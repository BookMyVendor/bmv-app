import { axiosFunctionsCall } from '../axiosClient';

export interface Offer {
  id: string;
  business_id: string;
  title: string;
  description: string;
  banner_image_url: string | null;
  [key: string]: unknown;
}

/** Spec: vendor-businesses-offers-list { business_id } */
export async function getOffers(businessId: string) {
  console.log('[getOffers] Request - Function: vendor-businesses-offers-list');
  console.log('[getOffers] Request - Payload:', JSON.stringify({ business_id: businessId }, null, 2));
  const result = await axiosFunctionsCall<Offer[]>('vendor-businesses-offers-list', { business_id: businessId }, 'offers');
  console.log('[getOffers] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[getOffers] Response - Data:', result.data ? JSON.stringify(result.data, null, 2).substring(0, 1000) + '...' : null);
  return result;
}

/** Spec: vendor-businesses-offers-create { business_id, title?, description?, ... } */
export async function createOffer(businessId: string, body: Record<string, unknown>) {
  const payload = { business_id: businessId, ...body };
  console.log('[createOffer] Request - Function: vendor-businesses-offers-create');
  console.log('[createOffer] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<Offer>('vendor-businesses-offers-create', payload as Record<string, unknown>, 'offer');
  console.log('[createOffer] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[createOffer] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}

/** Spec: offer-update { offer_id, title?, description?, ... } */
export async function updateOffer(id: string, body: Record<string, unknown>) {
  const payload = { offer_id: id, ...body };
  console.log('[updateOffer] Request - Function: offer-update');
  console.log('[updateOffer] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<Offer>('offer-update', payload as Record<string, unknown>, 'offer');
  console.log('[updateOffer] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[updateOffer] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}

/** Spec: offer-delete { offer_id } */
export async function deleteOffer(id: string) {
  const payload = { offer_id: id };
  console.log('[deleteOffer] Request - Function: offer-delete');
  console.log('[deleteOffer] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<void>('offer-delete', payload);
  console.log('[deleteOffer] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[deleteOffer] Response - Data:', result.data);
  return result;
}
