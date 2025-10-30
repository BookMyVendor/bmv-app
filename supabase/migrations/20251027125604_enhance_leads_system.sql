/*
  # Enhance Leads System

  ## Summary
  Adds enhanced features to the leads system including:
  - Priority field for lead prioritization
  - Budget range and guest count for better lead qualification
  - Venue information
  - Notes field for internal notes
  - Tags for categorization
  - Lead activities table for activity tracking
  - Lead notes table for detailed notes with full history

  ## Changes to Existing Tables
  
  ### `leads` table enhancements:
  - Add `priority` (text) - Lead priority (low, medium, high, urgent)
  - Add `budget_range` (text) - Expected budget range
  - Add `guest_count` (integer) - Number of expected guests
  - Add `venue` (text) - Event venue information
  - Add `notes` (text) - Internal notes
  - Add `tags` (text array) - Tags for categorization

  ## New Tables
  
  ### `lead_activities`
  - `id` (uuid, primary key) - Activity identifier
  - `lead_id` (uuid, foreign key) - Reference to lead
  - `activity_type` (text) - Type of activity
  - `title` (text) - Activity title
  - `description` (text) - Activity description
  - `performed_by` (uuid) - User who performed activity
  - `metadata` (jsonb) - Additional metadata
  - `created_at` (timestamptz) - Activity timestamp

  ### `lead_notes`
  - `id` (uuid, primary key) - Note identifier
  - `lead_id` (uuid, foreign key) - Reference to lead
  - `content` (text) - Note content
  - `created_by` (uuid) - User who created note
  - `created_at` (timestamptz) - Note creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all new tables
  - Business owners can view and manage activities and notes for their leads
  
  ## Performance
  - Add indexes on foreign keys and commonly queried fields
*/

-- Add new columns to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'priority'
  ) THEN
    ALTER TABLE leads ADD COLUMN priority text DEFAULT 'medium';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'budget_range'
  ) THEN
    ALTER TABLE leads ADD COLUMN budget_range text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'guest_count'
  ) THEN
    ALTER TABLE leads ADD COLUMN guest_count integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'venue'
  ) THEN
    ALTER TABLE leads ADD COLUMN venue text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'notes'
  ) THEN
    ALTER TABLE leads ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'tags'
  ) THEN
    ALTER TABLE leads ADD COLUMN tags text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;

-- Create lead_activities table
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title text NOT NULL,
  description text,
  performed_by uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view activities for their leads"
  ON lead_activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_activities.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can create activities for their leads"
  ON lead_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_activities.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update activities for their leads"
  ON lead_activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_activities.lead_id
      AND businesses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_activities.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete activities for their leads"
  ON lead_activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_activities.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

-- Create lead_notes table
CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can view notes for their leads"
  ON lead_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_notes.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can create notes for their leads"
  ON lead_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_notes.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update notes for their leads"
  ON lead_notes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_notes.lead_id
      AND businesses.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_notes.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete notes for their leads"
  ON lead_notes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN businesses ON businesses.id = leads.business_id
      WHERE leads.id = lead_notes.lead_id
      AND businesses.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at ON lead_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);

-- Create trigger for lead_notes updated_at
DROP TRIGGER IF EXISTS update_lead_notes_updated_at ON lead_notes;
CREATE TRIGGER update_lead_notes_updated_at
  BEFORE UPDATE ON lead_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
