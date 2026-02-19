import Expo
import React
import ReactAppDependencyProvider
import Firebase
import UserNotifications

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Configure Firebase
    FirebaseApp.configure()
        
    
    Analytics.setAnalyticsCollectionEnabled(true)
    
    // Initialize Crashlytics
    Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(true)
    print("💥 Firebase Crashlytics initialized")
    
    // Initialize Performance Monitoring
    Performance.sharedInstance().isInstrumentationEnabled = true
    Performance.sharedInstance().isDataCollectionEnabled = true
    print("⚡ Firebase Performance Monitoring initialized")
    
    // Create a custom trace for app startup
    let startupTrace = Performance.startTrace(name: "app_startup")
    startupTrace?.start()
    
    // Set up user attributes for Crashlytics
    Crashlytics.crashlytics().setUserID("test_user_\(UUID().uuidString)")
    Crashlytics.crashlytics().setCustomValue("iOS", forKey: "platform")
    Crashlytics.crashlytics().setCustomValue("debug", forKey: "build_type")
    print("👤 Crashlytics user attributes set")
    
    // Log a test event to verify Analytics is working
//    Analytics.logEvent("app_launch_testiOS", parameters: [
//      "launch_time": Date().timeIntervalSince1970,
//      "debug_mode": false
//    ])
    print("📊 Analytics test event logged: app_launch_test")
    
    // Set up messaging delegate
    Messaging.messaging().delegate = self
    
    // Request notification permission
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
      if granted {
        DispatchQueue.main.async {
          application.registerForRemoteNotifications()
        }
      }
    }
    
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    
    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)
    
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  

  // Complete the startup trace after app is fully loaded
  public override func applicationDidBecomeActive(_ application: UIApplication) {
    // Stop the startup trace
//    if let trace = Performance.startTrace(name: "app_startup") {
//      trace.stop()
//      print("⏱️ App startup trace completed")
//    }
//    
//    // Log a custom event for analytics
//    Analytics.logEvent("app_became_active", parameters: [
//      "timestamp": Date().timeIntervalSince1970
//    ])
//    print("📊 App became active event logged")
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
  
  // MARK: - Remote Notifications
  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    print("📱 APNS token registered successfully")
    Messaging.messaging().apnsToken = deviceToken
  }
  
  public override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("❌ Failed to register for remote notifications: \(error.localizedDescription)")
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

// MARK: - Firebase Messaging Delegate
extension AppDelegate: MessagingDelegate {
  public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    print("🔥 Firebase FCM Token: \(fcmToken ?? "nil")")
    
    // You can also send this token to your server or save it locally
    if let token = fcmToken {
      print("📱 Device FCM Token received: \(token)")
      // TODO: Send token to your backend server
    }
  }
}
