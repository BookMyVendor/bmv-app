import React, { useRef, useImperativeHandle, forwardRef } from 'react';
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
  validationErrors?: Record<string, string>;
}

export interface BasicInformationStepRef {
  focusNextEmptyField: () => void;
}

const BasicInformationStep = forwardRef<BasicInformationStepRef, BasicInformationStepProps>(({
  data,
  onUpdate,
  validationErrors = {},
}, ref) => {
  const handleChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  // Refs for keyboard navigation
  const businessNameRef = useRef<TextInput>(null);
  const contactPersonNameRef = useRef<TextInput>(null);
  const contactPersonRoleRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneNumberRef = useRef<TextInput>(null);

  // Expose method to focus next empty mandatory field
  useImperativeHandle(ref, () => ({
    focusNextEmptyField: () => {
      if (!data.businessName || !data.businessName.trim()) {
        businessNameRef.current?.focus();
      } else if (!data.contactPersonName || !data.contactPersonName.trim()) {
        contactPersonNameRef.current?.focus();
      } else if (!data.email || !data.email.trim()) {
        emailRef.current?.focus();
      } else if (!data.phoneNumber || !data.phoneNumber.trim()) {
        phoneNumberRef.current?.focus();
      }
    },
  }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.field}>
        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          ref={businessNameRef}
          style={[
            styles.input,
            validationErrors.businessName && styles.inputError
          ]}
          value={data.businessName || ''}
          onChangeText={(text) => handleChange('businessName', text)}
          placeholder="Enter your business name"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => contactPersonNameRef.current?.focus()}
        />
        {validationErrors.businessName && (
          <Text style={styles.errorText}>{validationErrors.businessName}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Contact Person Name *</Text>
        <TextInput
          ref={contactPersonNameRef}
          style={[
            styles.input,
            validationErrors.contactPersonName && styles.inputError
          ]}
          value={data.contactPersonName || ''}
          onChangeText={(text) => handleChange('contactPersonName', text)}
          placeholder="Enter contact person name"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => contactPersonRoleRef.current?.focus()}
        />
        {validationErrors.contactPersonName && (
          <Text style={styles.errorText}>{validationErrors.contactPersonName}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Contact Person Role</Text>
        <TextInput
          ref={contactPersonRoleRef}
          style={styles.input}
          value={data.contactPersonRole || ''}
          onChangeText={(text) => handleChange('contactPersonRole', text)}
          placeholder="e.g., Owner, Manager, Director"
          placeholderTextColor="#999"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Email *</Text>
        <TextInput
          ref={emailRef}
          style={[
            styles.input,
            validationErrors.email && styles.inputError
          ]}
          value={data.email || ''}
          onChangeText={(text) => handleChange('email', text)}
          placeholder="your.email@example.com"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => phoneNumberRef.current?.focus()}
        />
        {validationErrors.email && (
          <Text style={styles.errorText}>{validationErrors.email}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          ref={phoneNumberRef}
          style={[
            styles.input,
            validationErrors.phoneNumber && styles.inputError
          ]}
          value={data.phoneNumber || ''}
          placeholder="Enter 10-digit mobile number"
          placeholderTextColor="#999"
          keyboardType="number-pad"
          maxLength={10}
          returnKeyType="done"
          onChangeText={(text) => {
            // remove non-numeric characters
            const numericText = text.replace(/[^0-9]/g, '');

            // allow only 10 digits
            if (numericText.length <= 10) {
              handleChange('phoneNumber', numericText);
            }
          }}
        />

        {validationErrors.phoneNumber && (
          <Text style={styles.errorText}>{validationErrors.phoneNumber}</Text>
        )}
      </View>
    </ScrollView>
  );
});

BasicInformationStep.displayName = 'BasicInformationStep';

export default BasicInformationStep;

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
  inputError: {
    borderColor: '#FF3B30',
    backgroundColor: '#fff5f5',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    fontWeight: '500',
  },
});
