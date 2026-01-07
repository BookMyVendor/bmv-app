import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { PackageFormData, PackageType, Category } from '@/types/packages';
import { getBusinessCategories, getCategoryFormFields, createPackage, updatePackage, getPackage } from '@/lib/packageApi';
import { getCategoryConfig } from '@/lib/packageConfig';
import { validatePackageForm } from '@/lib/packageValidation';
import { supabaseCore } from '@/lib/supabase';
import PackageTypeSelector from '@/components/packages/PackageTypeSelector';
import PackagePricingForm from '@/components/packages/PackagePricingForm';
import IncludedServicesInput from '@/components/packages/IncludedServicesInput';
import TemplateSelector from '@/components/packages/TemplateSelector';
import CategoryFieldsForm from '@/components/packages/CategoryFieldsForm';
import { getTemplatesForCategory, applyTemplate, PackageTemplate } from '@/lib/packageTemplates';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STEPS = ['Category', 'Template', 'Type', 'Details', 'Pricing', 'Category Fields', 'Services', 'Review'];

export default function PackageFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: packageId, businessId: paramBusinessId } = useLocalSearchParams<{ id?: string; businessId?: string }>();
  const { user } = useAuth();
  const isEditMode = !!packageId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // Start at step 0 (Category selection)
  const [businessId, setBusinessId] = useState<string>(paramBusinessId || '');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryFormFields, setCategoryFormFields] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PackageTemplate | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<PackageTemplate[]>([]);

  const [formData, setFormData] = useState<Partial<PackageFormData>>({
    package_name: '',
    package_type: null,
    base_price: undefined,
    min_price: undefined,
    max_price: undefined,
    price_unit: 'per_event',
    min_capacity: undefined,
    max_capacity: undefined,
    package_description: '',
    included_services: [],
    is_active: true,
    sort_order: 0,
    categorySpecificFields: {},
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get business ID if not provided
      let actualBusinessId = businessId;
      if (!actualBusinessId && user?.id) {
        // Try to get business ID from user's businesses
        const { data: businesses, error: businessError } = await supabaseCore
          .from('vendor_businesses')
          .select('id')
          .eq('vendor_id', user.id)
          .limit(1)
          .single();

        if (!businessError && businesses) {
          actualBusinessId = businesses.id;
          setBusinessId(actualBusinessId);
        }
      }

      // Load categories
      if (actualBusinessId) {
        const { data: cats, error: catError } = await getBusinessCategories(actualBusinessId);
        if (catError) {
          console.error('Error loading categories:', catError);
          Alert.alert('Error', 'Failed to load categories. Please try again.');
        } else if (cats && cats.length > 0) {
          setCategories(cats as Category[]);
          // If only one category, auto-select and move to next step
          if (cats.length === 1) {
            const cat = cats[0] as Category;
            setSelectedCategory(cat);
            loadCategoryFields(cat.id);
            // Load templates for this category
            const templates = getTemplatesForCategory(cat.name);
            setAvailableTemplates(templates);
            // Auto-advance to template selection
            setCurrentStep(1);
          }
        } else {
          // No categories found
          setCategories([]);
        }
      } else {
        Alert.alert('Error', 'Business ID is required. Please navigate from business details.');
      }

      // Load package if editing
      if (isEditMode && packageId) {
        const { data: pkg } = await getPackage(packageId);
        if (pkg) {
          setFormData({
            ...pkg,
            categoryId: pkg.category_id || undefined,
          });
          if (pkg.category_id) {
            const cat = categories.find(c => c.id === pkg.category_id);
            if (cat) {
              setSelectedCategory(cat);
              loadCategoryFields(cat.id);
              // Load templates for this category
              const templates = getTemplatesForCategory(cat.name);
              setAvailableTemplates(templates);
            }
          }

          // Load category-specific fields if they exist
          if (pkg.category_id) {
            const { data: fields } = await getCategoryFormFields(pkg.category_id);
            if (fields) {
              setCategoryFormFields(fields);
              // Restore category-specific field values if they exist in package data
              // This would need to be stored in a JSONB column or similar
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryFields = async (categoryId: string) => {
    const { data: fields } = await getCategoryFormFields(categoryId);
    if (fields) {
      setCategoryFormFields(fields);
    }
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setFormData(prev => ({ ...prev, categoryId: category.id }));
    loadCategoryFields(category.id);

    // Load templates for this category
    const templates = getTemplatesForCategory(category.name);
    setAvailableTemplates(templates);

    setCurrentStep(1); // Move to template selection
  };

  const handleTemplateSelect = (template: PackageTemplate | null) => {
    setSelectedTemplate(template);

    if (template) {
      // Apply template to form data but keep navigation controlled by Next button
      const templateData = applyTemplate(template);
      setFormData(prev => ({
        ...prev,
        ...templateData,
        categorySpecificFields: prev.categorySpecificFields || {},
      }));
    }
  };

  const handleTypeSelect = (type: PackageType) => {
    const config = getCategoryConfig(selectedCategory?.name || '');
    setFormData(prev => ({
      ...prev,
      package_type: type,
      price_unit: config?.defaultPriceUnit || 'per_event',
    }));
    setCurrentStep(3); // Move to details
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!selectedCategory) {
        newErrors.category = 'Please select a category';
      }
    } else if (step === 2) {
      if (!formData.package_type) {
        newErrors.package_type = 'Please select a package type';
      }
    } else if (step === 3) {
      if (!formData.package_name?.trim()) {
        newErrors.package_name = 'Package name is required';
      }
    } else if (step >= 4) {
      // Validate pricing based on type
      if (formData.package_type) {
        const validation = validatePackageForm(formData, formData.package_type);
        Object.assign(newErrors, validation.errors);
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    // Control navigation from template step based on selection, but only via Next
    if (currentStep === 1) {
      const nextStep = selectedTemplate?.packageType ? 3 : 2;
      setCurrentStep(nextStep);
      return;
    }

    if (currentStep < STEPS.length - 1) {
      // Calculate next step, skipping "Category Fields" when there are no fields
      let nextStep = currentStep + 1;
      if (nextStep === 5 && categoryFormFields.length === 0) {
        nextStep = 6;
      }
      setCurrentStep(nextStep);
    } else {
      handleSave();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      // Calculate previous step, skipping "Category Fields" when there are no fields
      let previousStep = currentStep - 1;
      if (previousStep === 5 && categoryFormFields.length === 0) {
        previousStep = 4;
      }
      setCurrentStep(previousStep);
    }
  };

  const handleSave = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (!businessId) {
      Alert.alert('Error', 'Business ID is required');
      return;
    }

    try {
      setSaving(true);

      // Prepare package data, including category-specific fields
      const packageData = {
        ...formData,
        business_id: businessId,
        // Store category-specific fields - you may want to add a JSONB column for this
        // For now, we'll store it in a way that can be retrieved later
      };

      if (isEditMode && packageId) {
        const { error } = await updatePackage(packageId, packageData);
        if (error) throw error;
        // Close the form automatically after successful update
        router.back();
      } else {
        const { error } = await createPackage(packageData as any);
        if (error) throw error;
        // Close the form automatically after successful creation
        router.back();
      }
    } catch (error: any) {
      console.error('Error saving package:', error);
      Alert.alert('Error', error.message || 'Failed to save package. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    // Get category config once for use across multiple cases
    const categoryConfig = getCategoryConfig(selectedCategory?.name || '');

    switch (currentStep) {
      case 0: // Category selection
        if (categories.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No Categories Found</Text>
              <Text style={styles.emptyStateText}>
                Please register your business categories first in the business registration or edit section.
              </Text>
            </View>
          );
        }

        return (
          <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
            <View style={styles.categorySelectionContainer}>
              <Text style={styles.sectionTitle}>Select Category</Text>
              <Text style={styles.sectionDescription}>
                Choose the category for which you want to create a package
              </Text>

              <View style={styles.categoriesList}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      selectedCategory?.id === category.id && styles.categoryCardSelected,
                    ]}
                    onPress={() => handleCategorySelect(category)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryIcon}>{category.icon || '📦'}</Text>
                    <View style={styles.categoryCardContent}>
                      <Text style={styles.categoryCardName}>{category.name}</Text>
                    </View>
                    {selectedCategory?.id === category.id && (
                      <ChevronRight size={20} color={Colors.primary.main} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        );

      case 1: // Template selection
        if (!selectedCategory) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Please select a category first</Text>
            </View>
          );
        }
        return (
          <TemplateSelector
            templates={availableTemplates}
            onSelect={handleTemplateSelect}
            selectedTemplateId={selectedTemplate?.id || null}
          />
        );

      case 2: // Type selection
        return (
          <PackageTypeSelector
            selectedType={formData.package_type || null}
            onSelect={handleTypeSelect}
            recommendedTypes={categoryConfig?.recommendedPackageTypes || []}
          />
        );

      case 3: // Details
        return (
          <ScrollView style={styles.stepContent}>
            <View style={styles.field}>
              <Text style={styles.label}>
                Package Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.package_name && styles.inputError]}
                value={formData.package_name || ''}
                onChangeText={(text) => handleFieldChange('package_name', text)}
                placeholder="e.g., Wedding Photography Package"
                placeholderTextColor={Colors.text.tertiary}
              />
              {errors.package_name && (
                <Text style={styles.errorText}>{errors.package_name}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textArea, errors.package_description && styles.inputError]}
                value={formData.package_description || ''}
                onChangeText={(text) => handleFieldChange('package_description', text)}
                placeholder="Describe what's included in this package..."
                placeholderTextColor={Colors.text.tertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              {errors.package_description && (
                <Text style={styles.errorText}>{errors.package_description}</Text>
              )}
            </View>
          </ScrollView>
        );

      case 4: // Pricing
        if (!formData.package_type) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Please select a package type first</Text>
            </View>
          );
        }
        return (
          <PackagePricingForm
            packageType={formData.package_type}
            formData={formData}
            onChange={handleFieldChange}
            errors={errors}
          />
        );

      case 5: // Category-specific fields
        if (categoryFormFields.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No additional fields required for this category
              </Text>
            </View>
          );
        }
        return (
          <CategoryFieldsForm
            fields={categoryFormFields}
            values={formData.categorySpecificFields || {}}
            onChange={(fieldName, value) => {
              setFormData(prev => ({
                ...prev,
                categorySpecificFields: {
                  ...prev.categorySpecificFields,
                  [fieldName]: value,
                },
              }));
            }}
            errors={Object.fromEntries(
              Object.entries(errors)
                .filter(([key]) => key.startsWith('category_'))
                .map(([key, value]) => [key.replace('category_', ''), value])
            )}
          />
        );

      case 6: // Services
        const serviceSuggestions = categoryConfig?.customFields
          ?.find(f => f.field_name === 'deliverables')?.field_options?.options || [];

        return (
          <ScrollView style={styles.stepContent}>
            <IncludedServicesInput
              services={formData.included_services || []}
              onChange={(services) => handleFieldChange('included_services', services)}
              suggestions={serviceSuggestions}
            />
          </ScrollView>
        );

      case 7: // Review
        return (
          <ScrollView style={styles.stepContent}>
            <View style={styles.reviewSection}>
              <Text style={styles.reviewTitle}>Review Package Details</Text>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Package Name:</Text>
                <Text style={styles.reviewValue}>{formData.package_name || 'N/A'}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Category:</Text>
                <Text style={styles.reviewValue}>{selectedCategory?.name || 'N/A'}</Text>
              </View>

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Package Type:</Text>
                <Text style={styles.reviewValue}>
                  {PACKAGE_TYPE_CONFIGS[formData.package_type || 'fixed']?.label || 'N/A'}
                </Text>
              </View>

              {/* Add more review items based on package type */}

              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Included Services:</Text>
                <Text style={styles.reviewValue}>
                  {formData.included_services?.length ? formData.included_services.join(', ') : 'None'}
                </Text>
              </View>

              {categoryFormFields.length > 0 && formData.categorySpecificFields && Object.keys(formData.categorySpecificFields).length > 0 && (
                <View style={styles.reviewItem}>
                  <Text style={styles.reviewLabel}>Additional Details:</Text>
                  {categoryFormFields.map((field) => {
                    const value = formData.categorySpecificFields?.[field.field_name];
                    if (!value || (Array.isArray(value) && value.length === 0)) return null;
                    return (
                      <View key={field.id || field.field_name} style={styles.reviewSubItem}>
                        <Text style={styles.reviewSubLabel}>{field.field_label}:</Text>
                        <Text style={styles.reviewSubValue}>
                          {Array.isArray(value) ? value.join(', ') : value.toString()}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.main} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Package' : 'Create Package'}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.progressBar}>
        {STEPS.map((step, index) => (
          <View
            key={index}
            style={[
              styles.progressStep,
              index <= currentStep && styles.progressStepActive,
            ]}
          />
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handlePrevious}
            disabled={saving}
          >
            <Text style={styles.buttonSecondaryText}>Previous</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary, currentStep === 0 && styles.buttonFull]}
          onPress={currentStep === STEPS.length - 1 ? handleSave : handleNext}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.neutral.white} />
          ) : (
            <Text style={styles.buttonPrimaryText}>
              {currentStep === STEPS.length - 1 ? (isEditMode ? 'Update' : 'Create') : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// Import PACKAGE_TYPE_CONFIGS
import { PACKAGE_TYPE_CONFIGS } from '@/lib/packageConfig';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral.lighter,
    ...Shadows.sm,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  headerRight: {
    width: 40,
  },
  progressBar: {
    flexDirection: 'row',
    height: 4,
    backgroundColor: Colors.neutral.lighter,
  },
  progressStep: {
    flex: 1,
    backgroundColor: Colors.neutral.lighter,
  },
  progressStepActive: {
    backgroundColor: Colors.primary.main,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  stepContent: {
    flex: 1,
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
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  categorySelectionContainer: {
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
  },
  categoriesList: {
    gap: Spacing.md,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.neutral.lighter,
    ...Shadows.sm,
  },
  categoryCardSelected: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary.light + '10',
  },
  categoryIcon: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  categoryCardContent: {
    flex: 1,
  },
  categoryCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  categoryInfo: {
    padding: Spacing.lg,
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  categoryName: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  categoryDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  reviewSection: {
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  reviewItem: {
    marginBottom: Spacing.md,
  },
  reviewLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  reviewValue: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  reviewSubItem: {
    marginTop: Spacing.xs,
    marginLeft: Spacing.md,
  },
  reviewSubLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  reviewSubValue: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.lighter,
    ...Shadows.md,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFull: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: Colors.primary.main,
  },
  buttonSecondary: {
    backgroundColor: Colors.neutral.lighter,
  },
  buttonPrimaryText: {
    color: Colors.neutral.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});

