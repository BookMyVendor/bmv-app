import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ScreenBackgroundProps {
    children?: React.ReactNode;
    style?: any;
}

export default function ScreenBackground({ children, style }: ScreenBackgroundProps) {
    return (
        <LinearGradient
            colors={[Colors.background.primary, '#FDFBF7']}
            style={[styles.container, style]}
        >
            {/* Decorative Background Elements - More subtle than login screen */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            <View style={styles.decorCircle3} />
            <View style={styles.decorCircle4} />
            {children}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    decorCircle1: {
        position: 'absolute',
        top: -SCREEN_HEIGHT * 0.05,
        right: -SCREEN_WIDTH * 0.1,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#d9a966',
        opacity: 0.15, // Reduced from 0.3
    },
    decorCircle2: {
        position: 'absolute',
        bottom: -SCREEN_HEIGHT * 0.1,
        left: -SCREEN_WIDTH * 0.2,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#9fbfda',
        opacity: 0.2, // Reduced from 0.4
    },
    decorCircle3: {
        position: 'absolute',
        top: '25%',
        left: -SCREEN_WIDTH * 0.1,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#bfa3cf',
        opacity: 0.15, // Reduced from 0.3
    },
    decorCircle4: {
        position: 'absolute',
        bottom: '20%',
        right: -SCREEN_WIDTH * 0.08,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#a7cbb6',
        opacity: 0.15, // Reduced from 0.3
    },
});
