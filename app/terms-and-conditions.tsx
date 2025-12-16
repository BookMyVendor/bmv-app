import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore } from '@/lib/supabase';
import Logo from '@/components/Logo';

const TERMS_ACCEPTANCE_KEY = 'vendor_terms_accepted';

export default function TermsAndConditionsScreen() {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleAccept = async () => {
    if (!accepted) return;

    setLoading(true);
    try {
      // Store T&C acceptance in AsyncStorage
      await AsyncStorage.setItem(TERMS_ACCEPTANCE_KEY, 'true');
      
      // If user exists, also try to store in database (optional - for future use)
      if (user?.id) {
        try {
          // Try to update vendors table if terms_accepted field exists
          // This will fail silently if field doesn't exist, which is fine
          await supabaseCore
            .from('vendors')
            .update({ 
              terms_accepted: true,
              terms_accepted_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        } catch (dbError) {
          // Ignore DB errors - AsyncStorage is the primary storage
          console.log('DB update optional - field may not exist yet');
        }
      }

      router.replace('/complete-profile');
    } catch (error) {
      console.error('Error accepting terms:', error);
      // Still proceed even if save fails
      router.replace('/complete-profile');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isAtBottom && !accepted) {
      setAccepted(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <Logo size={48} style={styles.logo} />
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.subtitle}>Please read and accept to continue</Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.content}>
          <Text style={styles.lastUpdated}>Last Updated: November 2024</Text>

          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.sectionText}>
            By accessing and using BookMyVendors (BMV), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
          </Text>

          <Text style={styles.sectionTitle}>2. Use License</Text>
          <Text style={styles.sectionText}>
            Permission is granted to temporarily download one copy of the materials on BMV's website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
          </Text>
          <Text style={styles.bulletPoint}>• Modify or copy the materials</Text>
          <Text style={styles.bulletPoint}>• Use the materials for any commercial purpose or for any public display</Text>
          <Text style={styles.bulletPoint}>• Attempt to decompile or reverse engineer any software contained on BMV's website</Text>
          <Text style={styles.bulletPoint}>• Remove any copyright or other proprietary notations from the materials</Text>

          <Text style={styles.sectionTitle}>3. Vendor Responsibilities</Text>
          <Text style={styles.sectionText}>
            As a vendor on BMV, you agree to:
          </Text>
          <Text style={styles.bulletPoint}>• Provide accurate and truthful information about your business</Text>
          <Text style={styles.bulletPoint}>• Maintain the confidentiality of your account credentials</Text>
          <Text style={styles.bulletPoint}>• Respond promptly to customer inquiries and leads</Text>
          <Text style={styles.bulletPoint}>• Deliver services as described in your business profile</Text>
          <Text style={styles.bulletPoint}>• Comply with all applicable laws and regulations</Text>

          <Text style={styles.sectionTitle}>4. Service Availability</Text>
          <Text style={styles.sectionText}>
            BMV reserves the right to modify, suspend, or discontinue any part of the service at any time without prior notice. We do not guarantee that the service will be available at all times or that it will be error-free.
          </Text>

          <Text style={styles.sectionTitle}>5. User Accounts</Text>
          <Text style={styles.sectionText}>
            You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.
          </Text>

          <Text style={styles.sectionTitle}>6. Payment Terms</Text>
          <Text style={styles.sectionText}>
            Subscription fees and payment terms are outlined in your selected plan. Payments are processed securely, and refunds are subject to our refund policy.
          </Text>

          <Text style={styles.sectionTitle}>7. Content and Intellectual Property</Text>
          <Text style={styles.sectionText}>
            All content on BMV, including but not limited to text, graphics, logos, and software, is the property of BMV or its content suppliers and is protected by copyright and other intellectual property laws.
          </Text>

          <Text style={styles.sectionTitle}>8. Privacy Policy</Text>
          <Text style={styles.sectionText}>
            Your use of BMV is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection and use of your information.
          </Text>

          <Text style={styles.sectionTitle}>9. Prohibited Activities</Text>
          <Text style={styles.sectionText}>
            You agree not to engage in any of the following prohibited activities:
          </Text>
          <Text style={styles.bulletPoint}>• Violate any applicable laws or regulations</Text>
          <Text style={styles.bulletPoint}>• Infringe upon the rights of others</Text>
          <Text style={styles.bulletPoint}>• Transmit any harmful or malicious code</Text>
          <Text style={styles.bulletPoint}>• Spam or harass other users</Text>
          <Text style={styles.bulletPoint}>• Impersonate any person or entity</Text>

          <Text style={styles.sectionTitle}>10. Termination</Text>
          <Text style={styles.sectionText}>
            BMV reserves the right to terminate or suspend your account and access to the service immediately, without prior notice, for conduct that BMV believes violates these Terms of Use or is harmful to other users, BMV, or third parties.
          </Text>

          <Text style={styles.sectionTitle}>11. Disclaimer</Text>
          <Text style={styles.sectionText}>
            The materials on BMV's website are provided on an 'as is' basis. BMV makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
          </Text>

          <Text style={styles.sectionTitle}>12. Limitations</Text>
          <Text style={styles.sectionText}>
            In no event shall BMV or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on BMV's website.
          </Text>

          <Text style={styles.sectionTitle}>13. Accuracy of Materials</Text>
          <Text style={styles.sectionText}>
            The materials appearing on BMV's website could include technical, typographical, or photographic errors. BMV does not warrant that any of the materials on its website are accurate, complete, or current.
          </Text>

          <Text style={styles.sectionTitle}>14. Links</Text>
          <Text style={styles.sectionText}>
            BMV has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by BMV of the site.
          </Text>

          <Text style={styles.sectionTitle}>15. Modifications</Text>
          <Text style={styles.sectionText}>
            BMV may revise these terms of service for its website at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
          </Text>

          <Text style={styles.sectionTitle}>16. Governing Law</Text>
          <Text style={styles.sectionText}>
            These terms and conditions are governed by and construed in accordance with the laws of India and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </Text>

          <Text style={styles.sectionTitle}>17. Contact Information</Text>
          <Text style={styles.sectionText}>
            If you have any questions about these Terms of Use, please contact us at support@bookmyvendors.com.
          </Text>

          <Text style={styles.sectionTitle}>18. Agreement to Terms</Text>
          <Text style={styles.sectionText}>
            By clicking "Accept & Continue", you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
          </Text>

          <View style={styles.acceptanceBox}>
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkbox, accepted && styles.checkboxChecked]}
                onPress={() => setAccepted(!accepted)}
                disabled={!accepted && true} // Only allow unchecking, not checking manually
              >
                {accepted && <Check size={16} color="#fff" strokeWidth={3} />}
              </TouchableOpacity>
              <Text style={styles.acceptanceText}>
                I have read and agree to the Terms & Conditions
              </Text>
            </View>
            <Text style={styles.scrollHint}>
              Please scroll to the bottom to enable acceptance
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.acceptButton, (!accepted || loading) && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={!accepted || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept & Continue</Text>
          )}
        </TouchableOpacity>
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
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  logo: {
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  content: {
    padding: 24,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginLeft: 16,
    marginBottom: 4,
  },
  acceptanceBox: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  acceptanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  scrollHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  acceptButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

