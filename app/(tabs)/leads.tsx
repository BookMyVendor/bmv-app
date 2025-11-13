import React, { useEffect, useState, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, MapPin, Clock, ArrowUpDown, ChevronRight, Search, Plus, X, Download, MoveVertical as MoreVertical, SquareCheck as CheckSquare, Square } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore, supabaseCrm } from '@/lib/supabase';
import { getTimeAgo, formatEventDate } from '@/lib/timeUtils';
import FilterChip from '@/components/FilterChip';
import SortModal, { SortOption } from '@/components/SortModal';
import FilterModal from '@/components/FilterModal';
import { Lead, STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/types/leads';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';


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
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<'all' | 'month' | 'today'>('all');

  const [showEventTypeModal, setShowEventTypeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);

  useEffect(() => {
    if (params.statuses && typeof params.statuses === 'string') {
      const statusArray = params.statuses.split(',');
      setSelectedStatuses(statusArray);
    }
    if (params.timeFilter && typeof params.timeFilter === 'string') {
      setTimeFilter(params.timeFilter as 'all' | 'month' | 'today');
    }
  }, [params]);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);

      const { data: businessData } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name')
        .eq('vendor_id', user?.id);

      if (!businessData || businessData.length === 0) {
        setLeads([]);
        setLoading(false);
        return;
      }

      const businessIds = businessData.map((b) => b.id);
      const businessMap = new Map(businessData.map((b) => [b.id, b.business_name]));

      // Fetch leads without join
      const { data, error } = await supabaseCrm
        .from('customer_leads')
        .select('*')
        .in('business_id', businessIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map business names to leads
      const leadsWithBusiness = (data || []).map((lead) => ({
        ...lead,
        business_name: businessMap.get(lead.business_id) || 'Unknown Business',
      }));

      setLeads(leadsWithBusiness);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
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
          lead.customer_name.toLowerCase().includes(query) ||
          lead.customer_email?.toLowerCase().includes(query) ||
          lead.customer_phone.includes(query) ||
          lead.event_type.toLowerCase().includes(query) ||
          lead.city?.toLowerCase().includes(query)
      );
    }

    if (selectedEventTypes.length > 0) {
      filtered = filtered.filter((lead) =>
        selectedEventTypes.includes(lead.event_type)
      );
    }

    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((lead) =>
        selectedStatuses.includes(lead.status)
      );
    }

    if (selectedCities.length > 0) {
      filtered = filtered.filter(
        (lead) => lead.city && selectedCities.includes(lead.city)
      );
    }

    if (selectedPriorities.length > 0) {
      filtered = filtered.filter((lead) =>
        selectedPriorities.includes(lead.priority || 'medium')
      );
    }

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
  }, [leads, searchQuery, selectedEventTypes, selectedStatuses, selectedCities, selectedPriorities, sortOption, timeFilter]);

  const getStatusColor = (status: string) => {
    const statusInfo = STATUS_OPTIONS.find((s) => s.value === status);
    return statusInfo?.color || '#999';
  };

  const getStatusLabel = (status: string) => {
    const statusInfo = STATUS_OPTIONS.find((s) => s.value === status);
    return statusInfo?.label || status;
  };

  const getPriorityColor = (priority: string) => {
    const priorityInfo = PRIORITY_OPTIONS.find((p) => p.value === priority);
    return priorityInfo?.color || '#8E8E93';
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

  const exportLeads = () => {
    Alert.alert('Export', 'Export functionality coming soon');
  };

  const activeFilterCount =
    selectedEventTypes.length + selectedStatuses.length + selectedCities.length + selectedPriorities.length;

  const renderLead = ({ item }: { item: Lead }) => {
    const isSelected = selectedLeads.includes(item.id);
    const priorityColor = getPriorityColor(item.priority || 'medium');

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
        <View style={styles.cardMainContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderTop}>
              <Text style={styles.customerName}>{item.customer_name}</Text>
              <View style={styles.badges}>
                <View
                  style={[
                    styles.priorityIndicator,
                    { backgroundColor: priorityColor },
                  ]}
                />
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(item.status) + '20' },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: getStatusColor(item.status) }]}
                  >
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
            </View>
            {item.business_name && (
              <Text style={styles.businessName}>{item.business_name}</Text>
            )}
          </View>

          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Calendar size={18} color="#007AFF" strokeWidth={2} />
              <Text style={styles.infoText}>
                {item.event_type}
                {item.event_date && ` • ${formatEventDate(item.event_date)}`}
              </Text>
            </View>

            {item.city && (
              <View style={styles.infoRow}>
                <MapPin size={18} color="#34C759" strokeWidth={2} />
                <Text style={styles.infoText}>{item.city}</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Clock size={18} color="#999" strokeWidth={2} />
              <Text style={styles.timeText}>{getTimeAgo(item.created_at)}</Text>
            </View>
          </View>

          {!bulkSelectMode && (
            <View style={styles.cardFooter}>
              <View style={styles.viewDetailsButton}>
                <Text style={styles.viewDetailsText}>View Details</Text>
                <ChevronRight size={16} color="#007AFF" strokeWidth={2.5} />
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.secondary.main, Colors.secondary.light]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Leads</Text>
          {timeFilter !== 'all' && (
            <View style={styles.timeFilterBadge}>
              <Text style={styles.timeFilterBadgeText}>
                {timeFilter === 'month' ? 'This Month' : 'Today'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {bulkSelectMode ? (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => {
                setBulkSelectMode(false);
                setSelectedLeads([]);
              }}
            >
              <X size={20} color={Colors.neutral.white} strokeWidth={2} />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.headerButton} onPress={exportLeads}>
                <Download size={20} color={Colors.neutral.white} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowSortModal(true)}
              >
                <ArrowUpDown size={20} color={Colors.neutral.white} strokeWidth={2} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </LinearGradient>

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
        <Search size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search leads..."
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

      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          <FilterChip
            label={
              selectedEventTypes.length > 0
                ? `Event (${selectedEventTypes.length})`
                : 'Event Type'
            }
            active={selectedEventTypes.length > 0}
            onPress={() => setShowEventTypeModal(true)}
            showClear={selectedEventTypes.length > 0}
            onClear={() => setSelectedEventTypes([])}
          />
          <FilterChip
            label={
              selectedStatuses.length > 0
                ? `Status (${selectedStatuses.length})`
                : 'Status'
            }
            active={selectedStatuses.length > 0}
            onPress={() => setShowStatusModal(true)}
            showClear={selectedStatuses.length > 0}
            onClear={() => setSelectedStatuses([])}
          />
          {availableCities.length > 0 && (
            <FilterChip
              label={
                selectedCities.length > 0
                  ? `City (${selectedCities.length})`
                  : 'City'
              }
              active={selectedCities.length > 0}
              onPress={() => setShowCityModal(true)}
              showClear={selectedCities.length > 0}
              onClear={() => setSelectedCities([])}
            />
          )}
          <FilterChip
            label={
              selectedPriorities.length > 0
                ? `Priority (${selectedPriorities.length})`
                : 'Priority'
            }
            active={selectedPriorities.length > 0}
            onPress={() => setShowPriorityModal(true)}
            showClear={selectedPriorities.length > 0}
            onClear={() => setSelectedPriorities([])}
          />
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={() => {
                setSearchQuery('');
                setSelectedEventTypes([]);
                setSelectedStatuses([]);
                setSelectedCities([]);
                setSelectedPriorities([]);
              }}
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : filteredAndSortedLeads.length === 0 ? (
        <View style={styles.emptyState}>
          <Calendar size={64} color="#ddd" strokeWidth={1.5} />
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
                setSelectedPriorities([]);
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
        visible={showPriorityModal}
        onClose={() => setShowPriorityModal(false)}
        title="Priority"
        options={PRIORITY_OPTIONS.map((p) => p.value)}
        selectedOptions={selectedPriorities}
        onSelectOptions={setSelectedPriorities}
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

      {!bulkSelectMode && (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              bottom: Platform.OS === 'ios' ? 20 + insets.bottom + 60 : 80,
            },
          ]}
          onPress={() => router.push('/lead-form')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.primary.main, Colors.primary.light]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Plus size={28} color={Colors.neutral.white} strokeWidth={2.5} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingBottom: Spacing.lg,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.neutral.white,
  },
  timeFilterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.neutral.white,
  },
  timeFilterBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.neutral.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
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
  filterBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 12,
  },
  filterScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF3B30',
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
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    gap: 12,
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
  },
  cardMainContent: {
    flex: 1,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  businessName: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContent: {
    gap: 10,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  timeText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  cardFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
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
