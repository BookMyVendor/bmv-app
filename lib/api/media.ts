import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { getAuthFunctionsBaseUrl } from '../apiConfig';
import { apiFetch } from '../apiClient';
import { axiosFunctionsCall, axiosMultipartUpload } from '../axiosClient';

export interface PortfolioImage {
  id: string;
  business_id: string;
  image_url: string | null;
  file_id?: string | null;
  display_order: number;
  created_at: string;
  image_type?: string;
  mime_type?: string;
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

export interface BusinessMediaItem {
  id: string;
  business_id: string;
  url: string | null;
  image_url?: string | null;
  file_id?: string | null;
  display_order: number;
  sort_order?: number;
  created_at: string;
  image_type?: string;
  mime_type?: string;
}

/** Spec: vendor-businesses-media-list { business_id } */
export async function getBusinessMedia(businessId: string) {
  console.log('[getBusinessMedia] Request - Function: vendor-businesses-media-list');
  console.log('[getBusinessMedia] Request - Payload:', JSON.stringify({ business_id: businessId }, null, 2));
  const result = await axiosFunctionsCall<BusinessMediaItem[]>('vendor-businesses-media-list', { business_id: businessId }, 'media');
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
  const timestamp = new Date().toISOString();
  const payload = { business_id: businessId, media_id: mediaId };
  console.log(`[setCoverImage][${timestamp}] START`);
  console.log(`[setCoverImage][${timestamp}] Request - Function: vendor-businesses-media-set-cover`);
  console.log(`[setCoverImage][${timestamp}] Request - Payload:`, JSON.stringify(payload, null, 2));
  
  const res = await axiosFunctionsCall<unknown>('vendor-businesses-media-set-cover', payload);
  
  if (res.error) {
    console.error(`[setCoverImage][${timestamp}] ERROR:`, JSON.stringify(res.error, null, 2));
  } else {
    console.log(`[setCoverImage][${timestamp}] SUCCESS:`, res.data ? JSON.stringify(res.data, null, 2) : null);
  }
  return { data: res.data, error: res.error };
}

/** Spec: vendor-businesses-media-delete { business_id, media_id } */
export async function deleteBusinessImage(businessId: string, mediaId: string) {
  const timestamp = new Date().toISOString();
  const payload = { business_id: businessId, media_id: mediaId };
  console.log(`[deleteBusinessImage][${timestamp}] START`);
  console.log(`[deleteBusinessImage][${timestamp}] Request - Function: vendor-businesses-media-delete`);
  console.log(`[deleteBusinessImage][${timestamp}] Request - Payload:`, JSON.stringify(payload, null, 2));
  
  const result = await axiosFunctionsCall<void>('vendor-businesses-media-delete', payload);
  
  if (result.error) {
    console.error(`[deleteBusinessImage][${timestamp}] ERROR:`, JSON.stringify(result.error, null, 2));
  } else {
    console.log(`[deleteBusinessImage][${timestamp}] SUCCESS`);
  }
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

export interface DirectMediaUploadRequest {
  business_id: string;
  file: string;
  image_type: 'gallery' | 'cover' | 'portfolio';
  sort_order?: number;
  file_name?: string;
}

export interface DirectMediaUploadResponse extends PortfolioImage {
  cover_photo_url?: string | null;
  url?: string | null;
}

/**
 * Direct multipart upload to vendor-businesses-media-create
 * Supports gallery images, cover photos, and portfolio videos
 * 
 * For cover photos: also updates cover_photo_url on the business
 */
export async function uploadBusinessMediaDirect(
  request: DirectMediaUploadRequest
): Promise<{ data?: DirectMediaUploadResponse; error?: { success: false; error: string; code?: string } }> {
  const timestamp = new Date().toISOString();
  console.log(`[uploadBusinessMediaDirect][${timestamp}] START`);
  console.log(`[uploadBusinessMediaDirect][${timestamp}] Request:`, {
    business_id: request.business_id,
    image_type: request.image_type,
    sort_order: request.sort_order,
    file_name: request.file_name,
    file_uri: request.file?.substring(0, 50) + '...',
  });

  try {
    if (!request.file) {
      console.error(`[uploadBusinessMediaDirect][${timestamp}] ERROR: File URI is required`);
      return { error: { success: false, error: 'File URI is required' } };
    }

    if (!request.business_id) {
      console.error(`[uploadBusinessMediaDirect][${timestamp}] ERROR: Business ID is required`);
      return { error: { success: false, error: 'Business ID is required' } };
    }

    const formData = new FormData();
    formData.append('business_id', request.business_id);
    formData.append('image_type', request.image_type);

    if (request.sort_order !== undefined) {
      formData.append('sort_order', request.sort_order.toString());
    }

    let normalizedUri = request.file;
    const isIOSAssetUri = normalizedUri.startsWith('ph://') || normalizedUri.startsWith('assets-library://');
    const lowerUri = normalizedUri.toLowerCase();
    const looksLikeHeic = lowerUri.includes('.heic') || lowerUri.includes('.heif');
    if (Platform.OS === 'ios' && (isIOSAssetUri || looksLikeHeic)) {
      try {
        console.log(`[uploadBusinessMediaDirect][${timestamp}] iOS image needs normalization (asset URI or HEIC/HEIF). Converting via ImageManipulator...`);
        const manipulated = await ImageManipulator.manipulateAsync(
          normalizedUri,
          [],
          { compress: 0.85, format: SaveFormat.JPEG }
        );
        normalizedUri = manipulated.uri;
        console.log(`[uploadBusinessMediaDirect][${timestamp}] iOS asset URI normalized: ${normalizedUri.substring(0, 50)}...`);
      } catch (e: any) {
        console.warn(`[uploadBusinessMediaDirect][${timestamp}] Failed to normalize iOS image URI:`, e?.message || e);
      }
    }

    const stillIOSAssetUri = normalizedUri.startsWith('ph://') || normalizedUri.startsWith('assets-library://');
    if (Platform.OS === 'ios' && stillIOSAssetUri) {
      return {
        error: {
          success: false,
          error: 'Selected photo could not be prepared for upload on iOS. Please try selecting a different image or take a screenshot (JPEG).',
          code: 'IOS_ASSET_URI_UNSUPPORTED',
        },
      };
    }

    // Backend enforces a strict 5MB limit (observed via HTTP_400: "Image exceeds 5 MB limit").
    // iOS HEIC->JPEG conversion can increase size, so ensure we recompress if needed.
    const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    const currentExt = getSafeImageExtension(normalizedUri, 'jpg');
    const isVideoByExt = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(currentExt);
    if (Platform.OS !== 'web' && !isVideoByExt) {
      try {
        // On iOS we standardize images to JPEG and cap resolution early; this avoids cases where
        // size can't be read reliably or the original asset is HEIC/very large.
        if (Platform.OS === 'ios') {
          const standardized = await ImageManipulator.manipulateAsync(
            normalizedUri,
            [{ resize: { width: 1920 } }],
            { compress: 0.85, format: SaveFormat.JPEG }
          );
          normalizedUri = standardized.uri;
        }

        const info = await FileSystem.getInfoAsync(normalizedUri);
        const size = (info as any)?.size as number | undefined;

        if (info.exists && typeof size === 'number') {
          console.log(`[uploadBusinessMediaDirect][${timestamp}] Post-normalize sizeKB: ${Math.round(size / 1024)}`);
        }

        if (info.exists && typeof size === 'number' && size > MAX_IMAGE_BYTES) {
          console.log(`[uploadBusinessMediaDirect][${timestamp}] Image too large (${Math.round(size / 1024)}KB). Recompressing to fit 5MB...`);

          // Try a few passes, progressively reducing quality and max width.
          const attempts: Array<{ maxWidth: number; quality: number }> = [
            { maxWidth: 1600, quality: 0.72 },
            { maxWidth: 1280, quality: 0.6 },
            { maxWidth: 1024, quality: 0.5 },
            { maxWidth: 800, quality: 0.45 },
          ];

          let finalSize: number | undefined = size;
          for (const a of attempts) {
            const manipulated = await ImageManipulator.manipulateAsync(
              normalizedUri,
              [{ resize: { width: a.maxWidth } }],
              { compress: a.quality, format: SaveFormat.JPEG }
            );
            const newInfo = await FileSystem.getInfoAsync(manipulated.uri);
            const newSize = (newInfo as any)?.size as number | undefined;
            normalizedUri = manipulated.uri;
            finalSize = newSize;
            console.log(`[uploadBusinessMediaDirect][${timestamp}] Recompress pass -> uri: ${normalizedUri.substring(0, 50)}..., sizeKB: ${typeof newSize === 'number' ? Math.round(newSize / 1024) : 'unknown'}`);

            if (newInfo.exists && typeof newSize === 'number' && newSize <= MAX_IMAGE_BYTES) {
              break;
            }
          }

          if (typeof finalSize === 'number' && finalSize > MAX_IMAGE_BYTES) {
            return {
              error: {
                success: false,
                error: 'Image exceeds 5 MB limit. Please choose a smaller image.',
                code: 'IMAGE_TOO_LARGE',
              },
            };
          }
        }
      } catch (e: any) {
        console.warn(`[uploadBusinessMediaDirect][${timestamp}] Failed to check/compress image size:`, e?.message || e);
      }
    }

    const fileExt = getSafeImageExtension(normalizedUri, 'jpg');
    const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(fileExt);
    const fileName = normalizeFileName(request.file_name, `business-${request.image_type}-${Date.now()}`, fileExt);

    console.log(`[uploadBusinessMediaDirect][${timestamp}] File details:`, {
      fileExt,
      isVideo,
      fileName,
      platform: Platform.OS,
    });

    if (Platform.OS === 'web') {
      console.log(`[uploadBusinessMediaDirect][${timestamp}] Web platform: fetching blob...`);
      const response = await fetch(normalizedUri);
      if (!response.ok) throw new Error('Failed to load file for upload');
      const blob = await response.blob();
      const contentType = isVideo ? `video/${fileExt === 'mov' ? 'quicktime' : fileExt}` : `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      formData.append('file', new File([blob], fileName, { type: contentType }));
      console.log(`[uploadBusinessMediaDirect][${timestamp}] Web blob created, size:`, blob.size);
    } else {
      const contentType = isVideo
        ? fileExt === 'mov' ? 'video/quicktime' : `video/${fileExt}`
        : fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg';

      formData.append('file', {
        uri: normalizedUri,
        name: fileName,
        type: contentType,
      } as any);
      console.log(`[uploadBusinessMediaDirect][${timestamp}] Native form data appended`);
    }

    console.log(`[uploadBusinessMediaDirect][${timestamp}] Calling axiosMultipartUpload...`);
    const result = await axiosMultipartUpload<DirectMediaUploadResponse>(
      'vendor-businesses-media-create',
      formData,
      'media'
    );

    if (result.error) {
      console.error(`[uploadBusinessMediaDirect][${timestamp}] ERROR from API:`, result.error);
      return { error: result.error };
    }

    console.log(`[uploadBusinessMediaDirect][${timestamp}] SUCCESS:`, {
      id: result.data?.id,
      image_url: result.data?.image_url?.substring(0, 50) + '...',
      image_type: result.data?.image_type,
      display_order: result.data?.display_order,
      cover_photo_url: result.data?.cover_photo_url?.substring(0, 50) + '...',
    });
    return { data: result.data };
  } catch (e: any) {
    console.error(`[uploadBusinessMediaDirect][${timestamp}] EXCEPTION:`, e?.message || e);
    return { error: { success: false, error: e?.message || 'Upload failed', code: 'NETWORK_ERROR' } };
  }
}

/**
 * Upload gallery image with sort_order
 */
export async function uploadGalleryImage(
  businessId: string,
  imageUri: string,
  sortOrder: number,
  fileName?: string
): Promise<{ data?: DirectMediaUploadResponse; error?: { success: false; error: string; code?: string } }> {
  return uploadBusinessMediaDirect({
    business_id: businessId,
    file: imageUri,
    image_type: 'gallery',
    sort_order: sortOrder,
    file_name: fileName,
  });
}

/**
 * Upload cover photo (also updates cover_photo_url on the business)
 */
export async function uploadCoverImage(
  businessId: string,
  imageUri: string,
  fileName?: string
): Promise<{ data?: DirectMediaUploadResponse; error?: { success: false; error: string; code?: string } }> {
  return uploadBusinessMediaDirect({
    business_id: businessId,
    file: imageUri,
    image_type: 'cover',
    file_name: fileName,
  });
}

/**
 * Upload portfolio video
 */
export async function uploadPortfolioVideo(
  businessId: string,
  videoUri: string,
  fileName?: string
): Promise<{ data?: DirectMediaUploadResponse; error?: { success: false; error: string; code?: string } }> {
  return uploadBusinessMediaDirect({
    business_id: businessId,
    file: videoUri,
    image_type: 'portfolio',
    file_name: fileName,
  });
}

/** Spec: file-storage-url { file_id or id } -> { success, file_id, url } */
export async function getFileStorageUrl(fileId: string) {
  return axiosFunctionsCall<{ file_id: string; url: string }>('file-storage-url', { file_id: fileId }, 'file_id');
}

/** Spec: upload-profile-photo — multipart/form-data field `image` (file). */
export async function uploadProfilePhoto(
  imageUri: string, 
  fileName?: string
): Promise<{ data?: { file_id: string; url: string }; error?: { success: false; error: string } }> {
  try {
    const formData = new FormData();
    let normalizedImageUri = imageUri;
    let fileExt = getSafeImageExtension(imageUri);

    // Some gallery URIs have unsupported extensions or query strings.
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
        // Fall back to original URI
      }
    }
    
    const normalizedName = normalizeFileName(fileName, 'profile', fileExt);

    if (Platform.OS === 'web') {
      const response = await fetch(normalizedImageUri);
      if (!response.ok) throw new Error('Failed to load image for upload');
      const blob = await response.blob();
      formData.append('image', new File([blob], normalizedName, { type: blob.type || 'image/jpeg' }));
    } else {
      formData.append('image', {
        uri: normalizedImageUri,
        name: normalizedName,
        type: fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg',
      } as any);
    }

    console.log('[uploadProfilePhoto] START', { imageUri, fileName });
    const { data, error } = await axiosMultipartUpload<any>('upload-profile-photo', formData);
    
    if (error) {
      console.error('[uploadProfilePhoto] ERROR:', error);
      return { error: { success: false, error: error.error } };
    }
    
    console.log('[uploadProfilePhoto] SUCCESS:', data);
    
    return { 
      data: { 
        file_id: data?.file_id || data?.id, 
        url: data?.url || data?.image_url 
      } 
    };
  } catch (e: any) {
    console.error('[uploadProfilePhoto] EXCEPTION:', e);
    return { error: { success: false, error: e?.message || 'Upload failed' } };
  }
}
