import { functionsCall } from '../apiClient';

export interface VendorBusiness {
  id: string;
  vendor_id: string;
  name: string;
  business_name?: string; // Alias for compatibility with older components
  slug?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  status?: string;
  cover_image_file_id?: string;
  logo_file_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListBusinessesRequest {
  limit?: number;
  offset?: number;
}

/** Lists vendor businesses — wraps vendor-businesses-list. */
export async function getVendorBusinesses(paramsOrVendorId?: ListBusinessesRequest | string) {
  // Spec now relies on Bearer (vendor), so vendorId passed as string is ignored.
  const params = typeof paramsOrVendorId === 'object' ? paramsOrVendorId : { limit: 50 };
  return functionsCall<VendorBusiness[]>('vendor-businesses-list', params as any, 'vendor_businesses');
}

/** Gets a single business — wraps vendor-businesses-get. */
export async function getVendorBusiness(businessId: string) {
  return functionsCall<VendorBusiness>('vendor-businesses-get', { business_id: businessId }, 'vendor_business');
}

export interface CreateBusinessRequest {
  name?: string;
  business_name?: string; // Compatibility
  slug?: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  status?: string;
}

/** Creates a business — wraps vendor-businesses-create. Adds compatibility for business_name. */
export async function createVendorBusiness(body: CreateBusinessRequest | Record<string, any>) {
  const payload = { ...body };
  if (payload.business_name && !payload.name) {
    payload.name = payload.business_name;
  }
  return functionsCall<VendorBusiness>('vendor-businesses-create', payload as any, 'vendor_business');
}

export interface UpdateBusinessRequest extends Partial<CreateBusinessRequest> {
  business_id?: string;
  cover_image_file_id?: string;
  logo_file_id?: string;
}

/** Updates a business — wraps vendor-businesses-update. Handles both (body) and (id, body) signatures. */
export async function updateVendorBusiness(bodyOrId: UpdateBusinessRequest | string, maybeBody?: Partial<UpdateBusinessRequest>) {
  let payload: any;
  if (typeof bodyOrId === 'string') {
    payload = { business_id: bodyOrId, ...maybeBody };
  } else {
    payload = bodyOrId;
  }
  return functionsCall<VendorBusiness>('vendor-businesses-update', payload as any, 'vendor_business');
}
