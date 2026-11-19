import { FolderDestination } from '@/Components/Documents/FolderDestination';
import { Button, LinkButton } from '@/Components/ui/Button';
import { Card } from '@/Components/ui/Card';
import { FileDrop } from '@/Components/ui/FileDrop';
import { Checkbox, Field, Input, Select, Textarea } from '@/Components/ui/Form';
import { Alert } from '@/Components/ui/misc';
import { UserPicker } from '@/Components/ui/UserPicker';
import AppLayout from '@/Layouts/AppLayout';
import { cn } from '@/lib/cn';
import { titleFromFileName } from '@/lib/documentTitle';
import { Category, DocumentRecord, UserLite } from '@/types/models';
import { Link, useForm } from '@inertiajs/react';
import { ArrowLeft, ChevronDown, FileUp, ShieldCheck, Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface DepartmentOption {
    id: number;
    name: string;
    code: string;
}

interface Props {
    document: DocumentRecord | null;
    categories: Category[];
    departments: DepartmentOption[];
    users: UserLite[];
    defaultFolderId?: number | null;
}

const MAX_BYTES = 100 * 1024 * 1024;

export default function Form({ document: doc, categories: initialCategories, departments, users, defaultFolderId }: Props) {
    const editing = !!doc;
    const initialFolder = doc?.category_id ?? defaultFolderId ?? null;
    const [categories, setCategories] = useState(initialCategories);
    const [titleLockedFromFile, setTitleLockedFromFile] = useState(!editing);
    const [showMore, setShowMore] = useState(editing);

    const initialDepartment =
        (doc as DocumentRecord & { department_id?: number | null })?.department_id ?? departments[0]?.id ?? null;

    const { data, setData, post, processing, errors, progress } = useForm({
        _method: editing ? 'put' : 'post',
        title: doc?.title ?? '',
        description: doc?.description ?? '',
        department_id: initialDepartment ? String(initialDepartment) : '',
        category_id: initialFolder ? String(initialFolder) : '',
        file: null as File | null,
        status: doc?.status ?? 'DRAFT',
        requires_approval: doc?.requires_approval ?? false,
        access_expires_at: doc?.access_expires_at ? doc.access_expires_at.slice(0, 10) : '',
        visible_to_ids: doc?.visible_to?.map((u) => u.id) ?? ([] as number[]),
        pending_approver_ids: doc?.pending_approvers?.map((u) => u.id) ?? ([] as number[]),
    });

    const onFileChange = (file: File | null) => {
        setData((current) => {
            const shouldFillFromFile = !!file && (titleLockedFromFile || !current.title.trim());

            return {
                ...current,
                file,
                title: shouldFillFromFile && file ? titleFromFileName(file.name) : current.title,
            };
        });

        if (file) {
            setTitleLockedFromFile((locked) => locked || !data.title.trim());
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(editing ? route('documents.update', doc!.id) : route('documents.store'), { forceFormData: true });
    };

    const ready = editing || (!!data.file && !!data.title.trim());

    return (
        <AppLayout title={editing ? `Edit ${doc!.title}` : 'Upload'}>
            <div className="mx-auto max-w-3xl">
                <div className="mb-6">
                    <Link
                        href={
                            editing
                                ? route('documents.show', doc!.id)
                                : route('documents.index', data.category_id ? { folder: data.category_id } : {})
                        }
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-night-400 transition hover:text-slate-800 dark:hover:text-night-200"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                    <div className="mt-4 flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-900/20">
                            <FileUp className="h-5 w-5" />
                        </span>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-night-100">
                                {editing ? 'Update document' : 'Upload a document'}
                            </h1>
                            <p className="mt-1 text-sm text-slate-500 dark:text-night-400">
                                {editing
                                    ? 'Replace the file or adjust details, access, and approval.'
                                    : 'Drop a file, confirm the name, and choose where it lives. That’s it.'}
                            </p>
                        </div>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-5">
                    <Card className="overflow-hidden border-slate-200/80 dark:border-night-700/80">
                        <div className="border-b border-slate-100 dark:border-night-800 bg-gradient-to-br from-slate-50 via-white to-brand-50/40 dark:from-night-900 dark:via-night-900 dark:to-brand-950/30 px-5 py-5 sm:px-6">
                            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-brand-700 dark:text-brand-300">
                                <Sparkles className="h-3.5 w-3.5" />
                                Step 1 · File
                            </div>
                            <Field error={errors.file}>
                                <FileDrop
                                    file={data.file}
                                    onChange={onFileChange}
                                    accept=".pdf,application/pdf"
                                    hint="PDF only · up to 100 MB"
                                    invalid={!!errors.file}
                                    maxBytes={MAX_BYTES}
                                    currentLabel={editing ? `version ${doc!.version} — pick a file to replace` : undefined}
                                    size="lg"
                                />
                            </Field>
                            {editing && data.file && doc!.is_signed && (
                                <div className="mt-3">
                                    <Alert tone="warning">Uploading a new version clears existing signatures.</Alert>
                                </div>
                            )}
                            {progress && (
                                <div className="mt-4">
                                    <div className="mb-1.5 flex justify-between text-xs text-slate-500 dark:text-night-400">
                                        <span>Uploading…</span>
                                        <span>{progress.percentage ?? 0}%</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-night-800">
                                        <div
                                            className="h-full rounded-full bg-brand-600 transition-all"
                                            style={{ width: `${progress.percentage ?? 0}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-5 px-5 py-5 sm:px-6">
                            <div>
                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-night-400">
                                    Step 2 · Details
                                </div>
                                <div className="space-y-4">
                                    <Field
                                        label="Name"
                                        htmlFor="title"
                                        error={errors.title}
                                        required
                                        hint={data.file && titleLockedFromFile ? 'Filled from the file name — edit anytime.' : undefined}
                                    >
                                        <Input
                                            id="title"
                                            value={data.title}
                                            invalid={!!errors.title}
                                            onChange={(e) => {
                                                setTitleLockedFromFile(false);
                                                setData('title', e.target.value);
                                            }}
                                            placeholder="Document name"
                                            className="text-base"
                                        />
                                    </Field>

                                    <Field
                                        label="Department"
                                        error={errors.department_id}
                                        hint="Optional and independent of the folder. A document can sit in any folder and still belong to another department."
                                    >
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setData('department_id', '')}
                                                className={cn(
                                                    'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                                                    !data.department_id
                                                        ? 'bg-brand-700 text-white shadow-sm'
                                                        : 'bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-night-400 hover:bg-slate-200 dark:hover:bg-night-700',
                                                )}
                                            >
                                                None
                                            </button>
                                            {departments.map((d) => {
                                                const selected = data.department_id === String(d.id);
                                                return (
                                                    <button
                                                        key={d.id}
                                                        type="button"
                                                        onClick={() => setData('department_id', String(d.id))}
                                                        className={cn(
                                                            'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                                                            selected
                                                                ? 'bg-brand-700 text-white shadow-sm'
                                                                : 'bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-night-400 hover:bg-slate-200 dark:hover:bg-night-700',
                                                        )}
                                                    >
                                                        {d.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Field>

                                    <div className="rounded-lg border border-slate-200 dark:border-night-700 bg-slate-50/60 dark:bg-night-900/50 p-4">
                                        <p className="mb-2 text-sm font-medium text-slate-800 dark:text-night-200">Folder</p>
                                        <FolderDestination
                                            categories={categories}
                                            value={data.category_id}
                                            onChange={(id) => setData('category_id', id)}
                                            onCategoriesChange={setCategories}
                                            allowNestedCreate
                                        />
                                        {errors.category_id && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.category_id}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-night-700">
                                <button
                                    type="button"
                                    onClick={() => setShowMore((v) => !v)}
                                    className="flex w-full items-center justify-between gap-3 bg-white dark:bg-night-900 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-night-800/50"
                                >
                                    <span>
                                        <span className="block text-sm font-medium text-slate-900 dark:text-night-100">More options</span>
                                        <span className="block text-xs text-slate-500 dark:text-night-400">Description, who can see it, and approval</span>
                                    </span>
                                    <ChevronDown className={cn('h-4 w-4 text-slate-400 transition', showMore && 'rotate-180')} />
                                </button>

                                {showMore && (
                                    <div className="space-y-5 border-t border-slate-100 dark:border-night-800 bg-slate-50/40 dark:bg-night-900/50 px-4 py-4">
                                        <Field label="Description" htmlFor="description" error={errors.description}>
                                            <Textarea
                                                id="description"
                                                rows={3}
                                                value={data.description}
                                                onChange={(e) => setData('description', e.target.value)}
                                                placeholder="Optional context for reviewers"
                                            />
                                        </Field>

                                        <Field
                                            label="Visible to"
                                            error={errors.visible_to_ids}
                                            hint="Leave empty to share with everyone who can see this department."
                                        >
                                            <UserPicker
                                                users={users}
                                                value={data.visible_to_ids}
                                                onChange={(ids) => setData('visible_to_ids', ids)}
                                                placeholder="Restrict to specific people…"
                                            />
                                        </Field>

                                        <Field label="Access expires" htmlFor="access_expires_at" error={errors.access_expires_at}>
                                            <Input
                                                id="access_expires_at"
                                                type="date"
                                                value={data.access_expires_at}
                                                onChange={(e) => setData('access_expires_at', e.target.value)}
                                                className="sm:w-56"
                                            />
                                        </Field>

                                        <div className="rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 p-4">
                                            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-night-100">
                                                <ShieldCheck className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                                                Approval
                                            </div>
                                            <Checkbox
                                                label="Requires approval before it is marked approved"
                                                checked={data.requires_approval}
                                                onChange={(e) => setData('requires_approval', e.target.checked)}
                                            />
                                            {data.requires_approval && (
                                                <div className="mt-3">
                                                    <Field
                                                        label="Approval order"
                                                        error={errors.pending_approver_ids}
                                                        required
                                                        hint="First person acts first. Later approvers cannot open it until their turn."
                                                    >
                                                        <UserPicker
                                                            users={users}
                                                            value={data.pending_approver_ids}
                                                            onChange={(ids) => setData('pending_approver_ids', ids)}
                                                            invalid={!!errors.pending_approver_ids}
                                                            showOrder
                                                        />
                                                    </Field>
                                                </div>
                                            )}
                                        </div>

                                        {editing && (
                                            <Field label="Status" htmlFor="status" error={errors.status}>
                                                <Select id="status" value={data.status} onChange={(e) => setData('status', e.target.value)}>
                                                    <option value="DRAFT">Draft</option>
                                                    <option value="REVIEW">In review</option>
                                                    <option value="APPROVED">Approved</option>
                                                    <option value="REJECTED">Rejected</option>
                                                </Select>
                                            </Field>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 dark:border-night-800 bg-white dark:bg-night-900 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                            <LinkButton
                                href={
                                    editing
                                        ? route('documents.show', doc!.id)
                                        : route('documents.index', data.category_id ? { folder: data.category_id } : {})
                                }
                                variant="secondary"
                            >
                                Cancel
                            </LinkButton>
                            <Button type="submit" loading={processing} disabled={!ready} icon={FileUp} className="min-w-40">
                                {editing ? 'Save changes' : 'Upload document'}
                            </Button>
                        </div>
                    </Card>
                </form>
            </div>
        </AppLayout>
    );
}
