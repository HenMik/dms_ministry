import { cn } from '@/lib/cn';
import { InertiaLinkProps, Link } from '@inertiajs/react';
import { Loader2, LucideIcon } from 'lucide-react';
import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const variants: Record<ButtonVariant, string> = {
    primary:
        'bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700 disabled:bg-brand-700/60 dark:bg-brand-600 dark:hover:bg-brand-500',
    secondary:
        'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-brand-700 dark:bg-night-900 dark:text-night-200 dark:ring-night-600 dark:hover:bg-night-800',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-brand-700 dark:text-night-300 dark:hover:bg-night-800 dark:hover:text-night-100',
    subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100 focus-visible:outline-brand-700 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600 disabled:bg-red-600/60',
};

const sizes: Record<ButtonSize, string> = {
    xs: 'h-7 gap-1 rounded-md px-2 text-xs',
    sm: 'h-8 gap-1.5 rounded-md px-3 text-sm',
    md: 'h-9 gap-2 rounded-md px-3.5 text-sm',
    lg: 'h-10 gap-2 rounded-md px-5 text-[15px]',
    icon: 'h-9 w-9 rounded-md',
    'icon-sm': 'h-8 w-8 rounded-md',
};

const iconSizes: Record<ButtonSize, string> = {
    xs: 'h-3.5 w-3.5',
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-[18px] w-[18px]',
    icon: 'h-[18px] w-[18px]',
    'icon-sm': 'h-4 w-4',
};

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
    return cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
    );
}

interface CommonProps {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: LucideIcon;
    iconRight?: LucideIcon;
    loading?: boolean;
    children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, CommonProps & ButtonHTMLAttributes<HTMLButtonElement>>(
    function Button(
        { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading, className, children, disabled, type = 'button', ...rest },
        ref,
    ) {
        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled || loading}
                className={buttonClasses(variant, size, className)}
                {...rest}
            >
                {loading ? (
                    <Loader2 className={cn(iconSizes[size], 'animate-spin')} />
                ) : (
                    Icon && <Icon className={iconSizes[size]} />
                )}
                {children}
                {IconRight && <IconRight className={iconSizes[size]} />}
            </button>
        );
    },
);

export function LinkButton({
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    className,
    children,
    ...rest
}: CommonProps & Omit<InertiaLinkProps, 'size'>) {
    return (
        <Link className={buttonClasses(variant, size, className)} {...rest}>
            {Icon && <Icon className={iconSizes[size]} />}
            {children}
            {IconRight && <IconRight className={iconSizes[size]} />}
        </Link>
    );
}

export function AnchorButton({
    variant = 'primary',
    size = 'md',
    icon: Icon,
    className,
    children,
    ...rest
}: CommonProps & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'size'>) {
    return (
        <a className={buttonClasses(variant, size, className)} {...rest}>
            {Icon && <Icon className={iconSizes[size]} />}
            {children}
        </a>
    );
}
