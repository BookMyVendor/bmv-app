import { getAuthFunctionsBaseUrl } from '../apiConfig';
import { apiFetch } from '../apiClient';
import { axiosFunctionsCall } from '../axiosClient';

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
  console.log('[getVerificationDocuments] Request - Function: vendor-businesses-verification-documents-list');
  console.log('[getVerificationDocuments] Request - Payload:', JSON.stringify({ business_id: businessId }, null, 2));
  const result = await axiosFunctionsCall<VerificationDocument[]>('vendor-businesses-verification-documents-list', { business_id: businessId }, 'verification_documents');
  console.log('[getVerificationDocuments] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[getVerificationDocuments] Response - Data Count:', result.data?.length ?? 0);
  return result;
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
  const payload = { document_id: id };
  console.log('[deleteVerificationDocument] Request - Function: verification-document-delete');
  console.log('[deleteVerificationDocument] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<void>('verification-document-delete', payload);
  console.log('[deleteVerificationDocument] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  return result;
}

export interface CreateVerificationDocumentRequest {
  business_id: string;
  file_id: string;
  document_type_id?: string;
  document_type_code?: string;
}

/** Spec: vendor-businesses-verification-documents-create { business_id, file_id, ... } */
export async function createVerificationDocument(body: CreateVerificationDocumentRequest) {
  console.log('[createVerificationDocument] Request - Function: vendor-businesses-verification-documents-create');
  console.log('[createVerificationDocument] Request - Payload:', JSON.stringify(body, null, 2));
  const result = await axiosFunctionsCall<VerificationDocument>('vendor-businesses-verification-documents-create', body as any, 'verification_document');
  console.log('[createVerificationDocument] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[createVerificationDocument] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}
