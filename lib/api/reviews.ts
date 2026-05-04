import { axiosFunctionsCall } from '../axiosClient';
import { getApiBaseUrl } from '../apiConfig';

export interface Review {
  id: string;
  business_id?: string | null;
  rating?: number;
  review_text?: string | null;
  review_title?: string | null;
  status?: string;
  vendor_response?: string | null;
  vendor_response_date?: string | null;
  created_at: string;
  customers?: { name?: string } | null;
  customer_leads?: { template_id?: string; sub_template_id?: string } | null;
  mediaItems?: { url: string; mimeType?: string }[];
  [key: string]: unknown;
}

interface FileStorageUrlResponse {
  file_id: string;
  url: string;
}

/** Get public URL for a file_storage record, converting relative paths to full URLs */
async function getFileStorageUrl(fileId: string): Promise<string | null> {
  const { data, error } = await axiosFunctionsCall<FileStorageUrlResponse>('file-storage-url', { file_id: fileId });
  if (error || !data) {
    console.error(`[getFileStorageUrl] Failed to get URL for ${fileId}:`, error);
    return null;
  }

  let url = data.url;
  if (!url) return null;

  // If URL is relative (starts with /), prepend base API URL
  if (url.startsWith('/')) {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    url = `${base}${url}`;
    console.log(`[getFileStorageUrl] Converted relative path to full URL:`, { fileId, fullUrl: url });
  }

  return url;
}

/** Spec: reviews-list { business_id?, limit?, offset? } */
export async function getReviews(params?: { business_id?: string; limit?: number; offset?: number }) {
  const body: Record<string, unknown> = {};
  if (params?.business_id) body.business_id = params.business_id;
  if (params?.limit !== undefined) body.limit = params.limit;
  if (params?.offset !== undefined) body.offset = params.offset;

  const { data, error } = await axiosFunctionsCall<Review[]>('reviews-list', body, 'reviews');
  if (error || !data) {
    return { data, error };
  }

  // Resolve file_ids to URLs for all reviews with media
  const reviewsWithMedia = data.map(review => ({ ...review, mediaItems: [] as { url: string; mimeType?: string }[] }));
  const fileIdToReviewMap = new Map<string, { reviewIndex: number; mimeType?: string }[]>();

  // Collect all file_ids from media array
  reviewsWithMedia.forEach((review, reviewIndex) => {
    const media = (review as any).media as { file_id: string; mime_type?: string }[] | undefined;
    if (media && media.length > 0) {
      media.forEach(m => {
        if (!fileIdToReviewMap.has(m.file_id)) {
          fileIdToReviewMap.set(m.file_id, []);
        }
        fileIdToReviewMap.get(m.file_id)!.push({ reviewIndex, mimeType: m.mime_type });
      });
    }
  });

  // Fetch URLs for all unique file_ids in parallel
  if (fileIdToReviewMap.size > 0) {
    const fileIds = Array.from(fileIdToReviewMap.keys());
    const urlPromises = fileIds.map(async (fileId) => {
      const url = await getFileStorageUrl(fileId);
      return { fileId, url };
    });

    const urlResults = await Promise.all(urlPromises);

    // Map URLs back to reviews
    urlResults.forEach(({ fileId, url }) => {
      if (url) {
        const reviewEntries = fileIdToReviewMap.get(fileId);
        if (reviewEntries) {
          reviewEntries.forEach(({ reviewIndex, mimeType }) => {
            reviewsWithMedia[reviewIndex].mediaItems!.push({ url, mimeType });
          });
        }
      }
    });
  }

  return { data: reviewsWithMedia, error };
}

/** Spec: review-update { review_id, vendor_response?, vendor_response_date? } */
export async function updateReview(id: string, body: { vendor_response?: string; vendor_response_date?: string }) {
  return axiosFunctionsCall<Review>('review-update', { review_id: id, ...body } as Record<string, unknown>, 'review');
}
