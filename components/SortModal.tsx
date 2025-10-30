import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Check } from 'lucide-react-native';

export type SortOption = 'recent' | 'event_date' | 'budget' | 'newest' | 'oldest' | 'highest' | 'lowest';

interface SortModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSort: SortOption;
  onSelectSort: (sort: SortOption) => void;
  context?: 'reviews' | 'leads';
}

const reviewSortOptions = [
  { value: 'newest' as SortOption, label: 'Newest First' },
  { value: 'oldest' as SortOption, label: 'Oldest First' },
  { value: 'highest' as SortOption, label: 'Highest Rated' },
  { value: 'lowest' as SortOption, label: 'Lowest Rated' },
];

const leadSortOptions = [
  { value: 'recent' as SortOption, label: 'Most Recent' },
  { value: 'event_date' as SortOption, label: 'Event Date (Upcoming First)' },
  { value: 'budget' as SortOption, label: 'Budget (High to Low)' },
];

export default function SortModal({
  visible,
  onClose,
  selectedSort,
  onSelectSort,
  context = 'leads',
}: SortModalProps) {
  const sortOptions = context === 'reviews' ? reviewSortOptions : leadSortOptions;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sort By</Text>
          </View>

          <View style={styles.optionsList}>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.optionItem}
                onPress={() => {
                  onSelectSort(option.value);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedSort === option.value && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
                {selectedSort === option.value && (
                  <Check size={20} color="#3B82F6" strokeWidth={3} />
                )}
              </TouchableOpacity>
            ))}
          </View>
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
    paddingBottom: 40,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  optionsList: {
    paddingTop: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
});
