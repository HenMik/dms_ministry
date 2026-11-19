import { cn } from '@/lib/cn';
import { humanize } from '@/lib/format';
import { ReactNode } from 'react';

export type BadgeTone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'brand';

const tones: Record<BadgeTone, string> = {
    gray: 'bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-night-800 dark:text-night-300 dark:ring-night-400/20',
    blue: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-400/20',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/20',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/25',
    red: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300 dark:ring-red-400/20',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-400/20',
    brand: 'bg-brand-50 text-brand-800 ring-brand-700/20 dark:bg-brand-950 dark:text-brand-200 dark:ring-brand-400/20',
};

const dots: Record<BadgeTone, string> = {
    gray: 'bg-slate-400',
    blue: 'bg-sky-500',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    violet: 'bg-violet-500',
    brand: 'bg-brand-600',
};

export function Badge({
    tone = 'gray',
    dot,
    className,
    children,
}: {
    tone?: BadgeTone;
    dot?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset',
                tones[tone],
                className,
            )}
        >
            {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dots[tone])} />}
            {children}
        </span>
    );
}

const statusTones: Record<string, BadgeTone> = {
    DRAFT: 'gray',
    REVIEW: 'amber',
    PENDING: 'amber',
    REQUESTED: 'blue',
    SUBMITTED: 'amber',
    RETURNED: 'red',
    PROPOSED: 'amber',
    APPROVED: 'green',
    ADOPTED: 'green',
    COMPLETED: 'green',
    SIGNED: 'brand',
    READY: 'blue',
    PUBLISHED: 'green',
    SCHEDULED: 'blue',
    IN_PROGRESS: 'violet',
    POSTPONED: 'amber',
    CANCELLED: 'red',
    REJECTED: 'red',
    WITHDRAWN: 'gray',
    ARCHIVED: 'gray',
    OVERDUE: 'red',
    LOW: 'gray',
    MEDIUM: 'blue',
    HIGH: 'amber',
    URGENT: 'red',
};

const statusLabels: Record<string, string> = {
    REVIEW: 'In review',
    IN_PROGRESS: 'In progress',
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
    if (!status) return null;
    return (
        <Badge tone={statusTones[status] ?? 'gray'} dot className={className}>
            {statusLabels[status] ?? humanize(status)}
        </Badge>
    );
}
