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
import { Smartphone } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';
import ExternalLogo from '@/components/ExternalLogo';
import { sendOTP } from '@/lib/otpAuthApi';



export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState<number | null>(null);

  const isVerifyingRef = useRef(false);
  const { verifyOTP: authVerifyOTP } = useAuth();
  const router = useRouter();

  /* -------------------- Helpers -------------------- */

  const formatPhoneNumber = (text: string): string => {
    const digits = text.replace(/\D/g, '');
    return digits.length === 10 ? `+91${digits}` : text;
  };

  const validatePhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  };

  /* -------------------- OTP SEND -------------------- */

  const handleSendOTP = async () => {
    const formattedPhone = formatPhoneNumber(phone);

    if (!validatePhoneNumber(formattedPhone)) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');
    setOtp('');
    setOtpAttemptsRemaining(null);

    const result = await sendOTP(formattedPhone);
    setLoading(false);

    if (result?.error) {
      if (result.error.code === 'RATE_LIMIT') {
        setRateLimitCountdown(result.error.retryAfter || 60);
        setError(`Too many requests. Try again later.`);
      } else {
        setError(result.error.message);
      }
      return;
    }

    setStep('otp');
  };

  /* -------------------- OTP VERIFY -------------------- */

  const handleVerifyOTP = async () => {
    if (isVerifyingRef.current) return;
  
    if (otp.length !== 6) {
      setError('Please enter a 6-digit OTP');
      return;
    }
  
    isVerifyingRef.current = true;
    setLoading(true);
    setError('');
  
    const formattedPhone = formatPhoneNumber(phone);
    let hasError = false;
  
    try {
      const result = await authVerifyOTP(formattedPhone, otp);
  
      if (result?.error) {
        hasError = true;
        const code = result.error.code;
  
        if (code === 'OTP_EXPIRED' || code === 'OTP_NOT_FOUND') {
          setError('OTP expired. Please request a new one.');
          setStep('phone');
          setOtp('');
          return;
        }
  
        if (code === 'MAX_ATTEMPTS_EXCEEDED') {
          setError('Maximum attempts exceeded.');
          setStep('phone');
          setOtp('');
          return;
        }
  
        if (code === 'INVALID_OTP') {
          setError('Invalid OTP. Try again.');
          setOtp('');
          return;
        }
  
        setError(result.error.message);
        return;
      }
  
      // ✅ SUCCESS — user is logged in
      // AuthContext now has session + profile loaded
      // The navigation logic in _layout.tsx will automatically route the user
      // Keep loading true so user sees spinner while navigation happens
      
    } catch (error) {
      console.error('Unexpected error during OTP verification:', error);
      setError('An unexpected error occurred. Please try again.');
      hasError = true;
    } finally {
      isVerifyingRef.current = false;
      // Only set loading to false on errors
      if (hasError) {
        setLoading(false);
      }
    }
  };
  

  /* -------------------- UI -------------------- */

  return (
    <LinearGradient colors={[Colors.background.primary, '#FFFFFF']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>

            <View style={styles.headerContainer}>
              <Text style={styles.titleSmall}>Welcome to</Text>
              <ExternalLogo size={260} />
            </View>

            {step === 'phone' ? (
              <>
                <View style={styles.inputContainer}>
                  <Smartphone size={20} color="#FFA500" />
                  <TextInput
                    style={styles.input}
                    placeholder="Mobile Number"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    maxLength={13}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading}
                >
                  <LinearGradient colors={['#FFA500', '#FF8C00']} style={styles.buttonGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.otpLabel}>Enter 6-digit OTP</Text>

                <TextInput
                  style={styles.otpInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(val) => setOtp(val.replace(/\D/g, ''))}
                  textAlign="center"
                />

                {otpAttemptsRemaining !== null && (
                  <Text style={styles.attemptsText}>
                    {otpAttemptsRemaining} attempt(s) remaining
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                >
                  <LinearGradient colors={['#87CEEB', '#6BB6FF']} style={styles.buttonGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.button}
                  onPress={() => {
                    setStep('phone');
                    setOtp('');
                    setError('');
                  }}
                >
                  <LinearGradient
                    colors={[Colors.secondary.main, Colors.secondary.light]}
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

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.xxxl },

  headerContainer: { alignItems: 'center', marginBottom: Spacing.xl },
  titleSmall: { fontSize: 22, fontWeight: '600' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: Spacing.lg,
  },

  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },

  otpLabel: {
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },

  otpInput: {
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 12,
    borderColor: Colors.primary.main,
    marginBottom: 16,
  },

  button: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },

  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },

  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  errorContainer: {
    backgroundColor: Colors.error.light + '20',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },

  errorText: {
    color: Colors.error.main,
  },

  attemptsText: {
    textAlign: 'center',
    marginBottom: 8,
    color: Colors.warning.main,
  },
});
