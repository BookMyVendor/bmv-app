import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PackageType, PackageTypeConfig } from '../../types/packages';
import { PACKAGE_TYPE_CONFIGS } from '../../lib/packageConfig';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';

interface PackageTypeSelectorProps {
  selectedType: PackageType | null;
  onSelect: (type: PackageType) => void;
  recommendedTypes?: PackageType[];
}

export default function PackageTypeSelector({
  selectedType,
  onSelect,
  recommendedTypes = [],
}: PackageTypeSelectorProps) {
  const types: PackageType[] = ['fixed', 'hourly', 'per_person', 'custom'];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Select Package Type</Text>
      <Text style={styles.description}>
        Choose how you want to price this package
      </Text>

      <View style={styles.grid}>
        {types.map((type) => {
          const config = PACKAGE_TYPE_CONFIGS[type];
          const isRecommended = recommendedTypes.includes(type);
          const isSelected = selectedType === type;

          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.card,
                isSelected && styles.cardSelected,
                isRecommended && styles.cardRecommended,
              ]}
              onPress={() => onSelect(type)}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                  {config.label}
                </Text>
                <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
                  {config.description}
                </Text>
                {isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Recommended</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.neutral.lighter,
    ...Shadows.sm,
  },
  cardSelected: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary.light + '10',
  },
  cardRecommended: {
    borderColor: Colors.success.main,
  },
  cardContent: {
    gap: Spacing.xs,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  cardTitleSelected: {
    color: Colors.primary.dark,
  },
  cardDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  cardDescriptionSelected: {
    color: Colors.text.primary,
  },
  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.success.main,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.neutral.white,
    textTransform: 'uppercase',
  },
});

