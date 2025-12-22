import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PackageTemplate } from '@/lib/packageTemplates';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';

interface TemplateSelectorProps {
  templates: PackageTemplate[];
  onSelect: (template: PackageTemplate | null) => void;
  selectedTemplateId?: string | null;
}

export default function TemplateSelector({
  templates,
  onSelect,
  selectedTemplateId,
}: TemplateSelectorProps) {
  if (templates.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No templates available for this category</Text>
      </View>
    );
  }

  const renderCard = (
    cardTemplate: PackageTemplate | null,
    isSelected: boolean,
    extraStyles: object[] = []
  ) => (
    <TouchableOpacity
      key={cardTemplate?.id || 'start-from-scratch'}
      style={[
        styles.templateCard,
        ...extraStyles,
        isSelected && styles.templateCardSelected,
      ]}
      onPress={() => onSelect(cardTemplate)}
      activeOpacity={0.7}
    >
      <Text style={styles.templateIcon}>{cardTemplate?.icon || '✨'}</Text>
      <Text
        style={[
          styles.templateName,
          isSelected && styles.templateNameSelected,
        ]}
      >
        {cardTemplate?.name || 'Start from Scratch'}
      </Text>
      {cardTemplate && (
        <Text
          style={[
            styles.templateDescription,
            isSelected && styles.templateDescriptionSelected,
          ]}
        >
          {cardTemplate.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderGridLayout = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.gridContent}
    >
      <View style={styles.gridRow}>
        <View style={styles.gridItem}>
          {renderCard(null, !selectedTemplateId, [styles.templateCardFullWidth])}
        </View>
        {templates.map((template) => (
          <View key={template.id} style={styles.gridItem}>
            {renderCard(template, selectedTemplateId === template.id, [
              styles.templateCardFullWidth,
            ])}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Choose a Template (Optional)</Text>
      <Text style={styles.description}>
        Start with a pre-configured template or create from scratch
      </Text>

      {renderGridLayout()}
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
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  gridContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    marginBottom: Spacing.md,
  },
  emptyState: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  templateCard: {
    width: 180,
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.neutral.lighter,
    alignItems: 'center',
    ...Shadows.small,
  },
  templateCardSelected: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.neutral.white,
  },
  templateCardFullWidth: {
    width: '100%',
  },
  templateIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  templateNameSelected: {
    color: Colors.primary.dark,
  },
  templateDescription: {
    fontSize: 11,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  templateDescriptionSelected: {
    color: Colors.text.primary,
  },
});

