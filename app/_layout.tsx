import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const ONBOARDING_STORAGE_KEY = 'has_seen_onboarding';

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  // Check if user has seen onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        setHasSeenOnboarding(value === 'true');
      } catch (error) {
        console.error('Error checking onboarding:', error);
        setHasSeenOnboarding(false);
      }
    };
    checkOnboarding();
  }, []);

  useEffect(() => {
    // Don't navigate during initial load or while checking onboarding
    if (loading && initialLoad) return;
    if (hasSeenOnboarding === null) return;

    const inOnboarding = segments[0] === 'onboarding';
    
    // Don't interfere if user is on onboarding screen - let onboarding handle navigation
    if (inOnboarding) {
      return;
    }

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

      const inAuthGroup = segments[0] === '(auth)';
      const inTabsGroup = segments[0] === '(tabs)';
      const inCompleteProfile = segments[0] === 'complete-profile';
      const inBusinessReg = segments[0] === 'business-registration';

      // Show onboarding for first-time users (only if not logged in)
      if (hasSeenOnboarding === false && !session) {
        router.replace('/onboarding');
        return;
      }

      // If no session, redirect to login (this handles logout case)
      // Check both session and user to ensure we're truly logged out
      if (!session && !loading && hasSeenOnboarding) {
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
        return;
      }

      // If we have a session but no profile yet, wait for profile to load
      if (session && !profile && loading) {
        return;
      }

      // If we have session and profile, handle navigation
      if (session && profile) {
        // Don't redirect if user is on business-registration screen
        if (inBusinessReg) {
          return;
        }
        if (!profile?.first_name && !inCompleteProfile) {
          router.replace('/complete-profile');
        } else if (profile?.first_name && (inAuthGroup || inCompleteProfile)) {
          router.replace('/(tabs)');
        }
      }
    };

    hideSplashAndNavigate();
  }, [session, profile, loading, segments, hasSeenOnboarding]);

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
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
