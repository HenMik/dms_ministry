import { Button } from '@/Components/ui/Button';
import { Card, CardBody, CardHeader } from '@/Components/ui/Card';
import { Checkbox, Field, Input, Select } from '@/Components/ui/Form';
import { PageHeader } from '@/Components/ui/PageHeader';
import { UserPicker } from '@/Components/ui/UserPicker';
import AppLayout from '@/Layouts/AppLayout';
import { UserLite } from '@/types/models';
import { useForm } from '@inertiajs/react';
import { FormEvent } from 'react';

interface SettingsForm {
    require_otp_after_password: boolean;
    mail_mailer: string;
    mail_host: string;
    mail_port: string;
    mail_username: string;
    mail_password: string;
    mail_password_configured: boolean;
    mail_scheme: string;
    mail_from_address: string;
    mail_from_name: string;
    sms_enabled: boolean;
    sms_driver: string;
    sms_url: string;
    sms_token: string;
    sms_token_configured: boolean;
    sms_sender: string;
    view_access_user_ids: number[];
}

interface Option {
    value: string;
    label: string;
}

export default function Edit({
    settings,
    users = [],
    mailerOptions,
    smsDriverOptions,
}: {
    settings: SettingsForm;
    users?: UserLite[];
    mailerOptions: Option[];
    smsDriverOptions: Option[];
}) {
    const form = useForm({
        require_otp_after_password: settings.require_otp_after_password,
        mail_mailer: settings.mail_mailer,
        mail_host: settings.mail_host,
        mail_port: settings.mail_port,
        mail_username: settings.mail_username,
        mail_password: '',
        mail_scheme: settings.mail_scheme,
        mail_from_address: settings.mail_from_address,
        mail_from_name: settings.mail_from_name,
        sms_enabled: settings.sms_enabled,
        sms_driver: settings.sms_driver,
        sms_url: settings.sms_url,
        sms_token: '',
        sms_sender: settings.sms_sender,
        view_access_user_ids: settings.view_access_user_ids ?? [],
    });

    const submit = (e: FormEvent) => {
        e.preventDefault();
        form.put(route('settings.update'), {
            preserveScroll: true,
            onSuccess: () => form.setData({ mail_password: '', sms_token: '' }),
        });
    };

    return (
        <AppLayout title="Settings">
            <PageHeader
                title="System settings"
                description="Configure email notifications, SMS delivery, and optional OTP after password login."
            />

            <form onSubmit={submit} className="space-y-6">
                <Card>
                    <CardHeader
                        title="Login security"
                        description="Password sign-in is always required. Optionally challenge with SMS OTP afterwards."
                    />
                    <CardBody className="space-y-4">
                        <Checkbox
                            label="Require SMS OTP after successful email/password login"
                            checked={form.data.require_otp_after_password}
                            onChange={(e) => form.setData('require_otp_after_password', e.target.checked)}
                        />
                        <p className="text-xs text-slate-500 dark:text-night-400">
                            When enabled, users must have a mobile number on their profile. SMS gateway settings below must work.
                        </p>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Email for notifications" description="SMTP settings used when the system sends email." />
                    <CardBody className="grid gap-4 sm:grid-cols-2">
                        <Field label="Mailer" htmlFor="mail_mailer" error={form.errors.mail_mailer}>
                            <Select
                                id="mail_mailer"
                                value={form.data.mail_mailer}
                                onChange={(e) => form.setData('mail_mailer', e.target.value)}
                            >
                                {mailerOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Encryption / scheme" htmlFor="mail_scheme" error={form.errors.mail_scheme}>
                            <Select
                                id="mail_scheme"
                                value={form.data.mail_scheme}
                                onChange={(e) => form.setData('mail_scheme', e.target.value)}
                            >
                                <option value="">None / auto</option>
                                <option value="smtp">smtp</option>
                                <option value="smtps">smtps</option>
                            </Select>
                        </Field>
                        <Field label="SMTP host" htmlFor="mail_host" error={form.errors.mail_host}>
                            <Input
                                id="mail_host"
                                value={form.data.mail_host}
                                onChange={(e) => form.setData('mail_host', e.target.value)}
                            />
                        </Field>
                        <Field label="SMTP port" htmlFor="mail_port" error={form.errors.mail_port}>
                            <Input
                                id="mail_port"
                                type="number"
                                value={form.data.mail_port}
                                onChange={(e) => form.setData('mail_port', e.target.value)}
                            />
                        </Field>
                        <Field label="Username" htmlFor="mail_username" error={form.errors.mail_username}>
                            <Input
                                id="mail_username"
                                value={form.data.mail_username}
                                onChange={(e) => form.setData('mail_username', e.target.value)}
                                autoComplete="off"
                            />
                        </Field>
                        <Field
                            label={settings.mail_password_configured ? 'Password (leave blank to keep)' : 'Password'}
                            htmlFor="mail_password"
                            error={form.errors.mail_password}
                        >
                            <Input
                                id="mail_password"
                                type="password"
                                value={form.data.mail_password}
                                onChange={(e) => form.setData('mail_password', e.target.value)}
                                autoComplete="new-password"
                            />
                        </Field>
                        <Field label="From address" htmlFor="mail_from_address" error={form.errors.mail_from_address}>
                            <Input
                                id="mail_from_address"
                                type="email"
                                value={form.data.mail_from_address}
                                onChange={(e) => form.setData('mail_from_address', e.target.value)}
                            />
                        </Field>
                        <Field label="From name" htmlFor="mail_from_name" error={form.errors.mail_from_name}>
                            <Input
                                id="mail_from_name"
                                value={form.data.mail_from_name}
                                onChange={(e) => form.setData('mail_from_name', e.target.value)}
                            />
                        </Field>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="SMS gateway" description="Used for login OTP codes and SMS notifications." />
                    <CardBody className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Checkbox
                                label="Enable SMS gateway"
                                checked={form.data.sms_enabled}
                                onChange={(e) => form.setData('sms_enabled', e.target.checked)}
                            />
                        </div>
                        <Field label="Driver" htmlFor="sms_driver" error={form.errors.sms_driver}>
                            <Select
                                id="sms_driver"
                                value={form.data.sms_driver}
                                onChange={(e) => form.setData('sms_driver', e.target.value)}
                            >
                                {smsDriverOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label="Sender ID" htmlFor="sms_sender" error={form.errors.sms_sender}>
                            <Input
                                id="sms_sender"
                                value={form.data.sms_sender}
                                onChange={(e) => form.setData('sms_sender', e.target.value)}
                            />
                        </Field>
                        <Field label="Gateway URL" htmlFor="sms_url" error={form.errors.sms_url} className="sm:col-span-2">
                            <Input
                                id="sms_url"
                                value={form.data.sms_url}
                                onChange={(e) => form.setData('sms_url', e.target.value)}
                                placeholder="https://clicksmsgateway.com"
                            />
                        </Field>
                        <Field
                            label={settings.sms_token_configured ? 'API token (leave blank to keep)' : 'API token'}
                            htmlFor="sms_token"
                            error={form.errors.sms_token}
                            className="sm:col-span-2"
                        >
                            <Input
                                id="sms_token"
                                type="password"
                                value={form.data.sms_token}
                                onChange={(e) => form.setData('sms_token', e.target.value)}
                                autoComplete="new-password"
                            />
                        </Field>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader
                        title="Document open history"
                        description="Choose who can see who opened or downloaded documents. Uploaders and full-access admins always see this."
                    />
                    <CardBody>
                        <Field label="People who can view opens" error={form.errors.view_access_user_ids}>
                            <UserPicker
                                users={users}
                                value={form.data.view_access_user_ids}
                                onChange={(ids) => form.setData('view_access_user_ids', ids)}
                                placeholder="Select people…"
                            />
                        </Field>
                    </CardBody>
                </Card>

                <div className="flex justify-end">
                    <Button type="submit" loading={form.processing}>
                        Save settings
                    </Button>
                </div>
            </form>
        </AppLayout>
    );
}
