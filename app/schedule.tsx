import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Plus, Calendar, Clock, Trash2, ClipboardList, Building2, Pencil, X } from 'lucide-react-native';
import ScreenBackground from '../components/ScreenBackground';
import { useAuth } from '../contexts/AuthContext';
import { supabaseCore } from '../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import notifee, { TriggerType, AndroidImportance } from '@notifee/react-native';

type CategoryType = 'Call' | 'Meeting' | 'Follow-up';

interface ScheduleItem {
  id: string;
  title: string;
  date: string;
  time: string;
  category: CategoryType;
  businessName: string;
  timestamp: number;
}

const CATEGORY_COLORS = {
  'Call': {
    bg: '#eff3ff',
    text: '#4f46e5',
    dot: '#3b82f6',
  },
  'Meeting': {
    bg: '#e6fdf2',
    text: '#059669',
    dot: '#10b981',
  },
  'Follow-up': {
    bg: '#fff7e5',
    text: '#d97706',
    dot: '#f59e0b',
  },
};

const STORAGE_PREFIX = '@bmv_schedule_items';

export default function ScheduleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCard, setShowNewCard] = useState(false);
  const [businesses, setBusinesses] = useState<{ id: string, business_name: string }[]>([]);

  // New Item State
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  useEffect(() => {
    if (user?.id) {
      loadItems();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadBusinesses();
    }
  }, [user?.id]);

  const loadBusinesses = async () => {
    try {
      const { data, error } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name')
        .eq('vendor_id', user?.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBusinesses(data);
      }
    } catch (e) {
      console.error('Error loading businesses:', e);
    }
  };

  const loadItems = async () => {
    if (!user?.id) return;
    try {
      const stored = await AsyncStorage.getItem(`${STORAGE_PREFIX}_${user.id}`);
      if (stored) {
        const parsedItems: ScheduleItem[] = JSON.parse(stored);
        // Sort items by timestamp (nearest first)
        const sortedItems = parsedItems.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setItems(sortedItems);
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error('Error loading schedule:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveItems = async (newItems: ScheduleItem[]) => {
    if (!user?.id) return;
    try {
      setItems(newItems);
      await AsyncStorage.setItem(`${STORAGE_PREFIX}_${user.id}`, JSON.stringify(newItems));
    } catch (e) {
      console.error('Error saving schedule:', e);
    }
  };

  const scheduleNotification = async (item: ScheduleItem, date: Date) => {
    try {
      // Cancel existing if any
      await notifee.cancelNotification(item.id);

      const triggerDate = new Date(date.getTime() - 15 * 60 * 1000); // 15 mins before

      // If the trigger time is already in the past, don't schedule
      if (triggerDate.getTime() <= Date.now()) {
        console.log('[SCHEDULE] Reminder time is in the past, skipping notification');
        return;
      }

      await notifee.createTriggerNotification(
        {
          id: item.id,
          title: `${item.businessName} - ${item.category}`,
          body: `"${item.title}" starts in 15 minutes.`,
          android: {
            channelId: 'default',
            importance: AndroidImportance.HIGH,
            pressAction: {
              id: 'default',
            },
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerDate.getTime(),
        }
      );
      console.log(`[SCHEDULE] Notification scheduled for: ${triggerDate.toLocaleString()}`);
    } catch (e) {
      console.error('[SCHEDULE] Failed to schedule notification:', e);
    }
  };

  const handleSaveItem = async () => {
    if (!title || !selectedCategory) return;

    let newItems: ScheduleItem[];

    if (editingItem) {
      const updatedItem: ScheduleItem = {
        ...editingItem,
        title,
        date: formatDate(selectedDate),
        time: formatTime(selectedDate),
        category: selectedCategory,
        businessName: selectedBusiness || 'General Business',
        timestamp: selectedDate.getTime(),
      };
      newItems = items.map(item => item.id === editingItem.id ? updatedItem : item);
      await scheduleNotification(updatedItem, selectedDate);
    } else {
      const newItem: ScheduleItem = {
        id: Date.now().toString(),
        title,
        date: formatDate(selectedDate),
        time: formatTime(selectedDate),
        category: selectedCategory,
        businessName: selectedBusiness || 'General Business',
        timestamp: selectedDate.getTime(),
      };
      newItems = [...items, newItem];
      await scheduleNotification(newItem, selectedDate);
    }

    // Sort by timestamp ascending
    newItems.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    saveItems(newItems);

    // Reset form
    setTitle('');
    setSelectedDate(new Date());
    setSelectedCategory(null);
    setSelectedBusiness(null);
    setEditingItem(null);
    setShowNewCard(false);
  };

  const handleEdit = (item: ScheduleItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setSelectedDate(new Date(item.timestamp || Date.now()));
    setSelectedCategory(item.category);
    setSelectedBusiness(item.businessName);
    setShowNewCard(true);
  };

  const handleCancelEdit = () => {
    setTitle('');
    setSelectedDate(new Date());
    setSelectedCategory(null);
    setSelectedBusiness(null);
    setEditingItem(null);
    setShowNewCard(false);
  };

  const handleDelete = async (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    saveItems(newItems);
    await notifee.cancelNotification(id);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScreenBackground style={styles.container}>
      {/* ── App Bar ── */}
      <View style={[styles.appBar, { paddingTop: insets.top + 10, paddingBottom: 16 }]}>
        <View style={styles.appBarLeft}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <ArrowLeft size={20} color="#1a1a1a" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.appBarTitle}>Schedule</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (showNewCard) handleCancelEdit();
            else setShowNewCard(true);
          }}
          activeOpacity={0.7}
          style={styles.iconBtn}
        >
          {showNewCard ? (
            <X size={24} color="#666" strokeWidth={2.5} />
          ) : (
            <Plus size={24} color="#4285F4" strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerRow}>
          <Calendar size={18} color="#4285F4" strokeWidth={2.5} />
          <Text style={styles.headerTitle}>Today's Schedule</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{items.length}</Text>
          </View>
        </View>

        {/* New Item Card directly below header */}
        {showNewCard && (
          <View style={styles.newCard}>
            <View style={styles.newCardHeader}>
              <Text style={styles.newCardTitle}>{editingItem ? 'Edit Schedule Item' : 'New Schedule Item'}</Text>
              {editingItem && (
                <TouchableOpacity onPress={handleCancelEdit}>
                  <X size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Title (e.g. Follow up call)"
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
            />

            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.input, styles.dateTimeBtn]}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar size={16} color="#4285F4" />
                <Text style={styles.dateTimeText}>{formatDate(selectedDate)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.input, styles.dateTimeBtn]}
                onPress={() => setShowTimePicker(true)}
              >
                <Clock size={16} color="#4285F4" />
                <Text style={styles.dateTimeText}>{formatTime(selectedDate)}</Text>
              </TouchableOpacity>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date) setSelectedDate(date);
                }}
              />
            )}

            <View style={styles.chipsRow}>
              {(['Call', 'Meeting', 'Follow-up'] as CategoryType[]).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    selectedCategory === cat && styles.chipActive
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.chipText,
                    selectedCategory === cat && styles.chipTextActive
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {businesses.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContent}>
                {businesses.map(bus => (
                  <TouchableOpacity
                    key={bus.id}
                    style={[
                      styles.chip,
                      selectedBusiness === bus.business_name && styles.chipActive
                    ]}
                    onPress={() => setSelectedBusiness(bus.business_name)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.chipText,
                      selectedBusiness === bus.business_name && styles.chipTextActive
                    ]}>
                      {bus.business_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[
                styles.addBtn,
                (!title || !selectedCategory) && styles.addBtnDisabled
              ]}
              onPress={handleSaveItem}
              activeOpacity={0.8}
              disabled={!title || !selectedCategory}
            >
              <Text style={styles.addBtnText}>{editingItem ? 'Update Schedule' : 'Add to Schedule'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Timeline Items or Empty State */}
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <ClipboardList size={32} color="#CBD5E0" />
            </View>
            <Text style={styles.emptyTitle}>No schedules found</Text>
            <Text style={styles.emptyMessage}>
              Your planned calls, meetings, and follow-ups will appear here once you add them.
            </Text>
            <TouchableOpacity
              style={styles.emptyAddBtn}
              onPress={() => setShowNewCard(true)}
            >
              <Plus size={18} color="#4285F4" />
              <Text style={styles.emptyAddBtnText}>Add first item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {items.map((item, index) => {
              const colors = CATEGORY_COLORS[item.category];
              const isLast = index === items.length - 1;

              return (
                <View key={item.id} style={styles.timelineItemWrap}>
                  {/* Timeline Line & Dot */}
                  <View style={styles.timelineLeft}>
                    <View style={[styles.dot, { backgroundColor: colors.dot }]} />
                    {!isLast && <View style={styles.verticalLine} />}
                  </View>

                  {/* Card */}
                  <View style={styles.itemCardWrap}>
                    <View style={styles.itemCard}>
                      <View style={styles.itemCardTop}>
                        <View style={[styles.catBadge, { backgroundColor: colors.bg }]}>
                          <Text style={[styles.catBadgeText, { color: colors.text }]}>
                            {item.category}
                          </Text>
                        </View>
                        <View style={styles.itemCardActions}>
                          <TouchableOpacity onPress={() => handleEdit(item)} activeOpacity={0.6} style={styles.actionBtn}>
                            <Pencil size={15} color="#4285F4" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDelete(item.id)} activeOpacity={0.6} style={styles.actionBtn}>
                            <Trash2 size={16} color="#F56565" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.itemTitle}>{item.title}</Text>

                      <View style={styles.businessRow}>
                        <Building2 size={14} color="#4285F4" strokeWidth={2} />
                        <Text style={styles.businessName}>{item.businessName}</Text>
                      </View>

                      <View style={styles.itemTimeRow}>
                        <View style={styles.timeTag}>
                          <Clock size={12} color="#718096" />
                          <Text style={styles.itemTime}>{item.time}</Text>
                        </View>
                        <View style={styles.timeTag}>
                          <Calendar size={12} color="#718096" />
                          <Text style={styles.itemTime}>{item.date}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: 8,
  },
  appBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  iconBtn: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginLeft: 10,
    marginRight: 10,
  },
  countBadge: {
    backgroundColor: '#eff4ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countText: {
    color: '#4285F4',
    fontSize: 12,
    fontWeight: '700',
  },

  /* New Card */
  newCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#eee',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  newCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  newCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  input: {
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chipsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: '#f5f7fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chipActive: {
    backgroundColor: '#eef3ff',
    borderWidth: 1,
    borderColor: '#aac5fa',
  },
  chipText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#4285F4',
    fontWeight: '600',
  },
  addBtn: {
    backgroundColor: '#4285F4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addBtnDisabled: {
    backgroundColor: '#a2bff4',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
  },

  /* Timeline */
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineItemWrap: {
    flexDirection: 'row',
    marginBottom: 0, // line handles spacing, but we can do it via itemCardWrap
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 24,
    zIndex: 2,
  },
  verticalLine: {
    width: 1,
    backgroundColor: '#f0f0f0',
    flex: 1,
    marginTop: -8, // Starts going up to the dot position slightly, but since dot has marginTop 24, we'll let it be.
    // Actually, setting flex:1 will stretch it if the row is tall enough.
    // wait, if we want it to go down through the content, it should just be flex:1.
    // But it should also go up. We can just use absolute positioning for the line from dot to bottom.
  },
  // Let's refine the line:
  // Using absolute horizontal center for line, and absolute top for dot.

  itemCardWrap: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 20,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  itemCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  businessName: {
    fontSize: 14,
    color: '#4A5568',
    fontWeight: '600',
  },
  itemTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f7fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemTime: {
    fontSize: 12,
    color: '#718096',
    fontWeight: '500',
  },
});
