export interface User {
    id: number;
    name: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number?: string;
    email_verified_at?: string;
    is_admin?: boolean;
    is_approver?: boolean;
    can_manage_users?: boolean;
    can_manage_roles?: boolean;
    can_manage_departments?: boolean;
    can_manage_folders?: boolean;
    can_manage_settings?: boolean;
    can_view_activity?: boolean;
    has_signature?: boolean;
    force_password_change?: boolean;
    permissions?: Record<string, boolean>;
    departments?: { id: number; name: string; code: string; is_primary?: boolean }[];
    role?: {
        id: number;
        name: string;
        display_name: string;
    } | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
    };
    organization?: {
        id: number;
        name: string;
        logo_path?: string | null;
    } | null;
    flash?: {
        success?: string | null;
        error?: string | null;
        reset_password?: string | null;
        reset_password_user?: string | null;
        request_link?: string | null;
    };
    unreadNotifications?: number;
};
