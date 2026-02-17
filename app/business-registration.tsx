import React, { useState, useEffect, useRef } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabaseCore } from '../lib/supabase';
import BasicInformationStep, { BasicInformationStepRef } from '../components/registration/BasicInformationStep';
import ServicesExperienceStep, { ServicesExperienceStepRef } from '../components/registration/ServicesExperienceStep';
import LocationCoverageStep, { LocationCoverageStepRef } from '../components/registration/LocationCoverageStep';
import VerificationStep, { VerificationStepRef } from '../components/registration/VerificationStep';
import PortfolioSocialStep from '../components/registration/PortfolioSocialStep';
import { pickMultipleImages, uploadMultipleBusinessImages, uploadMultipleVerificationDocuments, UploadDocumentData, uploadBusinessImage, setCoverImage } from '../lib/businessApi';
import Dropdown from '../components/Dropdown';
import Logo from '../components/Logo';
import { validateEmail, getEmailError } from '../lib/validation';
import { createPackage } from '../lib/packageApi';
import ScreenBackground from '../components/ScreenBackground';
import { stripCountryCode } from '../lib/formatters';

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
  basePrice: string;
  pricingUnit: string;
  businessAddress: string;
  city: string;
  state: string;
  pincode?: string; // Add this
  locality?: string; // Add this
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
  const basicInfoStepRef = useRef<BasicInformationStepRef>(null);
  const servicesStepRef = useRef<ServicesExperienceStepRef>(null);
  const locationStepRef = useRef<LocationCoverageStepRef>(null);
  const verificationStepRef = useRef<VerificationStepRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const insets = useSafeAreaInsets();

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
          updated.phoneNumber = stripCountryCode(profile.phone);
        }
        if (!prev.email && profile.email) {
          updated.email = profile.email;
        }
        return updated;
      });
    }
  }, [profile, isRestored]);

  const handleFieldFocus = () => {
    // Add a small delay to ensure the keyboard has started showing
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

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

  // Check if all mandatory fields are filled for current step
  const areMandatoryFieldsFilled = (): boolean => {
    if (currentPage === 0) {
      // Basic Information step - all fields must be filled AND valid
      const hasBusinessName = !!(businessData.businessName?.trim());
      const hasContactName = !!(businessData.contactPersonName?.trim());
      const hasEmail = !!(businessData.email?.trim()) && validateEmail(businessData.email);
      const hasPhone = !!(businessData.phoneNumber?.trim());
      return hasBusinessName && hasContactName && hasEmail && hasPhone;
    } else if (currentPage === 1) {
      // Services & Experience step
      const hasCategory = !!(businessData.selectedRootCategoryId || (businessData.selectedCategoryIds && businessData.selectedCategoryIds.length > 0));
      const hasEvents = !!(businessData.selectedEventIds && businessData.selectedEventIds.length > 0);
      const hasDescription = !!(businessData.businessDescription?.trim());
      const hasExperience = !!(businessData.yearsOfExperience?.trim());
      const hasBasePrice = !!(businessData.basePrice?.trim());
      const hasPricingUnit = !!(businessData.pricingUnit?.trim());
      return hasCategory && hasEvents && hasDescription && hasExperience && hasBasePrice && hasPricingUnit;
    } else if (currentPage === 2) {
      // Location & Coverage step
      const hasAddress = !!(businessData.businessAddress?.trim());
      const hasPincode = !!(businessData.pincode?.trim()) && businessData.pincode.length === 6;
      const hasCity = !!(businessData.city?.trim());
      const hasState = !!(businessData.state?.trim());
      return hasAddress && hasPincode && hasCity && hasState;
    } else if (currentPage === 3) {
      // Verification step
      const hasPanNumber = !!(businessData.panNumber?.trim());
      const hasPanDoc = !!(businessData.verificationDocuments?.['pan'] && businessData.verificationDocuments['pan'].length > 0);
      return hasPanNumber && hasPanDoc;
    }
    // Step 4 (Portfolio & Social) has no mandatory fields
    return true;
  };

  const handleNextField = () => {
    const errors: Record<string, string> = {};

    if (currentPage === 0) {
      // Validate email format if it has been entered on Basic Information step
      if (businessData.email && businessData.email.trim() && !validateEmail(businessData.email)) {
        errors.email = 'Please enter a valid email address';
        setValidationErrors(errors);
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }
      basicInfoStepRef.current?.focusNextEmptyField();
    } else if (currentPage === 1) {
      servicesStepRef.current?.focusNextEmptyField();
    } else if (currentPage === 2) {
      locationStepRef.current?.focusNextEmptyField();
    } else if (currentPage === 3) {
      verificationStepRef.current?.focusNextEmptyField();
    }
  };

  // Reset scroll position when page changes
  useEffect(() => {
    // Scroll to top when page changes
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentPage]);

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
      } else if (!validateEmail(businessData.email)) {
        errors.email = 'Please enter a valid email address';
      }
      if (!businessData.phoneNumber || !businessData.phoneNumber.trim()) {
        errors.phoneNumber = 'Business contact number is required';
      }
    } else if (currentPage === 1) {
      // Services & Experience step
      // Must have at least one sub-category selected
      if (!businessData.selectedCategoryIds || businessData.selectedCategoryIds.length === 0) {
        errors.selectedCategoryIds = 'Please select at least one sub-category';
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
      if (!businessData.basePrice || !businessData.basePrice.trim()) {
        errors.basePrice = 'Base price is required';
      }
      if (!businessData.pricingUnit || !businessData.pricingUnit.trim()) {
        errors.pricingUnit = 'Pricing unit is required';
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
        errors.city = 'Area is required';
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
      if (data.email !== undefined) {
        const emailErr = getEmailError(data.email);
        if (emailErr && data.email.trim().length > 5) { // Only show error if they've typed a bit
          updatedErrors.email = emailErr;
          hasChanges = true;
        } else if (!emailErr && updatedErrors.email) {
          delete updatedErrors.email;
          hasChanges = true;
        }
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
      if (data.basePrice !== undefined && data.basePrice.trim() && updatedErrors.basePrice) {
        delete updatedErrors.basePrice;
        hasChanges = true;
      }
      if (data.pricingUnit !== undefined && data.pricingUnit.trim() && updatedErrors.pricingUnit) {
        delete updatedErrors.pricingUnit;
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
    // 0. Validate Phone Number (10 digits)
    if (businessData.phoneNumber && businessData.phoneNumber.trim()) {
      const cleanedPhone = stripCountryCode(businessData.phoneNumber);
      if (cleanedPhone.length !== 10) {
        Alert.alert('Validation Error', 'Business contact number must be exactly 10 digits.');
        return;
      }
    }

    // Validate PAN number is provided
    if (!businessData.panNumber || !businessData.panNumber.trim()) {
      Alert.alert('Validation Error', 'PAN is required. Please enter your PAN number.');
      setSubmitting(false);
      return;
    }

    // Validate PAN format
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(businessData.panNumber.trim().toUpperCase())) {
      Alert.alert('Validation Error', 'Please enter a valid PAN number (e.g., ABCDE1234F).');
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

      // Step 1: Create business with all fields (cover photo will be uploaded after)
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
          locality: businessData.locality || null,
          latitude: null,
          longitude: null,
          operating_locations: businessData.operatingLocations || [],
          service_radius_km: businessData.serviceRadiusKm || 0,
          contact_person_name: businessData.contactPersonName,
          contact_person_phone: stripCountryCode(businessData.phoneNumber), // Ensure no +91
          contact_person_role: businessData.contactPersonRole || null,
          business_registration_number: businessData.panNumber || null, // PAN stored in business_registration_number field
          website_url: businessData.websiteUrl || null,
          instagram_url: businessData.instagramUrl || null,
          facebook_url: businessData.facebookUrl || null,
          youtube_url: businessData.youtubeUrl || null,
          cover_photo_url: null, // Will be set after uploading cover image
          years_experience: parseYearsOfExperience(businessData.yearsOfExperience || '0'),
          gst_number: businessData.gstNumber || null,
          status: 'pending',
          subscription_status: 'trial',
        })
        .select()
        .single();

      if (businessError) throw businessError;
      if (!createdBusiness) throw new Error('Failed to create business');

      // Step 3: Upload cover photo if provided (after business is created)
      if (businessData.coverPhotoUri) {
        try {
          const { data: coverImageData, error: coverError } = await uploadBusinessImage(
            createdBusiness.id,
            businessData.coverPhotoUri
          );
          if (coverError) {
            console.error('Error uploading cover photo:', coverError);
            // Don't fail the entire registration if cover photo fails
          } else if (coverImageData) {
            // Set the uploaded image as cover
            const { error: setCoverError } = await setCoverImage(createdBusiness.id, coverImageData.id);
            if (setCoverError) {
              console.error('Error setting cover image:', setCoverError);
            }
          }
        } catch (coverError) {
          console.error('Error uploading cover photo:', coverError);
          // Don't fail the entire registration if cover photo fails
        }
      }

      // Step 4: Upload portfolio images if provided (after business is created)
      if (businessData.portfolioImages && businessData.portfolioImages.length > 0) {
        try {
          // Filter out the cover photo if it was already uploaded in Step 3
          const otherImages = businessData.coverPhotoUri
            ? businessData.portfolioImages.filter(uri => uri !== businessData.coverPhotoUri)
            : businessData.portfolioImages;

          if (otherImages.length > 0) {
            await uploadMultipleBusinessImages(
              createdBusiness.id,
              otherImages,
              (current, total) => {
                console.log(`Uploading portfolio images ${current}/${total}`);
              }
            );
          }
        } catch (imageError) {
          console.error('Error uploading portfolio images:', imageError);
          // Don't fail the entire registration if images fail
        }
      }

      // Step 5: Upload verification documents if provided
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

      // Step 6: Insert category mappings
      const categoryMappings: any[] = [];

      // Add selected business category IDs (including root categories)
      const allSelectedCategoryIds = [...(businessData.selectedCategoryIds || [])];
      // Include root category if selected and not already in the list
      if (businessData.selectedRootCategoryId && !allSelectedCategoryIds.includes(businessData.selectedRootCategoryId)) {
        allSelectedCategoryIds.push(businessData.selectedRootCategoryId);
      }

      if (allSelectedCategoryIds.length > 0) {
        allSelectedCategoryIds.forEach((categoryId) => {
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

      // Step 7: Create default package with pricing info
      if (businessData.basePrice && businessData.pricingUnit) {
        try {
          // Use 'Standard Package' as default name
          await createPackage({
            business_id: createdBusiness.id,
            package_name: 'Standard Package',
            package_type: 'fixed', // Default type, can be updated later
            base_price: parseFloat(businessData.basePrice),
            price_unit: businessData.pricingUnit,
            included_services: [],
            is_active: true,
            sort_order: 0,
          });
        } catch (pkgError) {
          console.error('Error creating default package:', pkgError);
          // Continue execution, don't block success just because package creation failed (though it shouldn't)
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
          ref={basicInfoStepRef}
          data={businessData}
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
          onFocus={handleFieldFocus}
        />
      ),
    },
    {
      title: 'Services & Experience',
      subtitle: 'What services do you provide?',
      component: (
        <ServicesExperienceStep
          ref={servicesStepRef}
          data={businessData}
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
          onFocus={handleFieldFocus}
        />
      ),
    },
    {
      title: 'Location & Coverage',
      subtitle: 'Where do you operate?',
      component: (
        <LocationCoverageStep
          ref={locationStepRef}
          data={businessData}
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
          onFocus={handleFieldFocus}
        />
      ),
    },
    {
      title: 'Verification',
      subtitle: 'Verify your business',
      component: (
        <VerificationStep
          ref={verificationStepRef}
          data={businessData}
          onUpdate={updateBusinessData}
          validationErrors={validationErrors}
          onFocus={handleFieldFocus}
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
          onFocus={handleFieldFocus}
        />
      ),
    },
  ];

  return (
    <ScreenBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
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
          ref={scrollViewRef}
          style={styles.pager}
          contentContainerStyle={[styles.pagerContent, { paddingBottom: 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={contentHeight > containerHeight}
          onContentSizeChange={(_, h) => setContentHeight(h)}
          onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
        >
          <View style={{ flex: contentHeight > containerHeight ? 0 : 1, justifyContent: 'center' }}>
            {steps[currentPage].component}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {currentPage > 0 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handlePrevious}
            >
              <ChevronLeft size={20} color="#007AFF" />
              <Text style={styles.secondaryButtonText}>Previous</Text>
            </TouchableOpacity>
          )}

          {currentPage < totalSteps - 1 ? (
            areMandatoryFieldsFilled() ? (
              <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                <Text style={styles.primaryButtonText}>Next Step</Text>
                <ChevronRight size={20} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.nextFieldButton} onPress={handleNextField}>
                <Text style={styles.nextFieldButtonText}>Continue</Text>
                <ChevronRight size={20} color="#007AFF" />
              </TouchableOpacity>
            )
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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
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
    paddingBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    minHeight: 64,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 'auto',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 48,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  nextFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 48,
  },
  nextFieldButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
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
