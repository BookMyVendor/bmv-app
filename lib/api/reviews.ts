import { functionsCall } from '../apiClient';

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

/** Spec: reviews-list { business_id?, limit?, offset? } */
export async function getReviews(params?: { business_id?: string; limit?: number; offset?: number }) {
  const body: Record<string, unknown> = {};
  if (params?.business_id) body.business_id = params.business_id;
  if (params?.limit !== undefined) body.limit = params.limit;
  if (params?.offset !== undefined) body.offset = params.offset;
  return functionsCall<Review[]>('reviews-list', body, 'reviews');
}

/** Spec: review-update { review_id, vendor_response?, vendor_response_date? } */
export async function updateReview(id: string, body: { vendor_response?: string; vendor_response_date?: string }) {
  return functionsCall<Review>('review-update', { review_id: id, ...body } as Record<string, unknown>, 'review');
}
