import React, { useEffect, useState, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
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
import { Check, ChevronRight, ChevronDown, X } from 'lucide-react-native';
import Dropdown from '@/components/Dropdown';
import { supabaseCore } from '@/lib/supabase';

interface ServicesExperienceStepProps {
  data: any;
  onUpdate: (data: any) => void;
  validationErrors?: Record<string, string>;
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

const ServicesExperienceStep = forwardRef<ServicesExperienceStepRef, ServicesExperienceStepProps>(({
  data,
  onUpdate,
  validationErrors = {},
}, ref) => {
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
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isExperienceDropdownOpen, setIsExperienceDropdownOpen] = useState(false);
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  // Refs for keyboard navigation
  const businessDescriptionRef = useRef<TextInput>(null);

  // Expose method to focus next empty mandatory field
  useImperativeHandle(ref, () => ({
    focusNextEmptyField: () => {
      // Focus first empty mandatory field
      if (!data.selectedRootCategoryId && (!data.selectedCategoryIds || data.selectedCategoryIds.length === 0)) {
        // Can't focus dropdown, but we can scroll to it or show modal
        setIsCategoryModalOpen(true);
      } else if (!data.selectedEventIds || data.selectedEventIds.length === 0) {
        setIsEventModalOpen(true);
      } else if (!data.businessDescription || !data.businessDescription.trim()) {
        businessDescriptionRef.current?.focus();
      } else if (!data.yearsOfExperience || !data.yearsOfExperience.trim()) {
        setIsExperienceDropdownOpen(true);
      }
    },
  }));

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const fetchCategories = async () => {
    try {
      setLoading(true);

      // Fetch all business categories with hierarchy info
      const { data: businessCats, error: businessError } = await supabaseCore
        .from('categories')
        .select('id, name, icon, parent_category_id, category_level, sort_order')
        .eq('category_type', 'business')
        .eq('visible', true)
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

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    return filterCategories(categoryTree, searchQuery);
  }, [categoryTree, searchQuery]);

  // Get root categories (level 1 or no parent)
  const rootCategories = useMemo(() => {
    return allBusinessCategories.filter(
      (cat) => cat.category_level === 1 || cat.parent_category_id === null
    );
  }, [allBusinessCategories]);

  // Handle root category selection
  const handleRootSelection = (categoryId: string) => {
    setSelectedRootCategoryId(categoryId);
    // Clear all previous selections when root changes
    setSelectedCategoryIds([]);
    // Expand the selected root to show children
    setExpandedCategoryIds(new Set([categoryId]));
  };

  // Handle category selection (both root and child categories)
  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        // Remove from selection
        const newIds = prev.filter((id) => id !== categoryId);

        // Collapse the category when unselected
        setExpandedCategoryIds((expanded) => {
          const newExpanded = new Set(expanded);
          if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
          }
          return newExpanded;
        });

        // Also clear root selection if this was the selected root
        if (selectedRootCategoryId === categoryId) {
          setSelectedRootCategoryId(null);
        }
        return newIds;
      } else {
        // Add to selection
        // Find the category and expand parent chain so it's visible
        const category = allBusinessCategories.find((c) => c.id === categoryId);
        if (category) {
          // Auto-expand parent chain to make the selected category visible
          const parentChain: string[] = [];
          let currentParentId: string | null = category.parent_category_id;

          while (currentParentId) {
            parentChain.push(currentParentId);
            const parent = allBusinessCategories.find((c) => c.id === currentParentId);
            currentParentId = parent?.parent_category_id || null;
          }

          // Expand all parents in the chain
          if (parentChain.length > 0) {
            setExpandedCategoryIds((expanded) => new Set([...expanded, ...parentChain]));
          }

          // Expand the category itself if it has children
          const hasChildren = allBusinessCategories.some(
            (c) => c.parent_category_id === categoryId
          );
          if (hasChildren) {
            setExpandedCategoryIds((expanded) => new Set([...expanded, categoryId]));
          }

          // If the added category is a root (no parent / level 1), mark it as selected root
          if (!category.parent_category_id || category.category_level === 1) {
            setSelectedRootCategoryId(categoryId);
          }
        }
        return [...prev, categoryId];
      }
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

  // Render category tree recursively
  const renderCategoryTree = (nodes: CategoryNode[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isRoot = node.category_level === 1 || node.parent_category_id === null;
      const isSelected = selectedCategoryIds.includes(node.id);
      const isExpanded = expandedCategoryIds.has(node.id);
      const hasChildren = node.children.length > 0;
      const isRootSelected = selectedRootCategoryId === node.id;

      return (
        <View key={node.id} style={styles.categoryItem}>
          <TouchableOpacity
            style={[styles.categoryRow, { paddingLeft: level * 20 + 12 }]}
            onPress={() => {
              if (isRoot) {
                handleRootSelection(node.id);
              } else {
                toggleCategorySelection(node.id);
              }
            }}
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

            {isRoot ? (
              <View style={styles.radioButton}>
                {isRootSelected ? (
                  <View style={styles.radioButtonSelected}>
                    <View style={styles.radioButtonInner} />
                  </View>
                ) : (
                  <View style={styles.radioButtonOuter} />
                )}
              </View>
            ) : (
              <View style={styles.checkbox}>
                {isSelected ? (
                  <View style={styles.checkboxSelected}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={styles.checkboxUnselected} />
                )}
              </View>
            )}

            {node.icon && <Text style={styles.categoryIcon}>{node.icon}</Text>}
            <Text
              style={[
                styles.categoryName,
                (isRootSelected || isSelected) && styles.categoryNameSelected,
              ]}
            >
              {node.name}
            </Text>
          </TouchableOpacity>

          {hasChildren && isExpanded && (
            <View style={styles.childrenContainer}>
              {renderCategoryTree(node.children, level + 1)}
            </View>
          )}
        </View>
      );
    });
  };

  // Get selected categories with full paths (including root if selected)
  const selectedCategoriesWithPaths = useMemo(() => {
    // Combine selectedCategoryIds with root category if selected
    const allSelectedIds = [...selectedCategoryIds];
    if (selectedRootCategoryId && !allSelectedIds.includes(selectedRootCategoryId)) {
      allSelectedIds.push(selectedRootCategoryId);
    }

    return allSelectedIds.map((id) => ({
      id,
      path: getCategoryPath(id, allBusinessCategories),
    }));
  }, [selectedCategoryIds, selectedRootCategoryId, allBusinessCategories]);

  const handleChange = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  const toggleEventType = (eventId: string) => {
    const currentIds = data.selectedEventIds || [];
    const isSelected = currentIds.includes(eventId);

    if (isSelected) {
      // Collapse when deselecting
      setExpandedEventIds((expanded) => {
        const newExpanded = new Set(expanded);
        if (newExpanded.has(eventId)) {
          newExpanded.delete(eventId);
        }
        return newExpanded;
      });
    }

    const newIds = isSelected
      ? currentIds.filter((id: string) => id !== eventId)
      : [...currentIds, eventId];
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
    const selectedIds = data.selectedEventIds || [];
    return selectedIds.map((id: string) => ({
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
    if (selectedEventsWithPaths.length === 0) {
      return 'Select event types';
    }
    if (selectedEventsWithPaths.length === 1) {
      return selectedEventsWithPaths[0].path;
    }
    return `${selectedEventsWithPaths.length} events selected`;
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  // Get display text for dropdown
  const getDropdownDisplayText = (): string => {
    if (selectedCategoriesWithPaths.length === 0) {
      return 'Select service category';
    }
    if (selectedCategoriesWithPaths.length === 1) {
      return selectedCategoriesWithPaths[0].path;
    }
    return `${selectedCategoriesWithPaths.length} categories selected`;
  };

  const handleCategoryDone = () => {
    if (selectedCategoryIds.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one sub-category');
      return;
    }
    setIsCategoryModalOpen(false);
  };

  const handleEventDone = () => {
    if ((data.selectedEventIds || []).length === 0) {
      Alert.alert('Validation Error', 'Please select at least one sub-category for event types');
      return;
    }
    setIsEventModalOpen(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Service Category *</Text>

        {/* Dropdown Trigger */}
        <TouchableOpacity
          style={[
            styles.dropdownTrigger,
            (validationErrors.selectedRootCategoryId || validationErrors.selectedCategoryIds) && styles.dropdownTriggerError
          ]}
          onPress={() => setIsCategoryModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownText, !selectedRootCategoryId && styles.placeholder]}>
            {getDropdownDisplayText()}
          </Text>
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>
        {(validationErrors.selectedRootCategoryId || validationErrors.selectedCategoryIds) && (
          <Text style={styles.errorText}>
            {validationErrors.selectedRootCategoryId || validationErrors.selectedCategoryIds}
          </Text>
        )}

        {/* Selected Categories Display */}
        {selectedCategoriesWithPaths.length > 0 && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedLabel}>
              Selected Categories ({selectedCategoriesWithPaths.length}):
            </Text>
            {selectedCategoriesWithPaths.map((item: { id: string, path: string }) => (
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

        {/* Category Selection Modal */}
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
                <Text style={styles.modalTitle}>Select Service Category</Text>
                <TouchableOpacity
                  onPress={() => setIsCategoryModalOpen(false)}
                  style={styles.closeButton}
                >
                  <X size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search vendor categories..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />

              {/* Category Tree */}
              <ScrollView
                style={styles.modalCategoryTree}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {filteredTree.length === 0 ? (
                  <Text style={styles.emptyText}>No categories found</Text>
                ) : (
                  renderCategoryTree(filteredTree)
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
        <Text style={styles.label}>Event Types *</Text>

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
            <Text style={styles.selectedLabel}>
              Selected Events ({selectedEventsWithPaths.length}):
            </Text>
            {selectedEventsWithPaths.map((item: { id: string, path: string }) => {
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
            onPress={() => setIsEventModalOpen(false)}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Event Types</Text>
                <TouchableOpacity
                  onPress={() => setIsEventModalOpen(false)}
                  style={styles.closeButton}
                >
                  <X size={24} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Search Input */}
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search event types..."
                placeholderTextColor="#999"
                value={eventSearchQuery}
                onChangeText={setEventSearchQuery}
              />

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
        <Text style={styles.label}>Business Description *</Text>
        <TextInput
          ref={businessDescriptionRef}
          style={[
            styles.input,
            styles.textArea,
            validationErrors.businessDescription && styles.inputError
          ]}
          value={data.businessDescription || ''}
          onChangeText={(text) => handleChange('businessDescription', text)}
          placeholder="Describe your services and what makes your business unique"
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="done"
          blurOnSubmit={true}
        />
        {validationErrors.businessDescription && (
          <Text style={styles.errorText}>{validationErrors.businessDescription}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Years of Experience *</Text>
        <Dropdown
          options={EXPERIENCE_OPTIONS.map((exp) => ({
            label: exp,
            value: exp,
          }))}
          value={data.yearsOfExperience || ''}
          placeholder="Select experience"
          onChange={(value: string) => handleChange('yearsOfExperience', value)}
          open={isExperienceDropdownOpen}
          onOpenChange={setIsExperienceDropdownOpen}
        />
        {validationErrors.yearsOfExperience && (
          <Text style={styles.errorText}>{validationErrors.yearsOfExperience}</Text>
        )}
      </View>
    </ScrollView>
  );
});

ServicesExperienceStep.displayName = 'ServicesExperienceStep';

export default ServicesExperienceStep;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
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
    marginBottom: 16,
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
    backgroundColor: '#fff5f5',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#fff5f5',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    fontWeight: '500',
  },
  selectedContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
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
    borderRadius: 16,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    padding: 0,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
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
  categoryTreeContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 400,
    paddingVertical: 8,
  },
  categoryItem: {
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
  },
  expandButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
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
    width: 20,
    height: 20,
    marginRight: 8,
  },
  checkboxSelected: {
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxUnselected: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ccc',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  categoryNameSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
  childrenContainer: {
    marginLeft: 20,
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
});
