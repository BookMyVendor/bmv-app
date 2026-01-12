import React from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { CategoryFormField } from '../../types/packages';
import Dropdown from '../../components/Dropdown';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';

interface CategoryFieldsFormProps {
  fields: CategoryFormField[];
  values: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
}

export default function CategoryFieldsForm({
  fields,
  values,
  onChange,
  errors = {},
}: CategoryFieldsFormProps) {
  if (fields.length === 0) {
    return null;
  }

  const renderField = (field: CategoryFormField) => {
    const value = values[field.field_name] || '';
    const error = errors[field.field_name];
    const isRequired = field.is_required;

    switch (field.field_type) {
      case 'text':
        return (
          <View key={field.id || field.field_name} style={styles.field}>
            <Text style={styles.label}>
              {field.field_label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={value.toString()}
              onChangeText={(text) => onChange(field.field_name, text)}
              placeholder={`Enter ${field.field_label.toLowerCase()}`}
              placeholderTextColor={Colors.text.tertiary}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'textarea':
        return (
          <View key={field.id || field.field_name} style={styles.field}>
            <Text style={styles.label}>
              {field.field_label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.textArea, error && styles.inputError]}
              value={value.toString()}
              onChangeText={(text) => onChange(field.field_name, text)}
              placeholder={`Enter ${field.field_label.toLowerCase()}`}
              placeholderTextColor={Colors.text.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'number':
        return (
          <View key={field.id || field.field_name} style={styles.field}>
            <Text style={styles.label}>
              {field.field_label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={value.toString()}
              onChangeText={(text) => {
                const num = parseFloat(text) || (text === '' ? null : 0);
                onChange(field.field_name, num);
              }}
              placeholder={`Enter ${field.field_label.toLowerCase()}`}
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="numeric"
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            {field.validation_rules && (
              <Text style={styles.helperText}>
                {field.validation_rules.min !== undefined && `Min: ${field.validation_rules.min}`}
                {field.validation_rules.min !== undefined && field.validation_rules.max !== undefined && ' • '}
                {field.validation_rules.max !== undefined && `Max: ${field.validation_rules.max}`}
              </Text>
            )}
          </View>
        );

      case 'select':
        const selectOptions = field.field_options?.options || [];
        return (
          <View key={field.id || field.field_name} style={styles.field}>
            <Text style={styles.label}>
              {field.field_label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <Dropdown
              options={selectOptions.map(opt => ({ label: opt, value: opt }))}
              value={value}
              onSelect={(selectedValue) => onChange(field.field_name, selectedValue)}
              placeholder={`Select ${field.field_label.toLowerCase()}`}
              error={error}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      case 'multiselect':
        const multiOptions = field.field_options?.options || [];
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <View key={field.id || field.field_name} style={styles.field}>
            <Text style={styles.label}>
              {field.field_label} {isRequired && <Text style={styles.required}>*</Text>}
            </Text>
            <View style={styles.optionsContainer}>
              {multiOptions.map((option) => {
                const isSelected = selectedValues.includes(option);
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionChip,
                      isSelected && styles.optionChipSelected,
                    ]}
                    onPress={() => {
                      const newValues = isSelected
                        ? selectedValues.filter(v => v !== option)
                        : [...selectedValues, option];
                      onChange(field.field_name, newValues);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Additional Details</Text>
        <Text style={styles.sectionDescription}>
          Provide additional information specific to this category
        </Text>
        {fields.map(renderField)}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.lg,
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
  textArea: {
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.neutral.lighter,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text.primary,
    minHeight: 100,
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
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral.lighter,
    borderWidth: 1,
    borderColor: Colors.neutral.lighter,
  },
  optionChipSelected: {
    backgroundColor: Colors.primary.light + '20',
    borderColor: Colors.primary.main,
  },
  optionText: {
    fontSize: 12,
    color: Colors.text.primary,
  },
  optionTextSelected: {
    color: Colors.primary.dark,
    fontWeight: '600',
  },
});

