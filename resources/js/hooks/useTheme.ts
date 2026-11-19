import { applyTheme, getStoredTheme, persistTheme, ThemeMode } from '@/lib/theme';
import { useCallback, useEffect, useState } from 'react';

export function useTheme() {
    const [mode, setModeState] = useState<ThemeMode>(() => (typeof window === 'undefined' ? 'system' : getStoredTheme()));
    const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
        typeof window === 'undefined' ? 'light' : applyTheme(getStoredTheme()),
    );

    const setMode = useCallback((next: ThemeMode) => {
        persistTheme(next);
        setModeState(next);
        setResolved(applyTheme(next));
    }, []);

    const cycleMode = useCallback(() => {
        const order: ThemeMode[] = ['light', 'dark', 'system'];
        const next = order[(order.indexOf(mode) + 1) % order.length];
        setMode(next);
    }, [mode, setMode]);

    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
            if (getStoredTheme() === 'system') {
                setResolved(applyTheme('system'));
            }
        };
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    return { mode, resolved, setMode, cycleMode, isDark: resolved === 'dark' };
}
