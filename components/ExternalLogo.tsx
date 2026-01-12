import React from 'react';
import { Image, ImageStyle, StyleSheet, ViewStyle } from 'react-native';

interface LogoProps {
  size?: number;
  style?: ImageStyle | ViewStyle;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}

export const ExternalLogo: React.FC<LogoProps> = ({
  size = 120,
  style,
  resizeMode = 'contain'
}) => {
  return (
    <Image
      source={require('../assets/images/bmv_internal_logo.png')}
      style={[
        {
          width: size,
          height: size,
          resizeMode,
        },
        style,
      ]}
    />
  );
};



export default ExternalLogo;

