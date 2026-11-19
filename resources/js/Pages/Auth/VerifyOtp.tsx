import { Button, LinkButton } from '@/Components/ui/Button';
import { Field } from '@/Components/ui/Form';
import { OtpInput } from '@/Components/ui/OtpInput';
import { Alert } from '@/Components/ui/misc';
import GuestLayout from '@/Layouts/GuestLayout';
import { useForm } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';

export default function VerifyOtp({
    maskedPhone,
    status,
    expiresIn = 300,
}: {
    maskedPhone: string;
    status?: string;
    expiresIn?: number;
}) {
    const form = useForm({ otp: '' });
    const resend = useForm({});
    const [seconds, setSeconds] = useState(expiresIn);

    useEffect(() => {
        if (seconds <= 0) return;
        const id = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
        return () => window.clearInterval(id);
    }, [seconds]);

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.post(route('login.otp.verify.store'));
    };

    const requestResend = () => {
        resend.post(route('login.otp.resend'), {
            preserveScroll: true,
            onSuccess: () => setSeconds(expiresIn),
        });
    };

    return (
        <GuestLayout
            title="Enter verification code"
            description={`We sent a 6-digit code to ${maskedPhone}. Enter it below to continue.`}
        >
            {status && (
                <Alert tone="success" className="mb-6">
                    {status}
                </Alert>
            )}

            <form onSubmit={submit} className="space-y-5">
                <Field label="One-time code" htmlFor="otp" error={form.errors.otp}>
                    <OtpInput
                        id="otp"
                        value={form.data.otp}
                        invalid={!!form.errors.otp}
                        disabled={form.processing}
                        autoFocus
                        onChange={(otp) => form.setData('otp', otp)}
                    />
                </Field>

                <Button type="submit" size="lg" className="w-full" loading={form.processing} disabled={form.data.otp.length !== 6}>
                    Verify and sign in
                </Button>
            </form>

            <div className="mt-6 space-y-3 text-center text-sm text-slate-500 dark:text-night-400">
                <p>
                    {seconds > 0 ? (
                        <>Code expires in {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</>
                    ) : (
                        <>Code may have expired.</>
                    )}
                </p>
                <button
                    type="button"
                    onClick={requestResend}
                    disabled={resend.processing}
                    className="font-medium text-brand-700 dark:text-brand-300 hover:text-brand-800 dark:hover:text-brand-300 disabled:opacity-60"
                >
                    {resend.processing ? 'Sending…' : 'Resend code'}
                </button>
                <div>
                    <LinkButton href={route('login')} variant="ghost" size="sm">
                        Back to sign in
                    </LinkButton>
                </div>
            </div>
        </GuestLayout>
    );
}
