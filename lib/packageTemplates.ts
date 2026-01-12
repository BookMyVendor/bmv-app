import { PackageFormData, PackageType } from '../types/packages';

export interface PackageTemplate {
  id: string;
  name: string;
  description: string;
  categoryId?: string; // Optional: specific to a category
  categoryName?: string;
  packageType: PackageType;
  template: Partial<PackageFormData>;
  icon?: string;
}

// Package Templates by Category
export const PACKAGE_TEMPLATES: PackageTemplate[] = [
  // Photography Templates
  {
    id: 'photography-basic',
    name: 'Basic Photography',
    description: 'Essential photography coverage for small events',
    categoryName: 'Photography',
    packageType: 'fixed',
    template: {
      package_name: 'Basic Photography Package',
      package_type: 'fixed',
      base_price: 30000,
      price_unit: 'per_event',
      package_description: 'Essential photography coverage including pre-wedding, wedding, and reception. Includes 2 photographers, 8 hours coverage, and edited photos.',
      included_services: ['Pre-wedding Shoot', 'Wedding Coverage', 'Reception Coverage', 'Edited Photos', 'Online Gallery'],
    },
    icon: '📸',
  },
  {
    id: 'photography-premium',
    name: 'Premium Photography',
    description: 'Complete photography package with all deliverables',
    categoryName: 'Photography',
    packageType: 'fixed',
    template: {
      package_name: 'Premium Photography Package',
      package_type: 'fixed',
      base_price: 80000,
      price_unit: 'per_event',
      package_description: 'Premium photography coverage with 3 photographers, 12 hours coverage, drone footage, cinematic video, and premium photo album.',
      included_services: ['Pre-wedding Shoot', 'Wedding Coverage', 'Reception Coverage', 'Drone Footage', 'Cinematic Video', 'Premium Photo Album', 'Raw Photos', 'Online Gallery'],
    },
    icon: '📸',
  },
  {
    id: 'photography-hourly',
    name: 'Hourly Photography',
    description: 'Flexible hourly photography service',
    categoryName: 'Photography',
    packageType: 'hourly',
    template: {
      package_name: 'Hourly Photography Service',
      package_type: 'hourly',
      base_price: 5000,
      price_unit: 'per_hour',
      min_capacity: 4, // Minimum hours
      package_description: 'Professional photography service charged per hour. Minimum 4 hours booking required.',
      included_services: ['Professional Photographer', 'Edited Photos', 'Online Gallery'],
    },
    icon: '📸',
  },

  // Catering Templates
  {
    id: 'catering-buffet',
    name: 'Buffet Catering',
    description: 'Traditional buffet service per person',
    categoryName: 'Catering',
    packageType: 'per_person',
    template: {
      package_name: 'Buffet Catering Package',
      package_type: 'per_person',
      base_price: 600,
      price_unit: 'per_person',
      min_capacity: 50,
      max_capacity: 500,
      package_description: 'Delicious buffet spread with multiple cuisines. Includes service staff, setup, and cleanup.',
      included_services: ['Buffet Setup', 'Service Staff', 'Multiple Cuisines', 'Desserts', 'Beverages', 'Cleanup'],
    },
    icon: '🍽️',
  },
  {
    id: 'catering-plated',
    name: 'Plated Service',
    description: 'Elegant plated meal service',
    categoryName: 'Catering',
    packageType: 'per_person',
    template: {
      package_name: 'Plated Service Package',
      package_type: 'per_person',
      base_price: 1200,
      price_unit: 'per_person',
      min_capacity: 30,
      max_capacity: 300,
      package_description: 'Fine dining plated service with multiple course meal. Includes professional waitstaff and elegant presentation.',
      included_services: ['Multi-course Meal', 'Professional Waitstaff', 'Table Service', 'Dessert Course', 'Beverages'],
    },
    icon: '🍽️',
  },
  {
    id: 'catering-custom',
    name: 'Custom Catering',
    description: 'Flexible catering with custom menu',
    categoryName: 'Catering',
    packageType: 'custom',
    template: {
      package_name: 'Custom Catering Package',
      package_type: 'custom',
      min_price: 50000,
      max_price: 500000,
      base_price: 200000,
      price_unit: 'per_event',
      package_description: 'Customized catering solution tailored to your event. Menu, service style, and pricing can be customized based on requirements.',
      included_services: ['Custom Menu', 'Flexible Service Style', 'Professional Staff', 'Setup & Cleanup'],
    },
    icon: '🍽️',
  },

  // Makeup Templates
  {
    id: 'makeup-bridal',
    name: 'Bridal Makeup',
    description: 'Complete bridal makeup package',
    categoryName: 'Makeup',
    packageType: 'fixed',
    template: {
      package_name: 'Bridal Makeup Package',
      package_type: 'fixed',
      base_price: 25000,
      price_unit: 'per_person',
      min_capacity: 1,
      max_capacity: 1,
      package_description: 'Complete bridal makeup and hair styling package. Includes trial session, bridal makeup, hair styling, and touch-ups.',
      included_services: ['Trial Session', 'Bridal Makeup', 'Hair Styling', 'Touch-ups', 'Premium Products'],
    },
    icon: '💄',
  },
  {
    id: 'makeup-family',
    name: 'Family Makeup Package',
    description: 'Makeup for bride and family members',
    categoryName: 'Makeup',
    packageType: 'fixed',
    template: {
      package_name: 'Bride + Family Makeup Package',
      package_type: 'fixed',
      base_price: 45000,
      price_unit: 'per_event',
      min_capacity: 3,
      max_capacity: 8,
      package_description: 'Makeup package for bride and family members. Includes trial session for bride, makeup for all included members, and hair styling.',
      included_services: ['Bridal Trial', 'Bride Makeup & Hair', 'Family Makeup (3-7 people)', 'Hair Styling', 'Touch-ups'],
    },
    icon: '💄',
  },

  // Decor Templates
  {
    id: 'decor-basic',
    name: 'Basic Decor',
    description: 'Essential decor for small venues',
    categoryName: 'Decor',
    packageType: 'fixed',
    template: {
      package_name: 'Basic Decor Package',
      package_type: 'fixed',
      base_price: 100000,
      price_unit: 'per_event',
      package_description: 'Essential decor package including stage, entrance, and basic lighting. Suitable for small to medium venues.',
      included_services: ['Stage Decoration', 'Entrance Decoration', 'Basic Lighting', 'Table Centerpieces', 'Setup & Dismantle'],
    },
    icon: '🎨',
  },
  {
    id: 'decor-premium',
    name: 'Premium Decor',
    description: 'Luxury decor with all elements',
    categoryName: 'Decor',
    packageType: 'custom',
    template: {
      package_name: 'Premium Decor Package',
      package_type: 'custom',
      min_price: 300000,
      max_price: 1000000,
      base_price: 500000,
      price_unit: 'per_event',
      package_description: 'Premium decor package with all elements including stage, entrance, lighting, floral arrangements, props, and theme-based decoration.',
      included_services: ['Premium Stage Design', 'Grand Entrance', 'Advanced Lighting', 'Floral Arrangements', 'Props & Backdrops', 'Theme Decoration', 'Setup & Dismantle'],
    },
    icon: '🎨',
  },

  // Venue Templates
  {
    id: 'venue-fixed',
    name: 'Fixed Venue Rental',
    description: 'Fixed price venue rental',
    categoryName: 'Venue',
    packageType: 'fixed',
    template: {
      package_name: 'Venue Rental Package',
      package_type: 'fixed',
      base_price: 200000,
      price_unit: 'per_event',
      min_capacity: 50,
      max_capacity: 500,
      package_description: 'Complete venue rental including space, basic amenities, parking, and 8 hours usage. Additional hours available at extra cost.',
      included_services: ['Venue Space', 'Basic Amenities', 'Parking', '8 Hours Usage', 'Sound System', 'AC'],
    },
    icon: '🏛️',
  },
  {
    id: 'venue-hourly',
    name: 'Hourly Venue Rental',
    description: 'Flexible hourly venue rental',
    categoryName: 'Venue',
    packageType: 'hourly',
    template: {
      package_name: 'Hourly Venue Rental',
      package_type: 'hourly',
      base_price: 25000,
      price_unit: 'per_hour',
      min_capacity: 4, // Minimum hours
      package_description: 'Flexible hourly venue rental. Minimum 4 hours booking required. Includes basic amenities and parking.',
      included_services: ['Venue Space', 'Basic Amenities', 'Parking', 'Sound System', 'AC'],
    },
    icon: '🏛️',
  },

  // Entertainment Templates
  {
    id: 'entertainment-dj',
    name: 'DJ Service',
    description: 'Professional DJ with sound system',
    categoryName: 'Entertainment',
    packageType: 'fixed',
    template: {
      package_name: 'DJ Service Package',
      package_type: 'fixed',
      base_price: 40000,
      price_unit: 'per_event',
      package_description: 'Professional DJ service with high-quality sound system, lighting, and 6 hours of music. Includes setup and breakdown.',
      included_services: ['Professional DJ', 'Sound System', 'Lighting', '6 Hours Service', 'Setup & Breakdown'],
    },
    icon: '🎵',
  },
  {
    id: 'entertainment-band',
    name: 'Live Band',
    description: 'Live music band performance',
    categoryName: 'Entertainment',
    packageType: 'fixed',
    template: {
      package_name: 'Live Band Performance',
      package_type: 'fixed',
      base_price: 80000,
      price_unit: 'per_event',
      package_description: 'Live music band with 4-5 members, sound system, and 4 hours performance. Multiple sets available.',
      included_services: ['Live Band (4-5 members)', 'Sound System', '4 Hours Performance', 'Multiple Sets', 'Setup & Breakdown'],
    },
    icon: '🎵',
  },

  // Generic/Default Templates (for any category)
  {
    id: 'default-standard',
    name: 'Standard Package',
    description: 'Standard fixed price package',
    categoryName: undefined, // Works for any category
    packageType: 'fixed',
    template: {
      package_name: 'Standard Package',
      package_type: 'fixed',
      base_price: 50000,
      price_unit: 'per_event',
      package_description: 'Standard service package with essential features and services.',
      included_services: ['Standard Service', 'Professional Setup', 'Basic Support'],
    },
    icon: '📦',
  },
  {
    id: 'default-premium',
    name: 'Premium Package',
    description: 'Premium fixed price package with enhanced features',
    categoryName: undefined, // Works for any category
    packageType: 'fixed',
    template: {
      package_name: 'Premium Package',
      package_type: 'fixed',
      base_price: 150000,
      price_unit: 'per_event',
      package_description: 'Premium service package with enhanced features, premium quality, and comprehensive support.',
      included_services: ['Premium Service', 'Enhanced Features', 'Premium Quality', 'Comprehensive Support', 'Priority Service'],
    },
    icon: '⭐',
  },
  {
    id: 'default-basic',
    name: 'Basic Package',
    description: 'Basic fixed price package for budget-conscious customers',
    categoryName: undefined, // Works for any category
    packageType: 'fixed',
    template: {
      package_name: 'Basic Package',
      package_type: 'fixed',
      base_price: 25000,
      price_unit: 'per_event',
      package_description: 'Basic service package with essential features at an affordable price.',
      included_services: ['Essential Service', 'Basic Setup', 'Standard Support'],
    },
    icon: '💼',
  },
  {
    id: 'default-per-person',
    name: 'Per Person Package',
    description: 'Flexible per person pricing',
    categoryName: undefined, // Works for any category
    packageType: 'per_person',
    template: {
      package_name: 'Per Person Package',
      package_type: 'per_person',
      base_price: 500,
      price_unit: 'per_person',
      min_capacity: 20,
      max_capacity: 500,
      package_description: 'Flexible per person pricing package. Perfect for events with varying guest counts.',
      included_services: ['Per Person Service', 'Flexible Pricing', 'Scalable Service'],
    },
    icon: '👥',
  },
  {
    id: 'default-hourly',
    name: 'Hourly Service',
    description: 'Flexible hourly pricing',
    categoryName: undefined, // Works for any category
    packageType: 'hourly',
    template: {
      package_name: 'Hourly Service Package',
      package_type: 'hourly',
      base_price: 5000,
      price_unit: 'per_hour',
      min_capacity: 2, // Minimum hours
      package_description: 'Flexible hourly service package. Pay only for the hours you need. Minimum 2 hours required.',
      included_services: ['Hourly Service', 'Flexible Duration', 'Professional Service'],
    },
    icon: '⏰',
  },
  {
    id: 'default-custom',
    name: 'Custom Package',
    description: 'Customizable package with flexible pricing range',
    categoryName: undefined, // Works for any category
    packageType: 'custom',
    template: {
      package_name: 'Custom Package',
      package_type: 'custom',
      min_price: 30000,
      max_price: 300000,
      base_price: 100000,
      price_unit: 'per_event',
      package_description: 'Customizable package tailored to your specific needs. Pricing and services can be customized based on requirements.',
      included_services: ['Customizable Service', 'Flexible Pricing', 'Tailored Solution', 'Custom Features'],
    },
    icon: '🎯',
  },
];

/**
 * Get templates for a specific category
 * Returns category-specific templates if available, otherwise returns generic/default templates
 */
export function getTemplatesForCategory(categoryName?: string): PackageTemplate[] {
  if (!categoryName) {
    // Return all templates including generic ones
    return PACKAGE_TEMPLATES;
  }

  const normalizedCategoryName = categoryName.toLowerCase().trim();

  // First, try exact match
  const exactMatches = PACKAGE_TEMPLATES.filter(
    template => template.categoryName?.toLowerCase() === normalizedCategoryName
  );

  // If we have category-specific templates, return them
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // Try partial/fuzzy matching (e.g., "Wedding Photography" matches "Photography")
  const partialMatches = PACKAGE_TEMPLATES.filter(
    template => {
      if (!template.categoryName) return false;
      const templateCategory = template.categoryName.toLowerCase();
      return normalizedCategoryName.includes(templateCategory) ||
        templateCategory.includes(normalizedCategoryName);
    }
  );

  if (partialMatches.length > 0) {
    return partialMatches;
  }

  // If no category-specific templates found, return generic/default templates
  const genericTemplates = PACKAGE_TEMPLATES.filter(
    template => !template.categoryName // Generic templates have no categoryName
  );

  return genericTemplates.length > 0 ? genericTemplates : PACKAGE_TEMPLATES;
}

/**
 * Get templates for a specific package type
 */
export function getTemplatesForType(packageType: PackageType): PackageTemplate[] {
  return PACKAGE_TEMPLATES.filter(template => template.packageType === packageType);
}

/**
 * Apply template to form data
 */
export function applyTemplate(template: PackageTemplate): Partial<PackageFormData> {
  return {
    ...template.template,
    package_name: template.template.package_name || template.name,
  };
}

