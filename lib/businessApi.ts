import { getApiBaseUrl } from './apiConfig';
import * as vendorBusinessApi from './api/vendorBusinesses';
import * as offersApi from './api/offers';
import * as mediaApi from './api/media';
import * as verificationApi from './api/verificationDocuments';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { compressAndConvertToBase64, validateImageUri } from './imageCompression';
import { DocumentFile, getMimeType, isImageFile, isPdfFile, validateFileType } from './documentUpload';
import { Platform } from 'react-native';

export interface Offer {
  id: string;
  business_id: string;
  title: string;
  description: string;
  banner_image_url: string | null;
  banner_image_base64: string | null;
  discount_percentage: number | null;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortfolioImage {
  id: string;
  business_id: string;
  image_url: string | null;
  image_base64: string | null;
  display_order: number;
  created_at: string;
  image_type?: string; // 'gallery', 'cover', 'portfolio', or 'video'
  mime_type?: string;
}

export interface CreateOfferData {
  business_id: string;
  title: string;
  description: string;
  banner_image_url?: string | null;
  banner_image_base64?: string | null;
  discount_percentage?: number | null;
  valid_from?: string;
  valid_until: string;
  is_active?: boolean;
}

export interface UpdateOfferData {
  title?: string;
  description?: string;
  banner_image_url?: string | null;
  banner_image_base64?: string | null;
  discount_percentage?: number | null;
  valid_from?: string;
  valid_until?: string;
  is_active?: boolean;
}

const MAX_IMAGES_PER_BUSINESS = 10;
const MAX_VIDEOS_PER_BUSINESS = 5;
const OFFER_BANNER_MAX_SIZE = 5 * 1024 * 1024;
const GALLERY_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const GALLERY_VIDEO_MAX_SIZE = 25 * 1024 * 1024;

export const validateImageFormat = (uri: string): boolean => {
  const validFormats = ['.jpg', '.jpeg', '.png', '.webp'];
  const lowerUri = uri.toLowerCase();
  return validFormats.some((format) => lowerUri.endsWith(format));
};

export const validateImageSize = async (
  uri: string,
  maxSize: number
): Promise<boolean> => {
  try {
    if (!uri) return false;

    // Local file/content URIs on RN should use FileSystem, not fetch(blob),
    // which can throw generic "Internal error" on some Android devices.
    const isLocalUri = uri.startsWith('file://') || uri.startsWith('content://');
    if (isLocalUri) {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && typeof (info as any).size === 'number') {
        return ((info as any).size as number) <= maxSize;
      }
      // If size is unavailable for a valid local URI, allow upload to proceed.
      return true;
    }

    // data/blob/http URLs
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size <= maxSize;
  } catch (error) {
    console.error('Error validating image size:', error);
    // Validation errors should not block uploads; backend will enforce limits.
    return true;
  }
};

export const uploadImageToStorage = async (
  _uri: string,
  _bucket: string,
  _path: string
): Promise<{ data: { path: string } | null; error: Error | null }> => {
  return { data: null, error: new Error('Use uploadBusinessImage or uploadProfilePhoto API instead') };
};

export const getPublicUrl = (_bucket: string, path: string): string => {
  return path ? `${getApiBaseUrl()}/files/${_bucket}/${path}` : '';
};

export const resolveBusinessMediaUrl = (
  filePathOrUrl: string | null | undefined,
  bucket = 'vendor-media'
): string | null => {
  if (!filePathOrUrl) {
    console.log('[MediaResolve] Empty input, returning null');
    return null;
  }
  
  const base = getApiBaseUrl().replace(/\/+$/, '');
  let resolvedUrl: string | null = null;

  // 1. If it's a full URL, check if it's an internal storage URL that needs proxying
  if (
    filePathOrUrl.startsWith('http://') || 
    filePathOrUrl.startsWith('https://')
  ) {
    try {
      const url = new URL(filePathOrUrl);
      const apiHost = new URL(base).host;
      
      // If it's already on our API host, return it as-is
      if (url.host === apiHost) {
        console.log('[MediaResolve] Already on API host:', filePathOrUrl);
        return filePathOrUrl;
      }

      const path = url.pathname;
      
      // Pattern 1: /bucket-name/path/to/file
      if (path.includes(`/${bucket}/`)) {
        const pathAfterBucket = path.split(`/${bucket}/`)[1];
        resolvedUrl = `${base}/media/${bucket}/${pathAfterBucket}`;
        console.log('[MediaResolve] Rewrote storage URL to proxy:', { original: filePathOrUrl, resolved: resolvedUrl });
        return resolvedUrl;
      }
      
      // Pattern 2: /media/bucket-name/path/to/file
      if (path.includes('/media/')) {
        resolvedUrl = `${base}${path}`;
        console.log('[MediaResolve] Prepended base to media proxy path:', { original: filePathOrUrl, resolved: resolvedUrl });
        return resolvedUrl;
      }

      // Pattern 3: Any other path that looks like a storage path (e.g. minio host)
      if (url.host.includes('minio')) {
        const parts = path.split('/').filter(Boolean);
        if (parts.length >= 2) {
           const urlBucket = parts[0];
           const urlKey = parts.slice(1).join('/');
           resolvedUrl = `${base}/media/${urlBucket}/${urlKey}`;
           console.log('[MediaResolve] Detected MinIO host, converted to proxy:', { original: filePathOrUrl, resolved: resolvedUrl });
           return resolvedUrl;
        }
      }
    } catch (e) {
      console.warn('[MediaResolve] URL parsing failed for:', filePathOrUrl);
    }

    console.log('[MediaResolve] Returning external URL as-is:', filePathOrUrl);
    return filePathOrUrl;
  }

  // 2. Data URLs are returned as-is
  if (filePathOrUrl.startsWith('data:')) {
    console.log('[MediaResolve] Returning Data URL as-is');
    return filePathOrUrl;
  }

  // 3. If it's a proxy path (starts with /media, /storage, /files, etc)
  if (filePathOrUrl.startsWith('/')) {
    resolvedUrl = `${base}${filePathOrUrl}`;
    console.log('[MediaResolve] Handled absolute path:', { original: filePathOrUrl, resolved: resolvedUrl });
    return resolvedUrl;
  }

  // 4. If it's a relative path containing a slash, assume it's a sub-path
  if (filePathOrUrl.includes('/')) {
    resolvedUrl = `${base}/${filePathOrUrl.replace(/^\/+/, '')}`;
    console.log('[MediaResolve] Handled relative path:', { original: filePathOrUrl, resolved: resolvedUrl });
    return resolvedUrl;
  }

  // 5. Fallback for raw keys/UUIDs:
  const key = filePathOrUrl.replace(/^\/+/, '');
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(key) && key.includes('.')) {
     resolvedUrl = `${base}/${key}`;
     console.log('[MediaResolve] Handled raw key (filename):', { original: filePathOrUrl, resolved: resolvedUrl });
     return resolvedUrl;
  }

  resolvedUrl = `${base}/media/${bucket}/${key}`;
  console.log('[MediaResolve] Fallback resolved to proxy:', { original: filePathOrUrl, resolved: resolvedUrl });
  return resolvedUrl;
};

// Helper to rewrite MinIO URLs for local development
const rewriteMinioUrl = (url: string | null | undefined, bucket = 'vendor-media'): string | null => {
  return resolveBusinessMediaUrl(url, bucket);
};

export const deleteImageFromStorage = async (
  _bucket: string,
  _path: string
): Promise<{ error: Error | null }> => {
  return { error: null };
};

export const createOffer = async (
  offerData: CreateOfferData
): Promise<{ data: Offer | null; error: Error | null }> => {
  try {
    if (offerData.title.length > 100) {
      throw new Error('Title must not exceed 100 characters');
    }
    if (offerData.description.length > 500) {
      throw new Error('Description must not exceed 500 characters');
    }

    const validUntil = new Date(offerData.valid_until);
    if (validUntil < new Date()) {
      throw new Error('Expiry date must be in the future');
    }

    const { data, error } = await offersApi.createOffer(offerData.business_id, offerData as any);
    if (error) throw new Error(error.error);
    return { data: data as any as Offer, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const getOffers = async (
  businessId: string
): Promise<{ data: Offer[] | null; error: Error | null }> => {
  const { data, error } = await offersApi.getOffers(businessId);
  if (error) return { data: null, error: new Error(error.error) };
  return { data: (data || []) as any as Offer[], error: null };
};

export const updateOffer = async (
  offerId: string,
  offerData: UpdateOfferData
): Promise<{ data: Offer | null; error: Error | null }> => {
  try {
    if (offerData.title && offerData.title.length > 100) {
      throw new Error('Title must not exceed 100 characters');
    }
    if (offerData.description && offerData.description.length > 500) {
      throw new Error('Description must not exceed 500 characters');
    }
    if (offerData.valid_until && new Date(offerData.valid_until) < new Date()) {
      throw new Error('Expiry date must be in the future');
    }
    const { data, error } = await offersApi.updateOffer(offerId, offerData as any);
    if (error) throw new Error(error.error);
    return { data: data as any as Offer, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const deleteOffer = async (
  offerId: string
): Promise<{ error: Error | null }> => {
  const { error } = await offersApi.deleteOffer(offerId);
  if (error) return { error: new Error(error.error) };
  return { error: null };
};

export const getBusinessImages = async (
  businessId: string
): Promise<{ data: PortfolioImage[] | null; error: Error | null }> => {
  console.log(`[getBusinessImages] START - businessId: ${businessId}`);
  const { data, error } = await mediaApi.getBusinessMedia(businessId);
  if (error) {
    console.error(`[getBusinessImages] ERROR:`, error);
    return { data: null, error: new Error(error.error) };
  }
  console.log(`[getBusinessImages] Raw response count: ${data?.length || 0}`);
  const firstItem = data?.[0];
  console.log(`[getBusinessImages] First item sample:`, firstItem ? {
    id: firstItem.id,
    url: firstItem.url,
    image_url: firstItem.image_url,
    image_type: firstItem.image_type,
    mime_type: firstItem.mime_type,
  } : 'no data');

  // Use the direct URL from the API response (the API returns full MinIO/S3 URLs)
  const transformedData = (data || []).map((item) => ({
    id: item.id,
    business_id: item.business_id,
    image_url: resolveBusinessMediaUrl(item.url ?? item.image_url ?? null, 'vendor-media'),
    image_base64: null,
    display_order: item.display_order ?? item.sort_order ?? 0,
    created_at: item.created_at,
    image_type: item.image_type || 'gallery',
    mime_type: item.mime_type,
  }));

  console.log(`[getBusinessImages] Transformed ${transformedData.length} items`);
  return { data: transformedData, error: null };
};

export const uploadBusinessImage = async (
  businessId: string,
  imageUri: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  const timestamp = new Date().toISOString();
  console.log(`[uploadBusinessImage][${timestamp}] START - businessId: ${businessId}`);
  console.log(`[uploadBusinessImage][${timestamp}] imageUri: ${imageUri?.substring(0, 50)}...`);
  
  try {
    const { data: existingImages } = await getBusinessImages(businessId);
    console.log(`[uploadBusinessImage][${timestamp}] Existing images count: ${existingImages?.length || 0}`);
    
    if (existingImages && existingImages.length >= MAX_IMAGES_PER_BUSINESS) {
      console.error(`[uploadBusinessImage][${timestamp}] ERROR: Maximum images limit reached`);
      throw new Error(`Maximum ${MAX_IMAGES_PER_BUSINESS} images allowed per business`);
    }
    if (!validateImageUri(imageUri)) {
      console.error(`[uploadBusinessImage][${timestamp}] ERROR: Invalid image URI`);
      throw new Error('Invalid image URI');
    }
    
    const stripped = imageUri.split('?')[0].split('#')[0];
    const extractedExt = stripped.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(extractedExt) ? extractedExt : 'jpg';
    
    // Calculate sort_order as next available position
    const galleryImages = existingImages?.filter(img => img.image_type !== 'video') || [];
    const sortOrder = galleryImages.length;
    console.log(`[uploadBusinessImage][${timestamp}] Calculated sortOrder: ${sortOrder}`);
    
    // Use new direct multipart upload with image_type='gallery'
    console.log(`[uploadBusinessImage][${timestamp}] Calling mediaApi.uploadGalleryImage...`);
    const result = await mediaApi.uploadGalleryImage(
      businessId,
      imageUri,
      sortOrder,
      `business-${businessId}-${Date.now()}.${safeExt}`
    );
    
    if (result.error) {
      console.error(`[uploadBusinessImage][${timestamp}] ERROR from mediaApi:`, result.error);
      throw new Error(result.error.error);
    }
    if (!result.data) {
      console.error(`[uploadBusinessImage][${timestamp}] ERROR: No data returned`);
      throw new Error('Upload failed');
    }
    
    console.log(`[uploadBusinessImage][${timestamp}] SUCCESS:`, {
      id: result.data.id,
      image_type: result.data.image_type,
      display_order: result.data.display_order,
      url: result.data.url?.substring(0, 50) + '...',
    });
    
    return {
      data: {
        id: result.data.id,
        business_id: businessId,
        image_url: result.data.url ?? result.data.image_url ?? null,
        image_base64: null,
        display_order: result.data.display_order ?? sortOrder,
        created_at: result.data.created_at,
        image_type: result.data.image_type || 'gallery',
        mime_type: result.data.mime_type,
      },
      error: null,
    };
  } catch (error) {
    console.error(`[uploadBusinessImage][${timestamp}] EXCEPTION:`, (error as Error)?.message);
    return { data: null, error: error as Error };
  }
};

export const uploadBusinessVideo = async (
  businessId: string,
  videoUri: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  const timestamp = new Date().toISOString();
  console.log(`[uploadBusinessVideo][${timestamp}] START - businessId: ${businessId}`);
  console.log(`[uploadBusinessVideo][${timestamp}] videoUri: ${videoUri?.substring(0, 50)}...`);
  
  try {
    const { data: existingMedia } = await getBusinessImages(businessId);
    console.log(`[uploadBusinessVideo][${timestamp}] Existing media count: ${existingMedia?.length || 0}`);
    
    // Check video limit
    const existingVideos = existingMedia?.filter(img => img.image_type === 'video') || [];
    console.log(`[uploadBusinessVideo][${timestamp}] Existing videos count: ${existingVideos.length}`);
    
    if (existingVideos.length >= MAX_VIDEOS_PER_BUSINESS) {
      console.error(`[uploadBusinessVideo][${timestamp}] ERROR: Maximum videos limit reached`);
      throw new Error(`Maximum ${MAX_VIDEOS_PER_BUSINESS} videos allowed per business`);
    }

    // Use new direct multipart upload with image_type='portfolio'
    const fileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    console.log(`[uploadBusinessVideo][${timestamp}] Calling mediaApi.uploadPortfolioVideo...`);
    
    const result = await mediaApi.uploadPortfolioVideo(
      businessId,
      videoUri,
      `business-video-${businessId}-${Date.now()}.${fileExt}`
    );
    
    if (result.error) {
      console.error(`[uploadBusinessVideo][${timestamp}] ERROR from mediaApi:`, result.error);
      throw new Error(result.error.error);
    }
    if (!result.data) {
      console.error(`[uploadBusinessVideo][${timestamp}] ERROR: No data returned`);
      throw new Error('Upload failed');
    }

    console.log(`[uploadBusinessVideo][${timestamp}] SUCCESS:`, {
      id: result.data.id,
      image_type: result.data.image_type,
      display_order: result.data.display_order,
      url: result.data.url?.substring(0, 50) + '...',
    });

    return {
      data: {
        id: result.data.id,
        business_id: businessId,
        image_url: result.data.url ?? result.data.image_url ?? null,
        image_base64: null,
        display_order: result.data.display_order ?? 0,
        created_at: result.data.created_at,
        image_type: result.data.image_type || 'video',
        mime_type: result.data.mime_type,
      },
      error: null,
    };
  } catch (error) {
    console.error(`[uploadBusinessVideo][${timestamp}] EXCEPTION:`, (error as Error)?.message);
    return { data: null, error: error as Error };
  }
};

export const pickVideo = async (): Promise<{
  uri: string | null;
  size: number | null;
  error: Error | null;
}> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Photo Library access is required.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.8,
    });

    if (result.canceled) {
      return { uri: null, size: null, error: null };
    }

    const asset = result.assets[0];
    const fileSize = asset.fileSize || 0;

    if (fileSize > GALLERY_VIDEO_MAX_SIZE) {
      throw new Error(`Video file size exceeds 25MB limit (Current: ${(fileSize / (1024 * 1024)).toFixed(1)}MB)`);
    }

    return { uri: asset.uri, size: fileSize, error: null };
  } catch (error) {
    return { uri: null, size: null, error: error as Error };
  }
};

export interface UploadResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export const uploadMultipleBusinessImages = async (
  businessId: string,
  imageUris: string[],
  onProgress?: (current: number, total: number) => void
): Promise<{
  results: UploadResult[];
  successCount: number;
  error: Error | null;
}> => {
  const timestamp = new Date().toISOString();
  console.log(`[uploadMultipleBusinessImages][${timestamp}] START - businessId: ${businessId}`);
  console.log(`[uploadMultipleBusinessImages][${timestamp}] Total images to upload: ${imageUris.length}`);
  console.log(`[uploadMultipleBusinessImages][${timestamp}] Image URIs:`, imageUris.map(u => u.substring(0, 30) + '...'));
  
  const results: UploadResult[] = [];
  let successCount = 0;
  
  try {
    const { data: existingImages } = await getBusinessImages(businessId);
    const currentCount = existingImages?.length || 0;
    const availableSlots = MAX_IMAGES_PER_BUSINESS - currentCount;
    
    console.log(`[uploadMultipleBusinessImages][${timestamp}] Existing images: ${currentCount}, Available slots: ${availableSlots}`);
    
    if (imageUris.length > availableSlots) {
      console.error(`[uploadMultipleBusinessImages][${timestamp}] ERROR: Too many images. Requested: ${imageUris.length}, Available: ${availableSlots}`);
      throw new Error(
        `Can only upload ${availableSlots} more images. Current: ${currentCount}/${MAX_IMAGES_PER_BUSINESS}`
      );
    }

    const hasCover = existingImages?.some(img => img.image_type === 'cover');
    console.log(`[uploadMultipleBusinessImages][${timestamp}] Has existing cover: ${hasCover}`);

    for (let i = 0; i < imageUris.length; i++) {
      console.log(`[uploadMultipleBusinessImages][${timestamp}] Processing image ${i + 1}/${imageUris.length}...`);
      onProgress?.(i + 1, imageUris.length);
      
      const { data, error } = await uploadBusinessImage(businessId, imageUris[i]);
      
      if (error) {
        console.error(`[uploadMultipleBusinessImages][${timestamp}] Image ${i + 1} FAILED:`, error.message);
        results.push({ success: false, error: error.message });
      } else if (data?.image_url) {
        console.log(`[uploadMultipleBusinessImages][${timestamp}] Image ${i + 1} SUCCESS:`, data.id);
        results.push({ success: true, imageUrl: data.image_url });
        successCount++;
      } else {
        console.error(`[uploadMultipleBusinessImages][${timestamp}] Image ${i + 1} FAILED: No data returned`);
        results.push({ success: false, error: 'Upload failed - no data returned' });
      }
    }
    
    console.log(`[uploadMultipleBusinessImages][${timestamp}] COMPLETE - Success: ${successCount}/${imageUris.length}`);
    console.log(`[uploadMultipleBusinessImages][${timestamp}] Results summary:`, results.map(r => ({ success: r.success, error: r.error?.substring(0, 50) })));
    
    return { results, successCount, error: null };
  } catch (error) {
    console.error(`[uploadMultipleBusinessImages][${timestamp}] EXCEPTION:`, (error as Error)?.message);
    return { results, successCount, error: error as Error };
  }
};

export const deleteBusinessImage = async (
  imageId: string,
  businessId: string
): Promise<{ error: Error | null }> => {
  const timestamp = new Date().toISOString();
  console.log(`[deleteBusinessImage][${timestamp}] START - imageId: ${imageId}, businessId: ${businessId}`);
  
  const { error } = await mediaApi.deleteBusinessImage(businessId, imageId);
  
  if (error) {
    console.error(`[deleteBusinessImage][${timestamp}] ERROR:`, error.error);
    return { error: new Error(error.error) };
  }
  
  console.log(`[deleteBusinessImage][${timestamp}] SUCCESS`);
  return { error: null };
};

export const setCoverImage = async (
  businessId: string,
  imageId: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  const timestamp = new Date().toISOString();
  console.log(`[setCoverImage][${timestamp}] START - businessId: ${businessId}, imageId: ${imageId}`);
  
  const { data, error } = await mediaApi.setCoverImage(businessId, imageId);
  
  if (error) {
    console.error(`[setCoverImage][${timestamp}] ERROR:`, error.error);
    return { data: null, error: new Error(error.error) };
  }
  
  const d = data as any;
  console.log(`[setCoverImage][${timestamp}] SUCCESS:`, {
    id: d?.id,
    image_type: 'cover',
    image_url: d?.image_url?.substring(0, 50) + '...',
  });
  
  return {
    data: d ? {
      id: d.id,
      business_id: businessId,
      image_url: d.image_url ?? null,
      image_base64: null,
      display_order: d.display_order ?? 0,
      created_at: d.created_at,
      image_type: 'cover',
    } : null,
    error: null,
  };
};

/**
 * Fetch detailed information for a specific business.
 *
 * This function calls the vendor-businesses-get API which requires an OBJECT
 * payload containing the business_id. Sending a raw string will cause a
 * 500 INTERNAL_ERROR from the backend.
 *
 * @param businessId - The UUID of the business to fetch
 * @returns Object containing business data or error
 */
export const getBusinessDetails = async (
  businessId: string
): Promise<{ data: any | null; error: Error | null }> => {
  // Input validation
  if (!businessId) {
    console.error('[getBusinessDetails] businessId is missing or empty');
    return { data: null, error: new Error('Business ID is required') };
  }

  if (typeof businessId !== 'string') {
    console.error('[getBusinessDetails] businessId must be a string, got:', typeof businessId);
    return { data: null, error: new Error('Business ID must be a string') };
  }

  // UUID format validation (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(businessId)) {
    console.error('[getBusinessDetails] businessId is not a valid UUID format:', businessId);
    return { data: null, error: new Error('Business ID must be a valid UUID') };
  }

  console.log(`[getBusinessDetails] Fetching details for businessId: ${businessId}`);

  try {
    const { data, error } = await vendorBusinessApi.getVendorBusiness(businessId);

    if (error) {
      console.error(`[getBusinessDetails] API error for businessId ${businessId}:`, error);
      return { data: null, error: new Error(error.error || 'Failed to fetch business details') };
    }

    console.log(`[getBusinessDetails] Successfully fetched details for businessId: ${businessId}`);

    // Normalize null/undefined to null safely
    return { data: data ?? null, error: null };
  } catch (err: any) {
    console.error(`[getBusinessDetails] Unexpected error for businessId ${businessId}:`, err);
    return { data: null, error: new Error(err?.message || 'An unexpected error occurred') };
  }
};

export const updateBusinessDetails = async (
  businessId: string,
  businessData: any
): Promise<{ data: any | null; error: Error | null }> => {
  const { data, error } = await vendorBusinessApi.updateVendorBusiness({ business_id: businessId, ...businessData });
  if (error) return { data: null, error: new Error(error.error) };
  return { data: data ?? null, error: null };
};

export const pickImage = async (): Promise<{
  uri: string | null;
  error: Error | null;
}> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Photo Library access is required. Go to Settings > Apps > BookMyVendors Business > Permissions > Photos to enable.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) {
      return { uri: null, error: null };
    }

    return { uri: result.assets[0].uri, error: null };
  } catch (error) {
    return { uri: null, error: error as Error };
  }
};

export const pickMultipleImages = async (): Promise<{
  uris: string[];
  error: Error | null;
}> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Photo Library access is required. Go to Settings > Apps > BookMyVendors Business > Permissions > Photos to enable.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as any,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) {
      return { uris: [], error: null };
    }

    const uris = result.assets.map((asset) => asset.uri);
    return { uris, error: null };
  } catch (error) {
    return { uris: [], error: error as Error };
  }
};

// Verification Document Interfaces
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

export interface UploadDocumentData {
  documentTypeCode: string;
  file: DocumentFile;
}

/**
 * Uploads a verification document for a business
 */
export const uploadVerificationDocument = async (
  businessId: string,
  documentTypeId: string,
  file: DocumentFile,
  _userId?: string
): Promise<{ data: VerificationDocument | null; error: Error | null }> => {
  const timestamp = new Date().toISOString();
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] START`);
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] businessId: ${businessId}`);
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] documentTypeId: ${documentTypeId}`);
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] file:`, { name: file.name, uri: file.uri?.substring(0, 50), size: file.size });
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] userId: ${_userId}`);
  
  const mimeType = file.type || getMimeType(file.uri, file.name);
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] mimeType: ${mimeType}`);
  
  if (!mimeType || !validateFileType(mimeType)) {
    console.error(`[businessApi.uploadVerificationDocument][${timestamp}] Invalid file type`);
    return { data: null, error: new Error('Invalid file type. Only images (jpg, png) and PDFs are allowed.') };
  }
  if (file.size && file.size > 10 * 1024 * 1024) {
    console.error(`[businessApi.uploadVerificationDocument][${timestamp}] File size exceeds 10MB`);
    return { data: null, error: new Error('File size exceeds 10MB limit') };
  }
  
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] Calling verificationApi.uploadVerificationDocument...`);
  const result = await verificationApi.uploadVerificationDocument(
    businessId, 
    documentTypeId, 
    file.uri, 
    file.name
  );
  
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] Result:`, {
    error: result.error ? result.error.error : null,
    dataId: result.data?.id
  });
  
  if (result.error) {
    console.error(`[businessApi.uploadVerificationDocument][${timestamp}] API error:`, result.error);
    return { data: null, error: new Error(result.error.error) };
  }
  console.log(`[businessApi.uploadVerificationDocument][${timestamp}] SUCCESS`);
  return { data: result.data || null, error: null };
};

/**
 * Uploads multiple verification documents for a business
 */
export const uploadMultipleVerificationDocuments = async (
  businessId: string,
  documents: UploadDocumentData[]
): Promise<{ data: VerificationDocument[]; errors: Error[] }> => {
  const results: VerificationDocument[] = [];
  const errors: Error[] = [];

  for (const doc of documents) {
    const { data, error } = await uploadVerificationDocument(
      businessId,
      doc.documentTypeCode,
      doc.file
    );

    if (error) {
      errors.push(error);
    } else if (data) {
      results.push(data);
    }
  }

  return { data: results, errors };
};

export const getBusinessVerificationDocuments = async (
  businessId: string
): Promise<{ data: VerificationDocument[] | null; error: Error | null }> => {
  const { data, error } = await verificationApi.getVerificationDocuments(businessId);
  if (error) return { data: null, error: new Error(error.error) };
  return { data: (data || []) as VerificationDocument[], error: null };
};

export const getDocumentTypes = async (): Promise<{ data: any[] | null; error: Error | null }> => {
  const { data, error } = await verificationApi.getDocumentTypes();
  if (error) return { data: null, error: new Error(error.error) };
  return { data: data || [], error: null };
};

export const deleteVerificationDocument = async (
  documentId: string
): Promise<{ error: Error | null }> => {
  const { error } = await verificationApi.deleteVerificationDocument(documentId);
  if (error) return { error: new Error(error.error) };
  return { error: null };
};

export const uploadOfferBanner = async (
  businessId: string,
  imageUri: string
): Promise<{ url: string | null; error: Error | null }> => {
  try {
    if (!validateImageUri(imageUri)) {
      throw new Error('Invalid image URI');
    }

    const { base64, error: compressionError } = await compressAndConvertToBase64(imageUri);
    if (compressionError) throw compressionError;
    if (!base64) throw new Error('Failed to process image');

    return { url: base64, error: null };
  } catch (error) {
    return { url: null, error: error as Error };
  }
};
