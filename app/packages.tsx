import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Plus, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../contexts/AuthContext';
import { PricingPackage } from '../types/packages';
import { getBusinessPackages, togglePackageStatus } from '../lib/packageApi';
import PackageList from '../components/packages/PackageList';
import { Colors, Shadows, BorderRadius, Spacing } from '../constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenBackground from '../components/ScreenBackground';

export default function PackagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [packages, setPackages] = useState<PricingPackage[]>([]);

  useEffect(() => {
    if (businessId) {
      loadPackages();
    }
  }, [businessId]);

  const loadPackages = async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      const { data, error } = await getBusinessPackages(businessId);
      if (error) throw error;
      // Filter out inactive packages - only show active ones
      const activePackages = (data || []).filter((pkg: any) => pkg.is_active !== false);
      setPackages(activePackages);
    } catch (error: any) {
      console.error('Error loading packages:', error);
      Alert.alert('Error', 'Failed to load packages. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPackages();
  };

  const handleCreatePackage = () => {
    router.push({
      pathname: '/package-form',
      params: { businessId },
    });
  };

  const handleEditPackage = (pkg: PricingPackage) => {
    router.push({
      pathname: '/package-form',
      params: { id: pkg.id, businessId },
    });
  };

  const handleDeletePackage = (pkg: PricingPackage) => {
    Alert.alert(
      'Delete Package',
      `Are you sure you want to delete "${pkg.package_name}"? This will mark it as inactive and hide it from the list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await togglePackageStatus(pkg.id!, false);
              if (error) throw error;
              loadPackages();
            } catch (error: any) {
              console.error('Error deleting package:', error);
              Alert.alert('Error', error.message || 'Failed to delete package. Please try again.');
            }
          },
        },
      ]
    );
  };


  if (loading && packages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary.main} />
      </View>
    );
  }

  return (
    <ScreenBackground style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Packages</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerActions}>
          <Text style={styles.subtitle}>
            Manage your pricing packages ({packages.length})
          </Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreatePackage}
            activeOpacity={0.7}
          >
            <Plus size={20} color={Colors.neutral.white} />
            <Text style={styles.createButtonText}>Add Package</Text>
          </TouchableOpacity>
        </View>

        <PackageList
          packages={packages}
          onEdit={handleEditPackage}
          onDelete={handleDeletePackage}
          onToggleStatus={() => { }} // Not used anymore, but required by interface
          loading={loading}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  backButton: {
    padding: Spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  headerActions: {
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Spacing.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary.main,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  createButtonText: {
    color: Colors.neutral.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

