import { Badge } from '@/Components/ui/Badge';
import { cn } from '@/lib/cn';
import { Link } from '@inertiajs/react';
import { Users } from 'lucide-react';

export interface OrgNode {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
    users_count: number;
    documents_count: number;
    children: OrgNode[];
}

function NodeCard({ node }: { node: OrgNode }) {
    return (
        <Link
            href={route('departments.show', node.id)}
            className={cn(
                'block min-w-[10.5rem] max-w-[14rem] rounded-lg border bg-white px-3.5 py-3 text-center transition',
                'hover:border-brand-300',
                node.is_active ? 'border-slate-200' : 'border-amber-200 bg-amber-50/40',
            )}
        >
            <p className="truncate text-sm font-semibold text-slate-900">{node.name}</p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                <Badge>{node.code}</Badge>
                {!node.is_active && <Badge tone="amber">Inactive</Badge>}
            </div>
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Users className="h-3 w-3" />
                {node.users_count} · {node.documents_count} docs
            </p>
        </Link>
    );
}

function Branch({ node }: { node: OrgNode }) {
    const hasChildren = node.children.length > 0;

    return (
        <li className="relative flex flex-col items-center px-3 pt-8">
            <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-slate-300" />
            <NodeCard node={node} />
            {hasChildren && (
                <>
                    <div className="h-6 w-px bg-slate-300" />
                    <ul
                        className={cn(
                            'relative flex flex-row flex-wrap justify-center',
                            'before:absolute before:left-[12.5%] before:right-[12.5%] before:top-0 before:h-px before:bg-slate-300',
                            node.children.length === 1 && 'before:hidden',
                        )}
                    >
                        {node.children.map((child) => (
                            <Branch key={child.id} node={child} />
                        ))}
                    </ul>
                </>
            )}
        </li>
    );
}

export function Organogram({ roots }: { roots: OrgNode[] }) {
    if (roots.length === 0) {
        return (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center text-sm text-slate-500">
                Add departments to see the organisation chart.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5">
            <ul className="inline-flex min-w-full flex-row flex-wrap justify-center gap-2">
                {roots.map((root) => (
                    <li key={root.id} className="relative flex flex-col items-center px-3">
                        <NodeCard node={root} />
                        {root.children.length > 0 && (
                            <>
                                <div className="h-6 w-px bg-slate-300" />
                                <ul
                                    className={cn(
                                        'relative flex flex-row flex-wrap justify-center',
                                        'before:absolute before:left-[12.5%] before:right-[12.5%] before:top-0 before:h-px before:bg-slate-300',
                                        root.children.length === 1 && 'before:hidden',
                                    )}
                                >
                                    {root.children.map((child) => (
                                        <Branch key={child.id} node={child} />
                                    ))}
                                </ul>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
