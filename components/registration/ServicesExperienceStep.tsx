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
import { Check, ChevronRight, ChevronDown, X, Search } from 'lucide-react-native';
import Dropdown from '../../components/Dropdown';
import { supabaseCore } from '../../lib/supabase';

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

const EXPERIENCE_OPTIONS = [
  'Less than 1 year',
  '1-3 years',
  '3-5 years',
  '5-10 years',
  'More than 10 years',
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isRootDropdownOpen, setIsRootDropdownOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isExperienceDropdownOpen, setIsExperienceDropdownOpen] = useState(false);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  const [isPricingUnitDropdownOpen, setIsPricingUnitDropdownOpen] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isEventsExpanded, setIsEventsExpanded] = useState(false);

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');



  // Expose method to focus next empty mandatory field
  useImperativeHandle(ref, () => ({
    focusNextEmptyField: () => {
      if (!data.selectedRootCategoryId) {
        setIsRootDropdownOpen(true);
      } else if (!data.selectedCategoryIds || data.selectedCategoryIds.length === 0) {
        setIsCategoryModalOpen(true);
      } else if (!data.selectedEventIds || data.selectedEventIds.length === 0) {
        setIsEventModalOpen(true);
      } else if (!data.operatingLocations || data.operatingLocations.length === 0) {
        setIsCityModalOpen(true);
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
      // Reset selected categories only when business type actually changes (not on initial mount)
      setSelectedRootCategoryId(null);
      setSelectedCategoryIds([]);
      onUpdate({
        selectedRootCategoryId: null,
        selectedCategoryIds: [],
      });
    }
  }, [data.businessType]);

  useEffect(() => {
    // Update parent component when selections change
    onUpdate({
      selectedRootCategoryId,
      selectedCategoryIds,
    });
  }, [selectedRootCategoryId, selectedCategoryIds]);

  // Auto-detect root category if we have selected sub-categories but no root
  useEffect(() => {
    if (allBusinessCategories.length > 0 && selectedCategoryIds.length > 0 && !selectedRootCategoryId) {
      const firstSelectedCat = allBusinessCategories.find(c => c.id === selectedCategoryIds[0]);
      if (firstSelectedCat) {
        let current = firstSelectedCat;
        while (current.parent_category_id) {
          const parent = allBusinessCategories.find(c => c.id === current.parent_category_id);
          if (!parent) break;
          current = parent;
        }
        if (current && current.id !== selectedRootCategoryId) {
          setSelectedRootCategoryId(current.id);
          // Don't modify expanded here to avoid infinite loops, but expanding root is usually desired
          setExpandedCategoryIds(prev => new Set([...prev, current.id]));
        }
      }
    }
  }, [allBusinessCategories, selectedCategoryIds, selectedRootCategoryId]);

  const fetchCategories = async (businessType?: string) => {
    try {
      setLoading(true);

      // Fetch all business categories with hierarchy info
      let businessQuery = supabaseCore
        .from('categories')
        .select('id, name, icon, parent_category_id, category_level, sort_order')
        .eq('category_type', 'business')
        .eq('visible', true);

      // If rental is selected, filter by business_model = 'rental'
      if (businessType === 'rental') {
        businessQuery = businessQuery.eq('business_model', 'rental');
      } else {
        // If service type is selected, filter by business_model != 'rental'
        businessQuery = businessQuery.neq('business_model', 'rental');
      }

      const { data: businessCats, error: businessError } = await businessQuery
        .order('sort_order', { ascending: true });

      if (businessError) {
        console.error('Error fetching business categories:', businessError);
      } else {
        setAllBusinessCategories(businessCats || []);
      }

      // Fetch all event categories with hierarchy info
      const { data: eventCats, error: eventError } = await supabaseCore
        .from('categories')
        .select('id, name, icon, parent_category_id, category_level, sort_order')
        .eq('category_type', 'event')
        .eq('visible', true)
        .order('sort_order', { ascending: true });

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

  // Build hierarchical tree structure
  const buildCategoryTree = (categories: Category[]): CategoryNode[] => {
    const categoryMap = new Map<string, CategoryNode>();
    const rootCategories: CategoryNode[] = [];

    // First pass: create all nodes
    categories.forEach((cat) => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [],
      });
    });

    // Second pass: build tree structure
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

    // Sort children by sort_order
    const sortChildren = (nodes: CategoryNode[]) => {
      nodes.forEach((node) => {
        node.children.sort((a, b) => {
          const aOrder = allBusinessCategories.find((c) => c.id === a.id)?.sort_order ?? 0;
          const bOrder = allBusinessCategories.find((c) => c.id === b.id)?.sort_order ?? 0;
          return aOrder - bOrder;
        });
        sortChildren(node.children);
      });
    };

    sortChildren(rootCategories);
    return rootCategories;
  };

  // Get full path for a category (excluding root/parent category)
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

    // Remove the root category (first element) if there are multiple levels
    if (path.length > 1) {
      path.shift(); // Remove the first element (root category)
    }

    return path.join(' > ');
  };

  // Filter categories based on search query
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

  // Build category tree
  const categoryTree = useMemo(() => {
    return buildCategoryTree(allBusinessCategories);
  }, [allBusinessCategories]);

  // Subtree for selected root only (for sub-categories modal)
  const subtreeForSelectedRoot = useMemo(() => {
    if (!selectedRootCategoryId) return null;
    const rootNode = categoryTree.find((n) => n.id === selectedRootCategoryId);
    return rootNode || null;
  }, [categoryTree, selectedRootCategoryId]);

  // Filter subtree by search (for modal)
  const filteredSubtree = useMemo(() => {
    if (!subtreeForSelectedRoot) return [];
    const filtered = filterCategories([subtreeForSelectedRoot], searchQuery);
    return filtered[0] ? filtered[0].children : [];
  }, [subtreeForSelectedRoot, searchQuery]);

  // Get root categories (level 1 or no parent)
  const rootCategories = useMemo(() => {
    return allBusinessCategories.filter(
      (cat) => cat.category_level === 1 || cat.parent_category_id === null
    );
  }, [allBusinessCategories]);

  // Handle root category selection (from dropdown)
  const handleRootSelection = (categoryId: string) => {
    setSelectedRootCategoryId(categoryId);
    setSelectedCategoryIds([]);
    setExpandedCategoryIds(new Set([categoryId]));
  };

  // Toggle only child category selection (used in sub-categories modal)
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

        const category = allBusinessCategories.find((c) => c.id === categoryId);
        if (category) {
          const parentChain: string[] = [];
          let currentParentId: string | null = category.parent_category_id;
          while (currentParentId) {
            parentChain.push(currentParentId);
            const parent = allBusinessCategories.find((c) => c.id === currentParentId);
            currentParentId = parent?.parent_category_id || null;
          }
          if (parentChain.length > 0) {
            setExpandedCategoryIds((expanded) => new Set([...expanded, ...parentChain]));
          }
        }
      }
      return newIds;
    });
  };

  // Toggle category expansion
  const toggleExpansion = (categoryId: string) => {
    setExpandedCategoryIds((expanded) => {
      const newExpanded = new Set(expanded);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return newExpanded;
    });
  };

  // Auto-expand selected categories with children and their parent chains
  useEffect(() => {
    setExpandedCategoryIds((currentExpanded) => {
      const newExpanded = new Set(currentExpanded);
      let changed = false;

      // Include root category in selectedCategoryIds if it's selected
      const allSelectedIds = [...selectedCategoryIds];
      if (selectedRootCategoryId && !allSelectedIds.includes(selectedRootCategoryId)) {
        allSelectedIds.push(selectedRootCategoryId);
      }

      allSelectedIds.forEach((categoryId) => {
        // Expand the category itself if it has children
        const hasChildren = allBusinessCategories.some(
          (c) => c.parent_category_id === categoryId
        );
        if (hasChildren && !newExpanded.has(categoryId)) {
          newExpanded.add(categoryId);
          changed = true;
        }

        // Expand parent chain so selected child categories are visible
        const category = allBusinessCategories.find((c) => c.id === categoryId);
        if (category) {
          let currentParentId: string | null = category.parent_category_id;
          while (currentParentId) {
            if (!newExpanded.has(currentParentId)) {
              newExpanded.add(currentParentId);
              changed = true;
            }
            const parent = allBusinessCategories.find((c) => c.id === currentParentId);
            currentParentId = parent?.parent_category_id || null;
          }
        }
      });

      return changed ? newExpanded : currentExpanded;
    });
  }, [selectedCategoryIds, selectedRootCategoryId, allBusinessCategories]);

  // Sync selection to parent
  useEffect(() => {
    onUpdate({
      selectedRootCategoryId,
      selectedCategoryIds
    });
  }, [selectedRootCategoryId, selectedCategoryIds]);

  // Render sub-category tree (checkboxes only, for modal under selected root)
  const renderSubCategoryTree = (nodes: CategoryNode[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isSelected = selectedCategoryIds.includes(node.id);
      const isExpanded = expandedCategoryIds.has(node.id);
      const hasChildren = node.children.length > 0;

      return (
        <View key={node.id} style={styles.categoryItem}>
          <TouchableOpacity
            style={[styles.categoryRow, { paddingLeft: level * 20 + 12 }]}
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
                {isExpanded ? (
                  <ChevronDown size={16} color="#666" />
                ) : (
                  <ChevronRight size={16} color="#666" />
                )}
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

            {node.icon && <Text style={styles.categoryIcon}>{node.icon}</Text>}
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

  // Get selected categories with full paths (only leaf-level selected items)
  const selectedCategoriesWithPaths = useMemo(() => {
    // Only show selected categories that:
    // 1. Have a parent (not root)
    // 2. Don't have any selected children (leaf-level in selection)
    const leafIds = selectedCategoryIds.filter(id => {
      const cat = allBusinessCategories.find(c => c.id === id);
      if (!cat || cat.parent_category_id === null) return false;
      // Check if any of its children are also selected
      const hasSelectedChild = allBusinessCategories.some(
        c => c.parent_category_id === id && selectedCategoryIds.includes(c.id)
      );
      return !hasSelectedChild;
    });

    return leafIds.map((id) => {
      const cat = allBusinessCategories.find(c => c.id === id);
      return {
        id,
        path: getCategoryPath(id, allBusinessCategories),
        name: cat?.name || ''
      };
    });
  }, [selectedCategoryIds, allBusinessCategories]);

  const handleChange = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  const toggleEventType = (eventId: string) => {
    const currentIds = data.selectedEventIds || [];
    const isSelected = currentIds.includes(eventId);
    let newIds = [...currentIds];

    if (isSelected) {
      // Deselecting
      newIds = newIds.filter((id) => id !== eventId);

      // Also deselect all children if this is a parent category
      const childCategories = eventCategories.filter(c => c.parent_category_id === eventId);
      if (childCategories.length > 0) {
        const childIds = childCategories.map(c => c.id);
        newIds = newIds.filter(id => !childIds.includes(id));
      }

      // Collapse when deselecting
      setExpandedEventIds((expanded) => {
        const newExpanded = new Set(expanded);
        if (newExpanded.has(eventId)) {
          newExpanded.delete(eventId);
        }
        return newExpanded;
      });
    } else {
      // Selecting
      newIds.push(eventId);

      // Also select all children if this is a parent category
      const childCategories = eventCategories.filter(c => c.parent_category_id === eventId);
      if (childCategories.length > 0) {
        childCategories.forEach(child => {
          if (!newIds.includes(child.id)) {
            newIds.push(child.id);
          }
        });

        // Auto-expand the parent category to show selected children
        setExpandedEventIds((expanded) => {
          const newExpanded = new Set(expanded);
          newExpanded.add(eventId);
          return newExpanded;
        });
      }
    }

    handleChange('selectedEventIds', newIds);
  };

  // Toggle event expansion
  const toggleEventExpansion = (eventId: string) => {
    setExpandedEventIds((expanded) => {
      const newExpanded = new Set(expanded);
      if (newExpanded.has(eventId)) {
        newExpanded.delete(eventId);
      } else {
        newExpanded.add(eventId);
      }
      return newExpanded;
    });
  };

  // Render event category tree recursively
  const renderEventCategoryTree = (nodes: CategoryNode[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isSelected = (data.selectedEventIds || []).includes(node.id);
      const isExpanded = expandedEventIds.has(node.id);
      const hasChildren = node.children.length > 0;

      return (
        <View key={node.id} style={styles.categoryItem}>
          <TouchableOpacity
            style={[styles.categoryRow, { paddingLeft: level * 20 + 12 }]}
            onPress={() => toggleEventType(node.id)}
            activeOpacity={0.7}
          >
            {hasChildren && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleEventExpansion(node.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown size={16} color="#666" />
                ) : (
                  <ChevronRight size={16} color="#666" />
                )}
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
            {node.icon && (
              <Text style={styles.categoryIcon}>{node.icon}</Text>
            )}
            <Text
              style={[
                styles.eventOptionText,
                isSelected && styles.eventOptionTextSelected,
              ]}
            >
              {node.name}
            </Text>
          </TouchableOpacity>
          {hasChildren && isExpanded && (
            <View style={styles.childrenContainer}>
              {renderEventCategoryTree(node.children, level + 1)}
            </View>
          )}
        </View>
      );
    });
  };

  // Auto-expand selected event categories with children and their parent chains
  useEffect(() => {
    setExpandedEventIds((currentExpanded) => {
      const newExpanded = new Set(currentExpanded);
      let changed = false;

      (data.selectedEventIds || []).forEach((eventId: string) => {
        // Expand the category itself if it has children
        const hasChildren = eventCategories.some(
          (c) => c.parent_category_id === eventId
        );
        if (hasChildren && !newExpanded.has(eventId)) {
          newExpanded.add(eventId);
          changed = true;
        }

        // Expand parent chain so selected child categories are visible
        const category = eventCategories.find((c) => c.id === eventId);
        if (category) {
          let currentParentId: string | null = category.parent_category_id;
          while (currentParentId) {
            if (!newExpanded.has(currentParentId)) {
              newExpanded.add(currentParentId);
              changed = true;
            }
            const parent = eventCategories.find((c) => c.id === currentParentId);
            currentParentId = parent?.parent_category_id || null;
          }
        }
      });

      return changed ? newExpanded : currentExpanded;
    });
  }, [data.selectedEventIds, eventCategories]);

  // Get event category path (excluding root/parent category)
  const getEventPath = (eventId: string, events: Category[]): string => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return '';

    const path: string[] = [event.name];
    let currentId: string | null = event.parent_category_id;

    while (currentId) {
      const parent = events.find((e) => e.id === currentId);
      if (parent) {
        path.unshift(parent.name);
        currentId = parent.parent_category_id;
      } else {
        currentId = null;
      }
    }

    // Remove the root category (first element) if there are multiple levels
    if (path.length > 1) {
      path.shift(); // Remove the first element (root category)
    }

    return path.join(' > ');
  };

  // Get selected events with paths for display
  const selectedEventsWithPaths = useMemo(() => {
    // Only show child categories
    const childIds = (data.selectedEventIds || []).filter((id: string) => {
      const cat = eventCategories.find(c => c.id === id);
      return cat && cat.parent_category_id !== null;
    });

    return childIds.map((id: string) => ({
      id,
      path: getEventPath(id, eventCategories),
    }));
  }, [data.selectedEventIds, eventCategories]);

  // Get selected event names for display (for dropdown text)
  const selectedEventNames = useMemo(() => {
    const selectedIds = data.selectedEventIds || [];
    return eventCategories
      .filter((cat) => selectedIds.includes(cat.id))
      .map((cat) => cat.name);
  }, [data.selectedEventIds, eventCategories]);

  // Build event category tree
  const eventCategoryTree = useMemo(() => {
    return buildCategoryTree(eventCategories);
  }, [eventCategories]);

  // Filter event tree based on search
  const filteredEventTree = useMemo(() => {
    return filterCategories(eventCategoryTree, eventSearchQuery);
  }, [eventCategoryTree, eventSearchQuery]);

  // Get display text for event dropdown
  const getEventDropdownDisplayText = (): string => {
    if (loading) {
      return 'Loading Events you serve...';
    }
    if (selectedEventsWithPaths.length === 0) {
      return 'Select Events you serve';
    }
    if (selectedEventsWithPaths.length === 1) {
      return selectedEventsWithPaths[0].path;
    }
    return `${selectedEventsWithPaths.length} events selected`;
  };

  const toggleCitySelection = (city: string) => {
    const currentLocations = data.operatingLocations || [];

    if (city === 'Pan India') {
      if (currentLocations.includes('*')) {
        handleChange('operatingLocations', []);
      } else {
        // If Pan India selected, clear all other cities and just set '*'
        handleChange('operatingLocations', ['*']);
      }
      return;
    }

    // If a normal city is selected while Pan India (*) is present, remove '*'
    let newLocations = currentLocations.filter((c: string) => c !== '*');

    if (newLocations.includes(city)) {
      handleChange('operatingLocations', newLocations.filter((c: string) => c !== city));
    } else {
      handleChange('operatingLocations', [...newLocations, city]);
    }
  };

  const filteredCities = OPERATING_CITIES.filter(city =>
    city.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  // Determine applicable pricing units based on selected service category
  const pricingUnitOptions = useMemo(() => {
    if (selectedCategoriesWithPaths.length === 0) return DEFAULT_PRICING_UNITS;

    // Use the first selected category to determine units
    // In a real app we might want to be smarter if multiple different types are selected
    // but usually a business has a primary domain.
    const firstCatName = selectedCategoriesWithPaths[0].name || '';

    // Find matching key in PRICING_MAPPING
    const match = Object.keys(PRICING_MAPPING).find(key =>
      firstCatName.toLowerCase().includes(key.toLowerCase())
    );

    if (match) {
      return PRICING_MAPPING[match];
    }

    // Secondary check: look at root category if available
    if (selectedRootCategoryId) {
      const rootCat = allBusinessCategories.find(c => c.id === selectedRootCategoryId);
      if (rootCat) {
        const rootMatch = Object.keys(PRICING_MAPPING).find(key =>
          rootCat.name.toLowerCase().includes(key.toLowerCase())
        );
        if (rootMatch) {
          return PRICING_MAPPING[rootMatch];
        }
      }
    }

    return DEFAULT_PRICING_UNITS;
  }, [selectedCategoriesWithPaths, allBusinessCategories, selectedRootCategoryId]);



  // Loading indicator overlay removed to prevent UI jumping. Components will display inline loading states.

  const handleCategoryDone = () => {
    const hasSubCategory = selectedCategoryIds.some(id => {
      const cat = allBusinessCategories.find(c => c.id === id);
      return cat && cat.parent_category_id !== null;
    });

    if (!hasSubCategory) {
      Alert.alert('Validation Error', 'Please select at least one sub-category');
      return;
    }
    setIsCategoryModalOpen(false);
  };

  const handleEventDone = () => {
    const hasSubEventType = (data.selectedEventIds || []).some((id: string) => {
      const cat = eventCategories.find(c => c.id === id);
      return cat && cat.parent_category_id !== null;
    });

    if (!hasSubEventType) {
      Alert.alert('Validation Error', 'Please select at least one sub-category for Events you serve');
      return;
    }
    setIsEventModalOpen(false);
  };

  // Select All / Deselect All helpers for Services modal
  const getAllSubtreeIds = (): string[] => {
    if (!subtreeForSelectedRoot) return [];
    const getAllIds = (nodes: any[]): string[] => {
      let ids: string[] = [];
      nodes.forEach((node) => {
        ids.push(node.id);
        if (node.children?.length > 0) ids = [...ids, ...getAllIds(node.children)];
      });
      return ids;
    };
    return getAllIds(subtreeForSelectedRoot.children || []);
  };

  const handleSelectAllServices = () => {
    const allIds = getAllSubtreeIds();
    const allSelected = allIds.every((id) => selectedCategoryIds.includes(id));
    if (allSelected) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(allIds);
      // Auto-expand all selected categories
      setExpandedCategoryIds((prev) => new Set([...prev, ...allIds]));
    }
  };

  const isAllServicesSelected = (): boolean => {
    const allIds = getAllSubtreeIds();
    return allIds.length > 0 && allIds.every((id) => selectedCategoryIds.includes(id));
  };

  // Select All / Deselect All helpers for Events modal
  const getAllEventIds = (): string[] => {
    return eventCategories.map((c) => c.id);
  };

  const handleSelectAllEvents = () => {
    const allIds = getAllEventIds();
    const currentEventIds = data.selectedEventIds || [];
    const allSelected = allIds.every((id) => currentEventIds.includes(id));
    if (allSelected) {
      handleChange('selectedEventIds', []);
    } else {
      handleChange('selectedEventIds', allIds);
      // Auto-expand all event categories
      setExpandedEventIds((prev) => new Set([...prev, ...allIds]));
    }
  };

  const isAllEventsSelected = (): boolean => {
    const allIds = getAllEventIds();
    const currentEventIds = data.selectedEventIds || [];
    return allIds.length > 0 && allIds.every((id) => currentEventIds.includes(id));
  };

  const rootDropdownOptions = rootCategories.map((c) => ({
    label: c.icon ? `${c.icon} ${c.name}` : c.name,
    value: c.id,
  }));

  return (
    <View style={[styles.container, styles.content]}>
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
        <Text style={[styles.label, (validationErrors.selectedRootCategoryId || validationErrors.selectedCategoryIds) && styles.labelError]}>Primary Category *</Text>
        <Dropdown
          options={rootDropdownOptions}
          value={selectedRootCategoryId || ''}
          placeholder={loading ? 'Loading categories...' : 'Select a category'}
          onChange={(value: string) => handleRootSelection(value)}
          open={isRootDropdownOpen}
          onOpenChange={setIsRootDropdownOpen}
          error={validationErrors.selectedRootCategoryId || validationErrors.selectedCategoryIds}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, validationErrors.selectedCategoryIds && styles.labelError]}>Specialization *</Text>
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
              selectedCategoriesWithPaths.length === 0 && selectedRootCategoryId && styles.placeholder,
            ]}
          >
            {!selectedRootCategoryId
              ? 'Select a category first'
              : loading
                ? 'Loading services...'
                : selectedCategoriesWithPaths.length === 0
                  ? 'Select Specialization'
                  : selectedCategoriesWithPaths.length === 1
                    ? selectedCategoriesWithPaths[0].path
                    : `${selectedCategoriesWithPaths.length} Specialization selected`}
          </Text>
          <ChevronDown size={20} color={selectedRootCategoryId ? '#666' : '#ccc'} />
        </TouchableOpacity>

        {/* Selected Services Offered*/}
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
            {(isCategoriesExpanded ? selectedCategoriesWithPaths : selectedCategoriesWithPaths.slice(0, 3)).map((item: { id: string; path: string }) => (
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
        {validationErrors.selectedCategoryIds && (
          <Text style={styles.errorText}>{validationErrors.selectedCategoryIds}</Text>
        )}

        {/* Sub-categories modal (tree for selected root only) */}
        <Modal
          visible={isCategoryModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsCategoryModalOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setSelectedCategoryIds([]);
              setIsCategoryModalOpen(false);
            }}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {subtreeForSelectedRoot
                    ? `Specialization under ${subtreeForSelectedRoot.name}`
                    : 'Select Specialization'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategoryIds([]);
                    setIsCategoryModalOpen(false);
                  }}
                  style={styles.closeButton}
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
                onPress={handleSelectAllServices}
                activeOpacity={0.7}
              >
                <View style={[styles.selectAllCheck, isAllServicesSelected() && styles.selectAllCheckActive]}>
                  {isAllServicesSelected() && <Check size={12} color="#fff" strokeWidth={3} />}
                </View>
                <Text style={[styles.selectAllText, isAllServicesSelected() && styles.selectAllTextActive]}>
                  {isAllServicesSelected() ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>

              <ScrollView
                style={styles.modalCategoryTree}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {filteredSubtree.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {subtreeForSelectedRoot?.children?.length === 0
                      ? 'No Specialization'
                      : 'No matching Specialization'}
                  </Text>
                ) : (
                  renderSubCategoryTree(filteredSubtree)
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleCategoryDone}
                >
                  <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, validationErrors.selectedEventIds && styles.labelError]}>Events you serve *</Text>

        {/* Event Dropdown Trigger */}
        <TouchableOpacity
          style={[
            styles.dropdownTrigger,
            validationErrors.selectedEventIds && styles.dropdownTriggerError
          ]}
          onPress={() => setIsEventModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownText, selectedEventNames.length === 0 && styles.placeholder]}>
            {getEventDropdownDisplayText()}
          </Text>
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>
        {validationErrors.selectedEventIds && (
          <Text style={styles.errorText}>{validationErrors.selectedEventIds}</Text>
        )}

        {/* Selected Events Display */}
        {selectedEventsWithPaths.length > 0 && (
          <View style={styles.selectedContainer}>
            <View style={styles.selectedHeader}>
              <Text style={[styles.selectedLabel, { marginBottom: 0 }]}>
                Selected Events ({selectedEventsWithPaths.length}):
              </Text>
              {selectedEventsWithPaths.length > 3 && (
                <TouchableOpacity onPress={() => setIsEventsExpanded(!isEventsExpanded)}>
                  <ChevronDown
                    size={20}
                    color="#666"
                    style={{ transform: [{ rotate: isEventsExpanded ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
              )}
            </View>
            {(isEventsExpanded ? selectedEventsWithPaths : selectedEventsWithPaths.slice(0, 3)).map((item: { id: string, path: string }) => {
              const eventCategory = eventCategories.find((cat) => cat.id === item.id);
              return (
                <View key={item.id} style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>
                    {eventCategory?.icon ? `${eventCategory.icon} ` : ''}
                    {item.path}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleEventType(item.id)}
                    style={styles.removeButton}
                  >
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Event Selection Modal */}
        <Modal
          visible={isEventModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEventModalOpen(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              handleChange('selectedEventIds', []);
              setIsEventModalOpen(false);
            }}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Events</Text>
                <TouchableOpacity
                  onPress={() => {
                    handleChange('selectedEventIds', []);
                    setIsEventModalOpen(false);
                  }}
                  style={styles.closeButton}
                >
                  <X size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search Events you serve..."
                placeholderTextColor="#999"
                value={eventSearchQuery}
                onFocus={onFocus}
                onChangeText={setEventSearchQuery}
              />

              {/* Select All strip */}
              <TouchableOpacity
                style={styles.selectAllRow}
                onPress={handleSelectAllEvents}
                activeOpacity={0.7}
              >
                <View style={[styles.selectAllCheck, isAllEventsSelected() && styles.selectAllCheckActive]}>
                  {isAllEventsSelected() && <Check size={12} color="#fff" strokeWidth={3} />}
                </View>
                <Text style={[styles.selectAllText, isAllEventsSelected() && styles.selectAllTextActive]}>
                  {isAllEventsSelected() ? 'Deselect All' : 'Select All'}
                </Text>
              </TouchableOpacity>

              {/* Event Category Tree */}
              <ScrollView
                style={styles.modalCategoryTree}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {filteredEventTree.length === 0 ? (
                  <Text style={styles.emptyText}>No events found</Text>
                ) : (
                  renderEventCategoryTree(filteredEventTree)
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={handleEventDone}
                >
                  <Text style={styles.modalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, validationErrors.operatingLocations && styles.labelError]}>Operating Locations *</Text>
        <TouchableOpacity
          style={[
            styles.dropdownTrigger,
            validationErrors.operatingLocations && styles.dropdownTriggerError
          ]}
          onPress={() => setIsCityModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.dropdownText,
            (!data.operatingLocations || data.operatingLocations.length === 0) && styles.placeholder
          ]}>
            {data.operatingLocations && data.operatingLocations.length > 0
              ? `${data.operatingLocations.length} locations selected`
              : 'Select operating locations'}
          </Text>
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>

        {data.operatingLocations && data.operatingLocations.length > 0 && (
          <View style={styles.selectedLocationsContainer}>
            {data.operatingLocations.map((city: string) => (
              <View key={city} style={styles.locationChip}>
                <Text style={styles.locationChipText}>{city === '*' ? 'Pan India' : city}</Text>
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
        {validationErrors.operatingLocations && (
          <Text style={styles.errorText}>{validationErrors.operatingLocations}</Text>
        )}
      </View>

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

            <ScrollView
              style={styles.optionsList}
              keyboardShouldPersistTaps="handled"
            >
              {filteredCities.map((city) => {
                const isSelected = city === 'Pan India'
                  ? data.operatingLocations?.includes('*')
                  : data.operatingLocations?.includes(city);
                return (
                  <TouchableOpacity
                    key={city}
                    style={[
                      styles.option,
                      isSelected && styles.optionSelected
                    ]}
                    onPress={() => toggleCitySelection(city)}
                  >
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected
                    ]}>
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

            <View
              style={[
                styles.cityModalFooter,
                { paddingBottom: insets.bottom + 40 }
              ]}
            >
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
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
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
  input: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  eventOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eventOptionText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  eventOptionTextSelected: {
    fontWeight: '600',
    color: '#007AFF',
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
  labelError: {
    color: '#FF3B30',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  uploadButtonError: {
    borderColor: '#FF3B30',
    borderStyle: 'solid',
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
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
    borderColor: '#007AFF',
    minHeight: 36,
  },
  selectedChipText: {
    fontSize: 14,
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  removeButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '92%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 0,
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
  modalSearchInput: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    margin: 20,
    marginBottom: 12,
  },
  modalCategoryTree: {
    maxHeight: 400,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  selectAllCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectAllCheckActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  selectAllTextActive: {
    color: '#007AFF',
  },
  categoryTreeContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 400,
    paddingVertical: 8,
  },
  categoryItem: {
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingRight: 12,
    minHeight: 44,
  },
  expandButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginTop: 0,
  },
  radioButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  radioButtonSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  radioButtonOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  checkbox: {
    width: 22,
    height: 22,
    marginRight: 10,
    marginTop: 0,
    flexShrink: 0,
  },
  checkboxSelected: {
    width: 22,
    height: 22,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxUnselected: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#d0d0d0',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    flexWrap: 'wrap',
    lineHeight: 22,
  },
  categoryNameSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
  childrenContainer: {
    marginLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#e8e8e8',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
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
    borderColor: '#e0e0e0',
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
  selectedLocationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 0,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    margin: 20,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  modalSearchInputInside: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1a1a1a',
  },
  optionsList: {
    flex: 1,
    maxHeight: 400,
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
});
