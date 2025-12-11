import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, Shield } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';
import Logo from '@/components/Logo';
import ExternalLogo from '@/components/ExternalLogo';

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
  const otpInputRef = useRef<TextInput>(null);

  // Auto-focus OTP input when step changes to 'otp'
  useEffect(() => {
    if (step === 'otp') {
      // Small delay to ensure the input is rendered
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 100);
    }
  }, [step]);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');
    setDevInfo('');

    if (DEV_MODE) {/* 
      // In dev mode, skip Twilio entirely - just proceed to OTP step
      setLoading(false);
      setStep('otp');
      //setDevInfo(`Development Mode: Use OTP ${DEV_OTP}`);
      return;
     */}

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
      colors={[Colors.background.primary, '#FFFFFF']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
          <View style={styles.headerContainer}>
            <Text style={styles.titleSmall}>Welcome to</Text>
            <ExternalLogo size={280} style={styles.logo} />
            {/* <Text style={styles.title}>Welcome to BookMyVendor</Text> */}
            {/* {step !== 'phone' && (
             <Text style={styles.subtitle}>
                 Enter the OTP sent to your phone
                </Text>
                )} */}
          </View>

          {/* {DEV_MODE && (
            <TouchableOpacity
              style={styles.dummyLoginButton}
              onPress={async () => {
                await dummyLogin();
              }}
            >
              <Text style={styles.dummyLoginText}>🚀 Skip Login (Dev Mode)</Text>
            </TouchableOpacity>
          )} */}

          {step === 'phone' ? (
            <>
              <View style={styles.inputContainer}>
                <View style={styles.inputIconContainer}>
                  <Smartphone size={20} color="#FFA500" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Mobile Number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={10}
                  returnKeyType="send"
                  onSubmitEditing={handleSendOTP}
                  blurOnSubmit={true}
                />
              </View>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFA500', '#FF8C00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
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
                  <Shield size={20} color="#6BB6FF" />
                </View>
                <TextInput
                  ref={otpInputRef}
                  style={styles.input}
                  placeholder="Enter 6-digit OTP"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOTP}
                  blurOnSubmit={true}
                />

              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerifyOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#87CEEB', '#6BB6FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.buttonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify OTP</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              {/* <TouchableOpacity
                style={styles.backButton}
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.backButtonText}>Change Phone Number</Text>
              </TouchableOpacity> */}
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                  setError('');
                }}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.secondary.main, Colors.secondary.light]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Change Phone Number</Text>
                </LinearGradient>
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
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.xl,
  },
  titleWrapper: {
    alignItems: 'center',
  },
  
  titleSmall: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.neutral.black,
  },
  
  titleLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary.black,
  },
  
  headerContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logo: {
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.colored,
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
    borderRadius: 12,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 56,
  },
  inputIconContainer: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text.primary,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    minHeight: 56,
  },
  buttonGradient: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.neutral.black,
    fontSize: 16,
    fontWeight: '500',
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
  secondaryButton: {
    marginTop: 0,
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
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
});
