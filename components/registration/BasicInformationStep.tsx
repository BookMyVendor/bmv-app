import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';

interface BasicInformationStepProps {
  data: any;
  onUpdate: (data: any) => void;
}

export default function BasicInformationStep({
  data,
  onUpdate,
}: BasicInformationStepProps) {
  const handleChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          style={styles.input}
          value={data.businessName || ''}
          onChangeText={(text) => handleChange('businessName', text)}
          placeholder="Enter your business name"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Contact Person Name *</Text>
        <TextInput
          style={styles.input}
          value={data.contactPersonName || ''}
          onChangeText={(text) => handleChange('contactPersonName', text)}
          placeholder="Enter contact person name"
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          style={styles.input}
          value={data.email || ''}
          onChangeText={(text) => handleChange('email', text)}
          placeholder="your.email@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          value={data.phoneNumber || ''}
          onChangeText={(text) => handleChange('phoneNumber', text)}
          placeholder="+91 XXXXX XXXXX"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
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
});
