import { getAuthFunctionsBaseUrl } from '../apiConfig';
import { apiFetch, functionsCall } from '../apiClient';

export interface VerificationDocument {
  id: string;
  business_id: string;
  document_type_id: string;
  document_type_code: string;
  document_type_name: string;
  file_id: string;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  verification_status: string;
  uploaded_at: string;
}

/** Spec: vendor-businesses-verification-documents-list { business_id } */
export async function getVerificationDocuments(businessId: string) {
  return functionsCall<VerificationDocument[]>('vendor-businesses-verification-documents-list', { business_id: businessId }, 'verification_documents');
}

/** Spec: vendor-businesses-verification-documents-create has file_id (no multipart). If backend has multipart upload, use it. */
export async function uploadVerificationDocument(
  businessId: string,
  formData: FormData
): Promise<{ data?: VerificationDocument; error?: { success: false; error: string } }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/vendor-businesses-verification-documents-upload`;
    const response = await apiFetch(url, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[API] 404 Not Found (non-blocking): vendor-businesses-verification-documents-upload', url);
        return {};
      }
      return {
        error: {
          success: false,
          error: (typeof data?.error === 'string' ? data.error : data?.message) || 'Upload failed',
        },
      };
    }
    const doc = data?.verification_document ?? data;
    return { data: doc as VerificationDocument };
  } catch (e: any) {
    return { error: { success: false, error: e?.message || 'Upload failed' } };
  }
}

/** Spec: verification-document-delete { document_id } */
export async function deleteVerificationDocument(id: string) {
  return functionsCall<void>('verification-document-delete', { document_id: id });
}
