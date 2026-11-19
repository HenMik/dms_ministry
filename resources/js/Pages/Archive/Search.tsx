import { StatusBadge } from '@/Components/ui/Badge';
import { Card, CardHeader } from '@/Components/ui/Card';
import { EmptyState } from '@/Components/ui/EmptyState';
import { FileIcon } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { formatDate } from '@/lib/format';
import { DocumentRecord } from '@/types/models';
import { Link } from '@inertiajs/react';
import { Search as SearchIcon } from 'lucide-react';

interface Props {
    query: string;
    resultsCount: number;
    results: { documents: DocumentRecord[] };
}

export default function Search({ query, resultsCount, results }: Props) {
    return (
        <AppLayout title={query ? `Search: ${query}` : 'Search'}>
            <PageHeader
                title={query ? <>Results for “{query}”</> : 'Search'}
                description={query ? `${resultsCount} document result${resultsCount === 1 ? '' : 's'}.` : 'Use the search bar above.'}
            />
            {resultsCount === 0 ? (
                <Card>
                    <EmptyState icon={SearchIcon} title={query ? 'No results found' : 'Start typing to search'} description={query ? 'Try a different or shorter search term.' : undefined} />
                </Card>
            ) : (
                <Card>
                    <CardHeader title="Documents" description={`${results.documents.length} result${results.documents.length === 1 ? '' : 's'}`} />
                    <ul className="divide-y divide-slate-100 dark:divide-night-800">
                        {results.documents.map((d) => (
                            <li key={d.id}>
                                <Link href={route('documents.show', d.id)} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-night-800/50">
                                    <FileIcon mime={d.mime_type} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-slate-900 dark:text-night-100">{d.title}</p>
                                        <p className="truncate text-xs text-slate-500 dark:text-night-400">
                                            {d.category?.name ?? 'Uncategorised'} · {formatDate(d.updated_at)}
                                        </p>
                                    </div>
                                    <StatusBadge status={d.status} />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </AppLayout>
    );
}
