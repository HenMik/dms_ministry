type DateInput = string | Date | null | undefined;

function toDate(value: DateInput): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: DateInput, fallback = '—'): string {
    const date = toDate(value);
    return date
        ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        : fallback;
}

export function formatDateTime(value: DateInput, fallback = '—'): string {
    const date = toDate(value);
    return date
        ? date.toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
          })
        : fallback;
}

export function formatTime(value: DateInput, fallback = '—'): string {
    const date = toDate(value);
    return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : fallback;
}

export function formatRelative(value: DateInput, fallback = '—'): string {
    const date = toDate(value);
    if (!date) return fallback;

    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

    if (abs < 60) return rtf.format(seconds, 'second');
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour');
    if (abs < 604800) return rtf.format(Math.round(seconds / 86400), 'day');
    return formatDate(date);
}

export function formatBytes(bytes: number | null | undefined): string {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit++;
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Server timestamp -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(value: DateInput): string {
    const date = toDate(value);
    if (!date) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value -> ISO string with offset so the server stores the right instant. */
export function fromLocalInput(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function initials(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function humanize(value: string | null | undefined): string {
    if (!value) return '';
    return value
        .toLowerCase()
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

export function fileExtension(path: string | null | undefined, mime?: string | null): string {
    const fromPath = path?.split('.').pop()?.toLowerCase();
    if (fromPath && fromPath.length <= 5) return fromPath;
    if (mime?.includes('pdf')) return 'pdf';
    return 'file';
}
