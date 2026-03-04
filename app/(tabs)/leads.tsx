import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone, Mail, ChevronRight, Search, X, MoveVertical as MoreVertical, SquareCheck as CheckSquare, Square } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseCore, supabaseCrm } from '../../lib/supabase';
import { getTimeAgo } from '../../lib/timeUtils';

import SortModal, { SortOption } from '../../components/SortModal';
import FilterModal from '../../components/FilterModal';
import { Lead, STATUS_OPTIONS } from '../../types/leads';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';

import ScreenBackground from '../../components/ScreenBackground';


const EVENT_TYPES = [
  'Wedding',
  'Birthday',
  'Corporate Event',
  'Anniversary',
  'Engagement',
  'Baby Shower',
  'Graduation',
  'Conference',
  'Product Launch',
  'Holiday Party',
  'Charity Event',
  'Other',
];

export default function LeadsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'today'>('all');

  const [showEventTypeModal, setShowEventTypeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [showFilterScrollIndicator, setShowFilterScrollIndicator] = useState(false);
  const filterScrollViewRef = useRef<ScrollView>(null);

  const hasLoadedLeads = useRef(false);

  // Sync filters with URL params when navigating from dashboard
  useEffect(() => {
    // Only update if params exist, otherwise keep current state
    if (params.statuses && typeof params.statuses === 'string') {
      const statusArray = params.statuses.split(',');
      setSelectedStatuses(statusArray);
    } else if (params.statuses === undefined && selectedStatuses.length > 0) {
      // If params were cleared (navigated without params), don't reset
      // This allows users to clear filters manually
    }

    if (params.timeFilter && typeof params.timeFilter === 'string') {
      setTimeFilter(params.timeFilter as 'all' | 'month' | 'today');
    } else if (params.timeFilter === undefined && timeFilter !== 'all') {
      // If params were cleared, don't reset
    }
  }, [params.statuses, params.timeFilter]); // Only depend on specific params

  useEffect(() => {
    if (user?.id) {
      fetchLeads(!hasLoadedLeads.current);
    }
  }, [user?.id]);

  // Refresh leads whenever the screen comes into focus (e.g., after creating/editing a lead)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchLeads(!hasLoadedLeads.current);
      }
    }, [user?.id])
  );

  const fetchLeads = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const { data: businessData } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name, city')
        .eq('vendor_id', user?.id);

      if (!businessData || businessData.length === 0) {
        setLeads([]);
        if (showLoading) setLoading(false);
        hasLoadedLeads.current = true;
        return;
      }

      const businessIds = businessData.map((b) => b.id);
      const businessMap = new Map(
        businessData.map((b) => [b.id, { name: b.business_name, city: b.city }])
      );

      // Fetch leads
      const { data: leadsData, error } = await supabaseCrm
        .from('customer_leads')
        .select('*')
        .eq('vendor_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error from Supabase:', error);
        throw error;
      }

      console.log(`📋 Raw leads from DB: ${leadsData?.length || 0}`);
      console.log('Lead IDs:', leadsData?.map(l => l.id) || []);

      // Get unique category IDs
      const categoryIds = [
        ...new Set((leadsData || []).map((lead) => lead.category_id).filter(Boolean)),
      ];

      // Fetch category names
      const categoryMap = new Map<string, string>();
      if (categoryIds.length > 0) {
        const { data: categories } = await supabaseCore
          .from('categories')
          .select('id, name')
          .in('id', categoryIds);

        categories?.forEach((cat) => {
          categoryMap.set(cat.id, cat.name);
        });
      }

      // Map business names, cities, and event types to leads
      const leadsWithDetails = (leadsData || []).map((lead) => {
        const business = lead.business_id ? businessMap.get(lead.business_id) : null;
        const eventType = lead.category_id ? categoryMap.get(lead.category_id) : null;

        return {
          ...lead,
          business_name: business?.name || 'Unknown Business',
          city: business?.city || null,
          event_type: eventType || lead.event_type || 'Unknown Event',
          status: lead.lead_status, // Map lead_status to status for compatibility
        } as Lead;
      });

      console.log(`✅ Fetched ${leadsWithDetails.length} leads`);
      console.log('Sample lead IDs:', leadsWithDetails.slice(0, 3).map(l => l.id));
      setLeads(leadsWithDetails);
      hasLoadedLeads.current = true;
    } catch (error) {
      console.error('❌ Error fetching leads:', error);
      Alert.alert('Error', 'Failed to load leads. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchLeads(false);
    } finally {
      setRefreshing(false);
    }
  };

  const availableCities = useMemo(() => {
    const cities = leads
      .map((lead) => lead.city)
      .filter((city): city is string => city !== null && city !== '');
    return Array.from(new Set(cities)).sort();
  }, [leads]);

  const filteredAndSortedLeads = useMemo(() => {
    let filtered = [...leads];

    if (timeFilter === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (lead) => new Date(lead.created_at) >= startOfMonth
      );
    } else if (timeFilter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (lead) => new Date(lead.created_at) >= startOfDay
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.customer_name?.toLowerCase().includes(query) ||
          lead.customer_email?.toLowerCase().includes(query) ||
          lead.customer_phone?.toLowerCase().includes(query) ||
          lead.event_type?.toLowerCase().includes(query) ||
          lead.city?.toLowerCase().includes(query) ||
          lead.event_location?.toLowerCase().includes(query)
      );
    }

    if (selectedEventTypes.length > 0) {
      filtered = filtered.filter((lead) =>
        selectedEventTypes.includes(lead.event_type || '')
      );
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((lead) =>
        selectedStatuses.includes(lead.lead_status)
      );
    }

    if (selectedCities.length > 0) {
      filtered = filtered.filter(
        (lead) => lead.city && selectedCities.includes(lead.city)
      );
    }

    // Priority filter removed - priority field doesn't exist in crm.customer_leads
    // if (selectedPriorities.length > 0) {
    //   filtered = filtered.filter((lead) =>
    //     selectedPriorities.includes(lead.priority || 'medium')
    //   );
    // }

    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'recent':
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        case 'event_date':
          if (!a.event_date && !b.event_date) return 0;
          if (!a.event_date) return 1;
          if (!b.event_date) return -1;
          return (
            new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
          );
        case 'budget':
          return 0;
        default:
          return 0;
      }
    });

    return filtered;
  }, [leads, searchQuery, selectedEventTypes, selectedStatuses, selectedCities, sortOption, timeFilter]);

  const getStatusColor = (status: string) => {
    const statusInfo = STATUS_OPTIONS.find((s) => s.value === status);
    return statusInfo?.color || '#999';
  };

  const getStatusLabel = (status: string) => {
    const statusInfo = STATUS_OPTIONS.find((s) => s.value === status);
    return statusInfo?.label || status;
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredAndSortedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredAndSortedLeads.map((lead) => lead.id));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    try {
      const { error } = await supabaseCrm
        .from('customer_leads')
        .update({ lead_status: newStatus })
        .in('id', selectedLeads);

      if (error) throw error;

      Alert.alert('Success', `Updated ${selectedLeads.length} leads`);
      setSelectedLeads([]);
      setBulkSelectMode(false);
      fetchLeads();
    } catch (error) {
      console.error('Error updating leads:', error);
      Alert.alert('Error', 'Failed to update leads');
    }
  };

  const handleBulkDelete = () => {
    Alert.alert(
      'Delete Leads',
      `Are you sure you want to delete ${selectedLeads.length} leads? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabaseCrm
                .from('customer_leads')
                .delete()
                .in('id', selectedLeads);

              if (error) throw error;

              Alert.alert('Success', 'Leads deleted successfully');
              setSelectedLeads([]);
              setBulkSelectMode(false);
              fetchLeads();
            } catch (error) {
              console.error('Error deleting leads:', error);
              Alert.alert('Error', 'Failed to delete leads');
            }
          },
        },
      ]
    );
  };



  const activeFilterCount =
    selectedEventTypes.length + selectedStatuses.length + selectedCities.length;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Quick status tabs displayed below the search bar
  const STATUS_TABS = [
    { label: 'All', value: '' },
    { label: 'New', value: 'new' },
    { label: 'Contacted', value: 'contacted' },
    { label: 'Quoted', value: 'quoted' },
    { label: 'Won', value: 'converted' },
  ];

  const activeStatusTab = selectedStatuses.length === 1 ? selectedStatuses[0] : '';

  const setStatusTab = (value: string) => {
    if (value === '') {
      setSelectedStatuses([]);
    } else {
      setSelectedStatuses([value]);
    }
  };

  const renderLead = ({ item }: { item: Lead }) => {
    const isSelected = selectedLeads.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.leadCard, isSelected && styles.selectedCard]}
        activeOpacity={0.7}
        onPress={() => {
          if (bulkSelectMode) {
            toggleLeadSelection(item.id);
          } else {
            router.push(`/lead-detail?id=${item.id}`);
          }
        }}
        onLongPress={() => {
          setBulkSelectMode(true);
          toggleLeadSelection(item.id);
        }}
      >
        {bulkSelectMode && (
          <View style={styles.checkboxContainer}>
            {isSelected ? (
              <CheckSquare size={24} color="#007AFF" strokeWidth={2} />
            ) : (
              <Square size={24} color="#ccc" strokeWidth={2} />
            )}
          </View>
        )}

        {/* Top row: avatar + name/business + status badge */}
        <View style={styles.cardTopRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{getInitials(item.customer_name)}</Text>
          </View>
          <View style={styles.cardNameBlock}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.businessName}>{item.business_name}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.lead_status) + '18' },
            ]}
          >
            <Text style={[styles.statusText, { color: getStatusColor(item.lead_status) }]}>
              {getStatusLabel(item.lead_status)}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.cardDivider} />

        {/* Bottom row: time + budget on left, actions on right */}
        <View style={styles.cardBottomRow}>
          <Text style={styles.cardMeta}>
            {getTimeAgo(item.created_at)}
            {item.budget_range ? (
              <Text style={styles.budgetText}>{`  •  ${item.budget_range}`}</Text>
            ) : null}
          </Text>
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => { }}
            >
              <Phone size={16} color="#6B7FD7" strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => { }}
            >
              <Mail size={16} color="#6B7FD7" strokeWidth={2} />
            </TouchableOpacity>
            <ChevronRight size={18} color="#C0C4D6" strokeWidth={2} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenBackground style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Leads</Text>
        <View style={styles.headerActions}>
          {bulkSelectMode ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setBulkSelectMode(false);
                setSelectedLeads([]);
              }}
            >
              <X size={20} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {bulkSelectMode && selectedLeads.length > 0 && (
        <View style={styles.bulkActionsBar}>
          <TouchableOpacity style={styles.bulkActionButton} onPress={toggleSelectAll}>
            <Text style={styles.bulkActionText}>
              {selectedLeads.length === filteredAndSortedLeads.length
                ? 'Deselect All'
                : 'Select All'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.selectedCount}>{selectedLeads.length} selected</Text>
          <TouchableOpacity
            style={styles.bulkActionButton}
            onPress={() => setShowBulkActionsModal(true)}
          >
            <MoreVertical size={20} color="#007AFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Search size={18} color="#aaa" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
          placeholderTextColor="#aaa"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearSearchButton}
          >
            <X size={16} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status pill tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statusTabsRow}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[
              styles.statusTab,
              activeStatusTab === tab.value && styles.statusTabActive,
            ]}
            onPress={() => setStatusTab(tab.value)}
          >
            <Text
              style={[
                styles.statusTabText,
                activeStatusTab === tab.value && styles.statusTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lead count row - occupies space even when loading to prevent jumps */}
      <View style={{ minHeight: 20 }}>
        {!loading && (
          <Text style={styles.leadCount}>
            {filteredAndSortedLeads.length} lead{filteredAndSortedLeads.length !== 1 ? 's' : ''} found
          </Text>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : filteredAndSortedLeads.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>
            {activeFilterCount > 0 ? 'No Matching Leads' : 'No Leads Yet'}
          </Text>
          <Text style={styles.emptyStateText}>
            {activeFilterCount > 0
              ? 'Try adjusting your filters'
              : 'Your customer inquiries will appear here'}
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={() => {
                setSearchQuery('');
                setSelectedEventTypes([]);
                setSelectedStatuses([]);
                setSelectedCities([]);
                setTimeFilter('all');
              }}
            >
              <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedLeads}
          renderItem={renderLead}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
            />
          }
        />
      )}

      <SortModal
        visible={showSortModal}
        onClose={() => setShowSortModal(false)}
        selectedSort={sortOption}
        onSelectSort={setSortOption}
      />

      <FilterModal
        visible={showEventTypeModal}
        onClose={() => setShowEventTypeModal(false)}
        title="Event Type"
        options={EVENT_TYPES}
        selectedOptions={selectedEventTypes}
        onSelectOptions={setSelectedEventTypes}
        multiSelect
      />

      <FilterModal
        visible={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Status"
        options={STATUS_OPTIONS.map((s) => s.value)}
        selectedOptions={selectedStatuses}
        onSelectOptions={setSelectedStatuses}
        multiSelect
      />


      <FilterModal
        visible={showBulkActionsModal}
        onClose={() => setShowBulkActionsModal(false)}
        title="Bulk Actions"
        options={[
          ...STATUS_OPTIONS.map((s) => `Change to ${s.label}`),
          'Delete Selected',
        ]}
        selectedOptions={[]}
        onSelectOptions={(options) => {
          const option = options[0];
          setShowBulkActionsModal(false);
          if (option === 'Delete Selected') {
            handleBulkDelete();
          } else {
            const status = STATUS_OPTIONS.find(
              (s) => `Change to ${s.label}` === option
            );
            if (status) {
              handleBulkStatusChange(status.value);
            }
          }
        }}
        multiSelect={false}
      />

      <FilterModal
        visible={showCityModal}
        onClose={() => setShowCityModal(false)}
        title="City"
        options={availableCities}
        selectedOptions={selectedCities}
        onSelectOptions={setSelectedCities}
        multiSelect
      />


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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#3D5AFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#3D5AFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#007AFF',
  },
  bulkActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F3F8',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 30,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    padding: 0,
  },
  clearSearchButton: {
    padding: 4,
  },
  statusTabsRow: {
    paddingHorizontal: 16,
    paddingVertical: 5, // Compact vertical padding for the row
    gap: 8,
    flexDirection: 'row',
  },
  statusTab: {
    paddingHorizontal: 12,
    paddingVertical: 6, // Compact padding for the chip itself
    borderRadius: 20,
    backgroundColor: '#eef0f4',
  },
  statusTabActive: {
    backgroundColor: '#1a1a1a',
  },
  statusTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  statusTabTextActive: {
    color: '#fff',
  },
  leadCount: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    marginHorizontal: 20,
    marginBottom: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
    marginBottom: 16,
  },
  clearFiltersButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  clearFiltersButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  leadCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#F5F9FF',
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
    marginBottom: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1E2A4A',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  cardNameBlock: {
    flex: 1,
  },
  cardMainContent: {
    flex: 1,
  },
  cardHeader: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  businessName: {
    fontSize: 13,
    color: '#888',
    fontWeight: '400',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F0F1F5',
    marginBottom: 12,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardMeta: {
    fontSize: 13,
    color: '#888',
    fontWeight: '400',
    flex: 1,
  },
  budgetText: {
    fontSize: 13,
    color: '#34C759',
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    ...Shadows.large,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
