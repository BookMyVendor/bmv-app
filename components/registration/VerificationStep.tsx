import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
} from 'react-native';

interface VerificationStepProps {
  data: any;
  onUpdate: (data: any) => void;
}

export default function VerificationStep({
  data,
  onUpdate,
}: VerificationStepProps) {
  const handleChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Business Verification</Text>
        <Text style={styles.infoText}>
          Adding verification details helps build trust with customers. These
          fields are optional but recommended.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>GST Number</Text>
        <Text style={styles.hint}>Optional - For registered businesses</Text>
        <TextInput
          style={styles.input}
          value={data.gstNumber || ''}
          onChangeText={(text) => handleChange('gstNumber', text)}
          placeholder="Enter GST number (e.g., 22AAAAA0000A1Z5)"
          placeholderTextColor="#999"
          autoCapitalize="characters"
          maxLength={15}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Business Registration Number</Text>
        <Text style={styles.hint}>
          Optional - CIN, PAN, or other registration number
        </Text>
        <TextInput
          style={styles.input}
          value={data.businessRegistrationNumber || ''}
          onChangeText={(text) =>
            handleChange('businessRegistrationNumber', text)
          }
          placeholder="Enter business registration number"
          placeholderTextColor="#999"
          autoCapitalize="characters"
        />
      </View>

      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>💡 Why verify?</Text>
        <Text style={styles.tipText}>
          • Builds customer confidence{'\n'}
          • Appears higher in search results{'\n'}
          • Eligible for premium features{'\n'}
          • Protects your business identity
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
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    color: '#666',
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
  infoBox: {
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0066cc',
    lineHeight: 20,
  },
  tipBox: {
    backgroundColor: '#fff9e6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#996600',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#996600',
    lineHeight: 22,
  },
});
