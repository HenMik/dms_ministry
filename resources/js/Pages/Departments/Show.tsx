import { Badge } from '@/Components/ui/Badge';
import { Button, LinkButton } from '@/Components/ui/Button';
import { Card, CardHeader } from '@/Components/ui/Card';
import { Dialog, useConfirm } from '@/Components/ui/Dialog';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Checkbox, Field, Input, Textarea } from '@/Components/ui/Form';
import { Avatar } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import { UserPicker } from '@/Components/ui/UserPicker';
import AppLayout from '@/Layouts/AppLayout';
import { fullName, UserLite } from '@/types/models';
import { Link, router, useForm } from '@inertiajs/react';
import { BarChart3, Briefcase, Building2, FileText, FolderTree, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

interface Member {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    is_primary: boolean;
}

interface ChildDepartment {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
    users_count: number;
    documents_count: number;
}

interface PositionRow {
    id: number;
    name: string;
    code: string | null;
    description: string;
    is_active: boolean;
    users_count: number;
    user_ids: number[];
    users: UserLite[];
}

interface DepartmentDetail {
    id: number;
    name: string;
    code: string;
    description: string;
    is_active: boolean;
    sort_order: number;
    parent: { id: number; name: string; code: string } | null;
    users_count: number;
    documents_count: number;
    folders_count: number;
    children: ChildDepartment[];
    members: Member[];
    positions: PositionRow[];
}

export default function Show({ department }: { department: DepartmentDetail }) {
    const { confirm, dialog } = useConfirm();
    const [positionOpen, setPositionOpen] = useState(false);
    const [editingPosition, setEditingPosition] = useState<PositionRow | null>(null);
    const form = useForm({
        name: '',
        code: '',
        description: '',
        is_active: true,
        user_ids: [] as number[],
    });

    const openCreatePosition = () => {
        setEditingPosition(null);
        form.clearErrors();
        form.setData({ name: '', code: '', description: '', is_active: true, user_ids: [] });
        setPositionOpen(true);
    };

    const openEditPosition = (position: PositionRow) => {
        setEditingPosition(position);
        form.clearErrors();
        form.setData({
            name: position.name,
            code: position.code ?? '',
            description: position.description ?? '',
            is_active: position.is_active,
            user_ids: position.user_ids,
        });
        setPositionOpen(true);
    };

    const savePosition = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => setPositionOpen(false),
        };
        if (editingPosition) {
            form.put(route('positions.update', editingPosition.id), options);
        } else {
            form.post(route('positions.store', department.id), options);
        }
    };

    return (
        <AppLayout title={department.name}>
            <PageHeader
                title={department.name}
                description={department.description || 'No description yet.'}
                breadcrumbs={[
                    { label: 'Departments', href: route('departments.index') },
                    { label: department.name },
                ]}
                meta={
                    <>
                        <Badge>{department.code}</Badge>
                        {department.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Inactive</Badge>}
                        {department.parent && (
                            <span>
                                Under{' '}
                                <Link href={route('departments.show', department.parent.id)} className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
                                    {department.parent.name}
                                </Link>
                            </span>
                        )}
                    </>
                }
                actions={
                    <>
                        <LinkButton href={route('reports.department', department.id)} variant="secondary" icon={BarChart3}>
                            Report
                        </LinkButton>
                        <LinkButton href={route('departments.edit', department.id)} icon={Pencil}>
                            Edit
                        </LinkButton>
                        <Button
                            variant="ghost"
                            icon={Trash2}
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-300"
                            onClick={() =>
                                confirm({
                                    title: 'Delete department',
                                    message: `Delete ${department.name}? Child departments and documents must be removed first.`,
                                    confirmLabel: 'Delete',
                                    tone: 'danger',
                                    action: () => router.delete(route('departments.destroy', department.id)),
                                })
                            }
                        >
                            Delete
                        </Button>
                    </>
                }
            />

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <Card className="flex items-center gap-3 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300">
                        <Users className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-night-400">Members</p>
                        <p className="text-xl font-semibold text-slate-900 dark:text-night-100">{department.users_count}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300">
                        <FileText className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-night-400">Documents</p>
                        <p className="text-xl font-semibold text-slate-900 dark:text-night-100">{department.documents_count}</p>
                    </div>
                </Card>
                <Card className="flex items-center gap-3 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        <FolderTree className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-night-400">Folders</p>
                        <p className="text-xl font-semibold text-slate-900 dark:text-night-100">{department.folders_count}</p>
                    </div>
                </Card>
            </div>

            <Card className="mb-6">
                <CardHeader
                    title="Positions"
                    description="Job titles in this department. Upload to a position shares with everyone who holds it."
                    actions={
                        <Button size="sm" icon={Plus} onClick={openCreatePosition}>
                            Add position
                        </Button>
                    }
                />
                {department.positions.length === 0 ? (
                    <EmptyState icon={Briefcase} title="No positions" description="Create positions like ICT Officer, then assign people." />
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-night-800">
                        {department.positions.map((position) => (
                            <li key={position.id} className="flex items-center gap-3 px-5 py-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                                    <Briefcase className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium text-slate-900 dark:text-night-100">{position.name}</p>
                                        {position.code && <Badge>{position.code}</Badge>}
                                        {!position.is_active && <Badge tone="amber">Inactive</Badge>}
                                    </div>
                                    <p className="truncate text-xs text-slate-500 dark:text-night-400">
                                        {position.users_count} holder{position.users_count === 1 ? '' : 's'}
                                        {position.users.length
                                            ? ` · ${position.users.map((u) => fullName(u)).join(', ')}`
                                            : ''}
                                    </p>
                                </div>
                                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEditPosition(position)} aria-label="Edit" />
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    icon={Trash2}
                                    className="hover:text-red-600 dark:hover:text-red-400"
                                    aria-label="Delete"
                                    onClick={() =>
                                        confirm({
                                            title: 'Delete position',
                                            message: `Delete ${position.name}?`,
                                            confirmLabel: 'Delete',
                                            tone: 'danger',
                                            action: () => router.delete(route('positions.destroy', position.id), { preserveScroll: true }),
                                        })
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Members" description="People assigned to this department" />
                    {department.members.length === 0 ? (
                        <EmptyState icon={Users} title="No members" description="Edit the department to assign people." />
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-night-800">
                            {department.members.map((member) => (
                                <li key={member.id} className="flex items-center gap-3 px-5 py-3">
                                    <Avatar name={fullName(member)} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-900 dark:text-night-100">
                                            {fullName(member)}
                                            {member.is_primary && (
                                                <span className="ml-2 text-xs font-medium text-brand-700 dark:text-brand-300">Primary</span>
                                            )}
                                        </p>
                                        <p className="truncate text-xs text-slate-500 dark:text-night-400">{member.email}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card>
                    <CardHeader title="Child departments" description="Direct reports in the hierarchy" />
                    {department.children.length === 0 ? (
                        <EmptyState icon={Building2} title="No child departments" description="This department has no units under it." />
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-night-800">
                            {department.children.map((child) => (
                                <li key={child.id}>
                                    <Link
                                        href={route('departments.show', child.id)}
                                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-night-800/50"
                                    >
                                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-night-400">
                                            <Building2 className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-medium text-slate-900 dark:text-night-100">{child.name}</p>
                                                <Badge>{child.code}</Badge>
                                                {!child.is_active && <Badge tone="amber">Inactive</Badge>}
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-night-400">
                                                {child.users_count} members · {child.documents_count} documents
                                            </p>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <Dialog
                open={positionOpen}
                onClose={() => setPositionOpen(false)}
                title={editingPosition ? 'Edit position' : 'New position'}
                description={`Positions belong to ${department.name}.`}
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setPositionOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={savePosition} loading={form.processing}>
                            Save
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Field label="Name" error={form.errors.name} required>
                        <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} placeholder="ICT Officer" />
                    </Field>
                    <Field label="Code" error={form.errors.code}>
                        <Input value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} placeholder="ICT-OFF" />
                    </Field>
                    <Field label="Description" error={form.errors.description}>
                        <Textarea rows={2} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                    </Field>
                    <Field label="Holders" hint="Only department members can be assigned." error={form.errors.user_ids}>
                        <UserPicker
                            users={department.members}
                            value={form.data.user_ids}
                            onChange={(ids) => form.setData('user_ids', ids)}
                            placeholder="Assign people…"
                        />
                    </Field>
                    <Checkbox
                        label="Active"
                        checked={form.data.is_active}
                        onChange={(e) => form.setData('is_active', e.target.checked)}
                    />
                </div>
            </Dialog>
            {dialog}
        </AppLayout>
    );
}
