import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  Plus,
  Edit,
  Trash2,
  Image as ImageIcon,
  Calendar,
  X,
  Tag,
  ZoomIn,
  Check,
  ChevronRight,
  ChevronDown,
  Upload,
  FileText,
  AlertCircle,
  Package,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore } from '@/lib/supabase';
import {
  getBusinessDetails,
  getOffers,
  getBusinessImages,
  createOffer,
  updateOffer,
  deleteOffer,
  uploadBusinessImage,
  deleteBusinessImage,
  updateBusinessDetails,
  uploadOfferBanner,
  pickImage,
  pickMultipleImages,
  uploadMultipleBusinessImages,
  setCoverImage,
  getBusinessVerificationDocuments,
  uploadVerificationDocument,
  deleteVerificationDocument,
  VerificationDocument,
  Offer,
  PortfolioImage,
} from '@/lib/businessApi';
import { pickDocuments, DocumentFile, isImageFile, isPdfFile } from '@/lib/documentUpload';
import { validatePincode } from '@/lib/pincodeValidation';
import Logo from '@/components/Logo';
import Dropdown from '@/components/Dropdown';
import PackageList from '@/components/packages/PackageList';
import { Colors } from '@/constants/theme';

const EXPERIENCE_OPTIONS = [
  'Less than 1 year',
  '1-3 years',
  '3-5 years',
  '5-10 years',
  'More than 10 years',
];

// Helper to convert numeric years to display string
const getExperienceDisplayValue = (years: number | null | undefined): string => {
  if (years === null || years === undefined) return '';
  if (years < 1) return 'Less than 1 year';
  if (years >= 1 && years < 3) return '1-3 years';
  if (years >= 3 && years < 5) return '3-5 years';
  if (years >= 5 && years < 10) return '5-10 years';
  return 'More than 10 years';
};

// Helper to convert display string to numeric years
const parseExperienceToNumber = (experienceStr: string): number => {
  if (!experienceStr) return 0;
  if (experienceStr === 'Less than 1 year') return 0;
  if (experienceStr === '1-3 years') return 1;
  if (experienceStr === '3-5 years') return 3;
  if (experienceStr === '5-10 years') return 5;
  if (experienceStr === 'More than 10 years') return 10;
  return 0;
};

type SectionType = 'offers' | 'gallery' | 'packages' | 'edit';

export default function BusinessDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [business, setBusiness] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [activeSection, setActiveSection] = useState<SectionType>('gallery');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

  const [offerTitle, setOfferTitle] = useState('');
  const [offerDescription, setOfferDescription] = useState('');
  const [offerBannerUri, setOfferBannerUri] = useState<string | null>(null);
  const [offerValidUntil, setOfferValidUntil] = useState('');
  const [offerDiscount, setOfferDiscount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMultiple, setUploadingMultiple] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  const [editData, setEditData] = useState<any>({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null); // document type code
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Category selection state
  const [allBusinessCategories, setAllBusinessCategories] = useState<any[]>([]);
  const [allEventCategories, setAllEventCategories] = useState<any[]>([]);
  const [selectedRootCategoryId, setSelectedRootCategoryId] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [expandedEventCategoryIds, setExpandedEventCategoryIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Pincode validation state
  const [validatingPincode, setValidatingPincode] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [cityOptions, setCityOptions] = useState<string[]>([]);

  // Refs for keyboard navigation in edit form
  const contactPersonNameRef = useRef<TextInput>(null);
  const contactPersonRoleRef = useRef<TextInput>(null);
  const businessEmailRef = useRef<TextInput>(null);
  const contactPersonPhoneRef = useRef<TextInput>(null);
  const businessDescriptionRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const pincodeRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const localityRef = useRef<TextInput>(null);
  const stateRef = useRef<TextInput>(null);
  const serviceRadiusRef = useRef<TextInput>(null);
  const gstNumberRef = useRef<TextInput>(null);
  const panRef = useRef<TextInput>(null);
  const websiteUrlRef = useRef<TextInput>(null);
  const instagramUrlRef = useRef<TextInput>(null);
  const facebookUrlRef = useRef<TextInput>(null);
  const youtubeUrlRef = useRef<TextInput>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  // Reload packages when screen comes into focus (e.g., after adding a package)
  useFocusEffect(
    useCallback(() => {
      if (id && activeSection === 'packages') {
        loadPackages();
      }
    }, [id, activeSection])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [businessRes, offersRes, imagesRes] = await Promise.all([
        getBusinessDetails(id),
        getOffers(id),
        getBusinessImages(id),
      ]);

      if (businessRes.error) throw businessRes.error;
      if (offersRes.error) throw offersRes.error;
      if (imagesRes.error) throw imagesRes.error;

      setBusiness(businessRes.data);
      setOffers(offersRes.data || []);
      
      // Combine images from vendor_business_media with cover_photo_url from business
      let allImages = imagesRes.data || [];
      
      // If business has cover_photo_url and it's not already in images, add it
      if (businessRes.data?.cover_photo_url) {
        const coverExists = allImages.some(
          (img) => img.image_url === businessRes.data.cover_photo_url || img.image_type === 'cover'
        );
        
        if (!coverExists) {
          // Add cover photo as the first image
          allImages = [
            {
              id: `cover-${id}`, // Temporary ID for cover photo
              business_id: id,
              image_url: businessRes.data.cover_photo_url,
              image_base64: null,
              display_order: 0,
              created_at: businessRes.data.created_at || new Date().toISOString(),
              image_type: 'cover',
            },
            ...allImages,
          ];
        }
      }
      
      setImages(allImages);
      setEditData(businessRes.data || {});

      // Load categories first, then mappings
      await loadCategories();
      // Load existing category mappings (this will set selectedCategoryIds)
      const { businessIds } = await loadCategoryMappings();
      
      // After mappings are loaded, determine root category
      if (businessIds.length > 0) {
        const selectedCats = allBusinessCategories.filter((cat) =>
          businessIds.includes(cat.id)
        );
        const rootCat = selectedCats.find(
          (cat) => cat.category_level === 1 || cat.parent_category_id === null
        );
        if (rootCat) {
          setSelectedRootCategoryId(rootCat.id);
          setExpandedCategoryIds(new Set([rootCat.id]));
        }
      }

      // Load verification documents
      await loadVerificationDocuments();
      
      // Load packages
      await loadPackages();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load business details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategoryMappings = async (): Promise<{ businessIds: string[]; eventIds: string[] }> => {
    try {
      const { data: mappings, error } = await supabaseCore
        .from('vendor_business_category_mappings')
        .select('category_id')
        .eq('business_id', id);

      if (error) {
        console.error('Error loading category mappings:', error);
        return { businessIds: [], eventIds: [] };
      }

      if (mappings && mappings.length > 0) {
        const allCategoryIds = mappings.map((m) => m.category_id);

        // Fetch categories to determine their types
        const { data: categories, error: catError } = await supabaseCore
          .from('categories')
          .select('id, category_type, category_level, parent_category_id')
          .in('id', allCategoryIds);

        if (catError) {
          console.error('Error loading categories:', catError);
          return { businessIds: [], eventIds: [] };
        }

        // Separate business and event categories
        const businessCategoryIds: string[] = [];
        const eventCategoryIds: string[] = [];

        categories?.forEach((cat) => {
          if (cat.category_type === 'business') {
            businessCategoryIds.push(cat.id);
          } else if (cat.category_type === 'event') {
            eventCategoryIds.push(cat.id);
          }
        });

        setSelectedCategoryIds(businessCategoryIds);
        setSelectedEventIds(eventCategoryIds);
        
        return { businessIds: businessCategoryIds, eventIds: eventCategoryIds };
      }
      
      return { businessIds: [], eventIds: [] };
    } catch (error) {
      console.error('Error loading category mappings:', error);
      return { businessIds: [], eventIds: [] };
    }
  };

  const loadCategories = async () => {
    try {
      setLoadingCategories(true);

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
        setAllEventCategories(eventCats || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const loadPackages = async () => {
    if (!id) return;
    try {
      setLoadingPackages(true);
      const { getBusinessPackages } = await import('@/lib/packageApi');
      const { data, error } = await getBusinessPackages(id);
      if (error) throw error;
      // Filter out inactive packages - only show active ones
      const activePackages = (data || []).filter((pkg: any) => pkg.is_active !== false);
      setPackages(activePackages);
    } catch (error: any) {
      console.error('Error loading packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleEditPackage = (pkg: any) => {
    router.push({
      pathname: '/package-form',
      params: { id: pkg.id, businessId: id },
    });
  };

  const handleDeletePackage = async (pkg: any) => {
    if (!pkg || !pkg.id) {
      Alert.alert('Error', 'Invalid package data');
      return;
    }

    console.log('handleDeletePackage called with package:', pkg.id, pkg.package_name);
    setPackageToDelete(pkg);
    setShowDeleteModal(true);
  };

  const confirmDeletePackage = async () => {
    if (!packageToDelete || !packageToDelete.id) {
      return;
    }

    try {
      setDeleting(true);
      console.log('Delete confirmed. Marking package as inactive:', packageToDelete.id);
      const { togglePackageStatus } = await import('@/lib/packageApi');
      console.log('Calling togglePackageStatus with:', packageToDelete.id, false);
      const result = await togglePackageStatus(packageToDelete.id, false);
      console.log('togglePackageStatus result:', result);
      
      if (result.error) {
        console.error('Delete package error:', result.error);
        Alert.alert('Error', result.error.message || 'Failed to delete package. Please try again.');
        setShowDeleteModal(false);
        setPackageToDelete(null);
        return;
      }
      
      console.log('Package marked as inactive successfully');
      setShowDeleteModal(false);
      setPackageToDelete(null);
      await loadPackages();
    } catch (error: any) {
      console.error('Error deleting package (catch block):', error);
      Alert.alert('Error', error.message || 'Failed to delete package. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePackageStatus = async (pkg: any) => {
    try {
      const { togglePackageStatus } = await import('@/lib/packageApi');
      const newStatus = !pkg.is_active;
      const { error } = await togglePackageStatus(pkg.id, newStatus);
      if (error) throw error;
      await loadPackages();
    } catch (error: any) {
      console.error('Error toggling package status:', error);
      Alert.alert('Error', error.message || 'Failed to update package status. Please try again.');
    }
  };

  // Build hierarchical tree structure
  const buildCategoryTree = (categories: any[]): any[] => {
    const categoryMap = new Map<string, any>();
    const rootCategories: any[] = [];

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
    const sortChildren = (nodes: any[]) => {
      nodes.forEach((node) => {
        node.children.sort((a: any, b: any) => {
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
  const getCategoryPath = (categoryId: string, categories: any[]): string => {
    const categoryMap = new Map<string, any>();
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
  const filterCategories = (nodes: any[], query: string): any[] => {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();
    const filtered: any[] = [];

    const matchesQuery = (node: any): boolean => {
      return node.name.toLowerCase().includes(lowerQuery);
    };

    const filterNode = (node: any): any | null => {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n: any): n is any => n !== null);

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
  const categoryTree = React.useMemo(() => {
    return buildCategoryTree(allBusinessCategories);
  }, [allBusinessCategories]);

  // Filter tree based on search
  const filteredTree = React.useMemo(() => {
    return filterCategories(categoryTree, searchQuery);
  }, [categoryTree, searchQuery]);

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
  React.useEffect(() => {
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
  const renderCategoryTree = (nodes: any[], level: number = 0): React.ReactNode => {
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
  const selectedCategoriesWithPaths = React.useMemo(() => {
    return selectedCategoryIds.map((id) => ({
      id,
      path: getCategoryPath(id, allBusinessCategories),
    }));
  }, [selectedCategoryIds, allBusinessCategories]);

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

  // Build hierarchical tree structure for event categories
  const buildEventCategoryTree = (categories: any[]): any[] => {
    const categoryMap = new Map<string, any>();
    const rootCategories: any[] = [];

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
    const sortChildren = (nodes: any[]) => {
      nodes.forEach((node) => {
        node.children.sort((a: any, b: any) => {
          const aOrder = allEventCategories.find((c) => c.id === a.id)?.sort_order ?? 0;
          const bOrder = allEventCategories.find((c) => c.id === b.id)?.sort_order ?? 0;
          return aOrder - bOrder;
        });
        sortChildren(node.children);
      });
    };

    sortChildren(rootCategories);
    return rootCategories;
  };

  // Build event category tree
  const eventCategoryTree = React.useMemo(() => {
    return buildEventCategoryTree(allEventCategories);
  }, [allEventCategories]);

  // Filter event category tree based on search
  const filterEventCategories = (nodes: any[], query: string): any[] => {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();
    const filtered: any[] = [];

    const matchesQuery = (node: any): boolean => {
      return node.name.toLowerCase().includes(lowerQuery);
    };

    const filterNode = (node: any): any | null => {
      const filteredChildren = node.children
        .map(filterNode)
        .filter((n: any): n is any => n !== null);

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

  const filteredEventTree = React.useMemo(() => {
    return filterEventCategories(eventCategoryTree, eventSearchQuery);
  }, [eventCategoryTree, eventSearchQuery]);

  // Get full path for an event category
  const getEventCategoryPath = (categoryId: string, categories: any[]): string => {
    const categoryMap = new Map<string, any>();
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

  // Get selected event categories with full paths
  const selectedEventsWithPaths = React.useMemo(() => {
    return selectedEventIds.map((id) => ({
      id,
      path: getEventCategoryPath(id, allEventCategories),
    }));
  }, [selectedEventIds, allEventCategories]);

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

  // Toggle event selection
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds((prev) => {
      if (prev.includes(eventId)) {
        return prev.filter((id) => id !== eventId);
      } else {
        // Find the category and expand it if it has children
        const category = allEventCategories.find((c) => c.id === eventId);
        if (category) {
          const hasChildren = allEventCategories.some(
            (c) => c.parent_category_id === eventId
          );
          if (hasChildren) {
            setExpandedEventCategoryIds((expanded) => new Set([...expanded, eventId]));
          }
        }
        return [...prev, eventId];
      }
    });
  };

  // Toggle event category expansion
  const toggleEventExpansion = (categoryId: string) => {
    setExpandedEventCategoryIds((expanded) => {
      const newExpanded = new Set(expanded);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return newExpanded;
    });
  };

  // Auto-expand selected event categories with children
  React.useEffect(() => {
    setExpandedEventCategoryIds((currentExpanded) => {
      const newExpanded = new Set(currentExpanded);
      let changed = false;
      selectedEventIds.forEach((categoryId) => {
        const hasChildren = allEventCategories.some(
          (c) => c.parent_category_id === categoryId
        );
        if (hasChildren && !newExpanded.has(categoryId)) {
          newExpanded.add(categoryId);
          changed = true;
        }
      });
      return changed ? newExpanded : currentExpanded;
    });
  }, [selectedEventIds, allEventCategories]);

  // Render event category tree recursively
  const renderEventCategoryTree = (nodes: any[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isSelected = selectedEventIds.includes(node.id);
      const isExpanded = expandedEventCategoryIds.has(node.id);
      const hasChildren = node.children.length > 0;

      return (
        <View key={node.id} style={styles.categoryItem}>
          <TouchableOpacity
            style={[styles.categoryRow, { paddingLeft: level * 20 + 12 }]}
            onPress={() => toggleEventSelection(node.id)}
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

            {node.icon && <Text style={styles.categoryIcon}>{node.icon}</Text>}
            <Text
              style={[
                styles.categoryName,
                isSelected && styles.categoryNameSelected,
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

  // Load verification documents
  const loadVerificationDocuments = async () => {
    if (!id) return;
    try {
      setLoadingDocuments(true);
      const { data, error } = await getBusinessVerificationDocuments(id);
      if (error) {
        console.error('Error loading verification documents:', error);
        return;
      }
      setVerificationDocuments(data || []);
    } catch (error) {
      console.error('Error loading verification documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // Handle document upload
  const handleUploadDocument = async (documentTypeCode: string) => {
    try {
      setUploadingDocument(documentTypeCode);
      const { files, error } = await pickDocuments(true);

      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      if (files.length === 0) {
        return;
      }

      // Upload each file
      for (const file of files) {
        const { data, error: uploadError } = await uploadVerificationDocument(
          id,
          documentTypeCode,
          file
        );

        if (uploadError) {
          Alert.alert('Upload Error', `Failed to upload ${file.name || 'document'}: ${uploadError.message}`);
        } else if (data) {
          // Reload documents to show the new one
          await loadVerificationDocuments();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload document');
      console.error('Error uploading document:', error);
    } finally {
      setUploadingDocument(null);
    }
  };

  // Handle document deletion
  const handleDeleteDocument = async (documentId: string) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteVerificationDocument(documentId);
              if (error) {
                Alert.alert('Error', error.message);
                return;
              }
              // Reload documents
              await loadVerificationDocuments();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete document');
              console.error('Error deleting document:', error);
            }
          },
        },
      ]
    );
  };

  // Group documents by type
  const documentsByType = React.useMemo(() => {
    const grouped: Record<string, VerificationDocument[]> = {};
    verificationDocuments.forEach((doc) => {
      if (!grouped[doc.document_type_code]) {
        grouped[doc.document_type_code] = [];
      }
      grouped[doc.document_type_code].push(doc);
    });
    return grouped;
  }, [verificationDocuments]);

  const handlePickOfferBanner = async () => {
    const { uri, error } = await pickImage();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    if (uri) {
      setOfferBannerUri(uri);
    }
  };

  const handleCreateOffer = async () => {
    if (!offerTitle.trim() || !offerDescription.trim() || !offerValidUntil) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      let bannerUrl = null;

      if (offerBannerUri) {
        const { url, error } = await uploadOfferBanner(id, offerBannerUri);
        if (error) throw error;
        bannerUrl = url;
      }

      const offerData = {
        business_id: id,
        title: offerTitle,
        description: offerDescription,
        banner_image_url: bannerUrl,
        discount_percentage: offerDiscount ? parseInt(offerDiscount) : null,
        valid_until: offerValidUntil,
      };

      const { data, error } = await createOffer(offerData);
      if (error) throw error;

      setOffers([data!, ...offers]);
      resetOfferForm();
      setShowOfferModal(false);
      Alert.alert('Success', 'Offer created successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOffer = async () => {
    if (!editingOffer) return;

    try {
      setSubmitting(true);
      let bannerUrl = editingOffer.banner_image_url;

      if (offerBannerUri && offerBannerUri !== editingOffer.banner_image_url) {
        const { url, error } = await uploadOfferBanner(id, offerBannerUri);
        if (error) throw error;
        bannerUrl = url;
      }

      const offerData = {
        title: offerTitle,
        description: offerDescription,
        banner_image_url: bannerUrl,
        discount_percentage: offerDiscount ? parseInt(offerDiscount) : null,
        valid_until: offerValidUntil,
      };

      const { data, error } = await updateOffer(editingOffer.id, offerData);
      if (error) throw error;

      setOffers(offers.map((o) => (o.id === editingOffer.id ? data! : o)));
      resetOfferForm();
      setShowOfferModal(false);
      Alert.alert('Success', 'Offer updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffer = (offer: Offer) => {
    Alert.alert(
      'Delete Offer',
      'Are you sure you want to delete this offer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteOffer(offer.id);
              if (error) throw error;
              setOffers(offers.filter((o) => o.id !== offer.id));
              Alert.alert('Success', 'Offer deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete offer');
            }
          },
        },
      ]
    );
  };

  const handleUploadImage = async () => {
    if (images.length >= 20) {
      Alert.alert('Limit Reached', 'Maximum 20 images allowed per business');
      return;
    }

    const { uri, error } = await pickImage();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (uri) {
      try {
        setUploading(true);
        console.log('Starting image upload, URI:', uri);
        const { data, error: uploadError } = await uploadBusinessImage(id, uri);
        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }
        console.log('Upload successful, data:', data);
        
        // Reload images to get the persisted data
        await loadData();
        
        Alert.alert('Success', 'Image uploaded successfully');
      } catch (error: any) {
        console.error('Upload failed:', error);
        Alert.alert('Error', error.message || 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleUploadMultipleImages = async () => {
    const availableSlots = 20 - images.length;
    if (availableSlots === 0) {
      Alert.alert('Limit Reached', 'Maximum 20 images allowed per business');
      return;
    }

    const { uris, error } = await pickMultipleImages();
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    if (uris.length === 0) {
      return;
    }

    if (uris.length > availableSlots) {
      Alert.alert(
        'Too Many Images',
        `You can only upload ${availableSlots} more image(s). Currently at ${images.length}/20.`
      );
      return;
    }

    try {
      setUploadingMultiple(true);
      setUploadProgress({ current: 0, total: uris.length });

      const { results, successCount, error: uploadError } =
        await uploadMultipleBusinessImages(id, uris, (current, total) => {
          setUploadProgress({ current, total });
        });

      if (uploadError) throw uploadError;

      await loadData();

      const failCount = results.length - successCount;
      if (failCount === 0) {
        Alert.alert(
          'Success',
          `All ${successCount} images uploaded successfully!`
        );
      } else if (successCount === 0) {
        Alert.alert('Error', 'All uploads failed. Please try again.');
      } else {
        Alert.alert(
          'Partial Success',
          `${successCount} of ${results.length} images uploaded successfully. ${failCount} failed.`
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to upload images');
    } finally {
      setUploadingMultiple(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const handleDeleteImage = (image: PortfolioImage) => {
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await deleteBusinessImage(image.id);
              if (error) throw error;
              await loadData(); // Reload to get updated list
              Alert.alert('Success', 'Image deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete image');
            }
          },
        },
      ]
    );
  };

  const handleSetCoverImage = async (image: PortfolioImage) => {
    try {
      const { error } = await setCoverImage(id, image.id);
      if (error) throw error;
      await loadData(); // Reload to get updated list with cover status
      Alert.alert('Success', 'Cover image updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set cover image');
    }
  };

  const openOfferModal = (offer?: Offer) => {
    if (offer) {
      setEditingOffer(offer);
      setOfferTitle(offer.title);
      setOfferDescription(offer.description);
      setOfferBannerUri(offer.banner_image_url);
      setOfferValidUntil(offer.valid_until);
      setOfferDiscount(
        offer.discount_percentage ? offer.discount_percentage.toString() : ''
      );
    }
    setShowOfferModal(true);
  };

  const resetOfferForm = () => {
    setEditingOffer(null);
    setOfferTitle('');
    setOfferDescription('');
    setOfferBannerUri(null);
    setOfferValidUntil('');
    setOfferDiscount('');
  };

  const handleSaveDetails = async () => {
    // Validate PAN number is provided
    if (!editData.business_registration_number || !editData.business_registration_number.trim()) {
      Alert.alert('Validation Error', 'PAN is required. Please enter your PAN number.');
      setSavingDetails(false);
      return;
    }

    // Validate PAN document is uploaded
    const panDocs = documentsByType['pan'] || [];
    if (panDocs.length === 0) {
      Alert.alert('Validation Error', 'PAN card document is required. Please upload your PAN card.');
      setSavingDetails(false);
      return;
    }

    try {
      setSavingDetails(true);

      // Update business details
      const { data, error } = await updateBusinessDetails(id, editData);
      if (error) throw error;
      setBusiness(data);

      // Update category mappings
      // First, delete existing mappings
      const { error: deleteError } = await supabaseCore
        .from('vendor_business_category_mappings')
        .delete()
        .eq('business_id', id);

      if (deleteError) {
        console.error('Error deleting category mappings:', deleteError);
      }

      // Then, insert new mappings
      const categoryMappings: any[] = [];

      // Add selected business category IDs
      if (selectedCategoryIds.length > 0) {
        selectedCategoryIds.forEach((categoryId) => {
          categoryMappings.push({
            vendor_id: user?.id,
            business_id: id,
            category_id: categoryId,
          });
        });
      }

      // Add event category IDs
      if (selectedEventIds.length > 0) {
        selectedEventIds.forEach((categoryId) => {
          categoryMappings.push({
            vendor_id: user?.id,
            business_id: id,
            category_id: categoryId,
          });
        });
      }

      // Insert all category mappings in a single batch
      if (categoryMappings.length > 0) {
        const { error: mappingError } = await supabaseCore
          .from('vendor_business_category_mappings')
          .insert(categoryMappings);

        if (mappingError) {
          console.error('Error inserting category mappings:', mappingError);
        }
      }

      Alert.alert('Success', 'Business details updated successfully');
      await loadData(); // Reload to refresh the display
      await loadVerificationDocuments(); // Reload documents
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update business details');
    } finally {
      setSavingDetails(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  const renderOfferCard = (offer: Offer) => (
    <View key={offer.id} style={styles.offerCard}>
      {offer.banner_image_url && (
        <Image
          source={{ uri: offer.banner_image_url }}
          style={styles.offerBanner}
          resizeMode="cover"
        />
      )}
      <View style={styles.offerContent}>
        <View style={styles.offerHeader}>
          <Text style={styles.offerTitle} numberOfLines={2}>
            {offer.title}
          </Text>
          {offer.discount_percentage && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{offer.discount_percentage}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.offerDescription} numberOfLines={3}>
          {offer.description}
        </Text>
        <View style={styles.offerFooter}>
          <View style={styles.offerDate}>
            <Calendar size={16} color="#666" />
            <Text style={[styles.offerDateText, isExpired(offer.valid_until) && styles.expiredText]}>
              Valid until {formatDate(offer.valid_until)}
            </Text>
          </View>
          <View style={styles.offerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => openOfferModal(offer)}
            >
              <Edit size={20} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => handleDeleteOffer(offer)}
            >
              <Trash2 size={20} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const renderImageItem = ({ item }: { item: PortfolioImage }) => {
    const imageSource = item.image_base64 || item.image_url;
    const isCover = item.image_type === 'cover';

    return (
      <TouchableOpacity
        style={styles.imageGridItem}
        onPress={() => {
          setPreviewImageUrl(imageSource);
          setShowImagePreview(true);
        }}
      >
        <Image source={{ uri: imageSource || undefined }} style={styles.galleryImage} />
        {isCover && (
          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>Cover</Text>
          </View>
        )}
        <View style={styles.imageActions}>
          {!isCover && (
            <TouchableOpacity
              style={[styles.imageActionButton, styles.setCoverButton]}
              onPress={() => handleSetCoverImage(item)}
            >
              <Tag size={14} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.imageActionButton, styles.deleteImageButton]}
            onPress={() => handleDeleteImage(item)}
          >
            <Trash2 size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Business not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* <LinearGradient
        colors={[Colors.neutral.white, Colors.neutral.white]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      > */}
                  <View style={[styles.header, { backgroundColor: 'rgba(138, 151, 209, 0.02)' }, { paddingTop: insets.top + 20, paddingLeft: insets.top + 15, backgroundColor: '#fff' }]}>

        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
          >
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <Logo size={48} style={{ ...styles.headerLogo, transform: [{ scale: 1.3}] }} />
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {business.business_name}
            </Text>
            <Text style={styles.headerSubtitle}>
              {business.vendor_service_category}
            </Text>
          </View>
        </View>
        {/* </LinearGradient> */}
        </View>
        <View style={styles.tabContainer}>
          {/*
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === 'offers' && styles.activeTab,
            ]}
            onPress={() => setActiveSection('offers')}
          >
            <Tag size={20} color={activeSection === 'offers' ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text
              style={[
                styles.tabText,
                activeSection === 'offers' && styles.activeTabText,
              ]}
            >
              Offers
            </Text>
          </TouchableOpacity>
          */}
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === 'gallery' && styles.activeTab,
            ]}
            onPress={() => setActiveSection('gallery')}
          >
            <ImageIcon size={20} color={activeSection === 'gallery' ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text
              style={[
                styles.tabText,
                activeSection === 'gallery' && styles.activeTabText,
              ]}
              numberOfLines={1}
            >
              Gallery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === 'packages' && styles.activeTab,
            ]}
            onPress={() => setActiveSection('packages')}
          >
            <Package size={20} color={activeSection === 'packages' ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text
              style={[
                styles.tabText,
                activeSection === 'packages' && styles.activeTabText,
              ]}
              numberOfLines={1}
            >
              Packages
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeSection === 'edit' && styles.activeTab,
            ]}
            onPress={() => setActiveSection('edit')}
          >
            <Edit size={20} color={activeSection === 'edit' ? '#fff' : 'rgba(255,255,255,0.7)'} />
            <Text
              style={[
                styles.tabText,
                activeSection === 'edit' && styles.activeTabText,
              ]}
              numberOfLines={1}
            >
              Edit Details
            </Text>
          </TouchableOpacity>
        </View>
     

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
  
        {/*activeSection === 'offers' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Offers & Promotions</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => openOfferModal()}
              >
                <Plus size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add Offer</Text>
              </TouchableOpacity>
            </View>

            {offers.length === 0 ? (
              <View style={styles.emptyState}>
                <Tag size={48} color="#ddd" />
                <Text style={styles.emptyStateTitle}>No Offers Yet</Text>
                <Text style={styles.emptyStateText}>
                  Create promotional offers to attract more customers
                </Text>
              </View>
            ) : (
              <View style={styles.offersGrid}>
                {offers.map((offer) => renderOfferCard(offer))}
              </View>
            )}
          </View>
        )*/}
      

        {activeSection === 'gallery' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Business Gallery</Text>
              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[styles.addButton, styles.smallButton]}
                  onPress={handleUploadImage}
                  disabled={uploading || uploadingMultiple || images.length >= 20}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Plus size={18} color="#fff" />
                      <Text style={styles.smallButtonText}>Single</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addButton, styles.smallButton]}
                  onPress={handleUploadMultipleImages}
                  disabled={uploading || uploadingMultiple || images.length >= 20}
                >
                  {uploadingMultiple ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <ImageIcon size={18} color="#fff" />
                      <Text style={styles.smallButtonText}>Multiple</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {uploadingMultiple && (
              <View style={styles.progressContainer}>
                <Text style={styles.progressText}>
                  Uploading {uploadProgress.current} of {uploadProgress.total} images...
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <Text style={styles.imageCounter}>
              {images.length}/20 images uploaded
            </Text>

            {images.length === 0 ? (
              <View style={styles.emptyState}>
                <ImageIcon size={48} color="#ddd" />
                <Text style={styles.emptyStateTitle}>No Images Yet</Text>
                <Text style={styles.emptyStateText}>
                  Upload images to showcase your work
                </Text>
              </View>
            ) : (
              <FlatList
                data={images}
                renderItem={renderImageItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                columnWrapperStyle={styles.imageRow}
                scrollEnabled={false}
              />
            )}
          </View>
        )}

        {activeSection === 'packages' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pricing Packages</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => router.push({
                  pathname: '/package-form',
                  params: { businessId: id },
                })}
              >
                <Plus size={20} color="#fff" />
                <Text style={styles.addButtonText}>Add Package</Text>
              </TouchableOpacity>
            </View>
            {loadingPackages ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary.main} />
              </View>
            ) : packages.length === 0 ? (
              <View style={styles.emptyState}>
                <Package size={48} color={Colors.text.tertiary} />
                <Text style={styles.emptyStateText}>No packages yet</Text>
                <Text style={styles.emptyStateSubtext}>
                  Create your first pricing package to get started
                </Text>
              </View>
            ) : (
              <PackageList
                packages={packages}
                onEdit={handleEditPackage}
                onDelete={handleDeletePackage}
                onToggleStatus={() => {}} // Not used anymore, but required by interface
                loading={loadingPackages}
              />
            )}
          </View>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowDeleteModal(false);
            setPackageToDelete(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete Package</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to delete "{packageToDelete?.package_name || 'this package'}"? This will mark it as inactive and hide it from the list.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowDeleteModal(false);
                    setPackageToDelete(null);
                  }}
                  disabled={deleting}
                >
                  <Text style={styles.modalButtonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonDelete]}
                  onPress={confirmDeletePackage}
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalButtonDeleteText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {activeSection === 'edit' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Edit Business Details</Text>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Basic Information</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Business Name</Text>
                <TextInput
                  style={styles.editInput}
                  value={editData.business_name || ''}
                  onChangeText={(text) => setEditData({ ...editData, business_name: text })}
                  placeholder="Enter business name"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  onSubmitEditing={() => contactPersonNameRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Contact Person Name</Text>
                <TextInput
                  ref={contactPersonNameRef}
                  style={styles.editInput}
                  value={editData.contact_person_name || ''}
                  onChangeText={(text) => setEditData({ ...editData, contact_person_name: text })}
                  placeholder="Enter contact person name"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  onSubmitEditing={() => contactPersonRoleRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Contact Person Role</Text>
                <TextInput
                  ref={contactPersonRoleRef}
                  style={styles.editInput}
                  value={editData.contact_person_role || ''}
                  onChangeText={(text) => setEditData({ ...editData, contact_person_role: text })}
                  placeholder="e.g., Owner, Manager, Director"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  onSubmitEditing={() => businessEmailRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Email</Text>
                <TextInput
                  ref={businessEmailRef}
                  style={styles.editInput}
                  value={editData.business_email || ''}
                  onChangeText={(text) => setEditData({ ...editData, business_email: text })}
                  placeholder="Enter email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => contactPersonPhoneRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Phone Number</Text>
                <TextInput
                  ref={contactPersonPhoneRef}
                  style={styles.editInput}
                  value={editData.contact_person_phone || ''}
                  onChangeText={(text) => setEditData({ ...editData, contact_person_phone: text })}
                  placeholder="Enter phone number"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => businessDescriptionRef.current?.focus()}
                />
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Services & Experience</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Service Category *</Text>
                
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
                      style={styles.categoryModalContent}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <View style={styles.categoryModalHeader}>
                        <Text style={styles.categoryModalTitle}>Select Service Category</Text>
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

                      <View style={styles.categoryModalFooter}>
                        <TouchableOpacity
                          style={styles.categoryModalButton}
                          onPress={() => setIsCategoryModalOpen(false)}
                        >
                          <Text style={styles.modalButtonText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Event Types *</Text>
                
                {/* Event Dropdown Trigger */}
                <TouchableOpacity
                  style={styles.dropdownTrigger}
                  onPress={() => setIsEventModalOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownText, selectedEventsWithPaths.length === 0 && styles.placeholder]}>
                    {getEventDropdownDisplayText()}
                  </Text>
                  <ChevronDown size={20} color="#666" />
                </TouchableOpacity>

                {/* Selected Events Display */}
                {selectedEventsWithPaths.length > 0 && (
                  <View style={styles.selectedContainer}>
                    <Text style={styles.selectedLabel}>
                      Selected Events ({selectedEventsWithPaths.length}):
                    </Text>
                    {selectedEventsWithPaths.map((item) => {
                      const eventCategory = allEventCategories.find((c) => c.id === item.id);
                      return (
                        <View key={item.id} style={styles.selectedChip}>
                          <Text style={styles.selectedChipText}>
                            {eventCategory?.icon ? `${eventCategory.icon} ` : ''}
                            {item.path}
                          </Text>
                          <TouchableOpacity
                            onPress={() => toggleEventSelection(item.id)}
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
                      style={styles.categoryModalContent}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <View style={styles.categoryModalHeader}>
                        <Text style={styles.categoryModalTitle}>Select Event Types</Text>
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

                      <View style={styles.categoryModalFooter}>
                        <TouchableOpacity
                          style={styles.categoryModalButton}
                          onPress={() => setIsEventModalOpen(false)}
                        >
                          <Text style={styles.modalButtonText}>Done</Text>
                        </TouchableOpacity>
                      </View>
                    </Pressable>
                  </Pressable>
                </Modal>
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Business Description</Text>
                <TextInput
                  ref={businessDescriptionRef}
                  style={[styles.editInput, styles.textArea]}
                  value={editData.description || ''}
                  onChangeText={(text) => setEditData({ ...editData, description: text })}
                  placeholder="Describe your business"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  returnKeyType="next"
                  onSubmitEditing={() => addressRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Years of Experience *</Text>
                <Dropdown
                  options={EXPERIENCE_OPTIONS.map((exp) => ({
                    label: exp,
                    value: exp,
                  }))}
                  value={getExperienceDisplayValue(editData.years_experience)}
                  placeholder="Select experience"
                  onChange={(value: string) => setEditData({ ...editData, years_experience: parseExperienceToNumber(value) })}
                />
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Location</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Business Address</Text>
                <TextInput
                  ref={addressRef}
                  style={styles.editInput}
                  value={editData.address || ''}
                  onChangeText={(text) => setEditData({ ...editData, address: text })}
                  placeholder="Enter business address"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  onSubmitEditing={() => pincodeRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Pincode *</Text>
                <View style={styles.inputWithStatus}>
                  <TextInput
                    ref={pincodeRef}
                    style={[
                      styles.editInput,
                      styles.pincodeInput,
                      pincodeStatus === 'valid' && styles.inputValid,
                      pincodeStatus === 'invalid' && styles.inputInvalid,
                    ]}
                    value={editData.pincode || ''}
                    onChangeText={(text) => {
                      const cleanText = text.replace(/\D/g, '');
                      setEditData({ ...editData, pincode: cleanText });
                      if (pincodeStatus !== 'idle') {
                        setPincodeStatus('idle');
                        setPincodeError(null);
                        setCityOptions([]);
                      }
                    }}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      if (cityOptions.length === 0 || cityOptions.length === 1) {
                        cityRef.current?.focus();
                      } else {
                        localityRef.current?.focus();
                      }
                    }}
                    onBlur={async () => {
                      const pincode = editData.pincode;
                      if (!pincode || pincode.length !== 6) {
                        if (pincode && pincode.length > 0 && pincode.length < 6) {
                          setPincodeStatus('invalid');
                          setPincodeError('Pincode must be 6 digits');
                        }
                        return;
                      }
                      setValidatingPincode(true);
                      setPincodeError(null);
                      try {
                        const result = await validatePincode(pincode);
                        if (result.valid) {
                          setPincodeStatus('valid');
                          // Set city options for dropdown
                          if (result.cityOptions && result.cityOptions.length > 0) {
                            setCityOptions(result.cityOptions);
                          }
                          // Auto-fill: city = Name, locality = District
                          if (result.city) {
                            setEditData((prev: any) => ({ ...prev, city: result.city }));
                          }
                          if (result.locality) {
                            setEditData((prev: any) => ({ ...prev, locality: result.locality }));
                          }
                          if (result.state) {
                            setEditData((prev: any) => ({ ...prev, state: result.state }));
                          }
                        } else {
                          setPincodeStatus('invalid');
                          setPincodeError(result.error || 'Invalid pincode');
                          setCityOptions([]);
                        }
                      } catch (error) {
                        setPincodeStatus('invalid');
                        setPincodeError('Failed to validate pincode');
                        setCityOptions([]);
                      } finally {
                        setValidatingPincode(false);
                      }
                    }}
                    placeholder="Enter 6-digit pincode"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <View style={styles.statusIcon}>
                    {validatingPincode && (
                      <ActivityIndicator size="small" color="#007AFF" />
                    )}
                    {!validatingPincode && pincodeStatus === 'valid' && (
                      <Check size={20} color="#34C759" />
                    )}
                    {!validatingPincode && pincodeStatus === 'invalid' && (
                      <AlertCircle size={20} color="#FF3B30" />
                    )}
                  </View>
                </View>
                {pincodeError && (
                  <Text style={styles.pincodeErrorText}>{pincodeError}</Text>
                )}
                {pincodeStatus === 'valid' && (
                  <Text style={styles.pincodeSuccessText}>
                    Pincode verified - Location details auto-filled
                  </Text>
                )}
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>City/Town</Text>
                {cityOptions.length > 1 ? (
                  <View style={styles.cityDropdown}>
                    {cityOptions.map((city) => (
                      <Pressable
                        key={city}
                        style={[
                          styles.cityOption,
                          editData.city === city && styles.cityOptionSelected,
                        ]}
                        onPress={() => setEditData({ ...editData, city })}
                      >
                        <Text
                          style={[
                            styles.cityOptionText,
                            editData.city === city && styles.cityOptionTextSelected,
                          ]}
                        >
                          {city}
                        </Text>
                        {editData.city === city && (
                          <Check size={16} color="#007AFF" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    ref={cityRef}
                    style={styles.editInput}
                    value={editData.city || ''}
                    onChangeText={(text) => setEditData({ ...editData, city: text })}
                    placeholder="Enter city/town"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onSubmitEditing={() => localityRef.current?.focus()}
                  />
                )}
                {cityOptions.length > 1 && (
                  <Text style={styles.editHint}>Select from available options for this pincode</Text>
                )}
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Locality/District</Text>
                <TextInput
                  ref={localityRef}
                  style={styles.editInput}
                  value={editData.locality || ''}
                  onChangeText={(text) => setEditData({ ...editData, locality: text })}
                  placeholder="Enter locality/district"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  onSubmitEditing={() => stateRef.current?.focus()}
                />
                <Text style={styles.editHint}>Auto-filled from pincode (editable)</Text>
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>State</Text>
                <TextInput
                  ref={stateRef}
                  style={styles.editInput}
                  value={editData.state || ''}
                  onChangeText={(text) => setEditData({ ...editData, state: text })}
                  placeholder="Enter state"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  onSubmitEditing={() => serviceRadiusRef.current?.focus()}
                />
                <Text style={styles.editHint}>Auto-filled from pincode (editable)</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Service Radius (km)</Text>
                <TextInput
                  ref={serviceRadiusRef}
                  style={styles.input}
                  value={editData.service_radius_km?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setEditData({ ...editData, service_radius_km: num });
                  }}
                  placeholder="Enter service radius in kilometers"
                  returnKeyType="next"
                  onSubmitEditing={() => gstNumberRef.current?.focus()}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Verification</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>GST Number</Text>
                <TextInput
                  ref={gstNumberRef}
                  style={styles.editInput}
                  value={editData.gst_number || ''}
                  onChangeText={(text) => setEditData({ ...editData, gst_number: text })}
                  placeholder="Enter GST number"
                  placeholderTextColor="#999"
                  returnKeyType="next"
                  onSubmitEditing={() => panRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>PAN *</Text>
                <Text style={styles.editHint}>Required - Permanent Account Number</Text>
                <TextInput
                  ref={panRef}
                  style={styles.editInput}
                  value={editData.business_registration_number || ''}
                  onChangeText={(text) => setEditData({ ...editData, business_registration_number: text })}
                  placeholder="Enter PAN (e.g., ABCDE1234F)"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  maxLength={10}
                  returnKeyType="next"
                  onSubmitEditing={() => websiteUrlRef.current?.focus()}
                />
              </View>

              {/* Verification Documents Section */}
              <View style={styles.editField}>
                <Text style={styles.editLabel}>Verification Documents</Text>
                <Text style={styles.editHint}>
                  PAN card document is required. Upload images (jpg, png) or PDF files (max 10MB each)
                </Text>

                {/* Document Types - PAN Card first and mandatory */}
                {[
                  { code: 'pan', name: 'PAN Card', mandatory: true },
                  { code: 'gst', name: 'GST Certificate', mandatory: false },
                  { code: 'aadhaar', name: 'Aadhaar Card', mandatory: false },
                  { code: 'bank_statement', name: 'Bank Statement', mandatory: false },
                  { code: 'general', name: 'General Document', mandatory: false },
                  { code: 'business_license', name: 'Business License', mandatory: false },
                ].map((docType) => {
                  const docs = documentsByType[docType.code] || [];
                  const isUploading = uploadingDocument === docType.code;

                  return (
                    <View key={docType.code} style={[styles.documentTypeSection, docType.mandatory && styles.mandatoryDocumentSection]}>
                      <View style={styles.documentTypeHeader}>
                        <View style={styles.documentTypeLabelContainer}>
                          <Text style={styles.documentTypeName}>{docType.name} {docType.mandatory ? '*' : ''}</Text>
                          {docType.mandatory && (
                            <Text style={styles.mandatoryDocumentHint}>Required</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[styles.addDocumentButton, isUploading && styles.addDocumentButtonDisabled]}
                          onPress={() => handleUploadDocument(docType.code)}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <ActivityIndicator size="small" color="#007AFF" />
                          ) : (
                            <Upload size={16} color="#007AFF" />
                          )}
                          <Text style={styles.addDocumentButtonText}>
                            {isUploading ? 'Uploading...' : 'Add'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Display documents */}
                      {docs.length > 0 && (
                        <View style={styles.documentsList}>
                          {docs.map((doc) => (
                            <View key={doc.id} style={styles.documentItem}>
                              {isImageFile(doc.mime_type || '') && doc.file_url ? (
                                <Image source={{ uri: doc.file_url }} style={styles.documentThumbnail} />
                              ) : (
                                <View style={styles.documentIcon}>
                                  <FileText size={20} color="#666" />
                                </View>
                              )}
                              <View style={styles.documentInfo}>
                                <Text style={styles.documentName} numberOfLines={1}>
                                  {doc.file_name || 'Document'}
                                </Text>
                                <Text style={styles.documentStatus}>
                                  Status: {doc.verification_status}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.deleteDocumentButton}
                                onPress={() => handleDeleteDocument(doc.id)}
                              >
                                <X size={16} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Social Media</Text>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Website URL</Text>
                <TextInput
                  ref={websiteUrlRef}
                  style={styles.editInput}
                  value={editData.website_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, website_url: text })}
                  placeholder="https://www.yourbusiness.com"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                  onSubmitEditing={() => instagramUrlRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Instagram URL</Text>
                <TextInput
                  ref={instagramUrlRef}
                  style={styles.editInput}
                  value={editData.instagram_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, instagram_url: text })}
                  placeholder="https://instagram.com/yourbusiness"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                  onSubmitEditing={() => facebookUrlRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>Facebook URL</Text>
                <TextInput
                  ref={facebookUrlRef}
                  style={styles.editInput}
                  value={editData.facebook_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, facebook_url: text })}
                  placeholder="https://facebook.com/yourbusiness"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                  onSubmitEditing={() => youtubeUrlRef.current?.focus()}
                />
              </View>

              <View style={styles.editField}>
                <Text style={styles.editLabel}>YouTube URL</Text>
                <TextInput
                  ref={youtubeUrlRef}
                  style={styles.editInput}
                  value={editData.youtube_url || ''}
                  onChangeText={(text) => setEditData({ ...editData, youtube_url: text })}
                  placeholder="https://youtube.com/@yourbusiness"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="done"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, savingDetails && styles.saveButtonDisabled]}
              onPress={handleSaveDetails}
              disabled={savingDetails}
            >
              {savingDetails ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showOfferModal}
        animationType="slide"
        onRequestClose={() => {
          resetOfferForm();
          setShowOfferModal(false);
        }}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingOffer ? 'Edit Offer' : 'Create Offer'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                resetOfferForm();
                setShowOfferModal(false);
              }}
            >
              <X size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.field}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={offerTitle}
                onChangeText={setOfferTitle}
                placeholder="Enter offer title"
                maxLength={100}
              />
              <Text style={styles.charCount}>{offerTitle.length}/100</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={offerDescription}
                onChangeText={setOfferDescription}
                placeholder="Enter offer description"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
              <Text style={styles.charCount}>{offerDescription.length}/500</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Banner Image</Text>
              <TouchableOpacity
                style={styles.imagePicker}
                onPress={handlePickOfferBanner}
              >
                {offerBannerUri ? (
                  <Image
                    source={{ uri: offerBannerUri }}
                    style={styles.pickerPreview}
                  />
                ) : (
                  <>
                    <ImageIcon size={32} color="#666" />
                    <Text style={styles.pickerText}>Select Banner Image</Text>
                    <Text style={styles.pickerHint}>JPG or PNG, max 5MB</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Discount Percentage</Text>
              <TextInput
                style={styles.input}
                value={offerDiscount}
                onChangeText={setOfferDiscount}
                placeholder="e.g., 20"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Valid Until *</Text>
              <TextInput
                style={styles.input}
                value={offerValidUntil}
                onChangeText={setOfferValidUntil}
                placeholder="YYYY-MM-DD"
              />
              <Text style={styles.fieldHint}>
                Enter future date in YYYY-MM-DD format
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                resetOfferForm();
                setShowOfferModal(false);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalButton,
                styles.submitButton,
                submitting && styles.buttonDisabled,
              ]}
              onPress={editingOffer ? handleUpdateOffer : handleCreateOffer}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingOffer ? 'Update' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showImagePreview}
        animationType="fade"
        transparent
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View style={styles.previewContainer}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setShowImagePreview(false)}
          >
            <X size={32} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
 
    gap: 12,
  },
  headerLogo: {
    marginLeft: 2,
    marginVertical: 0,
  },
  backButton: {
    width: 15,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#52aad9',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minWidth: 0, // Allow flex shrinking on iOS
    gap: 6,
  },
  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    flexShrink: 1, // Allow text to shrink on iOS if needed
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
    minWidth: 120,
    marginRight: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  imageCounter: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  progressContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
  offersGrid: {
    gap: 16,
  },
  offerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  offerBanner: {
    width: '100%',
    height: 160,
  },
  offerContent: {
    padding: 16,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  offerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginRight: 12,
  },
  discountBadge: {
    backgroundColor: '#34C759',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  discountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  offerDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  offerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerDateText: {
    fontSize: 13,
    color: '#666',
  },
  expiredText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  offerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageRow: {
    gap: 8,
    marginBottom: 8,
  },
  imageGridItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  deleteImageButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 2,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  imageActions: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    flexDirection: 'row',
    gap: 4,
    zIndex: 2,
  },
  imageActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  setCoverButton: {
    backgroundColor: 'rgba(37, 99, 235, 0.8)',
  },
  editSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  editSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  editInput: {
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
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  comingSoonText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  categoryModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  categoryModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
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
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  imagePicker: {
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  pickerPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  pickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  pickerHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  fieldHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  previewImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
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
    padding: 20,
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
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
  },
  modalCategoryTree: {
    maxHeight: 350,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryModalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  categoryModalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
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
  editHint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  inputWithStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  pincodeInput: {
    flex: 1,
    paddingRight: 44,
  },
  inputValid: {
    borderColor: '#34C759',
    backgroundColor: '#f0fff4',
  },
  inputInvalid: {
    borderColor: '#FF3B30',
    backgroundColor: '#fff5f5',
  },
  statusIcon: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  packagesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 12,
  },
  packagesCardContent: {
    flex: 1,
  },
  packagesCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  packagesCardText: {
    fontSize: 14,
    color: '#666',
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
    padding: 24,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  modalButtonCancel: {
    backgroundColor: '#f0f0f0',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonDelete: {
    backgroundColor: '#FF3B30',
  },
  modalButtonDeleteText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  pincodeErrorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  pincodeSuccessText: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 4,
  },
  cityDropdown: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cityOptionSelected: {
    backgroundColor: '#f0f7ff',
  },
  cityOptionText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  cityOptionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  documentTypeSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mandatoryDocumentSection: {
    backgroundColor: '#fff9e6',
    borderColor: '#cc6600',
  },
  documentTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  documentTypeLabelContainer: {
    flex: 1,
  },
  documentTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  mandatoryDocumentHint: {
    fontSize: 12,
    color: '#cc6600',
    fontWeight: '500',
    marginTop: 2,
  },
  addDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f7ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  addDocumentButtonDisabled: {
    opacity: 0.6,
  },
  addDocumentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  documentsList: {
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  documentThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  documentStatus: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  deleteDocumentButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
