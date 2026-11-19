import { AreaChart, BarChart, DonutChart, statusColor } from '@/Components/Dashboard/charts';
import { QuickUpload, UploadUser } from '@/Components/Dashboard/QuickUpload';
import { StatusBadge } from '@/Components/ui/Badge';
import { LinkButton } from '@/Components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { FileIcon, Tabs } from '@/Components/ui/misc';
import AppLayout from '@/Layouts/AppLayout';
import { formatRelative } from '@/lib/format';
import { PageProps } from '@/types';
import { Category, DocumentRecord, fullName } from '@/types/models';
import { Link, usePage } from '@inertiajs/react';
import { Archive, Building2, CheckCircle2, ClipboardCheck, FileText, FolderOpen, Plus, TrendingUp, UserRound } from 'lucide-react';

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

type DashboardView = 'personal' | 'department';

interface Props {
    view: DashboardView;
    stats: { documents: number; awaitingApproval: number; approved: number; archived: number };
    awaitingApproval: DocumentRecord[];
    recentDocuments: DocumentRecord[];
    statusBreakdown: Record<string, number>;
    analytics: {
        uploadsByMonth: { month: string; label: string; value: number }[];
        byDepartment: { id: number; name: string; value: number }[];
        byStatus: { status: string; label: string; value: number }[];
    };
    canCreate?: boolean;
    departments?: DepartmentOption[];
    positions?: PositionOption[];
    users?: UploadUser[];
    folders?: Category[];
    savedSignature?: string | null;
}

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function todayLabel() {
    return new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export default function Dashboard({
    view = 'personal',
    stats,
    awaitingApproval,
    recentDocuments,
    analytics,
    canCreate = false,
    departments = [],
    positions = [],
    users = [],
    folders = [],
    savedSignature = null,
}: Props) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const isPersonal = view === 'personal';
    const tasks = stats.awaitingApproval;
    const uploadsThisMonth = analytics.uploadsByMonth.at(-1)?.value ?? 0;
    const priorMonth = analytics.uploadsByMonth.at(-2)?.value ?? 0;
    const uploadDelta = uploadsThisMonth - priorMonth;

    return (
        <AppLayout title="Dashboard">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm text-slate-500 dark:text-night-400">{todayLabel()}</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-night-100">
                        {greeting()}, {user.first_name}
                    </h1>
                    <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-night-400">
                        {isPersonal
                            ? tasks > 0
                                ? `You have ${tasks} document${tasks === 1 ? '' : 's'} waiting for your approval.`
                                : 'Your personal document activity and approvals.'
                            : tasks > 0
                              ? `${tasks} document${tasks === 1 ? '' : 's'} currently in review across your department${departments.length === 1 ? '' : 's'}.`
                              : 'Overview of documents across your department(s).'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <LinkButton href={route('documents.index')} variant="secondary" icon={FolderOpen}>
                        Browse files
                    </LinkButton>
                </div>
            </div>

            <div className="mb-6">
                <Tabs
                    value={view}
                    className="w-full sm:w-auto"
                    tabs={[
                        {
                            value: 'personal',
                            label: 'Personal dashboard',
                            href: route('dashboard', { view: 'personal' }),
                            icon: <UserRound className="h-4 w-4" />,
                        },
                        {
                            value: 'department',
                            label: 'Departmental dashboard',
                            href: route('dashboard', { view: 'department' }),
                            icon: <Building2 className="h-4 w-4" />,
                        },
                    ]}
                />
            </div>

            {canCreate && isPersonal && (
                <QuickUpload
                    departments={departments}
                    positions={positions}
                    users={users}
                    folders={folders}
                    savedSignature={savedSignature}
                    signerName={user.name || `${user.first_name} ${user.last_name}`.trim()}
                />
            )}

            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    label={isPersonal ? 'My documents' : 'Department documents'}
                    value={stats.documents}
                    icon={<FileText className="h-5 w-5" />}
                    href={route('documents.index')}
                    hint={
                        uploadDelta === 0
                            ? `${uploadsThisMonth} uploaded this month`
                            : `${uploadsThisMonth} this month · ${uploadDelta > 0 ? '+' : ''}${uploadDelta} vs last`
                    }
                />
                <StatCard
                    label={isPersonal ? 'Awaiting you' : 'In review'}
                    value={stats.awaitingApproval}
                    icon={<ClipboardCheck className="h-5 w-5" />}
                    href={isPersonal ? route('documents.index', { awaiting: 1 }) : route('documents.index', { status: 'REVIEW' })}
                    tone={stats.awaitingApproval > 0 ? 'warn' : 'default'}
                />
                <StatCard
                    label={isPersonal ? 'My approved' : 'Approved'}
                    value={stats.approved}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    href={route('documents.index', { status: 'APPROVED' })}
                />
                <StatCard
                    label={isPersonal ? 'My archived' : 'Archived'}
                    value={stats.archived}
                    icon={<Archive className="h-5 w-5" />}
                    href={route('archive.index')}
                />
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader
                        title={isPersonal ? 'Awaiting your approval' : 'In review'}
                        description={
                            isPersonal
                                ? 'Assigned to you and still in review'
                                : 'Documents in review across your department(s)'
                        }
                        actions={
                            <Link
                                href={
                                    isPersonal
                                        ? route('documents.index', { awaiting: 1 })
                                        : route('documents.index', { status: 'REVIEW' })
                                }
                                className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-300"
                            >
                                View all
                            </Link>
                        }
                    />
                    {awaitingApproval.length === 0 ? (
                        <EmptyState
                            icon={ClipboardCheck}
                            title={isPersonal ? 'Nothing waiting' : 'Nothing in review'}
                            description={
                                isPersonal
                                    ? 'Approvals assigned to you will show up here.'
                                    : 'Department documents in review will show up here.'
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-night-800">
                            {awaitingApproval.map((doc) => (
                                <li key={doc.id}>
                                    <Link
                                        href={route('documents.show', doc.id)}
                                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-night-800/50"
                                    >
                                        <FileIcon mime={doc.mime_type} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-night-100">{doc.title}</p>
                                            <p className="truncate text-xs text-slate-500 dark:text-night-400">
                                                {(doc as DocumentRecord & { department?: { name: string } | null }).department?.name ??
                                                    doc.category?.name ??
                                                    'Uncategorised'}{' '}
                                                · {fullName(doc.uploaded_by)}
                                            </p>
                                        </div>
                                        <StatusBadge status={doc.status} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card>
                    <CardHeader
                        title={isPersonal ? 'Your recent uploads' : 'Recent department activity'}
                        description={
                            isPersonal
                                ? 'Documents you uploaded recently'
                                : 'Latest documents in your department(s)'
                        }
                        actions={
                            <Link
                                href={route('documents.index')}
                                className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-300"
                            >
                                Browse
                            </Link>
                        }
                    />
                    {recentDocuments.length === 0 ? (
                        <EmptyState
                            icon={FileText}
                            title={isPersonal ? 'No uploads yet' : 'No department documents yet'}
                            description={
                                isPersonal
                                    ? 'Documents you upload will appear here.'
                                    : 'Documents filed to your department(s) will appear here.'
                            }
                            action={
                                canCreate ? undefined : (
                                    <LinkButton href={route('documents.create')} size="sm" icon={Plus}>
                                        Upload
                                    </LinkButton>
                                )
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-night-800">
                            {recentDocuments.map((doc) => (
                                <li key={doc.id}>
                                    <Link
                                        href={route('documents.show', doc.id)}
                                        className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-night-800/50"
                                    >
                                        <FileIcon mime={doc.mime_type} />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-slate-900 dark:text-night-100">{doc.title}</p>
                                            <p className="truncate text-xs text-slate-500 dark:text-night-400">
                                                {doc.category?.name ?? 'Root'} · {formatRelative(doc.updated_at)}
                                            </p>
                                        </div>
                                        <StatusBadge status={doc.status} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            <div>
                <div className="mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                    <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-night-400">
                        Analytics
                    </h2>
                </div>

                <div className="grid gap-6 xl:grid-cols-5">
                    <Card className="xl:col-span-3">
                        <CardHeader
                            title={isPersonal ? 'Your uploads' : 'Department uploads'}
                            description={
                                isPersonal
                                    ? 'Your upload volume over the last six months'
                                    : 'Department upload volume over the last six months'
                            }
                        />
                        <CardBody>
                            <AreaChart
                                points={analytics.uploadsByMonth.map((p) => ({ label: p.label, value: p.value }))}
                                emptyLabel={
                                    isPersonal
                                        ? 'You have no uploads in this period'
                                        : 'No department uploads in this period'
                                }
                            />
                        </CardBody>
                    </Card>

                    <Card className="xl:col-span-2">
                        <CardHeader
                            title={isPersonal ? 'Your documents by status' : 'Department by status'}
                            description={
                                isPersonal
                                    ? 'Status mix of documents you uploaded'
                                    : 'Status mix across your department(s)'
                            }
                        />
                        <CardBody>
                            <DonutChart
                                points={analytics.byStatus.map((p) => ({
                                    label: p.label,
                                    value: p.value,
                                    color: statusColor(p.status),
                                }))}
                                emptyLabel={
                                    isPersonal
                                        ? 'You have no documents to chart yet'
                                        : 'No department documents to chart yet'
                                }
                            />
                        </CardBody>
                    </Card>

                    <Card className="xl:col-span-5">
                        <CardHeader
                            title={isPersonal ? 'Your uploads by department' : 'Volume by department'}
                            description={
                                isPersonal
                                    ? 'Where your documents were filed'
                                    : 'Document volume across your department(s)'
                            }
                            actions={
                                <Link
                                    href={route('documents.index')}
                                    className="text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-300"
                                >
                                    Open library
                                </Link>
                            }
                        />
                        <CardBody>
                            <BarChart
                                points={analytics.byDepartment.map((p) => ({ label: p.name, value: p.value }))}
                                emptyLabel={
                                    isPersonal
                                        ? 'You have no department-linked uploads yet'
                                        : 'No department-linked documents yet'
                                }
                            />
                        </CardBody>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
}
