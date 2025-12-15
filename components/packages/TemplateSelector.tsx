import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { PackageTemplate } from '@/lib/packageTemplates';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';

interface TemplateSelectorProps {
  templates: PackageTemplate[];
  onSelect: (template: PackageTemplate) => void;
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Choose a Template (Optional)</Text>
      <Text style={styles.description}>
        Start with a pre-configured template or create from scratch
      </Text>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={[
            styles.templateCard,
            !selectedTemplateId && styles.templateCardSelected,
          ]}
          onPress={() => onSelect(null!)}
          activeOpacity={0.7}
        >
          <Text style={styles.templateIcon}>✨</Text>
          <Text style={[styles.templateName, !selectedTemplateId && styles.templateNameSelected]}>
            Start from Scratch
          </Text>
        </TouchableOpacity>

        {templates.map((template) => {
          const isSelected = selectedTemplateId === template.id;
          return (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateCard,
                isSelected && styles.templateCardSelected,
              ]}
              onPress={() => onSelect(template)}
              activeOpacity={0.7}
            >
              <Text style={styles.templateIcon}>{template.icon || '📦'}</Text>
              <Text style={[styles.templateName, isSelected && styles.templateNameSelected]}>
                {template.name}
              </Text>
              <Text style={[styles.templateDescription, isSelected && styles.templateDescriptionSelected]}>
                {template.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
  scrollView: {
    marginHorizontal: -Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
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
    ...Shadows.sm,
  },
  templateCardSelected: {
    borderColor: Colors.primary.main,
    backgroundColor: Colors.primary.light + '10',
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

