import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Dropdown from '@/components/Dropdown';

interface ServicesExperienceStepProps {
  data: any;
  onUpdate: (data: any) => void;
}

const SERVICE_CATEGORIES = [
  'Photographer',
  'Videographer',
  'Caterer',
  'Decorator',
  'DJ/Music',
  'Makeup Artist',
  'Mehendi Artist',
  'Venue',
  'Wedding Planner',
  'Florist',
  'Invitation Designer',
  'Choreographer',
];

const EVENT_TYPES = [
  'Wedding',
  'Engagement',
  'Reception',
  'Birthday',
  'Corporate Event',
  'Anniversary',
  'Baby Shower',
  'Other',
];

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
  const handleChange = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  const toggleEventType = (eventType: string) => {
    const currentTypes = data.eventTypes || [];
    const newTypes = currentTypes.includes(eventType)
      ? currentTypes.filter((t: string) => t !== eventType)
      : [...currentTypes, eventType];
    handleChange('eventTypes', newTypes);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Service Category *</Text>
        <Dropdown
          options={SERVICE_CATEGORIES.map((cat) => ({
            label: cat,
            value: cat,
          }))}
          value={data.vendorServiceCategory || ''}
          placeholder="Select service category"
          onChange={(value) => handleChange('vendorServiceCategory', value)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Event Types *</Text>
        <View style={styles.chipContainer}>
          {EVENT_TYPES.map((eventType) => (
            <TouchableOpacity
              key={eventType}
              style={[
                styles.chip,
                (data.eventTypes || []).includes(eventType) &&
                  styles.chipSelected,
              ]}
              onPress={() => toggleEventType(eventType)}
            >
              <Text
                style={[
                  styles.chipText,
                  (data.eventTypes || []).includes(eventType) &&
                    styles.chipTextSelected,
                ]}
              >
                {eventType}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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
});
