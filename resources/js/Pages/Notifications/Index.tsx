import { Button } from '@/Components/ui/Button';
import { Card } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { Alert, Paginated, Pagination } from '@/Components/ui/misc';
import { notify } from '@/Components/ui/Toaster';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { AppNotificationRecord } from '@/types/models';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { Bell, BellRing, CalendarClock, CheckCheck, ClipboardCheck, FileText, ListTodo, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

const icons: Record<string, typeof Bell> = {
    MEETING_REMINDER: CalendarClock,
    MEETING_INVITE: CalendarClock,
    APPROVAL_REQUEST: ClipboardCheck,
    DOCUMENT_UPDATE: FileText,
    COMMENT: MessageSquare,
    TASK_ASSIGNED: ListTodo,
};

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type PushState = 'unsupported' | 'unconfigured' | 'default' | 'granted' | 'denied' | 'subscribed';

function usePush(vapidPublicKey: string | null) {
    const [state, setState] = useState<PushState>('default');

    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return setState('unsupported');
        if (!vapidPublicKey) return setState('unconfigured');
        if (Notification.permission === 'denied') return setState('denied');
        navigator.serviceWorker.register('/sw.js').then(async (reg) => {
            const sub = await reg.pushManager.getSubscription();
            setState(sub ? 'subscribed' : (Notification.permission as PushState));
        });
    }, [vapidPublicKey]);

    const enable = async () => {
        try {
            const reg = await navigator.serviceWorker.register('/sw.js');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return setState(permission as PushState);
            const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) });
            await axios.post(route('push.subscribe'), sub.toJSON());
            setState('subscribed');
            notify('Browser notifications enabled.');
        } catch {
            notify('Could not enable browser notifications.', 'error');
        }
    };

    const disable = async () => {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js');
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
            await axios.post(route('push.unsubscribe'), { endpoint: sub.endpoint });
            await sub.unsubscribe();
        }
        setState('granted');
        notify('Browser notifications turned off.', 'info');
    };

    return { state, enable, disable };
}

export default function Index({ notifications, vapidPublicKey }: { notifications: Paginated<AppNotificationRecord>; vapidPublicKey: string | null }) {
    const push = usePush(vapidPublicKey);
    const unread = notifications.data.filter((n) => !n.is_read).length;

    const open = (n: AppNotificationRecord) => {
        if (!n.is_read) router.post(route('notifications.read', n.id), {}, { preserveScroll: true, preserveState: true });
        if (n.url) router.visit(n.url);
    };

    return (
        <AppLayout title="Notifications">
            <PageHeader
                title="Notifications"
                description="Approvals, reminders and updates on documents you follow."
                actions={
                    <Button variant="secondary" icon={CheckCheck} disabled={unread === 0} onClick={() => router.post(route('notifications.read-all'), {}, { preserveScroll: true })}>
                        Mark all as read
                    </Button>
                }
            />

            <div className="mx-auto max-w-3xl space-y-4">
                {(push.state === 'default' || push.state === 'granted') && (
                    <Alert
                        tone="info"
                        title="Get notified on this device"
                        action={
                            <Button size="sm" icon={BellRing} onClick={push.enable}>
                                Enable
                            </Button>
                        }
                    >
                        Receive browser notifications for meeting reminders and approval requests.
                    </Alert>
                )}
                {push.state === 'subscribed' && (
                    <p className="flex items-center justify-between text-sm text-slate-500 dark:text-night-400">
                        <span className="inline-flex items-center gap-1.5">
                            <BellRing className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Browser notifications are on for this device.
                        </span>
                        <button type="button" onClick={push.disable} className="font-medium text-slate-600 dark:text-night-400 hover:text-slate-900 dark:hover:text-night-100">
                            Turn off
                        </button>
                    </p>
                )}

                <Card>
                    {notifications.data.length === 0 ? (
                        <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-night-800">
                            {notifications.data.map((n) => {
                                const Icon = icons[n.notification_type] ?? Bell;
                                return (
                                    <li key={n.id}>
                                        <button
                                            type="button"
                                            onClick={() => open(n)}
                                            className={cn('flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-night-800/50', !n.is_read && 'bg-brand-50/40 dark:bg-brand-950/30')}
                                        >
                                            <span
                                                className={cn(
                                                    'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                                                    n.is_read ? 'bg-slate-100 dark:bg-night-800 text-slate-400' : 'bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300',
                                                )}
                                            >
                                                <Icon className="h-[18px] w-[18px]" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-center justify-between gap-3">
                                                    <span className={cn('truncate text-sm', n.is_read ? 'font-medium text-slate-700 dark:text-night-200' : 'font-semibold text-slate-900 dark:text-night-100')}>{n.title}</span>
                                                    <span className="shrink-0 text-xs text-slate-400">{formatRelative(n.created_at)}</span>
                                                </span>
                                                <span className="mt-0.5 block text-sm text-slate-600 dark:text-night-400">{n.message}</span>
                                            </span>
                                            {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <Pagination meta={notifications} />
                </Card>
            </div>
        </AppLayout>
    );
}
