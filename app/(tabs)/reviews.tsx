import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  RefreshControl,
  Image,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Star,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  MessageSquare,
  X,
  Play,
  Store,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseCore, supabaseCrm, supabaseCms } from '../../lib/supabase';
import { getPublicUrl } from '../../lib/businessApi';
import FilterModal from '../../components/FilterModal';
import SortModal from '../../components/SortModal';
import ReplyModal from '../../components/ReplyModal';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';
import Logo from '../../components/Logo';
import ScreenBackground from '../../components/ScreenBackground';

interface Review {
  id: string;
  customer_name: string;
  profile_photo_url: string | null;
  rating: number;
  comment: string | null;
  event_type: string | null;
  is_flagged: boolean;
  vendor_response: string | null;
  responded_at: string | null;
  created_at: string;
  businesses: {
    business_name: string;
  };
  mediaItems?: { url: string; mimeType?: string }[];
}

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

interface RatingDistribution {
  stars: number;
  count: number;
  percentage: number;
}

export default function ReviewsScreen() {
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRatings, setSelectedRatings] = useState<string[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    mimeType?: string;
  } | null>(null);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchReviews();
    }
  }, [user?.id]);

  useEffect(() => {
    if (selectedMedia) setMediaLoadError(false);
  }, [selectedMedia]);

  const fetchReviews = async () => {
    try {
      if (!user?.id) return;

      const isRefresh = refreshing;
      if (!isRefresh) setLoading(true);

      // Get business data for mapping business_id to business_name
      const { data: businessData, error: businessError } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name')
        .eq('vendor_id', user.id);

      if (businessError) {
        console.error('Error fetching businesses:', businessError);
      }

      const businessMap = new Map((businessData || []).map((b) => [b.id, b.business_name]));

      // Fetch all reviews for this vendor (by vendor_id), regardless of status or business_id
      // Fetch reviews first, then join with related tables manually for better reliability
      const { data: reviewsData, error: reviewsError } = await supabaseCrm
        .from('customer_reviews')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
        throw reviewsError;
      }

      if (!reviewsData || reviewsData.length === 0) {
        console.log('No reviews found for vendor:', user.id);
        setReviews([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      console.log(`Found ${reviewsData.length} reviews for vendor ${user.id}`);

      // Fetch customers separately
      const customerIds = [...new Set(reviewsData.map((r: any) => r.customer_id).filter(Boolean))];
      const customersMap = new Map();
      if (customerIds.length > 0) {
        const { data: customersData, error: customersError } = await supabaseCrm
          .from('customers')
          .select('id, name, email')
          .in('id', customerIds);

        if (customersError) {
          console.error('Error fetching customers:', customersError);
        } else if (customersData) {
          customersData.forEach((c: any) => customersMap.set(c.id, c));
        }
      }

      // Fetch leads separately
      const leadIds = [...new Set(reviewsData.map((r: any) => r.lead_id).filter(Boolean))];
      const leadsMap = new Map();
      if (leadIds.length > 0) {
        const { data: leadsData, error: leadsError } = await supabaseCrm
          .from('customer_leads')
          .select('id, template_id, sub_template_id')
          .in('id', leadIds);

        if (leadsError) {
          console.error('Error fetching leads:', leadsError);
        } else if (leadsData) {
          leadsData.forEach((l: any) => leadsMap.set(l.id, l));
        }
      }

      // Map reviews with manually fetched data
      const reviewsWithJoins = reviewsData.map((review: any) => ({
        ...review,
        customers: customersMap.get(review.customer_id) || null,
        customer_leads: leadsMap.get(review.lead_id) || null,
      }));

      // Fetch event template names for event types
      const templateIds = reviewsWithJoins
        .map((r: any) => r.customer_leads?.template_id || r.customer_leads?.sub_template_id)
        .filter(Boolean);

      let eventTypeMap = new Map();
      if (templateIds.length > 0) {
        const { data: templates, error: templatesError } = await supabaseCore
          .from('event_templates')
          .select('id, name')
          .in('id', templateIds);

        const { data: subTemplates, error: subTemplatesError } = await supabaseCore
          .from('event_sub_templates')
          .select('id, name')
          .in('id', templateIds);

        if (templatesError) {
          console.error('Error fetching templates:', templatesError);
        } else if (templates) {
          templates.forEach((t: any) => eventTypeMap.set(t.id, t.name));
        }

        if (subTemplatesError) {
          console.error('Error fetching sub-templates:', subTemplatesError);
        } else if (subTemplates) {
          subTemplates.forEach((t: any) => eventTypeMap.set(t.id, t.name));
        }
      }

      // Fetch review media: cms.review_media → cms.file_storage → build mediaItems per review
      const reviewIds = reviewsWithJoins.map((r: any) => r.id);
      const reviewMediaMap = new Map<string, string[]>();
      if (reviewIds.length > 0) {
        const { data: reviewMediaData, error: reviewMediaError } = await supabaseCms
          .from('review_media')
          .select('review_id, file_id')
          .in('review_id', reviewIds);

        if (reviewMediaError) {
          console.error('Error fetching review_media:', reviewMediaError);
        } else if (reviewMediaData?.length) {
          reviewMediaData.forEach((rm: any) => {
            if (rm.review_id && rm.file_id) {
              const list = reviewMediaMap.get(rm.review_id) || [];
              list.push(rm.file_id);
              reviewMediaMap.set(rm.review_id, list);
            }
          });
        }
      }

      const allFileIds = [...new Set(Array.from(reviewMediaMap.values()).flat())];
      const fileStorageMap = new Map<string, { url: string; mimeType?: string }>();
      if (allFileIds.length > 0) {
        const { data: fileStorageData, error: fileStorageError } = await supabaseCms
          .from('file_storage')
          .select('id, storage_bucket, file_path, mime_type')
          .in('id', allFileIds);

        if (fileStorageError) {
          console.error('Error fetching file_storage for review media:', fileStorageError);
        } else if (fileStorageData?.length) {
          fileStorageData.forEach((fs: any) => {
            const path = fs.file_path;
            if (path) {
              // Review media is always in the 'reviews' bucket
              fileStorageMap.set(fs.id, {
                url: getPublicUrl('reviews', path),
                mimeType: fs.mime_type || undefined,
              });
            }
          });
        }
      }

      // Map reviews to match the Review interface
      const reviewsWithBusiness = reviewsWithJoins.map((review: any) => {
        const customer = review.customers || {};
        const lead = review.customer_leads || {};
        const eventTypeId = lead?.template_id || lead?.sub_template_id;
        const eventType = eventTypeId ? eventTypeMap.get(eventTypeId) : null;

        // Get business name if business_id exists, otherwise show "No Business"
        const businessName = review.business_id
          ? (businessMap.get(review.business_id) || 'Unknown Business')
          : 'No Business';

        const fileIdsForReview = reviewMediaMap.get(review.id) || [];
        const mediaItems = fileIdsForReview
          .map((fid) => fileStorageMap.get(fid))
          .filter(Boolean) as { url: string; mimeType?: string }[];

        return {
          id: review.id,
          customer_name: customer.name || 'Anonymous',
          profile_photo_url: null,
          rating: review.rating,
          comment: review.review_text || review.review_title || null,
          event_type: eventType,
          is_flagged: review.status === 'rejected',
          vendor_response: review.vendor_response || null,
          responded_at: review.vendor_response_date || null,
          created_at: review.created_at,
          businesses: {
            business_name: businessName,
          },
          mediaItems: mediaItems.length > 0 ? mediaItems : undefined,
        };
      });

      console.log(`Mapped ${reviewsWithBusiness.length} reviews`);
      setReviews(reviewsWithBusiness);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  const handleReply = (review: Review) => {
    setSelectedReview(review);
    setShowReplyModal(true);
  };

  const submitReply = async (replyText: string) => {
    if (!selectedReview) return;

    try {
      const { error } = await supabaseCrm
        .from('customer_reviews')
        .update({
          vendor_response: replyText,
          vendor_response_date: new Date().toISOString(),
        })
        .eq('id', selectedReview.id);

      if (error) throw error;
      await fetchReviews();
    } catch (error) {
      console.error('Error submitting reply:', error);
      throw error;
    }
  };

  const eventTypes = useMemo(() => {
    const types = new Set<string>();
    reviews.forEach((review) => {
      if (review.event_type) types.add(review.event_type);
    });
    return Array.from(types).sort();
  }, [reviews]);

  const filteredAndSortedReviews = useMemo(() => {
    let filtered = reviews;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (review) =>
          review.customer_name.toLowerCase().includes(query) ||
          review.comment?.toLowerCase().includes(query)
      );
    }

    if (selectedRatings.length > 0) {
      const ratings = selectedRatings.map((r) => parseInt(r));
      filtered = filtered.filter((review) => ratings.includes(review.rating));
    }

    if (selectedEventTypes.length > 0) {
      filtered = filtered.filter(
        (review) =>
          review.event_type && selectedEventTypes.includes(review.event_type)
      );
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (dateFilter) {
        case 'last7':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'last30':
          filterDate.setDate(now.getDate() - 30);
          break;
        case 'last90':
          filterDate.setDate(now.getDate() - 90);
          break;
      }

      filtered = filtered.filter(
        (review) => new Date(review.created_at) >= filterDate
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case 'oldest':
          return (
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        default:
          return 0;
      }
    });

    return sorted;
  }, [
    reviews,
    searchQuery,
    selectedRatings,
    selectedEventTypes,
    dateFilter,
    sortBy,
  ]);

  const ratingDistribution = useMemo((): RatingDistribution[] => {
    const dist = [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: reviews.filter((r) => r.rating === stars).length,
      percentage: 0,
    }));

    dist.forEach((item) => {
      item.percentage =
        reviews.length > 0 ? (item.count / reviews.length) * 100 : 0;
    });

    return dist;
  }, [reviews]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const responseRate = useMemo(() => {
    if (reviews.length === 0) return 0;
    const responded = reviews.filter((r) => r.vendor_response).length;
    return Math.round((responded / reviews.length) * 100);
  }, [reviews]);

  const mostCommonRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const dist = ratingDistribution.reduce((prev, current) =>
      current.count > prev.count ? current : prev
    );
    return dist.stars;
  }, [ratingDistribution]);

  const activeFilterCount =
    selectedRatings.length +
    selectedEventTypes.length +
    (dateFilter !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedRatings([]);
    setSelectedEventTypes([]);
    setDateFilter('all');
    setSearchQuery('');
  };

  const renderStars = (rating: number, size = 16) => {
    return (
      <View style={styles.starsContainer}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            size={size}
            color={index < rating ? '#FFB800' : '#ddd'}
            fill={index < rating ? '#FFB800' : 'transparent'}
          />
        ))}
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.customerInfo}>
          {item.profile_photo_url ? (
            <Image
              source={{ uri: item.profile_photo_url }}
              style={styles.avatar}
            />
          ) : (
            <LinearGradient
              colors={[Colors.info.main, Colors.info.light]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.avatar, styles.avatarPlaceholder]}
            >
              <Text style={styles.avatarText}>{getInitials(item.customer_name)}</Text>
            </LinearGradient>
          )}
          <View style={styles.customerDetails}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            {renderStars(item.rating, 14)}
          </View>
        </View>
        <Text style={styles.reviewDate}>{formatDate(item.created_at)}</Text>
      </View>

      <View style={styles.badgesContainer}>
        {item.event_type && (
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeText}>{item.event_type}</Text>
          </View>
        )}
        {item.businesses?.business_name && (
          <View style={styles.businessBadge}>
            <Store size={14} color="#6366F1" style={{ marginTop: -1 }} />
            <Text style={styles.businessBadgeText}>
              {item.businesses.business_name}
            </Text>
          </View>
        )}
      </View>

      {item.comment && <Text style={styles.comment}>{item.comment}</Text>}

      {item.mediaItems && item.mediaItems.length > 0 && (
        <View style={styles.mediaGrid}>
          {item.mediaItems.map((media, idx) => {
            const isImage =
              !media.mimeType || media.mimeType.startsWith('image/');
            return (
              <TouchableOpacity
                key={`${media.url}-${idx}`}
                style={styles.mediaThumb}
                onPress={() => setSelectedMedia(media)}
                activeOpacity={0.9}
              >
                {isImage ? (
                  <Image
                    source={{ uri: media.url }}
                    style={styles.mediaThumbImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.mediaThumbVideo}>
                    <Play size={28} color="#fff" fill="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {item.vendor_response && (
        <View style={styles.replyContainer}>
          <View style={styles.replyHeader}>
            <MessageSquare size={14} color="#3B82F6" />
            <Text style={styles.replyLabel}>Your Response</Text>
            {item.responded_at && (
              <Text style={styles.replyDate}>
                {formatDate(item.responded_at)}
              </Text>
            )}
          </View>
          <Text style={styles.replyText}>{item.vendor_response}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.replyButton}
        onPress={() => handleReply(item)}
      >
        <MessageSquare size={16} color="#3B82F6" />
        <Text style={styles.replyButtonText}>
          {item.vendor_response ? 'Edit Reply' : 'Reply'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderListHeader = () => (
    <>
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={styles.summaryRatingSection}>
            <Text style={styles.summaryRating}>{averageRating}</Text>
            {renderStars(Math.round(Number(averageRating)), 20)}
            <Text style={styles.summaryText}>
              {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
            </Text>
          </View>

          <View style={styles.insightsSection}>
            <View style={styles.insightItem}>
              <Text style={styles.insightValue}>{responseRate}%</Text>
              <Text style={styles.insightLabel}>Response Rate</Text>
            </View>
            {mostCommonRating && (
              <View style={styles.insightItem}>
                <Text style={styles.insightValue}>{mostCommonRating}★</Text>
                <Text style={styles.insightLabel}>Most Common</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.distributionSection}>
          {ratingDistribution.map((dist) => (
            <View key={dist.stars} style={styles.distributionRow}>
              <Text style={styles.distributionStars}>{dist.stars}★</Text>
              <View style={styles.distributionBar}>
                <View
                  style={[
                    styles.distributionBarFill,
                    { width: `${dist.percentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.distributionCount}>{dist.count}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search reviews..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearSearchButton}
          >
            <X size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterSortRow}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <SlidersHorizontal size={18} color="#3B82F6" />
          <Text style={styles.filterButtonText}>Filters</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortModal(true)}
        >
          <ArrowUpDown size={18} color="#3B82F6" />
          <Text style={styles.sortButtonText}>Sort</Text>
        </TouchableOpacity>

        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAllFilters}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  return (
    <ScreenBackground style={styles.container}>
      <View style={[styles.header, { height: insets.top + 60, paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Logo size={38} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>Reviews</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.emptyState}>
          <Star size={64} color="#ddd" />
          <Text style={styles.emptyStateTitle}>No Reviews Yet</Text>
          <Text style={styles.emptyStateText}>
            Customer reviews will appear here once you receive them
          </Text>
        </View>
      ) : filteredAndSortedReviews.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyStateContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
            />
          }
        >
          {renderListHeader()}
          <View style={styles.emptyResultsContainer}>
            <Search size={64} color="#ddd" />
            <Text style={styles.emptyStateTitle}>No Results Found</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your search or filters
            </Text>
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearAllFilters}
            >
              <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredAndSortedReviews}
          renderItem={renderReview}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderListHeader}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
            />
          }
        />
      )}

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        title="Filter by Rating"
        options={['5', '4', '3', '2', '1']}
        selectedOptions={selectedRatings}
        onSelectOptions={setSelectedRatings}
        multiSelect={true}
      />

      <SortModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        selectedSort={sortBy as any}
        onSelectSort={(sort) => setSortBy(sort as SortOption)}
        context="reviews"
      />

      {selectedReview && (
        <ReplyModal
          visible={showReplyModal}
          onClose={() => {
            setShowReplyModal(false);
            setSelectedReview(null);
          }}
          onSubmit={submitReply}
          customerName={selectedReview.customer_name}
          reviewText={selectedReview.comment || ''}
          existingReply={selectedReview.vendor_response}
        />
      )}

      <Modal
        visible={!!selectedMedia}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMedia(null)}
      >
        <View style={styles.mediaModalOverlay}>
          <TouchableOpacity
            style={styles.mediaModalClose}
            onPress={() => {
              setSelectedMedia(null);
              setMediaLoadError(false);
            }}
            activeOpacity={1}
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {selectedMedia && (
            <>
              {!selectedMedia.mimeType ||
                selectedMedia.mimeType.startsWith('image/') ? (
                <>
                  <Image
                    source={{ uri: selectedMedia.url }}
                    style={styles.mediaModalImage}
                    resizeMode="contain"
                    onError={() => setMediaLoadError(true)}
                    onLoad={() => setMediaLoadError(false)}
                  />
                  {mediaLoadError && (
                    <Text style={styles.mediaModalVideoText}>
                      Unable to load image
                    </Text>
                  )}
                </>
              ) : selectedMedia.mimeType.startsWith('video/') ? (
                <View style={styles.mediaModalVideoContainer}>
                  {mediaLoadError ? (
                    <>
                      <Text style={styles.mediaModalVideoText}>
                        Could not play video
                      </Text>
                      <TouchableOpacity
                        style={styles.mediaModalVideoButton}
                        onPress={() => Linking.openURL(selectedMedia.url)}
                      >
                        <Play size={20} color="#fff" />
                        <Text style={styles.mediaModalVideoButtonText}>
                          Open in browser
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <Video
                      source={{ uri: selectedMedia.url }}
                      style={styles.mediaModalVideo}
                      useNativeControls
                      resizeMode="contain"
                      shouldPlay
                      onError={() => setMediaLoadError(true)}
                    />
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.mediaModalVideoButton}
                  onPress={() => Linking.openURL(selectedMedia.url)}
                >
                  <Text style={styles.mediaModalVideoButtonText}>
                    Open link
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 20,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryRatingSection: {
    alignItems: 'flex-start',
  },
  summaryRating: {
    fontSize: 56,
    fontWeight: '700',
    color: Colors.primary.main,
    marginBottom: 8,
    lineHeight: 56,
  },
  summaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  insightsSection: {
    gap: 16,
  },
  insightItem: {
    alignItems: 'flex-end',
  },
  insightValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.secondary.main,
  },
  insightLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  distributionSection: {
    gap: 10,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distributionStars: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 24,
  },
  distributionBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionBarFill: {
    height: '100%',
    backgroundColor: Colors.accent.main,
    borderRadius: 4,
  },
  distributionCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    width: 30,
    textAlign: 'right',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  filterSortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 2,
    borderColor: Colors.secondary.main,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary.main,
  },
  filterBadge: {
    backgroundColor: Colors.secondary.main,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.neutral.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 2,
    borderColor: Colors.secondary.main,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.secondary.main,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  eventBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.accent.light + '30',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent.main,
  },
  businessBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: Spacing.md,
    gap: 6,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  businessBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4F46E5',
    letterSpacing: 0.2,
  },
  clearButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#999',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyStateContainer: {
    flexGrow: 1,
  },
  emptyResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 300,
  },
  emptyStateTitle: {
    fontSize: 20,
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
  clearFiltersButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  clearFiltersButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral.white,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.secondary.main,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  customerDetails: {
    flex: 1,
    gap: 6,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 13,
    color: '#999',
  },

  eventBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent.dark,
  },
  comment: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 16,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  mediaThumb: {
    width: 96,
    height: 96,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  mediaThumbImage: {
    width: '100%',
    height: '100%',
  },
  mediaThumbVideo: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  mediaModalImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  mediaModalVideoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: Dimensions.get('window').width,
    flex: 1,
  },
  mediaModalVideo: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.7,
  },
  mediaModalVideoText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  mediaModalVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  mediaModalVideoButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  replyContainer: {
    backgroundColor: Colors.secondary.light + '20',
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary.main,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.secondary.main,
    flex: 1,
  },
  replyDate: {
    fontSize: 11,
    color: '#999',
  },
  replyText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.light,
    marginTop: 4,
  },
  replyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.secondary.main,
  },
});
