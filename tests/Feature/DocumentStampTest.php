<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentSignature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DocumentStampTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    private const STAMP = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function pdf(string $name = 'paper.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
    }

    private function user(string $role, array $attributes = []): User
    {
        return $this->dmsUser($role, $attributes);
    }

    private function document(User $owner, array $attributes = []): Document
    {
        return Document::create([
            'department_id' => $owner->departments()->first()?->id ?? $this->department()->id,
            'title' => 'Board minutes',
            'description' => '',
            'file_path' => $this->pdf()->store('documents', 'local'),
            'file_size' => 100,
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $owner->id,
            ...$attributes,
        ]);
    }

    public function test_approver_can_stamp_a_pdf(): void
    {
        $secretary = $this->user('contributor');
        $approver = $this->user('approver');
        $approver->forceFill(['is_approver' => true])->save();
        $document = $this->document($secretary);
        $document->visibleTo()->sync([$approver->id]);

        $this->actingAs($approver)
            ->from(route('documents.show', $document))
            ->post(route('documents.stamp', $document), [
                'stamped_pdf' => $this->pdf('stamped.pdf'),
                'stamp_image' => self::STAMP,
                'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]]),
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('documents.show', $document));

        $document->refresh();
        $stamp = DocumentSignature::firstOrFail();

        $this->assertTrue($document->is_signed);
        Storage::disk('local')->assertExists($document->signed_file_path);
        $this->assertSame($approver->id, $stamp->user_id);
        $this->assertSame('STAMP', $stamp->signature_type);
        $this->assertSame(64, strlen($stamp->verification_certificate));
        $this->assertDatabaseHas('app_notifications', ['user_id' => $secretary->id, 'title' => 'Document stamped']);
    }

    public function test_stamp_does_not_overwrite_signature_record(): void
    {
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($approver);

        $this->actingAs($approver)->post(route('documents.sign', $document), [
            'signed_pdf' => $this->pdf('signed.pdf'),
            'signature_image' => self::STAMP,
            'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]]),
        ])->assertSessionHasNoErrors();

        $this->actingAs($approver)->post(route('documents.stamp', $document), [
            'stamped_pdf' => $this->pdf('stamped.pdf'),
            'stamp_image' => self::STAMP,
            'placements' => json_encode([['page' => 1, 'x' => 0.2, 'y' => 0.2, 'w' => 0.2, 'h' => 0.1]]),
        ])->assertSessionHasNoErrors();

        $this->assertDatabaseCount('document_signatures', 2);
        $this->assertDatabaseHas('document_signatures', [
            'document_id' => $document->id,
            'user_id' => $approver->id,
            'signature_type' => 'INTERNAL',
        ]);
        $this->assertDatabaseHas('document_signatures', [
            'document_id' => $document->id,
            'user_id' => $approver->id,
            'signature_type' => 'STAMP',
        ]);
    }

    public function test_non_approver_cannot_stamp(): void
    {
        $secretary = $this->user('contributor');
        $member = $this->user('viewer');
        $document = $this->document($secretary);
        $document->visibleTo()->sync([$member->id]);

        $this->actingAs($member)
            ->post(route('documents.stamp', $document), [
                'stamped_pdf' => $this->pdf(),
                'stamp_image' => self::STAMP,
                'placements' => json_encode([['page' => 1, 'x' => 0, 'y' => 0, 'w' => 0.2, 'h' => 0.1]]),
            ])
            ->assertForbidden();
    }
}
