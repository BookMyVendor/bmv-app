import React, { useEffect, useState, useRef } from 'react';
import * as Linking from 'expo-linking';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Users,
  Clock,
  FileText,
  MessageSquare,

  CheckCircle,
} from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { getVendorBusinesses } from '../lib/api/vendorBusinesses';
import { getCategories } from '../lib/api/categories';
import { getLead, getLeadCommunications, createLeadCommunication, updateLead } from '../lib/api/leads';
import { stripCountryCode } from '../lib/formatters';
import { Lead, LeadActivity, STATUS_OPTIONS } from '../types/leads';
import { getTimeAgo, formatEventDate } from '../lib/timeUtils';
import ScreenBackground from '../components/ScreenBackground';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes modal
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLeadDetails();
      fetchActivities();
    }
  }, [id]);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      const { data: businessData } = await getVendorBusinesses(user?.id!);
      const businessList = businessData || [];
      if (businessList.length === 0) {
        Alert.alert('Error', 'No businesses found');
        router.back();
        return;
      }
      const businessMap = new Map(businessList.map((b: any) => [b.id, b.business_name || b.name]));
      console.log('[LeadDetail] Business map keys:', Array.from(businessMap.keys()));
      console.log('[LeadDetail] Business list sample:', businessList.slice(0, 2));
      const { data, error } = await getLead(id);
      if (error) throw new Error(error.error);
      if (data) {
        const d = data as any;
        console.log('[LeadDetail] Lead business_id:', d.business_id);
        console.log('[LeadDetail] Matched business name:', businessMap.get(d.business_id));
        let eventType = d.event_type || 'Unknown Event';
        if (d.category_id) {
          const { data: categories } = await getCategories();
          const cat = (categories || []).find((c: any) => c.id === d.category_id);
          if (cat) eventType = cat.name;
        }
        setLead({
          ...d,
          business_name: businessMap.get(d.business_id) || 'Unknown Business',
          event_type: eventType,
        } as Lead);
      } else {
        Alert.alert('Error', 'Lead not found');
        router.back();
      }
    } catch (error) {
      console.error('Error fetching lead details:', error);
      Alert.alert('Error', 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const { data, error } = await getLeadCommunications(id);
      if (error) throw new Error(error.error);
      const list = (data || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const mappedActivities = list.map((comm: any) => {
        let actType = comm.communication_type;
        let msg = comm.message || '';
        if (actType === 'message' && msg.startsWith('[NOTE] ')) {
          actType = 'note';
          msg = msg.substring(7);
        }
        return {
          id: comm.id,
          lead_id: comm.lead_id,
          activity_type: actType,
          title: getActivityTitle(actType),
          description: msg,
          performed_by: comm.vendor_id,
          created_at: comm.created_at,
          metadata: comm.attachment_file_id ? { attachment_file_id: comm.attachment_file_id } : null,
        };
      });
      setActivities(mappedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const getActivityTitle = (communicationType: string): string => {
    switch (communicationType) {
      case 'call': return 'Phone Call';
      case 'email': return 'Email Sent';
      case 'message': return 'Message';
      case 'note': return 'Note Added';
      case 'status_change': return 'Status Changed';
      case 'meeting': return 'Meeting';
      case 'quote_sent': return 'Quote Sent';
      default: return 'Activity';
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const logActivity = async (type: string, _title: string, description: string) => {
    try {
      await createLeadCommunication({
        lead_id: id,
        vendor_id: user?.id,
        communication_type: type,
        message: description,
        is_from_vendor: true,
      });
      fetchActivities();
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  };

  const handleCallPress = async () => {
    if (lead?.customer_phone) {
      const phoneUrl = `tel:${lead.customer_phone}`;
      try {
        await Linking.openURL(phoneUrl);
        await logActivity('call', 'Called customer', `Phone call to ${lead.customer_phone}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to open dialer.');
      }
    } else {
      Alert.alert('Info', 'No business contact number available for this lead');
    }
  };

  const handleEmailPress = async () => {
    if (lead?.customer_email) {
      const emailUrl = `mailto:${lead.customer_email}`;
      try {
        await Linking.openURL(emailUrl);
        await logActivity('email', 'Sent email', `Email sent to ${lead.customer_email}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to open email client.');
      }
    } else {
      Alert.alert('Info', 'No email address available for this lead');
    }
  };

  const handleMessagePress = async () => {
    if (lead?.customer_phone) {
      const cleanPhone = lead.customer_phone.replace(/\D/g, '');
      const phoneWithCountry = cleanPhone.length === 10 ? `${cleanPhone}` : cleanPhone;
      const whatsappUrl = `https://wa.me/${phoneWithCountry}`;
      try {
        await Linking.openURL(whatsappUrl);
        await logActivity('message', 'WhatsApp message', `WhatsApp chat opened for ${lead.customer_phone}`);
      } catch (error) {
        Alert.alert('Error', 'Failed to open WhatsApp.');
      }
    } else {
      Alert.alert('Info', 'No business contact number available for this lead');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;
    try {
      const { error } = await updateLead(lead.id, { lead_status: newStatus });
      if (error) throw new Error(error.error);
      setLead({ ...lead, lead_status: newStatus as any });
      Alert.alert('Success', 'Status updated successfully');
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.trim() || !lead) return;
    try {
      setSavingNote(true);
      const { error } = await createLeadCommunication({
        lead_id: lead.id,
        vendor_id: user?.id,
        communication_type: 'message',
        message: `[NOTE] ${newNote.trim()}`,
        is_from_vendor: true,
      });
      if (error) throw new Error(error.error);
      setNewNote('');
      setNotesModalVisible(false);
      fetchActivities();
      Alert.alert('Success', 'Note added successfully');
    } catch (error: any) {
      console.error('Error saving note:', error);
      Alert.alert('Error', error.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };



  // ── Render helpers ───────────────────────────────────────────────────────────

  const getStatusInfo = (status: string) =>
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  const notesList = activities.filter((a) => a.activity_type === 'note');

  // ── Loading / Error states ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Lead not found</Text>
        <TouchableOpacity style={styles.errorBackButton} onPress={() => router.back()}>
          <Text style={styles.errorBackButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusInfo = getStatusInfo(lead.lead_status);

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <ScreenBackground style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.topBarBtn}>
            <ArrowLeft size={22} color="#007AFF" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Hero (avatar + name + business + badge) ── */}
          <View style={styles.heroSection}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials(lead.customer_name)}</Text>
            </View>
            <Text style={styles.heroName}>{lead.customer_name}</Text>
            <Text style={styles.heroBusiness}>{lead.business_name}</Text>
            <View style={[styles.heroBadge, { backgroundColor: statusInfo.color + '18' }]}>
              <Text style={[styles.heroBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>

          {/* ── Quick action cards ── */}
          <View style={styles.actionsRow}>
            {/* Call */}
            <TouchableOpacity style={styles.actionCard} onPress={handleCallPress}>
              <View style={[styles.actionIconBg, { backgroundColor: '#E8F5E9' }]}>
                <Phone size={20} color="#34C759" strokeWidth={2} />
              </View>
              <Text style={styles.actionLabel}>Call</Text>
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity
              style={[styles.actionCard, !lead.customer_email && styles.actionCardDisabled]}
              onPress={handleEmailPress}
              disabled={!lead.customer_email}
            >
              <View style={[styles.actionIconBg, { backgroundColor: '#EEF2FF' }]}>
                <Mail size={20} color={lead.customer_email ? '#5C6BC0' : '#CCC'} strokeWidth={2} />
              </View>
              <Text style={[styles.actionLabel, !lead.customer_email && styles.actionLabelDisabled]}>
                Email
              </Text>
            </TouchableOpacity>

            {/* Message */}
            <TouchableOpacity style={styles.actionCard} onPress={handleMessagePress}>
              <View style={[styles.actionIconBg, { backgroundColor: '#E3F2FD' }]}>
                <MessageSquare size={20} color="#007AFF" strokeWidth={2} />
              </View>
              <Text style={styles.actionLabel}>Message</Text>
            </TouchableOpacity>

            {/* Notes */}
            <TouchableOpacity style={styles.actionCard} onPress={() => setNotesModalVisible(true)}>
              <View style={[styles.actionIconBg, { backgroundColor: '#FFF8E1' }]}>
                <FileText size={20} color="#FF9500" strokeWidth={2} />
              </View>
              <Text style={styles.actionLabel}>Notes</Text>
            </TouchableOpacity>
          </View>

          {/* ── Update Status ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Update Status</Text>
            <View style={styles.statusPillsRow}>
              {STATUS_OPTIONS.map((opt) => {
                const isActive = lead.lead_status === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.statusPill,
                      isActive && {
                        backgroundColor: '#fff',
                        borderColor: opt.color,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => handleStatusChange(opt.value)}
                  >
                    {isActive && (
                      <CheckCircle size={12} color={opt.color} strokeWidth={2.5} style={{ marginRight: 4 }} />
                    )}
                    <Text
                      style={[
                        styles.statusPillText,
                        isActive && { color: opt.color, fontWeight: '700' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Contact Info ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact Info</Text>

            {lead.customer_email ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Email</Text>
                <Text style={styles.infoRowValue}>{lead.customer_email}</Text>
              </View>
            ) : null}

            <View style={[styles.infoRow, !lead.customer_email && { borderTopWidth: 0 }]}>
              <Text style={styles.infoRowLabel}>Phone</Text>
              <Text style={styles.infoRowValue}>{stripCountryCode(lead.customer_phone ?? '')}</Text>
            </View>

            {lead.budget_range ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Budget</Text>
                <Text style={[styles.infoRowValue, { color: '#34C759' }]}>{lead.budget_range}</Text>
              </View>
            ) : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoRowLabel}>Added</Text>
              <Text style={styles.infoRowValue}>{getTimeAgo(lead.created_at)}</Text>
            </View>
          </View>

          {/* ── Event Details ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Event Details</Text>

            {lead.event_type ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Event Type</Text>
                <Text style={styles.infoRowValue}>{lead.event_type}</Text>
              </View>
            ) : null}

            {lead.event_date ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Event Date</Text>
                <Text style={styles.infoRowValue}>{formatEventDate(lead.event_date)}</Text>
              </View>
            ) : null}

            {lead.event_location ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Location</Text>
                <Text style={styles.infoRowValue}>{lead.event_location}</Text>
              </View>
            ) : null}

            {lead.event_duration_hours ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Duration</Text>
                <Text style={styles.infoRowValue}>{lead.event_duration_hours} hours</Text>
              </View>
            ) : null}

            {lead.guest_count ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Guests</Text>
                <Text style={styles.infoRowValue}>{lead.guest_count} guests</Text>
              </View>
            ) : null}
          </View>

          {/* ── Requirements ── */}
          {lead.requirements ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Requirements</Text>
              <Text style={styles.requirementsText}>{lead.requirements}</Text>
            </View>
          ) : null}

          {/* ── Notes History ── */}
          {notesList.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes</Text>
              {notesList.map((note, index) => (
                <View
                  key={note.id}
                  style={[styles.noteItem, index < notesList.length - 1 && styles.noteItemBorder]}
                >
                  <View style={styles.noteItemHeader}>
                    <FileText size={14} color="#FF9500" strokeWidth={2} />
                    <Text style={styles.noteItemTime}>{getTimeAgo(note.created_at)}</Text>
                  </View>
                  <Text style={styles.noteItemText}>{note.description}</Text>
                </View>
              ))}
            </View>
          ) : null}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Notes Modal ── */}
      <Modal
        visible={notesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Add Note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Write a note about this lead..."
              placeholderTextColor="#aaa"
              value={newNote}
              onChangeText={setNewNote}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setNotesModalVisible(false);
                  setNewNote('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, (!newNote.trim() || savingNote) && styles.modalSaveBtnDisabled]}
                onPress={handleSaveNote}
                disabled={!newNote.trim() || savingNote}
              >
                {savingNote ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Save Note</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F4F8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F2F4F8',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 24,
  },
  errorBackButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorBackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Top bar ──────────────────────────────────
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 8,
  },
  topBarBtn: {
    padding: 6,
  },

  // ── Scroll ───────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },

  // ── Hero ─────────────────────────────────────
  heroSection: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1A2340',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  heroBusiness: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  heroBadge: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Action cards ─────────────────────────────
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardDisabled: {
    opacity: 0.45,
  },
  actionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  actionLabelDisabled: {
    color: '#bbb',
  },

  // ── Generic card ─────────────────────────────
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 12,
  },

  // ── Status pills ─────────────────────────────
  statusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F2F5',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },

  // ── Info rows ────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  infoRowLabel: {
    fontSize: 14,
    color: '#888',
    fontWeight: '400',
  },
  infoRowValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },

  // ── Requirements ─────────────────────────────
  requirementsText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    paddingBottom: 8,
  },

  // ── Notes history ─────────────────────────────
  noteItem: {
    paddingVertical: 12,
  },
  noteItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  noteItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  noteItemTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  noteItemText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },

  // ── Notes Modal ───────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 14,
  },
  noteInput: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
    minHeight: 120,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalSaveBtnDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
