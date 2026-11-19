import { PdfSignDialog } from '@/Components/Dashboard/PdfSignDialog';
import { FolderDestination } from '@/Components/Documents/FolderDestination';
import { Button } from '@/Components/ui/Button';
import { Dialog } from '@/Components/ui/Dialog';
import { FileDrop } from '@/Components/ui/FileDrop';
import { Checkbox, Field, Input, Select, Textarea } from '@/Components/ui/Form';
import { notify } from '@/Components/ui/Toaster';
import { UserPicker } from '@/Components/ui/UserPicker';
import { cn } from '@/lib/cn';
import { titleFromFileName } from '@/lib/documentTitle';
import { csrfToken } from '@/lib/folders';
import { Category, UserLite } from '@/types/models';
import { router } from '@inertiajs/react';
import { Building2, Briefcase, PenLine, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

interface DepartmentOption {
    id: number;
    name: string;
    code: string;
}

interface PositionOption {
    id: number;
    name: string;
    code?: string | null;
    department_id: number;
    users_count?: number;
}

export interface UploadUser extends UserLite {
    department_ids?: number[];
    position_ids?: number[];
}

type SendTo = 'people' | 'department' | 'position';

const MAX_BYTES = 100 * 1024 * 1024;
const ACCEPT = '.pdf,application/pdf';

const SEND_OPTIONS: { value: SendTo; label: string; hint: string; icon: typeof Users }[] = [
    { value: 'people', label: 'People', hint: 'Named recipients only', icon: Users },
    { value: 'department', label: 'Department', hint: 'Everyone in a department', icon: Building2 },
    { value: 'position', label: 'Role', hint: 'Everyone with that departmental role', icon: Briefcase },
];

function isPdf(file: File): boolean {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function appendIds(body: FormData, key: string, ids: number[]): void {
    ids.forEach((id, index) => body.append(`${key}[${index}]`, String(id)));
}

function uploadDocument(
    payload: {
        title: string;
        description: string;
        department_id: string;
        category_id: string;
        position_id: string;
        file: File;
        requires_approval: boolean;
        visible_to_ids: number[];
        pending_approver_ids: number[];
    },
    onProgress: (pct: number) => void,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const body = new FormData();
        body.append('async', '1');
        body.append('title', payload.title);
        body.append('description', payload.description);
        if (payload.department_id) {
            body.append('department_id', payload.department_id);
        }
        if (payload.category_id) {
            body.append('category_id', payload.category_id);
        }
        if (payload.position_id) {
            body.append('position_id', payload.position_id);
        }
        body.append('file', payload.file);
        body.append('requires_approval', payload.requires_approval ? '1' : '0');
        appendIds(body, 'visible_to_ids', payload.visible_to_ids);
        appendIds(body, 'pending_approver_ids', payload.pending_approver_ids);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', route('documents.store'));
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken());
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve();
                return;
            }

            try {
                const json = JSON.parse(xhr.responseText) as { message?: string; errors?: Record<string, string[]> };
                const first = json.errors ? Object.values(json.errors).flat()[0] : json.message;
                reject(new Error(first || `Upload failed (${xhr.status})`));
            } catch {
                reject(new Error(`Upload failed (${xhr.status})`));
            }
        };

        xhr.onerror = () => reject(new Error('Network error while uploading.'));
        xhr.send(body);
    });
}

export function QuickUpload({
    departments,
    positions,
    users,
    folders: initialFolders,
    savedSignature,
    signerName,
}: {
    departments: DepartmentOption[];
    positions: PositionOption[];
    users: UploadUser[];
    folders: Category[];
    savedSignature?: string | null;
    signerName: string;
}) {
    const [files, setFiles] = useState<File[]>([]);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [modalOpen, setModalOpen] = useState(false);
    const [sendTo, setSendTo] = useState<SendTo>('people');
    const [departmentId, setDepartmentId] = useState(departments[0] ? String(departments[0].id) : '');
    const [peopleIds, setPeopleIds] = useState<number[]>([]);
    const [positionId, setPositionId] = useState('');
    const [folderId, setFolderId] = useState('');
    const [folders, setFolders] = useState(initialFolders);
    const [description, setDescription] = useState('');
    const [requiresApproval, setRequiresApproval] = useState(false);
    const [approverIds, setApproverIds] = useState<number[]>([]);
    const [signBeforeUpload, setSignBeforeUpload] = useState(false);
    const [signedFiles, setSignedFiles] = useState<Record<string, File>>({});
    const [signingKey, setSigningKey] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [progressLabel, setProgressLabel] = useState('');
    const [progressPct, setProgressPct] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

    const positionsInDepartment = useMemo(() => {
        const dept = Number(departmentId);
        return positions.filter((position) => position.department_id === dept);
    }, [positions, departmentId]);

    const positionUsers = useMemo(() => {
        const pos = Number(positionId);
        if (!pos) {
            return [];
        }
        return users.filter((user) => (user.position_ids ?? []).includes(pos));
    }, [users, positionId]);

    const departmentUsers = useMemo(() => {
        if (sendTo !== 'department') {
            return users;
        }
        const dept = Number(departmentId);
        return users.filter((user) => (user.department_ids ?? []).includes(dept));
    }, [users, departmentId, sendTo]);

    const approvers = useMemo(() => users.filter((user) => user.is_approver), [users]);

    useEffect(() => {
        if (sendTo !== 'position') {
            return;
        }
        if (positionsInDepartment.length === 0) {
            setPositionId('');
            return;
        }
        if (!positionsInDepartment.some((position) => String(position.id) === positionId)) {
            setPositionId(String(positionsInDepartment[0].id));
        }
    }, [sendTo, positionsInDepartment, positionId]);

    const resetForm = () => {
        setFiles([]);
        setTitles({});
        setSignedFiles({});
        setDescription('');
        setPeopleIds([]);
        setApproverIds([]);
        setRequiresApproval(false);
        setSignBeforeUpload(false);
        setFolderId('');
        setProgressPct(0);
        setProgressLabel('');
        setError(null);
        setModalOpen(false);
    };

    const onFilesChange = (next: File[]) => {
        setFiles(next);
        setTitles((current) => {
            const updated = { ...current };
            for (const file of next) {
                const key = fileKey(file);
                if (!updated[key]) {
                    updated[key] = titleFromFileName(file.name);
                }
            }
            return updated;
        });
        setSignedFiles((current) => {
            const allowed = new Set(next.map(fileKey));
            return Object.fromEntries(Object.entries(current).filter(([key]) => allowed.has(key)));
        });
        setError(null);
        setProgressPct(0);
        setProgressLabel('');
        setModalOpen(next.length > 0);
    };

    const closeModal = () => {
        if (busy) {
            return;
        }
        resetForm();
    };

    const visibleToIds = (): number[] => {
        if (sendTo === 'people') {
            return peopleIds;
        }
        if (sendTo === 'position') {
            return positionUsers.map((user) => user.id);
        }
        return [];
    };

    const departmentIdForUpload = (): string => (sendTo === 'people' ? '' : departmentId);

    const pdfsNeedingSignature = files.filter((file) => isPdf(file) && !signedFiles[fileKey(file)]);
    const pdfCount = files.filter(isPdf).length;
    const signedCount = Object.keys(signedFiles).length;

    const beginSigning = () => {
        if (!savedSignature) {
            setError('No signature is assigned to your account. Ask an administrator to add one under Users.');
            return;
        }
        const next = pdfsNeedingSignature[0];
        if (!next) {
            setError('All selected PDFs already have a placed signature.');
            return;
        }
        setSigningKey(fileKey(next));
        setError(null);
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (files.length === 0 || busy) {
            return;
        }

        if (sendTo === 'department' && !departmentId) {
            setError('Choose a department.');
            return;
        }

        if (sendTo === 'people' && peopleIds.length === 0) {
            setError('Select at least one person.');
            return;
        }

        if (sendTo === 'position') {
            if (!departmentId || !positionId) {
                setError('Choose a department and role.');
                return;
            }
            if (positionUsers.length === 0) {
                setError('No users hold that role yet.');
                return;
            }
        }

        if (requiresApproval && approverIds.length === 0) {
            setError('Choose at least one approver.');
            return;
        }

        if (signBeforeUpload) {
            const pending = pdfsNeedingSignature;
            if (pending.length > 0) {
                if (!savedSignature) {
                    setError('No signature is assigned to your account. Ask an administrator to add one under Users.');
                    return;
                }
                setSigningKey(fileKey(pending[0]));
                setError('Place your signature on each PDF before uploading.');
                return;
            }
        }

        const visibility = visibleToIds();
        setBusy(true);
        setError(null);

        try {
            for (let index = 0; index < files.length; index++) {
                const original = files[index];
                const key = fileKey(original);
                const title = (titles[key] || titleFromFileName(original.name)).trim();
                if (!title) {
                    throw new Error(`Give “${original.name}” a name.`);
                }

                setProgressLabel(`Uploading ${index + 1} of ${files.length}: ${original.name}`);
                const uploadFile = signedFiles[key] ?? original;

                await uploadDocument(
                    {
                        title,
                        description,
                        department_id: departmentIdForUpload(),
                        category_id: folderId,
                        position_id: sendTo === 'position' ? positionId : '',
                        file: uploadFile,
                        requires_approval: requiresApproval,
                        visible_to_ids: visibility,
                        pending_approver_ids: requiresApproval ? approverIds : [],
                    },
                    (pct) => {
                        const base = (index / files.length) * 100;
                        const slice = pct / files.length;
                        setProgressPct(Math.min(99, Math.round(base + slice)));
                    },
                );
            }

            setProgressPct(100);
            setProgressLabel('Done');
            notify(files.length === 1 ? 'Document uploaded.' : `${files.length} documents uploaded.`, 'success');
            resetForm();
            router.reload({
                only: ['stats', 'recentDocuments', 'awaitingApproval', 'statusBreakdown', 'savedSignature', 'folders'],
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed.');
        } finally {
            setBusy(false);
        }
    };

    const signingFile = signingKey ? (files.find((file) => fileKey(file) === signingKey) ?? null) : null;

    return (
        <>
            <div className="mb-8">
                <FileDrop
                    multiple
                    files={files}
                    onChangeFiles={onFilesChange}
                    accept={ACCEPT}
                    hint="PDF only · up to 100 MB · select one or many"
                    maxBytes={MAX_BYTES}
                    size="lg"
                />
            </div>

            <Dialog
                open={modalOpen && files.length > 0 && !signingFile}
                onClose={closeModal}
                title={files.length === 1 ? 'Upload document' : `Upload ${files.length} documents`}
                description="Choose who receives it, then upload."
                size="lg"
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={closeModal} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" form="quick-upload-form" loading={busy} disabled={files.length === 0}>
                            Upload {files.length > 1 ? `${files.length} PDFs` : 'PDF'}
                        </Button>
                    </>
                }
            >
                <form id="quick-upload-form" onSubmit={submit} className="space-y-5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 dark:border-night-700 dark:bg-night-950/50">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <Checkbox
                                label="Sign before uploading"
                                description="Place your assigned signature on each PDF first."
                                checked={signBeforeUpload}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setSignBeforeUpload(checked);
                                    if (checked) {
                                        beginSigning();
                                    }
                                }}
                            />
                            {signBeforeUpload && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-night-400">
                                        {signedCount}/{pdfCount || 0} signed
                                    </span>
                                    <Button type="button" variant="secondary" size="sm" icon={PenLine} onClick={beginSigning}>
                                        Open editor
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {files.length === 1 ? (
                        <Field label="Name" htmlFor="quick-title" required>
                            <Input
                                id="quick-title"
                                value={titles[fileKey(files[0])] ?? ''}
                                onChange={(e) => setTitles((current) => ({ ...current, [fileKey(files[0])]: e.target.value }))}
                                placeholder="Document name"
                            />
                        </Field>
                    ) : (
                        <div className="space-y-2.5">
                            <p className="text-sm font-medium text-slate-700 dark:text-night-300">Names</p>
                            <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                                {files.map((file) => {
                                    const key = fileKey(file);
                                    return (
                                        <Field key={key} label={file.name} htmlFor={`title-${key}`}>
                                            <Input
                                                id={`title-${key}`}
                                                value={titles[key] ?? ''}
                                                onChange={(e) => setTitles((current) => ({ ...current, [key]: e.target.value }))}
                                                placeholder="Document name"
                                            />
                                        </Field>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="mb-2 text-sm font-medium text-slate-700 dark:text-night-300">Upload to</p>
                        <div className="grid grid-cols-3 gap-2">
                            {SEND_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const selected = sendTo === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setSendTo(option.value)}
                                        className={cn(
                                            'rounded-lg border px-3 py-2.5 text-left transition',
                                            selected
                                                ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600 dark:border-brand-500 dark:bg-brand-950 dark:ring-brand-500'
                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-night-700 dark:bg-night-900 dark:hover:border-night-600 dark:hover:bg-night-800',
                                        )}
                                    >
                                        <Icon className={cn('mb-1.5 h-4 w-4', selected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 dark:text-night-500')} />
                                        <span className={cn('block text-sm font-medium', selected ? 'text-brand-900 dark:text-brand-100' : 'text-slate-800 dark:text-night-200')}>
                                            {option.label}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-night-400">{option.hint}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {sendTo === 'people' && (
                        <Field label="People" required hint="Only these people (plus you) can see it.">
                            <UserPicker users={users} value={peopleIds} onChange={setPeopleIds} placeholder="Choose people…" />
                        </Field>
                    )}

                    {sendTo === 'department' && (
                        <Field label="Department" htmlFor="quick-department" required>
                            <Select id="quick-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                                {departments.map((department) => (
                                    <option key={department.id} value={department.id}>
                                        {department.name}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    )}

                    {sendTo === 'position' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Department" htmlFor="quick-position-department" required>
                                <Select id="quick-position-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                                    {departments.map((department) => (
                                        <option key={department.id} value={department.id}>
                                            {department.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field
                                label="Role"
                                htmlFor="quick-position"
                                required
                                hint={
                                    positionsInDepartment.length === 0
                                        ? 'No roles in this department yet.'
                                        : `${positionUsers.length} holder${positionUsers.length === 1 ? '' : 's'}`
                                }
                            >
                                <Select
                                    id="quick-position"
                                    value={positionId}
                                    onChange={(e) => setPositionId(e.target.value)}
                                    disabled={positionsInDepartment.length === 0}
                                >
                                    {positionsInDepartment.length === 0 ? (
                                        <option value="">No roles available</option>
                                    ) : (
                                        positionsInDepartment.map((position) => (
                                            <option key={position.id} value={position.id}>
                                                {position.name}
                                            </option>
                                        ))
                                    )}
                                </Select>
                            </Field>
                        </div>
                    )}

                    <Field label="Folder" hint="Optional — independent of who you upload to.">
                        <FolderDestination
                            categories={folders}
                            value={folderId}
                            onChange={setFolderId}
                            onCategoriesChange={setFolders}
                        />
                    </Field>

                    <div className="space-y-3">
                        <Checkbox
                            label="Needs approval"
                            description="Pick who must approve before it is final."
                            checked={requiresApproval}
                            onChange={(e) => setRequiresApproval(e.target.checked)}
                        />
                        {requiresApproval && (
                            <Field
                                label="Approval order"
                                hint="First person acts first. Later approvers cannot open the document until their turn."
                            >
                                <UserPicker
                                    users={approvers.length ? approvers : users}
                                    value={approverIds}
                                    onChange={setApproverIds}
                                    placeholder="Add approvers in order…"
                                    showOrder
                                />
                            </Field>
                        )}
                    </div>

                    <Field label="Note" htmlFor="quick-description" hint="Optional">
                        <Textarea
                            id="quick-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            placeholder="Short note for recipients"
                        />
                    </Field>

                    {(busy || progressPct > 0) && (
                        <div>
                            <div className="mb-1.5 flex justify-between gap-3 text-xs text-slate-500 dark:text-night-400">
                                <span className="truncate">{progressLabel || 'Uploading…'}</span>
                                <span>{progressPct}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-night-800">
                                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progressPct}%` }} />
                            </div>
                        </div>
                    )}

                    {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </form>
            </Dialog>

            <PdfSignDialog
                open={!!signingFile}
                file={signingFile}
                savedSignature={savedSignature ?? null}
                signerName={signerName}
                onClose={() => setSigningKey(null)}
                onSigned={(signedFile) => {
                    if (!signingKey) {
                        return;
                    }
                    setSignedFiles((current) => ({ ...current, [signingKey]: signedFile }));
                    const remaining = files.filter(
                        (file) => isPdf(file) && fileKey(file) !== signingKey && !signedFiles[fileKey(file)],
                    );
                    if (remaining[0]) {
                        setSigningKey(fileKey(remaining[0]));
                        notify('Signature placed. Continue with the next PDF.', 'success');
                    } else {
                        setSigningKey(null);
                        notify('Signature placed. You can upload now.', 'success');
                    }
                }}
            />
        </>
    );
}
