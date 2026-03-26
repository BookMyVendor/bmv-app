function crashlytics() {
  return {
    recordError: () => {},
    log: () => {},
    crash: () => {},
    setAttribute: () => {},
    setUserId: () => {},
    setCrashlyticsCollectionEnabled: () => {},
  };
}

export default crashlytics;
