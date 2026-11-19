import { Button, LinkButton } from '@/Components/ui/Button';
import { Card } from '@/Components/ui/Card';
import { Checkbox, Field, Input, Select, Textarea } from '@/Components/ui/Form';
import { PageHeader } from '@/Components/ui/PageHeader';
import { UserPicker } from '@/Components/ui/UserPicker';
import AppLayout from '@/Layouts/AppLayout';
import { UserLite } from '@/types/models';
import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface DepartmentForm {
    id: number;
    name: string;
    code: string;
    parent_id: number | null;
    description: string;
    is_active: boolean;
    sort_order: number;
    user_ids: number[];
    primary_user_id: number | null;
    report_viewer_ids: number[];
}

export default function Edit({
    department,
    parents,
    users,
}: {
    department: DepartmentForm;
    parents: { id: number; name: string }[];
    users: UserLite[];
}) {
    const form = useForm({
        name: department.name,
        code: department.code,
        parent_id: department.parent_id ? String(department.parent_id) : '',
        description: department.description ?? '',
        is_active: department.is_active,
        sort_order: String(department.sort_order ?? 0),
        user_ids: department.user_ids,
        primary_user_id: department.primary_user_id ? String(department.primary_user_id) : '',
        report_viewer_ids: department.report_viewer_ids ?? [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put(route('departments.update', department.id));
    };

    return (
        <AppLayout title={`Edit ${department.name}`}>
            <PageHeader
                title={`Edit ${department.name}`}
                description="Update details, hierarchy, and members."
                breadcrumbs={[
                    { label: 'Departments', href: route('departments.index') },
                    { label: department.name, href: route('departments.show', department.id) },
                    { label: 'Edit' },
                ]}
                actions={
                    <LinkButton href={route('departments.show', department.id)} variant="secondary">
                        Cancel
                    </LinkButton>
                }
            />

            <Card>
                <form onSubmit={submit} className="space-y-4 p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Name" error={form.errors.name} required>
                            <Input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} />
                        </Field>
                        <Field label="Code" error={form.errors.code} required>
                            <Input value={form.data.code} onChange={(e) => form.setData('code', e.target.value)} />
                        </Field>
                        <Field label="Parent" error={form.errors.parent_id} hint="Optional. Sets where this unit sits in the organogram.">
                            <Select value={form.data.parent_id} onChange={(e) => form.setData('parent_id', e.target.value)}>
                                <option value="">None (top level)</option>
                                {parents.map((parent) => (
                                    <option key={parent.id} value={parent.id}>
                                        {parent.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Sort order" error={form.errors.sort_order}>
                            <Input
                                type="number"
                                min={0}
                                value={form.data.sort_order}
                                onChange={(e) => form.setData('sort_order', e.target.value)}
                            />
                        </Field>
                    </div>

                    <Field label="Description" error={form.errors.description}>
                        <Textarea
                            rows={3}
                            value={form.data.description}
                            onChange={(e) => form.setData('description', e.target.value)}
                        />
                    </Field>

                    <Field label="Members" error={form.errors.user_ids}>
                        <UserPicker
                            users={users}
                            value={form.data.user_ids}
                            onChange={(ids) => {
                                form.setData('user_ids', ids);
                                if (form.data.primary_user_id && !ids.includes(Number(form.data.primary_user_id))) {
                                    form.setData('primary_user_id', '');
                                }
                            }}
                        />
                    </Field>

                    {form.data.user_ids.length > 0 && (
                        <Field label="Primary member" error={form.errors.primary_user_id} hint="Optional lead contact for this department.">
                            <Select
                                value={form.data.primary_user_id}
                                onChange={(e) => form.setData('primary_user_id', e.target.value)}
                            >
                                <option value="">None</option>
                                {users
                                    .filter((user) => form.data.user_ids.includes(user.id))
                                    .map((user) => (
                                        <option key={user.id} value={user.id}>
                                            {user.first_name} {user.last_name}
                                        </option>
                                    ))}
                            </Select>
                        </Field>
                    )}

                    <Field
                        label="Department report viewers"
                        error={form.errors.report_viewer_ids}
                        hint="Selected people can open this department’s report. Admins and users with report-all access already can."
                    >
                        <UserPicker
                            users={users}
                            value={form.data.report_viewer_ids}
                            onChange={(ids) => form.setData('report_viewer_ids', ids)}
                        />
                    </Field>

                    <Checkbox
                        label="Active"
                        description="Inactive departments stay in the chart but are marked clearly."
                        checked={form.data.is_active}
                        onChange={(e) => form.setData('is_active', e.target.checked)}
                    />

                    <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-night-800 pt-4">
                        <LinkButton href={route('departments.show', department.id)} variant="secondary">
                            Cancel
                        </LinkButton>
                        <Button type="submit" loading={form.processing}>
                            Save changes
                        </Button>
                    </div>
                </form>
            </Card>
        </AppLayout>
    );
}
