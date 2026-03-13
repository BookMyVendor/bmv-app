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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
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
  MoreVertical,
  Search,
  WifiOff,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabaseCore } from '../lib/supabase';
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
} from '../lib/businessApi';
import { pickDocuments, DocumentFile, isImageFile, isPdfFile } from '../lib/documentUpload';
import { validatePincode } from '../lib/pincodeValidation';
import { validateEmail, getEmailError } from '../lib/validation';
import { stripCountryCode } from '../lib/formatters';
import Dropdown from '../components/Dropdown';
import ScreenBackground from '../components/ScreenBackground';

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

const PRICING_MAPPING: Record<string, string[]> = {
  // Caterer
  'Cat': ['Per plate', 'Per live counter'],

  // Decoration
  'Decor': ['Per day', 'Per event'],

  // Photography
  'Photo': ['Per hour', 'Per event', 'Cinematography'],

  // Sound & Music
  'Sound': ['Per event', 'Per hour'],

  // Artist
  'Artist': ['Per hour', 'Per person'],

  // Transport
  'Transport': ['Per event', 'Per km'],

  // Housekeeping & Security
  'Housekeeping': ['Per security personnel', 'Per hour'],

  // Venues
  'Venue': ['Per day'],

  // Cakes
  'Cake': ['Per kg', 'Customized'],

  // Priest
  'Priest': ['Per event'],

  // Rentals
  'Rental': ['Per event'],

  // Event Management Companies
  'Event Management': ['Per event'],
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
  const [isOffline, setIsOffline] = useState(false);

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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [verificationDocuments, setVerificationDocuments] = useState<VerificationDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<string | null>(null); // document type code
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [defaultPackageId, setDefaultPackageId] = useState<string | null>(null);
  const [activeMenuImageId, setActiveMenuImageId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleFieldFocus = () => {
    // Removed scrollToEnd call that was causing the screen to jump to the bottom
    // when any field was focused. KeyboardAvoidingView and ScrollView 
    // will handle focus visibility naturally.
  };

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
  const [isRootDropdownOpen, setIsRootDropdownOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isPricingUnitDropdownOpen, setIsPricingUnitDropdownOpen] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isEventsExpanded, setIsEventsExpanded] = useState(false);
  const [businessType, setBusinessType] = useState<'services' | 'rental'>('services');

  // Temporary modal state - only committed when Done is clicked
  const [tempSelectedRootCategoryId, setTempSelectedRootCategoryId] = useState<string | null>(null);
  const [tempSelectedCategoryIds, setTempSelectedCategoryIds] = useState<string[]>([]);
  const [tempSelectedEventIds, setTempSelectedEventIds] = useState<string[]>([]);

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  // Pincode validation state
  const [validatingPincode, setValidatingPincode] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [emailError, setEmailError] = useState<string | null>(null);

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
  const gstNumberRef = useRef<TextInput>(null);
  const panRef = useRef<TextInput>(null);
  const websiteUrlRef = useRef<TextInput>(null);
  const instagramUrlRef = useRef<TextInput>(null);
  const facebookUrlRef = useRef<TextInput>(null);
  const youtubeUrlRef = useRef<TextInput>(null);

  const toggleCitySelection = (city: string) => {
    setEditData((prev: any) => {
      const current = prev.operating_locations || [];

      if (city === 'Pan India') {
        if (current.includes('*')) {
          return { ...prev, operating_locations: [], availability: '' };
        } else {
          return { ...prev, operating_locations: ['*'], availability: '*' };
        }
      }

      let newLocations = current.filter((c: string) => c !== '*');
      let newAvailability = prev.availability === '*' ? '' : prev.availability;

      if (newLocations.includes(city)) {
        return {
          ...prev,
          operating_locations: newLocations.filter((c: string) => c !== city),
          availability: newAvailability
        };
      } else {
        return {
          ...prev,
          operating_locations: [...newLocations, city],
          availability: newAvailability
        };
      }
    });
  };

  const filteredCities = OPERATING_CITIES.filter(city =>
    city.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

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

      // Check cache first
      try {
        const cachedBusiness = await AsyncStorage.getItem(`business_details_${id}`);
        if (cachedBusiness) {
          const parsedBusiness = JSON.parse(cachedBusiness);
          setBusiness(parsedBusiness);
          const dataToEdit = parsedBusiness ? { ...parsedBusiness } : {};
          if (dataToEdit.contact_person_phone) {
            dataToEdit.contact_person_phone = stripCountryCode(dataToEdit.contact_person_phone);
          }
          setEditData(dataToEdit);
          setLoading(false); // Stop loading so user sees cached data immediately
        }
      } catch (cacheError) {
        console.error("Cache read error:", cacheError);
      }

      // 1. Fetch core business details FIRST and render immediately
      const businessRes = await getBusinessDetails(id);

      if (businessRes.error) throw businessRes.error;

      setBusiness(businessRes.data);
      setIsOffline(false);
      try {
        AsyncStorage.setItem(`business_details_${id}`, JSON.stringify(businessRes.data));
      } catch (e) {}

      const dataToEdit = businessRes.data ? { ...businessRes.data } : {};
      if (dataToEdit.contact_person_phone) {
        dataToEdit.contact_person_phone = stripCountryCode(dataToEdit.contact_person_phone);
      }
      setEditData(dataToEdit);

      // CRITICAL: Stop loading here so the user sees the page content
      setLoading(false);

      // 2. Fetch everything else in parallel/sequence without blocking UI
      const [offersRes, imagesRes] = await Promise.all([
        getOffers(id),
        getBusinessImages(id),
      ]);

      if (offersRes.error) console.error('Error fetching offers:', offersRes.error);
      setOffers(offersRes.data || []);

      if (imagesRes.error) console.error('Error fetching images:', imagesRes.error);

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

      // Load existing category mappings (this will determine businessType)
      const { businessIds, businessType: determinedType } = await loadCategoryMappings();

      // Load categories using the determined businessType
      const fetchedBusinessCategories = await loadCategories(determinedType);

      // After mappings are loaded, determine root category
      if (businessIds.length > 0) {
        const selectedCats = fetchedBusinessCategories.filter((cat: any) =>
          businessIds.includes(cat.id)
        );

        // Find the root parent for the first selected category
        const firstSelectedCat = selectedCats[0];
        if (firstSelectedCat) {
          let current = firstSelectedCat;
          // Traverse up to find the root
          while (current.parent_category_id) {
            const parent = fetchedBusinessCategories.find((c: any) => c.id === current.parent_category_id);
            if (!parent) break;
            current = parent;
          }

          if (current) {
            setSelectedRootCategoryId(current.id);
            setExpandedCategoryIds(new Set([current.id]));
          }
        }
      }

      // Load verification documents
      await loadVerificationDocuments();

      // Load packages and extract price info
      // We manually call getBusinessPackages here so we can use the result immediately
      const { getBusinessPackages } = await import('../lib/packageApi');
      const { data: packagesData } = await getBusinessPackages(id);

      const activePackages = (packagesData || []).filter((pkg: any) => pkg.is_active !== false);
      setPackages(activePackages);

      // If we have any packages, use the first one's price/unit for the edit form
      // If we have a 'Standard Package', prefer that
      let defaultPkg = activePackages.find((p: any) => p.package_name === 'Standard Package');
      if (!defaultPkg && activePackages.length > 0) {
        defaultPkg = activePackages[0];
      }

      if (defaultPkg) {
        setDefaultPackageId(defaultPkg.id ?? null);
        setEditData((prev: any) => ({
          ...prev,
          base_price: defaultPkg.base_price,
          pricing_unit: defaultPkg.price_unit
        }));
      } else {
        setDefaultPackageId(null);
      }
    } catch (error: any) {
      console.error('Error loading business data:', error);
      setIsOffline(true);
      // Only show alert if we haven't loaded the business yet (from cache), otherwise it's a minor error
      if (!business) {
        Alert.alert('Error', error.message || 'Failed to load business details');
      }
    } finally {
      // Ensure specific loading states are off
      if (!business) setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategoryMappings = async (): Promise<{ businessIds: string[]; eventIds: string[]; businessType: 'services' | 'rental' }> => {
    try {
      const { data: mappings, error } = await supabaseCore
        .from('vendor_business_category_mappings')
        .select('category_id')
        .eq('business_id', id);

      if (error) {
        console.error('Error loading category mappings:', error);
        return { businessIds: [], eventIds: [], businessType: 'services' };
      }

      let determinedBusinessType: 'services' | 'rental' = 'services';

      if (mappings && mappings.length > 0) {
        const allCategoryIds = mappings.map((m) => m.category_id);

        // Fetch categories to determine their types and business model
        const { data: categories, error: catError } = await supabaseCore
          .from('categories')
          .select('id, category_type, category_level, parent_category_id, business_model')
          .in('id', allCategoryIds);

        if (catError) {
          console.error('Error loading categories:', catError);
          return { businessIds: [], eventIds: [], businessType: 'services' };
        }

        // Separate business and event categories
        const businessCategoryIds: string[] = [];
        const eventCategoryIds: string[] = [];

        categories?.forEach((cat) => {
          if (cat.category_type === 'business') {
            businessCategoryIds.push(cat.id);
            // Dynamic logic: if ANY category is rental, business type is rental
            if (cat.business_model === 'rental') {
              determinedBusinessType = 'rental';
            }
          } else if (cat.category_type === 'event') {
            eventCategoryIds.push(cat.id);
          }
        });

        setBusinessType(determinedBusinessType);
        setEditData((prev: any) => ({ ...prev, businessType: determinedBusinessType }));
        setSelectedCategoryIds(businessCategoryIds);
        setSelectedEventIds(eventCategoryIds);

        return { 
          businessIds: businessCategoryIds, 
          eventIds: eventCategoryIds, 
          businessType: determinedBusinessType 
        };
      }

      setBusinessType('services');
      return { businessIds: [], eventIds: [], businessType: 'services' };
    } catch (error) {
      console.error('Error loading category mappings:', error);
      return { businessIds: [], eventIds: [], businessType: 'services' };
    }
  };



  const loadCategories = async (type?: 'services' | 'rental') => {
    let businessCatsResult: any[] = [];
    try {
      setLoadingCategories(true);

      // Fetch all business categories with hierarchy info
      let businessQuery = supabaseCore
        .from('categories')
        .select('id, name, icon, parent_category_id, category_level, sort_order')
        .eq('category_type', 'business')
        .eq('visible', true);

      // If rental type is selected, filter by business_model = 'rental'
      if (type === 'rental') {
        businessQuery = businessQuery.eq('business_model', 'rental');
      }

      const { data: businessCats, error: businessError } = await businessQuery
        .order('sort_order', { ascending: true });

      if (businessError) {
        console.error('Error fetching business categories:', businessError);
      } else {
        businessCatsResult = businessCats || [];
        setAllBusinessCategories(businessCatsResult);
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
    return businessCatsResult;
  };

  const handleBusinessTypeChange = (type: 'services' | 'rental') => {
    setBusinessType(type);
    setEditData((prev: any) => ({ ...prev, businessType: type }));
    // Reset category selections when type changes
    setSelectedRootCategoryId(null);
    setSelectedCategoryIds([]);
    setExpandedCategoryIds(new Set());
    // Re-fetch categories with new filter
    loadCategories(type);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const loadPackages = async () => {
    if (!id) return;
    try {
      setLoadingPackages(true);
      const { getBusinessPackages } = await import('../lib/packageApi');
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
      const { togglePackageStatus } = await import('../lib/packageApi');
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
      const { togglePackageStatus } = await import('../lib/packageApi');
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

  // Get full path for a category (excluding root/parent category)
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

    // Remove the root category (first element) if there are multiple levels
    if (path.length > 1) {
      path.shift(); // Remove the first element (root category)
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

  // Root categories for dropdown (top-level nodes from tree)
  const rootCategoriesForDropdown = React.useMemo(() => {
    return categoryTree;
  }, [categoryTree]);

  // Subtree for selected root only (for sub-categories modal)
  const subtreeForSelectedRoot = React.useMemo(() => {
    if (!selectedRootCategoryId) return null;
    return categoryTree.find((n: any) => n.id === selectedRootCategoryId) || null;
  }, [categoryTree, selectedRootCategoryId]);

  // Filtered subtree children for modal (search scoped to selected root)
  const filteredSubtreeChildren = React.useMemo(() => {
    if (!subtreeForSelectedRoot) return [];
    const filtered = filterCategories([subtreeForSelectedRoot], searchQuery);
    return filtered[0] ? filtered[0].children : [];
  }, [subtreeForSelectedRoot, searchQuery]);

  // Handle root category selection (from dropdown)
  const handleRootSelection = (categoryId: string) => {
    setSelectedRootCategoryId(categoryId);
    setSelectedCategoryIds([]);
    setExpandedCategoryIds(new Set([categoryId]));
    if (isCategoryModalOpen) {
      setIsCategoryModalOpen(false);
      setTempSelectedCategoryIds([]);
    }
  };

  // Handle child category selection
  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      if (prev.includes(categoryId)) {
        // Collapse when deselecting
        setExpandedCategoryIds((expanded) => {
          const newExpanded = new Set(expanded);
          if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
          }
          return newExpanded;
        });
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
              <View style={styles.categoryRadioButton}>
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

  // Render sub-category tree for modal (checkboxes only, temp state; used under selected root)
  const renderSubCategoryTreeForModal = (nodes: any[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isSelected = tempSelectedCategoryIds.includes(node.id);
      const isExpanded = expandedCategoryIds.has(node.id);
      const hasChildren = node.children.length > 0;

      return (
        <View key={node.id} style={styles.categoryItem}>
          <TouchableOpacity
            style={[styles.categoryRow, { paddingLeft: level * 20 + 12 }]}
            onPress={() => toggleTempCategorySelection(node.id)}
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
            <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
              {node.name}
            </Text>
          </TouchableOpacity>

          {hasChildren && isExpanded && (
            <View style={styles.childrenContainer}>
              {renderSubCategoryTreeForModal(node.children, level + 1)}
            </View>
          )}
        </View>
      );
    });
  };

  // Get selected categories with full paths (only leaf-level selected items)
  const selectedCategoriesWithPaths = React.useMemo(() => {
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

    return leafIds.map((id) => ({
      id,
      path: getCategoryPath(id, allBusinessCategories),
      name: allBusinessCategories.find(c => c.id === id)?.name || ''
    }));
  }, [selectedCategoryIds, allBusinessCategories]);

  // Get display text for dropdown

  // Determine applicable pricing units based on selected service category
  const pricingUnitOptions = React.useMemo(() => {
    if (selectedCategoriesWithPaths.length === 0) return DEFAULT_PRICING_UNITS;

    // Use the first selected category to determine units
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
    // Only show child categories
    const childIds = selectedEventIds.filter(id => {
      const cat = allEventCategories.find(c => c.id === id);
      return cat && cat.parent_category_id !== null;
    });

    return childIds.map((id) => ({
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
    return `${selectedEventsWithPaths.length} sub-categories selected`;
  };

  // Toggle event selection
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds((prev) => {
      if (prev.includes(eventId)) {
        // Collapse when deselecting
        setExpandedEventCategoryIds((expanded) => {
          const newExpanded = new Set(expanded);
          if (newExpanded.has(eventId)) {
            newExpanded.delete(eventId);
          }
          return newExpanded;
        });
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

  // Modal handlers for sub-categories only (root is chosen via dropdown)
  const handleCategoryModalOpen = () => {
    if (!selectedRootCategoryId) return;
    setTempSelectedCategoryIds([...selectedCategoryIds]);
    setIsCategoryModalOpen(true);
  };

  const handleCategoryModalClose = () => {
    setIsCategoryModalOpen(false);
    setSearchQuery('');
  };

  const handleCategoryModalDone = () => {
    const hasSubCategory = tempSelectedCategoryIds.some(id => {
      const cat = allBusinessCategories.find(c => c.id === id);
      return cat && cat.parent_category_id !== null;
    });

    if (!hasSubCategory) {
      Alert.alert('Validation Error', 'Please select at least one sub-category');
      return;
    }

    setSelectedCategoryIds([...tempSelectedCategoryIds]);
    setIsCategoryModalOpen(false);
    setSearchQuery('');
  };

  const toggleTempCategorySelection = (categoryId: string) => {
    setTempSelectedCategoryIds((prev) => {
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

  // Modal handlers for event selection
  const handleEventModalOpen = () => {
    // Copy current selections to temp state when modal opens
    setTempSelectedEventIds([...selectedEventIds]);
    setIsEventModalOpen(true);
  };

  const handleEventModalClose = () => {
    // Discard temp changes when X is clicked
    setIsEventModalOpen(false);
    // Reset search
    setEventSearchQuery('');
  };

  const handleEventModalDone = () => {
    // Validate: at least one event type (sub-category) must be selected
    const hasSubEventType = tempSelectedEventIds.some(id => {
      const cat = allEventCategories.find(c => c.id === id);
      return cat && cat.parent_category_id !== null;
    });

    if (!hasSubEventType) {
      Alert.alert('Validation Error', 'Please select at least one sub-category for event types');
      return;
    }

    // Commit temp selections to actual state
    setSelectedEventIds([...tempSelectedEventIds]);
    setIsEventModalOpen(false);
    // Reset search
    setEventSearchQuery('');
  };

  // Temp handler for event selection in modal
  const toggleTempEventSelection = (eventId: string) => {
    setTempSelectedEventIds((prev) => {
      let newIds = [...prev];
      const isSelected = prev.includes(eventId);

      if (isSelected) {
        // Deselecting
        newIds = newIds.filter((id) => id !== eventId);

        // Also deselect all children if this is a parent category
        const childCategories = allEventCategories.filter(c => c.parent_category_id === eventId);
        if (childCategories.length > 0) {
          const childIds = childCategories.map(c => c.id);
          newIds = newIds.filter(id => !childIds.includes(id));
        }

        // Collapse when deselecting
        setExpandedEventCategoryIds((expanded) => {
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
        const childCategories = allEventCategories.filter(c => c.parent_category_id === eventId);
        if (childCategories.length > 0) {
          childCategories.forEach(child => {
            if (!newIds.includes(child.id)) {
              newIds.push(child.id);
            }
          });

          // Auto-expand the parent category to show selected children
          setExpandedEventCategoryIds((expanded) => {
            const newExpanded = new Set(expanded);
            newExpanded.add(eventId);
            return newExpanded;
          });
        }
      }
      return newIds;
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

  // Render event category tree for modal (uses temp state)
  const renderEventCategoryTreeForModal = (nodes: any[], level: number = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isSelected = tempSelectedEventIds.includes(node.id);
      const isExpanded = expandedEventCategoryIds.has(node.id);
      const hasChildren = node.children.length > 0;

      return (
        <View key={node.id} style={styles.categoryItem}>
          <TouchableOpacity
            style={[styles.categoryRow, { paddingLeft: level * 20 + 12 }]}
            onPress={() => toggleTempEventSelection(node.id)}
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
              {renderEventCategoryTreeForModal(node.children, level + 1)}
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
          file,
          user?.id
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
    const errors: Record<string, string> = {};

    // 1. Validate mandatory text fields
    if (!editData.business_name || !editData.business_name.trim()) {
      errors.business_name = 'Business name is required';
    }
    if (!editData.contact_person_name || !editData.contact_person_name.trim()) {
      errors.contact_person_name = 'Contact person name is required';
    }
    if (!editData.business_email || !editData.business_email.trim()) {
      errors.business_email = 'Email is required';
    } else {
      const emailErr = getEmailError(editData.business_email);
      if (emailErr) {
        errors.business_email = emailErr;
        setEmailError(emailErr);
      }
    }
    if (!editData.contact_person_phone || !editData.contact_person_phone.trim()) {
      errors.contact_person_phone = 'Business contact number is required';
    } else {
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(editData.contact_person_phone)) {
        errors.contact_person_phone = 'Business contact number must be exactly 10 digits';
      }
    }
    if (!editData.description || !editData.description.trim()) {
      errors.description = 'Business description is required';
    }
    if (!editData.years_experience && editData.years_experience !== 0) {
      errors.years_experience = 'Years of experience is required';
    }
    if (!editData.base_price || !String(editData.base_price).trim()) {
      errors.base_price = 'Base price is required';
    }
    if (!editData.pricing_unit || !editData.pricing_unit.trim()) {
      errors.pricing_unit = 'Pricing unit is required';
    }
    if (!editData.address || !editData.address.trim()) {
      errors.address = 'Business address is required';
    }
    if (!editData.pincode || !editData.pincode.trim()) {
      errors.pincode = 'Pincode is required';
    } else if (editData.pincode.length !== 6) {
      errors.pincode = 'Pincode must be 6 digits';
    }
    if (!editData.operating_locations || editData.operating_locations.length === 0) {
      errors.operating_locations = 'At least one operating location is required';
    }

    // 2. Validate PAN (Required and format)
    if (!editData.business_registration_number || !editData.business_registration_number.trim()) {
      errors.business_registration_number = 'PAN number is required';
    } else {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(editData.business_registration_number.toUpperCase())) {
        errors.business_registration_number = 'Please enter a valid PAN (e.g., ABCDE1234F)';
      }
    }

    // 3. Validate GST (format if provided)
    if (editData.gst_number && editData.gst_number.trim()) {
      const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z\d{1}$/;
      if (!gstRegex.test(editData.gst_number.toUpperCase())) {
        errors.gst_number = 'Please enter a valid GST number';
      }
    }

    // 4. Validate PAN document is uploaded
    const panDocs = documentsByType['pan'] || [];
    if (panDocs.length === 0) {
      errors.panDocument = 'PAN card document is required';
    }

    // 5. Validate at least one service category ONLY if categories are loaded
    if (allBusinessCategories.length > 0) {
      const hasSubCategory = selectedCategoryIds.some(id => {
        const cat = allBusinessCategories.find(c => c.id === id);
        return cat && cat.parent_category_id !== null;
      });
      if (!hasSubCategory) {
        errors.selectedCategoryIds = 'At least one service offering must be selected';
      }
    }

    // 6. Validate at least one event type ONLY if categories are loaded
    if (allEventCategories.length > 0) {
      const hasSubEventType = selectedEventIds.some(id => {
        const cat = allEventCategories.find(c => c.id === id);
        return cat && cat.parent_category_id !== null;
      });
      if (!hasSubEventType) {
        errors.selectedEventIds = 'At least one event type must be selected';
      }
    }

    // If there are any validation errors, set them to highlight fields
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Clear validation errors on successful validation
    setValidationErrors({});

    try {
      setSavingDetails(true);

      // Extract base_price and pricing_unit from editData as they are not columns on vendor_businesses
      const { base_price, pricing_unit, businessType: editDataBusinessType, ...businessUpdateData } = editData;

      // Update business details
      const finalUpdateData = {
        ...businessUpdateData
      };
      if (finalUpdateData.contact_person_phone) {
        finalUpdateData.contact_person_phone = stripCountryCode(finalUpdateData.contact_person_phone);
      }
      const { data, error } = await updateBusinessDetails(id, finalUpdateData);
      if (error) throw error;
      setBusiness(data);



      // Handle Package Update/Creation using the extracted price fields
      if (base_price && pricing_unit) {
        const { createPackage, updatePackage } = await import('../lib/packageApi');

        if (defaultPackageId) {
          // Update existing package
          await updatePackage(defaultPackageId, {
            base_price: parseFloat(base_price),
            price_unit: pricing_unit
          });
        } else {
          // Create new default package
          const { data: newPkg } = await createPackage({
            business_id: id,
            package_name: 'Standard Package',
            package_type: 'fixed',
            base_price: parseFloat(base_price),
            price_unit: pricing_unit,
            included_services: [],
            is_active: true,
            sort_order: 0
          });
          if (newPkg) setDefaultPackageId(newPkg.id ?? null);
        }
      }

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
    const isMenuOpen = activeMenuImageId === item.id;

    return (
      <View style={styles.imageGridItemContainer}>
        <TouchableOpacity
          style={styles.imageGridItem}
          activeOpacity={0.9}
          onPress={() => {
            if (activeMenuImageId) {
              setActiveMenuImageId(null);
            } else {
              setPreviewImageUrl(imageSource);
              setShowImagePreview(true);
            }
          }}
        >
          <Image source={{ uri: imageSource || undefined }} style={styles.galleryImage} resizeMode="cover" />
          {isCover && (
            <View style={styles.coverBadge}>
              <Text style={styles.coverBadgeText}>Cover</Text>
            </View>
          )}

          {/* Gradient overlay for text readability if needed, but kept clean for now */}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setActiveMenuImageId(isMenuOpen ? null : item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.menuButtonCircle}>
            <MoreVertical size={18} color="#fff" />
          </View>
        </TouchableOpacity>

        {isMenuOpen && (
          <View style={styles.menuOptions}>
            <TouchableOpacity
              style={styles.menuOptionItem}
              onPress={() => {
                setActiveMenuImageId(null);
                handleSetCoverImage(item);
              }}
            >
              <Text style={styles.menuOptionText}>Set Cover Image</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuOptionItem}
              onPress={() => {
                setActiveMenuImageId(null);
                handleDeleteImage(item);
              }}
            >
              <Text style={[styles.menuOptionText, styles.menuDeleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
    <ScreenBackground style={styles.container}>
      {/* ── Top Bar ── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
        >
          <ArrowLeft size={22} color="#007AFF" strokeWidth={2.2} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {business.business_name}
          </Text>
          {business.vendor_service_category ? (
            <Text style={styles.topBarSubtitle} numberOfLines={1}>
              {business.vendor_service_category}
            </Text>
          ) : null}
        </View>
        {/* Right placeholder to balance the back button */}
        <View style={{ width: 36 }} />
      </View>

      {isOffline && (
        <View style={styles.offlineBanner}>
          <WifiOff size={16} color="#B45309" />
          <Text style={styles.offlineText}>You're currently offline. Viewing cached data.</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        {/* ── Modern Tab Bar ── */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'gallery' && styles.tabActive]}
            onPress={() => setActiveSection('gallery')}
            activeOpacity={0.75}
          >
            <ImageIcon size={16} color={activeSection === 'gallery' ? '#1a1a1a' : '#999'} strokeWidth={2} />
            <Text style={[styles.tabText, activeSection === 'gallery' && styles.tabTextActive]}
              numberOfLines={1}
            >
              Gallery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeSection === 'edit' && styles.tabActive]}
            onPress={() => setActiveSection('edit')}
            activeOpacity={0.75}
          >
            <Edit size={16} color={activeSection === 'edit' ? '#1a1a1a' : '#999'} strokeWidth={2} />
            <Text style={[styles.tabText, activeSection === 'edit' && styles.tabTextActive]}
              numberOfLines={1}
            >
              Edit Details
            </Text>
          </TouchableOpacity>
        </View>


        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: Platform.OS === 'android' ? 20 : insets.bottom + 20
          }}
          keyboardShouldPersistTaps="handled"
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
              {/* Gallery header */}
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Business Gallery</Text>
                  <Text style={styles.sectionSubtitle}>{images.length}/20 images uploaded</Text>
                </View>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.addButton, styles.smallButton,
                    (uploading || uploadingMultiple || images.length >= 20) && styles.addButtonDisabled]}
                    onPress={handleUploadImage}
                    disabled={uploading || uploadingMultiple || images.length >= 20}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Plus size={16} color="#fff" />
                        <Text style={styles.smallButtonText}>Single</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addButton, styles.smallButton,
                    (uploading || uploadingMultiple || images.length >= 20) && styles.addButtonDisabled]}
                    onPress={handleUploadMultipleImages}
                    disabled={uploading || uploadingMultiple || images.length >= 20}
                  >
                    {uploadingMultiple ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <ImageIcon size={16} color="#fff" />
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
                  numColumns={2}
                  columnWrapperStyle={styles.imageRow}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}

          {/*
        activeSection === 'packages' && (
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
                onToggleStatus={() => { }} // Not used anymore, but required by interface
                loading={loadingPackages}
              />
            )}
          </View>
        )
        */}

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
            <View style={styles.confirmModalOverlay}>
              <View style={styles.confirmModalContent}>
                <Text style={styles.confirmModalTitle}>Delete Package</Text>
                <Text style={styles.confirmModalMessage}>
                  Are you sure you want to delete "{packageToDelete?.package_name || 'this package'}"? This will mark it as inactive and hide it from the list.
                </Text>
                <View style={styles.confirmModalButtons}>
                  <TouchableOpacity
                    style={[styles.confirmModalButton, styles.modalButtonCancel]}
                    onPress={() => {
                      setShowDeleteModal(false);
                      setPackageToDelete(null);
                    }}
                    disabled={deleting}
                  >
                    <Text style={styles.modalButtonCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmModalButton, styles.modalButtonDelete]}
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
              <View style={styles.editPageHeader}>
                <Text style={styles.sectionTitle}>Edit Business Details</Text>
                <Text style={styles.sectionSubtitle}>Update your business information</Text>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>Basic Information</Text>



                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.business_name && styles.editLabelError]}>Business Name *</Text>
                  <TextInput
                    style={[styles.editInput, validationErrors.business_name && styles.validationInputInvalid]}
                    value={editData.business_name || ''}
                    onChangeText={(text) => {
                      setEditData({ ...editData, business_name: text });
                      if (validationErrors.business_name) setValidationErrors(prev => { const { business_name, ...rest } = prev; return rest; });
                    }}
                    placeholder="Enter business name"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => contactPersonNameRef.current?.focus()}
                  />
                  {validationErrors.business_name && <Text style={styles.validationErrorText}>{validationErrors.business_name}</Text>}
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.contact_person_name && styles.editLabelError]}>Contact Person Name *</Text>
                  <TextInput
                    ref={contactPersonNameRef}
                    style={[styles.editInput, validationErrors.contact_person_name && styles.validationInputInvalid]}
                    value={editData.contact_person_name || ''}
                    onChangeText={(text) => {
                      setEditData({ ...editData, contact_person_name: text });
                      if (validationErrors.contact_person_name) setValidationErrors(prev => { const { contact_person_name, ...rest } = prev; return rest; });
                    }}
                    placeholder="Enter contact person name"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => contactPersonRoleRef.current?.focus()}
                  />
                  {validationErrors.contact_person_name && <Text style={styles.validationErrorText}>{validationErrors.contact_person_name}</Text>}
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
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => businessEmailRef.current?.focus()}
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, (validationErrors.business_email || emailError) && styles.editLabelError]}>Email *</Text>
                  <TextInput
                    ref={businessEmailRef}
                    style={[styles.editInput, (emailError || validationErrors.business_email) && styles.validationInputInvalid]}
                    value={editData.business_email || ''}
                    onChangeText={(text) => {
                      setEditData({ ...editData, business_email: text });
                      if (validationErrors.business_email) setValidationErrors(prev => { const { business_email, ...rest } = prev; return rest; });
                      const error = getEmailError(text);
                      if (error && text.trim().length > 5) {
                        setEmailError(error);
                      } else {
                        setEmailError(null);
                      }
                    }}
                    placeholder="Enter email"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => contactPersonPhoneRef.current?.focus()}
                  />
                  {(emailError || validationErrors.business_email) && <Text style={styles.validationErrorText}>{emailError || validationErrors.business_email}</Text>}
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.contact_person_phone && styles.editLabelError]}>Business Contact Number *</Text>
                  <TextInput
                    ref={contactPersonPhoneRef}
                    style={[styles.editInput, validationErrors.contact_person_phone && styles.validationInputInvalid]}
                    value={editData.contact_person_phone || ''}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 10);
                      setEditData({ ...editData, contact_person_phone: cleaned });
                      if (validationErrors.contact_person_phone) setValidationErrors(prev => { const { contact_person_phone, ...rest } = prev; return rest; });
                    }}
                    placeholder="Enter business contact number"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    maxLength={10}
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => businessDescriptionRef.current?.focus()}
                  />
                  {validationErrors.contact_person_phone && <Text style={styles.validationErrorText}>{validationErrors.contact_person_phone}</Text>}
                </View>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>Services & Experience</Text>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Business Type *</Text>
                  <View style={styles.radioGroup}>
                    <TouchableOpacity
                      style={styles.radioButton}
                      activeOpacity={0.7}
                      onPress={() => handleBusinessTypeChange('services')}
                    >
                      <View style={[styles.radioOuter, businessType === 'services' && styles.radioOuterSelected]}>
                        {businessType === 'services' && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioText}>Services</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.radioButton}
                      activeOpacity={0.7}
                      onPress={() => handleBusinessTypeChange('rental')}
                    >
                      <View style={[styles.radioOuter, businessType === 'rental' && styles.radioOuterSelected]}>
                        {businessType === 'rental' && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.radioText}>Rental</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, (validationErrors.selectedCategoryIds || validationErrors.selectedRootCategoryId) && styles.editLabelError]}>Business Category *</Text>
                  <Dropdown
                    options={rootCategoriesForDropdown.map((n: any) => ({
                      label: n.icon ? `${n.icon} ${n.name}` : n.name,
                      value: n.id,
                    }))}
                    value={selectedRootCategoryId || ''}
                    placeholder="Select a category"
                    onChange={(value: string) => {
                      handleRootSelection(value);
                      if (validationErrors.selectedCategoryIds) setValidationErrors(prev => { const { selectedCategoryIds, ...rest } = prev; return rest; });
                    }}
                    open={isRootDropdownOpen}
                    onOpenChange={setIsRootDropdownOpen}
                    error={validationErrors.selectedCategoryIds}
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.selectedCategoryIds && styles.editLabelError]}>Services Offered *</Text>
                  <TouchableOpacity
                    style={[
                      styles.dropdownTrigger,
                      !selectedRootCategoryId && styles.dropdownTriggerDisabled,
                      validationErrors.selectedCategoryIds && styles.validationInputInvalid,
                    ]}
                    onPress={() => selectedRootCategoryId && handleCategoryModalOpen()}
                    activeOpacity={0.7}
                    disabled={!selectedRootCategoryId}
                  >
                    <Text
                      style={[
                        styles.dropdownText,
                        !selectedRootCategoryId && styles.placeholder,
                        selectedRootCategoryId && selectedCategoriesWithPaths.length === 0 && styles.placeholder,
                      ]}
                    >
                      {!selectedRootCategoryId
                        ? 'Select a category first'
                        : selectedCategoriesWithPaths.length === 0
                          ? 'Select services offered'
                          : selectedCategoriesWithPaths.length === 1
                            ? selectedCategoriesWithPaths[0].path
                            : `${selectedCategoriesWithPaths.length} services selected`}
                    </Text>
                    <ChevronDown size={20} color={selectedRootCategoryId ? '#666' : '#ccc'} />
                  </TouchableOpacity>

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
                            onPress={() => {
                              if (selectedCategoryIds.length <= 1) {
                                Alert.alert('Validation Error', 'At least one service category must be selected.');
                                return;
                              }
                              toggleCategorySelection(item.id);
                            }}
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
                    onRequestClose={handleCategoryModalClose}
                  >
                    <Pressable
                      style={styles.modalOverlay}
                      onPress={handleCategoryModalClose}
                    >
                      <Pressable
                        style={styles.categoryModalContent}
                        onPress={(e) => e.stopPropagation()}
                      >
                        <View style={styles.categoryModalHeader}>
                          <Text style={styles.categoryModalTitle}>
                            {subtreeForSelectedRoot
                              ? `Services offered under ${subtreeForSelectedRoot.name}`
                              : 'Select Services offered'}
                          </Text>
                          <TouchableOpacity
                            onPress={handleCategoryModalClose}
                            style={styles.closeButton}
                          >
                            <X size={24} color="#666" />
                          </TouchableOpacity>
                        </View>

                        <TextInput
                          style={styles.modalSearchInput}
                          placeholder="Search services offered..."
                          placeholderTextColor="#999"
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                        />

                        <ScrollView
                          style={styles.modalCategoryTree}
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                        >
                          {filteredSubtreeChildren.length === 0 ? (
                            <Text style={styles.emptyText}>
                              {subtreeForSelectedRoot?.children?.length === 0
                                ? 'No services offered'
                                : 'No matching services offered'}
                            </Text>
                          ) : (
                            renderSubCategoryTreeForModal(filteredSubtreeChildren)
                          )}
                        </ScrollView>

                        <View style={styles.categoryModalFooter}>
                          <TouchableOpacity
                            style={styles.categoryModalButton}
                            onPress={handleCategoryModalDone}
                          >
                            <Text style={styles.modalButtonText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </Pressable>
                    </Pressable>
                  </Modal>
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.selectedEventIds && styles.editLabelError]}>Event Types *</Text>

                  {/* Event Dropdown Trigger */}
                  <TouchableOpacity
                    style={[styles.dropdownTrigger, validationErrors.selectedEventIds && styles.validationInputInvalid]}
                    onPress={handleEventModalOpen}
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
                      {(isEventsExpanded ? selectedEventsWithPaths : selectedEventsWithPaths.slice(0, 3)).map((item) => {
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
                    onRequestClose={handleEventModalClose}
                  >
                    <Pressable
                      style={styles.modalOverlay}
                      onPress={handleEventModalClose}
                    >
                      <Pressable
                        style={styles.categoryModalContent}
                        onPress={(e) => e.stopPropagation()}
                      >
                        <View style={styles.categoryModalHeader}>
                          <Text style={styles.categoryModalTitle}>Select Events</Text>
                          <TouchableOpacity
                            onPress={handleEventModalClose}
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
                            renderEventCategoryTreeForModal(filteredEventTree)
                          )}
                        </ScrollView>

                        <View style={styles.categoryModalFooter}>
                          <TouchableOpacity
                            style={styles.categoryModalButton}
                            onPress={handleEventModalDone}
                          >
                            <Text style={styles.modalButtonText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </Pressable>
                    </Pressable>
                  </Modal>
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.description && styles.editLabelError]}>Business Description *</Text>
                  <TextInput
                    ref={businessDescriptionRef}
                    style={[styles.editInput, styles.textArea, validationErrors.description && styles.validationInputInvalid]}
                    value={editData.description || ''}
                    onChangeText={(text) => {
                      setEditData({ ...editData, description: text });
                      if (validationErrors.description) setValidationErrors(prev => { const { description, ...rest } = prev; return rest; });
                    }}
                    placeholder="Describe your business"
                    placeholderTextColor="#999"
                    multiline
                    numberOfLines={4}
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => addressRef.current?.focus()}
                  />
                  {validationErrors.description && <Text style={styles.validationErrorText}>{validationErrors.description}</Text>}
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.years_experience && styles.editLabelError]}>Years of Experience *</Text>
                  <Dropdown
                    options={EXPERIENCE_OPTIONS.map((exp) => ({
                      label: exp,
                      value: exp,
                    }))}
                    value={getExperienceDisplayValue(editData.years_experience)}
                    placeholder="Select experience"
                    onChange={(value: string) => {
                      setEditData({ ...editData, years_experience: parseExperienceToNumber(value) });
                      if (validationErrors.years_experience) setValidationErrors(prev => { const { years_experience, ...rest } = prev; return rest; });
                    }}
                    error={validationErrors.years_experience}
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.base_price && styles.editLabelError]}>Base Price (₹) *</Text>
                  <TextInput
                    style={[styles.editInput, validationErrors.base_price && styles.validationInputInvalid]}
                    value={editData.base_price ? String(editData.base_price) : ''}
                    onChangeText={(text) => {
                      const cleanText = text.replace(/[^0-9]/g, '');
                      setEditData({ ...editData, base_price: cleanText });
                      if (validationErrors.base_price) setValidationErrors(prev => { const { base_price, ...rest } = prev; return rest; });
                    }}
                    placeholder="Enter starting price"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    onFocus={handleFieldFocus}
                    returnKeyType="next"
                  />
                  {validationErrors.base_price && <Text style={styles.validationErrorText}>{validationErrors.base_price}</Text>}
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.pricing_unit && styles.editLabelError]}>Pricing Unit *</Text>
                  <Dropdown
                    options={pricingUnitOptions.map((unit) => ({
                      label: unit,
                      value: unit,
                    }))}
                    value={editData.pricing_unit || ''}
                    placeholder="Select pricing unit"
                    onChange={(value: string) => {
                      setEditData({ ...editData, pricing_unit: value });
                      if (validationErrors.pricing_unit) setValidationErrors(prev => { const { pricing_unit, ...rest } = prev; return rest; });
                    }}
                    open={isPricingUnitDropdownOpen}
                    onOpenChange={setIsPricingUnitDropdownOpen}
                    disabled={selectedCategoriesWithPaths.length === 0}
                    error={validationErrors.pricing_unit}
                  />
                  {selectedCategoriesWithPaths.length === 0 && (
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      Select a service category first
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>Location</Text>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.address && styles.editLabelError]}>Business Address *</Text>
                  <TextInput
                    ref={addressRef}
                    style={[styles.editInput, validationErrors.address && styles.validationInputInvalid]}
                    value={editData.address || ''}
                    onChangeText={(text) => {
                      setEditData({ ...editData, address: text });
                      if (validationErrors.address) setValidationErrors(prev => { const { address, ...rest } = prev; return rest; });
                    }}
                    placeholder="Enter business address"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => pincodeRef.current?.focus()}
                  />
                  {validationErrors.address && <Text style={styles.validationErrorText}>{validationErrors.address}</Text>}
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.pincode && styles.editLabelError]}>Pincode *</Text>
                  <View style={styles.inputWithStatus}>
                    <TextInput
                      ref={pincodeRef}
                      style={[
                        styles.editInput,
                        styles.pincodeInput,
                        pincodeStatus === 'valid' && styles.inputValid,
                        pincodeStatus === 'invalid' && styles.inputInvalid,
                        validationErrors.pincode && styles.validationInputInvalid,
                      ]}
                      value={editData.pincode || ''}
                      onChangeText={(text) => {
                        const cleanText = text.replace(/\D/g, '');
                        setEditData({ ...editData, pincode: cleanText });
                        if (validationErrors.pincode) setValidationErrors(prev => { const { pincode, ...rest } = prev; return rest; });
                        if (pincodeStatus !== 'idle') {
                          setPincodeStatus('idle');
                          setPincodeError(null);
                          setCityOptions([]);
                        }
                      }}
                      onFocus={handleFieldFocus}
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
                  <Text style={styles.editLabel}>Area</Text>
                  <TextInput
                    ref={cityRef}
                    style={styles.editInput}
                    value={editData.city || ''}
                    onChangeText={(text) => setEditData({ ...editData, city: text })}
                    placeholder="Enter area"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => localityRef.current?.focus()}
                  />
                  {cityOptions.length > 0 && (
                    <View style={styles.suggestionsContainer}>
                      <Text style={styles.suggestionsLabel}>Suggestions:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                        {cityOptions.map((city) => (
                          <TouchableOpacity
                            key={city}
                            style={[
                              styles.suggestionChip,
                              editData.city === city && styles.suggestionChipSelected
                            ]}
                            onPress={() => setEditData({ ...editData, city })}
                          >
                            <Text style={[
                              styles.suggestionChipText,
                              editData.city === city && styles.suggestionChipTextSelected
                            ]}>
                              {city}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>City/Town</Text>
                  <TextInput
                    ref={localityRef}
                    style={styles.editInput}
                    value={editData.locality || ''}
                    onChangeText={(text) => setEditData({ ...editData, locality: text })}
                    placeholder="Enter city/town"
                    placeholderTextColor="#999"
                    returnKeyType="next"
                    onFocus={handleFieldFocus}
                    onSubmitEditing={() => stateRef.current?.focus()}
                  />
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
                    onFocus={handleFieldFocus}
                  />
                </View>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, validationErrors.operating_locations && styles.editLabelError]}>Operating Locations *</Text>
                  <TouchableOpacity
                    style={[styles.dropdownTrigger, validationErrors.operating_locations && styles.validationInputInvalid]}
                    onPress={() => setIsCityModalOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.dropdownText,
                      (!editData.operating_locations || editData.operating_locations.length === 0) && styles.placeholder
                    ]}>
                      {editData.operating_locations && editData.operating_locations.length > 0
                        ? `${editData.operating_locations.length} locations selected`
                        : 'Select operating locations'}
                    </Text>
                    <ChevronDown size={20} color="#666" />
                  </TouchableOpacity>

                  {editData.operating_locations && editData.operating_locations.length > 0 && (
                    <View style={styles.selectedContainer}>
                      {editData.operating_locations.map((city: string) => (
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
                </View>
              </View>

              <View style={styles.editSection}>
                <Text style={styles.editSectionTitle}>Verification</Text>

                <View style={styles.editField}>
                  <Text style={[styles.editLabel, (validationErrors.business_registration_number || validationErrors.panDocument) && styles.editLabelError]}>PAN *</Text>
                  <Text style={styles.editHint}>Required - Permanent Account Number</Text>
                  <View style={styles.inputActionRow}>
                    <TextInput
                      ref={panRef}
                      style={[styles.editInput, styles.flexInput, validationErrors.business_registration_number && styles.validationInputInvalid]}
                      value={editData.business_registration_number || ''}
                      onChangeText={(text) => {
                        setEditData({ ...editData, business_registration_number: text });
                        if (validationErrors.business_registration_number) setValidationErrors(prev => { const { business_registration_number, ...rest } = prev; return rest; });
                      }}
                      placeholder="Enter PAN"
                      placeholderTextColor="#999"
                      autoCapitalize="characters"
                      maxLength={10}
                      returnKeyType="next"
                      onSubmitEditing={() => gstNumberRef.current?.focus()}
                    />
                    <TouchableOpacity
                      style={[styles.inlineUploadButton, uploadingDocument === 'pan' && styles.addDocumentButtonDisabled]}
                      onPress={() => handleUploadDocument('pan')}
                      disabled={uploadingDocument === 'pan'}
                    >
                      {uploadingDocument === 'pan' ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                      ) : (
                        <>
                          <Upload size={18} color="#007AFF" />
                          <Text style={styles.inlineUploadButtonText}>Add PAN</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* PAN Document Preview */}
                  {(documentsByType['pan'] || []).length > 0 && (
                    <View style={styles.inlineDocumentsList}>
                      {(documentsByType['pan'] || []).map((doc: any) => (
                        <View key={doc.id} style={styles.documentItem}>
                          {isImageFile(doc.mime_type || '') && doc.file_url ? (
                            <Image source={{ uri: doc.file_url }} style={styles.documentThumbnail} />
                          ) : (
                            <View style={styles.documentIcon}>
                              <FileText size={20} color="#666" />
                            </View>
                          )}
                          <View style={styles.documentInfo}>
                            <Text style={styles.documentName} numberOfLines={1}>{doc.file_name || 'PAN Card'}</Text>
                            <Text style={styles.documentStatus}>Status: {doc.verification_status}</Text>
                          </View>
                          <TouchableOpacity style={styles.deleteDocumentButton} onPress={() => handleDeleteDocument(doc.id)}>
                            <X size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {(validationErrors.business_registration_number || validationErrors.panDocument) && (
                    <Text style={styles.validationErrorText}>{validationErrors.business_registration_number || validationErrors.panDocument}</Text>
                  )}
                </View>

                <View style={styles.editField}>
                  <Text style={styles.editLabel}>GST Number</Text>
                  <View style={styles.inputActionRow}>
                    <TextInput
                      ref={gstNumberRef}
                      style={[styles.editInput, styles.flexInput]}
                      value={editData.gst_number || ''}
                      onChangeText={(text) => setEditData({ ...editData, gst_number: text })}
                      placeholder="Enter GST number"
                      placeholderTextColor="#999"
                      returnKeyType="next"
                      onSubmitEditing={() => websiteUrlRef.current?.focus()}
                    />
                    <TouchableOpacity
                      style={[styles.inlineUploadButton, uploadingDocument === 'gst' && styles.addDocumentButtonDisabled]}
                      onPress={() => handleUploadDocument('gst')}
                      disabled={uploadingDocument === 'gst'}
                    >
                      {uploadingDocument === 'gst' ? (
                        <ActivityIndicator size="small" color="#007AFF" />
                      ) : (
                        <>
                          <Upload size={18} color="#007AFF" />
                          <Text style={styles.inlineUploadButtonText}>Add GST</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                  {/* GST Document Preview */}
                  {(documentsByType['gst'] || []).length > 0 && (
                    <View style={styles.inlineDocumentsList}>
                      {(documentsByType['gst'] || []).map((doc: any) => (
                        <View key={doc.id} style={styles.documentItem}>
                          {isImageFile(doc.mime_type || '') && doc.file_url ? (
                            <Image source={{ uri: doc.file_url }} style={styles.documentThumbnail} />
                          ) : (
                            <View style={styles.documentIcon}>
                              <FileText size={20} color="#666" />
                            </View>
                          )}
                          <View style={styles.documentInfo}>
                            <Text style={styles.documentName} numberOfLines={1}>{doc.file_name || 'GST Document'}</Text>
                            <Text style={styles.documentStatus}>Status: {doc.verification_status}</Text>
                          </View>
                          <TouchableOpacity style={styles.deleteDocumentButton} onPress={() => handleDeleteDocument(doc.id)}>
                            <X size={16} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Verification Documents Section */}
                <View style={styles.editField}>
                  <Text style={styles.editLabel}>Verification Documents</Text>

                  {/* Document Types - PAN Card first and mandatory */}
                  {[
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
                  <Text style={styles.editLabel}>Website</Text>
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
                  <Text style={styles.editLabel}>Instagram</Text>
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
                  <Text style={styles.editLabel}>Facebook</Text>
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
                  <Text style={styles.editLabel}>YouTube</Text>
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

            </View>
          )}
        </ScrollView>

        {activeSection === 'edit' && (
          <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.saveButton, savingDetails && styles.saveButtonDisabled]}
              onPress={handleSaveDetails}
              disabled={savingDetails}
              activeOpacity={0.85}
            >
              {savingDetails ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

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

            <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 20) }]}>
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
                <Search size={20} color="#999" style={styles.searchIcon} />
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
                    ? editData.operating_locations?.includes('*')
                    : editData.operating_locations?.includes(city);
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
      </KeyboardAvoidingView>
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
  errorText: {
    fontSize: 16,
    color: '#666',
  },

  // ─── Top Bar ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#f5f7fa',
    zIndex: 10,
  },
  backBtn: {
    padding: 6,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  topBarSubtitle: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 1,
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

  // ─── Tab Bar ────────────────────────────────────────────────────────────────
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    minWidth: 0,
  },
  tabActive: {
    backgroundColor: '#D3D6DE',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    flexShrink: 1,
  },
  tabTextActive: {
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  editPageHeader: {
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6aa3ce',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  addButtonDisabled: {
    opacity: 0.5,
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
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  imageCounter: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
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
    backgroundColor: '#6aa3ce',
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
  imageGridItemContainer: {
    flex: 1,
    aspectRatio: 1,
    position: 'relative',
    margin: 4,
  },
  imageGridItem: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  menuButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOptions: {
    position: 'absolute',
    top: 45,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
    minWidth: 160,
  },
  menuOptionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  menuDeleteText: {
    color: '#FF3B30',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 2,
  },
  coverBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#6aa3ce',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 5,
  },
  coverBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  editSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  editSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6aa3ce',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  editField: {
    marginBottom: 16,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 7,
  },
  editInput: {
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e8eaed',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1a1a1a',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 13,
  },
  saveButton: {
    backgroundColor: '#6aa3ce',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#6aa3ce',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#aaa',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  inputActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  flexInput: {
    flex: 1,
    minWidth: 200,
  },
  inlineUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f6fb',
    borderWidth: 1,
    borderColor: '#6aa3ce',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inlineUploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6aa3ce',
  },
  inlineDocumentsList: {
    marginTop: 12,
    gap: 8,
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
    backgroundColor: '#fff',
  },
  bottomSheetContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    width: '100%',
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
    flex: 1,
    marginRight: 12,
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
    backgroundColor: '#6aa3ce',
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
    backgroundColor: '#f7f8fa',
    borderWidth: 1,
    borderColor: '#e8eaed',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  dropdownTriggerDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e8e8e8',
    opacity: 0.9,
  },
  dropdownText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  placeholder: {
    color: '#999',
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
    backgroundColor: '#f0f6fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6aa3ce',
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
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
    backgroundColor: '#6aa3ce',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
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
  categoryRadioButton: {
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
    borderColor: '#6aa3ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6aa3ce',
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
    backgroundColor: '#6aa3ce',
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
    color: '#6aa3ce',
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
    color: '#6aa3ce',
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
    borderColor: '#6aa3ce',
    backgroundColor: '#f0f6fb',
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
  confirmModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModalContent: {
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
  confirmModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  confirmModalMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmModalButton: {
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
  validationErrorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
  validationInputInvalid: {
    borderColor: '#FF3B30',
    borderWidth: 2,
    backgroundColor: '#fff5f5',
  },
  editLabelError: {
    color: '#FF3B30',
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
  suggestionChipTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  citySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  citySearchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1a1a1a',
  },
  searchIcon: {
    marginRight: 8,
  },
  cityModalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6aa3ce',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#6aa3ce',
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#f0f7ff',
  },
  optionsList: {
    paddingHorizontal: 0,
  },
  optionText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  optionTextSelected: {
    color: '#6aa3ce',
    fontWeight: '600',
  },
  cityOptionTextSelected: {
    color: '#6aa3ce',
    fontWeight: '600',
  },
  stickyFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#f5f7fa',
    borderTopWidth: 1,
    borderTopColor: '#ececec',
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
    backgroundColor: '#f0f6fb',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#6aa3ce',
  },
  addDocumentButtonDisabled: {
    opacity: 0.6,
  },
  addDocumentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6aa3ce',
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
  suggestionsContainer: {
    marginTop: 8,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
    marginLeft: 4,
  },
  suggestionsScroll: {
    flexDirection: 'row',
  },
  suggestionChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  suggestionChipSelected: {
    backgroundColor: '#6aa3ce',
    borderColor: '#6aa3ce',
  },
  suggestionChipText: {
    fontSize: 13,
    color: '#666',
  },
  confirmModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelModalButtonText: {
    color: '#666',
  },
  dangerModalButtonText: {
    color: '#fff',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 4,
  },
  radioButton: {
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
});
