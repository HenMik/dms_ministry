import { Organogram, OrgNode } from '@/Components/Departments/Organogram';
import { Badge } from '@/Components/ui/Badge';
import { Button, LinkButton } from '@/Components/ui/Button';
import { Card, CardHeader } from '@/Components/ui/Card';
import { useConfirm } from '@/Components/ui/Dialog';
import { Checkbox, Field, Input, Select, Textarea } from '@/Components/ui/Form';
import { PageHeader } from '@/Components/ui/PageHeader';
import { UserPicker } from '@/Components/ui/UserPicker';
import AppLayout from '@/Layouts/AppLayout';
import { UserLite } from '@/types/models';
import { Link, router, useForm } from '@inertiajs/react';
import { Building2, Eye, Network, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface Department {
    id: number;
    name: string;
    code: string;
    parent_id: number | null;
    parent?: { id: number; name: string } | null;
    description: string;
    is_active: boolean;
    sort_order: number;
    users_count: number;
    documents_count: number;
}

export default function Index({
    departments,
    organogram,
    parents,
    users,
}: {
    departments: Department[];
    organogram: OrgNode[];
    parents: { id: number; name: string }[];
    users: UserLite[];
}) {
    const { confirm, dialog } = useConfirm();
    const [creating, setCreating] = useState(false);
    const form = useForm({
        name: '',
        code: '',
        parent_id: '',
        description: '',
        is_active: true,
        sort_order: '0',
        user_ids: [] as number[],
        primary_user_id: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('departments.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setCreating(false);
            },
        });
    };

    return (
        <AppLayout title="Departments">
            <PageHeader
                title="Departments"
                description="View the organisation chart, open a department, or edit its details and members."
                actions={
                    <Button icon={Plus} onClick={() => setCreating((v) => !v)}>
                        {creating ? 'Cancel' : 'Add department'}
                    </Button>
                }
            />

            {creating && (
                <Card className="mb-6">
                    <form onSubmit={submit} className="space-y-4 p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Name" error={form.errors.name} required>
                                <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                            </Field>
                            <Field label="Code" error={form.errors.code}>
                                <Input value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} placeholder="FIN" />
                            </Field>
                            <Field label="Parent" hint="Optional. Places this unit under another in the organogram.">
                                <Select value={form.data.parent_id} onChange={(e) => form.setData('parent_id', e.target.value)}>
                                    <option value="">None (top level)</option>
                                    {parents.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Sort order">
                                <Input type="number" value={form.data.sort_order} onChange={(e) => form.setData('sort_order', e.target.value)} />
                            </Field>
                        </div>
                        <Field label="Description">
                            <Textarea rows={2} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                        </Field>
                        <Field label="Members">
                            <UserPicker
                                users={users}
                                value={form.data.user_ids}
                                onChange={(ids) => form.setData('user_ids', ids)}
                            />
                        </Field>
                        <Checkbox label="Active" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                        <div className="flex justify-end">
                            <Button type="submit" loading={form.processing}>
                                Create
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            <Card className="mb-6">
                <CardHeader
                    title={
                        <span className="inline-flex items-center gap-2">
                            <Network className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                            Organogram
                        </span>
                    }
                    description="Hierarchy of departments across the organisation. Click a box to view details."
                />
                <div className="p-5 pt-2">
                    <Organogram roots={organogram} />
                </div>
            </Card>

            <Card>
                <CardHeader title="All departments" description={`${departments.length} total`} />
                {departments.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-slate-500 dark:text-night-400">
                        <Building2 className="h-8 w-8" />
                        <p>No departments yet.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-night-800">
                        {departments.map((department) => (
                            <li key={department.id} className="flex items-center gap-4 px-5 py-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href={route('departments.show', department.id)}
                                            className="font-medium text-slate-900 dark:text-night-100 hover:text-brand-800 dark:hover:text-brand-300"
                                        >
                                            {department.name}
                                        </Link>
                                        <Badge>{department.code}</Badge>
                                        {!department.is_active && <Badge tone="amber">Inactive</Badge>}
                                    </div>
                                    <p className="mt-1 text-sm text-slate-500 dark:text-night-400">
                                        {department.parent ? `Under ${department.parent.name} · ` : ''}
                                        {department.users_count} users · {department.documents_count} documents
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <LinkButton
                                        href={route('departments.show', department.id)}
                                        size="sm"
                                        variant="ghost"
                                        icon={Eye}
                                        aria-label={`View ${department.name}`}
                                    />
                                    <LinkButton
                                        href={route('departments.edit', department.id)}
                                        size="sm"
                                        variant="ghost"
                                        icon={Pencil}
                                        aria-label={`Edit ${department.name}`}
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        icon={Trash2}
                                        className="hover:text-red-600 dark:hover:text-red-400"
                                        aria-label={`Delete ${department.name}`}
                                        onClick={() =>
                                            confirm({
                                                title: 'Delete department',
                                                message: `Delete ${department.name}?`,
                                                confirmLabel: 'Delete',
                                                tone: 'danger',
                                                action: () =>
                                                    router.delete(route('departments.destroy', department.id), {
                                                        preserveScroll: true,
                                                    }),
                                            })
                                        }
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            {dialog}
        </AppLayout>
    );
}
