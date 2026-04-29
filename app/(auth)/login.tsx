import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  SafeAreaView as RNSafeAreaView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, HelpCircle, UserCircle, ShieldCheck, Zap, ChevronRight, Users } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';
import ExternalLogo from '../../components/ExternalLogo';
import ScreenBackground from '../../components/ScreenBackground';
import { sendOTP, resendOTP } from '../../lib/authApi';


const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_SMALL_SCREEN = SCREEN_HEIGHT < 700;
const CONTENT_TOP_PADDING = IS_SMALL_SCREEN
  ? SCREEN_HEIGHT * 0.08
  : SCREEN_HEIGHT * 0.12;
const LOGO_SIZE = IS_SMALL_SCREEN ? 120 : 160;

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [otpAttemptsRemaining, setOtpAttemptsRemaining] = useState<number | null>(null);

  const isVerifyingRef = useRef(false);
  const { verifyOTP: authVerifyOTP } = useAuth();
  const router = useRouter();

  useEffect(() => {
    let timer: any;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

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
      setError('Please enter a valid business contact number');
      return;
    }

    setLoading(true);
    setError('');
    setOtp('');
    setOtpAttemptsRemaining(null);

    console.log('[handleSendOTP] Sending OTP for phone:', formattedPhone);
    const result = await sendOTP(formattedPhone);
    console.log('[handleSendOTP] Result:', result);
    setLoading(false);

    if (result?.error) {
      console.error('[handleSendOTP] Error:', result.error);
      if (result.error.code === 'RATE_LIMIT') {
        setRateLimitCountdown(result.error.retryAfter || 60);
        setError(`Too many requests. Try again later.`);
      } else {
        setError(result.error.message);
      }
      return;
    }

    setStep('otp');
    setResendCountdown(30); // Initial 30s countdown
  };

  /* -------------------- OTP RESEND -------------------- */

  const handleResendOTP = async () => {
    if (resendCountdown > 0 || loading) return;

    setLoading(true);
    setError('');
    setOtp('');

    const formattedPhone = formatPhoneNumber(phone);
    const result = await resendOTP(formattedPhone);
    setLoading(false);

    if (result?.error) {
      setError(result.error.message);
      return;
    }

    setResendCountdown(60); // Set to 60s for subsequent resends
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
        const code = (result.error as any).code;

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
    <ScreenBackground style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.innerContent}>
              {/* MAIN CONTENT (fills space) */}
              <View style={{ flex: 1, paddingBottom: 20 }}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={styles.headerContainer}>
                    <Text style={styles.titleSmall}>Welcome to</Text>
                    <ExternalLogo size={LOGO_SIZE} />
                  </View>
                </TouchableWithoutFeedback>

                <View style={styles.formCard}>
                  {/* Step Indicator */}
                  <View style={styles.stepIndicatorContainer}>
                    <View style={[styles.stepDot, step === 'phone' ? styles.stepDotActive : styles.stepDotInactive]} />
                    <View style={[styles.stepDot, step === 'otp' ? styles.stepDotActive : styles.stepDotInactive]} />
                  </View>

                  {step === 'phone' ? (
                    <>
                      <Text style={styles.formTitle}>Enter Mobile Number</Text>
                      <Text style={styles.formHint}>
                        We'll send the OTP via WhatsApp—use a number that has it.
                      </Text>
                      <View style={styles.inputContainer}>
                        <Smartphone size={20} color="#FFA500" />
                        <TextInput
                          style={styles.input}
                          placeholder="Mobile number"
                          placeholderTextColor="#1a1a1a"
                          keyboardType="phone-pad"
                          value={phone}
                          onChangeText={(text) => {
                            const digitsOnly = text.replace(/\D/g, '');
                            if (digitsOnly.length <= 10) {
                              setPhone(digitsOnly);
                            }
                          }}
                          maxLength={10}
                          returnKeyType="send"
                          onSubmitEditing={handleSendOTP}
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
                      <Text style={styles.formTitle}>Verify OTP</Text>
                      <View style={styles.otpHeader}>
                        <Text style={styles.otpLabel}>Enter the 6-digit OTP sent on WhatsApp to</Text>
                        <Text style={styles.phoneNumberDisplay}>{phone}</Text>
                      </View>
                      <Text style={styles.otpHint}>Check your WhatsApp for the code.</Text>

                      <TextInput
                        style={styles.otpInput}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otp}
                        onChangeText={(val) => setOtp(val.replace(/\D/g, ''))}
                        textAlign="center"
                        autoFocus={true}
                        returnKeyType="done"
                        onSubmitEditing={handleVerifyOTP}
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

                      <View style={styles.otpFooter}>
                        <TouchableOpacity
                          onPress={() => {
                            setStep('phone');
                            setOtp('');
                            setError('');
                          }}
                          disabled={loading}
                        >
                          <Text style={[styles.footerLink, loading && styles.disabledLink]}>Change Business Contact Number</Text>
                        </TouchableOpacity>

                        <View>
                          {resendCountdown > 0 ? (
                            <Text style={styles.resendText}>
                              Resend in <Text style={styles.countdownText}>{resendCountdown}s</Text>
                            </Text>
                          ) : (
                            <TouchableOpacity onPress={handleResendOTP} disabled={loading}>
                              <Text style={[styles.footerLink, loading && styles.disabledLink]}>Resend OTP</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Process Step Timeline */}
                {step === 'phone' && (
                  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View>
                      <View style={styles.processContainer}>
                        <View style={styles.processLine} />
                        <View style={styles.processItem}>
                          <View style={styles.processIconContainer}>
                            <UserCircle size={24} color={Colors.primary.main} />
                          </View>
                          <Text style={styles.processText}>Set up profile</Text>
                        </View>

                        <ChevronRight size={16} color="#CED4DA" style={styles.processArrow} />

                        <View style={styles.processItem}>
                          <View style={styles.processIconContainer}>
                            <ShieldCheck size={24} color="#4CAF50" />
                          </View>
                          <Text style={styles.processText}>Get verified</Text>
                        </View>

                        <ChevronRight size={16} color="#CED4DA" style={styles.processArrow} />

                        <View style={styles.processItem}>
                          <View style={styles.processIconContainer}>
                            <Zap size={24} color="#FFD700" />
                          </View>
                          <Text style={styles.processText}>Receive leads</Text>
                        </View>
                      </View>

                      <Text style={styles.tagline}>Grow your event business. Get genuine leads.</Text>

                      {/* Social Proof / Trust Banner */}
                      <View style={styles.trustBanner}>
                        <View style={styles.trustIconCircle}>
                          <Users size={14} color="#FFF" />
                        </View>
                        <Text style={styles.trustText}>Building India's Largest Event Vendor Network</Text>
                      </View>

                      {process.env.EXPO_PUBLIC_NODE_ENV === 'development' && (
                        <Text style={styles.devTag}>DEVELOPMENT</Text>
                      )}
                    </View>
                  </TouchableWithoutFeedback>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Bottom anchored support links */}
      <SafeAreaView edges={['bottom']} style={styles.safeSupportContainer}>
        <View style={styles.supportContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {/* Add support link logic */ }}
            style={styles.supportButton}
          >
            <HelpCircle size={16} color={Colors.primary.main} />
            <Text style={styles.supportText}>
              Need help? <Text style={styles.supportLink}>Contact Support</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xxxl,
    paddingTop: CONTENT_TOP_PADDING,
  },
  innerContent: {
    flex: 1,
    width: '100%',
  },

  headerContainer: { alignItems: 'center', marginBottom: Spacing.md },
  titleSmall: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: Spacing.xs
  },
  tagline: {
    marginTop: Spacing.xl,
    fontSize: 15,
    color: Colors.text.secondary,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },

  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    padding: Spacing.xl,
    ...Shadows.medium,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },

  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },

  formHint: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },

  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: 8,
  },
  stepDot: {
    height: 4,
    width: 24,
    borderRadius: 2,
  },
  stepDotActive: {
    backgroundColor: Colors.primary.main,
  },
  stepDotInactive: {
    backgroundColor: '#E9ECEF',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: Spacing.lg,
    ...Shadows.small,
  },

  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },

  otpLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },

  otpHeader: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },

  otpHint: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  phoneDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  phoneNumberDisplay: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },

  editButton: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: Colors.primary.light + '20',
    borderRadius: 4,
  },

  editText: {
    fontSize: 12,
    color: Colors.primary.main,
    fontWeight: '600',
  },

  otpInput: {
    height: 56,
    borderWidth: 2,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 12,
    borderColor: Colors.primary.main,
    marginBottom: 24,
  },

  otpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: 4,
  },

  resendText: {
    fontSize: 13,
    color: '#666',
  },

  countdownText: {
    fontWeight: '700',
    color: Colors.primary.main,
  },

  footerLink: {
    fontSize: 13,
    color: Colors.primary.main,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  disabledLink: {
    opacity: 0.5,
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
    color: '#FFFFFF',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  processContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.sm,
    position: 'relative',
  },
  processLine: {
    position: 'absolute',
    top: 12,
    left: '15%',
    right: '15%',
    height: 1,
    backgroundColor: '#E9ECEF',
    zIndex: -1,
  },
  processItem: {
    alignItems: 'center',
    flex: 1,
  },
  processIconContainer: {
    backgroundColor: '#FDFBF7',
    paddingHorizontal: 8,
  },
  processText: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
  processArrow: {
    marginTop: -20,
    marginHorizontal: -8,
  },

  trustBanner: {
    marginTop: Spacing.xxl,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignSelf: 'center',
    ...Shadows.small,
  },
  trustIconCircle: {
    backgroundColor: Colors.primary.main,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  trustText: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  devTag: {
    color: '#FF0000',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: Spacing.md,
    fontSize: 16,
    textTransform: 'uppercase',
  },

  safeSupportContainer: {
    backgroundColor: 'transparent',
  },
  supportContainer: {
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 10 : 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  supportText: {
    marginLeft: 8,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  supportLink: {
    color: Colors.primary.main,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
