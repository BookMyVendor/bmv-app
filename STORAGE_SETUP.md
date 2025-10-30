# Supabase Storage Setup for Business Management

This document outlines the required Supabase Storage buckets for the business management features.

## Required Storage Buckets

### 1. `offer-banners`
**Purpose:** Store banner images for business offers and promotions

**Configuration:**
- **Public:** Yes (read-only public access)
- **File size limit:** 5MB per file
- **Allowed MIME types:** `image/jpeg`, `image/png`
- **Path structure:** `{business_id}/{timestamp}.{ext}`

**RLS Policies:**
```sql
-- Allow authenticated users to upload to their own business folders
CREATE POLICY "Users can upload offer banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'offer-banners' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their own offer banners
CREATE POLICY "Users can delete offer banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'offer-banners' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE user_id = auth.uid()
  )
);

-- Allow public read access
CREATE POLICY "Public can view offer banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'offer-banners');
```

### 2. `business-gallery`
**Purpose:** Store portfolio/gallery images for businesses (up to 20 per business)

**Configuration:**
- **Public:** Yes (read-only public access)
- **File size limit:** 10MB per file
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`
- **Path structure:** `{business_id}/{timestamp}.{ext}`

**RLS Policies:**
```sql
-- Allow authenticated users to upload to their own business folders
CREATE POLICY "Users can upload gallery images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'business-gallery' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete their own gallery images
CREATE POLICY "Users can delete gallery images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'business-gallery' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM businesses WHERE user_id = auth.uid()
  )
);

-- Allow public read access
CREATE POLICY "Public can view gallery images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'business-gallery');
```

## Setup Instructions

### Via Supabase Dashboard

1. Navigate to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Create bucket `offer-banners`:
   - Name: `offer-banners`
   - Public bucket: **Yes**
   - File size limit: `5242880` (5MB)
   - Allowed MIME types: `image/jpeg,image/png`
4. Create bucket `business-gallery`:
   - Name: `business-gallery`
   - Public bucket: **Yes**
   - File size limit: `10485760` (10MB)
   - Allowed MIME types: `image/jpeg,image/png,image/webp`
5. Apply the RLS policies listed above via the SQL Editor

### Via Supabase CLI

```bash
# Create offer-banners bucket
supabase storage create offer-banners --public

# Create business-gallery bucket
supabase storage create business-gallery --public

# Apply RLS policies (copy policies from above into SQL Editor or migration file)
```

## Testing Storage

After setup, test the storage functionality:

1. **Test Upload:** Try creating an offer with a banner image
2. **Test Read:** Verify the image displays in the app
3. **Test Delete:** Delete an offer and confirm the banner image is removed
4. **Test Gallery:** Upload multiple images to business gallery
5. **Test Limit:** Verify 20-image limit is enforced

## Troubleshooting

### Images not uploading
- Check if buckets are created and set to public
- Verify RLS policies are applied correctly
- Check file size and format restrictions
- Ensure user is authenticated

### Images not displaying
- Verify the public URL is generated correctly
- Check if bucket permissions allow public read access
- Inspect network requests in browser dev tools

### Permission errors
- Confirm RLS policies reference the correct bucket names
- Verify the user owns the business they're uploading to
- Check if auth.uid() matches the business user_id

## Security Notes

1. **Maximum images per business** is enforced at the application level (20 images)
2. **File validation** (format, size) happens before upload
3. **Automatic cleanup** removes storage files when database records are deleted
4. **Path isolation** ensures users can only access their own business folders
5. **Public read access** is required for displaying images to end users
