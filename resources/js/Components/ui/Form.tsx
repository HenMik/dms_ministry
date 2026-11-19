import { cn } from '@/lib/cn';
import {
    forwardRef,
    InputHTMLAttributes,
    ReactNode,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from 'react';

const control =
    'block w-full rounded-md border-0 bg-white text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 ' +
    'focus:ring-2 focus:ring-inset focus:ring-brand-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ' +
    'dark:bg-night-950 dark:text-night-100 dark:ring-night-600 dark:placeholder:text-night-500 dark:disabled:bg-night-900 dark:disabled:text-night-500';

const invalid = 'ring-red-300 focus:ring-red-500 dark:ring-red-500/60';

export function Field({
    label,
    htmlFor,
    error,
    hint,
    required,
    className,
    children,
}: {
    label?: ReactNode;
    htmlFor?: string;
    error?: string;
    hint?: ReactNode;
    required?: boolean;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={className}>
            {label && (
                <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-night-300">
                    {label}
                    {required && <span className="ml-0.5 text-red-500">*</span>}
                </label>
            )}
            {children}
            {error ? (
                <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : (
                hint && <p className="mt-1.5 text-xs text-slate-500 dark:text-night-400">{hint}</p>
            )}
        </div>
    );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
    function Input({ className, invalid: isInvalid, ...rest }, ref) {
        return <input ref={ref} className={cn(control, 'h-9 px-3', isInvalid && invalid, className)} {...rest} />;
    },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
    function Select({ className, invalid: isInvalid, children, ...rest }, ref) {
        return (
            <select ref={ref} className={cn(control, 'h-9 pl-3 pr-9', isInvalid && invalid, className)} {...rest}>
                {children}
            </select>
        );
    },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
    function Textarea({ className, invalid: isInvalid, rows = 4, ...rest }, ref) {
        return <textarea ref={ref} rows={rows} className={cn(control, 'px-3 py-2', isInvalid && invalid, className)} {...rest} />;
    },
);

export function Checkbox({
    label,
    description,
    className,
    ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
    return (
        <label className={cn('flex cursor-pointer items-start gap-3', className)}>
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600 dark:border-night-600 dark:bg-night-900" {...rest} />
            <span className="text-sm">
                <span className="font-medium text-slate-800 dark:text-night-200">{label}</span>
                {description && <span className="block text-slate-500 dark:text-night-400">{description}</span>}
            </span>
        </label>
    );
}

export function FormSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-6 border-b border-slate-100 px-5 py-6 last:border-b-0 dark:border-night-800 md:grid-cols-3">
            <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-night-100">{title}</h3>
                {description && <p className="mt-1 text-sm text-slate-500 dark:text-night-400">{description}</p>}
            </div>
            <div className="space-y-5 md:col-span-2">{children}</div>
        </div>
    );
}
