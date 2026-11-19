<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentAnnotation;
use App\Models\DocumentSignature;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DocumentPagesTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function pdf(string $name = 'paper.pdf'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
    }

    private function user(string $role = 'contributor', array $attributes = []): User
    {
        return $this->dmsUser($role, $attributes);
    }

    private function document(User $owner, array $attributes = []): Document
    {
        return Document::create([
            'department_id' => $owner->departments()->first()?->id ?? $this->department()->id,
            'title' => 'Packet',
            'description' => '',
            'file_path' => $this->pdf()->store('documents', 'local'),
            'file_size' => 100,
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $owner->id,
            ...$attributes,
        ]);
    }

    public function test_owner_can_update_pages_and_overlays_are_cleared(): void
    {
        $owner = $this->user();
        $document = $this->document($owner);

        DocumentAnnotation::create([
            'document_id' => $document->id,
            'user_id' => $owner->id,
            'annotation_type' => 'NOTE',
            'page_number' => 1,
            'coordinates' => ['x' => 0.1, 'y' => 0.1, 'w' => 0.2, 'h' => 0.05],
            'content' => 'Mark',
            'color' => '#0F172A',
        ]);

        DocumentSignature::create([
            'document_id' => $document->id,
            'user_id' => $owner->id,
            'signature_type' => 'INTERNAL',
            'signature_data' => ['placements' => [['page' => 1, 'x' => 0.1, 'y' => 0.8, 'w' => 0.2, 'h' => 0.1]]],
            'signed_at' => now(),
            'verified' => true,
            'verification_certificate' => str_repeat('a', 64),
        ]);

        $this->actingAs($owner)
            ->from(route('documents.show', $document))
            ->post(route('documents.pages', $document), [
                'pages_pdf' => $this->pdf('reordered.pdf'),
            ])
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('documents.show', $document));

        $document->refresh();
        $this->assertNotNull($document->signed_file_path);
        Storage::disk('local')->assertExists($document->signed_file_path);
        $this->assertDatabaseCount('document_annotations', 0);
        $this->assertDatabaseCount('document_signatures', 0);
    }

    public function test_viewer_without_update_permission_cannot_edit_pages(): void
    {
        $owner = $this->user('contributor');
        $viewer = $this->user('viewer');
        $document = $this->document($owner);
        $document->visibleTo()->sync([$viewer->id]);

        $this->actingAs($viewer)
            ->post(route('documents.pages', $document), [
                'pages_pdf' => $this->pdf(),
            ])
            ->assertForbidden();
    }
}
