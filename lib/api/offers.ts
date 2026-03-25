import { functionsCall } from '../apiClient';

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
  return functionsCall<Offer[]>('vendor-businesses-offers-list', { business_id: businessId }, 'offers');
}

/** Spec: vendor-businesses-offers-create { business_id, title?, description?, ... } */
export async function createOffer(businessId: string, body: Record<string, unknown>) {
  return functionsCall<Offer>('vendor-businesses-offers-create', { business_id: businessId, ...body } as Record<string, unknown>, 'offer');
}

/** Spec: offer-update { offer_id, title?, description?, ... } */
export async function updateOffer(id: string, body: Record<string, unknown>) {
  return functionsCall<Offer>('offer-update', { offer_id: id, ...body } as Record<string, unknown>, 'offer');
}

/** Spec: offer-delete { offer_id } */
export async function deleteOffer(id: string) {
  return functionsCall<void>('offer-delete', { offer_id: id });
}
