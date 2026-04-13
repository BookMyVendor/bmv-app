import { axiosFunctionsCall } from '../axiosClient';
import { MeResponse } from './me';

export interface UpdateVendorMeRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  image_file_id?: string;
  terms_accepted?: boolean;
  terms_accepted_at?: string;
}

/** Updates your vendor profile — wraps vendor-me-update. */
export async function updateVendorMe(body: UpdateVendorMeRequest) {
  return axiosFunctionsCall<MeResponse>('vendor-me-update', body as any, 'vendor');
}

export interface VendorCreateRequest {
  phone: string;
  name?: string;
  email?: string;
  id?: string;
}

/** Dev-only: bypass OTP to create a vendor. */
export async function devCreateVendor(body: VendorCreateRequest) {
  return axiosFunctionsCall<unknown>('vendor-create', body as any);
}
