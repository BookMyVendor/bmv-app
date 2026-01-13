import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, Mail, Calendar, MapPin, Users, Building2, CreditCard as Edit, Clock, Tag, FileText, MessageSquare, CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabaseCore, supabaseCrm } from '../lib/supabase';
import Logo from '../components/Logo';
import { Lead, LeadActivity, STATUS_OPTIONS } from '../types/leads';
import { getTimeAgo, formatEventDate } from '../lib/timeUtils';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'notes'>('overview');
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    if (id) {
      fetchLeadDetails();
      fetchActivities();
    }
  }, [id]);

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);

      const { data: businessData } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name')
        .eq('vendor_id', user?.id);

      if (!businessData || businessData.length === 0) {
        Alert.alert('Error', 'No businesses found');
        router.back();
        return;
      }

      const businessIds = businessData.map((b) => b.id);
      const businessMap = new Map(businessData.map((b) => [b.id, b.business_name]));

      const { data, error } = await supabaseCrm
        .from('customer_leads')
        .select('*')
        .eq('id', id)
        .in('business_id', businessIds)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Add business_name to the lead data
        const leadWithBusiness = {
          ...data,
          business_name: businessMap.get(data.business_id) || 'Unknown Business',
        };
        setLead(leadWithBusiness as Lead);
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
      const { data, error } = await supabaseCrm
        .from('lead_communications')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map lead_communications to LeadActivity format
      const mappedActivities = (data || []).map((comm) => ({
        id: comm.id,
        lead_id: comm.lead_id,
        activity_type: comm.communication_type as any,
        title: getActivityTitle(comm.communication_type),
        description: comm.message,
        performed_by: comm.vendor_id,
        created_at: comm.created_at,
        metadata: comm.attachment_file_id ? { attachment_file_id: comm.attachment_file_id } : null,
      }));

      setActivities(mappedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const getActivityTitle = (communicationType: string): string => {
    switch (communicationType) {
      case 'call':
        return 'Phone Call';
      case 'email':
        return 'Email Sent';
      case 'message':
        return 'Message';
      case 'meeting':
        return 'Meeting';
      case 'quote_sent':
        return 'Quote Sent';
      default:
        return 'Activity';
    }
  };

  const handleCallPress = async () => {
    console.log('[DEBUG] handleCallPress triggered');
    if (lead?.customer_phone) {
      const phoneUrl = `tel:${lead.customer_phone}`;
      console.log('[DEBUG] Prepared phone URL:', phoneUrl);
      try {
        await Linking.openURL(phoneUrl);
        await logActivity('call', 'Called customer', `Phone call to ${lead.customer_phone}`);
      } catch (error) {
        console.error('[DEBUG] Error opening dialer:', error);
        Alert.alert('Error', 'Failed to open dialer. Your device might not support phone calls.');
      }
    } else {
      console.log('[DEBUG] No customer phone found');
      Alert.alert('Info', 'No phone number available for this lead');
    }
  };

  const handleEmailPress = async () => {
    console.log('[DEBUG] handleEmailPress triggered');
    console.log('[DEBUG] Current Lead Data:', JSON.stringify(lead, null, 2));

    if (lead?.customer_email) {
      const emailUrl = `mailto:${lead.customer_email}`;
      console.log('[DEBUG] Prepared email URL:', emailUrl);

      try {
        console.log('[DEBUG] Calling Linking.openURL(emailUrl)...');
        // Use expo-linking's openURL
        const success = await Linking.openURL(emailUrl);
        console.log('[DEBUG] Linking.openURL promise resolved, success:', success);

        await logActivity('email', 'Sent email', `Email sent to ${lead.customer_email}`);
      } catch (error) {
        console.error('[DEBUG] catch error in handleEmailPress:', error);
        Alert.alert('Error', 'Failed to open email client. Please make sure you have an email app installed.');
      }
    } else {
      console.log('[DEBUG] No customer email found. lead.customer_email is:', lead?.customer_email);
      Alert.alert('Info', 'No email address available for this lead');
    }
  };

  const handleMessagePress = async () => {
    console.log('[DEBUG] handleMessagePress triggered');
    if (lead?.customer_phone) {
      // Clean phone number: remove non-numeric characters
      const cleanPhone = lead.customer_phone.replace(/\D/g, '');
      // Add India country code if not present (assuming default is India for this app)
      const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

      const whatsappUrl = `https://wa.me/${phoneWithCountry}`;
      console.log('[DEBUG] Prepared WhatsApp URL:', whatsappUrl);
      try {
        await Linking.openURL(whatsappUrl);
        await logActivity('message', 'WhatsApp message', `WhatsApp chat opened for ${lead.customer_phone}`);
      } catch (error) {
        console.error('[DEBUG] Error opening WhatsApp:', error);
        Alert.alert('Error', 'Failed to open WhatsApp. Please make sure it is installed.');
      }
    } else {
      console.log('[DEBUG] No customer phone found for WhatsApp');
      Alert.alert('Info', 'No phone number available for this lead');
    }
  };

  const logActivity = async (type: string, title: string, description: string) => {
    try {
      await supabaseCrm.from('lead_communications').insert({
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

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return;

    try {
      const { error } = await supabaseCrm
        .from('customer_leads')
        .update({ lead_status: newStatus })
        .eq('id', lead.id);

      if (error) throw error;

      await logActivity(
        'message',
        'Status changed',
        `Status changed from ${lead.lead_status} to ${newStatus}`
      );

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

      // Use lead_communications with communication_type = 'message' for notes
      await supabaseCrm.from('lead_communications').insert({
        lead_id: lead.id,
        vendor_id: user?.id,
        communication_type: 'message',
        message: newNote.trim(),
        is_from_vendor: true,
      });

      setNewNote('');
      fetchActivities();
      Alert.alert('Success', 'Note added successfully');
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };


  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue || '');
  };

  const saveEdit = async () => {
    if (!lead || !editingField) return;

    try {
      // Map UI field names to database field names
      const fieldMapping: Record<string, string> = {
        status: 'lead_status',
        event_type: 'category_id', // Note: This would need category lookup
      };

      const dbFieldName = fieldMapping[editingField] || editingField;
      const updateData: any = { [dbFieldName]: editValue };

      // Validate event_date is future if being updated
      if (editingField === 'event_date' && editValue) {
        const eventDate = new Date(editValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(eventDate.getTime())) {
          Alert.alert('Error', 'Please enter a valid date (YYYY-MM-DD)');
          return;
        } else if (eventDate < today) {
          Alert.alert('Error', 'Event date must be in the future');
          return;
        }
      }

      const { error } = await supabaseCrm
        .from('customer_leads')
        .update(updateData)
        .eq('id', lead.id);

      if (error) throw error;

      setLead({ ...lead, [editingField]: editValue, [dbFieldName]: editValue } as any);
      setEditingField(null);
      Alert.alert('Success', 'Field updated successfully');
    } catch (error) {
      console.error('Error updating field:', error);
      Alert.alert('Error', 'Failed to update field');
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  };


  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone size={16} color="#007AFF" />;
      case 'email':
        return <Mail size={16} color="#007AFF" />;
      case 'message':
        return <FileText size={16} color="#007AFF" />;
      case 'meeting':
        return <Users size={16} color="#007AFF" />;
      case 'quote_sent':
        return <CheckCircle size={16} color="#34C759" />;
      default:
        return <MessageSquare size={16} color="#007AFF" />;
    }
  };

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusInfo = getStatusInfo(lead.lead_status);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#007AFF" strokeWidth={2} />
        </TouchableOpacity>
        <Logo size={38} style={styles.headerLogo} />
        <Text style={styles.headerTitle}>Lead Details</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroName}>{lead.customer_name}</Text>
            <Text style={styles.heroBusiness}>{lead.business_name}</Text>
          </View>
          <View style={styles.badges}>
            <View
              style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}
            >
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleCallPress}
          >
            <Phone size={20} color="#007AFF" strokeWidth={2} />
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleEmailPress}
          >
            <Mail size={20} color="#007AFF" strokeWidth={2} />
            <Text style={styles.actionButtonText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleMessagePress}
          >
            <MessageSquare size={20} color="#007AFF" strokeWidth={2} />
            <Text style={styles.actionButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text
            style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}
          >
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'activity' && styles.activeTab]}
          onPress={() => setActiveTab('activity')}
        >
          <Text
            style={[styles.tabText, activeTab === 'activity' && styles.activeTabText]}
          >
            Activity
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notes' && styles.activeTab]}
          onPress={() => setActiveTab('notes')}
        >
          <Text style={[styles.tabText, activeTab === 'notes' && styles.activeTabText]}>
            Notes
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Phone size={20} color="#666" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{lead.customer_phone}</Text>
                </View>
              </View>

              {lead.customer_email && (
                <View style={styles.infoRow}>
                  <Mail size={20} color="#666" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{lead.customer_email}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Event Details</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Calendar size={20} color="#666" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Event Type</Text>
                  <Text style={styles.infoValue}>{lead.event_type}</Text>
                </View>
              </View>

              {lead.event_date && (
                <View style={styles.infoRow}>
                  <Clock size={20} color="#666" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Event Date</Text>
                    <Text style={styles.infoValue}>
                      {formatEventDate(lead.event_date)}
                    </Text>
                  </View>
                </View>
              )}

              {lead.event_location && (
                <View style={styles.infoRow}>
                  <MapPin size={20} color="#666" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Event Location</Text>
                    <Text style={styles.infoValue}>{lead.event_location}</Text>
                  </View>
                </View>
              )}

              {lead.event_duration_hours && (
                <View style={styles.infoRow}>
                  <Clock size={20} color="#666" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Duration</Text>
                    <Text style={styles.infoValue}>{lead.event_duration_hours} hours</Text>
                  </View>
                </View>
              )}

              {lead.guest_count && (
                <View style={styles.infoRow}>
                  <Users size={20} color="#666" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Guest Count</Text>
                    <Text style={styles.infoValue}>{lead.guest_count} guests</Text>
                  </View>
                </View>
              )}

              {lead.budget_range && (
                <View style={styles.infoRow}>
                  <Text style={{ fontSize: 20, color: '#666', fontWeight: '600' }}>₹</Text>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Budget Range</Text>
                    <Text style={styles.infoValue}>₹ {lead.budget_range}</Text>
                  </View>
                </View>
              )}

            </View>

            {lead.requirements && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Requirements</Text>
                </View>
                <View style={styles.messageCard}>
                  <Text style={styles.messageText}>{lead.requirements}</Text>
                </View>
              </>
            )}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Change Status</Text>
            </View>

            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status.value}
                  style={[
                    styles.statusOption,
                    lead.lead_status === status.value && styles.statusOptionActive,
                    { borderColor: status.color },
                  ]}
                  onPress={() => handleStatusChange(status.value)}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      lead.lead_status === status.value && { color: status.color },
                    ]}
                  >
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeTab === 'activity' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Activity Timeline</Text>
              <Text style={styles.activityCount}>{activities.length} activities</Text>
            </View>

            {activities.length === 0 ? (
              <View style={styles.emptyState}>
                <Clock size={48} color="#ddd" />
                <Text style={styles.emptyStateText}>No activities yet</Text>
              </View>
            ) : (
              <View style={styles.timeline}>
                {activities.map((activity, index) => (
                  <View key={activity.id} style={styles.timelineItem}>
                    <View style={styles.timelineDot}>
                      {getActivityIcon(activity.activity_type)}
                    </View>
                    {index < activities.length - 1 && <View style={styles.timelineLine} />}
                    <View style={styles.activityCard}>
                      <View style={styles.activityHeader}>
                        <Text style={styles.activityTitle}>{activity.title}</Text>
                        <Text style={styles.activityTime}>
                          {getTimeAgo(activity.created_at)}
                        </Text>
                      </View>
                      {activity.description && (
                        <Text style={styles.activityDescription}>
                          {activity.description}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'notes' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Add Note</Text>
            </View>

            <View style={styles.noteInputCard}>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note about this lead..."
                placeholderTextColor="#999"
                value={newNote}
                onChangeText={setNewNote}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.saveNoteButton, !newNote.trim() && styles.disabledButton]}
                onPress={handleSaveNote}
                disabled={!newNote.trim() || savingNote}
              >
                {savingNote ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveNoteButtonText}>Save Note</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Notes History</Text>
            </View>

            {activities.filter((a) => a.activity_type === 'message').length === 0 ? (
              <View style={styles.emptyState}>
                <FileText size={48} color="#ddd" />
                <Text style={styles.emptyStateText}>No notes yet</Text>
              </View>
            ) : (
              <View style={styles.notesList}>
                {activities
                  .filter((a) => a.activity_type === 'message')
                  .map((note) => (
                    <View key={note.id} style={styles.noteCard}>
                      <View style={styles.noteHeader}>
                        <FileText size={16} color="#007AFF" />
                        <Text style={styles.noteTime}>{getTimeAgo(note.created_at)}</Text>
                      </View>
                      <Text style={styles.noteContent}>{note.description}</Text>
                    </View>
                  ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    padding: 4,
  },
  headerLogo: {
    marginLeft: 8,
    marginRight: 8,
    marginVertical: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  heroCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroHeader: {
    marginBottom: 16,
  },
  heroLeft: {
    marginBottom: 12,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  heroBusiness: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  activityCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 16,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  statusOptionActive: {
    backgroundColor: '#f5f5f5',
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    position: 'relative',
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    zIndex: 1,
  },
  timelineLine: {
    position: 'absolute',
    left: 15,
    top: 40,
    bottom: -8,
    width: 2,
    backgroundColor: '#e0e0e0',
  },
  activityCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  activityDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  noteInputCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  noteInput: {
    fontSize: 15,
    color: '#1a1a1a',
    minHeight: 100,
    marginBottom: 12,
    padding: 0,
  },
  saveNoteButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveNoteButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  notesList: {
    gap: 12,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  noteTime: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  noteContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
});
