import React, { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Check, ChevronDown, X, Search, Plus, Star } from 'lucide-react-native';
import { Image as RNImage } from 'react-native';
import { pickImage } from '../../lib/businessApi';
import { supabaseCore } from '../../lib/supabase';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { dedupeIds, type CategoryRecord } from '../../lib/categoryPickerUtils';

interface ServicesExperienceStepProps {
  data: any;
  onUpdate: (data: any) => void;
  validationErrors?: Record<string, string>;
  onFocus?: () => void;
}

export interface ServicesExperienceStepRef {
  focusNextEmptyField: () => void;
}

interface Category {
  id: string;
  name: string;
  slug?: string | null;
  icon?: string | null;
  parent_category_id: string | null;
  category_level: number;
  category_type?: 'business' | 'event';
  business_model?: string | null;
  sort_order?: number | null;
}

interface FlatServiceItem {
  id: string;
  name: string;
  icon?: string | null;
  slug?: string | null;
  rootId: string;
  path: string;
}

const PRICING_MAPPING: Record<string, string[]> = {
  'Cat': ['Per plate', 'Per event', 'Per day', 'Per live counter'],
  'Photo': ['Per day', 'Per event', 'Per hour'],
  'Video': ['Per day', 'Per event', 'Per hour'],
  'Decor': ['Per event', 'Per day', 'Per setup'],
  'Mandap': ['Per event', 'Per day', 'Per setup'],
  'Sound': ['Per event', 'Per day', 'Per hour', 'Per equipment set'],
  'Music': ['Per event', 'Per day', 'Per hour', 'Per equipment set'],
  'Artist': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'DJ': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Makeup': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Mehndi': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Dancer': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Anchor': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Transport': ['Per trip', 'Per day', 'Per vehicle', 'Per hour'],
  'Travel': ['Per trip', 'Per day', 'Per vehicle', 'Per hour'],
  'Housekeeping': ['Per day', 'Per shift', 'Per person', 'Per event'],
  'Security': ['Per day', 'Per shift', 'Per person', 'Per event'],
  'Venue': ['Per day', 'Per event', 'Per hour'],
  'Cake': ['Per kg', 'Per cake', 'Per design'],
  'Ritual': ['Per ritual', 'Per event', 'Per day', 'Per consultation'],
  'Pandit': ['Per ritual', 'Per event', 'Per day', 'Per consultation'],
  'Priest': ['Per ritual', 'Per event', 'Per day', 'Per consultation'],
  'Rental': ['Per item', 'Per day', 'Per event', 'Per hour'],
  'Light': ['Per item', 'Per day', 'Per event', 'Per hour'],
  'Event Management': ['Per event', 'Per day', 'Percentage of event cost'],
  'Planner': ['Per event', 'Per day', 'Percentage of event cost'],
};

const DEFAULT_PRICING_UNITS = ['Per event', 'Per day', 'Per hour'];

const OPERATING_CITIES = [
  'Pan India',
  'Mumbai (Maharashtra)',
  'Delhi (Delhi)',
  'Bangalore (Karnataka)',
  'Hyderabad (Telangana)',
  'Chennai (Tamil Nadu)',
  'Kolkata (West Bengal)',
  'Pune (Maharashtra)',
  'Ahmedabad (Gujarat)',
  'Jaipur (Rajasthan)',
  'Surat (Gujarat)',
  'Lucknow (Uttar Pradesh)',
  'Kanpur (Uttar Pradesh)',
  'Nagpur (Maharashtra)',
  'Indore (Madhya Pradesh)',
  'Bhopal (Madhya Pradesh)',
  'Visakhapatnam (Andhra Pradesh)',
  'Patna (Bihar)',
  'Vadodara (Gujarat)',
  'Ghaziabad (Uttar Pradesh)',
  'Ludhiana (Punjab)',
  'Agra (Uttar Pradesh)',
  'Nashik (Maharashtra)',
  'Faridabad (Haryana)',
  'Meerut (Uttar Pradesh)',
  'Rajkot (Gujarat)',
  'Varanasi (Uttar Pradesh)',
  'Goa (Goa)',
  'Udaipur (Rajasthan)',
];

let categoriesCache: CategoryRecord[] | null = null;
let categoriesPromise: Promise<CategoryRecord[]> | null = null;

const fetchAllCategoriesCached = async (): Promise<CategoryRecord[]> => {
  if (categoriesCache) {
    return categoriesCache;
  }
  if (categoriesPromise) {
    return categoriesPromise;
  }

  categoriesPromise = (async () => {
    const { data, error } = await supabaseCore
      .from('categories')
      .select('id, name, slug, icon, parent_category_id, category_level, sort_order, category_type, business_model, visible')
      .eq('visible', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    categoriesCache = (data || []) as CategoryRecord[];
    return categoriesCache;
  })();

  try {
    return await categoriesPromise;
  } finally {
    categoriesPromise = null;
  }
};

const getRootId = (id: string, byId: Map<string, Category>): string => {
  let curr = byId.get(id);
  while (curr?.parent_category_id) {
    curr = byId.get(curr.parent_category_id);
  }
  return curr?.id ?? id;
};

const buildPath = (id: string, byId: Map<string, Category>): string => {
  const parts: string[] = [];
  let curr: Category | undefined = byId.get(id);
  while (curr) {
    parts.unshift(curr.name);
    curr = curr.parent_category_id ? byId.get(curr.parent_category_id) : undefined;
  }
  return parts.join(' > ');
};

const ServicesExperienceStep = forwardRef<ServicesExperienceStepRef, ServicesExperienceStepProps>(({
  data,
  onUpdate,
  validationErrors = {},
  onFocus,
}, ref) => {
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);

  const [selectedSpecializationIds, setSelectedSpecializationIds] = useState<string[]>(
    data.selectedCategoryIds || []
  );
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(
    data.selectedEventIds || []
  );

  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const debouncedServiceSearch = useDebouncedValue(serviceSearchQuery, 250);

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  const [coverPhotoUri, setCoverPhotoUri] = useState<string | undefined>(data.coverPhotoUri);

  const serviceSearchRef = useRef<TextInput>(null);
  const isInitialMount = useRef(true);

  useImperativeHandle(ref, () => ({
    focusNextEmptyField: () => {
      if (selectedSpecializationIds.length === 0) {
        serviceSearchRef.current?.focus();
      } else if (!data.operatingLocations || data.operatingLocations.length === 0) {
        setIsCityModalOpen(true);
      }
    },
  }));

  // ─── Derived data ──────────────────────────────────────────────────────────

  const allBusinessCategories = useMemo(
    () => allCategories.filter((c) => c.category_type === 'business'),
    [allCategories]
  );

  const eventRootCategories = useMemo(
    () =>
      allCategories
        .filter((c) => c.category_type === 'event' && c.parent_category_id === null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [allCategories]
  );

  const flatServiceItems = useMemo<FlatServiceItem[]>(() => {
    const byId = new Map<string, Category>();
    allBusinessCategories.forEach((c) => byId.set(c.id, c));

    const isRental = data.businessType === 'rental';

    return allBusinessCategories
      .filter((c) => {
        if (c.parent_category_id === null) return false;
        if (isRental) return c.business_model === 'rental';
        return c.business_model !== 'rental';
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        slug: c.slug,
        rootId: getRootId(c.id, byId),
        path: buildPath(c.id, byId),
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [allBusinessCategories, data.businessType]);

  const filteredServiceItems = useMemo<FlatServiceItem[]>(() => {
    const q = debouncedServiceSearch.trim().toLowerCase();
    if (!q) return flatServiceItems;
    const terms = q.split(/\s+/).filter(Boolean);
    return flatServiceItems.filter((item) => {
      const hay = `${item.name.toLowerCase()} ${item.path.toLowerCase()} ${(item.slug || '').toLowerCase()}`;
      return terms.every((t) => hay.includes(t));
    });
  }, [flatServiceItems, debouncedServiceSearch]);

  const derivedRootCategoryId = useMemo<string | null>(() => {
    if (selectedSpecializationIds.length === 0) return null;
    const first = flatServiceItems.find((item) => item.id === selectedSpecializationIds[0]);
    return first?.rootId ?? null;
  }, [selectedSpecializationIds, flatServiceItems]);

  const selectedSpecializationItems = useMemo<FlatServiceItem[]>(() => {
    return selectedSpecializationIds
      .map((id) => flatServiceItems.find((item) => item.id === id))
      .filter((item): item is FlatServiceItem => item !== undefined);
  }, [selectedSpecializationIds, flatServiceItems]);

  const selectedEventItems = useMemo(
    () => eventRootCategories.filter((c) => selectedEventIds.includes(c.id)),
    [eventRootCategories, selectedEventIds]
  );

  const pricingUnitOptions = useMemo(() => {
    if (selectedSpecializationItems.length === 0) return DEFAULT_PRICING_UNITS;
    const firstName = selectedSpecializationItems[0].name;
    const match = Object.keys(PRICING_MAPPING).find((key) =>
      firstName.toLowerCase().includes(key.toLowerCase())
    );
    if (match) return PRICING_MAPPING[match];

    if (derivedRootCategoryId) {
      const rootCat = allBusinessCategories.find((c) => c.id === derivedRootCategoryId);
      if (rootCat) {
        const rootMatch = Object.keys(PRICING_MAPPING).find((key) =>
          rootCat.name.toLowerCase().includes(key.toLowerCase())
        );
        if (rootMatch) return PRICING_MAPPING[rootMatch];
      }
    }

    return DEFAULT_PRICING_UNITS;
  }, [selectedSpecializationItems, allBusinessCategories, derivedRootCategoryId]);

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchCategories();
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      setSelectedSpecializationIds([]);
      setSelectedEventIds([]);
      onUpdate({ selectedRootCategoryId: null, selectedCategoryIds: [], selectedEventIds: [] });
    }
  }, [data.businessType]);

  useEffect(() => {
    onUpdate({
      selectedRootCategoryId: derivedRootCategoryId,
      selectedCategoryIds: selectedSpecializationIds,
      selectedEventIds: selectedEventIds,
    });
  }, [derivedRootCategoryId, selectedSpecializationIds, selectedEventIds]);

  useEffect(() => {
    if (data.coverPhotoUri !== coverPhotoUri) {
      onUpdate({
        coverPhotoUri,
        portfolioImages: coverPhotoUri ? [coverPhotoUri] : [],
      });
    }
  }, [coverPhotoUri]);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setCategoryLoadError(null);
      const categories = await fetchAllCategoriesCached();
      setAllCategories(categories as Category[]);
    } catch (error) {
      console.error('[categories] fetch error:', error);
      setCategoryLoadError('Unable to load categories. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const toggleSpecialization = (id: string) => {
    setSelectedSpecializationIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return dedupeIds([...prev, id]);
    });
  };

  const toggleEventRoot = (id: string) => {
    setSelectedEventIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      return dedupeIds([...prev, id]);
    });
  };

  const toggleCitySelection = (city: string) => {
    const currentLocations = data.operatingLocations || [];
    if (city === 'Pan India') {
      if (currentLocations.includes('*')) {
        onUpdate({ operatingLocations: [] });
      } else {
        onUpdate({ operatingLocations: ['*'] });
      }
      return;
    }
    let newLocations = currentLocations.filter((c: string) => c !== '*');
    if (newLocations.includes(city)) {
      onUpdate({ operatingLocations: newLocations.filter((c: string) => c !== city) });
    } else {
      onUpdate({ operatingLocations: [...newLocations, city] });
    }
  };

  const handlePickCoverPhoto = async () => {
    const { uri, error } = await pickImage();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (uri) setCoverPhotoUri(uri);
  };

  const filteredCities = OPERATING_CITIES.filter((city) =>
    city.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, styles.content]}>

      {/* Loading / error banners */}
      {loading && (
        <View style={styles.infoBanner}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.helperText}>Loading categories...</Text>
        </View>
      )}
      {categoryLoadError && (
        <View style={styles.infoBanner}>
          <Text style={styles.errorText}>{categoryLoadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchCategories}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Business Type */}
      <View style={styles.field}>
        <Text style={styles.label}>Business Type *</Text>
        <View style={styles.businessTypeGroup}>
          {(['services', 'rental'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={styles.businessTypeButton}
              activeOpacity={0.7}
              onPress={() => onUpdate({ businessType: type })}
            >
              <View
                style={[
                  styles.radioOuter,
                  data.businessType === type && styles.radioOuterSelected,
                ]}
              >
                {data.businessType === type && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioText}>
                {type === 'services' ? 'Service based' : 'Rental based'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Service Categories ─────────────────────────────────────────────── */}
      <View style={styles.field}>
        <Text style={[styles.label, validationErrors.selectedCategoryIds && styles.labelError]}>
          Specializations *
        </Text>

        {/* Search box */}
        <View style={styles.searchBox}>
          <Search size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            ref={serviceSearchRef}
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor="#999"
            value={serviceSearchQuery}
            onChangeText={setServiceSearchQuery}
            onFocus={onFocus}
            returnKeyType="search"
          />
          {serviceSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setServiceSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Results list */}
        {!loading && (
          <ScrollView
            style={styles.resultsList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {filteredServiceItems.length === 0 ? (
              <Text style={styles.emptyText}>
                {flatServiceItems.length === 0
                  ? 'No categories available'
                  : `No results for "${debouncedServiceSearch}"`}
              </Text>
            ) : (
              filteredServiceItems.map((item) => {
                const isSelected = selectedSpecializationIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.resultRow, isSelected && styles.resultRowSelected]}
                    onPress={() => toggleSpecialization(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultRowContent}>
                      {item.icon ? (
                        <Text style={styles.resultIcon}>{item.icon}</Text>
                      ) : null}
                      <Text
                        style={[styles.resultPath, isSelected && styles.resultPathSelected]}
                        numberOfLines={2}
                      >
                        {item.path}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}

        {validationErrors.selectedCategoryIds && (
          <Text style={styles.errorText}>{validationErrors.selectedCategoryIds}</Text>
        )}

        {/* Selected chips */}
        {selectedSpecializationItems.length > 0 && (
          <View style={styles.chipsContainer}>
            <Text style={styles.chipsLabel}>
              Selected ({selectedSpecializationItems.length}):
            </Text>
            <View style={styles.chips}>
              {selectedSpecializationItems.map((item) => (
                <View key={item.id} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleSpecialization(item.id)}
                    style={styles.chipRemove}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── Event Categories ───────────────────────────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>Event Categories</Text>

        {!loading && eventRootCategories.length === 0 ? (
          <Text style={styles.helperText}>No event categories available</Text>
        ) : (
          <View style={styles.eventList}>
            {eventRootCategories.map((cat) => {
              const isSelected = selectedEventIds.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.eventRow, isSelected && styles.eventRowSelected]}
                  onPress={() => toggleEventRoot(cat.id)}
                  activeOpacity={0.7}
                >
                  {cat.icon ? (
                    <Text style={styles.eventIcon}>{cat.icon}</Text>
                  ) : null}
                  <Text
                    style={[styles.eventName, isSelected && styles.eventNameSelected]}
                    numberOfLines={1}
                  >
                    {cat.name}
                  </Text>
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {selectedEventItems.length > 0 && (
          <View style={styles.chipsContainer}>
            <Text style={styles.chipsLabel}>
              Selected ({selectedEventItems.length}):
            </Text>
            <View style={styles.chips}>
              {selectedEventItems.map((cat) => (
                <View key={cat.id} style={styles.chip}>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleEventRoot(cat.id)}
                    style={styles.chipRemove}
                    hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                  >
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── Operating Locations ────────────────────────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>Operating Locations *</Text>
        <TouchableOpacity
          style={[
            styles.dropdownTrigger,
            validationErrors.operatingLocations && styles.dropdownTriggerError,
          ]}
          onPress={() => setIsCityModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.dropdownText,
              (!data.operatingLocations || data.operatingLocations.length === 0) && styles.placeholder,
            ]}
          >
            {data.operatingLocations && data.operatingLocations.length > 0
              ? `${data.operatingLocations.length} locations selected`
              : 'Select operating locations'}
          </Text>
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>

        {validationErrors.operatingLocations && (
          <Text style={styles.errorText}>{validationErrors.operatingLocations}</Text>
        )}

        {data.operatingLocations && data.operatingLocations.length > 0 && (
          <View style={styles.locationChips}>
            {data.operatingLocations.map((city: string) => (
              <View key={city} style={styles.locationChip}>
                <Text style={styles.locationChipText}>
                  {city === '*' ? 'Pan India' : city}
                </Text>
                <TouchableOpacity
                  onPress={() => toggleCitySelection(city === '*' ? 'Pan India' : city)}
                  style={styles.locationRemoveButton}
                >
                  <X size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* City selection modal */}
      <Modal
        visible={isCityModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCityModalOpen(false)}
      >
        <View style={styles.bottomSheetOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsCityModalOpen(false)}
          />
          <View style={[styles.bottomSheetContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Operating Locations</Text>
              <TouchableOpacity
                onPress={() => setIsCityModalOpen(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.citySearchContainer}>
              <Search size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.citySearchInput}
                placeholder="Search cities..."
                placeholderTextColor="#999"
                value={citySearchQuery}
                onFocus={onFocus}
                onChangeText={setCitySearchQuery}
              />
            </View>

            <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
              {filteredCities.map((city) => {
                const isSelected =
                  city === 'Pan India'
                    ? data.operatingLocations?.includes('*')
                    : data.operatingLocations?.includes(city);
                return (
                  <TouchableOpacity
                    key={city}
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => toggleCitySelection(city)}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                      {city}
                    </Text>
                    {isSelected && (
                      <View style={styles.checkmark}>
                        <Check size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.cityModalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => setIsCityModalOpen(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Business Cover Image ───────────────────────────────────────────── */}
      <View style={styles.field}>
        <Text style={styles.label}>Business Cover Image</Text>
        <Text style={styles.uploadHintTop}>
          First impression matters! Choose your best work.
        </Text>

        {coverPhotoUri ? (
          <View style={styles.imageGrid}>
            <View style={styles.imageContainer}>
              <RNImage source={{ uri: coverPhotoUri }} style={styles.thumbnailImage} />
              <View style={styles.coverBadge}>
                <Star size={10} color="#fff" fill="#fff" />
                <Text style={styles.coverBadgeText}>COVER</Text>
              </View>
              <TouchableOpacity
                style={styles.portfolioRemoveButton}
                onPress={() => setCoverPhotoUri(undefined)}
              >
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            onPress={handlePickCoverPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.uploadButtonText}>Uploading...</Text>
              </>
            ) : (
              <>
                <Plus size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>Add Cover Image</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

ServicesExperienceStep.displayName = 'ServicesExperienceStep';

export default ServicesExperienceStep;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 24,
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
  labelError: {
    color: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cce3ff',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginLeft: 'auto',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  businessTypeGroup: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 4,
  },
  businessTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#6aa3ce',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6aa3ce',
  },
  radioText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5ea',
    paddingHorizontal: 14,
    paddingVertical: 2,
    marginBottom: 8,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 15,
    color: '#1a1a1a',
  },
  resultsList: {
    maxHeight: 260,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 48,
  },
  resultRowSelected: {
    backgroundColor: '#f0f7ff',
  },
  resultRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 10,
  },
  resultIcon: {
    fontSize: 16,
  },
  resultPath: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  resultPathSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d0d0d0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  chipsContainer: {
    marginTop: 10,
  },
  chipsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
    maxWidth: '100%',
  },
  chipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  chipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventList: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 48,
    gap: 10,
  },
  eventRowSelected: {
    backgroundColor: '#f0f7ff',
  },
  eventIcon: {
    fontSize: 18,
  },
  eventName: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  eventNameSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  placeholder: {
    color: '#999',
  },
  dropdownTriggerError: {
    borderColor: '#FF3B30',
  },
  locationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationChipText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 6,
  },
  locationRemoveButton: {
    padding: 2,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  citySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7f9',
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e1e5ea',
  },
  citySearchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 10,
  },
  optionsList: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#f0f7ff',
  },
  optionText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 2,
  },
  cityModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
  portfolioRemoveButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#34C759',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 5,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
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
});
