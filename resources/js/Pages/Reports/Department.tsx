import { StatusBadge } from '@/Components/ui/Badge';
import { LinkButton } from '@/Components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatRelative } from '@/lib/format';
import { Link } from '@inertiajs/react';
import { ArrowLeft, BarChart3, Briefcase, ClipboardCheck, FileText, Users } from 'lucide-react';

interface DocRow {
    id: number;
    title: string;
    status: string;
    updated_at?: string | null;
}

interface DepartmentReport {
    totals: {
        documents: number;
        members: number;
        positions: number;
        awaiting_approval: number;
    };
    by_status: Record<string, number>;
    avg_approval_seconds: number | null;
    avg_approval_label: string | null;
    uploads_by_day: { date: string; count: number }[];
    top_uploaders: { id: number; name: string; count: number }[];
    recent_documents: DocRow[];
    days: number;
}

const statusOrder = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'];

function SparkBars({ series }: { series: { date: string; count: number }[] }) {
    const max = Math.max(1, ...series.map((point) => point.count));

    return (
        <div className="flex h-28 items-end gap-0.5">
            {series.map((point) => (
                <div
                    key={point.date}
                    title={`${point.date}: ${point.count}`}
                    className="min-w-0 flex-1 rounded-t bg-brand-500/80"
                    style={{ height: `${Math.max(4, (point.count / max) * 100)}%` }}
                />
            ))}
        </div>
    );
}

export default function Department({
    department,
    report,
}: {
    department: { id: number; name: string; code: string };
    report: DepartmentReport;
}) {
    return (
        <AppLayout title={`${department.name} report`}>
            <PageHeader
                title={department.name}
                description={`Department report · ${department.code} · last ${report.days} days upload trend`}
                breadcrumbs={[
                    { label: 'Reports', href: route('reports.index') },
                    { label: department.name },
                ]}
                actions={
                    <LinkButton href={route('reports.index')} variant="secondary" icon={ArrowLeft}>
                        All reports
                    </LinkButton>
                }
            />

            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard label="Documents" value={report.totals.documents} icon={<FileText className="h-5 w-5" />} />
                <StatCard
                    label="Awaiting approval"
                    value={report.totals.awaiting_approval}
                    icon={<ClipboardCheck className="h-5 w-5" />}
                    tone={report.totals.awaiting_approval > 0 ? 'warn' : 'default'}
                />
                <StatCard label="Members" value={report.totals.members} icon={<Users className="h-5 w-5" />} />
                <StatCard label="Roles" value={report.totals.positions} icon={<Briefcase className="h-5 w-5" />} />
                <StatCard
                    label="Avg. approval"
                    value={report.avg_approval_label ?? '—'}
                    icon={<BarChart3 className="h-5 w-5" />}
                />
            </div>

            <div className="mb-8 grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader title="Uploads by day" description={`Last ${report.days} days`} />
                    <CardBody>
                        {report.uploads_by_day.every((point) => point.count === 0) ? (
                            <EmptyState title="No recent uploads" description="Nothing was uploaded in this window." />
                        ) : (
                            <SparkBars series={report.uploads_by_day} />
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="By status" />
                    <CardBody className="space-y-2">
                        {statusOrder.map((status) => (
                            <div key={status} className="flex items-center justify-between gap-3 text-sm">
                                <StatusBadge status={status} />
                                <span className="tabular-nums font-medium text-slate-900 dark:text-night-100">{report.by_status[status] ?? 0}</span>
                            </div>
                        ))}
                    </CardBody>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Top uploaders" />
                    <CardBody className="space-y-2">
                        {report.top_uploaders.length === 0 ? (
                            <EmptyState title="No uploaders" description="This department has no documents yet." />
                        ) : (
                            report.top_uploaders.map((uploader) => (
                                <div key={uploader.id} className="flex items-center justify-between gap-3 text-sm">
                                    <span className="font-medium text-slate-900 dark:text-night-100">{uploader.name}</span>
                                    <span className="tabular-nums text-slate-500 dark:text-night-400">{uploader.count}</span>
                                </div>
                            ))
                        )}
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Recent documents" />
                    <CardBody className="space-y-2">
                        {report.recent_documents.length === 0 ? (
                            <EmptyState title="No documents" description="Nothing to show for this department." />
                        ) : (
                            report.recent_documents.map((doc) => (
                                <Link
                                    key={doc.id}
                                    href={route('documents.show', doc.id)}
                                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-night-800/50"
                                >
                                    <span className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-night-100">{doc.title}</span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        <StatusBadge status={doc.status} />
                                        <span className="text-xs text-slate-400">
                                            {doc.updated_at ? formatRelative(doc.updated_at) : ''}
                                        </span>
                                    </span>
                                </Link>
                            ))
                        )}
                    </CardBody>
                </Card>
            </div>
        </AppLayout>
    );
}
