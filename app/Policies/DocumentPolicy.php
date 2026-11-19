<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;

class DocumentPolicy
{
    public function create(User $user): bool
    {
        return $user->canPerm('documents.create');
    }

    public function view(User $user, Document $document): bool
    {
        if (! $user->canPerm('documents.view') && ! $user->canPerm('documents.approve')) {
            return false;
        }

        return $document->isAccessibleBy($user);
    }

    public function update(User $user, Document $document): bool
    {
        if (! $user->canPerm('documents.update')) {
            return false;
        }

        if ($document->uploaded_by_id === $user->id) {
            return $user->belongsToDepartment($document->department_id) || $user->canPerm('documents.view_all');
        }

        return $user->canPerm('documents.view_all') || $user->belongsToDepartment($document->department_id);
    }

    public function delete(User $user, Document $document): bool
    {
        return $user->canPerm('documents.delete') && $this->update($user, $document);
    }

    public function approve(User $user, Document $document): bool
    {
        if (! $user->canPerm('documents.approve')) {
            return false;
        }

        if (! in_array($document->status, ['DRAFT', 'REVIEW'], true)) {
            return false;
        }

        return $document->isCurrentApprover($user);
    }

    public function sign(User $user, Document $document): bool
    {
        return $document->is_pdf
            && $user->canPerm('documents.sign')
            && $this->view($user, $document);
    }

    public function annotate(User $user, Document $document): bool
    {
        return $user->canPerm('documents.annotate') && $this->view($user, $document);
    }

    public function archive(User $user, Document $document): bool
    {
        return $user->canPerm('documents.archive') && $this->view($user, $document);
    }
}
