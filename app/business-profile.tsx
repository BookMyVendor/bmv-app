import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Image,
    Animated,
    RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft,
    Search,
    X,
    Star,
    Users,
    MessageSquare,
    ChevronRight,
    TrendingUp,
    Edit2,
    WifiOff,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { getVendorBusiness } from '../lib/api/vendorBusinesses';
import { getLeads } from '../lib/api/leads';
import { getReviews } from '../lib/api/reviews';
import { getTimeAgo } from '../lib/timeUtils';
import { Lead, STATUS_OPTIONS } from '../types/leads';
import ScreenBackground from '../components/ScreenBackground';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Business {
    id: string;
    business_name: string;
    business_category: string;
    cover_photo_url: string | null;
}

interface Review {
    id: string;
    customer_name: string;
    rating: number;
    comment: string | null;
    created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
    name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    if (diffMonths < 12) return `${diffMonths} months ago`;
    return `${Math.floor(diffMonths / 12)} years ago`;
};

// Status filter chips config
const STATUS_CHIPS = [
    { label: 'All', value: '' },
    { label: 'New', value: 'new' },
    { label: 'Contacted', value: 'contacted' },
    { label: 'Quoted', value: 'quoted' },
    { label: 'Converted', value: 'converted' },
    { label: 'Lost', value: 'lost' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BusinessProfileScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();

    // Business data
    const [business, setBusiness] = useState<Business | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    // Stats
    const [totalLeads, setTotalLeads] = useState(0);
    const [wonLeads, setWonLeads] = useState(0);
    const [avgReview, setAvgReview] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState(0);

    // Leads tab
    const [leads, setLeads] = useState<Lead[]>([]);
    const [leadsLoading, setLeadsLoading] = useState(false);
    const [activeStatusFilter, setActiveStatusFilter] = useState('');

    // Reviews tab
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);

    // UI state
    const [activeTab, setActiveTab] = useState<'leads' | 'reviews'>('leads');

    // Search state
    const [searchActive, setSearchActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchWidthAnim = useRef(new Animated.Value(0)).current;
    const searchOpacityAnim = useRef(new Animated.Value(0)).current;

    // ── Data fetching ─────────────────────────────────────────────────────────

    const loadAll = useCallback(async () => {
        if (!id || !user?.id) return;
        try {
            setLoading(true);
            await Promise.all([
                fetchBusiness(),
                fetchLeads(),
                fetchReviews(),
            ]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id, user?.id]);

    useEffect(() => {
        if (id && user?.id) {
            loadAll();
        }
    }, [id, user?.id]);

    useFocusEffect(
        useCallback(() => {
            if (id && user?.id) {
                fetchLeads();
                fetchReviews();
            }
        }, [id, user?.id])
    );

    const fetchBusiness = async () => {
        if (!id || !user?.id) return;
        try {
            const cachedParams = await AsyncStorage.getItem(`business_profile_${id}`);
            if (cachedParams) setBusiness(JSON.parse(cachedParams));

            const { data, error } = await getVendorBusiness(id);
            if (error) throw new Error(error.error);
            if (data) {
                const raw = data as any;
                const category = raw.business_category ?? raw.vendor_business_category_mappings?.[0]?.categories?.name ?? 'General';
                const businessData: Business = {
                    id: data.id,
                    business_name: data.business_name,
                    business_category: category,
                    cover_photo_url: data.cover_photo_url ?? null,
                };
                setBusiness(businessData);
                setIsOffline(false);
                AsyncStorage.setItem(`business_profile_${id}`, JSON.stringify(businessData));
            }
        } catch (err) {
            console.error('Error fetching business:', err);
            setIsOffline(true);
        }
    };

    const fetchLeads = async () => {
        if (!id || !user?.id) return;
        try {
            setLeadsLoading(true);
            try {
                const cachedLeads = await AsyncStorage.getItem(`business_leads_${id}`);
                if (cachedLeads) {
                    const parsedLeads = JSON.parse(cachedLeads);
                    setLeads(parsedLeads);
                    setTotalLeads(parsedLeads.length);
                    setWonLeads(parsedLeads.filter((l: Lead) => l.lead_status === 'converted').length);
                }
            } catch (_) {}

            const { data, error } = await getLeads({ business_id: id, vendor_id: user.id });
            if (error) throw new Error(error.error);
            const leadsData = (data ?? []) as unknown as Lead[];
            setLeads(leadsData);
            try { AsyncStorage.setItem(`business_leads_${id}`, JSON.stringify(leadsData)); } catch (_) {}
            setTotalLeads(leadsData.length);
            setWonLeads(leadsData.filter((l) => l.lead_status === 'converted').length);
        } catch (err) {
            console.error('Error fetching leads:', err);
        } finally {
            setLeadsLoading(false);
        }
    };

    const fetchReviews = async () => {
        if (!id || !user?.id) return;
        try {
            setReviewsLoading(true);
            try {
                const cachedReviews = await AsyncStorage.getItem(`business_reviews_${id}`);
                if (cachedReviews) {
                    const parsed = JSON.parse(cachedReviews);
                    setReviews(parsed);
                    setReviewCount(parsed.length);
                    if (parsed.length > 0)
                        setAvgReview(parseFloat((parsed.reduce((s: number, r: Review) => s + r.rating, 0) / parsed.length).toFixed(1)));
                }
            } catch (_) {}

            const { data, error } = await getReviews();
            if (error) throw new Error(error.error);
            const raw = (data ?? []).filter((r: any) => r.business_id === id);
            const mapped: Review[] = raw.map((r: any) => ({
                id: r.id,
                customer_name: r.customers?.name ?? 'Anonymous',
                rating: r.rating ?? 0,
                comment: r.review_text || r.review_title || null,
                created_at: r.created_at,
            }));
            setReviews(mapped);
            try { AsyncStorage.setItem(`business_reviews_${id}`, JSON.stringify(mapped)); } catch (_) {}
            setReviewCount(mapped.length);
            setAvgReview(mapped.length > 0 ? parseFloat((mapped.reduce((s, r) => s + r.rating, 0) / mapped.length).toFixed(1)) : null);
        } catch (err) {
            console.error('Error fetching reviews:', err);
        } finally {
            setReviewsLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchLeads(), fetchReviews()]);
        setRefreshing(false);
    };

    // ── Search animation ──────────────────────────────────────────────────────

    const openSearch = () => {
        setSearchActive(true);
        Animated.parallel([
            Animated.timing(searchWidthAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: false,
            }),
            Animated.timing(searchOpacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: false,
            }),
        ]).start();
    };

    const closeSearch = () => {
        Animated.parallel([
            Animated.timing(searchWidthAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: false,
            }),
            Animated.timing(searchOpacityAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: false,
            }),
        ]).start(() => {
            setSearchActive(false);
            setSearchQuery('');
        });
    };

    // ── Filtered data ─────────────────────────────────────────────────────────

    const filteredLeads = useMemo(() => {
        let result = leads;
        if (activeStatusFilter) {
            result = result.filter((l) => l.lead_status === activeStatusFilter);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (l) =>
                    l.customer_name?.toLowerCase().includes(q) ||
                    l.customer_phone?.toLowerCase().includes(q) ||
                    l.customer_email?.toLowerCase().includes(q)
            );
        }
        return result;
    }, [leads, activeStatusFilter, searchQuery]);

    const filteredReviews = useMemo(() => {
        if (!searchQuery.trim()) return reviews;
        const q = searchQuery.toLowerCase();
        return reviews.filter(
            (r) =>
                r.customer_name.toLowerCase().includes(q) ||
                r.comment?.toLowerCase().includes(q)
        );
    }, [reviews, searchQuery]);

    // ── Status helpers ────────────────────────────────────────────────────────

    const getStatusColor = (status: string) => {
        const s = STATUS_OPTIONS.find((o) => o.value === status);
        return s?.color || '#999';
    };

    const getStatusLabel = (status: string) => {
        const s = STATUS_OPTIONS.find((o) => o.value === status);
        return s?.label || status;
    };

    // ── Loading state ─────────────────────────────────────────────────────────

    if (loading && !business) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const coverLetter = business?.business_name?.charAt(0)?.toUpperCase() || 'B';

    const chipCounts: Record<string, number> = { '': leads.length };
    STATUS_OPTIONS.forEach((opt) => {
        chipCounts[opt.value] = leads.filter((l) => l.lead_status === opt.value).length;
    });

    const renderStars = (rating: number) => (
        <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={12}
                    color={i < rating ? '#FFB800' : '#ddd'}
                    fill={i < rating ? '#FFB800' : 'transparent'}
                />
            ))}
        </View>
    );

    const renderLeadItem = ({ item }: { item: Lead }) => (
        <TouchableOpacity
            style={styles.leadCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/lead-detail?id=${item.id}`)}
        >
            <View style={styles.leadAvatarCircle}>
                <Text style={styles.leadAvatarText}>{getInitials(item.customer_name)}</Text>
            </View>
            <View style={styles.leadInfo}>
                <Text style={styles.leadName}>{item.customer_name}</Text>
                <Text style={styles.leadMeta}>
                    {getTimeAgo(item.created_at)}
                    {item.budget_range ? `  ·  ${item.budget_range}` : ''}
                </Text>
            </View>
            <View style={[styles.leadStatusBadge, { backgroundColor: getStatusColor(item.lead_status) + '18' }]}>
                <Text style={[styles.leadStatusText, { color: getStatusColor(item.lead_status) }]}>
                    {getStatusLabel(item.lead_status)}
                </Text>
            </View>
            <ChevronRight size={16} color="#ccc" strokeWidth={2} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
    );

    const renderReviewItem = ({ item }: { item: Review }) => (
        <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
                <View style={styles.reviewAvatarCircle}>
                    <Text style={styles.reviewAvatarText}>{getInitials(item.customer_name)}</Text>
                </View>
                <View style={styles.reviewInfo}>
                    <Text style={styles.reviewName}>{item.customer_name}</Text>
                    <View style={styles.reviewStarsRow}>
                        {renderStars(item.rating)}
                        <Text style={styles.reviewDate}>{formatRelativeTime(item.created_at)}</Text>
                    </View>
                </View>
            </View>
            {item.comment ? <Text style={styles.reviewComment}>{item.comment}</Text> : null}
        </View>
    );

    return (
        <ScreenBackground style={styles.container}>
            {/* ── Top Bar ── */}
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.topBarBtn}>
                    <ArrowLeft size={22} color="#007AFF" strokeWidth={2.2} />
                </TouchableOpacity>
                <View style={styles.topBarActionContainer}>
                    <TouchableOpacity
                        style={styles.topBarEditBtn}
                        onPress={() => (router as any).push(`/business-details?id=${id}`)}
                        activeOpacity={0.7}
                    >
                        <Edit2 size={18} color="#007AFF" strokeWidth={2.2} />
                    </TouchableOpacity>
                    <Text style={styles.topBarEditLabel}>Edit Profile</Text>
                </View>
            </View>

            {isOffline && (
                <View style={styles.offlineBanner}>
                    <WifiOff size={16} color="#B45309" />
                    <Text style={styles.offlineText}>You're currently offline.</Text>
                </View>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
                }
            >
                {/* ── Business Header ── */}
                <View style={styles.businessHeader}>
                    {business?.cover_photo_url ? (
                        <Image
                            source={{ uri: business.cover_photo_url }}
                            style={styles.coverAvatar}
                            resizeMode="cover"
                        />
                    ) : (
                        <LinearGradient
                            colors={['#6c7ef7', '#8b9dff']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.coverAvatar}
                        >
                            <Text style={styles.coverAvatarLetter}>{coverLetter}</Text>
                        </LinearGradient>
                    )}
                    <Text style={styles.businessName}>{business?.business_name || 'Business'}</Text>
                    <Text style={styles.businessCategory}>{business?.business_category || ''}</Text>
                </View>

                {/* ── Stat Cards ── */}
                <View style={styles.statsRow}>
                    {/* Total Leads */}
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{totalLeads}</Text>
                        <Text style={styles.statLabel}>Total Leads</Text>
                    </View>

                    <View style={styles.statDivider} />

                    {/* Won */}
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{wonLeads}</Text>
                        <Text style={styles.statLabel}>Won</Text>
                    </View>

                    <View style={styles.statDivider} />

                    {/* Avg Review */}
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: avgReview !== null ? '#FFB800' : '#ccc' }]}>
                            {avgReview !== null ? avgReview.toFixed(1) : '—'}
                        </Text>
                        <Text style={styles.statLabel}>{reviewCount} Reviews</Text>
                    </View>
                </View>

                {/* ── Tabs ── */}
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'leads' && styles.tabActive]}
                        onPress={() => {
                            setActiveTab('leads');
                            setSearchQuery('');
                        }}
                        activeOpacity={0.75}
                    >
                        <Users size={15} color={activeTab === 'leads' ? '#1a1a1a' : '#999'} strokeWidth={2} />
                        <Text style={[styles.tabText, activeTab === 'leads' && styles.tabTextActive]}>
                            Leads
                        </Text>
                        <View style={[styles.tabBadge, activeTab === 'leads' && styles.tabBadgeActive]}>
                            <Text style={[styles.tabBadgeText, activeTab === 'leads' && styles.tabBadgeTextActive]}>
                                {totalLeads}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
                        onPress={() => {
                            setActiveTab('reviews');
                            setSearchQuery('');
                        }}
                        activeOpacity={0.75}
                    >
                        <MessageSquare size={15} color={activeTab === 'reviews' ? '#1a1a1a' : '#999'} strokeWidth={2} />
                        <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
                            Reviews
                        </Text>
                        <View style={[styles.tabBadge, activeTab === 'reviews' && styles.tabBadgeActive]}>
                            <Text style={[styles.tabBadgeText, activeTab === 'reviews' && styles.tabBadgeTextActive]}>
                                {reviewCount}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* ── Search row ── */}
                <View style={styles.searchRow}>
                    {searchActive ? (
                        <View style={styles.searchBar}>
                            <Search size={16} color="#aaa" style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={activeTab === 'leads' ? 'Search leads...' : 'Search reviews...'}
                                placeholderTextColor="#aaa"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                            <TouchableOpacity onPress={closeSearch} style={styles.searchCloseBtn}>
                                <X size={16} color="#aaa" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.searchIconBtn} onPress={openSearch}>
                            <Search size={18} color="#888" strokeWidth={2} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── Leads Content ── */}
                {activeTab === 'leads' && (
                    <>
                        {/* Status filter chips */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipsRow}
                        >
                            {STATUS_CHIPS.map((chip) => {
                                const isActive = activeStatusFilter === chip.value;
                                const count = chipCounts[chip.value] ?? 0;
                                return (
                                    <TouchableOpacity
                                        key={chip.value}
                                        style={[styles.chip, isActive && styles.chipActive]}
                                        onPress={() => setActiveStatusFilter(chip.value)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                                            {chip.label}
                                            {' '}
                                            <Text style={[styles.chipCount, isActive && styles.chipCountActive]}>
                                                ({count})
                                            </Text>
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Leads list */}
                        {leadsLoading ? (
                            <View style={styles.tabLoading}>
                                <ActivityIndicator color="#007AFF" />
                            </View>
                        ) : filteredLeads.length === 0 ? (
                            <View style={styles.emptyState}>
                                <TrendingUp size={40} color="#ddd" />
                                <Text style={styles.emptyTitle}>No leads found</Text>
                                <Text style={styles.emptyText}>
                                    {searchQuery ? 'Try a different search' : 'Leads for this business will appear here'}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.listContainer}>
                                {filteredLeads.map((item) => (
                                    <View key={item.id}>
                                        {renderLeadItem({ item })}
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}

                {/* ── Reviews Content ── */}
                {activeTab === 'reviews' && (
                    <>
                        {reviewsLoading ? (
                            <View style={styles.tabLoading}>
                                <ActivityIndicator color="#007AFF" />
                            </View>
                        ) : filteredReviews.length === 0 ? (
                            <View style={styles.emptyState}>
                                <Star size={40} color="#ddd" />
                                <Text style={styles.emptyTitle}>No reviews found</Text>
                                <Text style={styles.emptyText}>
                                    {searchQuery ? 'Try a different search' : 'Reviews for this business will appear here'}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.listContainer}>
                                {filteredReviews.map((item) => (
                                    <View key={item.id}>
                                        {renderReviewItem({ item })}
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </ScreenBackground>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

    // Top bar
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 8,
        backgroundColor: '#f5f7fa',
    },
    topBarBtn: {
        padding: 6,
    },
    topBarEditBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    topBarActionContainer: {
        alignItems: 'center',
        paddingTop: 4,
    },
    topBarEditLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#007AFF',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Business header
    businessHeader: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#f5f7fa',
    },
    coverAvatar: {
        width: 72,
        height: 72,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    coverAvatarLetter: {
        fontSize: 28,
        fontWeight: '700',
        color: '#fff',
    },
    businessName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
        textAlign: 'center',
    },
    businessCategory: {
        fontSize: 13,
        color: '#888',
        marginTop: 3,
        textAlign: 'center',
    },

    // Stat cards
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
        marginBottom: 16,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 4,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    statLabel: {
        fontSize: 11,
        color: '#888',
        fontWeight: '500',
        marginTop: 3,
    },

    // Tabs
    tabsContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
        marginBottom: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 6,
    },
    tabActive: {
        backgroundColor: '#D3D6DE',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#999',
    },
    tabTextActive: {
        color: '#1a1a1a',
    },
    tabBadge: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#eef0f4',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 5,
    },
    tabBadgeActive: {
        backgroundColor: '#1a1a1a',
    },
    tabBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#666',
    },
    tabBadgeTextActive: {
        color: '#fff',
    },

    // Search row
    searchRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 8,
        minHeight: 40,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1a1a1a',
        padding: 0,
    },
    searchCloseBtn: {
        padding: 4,
    },
    searchIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },

    // Status chips
    chipsRow: {
        paddingHorizontal: 16,
        paddingBottom: 10,
        gap: 8,
        flexDirection: 'row',
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#eef0f4',
    },
    chipActive: {
        backgroundColor: '#1a1a1a',
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555',
        includeFontPadding: false,
        lineHeight: 18,
    },
    chipTextActive: {
        color: '#fff',
    },
    chipCount: {
        fontWeight: '500',
        color: '#888',
    },
    chipCountActive: {
        color: '#ccc',
    },

    // List
    listContainer: {
        paddingHorizontal: 16,
        gap: 8,
    },

    // Lead card
    leadCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 13,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    leadAvatarCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#1A2340',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    leadAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    leadInfo: {
        flex: 1,
    },
    leadName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 2,
    },
    leadMeta: {
        fontSize: 12,
        color: '#999',
    },
    leadStatusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        marginLeft: 8,
    },
    leadStatusText: {
        fontSize: 11,
        fontWeight: '600',
    },

    // Review card
    reviewCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    reviewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    reviewAvatarCircle: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#1A2340',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    reviewAvatarText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    reviewInfo: {
        flex: 1,
    },
    reviewName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 3,
    },
    reviewStarsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 2,
    },
    reviewDate: {
        fontSize: 11,
        color: '#aaa',
        marginLeft: 4,
    },
    reviewComment: {
        fontSize: 13,
        color: '#444',
        lineHeight: 19,
    },

    // Loading / empty
    tabLoading: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#555',
        marginTop: 12,
        marginBottom: 6,
    },
    emptyText: {
        fontSize: 13,
        color: '#999',
        textAlign: 'center',
        lineHeight: 20,
    },
});
