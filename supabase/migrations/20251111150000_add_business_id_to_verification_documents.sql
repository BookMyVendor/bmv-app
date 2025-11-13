-- Add business_id column to vendor_verification_documents table
-- This allows documents to be associated with specific businesses

ALTER TABLE "cms"."vendor_verification_documents"
ADD COLUMN IF NOT EXISTS "business_id" uuid;

-- Add foreign key constraint
ALTER TABLE "cms"."vendor_verification_documents"
ADD CONSTRAINT "vendor_verification_documents_business_id_fkey"
FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id") ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "idx_vendor_verification_documents_business_id"
ON "cms"."vendor_verification_documents"("business_id");

-- Note: vendor_id is kept for backward compatibility and can be nullable
-- Documents can be associated with either vendor_id (legacy) or business_id (new)

