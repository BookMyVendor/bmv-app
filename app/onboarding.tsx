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

import { StatusBar } from 'expo-status-bar';

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [splashHidden, setSplashHidden] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('screen').width;
  const screenHeight = Dimensions.get('screen').height;

  // Responsive sizes based on screen height
  const logoSize = screenHeight < 650 ? 70 : screenHeight < 750 ? 100 : 130;
  const iconSize = screenHeight < 650 ? 36 : screenHeight < 750 ? 48 : 60;
  const skipTop = Math.max(insets.top, 20);

  // Hide splash screen when onboarding screen mounts
  useEffect(() => {
    const hideSplash = async () => {
      if (splashHidden) return;
      try {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      } catch (error) {
        console.error('Error hiding splash screen:', error);
        setSplashHidden(true);
      }
    };
    hideSplash();
  }, []);

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      scrollViewRef.current?.scrollTo({
        x: nextIndex * screenWidth,
        animated: true,
      });
    } else {
      handleFinish();
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      if (!splashHidden) {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error in handleSkip:', error);
      router.replace('/(auth)/login');
    }
  };

  const handleFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      if (!splashHidden) {
        await SplashScreen.hideAsync();
        setSplashHidden(true);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error in handleFinish:', error);
      router.replace('/(auth)/login');
    }
  };

  const handleDotPress = (index: number) => {
    setCurrentIndex(index);
    scrollViewRef.current?.scrollTo({
      x: index * screenWidth,
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
          setCurrentIndex(index);
        }}
        scrollEnabled={true}
        bounces={false}
      >
        {ONBOARDING_DATA.map((item, index) => {
          const IconComponent = item.icon;
          return (
            <View key={item.id} style={[styles.slide, { width: screenWidth, height: screenHeight }]}>
              <LinearGradient
                colors={item.gradient as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.gradient}
              >
                {/* Skip Button - Absolute but safe */}
                {index < ONBOARDING_DATA.length - 1 && (
                  <TouchableOpacity
                    style={[styles.skipButton, { top: skipTop }]}
                    onPress={handleSkip}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.skipText}>Skip</Text>
                  </TouchableOpacity>
                )}

                {/* Main Content Area - Scrollable for safety on small devices */}
                <ScrollView
                  contentContainerStyle={[
                    styles.scrollContent,
                    {
                      paddingTop: insets.top + (screenHeight < 700 ? 40 : 80),
                      paddingBottom: Math.max(insets.bottom, Spacing.xl) + 20
                    }
                  ]}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                  {/* Top Content (Logo, Icon, Text) */}
                  <View style={styles.topContent}>
                    <View style={styles.logoWrapper}>
                      <ExternalLogo size={logoSize} />
                    </View>

                    <View style={styles.iconWrapper}>
                      <View style={[styles.iconCircle, {
                        width: iconSize * 2.2,
                        height: iconSize * 2.2,
                        borderRadius: (iconSize * 2.2) / 2
                      }]}>
                        <IconComponent size={iconSize} color="#000" strokeWidth={2} />
                      </View>
                    </View>

                    <View style={styles.textWrapper}>
                      <Text style={[styles.title, { fontSize: screenHeight < 750 ? 24 : 32 }]}>{item.title}</Text>
                      <Text style={[styles.description, { fontSize: screenHeight < 750 ? 16 : 18 }]}>{item.description}</Text>
                    </View>
                  </View>

                  {/* Spacer to give some room if screen is tall */}
                  <View style={{ height: screenHeight < 700 ? Spacing.lg : Spacing.xxl }} />

                  {/* Footer Section - Flows naturally after content */}
                  <View style={styles.footer}>
                    <View style={styles.dotsContainer}>
                      {ONBOARDING_DATA.map((_, dotIndex) => (
                        <TouchableOpacity
                          key={dotIndex}
                          onPress={() => handleDotPress(dotIndex)}
                          style={styles.dotButton}
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

                    <View style={styles.buttonWrapper}>
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
                </ScrollView>
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
    backgroundColor: '#fff',
  },
  slide: {
    // width/height handled inline
  },
  gradient: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 10,
    padding: Spacing.md,
  },
  skipText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'flex-start', // This centers the group vertically when there's extra space
  },
  topContent: {
    width: '100%',
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
    ...Shadows.medium,
  },
  textWrapper: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    color: '#000',
    marginBottom: Spacing.md,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  description: {
    color: '#333',
    textAlign: 'center',
    lineHeight: 26,
    opacity: 0.9,
  },
  footer: {
    width: '100%',
    alignItems: 'center',
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#000',
  },
  buttonWrapper: {
    width: '100%',
    paddingHorizontal: Spacing.md,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  nextButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
});

