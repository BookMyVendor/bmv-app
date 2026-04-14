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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Star,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  MessageSquare,
  CornerDownLeft,
  TrendingUp,
  X,
  Play,
  WifiOff,
} from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getReviews, updateReview } from '../../lib/api/reviews';
import { getVendorBusinesses } from '../../lib/api/vendorBusinesses';
import FilterSortModal from '../../components/FilterSortModal';
import ReplyModal from '../../components/ReplyModal';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';
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
  businesses?: {
    business_name: string;
  } | null;
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
  const [showFilterSortModal, setShowFilterSortModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    mimeType?: string;
  } | null>(null);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const { user, isOffline: authIsOffline } = useAuth();

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
      try {
        const cachedReviews = await AsyncStorage.getItem(`vendor_reviews_${user.id}`);
        if (cachedReviews) setReviews(JSON.parse(cachedReviews));
      } catch { }

      let apiList: any[] = [];
      const { data, error } = await getReviews();
      console.log('[BizDebug][Reviews] getReviews(all) response', {
        hasError: !!error,
        error: error?.error ?? null,
        count: Array.isArray(data) ? data.length : 0,
      });

      if (error && /internal error/i.test(error.error || '')) {
        console.log('[BizDebug][Reviews] Falling back to business-wise reviews fetch');
        const { data: businesses, error: businessError } = await getVendorBusinesses();
        console.log('[BizDebug][Reviews] getVendorBusinesses for fallback', {
          hasError: !!businessError,
          error: businessError?.error ?? null,
          businessCount: Array.isArray(businesses) ? businesses.length : 0,
        });

        if (businessError) {
          throw new Error(businessError.error);
        }

        const businessIds = (businesses || []).map((b: any) => b.id).filter(Boolean);
        const reviewResponses = await Promise.all(
          businessIds.map((businessId) => getReviews({ business_id: businessId, limit: 100 }))
        );

        const fallbackErrors = reviewResponses
          .map((response) => response.error?.error)
          .filter((message): message is string => !!message);
        const merged = reviewResponses.flatMap((response) => (Array.isArray(response.data) ? response.data : []));
        const deduped = Array.from(
          merged.reduce((map, item: any) => {
            if (item?.id) map.set(item.id, item);
            return map;
          }, new Map<string, any>()).values()
        );

        console.log('[BizDebug][Reviews] Fallback reviews result', {
          requestedBusinessCount: businessIds.length,
          mergedCount: merged.length,
          dedupedCount: deduped.length,
          errorCount: fallbackErrors.length,
        });

        if (deduped.length === 0 && fallbackErrors.length > 0) {
          throw new Error(fallbackErrors[0]);
        }

        apiList = deduped;
      } else {
        if (error) throw new Error(error.error);
        apiList = (data || []) as any[];
      }

      const list = apiList.map(item => ({
        id: item.id,
        customer_name: item.customers?.name || item.customer_name || 'Anonymous',
        profile_photo_url: item.profile_photo_url || null,
        rating: item.rating || 0,
        comment: item.review_text || item.comment || '',
        event_type: item.event_type || null,
        is_flagged: !!item.is_flagged,
        vendor_response: item.vendor_response || null,
        responded_at: item.vendor_response_date || item.responded_at || null,
        created_at: item.created_at,
        businesses: item.business_name ? { business_name: item.business_name } : null,
        mediaItems: item.mediaItems || []
      })) as Review[];

      setReviews(list);
      try {
        AsyncStorage.setItem(`vendor_reviews_${user.id}`, JSON.stringify(list));
      } catch { }
    } catch (error) {
      console.error('Error fetching reviews:', error);
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
      const { error } = await updateReview(selectedReview.id, {
        vendor_response: replyText,
        vendor_response_date: new Date().toISOString(),
      });
      if (error) throw new Error(error.error);
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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    const diffYears = Math.floor(diffMonths / 12);
    if (diffYears === 1) return '1 year ago';
    return `${diffYears} years ago`;
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
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{getInitials(item.customer_name)}</Text>
            </View>
          )}
          <View style={styles.customerDetails}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <View style={styles.starsRow}>
              {renderStars(item.rating, 14)}
              <Text style={styles.reviewDate}>{formatRelativeTime(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </View>

      {item.event_type && (
        <View style={styles.eventBadge}>
          <Text style={styles.eventBadgeText}>{item.event_type}</Text>
        </View>
      )}

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

      {/* {item.vendor_response && (
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
      )} */}

      <View style={styles.reviewFooter}>
        {item.businesses?.business_name ? (
          <View style={styles.businessBadge}>
            <Text style={styles.businessBadgeText}>
              {item.businesses.business_name}
            </Text>
          </View>
        ) : (
          <View />
        )}
        {/* <TouchableOpacity
          style={styles.replyButton}
          onPress={() => handleReply(item)}
        >
          <CornerDownLeft size={14} color='#5B8DB8' />
          <Text style={styles.replyButtonText}>
            {item.vendor_response ? 'Edit Reply' : 'Reply'}
          </Text>
        </TouchableOpacity> */}
      </View>
    </View>
  );

  const fiveStarCount = useMemo(() => reviews.filter((r) => r.rating === 5).length, [reviews]);

  const renderListHeader = () => (
    <>
      {/* Stat Cards Container */}
      <View style={styles.statCardsContainer}>
        <View style={styles.individualStatCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FFF6DC' }]}>
            <Star size={20} color="#FFB800" fill="#FFB800" />
          </View>
          <Text style={styles.statValue}>{averageRating}</Text>
          <Text style={styles.statLabel}>Avg. Rating</Text>
        </View>

        <View style={styles.individualStatCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#EAF0FF' }]}>
            <MessageSquare size={20} color="#6B7FD7" />
          </View>
          <Text style={styles.statValue}>{reviews.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>

        <View style={styles.individualStatCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#E6F9EE' }]}>
            <TrendingUp size={20} color="#4CAF50" />
          </View>
          <Text style={styles.statValue}>{fiveStarCount}</Text>
          <Text style={styles.statLabel}>5-Star</Text>
        </View>
      </View>

      {/* Recent Reviews Header row with Filter/Sort button */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Reviews</Text>
        
        <TouchableOpacity
          style={styles.filterSortButton}
          onPress={() => setShowFilterSortModal(true)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={16} color="#3B82F6" />
          <Text style={styles.filterSortButtonText}>
            Filter & Sort{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <ScreenBackground style={[styles.container, { backgroundColor: '#ECEEF5' }]}>
      <View style={[styles.header, { height: insets.top + 60, paddingTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Reviews</Text>
        </View>
      </View>

      {authIsOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color="#B45309" />
          <Text style={styles.offlineText}>You're currently offline. Viewing cached data.</Text>
        </View>
      )}

      {loading && reviews.length === 0 ? (
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

      <FilterSortModal
        visible={showFilterSortModal}
        onClose={() => setShowFilterSortModal(false)}
        selectedSort={sortBy}
        onSelectSort={(sort) => setSortBy(sort as SortOption)}
        sortOptions={[
          { label: 'Newest first', value: 'newest' },
          { label: 'Oldest first', value: 'oldest' },
          { label: 'Highest rated', value: 'highest' },
          { label: 'Lowest rated', value: 'lowest' },
        ]}
        selectedRatings={selectedRatings}
        onSelectRatings={setSelectedRatings}
        ratingOptions={['5', '4', '3', '2', '1']}
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
                      resizeMode={ResizeMode.CONTAIN}
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
    gap: 12,
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '500',
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

  // ── Stat Cards ──────────────────────────────────────
  statCardsContainer: {
    flexDirection: 'row',
    marginTop: 4,
    marginBottom: 8,
    gap: 12,
  },
  individualStatCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#F0F2F8',
    shadowColor: '#8090B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C2340',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8A94A6',
    fontWeight: '500',
  },

  // ── Section Header ────────────────────────────────


  // ── Header & Filters ────────────────────────────────
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  filterSortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3B82F6',
    gap: 6,
  },
  filterSortButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  clearButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8CDD8',
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9AA0BB',
  },

  // ── Review Card ─────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 12,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#8090B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
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
    borderRadius: 10,
  },
  avatarPlaceholder: {
    backgroundColor: '#2D3554',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  customerDetails: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C2340',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9AA0BB',
    fontWeight: '400',
  },

  // ── Badges ──────────────────────────────────────────
  eventBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: Colors.accent.light + '30',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.accent.main,
  },
  eventBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.dark,
  },
  businessBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F0F2F8',
  },
  businessBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },

  // ── Comment / Media ─────────────────────────────────
  comment: {
    fontSize: 14,
    color: '#4B5275',
    lineHeight: 21,
    marginBottom: 14,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
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

  // ── Reply ───────────────────────────────────────────
  replyContainer: {
    backgroundColor: '#EAF2FB',
    borderLeftWidth: 3,
    borderLeftColor: '#5B8DB8',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: 12,
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
    color: '#5B8DB8',
    flex: 1,
  },
  replyDate: {
    fontSize: 11,
    color: '#9AA0BB',
  },
  replyText: {
    fontSize: 13,
    color: '#4B5275',
    lineHeight: 19,
  },

  // ── Review Footer (business badge + reply button) ───
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#ECEEF5',
    paddingTop: 10,
    marginTop: 4,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#EAF2FB',
    borderWidth: 1,
    borderColor: '#C1D8EC',
  },
  replyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5B8DB8',
  },

  // ── Empty States ────────────────────────────────────
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

  // ── Media Modal ─────────────────────────────────────
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
});
