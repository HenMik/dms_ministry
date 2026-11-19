import { StatusBadge } from '@/Components/ui/Badge';
import { LinkButton } from '@/Components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatRelative } from '@/lib/format';
import { Link } from '@inertiajs/react';
import { ArrowLeft, BarChart3, CheckCircle2, ClipboardCheck, FileUp, XCircle } from 'lucide-react';

interface DocRow {
    id: number;
    title: string;
    status: string;
    created_at?: string | null;
    updated_at?: string | null;
}

interface MeReport {
    uploaded: number;
    awaiting_my_approval: number;
    approved_by_me: number;
    rejected_by_me: number;
    by_status: Record<string, number>;
    avg_approval_seconds: number | null;
    avg_approval_label: string | null;
    recent_uploads: DocRow[];
    pending_for_me: DocRow[];
}

const statusOrder = ['DRAFT', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'];

export default function Me({ report, user }: { report: MeReport; user: { id: number; name: string } }) {
    return (
        <AppLayout title="My report">
            <PageHeader
                title="My report"
                description={`Personal document activity for ${user.name}.`}
                breadcrumbs={[{ label: 'Reports', href: route('reports.index') }, { label: 'My report' }]}
                actions={
                    <LinkButton href={route('reports.index')} variant="secondary" icon={ArrowLeft}>
                        All reports
                    </LinkButton>
                }
            />

            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard label="Uploaded" value={report.uploaded} icon={<FileUp className="h-5 w-5" />} />
                <StatCard
                    label="Awaiting you"
                    value={report.awaiting_my_approval}
                    icon={<ClipboardCheck className="h-5 w-5" />}
                    tone={report.awaiting_my_approval > 0 ? 'warn' : 'default'}
                />
                <StatCard
                    label="Approved by you"
                    value={report.approved_by_me}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    tone="success"
                />
                <StatCard
                    label="Rejected by you"
                    value={report.rejected_by_me}
                    icon={<XCircle className="h-5 w-5" />}
                    tone={report.rejected_by_me > 0 ? 'danger' : 'default'}
                />
                <StatCard
                    label="Avg. approval"
                    value={report.avg_approval_label ?? '—'}
                    icon={<BarChart3 className="h-5 w-5" />}
                />
            </div>

            <div className="mb-8 grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                    <CardHeader title="Your uploads by status" />
                    <CardBody className="space-y-2">
                        {statusOrder.map((status) => (
                            <div key={status} className="flex items-center justify-between gap-3 text-sm">
                                <StatusBadge status={status} />
                                <span className="tabular-nums font-medium text-slate-900 dark:text-night-100">{report.by_status[status] ?? 0}</span>
                            </div>
                        ))}
                    </CardBody>
                </Card>

                <Card className="lg:col-span-2">
                    <CardHeader title="Recent uploads" />
                    <CardBody className="space-y-2">
                        {report.recent_uploads.length === 0 ? (
                            <EmptyState title="No uploads" description="You have not uploaded any documents yet." />
                        ) : (
                            report.recent_uploads.map((doc) => (
                                <Link
                                    key={doc.id}
                                    href={route('documents.show', doc.id)}
                                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-night-800/50"
                                >
                                    <span className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-night-100">{doc.title}</span>
                                    <span className="flex shrink-0 items-center gap-2">
                                        <StatusBadge status={doc.status} />
                                        <span className="text-xs text-slate-400">
                                            {doc.created_at ? formatRelative(doc.created_at) : ''}
                                        </span>
                                    </span>
                                </Link>
                            ))
                        )}
                    </CardBody>
                </Card>
            </div>

            <Card>
                <CardHeader title="Pending approvals" description="Documents currently waiting on you" />
                <CardBody className="space-y-2">
                    {report.pending_for_me.length === 0 ? (
                        <EmptyState title="Queue clear" description="Nothing is waiting for your approval." />
                    ) : (
                        report.pending_for_me.map((doc) => (
                            <Link
                                key={doc.id}
                                href={route('documents.show', doc.id)}
                                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-night-800/50"
                            >
                                <span className="min-w-0 truncate text-sm font-medium text-slate-900 dark:text-night-100">{doc.title}</span>
                                <span className="text-xs text-slate-400">
                                    {doc.updated_at ? formatRelative(doc.updated_at) : ''}
                                </span>
                            </Link>
                        ))
                    )}
                </CardBody>
            </Card>
        </AppLayout>
    );
}
