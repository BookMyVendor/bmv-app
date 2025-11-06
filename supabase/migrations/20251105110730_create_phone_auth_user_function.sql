-- Function to create phone-only auth users (for dev mode)
-- Also creates email identity for password auth fallback
CREATE OR REPLACE FUNCTION public.create_phone_auth_user(phone_number TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  user_id UUID;
  instance_id_val UUID;
  existing_user_id UUID;
  temp_email TEXT;
BEGIN
  -- Check if user already exists with this phone number
  SELECT id INTO existing_user_id 
  FROM auth.users 
  WHERE phone = phone_number 
  LIMIT 1;
  
  IF existing_user_id IS NOT NULL THEN
    RETURN existing_user_id;
  END IF;
  
  -- Get instance ID (usually from auth.instances)
  SELECT id INTO instance_id_val FROM auth.instances LIMIT 1;
  
  -- Generate new user ID
  user_id := gen_random_uuid();
  temp_email := 'dev-' || user_id::text || '@dev.local';
  
  -- Insert into auth.users table (with email for compatibility)
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    phone,
    email,
    phone_confirmed_at,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    user_id,
    COALESCE(instance_id_val, '00000000-0000-0000-0000-000000000000'::uuid),
    'authenticated',
    'authenticated',
    phone_number,
    temp_email,
    NOW(),
    NOW(),
    '{"provider": "phone", "providers": ["phone"]}'::jsonb,
    jsonb_build_object('phone', phone_number),
    NOW(),
    NOW()
  );
  
  -- Create identity for phone authentication
  INSERT INTO auth.identities (
    id,
    user_id,
    provider,
    provider_id,
    identity_data,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    user_id,
    'phone',
    phone_number,
    jsonb_build_object('phone', phone_number),
    NOW(),
    NOW()
  );
  
  -- Create email identity (for password auth fallback)
  INSERT INTO auth.identities (
    id,
    user_id,
    provider,
    provider_id,
    identity_data,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    user_id,
    'email',
    temp_email,
    jsonb_build_object('email', temp_email),
    NOW(),
    NOW()
  );
  
  RETURN user_id;
END;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.create_phone_auth_user(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_phone_auth_user(TEXT) TO anon;

-- Add comment explaining the function
COMMENT ON FUNCTION public.create_phone_auth_user(TEXT) IS 'Creates a phone-only authentication user in auth.users and auth.identities. Returns the user ID. Used for dev mode phone authentication.';

