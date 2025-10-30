/*
  # Vendor Mobile App Database Schema

  ## Summary
  Creates the complete database structure for a vendor management mobile app with user authentication, 
  profiles, business registration, leads, and reviews.

  ## 1. New Tables

  ### `user_profiles`
  - `id` (uuid, primary key) - References auth.users
  - `phone_number` (text, unique) - User's mobile number
  - `first_name` (text) - User's first name
  - `last_name` (text) - User's last name
  - `email` (text) - User's email address
  - `profile_photo_url` (text) - URL to profile photo
  - `is_profile_complete` (boolean) - Flag for profile completion
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `businesses`
  - `id` (uuid, primary key) - Business identifier
  - `user_id` (uuid, foreign key) - Owner reference
  - `business_name` (text) - Name of the business
  - `contact_person_name` (text) - Contact person
  - `email` (text) - Business email
  - `phone_number` (text) - Business phone
  - `vendor_service_category` (text) - Service category
  - `event_types` (text[]) - Array of event types served
  - `business_description` (text) - Business description
  - `years_of_experience` (text) - Experience range
  - `business_address` (text) - Full address
  - `city` (text) - City name
  - `state` (text) - State name
  - `gst_number` (text) - Optional GST number
  - `business_registration_number` (text) - Optional registration number
  - `is_verified` (boolean) - Verification status
  - `website_url` (text) - Optional website
  - `instagram_url` (text) - Optional Instagram link
  - `facebook_url` (text) - Optional Facebook link
  - `youtube_url` (text) - Optional YouTube link
  - `cover_photo_url` (text) - Optional cover photo
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `business_portfolio`
  - `id` (uuid, primary key) - Portfolio image identifier
  - `business_id` (uuid, foreign key) - Business reference
  - `image_url` (text) - URL to portfolio image
  - `display_order` (integer) - Display order
  - `created_at` (timestamptz) - Upload timestamp

  ### `leads`
  - `id` (uuid, primary key) - Lead identifier
  - `business_id` (uuid, foreign key) - Target business
  - `customer_name` (text) - Customer name
  - `customer_email` (text) - Customer email
  - `customer_phone` (text) - Customer phone
  - `event_type` (text) - Type of event
  - `event_date` (date) - Planned event date
  - `message` (text) - Customer message
  - `status` (text) - Lead status (new, contacted, converted, closed)
  - `created_at` (timestamptz) - Lead creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `reviews`
  - `id` (uuid, primary key) - Review identifier
  - `business_id` (uuid, foreign key) - Business being reviewed
  - `customer_name` (text) - Reviewer name
  - `rating` (integer) - Rating (1-5)
  - `comment` (text) - Review text
  - `event_type` (text) - Event type for context
  - `is_flagged` (boolean) - Flagged for moderation
  - `created_at` (timestamptz) - Review timestamp

  ### `offers`
  - `id` (uuid, primary key) - Offer identifier
  - `business_id` (uuid, foreign key) - Business creating offer
  - `title` (text) - Offer title
  - `description` (text) - Offer details
  - `discount_percentage` (integer) - Discount amount
  - `valid_from` (date) - Start date
  - `valid_until` (date) - End date
  - `is_active` (boolean) - Active status
  - `created_at` (timestamptz) - Creation timestamp

  ## 2. Security
  - Enable RLS on all tables
  - Add policies for authenticated users to access their own data
  - Add policies for business owners to manage their businesses
  - Add read-only policies for public data (reviews, business listings)
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  email text,
  profile_photo_url text,
  is_profile_complete boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_person_name text NOT NULL,
  email text NOT NULL,
  phone_number text NOT NULL,
  vendor_service_category text NOT NULL,
  event_types text[] DEFAULT '{}',
  business_description text NOT NULL,
  years_of_experience text NOT NULL,
  business_address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  gst_number text,
  business_registration_number text,
  is_verified boolean DEFAULT false,
  website_url text,
  instagram_url text,
  facebook_url text,
  youtube_url text,
  cover_photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own businesses"
  ON businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own businesses"
  ON businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own businesses"
  ON businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can view verified businesses"
  ON businesses FOR SELECT
  TO anon
  USING (is_verified = true);

-- Create business_portfolio table
CREATE TABLE IF NOT EXISTS business_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE business_portfolio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage portfolio"
  ON business_portfolio FOR ALL
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

CREATE POLICY "Public can view portfolio"
  ON business_portfolio FOR SELECT
  TO anon
  USING (true);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text NOT NULL,
  event_type text NOT NULL,
  event_date date,
  message text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view their leads"
  ON leads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = leads.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update their leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = leads.business_id
      AND businesses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = leads.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create leads"
  ON leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  event_type text,
  is_flagged boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-flagged reviews"
  ON reviews FOR SELECT
  TO anon, authenticated
  USING (is_flagged = false);

CREATE POLICY "Business owners can flag reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = reviews.business_id
      AND businesses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = reviews.business_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  discount_percentage integer,
  valid_from date DEFAULT CURRENT_DATE,
  valid_until date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage offers"
  ON offers FOR ALL
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

CREATE POLICY "Public can view active offers"
  ON offers FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND valid_until >= CURRENT_DATE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(vendor_service_category);
CREATE INDEX IF NOT EXISTS idx_businesses_city ON businesses(city);
CREATE INDEX IF NOT EXISTS idx_businesses_state ON businesses(state);
CREATE INDEX IF NOT EXISTS idx_leads_business_id ON leads(business_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_offers_business_id ON offers(business_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();