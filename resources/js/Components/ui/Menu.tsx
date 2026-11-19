import { cn } from '@/lib/cn';
import { Menu as HMenu, MenuButton, MenuItem, MenuItems, MenuSeparator } from '@headlessui/react';
import { Link } from '@inertiajs/react';
import { LucideIcon, MoreHorizontal } from 'lucide-react';
import { ReactNode } from 'react';

export interface MenuAction {
    label: string;
    icon?: LucideIcon;
    href?: string;
    external?: boolean;
    onClick?: () => void;
    danger?: boolean;
    method?: 'post' | 'put' | 'delete';
    hidden?: boolean;
    separatorBefore?: boolean;
}

export function Menu({
    trigger,
    items,
    align = 'right',
    header,
    widthClass = 'w-52',
    triggerClassName,
}: {
    trigger?: ReactNode;
    triggerClassName?: string;
    items: MenuAction[];
    align?: 'left' | 'right';
    header?: ReactNode;
    widthClass?: string;
}) {
    const visible = items.filter((i) => !i.hidden);

    return (
        <HMenu as="div" className="relative">
            <MenuButton
                aria-label={trigger ? undefined : 'More actions'}
                className={
                    triggerClassName ??
                    'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-700 dark:text-night-400 dark:hover:bg-night-800 dark:hover:text-night-200'
                }
            >
                {trigger ?? <MoreHorizontal className="h-4 w-4" />}
            </MenuButton>
            <MenuItems
                transition
                anchor={align === 'right' ? 'bottom end' : 'bottom start'}
                className={cn(
                    'z-50 origin-top rounded-md [--anchor-gap:6px] bg-white p-1 shadow-pop ring-1 ring-slate-900/10 focus:outline-none dark:bg-night-900 dark:ring-white/10',
                    'transition duration-100 data-[closed]:scale-95 data-[closed]:opacity-0',
                    widthClass,
                )}
            >
                {header && <div className="border-b border-slate-200 px-3 py-2.5 dark:border-night-700">{header}</div>}
                {visible.map((item, i) => {
                    const Icon = item.icon;
                    const content = (
                        <>
                            {Icon && <Icon className={cn('h-4 w-4', item.danger ? 'text-red-500' : 'text-slate-400')} />}
                            {item.label}
                        </>
                    );
                    const cls = cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm data-[focus]:bg-slate-100 dark:data-[focus]:bg-night-800',
                        item.danger ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-night-200',
                    );

                    return (
                        <div key={i}>
                            {item.separatorBefore && i > 0 && <MenuSeparator className="my-1 h-px bg-slate-100 dark:bg-night-800" />}
                            <MenuItem>
                                {item.href && item.external ? (
                                    <a href={item.href} className={cls}>
                                        {content}
                                    </a>
                                ) : item.href ? (
                                    <Link href={item.href} method={item.method} as={item.method ? 'button' : 'a'} className={cls}>
                                        {content}
                                    </Link>
                                ) : (
                                    <button type="button" onClick={item.onClick} className={cls}>
                                        {content}
                                    </button>
                                )}
                            </MenuItem>
                        </div>
                    );
                })}
            </MenuItems>
        </HMenu>
    );
}
