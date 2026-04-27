import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrendingUp, Calendar, Eye, X, ChevronRight, Bell, WifiOff } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getVendorBusinesses } from '../../lib/api/vendorBusinesses';
import { resolveBusinessMediaUrl, getBusinessDetails } from '../../lib/businessApi';
import { getLeads } from '../../lib/api/leads';
import { getCategoryTree } from '../../lib/api/categories';
import { checkNotificationPermission, requestNotificationPermission } from '../../lib/pushNotifications';
import { STATUS_OPTIONS, LeadStatus } from '../../types/leads';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';
import ScreenBackground from '../../components/ScreenBackground';

interface Business {
  id: string;
  business_name: string;
  business_category: string;
  business_description: string;
  cover_photo_url: string | null;
  city: string | null;
  state: string | null;
  // Mandatory fields for completion calculation (from vendor_businesses)
  description?: string | null;
  address?: string | null;
  pincode?: string | null;
  contact_person_name?: string | null;
  business_email?: string | null;
  contact_person_phone?: string | null;
  years_experience?: number | null;
  operating_locations?: string[] | null;
  // Joined fields for mandatory completion checks
  vendor_business_category_mappings?: {
    categories?: {
      category_level?: number; // Optional in API
      category_type: string;
      parent_category_id: string | null;
    }
  }[] | null;
  vendor_business_pricing_packages?: {
    id: string;
    base_price: number;
    price_unit: string;
  }[] | null;
  // Optional fields (not counted in mandatory progress)
  website_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  gst_number?: string | null;
  pan_number?: string | null; // Keep for fallback
  business_registration_number?: string | null; // Actual PAN column
  locality?: string | null;
  image_count?: number;
  document_count?: number;
  // Fallback fields for profile completion calculation
  primary_category_id?: string | null;
  category_ids?: string[] | null;
  specialization_category_ids?: string[] | null;
  event_category_ids?: string[] | null;
  base_price?: number | null;
  pricing_unit?: string | null;
  price_range?: string | null;
  min_price?: number | null;
  max_price?: number | null;
  verification_documents?: any[] | null;
  gallery_images?: any[] | null;
  media?: any[] | null;
}

interface LeadStats {
  total: number;
  monthly: number;
  today: number;
  byStatus: Record<LeadStatus, number>;
}

/**
 * Helper to convert a file path to a full URL.
 * If the input is already a full URL (starts with http), return as-is.
 * If it's a file path, prepend the API base URL.
 */
function getFullImageUrl(filePathOrUrl: string | null | undefined): string | null {
  return resolveBusinessMediaUrl(filePathOrUrl, 'vendor-media');
}

/**
 * Image component with fallback to gradient avatar on error
 */
function ImageWithFallback({
  uri,
  fallbackLetter,
  gradientColors,
  style,
}: {
  uri: string | null | undefined;
  fallbackLetter: string;
  gradientColors: readonly [string, string];
  style: any;
}) {
  const [hasError, setHasError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset error state when URI changes
  useEffect(() => {
    setHasError(false);
    setImageLoaded(false);
  }, [uri]);

  if (!uri || hasError) {
    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={style}
      >
        <Text style={styles.businessAvatarLetter}>{fallbackLetter}</Text>
      </LinearGradient>
    );
  }

  return (
    <View style={style}>
      {!imageLoaded && !hasError && (
        <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
          <ActivityIndicator size="small" color="#6aa3ce" />
        </View>
      )}
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFillObject, !imageLoaded && { opacity: 0 }]}
        resizeMode="cover"
        onLoad={() => setImageLoaded(true)}
        onError={(e) => {
          console.error(`[Dashboard][ImageError] Failed to load image: ${uri}`, e.nativeEvent.error);
          setHasError(true);
          setImageLoaded(true);
        }}
      />
    </View>
  );
}

// Returns a 0-100 integer representing how complete the business profile is
function calculateProfileCompletion(business: Business): number {
  // Helper to check category mappings with fallbacks
  const hasPrimaryCategory = (): boolean => {
    // Check joined data first
    if (business.vendor_business_category_mappings?.some(m => m.categories?.category_type === 'business' && m.categories?.parent_category_id === null)) {
      return true;
    }
    // Fallback: check if primary_category_id exists
    if (business.primary_category_id) return true;
    // Fallback: check category_ids array
    if (business.category_ids && business.category_ids.length > 0) return true;
    // Fallback: check if business has a category name
    if (business.business_category && business.business_category !== 'General') return true;
    return false;
  };

  const hasSpecialization = (): boolean => {
    // Check joined data first
    if (business.vendor_business_category_mappings?.some(m => m.categories?.category_type === 'business' && m.categories?.parent_category_id !== null)) {
      return true;
    }
    // Fallback: check specialization_category_ids
    if (business.specialization_category_ids && business.specialization_category_ids.length > 0) return true;
    // Fallback: check if multiple category_ids exist
    if (business.category_ids && business.category_ids.length > 1) return true;
    return false;
  };

  const hasEventCategories = (): boolean => {
    // Check joined data first
    if (business.vendor_business_category_mappings?.some(m => m.categories?.category_type === 'event')) {
      return true;
    }
    // Fallback: check event_category_ids
    if (business.event_category_ids && business.event_category_ids.length > 0) return true;
    return false;
  };

  // Helper to check pricing with fallbacks
  const hasPricing = (): boolean => {
    // Check joined pricing packages first
    if (business.vendor_business_pricing_packages?.[0]?.base_price && business.vendor_business_pricing_packages?.[0]?.price_unit) {
      return true;
    }
    // Fallback: check direct pricing fields on business
    if (business.base_price && business.pricing_unit) return true;
    if (business.price_range) return true;
    if (business.min_price && business.max_price) return true;
    return false;
  };

  const coreChecks = [
    // 1-4. Basic Info
    !!(business.business_name?.trim()),
    !!(business.contact_person_name?.trim()),
    !!(business.business_email?.trim()),
    !!(business.contact_person_phone?.trim()),
    // 5-6. Services & Experience
    !!(business.description?.trim() || business.business_description?.trim()),
    !!(business.years_experience !== null && business.years_experience !== undefined),
    // 7-9. Location
    !!(business.address?.trim()),
    !!(business.pincode?.trim()),
    !!(business.operating_locations && business.operating_locations.length > 0),
    // 10. Pricing (Base Price & Unit filled) - with fallbacks
    hasPricing(),
    // 11. Primary Category Mapped - with fallbacks
    hasPrimaryCategory(),
    // 12. Specialization Mapped - with fallbacks
    hasSpecialization(),
    // 13-15. Detailed Location
    !!(business.city?.trim()),
    !!(business.locality?.trim()),
    !!(business.state?.trim()),
    // 16. Cover Photo (Required during registration)
    !!(business.cover_photo_url?.trim()),
  ];

  const optionalChecks = [
    // 17-20. Social Media
    !!(business.website_url?.trim()),
    !!(business.instagram_url?.trim()),
    !!(business.facebook_url?.trim()),
    !!(business.youtube_url?.trim()),
    // 21-22. Tax Info
    !!(business.business_registration_number?.trim() || business.pan_number?.trim()),
    !!(business.gst_number?.trim()),
    // 23. Verification Documents (with fallbacks)
    !!(business.document_count && business.document_count > 0) || !!(business.verification_documents && business.verification_documents.length > 0),
    // 24. Events Mapped (Optional) - with fallbacks
    hasEventCategories(),
    // 25. Gallery/Portfolio (Additional images) - with fallbacks
    !!(business.image_count && business.image_count > 0) || !!(business.gallery_images && business.gallery_images.length > 0) || !!(business.media && business.media.length > 0),
  ];

  const coreFilled = coreChecks.filter(Boolean).length;
  const optionalFilled = optionalChecks.filter(Boolean).length;

  // DEBUG: Log which checks are failing
  const checkNames = [
    'business_name', 'contact_person_name', 'business_email', 'contact_person_phone',
    'description', 'years_experience', 'address', 'pincode', 'operating_locations',
    'pricing', 'primary_category', 'specialization', 'city', 'locality', 'state', 'cover_photo'
  ];
  const failedChecks = checkNames.filter((_, i) => !coreChecks[i]);
  const coreScore = (coreFilled / coreChecks.length) * 90;
  const optionalScore = optionalChecks.length > 0 ? (optionalFilled / optionalChecks.length) * 10 : 0;
  const totalScore = Math.round(coreScore + optionalScore);

  // Score is calculated but logs are removed to prevent console spam

  // Weighting: Core fields account for 90%, Optional fields account for 10%
  // 16 core fields * 5.625% = 90%
  // 9 optional fields * ~1.11% = 10%
  return totalScore;
}

function getGreeting(userName?: string) {
  const hour = new Date().getHours();
  let greeting = '';
  if (hour >= 5 && hour < 12) greeting = 'Good morning';
  else if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17 && hour < 21) greeting = 'Good evening';
  else greeting = 'Good night';

  return userName ? `${greeting}, ${userName.split(' ')[0]}` : greeting;
}

// Avatar color palette for businesses (matches screenshot style)
const AVATAR_COLORS: [string, string][] = [
  ['#6c7ef7', '#8b9dff'],
  ['#4ecb71', '#6fdd90'],
  ['#ff9c42', '#ffb26b'],
  ['#f75c7e', '#ff85a0'],
  ['#5bc4f5', '#7dd6ff'],
];

export default function DashboardScreen() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [leadStats, setLeadStats] = useState<LeadStats>({
    total: 0,
    monthly: 0,
    today: 0,
    byStatus: { new: 0, contacted: 0, quoted: 0, converted: 0, lost: 0 },
  });
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [showFilterScrollIndicator, setShowFilterScrollIndicator] = useState(false);
  const [businessLeadCounts, setBusinessLeadCounts] = useState<Record<string, number>>({});
  const [isOffline, setIsOffline] = useState(false);
  const filterScrollViewRef = useRef<ScrollView>(null);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user?.id) {
      fetchBusinesses();
      fetchLeadStats();
    }
  }, [user?.id, selectedStatuses]);

  useEffect(() => {
    const checkPermissionStatus = async () => {
      try {
        const hasPermission = await checkNotificationPermission();
        if (!hasPermission) {
          const hasPrompted = await AsyncStorage.getItem('notificationPermissionPromptShown');
          if (hasPrompted !== 'true') {
            Alert.alert(
              'Enable Notifications',
              'Stay updated with new leads and important alerts. Enable notifications now?',
              [
                {
                  text: 'Later',
                  style: 'cancel',
                  onPress: async () => {
                    await AsyncStorage.setItem('notificationPermissionPromptShown', 'true');
                  },
                },
                {
                  text: 'Enable',
                  onPress: async () => {
                    await requestNotificationPermission();
                    await AsyncStorage.setItem('notificationPermissionPromptShown', 'true');
                  },
                },
              ]
            );
          }
        }
      } catch (e) {
        console.error('Permission check failed', e);
      }
    };
    checkPermissionStatus();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        // On refocus, silently refresh in the background without resetting state
        fetchBusinesses(true);
        fetchLeadStats();
      }
    }, [user?.id])
  );

  const fetchBusinesses = async (isSilentRefresh = false) => {
    if (!user?.id) {
      console.log('[BizDebug][Dashboard] Skipping fetchBusinesses: missing user id');
      setLoading(false);
      return;
    }
    console.log('[BizDebug][Dashboard] fetchBusinesses started', {
      userId: user.id,
      isSilentRefresh,
      initialDataLoaded,
    });

    // On first load only, show cached data immediately so UI isn't empty
    if (!isSilentRefresh && !initialDataLoaded) {
      try {
        const cachedStr = await AsyncStorage.getItem(`dashboard_businesses_${user.id}`);
        if (cachedStr) {
          const cachedBusinesses = JSON.parse(cachedStr);
          console.log('[BizDebug][Dashboard] Loaded cached businesses', {
            count: Array.isArray(cachedBusinesses) ? cachedBusinesses.length : 0,
          });
          setBusinesses(cachedBusinesses);
        }
      } catch { }
    }

    try {
      // Fetch both businesses and category tree in parallel
      const [{ data, error }, categoryTreeRes] = await Promise.all([
        getVendorBusinesses(),
        getCategoryTree().catch(err => {
          console.error('Failed to fetch category tree:', err);
          return { data: null, error: err };
        })
      ]);

      // Clear stale detail caches to ensure fresh data is used for percentage calculation
      const detailCacheKeys = await AsyncStorage.getAllKeys();
      const businessDetailKeys = detailCacheKeys.filter(k => k.startsWith('business_details_'));
      if (businessDetailKeys.length > 0) {
        try {
          await AsyncStorage.multiRemove(businessDetailKeys);
        } catch (e) {
          console.warn('[Dashboard] Cache clear error:', e);
        }
      }
      console.log('[BizDebug][Dashboard] Cleared detail caches:', businessDetailKeys.length);

      console.log('[BizDebug][Dashboard] getVendorBusinesses response', {
        hasError: !!error,
        error: error?.error ?? null,
        rawType: Array.isArray(data) ? 'array' : typeof data,
        rawCount: Array.isArray(data) ? data.length : 0,
        rawKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data as any) : [],
      });

      if (error) {
        console.error('❌ Error fetching businesses:', error);
        throw new Error(error.error);
      }

      // Build category lookup map from category tree (store full category object)
      const categoryMap = new Map<string, { name: string; category_type?: string; parent_category_id?: string | null; category_level?: number }>();
      if (categoryTreeRes.data) {
        const flattenCategories = (cats: any[]) => {
          cats.forEach(cat => {
            categoryMap.set(cat.id, {
              name: cat.name,
              category_type: cat.category_type,
              parent_category_id: cat.parent_category_id,
              category_level: cat.category_level,
            });
            if (cat.children) flattenCategories(cat.children);
          });
        };
        flattenCategories(categoryTreeRes.data);
      }
      console.log('[BizDebug][Dashboard] Category map size:', categoryMap.size);

      const businessesList = Array.isArray(data) ? data : [];

      // CRITICAL: The 'vendor-businesses-list' API only returns a subset of fields.
      // To calculate 100% profile completion, we need the full details for each business.
      console.log(`[Dashboard] Fetching full details for ${businessesList.length} businesses...`);
      const fullDetailsResults = await Promise.all(
        businessesList.map(b => getBusinessDetails(b.id || b.business_id))
      );

      // Map API response to frontend format
      const formattedBusinesses = businessesList.map((business: any, index: number) => {
        // Use full details if fetch was successful, fallback to list item
        const fullDetails = fullDetailsResults[index]?.data || {};
        const combinedBusiness = { ...business, ...fullDetails };

        // Try multiple possible API response structures for category
        let category = 'General';
        
        if (combinedBusiness.primary_category_id) {
          const primaryCat = categoryMap.get(combinedBusiness.primary_category_id);
          if (primaryCat?.name) {
            category = primaryCat.name;
          }
        }
        
        if (category === 'General' && combinedBusiness.business_category) {
          category = combinedBusiness.business_category;
        } else if (category === 'General' && combinedBusiness.primary_category_name) {
          category = combinedBusiness.primary_category_name;
        } else if (category === 'General' && combinedBusiness.category_name) {
          category = combinedBusiness.category_name;
        } else if (category === 'General' && combinedBusiness.vendor_business_category_mappings?.length > 0) {
          const mapping = combinedBusiness.vendor_business_category_mappings[0];
          category = mapping.categories?.name || mapping.category_name || 'General';
        } else if (category === 'General' && combinedBusiness.categories?.name) {
          category = combinedBusiness.categories.name;
        } else if (category === 'General' && combinedBusiness.category_ids?.length > 0) {
          const primaryCatId = combinedBusiness.category_ids.find((id: string) => {
            const cat = categoryMap.get(id);
            return cat && cat.category_type === 'business' && !cat.parent_category_id;
          });
          const anyBusinessCatId = primaryCatId || combinedBusiness.category_ids.find((id: string) => {
            const cat = categoryMap.get(id);
            return cat && cat.category_type === 'business';
          });
          const foundCatId = primaryCatId || anyBusinessCatId || combinedBusiness.category_ids[0];
          category = categoryMap.get(foundCatId)?.name || 'General';
        }

        // Get full URL for cover photo (API returns full MinIO/S3 URLs or file paths)
        const coverPhotoUrl = getFullImageUrl(combinedBusiness.cover_photo_url || combinedBusiness.cover_image_file_id);

        // Map API field names to frontend field names
        return {
          ...combinedBusiness,
          id: combinedBusiness.id || combinedBusiness.business_id,
          business_name: combinedBusiness.business_name || combinedBusiness.name || 'Unnamed Business',
          business_description: combinedBusiness.description || combinedBusiness.business_description || '',
          contact_person_name: combinedBusiness.contact_person_name || combinedBusiness.contact_name || '',
          contact_person_phone: combinedBusiness.contact_person_phone || combinedBusiness.phone || combinedBusiness.contact_phone || '',
          business_email: combinedBusiness.business_email || combinedBusiness.email || '',
          cover_photo_url: coverPhotoUrl,
          business_category: category,
          city: combinedBusiness.city || '',
          operating_locations: combinedBusiness.operating_locations || combinedBusiness.availability || combinedBusiness.cities || [],
        };
      });

      // DEBUG: Log first business detailed data for profile completion debugging
      if (formattedBusinesses.length > 0) {
        const firstBiz = formattedBusinesses[0];
      }
      let cachedBusinesses: Business[] = [];
      try {
        const cacheKey = `dashboard_businesses_${user.id}`;
        const cachedStr = await AsyncStorage.getItem(cacheKey);
        const parsed = cachedStr ? JSON.parse(cachedStr) : [];
        cachedBusinesses = Array.isArray(parsed) ? parsed : [];
      } catch { }
      console.log('[BizDebug][Dashboard] Formatted businesses', {
        count: formattedBusinesses.length,
        items: formattedBusinesses.map((b: any) => ({
          id: b.id,
          business_name: b.business_name,
          status: b.status ?? null,
        })),
      });

      const mergeBusinessesById = (existing: Business[], incoming: Business[]): Business[] => {
        if (incoming.length === 0 && existing.length > 0) {
          return existing;
        }
        const merged = new Map<string, Business>();
        existing.forEach((item) => {
          if (item?.id) merged.set(item.id, item);
        });
        incoming.forEach((item) => {
          if (!item?.id) return;
          const previous = merged.get(item.id);
          // Smart merge: preserve detailed fields from cache if new data doesn't have them
          const smartMerge = { ...(previous || {}), ...item };
          // Preserve category data from cache if new data doesn't have it
          if (!item.category_ids?.length && previous?.category_ids?.length) {
            smartMerge.category_ids = previous.category_ids;
          }
          if (!item.contact_person_name && previous?.contact_person_name) {
            smartMerge.contact_person_name = previous.contact_person_name;
          }
          if (!item.operating_locations?.length && previous?.operating_locations?.length) {
            smartMerge.operating_locations = previous.operating_locations;
          }
          if (!item.years_experience && previous?.years_experience) {
            smartMerge.years_experience = previous.years_experience;
          }
          if (!item.cover_photo_url && previous?.cover_photo_url) {
            smartMerge.cover_photo_url = previous.cover_photo_url;
          }
          // Recalculate category from category_ids if available
          // Priority: primary_category_id > root business category > other fallbacks
          if (smartMerge.primary_category_id && categoryMap.size > 0) {
            const primaryCat = categoryMap.get(smartMerge.primary_category_id);
            if (primaryCat?.name) {
              smartMerge.business_category = primaryCat.name;
            }
          } else if (smartMerge.category_ids && smartMerge.category_ids.length > 0 && categoryMap.size > 0) {
            // Find PRIMARY business category (category_type='business' with no parent)
            const primaryCatId = smartMerge.category_ids.find((id: string) => {
              const cat = categoryMap.get(id);
              return cat && cat.category_type === 'business' && !cat.parent_category_id;
            });
            // If no primary found, try any business category
            const anyBusinessCatId = primaryCatId || smartMerge.category_ids.find((id: string) => {
              const cat = categoryMap.get(id);
              return cat && cat.category_type === 'business';
            });
            const foundCatId = primaryCatId || anyBusinessCatId || smartMerge.category_ids[0];
            const catObj = categoryMap.get(foundCatId);
            if (catObj && catObj.name) {
              smartMerge.business_category = catObj.name;
            }
          }
          merged.set(item.id, smartMerge);
        });
        return Array.from(merged.values());
      };
      const mergedBusinesses = mergeBusinessesById(
        mergeBusinessesById(cachedBusinesses, formattedBusinesses),
        formattedBusinesses
      );

      // 4. Single state update — percentage is computed once, no flicker
      setBusinesses(mergedBusinesses);
      setInitialDataLoaded(true);

      const cacheKey = `dashboard_businesses_${user.id}`;
      AsyncStorage.setItem(cacheKey, JSON.stringify(mergedBusinesses)).catch(() => { });
      setIsOffline(false);

      const businessIds = mergedBusinesses.map(b => b.id);
      console.log('[BizDebug][Dashboard] Setting businesses completed', {
        businessIds,
      });
      // 5. Fetch lead counts (doesn't affect percentage, so can run after)
      if (businessIds.length > 0) {
        fetchBusinessLeadCounts(businessIds);
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
      console.log('[BizDebug][Dashboard] fetchBusinesses failed', {
        message: (error as any)?.message ?? 'Unknown error',
      });
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessLeadCounts = async (businessIds: string[]) => {
    try {
      const cachedStr = await AsyncStorage.getItem(`dashboard_business_counts_${user?.id}`);
      if (cachedStr) {
        setBusinessLeadCounts(JSON.parse(cachedStr));
      }
    } catch { }

    if (!user?.id) return;
    try {
      const { data: leads, error } = await getLeads({
        // Bearer token identifies the vendor, so vendor_id is not needed in the query
      });
      if (error) throw new Error(error.error);
      const counts: Record<string, number> = {};
      const leadsList = Array.isArray(leads) ? leads : [];
      businessIds.forEach((id) => { counts[id] = 0; });
      leadsList.forEach((lead: any) => {
        if (lead.business_id && counts[lead.business_id] !== undefined) {
          counts[lead.business_id]++;
        }
      });
      setBusinessLeadCounts(counts);
      AsyncStorage.setItem(`dashboard_business_counts_${user?.id}`, JSON.stringify(counts)).catch(() => { });
      setIsOffline(false);
    } catch (error) {
      console.error('Error fetching business lead counts:', error);
      setIsOffline(true);
    }
  };

  const fetchLeadStats = async () => {
    if (!user?.id) return;

    try {
      const cachedStr = await AsyncStorage.getItem(`dashboard_lead_stats_${user.id}_${selectedStatuses.join(',')}`);
      if (cachedStr) {
        setLeadStats(JSON.parse(cachedStr));
      }
    } catch { }

    try {
      const { data: leads, error } = await getLeads({
        ...(selectedStatuses.length > 0 ? { lead_status: selectedStatuses } : {}),
      });
      if (error) throw new Error(error.error);
      const list = Array.isArray(leads) ? leads : [];
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const statusCounts: Record<LeadStatus, number> = {
        new: 0, contacted: 0, quoted: 0, converted: 0, lost: 0,
      };
      list.forEach((lead: any) => {
        if (lead.lead_status in statusCounts) {
          statusCounts[lead.lead_status as LeadStatus]++;
        }
      });
      const stats = {
        total: list.length,
        monthly: list.filter((l: any) => new Date(l.created_at) >= startOfMonth).length,
        today: list.filter((l: any) => new Date(l.created_at) >= startOfDay).length,
        byStatus: statusCounts,
      };
      setLeadStats(stats);
      AsyncStorage.setItem(`dashboard_lead_stats_${user.id}_${selectedStatuses.join(',')}`, JSON.stringify(stats)).catch(() => { });
      setIsOffline(false);
    } catch (error) {
      console.error('Error fetching lead stats:', error);
      setIsOffline(true);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScreenBackground style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <View>
            <Text style={styles.headerGreeting}>
              {getGreeting((user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string))}
            </Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
        </View>
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color="#B45309" />
          <Text style={styles.offlineText}>You're currently offline. Data may be outdated.</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Lead Statistics ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Lead Statistics</Text>
            <TouchableOpacity onPress={() => router.push('/leads')} activeOpacity={0.7}>
              <Text style={styles.actionLink}>See all</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Chips */}
          <View style={styles.filterWrapper}>
            <ScrollView
              ref={filterScrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
              onContentSizeChange={(w) => setShowFilterScrollIndicator(w > 0)}
              onScroll={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                setShowFilterScrollIndicator(
                  contentOffset.x + layoutMeasurement.width < contentSize.width - 10
                );
              }}
              scrollEventThrottle={16}
            >
              {STATUS_OPTIONS.map((status) => {
                const isActive = selectedStatuses.includes(status.value);
                return (
                  <TouchableOpacity
                    key={status.value}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() =>
                      setSelectedStatuses((prev) =>
                        prev.includes(status.value)
                          ? prev.filter((s) => s !== status.value)
                          : [...prev, status.value]
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {status.label}{' '}
                      <Text style={[styles.chipCount, isActive && styles.chipCountActive]}>
                        {leadStats.byStatus[status.value]}
                      </Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {selectedStatuses.length > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => setSelectedStatuses([])}
                >
                  <X size={14} color="#FF3B30" />
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            {showFilterScrollIndicator && (
              <TouchableOpacity
                style={styles.scrollFade}
                onPress={() =>
                  filterScrollViewRef.current?.scrollTo({ x: 200, animated: true })
                }
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(245,247,250,0.95)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scrollFadeGradient}
                >
                  <ChevronRight size={18} color="#aaa" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Stat Cards — white cards with colored accent bottom border */}
          <View style={styles.statsRow}>
            {/* Total Leads */}
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.75}
              onPress={() =>
                router.push({
                  pathname: '/leads',
                  params: selectedStatuses.length > 0 ? { statuses: selectedStatuses.join(',') } : {},
                })
              }
            >
              <View style={[styles.statIconWrap, { backgroundColor: '#e8f0fe' }]}>
                <TrendingUp size={20} color="#4285F4" strokeWidth={2.5} />
              </View>
              <Text style={styles.statNumber}>{leadStats.total}</Text>
              <Text style={styles.statLbl}>Total Leads</Text>
              <View style={[styles.statAccent, { backgroundColor: '#4285F4' }]} />
            </TouchableOpacity>

            {/* This Month */}
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.75}
              onPress={() => {
                const params: any = { timeFilter: 'month' };
                if (selectedStatuses.length > 0) params.statuses = selectedStatuses.join(',');
                router.push({ pathname: '/leads', params });
              }}
            >
              <View style={[styles.statIconWrap, { backgroundColor: '#e6f4ea' }]}>
                <Calendar size={20} color="#34A853" strokeWidth={2.5} />
              </View>
              <Text style={styles.statNumber}>{leadStats.monthly}</Text>
              <Text style={styles.statLbl}>This Month</Text>
              <View style={[styles.statAccent, { backgroundColor: '#34A853' }]} />
            </TouchableOpacity>

            {/* Today */}
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.75}
              onPress={() => {
                const params: any = { timeFilter: 'today' };
                if (selectedStatuses.length > 0) params.statuses = selectedStatuses.join(',');
                router.push({ pathname: '/leads', params });
              }}
            >
              <View style={[styles.statIconWrap, { backgroundColor: '#fef3dc' }]}>
                <Eye size={20} color="#FBBC04" strokeWidth={2.5} />
              </View>
              <Text style={styles.statNumber}>{leadStats.today}</Text>
              <Text style={styles.statLbl}>Today</Text>
              <View style={[styles.statAccent, { backgroundColor: '#FBBC04' }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── My Businesses ── */}
        {businesses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Businesses</Text>
            </View>

            <View style={styles.businessList}>
              {businesses.map((business, index) => {
                const completion = calculateProfileCompletion(business);
                const isIncomplete = completion < 100;
                // Color: amber at low%, transitions to green near 100%
                const barColor = completion >= 80 ? '#34A853' : completion >= 50 ? '#FBBC04' : '#FF9C42';

                return (
                  <TouchableOpacity
                    key={business.id}
                    style={styles.businessCardItem}
                    onPress={() => (router as any).push(`/business-profile?id=${business.id}`)}
                    activeOpacity={0.7}
                  >
                    {/* Main row */}
                    <View style={styles.businessRow}>
                      {/* Avatar */}
                      {business.cover_photo_url ? (
                        <ImageWithFallback
                          uri={business.cover_photo_url}
                          fallbackLetter={business.business_name.charAt(0).toUpperCase()}
                          gradientColors={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                          style={styles.businessAvatar}
                        />
                      ) : (
                        <LinearGradient
                          colors={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.businessAvatar}
                        >
                          <Text style={styles.businessAvatarLetter}>
                            {business.business_name.charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                      )}

                      {/* Info */}
                      <View style={styles.businessInfo}>
                        <Text style={styles.businessName} numberOfLines={1}>
                          {business.business_name}
                        </Text>
                        <Text style={styles.businessCategory} numberOfLines={1}>
                          {business.business_category}
                        </Text>
                      </View>

                      {/* Right side */}
                      <View style={styles.businessRight}>
                        {businessLeadCounts[business.id] !== undefined && (
                          <View style={styles.leadsBadge}>
                            <Text style={styles.leadsBadgeText}>
                              {businessLeadCounts[business.id]} {businessLeadCounts[business.id] === 1 ? 'lead' : 'leads'}
                            </Text>
                          </View>
                        )}
                        <ChevronRight size={16} color="#c8c8c8" strokeWidth={2} />
                      </View>
                    </View>

                    {/* Profile completion bar — only shown when incomplete */}
                    {isIncomplete && (
                      <View style={styles.completionWrap}>
                        <Text style={[styles.completionLabelText, { color: barColor }]}>
                          Profile Completed
                        </Text>
                        <View style={styles.completionBarBg}>
                          <View
                            style={[
                              styles.completionBarFill,
                              { width: `${completion}%` as any, backgroundColor: barColor },
                            ]}
                          />
                        </View>
                        <Text style={[styles.completionLabel, { color: barColor }]}>
                          {completion}%
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Quick Actions ── */}
        <View style={[styles.section]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickRow}>
            {/* <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.75}
              onPress={() => router.push('/leads')}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: '#ede9ff' }]}>
                <TrendingUp size={24} color="#7c5cfc" strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>Add Lead</Text>
            </TouchableOpacity> */}

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.75}
              onPress={() => router.push('/business-registration')}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: '#e6f4ea' }]}>
                <Calendar size={24} color="#34A853" strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>Add Business</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickCard}
              activeOpacity={0.75}
              onPress={() => (router as any).push('/schedule')}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: '#fef3dc' }]}>
                <Calendar size={24} color="#FBBC04" strokeWidth={2} />
              </View>
              <Text style={styles.quickLabel}>Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#efefef',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    marginRight: 0,
  },
  headerGreeting: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 24,
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f4f4f4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ececec',
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

  /* Content layout */
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  actionLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },

  /* Filter chips */
  filterWrapper: {
    position: 'relative',
    marginBottom: 14,
  },
  filterScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    paddingRight: 36,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#eef0f4',
  },
  chipActive: {
    backgroundColor: '#1a1a1a',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  chipTextActive: {
    color: '#fff',
  },
  chipCount: {
    fontWeight: '700',
    color: '#555',
  },
  chipCountActive: {
    color: '#fff',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFF5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
  },
  scrollFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 10,
  },
  scrollFadeGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 4,
  },

  /* Stat cards */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'flex-start',
    overflow: 'hidden',
    /* Shadow */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 30,
  },
  statLbl: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    marginTop: 2,
  },
  statAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },

  /* Business list — each business is its own card */
  businessList: {
    gap: 10,
  },
  businessCardItem: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  businessAvatar: {
    width: 42,
    height: 42,
    borderRadius: 10,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessAvatarLetter: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  businessCategory: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
  },
  businessRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadsBadge: {
    backgroundColor: '#f0f4ff',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  leadsBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4285F4',
  },

  /* Profile completion bar */
  completionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 11,
    gap: 8,
  },
  completionLabelText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  completionBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 99,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: 4,
    borderRadius: 99,
  },
  completionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    minWidth: 28,
    textAlign: 'right',
  },

  /* Empty */
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },

  /* Quick Actions */
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  quickIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    textAlign: 'center',
  },
});
