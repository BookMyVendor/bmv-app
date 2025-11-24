export const Colors = {
  primary: {
    main: '#ffb543',
    light: '#FFC766',
    dark: '#E5A02F',
    gradient: ['#ffb543', '#FFC766'],
  },
  secondary: {
    main: '#6aa3ce',
    light: '#8BB5D9',
    dark: '#5A8FB8',
    gradient: ['#6aa3ce', '#8BB5D9'],
  },
  accent: {
    main: '#88a94b',
    light: '#A0C063',
    dark: '#76923F',
    gradient: ['#88a94b', '#A0C063'],
  },
  purple: {
    main: '#cd74c2',
    light: '#D98FD0',
    dark: '#B563A8',
    gradient: ['#cd74c2', '#D98FD0'],
  },
  success: {
    main: '#6BCF7F',
    light: '#8EE09E',
    dark: '#50B564',
    gradient: ['#6BCF7F', '#8EE09E'],
  },
  warning: {
    main: '#FFAB40',
    light: '#FFBF6B',
    dark: '#FF9500',
  },
  error: {
    main: '#FF5252',
    light: '#FF7676',
    dark: '#E63939',
  },
  info: {
    main: '#6aa3ce',
    light: '#8BB5D9',
    dark: '#5A8FB8',
  },
  neutral: {
    white: '#FFFFFF',
    lightest: '#F8F9FA',
    lighter: '#F1F3F5',
    light: '#E9ECEF',
    medium: '#ADB5BD',
    dark: '#495057',
    darker: '#212529',
    black: '#000000',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#666666',
    tertiary: '#999999',
    disabled: '#CCCCCC',
    inverse: '#FFFFFF',
  },
  background: {
    primary: '#FFFFFF',
    secondary: '#F8F9FA',
    tertiary: '#F1F3F5',
    gradient: ['#FFE5E0', '#FFF8F5'],
    gradientBlue: ['#E3F2FD', '#F0F7FF'],
    gradientGreen: ['#E8F5E9', '#F1F8F2'],
    gradientYellow: ['#FFF9E6', '#FFFBF0'],
  },
  status: {
    new: '#5C9EFF',
    contacted: '#FFD93D',
    qualified: '#FF9500',
    proposal: '#9C27B0',
    negotiation: '#FF6B35',
    won: '#6BCF7F',
    lost: '#8E8E93',
  },
  priority: {
    low: '#6BCF7F',
    medium: '#FFD93D',
    high: '#FF9500',
    urgent: '#FF5252',
  },
  rating: {
    star: '#FFB800',
    starGradient: ['#FFC107', '#FFD54F'],
  },
  overlay: {
    light: 'rgba(255, 255, 255, 0.9)',
    medium: 'rgba(0, 0, 0, 0.5)',
    dark: 'rgba(0, 0, 0, 0.7)',
  },
};

export const Gradients = {
  primary: {
    colors: ['#ffb543', '#FFC766'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  secondary: {
    colors: ['#6aa3ce', '#8BB5D9'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  warm: {
    colors: ['#ffb543', '#88a94b'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  cool: {
    colors: ['#6aa3ce', '#cd74c2'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  sunset: {
    colors: ['#ffb543', '#88a94b', '#cd74c2'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  success: {
    colors: ['#88a94b', '#A0C063'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  info: {
    colors: ['#6aa3ce', '#8BB5D9'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  purple: {
    colors: ['#cd74c2', '#D98FD0'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
};

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  colored: {
    shadowColor: '#ffb543',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const Typography = {
  fontSize: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};
