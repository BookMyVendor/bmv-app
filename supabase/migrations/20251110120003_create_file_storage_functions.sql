-- Alternative to views: Create RPC functions for file_storage operations

-- Function to insert into file_storage
CREATE OR REPLACE FUNCTION public.insert_file_storage(
  p_original_filename TEXT,
  p_stored_filename TEXT,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_file_extension TEXT,
  p_storage_provider TEXT DEFAULT 'supabase',
  p_storage_bucket TEXT DEFAULT 'uploads',
  p_file_hash TEXT DEFAULT NULL,
  p_upload_status TEXT DEFAULT 'completed',
  p_uploaded_by_type TEXT,
  p_uploaded_by_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cms
AS $$
DECLARE
  v_file_id UUID;
BEGIN
  INSERT INTO cms.file_storage (
    id,
    original_filename,
    stored_filename,
    file_path,
    file_size,
    mime_type,
    file_extension,
    storage_provider,
    storage_bucket,
    file_hash,
    upload_status,
    uploaded_by_type,
    uploaded_by_id,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    p_original_filename,
    p_stored_filename,
    p_file_path,
    p_file_size,
    p_mime_type,
    p_file_extension,
    p_storage_provider,
    p_storage_bucket,
    p_file_hash,
    p_upload_status,
    p_uploaded_by_type,
    p_uploaded_by_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_file_id;
  
  RETURN v_file_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.insert_file_storage TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_file_storage TO anon;

-- Function to get file_storage by ID
CREATE OR REPLACE FUNCTION public.get_file_storage(p_file_id UUID)
RETURNS TABLE (
  id UUID,
  original_filename TEXT,
  stored_filename TEXT,
  file_path TEXT,
  file_size BIGINT,
  mime_type TEXT,
  file_extension TEXT,
  storage_provider TEXT,
  storage_bucket TEXT,
  file_hash TEXT,
  upload_status TEXT,
  uploaded_by_type TEXT,
  uploaded_by_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cms
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fs.id,
    fs.original_filename,
    fs.stored_filename,
    fs.file_path,
    fs.file_size,
    fs.mime_type,
    fs.file_extension,
    fs.storage_provider,
    fs.storage_bucket,
    fs.file_hash,
    fs.upload_status,
    fs.uploaded_by_type,
    fs.uploaded_by_id,
    fs.created_at,
    fs.updated_at
  FROM cms.file_storage fs
  WHERE fs.id = p_file_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_file_storage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_file_storage(UUID) TO anon;

