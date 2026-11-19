import { Badge } from '@/Components/ui/Badge';
import { Button } from '@/Components/ui/Button';
import { Card } from '@/Components/ui/Card';
import { useConfirm } from '@/Components/ui/Dialog';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Paginated, Pagination } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatDate } from '@/lib/format';
import { fullName, UserLite } from '@/types/models';
import { Link, router } from '@inertiajs/react';
import { Archive as ArchiveIcon, ArchiveRestore, FileText, Lock } from 'lucide-react';

interface ArchiveEntry {
    id: number;
    type: 'document' | 'item';
    url: string | null;
    archived_at: string;
    reason: string;
    restricted_access: boolean;
    archived_by?: UserLite | null;
    archivable?: { id: number; title?: string } | null;
}

export default function Index({ archives, canManage }: { archives: Paginated<ArchiveEntry>; canManage: boolean }) {
    const { confirm, dialog } = useConfirm();

    return (
        <AppLayout title="Archive">
            <PageHeader title="Archive" description="Historical documents retained for audit and recovery." />
            <Card>
                {archives.data.length === 0 ? (
                    <EmptyState icon={ArchiveIcon} title="Nothing archived" description="Archived documents appear here and can be restored by authorized users." />
                ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-night-800">
                        {archives.data.map((a) => {
                            const title = a.archivable?.title ?? 'Deleted item';
                            return (
                                <li key={a.id} className="flex items-center gap-4 px-5 py-4">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-night-800 text-slate-600 dark:text-night-400">
                                        <FileText className="h-5 w-5" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {a.url ? (
                                                <Link href={a.url} className="truncate font-medium text-slate-900 dark:text-night-100 hover:text-brand-700 dark:hover:text-brand-300">
                                                    {title}
                                                </Link>
                                            ) : (
                                                <span className="truncate font-medium text-slate-900 dark:text-night-100">{title}</span>
                                            )}
                                            <Badge>Document</Badge>
                                            {a.restricted_access && (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                                                    <Lock className="h-3.5 w-3.5" /> Restricted
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500 dark:text-night-400">
                                            Archived {formatDate(a.archived_at)}
                                            {a.archived_by ? ` by ${fullName(a.archived_by)}` : ''}
                                            {a.reason ? ` · ${a.reason}` : ''}
                                        </p>
                                    </div>
                                    {canManage && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            icon={ArchiveRestore}
                                            onClick={() =>
                                                confirm({
                                                    title: 'Restore document',
                                                    message: `Restore “${title}” from the archive?`,
                                                    confirmLabel: 'Restore',
                                                    action: () =>
                                                        router.post(route('archive.unarchive', a.id), {}, { preserveScroll: true }),
                                                })
                                            }
                                        >
                                            Restore
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
                <Pagination meta={archives} />
            </Card>
            {dialog}
        </AppLayout>
    );
}
