import DocumentViewer, { NewAnnotation, SignPayload, StampPayload } from '@/Components/Pdf/DocumentViewer';
import { StatusBadge } from '@/Components/ui/Badge';
import { AnchorButton, Button, LinkButton } from '@/Components/ui/Button';
import { Dialog, useConfirm } from '@/Components/ui/Dialog';
import { Field, Textarea } from '@/Components/ui/Form';
import { Menu } from '@/Components/ui/Menu';
import { Alert, Avatar, DetailList, FileIcon } from '@/Components/ui/misc';
import { notify } from '@/Components/ui/Toaster';
import AppLayout from '@/Layouts/AppLayout';
import { formatBytes, formatDate, formatDateTime } from '@/lib/format';
import { visit } from '@/lib/http';
import { PageProps } from '@/types';
import { DocumentRecord, fullName } from '@/types/models';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { Archive, ChevronLeft, Download, FileDown, Info, Pencil, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ApprovalStep {
    id: number;
    first_name: string;
    last_name: string;
    email?: string;
    sort_order: number;
    status: string;
    acted_at?: string | null;
}

interface AccessLogRow {
    id: number;
    action: string;
    accessed_at: string;
    user?: { id: number; first_name: string; last_name: string; email?: string } | null;
}

interface Props {
    document: DocumentRecord;
    approvalChain?: ApprovalStep[];
    tat?: { seconds: number; label: string; completed: boolean } | null;
    accessLogs?: AccessLogRow[];
    fileUrl: string;
    savedSignature: string | null;
    savedStamp?: string | null;
    can: {
        update: boolean;
        delete: boolean;
        approve: boolean;
        sign: boolean;
        annotate: boolean;
        archive: boolean;
        moderate: boolean;
        view_access_logs?: boolean;
    };
}

const chainTone: Record<string, string> = {
    approved: 'text-emerald-700 dark:text-emerald-400',
    current: 'text-brand-700 dark:text-brand-300',
    waiting: 'text-slate-500 dark:text-night-400',
    rejected: 'text-red-700 dark:text-red-400',
    skipped: 'text-slate-400',
};

const chainLabel: Record<string, string> = {
    approved: 'Approved',
    current: 'Current',
    waiting: 'Waiting',
    rejected: 'Rejected',
    skipped: 'Skipped',
};

export default function Show({
    document: doc,
    approvalChain = [],
    tat = null,
    accessLogs = [],
    fileUrl,
    savedSignature,
    savedStamp = null,
    can,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const { confirm, dialog } = useConfirm();
    const [rejectOpen, setRejectOpen] = useState(false);
    const reject = useForm({ reason: '' });

    const signatures = doc.signatures ?? [];
    const alreadySigned = signatures.some((s) => s.user_id === auth.user.id && (s.signature_type ?? 'INTERNAL') !== 'STAMP');
    const downloadUrl = route('documents.download', doc.id);

    const addAnnotation = async (a: NewAnnotation) => {
        try {
            await visit('post', route('documents.annotations.store', doc.id), { ...a });
        } catch (e) {
            notify((e as Error).message, 'error');
            throw e;
        }
    };

    const updateAnnotation = async (
        id: number,
        patch: { content?: string; color?: string; coordinates?: { x: number; y: number; w?: number; h?: number } | null },
    ) => {
        try {
            await visit('put', route('annotations.update', id), { ...patch });
        } catch (e) {
            notify((e as Error).message, 'error');
            throw e;
        }
    };

    const sign = async ({ pdf, image, placements, save }: SignPayload) => {
        await visit(
            'post',
            route('documents.sign', doc.id),
            {
                signed_pdf: new File([pdf], 'signed.pdf', { type: 'application/pdf' }),
                signature_image: image,
                placements: JSON.stringify(placements),
                save_signature: save,
            },
            { forceFormData: true },
        );
    };

    const stampDocument = async ({ pdf, image, placements }: StampPayload) => {
        await visit(
            'post',
            route('documents.stamp', doc.id),
            {
                stamped_pdf: new File([pdf], 'stamped.pdf', { type: 'application/pdf' }),
                stamp_image: image,
                placements: JSON.stringify(placements),
            },
            { forceFormData: true },
        );
    };

    const saveMarks = async (pdf: Blob) => {
        await visit(
            'post',
            route('documents.flatten', doc.id),
            {
                marked_pdf: new File([pdf], 'marked.pdf', { type: 'application/pdf' }),
            },
            { forceFormData: true },
        );
    };

    const updatePages = async (pdf: Blob) => {
        await visit(
            'post',
            route('documents.pages', doc.id),
            {
                pages_pdf: new File([pdf], 'pages.pdf', { type: 'application/pdf' }),
            },
            { forceFormData: true },
        );
    };

    const details = (
        <div className="space-y-5 p-4">
            {doc.description && <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-night-200">{doc.description}</p>}
            <DetailList
                items={[
                    { label: 'Status', value: <StatusBadge status={doc.status} /> },
                    { label: 'Category', value: doc.category?.name ?? '—' },
                    { label: 'Version', value: `v${doc.version}` },
                    { label: 'Size', value: formatBytes(doc.file_size) },
                    { label: 'Uploaded by', value: fullName(doc.uploaded_by) },
                    { label: 'Uploaded', value: formatDate(doc.created_at) },
                    { label: 'Last updated', value: formatDateTime(doc.updated_at) },
                    { label: 'Access expires', value: formatDate(doc.access_expires_at), hidden: !doc.access_expires_at },
                ]}
            />
            {approvalChain.length > 0 && (
                <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-night-400">Approval chain</h4>
                        {tat?.label && (
                            <span className="text-xs font-medium text-slate-600 dark:text-night-400">
                                {tat.completed ? `Completed in ${tat.label}` : `In review ${tat.label}`}
                            </span>
                        )}
                    </div>
                    <ul className="space-y-2">
                        {approvalChain.map((step) => (
                            <li key={`step-${step.id}-${step.sort_order}`} className="flex items-center gap-2 text-sm">
                                <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 dark:bg-night-800 text-[10px] font-semibold text-slate-600 dark:text-night-400">
                                    {step.sort_order + 1}
                                </span>
                                <Avatar name={fullName(step)} size="xs" />
                                <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-night-200">{fullName(step)}</span>
                                <span className={`text-xs font-medium ${chainTone[step.status] ?? 'text-slate-500 dark:text-night-400'}`}>
                                    {chainLabel[step.status] ?? step.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-night-400">Visibility</h4>
                <p className="text-sm text-slate-700 dark:text-night-200">
                    {doc.visible_to?.length ? doc.visible_to.map((u) => fullName(u)).join(', ') : 'Uploader only'}
                </p>
            </div>
            {can.view_access_logs && (
                <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-night-400">Who opened</h4>
                    {accessLogs.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-night-400">No opens recorded yet.</p>
                    ) : (
                        <ul className="max-h-48 space-y-2 overflow-y-auto">
                            {accessLogs.map((log) => (
                                <li key={log.id} className="flex items-center gap-2 text-sm">
                                    <Avatar name={fullName(log.user)} size="xs" />
                                    <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-night-200">{fullName(log.user)}</span>
                                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{log.action}</span>
                                    <span className="whitespace-nowrap text-xs text-slate-500 dark:text-night-400">{formatDateTime(log.accessed_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <AppLayout title={doc.title} fullBleed>
            <div className="flex h-[calc(100vh-4rem)] flex-col">
                <div className="shrink-0 border-b border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href={route('documents.index')}
                            className="rounded-md p-1.5 text-slate-500 dark:text-night-400 hover:bg-slate-100 dark:hover:bg-night-800 hover:text-slate-800 dark:hover:text-night-200"
                            aria-label="Back to documents"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Link>
                        <FileIcon mime={doc.mime_type} />
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-lg font-semibold text-slate-900 dark:text-night-100">{doc.title}</h1>
                                <StatusBadge status={doc.status} />
                                {doc.is_signed && (
                                    <span className="inline-flex items-center rounded-md bg-brand-50 dark:bg-brand-500/20 px-2 py-0.5 text-xs font-medium text-brand-800 dark:text-brand-200 ring-1 ring-inset ring-brand-700/20 dark:ring-brand-400/30">
                                        {signatures.length} signature{signatures.length === 1 ? '' : 's'}
                                    </span>
                                )}
                            </div>
                            <p className="truncate text-sm text-slate-500 dark:text-night-400">
                                {doc.category?.name ?? 'Uncategorised'} · v{doc.version} · {formatBytes(doc.file_size)} · Updated{' '}
                                {formatDate(doc.updated_at)}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {!doc.is_pdf && (
                                <AnchorButton href={downloadUrl} size="sm" icon={Download}>
                                    Download
                                </AnchorButton>
                            )}
                            {can.update && (
                                <LinkButton href={route('documents.edit', doc.id)} variant="secondary" size="sm" icon={Pencil}>
                                    Edit
                                </LinkButton>
                            )}
                            <Menu
                                items={[
                                    { label: doc.is_signed ? 'Download signed copy' : 'Download', icon: Download, href: downloadUrl, external: true },
                                    {
                                        label: 'Download original (unsigned)',
                                        icon: FileDown,
                                        href: route('documents.download', { document: doc.id, version: 'original' }),
                                        external: true,
                                        hidden: !doc.is_signed,
                                    },
                                    {
                                        label: 'Approve',
                                        icon: ThumbsUp,
                                        hidden: !can.approve,
                                        separatorBefore: true,
                                        onClick: () =>
                                            confirm({
                                                title: 'Approve document',
                                                message: `Approve “${doc.title}”? The uploader will be notified.`,
                                                confirmLabel: 'Approve',
                                                tone: 'primary',
                                                action: () => router.post(route('documents.approve', doc.id), {}, { preserveScroll: true }),
                                            }),
                                    },
                                    {
                                        label: 'Reject',
                                        icon: ThumbsDown,
                                        danger: true,
                                        hidden: !can.approve,
                                        onClick: () => setRejectOpen(true),
                                    },
                                    {
                                        label: 'Archive',
                                        icon: Archive,
                                        hidden: !can.archive || doc.status === 'ARCHIVED',
                                        separatorBefore: true,
                                        onClick: () =>
                                            confirm({
                                                title: 'Archive document',
                                                message: 'The document will move to the archive. You can restore it later.',
                                                confirmLabel: 'Archive',
                                                tone: 'primary',
                                                action: () => router.post(route('archive.store'), { type: 'document', id: doc.id }),
                                            }),
                                    },
                                    {
                                        label: 'Delete',
                                        icon: Trash2,
                                        danger: true,
                                        hidden: !can.delete,
                                        onClick: () =>
                                            confirm({
                                                title: 'Delete document',
                                                message: 'This permanently deletes the file, its comments and signatures.',
                                                confirmLabel: 'Delete',
                                                action: () => router.delete(route('documents.destroy', doc.id)),
                                            }),
                                    },
                                ]}
                            />
                        </div>
                    </div>
                    {can.approve && (
                        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-500/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <Alert tone="warning" className="border-0 bg-transparent p-0">
                                Your approval is requested on this document.
                            </Alert>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="secondary" size="sm" icon={ThumbsDown} onClick={() => setRejectOpen(true)}>
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    icon={ThumbsUp}
                                    onClick={() =>
                                        confirm({
                                            title: 'Approve document',
                                            message: `Approve “${doc.title}”? The uploader will be notified.`,
                                            confirmLabel: 'Approve',
                                            tone: 'primary',
                                            action: () => router.post(route('documents.approve', doc.id), {}, { preserveScroll: true }),
                                        })
                                    }
                                >
                                    Approve
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="min-h-0 flex-1">
                    {doc.is_pdf ? (
                        <DocumentViewer
                            fileUrl={fileUrl}
                            downloadUrl={downloadUrl}
                            annotations={doc.annotations ?? []}
                            signatures={signatures}
                            currentUserId={auth.user.id}
                            signerName={auth.user.name}
                            savedSignature={savedSignature}
                            savedStamp={savedStamp}
                            canAnnotate={can.annotate}
                            canModerate={can.moderate}
                            canSign={can.sign}
                            alreadySigned={alreadySigned}
                            canEditPages={can.update}
                            extraPanels={[{ id: 'details', label: 'Details', icon: Info, content: details }]}
                            onAddAnnotation={addAnnotation}
                            onUpdateAnnotation={updateAnnotation}
                            onSaveMarks={can.annotate ? saveMarks : undefined}
                            onToggleResolve={(id) => router.post(route('annotations.resolve', id), {}, { preserveScroll: true, preserveState: true })}
                            onDeleteAnnotation={(id) =>
                                confirm({
                                    title: 'Delete comment',
                                    message: 'This comment will be removed for everyone.',
                                    confirmLabel: 'Delete',
                                    action: () => router.delete(route('annotations.destroy', id), { preserveScroll: true, preserveState: true }),
                                })
                            }
                            onSign={sign}
                            onStamp={can.sign ? stampDocument : undefined}
                            onRemoveSignature={(id) => {
                                const mark = signatures.find((s) => s.id === id);
                                const isStamp = mark?.signature_type === 'STAMP';
                                confirm({
                                    title: isStamp ? 'Remove stamp' : 'Remove signature',
                                    message: isStamp
                                        ? 'This restores the document to the version before this stamp was applied.'
                                        : 'This restores the document to the version before this signature was applied.',
                                    confirmLabel: 'Remove',
                                    action: () =>
                                        router.delete(route('signatures.destroy', id), {
                                            preserveScroll: true,
                                        }),
                                });
                            }}
                            onUpdatePages={can.update ? updatePages : undefined}
                        />
                    ) : (
                        <div className="mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-3">
                            <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900 p-10 text-center lg:col-span-2">
                                <FileIcon mime={doc.mime_type} className="h-16 w-16 text-sm" />
                                <p className="mt-4 text-base font-semibold text-slate-900 dark:text-night-100">Preview not available</p>
                                <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-night-400">
                                    In-browser viewing, commenting and signing are available for PDF files. Download this file to open it.
                                </p>
                                <AnchorButton href={downloadUrl} icon={Download} className="mt-5">
                                    Download file
                                </AnchorButton>
                            </div>
                            <div className="rounded-lg border border-slate-200 dark:border-night-700 bg-white dark:bg-night-900">{details}</div>
                        </div>
                    )}
                </div>
            </div>

            <Dialog
                open={rejectOpen}
                onClose={() => setRejectOpen(false)}
                title="Reject document"
                description="The uploader will see your reason as a comment."
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setRejectOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={reject.processing}
                            onClick={() =>
                                reject.post(route('documents.reject', doc.id), {
                                    preserveScroll: true,
                                    onSuccess: () => {
                                        setRejectOpen(false);
                                        reject.reset();
                                    },
                                })
                            }
                        >
                            Reject document
                        </Button>
                    </>
                }
            >
                <Field label="Reason" htmlFor="reason" error={reject.errors.reason} required>
                    <Textarea id="reason" autoFocus value={reject.data.reason} onChange={(e) => reject.setData('reason', e.target.value)} />
                </Field>
            </Dialog>
            {dialog}
        </AppLayout>
    );
}
