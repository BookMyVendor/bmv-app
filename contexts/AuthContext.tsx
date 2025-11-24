import React, { createContext, useContext, useEffect, useState } from 'react';
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

const fetchProfile = async (userId: string) => {
  try {
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
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabaseCore.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
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

  // Separate effect for polling - only runs when user.id changes
  useEffect(() => {
    if (!user?.id) {
      return; // No user, no polling
    }

    // Poll profile every 30 minutes (30 * 60 * 1000 ms)
    const pollInterval = setInterval(() => {
      fetchProfile(user.id).catch((error) => {
        console.error('Error polling profile:', error);
      });
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
    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/create-dev-session`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ phone, otp: token }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle error response from edge function
      const errorMessage = data.error || data.details || `HTTP ${response.status}: Failed to create session`;
      return { error: new Error(errorMessage) };
    }

    if (data.success && data.session) {
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

    return { error: new Error(data.error || data.details || 'Failed to create session') };
  } catch (error) {
    console.error('Verification error:', error);
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
      // Get current session to ensure we have access token for API call
      const { data: { session: currentSession } } = await supabaseCore.auth.getSession();
      
      if (currentSession?.access_token) {
        // Explicitly make API call to logout endpoint
        try {
          const response = await fetch(`${supabaseUrl}/auth/v1/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentSession.access_token}`,
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.warn('Logout API call failed, but continuing with local signout');
          }
        } catch (fetchError) {
          console.warn('Logout API call error:', fetchError);
          // Continue with local signout even if API call fails
        }
      }

      // Clear state immediately for immediate UI feedback
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);

      // Call Supabase signOut to clear local storage and trigger onAuthStateChange
      // This should trigger the onAuthStateChange listener which will also set session to null
      const { error } = await supabaseCore.auth.signOut({ scope: 'global' });
      if (error) {
        console.error('Error signing out:', error);
        // Don't throw - we've already cleared local state
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      // Even on error, clear local state
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
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
