import { Badge } from '@/Components/ui/Badge';
import { Card } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Avatar, Paginated, Pagination } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatDateTime, humanize } from '@/lib/format';
import { fullName, UserLite } from '@/types/models';
import { History } from 'lucide-react';

interface Log {
    id: number;
    action: string;
    description: string;
    ip_address: string | null;
    created_at: string;
    user?: UserLite | null;
}

const tone = (action: string) =>
    action.includes('DELETE') || action.includes('REJECT') ? 'red' : action.includes('SIGN') || action.includes('APPROVE') ? 'green' : action.includes('LOGIN') ? 'blue' : 'gray';

export default function ActivityLogs({ logs }: { logs: Paginated<Log> }) {
    return (
        <AppLayout title="Audit log">
            <PageHeader title="Audit log" description="A record of sign-ins, uploads, approvals, signatures and administrative changes." />
            <Card>
                {logs.data.length === 0 ? (
                    <EmptyState icon={History} title="No activity recorded yet" />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table-base">
                            <thead>
                                <tr>
                                    <th>When</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th className="hidden md:table-cell">Details</th>
                                    <th className="hidden lg:table-cell">IP address</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.data.map((l) => (
                                    <tr key={l.id}>
                                        <td className="whitespace-nowrap text-slate-500 dark:text-night-400">{formatDateTime(l.created_at)}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <Avatar name={fullName(l.user)} size="xs" />
                                                <span className="whitespace-nowrap">{l.user ? fullName(l.user) : 'System'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge tone={tone(l.action)}>{humanize(l.action)}</Badge>
                                        </td>
                                        <td className="hidden max-w-md truncate md:table-cell">{l.description}</td>
                                        <td className="hidden font-mono text-xs text-slate-500 dark:text-night-400 lg:table-cell">{l.ip_address ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination meta={logs} />
            </Card>
        </AppLayout>
    );
}
