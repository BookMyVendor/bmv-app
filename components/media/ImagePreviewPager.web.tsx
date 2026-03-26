import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';

export interface ImagePreviewPagerProps {
  style?: ViewStyle;
  initialPage: number;
  pageMargin?: number;
  onPageSelected: (e: { nativeEvent: { position: number } }) => void;
  children: React.ReactNode;
}

/**
 * Web cannot load react-native-pager-view (native codegen). Use horizontal paging ScrollView.
 * pageMargin is ignored on web; spacing is negligible for fullscreen preview.
 */
export function ImagePreviewPager({
  style,
  initialPage,
  onPageSelected,
  children,
}: ImagePreviewPagerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(() => Dimensions.get('window').width);

  useEffect(() => {
    const w = Math.max(pageWidth, 1);
    scrollRef.current?.scrollTo({ x: initialPage * w, animated: false });
  }, [initialPage, pageWidth]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = Math.max(pageWidth, 1);
    const index = Math.round(e.nativeEvent.contentOffset.x / w);
    onPageSelected({ nativeEvent: { position: index } });
  };

  return (
    <View
      style={style}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        if (width > 0 && width !== pageWidth) {
          setPageWidth(width);
        }
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {React.Children.map(children, (child, index) => (
          <View key={index} style={{ width: pageWidth }}>
            {child}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
