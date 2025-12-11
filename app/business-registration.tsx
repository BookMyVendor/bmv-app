import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  AppState,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore } from '@/lib/supabase';
import BasicInformationStep from '@/components/registration/BasicInformationStep';
import ServicesExperienceStep from '@/components/registration/ServicesExperienceStep';
import LocationCoverageStep from '@/components/registration/LocationCoverageStep';
import VerificationStep from '@/components/registration/VerificationStep';
import PortfolioSocialStep from '@/components/registration/PortfolioSocialStep';
import { pickMultipleImages, uploadMultipleBusinessImages, uploadMultipleVerificationDocuments, UploadDocumentData } from '@/lib/businessApi';
import { INDIAN_STATES } from '@/constants/indianStates';
import { TextInput } from '@/components/TextInput';
import { Dropdown } from '@/components/Dropdown';
import Logo from '@/components/Logo';

interface BusinessData {
  businessName: string;
  contactPersonName: string;
  contactPersonRole?: string; // Add this
  email: string;
  phoneNumber: string;
  selectedRootCategoryId?: string | null;
  selectedCategoryIds?: string[];
  selectedEventIds?: string[];
  businessDescription: string;
  yearsOfExperience: string;
  businessAddress: string;
  city: string;
  state: string;
  pincode?: string; // Add this
  serviceRadiusKm?: number; // Add this
  operatingLocations?: string[]; // Add this (for future use)
  gstNumber: string;
  panNumber: string; // Changed from businessRegistrationNumber
  verificationDocuments?: Record<string, any[]>; // Document files by type code
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  portfolioImages: string[];
  coverPhotoUri?: string; // Add this
}

const STORAGE_KEY = 'business_registration_data';
const STORAGE_PAGE_KEY = 'business_registration_page';

export default function BusinessRegistrationScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const [businessData, setBusinessData] = useState<Partial<BusinessData>>({});
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isRestored, setIsRestored] = useState(false);
  const { user, profile } = useAuth();
  const router = useRouter();

  // Save form data to AsyncStorage whenever it changes
  useEffect(() => {
    if (isRestored) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(businessData));
          await AsyncStorage.setItem(STORAGE_PAGE_KEY, currentPage.toString());
        } catch (error) {
          console.error('Error saving business registration data:', error);
        }
      };
      saveData();
    }
  }, [businessData, currentPage, isRestored]);

  // Restore form data from AsyncStorage when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const restoreData = async () => {
        try {
          const savedData = await AsyncStorage.getItem(STORAGE_KEY);
          const savedPage = await AsyncStorage.getItem(STORAGE_PAGE_KEY);
          
          if (savedData) {
            const parsedData = JSON.parse(savedData);
            setBusinessData(parsedData);
          }
          
          if (savedPage) {
            setCurrentPage(parseInt(savedPage, 10));
          }
          
          setIsRestored(true);
        } catch (error) {
          console.error('Error restoring business registration data:', error);
          setIsRestored(true);
        }
      };
      
      restoreData();
    }, [])
  );

  // Initialize business data with vendor's phone and email when component mounts
  useEffect(() => {
    if (profile && isRestored) {
      setBusinessData((prev) => {
        // Only set if not already set (don't overwrite user input or restored data)
        const updated: Partial<BusinessData> = { ...prev };
        if (!prev.phoneNumber && profile.phone) {
          updated.phoneNumber = profile.phone;
        }
        if (!prev.email && profile.email) {
          updated.email = profile.email;
        }
        return updated;
      });
    }
  }, [profile, isRestored]);

  // Clear saved data when registration is successfully submitted
  const clearSavedData = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await AsyncStorage.removeItem(STORAGE_PAGE_KEY);
    } catch (error) {
      console.error('Error clearing saved data:', error);
    }
  };

  const totalSteps = 5;

  const handleNext = () => {
    // Dismiss keyboard before validation
    Keyboard.dismiss();
    
    // Validate current step before proceeding
    const errors: Record<string, string> = {};
    
    if (currentPage === 0) {
      // Basic Information step
      if (!businessData.businessName || !businessData.businessName.trim()) {
        errors.businessName = 'Business name is required';
      }
      if (!businessData.contactPersonName || !businessData.contactPersonName.trim()) {
        errors.contactPersonName = 'Contact person name is required';
      }
      if (!businessData.email || !businessData.email.trim()) {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessData.email)) {
        errors.email = 'Please enter a valid email address';
      }
      if (!businessData.phoneNumber || !businessData.phoneNumber.trim()) {
        errors.phoneNumber = 'Phone number is required';
      }
    } else if (currentPage === 1) {
      // Services & Experience step
      // Only require at least one category to be selected (root or child)
      if (!businessData.selectedRootCategoryId && (!businessData.selectedCategoryIds || businessData.selectedCategoryIds.length === 0)) {
        errors.selectedCategoryIds = 'Please select at least one service category';
      }
      if (!businessData.selectedEventIds || businessData.selectedEventIds.length === 0) {
        errors.selectedEventIds = 'Please select at least one event type';
      }
      if (!businessData.businessDescription || !businessData.businessDescription.trim()) {
        errors.businessDescription = 'Business description is required';
      }
      if (!businessData.yearsOfExperience || !businessData.yearsOfExperience.trim()) {
        errors.yearsOfExperience = 'Years of experience is required';
      }
    } else if (currentPage === 2) {
      // Location & Coverage step
      if (!businessData.businessAddress || !businessData.businessAddress.trim()) {
        errors.businessAddress = 'Business address is required';
      }
      if (!businessData.pincode || !businessData.pincode.trim()) {
        errors.pincode = 'Pincode is required';
      } else if (businessData.pincode.length !== 6) {
        errors.pincode = 'Pincode must be 6 digits';
      }
      if (!businessData.city || !businessData.city.trim()) {
        errors.city = 'City/Town is required';
      }
      if (!businessData.state || !businessData.state.trim()) {
        errors.state = 'State is required';
      }
    } else if (currentPage === 3) {
      // Verification step - validate PAN number and PAN card image
      if (!businessData.panNumber || !businessData.panNumber.trim()) {
        errors.panNumber = 'PAN number is required';
      }
      
      const panDocuments = businessData.verificationDocuments?.['pan'];
      if (!panDocuments || panDocuments.length === 0) {
        errors.panDocument = 'PAN card document is required. Please upload your PAN card.';
      }
    }
    // Step 4 (Portfolio & Social) has no mandatory fields
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Alert.alert(
        'Validation Error',
        'Please complete all required fields:\n\n' + Object.values(errors).join('\n'),
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Clear validation errors when moving to next step
    setValidationErrors({});
    
    if (currentPage < totalSteps - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const hasEnteredData = () => {
    // Check if any significant data has been entered
    return !!(
      businessData.businessName ||
      businessData.contactPersonName ||
      businessData.email ||
      businessData.phoneNumber ||
      businessData.panNumber ||
      businessData.businessDescription ||
      businessData.businessAddress ||
      businessData.city ||
      businessData.state ||
      (businessData.selectedCategoryIds && businessData.selectedCategoryIds.length > 0) ||
      (businessData.selectedEventIds && businessData.selectedEventIds.length > 0) ||
      (businessData.portfolioImages && businessData.portfolioImages.length > 0) ||
      (businessData.verificationDocuments && Object.keys(businessData.verificationDocuments).length > 0)
    );
  };

  const handleCancel = () => {
    console.log('Close button pressed');
    // Dismiss keyboard first to ensure proper navigation and button responsiveness
    Keyboard.dismiss();
    
    // Use setTimeout to ensure keyboard is fully dismissed before showing alert
    setTimeout(() => {
      if (hasEnteredData()) {
        Alert.alert(
          'Cancel Registration?',
          'You have entered some information. Are you sure you want to cancel? All entered data will be lost.',
          [
            {
              text: 'Continue Registration',
              style: 'cancel',
            },
            {
              text: 'Cancel',
              style: 'destructive',
              onPress: async () => {
                // Clear saved data when user cancels
                await clearSavedData();
                console.log('Navigating to dashboard after cancel');
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else {
        // No data entered, clear saved data and navigate away
        clearSavedData().then(() => {
          console.log('Navigating to dashboard (no data entered)');
          router.replace('/(tabs)');
        }).catch(() => {
          console.log('Navigating to dashboard (clear data error)');
          router.replace('/(tabs)');
        });
      }
    }, 100);
  };

  const updateBusinessData = (data: Partial<BusinessData>) => {
    setBusinessData((prev) => ({ ...prev, ...data }));
    
    // Clear validation errors when user fixes the issues
    if (Object.keys(validationErrors).length > 0) {
      const updatedErrors = { ...validationErrors };
      let hasChanges = false;
      
      // Clear errors for fields that are being updated
      if (data.businessName !== undefined && data.businessName.trim() && updatedErrors.businessName) {
        delete updatedErrors.businessName;
        hasChanges = true;
      }
      if (data.contactPersonName !== undefined && data.contactPersonName.trim() && updatedErrors.contactPersonName) {
        delete updatedErrors.contactPersonName;
        hasChanges = true;
      }
      if (data.email !== undefined && data.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) && updatedErrors.email) {
        delete updatedErrors.email;
        hasChanges = true;
      }
      if (data.phoneNumber !== undefined && data.phoneNumber.trim() && updatedErrors.phoneNumber) {
        delete updatedErrors.phoneNumber;
        hasChanges = true;
      }
      if (data.selectedRootCategoryId !== undefined && updatedErrors.selectedRootCategoryId) {
        delete updatedErrors.selectedRootCategoryId;
        hasChanges = true;
      }
      if (data.selectedCategoryIds !== undefined && data.selectedCategoryIds.length > 0 && updatedErrors.selectedCategoryIds) {
        delete updatedErrors.selectedCategoryIds;
        hasChanges = true;
      }
      if (data.selectedEventIds !== undefined && data.selectedEventIds.length > 0 && updatedErrors.selectedEventIds) {
        delete updatedErrors.selectedEventIds;
        hasChanges = true;
      }
      if (data.businessDescription !== undefined && data.businessDescription.trim() && updatedErrors.businessDescription) {
        delete updatedErrors.businessDescription;
        hasChanges = true;
      }
      if (data.yearsOfExperience !== undefined && data.yearsOfExperience.trim() && updatedErrors.yearsOfExperience) {
        delete updatedErrors.yearsOfExperience;
        hasChanges = true;
      }
      if (data.businessAddress !== undefined && data.businessAddress.trim() && updatedErrors.businessAddress) {
        delete updatedErrors.businessAddress;
        hasChanges = true;
      }
      if (data.pincode !== undefined && data.pincode.trim() && data.pincode.length === 6 && updatedErrors.pincode) {
        delete updatedErrors.pincode;
        hasChanges = true;
      }
      if (data.city !== undefined && data.city.trim() && updatedErrors.city) {
        delete updatedErrors.city;
        hasChanges = true;
      }
      if (data.state !== undefined && data.state.trim() && updatedErrors.state) {
        delete updatedErrors.state;
        hasChanges = true;
      }
      if (data.panNumber !== undefined && data.panNumber.trim() && updatedErrors.panNumber) {
        delete updatedErrors.panNumber;
        hasChanges = true;
      }
      if (data.verificationDocuments !== undefined) {
        const panDocuments = data.verificationDocuments?.['pan'];
        if (panDocuments && panDocuments.length > 0 && updatedErrors.panDocument) {
          delete updatedErrors.panDocument;
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        setValidationErrors(updatedErrors);
      }
    }
  };

  const handleSubmit = async () => {
    // Validate PAN number is provided
    if (!businessData.panNumber || !businessData.panNumber.trim()) {
      Alert.alert('Validation Error', 'PAN is required. Please enter your PAN number.');
      setSubmitting(false);
      return;
    }

    // Validate PAN document is uploaded
    const panDocuments = businessData.verificationDocuments?.['pan'];
    if (!panDocuments || panDocuments.length === 0) {
      Alert.alert('Validation Error', 'PAN card document is required. Please upload your PAN card in the Verification step.');
      setSubmitting(false);
      return;
    }

    setSubmitting(true);

    try {
      const parseYearsOfExperience = (yearsStr: string): number => {
        if (!yearsStr) return 0;
        const match = yearsStr.match(/\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          return num;
        }
        if (yearsStr.toLowerCase().includes('more')) {
          return 10;
        }
        return 0;
      };

      // Step 1: Upload cover photo if provided
      let coverPhotoUrl = null;
      if (businessData.coverPhotoUri) {
        // Upload cover photo to storage and get URL
        // This should use the same logic as profile photo upload
        // For now, we'll handle it after business creation
      }

      // Step 2: Create business with all fields
      const { data: createdBusiness, error: businessError } = await supabaseCore
        .from('vendor_businesses')
        .insert({
          vendor_id: user?.id,
          business_name: businessData.businessName,
          business_email: businessData.email,
          description: businessData.businessDescription,
          address: businessData.businessAddress,
          city: businessData.city,
          state: businessData.state,
          pincode: businessData.pincode || null,
          latitude: null,
          longitude: null,
          operating_locations: businessData.operatingLocations || [],
          service_radius_km: businessData.serviceRadiusKm || 0,
          contact_person_name: businessData.contactPersonName,
          contact_person_phone: businessData.phoneNumber, // Add this line
          contact_person_role: businessData.contactPersonRole || null,
          business_registration_number: businessData.panNumber || null, // PAN stored in business_registration_number field
          website_url: businessData.websiteUrl || null,
          instagram_url: businessData.instagramUrl || null,
          facebook_url: businessData.facebookUrl || null,
          youtube_url: businessData.youtubeUrl || null,
          cover_photo_url: coverPhotoUrl,
          years_experience: parseYearsOfExperience(businessData.yearsOfExperience || '0'),
          gst_number: businessData.gstNumber || null,
          status: 'pending',
          subscription_status: 'trial',
        })
        .select()
        .single();

      if (businessError) throw businessError;
      if (!createdBusiness) throw new Error('Failed to create business');

      // Step 3: Upload portfolio images if provided (after business is created)
      if (businessData.portfolioImages && businessData.portfolioImages.length > 0) {
        try {
          await uploadMultipleBusinessImages(
            createdBusiness.id,
            businessData.portfolioImages,
            (current, total) => {
              console.log(`Uploading portfolio images ${current}/${total}`);
            }
          );
        } catch (imageError) {
          console.error('Error uploading portfolio images:', imageError);
          // Don't fail the entire registration if images fail
        }
      }

      // Step 3.5: Upload verification documents if provided
      if (businessData.verificationDocuments) {
        try {
          const documentsToUpload: UploadDocumentData[] = [];
          
          // Flatten all documents by type into upload format
          Object.entries(businessData.verificationDocuments).forEach(([typeCode, files]) => {
            if (Array.isArray(files) && files.length > 0) {
              files.forEach((file) => {
                documentsToUpload.push({
                  documentTypeCode: typeCode,
                  file: file,
                });
              });
            }
          });

          if (documentsToUpload.length > 0) {
            const { data: uploadedDocs, errors } = await uploadMultipleVerificationDocuments(
              createdBusiness.id,
              documentsToUpload
            );

            if (errors.length > 0) {
              console.error('Some documents failed to upload:', errors);
              // Don't fail the entire registration if documents fail
            } else {
              console.log(`Successfully uploaded ${uploadedDocs.length} verification documents`);
            }
          }
        } catch (docError) {
          console.error('Error uploading verification documents:', docError);
          // Don't fail the entire registration if documents fail
        }
      }

      // Step 4: Insert category mappings
      const categoryMappings = [];

      // Add selected business category IDs
      if (businessData.selectedCategoryIds && businessData.selectedCategoryIds.length > 0) {
        businessData.selectedCategoryIds.forEach((categoryId) => {
          categoryMappings.push({
            vendor_id: user?.id,
            business_id: createdBusiness.id,
            category_id: categoryId,
          });
        });
      }

      // Add event category IDs
      if (businessData.selectedEventIds && businessData.selectedEventIds.length > 0) {
        businessData.selectedEventIds.forEach((categoryId: string) => {
          categoryMappings.push({
            vendor_id: user?.id,
            business_id: createdBusiness.id,
            category_id: categoryId,
          });
        });
      }

      // Insert all category mappings in a single batch
      if (categoryMappings.length > 0) {
        const { error: mappingError } = await supabaseCore
          .from('vendor_business_category_mappings')
          .insert(categoryMappings);

        if (mappingError) {
          console.error('Error inserting category mappings:', mappingError);
        }
      }

      // Clear saved form data before navigating
      await clearSavedData();
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Error submitting business:', error);
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    {
      title: 'Basic Information',
      subtitle: 'Tell us about your business',
      component: (
        <BasicInformationStep
          data={businessData}
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
        />
      ),
    },
    {
      title: 'Services & Experience',
      subtitle: 'What services do you provide?',
      component: (
        <ServicesExperienceStep
          data={businessData}
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
        />
      ),
    },
    {
      title: 'Location & Coverage',
      subtitle: 'Where do you operate?',
      component: (
        <LocationCoverageStep
          data={businessData}
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
        />
      ),
    },
    {
      title: 'Verification',
      subtitle: 'Verify your business',
      component: (
        <VerificationStep 
          data={businessData} 
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
        />
      ),
    },
    {
      title: 'Portfolio & Social',
      subtitle: 'Showcase your work',
      component: (
        <PortfolioSocialStep
          data={businessData}
          onUpdate={updateBusinessData}
        />
      ),
    },
  ];

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Logo size={48} style={styles.headerLogo} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>{steps[currentPage].title}</Text>
            <Text style={styles.subtitle}>{steps[currentPage].subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.7}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            accessibilityLabel="Close registration"
            accessibilityRole="button"
            disabled={submitting}
          >
            <X size={24} color="#666" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
        <View style={styles.progressContainer}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index <= currentPage && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {steps[currentPage].component}
      </ScrollView>

      <View style={styles.footer}>
        {currentPage > 0 && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handlePrevious}
          >
            <ChevronLeft size={20} color="#007AFF" />
            <Text style={styles.secondaryButtonText}>Previous</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        {currentPage < totalSteps - 1 ? (
          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>Next Step</Text>
            <ChevronRight size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Submit Registration</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    position: 'relative',
  },
  headerLogo: {
    marginRight: 12,
    marginVertical: 0,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 16,
    flexShrink: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  cancelButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -4,
    zIndex: 9999,
    elevation: 10, // For Android
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  progressDotActive: {
    backgroundColor: '#007AFF',
  },
  pager: {
    flex: 1,
  },
  pagerContent: {
    flexGrow: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1a1a1a',
  },
});
