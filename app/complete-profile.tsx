import React, { useState, useRef } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore, supabaseCms } from '@/lib/supabase';

const profileSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
});

export default function CompleteProfileScreen() {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  
  // Refs for keyboard navigation
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
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
    try {
      // On web, permissions are usually granted automatically
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Please allow access to your photos');
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
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
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
      console.log('Photo taken:', result.assets[0].uri);
      // Resize the image before setting it
      const resizedUri = await resizeImage(result.assets[0].uri);
      setPhotoUri(resizedUri);
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
      let fileDataId: string | null = null;

      // Step 1: Upload image to storage bucket (if photo provided)
      if (photoUri) {
        console.log('📤 Step 1: Fetching image from URI:', photoUri);
        const response = await fetch(photoUri);
        if (!response.ok) {
          console.error('❌ Failed to fetch image:', response.status, response.statusText);
          throw new Error('Failed to load image');
        }
        console.log('✅ Image fetched successfully');
        
        const blob = await response.blob();
        console.log('✅ Blob created, size:', blob.size);
        
        const fileExt = photoUri.split('.').pop() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `profile-photos/${fileName}`;
        console.log('📤 Step 2: Uploading to storage:', filePath);

        // Upload to storage bucket
        const { error: uploadError } = await supabaseCore.storage
          .from('profile_image')
          .upload(filePath, blob);

        if (uploadError) {
          console.error('❌ Storage upload error:', uploadError);
          throw uploadError;
        }
        console.log('✅ Image uploaded to storage');

        // Step 2: Create file_storage record
        console.log('📤 Step 3: Creating file_storage record');
        const { data: fileData, error: fileError } = await supabaseCms
          .from('file_storage')
          .insert({
            original_filename: fileName,
            stored_filename: fileName,
            file_path: filePath,
            file_size: blob.size,
            mime_type: blob.type || `image/${fileExt}`,
            file_extension: fileExt,
            storage_provider: 'supabase',
            storage_bucket: 'profile_image',
            upload_status: 'completed',
            uploaded_by_type: 'vendor',
            uploaded_by_id: user?.id,
          })
          .select()
          .single();

        if (fileError) {
          console.error('❌ file_storage insert error:', fileError);
          throw fileError;
        }
        console.log('✅ file_storage record created:', fileData?.id);
        fileDataId = fileData.id;
      } else {
        console.log('ℹ️ No photo provided, skipping image upload');
      }

      // Step 3: Update vendors table
      console.log('📤 Step 4: Updating vendors table');
      const updateData: any = {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email,
      };
      
      if (fileDataId) {
        updateData.image_file_id = fileDataId;
      }

      const { error: vendorError } = await supabaseCore
        .from('vendors')
        .update(updateData)
        .eq('id', user?.id);

      if (vendorError) {
        console.error('❌ vendors update error:', vendorError);
        throw vendorError;
      }
      console.log('✅ vendors table updated');

      // Step 4: Create vendor_verification_documents entry for profile photo (if photo uploaded)
      if (fileDataId) {
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
              file_id: fileDataId,
              verification_status: 'pending',
              uploaded_at: new Date().toISOString(),
            });

          // Don't throw error if this fails - it's optional tracking
          if (verificationDocError) {
            console.warn('Failed to create verification document entry:', verificationDocError);
          }
        }
      }

      console.log('📤 Step 5: Refreshing profile');
      await refreshProfile();
      
      // Wait longer to ensure profile state is updated in AuthContext
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✅ All steps completed, navigating to business-registration');
      // Use push instead of replace to avoid navigation conflicts
      router.push('/business-registration');
    } catch (error: any) {
      console.error('❌ Profile submission error:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        code: error.code,
        hint: error.hint,
        fullError: error
      });
      Alert.alert(
        'Error', 
        error.message || error.details || error.hint || 'Failed to save profile. Please try again.'
      );
    } finally {
      console.log('🔄 Setting uploading to false');
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Complete Your Profile</Text>
        <Text style={styles.subtitle}>
          Please provide your details to continue
        </Text>

      <Formik
        initialValues={{ firstName: '', lastName: '', email: '' }}
        validationSchema={profileSchema}
        onSubmit={handleSubmit}
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
            <TouchableOpacity
              style={styles.photoContainer}
              onPress={() => {
                console.log('Photo container pressed');
                showImageOptions();
              }}
              activeOpacity={0.7}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Camera size={32} color="#999" />
                  <Text style={styles.photoPlaceholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                First Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
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
                onSubmitEditing={() => formikHandleSubmit()}
              />
              {touched.email && errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.button, uploading && styles.buttonDisabled]}
              onPress={(e) => {
                console.log('Continue button pressed', { 
                  uploading, 
                  values, 
                  errors, 
                  touched, 
                  isValid,
                  hasErrors: Object.keys(errors).length > 0
                });
                e?.preventDefault?.();
                e?.stopPropagation?.();
                // Trigger Formik validation and submit
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    flexGrow: 1,
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
});
