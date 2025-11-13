import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Dropdown from '@/components/Dropdown';

interface LocationCoverageStepProps {
  data: any;
  onUpdate: (data: any) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Puducherry',
];

export default function LocationCoverageStep({
  data,
  onUpdate,
}: LocationCoverageStepProps) {
  const handleChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Business Address *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={data.businessAddress || ''}
          onChangeText={(text) => handleChange('businessAddress', text)}
          placeholder="Enter your complete business address"
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>City *</Text>
        <TextInput
          style={styles.input}
          value={data.city || ''}
          onChangeText={(text) => handleChange('city', text)}
          placeholder="Enter your city"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>State *</Text>
        <Dropdown
          options={INDIAN_STATES.map((state) => ({
            label: state,
            value: state,
          }))}
          value={data.state || ''}
          placeholder="Select state"
          onChange={(value) => handleChange('state', value)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Pincode</Text>
        <TextInput
          style={styles.input}
          value={data.pincode || ''}
          onChangeText={(text) => handleChange('pincode', text)}
          placeholder="Enter pincode"
          placeholderTextColor="#999"
          keyboardType="numeric"
          maxLength={6}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Service Radius (km)</Text>
        <TextInput
          style={styles.input}
          value={data.serviceRadiusKm?.toString() || ''}
          onChangeText={(text) => {
            const num = parseInt(text) || 0;
            handleChange('serviceRadiusKm', num);
          }}
          placeholder="Enter service radius in kilometers"
          placeholderTextColor="#999"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          This information helps customers find vendors in their area. Make sure
          your address is accurate.
        </Text>
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
    minHeight: 80,
    paddingTop: 14,
  },
  infoBox: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0066cc',
    lineHeight: 20,
  },
});
