import { Button } from '@/Components/ui/Button';
import { Card, CardHeader } from '@/Components/ui/Card';
import { Dialog, useConfirm } from '@/Components/ui/Dialog';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Field, Input, Select, Textarea } from '@/Components/ui/Form';
import { PageHeader } from '@/Components/ui/PageHeader';
import { UserPicker } from '@/Components/ui/UserPicker';
import AppLayout from '@/Layouts/AppLayout';
import { PageProps } from '@/types';
import { UserLite } from '@/types/models';
import { router, useForm, usePage } from '@inertiajs/react';
import { Folder, FolderPlus, Lock, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Category {
    id: number;
    name: string;
    description: string | null;
    parent_id: number | null;
    parent?: { id: number; name: string } | null;
    documents_count: number;
    visible_to?: UserLite[];
}

export default function Index({
    categories,
    parents,
    users = [],
}: {
    categories: Category[];
    parents: { id: number; name: string }[];
    users?: UserLite[];
}) {
    const { auth } = usePage<PageProps>().props;
    const { confirm, dialog } = useConfirm();
    const [editing, setEditing] = useState<Category | null>(null);
    const [open, setOpen] = useState(false);
    const form = useForm({ name: '', description: '', parent_id: '', visible_to_ids: [] as number[] });

    const openForm = (c: Category | null) => {
        setEditing(c);
        form.clearErrors();
        form.setData({
            name: c?.name ?? '',
            description: c?.description ?? '',
            parent_id: c?.parent_id ? String(c.parent_id) : '',
            visible_to_ids: c?.visible_to?.map((u) => u.id) ?? [],
        });
        setOpen(true);
    };

    const save = () => {
        const options = { preserveScroll: true, onSuccess: () => setOpen(false) };
        if (editing) form.put(route('categories.update', editing.id), options);
        else form.post(route('categories.store'), options);
    };

    return (
        <AppLayout title="Folders">
            <PageHeader
                title="Folders"
                description="Organise documents into department folders. Restrict a folder to specific people when needed."
                actions={
                    <Button icon={FolderPlus} onClick={() => openForm(null)}>
                        New folder
                    </Button>
                }
            />
            <Card>
                <CardHeader title={`${categories.length} folders`} />
                {categories.length === 0 ? (
                    <EmptyState icon={Folder} title="No folders yet" />
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-night-800">
                        {categories.map((c) => (
                            <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300">
                                    <Folder className="h-[18px] w-[18px]" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium text-slate-900 dark:text-night-100">
                                            {c.parent && <span className="text-slate-400">{c.parent.name} / </span>}
                                            {c.name}
                                        </p>
                                        {(c.visible_to?.length ?? 0) > 0 && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                                <Lock className="h-3 w-3" /> {c.visible_to!.length} people
                                            </span>
                                        )}
                                    </div>
                                    {c.description && <p className="truncate text-xs text-slate-500 dark:text-night-400">{c.description}</p>}
                                </div>
                                <span className="text-sm text-slate-500 dark:text-night-400">{c.documents_count} docs</span>
                                <Button size="icon-sm" variant="ghost" icon={Pencil} onClick={() => openForm(c)} aria-label="Edit" />
                                {auth.user.is_admin && (
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        icon={Trash2}
                                        className="hover:text-red-600 dark:hover:text-red-400"
                                        aria-label="Delete"
                                        onClick={() =>
                                            confirm({
                                                title: 'Delete folder',
                                                message: `Documents in “${c.name}” will become uncategorised.`,
                                                confirmLabel: 'Delete',
                                                action: () => router.delete(route('categories.destroy', c.id), { preserveScroll: true }),
                                            })
                                        }
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title={editing ? 'Edit folder' : 'New folder'}
                size="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={save} loading={form.processing}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Field label="Name" error={form.errors.name} required>
                        <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} autoFocus />
                    </Field>
                    <Field label="Parent">
                        <Select value={form.data.parent_id} onChange={(e) => form.setData('parent_id', e.target.value)}>
                            <option value="">None (top level)</option>
                            {parents
                                .filter((p) => p.id !== editing?.id)
                                .map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}
                                    </option>
                                ))}
                        </Select>
                    </Field>
                    <Field label="Description">
                        <Textarea rows={2} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                    </Field>
                    <Field
                        label="Visible to"
                        hint="Leave empty for everyone in the department. Choose people to restrict access."
                        error={form.errors.visible_to_ids}
                    >
                        <UserPicker
                            users={users}
                            value={form.data.visible_to_ids}
                            onChange={(ids) => form.setData('visible_to_ids', ids)}
                            placeholder="Everyone in the department"
                        />
                    </Field>
                </div>
            </Dialog>
            {dialog}
        </AppLayout>
    );
}
