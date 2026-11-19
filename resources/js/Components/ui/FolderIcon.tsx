import { cn } from '@/lib/cn';

/** Manila-style folder glyph for the documents file browser. */
export function FolderIcon({
    className,
    size = 36,
}: {
    className?: string;
    size?: number;
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn('shrink-0', className)}
            aria-hidden
        >
            <path
                d="M6 14.5c0-2.2 1.8-4 4-4h9.2c1.1 0 2.1.5 2.8 1.3l1.7 2c.4.5 1 .7 1.6.7H38c2.2 0 4 1.8 4 4V36c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V14.5Z"
                fill="#F2B84B"
            />
            <path
                d="M6 18h36v18c0 2.2-1.8 4-4 4H10c-2.2 0-4-1.8-4-4V18Z"
                fill="#F6C86A"
            />
            <path
                d="M6 18h36v2.5H6V18Z"
                fill="#E6A63A"
                opacity="0.55"
            />
            <path
                d="M10 10.5h9.2c.7 0 1.3.3 1.7.8l1.2 1.5c.2.2.5.4.8.4H20c-1.5 0-2.4.9-2.4 2.2v.6H10c-1.3 0-2.4-1-2.4-2.3v-1.1c0-1.2 1-2.1 2.4-2.1Z"
                fill="#E09B2D"
            />
        </svg>
    );
}

export function FolderIconSmall({ className }: { className?: string }) {
    return <FolderIcon className={className} size={20} />;
}
