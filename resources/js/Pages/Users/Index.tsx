import { SignatureModal } from '@/Components/Signature/SignatureModal';
import { Badge } from '@/Components/ui/Badge';
import { Button } from '@/Components/ui/Button';
import { Card } from '@/Components/ui/Card';
import { Dialog, useConfirm } from '@/Components/ui/Dialog';
import { Checkbox, Field, Input, Select } from '@/Components/ui/Form';
import { Menu } from '@/Components/ui/Menu';
import { Avatar, Paginated, Pagination } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatRelative } from '@/lib/format';
import { PageProps } from '@/types';
import { router, useForm, usePage } from '@inertiajs/react';
import { KeyRound, Pencil, PenLine, Stamp, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Role {
    id: number;
    name: string;
    display_name: string;
}

interface Department {
    id: number;
    name: string;
    code: string;
}

interface PositionOption {
    id: number;
    name: string;
    code?: string | null;
    department_id: number;
}

interface ManagedUser {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    role_id: number | null;
    role?: Role | null;
    departments?: Department[];
    position_ids?: number[];
    is_active: boolean;
    is_admin: boolean;
    is_approver: boolean;
    has_signature?: boolean;
    signature_image?: string | null;
    has_stamp?: boolean;
    stamp_image?: string | null;
    last_login?: string | null;
    updated_at: string;
}

const blank = {
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role_id: '',
    password: '',
    is_approver: false,
    is_admin: false,
    is_active: true,
    department_ids: [] as number[],
    primary_department_id: '',
    position_ids: [] as number[],
    signature_image: '',
    clear_signature: false,
    stamp_image: '',
    clear_stamp: false,
};
const DEFAULT_PASSWORD = 'ChangeMe123!';

export default function Index({
    users,
    roles,
    departments,
    positions = [],
}: {
    users: Paginated<ManagedUser>;
    roles: Role[];
    departments: Department[];
    positions?: PositionOption[];
}) {
    const { flash } = usePage<PageProps>().props;
    const { confirm, dialog } = useConfirm();
    const [editing, setEditing] = useState<ManagedUser | null>(null);
    const [open, setOpen] = useState(false);
    const [signOpen, setSignOpen] = useState(false);
    const [stampOpen, setStampOpen] = useState(false);
    const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
    const form = useForm({ ...blank });

    useEffect(() => {
        if (flash?.reset_password && flash.reset_password_user) {
            setResetResult({ email: flash.reset_password_user, password: flash.reset_password });
        }
    }, [flash?.reset_password, flash?.reset_password_user]);

    const openCreate = () => {
        setEditing(null);
        form.clearErrors();
        form.setData({ ...blank });
        setOpen(true);
    };

    const openEdit = (u: ManagedUser) => {
        setEditing(u);
        form.clearErrors();
        form.setData({
            first_name: u.first_name,
            last_name: u.last_name,
            email: u.email,
            phone_number: u.phone_number ?? '',
            role_id: u.role_id ? String(u.role_id) : '',
            password: '',
            is_approver: u.is_approver,
            is_admin: u.is_admin,
            is_active: u.is_active,
            department_ids: u.departments?.map((d) => d.id) ?? [],
            primary_department_id: '',
            position_ids: u.position_ids ?? [],
            signature_image: '',
            clear_signature: false,
            stamp_image: '',
            clear_stamp: false,
        });
        setOpen(true);
    };

    const save = () => {
        const options = { preserveScroll: true, onSuccess: () => setOpen(false) };
        if (editing) form.put(route('users.update', editing.id), options);
        else form.post(route('users.store'), options);
    };

    const resetPassword = (u: ManagedUser) => {
        confirm({
            title: 'Reset password',
            message: (
                <>
                    Reset the password for <span className="font-medium text-slate-900 dark:text-night-100">{u.first_name} {u.last_name}</span> to{' '}
                    <code className="rounded bg-slate-100 dark:bg-night-800 px-1.5 py-0.5 text-sm font-semibold text-slate-800 dark:text-night-200">{DEFAULT_PASSWORD}</code>? They will
                    be asked to change it at next sign-in.
                </>
            ),
            confirmLabel: 'Reset password',
            tone: 'primary',
            action: () =>
                router.post(route('users.reset-password', u.id), {}, { preserveScroll: true }),
        });
    };

    return (
        <AppLayout title="Users">
            <PageHeader
                title="Users"
                description="Provision board members and staff, assign roles and control access."
                actions={
                    <Button icon={UserPlus} onClick={openCreate}>
                        Add user
                    </Button>
                }
            />
            <Card>
                <div className="overflow-x-auto">
                    <table className="table-base">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th className="hidden md:table-cell">Role</th>
                                <th>Status</th>
                                <th className="hidden lg:table-cell">Permissions</th>
                                <th className="w-12" />
                            </tr>
                        </thead>
                        <tbody>
                            {users.data.map((u) => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <Avatar name={`${u.first_name} ${u.last_name}`} size="sm" />
                                            <div className="min-w-0">
                                                <p className="font-medium text-slate-900 dark:text-night-100">
                                                    {u.first_name} {u.last_name}
                                                </p>
                                                <p className="truncate text-xs text-slate-500 dark:text-night-400">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="hidden md:table-cell">{u.role?.display_name ?? <span className="text-slate-400">No role</span>}</td>
                                    <td>
                                        <Badge tone={u.is_active ? 'green' : 'gray'} dot>
                                            {u.is_active ? 'Active' : 'Disabled'}
                                        </Badge>
                                    </td>
                                    <td className="hidden lg:table-cell">
                                        <div className="flex flex-wrap gap-1.5">
                                            {u.is_admin && <Badge tone="violet">Admin</Badge>}
                                            {u.is_approver && <Badge tone="blue">Approver</Badge>}
                                            {u.has_signature && <Badge tone="gray">Signature</Badge>}
                                            {u.has_stamp && <Badge tone="gray">Stamp</Badge>}
                                            {!u.is_admin && !u.is_approver && !u.has_signature && !u.has_stamp && <span className="text-slate-400">—</span>}
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        <Menu
                                            align="right"
                                            items={[
                                                {
                                                    label: 'Edit',
                                                    icon: Pencil,
                                                    onClick: () => openEdit(u),
                                                },
                                                {
                                                    label: 'Reset password',
                                                    icon: KeyRound,
                                                    separatorBefore: true,
                                                    onClick: () => resetPassword(u),
                                                },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Pagination meta={users} />
            </Card>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title={editing ? `Edit ${editing.first_name} ${editing.last_name}` : 'Add user'}
                description={editing ? `Last updated ${formatRelative(editing.updated_at)}` : 'The user will be asked to change their password at first sign-in.'}
                size="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={save} loading={form.processing}>
                            {editing ? 'Save changes' : 'Create user'}
                        </Button>
                    </>
                }
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name" error={form.errors.first_name} required>
                        <Input value={form.data.first_name} onChange={(e) => form.setData('first_name', e.target.value)} />
                    </Field>
                    <Field label="Last name" error={form.errors.last_name} required>
                        <Input value={form.data.last_name} onChange={(e) => form.setData('last_name', e.target.value)} />
                    </Field>
                    <Field label="Email" error={form.errors.email} required>
                        <Input type="email" value={form.data.email} onChange={(e) => form.setData('email', e.target.value)} />
                    </Field>
                    <Field label="Phone" error={form.errors.phone_number}>
                        <Input value={form.data.phone_number} onChange={(e) => form.setData('phone_number', e.target.value)} />
                    </Field>
                    <Field label="Role" error={form.errors.role_id}>
                        <Select value={form.data.role_id} onChange={(e) => form.setData('role_id', e.target.value)}>
                            <option value="">No role</option>
                            {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                    {r.display_name}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Departments" error={form.errors.department_ids} className="sm:col-span-2">
                        <div className="grid max-h-40 gap-2 overflow-y-auto rounded-lg border border-slate-200 dark:border-night-700 p-3 sm:grid-cols-2">
                            {departments.map((d) => {
                                const departmentIds = form.data.department_ids ?? [];
                                const positionIds = form.data.position_ids ?? [];
                                const checked = departmentIds.includes(d.id);
                                return (
                                    <Checkbox
                                        key={d.id}
                                        label={d.name}
                                        checked={checked}
                                        onChange={(e) => {
                                            const next = e.target.checked
                                                ? [...departmentIds, d.id]
                                                : departmentIds.filter((id) => id !== d.id);
                                            form.setData((data) => ({
                                                ...data,
                                                department_ids: next,
                                                position_ids: e.target.checked
                                                    ? positionIds
                                                    : positionIds.filter((id) => {
                                                          const position = positions.find((p) => p.id === id);
                                                          return position && next.includes(position.department_id);
                                                      }),
                                            }));
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </Field>
                    <Field label="Positions" error={form.errors.position_ids} className="sm:col-span-2" hint="Filtered to the selected departments.">
                        <div className="grid max-h-40 gap-2 overflow-y-auto rounded-lg border border-slate-200 dark:border-night-700 p-3 sm:grid-cols-2">
                            {positions
                                .filter((p) => (form.data.department_ids ?? []).includes(p.department_id))
                                .map((p) => {
                                    const positionIds = form.data.position_ids ?? [];
                                    const checked = positionIds.includes(p.id);
                                    const dept = departments.find((d) => d.id === p.department_id);
                                    return (
                                        <Checkbox
                                            key={p.id}
                                            label={`${p.name}${dept ? ` (${dept.name})` : ''}`}
                                            checked={checked}
                                            onChange={(e) => {
                                                form.setData(
                                                    'position_ids',
                                                    e.target.checked
                                                        ? [...positionIds, p.id]
                                                        : positionIds.filter((id) => id !== p.id),
                                                );
                                            }}
                                        />
                                    );
                                })}
                            {positions.filter((p) => (form.data.department_ids ?? []).includes(p.department_id)).length === 0 && (
                                <p className="text-sm text-slate-500 dark:text-night-400 sm:col-span-2">Select departments first, or create positions under a department.</p>
                            )}
                        </div>
                    </Field>
                    <Field
                        label={editing ? 'Set password' : 'Temporary password'}
                        error={form.errors.password}
                        required={!editing}
                        hint={editing ? 'Leave blank to keep the current password.' : undefined}
                    >
                        <Input type="password" autoComplete="new-password" value={form.data.password} onChange={(e) => form.setData('password', e.target.value)} />
                    </Field>
                    <div className="space-y-3 sm:col-span-2">
                        <Checkbox label="Approver" description="Can be asked to approve documents." checked={form.data.is_approver} onChange={(e) => form.setData('is_approver', e.target.checked)} />
                        <Checkbox label="Administrator" description="Full access, including roles and audit log." checked={form.data.is_admin} onChange={(e) => form.setData('is_admin', e.target.checked)} />
                        {editing && (
                            <Checkbox label="Active" description="Disabled users cannot sign in." checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                        )}
                    </div>
                    {editing && (
                        <>
                            <div className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 dark:border-night-700 bg-slate-50/70 dark:bg-night-900/50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900 dark:text-night-100">Signature</p>
                                        <p className="text-xs text-slate-500 dark:text-night-400">Only administrators can assign signatures for signing documents.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="secondary" icon={PenLine} onClick={() => setSignOpen(true)}>
                                            {editing.has_signature || form.data.signature_image ? 'Change' : 'Assign'}
                                        </Button>
                                        {(editing.has_signature || form.data.signature_image) && !form.data.clear_signature && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                icon={Trash2}
                                                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => {
                                                    form.setData('signature_image', '');
                                                    form.setData('clear_signature', true);
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex h-28 items-center justify-center rounded-lg border border-slate-200 dark:border-night-700 bg-white p-3">
                                    {form.data.clear_signature ? (
                                        <p className="text-sm text-slate-500">Signature will be removed on save.</p>
                                    ) : form.data.signature_image || editing.signature_image ? (
                                        <img
                                            src={form.data.signature_image || editing.signature_image || ''}
                                            alt="Assigned signature"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-500">No signature assigned.</p>
                                    )}
                                </div>
                            </div>
                            <div className="sm:col-span-2 space-y-3 rounded-lg border border-slate-200 dark:border-night-700 bg-slate-50/70 dark:bg-night-900/50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-900 dark:text-night-100">Stamp</p>
                                        <p className="text-xs text-slate-500 dark:text-night-400">Only administrators can assign stamps for stamping documents.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" size="sm" variant="secondary" icon={Stamp} onClick={() => setStampOpen(true)}>
                                            {editing.has_stamp || form.data.stamp_image ? 'Change' : 'Assign'}
                                        </Button>
                                        {(editing.has_stamp || form.data.stamp_image) && !form.data.clear_stamp && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                icon={Trash2}
                                                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                                                onClick={() => {
                                                    form.setData('stamp_image', '');
                                                    form.setData('clear_stamp', true);
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex h-28 items-center justify-center rounded-lg border border-slate-200 dark:border-night-700 bg-white p-3">
                                    {form.data.clear_stamp ? (
                                        <p className="text-sm text-slate-500">Stamp will be removed on save.</p>
                                    ) : form.data.stamp_image || editing.stamp_image ? (
                                        <img
                                            src={form.data.stamp_image || editing.stamp_image || ''}
                                            alt="Assigned stamp"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-500">No stamp assigned.</p>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </Dialog>

            <SignatureModal
                open={signOpen}
                onClose={() => setSignOpen(false)}
                title="Assign signature"
                confirmLabel="Use signature"
                savedSignature={null}
                defaultName={editing ? `${editing.first_name} ${editing.last_name}` : ''}
                allowCreate
                allowSave={false}
                onConfirm={({ image }) => {
                    form.setData('signature_image', image);
                    form.setData('clear_signature', false);
                    setSignOpen(false);
                }}
            />

            <SignatureModal
                open={stampOpen}
                onClose={() => setStampOpen(false)}
                title="Assign stamp"
                confirmLabel="Use stamp"
                savedSignature={null}
                defaultName={editing ? `${editing.first_name} ${editing.last_name}` : ''}
                allowCreate
                allowSave={false}
                preserveColors
                onConfirm={({ image }) => {
                    form.setData('stamp_image', image);
                    form.setData('clear_stamp', false);
                    setStampOpen(false);
                }}
            />

            <Dialog
                open={!!resetResult}
                onClose={() => setResetResult(null)}
                title="Password reset"
                description={resetResult ? `Temporary password for ${resetResult.email}` : undefined}
                footer={
                    <Button onClick={() => setResetResult(null)}>Done</Button>
                }
            >
                {resetResult && (
                    <div className="rounded-lg border border-slate-200 dark:border-night-700 bg-slate-50 dark:bg-night-900/50 px-4 py-5 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-night-400">Temporary password</p>
                        <p className="mt-2 font-mono text-2xl font-semibold tracking-wide text-slate-900 dark:text-night-100">{resetResult.password}</p>
                        <p className="mt-3 text-sm text-slate-500 dark:text-night-400">Share this with the user. They must change it after signing in.</p>
                    </div>
                )}
            </Dialog>
            {dialog}
        </AppLayout>
    );
}
