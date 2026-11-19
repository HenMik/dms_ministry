import { cn } from '@/lib/cn';

/** Soft empty-folder illustration for the documents browser. */
export function EmptyFolderGraphic({ className, size = 168 }: { className?: string; size?: number }) {
    return (
        <svg
            width={size}
            height={size * 0.78}
            viewBox="0 0 200 156"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn('mx-auto', className)}
            aria-hidden
        >
            <ellipse cx="100" cy="138" rx="62" ry="8" fill="#E2E8F0" opacity="0.9" />

            <path
                d="M48 46c0-5.5 4.5-10 10-10h28.5c2.7 0 5.2 1.2 6.9 3.2l5.4 6.3c1.1 1.3 2.7 2 4.4 2H142c5.5 0 10 4.5 10 10v52c0 5.5-4.5 10-10 10H58c-5.5 0-10-4.5-10-10V46Z"
                fill="#F8D48A"
            />
            <path d="M48 56h104v47c0 5.5-4.5 10-10 10H58c-5.5 0-10-4.5-10-10V56Z" fill="#FBE2A8" />
            <path d="M48 56h104v5H48V56Z" fill="#E8B45A" opacity="0.45" />
            <path
                d="M58 36h28.5c1.6 0 3.1.7 4.1 1.9l3.4 4.1c.5.6 1.3 1 2.1 1H72.5c-3.6 0-5.8 2.2-5.8 5.3v1.7H58c-3.2 0-5.8-2.4-5.8-5.5V41.5C52.2 38.4 54.8 36 58 36Z"
                fill="#E6A63A"
            />

            <rect x="72" y="78" width="56" height="6" rx="3" fill="#F1F5F9" />
            <rect x="82" y="90" width="36" height="5" rx="2.5" fill="#E2E8F0" />

            <circle cx="148" cy="44" r="18" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1.5" />
            <path
                d="M148 36.5v10.5M142.75 41.75h10.5"
                stroke="#3B82F6"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}
