import * as Yup from 'yup';
import { PackageType } from '../types/packages';

/**
 * Create validation schema based on package type
 */
export function createPackageValidationSchema(packageType: PackageType) {
  const baseSchema = {
    package_name: Yup.string()
      .required('Package name is required')
      .min(3, 'Package name must be at least 3 characters')
      .max(100, 'Package name must be less than 100 characters'),

    package_description: Yup.string()
      .max(1000, 'Description must be less than 1000 characters'),

    included_services: Yup.array()
      .of(Yup.string())
      .max(20, 'Maximum 20 services allowed'),
  };

  switch (packageType) {
    case 'fixed':
      return Yup.object().shape({
        ...baseSchema,
        base_price: Yup.number()
          .required('Price is required')
          .min(0, 'Price must be 0 or greater')
          .max(99999999, 'Price is too large'),
        price_unit: Yup.string().required('Price unit is required'),
      });

    case 'hourly':
      return Yup.object().shape({
        ...baseSchema,
        base_price: Yup.number()
          .required('Price per hour is required')
          .min(0, 'Price must be 0 or greater')
          .max(999999, 'Price is too large'),
        price_unit: Yup.string().default('per_hour'),
        min_capacity: Yup.number()
          .nullable()
          .min(1, 'Minimum hours must be at least 1')
          .max(24, 'Maximum hours is 24'),
      });

    case 'per_person':
      return Yup.object().shape({
        ...baseSchema,
        base_price: Yup.number()
          .required('Price per person is required')
          .min(0, 'Price must be 0 or greater')
          .max(99999, 'Price is too large'),
        price_unit: Yup.string().default('per_person'),
        min_capacity: Yup.number()
          .required('Minimum capacity is required')
          .min(1, 'Minimum capacity must be at least 1')
          .integer('Capacity must be a whole number'),
        max_capacity: Yup.number()
          .required('Maximum capacity is required')
          .min(1, 'Maximum capacity must be at least 1')
          .integer('Capacity must be a whole number')
          .test('greater-than-min', 'Maximum capacity must be greater than minimum capacity', function (value) {
            const minCapacity = this.parent.min_capacity;
            return !minCapacity || !value || value >= minCapacity;
          }),
      });

    case 'custom':
      return Yup.object().shape({
        ...baseSchema,
        min_price: Yup.number()
          .required('Minimum price is required')
          .min(0, 'Minimum price must be 0 or greater')
          .max(99999999, 'Price is too large'),
        max_price: Yup.number()
          .required('Maximum price is required')
          .min(0, 'Maximum price must be 0 or greater')
          .max(99999999, 'Price is too large')
          .test('greater-than-min', 'Maximum price must be greater than minimum price', function (value) {
            const minPrice = this.parent.min_price;
            return !minPrice || !value || value > minPrice;
          }),
        base_price: Yup.number()
          .nullable()
          .min(0, 'Base price must be 0 or greater')
          .max(99999999, 'Price is too large'),
        price_unit: Yup.string().default('per_event'),
      });

    default:
      return Yup.object().shape(baseSchema);
  }
}

/**
 * Validate package form data
 */
export function validatePackageForm(
  data: any,
  packageType: PackageType
): { isValid: boolean; errors: Record<string, string> } {
  const schema = createPackageValidationSchema(packageType);
  const errors: Record<string, string> = {};

  try {
    schema.validateSync(data, { abortEarly: false });
    return { isValid: true, errors: {} };
  } catch (err: any) {
    if (err.inner) {
      err.inner.forEach((error: any) => {
        if (error.path) {
          errors[error.path] = error.message;
        }
      });
    }
    return { isValid: false, errors };
  }
}

