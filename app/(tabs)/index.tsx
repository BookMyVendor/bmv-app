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
import { supabaseCore, supabaseCrm } from '../../lib/supabase';
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
      category_type: string;
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
  pan_number?: string | null;
}

interface LeadStats {
  total: number;
  monthly: number;
  today: number;
  byStatus: Record<LeadStatus, number>;
}

// Returns a 0-100 integer representing how complete the business profile is
// Returns a 0-100 integer representing how complete the business profile is based ONLY on mandatory fields (*)
function calculateProfileCompletion(business: Business): number {
  const checks = [
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
    // 10. Pricing (Package exists)
    !!(business.vendor_business_pricing_packages && business.vendor_business_pricing_packages.length > 0),
    // 11. Services Offered Mapped
    !!(business.vendor_business_category_mappings?.some(m => m.categories?.category_type === 'business')),
    // 12. Event Types Mapped
    !!(business.vendor_business_category_mappings?.some(m => m.categories?.category_type === 'event')),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
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
        fetchBusinesses();
        fetchLeadStats();
      }
    }, [user?.id])
  );

  const fetchBusinesses = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const cachedStr = await AsyncStorage.getItem(`dashboard_businesses_${user.id}`);
      if (cachedStr) {
        setBusinesses(JSON.parse(cachedStr));
      }
    } catch { }

    try {
      const { data, error } = await supabaseCore
        .from('vendor_businesses')
        .select(`
          *,
          vendor_business_category_mappings (
            categories (
              name,
              category_type,
              parent_category_id
            )
          ),
          vendor_business_pricing_packages (
            id,
            base_price,
            price_unit
          )
        `)
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBusinesses = (data || []).map((business: any) => {
        // Find the root business category (parent_category_id is null)
        const rootCategoryMatch = business.vendor_business_category_mappings?.find((m: any) =>
          m.categories?.category_type === 'business' && m.categories?.parent_category_id === null
        );

        // Fallback: if no root is found, try any business category, then index 0
        const categoryName = rootCategoryMatch?.categories?.name ||
          business.vendor_business_category_mappings?.find((m: any) => m.categories?.category_type === 'business')?.categories?.name ||
          business.vendor_business_category_mappings?.[0]?.categories?.name;

        return {
          ...business,
          business_description: business.description,
          business_category: categoryName || 'General',
        };
      });

      setBusinesses(formattedBusinesses);
      AsyncStorage.setItem(`dashboard_businesses_${user.id}`, JSON.stringify(formattedBusinesses)).catch(() => { });
      setIsOffline(false);

      if (formattedBusinesses.length > 0) {
        fetchBusinessLeadCounts(formattedBusinesses.map((b: Business) => b.id));
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
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

    try {
      const counts: Record<string, number> = {};
      await Promise.all(
        businessIds.map(async (id) => {
          const { count } = await supabaseCrm
            .from('customer_leads')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', id);
          counts[id] = count || 0;
        })
      );
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
      const { data: businessData } = await supabaseCore
        .from('vendor_businesses')
        .select('id')
        .eq('vendor_id', user.id);

      if (!businessData || businessData.length === 0) {
        setLeadStats({
          total: 0,
          monthly: 0,
          today: 0,
          byStatus: { new: 0, contacted: 0, quoted: 0, converted: 0, lost: 0 },
        });
        return;
      }

      const statusFilter = selectedStatuses.length > 0 ? selectedStatuses : undefined;

      let totalQuery = supabaseCrm
        .from('customer_leads')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', user.id);
      if (statusFilter) totalQuery = totalQuery.in('lead_status', statusFilter);
      const { count: totalCount } = await totalQuery;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      let monthlyQuery = supabaseCrm
        .from('customer_leads')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', user.id)
        .gte('created_at', startOfMonth.toISOString());
      if (statusFilter) monthlyQuery = monthlyQuery.in('lead_status', statusFilter);
      const { count: monthlyCount } = await monthlyQuery;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      let todayQuery = supabaseCrm
        .from('customer_leads')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', user.id)
        .gte('created_at', startOfDay.toISOString());
      if (statusFilter) todayQuery = todayQuery.in('lead_status', statusFilter);
      const { count: todayCount } = await todayQuery;

      const { data: allLeads } = await supabaseCrm
        .from('customer_leads')
        .select('lead_status')
        .eq('vendor_id', user.id);

      const statusCounts: Record<LeadStatus, number> = {
        new: 0, contacted: 0, quoted: 0, converted: 0, lost: 0,
      };
      allLeads?.forEach((lead) => {
        if (lead.lead_status in statusCounts) {
          statusCounts[lead.lead_status as LeadStatus]++;
        }
      });

      const stats = {
        total: totalCount || 0,
        monthly: monthlyCount || 0,
        today: todayCount || 0,
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
              {getGreeting(user?.user_metadata?.full_name || user?.user_metadata?.name)}
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
                        <Image
                          source={{ uri: business.cover_photo_url }}
                          style={styles.businessAvatar}
                          resizeMode="cover"
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
