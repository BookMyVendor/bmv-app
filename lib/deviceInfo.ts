import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface DeviceInfo {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os: string;
  appVersion: string;
}

/**
 * Get device information for API requests
 */
export function getDeviceInfo(): DeviceInfo {
  const osVersion = Platform.Version;
  const osName = Platform.OS === 'ios' ? 'iOS' : 'Android';
  const osString = `${osName} ${osVersion}`;

  // Get app version from app.json or Constants
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  // Determine device type (simplified - could be enhanced with device detection)
  const deviceType: 'mobile' | 'tablet' | 'desktop' = 'mobile';

  return {
    deviceType,
    os: osString,
    appVersion,
  };
}

