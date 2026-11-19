import { FolderDestination } from '@/Components/Documents/FolderDestination';
import { StatusBadge } from '@/Components/ui/Badge';
import { Button, LinkButton } from '@/Components/ui/Button';
import { Card } from '@/Components/ui/Card';
import { Dialog, useConfirm } from '@/Components/ui/Dialog';
import { EmptyFolderGraphic } from '@/Components/ui/EmptyFolderGraphic';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Field, Input, Select } from '@/Components/ui/Form';
import { FolderIcon } from '@/Components/ui/FolderIcon';
import { Menu } from '@/Components/ui/Menu';
import { FileIcon, Paginated, Pagination, Tabs } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import { UserPicker } from '@/Components/ui/UserPicker';
import AppLayout from '@/Layouts/AppLayout';
import { formatBytes, formatRelative } from '@/lib/format';
import { Category, DocumentRecord, fullName, UserLite } from '@/types/models';
import { Link, router } from '@inertiajs/react';
import { ExternalLink, FolderInput, FolderOpen, FolderPlus, Lock, PenLine, Search, Trash2, Upload, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface FolderItem extends Category {
    documents_count: number;
    folders_count: number;
    is_restricted?: boolean;
}

interface DepartmentOption {
    id: number;
    name: string;
    code: string;
}

interface Props {
    documents: Paginated<DocumentRecord>;
    folders: FolderItem[];
    currentFolder: { id: number; name: string; parent_id: number | null } | null;
    breadcrumbs: { label: string; href?: string | null }[];
    folderOptions: Category[];
    filters: { status?: string; q?: string; folder?: number | null; awaiting?: string | null };
    awaitingCount: number;
    canCreate: boolean;
    canManageFolders: boolean;
    viewMode: 'folder' | 'search' | 'awaiting';
    users: UserLite[];
    departments?: DepartmentOption[];
}

export default function Index({
    documents,
    folders,
    currentFolder,
    breadcrumbs,
    folderOptions: initialFolderOptions,
    filters,
    awaitingCount,
    canCreate,
    canManageFolders,
    viewMode,
    users = [],
    departments = [],
}: Props) {
    const { confirm, dialog } = useConfirm();
    const [q, setQ] = useState(filters.q ?? '');
    const [folderOptions, setFolderOptions] = useState(initialFolderOptions);
    const [moving, setMoving] = useState<DocumentRecord | null>(null);
    const [moveTarget, setMoveTarget] = useState('');
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [folderDepartmentIds, setFolderDepartmentIds] = useState<number[]>([]);
    const [folderVisibleTo, setFolderVisibleTo] = useState<number[]>([]);
    const [createError, setCreateError] = useState<string | null>(null);
    const [creatingBusy, setCreatingBusy] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const first = useRef(true);
    const awaiting = viewMode === 'awaiting';
    const folderParam = currentFolder?.id;

    useEffect(() => {
        setFolderOptions(initialFolderOptions);
    }, [initialFolderOptions]);

    useEffect(() => {
        if (creatingFolder) {
            nameInputRef.current?.focus();
        }
    }, [creatingFolder]);

    const apply = (next: Record<string, string | number | undefined | null>) => {
        const params: Record<string, string | number> = {};
        const merged = {
            folder: folderParam,
            status: filters.status,
            q: filters.q,
            awaiting: filters.awaiting,
            ...next,
        };

        Object.entries(merged).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params[key] = value;
            }
        });

        if (params.q || params.awaiting) {
            delete params.folder;
        }

        router.get(route('documents.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const t = window.setTimeout(() => apply({ q: q || undefined }), 300);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    const startCreateFolder = () => {
        setCreatingFolder(true);
        setNewFolderName('');
        setFolderDepartmentIds([]);
        setFolderVisibleTo([]);
        setCreateError(null);
    };

    const cancelCreateFolder = () => {
        setCreatingFolder(false);
        setNewFolderName('');
        setFolderDepartmentIds([]);
        setFolderVisibleTo([]);
        setCreateError(null);
    };

    const createFolder = () => {
        const name = newFolderName.trim();
        if (!name) {
            setCreateError('Enter a folder name.');
            return;
        }

        setCreatingBusy(true);
        setCreateError(null);

        router.post(
            route('categories.store'),
            {
                name,
                parent_id: currentFolder?.id ?? null,
                ...(folderDepartmentIds.length > 0 || !currentFolder ? { department_ids: folderDepartmentIds } : {}),
                visible_to_ids: folderVisibleTo,
                browse: true,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    cancelCreateFolder();
                },
                onError: (errors) => {
                    setCreateError(errors.name ?? 'Could not create the folder.');
                },
                onFinish: () => setCreatingBusy(false),
            },
        );
    };

    const deleteFolder = (folder: FolderItem) => {
        confirm({
            title: 'Delete folder',
            message: `Delete “${folder.name}”? Nested folders will be removed too. Documents inside move to uncategorised.`,
            confirmLabel: 'Delete',
            tone: 'danger',
            action: () =>
                router.delete(route('categories.destroy', folder.id), {
                    data: { browse: true },
                    preserveScroll: true,
                }),
        });
    };

    const openMove = (doc: DocumentRecord) => {
        setMoving(doc);
        setMoveTarget(doc.category_id ? String(doc.category_id) : '');
    };

    const confirmMove = () => {
        if (!moving) {
            return;
        }
        router.post(
            route('documents.move', moving.id),
            { category_id: moveTarget || null },
            {
                preserveScroll: true,
                onSuccess: () => setMoving(null),
            },
        );
    };

    const openFolder = (id?: number | null) => {
        router.get(route('documents.index'), id ? { folder: id } : {}, { preserveState: true });
    };

    const empty = folders.length === 0 && documents.data.length === 0 && !filters.status && !creatingFolder;
    const insideFolder = viewMode === 'folder' && !!currentFolder;
    const showFolderBrowser = viewMode === 'folder';
    const showListing = showFolderBrowser || !empty;
    const colCount = (viewMode === 'search' || awaiting ? 4 : 3) + (canManageFolders || canCreate ? 1 : 0);

    return (
        <AppLayout title={currentFolder?.name ?? 'Documents'}>
            <PageHeader
                title={currentFolder?.name ?? 'Documents'}
                description={
                    viewMode === 'search'
                        ? 'Search results across all folders.'
                        : awaiting
                          ? 'Documents waiting for your approval.'
                          : 'Browse folders and documents like a file manager.'
                }
                breadcrumbs={viewMode === 'folder' ? breadcrumbs.map((b) => ({ label: b.label, href: b.href ?? undefined })) : undefined}
            />

            <Tabs
                className="mb-4"
                value={awaiting ? 'awaiting' : 'browse'}
                tabs={[
                    { value: 'browse', label: 'Browse', href: route('documents.index', folderParam ? { folder: folderParam } : {}) },
                    { value: 'awaiting', label: 'Awaiting my approval', count: awaitingCount, href: route('documents.index', { awaiting: 1 }) },
                ]}
            />

            <Card>
                <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-night-800 p-4 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all folders" className="pl-9" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Select value={filters.status ?? ''} onChange={(e) => apply({ status: e.target.value || undefined })} className="sm:w-40">
                            <option value="">Any status</option>
                            <option value="DRAFT">Draft</option>
                            <option value="REVIEW">In review</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="ARCHIVED">Archived</option>
                        </Select>
                        {showFolderBrowser && canManageFolders && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={FolderPlus}
                                disabled={creatingFolder}
                                onClick={startCreateFolder}
                            >
                                New folder
                            </Button>
                        )}
                        {showFolderBrowser && canCreate && (
                            <LinkButton
                                href={route('documents.create', folderParam ? { folder: folderParam } : {})}
                                size="sm"
                                icon={Upload}
                            >
                                {currentFolder ? 'Upload here' : 'Upload'}
                            </LinkButton>
                        )}
                    </div>
                </div>

                {!showListing ? (
                    <EmptyState
                        icon={FolderPlus}
                        title={
                            awaiting
                                ? 'Nothing awaiting your approval'
                                : viewMode === 'search'
                                  ? 'No documents match your search'
                                  : 'No folders or documents yet'
                        }
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-base">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    {(viewMode === 'search' || awaiting) && <th className="hidden md:table-cell">Folder</th>}
                                    <th>Status</th>
                                    <th className="hidden lg:table-cell">Updated</th>
                                    {(canCreate || canManageFolders) && (
                                        <th className="w-12">
                                            <span className="sr-only">Options</span>
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {insideFolder && (
                                    <tr className="cursor-pointer hover:bg-slate-50 dark:hover:bg-night-800/50" onClick={() => openFolder(currentFolder.parent_id)}>
                                        <td colSpan={colCount}>
                                            <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-night-400">
                                                <FolderIcon size={28} className="opacity-70" />
                                                ..
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {empty && showFolderBrowser && (
                                    <tr>
                                        <td colSpan={colCount} className="!p-0">
                                            <EmptyState
                                                className="py-12"
                                                illustration={<EmptyFolderGraphic />}
                                                title={insideFolder ? 'This folder is empty' : 'No folders or documents yet'}
                                                description={
                                                    canManageFolders || canCreate
                                                        ? 'Create a folder or upload a document to get started.'
                                                        : 'Nothing has been added here yet.'
                                                }
                                                action={
                                                    canManageFolders ? (
                                                        <Button type="button" variant="secondary" icon={FolderPlus} onClick={startCreateFolder}>
                                                            New folder
                                                        </Button>
                                                    ) : canCreate ? (
                                                        <LinkButton
                                                            href={route('documents.create', folderParam ? { folder: folderParam } : {})}
                                                            variant="secondary"
                                                            icon={Upload}
                                                        >
                                                            Upload
                                                        </LinkButton>
                                                    ) : undefined
                                                }
                                            />
                                        </td>
                                    </tr>
                                )}

                                {folders.map((folder) => (
                                    <tr key={`folder-${folder.id}`} className="hover:bg-slate-50 dark:hover:bg-night-800/50">
                                        <td className="cursor-pointer" onClick={() => openFolder(folder.id)}>
                                            <div className="flex items-center gap-3">
                                                <FolderIcon size={36} />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="truncate font-medium text-slate-900 dark:text-night-100">{folder.name}</p>
                                                        {folder.is_restricted && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                                                                <Lock className="h-3 w-3" /> Restricted
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-night-400">
                                                        {folder.folders_count} folders · {folder.documents_count} documents
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        {(viewMode === 'search' || awaiting) && <td className="hidden md:table-cell" />}
                                        <td>
                                            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Folder</span>
                                        </td>
                                        <td className="hidden whitespace-nowrap text-slate-500 dark:text-night-400 lg:table-cell">
                                            {folder.updated_at ? formatRelative(folder.updated_at) : '—'}
                                        </td>
                                        {(canCreate || canManageFolders) && (
                                            <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Menu
                                                    align="right"
                                                    items={[
                                                        {
                                                            label: 'Open',
                                                            icon: FolderOpen,
                                                            onClick: () => openFolder(folder.id),
                                                        },
                                                        {
                                                            label: 'Upload into folder',
                                                            icon: Upload,
                                                            hidden: !canCreate,
                                                            href: route('documents.create', { folder: folder.id }),
                                                        },
                                                        {
                                                            label: 'Delete',
                                                            icon: Trash2,
                                                            danger: true,
                                                            hidden: !canManageFolders,
                                                            separatorBefore: true,
                                                            onClick: () => deleteFolder(folder),
                                                        },
                                                    ]}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}

                                {documents.data.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-night-800/50">
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <FileIcon mime={doc.mime_type} />
                                                <div className="min-w-0">
                                                    <Link
                                                        href={route('documents.show', doc.id)}
                                                        className="block max-w-md truncate font-medium text-slate-900 dark:text-night-100 hover:text-brand-700 dark:hover:text-brand-300"
                                                    >
                                                        {doc.title}
                                                    </Link>
                                                    <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-night-400">
                                                        <span>v{doc.version}</span>
                                                        <span>·</span>
                                                        <span>{formatBytes(doc.file_size)}</span>
                                                        {doc.uploaded_by && (
                                                            <>
                                                                <span>·</span>
                                                                <span>{fullName(doc.uploaded_by)}</span>
                                                            </>
                                                        )}
                                                        {!!doc.signatures_count && (
                                                            <span className="inline-flex items-center gap-1 text-brand-700 dark:text-brand-300">
                                                                <PenLine className="h-3 w-3" />
                                                                {doc.signatures_count} signed
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        {(viewMode === 'search' || awaiting) && (
                                            <td className="hidden md:table-cell">
                                                {doc.category ? (
                                                    <Link
                                                        href={route('documents.index', { folder: doc.category.id })}
                                                        className="text-sm text-brand-700 dark:text-brand-300 hover:underline"
                                                    >
                                                        {doc.category.name}
                                                    </Link>
                                                ) : (
                                                    <span className="text-slate-400">Root</span>
                                                )}
                                            </td>
                                        )}
                                        <td>
                                            <StatusBadge status={doc.status} />
                                        </td>
                                        <td className="hidden whitespace-nowrap text-slate-500 dark:text-night-400 lg:table-cell">
                                            {formatRelative(doc.updated_at)}
                                        </td>
                                        {(canCreate || canManageFolders) && (
                                            <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Menu
                                                    align="right"
                                                    items={[
                                                        {
                                                            label: 'Open',
                                                            icon: ExternalLink,
                                                            href: route('documents.show', doc.id),
                                                        },
                                                        {
                                                            label: 'Move to…',
                                                            icon: FolderInput,
                                                            hidden: !canCreate,
                                                            onClick: () => openMove(doc),
                                                        },
                                                    ]}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination meta={documents} />
            </Card>

            <Dialog
                open={!!moving}
                onClose={() => setMoving(null)}
                title="Move document"
                description={moving ? `Choose a folder for “${moving.title}”.` : undefined}
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setMoving(null)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={confirmMove}>
                            Move
                        </Button>
                    </>
                }
            >
                <FolderDestination
                    categories={folderOptions}
                    value={moveTarget}
                    onChange={setMoveTarget}
                    onCategoriesChange={setFolderOptions}
                    allowNestedCreate
                />
            </Dialog>
            <Dialog
                open={creatingFolder}
                onClose={cancelCreateFolder}
                title="New folder"
                description={
                    currentFolder
                        ? `Create a folder inside “${currentFolder.name}”. Documents inside can still belong to any department.`
                        : 'Link the folder to one or more departments, or leave open. Documents inside stay independent.'
                }
                size="lg"
                footer={
                    <>
                        <Button variant="secondary" onClick={cancelCreateFolder}>
                            Cancel
                        </Button>
                        <Button icon={FolderPlus} loading={creatingBusy} onClick={createFolder}>
                            Create folder
                        </Button>
                    </>
                }
            >
                <div className="space-y-4">
                    <Field label="Folder name" error={createError ?? undefined} required>
                        <Input
                            ref={nameInputRef}
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="e.g. Policies 2026"
                            invalid={!!createError}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    createFolder();
                                }
                            }}
                        />
                    </Field>
                    {departments.length > 0 && (
                        <Field
                            label="Departments"
                            hint={
                                currentFolder
                                    ? 'Leave empty to inherit the parent folder’s departments.'
                                    : 'Leave empty for an open folder. Pick one or more to limit who sees it.'
                            }
                        >
                            <div className="flex flex-wrap gap-2">
                                {departments.map((department) => {
                                    const selected = folderDepartmentIds.includes(department.id);
                                    return (
                                        <button
                                            key={department.id}
                                            type="button"
                                            onClick={() =>
                                                setFolderDepartmentIds((current) =>
                                                    selected
                                                        ? current.filter((id) => id !== department.id)
                                                        : [...current, department.id],
                                                )
                                            }
                                            className={
                                                selected
                                                    ? 'rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white'
                                                    : 'rounded-lg bg-slate-100 dark:bg-night-800 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-night-400 hover:bg-slate-200 dark:hover:bg-night-700'
                                            }
                                        >
                                            {department.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>
                    )}
                    <Field
                        label="Visible to"
                        hint="Leave empty for everyone who can see this folder. Pick people to restrict it further."
                    >
                        <UserPicker users={users} value={folderVisibleTo} onChange={setFolderVisibleTo} placeholder="Everyone with folder access" />
                    </Field>
                    {folderVisibleTo.length > 0 && (
                        <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                            <Users className="h-3.5 w-3.5" />
                            Only the selected people (and folder managers) will see this folder.
                        </p>
                    )}
                </div>
            </Dialog>
            {dialog}
        </AppLayout>
    );
}
