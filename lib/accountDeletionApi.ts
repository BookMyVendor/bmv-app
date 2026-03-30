import { getAuthFunctionsBaseUrl } from './apiConfig';
import { apiFetch } from './apiClient';

export interface AccountDeletionResponse {
  success: boolean;
  message?: string;
}

export interface AccountDeletionError {
  code: string;
  message: string;
}

/** Calls auth-vendor-delete-account per API_SPEC_FOR_CONSUMERS.md (Bearer required). */
export async function confirmAccountDeletion(): Promise<{
  data?: AccountDeletionResponse;
  error?: AccountDeletionError;
}> {
  try {
    const response = await apiFetch(`${getAuthFunctionsBaseUrl()}/auth-vendor-delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const rawText = await response.text();
    const json = (() => {
      try {
        return rawText ? JSON.parse(rawText) : {};
      } catch {
        return {};
      }
    })();
    if (!response.ok) {
      const code = json?.code ?? json?.error?.code ?? 'ACCOUNT_DELETION_FAILED';
      const message =
        (typeof json?.error === 'string' ? json.error : null) ||
        json?.message ||
        json?.error?.message ||
        rawText ||
        `Failed to delete account (status ${response.status})`;
      return { error: { code, message } };
    }
    return { data: { success: true, message: json?.message } };
  } catch (err: any) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network error. Please try again.',
      },
    };
  }
}
