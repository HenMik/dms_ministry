<?php

namespace Tests\Feature;

use App\Models\Document;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CreatesDmsUsers;
use Tests\TestCase;

class DocumentVisibilityAccessTest extends TestCase
{
    use CreatesDmsUsers;
    use RefreshDatabase;

    public function test_document_without_department_is_private_until_shared(): void
    {
        Storage::fake('local');

        $uploader = $this->dmsUser('contributor');
        $outsider = $this->dmsUser('viewer', [], $this->department('HR'));

        $response = $this->actingAs($uploader)->post(route('documents.store'), [
            'title' => 'Private note',
            'description' => '',
            'file' => UploadedFile::fake()->create('note.pdf', 100, 'application/pdf'),
            'requires_approval' => false,
            'visible_to_ids' => [],
        ]);

        $response->assertRedirect();
        $document = Document::firstOrFail();
        $this->assertNull($document->department_id);
        $this->assertTrue($document->isAccessibleBy($uploader));
        $this->assertFalse($document->isAccessibleBy($outsider));
    }

    public function test_document_shared_with_people_is_accessible_without_department(): void
    {
        Storage::fake('local');

        $uploader = $this->dmsUser('contributor');
        $recipient = $this->dmsUser('viewer', [], $this->department('HR'));

        $this->actingAs($uploader)->post(route('documents.store'), [
            'title' => 'Shared note',
            'description' => '',
            'file' => UploadedFile::fake()->create('note.pdf', 100, 'application/pdf'),
            'requires_approval' => false,
            'visible_to_ids' => [$recipient->id],
        ])->assertRedirect();

        $document = Document::firstOrFail();
        $this->assertNull($document->department_id);
        $this->assertTrue($document->isAccessibleBy($recipient->fresh()));
    }

    public function test_document_sent_to_department_is_linked_to_that_department(): void
    {
        Storage::fake('local');

        $finance = $this->department('FIN');
        $uploader = $this->dmsUser('contributor', [], $finance);
        $colleague = $this->dmsUser('viewer', [], $finance);

        $this->actingAs($uploader)->post(route('documents.store'), [
            'title' => 'Finance memo',
            'description' => '',
            'department_id' => $finance->id,
            'file' => UploadedFile::fake()->create('memo.pdf', 100, 'application/pdf'),
            'requires_approval' => false,
            'visible_to_ids' => [],
        ])->assertRedirect();

        $document = Document::firstOrFail();
        $this->assertSame($finance->id, $document->department_id);
        $this->assertTrue($document->isAccessibleBy($colleague->fresh()));
    }
}
