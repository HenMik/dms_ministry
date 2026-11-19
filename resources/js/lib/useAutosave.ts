import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Debounced JSON autosave. Call `schedule(payload)` on every change; `flush()` saves immediately.
 */
export function useAutosave<T>(url: string, { delay = 2000, method = 'put' }: { delay?: number; method?: 'put' | 'post' } = {}) {
    const [state, setState] = useState<AutosaveState>('idle');
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const timer = useRef<number | null>(null);
    const latest = useRef<T | null>(null);
    const inFlight = useRef<Promise<boolean> | null>(null);

    const send = useCallback(async (): Promise<boolean> => {
        if (latest.current === null) return true;
        const payload = latest.current;
        latest.current = null;
        setState('saving');
        try {
            await axios.request({ url, method, data: payload, headers: { Accept: 'application/json' } });
            setSavedAt(new Date());
            setError(null);
            setState(latest.current === null ? 'saved' : 'pending');
            return true;
        } catch (e) {
            const response = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
            const first = response?.data?.errors ? Object.values(response.data.errors)[0]?.[0] : undefined;
            setError(first ?? response?.data?.message ?? 'Could not save. Check your connection.');
            latest.current ??= payload;
            setState('error');
            return false;
        }
    }, [url, method]);

    const flush = useCallback(async (): Promise<boolean> => {
        if (timer.current) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
        if (inFlight.current) await inFlight.current;
        inFlight.current = send();
        const ok = await inFlight.current;
        inFlight.current = null;
        return ok;
    }, [send]);

    const schedule = useCallback(
        (payload: T) => {
            latest.current = payload;
            setState('pending');
            if (timer.current) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => {
                timer.current = null;
                void flush();
            }, delay);
        },
        [delay, flush],
    );

    useEffect(() => {
        const beforeUnload = (e: BeforeUnloadEvent) => {
            if (latest.current !== null) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', beforeUnload);
        return () => {
            window.removeEventListener('beforeunload', beforeUnload);
            if (timer.current) window.clearTimeout(timer.current);
        };
    }, []);

    return { state, savedAt, error, schedule, flush };
}

export function autosaveLabel(state: AutosaveState, savedAt: Date | null): string {
    switch (state) {
        case 'pending':
            return 'Unsaved changes…';
        case 'saving':
            return 'Saving…';
        case 'error':
            return 'Not saved';
        case 'saved':
            return savedAt ? `Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved';
        default:
            return savedAt ? `Saved at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'All changes saved';
    }
}
