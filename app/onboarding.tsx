import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Building2, TrendingUp, Star } from 'lucide-react-native';
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
  const scrollViewRef = useRef<ScrollView>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    router.replace('/(auth)/login');
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    router.replace('/(auth)/login');
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
            <View key={item.id} style={[styles.slide, { width }]}>
              <LinearGradient
                colors={item.gradient}
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
                <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
                  {/* Logo */}
                  <View style={styles.logoContainer}>
                    <ExternalLogo size={140} />
                  </View>

                  {/* Icon */}
                  <View style={styles.iconContainer}>
                    <View style={styles.iconCircle}>
                      <IconComponent size={64} color="#fff" strokeWidth={2} />
                    </View>
                  </View>

                  {/* Text Content */}
                  <View style={styles.textContainer}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                  </View>

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
                      <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
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
  },
  slide: {
    flex: 1,
    height: height,
  },
  gradient: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    right: Spacing.xxxl,
    zIndex: 10,
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  skipText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Spacing.xxxl,
    justifyContent: 'space-between',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: Spacing.xxxl,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Shadows.large,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginVertical: Spacing.xxxl,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  description: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 26,
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  dotButton: {
    padding: Spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
  buttonContainer: {
    paddingBottom: Spacing.xl,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xxxl,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#fff',
    gap: Spacing.sm,
    ...Shadows.medium,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

