import { useEffect, useState, useCallback, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { setupPushNotifications } from '../lib/pushNotifications';
import { getVendorBusinesses } from '../lib/api/vendorBusinesses';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const ONBOARDING_STORAGE_KEY = 'has_seen_onboarding';
const TERMS_ACCEPTANCE_KEY = 'vendor_terms_accepted';
const SKIP_BUSINESS_REGISTRATION_KEY = 'skip_business_registration';

function RootLayoutNav() {
  const { session, profile, loading, isNewUser } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const [skipBusinessRegistration, setSkipBusinessRegistration] = useState<boolean | null>(null);
  const [isCheckingTerms, setIsCheckingTerms] = useState(false);
  const [isVerifyingBusiness, setIsVerifyingBusiness] = useState(false);

  // Function to check storage values
  const checkStorage = useCallback(async () => {
    try {
      const [onboardingValue, termsValue, skipRegValue] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_STORAGE_KEY),
        AsyncStorage.getItem(TERMS_ACCEPTANCE_KEY),
        AsyncStorage.getItem(SKIP_BUSINESS_REGISTRATION_KEY),
      ]);
      setHasSeenOnboarding(onboardingValue === 'true');
      setTermsAccepted(termsValue === 'true');
      setSkipBusinessRegistration(skipRegValue === 'true');
      console.log('[STORAGE] Terms accepted:', termsValue === 'true', 'Onboarding seen:', onboardingValue === 'true', 'Skip Business Reg:', skipRegValue === 'true');
    } catch (error) {
      console.error('Error checking storage:', error);
      setHasSeenOnboarding(false);
      setTermsAccepted(false);
      setSkipBusinessRegistration(false);
    }
  }, []);

  // Check storage on mount
  useEffect(() => {
    checkStorage();
  }, [checkStorage]);

  // Setup push notification listeners (native only — Firebase/FCM not initialized on web)
  useEffect(() => {
    if (!session || Platform.OS === 'web') return;
    console.log('[PUSH] Initializing notification listeners');
    const unsubscribe = setupPushNotifications(router);
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [session, router]);

  // Refresh terms acceptance state when session/profile changes
  // This ensures we get the latest value after user accepts terms
  useEffect(() => {
    if (session && profile) {
      // Re-check storage when we have a session/profile
      // This helps catch updates after terms acceptance
      checkStorage();
    }
  }, [session?.user?.id, profile?.id, checkStorage]);

  // Also refresh when navigating away from terms screen
  useEffect(() => {
    if (segments[0] !== 'terms-and-conditions' && session && profile) {
      // Refresh storage check when we're not on terms screen anymore
      checkStorage();
    }
  }, [segments[0], session, profile, checkStorage]);

  const hasVerifiedBusiness = useRef(false);

  useEffect(() => {
    // Don't navigate during initial load or while checking storage
    if (loading && initialLoad) return;
    if (hasSeenOnboarding === null || termsAccepted === null) return;
    if (isCheckingTerms) return;
    if (isVerifyingBusiness) return;

    const inOnboarding = segments[0] === 'onboarding';
    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inTermsAndConditions = segments[0] === 'terms-and-conditions';
    const inCompleteProfile = segments[0] === 'complete-profile';
    const inBusinessReg = segments[0] === 'business-registration';

    const hideSplashAndNavigate = async () => {
      // Hide splash screen first
      try {
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('Error hiding splash screen:', error);
      }

      if (initialLoad) {
        setInitialLoad(false);
      }

      // Show onboarding for first-time users (only if not logged in)
      if (hasSeenOnboarding === false && !session && !inAuthGroup) {
        router.replace('/onboarding');
        return;
      }

      // If no session, redirect to login
      if (!session && !loading && hasSeenOnboarding) {
        if (!inAuthGroup && !inOnboarding) {
          router.replace('/(auth)/login');
        }
        return;
      }

      // If profile is still loading, wait
      if (session && loading) {
        return;
      }

      // Check if profile is complete (has first_name and last_name)
      const isProfileComplete = profile?.first_name && profile?.last_name;

      // NEW USER FLOW - if authenticated but profile NOT complete
      if (session && !isProfileComplete) {
        const termsAcceptedValue = await AsyncStorage.getItem(TERMS_ACCEPTANCE_KEY);
        const isTermsAccepted = termsAcceptedValue === 'true' || profile?.terms_accepted === true;

        // Step 1: T&C must be accepted first
        if (!isTermsAccepted) {
          if (!inTermsAndConditions) {
            router.replace('/terms-and-conditions');
          }
          return;
        }

        // Step 2: After T&C, complete profile
        if (!inCompleteProfile && !inBusinessReg) {
          router.replace('/complete-profile');
        }
        return;
      }

      // EXISTING USER or PROFILE COMPLETE - check for business requirement
      if (session && isProfileComplete) {
        let hasBusiness = profile?.has_business;

        // If profile says no business, verify by calling the API directly
        // This handles the case where user reinstalls app and API cache is stale
        if (!hasBusiness && !skipBusinessRegistration && !isVerifyingBusiness && !hasVerifiedBusiness.current) {
          hasVerifiedBusiness.current = true;
          setIsVerifyingBusiness(true);
          try {
            console.log('[NAV] Verifying business status via API (one-time check)...');
            const { data: businesses, error } = await getVendorBusinesses();
            if (!error && businesses && Array.isArray(businesses) && businesses.length > 0) {
              console.log('[NAV] API verification found', businesses.length, 'business(es)');
              hasBusiness = true;
            }
          } catch (e) {
            console.error('[NAV] Error verifying business status:', e);
          } finally {
            setIsVerifyingBusiness(false);
          }
        }

        if (!hasBusiness && !skipBusinessRegistration) {
          // If profile is complete but no business exists, they must go to registration
          if (!inBusinessReg) {
            router.replace('/business-registration');
          }
          return;
        }

        // Only redirect to dashboard if they are coming from an setup/auth screen
        if (inAuthGroup || inTermsAndConditions || inOnboarding || inCompleteProfile) {
          console.log('[NAV] Redirecting to dashboard');
          router.replace('/(tabs)');
        }
        return;
      }
    };

    hideSplashAndNavigate();
  }, [session, profile?.id, profile?.first_name, profile?.last_name, profile?.has_business, loading, segments, hasSeenOnboarding, termsAccepted, skipBusinessRegistration, isVerifyingBusiness, initialLoad]);

  // Show gradient splash screen during initial load
  if (loading && initialLoad) {
    return (
      <LinearGradient
        colors={['#FFFFFF', '#FFF8F0', '#FFE5D0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.splashContainer}
      >
        <View style={styles.splashContent}>
          <ActivityIndicator size="large" color="#ffb543" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="terms-and-conditions" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="business-registration" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default function RootLayout() {
  useFrameworkReady();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
