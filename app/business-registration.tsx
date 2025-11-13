import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore } from '@/lib/supabase';
import BasicInformationStep from '@/components/registration/BasicInformationStep';
import ServicesExperienceStep from '@/components/registration/ServicesExperienceStep';
import LocationCoverageStep from '@/components/registration/LocationCoverageStep';
import VerificationStep from '@/components/registration/VerificationStep';
import PortfolioSocialStep from '@/components/registration/PortfolioSocialStep';
import { pickMultipleImages, uploadMultipleBusinessImages } from '@/lib/businessApi';
import { INDIAN_STATES } from '@/constants/indianStates';
import { TextInput } from '@/components/TextInput';
import { Dropdown } from '@/components/Dropdown';

interface BusinessData {
  businessName: string;
  contactPersonName: string;
  contactPersonRole?: string; // Add this
  email: string;
  phoneNumber: string;
  vendorServiceCategory: string;
  eventTypes: string[];
  businessDescription: string;
  yearsOfExperience: string;
  businessAddress: string;
  city: string;
  state: string;
  pincode?: string; // Add this
  serviceRadiusKm?: number; // Add this
  operatingLocations?: string[]; // Add this (for future use)
  gstNumber: string;
  businessRegistrationNumber: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  portfolioImages: string[];
  coverPhotoUri?: string; // Add this
}

export default function BusinessRegistrationScreen() {
  const [currentPage, setCurrentPage] = useState(0);
  const [businessData, setBusinessData] = useState<Partial<BusinessData>>({});
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const totalSteps = 5;

  const handleNext = () => {
    if (currentPage < totalSteps - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const updateBusinessData = (data: Partial<BusinessData>) => {
    setBusinessData((prev) => ({ ...prev, ...data }));
  };

  const handleSubmit = async () => {
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
          business_registration_number: businessData.businessRegistrationNumber || null,
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

      // Step 4: Look up and insert category mappings
      const categoryMappings = [];

      if (businessData.vendorServiceCategory) {
        const { data: businessCategory } = await supabaseCore
          .from('categories')
          .select('id')
          .eq('name', businessData.vendorServiceCategory)
          .eq('category_type', 'business')
          .maybeSingle();

        if (businessCategory) {
          categoryMappings.push({
            vendor_id: user?.id,
            business_id: createdBusiness.id,
            category_id: businessCategory.id,
          });
        }
      }

      if (businessData.eventTypes && businessData.eventTypes.length > 0) {
        const { data: eventCategories } = await supabaseCore
          .from('categories')
          .select('id')
          .in('name', businessData.eventTypes)
          .eq('category_type', 'event');

        if (eventCategories && eventCategories.length > 0) {
          eventCategories.forEach((category) => {
            categoryMappings.push({
              vendor_id: user?.id,
              business_id: createdBusiness.id,
              category_id: category.id,
            });
          });
        }
      }

      if (categoryMappings.length > 0) {
        const { error: mappingError } = await supabaseCore
          .from('vendor_business_category_mappings')
          .insert(categoryMappings);

        if (mappingError) {
          console.error('Error inserting category mappings:', mappingError);
        }
      }

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
        />
      ),
    },
    {
      title: 'Verification',
      subtitle: 'Verify your business',
      component: (
        <VerificationStep data={businessData} onUpdate={updateBusinessData} />
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{steps[currentPage].title}</Text>
        <Text style={styles.subtitle}>{steps[currentPage].subtitle}</Text>
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

      <View style={styles.pager}>
        {steps[currentPage].component}
      </View>

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
    </View>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
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
