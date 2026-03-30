import { functionsCall } from '../apiClient';

export interface PricingPackage {
  id: string;
  business_id: string;
  [key: string]: unknown;
}

/** Spec: vendor-businesses-packages-list { business_id } */
export async function getPackages(businessId: string) {
  return functionsCall<PricingPackage[]>('vendor-businesses-packages-list', { business_id: businessId }, 'packages');
}

/** Spec: package-get { package_id } */
export async function getPackage(id: string) {
  return functionsCall<PricingPackage>('package-get', { package_id: id }, 'package');
}

/** Spec: vendor-businesses-packages-create { business_id, name?, description?, price?, ... } */
export async function createPackage(businessId: string, body: Record<string, unknown>) {
  return functionsCall<PricingPackage>('vendor-businesses-packages-create', { business_id: businessId, ...body } as Record<string, unknown>, 'package');
}

/** Spec: package-update { package_id, name?, description?, price?, ... } */
export async function updatePackage(id: string, body: Record<string, unknown>) {
  return functionsCall<PricingPackage>('package-update', { package_id: id, ...body } as Record<string, unknown>, 'package');
}

/** Spec: package-delete { package_id } */
export async function deletePackage(id: string) {
  return functionsCall<void>('package-delete', { package_id: id });
}

/** Spec: category-form-fields-list { category_id } */
export async function getCategoryFormFields(categoryId: string) {
  return functionsCall<unknown[]>('category-form-fields-list', { category_id: categoryId }, 'category_form_fields');
}

/** Spec: vendor-businesses-category-mappings-get { business_id } */
export async function getBusinessCategoryMappings(businessId: string) {
  return functionsCall<{ category_id: string; categories?: { id: string; name: string; icon?: string; slug?: string; parent_category_id?: string } }[]>(
    'vendor-businesses-category-mappings-get',
    { business_id: businessId },
    'category_mappings'
  );
}

/** Spec: vendor-businesses-category-mappings-put { business_id, category_ids } */
export async function updateBusinessCategoryMappings(businessId: string, categoryIds: string[]) {
  return functionsCall<unknown>('vendor-businesses-category-mappings-put', { business_id: businessId, category_ids: categoryIds }, 'category_mappings');
}
