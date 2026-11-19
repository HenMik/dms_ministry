import { Button } from '@/Components/ui/Button';
import { Field, Input } from '@/Components/ui/Form';
import GuestLayout from '@/Layouts/GuestLayout';
import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function ConfirmPassword() {
    const { data, setData, post, processing, errors, reset } = useForm({ password: '' });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        post(route('password.confirm'), { onFinish: () => reset('password') });
    };

    return (
        <GuestLayout title="Confirm your password" description="This is a secure area. Please confirm your password before continuing.">
            <form onSubmit={submit} className="space-y-5">
                <Field label="Password" htmlFor="password" error={errors.password}>
                    <Input
                        id="password"
                        type="password"
                        autoFocus
                        value={data.password}
                        invalid={!!errors.password}
                        onChange={(e) => setData('password', e.target.value)}
                    />
                </Field>
                <Button type="submit" size="lg" className="w-full" loading={processing}>
                    Confirm
                </Button>
            </form>
        </GuestLayout>
    );
}
