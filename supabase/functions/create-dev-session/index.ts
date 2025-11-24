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
    const { phone, otp } = body || {};
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'phone is required', step: 'validation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!otp) {
      return new Response(
        JSON.stringify({ error: 'otp is required', step: 'validation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables', step: 'env_check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    if (!anonKey) {
      console.error(`[LOG] SUPABASE_ANON_KEY not found in Edge Function environment`);
      return new Response(
        JSON.stringify({ 
          error: 'SUPABASE_ANON_KEY not configured in Edge Function environment',
          details: 'Please set SUPABASE_ANON_KEY in your Supabase Edge Function settings',
          step: 'env_check'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: {
        schema: 'core',
      },
    });

    // Create a client with anon key for sign-in (sessions created with anon key are valid for client use)
    // This uses the anon key configured in Edge Function environment (may differ from .env file)
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    console.log(`[LOG] Using anon key from Edge Function environment for session creation`);

    const nodeEnv = Deno.env.get('NODE_ENV') || Deno.env.get('ENVIRONMENT') || 'development';
    const isDevelopment = nodeEnv === 'development';

    // Use phone as-is (no country code prepending)
    const formattedPhone = phone;
    const phoneDigits = phone.replace(/\D/g, ''); // Remove non-digits for storage

    // Step 1: Check vendors table FIRST (no auth user needed - service role bypasses RLS)
    console.log(`[LOG] Checking vendors table for phone: ${phoneDigits}`);
    const { data: existingVendorByPhone, error: vendorQueryError } = await supabaseAdmin
      .from('vendors')
      .select('id, email, first_name, last_name')
      .eq('phone', phoneDigits)
      .maybeSingle();

    if (vendorQueryError && vendorQueryError.code !== 'PGRST116') {
      console.error(`[LOG] Error querying vendors: ${vendorQueryError.message}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to query vendors table',
          details: vendorQueryError.message,
          step: 'query_vendors'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Step 2: Verify OTP - DIFFERENT for dev vs prod
    let otpVerified = false;
    let productionSession: any = null;

    if (isDevelopment) {
      // DEV: Validate OTP format ourselves (single OTP for all phones)
      console.log(`[LOG] Development mode - validating OTP format: ${otp}`);
      if (otp !== '123456') {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid OTP',
            details: 'In development mode, OTP must be 123456',
            step: 'verify_otp'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      otpVerified = true;
      console.log(`[LOG] OTP validated in dev mode (123456) - skipping Supabase OTP verification`);
    } else {
      // PROD: Verify OTP with Twilio first, then use Supabase OTP flow
      console.log(`[LOG] Production mode - verifying OTP with Twilio for phone: ${formattedPhone}`);
      
      // TODO: Add Twilio OTP verification here
      // Example implementation:
      // const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      // const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      // const twilioServiceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID');
      // 
      // const twilioUrl = `https://verify.twilio.com/v2/Services/${twilioServiceSid}/VerificationCheck`;
      // const twilioResponse = await fetch(twilioUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/x-www-form-urlencoded',
      //     'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
      //   },
      //   body: new URLSearchParams({
      //     To: formattedPhone,
      //     Code: otp,
      //   }),
      // });
      // 
      // const twilioData = await twilioResponse.json();
      // if (twilioData.status !== 'approved') {
      //   return new Response(
      //     JSON.stringify({ 
      //       error: 'Invalid OTP',
      //       details: 'OTP verification failed with Twilio',
      //       step: 'verify_otp_twilio'
      //     }),
      //     { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      //   );
      // }
      
      // For now, assume Twilio verification happens externally or skip for testing
      console.log(`[LOG] Twilio verification skipped - add implementation when ready`);
      
      // After Twilio verification succeeds, use Supabase OTP flow to get session
      console.log(`[LOG] Creating OTP challenge with Supabase`);
      await supabaseAdmin.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          shouldCreateUser: false,
        },
      });

      // Wait for OTP challenge to be created
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify with Supabase to get session
      console.log(`[LOG] Verifying OTP with Supabase to get session`);
      const { data: verifyData, error: verifyError } = await supabaseAdmin.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms'
      });

      if (verifyError || !verifyData.session) {
        console.error(`[LOG] Supabase OTP verification failed: ${verifyError?.message}`);
        return new Response(
          JSON.stringify({ 
            error: 'Invalid OTP',
            details: verifyError?.message || 'OTP verification failed',
            step: 'verify_otp_supabase'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      otpVerified = true;
      productionSession = verifyData.session;
      console.log(`[LOG] OTP verified with Supabase, session created`);
    }

    // Step 3: Determine user ID - UNIFIED FLOW for dev and prod
    let userId: string;
    let userEmail: string;

    if (existingVendorByPhone) {
      // Vendor exists - ALWAYS use existing vendor's ID
      console.log(`[LOG] Existing vendor found with ID: ${existingVendorByPhone.id}`);
      userId = existingVendorByPhone.id;
      userEmail = existingVendorByPhone.email || `dev-${userId}@dev.local`;

      // In production, if verifyOtp created a different user, delete it
      if (!isDevelopment && productionSession) {
        const productionAuthUserId = productionSession.user?.id;
        if (productionAuthUserId && productionAuthUserId !== userId) {
          console.warn(`[LOG] Mismatch: Vendor ID ${userId} vs Auth User ID ${productionAuthUserId} - deleting orphaned user`);
          try {
            await supabaseAdmin.auth.admin.deleteUser(productionAuthUserId);
            console.log(`[LOG] Deleted orphaned auth user: ${productionAuthUserId}`);
          } catch (deleteError) {
            console.error(`[LOG] Failed to delete orphaned user: ${deleteError}`);
          }
        }
      }
    } else {
      // No vendor exists - create vendor first, then use its ID
      // Final check before creating (race condition protection)
      console.log(`[LOG] No vendor found - double-checking before creation`);
      const { data: finalVendorCheck } = await supabaseAdmin
        .from('vendors')
        .select('id, email')
        .eq('phone', phoneDigits)
        .maybeSingle();

      if (finalVendorCheck) {
        // Vendor was created between checks - use it
        console.log(`[LOG] Vendor found in final check: ${finalVendorCheck.id}`);
        userId = finalVendorCheck.id;
        userEmail = finalVendorCheck.email || `dev-${userId}@dev.local`;

        // In production, if verifyOtp created a different user, delete it
        if (!isDevelopment && productionSession) {
          const productionAuthUserId = productionSession.user?.id;
          if (productionAuthUserId && productionAuthUserId !== userId) {
            console.warn(`[LOG] Mismatch: Vendor ID ${userId} vs Auth User ID ${productionAuthUserId} - deleting orphaned user`);
            try {
              await supabaseAdmin.auth.admin.deleteUser(productionAuthUserId);
              console.log(`[LOG] Deleted orphaned auth user: ${productionAuthUserId}`);
            } catch (deleteError) {
              console.error(`[LOG] Failed to delete orphaned user: ${deleteError}`);
            }
          }
        }
      } else {
        // Still no vendor - create new vendor first, then use vendor.id
        // In production, if verifyOtp already created an auth user, we can use that ID for vendor
        // In dev, generate new UUID for vendor
        if (!isDevelopment && productionSession?.user?.id) {
          // Production: use auth user ID from verifyOtp for vendor
          userId = productionSession.user.id;
          userEmail = productionSession.user.email || `dev-${userId}@dev.local`;
          console.log(`[LOG] Using auth user ID from verifyOtp for vendor: ${userId}`);
        } else {
          // Dev: generate UUID for vendor, then use vendor.id
          userId = crypto.randomUUID();
          userEmail = `dev-${userId}@dev.local`;
          console.log(`[LOG] Generating UUID for new vendor: ${userId}`);
        }

        // Create vendor first, then use vendor.id for auth user
        console.log(`[LOG] Creating new vendor with ID: ${userId} for phone: ${phoneDigits}`);
        const { error: vendorCreateError } = await supabaseAdmin
          .from('vendors')
          .insert({
            id: userId,
            phone: phoneDigits,
            email: userEmail,
            first_name: '',
            last_name: '',
          });

        if (vendorCreateError) {
          console.error(`[LOG] Vendor creation failed: ${vendorCreateError.message}, code: ${vendorCreateError.code}`);
          // If duplicate key error, vendor was created by another request
          if (vendorCreateError.code === '23505' || vendorCreateError.message.includes('duplicate key')) {
            console.log(`[LOG] Duplicate key error - checking for existing vendor`);
            const { data: existingVendorRetry } = await supabaseAdmin
              .from('vendors')
              .select('id, email')
              .eq('phone', phoneDigits)
              .maybeSingle();

            if (existingVendorRetry) {
              // Use existing vendor's ID
              console.log(`[LOG] Found existing vendor: ${existingVendorRetry.id}`);
              userId = existingVendorRetry.id;
              userEmail = existingVendorRetry.email || `dev-${userId}@dev.local`;

              // In production, if verifyOtp created a different user, delete it
              if (!isDevelopment && productionSession) {
                const productionAuthUserId = productionSession.user?.id;
                if (productionAuthUserId && productionAuthUserId !== userId) {
                  console.warn(`[LOG] Mismatch after retry: Vendor ID ${userId} vs Auth User ID ${productionAuthUserId} - deleting orphaned user`);
                  try {
                    await supabaseAdmin.auth.admin.deleteUser(productionAuthUserId);
                    console.log(`[LOG] Deleted orphaned auth user: ${productionAuthUserId}`);
                  } catch (deleteError) {
                    console.error(`[LOG] Failed to delete orphaned user: ${deleteError}`);
                  }
                }
              }
            } else {
              return new Response(
                JSON.stringify({ 
                  error: 'Vendor creation failed - duplicate key but vendor not found',
                  details: vendorCreateError.message,
                  step: 'create_vendor_duplicate'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              );
            }
          } else {
            return new Response(
              JSON.stringify({ 
                error: 'Failed to create vendor',
                details: vendorCreateError.message,
                step: 'create_vendor'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
        } else {
          console.log(`[LOG] Vendor created successfully: ${userId}`);
        }
      }
    }

    // Step 4: Check if auth user exists by phone number first, then by vendor ID
    console.log(`[LOG] Checking if auth user exists by phone: ${formattedPhone}`);
    let authUser = null;

    // In production, check if verifyOtp created a user
    if (!isDevelopment && productionSession?.user) {
      const productionAuthUserId = productionSession.user.id;
      if (productionAuthUserId === userId) {
        // IDs match - use the session from verifyOtp
        console.log(`[LOG] Using session from verifyOtp (IDs match)`);
        return new Response(
          JSON.stringify({ success: true, session: productionSession }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      } else {
        // IDs don't match - we'll handle this below
        console.log(`[LOG] Auth user from verifyOtp has different ID: ${productionAuthUserId} vs vendor ID: ${userId}`);
      }
    }

    // Try to find auth user by phone number
    try {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const userByPhone = usersData?.users?.find(u => u.phone === formattedPhone);
      
      if (userByPhone) {
        authUser = userByPhone;
        console.log(`[LOG] Found auth user by phone: ${userByPhone.id}`);
        
        // If found user has different ID than vendor, handle it
        if (userByPhone.id !== userId) {
          console.warn(`[LOG] Auth user ID mismatch: Vendor ID ${userId} vs Auth User ID ${userByPhone.id}`);
          // If we have an existing vendor, delete the auth user with wrong ID
          if (existingVendorByPhone) {
            console.log(`[LOG] Deleting auth user with wrong ID: ${userByPhone.id}`);
            try {
              await supabaseAdmin.auth.admin.deleteUser(userByPhone.id);
              console.log(`[LOG] Deleted auth user: ${userByPhone.id}`);
              authUser = null;
            } catch (deleteError) {
              console.error(`[LOG] Failed to delete auth user: ${deleteError}`);
              authUser = null;
            }
          } else {
            // No existing vendor, so use the auth user's ID for vendor
            console.log(`[LOG] No existing vendor - using auth user ID: ${userByPhone.id} for vendor`);
            userId = userByPhone.id;
            userEmail = userByPhone.email || `dev-${userId}@dev.local`;
          }
        }
      }
    } catch (error) {
      console.log(`[LOG] Could not find auth user by phone: ${error}`);
    }

    // If not found by phone, check by vendor ID
    if (!authUser) {
      console.log(`[LOG] Checking if auth user exists with vendor ID: ${userId}`);
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
        authUser = userData?.user;
        if (authUser) {
          console.log(`[LOG] Auth user found with vendor ID: ${userId}`);
        }
      } catch (error) {
        console.log(`[LOG] Auth user not found with vendor ID: ${error}`);
        authUser = null;
      }
    }

    // Step 5: Create auth user if it doesn't exist (phone-based, with email for password sign-in)
    if (!authUser) {
      console.log(`[LOG] Creating auth user with ID: ${userId} for phone: ${formattedPhone}, email: ${userEmail}`);
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        id: userId,
        phone: formattedPhone,
        email: userEmail, // Set email so we can sign in with email+password
        email_confirm: true, // Confirm email so sign-in works
        phone_confirmed_at: new Date().toISOString(),
      });

      if (createError) {
        // If user already exists, try to find it
        if (createError.message.includes('already exists') || createError.message.includes('duplicate')) {
          console.log(`[LOG] Auth user creation failed - user may already exist. Checking...`);
          try {
            const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = usersData?.users?.find(u => u.phone === formattedPhone || u.id === userId);
            if (existingUser) {
              authUser = existingUser;
              console.log(`[LOG] Found existing auth user: ${existingUser.id}`);
            } else {
              return new Response(
                JSON.stringify({ 
                  error: 'Failed to create auth user - user exists but not found',
                  details: createError.message,
                  step: 'create_auth_user'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
              );
            }
          } catch (findError) {
            return new Response(
              JSON.stringify({ 
                error: 'Failed to create auth user',
                details: createError.message,
                step: 'create_auth_user'
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            );
          }
        } else {
          console.error(`[LOG] Auth user creation failed: ${createError.message}`);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create auth user',
              details: createError.message,
              step: 'create_auth_user'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      } else {
        authUser = newUser?.user;
        if (!authUser) {
          console.error(`[LOG] Auth user creation returned no user`);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to create auth user - no user returned',
              step: 'create_auth_user'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        console.log(`[LOG] Auth user created successfully: ${userId}`);
      }
    }

    // Step 6: Generate session - DIFFERENT for dev vs prod
    console.log(`[LOG] Generating session for user: ${userId}`);

    if (!isDevelopment && productionSession && productionSession.user?.id === userId) {
      // PROD: Use session from verifyOtp if IDs match
      console.log(`[LOG] Using session from verifyOtp`);
      return new Response(
        JSON.stringify({ success: true, session: productionSession }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // DEV mode or PROD fallback: Use temporary password approach
    try {
      // Ensure auth user has email set (required for signInWithPassword)
      // Always update email to ensure it matches userEmail
      console.log(`[LOG] Ensuring email is set on auth user: ${userEmail}`);
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: userEmail,
        email_confirm: true, // Confirm email so sign-in works
      });
      // Small delay to ensure email is set
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate a secure temporary password (user never sees this)
      const tempPassword = crypto.randomUUID();
      
      // Set temporary password on auth user
      console.log(`[LOG] Setting temporary password for session generation`);
      const { error: passwordUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });

      if (passwordUpdateError) {
        console.error(`[LOG] Failed to set password: ${passwordUpdateError.message}`);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to set password for session generation',
            details: passwordUpdateError.message,
            step: 'set_password'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      // Wait longer to ensure password is set and propagated
      console.log(`[LOG] Waiting for password to be set...`);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify user has email and password before signing in
      const { data: userVerify } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!userVerify?.user?.email) {
        console.error(`[LOG] Auth user does not have email set`);
        return new Response(
          JSON.stringify({ 
            error: 'Auth user missing email',
            details: 'Cannot sign in without email',
            step: 'verify_user'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
      console.log(`[LOG] User verified - email: ${userVerify.user.email}, ready to sign in`);

      // Sign in with temporary password to get session
      // Use regular client for sign-in (admin client might not create sessions properly)
      console.log(`[LOG] Signing in with temporary password to generate session (email: ${userEmail})`);
      const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
        email: userEmail,
        password: tempPassword,
      });

      // Note: We keep the temporary password set (user never knows it anyway)
      // Changing password after session creation would invalidate the session
      // The password is a random UUID that the user never has access to, so it's safe to leave it

      if (signInError || !signInData.session) {
        console.error(`[LOG] Failed to generate session: ${signInError?.message}`);
        console.error(`[LOG] Sign-in attempt details - email: ${userEmail}, userId: ${userId}, authUser.email: ${authUser?.email}`);
        
        // If sign-in fails, try to get user details to debug
        try {
          const { data: userCheck } = await supabaseAdmin.auth.admin.getUserById(userId);
          console.log(`[LOG] Auth user details: ${JSON.stringify({ id: userCheck?.user?.id, email: userCheck?.user?.email, phone: userCheck?.user?.phone })}`);
        } catch (debugError) {
          console.error(`[LOG] Could not fetch user for debugging: ${debugError}`);
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create session',
            details: signInError?.message || 'No session returned',
            step: 'create_session',
            debug: { email: userEmail, userId }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`[LOG] Session created successfully`);
      return new Response(
        JSON.stringify({ success: true, session: signInData.session }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      console.error(`[LOG] Error creating session: ${error}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create session',
          details: error instanceof Error ? error.message : String(error),
          step: 'create_session'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  } catch (error) {
    console.error(`[LOG] Internal server error: ${error}`);
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
