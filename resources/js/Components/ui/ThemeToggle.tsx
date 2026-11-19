import { cn } from '@/lib/cn';
import { ThemeMode } from '@/lib/theme';
import { useTheme } from '@/hooks/useTheme';
import { Monitor, Moon, Sun } from 'lucide-react';

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
    const { mode, setMode } = useTheme();

    return (
        <div
            role="group"
            aria-label="Color theme"
            className={cn(
                'inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-night-700 dark:bg-night-800',
                className,
            )}
        >
            {OPTIONS.map(({ value, label, icon: Icon }) => {
                const active = mode === value;
                return (
                    <button
                        key={value}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-pressed={active}
                        onClick={() => setMode(value)}
                        className={cn(
                            'inline-flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-medium transition-colors',
                            active
                                ? 'bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-night-950 dark:text-night-100 dark:ring-night-700'
                                : 'text-slate-500 hover:text-slate-800 dark:text-night-400 dark:hover:text-night-200',
                            compact && 'w-7 px-0',
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {!compact && <span>{label}</span>}
                    </button>
                );
            })}
        </div>
    );
}
