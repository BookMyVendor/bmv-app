import { supabaseUrl } from './supabase';

export interface AccountDeletionResponse {
    success: boolean;
    message?: string;
}

export interface AccountDeletionError {
    code: string;
    message: string;
}

function getProjectRef(): string {
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[1] === 'supabase') {
        return parts[0];
    }
    throw new Error('Invalid Supabase URL format');
}

export async function confirmAccountDeletion({
    accessToken,
}: {
    accessToken: string;
}): Promise<{ data?: AccountDeletionResponse; error?: AccountDeletionError }> {
    try {
        const url = `https://${getProjectRef()}.supabase.co/functions/v1/auth-vendor-delete-account`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({}),
        });

        const rawText = await response.text();
        const json = (() => {
            try {
                return rawText ? JSON.parse(rawText) : {};
            } catch {
                return { message: rawText };
            }
        })();

        if (!response.ok) {
            const code = json?.code || json?.error?.code || 'ACCOUNT_DELETION_FAILED';
            const message = json?.message || json?.error?.message || rawText || `Failed to delete account (status ${response.status})`;
            return { error: { code, message } };
        }

        return { data: { success: true, message: json?.message } };
    } catch (error: any) {
        return {
            error: {
                code: 'NETWORK_ERROR',
                message: error?.message || 'Network error. Please try again.',
            },
        };
    }
}
