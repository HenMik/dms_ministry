import { Button } from '@/Components/ui/Button';
import { Checkbox, Field, Input } from '@/Components/ui/Form';
import { Alert } from '@/Components/ui/misc';
import GuestLayout from '@/Layouts/GuestLayout';
import { useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEvent, useState } from 'react';

export default function Login({
    status,
    otpAfterPasswordEnabled = false,
}: {
    status?: string;
    otpAfterPasswordEnabled?: boolean;
}) {
    const form = useForm({ email: '', password: '', remember: false });
    const [showPassword, setShowPassword] = useState(false);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('login.store'), {
            onFinish: () => form.reset('password'),
        });
    };

    return (
        <GuestLayout
            title="Sign in"
            description={
                otpAfterPasswordEnabled
                    ? 'Sign in with your email and password. A one-time SMS code will be required next.'
                    : 'Sign in with your email and password.'
            }
        >
            {status && (
                <Alert tone="success" className="mb-6">
                    {status}
                </Alert>
            )}

            <form onSubmit={submit} className="space-y-5">
                <Field label="Email address" htmlFor="email" error={form.errors.email}>
                    <Input
                        id="email"
                        type="email"
                        autoComplete="username"
                        autoFocus
                        value={form.data.email}
                        invalid={!!form.errors.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                    />
                </Field>

                <Field label="Password" htmlFor="password" error={form.errors.password}>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={form.data.password}
                            invalid={!!form.errors.password}
                            className="pr-10"
                            onChange={(e) => form.setData('password', e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-night-300"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </Field>

                <Checkbox
                    label="Keep me signed in"
                    checked={form.data.remember}
                    onChange={(e) => form.setData('remember', e.target.checked)}
                />

                <Button type="submit" size="lg" className="w-full" loading={form.processing}>
                    Sign in
                </Button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-500 dark:text-night-400">
                Access is provisioned by your administrator. Contact ICT if you need an account.
            </p>
        </GuestLayout>
    );
}
