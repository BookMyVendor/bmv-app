import { axiosFunctionsCall } from '../axiosClient';

export interface PricingPackage {
  id: string;
  business_id: string;
  [key: string]: unknown;
}

/** Spec: vendor-businesses-packages-list { business_id } */
export async function getPackages(businessId: string) {
  console.log('[getPackages] Request - Function: vendor-businesses-packages-list');
  console.log('[getPackages] Request - Payload:', JSON.stringify({ business_id: businessId }, null, 2));
  const result = await axiosFunctionsCall<PricingPackage[]>('vendor-businesses-packages-list', { business_id: businessId }, 'packages');
  console.log('[getPackages] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[getPackages] Response - Data Count:', result.data?.length ?? 0);
  return result;
}

/** Spec: package-get { package_id } */
export async function getPackage(id: string) {
  const payload = { package_id: id };
  console.log('[getPackage] Request - Function: package-get');
  console.log('[getPackage] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<PricingPackage>('package-get', payload, 'package');
  console.log('[getPackage] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[getPackage] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}

/** Spec: vendor-businesses-packages-create { business_id, name?, description?, price?, ... } */
export async function createPackage(businessId: string, body: Record<string, unknown>) {
  const payload = { business_id: businessId, ...body };
  console.log('[createPackage] Request - Function: vendor-businesses-packages-create');
  console.log('[createPackage] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<PricingPackage>('vendor-businesses-packages-create', payload as Record<string, unknown>, 'package');
  console.log('[createPackage] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[createPackage] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}

/** Spec: package-update { package_id, name?, description?, price?, ... } */
export async function updatePackage(id: string, body: Record<string, unknown>) {
  const payload = { package_id: id, ...body };
  console.log('[updatePackage] Request - Function: package-update');
  console.log('[updatePackage] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<PricingPackage>('package-update', payload as Record<string, unknown>, 'package');
  console.log('[updatePackage] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[updatePackage] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}

/** Spec: package-delete { package_id } */
export async function deletePackage(id: string) {
  const payload = { package_id: id };
  console.log('[deletePackage] Request - Function: package-delete');
  console.log('[deletePackage] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<void>('package-delete', payload);
  console.log('[deletePackage] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  return result;
}

/** Spec: vendor-businesses-category-mappings-get { business_id } */
export async function getBusinessCategoryMappings(businessId: string) {
  const payload = { business_id: businessId };
  console.log('[getBusinessCategoryMappings] Request - Function: vendor-businesses-category-mappings-get');
  console.log('[getBusinessCategoryMappings] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<{ category_id: string; categories?: { id: string; name: string; icon?: string; slug?: string; parent_category_id?: string } }[]>(
    'vendor-businesses-category-mappings-get',
    payload,
    'category_mappings'
  );
  console.log('[getBusinessCategoryMappings] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[getBusinessCategoryMappings] Response - Data Count:', result.data?.length ?? 0);
  return result;
}

/** Spec: vendor-businesses-category-mappings-put { business_id, category_ids } */
export async function updateBusinessCategoryMappings(businessId: string, categoryIds: string[]) {
  const payload = { business_id: businessId, category_ids: categoryIds };
  console.log('[updateBusinessCategoryMappings] Request - Function: vendor-businesses-category-mappings-put');
  console.log('[updateBusinessCategoryMappings] Request - Payload:', JSON.stringify(payload, null, 2));
  const result = await axiosFunctionsCall<unknown>('vendor-businesses-category-mappings-put', payload, 'category_mappings');
  console.log('[updateBusinessCategoryMappings] Response - Error:', result.error ? JSON.stringify(result.error, null, 2) : null);
  console.log('[updateBusinessCategoryMappings] Response - Data:', result.data ? JSON.stringify(result.data, null, 2) : null);
  return result;
}
