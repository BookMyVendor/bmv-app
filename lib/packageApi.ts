import * as api from './api/packages';
import { PricingPackage } from '../types/packages';

export async function getBusinessPackages(
  businessId: string
): Promise<{ data: PricingPackage[] | null; error: Error | null }> {
  const { data, error } = await api.getPackages(businessId);
  if (error) return { data: null, error: new Error(error.error) };
  return { data: (data || []) as PricingPackage[], error: null };
}

export async function getPackage(
  packageId: string
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  const { data, error } = await api.getPackage(packageId);
  if (error) return { data: null, error: new Error(error.error) };
  return { data: data as PricingPackage, error: null };
}

export async function createPackage(
  packageData: Omit<PricingPackage, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  const { categoryId, categorySpecificFields, isDirty, validationErrors, ...dbData } = packageData as any;
  const businessId = dbData.business_id;
  if (!businessId) return { data: null, error: new Error('business_id required') };
  const insertData = {
    ...dbData,
    is_active: dbData.is_active ?? true,
    sort_order: dbData.sort_order ?? 0,
    included_services: dbData.included_services || [],
    price_unit: dbData.price_unit || 'per_event',
  };
  const { data, error } = await api.createPackage(businessId, insertData);
  if (error) return { data: null, error: new Error(error.error) };
  return { data: data as PricingPackage, error: null };
}

export async function updatePackage(
  packageId: string,
  packageData: Partial<Omit<PricingPackage, 'id' | 'business_id' | 'created_at' | 'updated_at'>>
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  const { categoryId, categorySpecificFields, isDirty, validationErrors, ...dbData } = packageData as any;
  const { data, error } = await api.updatePackage(packageId, {
    ...dbData,
    updated_at: new Date().toISOString(),
  });
  if (error) return { data: null, error: new Error(error.error) };
  return { data: data as PricingPackage, error: null };
}

export async function deletePackage(packageId: string): Promise<{ error: Error | null }> {
  if (!packageId) return { error: new Error('Package ID is required') };
  const { error } = await api.deletePackage(packageId);
  if (error) return { error: new Error(error.error) };
  return { error: null };
}

export async function togglePackageStatus(
  packageId: string,
  isActive: boolean
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  return updatePackage(packageId, { is_active: isActive });
}

export async function updatePackageSortOrder(
  packageIds: string[]
): Promise<{ error: Error | null }> {
  try {
    await Promise.all(
      packageIds.map((id, index) =>
        api.updatePackage(id, { sort_order: index, updated_at: new Date().toISOString() })
      )
    );
    return { error: null };
  } catch (e) {
    return { error: e as Error };
  }
}

export async function getCategoryFormFields(
  categoryId: string
): Promise<{ data: any[] | null; error: Error | null }> {
  const { data, error } = await api.getCategoryFormFields(categoryId);
  if (error) return { data: null, error: new Error(error.error) };
  return { data: data || [], error: null };
}

export async function getBusinessCategories(
  businessId: string
): Promise<{ data: any[] | null; error: Error | null }> {
  const { data, error } = await api.getBusinessCategoryMappings(businessId);
  if (error) return { data: null, error: new Error(error.error) };
  const categories = (data || []).map((item: any) => ({
    id: item.categories?.id ?? item.category_id,
    name: item.categories?.name,
    icon: item.categories?.icon,
    slug: item.categories?.slug,
    parent_category_id: item.categories?.parent_category_id,
  }));
  return { data: categories, error: null };
}
