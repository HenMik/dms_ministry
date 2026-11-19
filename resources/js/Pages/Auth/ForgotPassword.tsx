import { Button } from '@/Components/ui/Button';
import { Field, Input } from '@/Components/ui/Form';
import { Alert } from '@/Components/ui/misc';
import GuestLayout from '@/Layouts/GuestLayout';
import { Link, useForm } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { FormEvent } from 'react';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.email'));
    };

    return (
        <GuestLayout title="Reset your password" description="Enter your email and we'll send you a link to choose a new password.">
            {status && (
                <Alert tone="success" className="mb-6">
                    {status}
                </Alert>
            )}
            <form onSubmit={submit} className="space-y-5">
                <Field label="Email address" htmlFor="email" error={errors.email}>
                    <Input
                        id="email"
                        type="email"
                        autoFocus
                        value={data.email}
                        invalid={!!errors.email}
                        onChange={(e) => setData('email', e.target.value)}
                    />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={processing}>
                    Email reset link
                </Button>
            </form>
            <Link href={route('login')} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-night-400 hover:text-slate-900 dark:hover:text-night-100">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
            </Link>
        </GuestLayout>
    );
}
