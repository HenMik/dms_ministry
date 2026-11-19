import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';
import { UploadCloud, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { FileIcon } from './misc';

type SingleProps = {
    multiple?: false;
    file: File | null;
    onChange: (file: File | null) => void;
    files?: never;
    onChangeFiles?: never;
};

type MultiProps = {
    multiple: true;
    files: File[];
    onChangeFiles: (files: File[]) => void;
    file?: never;
    onChange?: never;
};

type CommonProps = {
    accept?: string;
    hint?: string;
    invalid?: boolean;
    currentLabel?: string;
    maxBytes?: number;
    size?: 'md' | 'lg';
};

export function FileDrop(props: (SingleProps | MultiProps) & CommonProps) {
    const { accept, hint, invalid, currentLabel, maxBytes, size = 'md' } = props;
    const multiple = props.multiple === true;
    const inputRef = useRef<HTMLInputElement>(null);
    const [over, setOver] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const files = multiple ? props.files : props.file ? [props.file] : [];

    const addFiles = (incoming: FileList | File[] | null | undefined) => {
        setError(null);
        const list = Array.from(incoming ?? []);
        if (list.length === 0) {
            return;
        }

        const accepted: File[] = [];
        for (const file of list) {
            if (maxBytes && file.size > maxBytes) {
                setError(`“${file.name}” is too large. Maximum size is ${formatBytes(maxBytes)}.`);
                continue;
            }
            accepted.push(file);
        }

        if (accepted.length === 0) {
            return;
        }

        if (multiple) {
            const byKey = new Map(props.files.map((file) => [`${file.name}:${file.size}:${file.lastModified}`, file]));
            for (const file of accepted) {
                byKey.set(`${file.name}:${file.size}:${file.lastModified}`, file);
            }
            props.onChangeFiles(Array.from(byKey.values()));
            return;
        }

        props.onChange(accepted[0] ?? null);
    };

    const removeAt = (index: number) => {
        if (multiple) {
            props.onChangeFiles(props.files.filter((_, i) => i !== index));
            return;
        }
        props.onChange(null);
    };

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setOver(false);
                    addFiles(e.dataTransfer.files);
                }}
                className={cn(
                    'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-center transition',
                    size === 'lg' ? 'px-6 py-12 sm:py-14' : 'px-5 py-7',
                    over
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40'
                        : invalid || error
                          ? 'border-red-300 bg-red-50/40 dark:border-red-800 dark:bg-red-950/30'
                          : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40 dark:border-night-600 dark:bg-night-900 dark:hover:border-brand-500 dark:hover:bg-brand-950/30',
                )}
            >
                <span
                    className={cn(
                        'flex items-center justify-center rounded-md',
                        size === 'lg' ? 'h-12 w-12 bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : '',
                    )}
                >
                    <UploadCloud
                        className={cn(
                            size === 'lg' ? 'h-7 w-7' : 'h-8 w-8',
                            over ? 'text-brand-600' : size === 'lg' ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400',
                        )}
                    />
                </span>
                <p className={cn('text-sm text-slate-700 dark:text-night-300', size === 'lg' ? 'mt-4 text-base' : 'mt-2')}>
                    <span className="font-semibold text-brand-700 dark:text-brand-300">Click to upload</span> or drag and drop
                    {multiple ? ' files' : ''}
                </p>
                {hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-night-400">{hint}</p>}
                {currentLabel && <p className="mt-2 text-xs text-slate-500 dark:text-night-400">Current file: {currentLabel}</p>}
                <input
                    ref={inputRef}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    className="sr-only"
                    onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
            </div>

            {files.length > 0 && (
                <ul className="mt-3 space-y-2">
                    {files.map((file, index) => (
                        <li
                            key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                            className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-2.5 dark:border-night-700 dark:bg-night-900"
                        >
                            <FileIcon mime={file.type} path={file.name} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900 dark:text-night-100">{file.name}</p>
                                <p className="text-xs text-slate-500 dark:text-night-400">{formatBytes(file.size)}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeAt(index)}
                                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-night-800 dark:hover:text-night-200"
                                aria-label={`Remove ${file.name}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        </>
    );
}
