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
import { Camera, LogOut, Save } from 'lucide-react-native';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore, supabaseCms } from '@/lib/supabase';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';
import Logo from '@/components/Logo';

const profileSchema = Yup.object().shape({
  firstName: Yup.string().required('First name is required'),
  lastName: Yup.string().required('Last name is required'),
  email: Yup.string().email('Invalid email').required('Email is required'),
});

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();
  
  // Refs for keyboard navigation
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        
        // Step 1: Upload image to storage bucket
        const response = await fetch(photoUri);
        if (!response.ok) {
          throw new Error('Failed to load image');
        }
        
        const blob = await response.blob();
        console.log('✅ Image blob created, size:', blob.size);
        
        // Determine file extension from blob type or URI
        let fileExt = 'jpg';
        if (blob.type) {
          if (blob.type.includes('png')) fileExt = 'png';
          else if (blob.type.includes('jpeg') || blob.type.includes('jpg')) fileExt = 'jpg';
          else if (blob.type.includes('webp')) fileExt = 'webp';
        } else {
          fileExt = photoUri.split('.').pop() || 'jpg';
        }
        
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`;
        const filePath = `profile-photos/${fileName}`;
        console.log('📤 Uploading to storage:', filePath);

        // Upload to storage bucket
        const { error: uploadError } = await supabaseCore.storage
          .from('vendor-media')
          .upload(filePath, blob, {
            contentType: blob.type || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
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
            file_size: blob.size,
            mime_type: blob.type || `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
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
      <View style={[styles.header, { paddingTop: insets.top + 20, paddingLeft: insets.top + 15, backgroundColor: '#fff' }]}>

        {/* <LinearGradient
        colors={[Colors.info.main, Colors.info.light]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      > */}
        <View style={styles.headerContent}>
          <Logo
            size={48}
            style={{ ...styles.headerLogo, transform: [{ scale: 1.1 }] }}
          />
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => handleSignOut()}
          activeOpacity={0.7} // This will help you see if press is registering
          disabled={false}
        >

          <LogOut size={20} color={Colors.neutral.black} strokeWidth={2} />
        </TouchableOpacity>
      </View>
      {/* </LinearGradient> */}

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
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
   
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerLogo: {
    marginRight: Spacing.sm,
    marginVertical: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlignVertical: 'center',
    height: '100%',
    color: Colors.neutral.black,
  },
  signOutButton: {
    padding: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
});
