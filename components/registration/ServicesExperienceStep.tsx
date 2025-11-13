import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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
  const [businessCategories, setBusinessCategories] = useState<Category[]>([]);
  const [eventCategories, setEventCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);

      // Fetch business categories
      const { data: businessCats, error: businessError } = await supabaseCore
        .from('categories')
        .select('id, name, icon')
        .eq('category_type', 'business')
        .eq('visible', true)
        .order('sort_order', { ascending: true });

      if (businessError) {
        console.error('Error fetching business categories:', businessError);
      } else {
        setBusinessCategories(businessCats || []);
      }

      // Fetch event categories
      const { data: eventCats, error: eventError } = await supabaseCore
        .from('categories')
        .select('id, name, icon')
        .eq('category_type', 'event')
        .eq('visible', true)
        .order('sort_order', { ascending: true });

      if (eventError) {
        console.error('Error fetching event categories:', eventError);
      } else {
        setEventCategories(eventCats || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  const toggleEventType = (eventTypeName: string) => {
    const currentTypes = data.eventTypes || [];
    const newTypes = currentTypes.includes(eventTypeName)
      ? currentTypes.filter((t: string) => t !== eventTypeName)
      : [...currentTypes, eventTypeName];
    handleChange('eventTypes', newTypes);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Service Category *</Text>
        <Dropdown
          options={businessCategories.map((cat) => ({
            label: cat.icon ? `${cat.icon} ${cat.name}` : cat.name,
            value: cat.name,
          }))}
          value={data.vendorServiceCategory || ''}
          placeholder="Select service category"
          onChange={(value) => handleChange('vendorServiceCategory', value)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Event Types *</Text>
        {eventCategories.length === 0 ? (
          <Text style={styles.errorText}>No event categories available</Text>
        ) : (
          <View style={styles.chipContainer}>
            {eventCategories.map((eventCategory) => {
              const eventName = eventCategory.name;
              const isSelected = (data.eventTypes || []).includes(eventName);
              return (
                <TouchableOpacity
                  key={eventCategory.id}
                  style={[
                    styles.chip,
                    isSelected && styles.chipSelected,
                  ]}
                  onPress={() => toggleEventType(eventName)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected,
                    ]}
                  >
                    {eventCategory.icon ? `${eventCategory.icon} ` : ''}
                    {eventName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
          onChange={(value) => handleChange('yearsOfExperience', value)}
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
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  chipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    color: '#666',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#ff3b30',
    fontStyle: 'italic',
  },
});
