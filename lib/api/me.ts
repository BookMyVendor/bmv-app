import { axiosFunctionsCall } from '../axiosClient';

/** Matches vendor-me-get response vendor shape (API_SPEC_FOR_CONSUMERS.md). */
export interface MeResponse {
  id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  image_file_id: string | null;
  terms_accepted: boolean | null;
  terms_accepted_at: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  has_business: boolean;
  vendor_businesses?: { id: string }[];
}

export async function getMe() {
  return axiosFunctionsCall<MeResponse>('vendor-me-get', {}, 'vendor');
}
