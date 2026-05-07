import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';

const MAX_BASE64_SIZE = 500000;
const MAX_IMAGE_WIDTH = 800;
const COMPRESSION_QUALITY = 0.6;

export interface CompressionResult {
  base64: string | null;
  error: Error | null;
}

export const compressAndConvertToBase64 = async (
  uri: string
): Promise<CompressionResult> => {
  try {
    let imageUri = uri;

    // Handle blob URLs by converting them to data URIs
    if (uri.startsWith('blob:')) {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('Failed to convert blob to data URI'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        imageUri = dataUri;
      } catch (blobError) {
        return {
          base64: null,
          error: blobError instanceof Error 
            ? blobError 
            : new Error('Failed to process blob URL'),
        };
      }
    }

    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: MAX_IMAGE_WIDTH } }],
      {
        compress: COMPRESSION_QUALITY,
        format: SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipResult.base64) {
      throw new Error('Failed to generate base64 from image');
    }

    const base64WithPrefix = `data:image/jpeg;base64,${manipResult.base64}`;

    if (base64WithPrefix.length > MAX_BASE64_SIZE) {
      const sizeKB = Math.round(base64WithPrefix.length / 1024);
      throw new Error(
        `Image is too large after compression (${sizeKB}KB). ` +
          `Please use a smaller image or lower resolution. Maximum size is ~500KB.`
      );
    }

    return { base64: base64WithPrefix, error: null };
  } catch (error) {
    return {
      base64: null,
      error:
        error instanceof Error ? error : new Error('Unknown compression error'),
    };
  }
};

export const validateImageUri = (uri: string): boolean => {
  if (!uri || typeof uri !== 'string') {
    return false;
  }

  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library://') ||
    uri.startsWith('data:image/') ||
    uri.startsWith('blob:')
  );
};

export const isBase64Image = (source: string | null | undefined): boolean => {
  if (!source) return false;
  return source.startsWith('data:image/');
};

export const getImageSizeKB = (base64: string): number => {
  return Math.round(base64.length / 1024);
};
