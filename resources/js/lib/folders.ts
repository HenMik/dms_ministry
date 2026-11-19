import { Category } from '@/types/models';

export function folderChildren(categories: Category[], parentId: string | number | null | undefined): Category[] {
    const key = parentId === '' || parentId === null || parentId === undefined ? null : Number(parentId);

    return categories
        .filter((c) => (c.parent_id ?? null) === key)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function folderPath(categories: Category[], folderId: string | number | null | undefined): Category[] {
    if (folderId === '' || folderId === null || folderId === undefined) {
        return [];
    }

    const byId = new Map(categories.map((c) => [c.id, c]));
    const path: Category[] = [];
    let current = byId.get(Number(folderId));

    while (current) {
        path.unshift(current);
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }

    return path;
}

export function folderLabel(categories: Category[], folderId: string | number | null | undefined): string {
    const path = folderPath(categories, folderId);
    return path.length ? path.map((c) => c.name).join(' / ') : 'Root';
}

export function csrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

export async function createFolderRequest(input: {
    name: string;
    parentId?: string | null;
    departmentIds?: number[];
}): Promise<{ folder: Category; categories: Category[] }> {
    const body = new FormData();
    body.append('name', input.name);
    body.append('json', '1');
    if (input.parentId) {
        body.append('parent_id', input.parentId);
    }
    (input.departmentIds ?? []).forEach((id, index) => {
        body.append(`department_ids[${index}]`, String(id));
    });

    const response = await fetch(route('categories.store'), {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        body,
        credentials: 'same-origin',
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload?.errors?.name?.[0] ?? payload?.message ?? 'Could not create the folder.');
    }

    return {
        folder: payload.folder,
        categories: payload.categories ?? [],
    };
}
