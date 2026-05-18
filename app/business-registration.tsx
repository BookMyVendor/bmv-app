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
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChevronLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { registerVendorBusiness } from '../lib/api/vendorBusinesses';
import { updateBusinessCategoryMappings } from '../lib/api/packages';
import BasicInformationStep, { BasicInformationStepRef } from '../components/registration/BasicInformationStep';
import ServicesExperienceStep, { ServicesExperienceStepRef } from '../components/registration/ServicesExperienceStep';
import { pickMultipleImages } from '../lib/businessApi';
import Dropdown from '../components/Dropdown';
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
  businessType?: 'services' | 'rental';
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
  operatingHours?: string; // Added for 'Pan India' support
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
const SKIP_BUSINESS_REGISTRATION_KEY = 'skip_business_registration';

export default function BusinessRegistrationScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const [businessData, setBusinessData] = useState<Partial<BusinessData>>({ businessType: 'services' });
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isRestored, setIsRestored] = useState(false);
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const basicInfoStepRef = useRef<BasicInformationStepRef>(null);
  const servicesStepRef = useRef<ServicesExperienceStepRef>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
            try {
              const parsedData = JSON.parse(savedData);
              setBusinessData({ businessType: 'services', ...parsedData });
            } catch (e) {
              setBusinessData({ businessType: 'services' });
            }
          } else {
            setBusinessData({ businessType: 'services' });
          }

          if (savedPage) {
            setCurrentPage(parseInt(savedPage, 10));
          } else {
            setCurrentPage(0);
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
        if (!prev.contactPersonName && (profile.first_name || profile.last_name)) {
          updated.contactPersonName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        }
        return updated;
      });
    }
  }, [profile, isRestored]);

  const handleFieldFocus = () => {
    // Let the keyboard avoiding view handle scroll naturally
    // Don't force scrollToEnd as it causes the entire screen to jump
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

  const totalSteps = 1;

  // Check if all mandatory fields are filled for current step
  const areMandatoryFieldsFilled = (): boolean => {
    const hasBusinessName = !!(businessData.businessName?.trim());
    const hasContactName = !!(businessData.contactPersonName?.trim());
    const isEmailValid = !businessData.email || !businessData.email.trim() || validateEmail(businessData.email);
    const hasPhone = !!(businessData.phoneNumber?.trim());
    const hasCategory = !!(businessData.selectedRootCategoryId || (businessData.selectedCategoryIds && businessData.selectedCategoryIds.length > 0));
    const hasOperatingLocations = !!(businessData.operatingLocations && businessData.operatingLocations.length > 0);

    return hasBusinessName && hasContactName && isEmailValid && hasPhone && hasCategory && hasOperatingLocations;
  };

  const handleNextField = () => {
    const errors: Record<string, string> = {};

    if (!businessData.businessName || !businessData.businessName.trim()) {
      errors.businessName = 'Business name is required';
    }
    if (!businessData.contactPersonName || !businessData.contactPersonName.trim()) {
      errors.contactPersonName = 'Contact person name is required';
    }
    if (businessData.email && businessData.email.trim() && !validateEmail(businessData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!businessData.phoneNumber || !businessData.phoneNumber.trim()) {
      errors.phoneNumber = 'Business contact number is required';
    }
    if (!businessData.selectedCategoryIds || businessData.selectedCategoryIds.length === 0) {
      errors.selectedCategoryIds = 'Please select at least one sub-category';
    }
    if (!businessData.operatingLocations || businessData.operatingLocations.length === 0) {
      errors.operatingLocations = 'Please select at least one operating location';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
    }

    // Focus first empty field
    if (errors.businessName || errors.contactPersonName || errors.email || errors.phoneNumber) {
      basicInfoStepRef.current?.focusNextEmptyField();
    } else {
      servicesStepRef.current?.focusNextEmptyField();
    }
  };

  // Reset scroll position when page changes
  useEffect(() => {
    // Scroll to top when page changes
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentPage]);

  const validateCurrentPage = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate all fields
    if (!businessData.businessName || !businessData.businessName.trim()) {
      errors.businessName = 'Business name is required';
    }
    if (!businessData.contactPersonName || !businessData.contactPersonName.trim()) {
      errors.contactPersonName = 'Contact person name is required';
    }
    if (businessData.email && businessData.email.trim() && !validateEmail(businessData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!businessData.phoneNumber || !businessData.phoneNumber.trim()) {
      errors.phoneNumber = 'Business contact number is required';
    } else {
      const cleanedPhone = stripCountryCode(businessData.phoneNumber);
      if (cleanedPhone.length !== 10) {
        errors.phoneNumber = 'Phone number must be exactly 10 digits';
      }
    }
    if (!businessData.selectedRootCategoryId) {
      errors.selectedRootCategoryId = 'Please select a primary category';
    }
    if (!businessData.selectedCategoryIds || businessData.selectedCategoryIds.length === 0) {
      errors.selectedCategoryIds = 'Please select at least one specialization';
    }
    if (!businessData.operatingLocations || businessData.operatingLocations.length === 0) {
      errors.operatingLocations = 'Please select at least one operating location';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      Alert.alert(
        'Validation Error',
        'Please complete all required fields',
        [{ text: 'OK' }]
      );

      // Focus first error field for better UX
      if (errors.businessName || errors.contactPersonName || errors.phoneNumber || errors.email) {
        basicInfoStepRef.current?.focusNextEmptyField();
      } else {
        servicesStepRef.current?.focusNextEmptyField();
      }

      return false;
    }

    // Clear validation errors if validation passes
    setValidationErrors({});
    return true;
  };

  const handleNext = () => {
    // Dismiss keyboard before validation
    Keyboard.dismiss();

    if (!validateCurrentPage()) return;

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
                // Clear saved data and set skip flag when user cancels
                await Promise.all([
                  clearSavedData(),
                  AsyncStorage.setItem(SKIP_BUSINESS_REGISTRATION_KEY, 'true')
                ]);
                console.log('Navigating to dashboard after cancel');
                router.replace('/(tabs)');
              },
            },
          ]
        );
      } else {
        // No data entered, clear saved data, set skip flag and navigate away
        Promise.all([
          clearSavedData(),
          AsyncStorage.setItem(SKIP_BUSINESS_REGISTRATION_KEY, 'true')
        ]).then(() => {
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
      if (data.operatingLocations !== undefined && data.operatingLocations.length > 0 && updatedErrors.operatingLocations) {
        delete updatedErrors.operatingLocations;
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
    // Dismiss keyboard before validation
    Keyboard.dismiss();

    // Perform comprehensive validation
    if (!validateCurrentPage()) return;

    setSubmitting(true);

    try {
      console.log('[BizDebug][Create] Submit started', {
        userId: user?.id ?? null,
        businessName: businessData.businessName ?? null,
        selectedRootCategoryId: businessData.selectedRootCategoryId ?? null,
        selectedCategoryCount: businessData.selectedCategoryIds?.length ?? 0,
        selectedEventCount: businessData.selectedEventIds?.length ?? 0,
      });
      // Parse contact person name into first_name and last_name
      const nameParts = (businessData.contactPersonName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || firstName; // If only one name, use it as last name too

      // Determine business_type - map 'services' to 'service'
      const businessType: 'service' | 'rental' = businessData.businessType === 'rental' ? 'rental' : 'service';

      // Determine pan_india based on operating locations
      // If operatingLocations has 'Pan India' or is empty, set pan_india to true
      const isPanIndia = !businessData.operatingLocations ||
        businessData.operatingLocations.length === 0 ||
        businessData.operatingLocations.some(loc => loc.toLowerCase() === 'pan india' || loc.toLowerCase() === 'all india');

      // If no cover photo is provided but portfolio images exist, use first portfolio image as cover
      let coverPhotoUri = businessData.coverPhotoUri;
      if (!coverPhotoUri && businessData.portfolioImages && businessData.portfolioImages.length > 0) {
        coverPhotoUri = businessData.portfolioImages[0];
        console.log('[BizDebug][Register] No cover photo provided, using first portfolio image as cover');
      }

      // Prepare gallery photos from portfolioImages (excluding cover photo)
      const galleryPhotos = businessData.portfolioImages
        ? coverPhotoUri
          ? businessData.portfolioImages.filter(uri => uri !== coverPhotoUri)
          : businessData.portfolioImages
        : [];

      // Build the registration payload
      const registrationPayload = {
        first_name: firstName,
        last_name: lastName,
        phone: stripCountryCode(businessData.phoneNumber || ''),
        email: businessData.email || undefined,
        business_name: businessData.businessName || '',
        business_type: businessType,
        pan_india: isPanIndia,
        operating_locations: isPanIndia ? undefined : businessData.operatingLocations,
        primary_category_id: businessData.selectedRootCategoryId || '',
        specialization_category_ids: businessData.selectedCategoryIds || [],
        event_category_ids: businessData.selectedEventIds || [],
        cover_photo: coverPhotoUri ? { uri: coverPhotoUri } : undefined,
        photos: galleryPhotos.map(uri => ({ uri })),
      };

      console.log('[BizDebug][Register] Calling registerVendorBusiness', {
        firstName,
        lastName,
        phone: registrationPayload.phone,
        businessName: registrationPayload.business_name,
        businessType: registrationPayload.business_type,
        panIndia: isPanIndia,
        primaryCategoryId: registrationPayload.primary_category_id,
        specializationCount: registrationPayload.specialization_category_ids?.length ?? 0,
        eventCount: registrationPayload.event_category_ids?.length ?? 0,
        hasCoverPhoto: !!registrationPayload.cover_photo,
        galleryPhotoCount: registrationPayload.photos?.length ?? 0,
      });

      const { data: registrationResult, error: registrationError } = await registerVendorBusiness(registrationPayload);

      console.log('[BizDebug][Register] registerVendorBusiness response', {
        hasError: !!registrationError,
        error: registrationError?.error ?? null,
        errorCode: registrationError?.code ?? null,
        vendorId: registrationResult?.vendor_id ?? null,
        vendorBusinessId: registrationResult?.vendor_business_id ?? null,
      });

      if (registrationError) {
        // Handle duplicate phone error
        if (registrationError.code === 'DUPLICATE_PHONE') {
          throw new Error('This phone number is already registered. Please use a different number.');
        }
        throw new Error(registrationError.error);
      }
      if (!registrationResult) throw new Error('Failed to register business');

      // Update category mappings after successful registration
      const allSelectedCategoryIds = [...(businessData.selectedCategoryIds || [])];
      if (businessData.selectedRootCategoryId && !allSelectedCategoryIds.includes(businessData.selectedRootCategoryId)) {
        allSelectedCategoryIds.push(businessData.selectedRootCategoryId);
      }
      const eventIds = businessData.selectedEventIds || [];
      const allCategoryIds = [...allSelectedCategoryIds, ...eventIds];

      if (allCategoryIds.length > 0 && registrationResult.vendor_business_id) {
        const { error: mappingError } = await updateBusinessCategoryMappings(registrationResult.vendor_business_id, allCategoryIds);
        if (mappingError) console.error('Error saving category mappings:', mappingError);
        console.log('[BizDebug][Register] Category mapping result', {
          businessId: registrationResult.vendor_business_id,
          categoryCount: allCategoryIds.length,
          hasError: !!mappingError,
          error: mappingError?.error ?? null,
        });
      }

      // Create a normalized business object for caching
      const normalizedCreatedBusiness = {
        id: registrationResult.vendor_business_id,
        vendor_id: registrationResult.vendor_id,
        business_name: businessData.businessName,
        description: businessData.businessDescription || '',
        city: businessData.city || '',
        state: businessData.state || '',
        cover_photo_url: null,
      };



      // Clear saved form data before navigating
      await clearSavedData();

      // Set skip flag so layout doesn't redirect back to registration
      await AsyncStorage.setItem(SKIP_BUSINESS_REGISTRATION_KEY, 'true');

      // Reset local state to ensure next registration starts fresh
      setBusinessData({ businessType: 'services' });
      setCurrentPage(0);
      setIsRestored(false); // Force re-restore check next time

      // Update profile in AuthContext to include the new business flag
      await refreshProfile();
      if (user?.id && registrationResult?.vendor_business_id) {
        const cacheKey = `dashboard_businesses_${user.id}`;
        try {
          const cachedStr = await AsyncStorage.getItem(cacheKey);
          const cachedBusinesses = cachedStr ? JSON.parse(cachedStr) : [];
          const list = Array.isArray(cachedBusinesses) ? cachedBusinesses : [];
          const deduped = list.filter((item: any) => item?.id !== normalizedCreatedBusiness.id);
          await AsyncStorage.setItem(cacheKey, JSON.stringify([normalizedCreatedBusiness, ...deduped]));
        } catch {
          // Cache priming is best-effort; dashboard API remains source of truth.
        }
      }
      console.log('[BizDebug][Register] Submit finished successfully', {
        vendorBusinessId: registrationResult?.vendor_business_id,
        businessName: businessData.businessName,
      });

      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Error submitting business:', error);
      console.log('[BizDebug][Create] Submit failed', {
        message: error?.message ?? 'Unknown error',
      });
      alert(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    {
      title: 'Business Registration',
      subtitle: 'Complete these details to get started',
      component: (
        <View>
          <BasicInformationStep
            ref={basicInfoStepRef}
            data={businessData}
            onUpdate={updateBusinessData}
            validationErrors={validationErrors}
            onFocus={handleFieldFocus}
          />
          <ServicesExperienceStep
            ref={servicesStepRef}
            data={businessData}
            onUpdate={updateBusinessData}
            validationErrors={validationErrors}
            onFocus={handleFieldFocus}
          />
        </View>
      ),
    },
  ];

  return (
    <ScreenBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
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

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => router.replace('/(tabs)')}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <CheckCircle2 size={60} color="#34C759" />
            </View>

            <Text style={styles.successModalTitle}>You’re live! 🚀</Text>

            <Text style={styles.successModalMessage}>
              Your profile is now live on BookMyVendors and ready to receive customer inquiries.
            </Text>

            <View style={styles.successInfoBox}>
              <Text style={styles.successInfoBoxText}>
                <Text style={{ fontWeight: '700' }}>Tip:</Text> Complete your profile and add photos and videos to stand out.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/(tabs)');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.successModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContent: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F2FBF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  successModalMessage: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  successInfoBox: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#D0E7FF',
  },
  successInfoBoxText: {
    fontSize: 14,
    color: '#0056B3',
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  successModalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
