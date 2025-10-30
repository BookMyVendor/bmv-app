import { supabase } from './supabase';
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

    const { data, error } = await supabase.storage
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
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteImageFromStorage = async (
  bucket: string,
  path: string
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
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

    const { data, error } = await supabase
      .from('offers')
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
    const { data, error } = await supabase
      .from('offers')
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

    const { data, error } = await supabase
      .from('offers')
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
    const { error } = await supabase.from('offers').delete().eq('id', offerId);

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
    const { data, error } = await supabase
      .from('business_portfolio')
      .select('*')
      .eq('business_id', businessId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
};

export const uploadBusinessImage = async (
  businessId: string,
  imageUri: string
): Promise<{ data: PortfolioImage | null; error: Error | null }> => {
  try {
    const { data: existingImages } = await getBusinessImages(businessId);
    if (existingImages && existingImages.length >= MAX_IMAGES_PER_BUSINESS) {
      throw new Error(
        `Maximum ${MAX_IMAGES_PER_BUSINESS} images allowed per business`
      );
    }

    if (!validateImageUri(imageUri)) {
      throw new Error('Invalid image URI');
    }

    const { base64, error: compressionError } = await compressAndConvertToBase64(imageUri);
    if (compressionError) throw compressionError;
    if (!base64) throw new Error('Failed to process image');

    const nextOrder = existingImages ? existingImages.length : 0;

    const { data, error } = await supabase
      .from('business_portfolio')
      .insert({
        business_id: businessId,
        image_url: null,
        image_base64: base64,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
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

        const nextOrder = currentCount + successCount;

        const { data, error } = await supabase
          .from('business_portfolio')
          .insert({
            business_id: businessId,
            image_url: null,
            image_base64: base64,
            display_order: nextOrder,
          })
          .select()
          .single();

        if (error) throw error;

        results.push({
          success: true,
          imageUrl: base64,
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
    const { error } = await supabase
      .from('business_portfolio')
      .delete()
      .eq('id', imageId);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error: error as Error };
  }
};

export const getBusinessDetails = async (
  businessId: string
): Promise<{ data: any | null; error: Error | null }> => {
  try {
    const { data, error } = await supabase
      .from('businesses')
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
    const { data, error } = await supabase
      .from('businesses')
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
