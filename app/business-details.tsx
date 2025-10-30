import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  Calendar,
  X,
  Tag,
  ZoomIn,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import {
  getBusinessDetails,
  getOffers,
  getBusinessImages,
  createOffer,
  updateOffer,
  deleteOffer,
  uploadBusinessImage,
  deleteBusinessImage,
  updateBusinessDetails,
  uploadOfferBanner,
  pickImage,
  pickMultipleImages,
  uploadMultipleBusinessImages,
  Offer,
  PortfolioImage,
} from '@/lib/businessApi';

type SectionType = 'offers' | 'gallery' | 'edit';

export default function BusinessDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [activeSection, setActiveSection] = useState<SectionType>('offers');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [offerBannerUri, setOfferBannerUri] = useState<string | null>(null);
  const [offerValidUntil, setOfferValidUntil] = useState('');
  const [offerDiscount, setOfferDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMultiple, setUploadingMultiple] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const [editData, setEditData] = useState<any>({});
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [businessRes, offersRes, imagesRes] = await Promise.all([
        getBusinessDetails(id),
        getOffers(id),
        getBusinessImages(id),
      ]);

      if (businessRes.error) throw businessRes.error;
      if (offersRes.error) throw offersRes.error;
      if (imagesRes.error) throw imagesRes.error;

      setBusiness(businessRes.data);
      setOffers(offersRes.data || []);
      setImages(imagesRes.data || []);
      setEditData(businessRes.data || {});
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load business details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePickOfferBanner = async () => {
    const { uri, error } = await pickImage();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (uri) {
      setOfferBannerUri(uri);
    }
  };

  const handleCreateOffer = async () => {
    if (!offerTitle.trim() || !offerDescription.trim() || !offerValidUntil) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      let bannerUrl = null;

      if (offerBannerUri) {
        const { url, error } = await uploadOfferBanner(id, offerBannerUri);
        if (error) throw error;
        bannerUrl = url;
      }

      const offerData = {
        business_id: id,
        title: offerTitle,
        description: offerDescription,
        banner_image_url: bannerUrl,
        discount_percentage: offerDiscount ? parseInt(offerDiscount) : null,
        valid_until: offerValidUntil,
      };

      const { data, error } = await createOffer(offerData);
      if (error) throw error;

      setOffers([data!, ...offers]);
      resetOfferForm();
      setShowOfferModal(false);
      Alert.alert('Success', 'Offer created successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOffer = async () => {
    if (!editingOffer) return;

    try {
      setSubmitting(true);
      let bannerUrl = editingOffer.banner_image_url;

      if (offerBannerUri && offerBannerUri !== editingOffer.banner_image_url) {
        const { url, error } = await uploadOfferBanner(id, offerBannerUri);
        if (error) throw error;
        bannerUrl = url;
      }

      const offerData = {
        title: offerTitle,
        description: offerDescription,
        banner_image_url: bannerUrl,
        discount_percentage: offerDiscount ? parseInt(offerDiscount) : null,
        valid_until: offerValidUntil,
      };

      const { data, error } = await updateOffer(editingOffer.id, offerData);
      if (error) throw error;

      setOffers(offers.map((o) => (o.id === editingOffer.id ? data! : o)));
      resetOfferForm();
      setShowOfferModal(false);
      Alert.alert('Success', 'Offer updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffer = (offer: Offer) => {
    Alert.alert(
      'Delete Offer',
      'Are you sure you want to delete this offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteOffer(offer.id);
              if (error) throw error;
              setOffers(offers.filter((o) => o.id !== offer.id));
              Alert.alert('Success', 'Offer deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete offer');
            }
          },
        },
      ]
    );
  };

  const handleUploadImage = async () => {
    if (images.length >= 20) {
      Alert.alert('Limit Reached', 'Maximum 20 images allowed per business');
      return;
    }

    const { uri, error } = await pickImage();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (uri) {
      try {
        setUploading(true);
        const { data, error: uploadError } = await uploadBusinessImage(id, uri);
        if (uploadError) throw uploadError;
        setImages([...images, data!]);
        Alert.alert('Success', 'Image uploaded successfully');
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleUploadMultipleImages = async () => {
    const availableSlots = 20 - images.length;
    if (availableSlots === 0) {
      Alert.alert('Limit Reached', 'Maximum 20 images allowed per business');
      return;
    }

    const { uris, error } = await pickMultipleImages();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (uris.length === 0) {
      return;
    }

    if (uris.length > availableSlots) {
      Alert.alert(
        'Too Many Images',
        `You can only upload ${availableSlots} more image(s). Currently at ${images.length}/20.`
      );
      return;
    }

    try {
      setUploadingMultiple(true);
      setUploadProgress({ current: 0, total: uris.length });

      const { results, successCount, error: uploadError } =
        await uploadMultipleBusinessImages(id, uris, (current, total) => {
          setUploadProgress({ current, total });
        });

      if (uploadError) throw uploadError;

      await loadData();

      const failCount = results.length - successCount;
      if (failCount === 0) {
        Alert.alert(
          'Success',
          `All ${successCount} images uploaded successfully!`
        );
      } else if (successCount === 0) {
        Alert.alert('Error', 'All uploads failed. Please try again.');
      } else {
        Alert.alert(
          'Partial Success',
          `${successCount} of ${results.length} images uploaded successfully. ${failCount} failed.`
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload images');
    } finally {
      setUploadingMultiple(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const handleDeleteImage = (image: PortfolioImage) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteBusinessImage(image.id);
              if (error) throw error;
              setImages(images.filter((img) => img.id !== image.id));
              Alert.alert('Success', 'Image deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete image');
            }
          },
        },
      ]
    );
  };

  const openOfferModal = (offer?: Offer) => {
    if (offer) {
      setEditingOffer(offer);
      setOfferTitle(offer.title);
      setOfferDescription(offer.description);
      setOfferBannerUri(offer.banner_image_url);
      setOfferValidUntil(offer.valid_until);
      setOfferDiscount(
        offer.discount_percentage ? offer.discount_percentage.toString() : ''
      );
    }
    setShowOfferModal(true);
  };

  const resetOfferForm = () => {
    setEditingOffer(null);
    setOfferTitle('');
    setOfferDescription('');
    setOfferBannerUri(null);
    setOfferValidUntil('');
    setOfferDiscount('');
  };

  const handleSaveDetails = async () => {
    try {
      setSavingDetails(true);
      const { data, error } = await updateBusinessDetails(id, editData);
      if (error) throw error;
      setBusiness(data);
      Alert.alert('Success', 'Business details updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update business details');
    } finally {
      setSavingDetails(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  const renderOfferCard = (offer: Offer) => (
    <View key={offer.id} style={styles.offerCard}>
      {offer.banner_image_url && (
        <Image
          source={{ uri: offer.banner_image_url }}
          style={styles.offerBanner}
          resizeMode="cover"
        />
      )}
      <View style={styles.offerContent}>
        <View style={styles.offerHeader}>
          <Text style={styles.offerTitle} numberOfLines={2}>
            {offer.title}
          </Text>
          {offer.discount_percentage && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{offer.discount_percentage}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.offerDescription} numberOfLines={3}>
          {offer.description}
        </Text>
        <View style={styles.offerFooter}>
          <View style={styles.offerDate}>
            <Calendar size={16} color="#666" />
            <Text style={[styles.offerDateText, isExpired(offer.valid_until) && styles.expiredText]}>
              Valid until {formatDate(offer.valid_until)}
            </Text>
          </View>
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => openOfferModal(offer)}
            >
              <Edit size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => handleDeleteOffer(offer)}
            >
              <Trash2 size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const renderImageItem = ({ item }: { item: PortfolioImage }) => {
    const imageSource = item.image_base64 || item.image_url;

    return (
      <TouchableOpacity
        style={styles.imageGridItem}
        onPress={() => {
          setPreviewImageUrl(imageSource);
          setShowImagePreview(true);
        }}
      >
        <Image source={{ uri: imageSource || undefined }} style={styles.galleryImage} />
        <TouchableOpacity
          style={styles.deleteImageButton}
          onPress={() => handleDeleteImage(item)}
        >
          <Trash2 size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Business not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2563EB', '#06B6D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ChevronLeft size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {business.business_name}
            </Text>
            <Text style={styles.headerSubtitle}>
              {business.vendor_service_category}
            </Text>
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === 'offers' && styles.activeTab,
            ]}
            onPress={() => setActiveSection('offers')}
          >
            <Tag size={20} color={activeSection === 'offers' ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text
              style={[
                styles.tabText,
                activeSection === 'offers' && styles.activeTabText,
              ]}
            >
              Offers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === 'gallery' && styles.activeTab,
            ]}
            onPress={() => setActiveSection('gallery')}
          >
            <ImageIcon size={20} color={activeSection === 'gallery' ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text
              style={[
                styles.tabText,
                activeSection === 'gallery' && styles.activeTabText,
              ]}
            >
              Gallery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === 'edit' && styles.activeTab,
            ]}
            onPress={() => setActiveSection('edit')}
          >
            <Edit size={20} color={activeSection === 'edit' ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text
              style={[
                styles.tabText,
                activeSection === 'edit' && styles.activeTabText,
              ]}
            >
              Edit Details
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeSection === 'offers' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Offers & Promotions</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => openOfferModal()}
              >
                <Plus size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add Offer</Text>
              </TouchableOpacity>
            </View>

            {offers.length === 0 ? (
              <View style={styles.emptyState}>
                <Tag size={48} color="#ddd" />
                <Text style={styles.emptyStateTitle}>No Offers Yet</Text>
                <Text style={styles.emptyStateText}>
                  Create promotional offers to attract more customers
                </Text>
              </View>
            ) : (
              <View style={styles.offersGrid}>
                {offers.map((offer) => renderOfferCard(offer))}
              </View>
            )}
          </View>
        )}

        {activeSection === 'gallery' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Business Gallery</Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.addButton, styles.smallButton]}
                  onPress={handleUploadImage}
                  disabled={uploading || uploadingMultiple || images.length >= 20}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Plus size={18} color="#fff" />
                      <Text style={styles.smallButtonText}>Single</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, styles.smallButton]}
                  onPress={handleUploadMultipleImages}
                  disabled={uploading || uploadingMultiple || images.length >= 20}
                >
                  {uploadingMultiple ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <ImageIcon size={18} color="#fff" />
                      <Text style={styles.smallButtonText}>Multiple</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {uploadingMultiple && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Uploading {uploadProgress.current} of {uploadProgress.total} images...
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <Text style={styles.imageCounter}>
              {images.length}/20 images uploaded
            </Text>

            {images.length === 0 ? (
              <View style={styles.emptyState}>
                <ImageIcon size={48} color="#ddd" />
                <Text style={styles.emptyStateTitle}>No Images Yet</Text>
                <Text style={styles.emptyStateText}>
                  Upload images to showcase your work
                </Text>
              </View>
            ) : (
              <FlatList
                data={images}
                renderItem={renderImageItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                columnWrapperStyle={styles.imageRow}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {activeSection === 'edit' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit Business Details</Text>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Basic Information</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Business Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.business_name || ''}
                  onChangeText={(text) => setEditData({ ...editData, business_name: text })}
                  placeholder="Enter business name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Contact Person Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.contact_person_name || ''}
                  onChangeText={(text) => setEditData({ ...editData, contact_person_name: text })}
                  placeholder="Enter contact person name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Email</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.email || ''}
                  onChangeText={(text) => setEditData({ ...editData, email: text })}
                  placeholder="Enter email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Phone Number</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.phone_number || ''}
                  onChangeText={(text) => setEditData({ ...editData, phone_number: text })}
                  placeholder="Enter phone number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Services & Experience</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Service Category</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.vendor_service_category || ''}
                  onChangeText={(text) => setEditData({ ...editData, vendor_service_category: text })}
                  placeholder="e.g., Photography, Catering"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Business Description</Text>
                <TextInput
                  style={[styles.editInput, styles.textArea]}
                  value={editData.business_description || ''}
                  onChangeText={(text) => setEditData({ ...editData, business_description: text })}
                  placeholder="Describe your business"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Years of Experience</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.years_of_experience || ''}
                  onChangeText={(text) => setEditData({ ...editData, years_of_experience: text })}
                  placeholder="e.g., 5"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Location</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Business Address</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.business_address || ''}
                  onChangeText={(text) => setEditData({ ...editData, business_address: text })}
                  placeholder="Enter business address"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>City</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.city || ''}
                  onChangeText={(text) => setEditData({ ...editData, city: text })}
                  placeholder="Enter city"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>State</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.state || ''}
                  onChangeText={(text) => setEditData({ ...editData, state: text })}
                  placeholder="Enter state"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Verification (Optional)</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>GST Number</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.gst_number || ''}
                  onChangeText={(text) => setEditData({ ...editData, gst_number: text })}
                  placeholder="Enter GST number"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Business Registration Number</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.business_registration_number || ''}
                  onChangeText={(text) => setEditData({ ...editData, business_registration_number: text })}
                  placeholder="Enter registration number"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Social Media</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Website URL</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.website_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, website_url: text })}
                  placeholder="https://www.yourbusiness.com"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Instagram URL</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.instagram_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, instagram_url: text })}
                  placeholder="https://instagram.com/yourbusiness"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Facebook URL</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.facebook_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, facebook_url: text })}
                  placeholder="https://facebook.com/yourbusiness"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>YouTube URL</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.youtube_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, youtube_url: text })}
                  placeholder="https://youtube.com/@yourbusiness"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, savingDetails && styles.saveButtonDisabled]}
              onPress={handleSaveDetails}
              disabled={savingDetails}
            >
              {savingDetails ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showOfferModal}
        animationType="slide"
        onRequestClose={() => {
          resetOfferForm();
          setShowOfferModal(false);
        }}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingOffer ? 'Edit Offer' : 'Create Offer'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                resetOfferForm();
                setShowOfferModal(false);
              }}
            >
              <X size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={offerTitle}
                onChangeText={setOfferTitle}
                placeholder="Enter offer title"
                maxLength={100}
              />
              <Text style={styles.charCount}>{offerTitle.length}/100</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={offerDescription}
                onChangeText={setOfferDescription}
                placeholder="Enter offer description"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={styles.charCount}>{offerDescription.length}/500</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Banner Image</Text>
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={handlePickOfferBanner}
              >
                {offerBannerUri ? (
                  <Image
                    source={{ uri: offerBannerUri }}
                    style={styles.pickerPreview}
                  />
                ) : (
                  <>
                    <ImageIcon size={32} color="#666" />
                    <Text style={styles.pickerText}>Select Banner Image</Text>
                    <Text style={styles.pickerHint}>JPG or PNG, max 5MB</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Discount Percentage</Text>
              <TextInput
                style={styles.input}
                value={offerDiscount}
                onChangeText={setOfferDiscount}
                placeholder="e.g., 20"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Valid Until *</Text>
              <TextInput
                style={styles.input}
                value={offerValidUntil}
                onChangeText={setOfferValidUntil}
                placeholder="YYYY-MM-DD"
              />
              <Text style={styles.fieldHint}>
                Enter future date in YYYY-MM-DD format
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                resetOfferForm();
                setShowOfferModal(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.submitButton,
                submitting && styles.buttonDisabled,
              ]}
              onPress={editingOffer ? handleUpdateOffer : handleCreateOffer}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingOffer ? 'Update' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImagePreview}
        animationType="fade"
        transparent
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View style={styles.previewContainer}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setShowImagePreview(false)}
          >
            <X size={32} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  imageCounter: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  progressContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  offersGrid: {
    gap: 16,
  },
  offerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  offerBanner: {
    width: '100%',
    height: 160,
  },
  offerContent: {
    padding: 16,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  offerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginRight: 12,
  },
  discountBadge: {
    backgroundColor: '#34C759',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  discountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  offerDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  offerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerDateText: {
    fontSize: 13,
    color: '#666',
  },
  expiredText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  offerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageRow: {
    gap: 8,
    marginBottom: 8,
  },
  imageGridItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  deleteImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  editSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  comingSoonText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
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
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  imagePicker: {
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  pickerPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  pickerHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  fieldHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  previewImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
});
