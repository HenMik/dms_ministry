export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'dms.theme';

export function getStoredTheme(): ThemeMode {
    try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        if (value === 'light' || value === 'dark' || value === 'system') {
            return value;
        }
    } catch {
        /* ignore */
    }

    return 'system';
}

export function systemPrefersDark(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
    return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
}

export function applyTheme(mode: ThemeMode): 'light' | 'dark' {
    const resolved = resolveTheme(mode);
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    root.style.backgroundColor = resolved === 'dark' ? '#151b28' : '#f8fafc';
    root.dataset.theme = resolved;

    if (document.body) {
        document.body.style.backgroundColor = resolved === 'dark' ? '#151b28' : '#f8fafc';
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', resolved === 'dark' ? '#151b28' : '#1f4d87');
    }

    return resolved;
}

export function persistTheme(mode: ThemeMode): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
        /* ignore */
    }
}
