import { cn } from '@/lib/cn';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    tone: ToastTone;
    message: string;
}

type Listener = (toast: Toast) => void;
const listeners = new Set<Listener>();
let counter = 0;

export function notify(message: string, tone: ToastTone = 'success') {
    const toast = { id: ++counter, tone, message };
    listeners.forEach((l) => l(toast));
}

const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    info: <Info className="h-5 w-5 text-brand-600" />,
};

export function Toaster() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener: Listener = (toast) => {
            setToasts((t) => [...t.slice(-3), toast]);
            window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), toast.tone === 'error' ? 7000 : 4000);
        };
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    return (
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-lg bg-white p-4 shadow-pop ring-1 ring-slate-900/5 dark:bg-night-900 dark:ring-white/10',
                    )}
                >
                    {icons[toast.tone]}
                    <p className="flex-1 pt-0.5 text-sm font-medium text-slate-800 dark:text-night-100">{toast.message}</p>
                    <button
                        type="button"
                        onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))}
                        className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-night-200"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
