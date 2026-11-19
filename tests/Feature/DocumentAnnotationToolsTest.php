<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DocumentAnnotationToolsTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function user(string $role = 'contributor', array $attributes = []): User
    {
        return $this->dmsUser($role, $attributes);
    }

    private function document(User $owner): Document
    {
        return Document::create([
            'department_id' => $owner->departments()->first()?->id ?? $this->department()->id,
            'title' => 'Board form',
            'description' => '',
            'file_path' => UploadedFile::fake()->create('form.pdf', 100, 'application/pdf')->store('documents', 'local'),
            'file_size' => 100,
            'mime_type' => 'application/pdf',
            'status' => 'DRAFT',
            'uploaded_by_id' => $owner->id,
        ]);
    }

    public function test_user_can_place_text_name_and_date_notes(): void
    {
        $user = $this->user();
        $document = $this->document($user);

        $this->actingAs($user)->post(route('documents.annotations.store', $document), [
            'annotation_type' => 'NOTE',
            'page_number' => 1,
            'coordinates' => ['x' => 0.2, 'y' => 0.3, 'w' => 0.25, 'h' => 0.03],
            'content' => 'Confidential',
            'color' => '#0F172A',
        ])->assertRedirect();

        $this->actingAs($user)->post(route('documents.annotations.store', $document), [
            'annotation_type' => 'NOTE',
            'page_number' => 1,
            'coordinates' => ['x' => 0.2, 'y' => 0.4, 'w' => 0.3, 'h' => 0.03],
            'content' => 'Ada Mwale',
        ])->assertRedirect();

        $this->actingAs($user)->post(route('documents.annotations.store', $document), [
            'annotation_type' => 'NOTE',
            'page_number' => 1,
            'coordinates' => ['x' => 0.2, 'y' => 0.5, 'w' => 0.3, 'h' => 0.03],
            'content' => 'November 3, 2026',
        ])->assertRedirect();

        $this->assertDatabaseCount('document_annotations', 3);
        $this->assertDatabaseHas('document_annotations', [
            'document_id' => $document->id,
            'annotation_type' => 'NOTE',
            'content' => 'Ada Mwale',
        ]);
    }

    public function test_user_can_update_note_color_and_size(): void
    {
        $user = $this->user();
        $document = $this->document($user);

        $this->actingAs($user)->post(route('documents.annotations.store', $document), [
            'annotation_type' => 'NOTE',
            'page_number' => 1,
            'coordinates' => ['x' => 0.1, 'y' => 0.1, 'w' => 0.2, 'h' => 0.03],
            'content' => 'Draft text',
            'color' => '#0F172A',
        ])->assertRedirect();

        $note = $document->annotations()->firstOrFail();

        $this->actingAs($user)->put(route('annotations.update', $note), [
            'color' => '#B91C1C',
            'coordinates' => [
                'x' => 0.15,
                'y' => 0.2,
                'w' => 0.35,
                'h' => 0.05,
                'size' => 0.4,
                'bold' => true,
                'italic' => true,
            ],
        ])->assertRedirect();

        $note->refresh();
        $this->assertSame('#B91C1C', $note->color);
        $this->assertEqualsWithDelta(0.15, $note->coordinates['x'], 0.001);
        $this->assertEqualsWithDelta(0.05, $note->coordinates['h'], 0.001);
        $this->assertEqualsWithDelta(0.4, $note->coordinates['size'], 0.001);
        $this->assertTrue($note->coordinates['bold']);
        $this->assertTrue($note->coordinates['italic']);
    }

    public function test_user_can_flatten_text_notes_into_document(): void
    {
        $user = $this->user();
        $document = $this->document($user);

        $this->actingAs($user)->post(route('documents.annotations.store', $document), [
            'annotation_type' => 'NOTE',
            'page_number' => 1,
            'coordinates' => ['x' => 0.1, 'y' => 0.1, 'w' => 0.2, 'h' => 0.03, 'size' => 0.1],
            'content' => 'Henry Mikanda',
            'color' => '#0F172A',
        ])->assertRedirect();

        $this->assertDatabaseCount('document_annotations', 1);

        $this->actingAs($user)->post(route('documents.flatten', $document), [
            'marked_pdf' => UploadedFile::fake()->create('marked.pdf', 120, 'application/pdf'),
        ])->assertRedirect();

        $document->refresh();
        $this->assertNotNull($document->signed_file_path);
        $this->assertDatabaseCount('document_annotations', 0);
    }
}
