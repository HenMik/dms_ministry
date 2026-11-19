import { cn } from '@/lib/cn';
import { ClipboardEvent, KeyboardEvent, useEffect, useRef } from 'react';

const LENGTH = 6;

function digitsOnly(value: string): string {
    return value.replace(/\D/g, '').slice(0, LENGTH);
}

export function OtpInput({
    id,
    value,
    onChange,
    invalid,
    disabled,
    autoFocus,
}: {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
    disabled?: boolean;
    autoFocus?: boolean;
}) {
    const refs = useRef<Array<HTMLInputElement | null>>([]);
    const chars = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

    useEffect(() => {
        if (autoFocus) {
            refs.current[0]?.focus();
        }
    }, [autoFocus]);

    const setAt = (index: number, digit: string) => {
        const next = chars.map((c, i) => (i === index ? digit : c));
        onChange(next.join('').replace(/\s/g, ''));
    };

    const focusIndex = (index: number) => {
        const el = refs.current[Math.max(0, Math.min(LENGTH - 1, index))];
        el?.focus();
        el?.select();
    };

    const handleChange = (index: number, raw: string) => {
        const cleaned = digitsOnly(raw);
        if (!cleaned) {
            setAt(index, '');
            return;
        }

        if (cleaned.length > 1) {
            const merged = digitsOnly(value.slice(0, index) + cleaned + value.slice(index + 1));
            onChange(merged);
            focusIndex(Math.min(merged.length, LENGTH - 1));
            return;
        }

        setAt(index, cleaned);
        if (index < LENGTH - 1) {
            focusIndex(index + 1);
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (chars[index]) {
                setAt(index, '');
            } else if (index > 0) {
                setAt(index - 1, '');
                focusIndex(index - 1);
            }
            return;
        }

        if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault();
            focusIndex(index - 1);
        }

        if (e.key === 'ArrowRight' && index < LENGTH - 1) {
            e.preventDefault();
            focusIndex(index + 1);
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = digitsOnly(e.clipboardData.getData('text'));
        if (!pasted) {
            return;
        }
        onChange(pasted);
        focusIndex(Math.min(pasted.length, LENGTH - 1));
    };

    return (
        <div className="flex justify-between gap-2" role="group" aria-labelledby={id ? `${id}-label` : undefined}>
            {chars.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        refs.current[index] = el;
                    }}
                    id={index === 0 ? id : undefined}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    disabled={disabled}
                    aria-label={`Digit ${index + 1} of ${LENGTH}`}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    className={cn(
                        'h-12 w-11 rounded-md border-0 bg-white text-center text-lg font-semibold text-slate-900 ring-1 ring-inset ring-slate-300',
                        'focus:ring-2 focus:ring-inset focus:ring-brand-600',
                        'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
                        'dark:bg-night-950 dark:text-night-100 dark:ring-night-600 dark:disabled:bg-night-900 dark:disabled:text-night-500',
                        'sm:h-12 sm:w-12',
                        invalid && 'ring-red-300 focus:ring-red-500 dark:ring-red-500/60',
                    )}
                />
            ))}
        </div>
    );
}
