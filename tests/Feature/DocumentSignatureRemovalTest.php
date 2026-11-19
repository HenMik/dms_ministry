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

class DocumentSignatureRemovalTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    private const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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

    public function test_user_can_remove_their_latest_signature_and_restore_previous_pdf(): void
    {
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($approver);

        $this->actingAs($approver)->post(route('documents.sign', $document), [
            'signed_pdf' => $this->pdf('signed.pdf'),
            'signature_image' => self::IMAGE,
            'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]]),
        ])->assertSessionHasNoErrors();

        $document->refresh();
        $signature = DocumentSignature::firstOrFail();
        $signedPath = $document->signed_file_path;

        $this->actingAs($approver)
            ->from(route('documents.show', $document))
            ->delete(route('signatures.destroy', $signature))
            ->assertRedirect(route('documents.show', $document))
            ->assertSessionHas('success');

        $document->refresh();
        $this->assertNull($document->signed_file_path);
        $this->assertDatabaseCount('document_signatures', 0);
        Storage::disk('local')->assertMissing($signedPath);
    }

    public function test_user_can_remove_their_latest_stamp(): void
    {
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($approver);

        $this->actingAs($approver)->post(route('documents.stamp', $document), [
            'stamped_pdf' => $this->pdf('stamped.pdf'),
            'stamp_image' => self::IMAGE,
            'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.2, 'w' => 0.2, 'h' => 0.1]]),
        ])->assertSessionHasNoErrors();

        $stamp = DocumentSignature::firstOrFail();

        $this->actingAs($approver)
            ->delete(route('signatures.destroy', $stamp))
            ->assertSessionHas('success');

        $this->assertDatabaseCount('document_signatures', 0);
        $this->assertNull($document->fresh()->signed_file_path);
    }

    public function test_cannot_remove_mark_that_is_not_the_latest_file_version(): void
    {
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($approver);

        $this->actingAs($approver)->post(route('documents.sign', $document), [
            'signed_pdf' => $this->pdf('signed.pdf'),
            'signature_image' => self::IMAGE,
            'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]]),
        ])->assertSessionHasNoErrors();

        $signature = DocumentSignature::firstOrFail();

        $this->actingAs($approver)->post(route('documents.stamp', $document), [
            'stamped_pdf' => $this->pdf('stamped.pdf'),
            'stamp_image' => self::IMAGE,
            'placements' => json_encode([['page' => 1, 'x' => 0.2, 'y' => 0.2, 'w' => 0.2, 'h' => 0.1]]),
        ])->assertSessionHasNoErrors();

        $this->actingAs($approver)
            ->from(route('documents.show', $document))
            ->delete(route('signatures.destroy', $signature))
            ->assertRedirect(route('documents.show', $document))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('document_signatures', ['id' => $signature->id]);
        $this->assertNotNull($document->fresh()->signed_file_path);
    }

    public function test_other_users_cannot_remove_someone_elses_signature(): void
    {
        $owner = $this->user('approver', ['is_approver' => true]);
        $other = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($owner);
        $document->visibleTo()->sync([$other->id]);

        $this->actingAs($owner)->post(route('documents.sign', $document), [
            'signed_pdf' => $this->pdf('signed.pdf'),
            'signature_image' => self::IMAGE,
            'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]]),
        ])->assertSessionHasNoErrors();

        $signature = DocumentSignature::firstOrFail();

        $this->actingAs($other)
            ->delete(route('signatures.destroy', $signature))
            ->assertForbidden();
    }

    public function test_removing_stamp_without_previous_path_restores_earlier_signature_file(): void
    {
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($approver);

        $this->actingAs($approver)->post(route('documents.sign', $document), [
            'signed_pdf' => $this->pdf('signed.pdf'),
            'signature_image' => self::IMAGE,
            'placements' => json_encode([['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]]),
        ])->assertSessionHasNoErrors();

        $signature = DocumentSignature::firstOrFail();
        $signedPath = $document->fresh()->signed_file_path;

        $stampPath = $this->pdf('stamped.pdf')->storeAs('documents/signed', 'manual-stamp.pdf', 'local');
        $stamp = DocumentSignature::create([
            'document_id' => $document->id,
            'user_id' => $approver->id,
            'signature_type' => 'STAMP',
            'signature_data' => [
                'image' => self::IMAGE,
                'placements' => [['page' => 1, 'x' => 0.2, 'y' => 0.2, 'w' => 0.2, 'h' => 0.1]],
                'file_path' => $stampPath,
                // Intentionally missing previous_file_path (legacy / buggy records).
            ],
            'signed_at' => now(),
            'verified' => true,
            'verification_certificate' => str_repeat('b', 64),
        ]);
        $document->update(['signed_file_path' => $stampPath]);

        $this->actingAs($approver)
            ->delete(route('signatures.destroy', $stamp))
            ->assertSessionHas('success');

        $this->assertSame($signedPath, $document->fresh()->signed_file_path);
        $this->assertDatabaseHas('document_signatures', ['id' => $signature->id]);
        $this->assertDatabaseMissing('document_signatures', ['id' => $stamp->id]);
    }

    public function test_show_heals_missing_signed_file_path_from_signature_records(): void
    {
        $approver = $this->user('approver', ['is_approver' => true]);
        $document = $this->document($approver);
        $signedPath = $this->pdf('signed.pdf')->storeAs('documents/signed', 'healed.pdf', 'local');

        DocumentSignature::create([
            'document_id' => $document->id,
            'user_id' => $approver->id,
            'signature_type' => 'INTERNAL',
            'signature_data' => [
                'image' => self::IMAGE,
                'placements' => [['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.25, 'h' => 0.08]],
                'file_path' => $signedPath,
            ],
            'signed_at' => now(),
            'verified' => true,
            'verification_certificate' => str_repeat('c', 64),
        ]);
        $document->update(['signed_file_path' => null]);

        $this->actingAs($approver)
            ->get(route('documents.show', $document))
            ->assertOk();

        $this->assertSame($signedPath, $document->fresh()->signed_file_path);
    }
}
