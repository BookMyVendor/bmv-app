-- Add normalized vendor replies for reviews and improve lead communications metadata.
-- This migration is intentionally idempotent where possible.

-- 1) New table: crm.review_replies
CREATE TABLE IF NOT EXISTS "crm"."review_replies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "review_id" uuid NOT NULL REFERENCES "crm"."customer_reviews"("id") ON DELETE CASCADE,
  "vendor_id" uuid NOT NULL REFERENCES "core"."vendors"("id"),
  "reply_text" text NOT NULL,
  "reply_status" text NOT NULL DEFAULT 'published'
    CHECK ("reply_status" IN ('draft', 'published', 'deleted')),
  "is_edited" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

ALTER TABLE "crm"."review_replies" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "idx_review_replies_review_created"
  ON "crm"."review_replies" USING btree ("review_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_review_replies_vendor_created"
  ON "crm"."review_replies" USING btree ("vendor_id", "created_at" DESC);

-- Enforce max one active published reply per review.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_review_replies_one_active"
  ON "crm"."review_replies" ("review_id")
  WHERE ("reply_status" = 'published'::text AND "deleted_at" IS NULL);

CREATE OR REPLACE TRIGGER "set_updated_at"
  BEFORE UPDATE ON "crm"."review_replies"
  FOR EACH ROW
  EXECUTE FUNCTION "core"."trigger_set_timestamp"();

-- 2) Improve crm.lead_communications metadata for sender/read tracking.
ALTER TABLE "crm"."lead_communications"
  ADD COLUMN IF NOT EXISTS "sender_type" text,
  ADD COLUMN IF NOT EXISTS "sender_customer_id" uuid,
  ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_communications_sender_type_check'
      AND connamespace = 'crm'::regnamespace
  ) THEN
    ALTER TABLE "crm"."lead_communications"
      ADD CONSTRAINT "lead_communications_sender_type_check"
      CHECK ("sender_type" = ANY (ARRAY['vendor'::text, 'customer'::text, 'admin'::text, 'system'::text]));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lead_communications_sender_customer_id_fkey'
      AND connamespace = 'crm'::regnamespace
  ) THEN
    ALTER TABLE "crm"."lead_communications"
      ADD CONSTRAINT "lead_communications_sender_customer_id_fkey"
      FOREIGN KEY ("sender_customer_id") REFERENCES "crm"."customers"("id");
  END IF;
END $$;

-- Backfill sender_type from legacy boolean flag.
UPDATE "crm"."lead_communications"
SET "sender_type" = CASE WHEN "is_from_vendor" THEN 'vendor' ELSE 'customer' END
WHERE "sender_type" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_lead_communications_lead_created"
  ON "crm"."lead_communications" USING btree ("lead_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "idx_lead_communications_sender"
  ON "crm"."lead_communications" USING btree ("sender_type", "vendor_id", "sender_customer_id");

-- 3) Backfill existing inline review response data into crm.review_replies.
INSERT INTO "crm"."review_replies" (
  "review_id",
  "vendor_id",
  "reply_text",
  "reply_status",
  "is_edited",
  "created_at",
  "updated_at"
)
SELECT
  r."id" AS "review_id",
  r."vendor_id",
  r."vendor_response" AS "reply_text",
  'published'::text AS "reply_status",
  false AS "is_edited",
  COALESCE(r."vendor_response_date", r."updated_at", r."created_at", now()) AS "created_at",
  now() AS "updated_at"
FROM "crm"."customer_reviews" r
WHERE r."vendor_response" IS NOT NULL
  AND length(trim(r."vendor_response")) > 0
  AND r."vendor_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4) RLS + policies for review replies.
ALTER TABLE "crm"."review_replies" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'crm'
      AND tablename = 'review_replies'
      AND policyname = 'Anyone can view published review replies'
  ) THEN
    CREATE POLICY "Anyone can view published review replies"
    ON "crm"."review_replies"
    FOR SELECT
    USING (
      "reply_status" = 'published'::text
      AND "deleted_at" IS NULL
      AND "review_id" IN (
        SELECT cr."id"
        FROM "crm"."customer_reviews" cr
        WHERE cr."status" = 'approved'::text
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'crm'
      AND tablename = 'review_replies'
      AND policyname = 'Vendors can manage their review replies'
  ) THEN
    CREATE POLICY "Vendors can manage their review replies"
    ON "crm"."review_replies"
    USING ((("vendor_id")::text = (auth.uid())::text) OR (auth.role() = 'admin'::text))
    WITH CHECK ((("vendor_id")::text = (auth.uid())::text) OR (auth.role() = 'admin'::text));
  END IF;
END $$;

-- 5) Grants for PostgREST roles.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "crm"."review_replies" TO anon, authenticated, service_role;
