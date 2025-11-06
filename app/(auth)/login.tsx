import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';

const DEV_MODE = true;
const DEV_OTP = '123456';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devInfo, setDevInfo] = useState('');
  const { signInWithOTP, verifyOTP, dummyLogin } = useAuth();
  const router = useRouter();

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');
    setDevInfo('');

    if (DEV_MODE) {
      setLoading(false);
      setStep('otp');
      setDevInfo(`Development Mode: Use OTP ${DEV_OTP}`);
      return;
    }

    const { error } = await signInWithOTP(phone);

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setStep('otp');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    // verifyOTP now handles dev mode internally
    const { error } = await verifyOTP(phone, otp);

    setLoading(false);

    if (error) {
      setError(error.message);
    }
  };

  return (
    <LinearGradient
      colors={['#FFE5E0', '#FFF8F5', '#FFFFFF']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.headerContainer}>
            <LinearGradient
              colors={[Colors.primary.main, Colors.primary.light]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <Smartphone size={40} color={Colors.neutral.white} strokeWidth={2} />
            </LinearGradient>
            <Text style={styles.title}>Welcome to VendorHub</Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'Enter your mobile number to continue'
                : 'Enter the OTP sent to your phone'}
            </Text>
          </View>

          {DEV_MODE && (
            <TouchableOpacity
              style={styles.dummyLoginButton}
              onPress={async () => {
                await dummyLogin();
              }}
            >
              <Text style={styles.dummyLoginText}>🚀 Skip Login (Dev Mode)</Text>
            </TouchableOpacity>
          )}

          {step === 'phone' ? (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Smartphone size={20} color={Colors.primary.main} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={10}
                />
              </View>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.primary.main, Colors.primary.light]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Shield size={20} color={Colors.secondary.main} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={6}
                />
              </View>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.secondary.main, Colors.secondary.light]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify OTP</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
              >
                <Text style={styles.backButtonText}>Change Phone Number</Text>
              </TouchableOpacity>
            </>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {devInfo ? (
            <View style={styles.devInfoContainer}>
              <Text style={styles.devInfo}>{devInfo}</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.colored,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.neutral.light,
    ...Shadows.small,
  },
  inputIconContainer: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    padding: Spacing.lg,
    fontSize: 16,
    color: Colors.text.primary,
  },
  button: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.medium,
  },
  buttonGradient: {
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.neutral.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backButton: {
    alignItems: 'center',
    padding: Spacing.md,
  },
  backButtonText: {
    color: Colors.primary.main,
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: Colors.error.light + '20',
    borderLeftWidth: 4,
    borderLeftColor: Colors.error.main,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  errorText: {
    color: Colors.error.dark,
    fontSize: 14,
    fontWeight: '500',
  },
  devInfoContainer: {
    backgroundColor: Colors.success.light + '20',
    borderLeftWidth: 4,
    borderLeftColor: Colors.success.main,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  devInfo: {
    color: Colors.success.dark,
    fontSize: 14,
    fontWeight: '600',
  },
  dummyLoginButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
    alignItems: 'center',
  },
  dummyLoginText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
