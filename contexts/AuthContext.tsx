import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
      const { data, error } = await supabase
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
      // Format phone with country code for Supabase
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const verifyOTP = async (phone: string, token: string) => {
    try {
      const DEV_MODE = false; // TODO: Move to config
      const DEV_OTP = '123456';

      // Format phone with country code for Supabase
      const formattedPhone = phone.startsWith('+') ? phone : `+1${phone}`;

      // For dev mode with dummy OTP, use database function to create phone-only user
      if (DEV_MODE && token === DEV_OTP) {
        // Check if vendor profile exists
        const { data: existingProfile } = await supabase
          .from('vendors')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();

        let userId: string;

        if (existingProfile) {
          // Vendor exists - check if auth user exists
          userId = existingProfile.id;
          
          const { data: authUser } = await supabase.auth.getUser(userId);
          
          if (!authUser.user) {
            // Create auth user via database function
            const { data: functionData, error: functionError } = await supabase.rpc(
              'create_phone_auth_user',
              { phone_number: formattedPhone }
            );
            
            if (functionError) {
              console.error('Error creating auth user:', functionError);
              return { error: functionError };
            }
            
            userId = functionData;
            
            // Update vendor profile ID if it changed
            if (existingProfile.id !== userId) {
              await supabase.from('vendors').delete().eq('id', existingProfile.id);
              await supabase.from('vendors').insert({
                id: userId,
                phone: phone,
                first_name: '',
                last_name: '',
                email: '',
              });
            }
          }
        } else {
          // New vendor - create auth user via database function
          const { data: functionData, error: functionError } = await supabase.rpc(
            'create_phone_auth_user',
            { phone_number: formattedPhone }
          );
          
          if (functionError) {
            console.error('Error creating auth user:', functionError);
            return { error: functionError };
          }
          
          userId = functionData;

          // Create vendor profile
          const { error: vendorError } = await supabase.from('vendors').insert({
            id: userId,
            phone: phone,
            first_name: '',
            last_name: '',
            email: '',
          });

          if (vendorError) {
            console.error('Error creating vendor profile:', vendorError);
            return { 
              error: new Error(`Failed to create vendor profile: ${vendorError.message}`) 
            };
          }
        }

        // After creating user via database function, set password using Edge Function
        const tempEmail = `dev-${userId}@dev.local`;
        const password = 'dev-password-123';
        
        // Sign out first to clear any existing session
        await supabase.auth.signOut();
        
        // Set password using Edge Function (admin API)
        const { error: passwordError } = await supabase.functions.invoke(
          'set-dev-password',
          {
            body: { userId, password },
          }
        );

        if (passwordError) {
          return { 
            error: new Error(`Failed to set password: ${passwordError.message}`) 
          };
        }

        // Now sign in with password
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: tempEmail,
          password: password,
        });

        if (signInError) {
          return { 
            error: new Error(`Failed to sign in: ${signInError.message}`) 
          };
        }

        // Get the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          return { 
            error: new Error('Failed to create session after sign in') 
          };
        }

        setSession(session);
        setUser(session.user);
        await fetchProfile(userId);
        return { error: null };
      }

      // Real OTP verification (production mode)
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token,
        type: 'sms',
      });

      if (error) return { error };

      if (data.user) {
        const { data: existingProfile } = await supabase
          .from('vendors')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!existingProfile) {
          await supabase.from('vendors').insert({
            id: data.user.id,
            phone: phone,
            first_name: '',
            last_name: '',
            email: '',
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
        .from('vendors')
        .select('id')
        .eq('phone', phone);

      let userId: string;
      let emailFormat = `dev+${phone}@dev.local`; // New format (default)

      if (existingProfiles && existingProfiles.length > 0) {
        userId = existingProfiles[0].id;
        // Try to sign in with new format first
        const { error: newFormatError } = await supabase.auth.signInWithPassword({
          email: emailFormat,
          password: 'dev-password-123',
        });

        // If new format fails, try old format for backward compatibility
        if (newFormatError) {
          emailFormat = `${phone}@dev.local`; // Old format
          const { error: oldFormatError } = await supabase.auth.signInWithPassword({
            email: emailFormat,
            password: 'dev-password-123',
          });
          if (oldFormatError) return { error: oldFormatError };
        }
      } else {
        // Create new account with new format
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailFormat,
          password: 'dev-password-123',
        });

        if (authError) {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: emailFormat,
            password: 'dev-password-123',
          });

          if (signUpError) return { error: signUpError };
          userId = signUpData.user!.id;

          await supabase.from('vendors').insert({
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
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
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
