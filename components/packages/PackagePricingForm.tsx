import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native';
import { PackageType, PackageFormData } from '@/types/packages';
import { PACKAGE_TYPE_CONFIGS, PRICE_UNIT_OPTIONS } from '@/lib/packageConfig';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';
import Dropdown from '@/components/Dropdown';

interface PackagePricingFormProps {
  packageType: PackageType;
  formData: Partial<PackageFormData>;
  onChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

export default function PackagePricingForm({
  packageType,
  formData,
  onChange,
  errors = {},
}: PackagePricingFormProps) {
  const config = PACKAGE_TYPE_CONFIGS[packageType];

  const renderPriceInput = () => {
    switch (packageType) {
      case 'fixed':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>
                {config.priceFieldLabel} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.priceInput, errors.base_price && styles.inputError]}
                  value={formData.base_price?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    onChange('base_price', num);
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
              </View>
              {errors.base_price && (
                <Text style={styles.errorText}>{errors.base_price}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Price Unit</Text>
              <Dropdown
                options={PRICE_UNIT_OPTIONS.map(opt => ({ label: opt.label, value: opt.value }))}
                value={formData.price_unit || 'per_event'}
                onSelect={(value) => onChange('price_unit', value)}
                placeholder="Select unit"
              />
            </View>
          </>
        );

      case 'hourly':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>
                {config.priceFieldLabel} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.priceInput, errors.base_price && styles.inputError]}
                  value={formData.base_price?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    onChange('base_price', num);
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
                <Text style={styles.unitLabel}>/ hour</Text>
              </View>
              {errors.base_price && (
                <Text style={styles.errorText}>{errors.base_price}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Minimum Hours (Optional)</Text>
              <TextInput
                style={[styles.input, errors.min_capacity && styles.inputError]}
                value={formData.min_capacity?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text) || null;
                  onChange('min_capacity', num);
                }}
                placeholder="e.g., 4"
                keyboardType="numeric"
                placeholderTextColor={Colors.text.tertiary}
              />
              {errors.min_capacity && (
                <Text style={styles.errorText}>{errors.min_capacity}</Text>
              )}
              <Text style={styles.helperText}>
                Minimum number of hours required for this package
              </Text>
            </View>
          </>
        );

      case 'per_person':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>
                {config.priceFieldLabel} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.priceInput, errors.base_price && styles.inputError]}
                  value={formData.base_price?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || 0;
                    onChange('base_price', num);
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
                <Text style={styles.unitLabel}>/ person</Text>
              </View>
              {errors.base_price && (
                <Text style={styles.errorText}>{errors.base_price}</Text>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.halfField]}>
                <Text style={styles.label}>
                  Minimum Capacity <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.min_capacity && styles.inputError]}
                  value={formData.min_capacity?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseInt(text) || null;
                    onChange('min_capacity', num);
                  }}
                  placeholder="e.g., 50"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
                {errors.min_capacity && (
                  <Text style={styles.errorText}>{errors.min_capacity}</Text>
                )}
              </View>

              <View style={[styles.field, styles.halfField]}>
                <Text style={styles.label}>
                  Maximum Capacity <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, errors.max_capacity && styles.inputError]}
                  value={formData.max_capacity?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseInt(text) || null;
                    onChange('max_capacity', num);
                  }}
                  placeholder="e.g., 500"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
                {errors.max_capacity && (
                  <Text style={styles.errorText}>{errors.max_capacity}</Text>
                )}
              </View>
            </View>
          </>
        );

      case 'custom':
        return (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>
                Minimum Price <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.priceInput, errors.min_price && styles.inputError]}
                  value={formData.min_price?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || null;
                    onChange('min_price', num);
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
              </View>
              {errors.min_price && (
                <Text style={styles.errorText}>{errors.min_price}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                Maximum Price <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.priceInput, errors.max_price && styles.inputError]}
                  value={formData.max_price?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || null;
                    onChange('max_price', num);
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
              </View>
              {errors.max_price && (
                <Text style={styles.errorText}>{errors.max_price}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Base Price (Estimate, Optional)</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.priceInput, errors.base_price && styles.inputError]}
                  value={formData.base_price?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text) || null;
                    onChange('base_price', num);
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  placeholderTextColor={Colors.text.tertiary}
                />
              </View>
              {errors.base_price && (
                <Text style={styles.errorText}>{errors.base_price}</Text>
              )}
              <Text style={styles.helperText}>
                Estimated average price for this package
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Price Unit</Text>
              <Dropdown
                options={PRICE_UNIT_OPTIONS.map(opt => ({ label: opt.label, value: opt.value }))}
                value={formData.price_unit || 'per_event'}
                onSelect={(value) => onChange('price_unit', value)}
                placeholder="Select unit"
              />
            </View>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {renderPriceInput()}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
  },
  field: {
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  required: {
    color: Colors.error.main,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.neutral.lighter,
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  currency: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginRight: Spacing.xs,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    paddingVertical: Spacing.md,
  },
  unitLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.neutral.lighter,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text.primary,
    ...Shadows.sm,
  },
  inputError: {
    borderColor: Colors.error.main,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error.main,
    marginTop: Spacing.xs,
  },
  helperText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
});

