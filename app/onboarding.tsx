import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Building2, TrendingUp, Star } from 'lucide-react-native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Shadows } from '@/constants/theme';
import ExternalLogo from '@/components/ExternalLogo';

const { width, height } = Dimensions.get('window');

const ONBOARDING_STORAGE_KEY = 'has_seen_onboarding';

const ONBOARDING_DATA = [
  {
    id: 1,
    title: 'Manage Your Business',
    description: 'Register your business, showcase your services, and build your professional profile all in one place.',
    icon: Building2,
    gradient: ['#FFF8F0', '#FFE5D0', '#FFC766', '#ffb543'], // Vertical orange gradient - light to dark
  },
  {
    id: 2,
    title: 'Get Quality Leads',
    description: 'Receive real-time leads from customers looking for your services. Track and manage them effortlessly.',
    icon: TrendingUp,
    gradient: ['#F0F7FF', '#D6E9F5', '#8BB5D9', '#6aa3ce'], // Vertical blue gradient - light to dark
  },
  {
    id: 3,
    title: 'Grow Your Business',
    description: 'Manage reviews, create offers, showcase your portfolio, and watch your business thrive.',
    icon: Star,
    gradient: ['#F1F8F2', '#E8F5E9', '#A0C063', '#88a94b'], // Vertical green gradient - light to dark
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [splashHidden, setSplashHidden] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Responsive sizes based on screen height
  const logoSize = screenHeight < 600 ? 80 : screenHeight < 700 ? 110 : 140;
  const iconSize = screenHeight < 600 ? 40 : screenHeight < 700 ? 52 : 64;

  // Hide splash screen when onboarding screen mounts
  useEffect(() => {
    const hideSplash = async () => {
      if (splashHidden) return;
      try {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      } catch (error) {
        console.error('Error hiding splash screen:', error);
        setSplashHidden(true); // Mark as attempted even if it fails
      }
    };
    hideSplash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
    } else {
      handleFinish();
    }
  };

  const handleSkip = async () => {
    try {
      console.log('Skip button pressed');
      // Save onboarding status first
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      // Ensure splash screen is hidden
      if (!splashHidden) {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      }
      // Small delay to ensure splash screen is fully hidden
      await new Promise(resolve => setTimeout(resolve, 300));
      // Navigate to login - use replace for proper navigation
      console.log('Navigating to login...');
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error in handleSkip:', error);
      // Even if there's an error, try to navigate
      try {
        await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        if (!splashHidden) {
          await SplashScreen.hideAsync();
          setSplashHidden(true);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // Ignore errors
      }
      router.replace('/(auth)/login');
    }
  };

  const handleFinish = async () => {
    try {
      console.log('Get Started button pressed');
      // Save onboarding status first
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      // Ensure splash screen is hidden
      if (!splashHidden) {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      }
      // Small delay to ensure splash screen is fully hidden
      await new Promise(resolve => setTimeout(resolve, 300));
      // Navigate to login - use replace for proper navigation
      console.log('Navigating to login...');
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error in handleFinish:', error);
      // Even if there's an error, try to navigate
      try {
        await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
        if (!splashHidden) {
          await SplashScreen.hideAsync();
          setSplashHidden(true);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        // Ignore errors
      }
      router.replace('/(auth)/login');
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * width,
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        scrollEnabled={true}
      >
        {ONBOARDING_DATA.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <View key={item.id} style={styles.slide}>
              <LinearGradient
                colors={item.gradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.gradient}
              >
                {/* Skip Button */}
                {index < ONBOARDING_DATA.length - 1 && (
                  <TouchableOpacity
                    style={[styles.skipButton, { top: insets.top + 20 }]}
                    onPress={handleSkip}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.skipText}>Skip</Text>
                  </TouchableOpacity>
                )}

                {/* Content */}
                <View style={[styles.content, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + Spacing.xxxl }]}>
                  {/* Logo */}
                  <View style={styles.logoContainer}>
                    <ExternalLogo size={logoSize} />
                  </View>

                  {/* Icon */}
                  <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                      <IconComponent size={iconSize} color="#000" strokeWidth={2} />
                    </View>
                  </View>

                  {/* Text Content */}
                  <View style={styles.textContainer}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                  </View>

                  {/* Footer Section - Anchored to bottom */}
                  <View style={styles.footer}>
                    {/* Dots Indicator */}
                    <View style={styles.dotsContainer}>
                      {ONBOARDING_DATA.map((_, dotIndex) => (
                        <TouchableOpacity
                          key={dotIndex}
                          onPress={() => handleDotPress(dotIndex)}
                          style={styles.dotButton}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.dot,
                              dotIndex === currentIndex && styles.dotActive,
                            ]}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Next/Get Started Button */}
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity
                        style={styles.nextButton}
                        onPress={handleNext}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.nextButtonText}>
                          {index === ONBOARDING_DATA.length - 1
                            ? 'Get Started'
                            : 'Next'}
                        </Text>
                        <ChevronRight size={20} color="#000" strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  slide: {
    width: width,
    height: Dimensions.get('screen').height,
  },
  gradient: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  skipButton: {
    position: 'absolute',
    right: Spacing.xxxl,
    zIndex: 10,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: height < 600 ? Spacing.lg : Spacing.xxxl,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height < 600 ? Spacing.sm : Spacing.xl,
    marginBottom: height < 600 ? Spacing.md : Spacing.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: height < 600 ? Spacing.md : Spacing.xxxl,
  },
  iconCircle: {
    width: height < 600 ? 100 : height < 700 ? 120 : 140,
    height: height < 600 ? 100 : height < 700 ? 120 : 140,
    borderRadius: height < 600 ? 50 : height < 700 ? 60 : 70,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000',
    ...Shadows.large,
  },
  textContainer: {
    flex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginVertical: height < 600 ? Spacing.md : Spacing.xxxl,
  },
  title: {
    fontSize: height < 600 ? 24 : height < 700 ? 28 : 32,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  description: {
    fontSize: height < 600 ? 14 : height < 700 ? 16 : 18,
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: height < 600 ? 20 : 26,
  },
  footer: {
    width: '100%',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  dotButton: {
    padding: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#000',
  },
  buttonContainer: {
    paddingBottom: Spacing.xl,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: height < 600 ? Spacing.md : Spacing.lg,
    paddingHorizontal: height < 600 ? Spacing.xxl : Spacing.xxxl,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  nextButtonText: {
    color: '#000',
    fontSize: height < 600 ? 16 : 18,
    fontWeight: '700',
  },
});

