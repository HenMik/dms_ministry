import { cn } from '@/lib/cn';
import { fileExtension, initials } from '@/lib/format';
import { Link } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { ReactNode } from 'react';

const avatarColors = [
    'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
    'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
    'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200',
    'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
];

export function Avatar({ name, size = 'md', className }: { name?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
    const hash = [...(name ?? '')].reduce((a, c) => a + c.charCodeAt(0), 0);
    const sizes = { xs: 'h-6 w-6 text-[10px]', sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };
    return (
        <span
            className={cn(
                'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
                avatarColors[hash % avatarColors.length],
                sizes[size],
                className,
            )}
            title={name ?? undefined}
        >
            {initials(name)}
        </span>
    );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
    const shown = names.slice(0, max);
    return (
        <div className="flex -space-x-1.5">
            {shown.map((n, i) => (
                <Avatar key={i} name={n} size="xs" className="ring-2 ring-white dark:ring-night-900" />
            ))}
            {names.length > max && (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white dark:bg-night-800 dark:text-night-300 dark:ring-night-900">
                    +{names.length - max}
                </span>
            )}
        </div>
    );
}

export function FileIcon({ mime, path, className }: { mime?: string | null; path?: string | null; className?: string }) {
    const kind = mime ? mimeLabel(mime) : fileExtension(path, mime) || 'file';
    const label = kind === 'file' ? 'DOC' : kind.toUpperCase().slice(0, 4);

    return (
        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center', className)} title={label}>
            <svg viewBox="0 0 36 44" className="h-full w-auto" aria-hidden>
                <path
                    d="M4 2.5h18.5L32 12v28.5a1.5 1.5 0 0 1-1.5 1.5h-26A1.5 1.5 0 0 1 2 40.5v-36A1.5 1.5 0 0 1 3.5 2.5H4z"
                    fill="#fff"
                    stroke="#cbd5e1"
                    strokeWidth="1.25"
                />
                <path d="M22.5 2.5V10a2 2 0 0 0 2 2H32" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.25" strokeLinejoin="round" />
                <rect x="8" y="20" width="20" height="2.25" rx="1" fill="#94a3b8" />
                <rect x="8" y="25.5" width="16" height="2.25" rx="1" fill="#cbd5e1" />
                <rect x="8" y="31" width="12" height="2.25" rx="1" fill="#cbd5e1" />
                <rect x="8" y="12" width="10" height="4.5" rx="1" fill="#1f4d87" />
                <text
                    x="13"
                    y="15.4"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="3.4"
                    fontWeight="700"
                    fontFamily="Poppins, system-ui, sans-serif"
                >
                    {label}
                </text>
            </svg>
        </span>
    );
}

function mimeLabel(mime: string): string {
    if (mime.includes('pdf')) return 'pdf';
    if (mime.includes('wordprocessing') || mime.includes('msword')) return 'docx';
    if (mime.includes('spreadsheet') || mime.includes('excel')) return 'xlsx';
    if (mime.includes('csv')) return 'csv';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'pptx';
    if (mime.startsWith('image/')) return 'img';
    if (mime.startsWith('text/')) return 'txt';
    return 'file';
}

export function DateTile({
    date,
    className,
    emphasis,
}: {
    date: string | null | undefined;
    className?: string;
    emphasis?: boolean;
}) {
    const d = date ? new Date(date) : null;
    return (
        <div
            className={cn(
                'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border leading-none',
                emphasis
                    ? 'border-brand-600 bg-brand-700 text-white'
                    : 'border-slate-200 bg-white dark:border-night-700 dark:bg-night-900',
                className,
            )}
        >
            <span
                className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    emphasis ? 'text-brand-100' : 'text-brand-700 dark:text-brand-300',
                )}
            >
                {d ? d.toLocaleDateString(undefined, { month: 'short' }) : '—'}
            </span>
            <span className={cn('mt-0.5 text-lg font-semibold', emphasis ? 'text-white' : 'text-slate-900 dark:text-night-100')}>
                {d ? d.getDate() : ''}
            </span>
        </div>
    );
}

export function DetailList({ items, className }: { items: { label: string; value: ReactNode; hidden?: boolean }[]; className?: string }) {
    return (
        <dl className={cn('divide-y divide-slate-100 dark:divide-night-800', className)}>
            {items
                .filter((i) => !i.hidden)
                .map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                        <dt className="text-slate-500 dark:text-night-400">{item.label}</dt>
                        <dd className="text-right font-medium text-slate-800 dark:text-night-200">{item.value}</dd>
                    </div>
                ))}
        </dl>
    );
}

const alertStyles = {
    info: { cls: 'bg-brand-50 text-brand-900 ring-brand-700/15 dark:bg-brand-950 dark:text-brand-100 dark:ring-brand-400/20', icon: Info, iconCls: 'text-brand-600 dark:text-brand-300' },
    success: { cls: 'bg-emerald-50 text-emerald-900 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-400/20', icon: CheckCircle2, iconCls: 'text-emerald-600 dark:text-emerald-300' },
    warning: { cls: 'bg-amber-50 text-amber-900 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-400/25', icon: TriangleAlert, iconCls: 'text-amber-600 dark:text-amber-300' },
    error: { cls: 'bg-red-50 text-red-900 ring-red-600/20 dark:bg-red-950 dark:text-red-100 dark:ring-red-400/20', icon: AlertCircle, iconCls: 'text-red-600 dark:text-red-300' },
};

export function Alert({
    tone = 'info',
    title,
    children,
    action,
    className,
}: {
    tone?: keyof typeof alertStyles;
    title?: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    const s = alertStyles[tone];
    const Icon = s.icon;
    return (
        <div className={cn('flex items-start gap-3 rounded-lg p-3.5 text-sm ring-1 ring-inset', s.cls, className)}>
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.iconCls)} />
            <div className="flex-1">
                {title && <p className="font-semibold">{title}</p>}
                {children && <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
            </div>
            {action}
        </div>
    );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
    return (
        <span className={cn('flex items-center gap-2.5', className)}>
            <span
                className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold',
                    inverted ? 'bg-white text-brand-800' : 'bg-brand-700 text-white',
                )}
            >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                    <path d="M14 3v5h5" />
                    <path d="M8 13h8M8 17h5" />
                </svg>
            </span>
            <span className="leading-tight">
                <span className={cn('block text-[15px] font-semibold tracking-tight', inverted ? 'text-white' : 'text-slate-900 dark:text-night-100')}>
                    DMS
                </span>
                <span className={cn('block text-[11px] font-medium', inverted ? 'text-slate-400' : 'text-slate-500 dark:text-night-400')}>Documents</span>
            </span>
        </span>
    );
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
    links: { url: string | null; label: string; active: boolean }[];
}

export function Pagination({ meta, className }: { meta: Paginated<unknown>; className?: string }) {
    if (meta.last_page <= 1) {
        return meta.total > 0 ? (
            <div className={cn('border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-night-800 dark:text-night-400', className)}>
                {meta.total} {meta.total === 1 ? 'result' : 'results'}
            </div>
        ) : null;
    }

    const pages = meta.links.slice(1, -1);

    return (
        <div className={cn('flex items-center justify-between gap-4 border-t border-slate-100 px-4 py-3 dark:border-night-800', className)}>
            <p className="text-sm text-slate-500 dark:text-night-400">
                Showing <span className="font-medium text-slate-700 dark:text-night-200">{meta.from}</span>–
                <span className="font-medium text-slate-700 dark:text-night-200">{meta.to}</span> of{' '}
                <span className="font-medium text-slate-700 dark:text-night-200">{meta.total}</span>
            </p>
            <div className="flex items-center gap-1">
                <PageLink url={meta.prev_page_url} label="Previous" />
                <div className="hidden items-center gap-1 sm:flex">
                    {pages.map((link, i) =>
                        link.url ? (
                            <Link
                                key={i}
                                href={link.url}
                                preserveScroll
                                className={cn(
                                    'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm',
                                    link.active
                                        ? 'bg-brand-700 font-medium text-white'
                                        : 'text-slate-600 hover:bg-slate-100 dark:text-night-300 dark:hover:bg-night-800',
                                )}
                            >
                                {link.label}
                            </Link>
                        ) : (
                            <span key={i} className="px-1 text-sm text-slate-400">
                                …
                            </span>
                        ),
                    )}
                </div>
                <PageLink url={meta.next_page_url} label="Next" />
            </div>
        </div>
    );
}

function PageLink({ url, label }: { url: string | null; label: string }) {
    const cls = 'inline-flex h-8 items-center rounded-md px-3 text-sm font-medium ring-1 ring-inset ring-slate-300 dark:ring-night-600';
    return url ? (
        <Link href={url} preserveScroll className={cn(cls, 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-night-900 dark:text-night-200 dark:hover:bg-night-800')}>
            {label}
        </Link>
    ) : (
        <span className={cn(cls, 'cursor-not-allowed bg-slate-50 text-slate-400 dark:bg-night-900 dark:text-night-600')}>{label}</span>
    );
}

export function Tabs<T extends string>({
    tabs,
    value,
    onChange,
    className,
}: {
    tabs: { value: T; label: ReactNode; count?: number; href?: string; icon?: ReactNode }[];
    value: T;
    onChange?: (value: T) => void;
    className?: string;
}) {
    return (
        <div
            role="tablist"
            className={cn(
                'inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-slate-100 p-1 scrollbar-thin dark:bg-night-800',
                className,
            )}
        >
            {tabs.map((tab) => {
                const active = tab.value === value;
                const cls = cn(
                    'inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                        ? 'bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-night-950 dark:text-night-100 dark:ring-night-700'
                        : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-night-400 dark:hover:bg-night-900/60 dark:hover:text-night-200',
                );
                const inner = (
                    <>
                        {tab.icon}
                        <span>{tab.label}</span>
                        {tab.count !== undefined && (
                            <span
                                className={cn(
                                    'min-w-5 rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums',
                                    active
                                        ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200'
                                        : 'bg-slate-200/80 text-slate-600 dark:bg-night-700 dark:text-night-300',
                                )}
                            >
                                {tab.count}
                            </span>
                        )}
                    </>
                );

                return tab.href ? (
                    <Link key={tab.value} href={tab.href} preserveScroll role="tab" aria-selected={active} className={cls}>
                        {inner}
                    </Link>
                ) : (
                    <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange?.(tab.value)}
                        className={cls}
                    >
                        {inner}
                    </button>
                );
            })}
        </div>
    );
}

export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    className,
}: {
    options: { value: T; label: ReactNode; icon?: ReactNode }[];
    value: T;
    onChange: (v: T) => void;
    className?: string;
}) {
    return (
        <div
            role="tablist"
            className={cn(
                'inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-1 dark:bg-night-800',
                className,
            )}
        >
            {options.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(opt.value)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                            active
                                ? 'bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-night-950 dark:text-night-100 dark:ring-night-700'
                                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-night-400 dark:hover:bg-night-900/60 dark:hover:text-night-200',
                        )}
                    >
                        {opt.icon}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}
