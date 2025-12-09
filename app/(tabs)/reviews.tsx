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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Star,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  MessageSquare,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore, supabaseCrm } from '@/lib/supabase';
import FilterModal from '@/components/FilterModal';
import SortModal from '@/components/SortModal';
import ReplyModal from '@/components/ReplyModal';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';
import Logo from '@/components/Logo';

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
  const { user } = useAuth();

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const isRefresh = refreshing;
      if (!isRefresh) setLoading(true);

      const { data: businessData } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name')
        .eq('vendor_id', user?.id);

      if (!businessData || businessData.length === 0) {
        setReviews([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const businessIds = businessData.map((b) => b.id);
      const businessMap = new Map(businessData.map((b) => [b.id, b.business_name]));

      // Fetch reviews without join
      const { data, error } = await supabaseCrm
        .from('customer_reviews')
        .select('*')
        .in('business_id', businessIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map business names to reviews
      const reviewsWithBusiness = (data || []).map((review) => ({
        ...review,
        business_name: businessMap.get(review.business_id) || 'Unknown Business',
      }));

      setReviews(reviewsWithBusiness);
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
      const { error } = await supabaseCrm
        .from('customer_reviews')
        .update({
          vendor_response: replyText,
          responded_at: new Date().toISOString(),
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

      {item.event_type && (
        <View style={styles.eventBadge}>
          <Text style={styles.eventBadgeText}>{item.event_type}</Text>
        </View>
      )}

      {item.comment && <Text style={styles.comment}>{item.comment}</Text>}

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
    <View style={styles.container}>
     <View style={[styles.header, { paddingTop: insets.top + 20,  backgroundColor: '#fff' }]}>

      {/* <LinearGradient
        colors={[Colors.accent.main, Colors.accent.light]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      > */}
        <View style={styles.headerContent}>
        <Logo
         size={48}
         style={{ ...styles.headerLogo, transform: [{ scale: 1.2}] }}
/>
          <Text style={styles.headerTitle}>Reviews</Text>
        </View>
        </View>
      {/* </LinearGradient> */}

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
     color: Colors.text.primary,
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
  eventBadge: {
    backgroundColor: Colors.accent.light + '30',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent.main,
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
