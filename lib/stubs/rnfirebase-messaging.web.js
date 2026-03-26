const AuthorizationStatus = {
  NOT_DETERMINED: -1,
  DENIED: 0,
  AUTHORIZED: 1,
  PROVISIONAL: 2,
};

function messaging() {
  const noop = () => () => {};
  return {
    requestPermission: async () => AuthorizationStatus.DENIED,
    hasPermission: async () => AuthorizationStatus.DENIED,
    getToken: async () => '',
    deleteToken: async () => {},
    onMessage: noop,
    onNotificationOpenedApp: noop,
    onTokenRefresh: noop,
    setBackgroundMessageHandler: () => {},
    getInitialNotification: async () => null,
    registerDeviceForRemoteMessages: async () => {},
    isDeviceRegisteredForRemoteMessages: true,
    subscribeToTopic: async () => {},
    unsubscribeFromTopic: async () => {},
  };
}

messaging.AuthorizationStatus = AuthorizationStatus;

export default messaging;
