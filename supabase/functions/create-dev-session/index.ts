  import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  serve(async (req) => {
    try {
      if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders, status: 200 });
      }

      const body = JSON.parse(await req.text());
      const { phone } = body || {};
      
      if (!phone) {
        return new Response(
          JSON.stringify({ error: 'phone is required', step: 'validation' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
          JSON.stringify({ error: 'Missing environment variables', step: 'env_check' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });

      let userId: string;
      let userEmail: string;
      const defaultPassword = 'dev-password-123';

      // Try to create user first
      userEmail = `dev-${Date.now()}@dev.local`;
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userEmail,
        phone: phone,
        password: defaultPassword,
        email_confirm: true,
        phone_confirm: true,
      });

      if (createError) {
        // If user already exists, find the existing user
        if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
          // Find user by phone using GoTrue API
          const findUserUrl = `${supabaseUrl}/auth/v1/admin/users?phone=${encodeURIComponent(phone)}`;
          const findResponse = await fetch(findUserUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'apikey': serviceRoleKey,
            },
          });

          if (!findResponse.ok) {
            // If API doesn't support phone search, try listing users
            const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = usersData?.users?.find(u => u.phone === phone);
            
            if (!existingUser) {
              return new Response(
                JSON.stringify({ 
                  error: 'User exists but could not be found',
                  details: createError.message,
                  step: 'find_existing_user'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              );
            }

            userId = existingUser.id;
            userEmail = existingUser.email || `dev-${userId}@dev.local`;
            
            // Update password if needed (user might not have password set)
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: defaultPassword
            });
          } else {
            const userData = await findResponse.json();
            if (userData.users && userData.users.length > 0) {
              userId = userData.users[0].id;
              userEmail = userData.users[0].email || `dev-${userId}@dev.local`;
              
              // Update password if needed
              await supabaseAdmin.auth.admin.updateUserById(userId, {
                password: defaultPassword
              });
            } else {
              return new Response(
                JSON.stringify({ 
                  error: 'User exists but could not be found',
                  details: createError.message,
                  step: 'find_existing_user'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              );
            }
          }
        } else {
          // Some other error creating user
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create user',
              details: createError.message,
              step: 'create_user'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      } else if (newUser?.user) {
        // User created successfully
        userId = newUser.user.id;
        userEmail = newUser.user.email || userEmail;
      } else {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create user - no user returned',
            step: 'create_user'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Small delay to ensure password is set
      await new Promise(resolve => setTimeout(resolve, 300));

      // Sign in with password to get session
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: userEmail,
        password: defaultPassword,
      });

      if (signInError || !signInData.session) {
        return new Response(
          JSON.stringify({ 
            error: 'Failed to sign in',
            details: signInError?.message || 'No session returned',
            step: 'sign_in',
            userId,
            userEmail
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Return the session
      return new Response(
        JSON.stringify({ success: true, session: signInData.session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
          step: 'catch_block'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  });
