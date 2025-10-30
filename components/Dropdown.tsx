import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';

type DropdownOption = string | { label: string; value: string };

interface DropdownProps {
  options: DropdownOption[];
  value: string | null;
  placeholder?: string;
  label?: string;
  error?: string;
  onSelect?: (value: string) => void;
  onChange?: (value: string) => void;
}

export default function Dropdown({
  options,
  value,
  placeholder = 'Select an option',
  label,
  error,
  onSelect,
  onChange,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const normalizeOption = (
    option: DropdownOption
  ): { label: string; value: string } => {
    if (typeof option === 'string') {
      return { label: option, value: option };
    }
    return option;
  };

  const normalizedOptions = options.map(normalizeOption);

  const displayValue = normalizedOptions.find((opt) => opt.value === value)?.label;

  const handleSelect = (optionValue: string) => {
    if (onSelect) onSelect(optionValue);
    if (onChange) onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={[styles.dropdown, error && styles.dropdownError]}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, !value && styles.placeholder]}>
          {displayValue || placeholder}
        </Text>
        <ChevronDown
          size={20}
          color="#666"
          style={[styles.chevron, isOpen && styles.chevronOpen]}
        />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
            </View>
            <ScrollView style={styles.optionsList}>
              {normalizedOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    value === option.value && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      value === option.value && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {value === option.value && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    minHeight: 52,
  },
  dropdownError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    marginLeft: 4,
  },
  dropdownText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  placeholder: {
    color: '#999',
  },
  chevron: {
    marginLeft: 8,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  optionsList: {
    maxHeight: 400,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#f0f7ff',
  },
  optionText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  optionTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
