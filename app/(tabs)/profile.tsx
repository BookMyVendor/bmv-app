import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera, LogOut, Save, ShieldAlert, Trash2 } from 'lucide-react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseCore, supabaseCms } from '../../lib/supabase';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';
import { validateEmail } from '../../lib/validation';
import Logo from '../../components/Logo';
import { sendOTP, resendOTP } from '../../lib/otpAuthApi';
import { confirmAccountDeletion } from '../../lib/accountDeletionApi';
import { getAccessToken } from '../../lib/tokenStorage';

const profileSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string()
    .required('Email is required')
    .test('email-validation', 'Invalid email address', function (value) {
      return validateEmail(value);
    }),
});

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile, verifyOTP: authVerifyOTP } = useAuth();
  const insets = useSafeAreaInsets();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionOtp, setDeletionOtp] = useState('');
  const [deletionStep, setDeletionStep] = useState<'idle' | 'otp'>('idle');
  const [deletionError, setDeletionError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [infoMessage, setInfoMessage] = useState('');
  const [showDeletionCard, setShowDeletionCard] = useState(false);
  const router = useRouter();

  // Refs for keyboard navigation
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  const formattedPhone = () => {
    const digits = profile?.phone?.replace(/\D/g, '') || '';
    if (!digits) return '';
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith('91')) return `+${digits}`;
    return `+${digits}`;
  };

  const handleRequestDeletionOtp = async () => {
    const phone = formattedPhone();
    if (!phone) {
      setDeletionError('Phone number is missing from your profile.');
      return;
    }

    setDeletionLoading(true);
    setDeletionError('');
    setInfoMessage('');
    setDeletionOtp('');
    const { error } = await sendOTP(phone);
    setDeletionLoading(false);

    if (error) {
      setDeletionError(error.message || 'Failed to send code.');
      if (error.retryAfter) setResendCountdown(error.retryAfter);
      return;
    }

    setDeletionStep('otp');
    setResendCountdown(30);
    setInfoMessage('Enter the code sent to your phone to confirm deletion.');
  };

  const handleResendDeletionOtp = async () => {
    if (resendCountdown > 0 || deletionLoading) return;
    const phone = formattedPhone();
    if (!phone) return;

    setDeletionLoading(true);
    setDeletionError('');
    const { error } = await resendOTP(phone);
    setDeletionLoading(false);

    if (error) {
      setDeletionError(error.message || 'Failed to resend code.');
      if (error.retryAfter) setResendCountdown(error.retryAfter);
      return;
    }

    setResendCountdown(60);
    setInfoMessage('New code sent. Please check your messages.');
  };

  const handleConfirmDeletion = async () => {
    if (deletionOtp.length !== 6) {
      setDeletionError('Please enter the 6-digit code.');
      return;
    }

    setDeletionLoading(true);
    setDeletionError('');
    setInfoMessage('Verifying code...');
    const phone = formattedPhone();

    // Re-verify OTP to confirm user intent and obtain fresh access token
    const verifyResult = await authVerifyOTP(phone, deletionOtp);
    if (verifyResult.error) {
      const code = (verifyResult.error as any).code;
      if (code === 'OTP_EXPIRED' || code === 'OTP_NOT_FOUND') {
        setDeletionError('Code expired. Please request a new one.');
        setDeletionStep('idle');
        setDeletionOtp('');
        setDeletionLoading(false);
        return;
      }
      if (code === 'MAX_ATTEMPTS_EXCEEDED') {
        setDeletionError('Maximum attempts exceeded.');
        setDeletionStep('idle');
        setDeletionOtp('');
        setDeletionLoading(false);
        return;
      }
      if (code === 'INVALID_OTP') {
        setDeletionError('Invalid code. Try again.');
        setDeletionOtp('');
        setDeletionLoading(false);
        return;
      }
      setDeletionError(verifyResult.error.message || 'Failed to verify code.');
      setDeletionLoading(false);
      return;
    }

    setInfoMessage('Deleting account...');
    const accessToken = await getAccessToken();
    if (!accessToken) {
      setDeletionError('Could not retrieve access token. Please try again.');
      setDeletionLoading(false);
      return;
    }

    const { error } = await confirmAccountDeletion({ accessToken });
    setDeletionLoading(false);

    if (error) {
      setDeletionError(error.message || 'Deletion failed.');
      return;
    }

    setInfoMessage('Account deleted. You will be signed out.');
    await signOut();
    router.replace('/');
  };

  const resetDeletionFlow = () => {
    setDeletionStep('idle');
    setDeletionOtp('');
    setDeletionError('');
    setInfoMessage('');
    setResendCountdown(0);
  };

  // Fetch image URL from file_storage when profile loads
  useEffect(() => {
    const fetchImageUrl = async () => {
      if (profile?.image_file_id) {
        const { data: fileData } = await supabaseCms
          .from('file_storage')
          .select('file_path, storage_bucket')
          .eq('id', profile.image_file_id)
          .single();

        if (fileData) {
          const { data: urlData } = supabaseCore.storage
            .from(fileData.storage_bucket || 'vendor-media')
            .getPublicUrl(fileData.file_path);
          setPhotoUri(urlData.publicUrl);
        }
      }
    };

    fetchImageUrl();
  }, [profile?.image_file_id]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCountdown]);

  const resizeImage = async (uri: string): Promise<string> => {
    try {
      console.log('Resizing image from:', uri);
      // Resize to max 800x800 for profile photos (good balance between quality and size)
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 800, height: 800 } }, // Max dimensions, maintains aspect ratio
        ],
        {
          compress: 0.8, // 80% quality
          format: ImageManipulator.SaveFormat.JPEG, // Use JPEG for smaller file size
        }
      );
      console.log('Image resized to:', manipulatedImage.uri);
      return manipulatedImage.uri;
    } catch (error) {
      console.error('Error resizing image:', error);
      // Return original URI if resize fails
      return uri;
    }
  };

  const pickImage = async () => {
    // On web, permissions are handled by the browser
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your photos');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1.0, // Use full quality initially, we'll compress after resize
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      // Resize the image before setting it
      const resizedUri = await resizeImage(result.assets[0].uri);
      setPhotoUri(resizedUri);
    }
  };

  const takePhoto = async () => {
    // Camera is typically not available on web
    if (Platform.OS === 'web') {
      // On web, just open image picker instead
      pickImage();
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1.0, // Use full quality initially, we'll compress after resize
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      // Resize the image before setting it
      const resizedUri = await resizeImage(result.assets[0].uri);
      setPhotoUri(resizedUri);
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === 'web') {
      // On web, directly open file picker (camera not typically available)
      pickImage();
    } else {
      // On mobile, use Alert to choose between camera and gallery
      Alert.alert('Change Photo', 'Select an option', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // Note: uploadImage function is no longer used directly
  // Upload logic is now in handleSubmit to properly create file_storage records

  const handleSubmit = async (values: {
    firstName: string;
    lastName: string;
    email: string;
  }) => {
    setUploading(true);

    try {
      let imageFileId = profile?.image_file_id;

      // If a new photo was selected (local URI or blob URL, not a remote URL), upload it and create file_storage record
      // Check if it's a local/blob URI (not an http/https URL from storage)
      const isLocalImage = photoUri && !photoUri.startsWith('http://') && !photoUri.startsWith('https://');

      if (isLocalImage) {
        console.log('📤 Uploading new profile photo:', photoUri);

        let blob: Blob | undefined;
        let fileExt = 'jpg';
        let fileName: string;
        let filePath: string;
        let file: any;
        if (Platform.OS === 'web') {
          // Web: fetch as before
          const response = await fetch(photoUri as string);
          if (!response.ok) {
            throw new Error('Failed to load image');
          }
          blob = await response.blob();
          if (blob.type) {
            if (blob.type.includes('png')) fileExt = 'png';
            else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) fileExt = 'jpg';
            else if (blob.type.includes('webp')) fileExt = 'webp';
          } else {
            fileExt = (photoUri as string).split('.').pop() || 'jpg';
          }
          fileName = `${user?.id}-${Date.now()}.${fileExt}`;
          filePath = `profile-photos/${fileName}`;
          file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
        } else {
          // React Native: use expo-file-system (legacy API for compatibility)
          const fs = await import('expo-file-system/legacy');
          const fileInfo = await fs.getInfoAsync(photoUri as string);
          if (!fileInfo.exists) throw new Error('File does not exist');
          fileExt = (photoUri as string).split('.').pop() || 'jpg';
          fileName = `${user?.id}-${Date.now()}.${fileExt}`;
          filePath = `profile-photos/${fileName}`;
          // Read as base64
          const base64Data = await fs.readAsStringAsync(photoUri as string, { encoding: 'base64' });
          // Turn base64 into buffer for upload
          let BufferClass = (global as any).Buffer || require('buffer').Buffer;
          file = BufferClass.from(base64Data, 'base64');
        }

        console.log('📤 Uploading to storage:', filePath);

        let blobObj: { size: number; type: string };
        if (Platform.OS === 'web') {
          blobObj = blob ? { size: blob.size, type: blob.type } : { size: 0, type: 'image/jpeg' };
        } else {
          blobObj = { size: file.length, type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}` };
        }

        const { error: uploadError } = await supabaseCore.storage
          .from('vendor-media')
          .upload(filePath, file, {
            contentType: blobObj.type || 'image/jpeg',
          });


        if (uploadError) {
          console.error('❌ Storage upload error:', uploadError);
          throw uploadError;
        }
        console.log('✅ Image uploaded to storage');

        // Step 2: Create file_storage record
        console.log('📤 Creating file_storage record');
        const { data: fileData, error: fileError } = await supabaseCms
          .from('file_storage')
          .insert({
            original_filename: fileName,
            stored_filename: fileName,
            file_path: filePath,
            file_size: blobObj.size,
            mime_type: blobObj.type,
            file_extension: fileExt,
            storage_provider: 'supabase',
            storage_bucket: 'vendor-media',
            upload_status: 'completed',
            uploaded_by_type: 'vendor',
            uploaded_by_id: user?.id,
          })
          .select()
          .single();

        if (fileError) {
          console.error('❌ File storage record error:', fileError);
          throw fileError;
        }
        console.log('✅ File storage record created:', fileData.id);
        imageFileId = fileData.id;

        // Step 3: Create vendor_verification_documents entry for profile photo
        const { data: docTypeData } = await supabaseCore
          .from('document_types')
          .select('id')
          .eq('type_code', 'profile_photo')
          .maybeSingle();

        if (docTypeData) {
          // Create verification document entry
          const { error: verificationDocError } = await supabaseCms
            .from('vendor_verification_documents')
            .insert({
              vendor_id: user?.id,
              document_type_id: docTypeData.id,
              file_id: fileData.id,
              verification_status: 'pending',
              uploaded_at: new Date().toISOString(),
            });

          // Don't throw error if this fails - it's optional tracking
          if (verificationDocError) {
            console.warn('Failed to create verification document entry:', verificationDocError);
          }
        }
        // no-op
      }

      // Step 4: Update vendors table
      console.log('📤 Updating vendor record');
      console.log('  - user?.id:', user?.id);
      console.log('  - imageFileId:', imageFileId);
      console.log('  - isLocalImage:', isLocalImage);
      console.log('  - update data:', {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        image_file_id: imageFileId || null,
      });

      const updateData: any = {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
      };

      // Only include image_file_id if we have a value (either new or existing)
      if (imageFileId) {
        updateData.image_file_id = imageFileId;
      }

      console.log('  - Final update data:', updateData);

      const { data: updateResult, error } = await supabaseCore
        .from('vendors')
        .update(updateData)
        .eq('id', user?.id)
        .select();

      if (error) {
        console.error('❌ Vendor update error:', error);
        console.error('  - Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      console.log('✅ Vendor record updated');
      console.log('  - Update result:', updateResult);

      // Verify the update by fetching the record
      const { data: verifyData, error: verifyError } = await supabaseCore
        .from('vendors')
        .select('image_file_id')
        .eq('id', user?.id)
        .single();

      if (verifyError) {
        console.warn('⚠️ Could not verify update:', verifyError);
      } else {
        console.log('✅ Verified image_file_id in database:', verifyData?.image_file_id);
      }

      // Small delay to ensure database update is committed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh profile to get updated data
      await refreshProfile();

      // If we uploaded a new image, update the photoUri to show the uploaded image
      if (isLocalImage && imageFileId) {
        // Fetch the public URL for the uploaded image
        const { data: fileData } = await supabaseCms
          .from('file_storage')
          .select('file_path, storage_bucket')
          .eq('id', imageFileId)
          .single();

        if (fileData) {
          const { data: urlData } = supabaseCore.storage
            .from(fileData.storage_bucket || 'vendor-media')
            .getPublicUrl(fileData.file_path);
          setPhotoUri(urlData.publicUrl);
          console.log('✅ Updated photoUri to:', urlData.publicUrl);
        }
      }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    if (Platform.OS === 'web') {
      // Web version
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (confirmed) {
        try {
          await signOut();
        } catch (error: any) {
          window.alert('Failed to sign out. Please try again.');
        }
      }
    } else {
      // Mobile version
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { height: insets.top + 60, paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Logo size={38} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => handleSignOut()}
          activeOpacity={0.7}
          disabled={false}
        >
          <LogOut size={20} color={Colors.neutral.black} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Formik
            initialValues={{
              firstName: profile?.first_name || '',
              lastName: profile?.last_name || '',
              email: profile?.email || '',
            }}
            validationSchema={profileSchema}
            onSubmit={handleSubmit}
            enableReinitialize
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit,
              values,
              errors,
              touched,
            }) => (
              <>
                <TouchableOpacity
                  style={styles.photoContainer}
                  onPress={showImageOptions}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photo} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Camera size={32} color={Colors.text.tertiary} />
                    </View>
                  )}
                  <LinearGradient
                    colors={[Colors.primary.main, Colors.primary.light]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.photoOverlay}
                  >
                    <Camera size={20} color={Colors.neutral.white} />
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>{profile?.phone}</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    First Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    ref={null}
                    style={styles.input}
                    placeholder="Enter first name"
                    value={values.firstName}
                    onChangeText={handleChange('firstName')}
                    onBlur={handleBlur('firstName')}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                  {touched.firstName && errors.firstName && (
                    <Text style={styles.errorText}>{errors.firstName}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Last Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    ref={lastNameRef}
                    style={styles.input}
                    placeholder="Enter last name"
                    value={values.lastName}
                    onChangeText={handleChange('lastName')}
                    onBlur={handleBlur('lastName')}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                  {touched.lastName && errors.lastName && (
                    <Text style={styles.errorText}>{errors.lastName}</Text>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Email Address <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    placeholder="Enter email address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    returnKeyType="done"
                    onSubmitEditing={() => handleSubmit()}
                  />
                  {touched.email && errors.email && (
                    <Text style={styles.errorText}>{errors.email}</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, uploading && styles.buttonDisabled]}
                  onPress={() => handleSubmit()}
                  disabled={uploading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[Colors.success.main, Colors.success.light]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveButtonGradient}
                  >
                    {uploading ? (
                      <ActivityIndicator color={Colors.neutral.white} />
                    ) : (
                      <>
                        <Save size={20} color={Colors.neutral.white} strokeWidth={2.5} />
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.dangerCardContainer}>
                  {!showDeletionCard ? (
                    <TouchableOpacity
                      style={[styles.dangerButton, styles.fullWidthButton]}
                      onPress={() => {
                        resetDeletionFlow();
                        setShowDeletionCard(true);
                      }}
                      activeOpacity={0.9}
                    >
                      <Trash2 size={18} color={Colors.neutral.white} />
                      <Text style={styles.dangerButtonText}>Delete Account</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.dangerCard}>
                      <View style={styles.dangerHeader}>
                        <ShieldAlert size={20} color={Colors.error.main} />
                        <Text style={styles.dangerTitle}>Delete Account</Text>
                      </View>
                      <Text style={styles.dangerText}>
                        Deleting your account will remove your profile and associated data. <Text style={styles.irreversibleText}>This action is irreversible.</Text>
                      </Text>

                      {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
                      {deletionError ? <Text style={styles.errorText}>{deletionError}</Text> : null}

                      {deletionStep === 'idle' ? (
                        <TouchableOpacity
                          style={[styles.dangerButton, deletionLoading && styles.buttonDisabled]}
                          onPress={handleRequestDeletionOtp}
                          disabled={deletionLoading}
                          activeOpacity={0.9}
                        >
                          {deletionLoading ? (
                            <ActivityIndicator color={Colors.neutral.white} />
                          ) : (
                            <>
                              <Trash2 size={18} color={Colors.neutral.white} />
                              <Text style={styles.dangerButtonText}>Request Deletion Code</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.otpBlock}>
                          <Text style={styles.otpLabel}>Enter the 6-digit code sent to {formattedPhone()}</Text>
                          <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            maxLength={6}
                            value={deletionOtp}
                            onChangeText={(text) => setDeletionOtp(text.replace(/\D/g, ''))}
                            placeholder="123456"
                          />
                          <View style={styles.otpActions}>
                            <TouchableOpacity
                              style={[styles.dangerButton, deletionLoading && styles.buttonDisabled]}
                              onPress={handleConfirmDeletion}
                              disabled={deletionLoading}
                              activeOpacity={0.9}
                            >
                              {deletionLoading ? (
                                <ActivityIndicator color={Colors.neutral.white} />
                              ) : (
                                <Text style={styles.dangerButtonText}>Confirm Deletion</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.secondaryLink}
                              onPress={() => {
                                resetDeletionFlow();
                                setShowDeletionCard(false);
                              }}
                              disabled={deletionLoading}
                            >
                              <Text style={styles.secondaryLinkText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                          <View style={styles.resendRow}>
                            {resendCountdown > 0 ? (
                              <Text style={styles.resendText}>Resend code in {resendCountdown}s</Text>
                            ) : (
                              <TouchableOpacity onPress={handleResendDeletionOtp} disabled={deletionLoading}>
                                <Text style={styles.secondaryLinkText}>Resend code</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </>
            )}
          </Formik>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(138, 151, 209, 0.02)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    height: '100%',
  },
  headerLogo: {
    marginRight: 4,
    marginVertical: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 22,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  signOutButton: {
    padding: Spacing.sm,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 24,
    flexGrow: 1,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.neutral.white,
    ...Shadows.medium,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    backgroundColor: Colors.neutral.white,
    borderWidth: 2,
    borderColor: Colors.neutral.light,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: 16,
    color: Colors.text.primary,
  },
  saveButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.md,
    ...Shadows.medium,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.neutral.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dangerCardContainer: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  dangerCard: {
    backgroundColor: '#fff7f7',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#ffd7d7',
    gap: Spacing.sm,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error.main,
  },
  dangerText: {
    color: Colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  dangerButton: {
    backgroundColor: Colors.error.main,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  fullWidthButton: {
    width: '100%',
  },
  dangerButtonText: {
    color: Colors.neutral.white,
    fontWeight: '700',
    fontSize: 15,
  },
  otpBlock: {
    gap: Spacing.sm,
  },
  otpLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  otpActions: {
    gap: Spacing.sm,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resendText: {
    color: Colors.text.secondary,
  },
  secondaryLink: {
    alignSelf: 'flex-start',
  },
  secondaryLinkText: {
    color: Colors.text.secondary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  infoText: {
    color: Colors.success.main,
    fontSize: 13,
  },
  irreversibleText: {
    color: Colors.error.main,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
});