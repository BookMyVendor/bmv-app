import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseCore, supabaseCrm } from '@/lib/supabase';
import {
  EVENT_TYPES,
  BUDGET_RANGES,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  Lead,
} from '@/types/leads';
import Dropdown from '@/components/Dropdown';

export default function LeadFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [businesses, setBusinesses] = useState<{ id: string; business_name: string }[]>(
    []
  );

  const [formData, setFormData] = useState({
    business_id: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    event_type: '',
    event_date: '',
    city: '',
    venue: '',
    guest_count: '',
    budget_range: '',
    message: '',
    status: 'new',
    priority: 'medium',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBusinesses();
    if (isEditMode) {
      fetchLead();
    }
  }, []);

  const fetchBusinesses = async () => {
    try {
      const { data, error } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name')
        .eq('vendor_id', user?.id)
        .order('business_name');

      if (error) throw error;
      setBusinesses(data || []);

      if (data && data.length > 0 && !isEditMode) {
        setFormData((prev) => ({ ...prev, business_id: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching businesses:', error);
      Alert.alert('Error', 'Failed to load businesses');
    }
  };

  const fetchLead = async () => {
    try {
      const { data, error } = await supabaseCrm
        .from('customer_leads')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          business_id: data.business_id || '',
          customer_name: data.customer_name || '',
          customer_email: data.customer_email || '',
          customer_phone: data.customer_phone || '',
          event_type: data.event_type || '',
          event_date: data.event_date || '',
          city: data.city || '',
          venue: data.venue || '',
          guest_count: data.guest_count?.toString() || '',
          budget_range: data.budget_range || '',
          message: data.message || '',
          status: data.lead_status || 'new',
          priority: data.priority || 'medium',
          notes: data.notes || '',
        });
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
      Alert.alert('Error', 'Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required';
    }

    if (!formData.customer_phone.trim()) {
      newErrors.customer_phone = 'Phone number is required';
    } else if (!/^\+?\d{10,}$/.test(formData.customer_phone.replace(/\D/g, ''))) {
      newErrors.customer_phone = 'Please enter a valid phone number';
    }

    if (formData.customer_email && !/^\S+@\S+\.\S+$/.test(formData.customer_email)) {
      newErrors.customer_email = 'Please enter a valid email address';
    }

    if (!formData.event_type) {
      newErrors.event_type = 'Event type is required';
    }

    if (!formData.business_id) {
      newErrors.business_id = 'Please select a business';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors in the form');
      return;
    }

    try {
      setSaving(true);

      const leadData = {
        business_id: formData.business_id,
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim() || null,
        customer_phone: formData.customer_phone.trim(),
        event_type: formData.event_type,
        event_date: formData.event_date || null,
        city: formData.city.trim() || null,
        venue: formData.venue.trim() || null,
        guest_count: formData.guest_count ? parseInt(formData.guest_count) : null,
        budget_range: formData.budget_range || null,
        message: formData.message.trim() || null,
        lead_status: formData.status,
        priority: formData.priority,
        notes: formData.notes.trim() || null,
      };

      if (isEditMode) {
        const { error } = await supabaseCrm
          .from('customer_leads')
          .update(leadData)
          .eq('id', id);

        if (error) throw error;

        Alert.alert('Success', 'Lead updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const { data, error } = await supabaseCrm.from('customer_leads').insert(leadData).select();

        if (error) throw error;

        // Note: lead_activities table might be in crm schema - update if needed
        await supabaseCrm.from('lead_activities').insert({
          lead_id: data[0].id,
          activity_type: 'note',
          title: 'Lead created',
          description: 'New lead added to the system',
          performed_by: user?.id,
        });

        Alert.alert('Success', 'Lead created successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      Alert.alert('Error', 'Failed to save lead. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#007AFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Edit Lead' : 'Add New Lead'}
        </Text>
        <TouchableOpacity
          onPress={handleSubmit}
          style={styles.saveBtn}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Save size={24} color="#007AFF" strokeWidth={2} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business</Text>
          <View style={styles.formGroup}>
            <Dropdown
              label="Select Business"
              value={formData.business_id}
              options={businesses.map((b) => ({ label: b.business_name, value: b.id }))}
              onChange={(value) => updateFormData('business_id', value)}
              error={errors.business_id}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Customer Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.customer_name && styles.inputError]}
              placeholder="Enter customer name"
              placeholderTextColor="#999"
              value={formData.customer_name}
              onChangeText={(text) => updateFormData('customer_name', text)}
            />
            {errors.customer_name && (
              <Text style={styles.errorText}>{errors.customer_name}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Phone Number <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.customer_phone && styles.inputError]}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              value={formData.customer_phone}
              onChangeText={(text) => updateFormData('customer_phone', text)}
              keyboardType="phone-pad"
            />
            {errors.customer_phone && (
              <Text style={styles.errorText}>{errors.customer_phone}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.customer_email && styles.inputError]}
              placeholder="Enter email address"
              placeholderTextColor="#999"
              value={formData.customer_email}
              onChangeText={(text) => updateFormData('customer_email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.customer_email && (
              <Text style={styles.errorText}>{errors.customer_email}</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Details</Text>

          <View style={styles.formGroup}>
            <Dropdown
              label="Event Type *"
              value={formData.event_type}
              options={EVENT_TYPES.map((type) => ({ label: type, value: type }))}
              onChange={(value) => updateFormData('event_type', value)}
              error={errors.event_type}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Date</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={formData.event_date}
              onChangeText={(text) => updateFormData('event_date', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>City / Location</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter city or location"
              placeholderTextColor="#999"
              value={formData.city}
              onChangeText={(text) => updateFormData('city', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Venue</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter venue name"
              placeholderTextColor="#999"
              value={formData.venue}
              onChangeText={(text) => updateFormData('venue', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Guest Count</Text>
            <TextInput
              style={styles.input}
              placeholder="Number of guests"
              placeholderTextColor="#999"
              value={formData.guest_count}
              onChangeText={(text) => updateFormData('guest_count', text)}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Dropdown
              label="Budget Range"
              value={formData.budget_range}
              options={BUDGET_RANGES.map((range) => ({ label: range, value: range }))}
              onChange={(value) => updateFormData('budget_range', value)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lead Management</Text>

          <View style={styles.formGroup}>
            <Dropdown
              label="Status"
              value={formData.status}
              options={STATUS_OPTIONS.map((s) => ({ label: s.label, value: s.value }))}
              onChange={(value) => updateFormData('status', value)}
            />
          </View>

          <View style={styles.formGroup}>
            <Dropdown
              label="Priority"
              value={formData.priority}
              options={PRIORITY_OPTIONS.map((p) => ({
                label: p.label,
                value: p.value,
              }))}
              onChange={(value) => updateFormData('priority', value)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Information</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Customer Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter customer message or requirements"
              placeholderTextColor="#999"
              value={formData.message}
              onChangeText={(text) => updateFormData('message', text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Internal Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Add internal notes (not visible to customer)"
              placeholderTextColor="#999"
              value={formData.notes}
              onChangeText={(text) => updateFormData('notes', text)}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEditMode ? 'Update Lead' : 'Create Lead'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    backgroundColor: '#f5f5f5',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  saveBtn: {
    padding: 4,
    width: 40,
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});
