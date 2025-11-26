import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabaseCore, supabaseUrl } from '@/lib/supabase';

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
  signInWithOTP: (phone: string) => Promise<{ error: Error | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: Error | null }>;
  devSignIn: (phone: string) => Promise<{ error: Error | null }>;
  dummyLogin: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    supabaseCore.auth.getSession().then(async ({ data: { session } }) => {
      // Don't process session if we're in the middle of logging out
      if (isLoggingOutRef.current) {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabaseCore.auth.onAuthStateChange((event, session) => {
      (async () => {
        // On SIGNED_OUT event, ensure all state is cleared
        if (event === 'SIGNED_OUT' || !session) {
          isLoggingOutRef.current = false; // Reset logout flag
          setSession(null);
          setUser(null);
          userRef.current = null; // Clear ref as well
          setProfile(null);
          setLoading(false);
          return;
        }
        
        // Don't process session if we're logging out
        if (isLoggingOutRef.current) {
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
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

  const signInWithOTP = async (phone: string) => {
  try {
    // Use phone as-is (no country code prepending)
    const formattedPhone = phone;
    
    // In development, just return success since we'll use hardcoded OTP
    if (process.env.EXPO_PUBLIC_NODE_ENV === 'development') {
      console.log('Development mode: Use OTP code: 123456');
      return { error: null };
    }

    // In production, this will trigger real SMS
    const { error } = await supabaseCore.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        shouldCreateUser: true,
      }
    });

    return { error };
  } catch (error) {
    return { error: error as Error };
  }
};


const verifyOTP = async (phone: string, token: string) => {
  try {
    // Use the edge function for session creation to avoid duplicate vendor creation
    // Use manual fetch() instead of functions.invoke() for better CORS handling in React Native/Expo
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-dev-session`;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
    
    console.log(`[LOG] Calling Edge Function: ${edgeFunctionUrl}`);
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ phone, otp: token }),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: `HTTP ${response.status}: ${response.statusText}` };
      }
      console.error(`[LOG] Edge Function error (${response.status}):`, errorData);
      return { 
        error: new Error(errorData.error || errorData.details || `HTTP ${response.status}: Failed to create session`) 
      };
    }

    const data = await response.json();

    if (data && data.success && data.session) {
      // Set the session in Supabase client first (this triggers onAuthStateChange)
      const { error: sessionError } = await supabaseCore.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) {
        console.error('Error setting session:', sessionError);
        return { error: sessionError };
      }

      // The onAuthStateChange listener will update session/user/profile automatically
      // But we can also set it directly for immediate UI update
      setSession(data.session);
      if (data.session.user) {
        setUser(data.session.user);
        await fetchProfile(data.session.user.id);
      }
      return { error: null };
    }

    return { error: new Error(data?.error || data?.details || 'Failed to create session') };
  } catch (error) {
    console.error('[LOG] Verification error:', error);
    return { error: error as Error };
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
      
      // First, clear local state immediately for immediate UI feedback
      setSession(null);
      setUser(null);
      userRef.current = null; // Clear ref to prevent polling
      setProfile(null);
      setLoading(false);

      // Then call Supabase signOut to clear local storage
      // Use 'local' scope instead of 'global' to avoid API call that might fail
      // 'local' scope clears the session from local storage without making API call
      const { error } = await supabaseCore.auth.signOut({ scope: 'local' });
      if (error) {
        console.warn('Error signing out from Supabase (continuing anyway):', error);
        // Don't throw - we've already cleared local state
      }
      
      // Reset logout flag after a short delay to allow any pending operations to complete
      setTimeout(() => {
        isLoggingOutRef.current = false;
      }, 1000);
    } catch (error) {
      console.error('Sign out failed:', error);
      // Even on error, ensure local state is cleared
      setSession(null);
      setUser(null);
      userRef.current = null; // Clear ref as well
      setProfile(null);
      setLoading(false);
      isLoggingOutRef.current = false; // Reset flag
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
        signInWithOTP,
        verifyOTP,
        devSignIn,
        dummyLogin,
        signOut,
        refreshProfile,
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
