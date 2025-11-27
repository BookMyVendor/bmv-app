import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Check, AlertCircle } from 'lucide-react-native';
import Dropdown from '@/components/Dropdown';
import { validatePincode } from '@/lib/pincodeValidation';

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
  const [validatingPincode, setValidatingPincode] = useState(false);
  const [pincodeStatus, setPincodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [cityOptions, setCityOptions] = useState<string[]>([]);

  const handleChange = (field: string, value: string | number) => {
    onUpdate({ [field]: value });
  };

  const handlePincodeChange = (text: string) => {
    // Only allow digits
    const cleanText = text.replace(/\D/g, '');
    handleChange('pincode', cleanText);
    
    // Reset status when typing
    if (pincodeStatus !== 'idle') {
      setPincodeStatus('idle');
      setPincodeError(null);
      setCityOptions([]);
    }
  };

  const handlePincodeBlur = async () => {
    const pincode = data.pincode;
    
    // Only validate if 6 digits
    if (!pincode || pincode.length !== 6) {
      if (pincode && pincode.length > 0 && pincode.length < 6) {
        setPincodeStatus('invalid');
        setPincodeError('Pincode must be 6 digits');
      }
      return;
    }

    setValidatingPincode(true);
    setPincodeError(null);

    try {
      const result = await validatePincode(pincode);

      if (result.valid) {
        setPincodeStatus('valid');
        
        // Set city options for dropdown
        if (result.cityOptions && result.cityOptions.length > 0) {
          setCityOptions(result.cityOptions);
        }
        
        // Auto-fill fields
        if (result.city) {
          handleChange('city', result.city);
        }
        if (result.locality) {
          handleChange('locality', result.locality);
        }
        if (result.state) {
          handleChange('state', result.state);
        }
      } else {
        setPincodeStatus('invalid');
        setPincodeError(result.error || 'Invalid pincode');
        setCityOptions([]);
      }
    } catch (error) {
      setPincodeStatus('invalid');
      setPincodeError('Failed to validate pincode');
      setCityOptions([]);
    } finally {
      setValidatingPincode(false);
    }
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
        <Text style={styles.label}>Pincode *</Text>
        <View style={styles.inputWithStatus}>
          <TextInput
            style={[
              styles.input,
              styles.pincodeInput,
              pincodeStatus === 'valid' && styles.inputValid,
              pincodeStatus === 'invalid' && styles.inputInvalid,
            ]}
            value={data.pincode || ''}
            onChangeText={handlePincodeChange}
            onBlur={handlePincodeBlur}
            placeholder="Enter 6-digit pincode"
            placeholderTextColor="#999"
            keyboardType="numeric"
            maxLength={6}
          />
          <View style={styles.statusIcon}>
            {validatingPincode && (
              <ActivityIndicator size="small" color="#007AFF" />
            )}
            {!validatingPincode && pincodeStatus === 'valid' && (
              <Check size={20} color="#34C759" />
            )}
            {!validatingPincode && pincodeStatus === 'invalid' && (
              <AlertCircle size={20} color="#FF3B30" />
            )}
          </View>
        </View>
        {pincodeError && (
          <Text style={styles.errorText}>{pincodeError}</Text>
        )}
        {pincodeStatus === 'valid' && (
          <Text style={styles.successText}>
            Pincode verified - Location details auto-filled
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>City/Town *</Text>
        {cityOptions.length > 1 ? (
          <Dropdown
            options={cityOptions.map((city) => ({
              label: city,
              value: city,
            }))}
            value={data.city || ''}
            placeholder="Select city/town"
            onChange={(value) => handleChange('city', value)}
          />
        ) : (
          <TextInput
            style={styles.input}
            value={data.city || ''}
            onChangeText={(text) => handleChange('city', text)}
            placeholder="Enter city/town"
            placeholderTextColor="#999"
          />
        )}
        {cityOptions.length > 1 && (
          <Text style={styles.hintText}>Select from available options for this pincode</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Locality/District</Text>
        <TextInput
          style={styles.input}
          value={data.locality || ''}
          onChangeText={(text) => handleChange('locality', text)}
          placeholder="Enter locality/district"
          placeholderTextColor="#999"
        />
        <Text style={styles.hintText}>Auto-filled from pincode (editable)</Text>
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
        <Text style={styles.hintText}>Auto-filled from pincode (editable)</Text>
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
          Enter your pincode to auto-fill city, locality, and state. This helps customers find vendors in their area.
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
  pincodeInput: {
    flex: 1,
    paddingRight: 44,
  },
  inputValid: {
    borderColor: '#34C759',
    backgroundColor: '#f0fff4',
  },
  inputInvalid: {
    borderColor: '#FF3B30',
    backgroundColor: '#fff5f5',
  },
  inputWithStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  statusIcon: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  hintText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  successText: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 4,
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
