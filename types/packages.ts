// Package Type Definitions

export type PackageType = 'fixed' | 'hourly' | 'per_person' | 'custom';
export type PriceUnit = 'per_event' | 'per_day' | 'per_hour' | 'per_person' | 'per_km' | 'per_sqft';

// Base package structure matching database
export interface PricingPackage {
  id?: string;
  business_id: string;
  package_name: string;
  package_type: PackageType;
  base_price: number;
  min_price?: number | null;
  max_price?: number | null;
  price_unit: string;
  min_capacity?: number | null;
  max_capacity?: number | null;
  package_description?: string | null;
  included_services: string[];
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  // Optional: category_id if we add it to schema later
  category_id?: string | null;
}

// Extended interface for UI with category-specific fields
export interface PackageFormData extends Omit<PricingPackage, 'created_at' | 'updated_at'> {
  // Category-specific dynamic fields
  categoryId?: string;
  categorySpecificFields?: {
    [key: string]: any;
  };
  
  // UI state fields (not saved to DB)
  isDirty?: boolean;
  validationErrors?: Record<string, string>;
}

// Package type configuration
export interface PackageTypeConfig {
  type: PackageType;
  label: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
  priceFieldLabel: string;
  showCapacityFields: boolean;
  showDurationFields: boolean;
  showPriceRange: boolean;
  validationRules: {
    base_price: { min: number; required: boolean };
    min_price?: { min: number; max?: number };
    max_price?: { min: number; max?: number };
    min_capacity?: { min: number };
    max_capacity?: { min: number };
  };
}

// Category form field (from category_form_fields table)
export interface CategoryFormField {
  id?: string;
  category_id?: string;
  field_name: string;
  field_type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'file' | 'image';
  field_label: string;
  is_required: boolean;
  field_options?: {
    options?: string[];
    [key: string]: any;
  };
  validation_rules?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    [key: string]: any;
  };
  sort_order?: number;
}

// Category-specific package configuration
export interface CategoryPackageConfig {
  categoryId: string;
  categoryName: string;
  recommendedPackageTypes: PackageType[];
  defaultPackageType?: PackageType;
  defaultPriceUnit?: PriceUnit;
  showCapacityFields: boolean;
  showDurationFields: boolean;
  customFields?: CategoryFormField[];
  pricingGuidelines?: string;
}

// Category info (from categories table)
export interface Category {
  id: string;
  name: string;
  icon?: string;
  parent_category_id?: string | null;
  category_level?: number;
  slug?: string;
}

