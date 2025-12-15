import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';

interface IncludedServicesInputProps {
  services: string[];
  onChange: (services: string[]) => void;
  suggestions?: string[];
}

export default function IncludedServicesInput({
  services,
  onChange,
  suggestions = [],
}: IncludedServicesInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddService = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    // Check if input contains commas (multiple services)
    if (trimmed.includes(',')) {
      // Split by comma and add each service
      const newServices = trimmed
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !services.includes(s));
      
      if (newServices.length > 0) {
        onChange([...services, ...newServices]);
        setInputValue('');
      }
    } else {
      // Single service
      if (!services.includes(trimmed)) {
        onChange([...services, trimmed]);
        setInputValue('');
      }
    }
  };

  const handleRemoveService = (service: string) => {
    onChange(services.filter(s => s !== service));
  };

  const handleAddSuggestion = (suggestion: string) => {
    if (!services.includes(suggestion)) {
      onChange([...services, suggestion]);
    }
  };

  const availableSuggestions = (suggestions || []).filter((s: string) => s && typeof s === 'string' && !services.includes(s));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Included Services</Text>
      <Text style={styles.description}>
        Add services included in this package. You can add multiple services separated by commas (e.g., "Service 1, Service 2, Service 3")
      </Text>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Type a service or multiple services separated by commas..."
            placeholderTextColor={Colors.text.tertiary}
            onSubmitEditing={handleAddService}
            returnKeyType="done"
          />
        </View>
        {inputValue.trim() ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddService}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {availableSuggestions.length > 0 ? (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsLabel}>Suggestions:</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.suggestions}
            contentContainerStyle={styles.suggestionsContent}
          >
            {availableSuggestions.map((suggestion: string) => (
              <TouchableOpacity
                key={suggestion}
                style={styles.suggestionChip}
                onPress={() => handleAddSuggestion(suggestion)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {services.length > 0 ? (
        <View style={styles.servicesContainer}>
          <Text style={styles.servicesLabel}>Selected Services:</Text>
          <View style={styles.servicesList}>
            {services.map((service) => (
              <View key={service} style={styles.serviceChip}>
                <Text style={styles.serviceText}>{service}</Text>
                <TouchableOpacity
                  onPress={() => handleRemoveService(service)}
                  activeOpacity={0.7}
                  style={styles.removeButton}
                >
                  <X size={16} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  inputWrapper: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.neutral.lighter,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text.primary,
    ...Shadows.sm,
  },
  addButton: {
    backgroundColor: Colors.primary.main,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addButtonText: {
    color: Colors.neutral.white,
    fontWeight: '600',
    fontSize: 14,
  },
  suggestionsContainer: {
    marginBottom: Spacing.md,
  },
  suggestionsLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  suggestions: {
    flexDirection: 'row',
  },
  suggestionsContent: {
    paddingRight: Spacing.md,
  },
  suggestionChip: {
    backgroundColor: Colors.neutral.lighter,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
    marginBottom: 0,
  },
  suggestionText: {
    fontSize: 12,
    color: Colors.text.primary,
  },
  servicesContainer: {
    marginTop: Spacing.sm,
  },
  servicesLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.xs,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs / 2,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary.light + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  serviceText: {
    fontSize: 12,
    color: Colors.primary.dark,
    fontWeight: '500',
  },
  removeButton: {
    padding: 2,
  },
});

