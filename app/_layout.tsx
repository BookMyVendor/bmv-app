import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function RootLayoutNav() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (loading && initialLoad) return;

    if (initialLoad) {
      setInitialLoad(false);
    }

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inCompleteProfile = segments[0] === 'complete-profile';
    const inBusinessReg = segments[0] === 'business-registration';

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (session && profile) {
      if (!profile.is_profile_complete && !inCompleteProfile) {
        router.replace('/complete-profile');
      } else if (profile.is_profile_complete && (inAuthGroup || inCompleteProfile)) {
        router.replace('/(tabs)');
      }
    }
  }, [session, profile, loading, segments]);

  if (loading && initialLoad) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="business-registration" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
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
