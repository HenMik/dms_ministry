import { Logo } from '@/Components/ui/misc';
import { notify, Toaster } from '@/Components/ui/Toaster';
import { PageProps } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import { PropsWithChildren, useEffect } from 'react';

export default function ReportLayout({ title, wide, children }: PropsWithChildren<{ title: string; wide?: boolean }>) {
    const { flash } = usePage<PageProps>().props;

    useEffect(() => {
        if (flash?.success) notify(flash.success, 'success');
        if (flash?.error) notify(flash.error, 'error');
    }, [flash?.success, flash?.error]);

    return (
        <>
            <Head title={title} />
            <div className="min-h-screen bg-slate-50 dark:bg-night-950">
                <header className="border-b border-slate-200 bg-white dark:border-night-800 dark:bg-night-900">
                    <div className={`mx-auto flex items-center justify-between px-4 py-3 sm:px-6 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
                        <Logo />
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-night-400">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Secure report link
                        </span>
                    </div>
                </header>
                <main className={`mx-auto px-4 py-8 sm:px-6 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>{children}</main>
                <footer className="pb-8 text-center text-xs text-slate-400 dark:text-night-500">United Civil Servants SACCO · Board portal</footer>
            </div>
            <Toaster />
        </>
    );
}
