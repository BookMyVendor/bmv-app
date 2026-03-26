import analytics from '@react-native-firebase/analytics';

export function logTabEvent(eventName: string): void {
  void analytics().logEvent(eventName);
}
