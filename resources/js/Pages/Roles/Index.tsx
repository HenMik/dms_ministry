import { Button } from '@/Components/ui/Button';
import { Card } from '@/Components/ui/Card';
import { useConfirm } from '@/Components/ui/Dialog';
import { Checkbox, Field, Input, Textarea } from '@/Components/ui/Form';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { router, useForm } from '@inertiajs/react';
import { Plus, Trash2, Users } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface Role {
    id: number;
    name: string;
    display_name: string;
    description: string | null;
    permissions: Record<string, boolean>;
    users_count: number;
    is_admin_role: boolean;
}

interface PermissionGroup {
    [group: string]: { key: string; label: string }[];
}

export default function Index({ roles, permissionGroups }: { roles: Role[]; permissionGroups: PermissionGroup }) {
    const { confirm, dialog } = useConfirm();
    const [creating, setCreating] = useState(false);
    const createForm = useForm({
        name: '',
        display_name: '',
        description: '',
        permissions: {} as Record<string, boolean>,
    });

    const create = (e: FormEvent) => {
        e.preventDefault();
        createForm.post(route('roles.store'), {
            preserveScroll: true,
            onSuccess: () => {
                createForm.reset();
                setCreating(false);
            },
        });
    };

    return (
        <AppLayout title="Roles">
            <PageHeader
                title="Roles"
                description="Define dynamic roles and assign permissions from the catalog."
                actions={
                    <Button icon={Plus} onClick={() => setCreating((v) => !v)}>
                        {creating ? 'Cancel' : 'New role'}
                    </Button>
                }
            />

            {creating && (
                <Card className="mb-6">
                    <form onSubmit={create} className="space-y-4 p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Key" error={createForm.errors.name}>
                                <Input value={createForm.data.name} onChange={(e) => createForm.setData('name', e.target.value)} placeholder="department_lead" />
                            </Field>
                            <Field label="Display name" error={createForm.errors.display_name}>
                                <Input value={createForm.data.display_name} onChange={(e) => createForm.setData('display_name', e.target.value)} />
                            </Field>
                        </div>
                        <Field label="Description">
                            <Textarea rows={2} value={createForm.data.description} onChange={(e) => createForm.setData('description', e.target.value)} />
                        </Field>
                        <PermissionEditor
                            groups={permissionGroups}
                            value={createForm.data.permissions}
                            onChange={(permissions) => createForm.setData('permissions', permissions)}
                        />
                        <div className="flex justify-end">
                            <Button type="submit" loading={createForm.processing}>
                                Create role
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                {roles.map((role) => (
                    <RoleCard
                        key={role.id}
                        role={role}
                        permissionGroups={permissionGroups}
                        onDelete={() =>
                            confirm({
                                title: 'Delete role',
                                message: `Delete ${role.display_name}?`,
                                confirmLabel: 'Delete',
                                tone: 'danger',
                                action: () => router.delete(route('roles.destroy', role.id), { preserveScroll: true }),
                            })
                        }
                    />
                ))}
            </div>
            {dialog}
        </AppLayout>
    );
}

function RoleCard({
    role,
    permissionGroups,
    onDelete,
}: {
    role: Role;
    permissionGroups: PermissionGroup;
    onDelete: () => void;
}) {
    const form = useForm({
        name: role.name,
        display_name: role.display_name,
        description: role.description ?? '',
        permissions: { ...role.permissions },
    });

    return (
        <Card>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    form.put(route('roles.update', role.id), { preserveScroll: true });
                }}
                className="space-y-4 p-5"
            >
                <div className="flex items-center justify-between gap-3">
                    <code className="rounded bg-slate-100 dark:bg-night-800 px-1.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-night-400">{role.name}</code>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-night-400">
                            <Users className="h-4 w-4" /> {role.users_count}
                        </span>
                        {!role.is_admin_role && role.users_count === 0 && (
                            <Button type="button" size="sm" variant="ghost" icon={Trash2} onClick={onDelete} />
                        )}
                    </div>
                </div>
                <Field label="Display name" error={form.errors.display_name}>
                    <Input value={form.data.display_name} onChange={(e) => form.setData('display_name', e.target.value)} />
                </Field>
                <Field label="Description">
                    <Textarea rows={2} value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} />
                </Field>
                {role.is_admin_role ? (
                    <p className="rounded-lg bg-slate-50 dark:bg-night-900/50 px-3 py-2 text-sm text-slate-600 dark:text-night-400">Administrator always has full access (`*`).</p>
                ) : (
                    <PermissionEditor
                        groups={permissionGroups}
                        value={form.data.permissions}
                        onChange={(permissions) => form.setData('permissions', permissions)}
                    />
                )}
                <div className="flex justify-end">
                    <Button type="submit" size="sm" variant="secondary" loading={form.processing} disabled={!form.isDirty}>
                        Save
                    </Button>
                </div>
            </form>
        </Card>
    );
}

function PermissionEditor({
    groups,
    value,
    onChange,
}: {
    groups: PermissionGroup;
    value: Record<string, boolean>;
    onChange: (next: Record<string, boolean>) => void;
}) {
    return (
        <div className="space-y-4">
            {Object.entries(groups).map(([group, items]) => (
                <div key={group}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-night-400">{group}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((item) => (
                            <div key={item.key} className="rounded-lg border border-slate-200 dark:border-night-700 px-3 py-2">
                                <Checkbox
                                    label={
                                        <span>
                                            <span className="block font-medium text-slate-800 dark:text-night-200">{item.label}</span>
                                            <code className="text-[11px] text-slate-400">{item.key}</code>
                                        </span>
                                    }
                                    checked={!!value[item.key]}
                                    onChange={(e) => onChange({ ...value, [item.key]: e.target.checked })}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
