import { cn } from '@/lib/cn';
import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

export function EmptyState({
    icon: Icon,
    illustration,
    title,
    description,
    action,
    className,
    compact,
}: {
    icon?: LucideIcon;
    illustration?: ReactNode;
    title: string;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
    compact?: boolean;
}) {
    return (
        <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14', className)}>
            {illustration ? (
                <div className="mb-4">{illustration}</div>
            ) : (
                Icon && (
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-night-800 dark:text-night-400">
                        <Icon className="h-5 w-5" />
                    </div>
                )
            )}
            <p className="text-sm font-semibold text-slate-900 dark:text-night-100">{title}</p>
            {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-night-400">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
