import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera } from 'lucide-react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../contexts/AuthContext';
import { getFileUrl } from '../lib/api/fileStorage';
import { uploadProfilePhoto } from '../lib/api/media';
import { updateVendorMe } from '../lib/api/vendors';
import { resolveBusinessMediaUrl } from '../lib/businessApi';
import { getVendorBusinesses } from '../lib/api/vendorBusinesses';
import { validateEmail } from '../lib/validation';
import ScreenBackground from '../components/ScreenBackground';
import { stripCountryCode } from '../lib/formatters';


const profileSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string()
    .test('email-validation', 'Invalid email address', function (value) {
      if (!value || value.trim() === '') return true;
      return validateEmail(value);
    }),
});

export default function CompleteProfileScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string>('');
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();

  // Refs for keyboard navigation
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

  useEffect(() => {
    if (profile?.image_file_id && !photoUri) {
      getFileUrl(profile.image_file_id).then(({ data }) => {
        if (data?.url) setPhotoUri(resolveBusinessMediaUrl(data.url));
      }).catch(() => {});
    }
  }, [profile?.image_file_id]);
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

  const getInitials = (firstName: string, lastName: string) => {
    const f = firstName.trim() ? firstName.trim()[0] : '';
    const l = lastName.trim() ? lastName.trim()[0] : '';
    return (f + l).toUpperCase();
  };

  const pickImage = async () => {
    try {
      // On web, permissions are usually granted automatically
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo Library access is required. Go to Settings > Apps > BookMyVendors Business > Photos to enable.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1.0, // Use full quality initially, we'll compress after resize
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('Image selected:', result.assets[0].uri);
        // Resize the image before setting it
        const resizedUri = await resizeImage(result.assets[0].uri);
        setPhotoUri(resizedUri);
        setPhotoError(''); // Clear error when photo is selected
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required. Go to Settings > Apps > BookMyVendors Business > Camera to enable.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1.0, // Use full quality initially, we'll compress after resize
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      console.log('Photo taken:', result.assets[0].uri);
      // Resize the image before setting it
      const resizedUri = await resizeImage(result.assets[0].uri);
      setPhotoUri(resizedUri);
      setPhotoError(''); // Clear error when photo is selected
    }
  };

  const showImageOptions = () => {
    console.log('showImageOptions called, Platform:', Platform.OS);

    if (Platform.OS === 'web') {
      // On web, directly open file picker
      console.log('Web platform - opening image picker directly');
      pickImage();
    } else {
      // On mobile, use Alert to choose between camera and gallery
      Alert.alert('Choose Photo', 'Select an option', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  // Upload logic is now directly in handleSubmit to properly create file_storage records
  const handleSubmit = async (values: {
    firstName: string;
    lastName: string;
    email: string;
  }) => {
    console.log('handleSubmit called', {
      values,
      photoUri,
      userId: user?.id,
      hasPhoto: !!photoUri,
      hasUser: !!user?.id
    });

    if (!user?.id) {
      console.log('❌ No user ID - returning early');
      Alert.alert('Error', 'User not found. Please try logging in again.');
      return;
    }

    console.log('✅ Starting submission process');
    setUploading(true);

    try {
      let fileDataId: string | undefined;

      if (photoUri && !photoUri.startsWith('http')) {
        const fileExt = photoUri.split('.').pop() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const uploadResult = await uploadProfilePhoto(photoUri, fileName);
        if (uploadResult.error) throw new Error(uploadResult.error.error);
        if (uploadResult.data?.file_id) fileDataId = uploadResult.data.file_id;
      }

      const updatePayload: any = {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
        image_file_id: fileDataId || profile?.image_file_id,
      };
      const { error: vendorError } = await updateVendorMe(updatePayload);
      if (vendorError) throw new Error(vendorError.error);
      await refreshProfile();
      console.log('✅ Profile refreshed');

      const { data: businessList } = await getVendorBusinesses();
      if (businessList && businessList.length > 0) {
        router.replace('/(tabs)');
      } else {
        router.replace('/business-registration');
      }
    } catch (error: any) {
      console.error('❌ Profile submission error CATCH block:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to save profile. Please try again.'
      );
    } finally {
      console.log('🔄 Setting uploading to false');
      setUploading(false);
    }
  };

  return (
    <ScreenBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Please provide your details to continue
          </Text>

          <Formik
            initialValues={{
              firstName: profile?.first_name || '',
              lastName: profile?.last_name || '',
              email: profile?.email || '',
            }}
            validationSchema={profileSchema}
            onSubmit={handleSubmit}
            validateOnChange={true}
            validateOnBlur={true}
          >
            {({
              handleChange,
              handleBlur,
              handleSubmit: formikHandleSubmit,
              values,
              errors,
              touched,
              isValid,
            }) => (
              <>
                <View style={styles.photoSection}>
                  <Text style={styles.label}>
                    Profile Photo
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.photoContainer,
                      photoError && styles.photoContainerError
                    ]}
                    onPress={() => {
                      console.log('Photo container pressed');
                      showImageOptions();
                    }}
                    activeOpacity={0.7}
                  >
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.photo} />
                    ) : values.firstName || values.lastName ? (
                      <View style={[styles.photo, styles.initialsContainer]}>
                        <Text style={styles.initialsText}>
                          {getInitials(values.firstName, values.lastName)}
                        </Text>
                      </View>
                    ) : (
                      <View style={[
                        styles.photoPlaceholder,
                        photoError && styles.photoPlaceholderError
                      ]}>
                        <Camera size={32} color={photoError ? "#FF3B30" : "#999"} />
                        <Text style={[
                          styles.photoPlaceholderText,
                          photoError && styles.photoPlaceholderTextError
                        ]}>Add Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {photoError ? (
                    <Text style={styles.errorText}>{photoError}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    First Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, touched.firstName && errors.firstName && styles.inputError]}
                    placeholder="Enter first name"
                    value={values.firstName}
                    onChangeText={handleChange('firstName')}
                    onBlur={handleBlur('firstName')}
                    returnKeyType="next"
                    onSubmitEditing={() => lastNameRef.current?.focus()}
                  />
                  {touched.firstName && errors.firstName ? (
                    <Text style={styles.errorText}>{errors.firstName}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Last Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    ref={lastNameRef}
                    style={[styles.input, touched.lastName && errors.lastName && styles.inputError]}
                    placeholder="Enter last name"
                    value={values.lastName}
                    onChangeText={handleChange('lastName')}
                    onBlur={handleBlur('lastName')}
                    returnKeyType="next"
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                  {touched.lastName && errors.lastName ? (
                    <Text style={styles.errorText}>{errors.lastName}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Email Address
                  </Text>
                  <TextInput
                    ref={emailRef}
                    style={[styles.input, errors.email && styles.inputError]}
                    placeholder="Enter email address"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={values.email}
                    onChangeText={handleChange('email')}
                    onBlur={handleBlur('email')}
                    returnKeyType="done"
                    onSubmitEditing={() => formikHandleSubmit()}
                  />
                  {errors.email ? (
                    <Text style={styles.errorText}>{errors.email}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={[styles.button, uploading && styles.buttonDisabled]}
                  onPress={() => {
                    console.log('Continue button pressed', {
                      uploading,
                      values,
                      errors,
                      touched,
                      isValid,
                      hasErrors: Object.keys(errors).length > 0
                    });
                    formikHandleSubmit();
                  }}
                  disabled={uploading}
                  activeOpacity={0.8}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </Formik>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 32,
    cursor: 'pointer',
    zIndex: 1,
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
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
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
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    cursor: 'pointer',
    zIndex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  photoSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  photoContainerError: {
    borderWidth: 2,
    borderColor: '#FF3B30',
    borderRadius: 60,
  },
  photoPlaceholderError: {
    borderColor: '#FF3B30',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  photoPlaceholderTextError: {
    color: '#FF3B30',
  },
  initialsContainer: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '700',
  },
});
