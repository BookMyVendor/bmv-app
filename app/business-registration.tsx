import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import BasicInformationStep from '@/components/registration/BasicInformationStep';
import ServicesExperienceStep from '@/components/registration/ServicesExperienceStep';
import LocationCoverageStep from '@/components/registration/LocationCoverageStep';
import VerificationStep from '@/components/registration/VerificationStep';
import PortfolioSocialStep from '@/components/registration/PortfolioSocialStep';

interface BusinessData {
  businessName: string;
  contactPersonName: string;
  email: string;
  phoneNumber: string;
  vendorServiceCategory: string;
  eventTypes: string[];
  businessDescription: string;
  yearsOfExperience: string;
  businessAddress: string;
  city: string;
  state: string;
  gstNumber: string;
  businessRegistrationNumber: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  portfolioImages: string[];
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
      const { error } = await supabase.from('businesses').insert({
        user_id: user?.id,
        business_name: businessData.businessName,
        contact_person_name: businessData.contactPersonName,
        email: businessData.email,
        phone_number: businessData.phoneNumber,
        vendor_service_category: businessData.vendorServiceCategory,
        event_types: businessData.eventTypes || [],
        business_description: businessData.businessDescription,
        years_of_experience: businessData.yearsOfExperience,
        business_address: businessData.businessAddress,
        city: businessData.city,
        state: businessData.state,
        gst_number: businessData.gstNumber || null,
        business_registration_number: businessData.businessRegistrationNumber || null,
        website_url: businessData.websiteUrl || null,
        instagram_url: businessData.instagramUrl || null,
        facebook_url: businessData.facebookUrl || null,
        youtube_url: businessData.youtubeUrl || null,
      });

      if (error) throw error;

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
});
