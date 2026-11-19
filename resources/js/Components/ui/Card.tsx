import { cn } from '@/lib/cn';
import { Link } from '@inertiajs/react';
import { HTMLAttributes, ReactNode } from 'react';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('rounded-lg border border-slate-200 bg-white dark:border-night-700 dark:bg-night-900', className)} {...rest} />;
}

export function CardHeader({
    title,
    description,
    actions,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5 dark:border-night-700', className)}>
            <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-night-100">{title}</h3>
                {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-night-400">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
    );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('px-4 py-3.5', className)} {...rest} />;
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'flex items-center justify-end gap-2 rounded-b-lg border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-night-700 dark:bg-night-950/60',
                className,
            )}
            {...rest}
        />
    );
}

const statTones = {
    default: {
        wrap: 'border-slate-200 hover:border-brand-200 dark:border-night-800 dark:hover:border-brand-700',
        icon: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
        value: 'text-slate-900 dark:text-night-100',
    },
    warn: {
        wrap: 'border-amber-200/80 bg-amber-50/40 hover:border-amber-300 dark:border-amber-900/60 dark:bg-amber-950/30 dark:hover:border-amber-700',
        icon: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
        value: 'text-amber-950 dark:text-amber-100',
    },
    danger: {
        wrap: 'border-rose-200/80 bg-rose-50/40 hover:border-rose-300 dark:border-rose-900/60 dark:bg-rose-950/30 dark:hover:border-rose-700',
        icon: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
        value: 'text-rose-950 dark:text-rose-100',
    },
    success: {
        wrap: 'border-emerald-200/80 bg-emerald-50/30 hover:border-emerald-300 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:hover:border-emerald-700',
        icon: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        value: 'text-emerald-950 dark:text-emerald-100',
    },
} as const;

export function StatCard({
    label,
    value,
    icon,
    hint,
    href,
    tone = 'default',
}: {
    label: string;
    value: ReactNode;
    icon?: ReactNode;
    hint?: ReactNode;
    href?: string;
    tone?: keyof typeof statTones;
}) {
    const t = statTones[tone];
    const body = (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500 dark:text-night-400">{label}</p>
                <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight tabular-nums', t.value)}>{value}</p>
                {hint && <p className="mt-1 text-xs text-slate-500 dark:text-night-400">{hint}</p>}
            </div>
            {icon && <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', t.icon)}>{icon}</div>}
        </div>
    );

    const className = cn('block rounded-lg border bg-white p-4 transition dark:bg-night-900', t.wrap);

    return href ? (
        <Link href={href} className={className}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}
