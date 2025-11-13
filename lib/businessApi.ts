import { supabaseCore, supabaseCms } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { compressAndConvertToBase64, validateImageUri } from './imageCompression';

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
  image_type?: string; // 'gallery', 'cover', or 'portfolio'
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

const MAX_IMAGES_PER_BUSINESS = 20;
const OFFER_BANNER_MAX_SIZE = 5 * 1024 * 1024;
const GALLERY_IMAGE_MAX_SIZE = 10 * 1024 * 1024;

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
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size <= maxSize;
  } catch (error) {
    console.error('Error validating image size:', error);
    return false;
  }
};

export const uploadImageToStorage = async (
  uri: string,
  bucket: string,
  path: string
): Promise<{ data: { path: string } | null; error: Error | null }> => {
  try {
    if (!uri || typeof uri !== 'string') {
      throw new Error('Invalid file URI provided');
    }

    const file = new File(uri);
    const fileInfo = await file.info();

    if (!fileInfo.exists) {
      throw new Error('File does not exist at the provided URI');
    }

    const base64Data = await file.base64();

    if (!base64Data) {
      throw new Error('Failed to read file data');
    }

    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${path}.${fileExt}`;
    const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    const { data, error } = await supabaseCore.storage
      .from(bucket)
      .upload(fileName, byteArray, {
        contentType,
        upsert: true,
      });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Upload error:', error);
    return { data: null, error: error as Error };
  }
};

export const getPublicUrl = (bucket: string, path: string): string => {
  const { data } = supabaseCore.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteImageFromStorage = async (
  bucket: string,
  path: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabaseCore.storage.from(bucket).remove([path]);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
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

    const { data, error } = await supabaseCore
      .from('vendor_business_offers')
      .insert(offerData)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const getOffers = async (
  businessId: string
): Promise<{ data: Offer[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabaseCore
      .from('vendor_business_offers')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
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

    if (offerData.valid_until) {
      const validUntil = new Date(offerData.valid_until);
      if (validUntil < new Date()) {
        throw new Error('Expiry date must be in the future');
      }
    }

    const { data, error } = await supabaseCore
      .from('vendor_business_offers')
      .update(offerData)
      .eq('id', offerId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const deleteOffer = async (
  offerId: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabaseCore.from('vendor_business_offers').delete().eq('id', offerId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};

export const getBusinessImages = async (
  businessId: string
): Promise<{ data: PortfolioImage[] | null; error: Error | null }> => {
  try {
    const { data, error } = await supabaseCms
      .from('vendor_business_media')
      .select(`
        *,
        file_storage:file_id (
          file_path,
          storage_bucket
        )
      `)
      .eq('business_id', businessId)
      .in('image_type', ['gallery', 'cover', 'portfolio'])
      .order('sort_order', { ascending: true });

    if (error) throw error;
    
    // Transform data to match PortfolioImage interface
    const transformedData = data?.map((item: any) => ({
      id: item.id,
      business_id: item.business_id,
      image_url: item.file_storage ? getPublicUrl(item.file_storage.storage_bucket, item.file_storage.file_path) : null,
      image_base64: null, // No longer stored as base64
      display_order: item.sort_order,
      created_at: item.created_at,
      image_type: item.image_type || 'gallery',
    })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const uploadBusinessImage = async (
  businessId: string,
  imageUri: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  try {
    console.log('uploadBusinessImage: Starting upload for business:', businessId);
    const { data: existingImages } = await getBusinessImages(businessId);
    if (existingImages && existingImages.length >= MAX_IMAGES_PER_BUSINESS) {
      throw new Error(
        `Maximum ${MAX_IMAGES_PER_BUSINESS} images allowed per business`
      );
    }

    if (!validateImageUri(imageUri)) {
      throw new Error('Invalid image URI');
    }

    console.log('uploadBusinessImage: Compressing image...');
    const { base64, error: compressionError } = await compressAndConvertToBase64(imageUri);
    if (compressionError) {
      console.error('uploadBusinessImage: Compression error:', compressionError);
      throw compressionError;
    }
    if (!base64) throw new Error('Failed to process image');
    console.log('uploadBusinessImage: Image compressed, base64 length:', base64.length);

    // Extract base64 string from data URI (remove "data:image/jpeg;base64," prefix)
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

    // Convert base64 to blob for upload
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `business-${businessId}-${Date.now()}.${fileExt}`;
    const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    // Step 1: Upload to storage
    console.log('uploadBusinessImage: Uploading to storage, fileName:', fileName);
    const { data: uploadData, error: uploadError } = await supabaseCore.storage
      .from('vendor-media')
      .upload(fileName, byteArray, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('uploadBusinessImage: Storage upload error:', uploadError);
      throw uploadError;
    }
    if (!uploadData) throw new Error('Upload failed');
    console.log('uploadBusinessImage: Storage upload successful, path:', uploadData.path);

    // Step 2: Create file_storage record
    console.log('uploadBusinessImage: Creating file_storage record...');
    const { data: fileData, error: fileError } = await supabaseCms
      .from('file_storage')
      .insert({
        original_filename: fileName,
        stored_filename: fileName,
        file_path: uploadData.path,
        file_size: byteArray.length,
        mime_type: contentType,
        file_extension: fileExt,
        storage_provider: 'supabase',
        storage_bucket: 'vendor-media',
        upload_status: 'completed',
        uploaded_by_type: 'vendor',
        uploaded_by_id: businessId, // Using businessId as uploaded_by_id
      })
      .select()
      .single();

    if (fileError) {
      console.error('uploadBusinessImage: file_storage insert error:', fileError);
      throw fileError;
    }
    if (!fileData) throw new Error('Failed to create file record');
    console.log('uploadBusinessImage: file_storage record created, id:', fileData.id);

    // Step 3: Create vendor_business_media record
    const nextOrder = existingImages ? existingImages.length : 0;
    console.log('uploadBusinessImage: Creating vendor_business_media record...');
    const { data: mediaData, error: mediaError } = await supabaseCms
      .from('vendor_business_media')
      .insert({
        business_id: businessId,
        file_id: fileData.id,
        image_type: 'gallery',
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (mediaError) {
      console.error('uploadBusinessImage: vendor_business_media insert error:', mediaError);
      throw mediaError;
    }
    if (!mediaData) throw new Error('Failed to create media record');
    console.log('uploadBusinessImage: vendor_business_media record created, id:', mediaData.id);

    // Return transformed data
    const imageUrl = getPublicUrl('vendor-media', uploadData.path);
    return {
      data: {
        id: mediaData.id,
        business_id: businessId,
        image_url: imageUrl,
        image_base64: null,
        display_order: nextOrder,
        created_at: mediaData.created_at,
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as Error };
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

    for (let i = 0; i < imageUris.length; i++) {
      const imageUri = imageUris[i];
      onProgress?.(i + 1, imageUris.length);

      try {
        if (!validateImageUri(imageUri)) {
          results.push({
            success: false,
            error: 'Invalid image URI',
          });
          continue;
        }

        const { base64, error: compressionError } = await compressAndConvertToBase64(imageUri);
        if (compressionError) {
          results.push({
            success: false,
            error: compressionError.message,
          });
          continue;
        }

        if (!base64) {
          results.push({
            success: false,
            error: 'Failed to process image',
          });
          continue;
        }

        // Extract base64 string from data URI (remove "data:image/jpeg;base64," prefix)
        const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

        // Convert base64 to blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `business-${businessId}-${Date.now()}-${i}.${fileExt}`;
        const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabaseCore.storage
          .from('vendor-media')
          .upload(fileName, byteArray, {
            contentType,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        if (!uploadData) throw new Error('Upload failed');

        // Create file_storage record
        const { data: fileData, error: fileError } = await supabaseCms
          .from('file_storage')
          .insert({
            original_filename: fileName,
            stored_filename: fileName,
            file_path: uploadData.path,
            file_size: byteArray.length,
            mime_type: contentType,
            file_extension: fileExt,
            storage_provider: 'supabase',
            storage_bucket: 'vendor-media',
            upload_status: 'completed',
            uploaded_by_type: 'vendor',
            uploaded_by_id: businessId,
          })
          .select()
          .single();

        if (fileError) throw fileError;
        if (!fileData) throw new Error('Failed to create file record');

        // Create vendor_business_media record
        const nextOrder = currentCount + successCount;

        const { data: mediaData, error: mediaError } = await supabaseCms
          .from('vendor_business_media')
          .insert({
            business_id: businessId,
            file_id: fileData.id,
            image_type: 'gallery',
            sort_order: nextOrder,
          })
          .select()
          .single();

        if (mediaError) throw mediaError;

        const imageUrl = getPublicUrl('vendor-media', uploadData.path);
        results.push({
          success: true,
          imageUrl: imageUrl,
        });
        successCount++;
      } catch (error: any) {
        results.push({
          success: false,
          error: error.message || 'Failed to upload image',
        });
      }
    }

    return { results, successCount, error: null };
  } catch (error) {
    return { results, successCount, error: error as Error };
  }
};

export const deleteBusinessImage = async (
  imageId: string
): Promise<{ error: Error | null }> => {
  try {
    // First get the media record to find file_id
    const { data: mediaData, error: fetchError } = await supabaseCms
      .from('vendor_business_media')
      .select('file_id')
      .eq('id', imageId)
      .single();

    if (fetchError) throw fetchError;

    // Delete the media record (this should cascade delete the file_storage record)
    const { error } = await supabaseCms
      .from('vendor_business_media')
      .delete()
      .eq('id', imageId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};

export const setCoverImage = async (
  businessId: string,
  imageId: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  try {
    // First, get the image to find its file_storage info
    const { data: mediaData, error: fetchError } = await supabaseCms
      .from('vendor_business_media')
      .select(`
        *,
        file_storage:file_id (
          file_path,
          storage_bucket
        )
      `)
      .eq('id', imageId)
      .eq('business_id', businessId)
      .single();

    if (fetchError) throw fetchError;
    if (!mediaData) throw new Error('Image not found');

    // Get the image URL
    const imageUrl = mediaData.file_storage
      ? getPublicUrl(mediaData.file_storage.storage_bucket, mediaData.file_storage.file_path)
      : null;

    // Step 1: Set all other cover images back to gallery
    const { error: updateOtherError } = await supabaseCms
      .from('vendor_business_media')
      .update({ image_type: 'gallery' })
      .eq('business_id', businessId)
      .eq('image_type', 'cover')
      .neq('id', imageId);

    if (updateOtherError) throw updateOtherError;

    // Step 2: Set this image as cover
    const { data: updatedMedia, error: updateError } = await supabaseCms
      .from('vendor_business_media')
      .update({ image_type: 'cover' })
      .eq('id', imageId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Step 3: Update cover_photo_url in vendor_businesses
    const { error: businessUpdateError } = await supabaseCore
      .from('vendor_businesses')
      .update({ cover_photo_url: imageUrl })
      .eq('id', businessId);

    if (businessUpdateError) throw businessUpdateError;

    return {
      data: {
        id: updatedMedia.id,
        business_id: businessId,
        image_url: imageUrl,
        image_base64: null,
        display_order: updatedMedia.sort_order,
        created_at: updatedMedia.created_at,
        image_type: 'cover',
      },
      error: null,
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const getBusinessDetails = async (
  businessId: string
): Promise<{ data: any | null; error: Error | null }> => {
  try {
    const { data, error } = await supabaseCore
      .from('vendor_businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const updateBusinessDetails = async (
  businessId: string,
  businessData: any
): Promise<{ data: any | null; error: Error | null }> => {
  try {
    const { data, error } = await supabaseCore
      .from('vendor_businesses')
      .update(businessData)
      .eq('id', businessId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const pickImage = async (): Promise<{
  uri: string | null;
  error: Error | null;
}> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library is required');
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
      throw new Error('Permission to access media library is required');
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
