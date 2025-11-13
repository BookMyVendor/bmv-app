-- Storage RLS Policies for vendor-media bucket
-- Allows anonymous users to read/view files
-- Allows authenticated users to upload, update, and delete files
-- Note: RLS is already enabled on storage.objects by Supabase

-- Drop existing policies for vendor-media bucket if they exist
DROP POLICY IF EXISTS "Public can view vendor-media files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload vendor-media files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update vendor-media files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete vendor-media files" ON storage.objects;

-- Policy 1: Allow anonymous users (public) to read/view files
CREATE POLICY "Public can view vendor-media files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'vendor-media');

-- Policy 2: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload vendor-media files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vendor-media');

-- Policy 3: Allow authenticated users to update their own files
-- Users can update files they own (owner_id matches auth.uid())
CREATE POLICY "Authenticated users can update vendor-media files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendor-media' AND
  (owner_id = auth.uid() OR owner IS NULL)
)
WITH CHECK (
  bucket_id = 'vendor-media' AND
  (owner_id = auth.uid() OR owner IS NULL)
);

-- Policy 4: Allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete vendor-media files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendor-media' AND
  (owner_id = auth.uid() OR owner IS NULL)
);

