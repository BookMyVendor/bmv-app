import { supabaseCore } from './supabase';
import { PricingPackage, PackageFormData } from '@/types/packages';

/**
 * Get all packages for a business
 */
export async function getBusinessPackages(
  businessId: string
): Promise<{ data: PricingPackage[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabaseCore
      .from('vendor_business_pricing_packages')
      .select('*')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data as PricingPackage[], error: null };
  } catch (error) {
    console.error('Error fetching packages:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get a single package by ID
 */
export async function getPackage(
  packageId: string
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  try {
    const { data, error } = await supabaseCore
      .from('vendor_business_pricing_packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (error) throw error;
    return { data: data as PricingPackage, error: null };
  } catch (error) {
    console.error('Error fetching package:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Create a new package
 */
export async function createPackage(
  packageData: Omit<PricingPackage, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  try {
    // Remove UI-only fields before saving
    const { categoryId, categorySpecificFields, isDirty, validationErrors, ...dbData } = packageData as any;
    
    // Set default values
    const insertData = {
      ...dbData,
      is_active: dbData.is_active ?? true,
      sort_order: dbData.sort_order ?? 0,
      included_services: dbData.included_services || [],
      price_unit: dbData.price_unit || 'per_event',
    };

    const { data, error } = await supabaseCore
      .from('vendor_business_pricing_packages')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return { data: data as PricingPackage, error: null };
  } catch (error) {
    console.error('Error creating package:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Update an existing package
 */
export async function updatePackage(
  packageId: string,
  packageData: Partial<Omit<PricingPackage, 'id' | 'business_id' | 'created_at' | 'updated_at'>>
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  try {
    // Remove UI-only fields before saving
    const { categoryId, categorySpecificFields, isDirty, validationErrors, ...dbData } = packageData as any;

    const { data, error } = await supabaseCore
      .from('vendor_business_pricing_packages')
      .update({
        ...dbData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', packageId)
      .select()
      .single();

    if (error) throw error;
    return { data: data as PricingPackage, error: null };
  } catch (error) {
    console.error('Error updating package:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Delete a package
 */
export async function deletePackage(
  packageId: string
): Promise<{ error: Error | null }> {
  try {
    if (!packageId) {
      throw new Error('Package ID is required');
    }
    
    console.log('Attempting to delete package with ID:', packageId);
    const { error, data } = await supabaseCore
      .from('vendor_business_pricing_packages')
      .delete()
      .eq('id', packageId)
      .select();

    if (error) {
      console.error('Supabase delete error:', error);
      throw error;
    }
    
    console.log('Package deleted successfully:', data);
    return { error: null };
  } catch (error) {
    console.error('Error deleting package:', error);
    return { error: error as Error };
  }
}

/**
 * Toggle package active status
 */
export async function togglePackageStatus(
  packageId: string,
  isActive: boolean
): Promise<{ data: PricingPackage | null; error: Error | null }> {
  try {
    if (!packageId) {
      throw new Error('Package ID is required');
    }
    
    console.log('togglePackageStatus called:', { packageId, isActive });
    
    const updateData = { 
      is_active: isActive, 
      updated_at: new Date().toISOString() 
    };
    console.log('Update data:', updateData);
    
    const { data, error } = await supabaseCore
      .from('vendor_business_pricing_packages')
      .update(updateData)
      .eq('id', packageId)
      .select()
      .single();

    console.log('Supabase response:', { data, error });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Package status updated successfully:', data);
    return { data: data as PricingPackage, error: null };
  } catch (error) {
    console.error('Error toggling package status:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Update package sort order
 */
export async function updatePackageSortOrder(
  packageIds: string[]
): Promise<{ error: Error | null }> {
  try {
    const updates = packageIds.map((id, index) =>
      supabaseCore
        .from('vendor_business_pricing_packages')
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    await Promise.all(updates);
    return { error: null };
  } catch (error) {
    console.error('Error updating sort order:', error);
    return { error: error as Error };
  }
}

/**
 * Get category form fields for a category
 */
export async function getCategoryFormFields(
  categoryId: string
): Promise<{ data: any[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabaseCore
      .from('category_form_fields')
      .select('*')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error) {
    console.error('Error fetching category form fields:', error);
    return { data: null, error: error as Error };
  }
}

/**
 * Get business categories (for package creation)
 */
export async function getBusinessCategories(
  businessId: string
): Promise<{ data: any[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabaseCore
      .from('vendor_business_category_mappings')
      .select(`
        category_id,
        categories:category_id (
          id,
          name,
          icon,
          slug,
          parent_category_id
        )
      `)
      .eq('business_id', businessId);

    if (error) throw error;
    
    // Flatten the nested structure
    const categories = (data || []).map((item: any) => ({
      id: item.categories?.id || item.category_id,
      name: item.categories?.name,
      icon: item.categories?.icon,
      slug: item.categories?.slug,
      parent_category_id: item.categories?.parent_category_id,
    }));

    return { data: categories, error: null };
  } catch (error) {
    console.error('Error fetching business categories:', error);
    return { data: null, error: error as Error };
  }
}

