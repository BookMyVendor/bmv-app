import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';
import { getAuthFunctionsBaseUrl } from '../apiConfig';
import { apiFetch } from '../apiClient';
import { axiosFunctionsCall } from '../axiosClient';

export interface PortfolioImage {
  id: string;
  business_id: string;
  image_url: string | null;
  display_order: number;
  created_at: string;
  image_type?: string;
}

const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function getSafeImageExtension(uri: string, fallback = 'jpg'): string {
  try {
    const withoutQuery = uri.split('?')[0].split('#')[0];
    const rawExt = withoutQuery.split('.').pop()?.toLowerCase()?.trim() || '';
    return ALLOWED_IMAGE_EXTENSIONS.has(rawExt) ? rawExt : fallback;
  } catch {
    return fallback;
  }
}

function normalizeFileName(fileName: string | undefined, fallbackPrefix: string, extension: string): string {
  if (!fileName || !fileName.trim()) {
    return `${fallbackPrefix}-${Date.now()}.${extension}`;
  }
  const cleaned = fileName.trim().split('?')[0].split('#')[0];
  const dotIndex = cleaned.lastIndexOf('.');
  const baseName = dotIndex > 0 ? cleaned.slice(0, dotIndex) : cleaned;
  return `${baseName}.${extension}`;
}

/** Spec: vendor-businesses-media-list { business_id } */
export async function getBusinessMedia(businessId: string) {
  console.log('[getBusinessMedia] Request - Function: vendor-businesses-media-list');
  console.log('[getBusinessMedia] Request - Payload:', JSON.stringify({ business_id: businessId }, null, 2));
  const result = await axiosFunctionsCall<PortfolioImage[]>('vendor-businesses-media-list', { business_id: businessId }, 'media');
  console.log('[getBusinessMedia] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[getBusinessMedia] Response - Data Count:', result.data?.length ?? 0);
  return result;
}

/** 
 * Backend uses a two-step process: 
 * 1. Upload using upload-profile-photo (multipart) -> returns file_id
 * 2. Link file to business using vendor-businesses-media-create -> returns media object
 */
export async function uploadBusinessImage(
  businessId: string, 
  imageUri: string, 
  fileName?: string
): Promise<{ data?: PortfolioImage; error?: { success: false; error: string; code?: string } }> {
  try {
    if (!imageUri) {
      return { error: { success: false, error: 'Image URI is required' } };
    }

    // Stage 1: Upload the file
    const { data: uploadData, error: uploadError } = await uploadProfilePhoto(imageUri, fileName);
    if (uploadError) return { error: { success: false, error: uploadError.error } };
    if (!uploadData?.file_id) return { error: { success: false, error: 'Failed to retrieve file_id after upload' } };

    // Stage 2: Link to business
    const { data: mediaData, error: createError } = await createBusinessMedia({
      business_id: businessId,
      file_id: uploadData.file_id,
      sort_order: 0
    });

    if (createError) return { error: createError };
    return { data: mediaData };
  } catch (e: any) {
    return { error: { success: false, error: e?.message || 'Upload failed', code: 'NETWORK_ERROR' } };
  }
}

/** Spec: vendor-businesses-media-set-cover { business_id, media_id } */
export async function setCoverImage(businessId: string, mediaId: string) {
  const payload = { business_id: businessId, media_id: mediaId };
  console.log('[setCoverImage] Request - Function: vendor-businesses-media-set-cover');
  console.log('[setCoverImage] Request - Payload:', JSON.stringify(payload, null, 2));
  const res = await axiosFunctionsCall<unknown>('vendor-businesses-media-set-cover', payload);
  console.log('[setCoverImage] Response - Error:', res.error ? JSON.stringify(res.error, null, 2) : null);
  console.log('[setCoverImage] Response - Data:', res.data ? JSON.stringify(res.data, null, 2) : null);
  return { data: res.data, error: res.error };
}

/** Spec: vendor-businesses-media-delete { business_id, media_id } */
export async function deleteBusinessImage(businessId: string, mediaId: string) {
  const payload = { business_id: businessId, media_id: mediaId };
  console.log('[deleteBusinessImage] Request - Function: vendor-businesses-media-delete');
  console.log('[deleteBusinessImage] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<void>('vendor-businesses-media-delete', payload);
  console.log('[deleteBusinessImage] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  return result;
}

export interface CreateMediaRequest {
  business_id: string;
  file_id: string;
  sort_order?: number;
}

/** Spec: vendor-businesses-media-create { business_id, file_id, sort_order? } */
export async function createBusinessMedia(body: CreateMediaRequest) {
  return axiosFunctionsCall<PortfolioImage>('vendor-businesses-media-create', body as any, 'media');
}

/** Spec: file-storage-url { file_id or id } -> { success, file_id, url } */
export async function getFileStorageUrl(fileId: string) {
  return axiosFunctionsCall<{ file_id: string; url: string }>('file-storage-url', { file_id: fileId }, 'file_id');
}

/** Spec: upload-profile-photo — multipart/form-data field `image` (file). */
export async function uploadProfilePhoto(imageUri: string, fileName?: string): Promise<{ data?: { file_id: string; url: string }; error?: { success: false; error: string } }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}upload-profile-photo`;
    const formData = new FormData();
    let normalizedImageUri = imageUri;
    let fileExt = getSafeImageExtension(imageUri);

    // Some gallery URIs have unsupported extensions or query strings.
    // Converting to JPEG avoids backend parser failures.
    if (Platform.OS !== 'web' && !imageUri.startsWith('data:image/')) {
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          imageUri,
          [],
          { compress: 0.85, format: SaveFormat.JPEG }
        );
        normalizedImageUri = manipulated.uri;
        fileExt = 'jpg';
      } catch {
        // Fall back to original URI when conversion fails.
      }
    }
    
    const normalizedName = normalizeFileName(fileName, 'profile', fileExt);

    // Platform-specific FormData handling
    if (Platform.OS === 'web') {
      const response = await fetch(normalizedImageUri);
      if (!response.ok) throw new Error('Failed to load image for upload');
      const blob = await response.blob();
      formData.append('image', new File([blob], normalizedName, { type: blob.type || 'image/jpeg' }));
    } else {
      // In React Native, we pass an object as 'any' for multipart upload
      formData.append('image', {
        uri: normalizedImageUri,
        name: normalizedName,
        type: fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg',
      } as any);
    }

    const response = await apiFetch(url, { method: 'POST', body: formData });
    let data: any;
    try {
      const text = await response.text();
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    
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
