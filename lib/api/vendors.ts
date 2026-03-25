import { functionsCall } from '../apiClient';

export async function updateVendorMe(body: Record<string, unknown>) {
  return functionsCall<unknown>('vendor-me-update', body as Record<string, unknown>, 'vendor');
}
