import { axiosFunctionsCall, axiosMultipartUpload } from '../axiosClient';

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
  category_ids?: string[];
  primary_category_id?: string;
  specialization_category_ids?: string[];
  event_category_ids?: string[];
  business_registration_number?: string;
  gst_number?: string;
  youtube_url?: string;
  created_at?: string;
  updated_at?: string;
  // Contact fields
  contact_person_name?: string;
  contact_name?: string;
  contact_person_phone?: string;
  contact_phone?: string;
  business_email?: string;
  // Operating locations
  operating_locations?: string[];
  availability?: string[];
  cities?: string[];
  service_locations?: string[];
  // Category display fields
  business_category?: string;
  primary_category_name?: string;
  category_name?: string;
  // Nested vendor data
  vendor?: {
    first_name?: string;
    last_name?: string;
  };
}

export interface ListBusinessesRequest {
  limit?: number;
  offset?: number;
}

/** Lists vendor businesses — wraps vendor-businesses-list. */
export async function getVendorBusinesses(paramsOrVendorId?: ListBusinessesRequest | string) {
  // Spec now relies on Bearer (vendor), so vendorId passed as string is ignored.
  const params = typeof paramsOrVendorId === 'object' ? paramsOrVendorId : { limit: 50 };
  const result = await axiosFunctionsCall<any>('vendor-businesses-list', params as any, 'vendor_businesses');
  let payload = result.data;

  // Handle case where API returns { vendor_businesses: { rowCount, rows: [...] } }
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.rows) {
    payload = payload.rows;
  }

  console.log('[getVendorBusinesses] RAW result:', {
    hasError: !!result.error,
    error: result.error,
    payloadType: typeof payload,
    isArray: Array.isArray(payload),
    payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : null,
    payload: payload, // Full payload
  });

  if (!payload) {
    return { data: [], error: result.error };
  }

  let list: any[];
  if (Array.isArray(payload)) {
    list = payload;
  } else {
    // Fallback for object-shaped responses from different backend versions.
    const candidateArrays = [
      payload.vendor_businesses,
      payload.businesses,
      payload.items,
      payload.data,
      payload.results,
    ];
    const foundList = candidateArrays.find((value) => Array.isArray(value));
    list = foundList || [];
  }

  console.log('[getVendorBusinesses] Extracted list:', {
    listLength: list.length,
    firstItemKeys: list.length > 0 ? Object.keys(list[0]) : null,
  });

  // DEBUG: Log first business fields to understand API response
  if (list.length > 0) {
    const firstBiz = list[0];
    console.log(`[getVendorBusinesses] DEBUG - First business FULL:`, JSON.stringify(firstBiz, null, 2));
    console.log(`[getVendorBusinesses] DEBUG - First business keys:`, Object.keys(firstBiz));
    console.log(`[getVendorBusinesses] DEBUG - Category data:`, {
      business_category: firstBiz.business_category,
      primary_category_id: firstBiz.primary_category_id,
      category_ids: firstBiz.category_ids,
      vendor_business_category_mappings: firstBiz.vendor_business_category_mappings,
      category_name: firstBiz.category_name,
      name: firstBiz.name,
    });
    console.log(`[getVendorBusinesses] DEBUG - Contact data:`, {
      contact_person_name: firstBiz.contact_person_name,
      contact_person_phone: firstBiz.contact_person_phone,
      email: firstBiz.email,
      phone: firstBiz.phone,
    });
    console.log(`[getVendorBusinesses] DEBUG - Location data:`, {
      operating_locations: firstBiz.operating_locations,
      city: firstBiz.city,
      state: firstBiz.state,
    });
  }

  return { data: list as VendorBusiness[], error: result.error };
}

/**
 * Gets a single business — wraps vendor-businesses-get.
 *
 * IMPORTANT: The API expects an OBJECT payload with `business_id` field.
 * DO NOT send a raw string or the API will return 500 INTERNAL_ERROR.
 *
 * ✅ CORRECT: { business_id: "<uuid>" }
 * ❌ WRONG: "<uuid>" (raw string)
 * ❌ WRONG: {} (empty object)
 * ❌ WRONG: { id: "<uuid>" } (wrong field name)
 */
export async function getVendorBusiness(businessId: string) {
  // Validate input to prevent API errors
  if (!businessId || typeof businessId !== 'string') {
    console.error('[getVendorBusiness] Invalid businessId:', businessId);
    return { data: null, error: { success: false, error: 'Invalid or missing businessId', code: 'VALIDATION_ERROR' } };
  }

  // Ensure payload is ALWAYS an object with business_id - never a raw string
  const requestPayload = { business_id: businessId };

  console.log('[getVendorBusiness] Request - Function: vendor-businesses-get');
  console.log('[getVendorBusiness] Request - Payload:', JSON.stringify(requestPayload, null, 2));

  const result = await axiosFunctionsCall<any>('vendor-businesses-get', requestPayload);

  console.log('[getVendorBusiness] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[getVendorBusiness] Response - Data:', result.data ? JSON.stringify(result.data, null, 2).substring(0, 2000) + '...' : null);

  if (result.error) {
    console.error(`[getVendorBusiness] API error for businessId ${businessId}:`, result.error);
    return { data: null, error: result.error };
  }

  // DEBUG: Log all fields returned by API
  let payload = result.data;

  // Handle case where API returns { vendor_business: { rowCount, rows: [...] } }
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const inner = payload.vendor_business || payload.business || payload.data || payload.item;
    if (inner && typeof inner === 'object' && inner.rows && Array.isArray(inner.rows)) {
      payload = inner.rows[0] || null;
    }
  }

  const business = payload?.vendor_business || payload?.business || payload?.data || payload?.item || payload;
  if (business) {
    console.log(`[getVendorBusiness] DEBUG - API Response Keys:`, Object.keys(business));
    console.log(`[getVendorBusiness] DEBUG - Category fields:`, {
      business_category: business.business_category,
      primary_category_id: business.primary_category_id,
      category_ids: business.category_ids,
      vendor_business_category_mappings: business.vendor_business_category_mappings,
      primary_category_name: business.primary_category_name,
    });
    console.log(`[getVendorBusiness] DEBUG - Contact fields:`, {
      contact_person_name: business.contact_person_name,
      contact_name: business.contact_name,
      vendor_first_name: business.vendor?.first_name,
      vendor_last_name: business.vendor?.last_name,
    });
    console.log(`[getVendorBusiness] DEBUG - Location fields:`, {
      operating_locations: business.operating_locations,
      availability: business.availability,
      cities: business.cities,
    });
  }
  console.log(`[getVendorBusiness] API response for businessId ${businessId}:`, result.data);

  if (!payload) {
    console.warn(`[getVendorBusiness] Empty response for businessId ${businessId}`);
    return { data: null as any, error: null };
  }

  return { data: business as VendorBusiness, error: null };
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
  business_registration_number?: string;
  gst_number?: string;
  youtube_url?: string;
  status?: string;
}

/** Creates a business — wraps vendor-businesses-create. Adds compatibility for business_name. */
export async function createVendorBusiness(body: CreateBusinessRequest | Record<string, any>) {
  const payload = { ...body };
  if (payload.business_name && !payload.name) {
    payload.name = payload.business_name;
  }

  console.log('[createVendorBusiness] Request - Function: vendor-businesses-create');
  console.log('[createVendorBusiness] Request - Payload:', JSON.stringify(payload, null, 2));

  const result = await axiosFunctionsCall<any>('vendor-businesses-create', payload as any);

  console.log('[createVendorBusiness] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[createVendorBusiness] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);

  if (result.error) return { data: null, error: result.error };
  const resData = result.data;
  if (!resData) return { data: null as any, error: null };
  const business = resData.vendor_business || resData.business || resData.data || resData.item || resData;
  return { data: business as VendorBusiness, error: null };
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
    payload = { ...bodyOrId };
  }

  // Compatibility mapping
  if (payload.business_name && !payload.name) {
    payload.name = payload.business_name;
  }
  if (payload.business_email && !payload.email) {
    payload.email = payload.business_email;
  }
  if (payload.contact_person_phone && !payload.phone) {
    payload.phone = payload.contact_person_phone;
  }

  console.log('[updateVendorBusiness] Request - Function: vendor-businesses-update');
  console.log('[updateVendorBusiness] Request - Payload:', JSON.stringify(payload, null, 2));

  const result = await axiosFunctionsCall<any>('vendor-businesses-update', payload as any);

  console.log('[updateVendorBusiness] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[updateVendorBusiness] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);

  if (result.error) return { data: null, error: result.error };
  const resData = result.data;
  if (!resData) return { data: null as any, error: null };
  const business = resData.vendor_business || resData.business || resData.data || resData.item || resData;
  return { data: business as VendorBusiness, error: null };
}

/** Request payload for registering a vendor business via multipart form. */
export interface RegisterVendorBusinessRequest {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  business_name: string;
  business_type: 'service' | 'rental';
  pan_india?: boolean | string;
  operating_locations?: string[] | string;
  primary_category_id: string;
  specialization_category_ids?: string[] | string;
  event_category_ids?: string[] | string;
  business_registration_number?: string;
  gst_number?: string;
  youtube_url?: string;
  cover_photo?: { uri: string; name?: string; type?: string };
  photos?: Array<{ uri: string; name?: string; type?: string }>;
  videos?: Array<{ uri: string; name?: string; type?: string }>;
}

/** Response from register-vendor-business endpoint. */
export interface RegisterVendorBusinessResponse {
  success: boolean;
  vendor_id: string;
  vendor_business_id: string;
  file_storage_ids: string[];
  vendor_business_media_ids: string[];
}

/**
 * Registers a vendor business using multipart/form-data.
 * Handles file uploads for cover_photo, photos (gallery), and videos.
 */
export async function registerVendorBusiness(
  data: RegisterVendorBusinessRequest
): Promise<{ data?: RegisterVendorBusinessResponse; error?: { success: false; error: string; code?: string } }> {
  try {
    const formData = new FormData();

    // Append text fields
    formData.append('first_name', data.first_name);
    formData.append('last_name', data.last_name);
    formData.append('phone', data.phone);
    if (data.email) formData.append('email', data.email);
    formData.append('business_name', data.business_name);
    formData.append('business_type', data.business_type);
    if (data.business_registration_number) formData.append('business_registration_number', data.business_registration_number);
    if (data.gst_number) formData.append('gst_number', data.gst_number);
    if (data.youtube_url) formData.append('youtube_url', data.youtube_url);

    // Handle pan_india - convert boolean to string
    if (data.pan_india !== undefined) {
      formData.append('pan_india', String(data.pan_india));
    }

    // Handle operating_locations - convert array to JSON string if needed
    if (data.operating_locations) {
      if (Array.isArray(data.operating_locations)) {
        formData.append('operating_locations', JSON.stringify(data.operating_locations));
      } else {
        formData.append('operating_locations', data.operating_locations);
      }
    }

    formData.append('primary_category_id', data.primary_category_id);

    // Handle specialization_category_ids
    if (data.specialization_category_ids) {
      if (Array.isArray(data.specialization_category_ids)) {
        formData.append('specialization_category_ids', JSON.stringify(data.specialization_category_ids));
      } else {
        formData.append('specialization_category_ids', data.specialization_category_ids);
      }
    }

    // Handle event_category_ids
    if (data.event_category_ids) {
      if (Array.isArray(data.event_category_ids)) {
        formData.append('event_category_ids', JSON.stringify(data.event_category_ids));
      } else {
        formData.append('event_category_ids', data.event_category_ids);
      }
    }

    // Helper to create file object for FormData in React Native
    const createFilePart = (file: { uri: string; name?: string; type?: string }, defaultName: string) => {
      const fileName = file.name || file.uri.split('/').pop() || defaultName;
      const mimeType = file.type || getMimeTypeFromUri(file.uri);
      return {
        uri: file.uri,
        name: fileName,
        type: mimeType,
      } as any;
    };

    // Helper to get MIME type from URI
    function getMimeTypeFromUri(uri: string): string {
      const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
      };
      return mimeMap[ext] || 'application/octet-stream';
    }

    // Append cover_photo (max 1 file)
    if (data.cover_photo) {
      formData.append('cover_photo', createFilePart(data.cover_photo, 'cover.jpg'));
    }

    // Append photos (gallery images, max 10)
    if (data.photos && data.photos.length > 0) {
      for (const photo of data.photos) {
        formData.append('photos', createFilePart(photo, 'photo.jpg'));
      }
    }

    // Append videos (max 5)
    if (data.videos && data.videos.length > 0) {
      for (const video of data.videos) {
        formData.append('videos', createFilePart(video, 'video.mp4'));
      }
    }

    // Use the multipart upload function
    const result = await axiosMultipartUpload<RegisterVendorBusinessResponse>(
      'register-vendor-business',
      formData,
      'data'
    );

    return result;
  } catch (err: any) {
    return {
      error: {
        success: false,
        error: err?.message || 'Failed to register business',
        code: 'UNKNOWN_ERROR',
      },
    };
  }
}