import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

export interface Crumb {
    label: string;
    href?: string;
}

export function PageHeader({
    title,
    description,
    actions,
    breadcrumbs,
    meta,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    breadcrumbs?: Crumb[];
    meta?: ReactNode;
}) {
    return (
        <div className="mb-5">
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-sm text-slate-500 dark:text-night-400">
                    {breadcrumbs.map((crumb, i) => (
                        <span key={i} className="flex items-center gap-1">
                            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-night-500" />}
                            {crumb.href ? (
                                <Link href={crumb.href} className="hover:text-slate-800 dark:hover:text-night-200">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="max-w-[16rem] truncate text-slate-700 dark:text-night-300">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </nav>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-night-100 sm:text-2xl">{title}</h1>
                    {description && <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-night-400">{description}</p>}
                    {meta && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-night-400">{meta}</div>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
        </div>
    );
}
