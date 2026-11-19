import { Button } from '@/Components/ui/Button';
import { Field, Input } from '@/Components/ui/Form';
import { Alert } from '@/Components/ui/misc';
import GuestLayout from '@/Layouts/GuestLayout';
import { Link, useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function ForceChangePassword() {
    const { data, setData, put, processing, errors } = useForm({
        current_password: '',
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        put(route('password.force.update'));
    };

    return (
        <GuestLayout title="Update your password">
            <Alert tone="warning" className="mb-6">
                Your password has expired or must be changed before you can continue.
            </Alert>
            <form onSubmit={submit} className="space-y-5">
                <Field label="Current password" htmlFor="current_password" error={errors.current_password}>
                    <Input
                        id="current_password"
                        type="password"
                        autoComplete="current-password"
                        autoFocus
                        value={data.current_password}
                        invalid={!!errors.current_password}
                        onChange={(e) => setData('current_password', e.target.value)}
                    />
                </Field>
                <Field label="New password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
                    <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        value={data.password}
                        invalid={!!errors.password}
                        onChange={(e) => setData('password', e.target.value)}
                    />
                </Field>
                <Field label="Confirm new password" htmlFor="password_confirmation">
                    <Input
                        id="password_confirmation"
                        type="password"
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                    />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={processing}>
                    Update password
                </Button>
            </form>
            <Link href={route('logout')} method="post" as="button" className="mt-6 text-sm font-medium text-slate-600 dark:text-night-400 hover:text-slate-900 dark:hover:text-night-100">
                Sign out
            </Link>
        </GuestLayout>
    );
}
