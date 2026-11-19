import { Menu } from '@/Components/ui/Menu';
import { Avatar, Logo } from '@/Components/ui/misc';
import { ThemeToggle } from '@/Components/ui/ThemeToggle';
import { notify, Toaster } from '@/Components/ui/Toaster';
import { cn } from '@/lib/cn';
import { PageProps } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Archive,
    BarChart3,
    Bell,
    FileText,
    History,
    Landmark,
    LayoutDashboard,
    LogOut,
    LucideIcon,
    Menu as MenuIcon,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Settings,
    ShieldCheck,
    UserCircle,
    UserCog,
    Users,
    X,
} from 'lucide-react';
import { FormEvent, PropsWithChildren, ReactNode, useEffect, useRef, useState } from 'react';

const SIDEBAR_KEY = 'dms.sidebar.collapsed';
const SIDEBAR_EXPANDED = 'w-64';
const SIDEBAR_COLLAPSED = 'w-[4.5rem]';

interface NavItem {
    label: string;
    href: string;
    icon: LucideIcon;
    active: boolean;
    badge?: number;
}

function useNavigation() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const main: NavItem[] = [
        { label: 'Dashboard', href: route('dashboard'), icon: LayoutDashboard, active: route().current('dashboard') },
        { label: 'Documents', href: route('documents.index'), icon: FileText, active: route().current('documents.*') },
        { label: 'Reports', href: route('reports.index'), icon: BarChart3, active: route().current('reports.*') },
        { label: 'Archive', href: route('archive.index'), icon: Archive, active: route().current('archive.index') },
        { label: 'Directory', href: route('team.index'), icon: Users, active: route().current('team.index') },
    ];

    const admin: NavItem[] = [];
    if (user.can_manage_users) {
        admin.push({ label: 'Users', href: route('users.index'), icon: UserCog, active: route().current('users.index') });
    }
    if (user.can_manage_departments) {
        admin.push({ label: 'Departments', href: route('departments.index'), icon: Landmark, active: route().current('departments.*') });
    }
    if (user.can_manage_roles) {
        admin.push({ label: 'Roles', href: route('roles.index'), icon: ShieldCheck, active: route().current('roles.*') });
    }
    if (user.can_manage_settings) {
        admin.push({ label: 'Settings', href: route('settings.edit'), icon: Settings, active: route().current('settings.*') });
    }
    if (user.can_view_activity) {
        admin.push({ label: 'Audit log', href: route('activity-logs.index'), icon: History, active: route().current('activity-logs.*') });
    }

    return { main, admin };
}

function useSidebarCollapsed() {
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        try {
            setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
        } catch {
            /* ignore */
        }
    }, []);

    const toggle = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
            } catch {
                /* ignore */
            }
            return next;
        });
    };

    return { collapsed, toggle };
}

function NavLinks({ items, onNavigate, collapsed }: { items: NavItem[]; onNavigate?: () => void; collapsed?: boolean }) {
    return (
        <ul>
            {items.map((item) => (
                <li key={item.href}>
                    <Link
                        href={item.href}
                        onClick={onNavigate}
                        title={collapsed ? item.label : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        aria-current={item.active ? 'page' : undefined}
                        className={cn(
                            'group relative flex items-center gap-3 py-2.5 text-sm font-medium transition-colors',
                            collapsed ? 'justify-center px-0' : 'px-5',
                            item.active
                                ? 'bg-white/10 text-white dark:bg-night-800 dark:text-night-50'
                                : 'text-slate-300 hover:bg-white/[0.06] hover:text-white dark:text-night-400 dark:hover:bg-night-800/70 dark:hover:text-night-100',
                        )}
                    >
                        {item.active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brand-300 dark:bg-brand-400" />}
                        <span className="relative">
                            <item.icon
                                className={cn(
                                    'h-[18px] w-[18px] shrink-0',
                                    item.active
                                        ? 'text-brand-200 dark:text-brand-300'
                                        : 'text-slate-400 group-hover:text-slate-300 dark:text-night-500 dark:group-hover:text-night-300',
                                )}
                            />
                            {collapsed && item.badge != null && item.badge > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 h-1.5 w-1.5 rounded-full bg-brand-300 dark:bg-brand-400" />
                            )}
                        </span>
                        {!collapsed && (
                            <>
                                <span className="flex-1 truncate">{item.label}</span>
                                {item.badge != null && item.badge > 0 ? (
                                    <span className="min-w-5 rounded-full bg-brand-800 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-brand-100 dark:bg-night-700 dark:text-night-200">
                                        {item.badge > 99 ? '99+' : item.badge}
                                    </span>
                                ) : null}
                            </>
                        )}
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function NavSection({ label, collapsed, children }: { label?: string; collapsed?: boolean; children: ReactNode }) {
    return (
        <div>
            {label && !collapsed && (
                <p className="mb-1 px-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-night-500">{label}</p>
            )}
            {label && collapsed && <div className="mx-auto mb-2 h-px w-8 bg-white/10 dark:bg-night-800" />}
            {children}
        </div>
    );
}

function Sidebar({
    onNavigate,
    collapsed,
}: {
    onNavigate?: () => void;
    collapsed?: boolean;
}) {
    const { main, admin } = useNavigation();
    const { auth, unreadNotifications } = usePage<PageProps>().props;
    const user = auth.user;
    const role = user.role?.display_name ?? (user.is_admin ? 'Administrator' : 'Member');

    return (
        <div className="flex h-full flex-col border-r border-transparent bg-brand-950 dark:border-night-800 dark:bg-night-950">
            <div
                className={cn(
                    'flex h-14 shrink-0 items-center border-b border-white/10 dark:border-night-700',
                    collapsed ? 'justify-center px-2' : 'px-4',
                )}
            >
                <Link
                    href={route('dashboard')}
                    onClick={onNavigate}
                    className={cn('min-w-0', collapsed && 'flex justify-center')}
                    title="DMS"
                >
                    {collapsed ? (
                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-sm font-bold text-brand-800 dark:bg-night-100 dark:text-night-900">
                            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                                <path d="M14 3v5h5" />
                                <path d="M8 13h8M8 17h5" />
                            </svg>
                        </span>
                    ) : (
                        <Logo inverted />
                    )}
                </Link>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden py-4 scrollbar-thin">
                <NavSection label="Workspace" collapsed={collapsed}>
                    <NavLinks items={main} onNavigate={onNavigate} collapsed={collapsed} />
                </NavSection>
                {admin.length > 0 && (
                    <NavSection label="Administration" collapsed={collapsed}>
                        <NavLinks items={admin} onNavigate={onNavigate} collapsed={collapsed} />
                    </NavSection>
                )}
            </nav>

            <div className="border-t border-white/10 py-2 dark:border-night-800">
                <Link
                    href={route('notifications.index')}
                    onClick={onNavigate}
                    title={collapsed ? 'Notifications' : undefined}
                    aria-label={collapsed ? 'Notifications' : undefined}
                    className={cn(
                        'flex items-center gap-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white dark:text-night-400 dark:hover:bg-night-800/70 dark:hover:text-night-100',
                        collapsed ? 'justify-center px-0' : 'px-5',
                    )}
                >
                    <span className="relative">
                        <Bell className="h-[18px] w-[18px] text-slate-400 dark:text-night-500" />
                        {!!unreadNotifications && (
                            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                        )}
                    </span>
                    {!collapsed && (
                        <>
                            <span className="flex-1">Notifications</span>
                            {!!unreadNotifications && (
                                <span className="min-w-5 rounded-full bg-brand-800 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-brand-100 dark:bg-night-700 dark:text-night-200">
                                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                                </span>
                            )}
                        </>
                    )}
                </Link>

                <Link
                    href={route('profile.edit')}
                    onClick={onNavigate}
                    title={collapsed ? `${user.name} · ${role}` : undefined}
                    className={cn(
                        'flex items-center gap-3 py-2.5 transition hover:bg-white/[0.06] dark:hover:bg-night-800/70',
                        collapsed ? 'justify-center px-0' : 'px-5',
                    )}
                >
                    <Avatar name={user.name} size="sm" />
                    {!collapsed && (
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-white dark:text-night-100">{user.name}</span>
                            <span className="block truncate text-xs text-slate-400 dark:text-night-500">{role}</span>
                        </span>
                    )}
                </Link>

                <Link
                    href={route('logout')}
                    method="post"
                    as="button"
                    onClick={onNavigate}
                    title={collapsed ? 'Sign out' : undefined}
                    aria-label={collapsed ? 'Sign out' : undefined}
                    className={cn(
                        'flex w-full items-center gap-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white dark:text-night-400 dark:hover:bg-night-800/70 dark:hover:text-night-100',
                        collapsed ? 'justify-center px-0' : 'px-5',
                    )}
                >
                    <LogOut className="h-[18px] w-[18px] shrink-0 text-slate-400 dark:text-night-500" />
                    {!collapsed && <span>Sign out</span>}
                </Link>

                {!collapsed && (
                    <p className="px-5 pb-2 pt-1 text-[10px] leading-snug text-slate-500 dark:text-night-600">
                        Developed by Software Engineering Department
                    </p>
                )}
            </div>
        </div>
    );
}

function GlobalSearch() {
    const [q, setQ] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('q') ?? '' : ''));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (q.trim()) router.get(route('archive.search'), { q: q.trim() });
    };

    return (
        <form onSubmit={submit} className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search documents…"
                className="h-9 w-full rounded-md border-0 bg-slate-100 pl-9 pr-14 text-sm text-slate-900 placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-brand-600 dark:bg-night-800 dark:text-night-100 dark:placeholder:text-night-400 dark:focus:bg-night-900"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-white px-1.5 text-[10px] font-medium text-slate-500 dark:border-night-600 dark:bg-night-900 dark:text-night-400 sm:block">
                Ctrl K
            </kbd>
        </form>
    );
}

export default function AppLayout({
    title,
    children,
    fullBleed,
}: PropsWithChildren<{ title: string; fullBleed?: boolean; actions?: ReactNode }>) {
    const { auth, flash, unreadNotifications } = usePage<PageProps>().props;
    const user = auth.user;
    const [mobileOpen, setMobileOpen] = useState(false);
    const { collapsed, toggle } = useSidebarCollapsed();

    useEffect(() => {
        if (flash?.success) notify(flash.success, 'success');
        if (flash?.error) notify(flash.error, 'error');
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        return router.on('invalid', (event) => {
            const status = event.detail.response.status;
            if (status === 403) {
                event.preventDefault();
                notify('You do not have permission to do that.', 'error');
            } else if (status === 413) {
                event.preventDefault();
                notify('That file is too large to upload.', 'error');
            }
        });
    }, []);

    return (
        <>
            <Head title={title} />
            <div className="min-h-full bg-slate-50 dark:bg-night-950">
                <aside
                    className={cn(
                        'fixed inset-y-0 left-0 z-30 hidden overflow-hidden transition-[width] duration-200 ease-out lg:block',
                        collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
                    )}
                >
                    <Sidebar collapsed={collapsed} />
                </aside>

                {mobileOpen && (
                    <div className="fixed inset-0 z-50 lg:hidden">
                        <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={() => setMobileOpen(false)} />
                        <div className="absolute inset-y-0 left-0 w-72 animate-slide-up shadow-xl">
                            <Sidebar onNavigate={() => setMobileOpen(false)} />
                            <button
                                type="button"
                                onClick={() => setMobileOpen(false)}
                                className="absolute right-3 top-4 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                                aria-label="Close menu"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                <div
                    className={cn(
                        'flex min-h-screen flex-col bg-slate-50 transition-[padding] duration-200 ease-out dark:bg-night-950',
                        collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64',
                    )}
                >
                    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-night-700 dark:bg-night-950 sm:px-6">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(true)}
                            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:text-night-400 dark:hover:bg-night-800 lg:hidden"
                            aria-label="Open menu"
                        >
                            <MenuIcon className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={toggle}
                            className="hidden rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-night-400 dark:hover:bg-night-800 dark:hover:text-night-200 lg:inline-flex"
                            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                        </button>
                        <GlobalSearch />
                        <div className="ml-auto flex items-center gap-1.5">
                            <ThemeToggle compact />
                            <Link
                                href={route('notifications.index')}
                                className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-night-400 dark:hover:bg-night-800 dark:hover:text-night-200"
                                aria-label="Notifications"
                            >
                                <Bell className="h-5 w-5" />
                                {!!unreadNotifications && (
                                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-night-950">
                                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                                    </span>
                                )}
                            </Link>
                            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-night-700" />
                            <Menu
                                widthClass="w-60"
                                triggerClassName="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100 dark:hover:bg-night-800"
                                trigger={
                                    <>
                                        <Avatar name={user.name} size="sm" />
                                        <span className="hidden text-left sm:block">
                                            <span className="block text-sm font-medium leading-tight text-slate-800 dark:text-night-100">{user.name}</span>
                                            <span className="block text-xs leading-tight text-slate-500 dark:text-night-400">
                                                {user.role?.display_name ?? (user.is_admin ? 'Administrator' : 'Member')}
                                            </span>
                                        </span>
                                    </>
                                }
                                header={
                                    <>
                                        <p className="truncate text-sm font-medium text-slate-900 dark:text-night-100">{user.name}</p>
                                        <p className="truncate text-xs text-slate-500 dark:text-night-400">{user.email}</p>
                                    </>
                                }
                                items={[
                                    { label: 'Profile & signature', icon: UserCircle, href: route('profile.edit') },
                                    { label: 'Notifications', icon: Bell, href: route('notifications.index') },
                                    { label: 'Sign out', icon: LogOut, href: route('logout'), method: 'post', separatorBefore: true },
                                ]}
                            />
                        </div>
                    </header>

                    <main className={cn('flex-1', fullBleed ? '' : 'px-4 py-5 sm:px-5 lg:px-6 lg:py-6')}>{children}</main>
                    {!fullBleed && (
                        <footer className="mt-auto shrink-0 border-t border-slate-200 bg-white dark:border-night-800 dark:bg-night-950">
                            <div className="flex flex-col gap-1 px-4 py-4 text-center text-xs text-slate-500 dark:text-night-400 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:text-left lg:px-6">
                                <p>Ministry of Trade and Industry</p>
                                <p>
                                    DMS — software donated by{' '}
                                    <a
                                        href="https://www.ucssacco.com/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-slate-700 underline-offset-2 hover:text-brand-700 hover:underline dark:text-night-300 dark:hover:text-brand-300"
                                    >
                                        UCSSACCO
                                    </a>
                                </p>
                            </div>
                        </footer>
                    )}
                </div>
            </div>
            <Toaster />
        </>
    );
}
