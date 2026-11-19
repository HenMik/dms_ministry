import { cn } from '@/lib/cn';

export type ChartPoint = { label: string; value: number; color?: string };

const STATUS_COLORS: Record<string, string> = {
    DRAFT: '#94a3b8',
    REVIEW: '#f59e0b',
    APPROVED: '#10b981',
    REJECTED: '#f43f5e',
    ARCHIVED: '#64748b',
};

const SERIES_COLORS = ['#1f4d87', '#3d79cd', '#6098da', '#93bbe7', '#0d9488', '#a78bfa'];

export function statusColor(status: string): string {
    return STATUS_COLORS[status] ?? SERIES_COLORS[0];
}

export function AreaChart({
    points,
    className,
    emptyLabel = 'No uploads in this period',
}: {
    points: ChartPoint[];
    className?: string;
    emptyLabel?: string;
}) {
    const width = 560;
    const height = 220;
    const padX = 16;
    const padTop = 16;
    const padBottom = 36;
    const max = Math.max(...points.map((p) => p.value), 0);
    const chartH = height - padTop - padBottom;
    const chartW = width - padX * 2;
    const step = points.length > 1 ? chartW / (points.length - 1) : chartW;

    if (points.length === 0 || max === 0) {
        return <ChartEmpty label={emptyLabel} className={className} />;
    }

    const coords = points.map((p, i) => {
        const x = padX + i * step;
        const y = padTop + chartH - (p.value / max) * chartH;
        return { ...p, x, y };
    });

    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ');
    const area = `${line} L${coords[coords.length - 1].x},${padTop + chartH} L${coords[0].x},${padTop + chartH} Z`;

    return (
        <div className={cn('w-full', className)}>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Uploads over time">
                {[0.25, 0.5, 0.75, 1].map((t) => {
                    const y = padTop + chartH * (1 - t);
                    return (
                        <line
                            key={t}
                            x1={padX}
                            x2={width - padX}
                            y1={y}
                            y2={y}
                            className="stroke-slate-200 dark:stroke-night-800"
                            strokeWidth="1"
                        />
                    );
                })}
                <defs>
                    <linearGradient id="dms-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1f4d87" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#1f4d87" stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <path d={area} fill="url(#dms-area-fill)" />
                <path d={line} fill="none" stroke="#1f4d87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {coords.map((c) => (
                    <g key={c.label}>
                        <circle cx={c.x} cy={c.y} r="4" fill="#fff" stroke="#1f4d87" strokeWidth="2" className="dark:fill-night-900" />
                        <text
                            x={c.x}
                            y={height - 12}
                            textAnchor="middle"
                            className="fill-slate-500 text-[11px] dark:fill-night-400"
                        >
                            {c.label}
                        </text>
                    </g>
                ))}
            </svg>
            <div className="mt-1 flex items-center justify-between px-1 text-xs text-slate-500 dark:text-night-400">
                <span>Last 6 months</span>
                <span className="font-medium tabular-nums text-slate-700 dark:text-night-200">Peak {max}</span>
            </div>
        </div>
    );
}

export function DonutChart({
    points,
    className,
    emptyLabel = 'No documents to chart',
}: {
    points: ChartPoint[];
    className?: string;
    emptyLabel?: string;
}) {
    const total = points.reduce((sum, p) => sum + p.value, 0);
    if (total === 0) {
        return <ChartEmpty label={emptyLabel} className={className} />;
    }

    const size = 180;
    const stroke = 22;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    const segments = points
        .filter((p) => p.value > 0)
        .map((p, i) => {
            const length = (p.value / total) * circumference;
            const segment = {
                ...p,
                color: p.color ?? SERIES_COLORS[i % SERIES_COLORS.length],
                dash: `${length} ${circumference - length}`,
                offset,
            };
            offset += length;
            return segment;
        });

    return (
        <div className={cn('flex flex-col items-center gap-5 sm:flex-row sm:items-center', className)}>
            <div className="relative shrink-0">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Status breakdown">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        strokeWidth={stroke}
                        className="stroke-slate-100 dark:stroke-night-800"
                    />
                    {segments.map((s) => (
                        <circle
                            key={s.label}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={stroke}
                            strokeDasharray={s.dash}
                            strokeDashoffset={-s.offset}
                            strokeLinecap="butt"
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        />
                    ))}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900 dark:text-night-100">{total}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-night-400">Total</p>
                </div>
            </div>
            <ul className="w-full min-w-0 space-y-2.5">
                {points.map((p, i) => {
                    const pct = total ? Math.round((p.value / total) * 100) : 0;
                    return (
                        <li key={p.label} className="flex items-center gap-2.5 text-sm">
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: p.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }}
                            />
                            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-night-300">{p.label}</span>
                            <span className="tabular-nums text-slate-500 dark:text-night-400">{pct}%</span>
                            <span className="w-8 text-right font-medium tabular-nums text-slate-900 dark:text-night-100">{p.value}</span>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export function BarChart({
    points,
    className,
    emptyLabel = 'No department data yet',
}: {
    points: ChartPoint[];
    className?: string;
    emptyLabel?: string;
}) {
    const max = Math.max(...points.map((p) => p.value), 0);
    if (points.length === 0 || max === 0) {
        return <ChartEmpty label={emptyLabel} className={className} />;
    }

    return (
        <div className={cn('space-y-3', className)}>
            {points.map((p, i) => {
                const width = `${Math.max((p.value / max) * 100, 4)}%`;
                const color = p.color ?? SERIES_COLORS[i % SERIES_COLORS.length];
                return (
                    <div key={p.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.5rem] items-center gap-3">
                        <p className="truncate text-sm text-slate-600 dark:text-night-300" title={p.label}>
                            {p.label}
                        </p>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-night-800">
                            <div className="h-full rounded-full transition-all" style={{ width, backgroundColor: color }} />
                        </div>
                        <p className="text-right text-sm font-medium tabular-nums text-slate-900 dark:text-night-100">{p.value}</p>
                    </div>
                );
            })}
        </div>
    );
}

function ChartEmpty({ label, className }: { label: string; className?: string }) {
    return (
        <div
            className={cn(
                'flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/60 text-sm text-slate-500 dark:border-night-700 dark:bg-night-950/40 dark:text-night-400',
                className,
            )}
        >
            {label}
        </div>
    );
}
