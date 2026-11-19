import { Button } from '@/Components/ui/Button';
import { Card, CardFooter } from '@/Components/ui/Card';
import { Field, FormSection, Input } from '@/Components/ui/Form';
import { Avatar } from '@/Components/ui/misc';
import { PageHeader } from '@/Components/ui/PageHeader';
import AppLayout from '@/Layouts/AppLayout';
import { PageProps } from '@/types';
import { useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';

export default function Edit({
    savedSignature,
    savedStamp = null,
}: {
    savedSignature: string | null;
    savedStamp?: string | null;
}) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const profile = useForm({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone_number: user.phone_number ?? '',
    });

    const password = useForm({ current_password: '', password: '', password_confirmation: '' });

    const saveProfile = (e: FormEvent) => {
        e.preventDefault();
        profile.patch(route('profile.update'), { preserveScroll: true });
    };

    const savePassword = (e: FormEvent) => {
        e.preventDefault();
        password.put(route('password.update'), {
            preserveScroll: true,
            onSuccess: () => password.reset(),
            onError: () => password.reset('password', 'password_confirmation'),
        });
    };

    return (
        <AppLayout title="Profile">
            <PageHeader title="Profile" description="Manage your personal details and password." />

            <div className="space-y-6">
                <Card>
                    <form onSubmit={saveProfile}>
                        <FormSection title="Personal information" description="Your name appears on comments, approvals and signatures.">
                            <div className="flex items-center gap-4">
                                <Avatar name={user.name} size="lg" />
                                <div>
                                    <p className="font-medium text-slate-900 dark:text-night-100">{user.name}</p>
                                    <p className="text-sm text-slate-500 dark:text-night-400">{user.role?.display_name ?? (user.is_admin ? 'Administrator' : 'Member')}</p>
                                </div>
                            </div>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="First name" htmlFor="first_name" error={profile.errors.first_name} required>
                                    <Input id="first_name" value={profile.data.first_name} onChange={(e) => profile.setData('first_name', e.target.value)} />
                                </Field>
                                <Field label="Last name" htmlFor="last_name" error={profile.errors.last_name} required>
                                    <Input id="last_name" value={profile.data.last_name} onChange={(e) => profile.setData('last_name', e.target.value)} />
                                </Field>
                                <Field label="Email" htmlFor="email" error={profile.errors.email} required>
                                    <Input id="email" type="email" value={profile.data.email} onChange={(e) => profile.setData('email', e.target.value)} />
                                </Field>
                                <Field label="Phone" htmlFor="phone_number" error={profile.errors.phone_number}>
                                    <Input id="phone_number" value={profile.data.phone_number} onChange={(e) => profile.setData('phone_number', e.target.value)} />
                                </Field>
                            </div>
                        </FormSection>
                        <CardFooter>
                            <Button type="submit" loading={profile.processing} disabled={!profile.isDirty}>
                                Save changes
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <Card>
                    <FormSection
                        title="Assigned signature"
                        description="Signatures are assigned by an administrator. Contact ICT if yours is missing or needs updating."
                    >
                        <div className="flex h-36 items-center justify-center rounded-lg border border-slate-200 dark:border-night-700 bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#fff_10px,#fff_20px)] p-4">
                            {savedSignature ? (
                                <img src={savedSignature} alt="Your assigned signature" className="max-h-full max-w-full object-contain" />
                            ) : (
                                <p className="text-sm text-slate-500">No signature has been assigned to your account yet.</p>
                            )}
                        </div>
                    </FormSection>
                </Card>

                <Card>
                    <FormSection
                        title="Assigned stamp"
                        description="Stamps are assigned by an administrator. Contact ICT if yours is missing or needs updating."
                    >
                        <div className="flex h-36 items-center justify-center rounded-lg border border-slate-200 dark:border-night-700 bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_10px,#fff_10px,#fff_20px)] p-4">
                            {savedStamp ? (
                                <img src={savedStamp} alt="Your assigned stamp" className="max-h-full max-w-full object-contain" />
                            ) : (
                                <p className="text-sm text-slate-500">No stamp has been assigned to your account yet.</p>
                            )}
                        </div>
                    </FormSection>
                </Card>

                <Card>
                    <form onSubmit={savePassword}>
                        <FormSection title="Password" description="Use a long, unique password.">
                            <Field label="Current password" htmlFor="current_password" error={password.errors.current_password}>
                                <Input
                                    id="current_password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={password.data.current_password}
                                    onChange={(e) => password.setData('current_password', e.target.value)}
                                />
                            </Field>
                            <div className="grid gap-5 sm:grid-cols-2">
                                <Field label="New password" htmlFor="password" error={password.errors.password}>
                                    <Input
                                        id="password"
                                        type="password"
                                        autoComplete="new-password"
                                        value={password.data.password}
                                        onChange={(e) => password.setData('password', e.target.value)}
                                    />
                                </Field>
                                <Field label="Confirm new password" htmlFor="password_confirmation" error={password.errors.password_confirmation}>
                                    <Input
                                        id="password_confirmation"
                                        type="password"
                                        autoComplete="new-password"
                                        value={password.data.password_confirmation}
                                        onChange={(e) => password.setData('password_confirmation', e.target.value)}
                                    />
                                </Field>
                            </div>
                        </FormSection>
                        <CardFooter>
                            <Button type="submit" loading={password.processing}>
                                Update password
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </AppLayout>
    );
}
