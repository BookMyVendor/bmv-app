import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabaseCore, supabaseCms, supabaseCrm } from '../lib/supabase';
import { sendOTP, verifyOTP as verifyOTPApi, type VerifyOTPResponse } from '../lib/otpAuthApi';
import {
  getAccessToken,
  getRefreshToken,
  getTokenExpiry,
  hasTokens,
  clearTokens,
  isTokenExpiredOrExpiringSoon,
} from '../lib/tokenStorage';
import { refreshAccessToken } from '../lib/otpAuthApi';
import { registerPushTokenFromDevice } from '../lib/pushNotifications';


interface UserProfile {
  id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  image_file_id: string | null;
  terms_accepted: boolean | null;
  terms_accepted_at: string | null;
  has_business?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isNewUser: boolean;
  signInWithOTP: (phone: string) => Promise<{ error: Error | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: Error | null }>;
  devSignIn: (phone: string) => Promise<{ error: Error | null }>;
  dummyLogin: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshToken: () => Promise<void>;
  isOffline: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const userRef = useRef<User | null>(null);
  const isLoggingOutRef = useRef<boolean>(false);
  const isRefreshingRef = useRef<boolean>(false);
  const isRestoringRef = useRef<boolean>(false);

  const fetchProfile = async (userId: string, skipCache: boolean = false) => {
    try {
      // Don't fetch if userId is not provided or if we're logging out
      if (!userId || isLoggingOutRef.current) {
        setProfile(null);
        return;
      }

      // Try to load cached profile first for faster UI and offline support
      // But skip it if we are explicitly refreshing to avoid race conditions with old state
      if (!skipCache) {
        try {
          const cachedStr = await AsyncStorage.getItem(`cached_profile_${userId}`);
          if (cachedStr) {
            // Set immediately so we don't wait for network
            setProfile(JSON.parse(cachedStr));
          }
        } catch (e) {
          console.log('[AUTH] Error loading cached profile:', e);
        }
      }

      const { data, error } = await supabaseCore
        .from('vendors')
        .select(`
          *,
          vendor_businesses!vendor_id (id)
        `)
        .eq('id', userId)
        .limit(1, { foreignTable: 'vendor_businesses' })
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setIsOffline(false);
        const profileData = {
          ...data,
          has_business: data.vendor_businesses && data.vendor_businesses.length > 0
        };
        setProfile(profileData);
        // Cache the updated profile
        AsyncStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profileData)).catch(e => console.log('[AUTH] Error caching profile:', e));
      } else {
        setProfile(null);
        AsyncStorage.removeItem(`cached_profile_${userId}`).catch(e => console.log('[AUTH] Error removing profile cache:', e));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setIsOffline(true);
      // Re-throw if it's a manual refresh so the caller knows it failed
      if (skipCache) throw error;
    }
  };

  // Helper to set session on all Supabase clients
  const setSessionOnAllClients = async (session: Session) => {
    try {
      // Set session on all clients to ensure they use the custom JWT for RLS
      await Promise.all([
        supabaseCore.auth.setSession(session),
        supabaseCms.auth.setSession(session),
        supabaseCrm.auth.setSession(session),
      ]);
      console.log('[AUTH] Session set on all Supabase clients');
    } catch (error) {
      console.error('[AUTH] Failed to set session on all clients:', error);
    }
  };

  // Check for stored tokens on mount and restore session
  useEffect(() => {
    const checkStoredTokens = async () => {
      try {
        console.log('[AUTH] 🔍 Starting token restoration check...');

        if (isLoggingOutRef.current || isRestoringRef.current) {
          console.log('[AUTH] ⏭️ Skipping restoration - activity in progress');
          return;
        }

        isRestoringRef.current = true;
        const hasStoredTokens = await hasTokens();
        console.log('[AUTH] 📦 Has stored tokens:', hasStoredTokens);

        if (hasStoredTokens) {
          console.log('[AUTH] ✅ Stored tokens found, initializing session...');

          // 1. Check if token needs refresh using our manual logic
          const needsRefresh = await isTokenExpiredOrExpiringSoon();
          console.log('[AUTH] ⏰ Token needs refresh:', needsRefresh);

          if (needsRefresh) {
            console.log('[AUTH] 🔄 Token expiring soon, refreshing manually before init...');
            isRefreshingRef.current = true;
            try {
              const refreshResult = await refreshAccessToken();
              if (refreshResult.error?.code === 'NETWORK_ERROR') {
                console.log('[AUTH] ⚠️ Network error during manual refresh. Keeping tokens for offline mode.');
                setIsOffline(true);
              } else if (!refreshResult.data) {
                console.error('[AUTH] ❌ Manual refresh failed on boot, clearing session');
                await clearTokens();
                setLoading(false);
                return;
              } else {
                console.log('[AUTH] ✅ Token refreshed successfully');
              }
            } finally {
              isRefreshingRef.current = false;
            }
          }

          // 2. Get the latest tokens from SecureStore
          const accessToken = await getAccessToken();
          const refreshTokenValue = await getRefreshToken();
          const expiryTime = await getTokenExpiry();

          console.log('[AUTH] 🔑 Retrieved tokens:', {
            hasAccessToken: !!accessToken,
            hasRefreshToken: !!refreshTokenValue,
            expiryTime: expiryTime ? new Date(expiryTime).toISOString() : 'none',
            isExpired: expiryTime ? expiryTime < Date.now() : 'unknown'
          });

          if (accessToken) {
            // 3. Reconstruct session from tokens
            // First try to get the user from this token to ensure it's valid
            console.log('[AUTH] 🔐 Validating access token with Supabase...');
            const { data: { user: supabaseUser }, error: userError } = await supabaseCore.auth.getUser(accessToken);

            if (supabaseUser && !userError) {
              console.log('[AUTH] ✅ Token valid, user found:', supabaseUser.id);

              const session: Session = {
                access_token: accessToken,
                refresh_token: refreshTokenValue || '',
                expires_at: expiryTime ? Math.floor(expiryTime / 1000) : Math.floor(Date.now() / 1000) + 3600,
                expires_in: 3600,
                token_type: 'bearer',
                user: supabaseUser,
              };

              // 4. Sync this session to all clients IMMEDIATELY
              // This overwrites any stale session in Supabase's internal AsyncStorage
              console.log('[AUTH] 🔄 Setting session on all Supabase clients...');

              // Use a flag to indicate we're doing a manual sync to prevent onAuthStateChange interference
              isRefreshingRef.current = true;
              try {
                await setSessionOnAllClients(session);
                setSession(session);
                setUser(session.user);
                userRef.current = session.user;
                await AsyncStorage.setItem('current_user_id', session.user.id).catch(console.error);

                console.log('[AUTH] 👤 Fetching user profile...');
                await fetchProfile(session.user.id);
                console.log('[AUTH] ✅ Session restored successfully from SecureStore');
              } finally {
                isRefreshingRef.current = false;
              }
            } else {
              console.log('[AUTH] ❌ Token validation failed, code:', userError?.status, userError?.code, userError?.message);

              const isNetworkError = userError?.message?.toLowerCase().includes('fetch') || 
                                     userError?.message?.toLowerCase().includes('network') ||
                                     userError?.name === 'TypeError';

              if (isNetworkError) {
                console.log('[AUTH] ⚠️ Network error during validation, entering offline mode');
                setIsOffline(true);
                
                // Attempt to restore offline session
                const { data: { session: sbSession } } = await supabaseCore.auth.getSession();
                let fallbackUser = sbSession?.user;
                
                // Fallback to decode JWT manually if needed
                if (!fallbackUser) {
                  try {
                    // Try to get from AsyncStorage first
                    const storedUserId = await AsyncStorage.getItem('current_user_id');
                    if (storedUserId) {
                       fallbackUser = {
                         id: storedUserId,
                         app_metadata: {},
                         user_metadata: {},
                         aud: 'authenticated',
                         created_at: new Date().toISOString(),
                       } as User;
                    } else {
                      // Fallback: decode JWT robustly
                      const payloadBase64 = accessToken.split('.')[1];
                      // Custom base64 decode since atob is not available in all RN environments
                      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
                      let str = payloadBase64.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
                      let output = '';
                      for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
                        buffer = chars.indexOf(buffer);
                      }
                      const decodedPayload = JSON.parse(output);
                      fallbackUser = {
                        id: decodedPayload.sub,
                        app_metadata: {},
                        user_metadata: {},
                        aud: 'authenticated',
                        created_at: new Date().toISOString(),
                      } as User;
                    }
                  } catch (e) {
                    console.error('[AUTH] Failed to decode JWT for offline user', e);
                  }
                }

                if (fallbackUser) {
                   const session: Session = {
                     access_token: accessToken,
                     refresh_token: refreshTokenValue || '',
                     expires_at: expiryTime ? Math.floor(expiryTime / 1000) : Math.floor(Date.now() / 1000) + 3600,
                     expires_in: 3600,
                     token_type: 'bearer',
                     user: fallbackUser,
                   };
                   await setSessionOnAllClients(session);
                   setSession(session);
                   setUser(fallbackUser);
                   userRef.current = fallbackUser;
                   await fetchProfile(fallbackUser.id);
                   console.log('[AUTH] ✅ Session restored in offline mode');
                } else {
                   console.error('[AUTH] ❌ Critical: Could not reconstruct user object for offline mode');
                   await clearTokens();
                }
              } else {

              // Only attempt refresh if it's actually an expiry error
              const isExpiryError = userError?.message?.includes('expired') || userError?.status === 401 || userError?.status === 403;

              if (isExpiryError) {
                console.log('[AUTH] 🔄 Attempting fallback token refresh...');

                isRefreshingRef.current = true;
                try {
                  const refreshResult = await refreshAccessToken();
                  if (refreshResult.error?.code === 'NETWORK_ERROR') {
                    console.log('[AUTH] ⚠️ Network error during fallback refresh, entering offline mode');
                    setIsOffline(true);
                    // Use JWT decoding fallback
                    try {
                      let fallbackUser: User | undefined;
                      const storedUserId = await AsyncStorage.getItem('current_user_id');
                      if (storedUserId) {
                        fallbackUser = {
                          id: storedUserId,
                          app_metadata: {},
                          user_metadata: {},
                          aud: 'authenticated',
                          created_at: new Date().toISOString(),
                        } as User;
                      } else {
                        const payloadBase64 = accessToken.split('.')[1];
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
                        let str = payloadBase64.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
                        let output = '';
                        for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
                          buffer = chars.indexOf(buffer);
                        }
                        const decodedPayload = JSON.parse(output);
                        fallbackUser = {
                          id: decodedPayload.sub,
                          app_metadata: {},
                          user_metadata: {},
                          aud: 'authenticated',
                          created_at: new Date().toISOString(),
                        } as User;
                      }
                      
                      const restoredSession: Session = {
                        access_token: accessToken,
                        refresh_token: refreshTokenValue || '',
                        expires_at: expiryTime ? Math.floor(expiryTime / 1000) : Math.floor(Date.now() / 1000) + 3600,
                        expires_in: 3600,
                        token_type: 'bearer',
                        user: fallbackUser,
                      };
                      await setSessionOnAllClients(restoredSession);
                      setSession(restoredSession);
                      setUser(fallbackUser);
                      userRef.current = fallbackUser;
                      await fetchProfile(fallbackUser.id);
                      console.log('[AUTH] ✅ Session restored in offline mode from expired token');
                    } catch (e) {
                      console.error('[AUTH] ❌ Failed to assemble offline session:', e);
                      await clearTokens();
                    }
                  } else if (refreshResult.error) {
                    console.error('[AUTH] ❌ Fallback refresh failed:', refreshResult.error);

                    // Log additional context for TOKEN_EXPIRED errors
                    if (refreshResult.error.code === 'TOKEN_EXPIRED') {
                      const storedExpiry = await getTokenExpiry();
                      console.log('[AUTH] 🕐 Token expiry context:', {
                        storedExpiryTime: storedExpiry ? new Date(storedExpiry).toISOString() : 'none',
                        currentTime: new Date().toISOString(),
                        wasExpiredByStorage: storedExpiry ? storedExpiry < Date.now() : 'unknown',
                        message: 'Both access and refresh tokens expired. User must log in again.'
                      });
                    }
                    // refreshAccessToken already clears tokens on 4xx
                  } else if (refreshResult.data) {
                    console.log('[AUTH] ✅ Fallback refresh succeeded, restoring session with new token...');

                    // Re-validate with the newly refreshed access token
                    const newAccessToken = await getAccessToken();
                    const newRefreshTokenVal = await getRefreshToken();
                    const newExpiry = await getTokenExpiry();

                    if (newAccessToken) {
                      const { data: { user: refreshedUser }, error: refreshedUserError } =
                        await supabaseCore.auth.getUser(newAccessToken);

                      if (refreshedUser && !refreshedUserError) {
                        console.log('[AUTH] ✅ Refreshed token valid, user:', refreshedUser.id);

                        const restoredSession: Session = {
                          access_token: newAccessToken,
                          refresh_token: newRefreshTokenVal || '',
                          expires_at: newExpiry ? Math.floor(newExpiry / 1000) : Math.floor(Date.now() / 1000) + 3600,
                          expires_in: refreshResult.data.expiresIn || 3600,
                          token_type: 'bearer',
                          user: refreshedUser,
                        };

                        await setSessionOnAllClients(restoredSession);
                        setSession(restoredSession);
                        setUser(refreshedUser);
                        userRef.current = refreshedUser;
                        await fetchProfile(refreshedUser.id);
                        console.log('[AUTH] ✅ Session restored after fallback refresh');
                      } else {
                        console.error('[AUTH] ❌ Refreshed token still invalid after validation:', refreshedUserError);
                        await clearTokens();
                      }
                    }
                  }
                } finally {
                  isRefreshingRef.current = false;
                }
              } else {
                console.error('[AUTH] ❌ Non-expiry error during validation, clearing session to be safe:', userError);
                await clearTokens();
              }
            }
            }
          } else {
            console.warn('[AUTH] ⚠️ No access token found despite hasTokens=true');
          }
        } else {
          console.log('[AUTH] 📭 No tokens in SecureStore, checking Supabase AsyncStorage...');

          // Fallback check for Supabase session directly (e.g. if SecureStore cleared but AsyncStorage didn't)
          const { data: { session: sbSession } } = await supabaseCore.auth.getSession();
          if (sbSession) {
            console.log('[AUTH] ✅ Found Supabase session as fallback');
            setSession(sbSession);
            setUser(sbSession.user);
            userRef.current = sbSession.user;
            if (sbSession.user?.id) {
              await fetchProfile(sbSession.user.id);
            }
          } else {
            console.log('[AUTH] 📭 No session found anywhere - user needs to login');
          }
        }
      } catch (error) {
        console.error('[AUTH] ❌ Error checking stored tokens:', error);
      } finally {
        isRestoringRef.current = false;
        console.log('[AUTH] 🏁 Token restoration complete, setting loading=false');
        setLoading(false);
      }
    };

    checkStoredTokens();

    // Also listen to Supabase auth changes for backward compatibility
    const { data: { subscription } } = supabaseCore.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (isLoggingOutRef.current) {
          return;
        }

        // CRITICAL: When using custom JWT auth, Supabase's internal auto-refresh
        // may fail and fire SIGNED_OUT. We must check our SecureStore tokens
        // before honoring the sign-out to avoid false logouts.
        if (event === 'SIGNED_OUT' || !session) {
          // If we're currently refreshing or restoring, ignore this event to prevent loops
          if (isRefreshingRef.current) {
            console.log('[AUTH] 🛡️ Ignoring SIGNED_OUT during active refresh/restore');
            return;
          }

          // Check if we still have valid tokens in SecureStore
          const stillHasTokens = await hasTokens();
          if (stillHasTokens) {
            console.log('[AUTH] Supabase fired SIGNED_OUT but SecureStore has tokens - ignoring');
            return;
          }

          console.log('[AUTH] No tokens in SecureStore - honoring sign out');
          setSession(null);
          setUser(null);
          userRef.current = null;
          setProfile(null);
          return;
        }

        // Set loading to true while we prepare the session and profile
        // This prevents the UI from trying to navigate before the profile is loaded
        setLoading(true);
        try {
          if (session.user?.id) {
            await fetchProfile(session.user.id);
          }
          setSession(session);
          setUser(session.user);
        } finally {
          setLoading(false);
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Update ref whenever user changes
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Separate effect for polling - only runs when user.id changes
  useEffect(() => {
    if (!user?.id) {
      return; // No user, no polling
    }

    // Poll profile every 30 minutes (30 * 60 * 1000 ms)
    const pollInterval = setInterval(() => {
      // Use ref to get current user state (avoids closure issue)
      const currentUser = userRef.current;
      if (currentUser?.id) {
        fetchProfile(currentUser.id).catch((error) => {
          console.error('Error polling profile:', error);
        });
      }
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [user?.id]);

  // AppState listener to verify token on app resume
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Check if we are transitioning to the 'active' foreground state
      if (nextAppState === 'active') {
        console.log('[AUTH] App resumed to foreground, verifying token...');
        if (await isTokenExpiredOrExpiringSoon()) {
          console.log('[AUTH] Token expired or expiring soon, triggering refresh...');
          // Don't await if we want the callback to finish quickly, or await to be safe.
          await refreshToken();
        } else {
          console.log('[AUTH] Token is still valid on resume.');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [user?.id]);

  // Register push notifications token when user logs in
  useEffect(() => {
    if (user?.id) {
      registerPushTokenFromDevice().catch((err) => {
        console.error('[AUTH] Background push token registration failed:', err);
      });
    }
  }, [user?.id]);

  const signInWithOTP = async (phone: string) => {
    try {
      const result = await sendOTP(phone);

      if (result.error) {
        return { error: new Error(result.error.message) };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };


  const verifyOTP = async (phone: string, token: string) => {
    setLoading(true);
    try {
      const result = await verifyOTPApi(phone, token);

      if (result.error) {
        const error = new Error(result.error.message);
        (error as any).code = result.error.code;
        return { error };
      }

      if (result.data) {
        const { user: userData, newUser } = result.data;

        // Create a User-like object from the API response
        const user: User = {
          id: userData.id,
          phone: userData.phone,
          email: userData.email || undefined,
          created_at: userData.created_at || new Date().toISOString(),
          app_metadata: userData.app_metadata || {},
          user_metadata: userData.user_metadata || {},
          aud: 'authenticated',
          confirmation_sent_at: undefined,
          recovery_sent_at: undefined,
          email_confirmed_at: userData.email_confirmed_at || undefined,
          phone_confirmed_at: userData.phone_confirmed_at || new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
        };

        // Create a Session-like object
        const accessToken = await getAccessToken();
        const session: Session = {
          access_token: accessToken || result.data.accessToken,
          refresh_token: result.data.refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + result.data.expiresIn,
          expires_in: result.data.expiresIn,
          token_type: 'bearer',
          user,
        };

        // CRITICAL: Set the session on ALL Supabase clients so they use the custom JWT
        // This ensures RLS policies can verify auth.uid() from the JWT claims
        await setSessionOnAllClients(session);

        // Fetch profile before updating session state to avoid UI flicker in navigation
        // Always try to fetch profile if we have a user ID, regardless of newUser flag
        // This handles cases where an existing user might be flagged as new by the backend
        if (user.id) {
          await fetchProfile(user.id);
        }

        setSession(session);
        setUser(user);
        setIsNewUser(newUser);
        userRef.current = user;
        await AsyncStorage.setItem('current_user_id', user.id).catch(console.error);

        console.log('[AUTH] OTP Verification successful:', {
          userId: user.id,
          newUser,
          tokenSet: true,
          message: 'Auth complete. Profile loaded if existing user.'
        });

        return { error: null };
      }

      return { error: new Error('No data received from verification') };
    } finally {
      setLoading(false);
    }
  };





  const devSignIn = async (phone: string) => {
    try {
      const { data: existingProfiles } = await supabaseCore
        .from('vendors')
        .select('id')
        .eq('phone', phone);

      let userId: string;
      let emailFormat = `dev+${phone}@dev.loc`; // New format (default)

      if (existingProfiles && existingProfiles.length > 0) {
        userId = existingProfiles[0].id;
        // Try to sign in with new format first
        const { error: newFormatError } = await supabaseCore.auth.signInWithPassword({
          email: emailFormat,
          password: 'dev-password-123',
        });

        // If new format fails, try old format for backward compatibility
        if (newFormatError) {
          emailFormat = `dev${phone}@dev.local`; // Old format
          const { error: oldFormatError } = await supabaseCore.auth.signInWithPassword({
            email: emailFormat,
            password: 'dev-password-123',
          });
          if (oldFormatError) return { error: oldFormatError };
        }
      } else {
        // Create new account with new format
        const { data: authData, error: authError } = await supabaseCore.auth.signInWithPassword({
          email: emailFormat,
          password: 'dev-password-123',
        });

        if (authError) {
          const { data: signUpData, error: signUpError } = await supabaseCore.auth.signUp({
            email: emailFormat,
            password: 'dev-password-123',
          });

          if (signUpError) return { error: signUpError };
          userId = signUpData.user!.id;

          await supabaseCore.from('vendors').insert({
            id: userId,
            phone: phone,
            first_name: '',
            last_name: '',
            email: '',
          });
        } else {
          userId = authData.user.id;
        }
      }

      // Final sign in with determined email format
      const { data: sessionData, error: sessionError } = await supabaseCore.auth.signInWithPassword({
        email: emailFormat,
        password: 'dev-password-123',
      });

      if (sessionError) return { error: sessionError };

      await AsyncStorage.setItem('current_user_id', userId).catch(console.error);
      await fetchProfile(userId);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const dummyLogin = async () => {
    try {
      // Create a dummy user ID
      const dummyUserId = '00000000-0000-0000-0000-000000000000';

      // Create dummy profile
      const dummyProfile: UserProfile = {
        id: dummyUserId,
        phone: '1234567890',
        first_name: 'Dummy',
        last_name: 'User',
        email: 'dummy@test.com',
        image_file_id: null,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
      };

      // Set profile directly (bypassing Supabase)
      setProfile(dummyProfile);

      // Create a dummy session object
      const dummySession = {
        access_token: 'dummy_token',
        refresh_token: 'dummy_refresh',
        expires_at: Date.now() + 3600000, // 1 hour from now
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: dummyUserId,
          email: 'dummy@test.com',
          phone: '+11234567890',
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          confirmation_sent_at: undefined,
          recovery_sent_at: undefined,
          email_confirmed_at: undefined,
          phone_confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          role: 'authenticated',
          updated_at: new Date().toISOString(),
        },
      } as Session;

      setSession(dummySession);
      setUser(dummySession.user);
      setLoading(false);
    } catch (error) {
      console.error('Dummy login error:', error);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Set logout flag to prevent any profile fetches
      isLoggingOutRef.current = true;

       // Clear tokens from secure storage
      await clearTokens();

      // Clear cached profile and user id
      if (userRef.current?.id) {
        await AsyncStorage.removeItem(`cached_profile_${userRef.current.id}`).catch(() => {});
      }
      await Promise.all([
        AsyncStorage.removeItem('current_user_id').catch(() => {}),
        AsyncStorage.removeItem('skip_business_registration').catch(() => {}),
      ]);

      // Clear local state immediately for immediate UI feedback
      setSession(null);
      setUser(null);
      userRef.current = null;
      setProfile(null);
      setLoading(false);

      // Also clear Supabase session for backward compatibility
      await supabaseCore.auth.signOut({ scope: 'local' });

      // Reset logout flag after a short delay
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 1000);
    } catch (error) {
      console.error('Sign out failed:', error);
      // Even on error, ensure everything is cleared
      await clearTokens();
      setSession(null);
      setUser(null);
      userRef.current = null;
      setProfile(null);
      setLoading(false);
      isLoggingOutRef.current = false;
    }
  };

  // Refresh access token using custom API
  // IMPORTANT: We must use our own auth-refresh-token API and never
  // rely on Supabase's built-in auto-refresh, which is disabled.
  const refreshToken = async () => {
    console.log('[AUTH] 🔄 Initiating manual token refresh via custom auth-refresh-token API');
    try {
      // Set refreshing flag to prevent onAuthStateChange from interfering
      isRefreshingRef.current = true;

      const result = await refreshAccessToken();
      if (result.data && session) {
        // Update session with new expiry and refresh token if provided
        const updatedSession: Session = {
          ...session,
          access_token: result.data.accessToken,
          refresh_token: result.data.refreshToken || session.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + result.data.expiresIn,
          expires_in: result.data.expiresIn,
        };

        // Update local state
        setSession(updatedSession);

        // Update all Supabase clients with fresh session
        await setSessionOnAllClients(updatedSession);

        console.log('[AUTH] Token refreshed successfully', {
          expiresIn: result.data.expiresIn,
          rotated: !!result.data.refreshToken
        });
      } else if (result.error) {
        if (result.error.code === 'NETWORK_ERROR') {
          console.log('[AUTH] ⚠️ Network error during token refresh. Remaining in offline mode.');
          setIsOffline(true);
        } else {
          console.error('[AUTH] Token refresh returned error:', result.error);
          await signOut();
        }
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Determine if error is network related
      const isNetworkError = error instanceof TypeError || 
                             (error as any)?.message?.toLowerCase().includes('network') || 
                             (error as any)?.message?.toLowerCase().includes('fetch');
      if (isNetworkError) {
        console.log('[AUTH] ⚠️ Network error caught during token refresh. Remaining in offline mode.');
        setIsOffline(true);
      } else {
        await signOut();
      }
    } finally {
      isRefreshingRef.current = false;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, true);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isNewUser,
        signInWithOTP,
        verifyOTP,
        devSignIn,
        dummyLogin,
        signOut,
        refreshProfile,
        refreshToken,
        isOffline,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
