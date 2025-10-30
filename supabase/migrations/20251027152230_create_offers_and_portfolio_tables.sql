/*
  # Create Offers and Business Portfolio Tables

  ## Summary
  Creates tables for managing business offers/promotions and business portfolio images for the vendor management app.

  ## 1. New Tables

  ### `offers`
  - `id` (uuid, primary key) - Offer identifier
  - `business_id` (uuid, foreign key) - Business creating the offer
  - `title` (text, max 100 chars) - Offer title
  - `description` (text, max 500 chars) - Offer details
  - `banner_image_url` (text) - URL to banner image in Supabase Storage
  - `discount_percentage` (integer) - Optional discount amount
  - `valid_from` (date) - Start date
  - `valid_until` (date) - End date (required, must be future)
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `business_portfolio`
  - `id` (uuid, primary key) - Portfolio image identifier
  - `business_id` (uuid, foreign key) - Business reference
  - `image_url` (text) - URL to portfolio image in Supabase Storage
  - `display_order` (integer) - Display order for sorting
  - `created_at` (timestamptz) - Upload timestamp

  ## 2. Security
  - Enable RLS on both tables
  - Business owners can manage their own offers and portfolio images
  - Public can view active offers and portfolio images
  - Maximum 20 images per business enforced at application level

  ## 3. Important Notes
  - Image uploads handled via Supabase Storage buckets: `offer-banners` and `business-gallery`
  - File validation (format, size) performed at upload time
  - Automatic cleanup of storage files when database records are deleted
*/

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 100),
  description text NOT NULL CHECK (char_length(description) <= 500),
  banner_image_url text,
  discount_percentage integer CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  valid_from date DEFAULT CURRENT_DATE,
  valid_until date NOT NULL CHECK (valid_until >= CURRENT_DATE),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their offers"
  ON offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can insert offers"
  ON offers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update their offers"
  ON offers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete their offers"
  ON offers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = offers.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active offers"
  ON offers FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND valid_until >= CURRENT_DATE);

-- Create business_portfolio table
CREATE TABLE IF NOT EXISTS business_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their portfolio"
  ON business_portfolio FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_portfolio.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can insert portfolio images"
  ON business_portfolio FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_portfolio.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update portfolio images"
  ON business_portfolio FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_portfolio.business_id
      AND businesses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_portfolio.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete portfolio images"
  ON business_portfolio FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = business_portfolio.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Public can view portfolio images"
  ON business_portfolio FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offers_business_id ON offers(business_id);
CREATE INDEX IF NOT EXISTS idx_offers_valid_until ON offers(valid_until);
CREATE INDEX IF NOT EXISTS idx_offers_is_active ON offers(is_active);
CREATE INDEX IF NOT EXISTS idx_business_portfolio_business_id ON business_portfolio(business_id);
CREATE INDEX IF NOT EXISTS idx_business_portfolio_display_order ON business_portfolio(business_id, display_order);

-- Create updated_at trigger for offers
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create helper function to count portfolio images
CREATE OR REPLACE FUNCTION get_business_image_count(p_business_id uuid)
RETURNS integer AS $$
  SELECT COUNT(*)::integer FROM business_portfolio WHERE business_id = p_business_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_business_image_count IS 'Returns the count of portfolio images for a specific business. Maximum allowed is 20.';