/**
 * Metro resolves this instead of @react-native-firebase/app on web.
 * Prevents "No Firebase App '[DEFAULT]'" from native RN Firebase registry.
 */
const defaultApp = { name: '[DEFAULT]', options: {} };

export function getApp() {
  return defaultApp;
}

export function initializeApp() {
  return defaultApp;
}

export function getApps() {
  return [defaultApp];
}

function app() {
  return defaultApp;
}

app.app = app;
app.getApp = getApp;
app.initializeApp = initializeApp;
app.apps = [defaultApp];

export default app;
