import React, { useEffect, useState, useMemo } from 'react';
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
} from 'react-native';
import { Check, ChevronRight, ChevronDown, X } from 'lucide-react-native';
import Dropdown from '@/components/Dropdown';
import { supabaseCore } from '@/lib/supabase';

interface ServicesExperienceStepProps {
  data: any;
  onUpdate: (data: any) => void;
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

export default function ServicesExperienceStep({
  data,
  onUpdate,
}: ServicesExperienceStepProps) {
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

      // Fetch only root level event categories (category_level = 1 or parent_category_id is null)
      const { data: eventCats, error: eventError } = await supabaseCore
        .from('categories')
        .select('id, name, icon, parent_category_id, category_level, sort_order')
        .eq('category_type', 'event')
        .eq('visible', true)
        .or('parent_category_id.is.null,category_level.eq.1')
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

  // Get full path for a category
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

  // Handle child category selection
  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        return prev.filter((id) => id !== categoryId);
      } else {
        // Find the category and expand it if it has children
        const category = allBusinessCategories.find((c) => c.id === categoryId);
        if (category) {
          const hasChildren = allBusinessCategories.some(
            (c) => c.parent_category_id === categoryId
          );
          if (hasChildren) {
            setExpandedCategoryIds((expanded) => new Set([...expanded, categoryId]));
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

  // Auto-expand selected categories with children
  useEffect(() => {
    setExpandedCategoryIds((currentExpanded) => {
      const newExpanded = new Set(currentExpanded);
      let changed = false;
      selectedCategoryIds.forEach((categoryId) => {
        const hasChildren = allBusinessCategories.some(
          (c) => c.parent_category_id === categoryId
        );
        if (hasChildren && !newExpanded.has(categoryId)) {
          newExpanded.add(categoryId);
          changed = true;
        }
      });
      return changed ? newExpanded : currentExpanded;
    });
  }, [selectedCategoryIds, allBusinessCategories]);

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

  // Get selected categories with full paths
  const selectedCategoriesWithPaths = useMemo(() => {
    return selectedCategoryIds.map((id) => ({
      id,
      path: getCategoryPath(id, allBusinessCategories),
    }));
  }, [selectedCategoryIds, allBusinessCategories]);

  const handleChange = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  const toggleEventType = (eventId: string) => {
    const currentIds = data.selectedEventIds || [];
    const newIds = currentIds.includes(eventId)
      ? currentIds.filter((id: string) => id !== eventId)
      : [...currentIds, eventId];
    handleChange('selectedEventIds', newIds);
  };

  // Get selected event names for display
  const selectedEventNames = useMemo(() => {
    const selectedIds = data.selectedEventIds || [];
    return eventCategories
      .filter((cat) => selectedIds.includes(cat.id))
      .map((cat) => cat.name);
  }, [data.selectedEventIds, eventCategories]);

  // Filter event categories based on search
  const filteredEventCategories = useMemo(() => {
    if (!eventSearchQuery.trim()) return eventCategories;
    const lowerQuery = eventSearchQuery.toLowerCase();
    return eventCategories.filter((cat) =>
      cat.name.toLowerCase().includes(lowerQuery)
    );
  }, [eventCategories, eventSearchQuery]);

  // Get display text for event dropdown
  const getEventDropdownDisplayText = (): string => {
    if (selectedEventNames.length === 0) {
      return 'Select event types';
    }
    if (selectedEventNames.length === 1) {
      return selectedEventNames[0];
    }
    return `${selectedEventNames.length} events selected`;
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Service Category *</Text>
        
        {/* Dropdown Trigger */}
        <TouchableOpacity
          style={styles.dropdownTrigger}
          onPress={() => setIsCategoryModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownText, !selectedRootCategoryId && styles.placeholder]}>
            {getDropdownDisplayText()}
          </Text>
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>

        {/* Selected Categories Display */}
        {selectedCategoriesWithPaths.length > 0 && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedLabel}>
              Selected Categories ({selectedCategoriesWithPaths.length}):
            </Text>
            {selectedCategoriesWithPaths.map((item) => (
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
                  onPress={() => setIsCategoryModalOpen(false)}
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
          style={styles.dropdownTrigger}
          onPress={() => setIsEventModalOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.dropdownText, selectedEventNames.length === 0 && styles.placeholder]}>
            {getEventDropdownDisplayText()}
          </Text>
          <ChevronDown size={20} color="#666" />
        </TouchableOpacity>

        {/* Selected Events Display */}
        {selectedEventNames.length > 0 && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedLabel}>
              Selected Events ({selectedEventNames.length}):
            </Text>
            {eventCategories
              .filter((cat) => (data.selectedEventIds || []).includes(cat.id))
              .map((eventCategory) => (
                <View key={eventCategory.id} style={styles.selectedChip}>
                  <Text style={styles.selectedChipText}>
                    {eventCategory.icon ? `${eventCategory.icon} ` : ''}
                    {eventCategory.name}
                  </Text>
                  <TouchableOpacity
                    onPress={() => toggleEventType(eventCategory.id)}
                    style={styles.removeButton}
                  >
                    <X size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
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

              {/* Event List */}
              <ScrollView 
                style={styles.modalCategoryTree}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
              >
                {filteredEventCategories.length === 0 ? (
                  <Text style={styles.emptyText}>No events found</Text>
                ) : (
                  filteredEventCategories.map((eventCategory) => {
                    const isSelected = (data.selectedEventIds || []).includes(eventCategory.id);
                    return (
                      <TouchableOpacity
                        key={eventCategory.id}
                        style={styles.eventOption}
                        onPress={() => toggleEventType(eventCategory.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.checkbox}>
                          {isSelected ? (
                            <View style={styles.checkboxSelected}>
                              <Check size={14} color="#fff" strokeWidth={3} />
                            </View>
                          ) : (
                            <View style={styles.checkboxUnselected} />
                          )}
                        </View>
                        {eventCategory.icon && (
                          <Text style={styles.categoryIcon}>{eventCategory.icon}</Text>
                        )}
                        <Text
                          style={[
                            styles.eventOptionText,
                            isSelected && styles.eventOptionTextSelected,
                          ]}
                        >
                          {eventCategory.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setIsEventModalOpen(false)}
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
          style={[styles.input, styles.textArea]}
          value={data.businessDescription || ''}
          onChangeText={(text) => handleChange('businessDescription', text)}
          placeholder="Describe your services and what makes your business unique"
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
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
        />
      </View>
    </ScrollView>
  );
}

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
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    fontStyle: 'italic',
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
