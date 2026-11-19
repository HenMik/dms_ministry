import { Button } from '@/Components/ui/Button';
import { Field, Input } from '@/Components/ui/Form';
import { FolderIcon } from '@/Components/ui/FolderIcon';
import { createFolderRequest, folderChildren, folderLabel, folderPath } from '@/lib/folders';
import { Category } from '@/types/models';
import { Link } from '@inertiajs/react';
import { Check, ChevronRight, FolderPlus, CornerLeftUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Props {
    categories: Category[];
    value: string;
    onChange: (folderId: string) => void;
    onCategoriesChange: (categories: Category[]) => void;
    /** Keep the create form open after creating, ready for another nested folder. */
    allowNestedCreate?: boolean;
    className?: string;
}

export function FolderDestination({
    categories,
    value,
    onChange,
    onCategoriesChange,
    allowNestedCreate = true,
    className,
}: Props) {
    const [browseId, setBrowseId] = useState(value);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setBrowseId(value);
    }, [value]);

    const crumbs = useMemo(() => folderPath(categories, browseId), [categories, browseId]);
    const children = useMemo(() => folderChildren(categories, browseId || null), [categories, browseId]);
    const selectedLabel = folderLabel(categories, value);
    const browseLabel = folderLabel(categories, browseId);
    const isSelected = (browseId || '') === (value || '');

    const createFolder = async (andNest: boolean) => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Enter a folder name.');
            return;
        }

        setBusy(true);
        setError(null);

        try {
            const result = await createFolderRequest({
                name: trimmed,
                parentId: browseId || null,
            });

            onCategoriesChange(result.categories);
            const createdId = String(result.folder.id);
            onChange(createdId);
            setBrowseId(createdId);
            setName('');

            if (andNest && allowNestedCreate) {
                setCreating(true);
            } else {
                setCreating(false);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create the folder.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={className}>
            <div className="mb-3 flex items-start gap-3">
                <FolderIcon size={40} />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-night-100">Save in folder</p>
                    <p className="truncate text-sm text-slate-500 dark:text-night-400">{selectedLabel}</p>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={FolderPlus}
                    onClick={() => {
                        setCreating((open) => !open);
                        setError(null);
                        setName('');
                    }}
                >
                    New folder
                </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-night-700 dark:bg-night-900">
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-night-800 dark:bg-night-950/60">
                    <button
                        type="button"
                        onClick={() => setBrowseId('')}
                        className={`rounded-md px-1.5 py-0.5 ${!browseId ? 'font-semibold text-slate-900 dark:text-night-100' : 'text-brand-700 hover:underline dark:text-brand-300'}`}
                    >
                        Root
                    </button>
                    {crumbs.map((crumb) => (
                        <span key={crumb.id} className="inline-flex items-center gap-1">
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-night-500" />
                            <button
                                type="button"
                                onClick={() => setBrowseId(String(crumb.id))}
                                className={`rounded-md px-1.5 py-0.5 ${String(crumb.id) === browseId ? 'font-semibold text-slate-900 dark:text-night-100' : 'text-brand-700 hover:underline dark:text-brand-300'}`}
                            >
                                {crumb.name}
                            </button>
                        </span>
                    ))}
                </div>

                <div className="max-h-56 overflow-y-auto">
                    {browseId && (
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left text-sm text-slate-600 hover:bg-slate-50 dark:border-night-800 dark:text-night-300 dark:hover:bg-night-800/60"
                            onClick={() => {
                                const parent = crumbs.length > 1 ? String(crumbs[crumbs.length - 2].id) : '';
                                setBrowseId(parent);
                            }}
                        >
                            <CornerLeftUp className="h-4 w-4 text-slate-400 dark:text-night-500" />
                            Up one level
                        </button>
                    )}

                    {children.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-slate-500 dark:text-night-400">No subfolders here yet.</p>
                    ) : (
                        children.map((folder) => (
                            <button
                                key={folder.id}
                                type="button"
                                className="flex w-full items-center gap-3 border-b border-slate-50 px-3 py-2.5 text-left hover:bg-slate-50 dark:border-night-800 dark:hover:bg-night-800/60"
                                onClick={() => setBrowseId(String(folder.id))}
                                onDoubleClick={() => {
                                    setBrowseId(String(folder.id));
                                    onChange(String(folder.id));
                                }}
                            >
                                <FolderIcon size={28} />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-night-100">{folder.name}</span>
                                <ChevronRight className="h-4 w-4 text-slate-400 dark:text-night-500" />
                            </button>
                        ))
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5 dark:border-night-800 dark:bg-night-950/60">
                    <p className="text-xs text-slate-500 dark:text-night-400">
                        Browsing: <span className="font-medium text-slate-700 dark:text-night-200">{browseLabel}</span>
                    </p>
                    <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? 'subtle' : 'primary'}
                        icon={Check}
                        onClick={() => onChange(browseId || '')}
                    >
                        {isSelected ? 'Selected' : 'Use this folder'}
                    </Button>
                </div>
            </div>

            {creating && (
                <div className="mt-3 space-y-3 rounded-lg border border-dashed border-brand-200 bg-brand-50/40 p-3 dark:border-brand-800 dark:bg-brand-950/30">
                    <p className="text-sm font-medium text-slate-800 dark:text-night-200">
                        New folder inside <span className="text-brand-800 dark:text-brand-300">{browseLabel}</span>
                    </p>
                    <Field label="Folder name" htmlFor="nested_folder_name" error={error ?? undefined}>
                        <Input
                            id="nested_folder_name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Q3 papers"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void createFolder(false);
                                }
                            }}
                        />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" loading={busy} onClick={() => void createFolder(false)}>
                            Create & select
                        </Button>
                        {allowNestedCreate && (
                            <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => void createFolder(true)}>
                                Create & add another inside
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                                setCreating(false);
                                setError(null);
                                setName('');
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Compact link back into the browser for a chosen folder. */
export function FolderDestinationHint({ folderId, categories }: { folderId: string; categories: Category[] }) {
    if (!folderId) {
        return null;
    }

    return (
        <p className="mt-2 text-xs text-slate-500 dark:text-night-400">
            Opens in{' '}
            <Link href={route('documents.index', { folder: folderId })} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                {folderLabel(categories, folderId)}
            </Link>
        </p>
    );
}
