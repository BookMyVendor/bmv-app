import * as ImagePicker from 'expo-image-picker';
import { Platform, InteractionManager } from 'react-native';

export interface DocumentFile {
  uri: string;
  name?: string;
  type?: string;
  size?: number;
}

export interface PickDocumentResult {
  files: DocumentFile[];
  error: Error | null;
}

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Validates if a file type is allowed (images or PDFs)
 */
export const validateFileType = (mimeType: string | null | undefined): boolean => {
  if (!mimeType) return false;
  return ALLOWED_TYPES.includes(mimeType.toLowerCase());
};

/**
 * Validates if a file is an image
 */
export const isImageFile = (mimeType: string | null | undefined): boolean => {
  if (!mimeType) return false;
  return ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase());
};

/**
 * Validates if a file is a PDF
 */
export const isPdfFile = (mimeType: string | null | undefined): boolean => {
  return false; // PDF support disabled
};

/**
 * Gets MIME type from file URI or extension
 */
export const getMimeType = (uri: string, name?: string): string | null => {
  const lowerUri = uri.toLowerCase();
  const lowerName = (name || '').toLowerCase();

  // Check by extension
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerUri.includes('.jpg') || lowerUri.includes('.jpeg')) {
    return 'image/jpeg';
  }
  if (lowerName.endsWith('.png') || lowerUri.includes('.png')) {
    return 'image/png';
  }

  // Check by data URI
  if (uri.startsWith('data:')) {
    const mimeMatch = uri.match(/data:([^;]+)/);
    if (mimeMatch) {
      return mimeMatch[1];
    }
  }

  return null;
};

/**
 * Validates file size (max 10MB)
 */
export const validateFileSize = (size: number): boolean => {
  return size <= MAX_FILE_SIZE;
};

/**
 * Picks documents (images or PDFs) from device
 * Supports multiple file selection
 */
export const pickDocuments = async (allowMultiple: boolean = true): Promise<PickDocumentResult> => {
  try {
    if (Platform.OS === 'web') {
      return await pickDocumentsWeb(allowMultiple);
    }

    // For mobile, request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return {
        files: [],
        error: new Error('Photo Library access is required. Go to Settings > Apps > BookMyVendors Business > Permissions > Photos to enable.'),
      };
    }

    // On Android, a small delay after permission request can prevent "unregistered ActivityResultLauncher" errors
    if (Platform.OS === 'android') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Use only images as requested
      allowsMultipleSelection: allowMultiple,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) {
      return { files: [], error: null };
    }

    const files: DocumentFile[] = result.assets.map((asset) => {
      const mimeType = getMimeType(asset.uri, asset.fileName || undefined);

      return {
        uri: asset.uri,
        name: asset.fileName || undefined,
        type: mimeType || undefined,
        size: asset.fileSize || undefined,
      };
    });

    // Validate files
    const validFiles: DocumentFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!file.type || !validateFileType(file.type)) {
        errors.push(`${file.name || 'File'} is not a valid image (jpg, png)`);
        continue;
      }

      if (file.size && !validateFileSize(file.size)) {
        errors.push(`${file.name || 'File'} exceeds maximum size of 10MB`);
        continue;
      }

      validFiles.push(file);
    }

    if (errors.length > 0 && validFiles.length === 0) {
      return {
        files: [],
        error: new Error(errors.join('; ')),
      };
    }

    return {
      files: validFiles,
      error: errors.length > 0 ? new Error(errors.join('; ')) : null,
    };
  } catch (error) {
    return {
      files: [],
      error: error instanceof Error ? error : new Error('Failed to pick documents'),
    };
  }
};

/**
 * Web implementation for picking documents
 */
const pickDocumentsWeb = async (allowMultiple: boolean): Promise<PickDocumentResult> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png';
    input.multiple = allowMultiple;

    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const selectedFiles = target.files;

      if (!selectedFiles || selectedFiles.length === 0) {
        resolve({ files: [], error: null });
        return;
      }

      const files: DocumentFile[] = [];
      const errors: string[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const mimeType = file.type;

        if (!validateFileType(mimeType)) {
          errors.push(`${file.name} is not a valid image (jpg, png)`);
          continue;
        }

        if (!validateFileSize(file.size)) {
          errors.push(`${file.name} exceeds maximum size of 10MB`);
          continue;
        }

        // Convert to data URI for web
        try {
          const dataUri = await fileToDataUri(file);
          files.push({
            uri: dataUri,
            name: file.name,
            type: mimeType,
            size: file.size,
          });
        } catch (err) {
          errors.push(`Failed to process ${file.name}`);
        }
      }

      resolve({
        files,
        error: errors.length > 0 ? new Error(errors.join('; ')) : null,
      });
    };

    input.oncancel = () => {
      resolve({ files: [], error: null });
    };

    input.click();
  });
};

/**
 * Converts a File object to data URI (for web)
 */
const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to data URI'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Picks only images
 */
export const pickImages = async (allowMultiple: boolean = true): Promise<PickDocumentResult> => {
  try {
    if (Platform.OS === 'web') {
      return await pickImagesWeb(allowMultiple);
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return {
        files: [],
        error: new Error('Photo Library access is required. Go to Settings > Apps > BookMyVendors Business > Permissions > Photos to enable.'),
      };
    }

    // On Android, a small delay after permission request can prevent "unregistered ActivityResultLauncher" errors
    if (Platform.OS === 'android') {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Use array instead of MediaTypeOptions.Images
      allowsMultipleSelection: allowMultiple,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) {
      return { files: [], error: null };
    }

    const files: DocumentFile[] = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.fileName || undefined,
      type: getMimeType(asset.uri, asset.fileName || undefined) || 'image/jpeg',
      size: asset.fileSize || undefined,
    }));

    return { files, error: null };
  } catch (error) {
    return {
      files: [],
      error: error instanceof Error ? error : new Error('Failed to pick images'),
    };
  }
};

/**
 * Web implementation for picking images only
 */
const pickImagesWeb = async (allowMultiple: boolean): Promise<PickDocumentResult> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png';
    input.multiple = allowMultiple;

    input.onchange = async (e) => {
      const target = e.target as HTMLInputElement;
      const selectedFiles = target.files;

      if (!selectedFiles || selectedFiles.length === 0) {
        resolve({ files: [], error: null });
        return;
      }

      const files: DocumentFile[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (validateFileType(file.type) && isImageFile(file.type)) {
          try {
            const dataUri = await fileToDataUri(file);
            files.push({
              uri: dataUri,
              name: file.name,
              type: file.type,
              size: file.size,
            });
          } catch (err) {
            // Skip this file
          }
        }
      }

      resolve({ files, error: null });
    };

    input.oncancel = () => {
      resolve({ files: [], error: null });
    };

    input.click();
  });
};

