import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, TrendingUp, Calendar, Eye, X, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore, supabaseCrm } from '@/lib/supabase';
import { STATUS_OPTIONS, LeadStatus } from '@/types/leads';
import FilterChip from '@/components/FilterChip';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';
import Logo from '@/components/Logo';

interface Business {
  id: string;
  business_name: string;
  vendor_service_category: string;
  business_description: string;
  cover_photo_url: string | null;
  city: string;
  state: string;
}

interface LeadStats {
  total: number;
  monthly: number;
  today: number;
  byStatus: Record<LeadStatus, number>;
}

export default function DashboardScreen() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [leadStats, setLeadStats] = useState<LeadStats>({
    total: 0,
    monthly: 0,
    today: 0,
    byStatus: {
      new: 0,
      contacted: 0,
      quoted: 0,
      converted: 0,
      lost: 0,
    },
  });
  const [selectedStatuses, setSelectedStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilterScrollIndicator, setShowFilterScrollIndicator] = useState(false);
  const [showBusinessScrollIndicator, setShowBusinessScrollIndicator] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user?.id) {
      fetchBusinesses();
      fetchLeadStats();
    }
  }, [user?.id, selectedStatuses]);

  // Refresh businesses when screen comes into focus (e.g., after editing)
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
      const { data, error } = await supabaseCore
        .from('vendor_businesses')
        .select('*')
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error) {
      console.error('Error fetching businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadStats = async () => {
    if (!user?.id) {
      return;
    }
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
          byStatus: {
            new: 0,
            contacted: 0,
            quoted: 0,
            converted: 0,
            lost: 0,
          },
        });
        return;
      }

      const statusFilter = selectedStatuses.length > 0 ? selectedStatuses : undefined;

      // Use vendor_id for RLS policy compliance
      let totalQuery = supabaseCrm
        .from('customer_leads')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', user.id);

      if (statusFilter) {
        totalQuery = totalQuery.in('lead_status', statusFilter);
      }

      const { count: totalCount } = await totalQuery;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      let monthlyQuery = supabaseCrm
        .from('customer_leads')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', user.id)
        .gte('created_at', startOfMonth.toISOString());

      if (statusFilter) {
        monthlyQuery = monthlyQuery.in('lead_status', statusFilter);
      }

      const { count: monthlyCount } = await monthlyQuery;

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let todayQuery = supabaseCrm
        .from('customer_leads')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', user.id)
        .gte('created_at', startOfDay.toISOString());

      if (statusFilter) {
        todayQuery = todayQuery.in('lead_status', statusFilter);
      }

      const { count: todayCount } = await todayQuery;

      const { data: allLeads } = await supabaseCrm
        .from('customer_leads')
        .select('lead_status')
        .eq('vendor_id', user.id);

      const statusCounts: Record<LeadStatus, number> = {
        new: 0,
        contacted: 0,
        quoted: 0,
        converted: 0,
        lost: 0,
      };

      allLeads?.forEach((lead) => {
        if (lead.lead_status in statusCounts) {
          statusCounts[lead.lead_status as LeadStatus]++;
        }
      });

      setLeadStats({
        total: totalCount || 0,
        monthly: monthlyCount || 0,
        today: todayCount || 0,
        byStatus: statusCounts,
      });
    } catch (error) {
      console.error('Error fetching lead stats:', error);
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
    <View style={styles.container}>
      {/* <LinearGradient
        colors={[Colors.primary.main, Colors.primary.light]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.headerContent}>
        <Logo
         size={48}
         style={{ ...styles.headerLogo, transform: [{ scale: 1.3}] }}
/>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>
      </LinearGradient> */}
      <View style={[styles.header, { paddingTop: insets.top + 20, paddingLeft: insets.top + 15, backgroundColor: '#fff' }]}>
  <View style={styles.headerContent}>
    <Logo size={48} style={{ ...styles.headerLogo, transform: [{ scale: 1.2 }] }} />
    <Text style={[styles.headerTitle, { color: Colors.neutral.black }]}>Dashboard</Text>
  </View>
</View>


      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: 'rgba(138, 151, 209, 0.02)' }]}>
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Lead Statistics</Text>

          <View style={styles.scrollContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
              style={styles.filterContainer}
              onContentSizeChange={(width) => {
                // Check if content is wider than container
                setShowFilterScrollIndicator(width > 0);
              }}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                const canScrollRight = contentOffset.x + layoutMeasurement.width < contentSize.width - 10;
                setShowFilterScrollIndicator(canScrollRight);
              }}
              scrollEventThrottle={16}
            >
              {STATUS_OPTIONS.map((status) => (
                <FilterChip
                  key={status.value}
                  label={`${status.label} (${leadStats.byStatus[status.value]})`}
                  active={selectedStatuses.includes(status.value)}
                  onPress={() => {
                    setSelectedStatuses((prev) =>
                      prev.includes(status.value)
                        ? prev.filter((s) => s !== status.value)
                        : [...prev, status.value]
                    );
                  }}
                  showClear={false}
                />
              ))}
              {selectedStatuses.length > 0 && (
                <TouchableOpacity
                  style={styles.clearAllButton}
                  onPress={() => setSelectedStatuses([])}
                >
                  <X size={16} color="#FF3B30" />
                  <Text style={styles.clearAllText}>Clear</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            {showFilterScrollIndicator && (
              <View style={styles.scrollIndicatorRight}>
                <LinearGradient
                  colors={['transparent', 'rgba(255, 255, 255, 0.8)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.scrollGradient}
                >
                  <ChevronRight size={20} color="#666" />
                </LinearGradient>
              </View>
            )}
          </View>

          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => {
                const params = selectedStatuses.length > 0
                  ? `?statuses=${selectedStatuses.join(',')}`
                  : '';
                router.push(`/(tabs)/leads${params}`);
              }}
            >
              <LinearGradient
                colors={['#b1dafc', '#bbf2fc']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statIconCircle}>
                  <TrendingUp size={24} color={Colors.neutral.black} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{leadStats.total}</Text>
                <Text style={styles.statLabel}>Total Leads</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => {
                const params = selectedStatuses.length > 0
                  ? `?statuses=${selectedStatuses.join(',')}&timeFilter=month`
                  : '?timeFilter=month';
                router.push(`/(tabs)/leads${params}`);
              }}
            >
              <LinearGradient
                colors={['#7cf293', '#9df5ae']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statIconCircle}>
                  <Calendar size={24} color={Colors.neutral.black} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{leadStats.monthly}</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => {
                const params = selectedStatuses.length > 0
                  ? `?statuses=${selectedStatuses.join(',')}&timeFilter=today`
                  : '?timeFilter=today';
                router.push(`/(tabs)/leads${params}`);
              }}
            >
              <LinearGradient
                colors={['#ffd24d', '#ffd573']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.statCardGradient}
              >
                <View style={styles.statIconCircle}>
                  <Eye size={24} color={Colors.neutral.black} strokeWidth={2.5} />
                </View>
                <Text style={styles.statValue}>{leadStats.today}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.businessSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Businesses</Text>
          </View>

          {businesses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No Businesses Yet</Text>
              <Text style={styles.emptyStateText}>
                Register your first business to start receiving leads
              </Text>
            </View>
          ) : (
            <View style={styles.scrollContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.businessList}
                onContentSizeChange={(width) => {
                  setShowBusinessScrollIndicator(width > 0);
                }}
                onScroll={(event) => {
                  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                  const canScrollRight = contentOffset.x + layoutMeasurement.width < contentSize.width - 10;
                  setShowBusinessScrollIndicator(canScrollRight);
                }}
                scrollEventThrottle={16}
              >
                {businesses.map((business) => (
                  <TouchableOpacity
                    key={business.id}
                    style={styles.businessCard}
                    onPress={() =>
                      router.push(`/business-details?id=${business.id}`)
                    }
                  >
                    {business.cover_photo_url ? (
                      <Image
                        source={{ uri: business.cover_photo_url }}
                        style={styles.businessImage}
                      />
                    ) : (
                      <LinearGradient
                        colors={[Colors.secondary.main, Colors.secondary.light]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.businessImagePlaceholder}
                      >
                        <Text style={styles.businessImagePlaceholderText}>
                          {business.business_name.charAt(0)}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={styles.businessInfo}>
                      <Text style={styles.businessName} numberOfLines={1}>
                        {business.business_name}
                      </Text>
                      <Text style={styles.businessCategory} numberOfLines={1}>
                        {business.vendor_service_category}
                      </Text>
                      <Text style={styles.businessDescription} numberOfLines={2}>
                        {business.business_description}
                      </Text>
                      <Text style={styles.businessLocation} numberOfLines={1}>
                        {business.city}, {business.state}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {showBusinessScrollIndicator && (
                <View style={styles.scrollIndicatorRight}>
                  <LinearGradient
                    colors={['transparent', 'rgba(255, 255, 255, 0.8)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.scrollGradient}
                  >
                    <ChevronRight size={20} color="#666" />
                  </LinearGradient>
                </View>
              )}
            </View>
          )}

          {/* Always show Register Business button */}
          <View style={styles.primaryButtonContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, businesses.length > 0 && styles.primaryButtonWithMargin]}
              onPress={() => router.push('/business-registration')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[Colors.purple.main, Colors.purple.light]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Plus size={20} color={Colors.neutral.black} strokeWidth={2.5} />
                <Text style={styles.primaryButtonText}>
                  Register Business
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Spacing.lg,
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
  content: {
    padding: 20,
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.medium,
  },
  statCardGradient: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.neutral.black,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.neutral.black,
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.9,
  },
  scrollContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  filterContainer: {
    marginBottom: 0,
  },
  filterScrollContent: {
    paddingVertical: 4,
    gap: 8,
    paddingRight: 40, // Add padding for scroll indicator
  },
  scrollIndicatorRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    pointerEvents: 'none',
  },
  scrollGradient: {
    width: 40,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
  },
  businessSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral.black,
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButtonContainer: {
    alignItems: 'center',
    width: '100%',
  },
  primaryButton: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.medium,
    alignSelf: 'center',
  },
  primaryButtonWithMargin: {
    marginTop: 16,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
  },
  primaryButtonText: {
    color: Colors.neutral.black,
    fontSize: 16,
    fontWeight: '700',
  },
  businessList: {
    gap: 16,
    paddingRight: 40, // Add padding for scroll indicator
  },
  businessCard: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  businessImage: {
    width: '100%',
    height: 140,
  },
  businessImagePlaceholder: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessImagePlaceholderText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  businessInfo: {
    padding: 16,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  businessCategory: {
    fontSize: 12,
    color: Colors.primary.main,
    fontWeight: '600',
    marginBottom: 8,
  },
  businessDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  businessLocation: {
    fontSize: 12,
    color: '#999',
  },
});
