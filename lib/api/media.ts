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

/** Spec: upload-profile-photo — multipart/form-data field `image` (file). */
export async function uploadProfilePhoto(formData: FormData): Promise<{ data?: { file_id: string; url: string }; error?: { success: false; error: string } }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/upload-profile-photo`;
    const response = await apiFetch(url, { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[API] 404 Not Found (non-blocking): upload-profile-photo', url);
        return {};
      }
      return {
        error: {
          success: false,
          error: (typeof data?.error === 'string' ? data.error : data?.message) || 'Upload failed',
        },
      };
    }
    const payload = data?.file_id != null ? { file_id: data.file_id, url: data?.url ?? '' } : undefined;
    return { data: payload };
  } catch (e: any) {
    return { error: { success: false, error: e?.message || 'Upload failed' } };
  }
}
