import React from 'react';
import type { ViewStyle } from 'react-native';
import PagerView from 'react-native-pager-view';

export interface ImagePreviewPagerProps {
  style?: ViewStyle;
  initialPage: number;
  pageMargin?: number;
  onPageSelected: (e: { nativeEvent: { position: number } }) => void;
  children: React.ReactNode;
}

export function ImagePreviewPager({
  style,
  initialPage,
  pageMargin,
  onPageSelected,
  children,
}: ImagePreviewPagerProps) {
  return (
    <PagerView
      style={style}
      initialPage={initialPage}
      pageMargin={pageMargin}
      onPageSelected={onPageSelected}
    >
      {children}
    </PagerView>
  );
}
