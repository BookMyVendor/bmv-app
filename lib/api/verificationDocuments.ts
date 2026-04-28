import { Platform } from 'react-native';
import { axiosFunctionsCall, axiosMultipartUpload } from '../axiosClient';

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
  verification_status: 'pending' | 'verified' | 'rejected';
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

/**
 * Uploads a verification document via multipart/form-data directly to
 * vendor-businesses-verification-documents-create.
 *
 * The backend handles:
 *  - uploading the file to the vendor-docs bucket
 *  - storing file metadata in cms.file_storage
 *  - creating the verification document row
 *
 * Path in MinIO: vendors/{vendorId}/businesses/{businessId}/{docType}/{filename}
 */
export async function uploadVerificationDocument(
  businessId: string,
  documentTypeId: string,
  uri: string,
  fileName?: string
): Promise<{ data?: VerificationDocument; error?: { success: false; error: string } }> {
  const timestamp = new Date().toISOString();
  console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] START`);
  console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] businessId: ${businessId}`);
  console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] documentTypeId: ${documentTypeId}`);
  console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] uri: ${uri.substring(0, 60)}...`);
  console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] fileName: ${fileName}`);
  
  try {
    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] Creating FormData...`);
    const formData = new FormData();
    
    const safeName = fileName || uri.split('/').pop() || 'upload.jpg';
    const stripped = uri.split('?')[0].split('#')[0];
    const rawExt = stripped.split('.').pop()?.toLowerCase() || '';
    const ext = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(rawExt) ? rawExt : 'jpg';
    const mimeType = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] File info:`, { safeName, ext, mimeType });

    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] Appending business_id: ${businessId}`);
    formData.append('business_id', businessId);

    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] Appending document_type_id: ${documentTypeId}`);
    formData.append('document_type_id', documentTypeId);

    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] Appending file:`, { name: safeName, type: mimeType });
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      formData.append('file', new File([blob], safeName, { type: mimeType }));
    } else {
      formData.append('file', {
        uri,
        name: safeName,
        type: mimeType,
      } as any);
    }

    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] FormData created, calling axiosMultipartUpload...`);
    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] REQUEST:`);
    console.log(`  Function: vendor-businesses-verification-documents-create`);
    console.log(`  business_id: ${businessId}`);
    console.log(`  document_type_id: ${documentTypeId}`);
    console.log(`  file: ${safeName} (${mimeType})`);
    
    const result = await axiosMultipartUpload<VerificationDocument>(
      'vendor-businesses-verification-documents-create',
      formData,
      'verification_document'
    );

    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] RESPONSE:`);
    if (result.error) {
      console.log(`  Status: ERROR`);
      console.log(`  Error: ${result.error.error}`);
      console.log(`  Code: ${result.error.code}`);
    } else {
      console.log(`  Status: SUCCESS`);
      console.log(`  Document ID: ${result.data?.id}`);
      console.log(`  File URL: ${result.data?.file_url}`);
    }

    if (result.error) {
      console.error(`[verificationDocuments.uploadVerificationDocument][${timestamp}] FAILED:`, result.error);
      return { error: { success: false, error: result.error.error } };
    }

    console.log(`[verificationDocuments.uploadVerificationDocument][${timestamp}] SUCCESS:`, result.data);
    return { data: result.data };
  } catch (e: any) {
    console.error(`[verificationDocuments.uploadVerificationDocument][${timestamp}] EXCEPTION:`, e);
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

/** Spec: document-types-list { is_active: true } */
export async function getDocumentTypes() {
  console.log('[getDocumentTypes] Request - Function: document-types-list');
  const result = await axiosFunctionsCall<any[]>('document-types-list', { is_active: true }, 'document_types');
  console.log('[getDocumentTypes] Response - Count:', result.data?.length ?? 0);
  return result;
}

/** Spec: vendor-businesses-verification-documents-create (JSON) { business_id, file_id, ... } */
export async function createVerificationDocument(body: CreateVerificationDocumentRequest) {
  console.log('[createVerificationDocument] Request - Function: vendor-businesses-verification-documents-create');
  console.log('[createVerificationDocument] Request - Payload:', JSON.stringify(body, null, 2));
  const result = await axiosFunctionsCall<VerificationDocument>('vendor-businesses-verification-documents-create', body as any, 'verification_document');
  console.log('[createVerificationDocument] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[createVerificationDocument] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}
