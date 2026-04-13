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
      const info = await FileSystem.getInfoAsync(uri, { size: true });
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
  const { data, error } = await mediaApi.getBusinessMedia(businessId);
  if (error) return { data: null, error: new Error(error.error) };
  const transformedData = (data || []).map((item: any) => ({
    id: item.id,
    business_id: item.business_id,
    image_url: item.image_url ?? null,
    image_base64: null,
    display_order: item.display_order ?? item.sort_order ?? 0,
    created_at: item.created_at,
    image_type: item.image_type || 'gallery',
  }));
  return { data: transformedData, error: null };
};

export const uploadBusinessImage = async (
  businessId: string,
  imageUri: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  try {
    const { data: existingImages } = await getBusinessImages(businessId);
    if (existingImages && existingImages.length >= MAX_IMAGES_PER_BUSINESS) {
      throw new Error(`Maximum ${MAX_IMAGES_PER_BUSINESS} images allowed per business`);
    }
    if (!validateImageUri(imageUri)) throw new Error('Invalid image URI');
    const stripped = imageUri.split('?')[0].split('#')[0];
    const extractedExt = stripped.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(extractedExt) ? extractedExt : 'jpg';
    const result = await mediaApi.uploadBusinessImage(
      businessId,
      imageUri,
      `business-${businessId}-${Date.now()}.${safeExt}`
    );
    if (result.error) throw new Error(result.error.error);
    if (!result.data) throw new Error('Upload failed');
    return {
      data: {
        id: result.data.id,
        business_id: businessId,
        image_url: result.data.image_url ?? null,
        image_base64: null,
        display_order: result.data.display_order ?? 0,
        created_at: result.data.created_at,
        image_type: result.data.image_type || 'gallery',
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const uploadBusinessVideo = async (
  businessId: string,
  videoUri: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  try {
    const { data: existingMedia } = await getBusinessImages(businessId);
    
    // Check video limit
    const existingVideos = existingMedia?.filter(img => img.image_type === 'video') || [];
    if (existingVideos.length >= MAX_VIDEOS_PER_BUSINESS) {
      throw new Error(`Maximum ${MAX_VIDEOS_PER_BUSINESS} videos allowed per business`);
    }

    // Prepare form data
    const fileExt = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    const result = await mediaApi.uploadBusinessImage(businessId, videoUri, `business-video-${businessId}-${Date.now()}.${fileExt}`);
    
    if (result.error) throw new Error(result.error.error);
    if (!result.data) throw new Error('Upload failed');

    return {
      data: {
        id: result.data.id,
        business_id: businessId,
        image_url: result.data.image_url ?? null,
        image_base64: null,
        display_order: result.data.display_order ?? 0,
        created_at: result.data.created_at,
        image_type: result.data.image_type || 'video',
      },
      error: null,
    };
  } catch (error) {
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
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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
  const results: UploadResult[] = [];
  let successCount = 0;
  try {
    const { data: existingImages } = await getBusinessImages(businessId);
    const currentCount = existingImages?.length || 0;
    const availableSlots = MAX_IMAGES_PER_BUSINESS - currentCount;
    if (imageUris.length > availableSlots) {
      throw new Error(
        `Can only upload ${availableSlots} more images. Current: ${currentCount}/${MAX_IMAGES_PER_BUSINESS}`
      );
    }

    const hasCover = existingImages?.some(img => img.image_type === 'cover');
    let coverFound = hasCover;

    for (let i = 0; i < imageUris.length; i++) {
      onProgress?.(i + 1, imageUris.length);
      const { data, error } = await uploadBusinessImage(businessId, imageUris[i]);
      if (error) {
        results.push({ success: false, error: error.message });
      } else if (data?.image_url) {
        results.push({ success: true, imageUrl: data.image_url });
        successCount++;
      } else {
        results.push({ success: false, error: 'Upload failed' });
      }
    }
    return { results, successCount, error: null };
  } catch (error) {
    return { results, successCount, error: error as Error };
  }
};

export const deleteBusinessImage = async (
  imageId: string,
  businessId: string
): Promise<{ error: Error | null }> => {
  const { error } = await mediaApi.deleteBusinessImage(businessId, imageId);
  if (error) return { error: new Error(error.error) };
  return { error: null };
};

export const setCoverImage = async (
  businessId: string,
  imageId: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  const { data, error } = await mediaApi.setCoverImage(businessId, imageId);
  if (error) return { data: null, error: new Error(error.error) };
  const d = data as any;
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
  documentTypeCode: string,
  file: DocumentFile,
  _userId?: string
): Promise<{ data: VerificationDocument | null; error: Error | null }> => {
  const mimeType = file.type || getMimeType(file.uri, file.name);
  if (!mimeType || !validateFileType(mimeType)) {
    return { data: null, error: new Error('Invalid file type. Only images (jpg, png) and PDFs are allowed.') };
  }
  if (file.size && file.size > 10 * 1024 * 1024) {
    return { data: null, error: new Error('File size exceeds 10MB limit') };
  }
  const formData = new FormData();
  formData.append('documentTypeCode', documentTypeCode);
  formData.append('file', { uri: file.uri, name: file.name || 'document', type: mimeType } as any);
  const result = await verificationApi.uploadVerificationDocument(businessId, formData);
  if (result.error) return { data: null, error: new Error(result.error.error) };
  return { data: (result.data as any) ?? null, error: null };
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
