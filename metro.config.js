const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

const stubDir = path.join(projectRoot, 'lib/stubs');

const FIREBASE_STUB_BY_PKG = {
  app: path.join(stubDir, 'rnfirebase-app.web.js'),
  analytics: path.join(stubDir, 'rnfirebase-analytics.web.js'),
  messaging: path.join(stubDir, 'rnfirebase-messaging.web.js'),
  crashlytics: path.join(stubDir, 'rnfirebase-crashlytics.web.js'),
  perf: path.join(stubDir, 'rnfirebase-perf.web.js'),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    typeof moduleName === 'string' &&
    moduleName.startsWith('@react-native-firebase/')
  ) {
    const match = moduleName.match(/^@react-native-firebase\/([^/]+)/);
    const pkg = match ? match[1] : '';
    const filePath =
      FIREBASE_STUB_BY_PKG[pkg] || path.join(stubDir, 'rnfirebase-empty.web.js');
    return { type: 'sourceFile', filePath };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
