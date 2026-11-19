import { StatusBadge } from '@/Components/ui/Badge';
import { LinkButton } from '@/Components/ui/Button';
import { Card, CardBody, CardHeader, StatCard } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatRelative } from '@/lib/format';
import { Link } from '@inertiajs/react';
import { BarChart3, Building2, CheckCircle2, ClipboardCheck, FileUp, User } from 'lucide-react';

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

interface DepartmentOption {
    id: number;
    name: string;
    code: string;
}

export default function Index({
    me,
    departments,
}: {
    me: MeReport;
    departments: DepartmentOption[];
    canViewAllDepartmentReports: boolean;
}) {
    return (
        <AppLayout title="Reports">
            <PageHeader
                title="Reports"
                description="Your personal activity, plus any department reports you are allowed to view."
                breadcrumbs={[{ label: 'Reports' }]}
                actions={
                    <LinkButton href={route('reports.me')} variant="secondary" icon={User}>
                        Full personal report
                    </LinkButton>
                }
            />

            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Uploaded by you" value={me.uploaded} icon={<FileUp className="h-5 w-5" />} />
                <StatCard
                    label="Awaiting your approval"
                    value={me.awaiting_my_approval}
                    icon={<ClipboardCheck className="h-5 w-5" />}
                    tone={me.awaiting_my_approval > 0 ? 'warn' : 'default'}
                />
                <StatCard
                    label="Approved by you"
                    value={me.approved_by_me}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    tone="success"
                />
                <StatCard
                    label="Avg. approval time"
                    value={me.avg_approval_label ?? '—'}
                    icon={<BarChart3 className="h-5 w-5" />}
                    hint="On documents you uploaded"
                />
            </div>

            <div className="mb-8 grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader title="Recent uploads" description="Documents you uploaded" />
                    <CardBody className="space-y-3">
                        {me.recent_uploads.length === 0 ? (
                            <EmptyState title="No uploads yet" description="Documents you upload will show here." />
                        ) : (
                            me.recent_uploads.map((doc) => (
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

                <Card>
                    <CardHeader title="Waiting on you" description="Current approval queue" />
                    <CardBody className="space-y-3">
                        {me.pending_for_me.length === 0 ? (
                            <EmptyState title="Nothing pending" description="You have no documents waiting for approval." />
                        ) : (
                            me.pending_for_me.map((doc) => (
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
            </div>

            <Card>
                <CardHeader
                    title="Department reports"
                    description="Only departments you are selected for, or that your role can access."
                />
                <CardBody>
                    {departments.length === 0 ? (
                        <EmptyState
                            title="No department reports"
                            description="Ask an administrator to select you as a report viewer on a department."
                        />
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-night-800">
                            {departments.map((department) => (
                                <li key={department.id}>
                                    <Link
                                        href={route('reports.department', department.id)}
                                        className="flex items-center gap-3 py-3 transition hover:bg-slate-50 dark:hover:bg-night-800/50"
                                    >
                                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300">
                                            <Building2 className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-medium text-slate-900 dark:text-night-100">{department.name}</span>
                                            <span className="block text-xs text-slate-500 dark:text-night-400">{department.code}</span>
                                        </span>
                                        <span className="text-sm font-medium text-brand-700 dark:text-brand-300">View report</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </AppLayout>
    );
}
