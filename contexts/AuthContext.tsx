import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';

import { supabaseCore, supabaseCms, supabaseCrm } from '../lib/supabase';
import { sendOTP, verifyOTP as verifyOTPApi, type VerifyOTPResponse } from '../lib/otpAuthApi';
import {
  getAccessToken,
  hasTokens,
  clearTokens,
  isTokenExpiredOrExpiringSoon,
} from '../lib/tokenStorage';
import { refreshAccessToken } from '../lib/otpAuthApi';


interface UserProfile {
  id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  image_file_id: string | null;
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const userRef = useRef<User | null>(null);
  const isLoggingOutRef = useRef<boolean>(false);

  const fetchProfile = async (userId: string) => {
    try {
      // Don't fetch if userId is not provided or if we're logging out
      if (!userId || isLoggingOutRef.current) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabaseCore
        .from('vendors')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
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
        if (isLoggingOutRef.current) {
          setLoading(false);
          return;
        }

        const hasStoredTokens = await hasTokens();
        if (hasStoredTokens) {
          // Check if token needs refresh
          if (await isTokenExpiredOrExpiringSoon()) {
            const refreshResult = await refreshAccessToken();
            if (!refreshResult.data) {
              // Refresh failed, clear tokens
              await clearTokens();
              setLoading(false);
              return;
            }
          }

          // Get user info from token (we'll need to decode or fetch from API)
          // For now, try to get from Supabase session if available
          const { data: { session } } = await supabaseCore.auth.getSession();
          if (session?.user) {
            setSession(session);
            setUser(session.user);
            await fetchProfile(session.user.id);
          } else {
            // If no Supabase session but we have tokens, we need to fetch user info
            // This would require an API endpoint to get user from token
            // For now, we'll rely on verifyOTP to set the user
          }
        } else {
          // Check Supabase session as fallback
          const { data: { session } } = await supabaseCore.auth.getSession();
          if (session) {
            setSession(session);
            setUser(session.user);
            if (session.user?.id) {
              await fetchProfile(session.user.id);
            }
          }
        }
      } catch (error) {
        console.error('Error checking stored tokens:', error);
      } finally {
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

        if (event === 'SIGNED_OUT' || !session) {
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

  // Auto-refresh token before expiration (check every 5 minutes)
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const checkAndRefreshToken = async () => {
      if (await isTokenExpiredOrExpiringSoon()) {
        await refreshToken();
      }
    };

    // Check immediately
    checkAndRefreshToken();

    // Then check every 5 minutes
    const tokenRefreshInterval = setInterval(() => {
      checkAndRefreshToken();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(tokenRefreshInterval);
    };
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
        if (!newUser && user.id) {
          await fetchProfile(user.id);
        } else {
          setProfile(null);
        }

        setSession(session);
        setUser(user);
        setIsNewUser(newUser);
        userRef.current = user;

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

  const refreshToken = async () => {
    try {
      const result = await refreshAccessToken();
      if (result.data && session) {
        // Update session with new expiry
        const updatedSession: Session = {
          ...session,
          access_token: result.data.accessToken,
          expires_at: Math.floor(Date.now() / 1000) + result.data.expiresIn,
          expires_in: result.data.expiresIn,
        };
        setSession(updatedSession);
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // If refresh fails, sign out
      await signOut();
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
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
