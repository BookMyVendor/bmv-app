function analytics() {
  const noop = async () => {};
  return {
    logEvent: noop,
    logScreenView: noop,
    setUserId: noop,
    setUserProperties: noop,
    setAnalyticsCollectionEnabled: noop,
    setSessionTimeoutDuration: noop,
  };
}

export default analytics;
