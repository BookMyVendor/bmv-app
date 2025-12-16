import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image as RNImage,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Globe, Instagram, Facebook, Youtube, Image, Plus, X, Star } from 'lucide-react-native';
import { pickMultipleImages, uploadMultipleBusinessImages, pickImage } from '@/lib/businessApi';

interface PortfolioSocialStepProps {
  data: any;
  onUpdate: (data: any) => void;
}

export default function PortfolioSocialStep({
  data,
  onUpdate,
}: PortfolioSocialStepProps) {
  const [portfolioImages, setPortfolioImages] = useState<string[]>(data.portfolioImages || []);
  const [coverPhotoUri, setCoverPhotoUri] = useState<string | null>(data.coverPhotoUri || null);
  const [uploading, setUploading] = useState(false);

  // Refs for keyboard navigation
  const websiteUrlRef = useRef<TextInput>(null);
  const instagramUrlRef = useRef<TextInput>(null);
  const facebookUrlRef = useRef<TextInput>(null);
  const youtubeUrlRef = useRef<TextInput>(null);

  const handleChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  const handlePickImages = async () => {
    // Don't upload during registration - just store URIs
    // Images will be uploaded after business creation
    if (portfolioImages.length >= 20) {
      Alert.alert('Limit Reached', 'Maximum 20 images allowed per business.');
      return;
    }

    const { uris, error } = await pickMultipleImages();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (uris.length === 0) return;

    const remainingSlots = 20 - portfolioImages.length;
    if (uris.length > remainingSlots) {
      Alert.alert(
        'Too Many Images',
        `You can only add ${remainingSlots} more images. Maximum is 20 images per business.`
      );
      return;
    }

    // Store image URIs - they'll be uploaded after business creation
    const newImages = [...portfolioImages, ...uris];
    setPortfolioImages(newImages);
    onUpdate({ portfolioImages: newImages });
  };

  const handleRemoveImage = (index: number) => {
    const newImages = [...portfolioImages];
    newImages.splice(index, 1);
    setPortfolioImages(newImages);
    onUpdate({ portfolioImages: newImages });
  };

  const handlePickCoverImage = async () => {
    const { uri, error } = await pickImage();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (uri) {
      setCoverPhotoUri(uri);
      onUpdate({ coverPhotoUri: uri });
    }
  };

  const handleRemoveCoverImage = () => {
    setCoverPhotoUri(null);
    onUpdate({ coverPhotoUri: undefined });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Showcase Your Work</Text>
        <Text style={styles.infoText}>
          Add your social media profiles and portfolio to help customers see
          your work and connect with you.
        </Text>
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Globe size={16} color="#666" />
          <Text style={styles.label}>Website URL</Text>
        </View>
        <TextInput
          ref={websiteUrlRef}
          style={styles.input}
          value={data.websiteUrl || ''}
          onChangeText={(text) => handleChange('websiteUrl', text)}
          placeholder="https://www.yourbusiness.com"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="next"
          onSubmitEditing={() => instagramUrlRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Instagram size={16} color="#666" />
          <Text style={styles.label}>Instagram URL</Text>
        </View>
        <TextInput
          ref={instagramUrlRef}
          style={styles.input}
          value={data.instagramUrl || ''}
          onChangeText={(text) => handleChange('instagramUrl', text)}
          placeholder="https://instagram.com/yourbusiness"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="next"
          onSubmitEditing={() => facebookUrlRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Facebook size={16} color="#666" />
          <Text style={styles.label}>Facebook URL</Text>
        </View>
        <TextInput
          ref={facebookUrlRef}
          style={styles.input}
          value={data.facebookUrl || ''}
          onChangeText={(text) => handleChange('facebookUrl', text)}
          placeholder="https://facebook.com/yourbusiness"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="next"
          onSubmitEditing={() => youtubeUrlRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Youtube size={16} color="#666" />
          <Text style={styles.label}>YouTube URL</Text>
        </View>
        <TextInput
          ref={youtubeUrlRef}
          style={styles.input}
          value={data.youtubeUrl || ''}
          onChangeText={(text) => handleChange('youtubeUrl', text)}
          placeholder="https://youtube.com/@yourbusiness"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="url"
          returnKeyType="done"
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Star size={16} color="#666" />
          <Text style={styles.label}>Cover Image</Text>
        </View>
        <Text style={styles.uploadHintTop}>
          This image will be displayed as the main cover photo for your business on the dashboard.
        </Text>
        
        {coverPhotoUri ? (
          <View style={styles.coverImageContainer}>
            <RNImage source={{ uri: coverPhotoUri }} style={styles.coverImage} />
            <TouchableOpacity
              style={styles.removeCoverButton}
              onPress={handleRemoveCoverImage}
            >
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.coverImagePlaceholder}
            onPress={handlePickCoverImage}
            activeOpacity={0.7}
          >
            <Image size={32} color="#999" />
            <Text style={styles.coverImagePlaceholderText}>Select Cover Image</Text>
            <Text style={styles.coverImagePlaceholderHint}>Recommended: 1200x600px</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Image size={16} color="#666" />
          <Text style={styles.label}>Portfolio Images</Text>
          <Text style={styles.imageCount}>
            ({portfolioImages.length}/20)
          </Text>
        </View>
        <Text style={styles.uploadHintTop}>
          Images are compressed to ~500KB. Recommended: 800px width, good lighting.
        </Text>

        {portfolioImages.length > 0 && (
          <View style={styles.imageGrid}>
            {portfolioImages.map((uri, index) => (
              <View key={index} style={styles.imageContainer}>
                <RNImage source={{ uri }} style={styles.thumbnailImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveImage(index)}
                >
                  <X size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.uploadButton,
            (uploading || portfolioImages.length >= 20) && styles.uploadButtonDisabled,
          ]}
          onPress={handlePickImages}
          disabled={uploading || portfolioImages.length >= 20}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.uploadButtonText}>Uploading...</Text>
            </>
          ) : (
            <>
              <Plus size={20} color="#fff" />
              <Text style={styles.uploadButtonText}>
                {portfolioImages.length === 0 ? 'Add Portfolio Images' : 'Add More Images'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          💡 Tip: Complete social profiles receive 3x more customer inquiries
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  infoBox: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0066cc',
    lineHeight: 20,
  },
  imageCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  uploadHintTop: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 16,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  imageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    backgroundColor: '#0066cc',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadButtonDisabled: {
    backgroundColor: '#ccc',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tipBox: {
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#996600',
    lineHeight: 20,
  },
  coverImageContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  removeCoverButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ff4444',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  coverImagePlaceholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  coverImagePlaceholderHint: {
    fontSize: 12,
    color: '#999',
  },
});
