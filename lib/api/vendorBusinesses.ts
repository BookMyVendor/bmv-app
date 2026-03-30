import { functionsCall } from '../apiClient';

export interface VendorBusiness {
  id: string;
  vendor_id: string;
  business_name: string;
  description?: string | null;
  cover_photo_url?: string | null;
  [key: string]: unknown;
}

export interface VendorBusinessWithCategory extends VendorBusiness {
  vendor_business_category_mappings?: { categories?: { name: string } }[];
  business_description?: string;
  business_category?: string;
}

export async function getVendorBusinesses(_vendorId?: string) {
  const res = await functionsCall<VendorBusinessWithCategory[]>('vendor-businesses-list', { limit: 100 }, 'vendor_businesses');
  return res;
}

export async function getVendorBusiness(id: string) {
  const res = await functionsCall<VendorBusiness>('vendor-businesses-get', { business_id: id }, 'vendor_business');
  return res;
}

/** Spec uses "name"; we accept business_name and map. */
export async function createVendorBusiness(body: Record<string, unknown>) {
  const payload = { ...body };
  if (payload.business_name !== undefined && payload.name === undefined) {
    payload.name = payload.business_name;
  }
  const res = await functionsCall<VendorBusiness>('vendor-businesses-create', payload as Record<string, unknown>, 'vendor_business');
  return res;
}

export async function updateVendorBusiness(id: string, body: Record<string, unknown>) {
  const res = await functionsCall<VendorBusiness>('vendor-businesses-update', { business_id: id, ...body } as Record<string, unknown>, 'vendor_business');
  return res;
}
