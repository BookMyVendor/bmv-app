/*
  # Add Base64 Image Storage Support

  ## Summary
  Adds base64 image storage columns to offers and business_portfolio tables as an alternative to Supabase Storage URLs.

  ## 1. Schema Changes

  ### `offers` table
  - Add `banner_image_base64` (text) - Base64 encoded banner image with size limit
  
  ### `business_portfolio` table
  - Add `image_base64` (text) - Base64 encoded portfolio image with size limit

  ## 2. Constraints
  - Maximum 700,000 characters per base64 field (~500KB encoded image)
  - Keeps existing `image_url` columns for backward compatibility
  - Either base64 OR url can be used, not both

  ## 3. Important Notes
  - Base64 storage is less efficient than file storage
  - Images must be aggressively compressed before encoding
  - Recommended max resolution: 800px width, 60% JPEG quality
  - Database size will increase significantly with base64 images
  - No CDN caching available for base64 images
*/

-- Add base64 column to offers table
ALTER TABLE offers 
  ADD COLUMN IF NOT EXISTS banner_image_base64 text;

-- Add size constraint for offers banner images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'offers_banner_image_base64_size_limit'
  ) THEN
    ALTER TABLE offers 
      ADD CONSTRAINT offers_banner_image_base64_size_limit 
        CHECK (length(banner_image_base64) < 700000);
  END IF;
END $$;

-- Add base64 column to business_portfolio table
ALTER TABLE business_portfolio
  ADD COLUMN IF NOT EXISTS image_base64 text;

-- Add size constraint for portfolio images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'portfolio_image_base64_size_limit'
  ) THEN
    ALTER TABLE business_portfolio
      ADD CONSTRAINT portfolio_image_base64_size_limit
        CHECK (length(image_base64) < 700000);
  END IF;
END $$;

-- Make image_url nullable since we can use base64 instead
ALTER TABLE business_portfolio 
  ALTER COLUMN image_url DROP NOT NULL;

-- Add comments explaining the columns
COMMENT ON COLUMN offers.banner_image_base64 IS 'Base64 encoded banner image (max ~500KB after encoding). Use banner_image_url for larger images stored in Supabase Storage.';
COMMENT ON COLUMN business_portfolio.image_base64 IS 'Base64 encoded portfolio image (max ~500KB after encoding). Use image_url for larger images stored in Supabase Storage.';

-- Add constraint to ensure either URL or base64 is provided for portfolio
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'portfolio_image_source_required'
  ) THEN
    ALTER TABLE business_portfolio
      ADD CONSTRAINT portfolio_image_source_required
        CHECK (
          (image_url IS NOT NULL AND image_base64 IS NULL) OR
          (image_url IS NULL AND image_base64 IS NOT NULL)
        );
  END IF;
END $$;