import { cn } from '@/lib/cn';
import { fullName, UserLite } from '@/types/models';
import { Check, Search, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Avatar } from './misc';

export function UserPicker({
    users,
    value,
    onChange,
    placeholder = 'Add people…',
    invalid,
    showOrder = false,
}: {
    users: UserLite[];
    value: number[];
    onChange: (ids: number[]) => void;
    placeholder?: string;
    invalid?: boolean;
    /** When true, chips show 1, 2, 3… in selection order (approval chain). */
    showOrder?: boolean;
}) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = useMemo(
        () => value.map((id) => users.find((u) => u.id === id)).filter(Boolean) as UserLite[],
        [users, value],
    );
    const matches = useMemo(() => {
        const q = query.toLowerCase();
        return users.filter((u) => !q || fullName(u).toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)).slice(0, 50);
    }, [users, query]);

    const toggle = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

    return (
        <div className="relative">
            <div
                onClick={() => inputRef.current?.focus()}
                className={cn(
                    'flex min-h-9 cursor-text flex-wrap items-center gap-1.5 rounded-md bg-white px-2 py-1.5 ring-1 ring-inset dark:bg-night-950',
                    open ? 'ring-2 ring-brand-600' : invalid ? 'ring-red-300 dark:ring-red-500/60' : 'ring-slate-300 dark:ring-night-600',
                )}
            >
                {selected.map((u, index) => (
                    <span key={u.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-1 pr-1.5 text-xs font-medium text-slate-700 dark:bg-night-800 dark:text-night-200">
                        {showOrder && (
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-brand-700 text-[10px] font-semibold text-white">
                                {index + 1}
                            </span>
                        )}
                        {!showOrder && <Avatar name={fullName(u)} size="xs" className="h-5 w-5 text-[9px]" />}
                        {fullName(u)}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggle(u.id);
                            }}
                            className="rounded text-slate-400 hover:text-slate-700 dark:hover:text-night-200"
                            aria-label={`Remove ${fullName(u)}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                <div className="flex min-w-[8rem] flex-1 items-center gap-1.5">
                    {selected.length === 0 && <Search className="h-4 w-4 text-slate-400" />}
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setOpen(true)}
                        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                        onKeyDown={(e) => {
                            if (e.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1));
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (matches[0]) toggle(matches[0].id);
                                setQuery('');
                            }
                        }}
                        placeholder={selected.length ? '' : placeholder}
                        className="w-full border-0 bg-transparent p-0 text-sm placeholder:text-slate-400 focus:ring-0"
                    />
                </div>
            </div>
            {open && (
                <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg bg-white p-1 shadow-pop ring-1 ring-slate-900/10 scrollbar-thin dark:bg-night-900 dark:ring-white/10">
                    {matches.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-500 dark:text-night-400">No people match “{query}”.</p>
                    ) : (
                        matches.map((u) => {
                            const isSelected = value.includes(u.id);
                            return (
                                <button
                                    key={u.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => toggle(u.id)}
                                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-night-800"
                                >
                                    <Avatar name={fullName(u)} size="sm" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium text-slate-800 dark:text-night-200">{fullName(u)}</span>
                                        {u.email && <span className="block truncate text-xs text-slate-500 dark:text-night-400">{u.email}</span>}
                                    </span>
                                    {isSelected && <Check className="h-4 w-4 text-brand-700 dark:text-brand-300" />}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
