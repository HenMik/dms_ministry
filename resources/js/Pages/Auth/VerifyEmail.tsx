import { Button } from '@/Components/ui/Button';
import { Alert } from '@/Components/ui/misc';
import GuestLayout from '@/Layouts/GuestLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function VerifyEmail({ status }: { status?: string }) {
    const { post, processing } = useForm({});

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    return (
        <GuestLayout title="Verify your email" description="Click the link we emailed you to verify your address.">
            {status === 'verification-link-sent' && (
                <Alert tone="success" className="mb-6">
                    A new verification link has been sent to your email address.
                </Alert>
            )}
            <form onSubmit={submit} className="flex items-center justify-between">
                <Button type="submit" loading={processing}>
                    Resend verification email
                </Button>
                <Link href={route('logout')} method="post" as="button" className="text-sm font-medium text-slate-600 dark:text-night-400 hover:text-slate-900 dark:hover:text-night-100">
                    Sign out
                </Link>
            </form>
        </GuestLayout>
    );
}
