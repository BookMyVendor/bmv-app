import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ScreenBackgroundProps {
    children?: React.ReactNode;
    style?: any;
}

export default function ScreenBackground({ children, style }: ScreenBackgroundProps) {
    return (
        <View style={[styles.container, style]}>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
});
