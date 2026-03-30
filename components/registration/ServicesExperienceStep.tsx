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
  Platform,
} from 'react-native';
import { Check, ChevronRight, ChevronDown, X } from 'lucide-react-native';
import Dropdown from '../../components/Dropdown';
import { getCategories } from '../../lib/api/categories';

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
  icon?: string;
  parent_category_id: string | null;
  category_level: number;
  sort_order?: number;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
  path?: string;
}

const PRICING_MAPPING: Record<string, string[]> = {
  'Cat': ['Per plate', 'Per event', 'Per day', 'Per live counter'], // Caterers
  'Photo': ['Per day', 'Per event', 'Per hour'], // Photography / Videography
  'Video': ['Per day', 'Per event', 'Per hour'],
  'Decor': ['Per event', 'Per day', 'Per setup'], // Decoration / Mandap
  'Mandap': ['Per event', 'Per day', 'Per setup'],
  'Sound': ['Per event', 'Per day', 'Per hour', 'Per equipment set'], // Sound & Music
  'Music': ['Per event', 'Per day', 'Per hour', 'Per equipment set'],
  'Artist': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'], // Artists (DJs, Makeup, etc)
  'DJ': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Makeup': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Mehndi': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Dancer': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Anchor': ['Per event', 'Per day', 'Per hour', 'Per person', 'Per performance'],
  'Transport': ['Per trip', 'Per day', 'Per vehicle', 'Per hour'], // Transportation
  'Travel': ['Per trip', 'Per day', 'Per vehicle', 'Per hour'],
  'Housekeeping': ['Per day', 'Per shift', 'Per person', 'Per event'], // Housekeeping & Security
  'Security': ['Per day', 'Per shift', 'Per person', 'Per event'],
  'Venue': ['Per day', 'Per event', 'Per hour'], // Venues
  'Cake': ['Per kg', 'Per cake', 'Per design'], // Cakes
  'Ritual': ['Per ritual', 'Per event', 'Per day', 'Per consultation'], // Festival & Ritual Services
  'Pandit': ['Per ritual', 'Per event', 'Per day', 'Per consultation'],
  'Priest': ['Per ritual', 'Per event', 'Per day', 'Per consultation'],
  'Rental': ['Per item', 'Per day', 'Per event', 'Per hour'], // Rentals
  'Light': ['Per item', 'Per day', 'Per event', 'Per hour'], // Lighting (part of Rentals typically or Tech)
  'Event Management': ['Per event', 'Per day', 'Percentage of event cost'], // Event Management Companies
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

const ServicesExperienceStep = forwardRef<ServicesExperienceStepRef, ServicesExperienceStepProps>(({
  data,
  onUpdate,
  validationErrors = {},
  onFocus,
}, ref) => {
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [allBusinessCategories, setAllBusinessCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRootCategoryId, setSelectedRootCategoryId] = useState<string | null>(
    data.selectedRootCategoryId || null
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    data.selectedCategoryIds || []
  );
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isEventsExpanded, setIsEventsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isPrimaryModalOpen, setIsPrimaryModalOpen] = useState(false);
  const [primarySearchQuery, setPrimarySearchQuery] = useState('');

  const [coverPhotoUri, setCoverPhotoUri] = useState<string | undefined>(data.coverPhotoUri);

  // Sync cover photo with parent
  useEffect(() => {
    if (data.coverPhotoUri !== coverPhotoUri) {
      onUpdate({ 
        coverPhotoUri: coverPhotoUri,
        portfolioImages: coverPhotoUri ? [coverPhotoUri] : []
      });
    }
  }, [coverPhotoUri]);


  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  // Expose method to focus next empty mandatory field
  useImperativeHandle(ref, () => ({
    focusNextEmptyField: () => {
      if (!data.selectedRootCategoryId) {
        setIsPrimaryModalOpen(true);
      } else if (!data.selectedCategoryIds || data.selectedCategoryIds.length === 0) {
        setIsCategoryModalOpen(true);
      }
    },
  }));

  const isInitialMount = useRef(true);

  // Fetch categories on mount and re-fetch when business type changes
  useEffect(() => {
    fetchCategories(data.businessType);

    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      setSelectedRootCategoryId(null);
      setSelectedCategoryIds([]);
    }
  }, [data.businessType]);

  useEffect(() => {
    onUpdate({
      selectedRootCategoryId,
      selectedCategoryIds,
    });
  }, [selectedRootCategoryId, selectedCategoryIds]);

  const fetchCategories = async (businessType?: string) => {
    try {
      setLoading(true);
      const businessParams: any = { category_type: 'business', visible: true };
      if (businessType === 'rental') businessParams.business_model = 'rental';
      const { data: businessCats, error: businessError } = await getCategories(businessParams);
      if (businessError) {
        console.error('Error fetching business categories:', businessError);
      } else {
        setAllBusinessCategories((businessCats || []) as any[]);
      }
      const { data: eventCats, error: eventError } = await getCategories({ category_type: 'event', visible: true });
      if (eventError) {
        console.error('Error fetching event categories:', eventError);
      } else {
        setEventCategories((eventCats || []) as Category[]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildCategoryTree = (categories: Category[]): CategoryNode[] => {
    const categoryMap = new Map<string, CategoryNode>();
    const rootCategories: CategoryNode[] = [];

    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [],
      });
    });

    categories.forEach((cat) => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parent_category_id) {
        const parent = categoryMap.get(cat.parent_category_id);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        rootCategories.push(node);
      }
    });

    return rootCategories;
  };

  const getCategoryPath = (categoryId: string, categories: Category[]): string => {
    const categoryMap = new Map<string, Category>();
    categories.forEach((cat) => categoryMap.set(cat.id, cat));

    const path: string[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const cat = categoryMap.get(currentId);
      if (!cat) break;
      path.unshift(cat.name);
      currentId = cat.parent_category_id;
    }

    return path.join(' > ');
  };

  const getRootCategoryId = (categoryId: string, categories: Category[]): string => {
    const categoryMap = new Map<string, Category>();
    categories.forEach((cat) => categoryMap.set(cat.id, cat));
    
    let currentId: string | null = categoryId;
    let rootId = categoryId;
    
    while (currentId) {
      const cat = categoryMap.get(currentId);
      if (!cat) break;
      rootId = cat.id;
      currentId = cat.parent_category_id;
    }
    
    return rootId;
  };

  const filterCategories = (nodes: CategoryNode[], query: string): CategoryNode[] => {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();
    const filtered: CategoryNode[] = [];

    const matchesQuery = (node: CategoryNode): boolean => {
      return node.name.toLowerCase().includes(lowerQuery);
    };

    const filterNode = (node: CategoryNode): CategoryNode | null => {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n): n is CategoryNode => n !== null);

      if (matchesQuery(node) || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    };

    nodes.forEach((node) => {
      const filteredNode = filterNode(node);
      if (filteredNode) {
        filtered.push(filteredNode);
      }
    });

    return filtered;
  };

  const categoryTree = useMemo(() => {
    return buildCategoryTree(allBusinessCategories);
  }, [allBusinessCategories]);

  const subtreeForSelectedRoot = useMemo(() => {
    if (!selectedRootCategoryId) return null;
    const rootNode = categoryTree.find((n) => n.id === selectedRootCategoryId);
    return rootNode || null;
  }, [categoryTree, selectedRootCategoryId]);

  const filteredSubtree = useMemo(() => {
    if (!subtreeForSelectedRoot) return [];
    const filtered = filterCategories([subtreeForSelectedRoot], searchQuery);
    return filtered[0] ? filtered[0].children : [];
  }, [subtreeForSelectedRoot, searchQuery]);

  const rootCategories = useMemo(() => {
    return allBusinessCategories.filter(
      (cat) => cat.category_level === 1 || cat.parent_category_id === null
    );
  }, [allBusinessCategories]);

  const handleRootSelection = (categoryId: string) => {
    if (selectedRootCategoryId !== categoryId) {
      setSelectedRootCategoryId(categoryId);
      setSelectedCategoryIds([]);
    }
    setExpandedCategoryIds(new Set([categoryId]));
    setIsPrimaryModalOpen(false);
    setPrimarySearchQuery('');
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      let newIds = [...prev];
      const isSelected = prev.includes(categoryId);

      // Helper to find all descendants recursively
      const getDescendants = (parentId: string): string[] => {
        let descendants: string[] = [];
        const children = allBusinessCategories.filter(c => c.parent_category_id === parentId);
        if (children.length > 0) {
          children.forEach(child => {
            descendants.push(child.id);
            descendants = [...descendants, ...getDescendants(child.id)];
          });
        }
        return descendants;
      };

      const descendants = getDescendants(categoryId);

      if (isSelected) {
        // Deselecting: remove id and all descendants
        newIds = newIds.filter((id) => id !== categoryId && !descendants.includes(id));

        setExpandedCategoryIds((expanded) => {
          const next = new Set(expanded);
          next.delete(categoryId);
          return next;
        });
      } else {
        // Selecting: add id and all descendants
        if (!newIds.includes(categoryId)) newIds.push(categoryId);

        descendants.forEach(childId => {
          if (!newIds.includes(childId)) {
            newIds.push(childId);
          }
        });

        // Auto-expand the parent category to show selected children
        setExpandedCategoryIds((expanded) => {
          const newExpanded = new Set(expanded);
          newExpanded.add(categoryId);
          return newExpanded;
        });
      }
      return newIds;
    });
  };

  const toggleExpansion = (categoryId: string) => {
    setExpandedCategoryIds((expanded) => {
      const next = new Set(expanded);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Select All / Deselect All helpers for Specialization modal
  const getAllSubtreeIds = (): string[] => {
    if (!subtreeForSelectedRoot) return [];
    const getAllIds = (nodes: CategoryNode[]): string[] => {
      let ids: string[] = [];
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.children?.length > 0) ids = [...ids, ...getAllIds(node.children)];
      });
      return ids;
    };
    return getAllIds(subtreeForSelectedRoot.children || []);
  };

  const handleSelectAllSpecializations = () => {
    const allIds = getAllSubtreeIds();
    const allSelected = allIds.every((id) => selectedCategoryIds.includes(id));
    if (allSelected) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(allIds);
      setExpandedCategoryIds((prev) => new Set([...Array.from(prev), ...allIds]));
    }
  };

  const isAllSpecializationsSelected = (): boolean => {
    const allIds = getAllSubtreeIds();
    return allIds.length > 0 && allIds.every((id) => selectedCategoryIds.includes(id));
  };

  const renderSubCategoryTree = (nodes: CategoryNode[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isSelected = selectedCategoryIds.includes(node.id);
      const isExpanded = expandedCategoryIds.has(node.id);
      const hasChildren = node.children.length > 0;

      return (
        <View key={node.id} style={styles.categoryItem}>
          <TouchableOpacity
            style={[styles.categoryRow, { paddingLeft: level * 16 }]}
            onPress={() => toggleCategorySelection(node.id)}
            activeOpacity={0.7}
          >
            {hasChildren && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleExpansion(node.id);
                }}
              >
                <ChevronDown 
                  size={16} 
                  color="#666" 
                  style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>
            )}
            {!hasChildren && <View style={styles.expandButton} />}

            <View style={styles.checkbox}>
              {isSelected ? (
                <View style={styles.checkboxSelected}>
                  <Check size={14} color="#fff" strokeWidth={3} />
                </View>
              ) : (
                <View style={styles.checkboxUnselected} />
              )}
            </View>

            <Text
              style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
            >
              {node.name}
            </Text>
          </TouchableOpacity>

          {hasChildren && isExpanded && (
            <View style={styles.childrenContainer}>
              {renderSubCategoryTree(node.children, level + 1)}
            </View>
          )}
        </View>
      );
    });
  };

  const selectedCategoriesWithPaths = useMemo(() => {
    return selectedCategoryIds.map((id) => {
      const cat = allBusinessCategories.find(c => c.id === id);
      return {
        id,
        path: getCategoryPath(id, allBusinessCategories),
        name: cat?.name || ''
      };
    });
  }, [selectedCategoryIds, allBusinessCategories]);

  const filteredPrimaryResults = useMemo(() => {
    if (!primarySearchQuery.trim()) return rootCategories;
    const lowerQuery = primarySearchQuery.toLowerCase();
    
    const directMatches = rootCategories.filter(cat => 
      cat.name.toLowerCase().includes(lowerQuery)
    );
    
    const parentMatches: any[] = [];
    const subCategories = allBusinessCategories.filter(cat => cat.parent_category_id !== null);
    subCategories.forEach(cat => {
      if (cat.name.toLowerCase().includes(lowerQuery)) {
        let current: any = cat;
        while (current && current.parent_category_id) {
          const parent = allBusinessCategories.find(c => c.id === current.parent_category_id);
          current = parent;
        }
        if (current && !directMatches.find(dm => dm.id === current.id) && !parentMatches.find(pm => pm.id === current.id)) {
          parentMatches.push(current);
        }
      }
    });

    return [...directMatches, ...parentMatches];
  }, [rootCategories, primarySearchQuery, allBusinessCategories]);

  const filteredSpecializationResults = useMemo(() => {
    if (!primarySearchQuery.trim()) return [];
    
    const subCategories = allBusinessCategories.filter(cat => cat.parent_category_id !== null);
    
    return subCategories
      .filter(cat => cat.name.toLowerCase().includes(primarySearchQuery.toLowerCase()))
      .map(cat => ({
        ...cat,
        path: getCategoryPath(cat.id, allBusinessCategories),
        rootCategoryId: getRootCategoryId(cat.id, allBusinessCategories)
      }));
  }, [allBusinessCategories, primarySearchQuery]);

  const handleSpecializationSearchSelection = (catId: string, rootId: string) => {
    if (selectedRootCategoryId !== rootId) {
      setSelectedRootCategoryId(rootId);
      setSelectedCategoryIds([catId]);
    } else {
      setSelectedCategoryIds(prev => {
        if (prev.includes(catId)) {
          return prev.filter(id => id !== catId);
        } else {
          return [...prev, catId];
        }
      });
    }
  };

  const handleSelectAllFilteredSpecializations = () => {
    if (filteredSpecializationResults.length === 0) return;
    const targetRootId = filteredSpecializationResults[0].rootCategoryId;
    if (!targetRootId) return;

    const sameRootResults = filteredSpecializationResults.filter(r => r.rootCategoryId === targetRootId);
    const newIds = sameRootResults.map(r => r.id);

    if (selectedRootCategoryId !== targetRootId) {
      setSelectedRootCategoryId(targetRootId);
      setSelectedCategoryIds(newIds);
    } else {
      const allSelected = newIds.every(id => selectedCategoryIds.includes(id));
      if (allSelected) {
        setSelectedCategoryIds(prev => prev.filter(id => !newIds.includes(id)));
      } else {
        setSelectedCategoryIds(prev => Array.from(new Set([...prev, ...newIds])));
      }
    }
  };

  const handleClearAll = () => {
    setSelectedRootCategoryId(null);
    setSelectedCategoryIds([]);
    setPrimarySearchQuery('');
    onUpdate({ selectedRootCategoryId: null, selectedCategoryIds: [] });
    setIsPrimaryModalOpen(false);
  };

  const isAllFilteredSpecializationsSelected = () => {
    if (filteredSpecializationResults.length === 0) return false;
    const targetRootId = filteredSpecializationResults[0].rootCategoryId;
    const sameRootResults = filteredSpecializationResults.filter(r => r.rootCategoryId === targetRootId);
    return sameRootResults.every(r => selectedCategoryIds.includes(r.id));
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

  const filteredCities = OPERATING_CITIES.filter(city =>
    city.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  const handlePickCoverPhoto = async () => {
    const { uri, error } = await pickImage();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (uri) setCoverPhotoUri(uri);
  };

  const handleRemoveCoverPhoto = () => setCoverPhotoUri(undefined);

  const handleSelectAllEvents = () => {
    const allIds = eventCategories.filter(c => c.parent_category_id === null).map((c) => c.id);
    const currentEventIds = data.selectedEventIds || [];
    if (allIds.every(id => currentEventIds.includes(id))) {
      onUpdate({ selectedEventIds: [] });
    } else {
      onUpdate({ selectedEventIds: allIds });
    }
  };

  const handleClearAllEvents = () => {
    onUpdate({ selectedEventIds: [] });
    setEventSearchQuery('');
    setIsEventModalOpen(false);
  };

  const isAllEventsSelected = () => {
    const allIds = eventCategories.filter(c => c.parent_category_id === null).map((c) => c.id);
    const currentEventIds = data.selectedEventIds || [];
    return allIds.length > 0 && allIds.every(id => currentEventIds.includes(id));
  };

  const toggleEventType = (eventId: string) => {
    const currentIds = data.selectedEventIds || [];
    if (currentIds.includes(eventId)) {
      onUpdate({ selectedEventIds: currentIds.filter((id: string) => id !== eventId) });
    } else {
      onUpdate({ selectedEventIds: [...currentIds, eventId] });
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.label}>Business Type *</Text>
          <View style={styles.businessTypeGroup}>
            <TouchableOpacity
              style={styles.businessTypeButton}
              activeOpacity={0.7}
              onPress={() => onUpdate({ businessType: 'services' })}
            >
              <View
                style={[
                  styles.businessTypeRadioOuter,
                  data.businessType === 'services' && styles.businessTypeRadioOuterSelected,
                ]}
              >
                {data.businessType === 'services' && (
                  <View style={styles.businessTypeRadioInner} />
                )}
              </View>
              <Text style={styles.businessTypeRadioText}>Service based</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.businessTypeButton}
              activeOpacity={0.7}
              onPress={() => onUpdate({ businessType: 'rental' })}
            >
              <View
                style={[
                  styles.businessTypeRadioOuter,
                  data.businessType === 'rental' && styles.businessTypeRadioOuterSelected,
                ]}
              >
                {data.businessType === 'rental' && (
                  <View style={styles.businessTypeRadioInner} />
                )}
              </View>
              <Text style={styles.businessTypeRadioText}>Rental based</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Primary Category *</Text>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              validationErrors.selectedRootCategoryId && styles.dropdownTriggerError,
            ]}
            onPress={() => setIsPrimaryModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, !selectedRootCategoryId && styles.placeholder]}>
              {selectedRootCategoryId 
                ? rootCategories.find(c => c.id === selectedRootCategoryId)?.name || 'Select a category'
                : (loading ? 'Loading categories...' : 'Select a category')}
            </Text>
            <ChevronDown size={20} color="#666" />
          </TouchableOpacity>
          {validationErrors.selectedRootCategoryId && (
            <Text style={styles.errorText}>{validationErrors.selectedRootCategoryId}</Text>
          )}

          <Modal
            visible={isPrimaryModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsPrimaryModalOpen(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setIsPrimaryModalOpen(false)}
            >
              <Pressable
                style={styles.modalContent}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Category</Text>
                  <TouchableOpacity
                    onPress={handleClearAll}
                  >
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search Category or Specialization..."
                  placeholderTextColor="#999"
                  value={primarySearchQuery}
                  onChangeText={setPrimarySearchQuery}
                />

                <ScrollView style={styles.modalCategoryTree}>
                  <Text style={styles.sectionTitle}>Primary Categories</Text>
                  {filteredPrimaryResults.length === 0 ? (
                    <Text style={styles.emptyText}>No matching primary categories</Text>
                  ) : (
                    filteredPrimaryResults.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={styles.categoryListItemCompact}
                        onPress={() => {
                          handleRootSelection(cat.id);
                        }}
                      >
                        <Text style={[
                          styles.categoryListItemText,
                          selectedRootCategoryId === cat.id && styles.categoryListItemTextSelected
                        ]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}

                  {primarySearchQuery.trim().length > 0 && (
                    <>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Specializations</Text>
                        <TouchableOpacity onPress={handleSelectAllFilteredSpecializations}>
                          <Text style={styles.selectAllLinkText}>
                            {isAllFilteredSpecializationsSelected() ? 'Deselect All' : 'Select All'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {filteredSpecializationResults.length === 0 ? (
                        <Text style={styles.emptyText}>No matching specializations</Text>
                      ) : (
                        filteredSpecializationResults.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={styles.categoryListItemCompact}
                            onPress={() => handleSpecializationSearchSelection(cat.id, cat.rootCategoryId)}
                          >
                            <View style={styles.checkboxLeft}>
                              {selectedCategoryIds.includes(cat.id) ? (
                                <View style={styles.checkboxSelectedSmall}>
                                  <Check size={12} color="#fff" strokeWidth={3} />
                                </View>
                              ) : (
                                <View style={styles.checkboxUnselectedSmall} />
                              )}
                            </View>
                            <Text style={[
                              styles.categoryListItemText,
                              selectedCategoryIds.includes(cat.id) && styles.categoryListItemTextSelected
                            ]}>
                              {cat.path}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </>
                  )}
                </ScrollView>
                {primarySearchQuery.trim().length > 0 && (
                  <View style={styles.modalFooter}>
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={() => setIsPrimaryModalOpen(false)}
                    >
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Specialization *</Text>
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              !selectedRootCategoryId && styles.dropdownTriggerDisabled,
              validationErrors.selectedCategoryIds && styles.dropdownTriggerError,
            ]}
            onPress={() => selectedRootCategoryId && setIsCategoryModalOpen(true)}
            activeOpacity={0.7}
            disabled={!selectedRootCategoryId}
          >
            <Text
              style={[
                styles.dropdownText,
                !selectedRootCategoryId && styles.placeholder,
                selectedCategoryIds.length === 0 && selectedRootCategoryId && styles.placeholder,
              ]}
            >
              {!selectedRootCategoryId
                ? 'Select a category first'
                : selectedCategoryIds.length === 0
                  ? 'Select Specialization'
                  : `${selectedCategoryIds.length} Specialization selected`}
            </Text>
            <ChevronDown size={20} color="#666" />
          </TouchableOpacity>
          {validationErrors.selectedCategoryIds && (
            <Text style={styles.errorText}>{validationErrors.selectedCategoryIds}</Text>
          )}

          {selectedCategoriesWithPaths.length > 0 && (
            <View style={styles.selectedContainer}>
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedLabel}>
                  Selected ({selectedCategoriesWithPaths.length}):
                </Text>
                {selectedCategoriesWithPaths.length > 3 && (
                  <TouchableOpacity onPress={() => setIsCategoriesExpanded(!isCategoriesExpanded)}>
                    <ChevronDown
                      size={20}
                      color="#666"
                      style={{ transform: [{ rotate: isCategoriesExpanded ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>
                )}
              </View>
              {(isCategoriesExpanded ? selectedCategoriesWithPaths : selectedCategoriesWithPaths.slice(0, 3)).map((item) => (
                <View key={item.id} style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>{item.path}</Text>
                  <TouchableOpacity
                    onPress={() => toggleCategorySelection(item.id)}
                    style={styles.removeButton}
                  >
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Modal
            visible={isCategoryModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsCategoryModalOpen(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setIsCategoryModalOpen(false)}
            >
              <Pressable
                style={styles.modalContent}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Specialization</Text>
                  <TouchableOpacity
                    onPress={() => setIsCategoryModalOpen(false)}
                  >
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search Specialization..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                {/* Select All strip */}
                <TouchableOpacity
                  style={styles.selectAllRow}
                  onPress={handleSelectAllSpecializations}
                  activeOpacity={0.7}
                >
                  <View style={[styles.selectAllCheck, isAllSpecializationsSelected() && styles.selectAllCheckActive]}>
                    {isAllSpecializationsSelected() && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.selectAllText, isAllSpecializationsSelected() && styles.selectAllTextActive]}>
                    {isAllSpecializationsSelected() ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>

                <ScrollView style={styles.modalCategoryTree}>
                  {filteredSubtree.length === 0 ? (
                    <Text style={styles.emptyText}>No Specialization found</Text>
                  ) : (
                    renderSubCategoryTree(filteredSubtree)
                  )}
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => setIsCategoryModalOpen(false)}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Events you serve</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setIsEventModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, (data.selectedEventIds || []).length === 0 && styles.placeholder]}>
              {(data.selectedEventIds || []).length === 0 
                ? 'Select Events you serve' 
                : (data.selectedEventIds || []).length === 1
                  ? eventCategories.find(c => c.id === (data.selectedEventIds || [])[0])?.name || '1 event selected'
                  : `${(data.selectedEventIds || []).length} events selected`}
            </Text>
            <ChevronDown size={20} color="#666" />
          </TouchableOpacity>

          {/* Selected Events Display - chips with expandable arrow */}
          {(data.selectedEventIds || []).length > 0 && (
            <View style={styles.selectedContainer}>
              <View style={styles.selectedHeader}>
                <Text style={styles.selectedLabel}>
                  Selected Events ({(data.selectedEventIds || []).length}):
                </Text>
                {(data.selectedEventIds || []).length > 3 && (
                  <TouchableOpacity onPress={() => setIsEventsExpanded(!isEventsExpanded)}>
                    <ChevronDown
                      size={20}
                      color="#666"
                      style={{ transform: [{ rotate: isEventsExpanded ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>
                )}
              </View>
              {(isEventsExpanded ? (data.selectedEventIds || []) : (data.selectedEventIds || []).slice(0, 3)).map((id: string) => {
                const eventCategory = eventCategories.find((c) => c.id === id);
                if (!eventCategory) return null;
                return (
                  <View key={id} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>
                      {eventCategory.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => toggleEventType(id)}
                      style={styles.removeButton}
                    >
                      <X size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <Modal
            visible={isEventModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsEventModalOpen(false)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setIsEventModalOpen(false)}
            >
              <Pressable
                style={styles.modalContent}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Events</Text>
                  <TouchableOpacity
                    onPress={handleClearAllEvents}
                  >
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="Search Events..."
                  placeholderTextColor="#999"
                  value={eventSearchQuery}
                  onChangeText={setEventSearchQuery}
                />

                <TouchableOpacity 
                  style={styles.selectAllRow} 
                  onPress={handleSelectAllEvents}
                >
                  <View style={[styles.selectAllCheck, isAllEventsSelected() && styles.selectAllCheckActive]}>
                    {isAllEventsSelected() && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.selectAllText, isAllEventsSelected() && styles.selectAllTextActive]}>
                    {isAllEventsSelected() ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>

                <ScrollView style={styles.modalCategoryTree}>
                  {eventCategories
                    .filter(cat => 
                      cat.parent_category_id === null && 
                      cat.name.toLowerCase().includes(eventSearchQuery.toLowerCase())
                    )
                    .map(cat => (
                      <TouchableOpacity
                        key={cat.id}
                        style={styles.categoryRow}
                        onPress={() => toggleEventType(cat.id)}
                      >
                        <View style={styles.checkbox}>
                          {(data.selectedEventIds || []).includes(cat.id) ? (
                            <View style={styles.checkboxSelected}>
                              <Check size={14} color="#fff" strokeWidth={3} />
                            </View>
                          ) : (
                            <View style={styles.checkboxUnselected} />
                          )}
                        </View>
                        <Text style={styles.categoryName}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))
                  }
                </ScrollView>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.doneButton}
                    onPress={() => setIsEventModalOpen(false)}
                  >
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Operating Locations *</Text>
          <TouchableOpacity
            style={[styles.dropdownTrigger, validationErrors.operatingLocations && styles.dropdownTriggerError]}
            onPress={() => setIsCityModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownText, (!data.operatingLocations || data.operatingLocations.length === 0) && styles.placeholder]}>
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
            <View style={styles.selectedContainer}>
              {data.operatingLocations.map((city: string) => (
                <View key={city} style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>{city === '*' ? 'Pan India' : city}</Text>
                  <TouchableOpacity
                    onPress={() => toggleCitySelection(city === '*' ? 'Pan India' : city)}
                    style={styles.removeButton}
                  >
                    <X size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Modal
            visible={isCityModalOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setIsCityModalOpen(false)}
          >
            <View style={styles.bottomSheetOverlay}>
              <View style={styles.bottomSheetContent}>
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
                  <Search size={20} color="#999" />
                  <TextInput
                    style={styles.citySearchInput}
                    placeholder="Search cities..."
                    placeholderTextColor="#999"
                    value={citySearchQuery}
                    onChangeText={setCitySearchQuery}
                  />
                </View>

                <ScrollView style={styles.optionsList}>
                  {filteredCities.map((city) => {
                    const isSelected = city === 'Pan India'
                      ? data.operatingLocations?.includes('*')
                      : data.operatingLocations?.includes(city);
                    return (
                      <TouchableOpacity
                        key={city}
                        style={[styles.option, isSelected && styles.optionSelected]}
                        onPress={() => toggleCitySelection(city)}
                      >
                        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{city}</Text>
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
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Business Cover Image</Text>
          <Text style={styles.uploadHintTop}>First impression matters! Choose your best work.</Text>

          {coverPhotoUri ? (
            <View style={styles.imageGrid}>
              <View style={styles.imageContainer}>
                <RNImage source={{ uri: coverPhotoUri }} style={styles.thumbnailImage} />
                <View style={styles.coverBadge}>
                  <Star size={10} color="#fff" fill="#fff" />
                  <Text style={styles.coverBadgeText}>COVER</Text>
                </View>
                <TouchableOpacity style={styles.portfolioRemoveButton} onPress={handleRemoveCoverPhoto}>
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
      </ScrollView>
    </View>
  );
});

ServicesExperienceStep.displayName = 'ServicesExperienceStep';

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
  dropdownTriggerDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e8e8e8',
    opacity: 0.9,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  selectedContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f6fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6aa3ce',
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 0,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#6aa3ce',
    minHeight: 36,
  },
  selectedChipText: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    backgroundColor: '#ff3b30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '92%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
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
  },
  modalSearchInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    margin: 20,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCategoryTree: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  categoryItem: {
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  categoryName: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  categoryNameSelected: {
    fontWeight: '700',
    color: '#007AFF',
  },
  childrenContainer: {
    paddingLeft: 8,
  },
  categoryIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  checkboxStatus: {
    marginRight: 12,
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxUnselected: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  checkboxSelected: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  doneButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
  businessTypeRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#6aa3ce',
    alignItems: 'center',
    justifyContent: 'center',
  },
  businessTypeRadioOuterSelected: {
    borderColor: '#6aa3ce',
  },
  businessTypeRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6aa3ce',
  },
  businessTypeRadioText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginTop: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  categoryListItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  categoryListItemText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  categoryListItemTextSelected: {
    color: '#007AFF',
    fontWeight: '700',
  },
  categoryIconStyles: {
    fontSize: 18,
    marginRight: 8,
  },
  checkboxLeft: {
    marginRight: 10,
  },
  checkboxUnselectedSmall: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  checkboxSelectedSmall: {
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectAllLinkText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 10,
  },
  selectAllCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectAllCheckActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  selectAllText: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  selectAllTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  expandButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  citySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    margin: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  citySearchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    fontSize: 16,
  },
  optionsList: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#f0f7ff',
  },
  optionText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadHintTop: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  imageGrid: {
    flexDirection: 'row',
  },
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  portfolioRemoveButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 12,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
  },
  closeButton: {
    padding: 4,
  },
  cityModalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
});

export default ServicesExperienceStep;
