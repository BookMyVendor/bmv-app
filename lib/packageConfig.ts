import { PackageTypeConfig, CategoryPackageConfig, PriceUnit } from '@/types/packages';

// Package Type Configurations
export const PACKAGE_TYPE_CONFIGS: Record<string, PackageTypeConfig> = {
  fixed: {
    type: 'fixed',
    label: 'Fixed Price',
    description: 'One fixed price for the entire package',
    requiredFields: ['package_name', 'base_price'],
    optionalFields: ['package_description', 'included_services'],
    priceFieldLabel: 'Package Price',
    showCapacityFields: false,
    showDurationFields: false,
    showPriceRange: false,
    validationRules: {
      base_price: { min: 0, required: true }
    }
  },
  
  hourly: {
    type: 'hourly',
    label: 'Hourly Rate',
    description: 'Price per hour, with optional minimum hours',
    requiredFields: ['package_name', 'base_price'],
    optionalFields: ['package_description', 'included_services', 'min_capacity'],
    priceFieldLabel: 'Price per Hour',
    showCapacityFields: false,
    showDurationFields: true,  // Show minimum hours field
    showPriceRange: false,
    validationRules: {
      base_price: { min: 0, required: true },
      min_capacity: { min: 1 }  // Used as minimum hours
    }
  },
  
  per_person: {
    type: 'per_person',
    label: 'Per Person',
    description: 'Price per person, with capacity limits',
    requiredFields: ['package_name', 'base_price', 'min_capacity', 'max_capacity'],
    optionalFields: ['package_description', 'included_services'],
    priceFieldLabel: 'Price per Person',
    showCapacityFields: true,
    showDurationFields: false,
    showPriceRange: false,
    validationRules: {
      base_price: { min: 0, required: true },
      min_capacity: { min: 1, required: true },
      max_capacity: { min: 1, required: true }
    }
  },
  
  custom: {
    type: 'custom',
    label: 'Price Range',
    description: 'Flexible pricing with min and max range',
    requiredFields: ['package_name', 'min_price', 'max_price'],
    optionalFields: ['package_description', 'included_services', 'base_price'],
    priceFieldLabel: 'Base Price (Estimate)',
    showCapacityFields: false,
    showDurationFields: false,
    showPriceRange: true,
    validationRules: {
      base_price: { min: 0, required: false },
      min_price: { min: 0, required: true },
      max_price: { min: 0, required: true }
    }
  }
};

// Price Unit Options
export const PRICE_UNIT_OPTIONS: { value: PriceUnit; label: string }[] = [
  { value: 'per_event', label: 'Per Event' },
  { value: 'per_day', label: 'Per Day' },
  { value: 'per_hour', label: 'Per Hour' },
  { value: 'per_person', label: 'Per Person' },
  { value: 'per_km', label: 'Per Kilometer' },
  { value: 'per_sqft', label: 'Per Square Foot' },
];

// Category-Specific Configurations
// These will be dynamically loaded from database, but we provide defaults
export const DEFAULT_CATEGORY_CONFIGS: Record<string, Partial<CategoryPackageConfig>> = {
  // Photography
  photography: {
    recommendedPackageTypes: ['fixed', 'hourly'],
    defaultPackageType: 'fixed',
    defaultPriceUnit: 'per_event',
    showCapacityFields: false,
    showDurationFields: true,
    pricingGuidelines: 'Photography packages typically range from ₹30,000 to ₹2,00,000 depending on duration and deliverables.',
  },
  
  // Catering
  catering: {
    recommendedPackageTypes: ['per_person', 'fixed'],
    defaultPackageType: 'per_person',
    defaultPriceUnit: 'per_person',
    showCapacityFields: true,
    showDurationFields: false,
    pricingGuidelines: 'Catering typically costs ₹400-₹2,000 per person depending on cuisine and service style.',
  },
  
  // Makeup Artist
  makeup: {
    recommendedPackageTypes: ['fixed'],
    defaultPackageType: 'fixed',
    defaultPriceUnit: 'per_person',
    showCapacityFields: true,
    showDurationFields: false,
    pricingGuidelines: 'Makeup packages typically range from ₹5,000 to ₹50,000 depending on number of people and services.',
  },
  
  // Decor
  decor: {
    recommendedPackageTypes: ['fixed', 'custom'],
    defaultPackageType: 'fixed',
    defaultPriceUnit: 'per_event',
    showCapacityFields: false,
    showDurationFields: false,
    pricingGuidelines: 'Decor packages typically range from ₹50,000 to ₹5,00,000 depending on venue size and elements.',
  },
  
  // Venue
  venue: {
    recommendedPackageTypes: ['fixed', 'hourly', 'custom'],
    defaultPackageType: 'fixed',
    defaultPriceUnit: 'per_event',
    showCapacityFields: true,
    showDurationFields: true,
    pricingGuidelines: 'Venue pricing typically ranges from ₹50,000 to ₹10,00,000 depending on capacity and amenities.',
  },
  
  // Entertainment
  entertainment: {
    recommendedPackageTypes: ['fixed', 'hourly'],
    defaultPackageType: 'fixed',
    defaultPriceUnit: 'per_event',
    showCapacityFields: false,
    showDurationFields: true,
    pricingGuidelines: 'Entertainment packages typically range from ₹20,000 to ₹2,00,000 depending on duration and equipment.',
  },
  
  // Transportation
  transportation: {
    recommendedPackageTypes: ['fixed', 'hourly', 'custom'],
    defaultPackageType: 'fixed',
    defaultPriceUnit: 'per_day',
    showCapacityFields: true,
    showDurationFields: false,
    pricingGuidelines: 'Transportation typically costs ₹5,000 to ₹50,000 per vehicle depending on type and duration.',
  },
};

// Helper function to get category config by category name or slug
export function getCategoryConfig(categoryNameOrSlug: string): Partial<CategoryPackageConfig> | null {
  const normalized = categoryNameOrSlug.toLowerCase().replace(/\s+/g, '');
  
  // Try exact match first
  if (DEFAULT_CATEGORY_CONFIGS[normalized]) {
    return DEFAULT_CATEGORY_CONFIGS[normalized];
  }
  
  // Try partial match
  for (const [key, config] of Object.entries(DEFAULT_CATEGORY_CONFIGS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return config;
    }
  }
  
  // Return default config
  return {
    recommendedPackageTypes: ['fixed'],
    defaultPackageType: 'fixed',
    defaultPriceUnit: 'per_event',
    showCapacityFields: false,
    showDurationFields: false,
  };
}

// Helper function to get package type config
export function getPackageTypeConfig(type: string): PackageTypeConfig | null {
  return PACKAGE_TYPE_CONFIGS[type] || null;
}

