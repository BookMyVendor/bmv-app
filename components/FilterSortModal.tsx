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
import { Check, X, SlidersHorizontal } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, Spacing } from '../constants/theme';

interface FilterSortModalProps {
  visible: boolean;
  onClose: () => void;
  // Sort
  selectedSort: string;
  onSelectSort: (sort: string) => void;
  sortOptions: { label: string; value: string }[];
  // Filters
  selectedRatings: string[];
  onSelectRatings: (ratings: string[]) => void;
  ratingOptions: string[];
}

export default function FilterSortModal({
  visible,
  onClose,
  selectedSort,
  onSelectSort,
  sortOptions,
  selectedRatings,
  onSelectRatings,
  ratingOptions,
}: FilterSortModalProps) {
  const insets = useSafeAreaInsets();

  const handleToggleRating = (rating: string) => {
    if (selectedRatings.includes(rating)) {
      onSelectRatings(selectedRatings.filter((r) => r !== rating));
    } else {
      onSelectRatings([...selectedRatings, rating]);
    }
  };

  const handleClearAll = () => {
    onSelectRatings([]);
    // Optionally also reset sort to default
  };

  const activeCount = selectedRatings.length + (selectedSort !== 'newest' ? 1 : 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.modalContent,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <SlidersHorizontal size={20} color={Colors.text.primary} style={styles.headerIcon} />
              <Text style={styles.modalTitle}>Filter & Sort</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Sort Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sort By</Text>
              <View style={styles.optionsGrid}>
                {sortOptions.map((option) => {
                  const isSelected = selectedSort === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionChip,
                        isSelected && styles.optionChipActive,
                      ]}
                      onPress={() => onSelectSort(option.value)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {isSelected && (
                        <Check size={16} color={Colors.primary.main} style={styles.checkIcon} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.divider} />

            {/* Rating Filter Section */}
            <View style={styles.section}>
              <View style={[styles.sectionHeaderRow]}>
                <Text style={styles.sectionTitle}>Ratings</Text>
                {selectedRatings.length > 0 && (
                  <TouchableOpacity onPress={() => onSelectRatings([])}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.optionsGrid}>
                {ratingOptions.map((rating) => {
                  const isSelected = selectedRatings.includes(rating);
                  return (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.optionChip,
                        isSelected && styles.optionChipActive,
                      ]}
                      onPress={() => handleToggleRating(rating)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          isSelected && styles.optionTextActive,
                        ]}
                      >
                        {rating} Star{parseInt(rating) > 1 ? 's' : ''}
                      </Text>
                      {isSelected && (
                        <Check size={16} color={Colors.primary.main} style={styles.checkIcon} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll}>
              <Text style={styles.clearAllText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={onClose}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 24,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#f2f2f2',
    marginVertical: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionChipActive: {
    backgroundColor: '#EBF4FF',
    borderColor: '#3B82F6',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  optionTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 6,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  footer: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f2f2f2',
    gap: 12,
  },
  clearAllBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clearAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    flex: 2,
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
