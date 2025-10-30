import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';

interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  showClear?: boolean;
  onClear?: () => void;
}

export default function FilterChip({
  label,
  active = false,
  onPress,
  showClear = false,
  onClear,
}: FilterChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
      {showClear && active && onClear && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onClear();
          }}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={14} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 6,
  },
  chipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  chipTextActive: {
    color: '#fff',
  },
  clearButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
