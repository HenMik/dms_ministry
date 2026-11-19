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

class DocumentSigningTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    private const SIGNATURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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
            'title' => 'Budget 2027',
            'description' => '',
            'file_path' => $this->pdf()->store('documents', 'local'),
            'file_size' => 100,
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $owner->id,
            ...$attributes,
        ]);
    }

    public function test_uploads_are_stored_privately_and_streamed_through_the_app(): void
    {
        $secretary = $this->user('contributor');

        $this->actingAs($secretary)->post('/documents', [
            'title' => 'Q3 report',
            'department_id' => $secretary->departments()->first()->id,
            'file' => $this->pdf(),
        ])->assertSessionHasNoErrors();

        $document = Document::firstOrFail();
        Storage::disk('local')->assertExists($document->file_path);
        $this->assertArrayNotHasKey('file_path', $document->toArray());

        $this->actingAs($secretary)->get(route('documents.file', $document))->assertOk();
    }

    public function test_approver_can_sign_a_pdf(): void
    {
        $secretary = $this->user('contributor');
        $approver = $this->user('approver');
        $approver->forceFill(['is_approver' => true])->save();
        $document = $this->document($secretary);
        $document->visibleTo()->sync([$approver->id]);

        $this->actingAs($approver)
            ->from(route('documents.show', $document))
            ->post(route('documents.sign', $document), [
                'signed_pdf' => $this->pdf('signed.pdf'),
                'signature_image' => self::SIGNATURE,
                'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]]),
                'save_signature' => '1',
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('documents.show', $document));

        $document->refresh();
        $signature = DocumentSignature::firstOrFail();

        $this->assertTrue($document->is_signed);
        Storage::disk('local')->assertExists($document->signed_file_path);
        $this->assertSame($approver->id, $signature->user_id);
        $this->assertSame('INTERNAL', $signature->signature_type);
        $this->assertSame(64, strlen($signature->verification_certificate));
        $this->assertDatabaseHas('app_notifications', ['user_id' => $secretary->id, 'title' => 'Document signed']);
    }

    public function test_non_approver_cannot_sign(): void
    {
        $secretary = $this->user('contributor');
        $member = $this->user('viewer');
        $document = $this->document($secretary);
        $document->visibleTo()->sync([$member->id]);

        $this->actingAs($member)
            ->post(route('documents.sign', $document), [
                'signed_pdf' => $this->pdf(),
                'signature_image' => self::SIGNATURE,
                'placements' => json_encode([['page' => 1, 'x' => 0, 'y' => 0, 'w' => 0.2, 'h' => 0.1]]),
            ])
            ->assertForbidden();
    }

    public function test_signing_requires_placements_and_a_png_signature(): void
    {
        $secretary = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($secretary);

        $this->actingAs($secretary)
            ->post(route('documents.sign', $document), [
                'signed_pdf' => $this->pdf(),
                'signature_image' => 'not-an-image',
                'placements' => json_encode([['page' => 1, 'x' => 0, 'y' => 0, 'w' => 0.2, 'h' => 0.1]]),
            ])
            ->assertSessionHasErrors('signature_image');

        $this->actingAs($secretary)
            ->post(route('documents.sign', $document), [
                'signed_pdf' => $this->pdf(),
                'signature_image' => self::SIGNATURE,
                'placements' => json_encode([]),
            ])
            ->assertSessionHasErrors('placements');

        $this->assertFalse($document->refresh()->is_signed);
    }

    public function test_auditor_cannot_sign(): void
    {
        $secretary = $this->user('contributor');
        $auditor = $this->user('auditor');
        $document = $this->document($secretary);

        $this->actingAs($auditor)
            ->post(route('documents.sign', $document), [
                'signed_pdf' => $this->pdf(),
                'signature_image' => self::SIGNATURE,
                'placements' => json_encode([['page' => 1, 'x' => 0, 'y' => 0, 'w' => 0.2, 'h' => 0.1]]),
            ])
            ->assertForbidden();
    }

    public function test_restricted_documents_are_hidden_from_other_members(): void
    {
        $secretary = $this->user('contributor');
        $allowed = $this->user('approver');
        $other = $this->user('approver');
        $document = $this->document($secretary);
        $document->visibleTo()->sync([$allowed->id]);

        $this->actingAs($allowed)->get(route('documents.show', $document))->assertOk();
        $this->actingAs($other)->get(route('documents.show', $document))->assertForbidden();
        $this->actingAs($other)->get(route('documents.file', $document))->assertForbidden();
    }

    public function test_original_version_remains_downloadable_after_signing(): void
    {
        $secretary = $this->user('contributor');
        $document = $this->document($secretary, ['signed_file_path' => $this->pdf()->store('documents/signed', 'local')]);

        $this->actingAs($secretary)
            ->get(route('documents.download', ['document' => $document, 'version' => 'original']))
            ->assertOk()
            ->assertDownload('budget-2027.pdf');

        $this->actingAs($secretary)
            ->get(route('documents.download', $document))
            ->assertDownload('budget-2027-signed.pdf');
    }
}
