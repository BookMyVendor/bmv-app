import { getAuthFunctionsBaseUrl } from '../apiConfig';
import { apiFetch, functionsCall } from '../apiClient';

export interface PortfolioImage {
  id: string;
  business_id: string;
  image_url: string | null;
  display_order: number;
  created_at: string;
  image_type?: string;
}

/** Spec: vendor-businesses-media-list { business_id } */
export async function getBusinessMedia(businessId: string) {
  return functionsCall<PortfolioImage[]>('vendor-businesses-media-list', { business_id: businessId }, 'media');
}

/** Not in spec as multipart; backend may expose vendor-businesses-media-upload (multipart: business_id + image). */
export async function uploadBusinessImage(businessId: string, formData: FormData): Promise<{ data?: PortfolioImage; error?: { success: false; error: string; code?: string } }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/vendor-businesses-media-upload`;
    const body = new FormData();
    body.append('business_id', businessId);
    const file = formData.get('image') ?? formData.get('file');
    if (file) body.append('image', file as Blob);
    const response = await apiFetch(url, { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[API] 404 Not Found (non-blocking): vendor-businesses-media-upload', url);
        return {};
      }
      return {
        error: {
          success: false,
          error: (typeof data?.error === 'string' ? data.error : data?.message) || 'Upload failed',
          code: data?.code,
        },
      };
    }
    const media = data?.media ?? data;
    return { data: media as PortfolioImage };
  } catch (e: any) {
    return { error: { success: false, error: e?.message || 'Upload failed', code: 'NETWORK_ERROR' } };
  }
}

/** Spec: vendor-businesses-media-set-cover { business_id, media_id } */
export async function setCoverImage(businessId: string, mediaId: string) {
  const res = await functionsCall<unknown>('vendor-businesses-media-set-cover', { business_id: businessId, media_id: mediaId });
  return { data: res.data, error: res.error };
}

/** Spec: vendor-businesses-media-delete { business_id, media_id } */
export async function deleteBusinessImage(businessId: string, mediaId: string) {
  return functionsCall<void>('vendor-businesses-media-delete', { business_id: businessId, media_id: mediaId });
}

export interface CreateMediaRequest {
  business_id: string;
  file_id: string;
  sort_order?: number;
}

/** Spec: vendor-businesses-media-create { business_id, file_id, sort_order? } */
export async function createBusinessMedia(body: CreateMediaRequest) {
  return functionsCall<PortfolioImage>('vendor-businesses-media-create', body as any, 'media');
}

/** Spec: file-storage-url { file_id or id } -> { success, file_id, url } */
export async function getFileStorageUrl(fileId: string) {
  return functionsCall<{ file_id: string; url: string }>('file-storage-url', { file_id: fileId }, 'file_id');
}

/** Spec: upload-profile-photo — multipart/form-data field `image` (file). */
export async function uploadProfilePhoto(imageUri: string, fileName?: string): Promise<{ data?: { file_id: string; url: string }; error?: { success: false; error: string } }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/upload-profile-photo`;
    const formData = new FormData();
    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    
    // In React Native, we pass an object as 'any' for multipart upload
    formData.append('image', {
      uri: imageUri,
      name: fileName || `profile-${Date.now()}.${fileExt}`,
      type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
    } as any);

    const response = await apiFetch(url, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      return {
        error: {
          success: false,
          error: (typeof data?.error === 'string' ? data.error : data?.message) || 'Upload failed',
        },
      };
    }
    
    return { data: { file_id: data.file_id || data.id, url: data.url } };
  } catch (e: any) {
    return { error: { success: false, error: e?.message || 'Upload failed' } };
  }
}
