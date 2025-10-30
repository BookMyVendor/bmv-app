import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  phone_number: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  profile_photo_url: string | null;
  is_profile_complete: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithOTP: (phone: string) => Promise<{ error: Error | null }>;
  verifyOTP: (phone: string, token: string) => Promise<{ error: Error | null }>;
  devSignIn: (phone: string) => Promise<{ error: Error | null }>;
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
      const { data, error } = await supabase
        .from('user_profiles')
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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

    return () => subscription.unsubscribe();
  }, []);

  const signInWithOTP = async (phone: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyOTP = async (phone: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });

      if (error) return { error };

      if (data.user) {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!existingProfile) {
          await supabase.from('user_profiles').insert({
            id: data.user.id,
            phone_number: phone,
            is_profile_complete: false,
          });
        }

        await fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const devSignIn = async (phone: string) => {
    try {
      const { data: existingProfiles } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('phone_number', phone);

      let userId: string;

      if (existingProfiles && existingProfiles.length > 0) {
        userId = existingProfiles[0].id;
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: `${phone}@dev.local`,
          password: 'dev-password-123',
        });

        if (authError) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: `${phone}@dev.local`,
            password: 'dev-password-123',
          });

          if (signUpError) return { error: signUpError };
          userId = signUpData.user!.id;

          await supabase.from('user_profiles').insert({
            id: userId,
            phone_number: phone,
            is_profile_complete: false,
          });
        } else {
          userId = authData.user.id;
        }
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email: `${phone}@dev.local`,
        password: 'dev-password-123',
      });

      if (sessionError) return { error: sessionError };

      await fetchProfile(userId);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      setSession(null);
      setUser(null);
      setProfile(null);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        throw error;
      }
    } catch (error) {
      console.error('Sign out failed:', error);
      throw error;
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
