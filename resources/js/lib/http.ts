import { router } from '@inertiajs/react';

type Method = 'post' | 'put' | 'patch' | 'delete';

/** Inertia visit wrapped in a promise; rejects with the first validation message. */
export function visit(method: Method, url: string, data: Record<string, unknown> = {}, options: { forceFormData?: boolean; only?: string[] } = {}) {
    return new Promise<void>((resolve, reject) => {
        let succeeded = false;
        let failure: Error | null = null;
        router.visit(url, {
            method,
            data: data as never,
            preserveScroll: true,
            preserveState: true,
            forceFormData: options.forceFormData,
            only: options.only,
            onSuccess: () => {
                succeeded = true;
            },
            onError: (errors) => {
                failure = new Error(Object.values(errors)[0] ?? 'The request failed.');
            },
            onFinish: () => (succeeded ? resolve() : reject(failure ?? new Error('The request failed.'))),
        });
    });
}
