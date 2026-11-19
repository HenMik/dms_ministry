import { cn } from '@/lib/cn';
import { Dialog as HDialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { AlertTriangle, X } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { Button } from './Button';

const widths = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
};

export function Dialog({
    open,
    onClose,
    title,
    description,
    size = 'md',
    children,
    footer,
}: {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    description?: ReactNode;
    size?: keyof typeof widths;
    children?: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <HDialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop
                transition
                className="fixed inset-0 bg-slate-900/50 transition-opacity duration-150 data-[closed]:opacity-0"
            />
            <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
                    <DialogPanel
                        transition
                        className={cn(
                            'relative w-full overflow-hidden rounded-lg bg-white shadow-pop ring-1 ring-slate-900/10 transition duration-150 dark:bg-night-900 dark:ring-white/10',
                            'data-[closed]:translate-y-2 data-[closed]:opacity-0 data-[closed]:sm:scale-[0.98]',
                            widths[size],
                        )}
                    >
                        {title && (
                            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3.5 dark:border-night-700">
                                <div>
                                    <DialogTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-night-100">{title}</DialogTitle>
                                    {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-night-400">{description}</p>}
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="-mr-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-night-800 dark:hover:text-night-300"
                                    aria-label="Close"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        )}
                        <div className="px-4 py-3.5">{children}</div>
                        {footer && (
                            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-night-700 dark:bg-night-950/60 sm:flex-row sm:justify-end">
                                {footer}
                            </div>
                        )}
                    </DialogPanel>
                </div>
            </div>
        </HDialog>
    );
}

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    tone = 'danger',
    loading,
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: ReactNode;
    confirmLabel?: string;
    tone?: 'danger' | 'primary';
    loading?: boolean;
}) {
    return (
        <HDialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop transition className="fixed inset-0 bg-slate-900/40 transition-opacity duration-150 data-[closed]:opacity-0" />
            <div className="fixed inset-0 flex items-center justify-center p-4">
                <DialogPanel
                    transition
                    className="w-full max-w-md rounded-lg bg-white p-5 shadow-pop transition duration-150 data-[closed]:scale-[0.98] data-[closed]:opacity-0 dark:bg-night-900 dark:ring-1 dark:ring-white/10"
                >
                    <div className="flex gap-4">
                        <div
                            className={cn(
                                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                                tone === 'danger'
                                    ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'
                                    : 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
                            )}
                        >
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base font-semibold text-slate-900 dark:text-night-100">{title}</DialogTitle>
                            <div className="mt-1 text-sm text-slate-600 dark:text-night-400">{message}</div>
                        </div>
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                        <Button variant="secondary" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button variant={tone} onClick={onConfirm} loading={loading}>
                            {confirmLabel}
                        </Button>
                    </div>
                </DialogPanel>
            </div>
        </HDialog>
    );
}

/** Wraps a destructive action behind a confirmation dialog. */
export function useConfirm() {
    const [state, setState] = useState<{
        title: string;
        message: ReactNode;
        confirmLabel?: string;
        tone?: 'danger' | 'primary';
        action: () => void;
    } | null>(null);

    const confirm = (options: NonNullable<typeof state>) => setState(options);

    const dialog = (
        <ConfirmDialog
            open={state !== null}
            onClose={() => setState(null)}
            onConfirm={() => {
                state?.action();
                setState(null);
            }}
            title={state?.title ?? ''}
            message={state?.message}
            confirmLabel={state?.confirmLabel}
            tone={state?.tone}
        />
    );

    return { confirm, dialog };
}
