import { Badge } from '@/Components/ui/Badge';
import { Card } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Input } from '@/Components/ui/Form';
import { Avatar } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { Mail, Phone, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Member {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string | null;
    is_approver: boolean;
    role?: { display_name: string } | null;
}

export default function Index({ users }: { users: Member[] }) {
    const [q, setQ] = useState('');
    const filtered = useMemo(() => {
        const s = q.toLowerCase();
        return users.filter((u) => `${u.first_name} ${u.last_name} ${u.email} ${u.role?.display_name ?? ''}`.toLowerCase().includes(s));
    }, [users, q]);

    return (
        <AppLayout title="Directory">
            <PageHeader
                title="Directory"
                description="Board members, officers and secretariat."
                actions={
                    <div className="relative w-64">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people" className="pl-9" />
                    </div>
                }
            />
            {filtered.length === 0 ? (
                <Card>
                    <EmptyState icon={Users} title="No one matches your search" />
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((u) => (
                        <Card key={u.id} className="p-5">
                            <div className="flex items-start gap-3">
                                <Avatar name={`${u.first_name} ${u.last_name}`} size="lg" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-semibold text-slate-900 dark:text-night-100">
                                        {u.first_name} {u.last_name}
                                    </p>
                                    <p className="text-sm text-slate-500 dark:text-night-400">{u.role?.display_name ?? 'Member'}</p>
                                    {u.is_approver && (
                                        <Badge tone="blue" className="mt-1.5">
                                            Approver
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 space-y-1.5 border-t border-slate-100 dark:border-night-800 pt-3 text-sm">
                                <a href={`mailto:${u.email}`} className="flex items-center gap-2 truncate text-slate-600 dark:text-night-400 hover:text-brand-700 dark:hover:text-brand-300">
                                    <Mail className="h-4 w-4 text-slate-400" /> {u.email}
                                </a>
                                {u.phone_number && (
                                    <a href={`tel:${u.phone_number}`} className="flex items-center gap-2 text-slate-600 dark:text-night-400 hover:text-brand-700 dark:hover:text-brand-300">
                                        <Phone className="h-4 w-4 text-slate-400" /> {u.phone_number}
                                    </a>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </AppLayout>
    );
}
