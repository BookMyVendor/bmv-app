import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Check } from 'lucide-react-native';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  selectedOptions: string[];
  onSelectOptions: (options: string[]) => void;
  multiSelect?: boolean;
}

export default function FilterModal({
  visible,
  onClose,
  title,
  options,
  selectedOptions,
  onSelectOptions,
  multiSelect = true,
}: FilterModalProps) {
  const handleToggleOption = (option: string) => {
    if (multiSelect) {
      if (selectedOptions.includes(option)) {
        onSelectOptions(selectedOptions.filter((o) => o !== option));
      } else {
        onSelectOptions([...selectedOptions, option]);
      }
    } else {
      onSelectOptions([option]);
      onClose();
    }
  };

  const handleClearAll = () => {
    onSelectOptions([]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.modalContent}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            {multiSelect && selectedOptions.length > 0 && (
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.optionsList}>
            {options.map((option) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <TouchableOpacity
                  key={option}
                  style={styles.optionItem}
                  onPress={() => handleToggleOption(option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                  {isSelected && (
                    <Check size={20} color="#007AFF" strokeWidth={3} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {multiSelect && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={onClose}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  optionsList: {
    maxHeight: 400,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  optionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
