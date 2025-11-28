import React, { useState, useEffect, useRef } from 'react';
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
  BUDGET_RANGES,
  STATUS_OPTIONS,
  Lead,
} from '@/types/leads';
import Dropdown from '@/components/Dropdown';
import Logo from '@/components/Logo';

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
    category_id: '',
    event_date: '',
    event_location: '',
    guest_count: '',
    event_duration_hours: '',
    budget_range: '',
    requirements: '',
    lead_status: 'new',
    lead_type: 'inquiry',
    lead_source: 'website',
  });

  const [eventCategories, setEventCategories] = useState<{ id: string; name: string }[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs for keyboard navigation
  const customerPhoneRef = useRef<TextInput>(null);
  const customerEmailRef = useRef<TextInput>(null);
  const eventDateRef = useRef<TextInput>(null);
  const eventLocationRef = useRef<TextInput>(null);
  const guestCountRef = useRef<TextInput>(null);
  const eventDurationRef = useRef<TextInput>(null);

  useEffect(() => {
    if (user?.id) {
      fetchBusinesses();
      fetchEventCategories();
      if (isEditMode) {
        fetchLead();
      }
    }
  }, [user?.id, isEditMode]);

  const fetchEventCategories = async () => {
    try {
      const { data, error } = await supabaseCore
        .from('categories')
        .select('id, name')
        .eq('category_type', 'event')
        .eq('category_level', 1)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setEventCategories(data || []);
    } catch (error) {
      console.error('Error fetching event categories:', error);
    }
  };

  const fetchBusinesses = async () => {
    if (!user?.id) {
      return;
    }
    try {
      const { data, error } = await supabaseCore
        .from('vendor_businesses')
        .select('id, business_name')
        .eq('vendor_id', user.id)
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
          category_id: data.category_id || '',
          event_date: data.event_date || '',
          event_location: data.event_location || '',
          guest_count: data.guest_count?.toString() || '',
          event_duration_hours: data.event_duration_hours?.toString() || '',
          budget_range: data.budget_range || '',
          requirements: data.requirements || '',
          lead_status: data.lead_status || 'new',
          lead_type: data.lead_type || 'inquiry',
          lead_source: data.lead_source || 'website',
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

    if (!formData.category_id) {
      newErrors.category_id = 'Event type is required';
    }

    // Validate event_date is required and a future date
    if (!formData.event_date.trim()) {
      newErrors.event_date = 'Event date is required';
    } else {
      const eventDate = new Date(formData.event_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (isNaN(eventDate.getTime())) {
        newErrors.event_date = 'Please enter a valid date (YYYY-MM-DD)';
      } else if (eventDate < today) {
        newErrors.event_date = 'Event date must be in the future';
      }
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

      const leadData: any = {
        vendor_id: user?.id,
        business_id: formData.business_id || null,
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim() || null,
        customer_phone: formData.customer_phone.trim() || null,
        category_id: formData.category_id || null,
        event_date: formData.event_date || null,
        event_location: formData.event_location.trim() || null,
        guest_count: formData.guest_count ? parseInt(formData.guest_count) : null,
        event_duration_hours: formData.event_duration_hours ? parseInt(formData.event_duration_hours) : null,
        budget_range: formData.budget_range || null,
        requirements: formData.requirements.trim() || null,
        lead_status: formData.lead_status,
        lead_type: formData.lead_type,
        lead_source: formData.lead_source,
      };

      if (isEditMode) {
        // Don't update vendor_id on edit - it should remain the same
        const { vendor_id, ...updateData } = leadData;
        
        const { error } = await supabaseCrm
          .from('customer_leads')
          .update(updateData)
          .eq('id', id);

        if (error) throw error;

        Alert.alert('Success', 'Lead updated successfully', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        const { data, error } = await supabaseCrm.from('customer_leads').insert(leadData).select();

        if (error) throw error;

        // Log lead creation activity using lead_communications
        await supabaseCrm.from('lead_communications').insert({
          lead_id: data[0].id,
          vendor_id: user?.id,
          communication_type: 'message',
          message: 'New lead added to the system',
          is_from_vendor: true,
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
        <Logo size={38} style={styles.headerLogo} />
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
              returnKeyType="next"
              onSubmitEditing={() => customerPhoneRef.current?.focus()}
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
              ref={customerPhoneRef}
              style={[styles.input, errors.customer_phone && styles.inputError]}
              placeholder="Enter phone number"
              placeholderTextColor="#999"
              value={formData.customer_phone}
              onChangeText={(text) => updateFormData('customer_phone', text)}
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={() => customerEmailRef.current?.focus()}
            />
            {errors.customer_phone && (
              <Text style={styles.errorText}>{errors.customer_phone}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              ref={customerEmailRef}
              style={[styles.input, errors.customer_email && styles.inputError]}
              placeholder="Enter email address"
              placeholderTextColor="#999"
              value={formData.customer_email}
              onChangeText={(text) => updateFormData('customer_email', text)}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => eventDateRef.current?.focus()}
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
              value={formData.category_id}
              options={eventCategories.map((cat) => ({ label: cat.name, value: cat.id }))}
              onChange={(value) => updateFormData('category_id', value)}
              error={errors.category_id}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              Event Date <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              ref={eventDateRef}
              style={[styles.input, errors.event_date && styles.inputError]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#999"
              value={formData.event_date}
              onChangeText={(text) => updateFormData('event_date', text)}
              returnKeyType="next"
              onSubmitEditing={() => eventLocationRef.current?.focus()}
            />
            {errors.event_date && (
              <Text style={styles.errorText}>{errors.event_date}</Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Location</Text>
            <TextInput
              ref={eventLocationRef}
              style={styles.input}
              placeholder="Enter event location (e.g., Hotel, Pune)"
              placeholderTextColor="#999"
              value={formData.event_location}
              onChangeText={(text) => updateFormData('event_location', text)}
              returnKeyType="next"
              onSubmitEditing={() => guestCountRef.current?.focus()}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Guest Count</Text>
            <TextInput
              ref={guestCountRef}
              style={styles.input}
              placeholder="Number of guests"
              placeholderTextColor="#999"
              value={formData.guest_count}
              onChangeText={(text) => updateFormData('guest_count', text)}
              keyboardType="number-pad"
              returnKeyType="next"
              onSubmitEditing={() => eventDurationRef.current?.focus()}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Event Duration (hours)</Text>
            <TextInput
              ref={eventDurationRef}
              style={styles.input}
              placeholder="Duration in hours"
              placeholderTextColor="#999"
              value={formData.event_duration_hours}
              onChangeText={(text) => updateFormData('event_duration_hours', text)}
              keyboardType="number-pad"
              returnKeyType="done"
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
              value={formData.lead_status}
              options={STATUS_OPTIONS.map((s) => ({ label: s.label, value: s.value }))}
              onChange={(value) => updateFormData('lead_status', value)}
            />
          </View>

          <View style={styles.formGroup}>
            <Dropdown
              label="Lead Type"
              value={formData.lead_type}
              options={[
                { label: 'Inquiry', value: 'inquiry' },
                { label: 'Quote Request', value: 'quote_request' },
                { label: 'Booking Interest', value: 'booking_interest' },
              ]}
              onChange={(value) => updateFormData('lead_type', value)}
            />
          </View>

          <View style={styles.formGroup}>
            <Dropdown
              label="Lead Source"
              value={formData.lead_source}
              options={[
                { label: 'Website', value: 'website' },
                { label: 'Mobile App', value: 'mobile' },
                { label: 'Referral', value: 'referral' },
                { label: 'Direct', value: 'direct' },
              ]}
              onChange={(value) => updateFormData('lead_source', value)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Requirements</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Customer Requirements</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter customer requirements or message"
              placeholderTextColor="#999"
              value={formData.requirements}
              onChangeText={(text) => updateFormData('requirements', text)}
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
