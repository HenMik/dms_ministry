import { Logo } from '@/Components/ui/misc';
import { ThemeToggle } from '@/Components/ui/ThemeToggle';
import { Head } from '@inertiajs/react';
import { PropsWithChildren, ReactNode } from 'react';

function InstitutionalMark({ inverted = false }: { inverted?: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <img
                src="/images/branding/malawi-crest.svg"
                alt=""
                className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
            />
            <div className="min-w-0 leading-tight">
                <p className={inverted ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-200/90' : 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-night-400'}>
                    Republic of Malawi
                </p>
                <p className={inverted ? 'mt-0.5 text-sm font-semibold text-white' : 'mt-0.5 text-sm font-semibold text-slate-900 dark:text-night-100'}>
                    Ministry of Trade and Industry
                </p>
            </div>
        </div>
    );
}

function PartnerMark({ inverted = false }: { inverted?: boolean }) {
    return (
        <a
            href="https://www.ucssacco.com/"
            target="_blank"
            rel="noopener noreferrer"
            className={
                inverted
                    ? 'inline-flex items-center gap-2.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 transition hover:bg-white/10'
                    : 'inline-flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition hover:border-slate-300 hover:bg-white dark:border-night-700 dark:bg-night-900 dark:hover:border-night-600 dark:hover:bg-night-800'
            }
            title="UCSSACCO"
        >
            <img
                src={inverted ? '/images/branding/ucssacco-logo-light.png' : '/images/branding/ucssacco-logo.png'}
                alt="UCSSACCO"
                className="h-7 w-7 object-contain"
            />
            <span className={inverted ? 'text-[11px] leading-tight text-slate-300' : 'text-[11px] leading-tight text-slate-600 dark:text-night-400'}>
                <span className="block font-medium">Donated by</span>
                <span className={inverted ? 'font-semibold text-white' : 'font-semibold text-slate-800 dark:text-night-100'}>UCSSACCO</span>
            </span>
        </a>
    );
}

export default function GuestLayout({
    title,
    description,
    children,
}: PropsWithChildren<{ title: string; description?: ReactNode }>) {
    return (
        <>
            <Head title={title} />
            <div className="flex min-h-screen">
                <aside className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-brand-950 px-10 py-10 lg:flex xl:w-[38%]">
                    <img
                        src="/images/dms-login.jpg"
                        alt=""
                        className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-50"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-950/85 via-brand-950/70 to-slate-950/60" />

                    <div className="relative space-y-8">
                        <InstitutionalMark inverted />
                        <Logo inverted />
                    </div>

                    <div className="relative">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200/90">Document management</p>
                        <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white">
                            Secure records for
                            <br />
                            government departments.
                        </h2>
                        <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
                            Store, approve, sign, and archive official documents with department-based access control.
                        </p>
                    </div>

                    <div className="relative">
                        <PartnerMark inverted />
                    </div>
                </aside>

                <main className="relative flex flex-1 flex-col justify-center bg-white px-6 py-12 dark:bg-night-950 sm:px-12">
                    <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
                        <ThemeToggle compact />
                    </div>
                    <div className="mx-auto w-full max-w-sm">
                        <div className="mb-10 space-y-5 lg:hidden">
                            <InstitutionalMark />
                            <div className="flex items-center justify-between gap-3">
                                <Logo />
                                <PartnerMark />
                            </div>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-night-100">{title}</h1>
                        {description && <p className="mt-2 text-sm text-slate-500 dark:text-night-400">{description}</p>}
                        <div className="mt-8">{children}</div>
                    </div>
                </main>
            </div>
        </>
    );
}
