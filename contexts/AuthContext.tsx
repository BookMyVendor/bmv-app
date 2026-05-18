import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  sendOTP,
  verifyOTP as verifyOTPApi,
  refreshAccessToken,
  devSignIn as devSignInApi,
  signOut as signOutApi,
  type VerifyOTPResponse
} from '../lib/authApi';
import {
  getAccessToken,
  getRefreshToken,
  getTokenExpiry,
  hasTokens,
  clearTokens,
  isTokenExpiredOrExpiringSoon,
} from '../lib/tokenStorage';
import { getMe } from '../lib/api/me';
import { apiFetch } from '../lib/apiClient';
import { setOnAuthFailure, triggerAuthFailure } from '../lib/authFailure';
import { registerPushTokenFromDevice } from '../lib/pushNotifications';

export interface AppUser {
  id: string;
  phone: string;
  email?: string | null;
  created_at?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  role?: string;
}

export interface AppSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in: number;
  token_type: string;
  user: AppUser;
}

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
  session: AppSession | null;
  user: AppUser | null;
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

function sessionFromTokens(
  accessToken: string,
  refreshToken: string,
  expiresAtMs: number,
  user: AppUser
): AppSession {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(expiresAtMs / 1000),
    expires_in: Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)),
    token_type: 'bearer',
    user,
  };
}

function userFromVerify(u: VerifyOTPResponse['user']): AppUser {
  return {
    id: u.id,
    phone: u.phone,
    email: u.email ?? null,
    created_at: u.created_at,
    app_metadata: u.app_metadata ?? {},
    user_metadata: u.user_metadata ?? {},
    aud: 'authenticated',
    role: 'authenticated',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const userRef = useRef<AppUser | null>(null);
  const isLoggingOutRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const isRestoringRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    if (!userId || isLoggingOutRef.current) {
      setProfile(null);
      return;
    }
    try {
      const cachedStr = await AsyncStorage.getItem(`cached_profile_${userId}`);
      if (cachedStr) setProfile(JSON.parse(cachedStr));
    } catch (e) {
      console.log('[AUTH] Error loading cached profile:', e);
    }

    const { data, error } = await getMe();
    if (error) {
      console.error('Error fetching profile:', error);
      setIsOffline(true);
      return;
    }
    if (data) {
      setIsOffline(false);
      const profileData: UserProfile = {
        ...data,
        has_business:
          typeof data.has_business === 'boolean'
            ? data.has_business
            : Boolean(data.vendor_businesses && data.vendor_businesses.length > 0),
      };
      setProfile(profileData);
      AsyncStorage.setItem(`cached_profile_${userId}`, JSON.stringify(profileData)).catch(() => { });
    } else {
      // No error but no data (e.g. vendor-me-get 404 while backend is incomplete) — keep cache / existing profile
      console.warn('[AUTH] getMe returned no data; keeping cached profile if any');
      setIsOffline(false);
    }
  };

  const clearSession = () => {
    setSession(null);
    setUser(null);
    userRef.current = null;
    setProfile(null);
    setLoading(false);
  };

  useEffect(() => {
    setOnAuthFailure(clearSession);
    return () => setOnAuthFailure(null);
  }, []);

  useEffect(() => {
    const checkStoredTokens = async () => {
      try {
        if (isLoggingOutRef.current || isRestoringRef.current) return;
        isRestoringRef.current = true;
        const hasStoredTokens = await hasTokens();
        if (!hasStoredTokens) {
          setLoading(false);
          return;
        }

        if (await isTokenExpiredOrExpiringSoon()) {
          isRefreshingRef.current = true;
          try {
            const refreshResult = await refreshAccessToken();
            if (refreshResult.error?.code === 'NETWORK_ERROR') {
              setIsOffline(true);
            } else if (!refreshResult.data) {
              await clearTokens();
              clearSession();
              return;
            }
          } finally {
            isRefreshingRef.current = false;
          }
        }

        const accessToken = await getAccessToken();
        console.log("TOKEN:", accessToken);
        const refreshTokenVal = await getRefreshToken();
        const expiryTime = await getTokenExpiry();
        if (!accessToken) {
          setLoading(false);
          return;
        }

        const { data: meData } = await getMe();
        if (!meData) {
          setIsOffline(true);
          const fallbackUser: AppUser = {
            id: (await AsyncStorage.getItem('current_user_id')) || '',
            phone: '',
            app_metadata: {},
            user_metadata: {},
          };
          if (fallbackUser.id) {
            const sess = sessionFromTokens(
              accessToken,
              refreshTokenVal || '',
              expiryTime || Date.now() + 3600000,
              fallbackUser
            );
            setSession(sess);
            setUser(fallbackUser);
            userRef.current = fallbackUser;
            await fetchProfile(fallbackUser.id);
          }
        } else {
          const appUser: AppUser = {
            id: meData.id,
            phone: meData.phone,
            email: meData.email,
            app_metadata: {},
            user_metadata: {},
            aud: 'authenticated',
            role: 'authenticated',
          };
          const sess = sessionFromTokens(
            accessToken,
            refreshTokenVal || '',
            expiryTime || Date.now() + 3600000,
            appUser
          );
          setSession(sess);
          setUser(appUser);
          userRef.current = appUser;
          await AsyncStorage.setItem('current_user_id', appUser.id).catch(() => { });
          await fetchProfile(appUser.id);
        }
      } catch (e) {
        console.error('[AUTH] Restore error:', e);
      } finally {
        isRestoringRef.current = false;
        setLoading(false);
      }
    };
    checkStoredTokens();
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    const pollInterval = setInterval(() => {
      if (userRef.current?.id) fetchProfile(userRef.current.id).catch(() => { });
    }, 30 * 60 * 1000);
    return () => clearInterval(pollInterval);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const handleAppStateChange = async (next: AppStateStatus) => {
      if (next === 'active' && (await isTokenExpiredOrExpiringSoon())) {
        await refreshToken();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) registerPushTokenFromDevice().catch(() => { });
  }, [user?.id]);

  const signInWithOTP = async (phone: string) => {
    const result = await sendOTP(phone);
    if (result.error) return { error: new Error(result.error.message) };
    return { error: null };
  };

  const verifyOTP = async (phone: string, token: string) => {
    setLoading(true);
    try {
      const result = await verifyOTPApi(phone, token);
      if (result.error) {
        const err = new Error(result.error.message) as Error & { code?: string };
        err.code = result.error.code;
        return { error: err };
      }
      if (!result.data) return { error: new Error('No data received') };
      const { user: userData, newUser, accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn } = result.data;
      const appUser = userFromVerify(userData);

      const sessionData: AppSession = {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_at: Math.floor(Date.now() / 1000) + expiresIn,
        expires_in: expiresIn,
        token_type: 'bearer',
        user: appUser,
      };

      setSession(sessionData);
      setUser(appUser);
      userRef.current = appUser;
      setIsNewUser(newUser);

      await AsyncStorage.setItem('current_user_id', appUser.id).catch(() => { });

      // We must fetch the latest profile before finishing, so _layout avoids flicker/redirect issues
      await fetchProfile(appUser.id);

      return { error: null };
    } finally {
      setLoading(false);
    }
  };

  const devSignIn = async (phone: string) => {
    const result = await devSignInApi(phone);
    if (result.error) return { error: new Error(result.error.message) };
    if (!result.data) return { error: new Error('No data received') };
    const appUser = userFromVerify(result.data.user);
    const accessToken = await getAccessToken();
    const session: AppSession = {
      access_token: accessToken || result.data.accessToken,
      refresh_token: result.data.refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + result.data.expiresIn,
      expires_in: result.data.expiresIn,
      token_type: 'bearer',
      user: appUser,
    };
    setSession(session);
    setUser(appUser);
    userRef.current = appUser;
    await AsyncStorage.setItem('current_user_id', appUser.id).catch(() => { });
    await fetchProfile(appUser.id);
    return { error: null };
  };

  const dummyLogin = async () => {
    const dummyUserId = '00000000-0000-0000-0000-000000000000';
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
    setProfile(dummyProfile);
    const dummyUser: AppUser = {
      id: dummyUserId,
      phone: '+11234567890',
      email: 'dummy@test.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
    };
    setSession({
      access_token: 'dummy_token',
      refresh_token: 'dummy_refresh',
      expires_at: Math.floor((Date.now() + 3600000) / 1000),
      expires_in: 3600,
      token_type: 'bearer',
      user: dummyUser,
    });
    setUser(dummyUser);
    setLoading(false);
  };

  const signOut = async () => {
    isLoggingOutRef.current = true;
    try {
      await signOutApi();
    } catch (e) {
      console.warn('[AUTH] Sign out error:', e);
      await clearTokens();
    }

    if (userRef.current?.id) {
      await AsyncStorage.removeItem(`cached_profile_${userRef.current.id}`).catch(() => { });
    }
    await Promise.all([
      AsyncStorage.removeItem('current_user_id').catch(() => { }),
    ]);
    clearSession();
    setTimeout(() => { isLoggingOutRef.current = false; }, 1000);
  };

  const refreshToken = async () => {
    isRefreshingRef.current = true;
    try {
      const result = await refreshAccessToken();
      if (result.data && session) {
        const updated: AppSession = {
          ...session,
          access_token: result.data.accessToken,
          refresh_token: result.data.refreshToken ?? session.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + result.data.expiresIn,
          expires_in: result.data.expiresIn,
        };
        setSession(updated);
      } else if (result.error && result.error.code !== 'NETWORK_ERROR') {
        triggerAuthFailure();
      } else if (result.error?.code === 'NETWORK_ERROR') {
        setIsOffline(true);
      }
    } catch (e) {
      const msg = (e as Error)?.message?.toLowerCase() || '';
      if (msg.includes('network') || msg.includes('fetch')) setIsOffline(true);
      else triggerAuthFailure();
    } finally {
      isRefreshingRef.current = false;
    }
  };

  const refreshProfile = () => (user ? fetchProfile(user.id) : Promise.resolve());

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
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
