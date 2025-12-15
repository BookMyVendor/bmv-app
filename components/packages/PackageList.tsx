import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Edit, Trash2, Eye, EyeOff } from 'lucide-react-native';
import { PricingPackage } from '@/types/packages';
import { PACKAGE_TYPE_CONFIGS } from '@/lib/packageConfig';
import { Colors, Shadows, BorderRadius, Spacing } from '@/constants/theme';

interface PackageListProps {
  packages: PricingPackage[];
  onEdit: (pkg: PricingPackage) => void;
  onDelete: (pkg: PricingPackage) => void;
  onToggleStatus?: (pkg: PricingPackage) => void; // Optional, not used anymore
  loading?: boolean;
}

export default function PackageList({
  packages,
  onEdit,
  onDelete,
  onToggleStatus,
  loading = false,
}: PackageListProps) {
  const formatPrice = (pkg: PricingPackage): string => {
    const config = PACKAGE_TYPE_CONFIGS[pkg.package_type];
    
    switch (pkg.package_type) {
      case 'fixed':
        return `₹${pkg.base_price.toLocaleString('en-IN')}`;
      case 'hourly':
        return `₹${pkg.base_price.toLocaleString('en-IN')}/hour`;
      case 'per_person':
        return `₹${pkg.base_price.toLocaleString('en-IN')}/person`;
      case 'custom':
        if (pkg.min_price && pkg.max_price) {
          return `₹${pkg.min_price.toLocaleString('en-IN')} - ₹${pkg.max_price.toLocaleString('en-IN')}`;
        }
        return `₹${pkg.base_price?.toLocaleString('en-IN') || '0'}`;
      default:
        return `₹${pkg.base_price.toLocaleString('en-IN')}`;
    }
  };

  const getCapacityText = (pkg: PricingPackage): string => {
    if (pkg.package_type === 'per_person') {
      if (pkg.min_capacity && pkg.max_capacity) {
        return `${pkg.min_capacity}-${pkg.max_capacity} guests`;
      }
      if (pkg.min_capacity) {
        return `Min ${pkg.min_capacity} guests`;
      }
    }
    if (pkg.package_type === 'hourly' && pkg.min_capacity) {
      return `Min ${pkg.min_capacity} hours`;
    }
    return '';
  };

  if (packages.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyStateText}>No packages yet</Text>
        <Text style={styles.emptyStateSubtext}>
          Create your first package to start receiving inquiries
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {packages.map((pkg) => (
        <View key={pkg.id} style={styles.packageCard}>
          <View style={styles.packageHeader}>
            <View style={styles.packageTitleRow}>
              <Text style={styles.packageName}>{pkg.package_name}</Text>
              <View style={[styles.statusBadge, !pkg.is_active && styles.statusBadgeInactive]}>
                <Text style={[styles.statusText, !pkg.is_active && styles.statusTextInactive]}>
                  {pkg.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <Text style={styles.packageType}>
              {PACKAGE_TYPE_CONFIGS[pkg.package_type]?.label || pkg.package_type}
            </Text>
          </View>

          <View style={styles.packageDetails}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Price:</Text>
              <Text style={styles.priceValue}>{formatPrice(pkg)}</Text>
            </View>

            {getCapacityText(pkg) ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Capacity:</Text>
                <Text style={styles.detailValue}>{getCapacityText(pkg)}</Text>
              </View>
            ) : null}

            {pkg.included_services && pkg.included_services.length > 0 ? (
              <View style={styles.servicesRow}>
                <Text style={styles.detailLabel}>Services:</Text>
                <Text style={styles.servicesText} numberOfLines={2}>
                  {pkg.included_services.join(', ')}
                </Text>
              </View>
            ) : null}

            {pkg.package_description ? (
              <Text style={styles.description} numberOfLines={2}>
                {pkg.package_description}
              </Text>
            ) : null}
          </View>

          <View style={styles.packageActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => onEdit(pkg)}
              activeOpacity={0.7}
            >
              <Edit size={16} color={Colors.primary.main} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => {
                console.log('Delete button pressed for package:', pkg.id, pkg.package_name);
                onDelete(pkg);
              }}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={Colors.error.main} />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  packageCard: {
    backgroundColor: Colors.neutral.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  packageHeader: {
    marginBottom: Spacing.md,
  },
  packageTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  packageName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  statusBadge: {
    backgroundColor: Colors.success.main + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusBadgeInactive: {
    backgroundColor: Colors.neutral.lighter,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success.dark,
    textTransform: 'uppercase',
  },
  statusTextInactive: {
    color: Colors.text.secondary,
  },
  packageType: {
    fontSize: 12,
    color: Colors.text.secondary,
    textTransform: 'capitalize',
  },
  packageDetails: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary.main,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  detailValue: {
    fontSize: 12,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  servicesRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  servicesText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text.primary,
  },
  description: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  packageActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral.lighter,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  editButton: {
    backgroundColor: Colors.primary.light + '20',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary.main,
  },
  toggleButton: {
    backgroundColor: Colors.neutral.lighter,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning.main,
  },
  toggleButtonTextActive: {
    color: Colors.success.main,
  },
  deleteButton: {
    backgroundColor: Colors.error.main + '10',
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error.main,
  },
});

