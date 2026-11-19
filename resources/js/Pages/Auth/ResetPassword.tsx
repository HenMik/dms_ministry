import { Button } from '@/Components/ui/Button';
import { Field, Input } from '@/Components/ui/Form';
import GuestLayout from '@/Layouts/GuestLayout';
import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.store'), { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <GuestLayout title="Choose a new password">
            <form onSubmit={submit} className="space-y-5">
                <Field label="Email address" htmlFor="email" error={errors.email}>
                    <Input id="email" type="email" autoComplete="username" value={data.email} onChange={(e) => setData('email', e.target.value)} />
                </Field>
                <Field label="New password" htmlFor="password" error={errors.password}>
                    <Input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        autoFocus
                        value={data.password}
                        invalid={!!errors.password}
                        onChange={(e) => setData('password', e.target.value)}
                    />
                </Field>
                <Field label="Confirm password" htmlFor="password_confirmation" error={errors.password_confirmation}>
                    <Input
                        id="password_confirmation"
                        type="password"
                        autoComplete="new-password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                    />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={processing}>
                    Reset password
                </Button>
            </form>
        </GuestLayout>
    );
}
