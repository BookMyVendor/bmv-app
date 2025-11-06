


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "analytics";


ALTER SCHEMA "analytics" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "backoffice";


ALTER SCHEMA "backoffice" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "cms";


ALTER SCHEMA "cms" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "core";


ALTER SCHEMA "core" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "crm";


ALTER SCHEMA "crm" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "core"."category_type_enum" AS ENUM (
    'event',
    'business'
);


ALTER TYPE "core"."category_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."get_category_level"("cat_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
WITH RECURSIVE cte(id, parent_category_id, lvl) AS (
  SELECT id, parent_category_id, 1
  FROM core.categories
  WHERE id = cat_id
  UNION ALL
  SELECT c.id, c.parent_category_id, cte.lvl + 1
  FROM core.categories c
  INNER JOIN cte ON c.id = cte.parent_category_id
)
SELECT MAX(lvl) FROM cte;
$$;


ALTER FUNCTION "core"."get_category_level"("cat_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."set_category_level"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  lvl INTEGER;
BEGIN
  WITH RECURSIVE chain(id, lvl) AS (
    SELECT NEW.parent_category_id, 1
    UNION ALL
    SELECT c.parent_category_id, chain.lvl + 1
    FROM core.categories c
    JOIN chain ON c.id = chain.id
    WHERE chain.id IS NOT NULL
  )
  SELECT COALESCE(MAX(chain.lvl), 1) INTO lvl FROM chain;

  NEW.category_level := lvl;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "core"."set_category_level"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."trigger_set_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "core"."trigger_set_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "core"."update_vendor_rating"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE core.vendors
  SET calculated_rating = (
    SELECT COALESCE(AVG(rating), 0)::NUMERIC(2,1)
    FROM crm.customer_reviews
    WHERE vendor_id = COALESCE(NEW.vendor_id, OLD.vendor_id) AND status = 'approved'
  ),
  review_count = (
    SELECT COUNT(*)
    FROM crm.customer_reviews
    WHERE vendor_id = COALESCE(NEW.vendor_id, OLD.vendor_id) AND status = 'approved'
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.vendor_id, OLD.vendor_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "core"."update_vendor_rating"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "backoffice"."backoffice_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "last_login" timestamp with time zone,
    "avatar" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "backoffice_users_role_check" CHECK (("role" = ANY (ARRAY['super-admin'::"text", 'accounting'::"text", 'sales'::"text", 'cms-manager'::"text"])))
);


ALTER TABLE "backoffice"."backoffice_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "cms"."banner_ads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_file_id" "uuid",
    "cta_text" "text",
    "cta_link" "text",
    "vendor_id" "uuid",
    "business_id" "uuid",
    "placement" "text" NOT NULL,
    "category_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "priority" integer DEFAULT 1 NOT NULL,
    "impressions" integer DEFAULT 0 NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL,
    "ctr" numeric(5,2) DEFAULT 0.00,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "target_location" "text",
    "budget" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "banner_ads_check" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "banner_ads_placement_check" CHECK (("placement" = ANY (ARRAY['homepage-hero'::"text", 'category-top'::"text", 'search-results'::"text"])))
);


ALTER TABLE "cms"."banner_ads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "cms"."file_storage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_filename" "text" NOT NULL,
    "stored_filename" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_size" bigint,
    "mime_type" "text",
    "file_extension" "text",
    "storage_provider" "text" DEFAULT 'supabase'::"text",
    "storage_bucket" "text" DEFAULT 'uploads'::"text",
    "file_hash" "text",
    "upload_status" "text" DEFAULT 'completed'::"text",
    "uploaded_by_type" "text",
    "uploaded_by_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "file_storage_storage_provider_check" CHECK (("storage_provider" = ANY (ARRAY['supabase'::"text", 's3'::"text", 'gcs'::"text", 'azure'::"text"]))),
    CONSTRAINT "file_storage_upload_status_check" CHECK (("upload_status" = ANY (ARRAY['uploading'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "file_storage_uploaded_by_type_check" CHECK (("uploaded_by_type" = ANY (ARRAY['vendor'::"text", 'admin'::"text", 'customer'::"text"])))
);


ALTER TABLE "cms"."file_storage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "cms"."review_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid",
    "file_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "cms"."review_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "cms"."vendor_business_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "file_id" "uuid",
    "image_type" "text" DEFAULT 'gallery'::"text",
    "caption" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vendor_business_media_image_type_check" CHECK (("image_type" = ANY (ARRAY['gallery'::"text", 'cover'::"text", 'portfolio'::"text"])))
);


ALTER TABLE "cms"."vendor_business_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "cms"."vendor_verification_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid",
    "document_type_id" "uuid",
    "file_id" "uuid",
    "verification_status" "text" DEFAULT 'pending'::"text",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "rejection_reason" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vendor_verification_documents_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "cms"."vendor_verification_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_type" "core"."category_type_enum" NOT NULL,
    "parent_category_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" DEFAULT ''::"text" NOT NULL,
    "icon" "text" DEFAULT '📁'::"text",
    "visible" boolean DEFAULT true NOT NULL,
    "vendor_count" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0,
    "meta_title" "text",
    "meta_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_level" integer
);


ALTER TABLE "core"."categories" OWNER TO "postgres";


CREATE OR REPLACE VIEW "core"."business_categories" AS
 SELECT "id",
    "category_type",
    "parent_category_id",
    "name",
    "slug",
    "icon",
    "visible",
    "vendor_count",
    "sort_order",
    "meta_title",
    "meta_description",
    "created_at",
    "updated_at",
    "category_level"
   FROM "core"."categories"
  WHERE ("category_type" = 'business'::"core"."category_type_enum");


ALTER VIEW "core"."business_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."business_specializations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "specialization_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "core"."business_specializations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."category_form_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "field_name" "text" NOT NULL,
    "field_type" "text" NOT NULL,
    "field_label" "text" NOT NULL,
    "is_required" boolean DEFAULT false,
    "field_options" "jsonb",
    "validation_rules" "jsonb",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "category_form_fields_field_type_check" CHECK (("field_type" = ANY (ARRAY['text'::"text", 'textarea'::"text", 'number'::"text", 'select'::"text", 'multiselect'::"text", 'file'::"text", 'image'::"text"])))
);


ALTER TABLE "core"."category_form_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."document_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type_code" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "is_required_for_verification" boolean DEFAULT false,
    "allowed_mime_types" "text"[],
    "max_file_size_mb" integer DEFAULT 10,
    "applicable_to" "text"[] DEFAULT ARRAY['vendor'::"text", 'business'::"text"],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "core"."document_types" OWNER TO "postgres";


CREATE OR REPLACE VIEW "core"."event_categories" AS
 SELECT "id",
    "category_type",
    "parent_category_id",
    "name",
    "slug",
    "icon",
    "visible",
    "vendor_count",
    "sort_order",
    "meta_title",
    "meta_description",
    "created_at",
    "updated_at",
    "category_level"
   FROM "core"."categories"
  WHERE ("category_type" = 'event'::"core"."category_type_enum");


ALTER VIEW "core"."event_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."event_sub_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "age_range" "text",
    "guest_count_min" integer,
    "guest_count_max" integer,
    "budget_range_min" numeric(10,2),
    "budget_range_max" numeric(10,2),
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_sub_templates_budget_range_min_check" CHECK (("budget_range_min" >= (0)::numeric)),
    CONSTRAINT "event_sub_templates_check" CHECK (("guest_count_max" >= "guest_count_min")),
    CONSTRAINT "event_sub_templates_check1" CHECK (("budget_range_max" >= "budget_range_min")),
    CONSTRAINT "event_sub_templates_guest_count_min_check" CHECK (("guest_count_min" >= 0))
);


ALTER TABLE "core"."event_sub_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."event_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "icon_file_id" "uuid",
    "banner_image_file_id" "uuid",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "meta_title" "text",
    "meta_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "core"."event_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."featured_placements" (
    "id" "uuid" NOT NULL,
    "vendor_id" "uuid",
    "business_id" "uuid",
    "position" "text",
    "start_date" "date",
    "end_date" "date"
);


ALTER TABLE "core"."featured_placements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."template_category_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "sub_template_id" "uuid",
    "category_id" "uuid",
    "is_required" boolean DEFAULT false,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "core"."template_category_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."trust_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid",
    "badge_level" "text" DEFAULT 'basic'::"text",
    "badge_status" "text" DEFAULT 'active'::"text",
    "issued_date" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "verification_score" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trust_badges_badge_level_check" CHECK (("badge_level" = ANY (ARRAY['basic'::"text", 'premium'::"text", 'verified_pro'::"text"]))),
    CONSTRAINT "trust_badges_badge_status_check" CHECK (("badge_status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "trust_badges_verification_score_check" CHECK ((("verification_score" >= 0) AND ("verification_score" <= 100)))
);


ALTER TABLE "core"."trust_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."vendor_business_form_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "field_name" "text" NOT NULL,
    "field_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "core"."vendor_business_form_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."vendor_business_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "offer_title" "text" NOT NULL,
    "offer_description" "text",
    "discount_percentage" numeric(5,2),
    "discount_amount" numeric(10,2),
    "offer_type" "text" DEFAULT 'percentage'::"text",
    "min_order_value" numeric(10,2),
    "max_discount" numeric(10,2),
    "valid_from" "date",
    "valid_until" "date",
    "terms_conditions" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vendor_business_offers_check" CHECK (("valid_until" >= "valid_from")),
    CONSTRAINT "vendor_business_offers_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "vendor_business_offers_discount_percentage_check" CHECK ((("discount_percentage" >= (0)::numeric) AND ("discount_percentage" <= (100)::numeric))),
    CONSTRAINT "vendor_business_offers_max_discount_check" CHECK (("max_discount" >= (0)::numeric)),
    CONSTRAINT "vendor_business_offers_min_order_value_check" CHECK (("min_order_value" >= (0)::numeric)),
    CONSTRAINT "vendor_business_offers_offer_type_check" CHECK (("offer_type" = ANY (ARRAY['percentage'::"text", 'fixed_amount'::"text", 'buy_one_get_one'::"text", 'custom'::"text"])))
);


ALTER TABLE "core"."vendor_business_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."vendor_business_pricing_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "package_name" "text" NOT NULL,
    "package_type" "text" DEFAULT 'fixed'::"text",
    "base_price" numeric(10,2) NOT NULL,
    "min_price" numeric(10,2),
    "max_price" numeric(10,2),
    "price_unit" "text" DEFAULT 'per_event'::"text",
    "min_capacity" integer,
    "max_capacity" integer,
    "package_description" "text",
    "included_services" "text"[],
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vendor_business_pricing_packages_base_price_check" CHECK (("base_price" >= (0)::numeric)),
    CONSTRAINT "vendor_business_pricing_packages_check" CHECK (("max_price" >= "min_price")),
    CONSTRAINT "vendor_business_pricing_packages_check1" CHECK (("max_capacity" >= "min_capacity")),
    CONSTRAINT "vendor_business_pricing_packages_min_capacity_check" CHECK (("min_capacity" >= 0)),
    CONSTRAINT "vendor_business_pricing_packages_min_price_check" CHECK (("min_price" >= (0)::numeric)),
    CONSTRAINT "vendor_business_pricing_packages_package_type_check" CHECK (("package_type" = ANY (ARRAY['fixed'::"text", 'hourly'::"text", 'per_person'::"text", 'custom'::"text"])))
);


ALTER TABLE "core"."vendor_business_pricing_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."vendor_businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid",
    "business_name" "text" NOT NULL,
    "description" "text",
    "address" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "operating_locations" "text"[],
    "service_radius_km" integer DEFAULT 0,
    "contact_person_name" "text",
    "contact_person_role" "text",
    "business_registration_number" "text",
    "website_url" "text",
    "instagram_url" "text",
    "facebook_url" "text",
    "youtube_url" "text",
    "cover_photo_url" "text",
    "years_experience" integer DEFAULT 0,
    "calculated_rating" numeric(2,1) DEFAULT 0,
    "review_count" integer DEFAULT 0,
    "featured" boolean DEFAULT false NOT NULL,
    "verified" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "availability" "text",
    "gst_number" "text",
    "joined_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "subscription_status" "text" DEFAULT 'trial'::"text" NOT NULL,
    "subscription_expiry" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "vendor_businesses_calculated_rating_check" CHECK ((("calculated_rating" >= (0)::numeric) AND ("calculated_rating" <= (5)::numeric))),
    CONSTRAINT "vendor_businesses_service_radius_km_check" CHECK (("service_radius_km" >= 0)),
    CONSTRAINT "vendor_businesses_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'suspended'::"text"]))),
    CONSTRAINT "vendor_businesses_subscription_status_check" CHECK (("subscription_status" = ANY (ARRAY['trial'::"text", 'paid'::"text", 'expired'::"text"]))),
    CONSTRAINT "vendor_businesses_years_experience_check" CHECK (("years_experience" >= 0))
);


ALTER TABLE "core"."vendor_businesses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."vendor_otp" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid",
    "phone_number" "text" NOT NULL,
    "otp_code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "is_used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "core"."vendor_otp" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "core"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "image_file_id" "uuid",
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "core"."vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."blog_posts" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "title" "text",
    "content" "text",
    "image_url" "text",
    "created_at" timestamp without time zone,
    "updated_at" timestamp without time zone
);


ALTER TABLE "crm"."blog_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."checklist_items" (
    "checklist_id" "uuid",
    "task" "text",
    "category" "text",
    "priority" "text",
    "due_date" "date",
    "completed" boolean,
    CONSTRAINT "checklist_items_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))
);


ALTER TABLE "crm"."checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."checklists" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "name" "text"
);


ALTER TABLE "crm"."checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."customer_activity" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "activity_type" "text",
    "vendor_id" "uuid",
    "timestamp" timestamp without time zone
);


ALTER TABLE "crm"."customer_activity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."customer_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "business_id" "uuid",
    "vendor_id" "uuid",
    "category_id" "uuid",
    "template_id" "uuid",
    "sub_template_id" "uuid",
    "lead_type" "text" DEFAULT 'inquiry'::"text",
    "customer_name" "text",
    "customer_phone" "text",
    "customer_email" "text",
    "event_date" "date",
    "event_location" "text",
    "guest_count" integer,
    "event_duration_hours" integer,
    "budget_range" "text",
    "requirements" "text",
    "lead_status" "text" DEFAULT 'new'::"text",
    "lead_source" "text" DEFAULT 'website'::"text",
    "search_context" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_leads_event_duration_hours_check" CHECK (("event_duration_hours" >= 0)),
    CONSTRAINT "customer_leads_guest_count_check" CHECK (("guest_count" >= 0)),
    CONSTRAINT "customer_leads_lead_source_check" CHECK (("lead_source" = ANY (ARRAY['website'::"text", 'mobile'::"text", 'referral'::"text", 'direct'::"text"]))),
    CONSTRAINT "customer_leads_lead_status_check" CHECK (("lead_status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'quoted'::"text", 'converted'::"text", 'lost'::"text"]))),
    CONSTRAINT "customer_leads_lead_type_check" CHECK (("lead_type" = ANY (ARRAY['inquiry'::"text", 'quote_request'::"text", 'booking_interest'::"text"])))
);


ALTER TABLE "crm"."customer_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."customer_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "vendor_id" "uuid",
    "business_id" "uuid",
    "lead_id" "uuid",
    "rating" integer NOT NULL,
    "review_title" "text",
    "review_text" "text",
    "service_date" "date",
    "is_verified" boolean DEFAULT false,
    "vendor_response" "text",
    "vendor_response_date" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "customer_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "crm"."customer_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."customer_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "template_id" "uuid",
    "sub_template_id" "uuid",
    "search_filters" "jsonb",
    "search_location" "text",
    "results_count" integer,
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "crm"."customer_searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "email" "text",
    "phone" "text" NOT NULL,
    "address" "text",
    "city" "text",
    "state" "text",
    "pincode" "text",
    "registration_source" "text" DEFAULT 'website'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customers_registration_source_check" CHECK (("registration_source" = ANY (ARRAY['website'::"text", 'mobile'::"text", 'admin'::"text"])))
);


ALTER TABLE "crm"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."event_stories" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "title" "text",
    "description" "text",
    "location" "text",
    "event_type" "text",
    "budget_range" "text",
    "created_at" timestamp without time zone
);


ALTER TABLE "crm"."event_stories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."guest_lists" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "event_name" "text"
);


ALTER TABLE "crm"."guest_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."guests" (
    "id" "uuid" NOT NULL,
    "list_id" "uuid",
    "name" "text",
    "email" "text",
    "phone" "text",
    "rsvp_status" "text",
    "category" "text",
    "plus_one" boolean,
    "dietary_restrictions" "text",
    "special_requirements" "text",
    CONSTRAINT "guests_rsvp_status_check" CHECK (("rsvp_status" = ANY (ARRAY['pending'::"text", 'attending'::"text", 'not-attending'::"text"])))
);


ALTER TABLE "crm"."guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."lead_communications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid",
    "vendor_id" "uuid",
    "message" "text",
    "communication_type" "text" NOT NULL,
    "is_from_vendor" boolean DEFAULT true,
    "attachment_file_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_communications_communication_type_check" CHECK (("communication_type" = ANY (ARRAY['call'::"text", 'message'::"text", 'email'::"text", 'meeting'::"text", 'quote_sent'::"text"])))
);


ALTER TABLE "crm"."lead_communications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."seating_plans" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "event_name" "text"
);


ALTER TABLE "crm"."seating_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."seating_table_assignments" (
    "table_id" "uuid",
    "guest_id" "uuid"
);


ALTER TABLE "crm"."seating_table_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."seating_tables" (
    "id" "uuid" NOT NULL,
    "plan_id" "uuid",
    "shape" "text",
    "seat_count" integer,
    "position" "jsonb",
    "rotation" integer
);


ALTER TABLE "crm"."seating_tables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."vendor_comparisons" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "name" "text",
    "exported" boolean DEFAULT false,
    "created_at" timestamp without time zone
);


ALTER TABLE "crm"."vendor_comparisons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."vendor_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid",
    "lead_id" "uuid",
    "notification_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "action_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vendor_notifications_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['new_lead'::"text", 'lead_update'::"text", 'customer_message'::"text", 'system_alert'::"text"])))
);


ALTER TABLE "crm"."vendor_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."wishlist_items" (
    "wishlist_id" "uuid",
    "vendor_id" "uuid",
    "added_at" timestamp without time zone
);


ALTER TABLE "crm"."wishlist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "crm"."wishlists" (
    "id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "name" "text",
    "created_at" timestamp without time zone
);


ALTER TABLE "crm"."wishlists" OWNER TO "postgres";


ALTER TABLE ONLY "backoffice"."backoffice_users"
    ADD CONSTRAINT "backoffice_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "backoffice"."backoffice_users"
    ADD CONSTRAINT "backoffice_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "cms"."banner_ads"
    ADD CONSTRAINT "banner_ads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "cms"."file_storage"
    ADD CONSTRAINT "file_storage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "cms"."review_media"
    ADD CONSTRAINT "review_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "cms"."vendor_business_media"
    ADD CONSTRAINT "vendor_business_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "cms"."vendor_verification_documents"
    ADD CONSTRAINT "vendor_verification_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."business_specializations"
    ADD CONSTRAINT "business_specializations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."category_form_fields"
    ADD CONSTRAINT "category_form_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."document_types"
    ADD CONSTRAINT "document_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."document_types"
    ADD CONSTRAINT "document_types_type_code_key" UNIQUE ("type_code");



ALTER TABLE ONLY "core"."event_sub_templates"
    ADD CONSTRAINT "event_sub_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."event_sub_templates"
    ADD CONSTRAINT "event_sub_templates_template_id_slug_key" UNIQUE ("template_id", "slug");



ALTER TABLE ONLY "core"."event_templates"
    ADD CONSTRAINT "event_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."event_templates"
    ADD CONSTRAINT "event_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "core"."featured_placements"
    ADD CONSTRAINT "featured_placements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."template_category_mapping"
    ADD CONSTRAINT "template_category_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."trust_badges"
    ADD CONSTRAINT "trust_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."vendor_business_form_data"
    ADD CONSTRAINT "vendor_business_form_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."vendor_business_offers"
    ADD CONSTRAINT "vendor_business_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."vendor_business_pricing_packages"
    ADD CONSTRAINT "vendor_business_pricing_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."vendor_businesses"
    ADD CONSTRAINT "vendor_businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."vendor_otp"
    ADD CONSTRAINT "vendor_otp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "core"."vendors"
    ADD CONSTRAINT "vendors_email_key" UNIQUE ("email");



ALTER TABLE ONLY "core"."vendors"
    ADD CONSTRAINT "vendors_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "core"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."checklists"
    ADD CONSTRAINT "checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."customer_activity"
    ADD CONSTRAINT "customer_activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."customer_leads"
    ADD CONSTRAINT "customer_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."customer_reviews"
    ADD CONSTRAINT "customer_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."customer_searches"
    ADD CONSTRAINT "customer_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."customers"
    ADD CONSTRAINT "customers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "crm"."customers"
    ADD CONSTRAINT "customers_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "crm"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."event_stories"
    ADD CONSTRAINT "event_stories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."guest_lists"
    ADD CONSTRAINT "guest_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."lead_communications"
    ADD CONSTRAINT "lead_communications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."seating_plans"
    ADD CONSTRAINT "seating_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."seating_tables"
    ADD CONSTRAINT "seating_tables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."vendor_comparisons"
    ADD CONSTRAINT "vendor_comparisons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."vendor_notifications"
    ADD CONSTRAINT "vendor_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "crm"."wishlists"
    ADD CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_file_storage_hash" ON "cms"."file_storage" USING "btree" ("file_hash");



CREATE INDEX "idx_file_storage_uploader" ON "cms"."file_storage" USING "btree" ("uploaded_by_type", "uploaded_by_id");



CREATE INDEX "idx_categories_parent" ON "core"."categories" USING "btree" ("parent_category_id");



CREATE INDEX "idx_categories_slug" ON "core"."categories" USING "btree" ("slug");



CREATE INDEX "idx_vendor_businesses_location" ON "core"."vendor_businesses" USING "btree" ("city", "state");



CREATE INDEX "idx_vendor_businesses_vendor" ON "core"."vendor_businesses" USING "btree" ("vendor_id");



CREATE INDEX "idx_vendors_phone" ON "core"."vendors" USING "btree" ("phone");



CREATE INDEX "idx_customer_leads_business" ON "crm"."customer_leads" USING "btree" ("business_id");



CREATE INDEX "idx_customer_leads_created" ON "crm"."customer_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_customer_leads_status" ON "crm"."customer_leads" USING "btree" ("lead_status");



CREATE INDEX "idx_customer_leads_template" ON "crm"."customer_leads" USING "btree" ("template_id", "sub_template_id");



CREATE INDEX "idx_customer_leads_vendor" ON "crm"."customer_leads" USING "btree" ("vendor_id");



CREATE INDEX "idx_customer_reviews_business_status" ON "crm"."customer_reviews" USING "btree" ("business_id", "status");



CREATE INDEX "idx_customer_reviews_vendor_status" ON "crm"."customer_reviews" USING "btree" ("vendor_id", "status");



CREATE INDEX "idx_vendor_notifications_vendor_read" ON "crm"."vendor_notifications" USING "btree" ("vendor_id", "is_read");



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "backoffice"."backoffice_users" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "cms"."banner_ads" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "cms"."file_storage" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "cms"."review_media" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."business_specializations" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."categories" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."category_form_fields" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."document_types" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."event_sub_templates" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."event_templates" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."template_category_mapping" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."trust_badges" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."vendor_businesses" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."vendor_otp" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "core"."vendors" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_set_category_level" BEFORE INSERT OR UPDATE OF "parent_category_id" ON "core"."categories" FOR EACH ROW EXECUTE FUNCTION "core"."set_category_level"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "crm"."customer_leads" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "crm"."customer_reviews" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "crm"."customer_searches" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "crm"."customers" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "crm"."lead_communications" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "crm"."vendor_notifications" FOR EACH ROW EXECUTE FUNCTION "core"."trigger_set_timestamp"();



ALTER TABLE ONLY "cms"."banner_ads"
    ADD CONSTRAINT "banner_ads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id");



ALTER TABLE ONLY "cms"."banner_ads"
    ADD CONSTRAINT "banner_ads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "core"."categories"("id");



ALTER TABLE ONLY "cms"."banner_ads"
    ADD CONSTRAINT "banner_ads_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "cms"."file_storage"("id");



ALTER TABLE ONLY "cms"."banner_ads"
    ADD CONSTRAINT "banner_ads_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id");



ALTER TABLE ONLY "cms"."review_media"
    ADD CONSTRAINT "review_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "cms"."file_storage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "cms"."review_media"
    ADD CONSTRAINT "review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "crm"."customer_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "cms"."vendor_business_media"
    ADD CONSTRAINT "vendor_business_media_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "cms"."vendor_business_media"
    ADD CONSTRAINT "vendor_business_media_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "cms"."file_storage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "cms"."vendor_verification_documents"
    ADD CONSTRAINT "vendor_verification_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "core"."document_types"("id");



ALTER TABLE ONLY "cms"."vendor_verification_documents"
    ADD CONSTRAINT "vendor_verification_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "cms"."file_storage"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "cms"."vendor_verification_documents"
    ADD CONSTRAINT "vendor_verification_documents_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "cms"."vendor_verification_documents"
    ADD CONSTRAINT "vendor_verification_documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "backoffice"."backoffice_users"("id");



ALTER TABLE ONLY "core"."business_specializations"
    ADD CONSTRAINT "business_specializations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."categories"
    ADD CONSTRAINT "categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "core"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."category_form_fields"
    ADD CONSTRAINT "category_form_fields_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "core"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."event_sub_templates"
    ADD CONSTRAINT "event_sub_templates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "core"."event_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."event_templates"
    ADD CONSTRAINT "event_templates_banner_image_file_id_fkey" FOREIGN KEY ("banner_image_file_id") REFERENCES "cms"."file_storage"("id");



ALTER TABLE ONLY "core"."event_templates"
    ADD CONSTRAINT "event_templates_icon_file_id_fkey" FOREIGN KEY ("icon_file_id") REFERENCES "cms"."file_storage"("id");



ALTER TABLE ONLY "core"."featured_placements"
    ADD CONSTRAINT "featured_placements_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."template_category_mapping"
    ADD CONSTRAINT "template_category_mapping_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "core"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."template_category_mapping"
    ADD CONSTRAINT "template_category_mapping_sub_template_id_fkey" FOREIGN KEY ("sub_template_id") REFERENCES "core"."event_sub_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."template_category_mapping"
    ADD CONSTRAINT "template_category_mapping_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "core"."event_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."trust_badges"
    ADD CONSTRAINT "trust_badges_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."vendor_business_form_data"
    ADD CONSTRAINT "vendor_business_form_data_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."vendor_business_offers"
    ADD CONSTRAINT "vendor_business_offers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."vendor_business_pricing_packages"
    ADD CONSTRAINT "vendor_business_pricing_packages_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."vendor_businesses"
    ADD CONSTRAINT "vendor_businesses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."vendor_otp"
    ADD CONSTRAINT "vendor_otp_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "core"."vendors"
    ADD CONSTRAINT "vendors_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "cms"."file_storage"("id");



ALTER TABLE ONLY "crm"."blog_posts"
    ADD CONSTRAINT "blog_posts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."checklist_items"
    ADD CONSTRAINT "checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "crm"."checklists"("id");



ALTER TABLE ONLY "crm"."checklists"
    ADD CONSTRAINT "checklists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."customer_activity"
    ADD CONSTRAINT "customer_activity_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."customer_leads"
    ADD CONSTRAINT "customer_leads_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id");



ALTER TABLE ONLY "crm"."customer_leads"
    ADD CONSTRAINT "customer_leads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "core"."categories"("id");



ALTER TABLE ONLY "crm"."customer_leads"
    ADD CONSTRAINT "customer_leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."customer_leads"
    ADD CONSTRAINT "customer_leads_sub_template_id_fkey" FOREIGN KEY ("sub_template_id") REFERENCES "core"."event_sub_templates"("id");



ALTER TABLE ONLY "crm"."customer_leads"
    ADD CONSTRAINT "customer_leads_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "core"."event_templates"("id");



ALTER TABLE ONLY "crm"."customer_leads"
    ADD CONSTRAINT "customer_leads_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id");



ALTER TABLE ONLY "crm"."customer_reviews"
    ADD CONSTRAINT "customer_reviews_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "core"."vendor_businesses"("id");



ALTER TABLE ONLY "crm"."customer_reviews"
    ADD CONSTRAINT "customer_reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."customer_reviews"
    ADD CONSTRAINT "customer_reviews_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm"."customer_leads"("id");



ALTER TABLE ONLY "crm"."customer_reviews"
    ADD CONSTRAINT "customer_reviews_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id");



ALTER TABLE ONLY "crm"."customer_searches"
    ADD CONSTRAINT "customer_searches_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."customer_searches"
    ADD CONSTRAINT "customer_searches_sub_template_id_fkey" FOREIGN KEY ("sub_template_id") REFERENCES "core"."event_sub_templates"("id");



ALTER TABLE ONLY "crm"."customer_searches"
    ADD CONSTRAINT "customer_searches_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "core"."event_templates"("id");



ALTER TABLE ONLY "crm"."event_stories"
    ADD CONSTRAINT "event_stories_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."guest_lists"
    ADD CONSTRAINT "guest_lists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."guests"
    ADD CONSTRAINT "guests_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "crm"."guest_lists"("id");



ALTER TABLE ONLY "crm"."lead_communications"
    ADD CONSTRAINT "lead_communications_attachment_file_id_fkey" FOREIGN KEY ("attachment_file_id") REFERENCES "cms"."file_storage"("id");



ALTER TABLE ONLY "crm"."lead_communications"
    ADD CONSTRAINT "lead_communications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm"."customer_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."lead_communications"
    ADD CONSTRAINT "lead_communications_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id");



ALTER TABLE ONLY "crm"."seating_plans"
    ADD CONSTRAINT "seating_plans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."seating_table_assignments"
    ADD CONSTRAINT "seating_table_assignments_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "crm"."guests"("id");



ALTER TABLE ONLY "crm"."seating_table_assignments"
    ADD CONSTRAINT "seating_table_assignments_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "crm"."seating_tables"("id");



ALTER TABLE ONLY "crm"."seating_tables"
    ADD CONSTRAINT "seating_tables_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "crm"."seating_plans"("id");



ALTER TABLE ONLY "crm"."vendor_comparisons"
    ADD CONSTRAINT "vendor_comparisons_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



ALTER TABLE ONLY "crm"."vendor_notifications"
    ADD CONSTRAINT "vendor_notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm"."customer_leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."vendor_notifications"
    ADD CONSTRAINT "vendor_notifications_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "core"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "crm"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "crm"."wishlists"("id");



ALTER TABLE ONLY "crm"."wishlists"
    ADD CONSTRAINT "wishlists_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "crm"."customers"("id");



CREATE POLICY "Admin users can view all admin users" ON "backoffice"."backoffice_users" FOR SELECT USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Super admin can manage all admin users" ON "backoffice"."backoffice_users" USING (("auth"."role"() = 'admin'::"text"));



ALTER TABLE "backoffice"."backoffice_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins can manage banner ads" ON "cms"."banner_ads" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Anyone can view active banner ads" ON "cms"."banner_ads" FOR SELECT USING ((("active" = true) AND ((CURRENT_DATE >= "start_date") AND (CURRENT_DATE <= "end_date"))));



CREATE POLICY "Manage images through business ownership" ON "cms"."vendor_business_media" USING ((("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE (("vendor_businesses"."vendor_id")::"text" = ("auth"."uid"())::"text"))) OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Manage review images through review ownership" ON "cms"."review_media" USING ((("review_id" IN ( SELECT "customer_reviews"."id"
   FROM "crm"."customer_reviews"
  WHERE ((("customer_reviews"."customer_id")::"text" = ("auth"."uid"())::"text") OR ("customer_reviews"."status" = 'approved'::"text")))) OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Public can view business images" ON "cms"."vendor_business_media" FOR SELECT USING (("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE ("vendor_businesses"."status" = 'approved'::"text"))));



CREATE POLICY "Users can upload files" ON "cms"."file_storage" FOR INSERT WITH CHECK (((("uploaded_by_type" = 'vendor'::"text") AND (("uploaded_by_id")::"text" = ("auth"."uid"())::"text")) OR (("uploaded_by_type" = 'admin'::"text") AND ("auth"."role"() = 'admin'::"text"))));



CREATE POLICY "Users can view their own files" ON "cms"."file_storage" FOR SELECT USING (((("uploaded_by_type" = 'vendor'::"text") AND (("uploaded_by_id")::"text" = ("auth"."uid"())::"text")) OR (("uploaded_by_type" = 'admin'::"text") AND ("auth"."role"() = 'admin'::"text"))));



CREATE POLICY "Vendors can manage their verification documents" ON "cms"."vendor_verification_documents" USING (((("vendor_id")::"text" = ("auth"."uid"())::"text") OR ("auth"."role"() = 'admin'::"text")));



ALTER TABLE "cms"."banner_ads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "cms"."file_storage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "cms"."review_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "cms"."vendor_business_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "cms"."vendor_verification_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admin can manage all categories" ON "core"."categories" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Admins can manage all businesses" ON "core"."vendor_businesses" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Admins can manage all vendors" ON "core"."vendors" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Admins can manage form fields" ON "core"."category_form_fields" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Admins can manage sub-templates" ON "core"."event_sub_templates" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Admins can manage template mappings" ON "core"."template_category_mapping" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Admins can manage templates" ON "core"."event_templates" USING (("auth"."role"() = 'admin'::"text"));



CREATE POLICY "Anyone can view active sub-templates" ON "core"."event_sub_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active templates" ON "core"."event_templates" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view active trust badges" ON "core"."trust_badges" FOR SELECT USING (("badge_status" = 'active'::"text"));



CREATE POLICY "Anyone can view document types" ON "core"."document_types" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view form fields" ON "core"."category_form_fields" FOR SELECT USING (true);



CREATE POLICY "Anyone can view template mappings" ON "core"."template_category_mapping" FOR SELECT USING (true);



CREATE POLICY "Manage business offers through business ownership" ON "core"."vendor_business_offers" USING ((("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE (("vendor_businesses"."vendor_id")::"text" = ("auth"."uid"())::"text"))) OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Manage form data through business ownership" ON "core"."vendor_business_form_data" USING ((("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE (("vendor_businesses"."vendor_id")::"text" = ("auth"."uid"())::"text"))) OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Manage pricing packages through business ownership" ON "core"."vendor_business_pricing_packages" USING ((("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE (("vendor_businesses"."vendor_id")::"text" = ("auth"."uid"())::"text"))) OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Manage specializations through business ownership" ON "core"."business_specializations" USING ((("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE (("vendor_businesses"."vendor_id")::"text" = ("auth"."uid"())::"text"))) OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Public can view active pricing packages" ON "core"."vendor_business_pricing_packages" FOR SELECT USING ((("is_active" = true) AND ("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE ("vendor_businesses"."status" = 'approved'::"text")))));



CREATE POLICY "Public can view approved businesses" ON "core"."vendor_businesses" FOR SELECT USING ((("status" = 'approved'::"text") AND ("verified" = true)));



CREATE POLICY "Public can view business offers" ON "core"."vendor_business_offers" FOR SELECT USING (("business_id" IN ( SELECT "vendor_businesses"."id"
   FROM "core"."vendor_businesses"
  WHERE ("vendor_businesses"."status" = 'active'::"text"))));



CREATE POLICY "Read business categories" ON "core"."categories" FOR SELECT USING (("category_type" = 'business'::"core"."category_type_enum"));



CREATE POLICY "Read event categories" ON "core"."categories" FOR SELECT USING (("category_type" = 'event'::"core"."category_type_enum"));



CREATE POLICY "Vendors can access their own OTP" ON "core"."vendor_otp" USING ((("vendor_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Vendors can update their own data" ON "core"."vendor_businesses" FOR UPDATE USING ((("vendor_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Vendors can update their own data" ON "core"."vendors" FOR UPDATE USING ((("id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Vendors can view their own data" ON "core"."vendor_businesses" FOR SELECT USING (((("vendor_id")::"text" = ("auth"."uid"())::"text") OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Vendors can view their own data" ON "core"."vendors" FOR SELECT USING (((("id")::"text" = ("auth"."uid"())::"text") OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Vendors can view their trust badges" ON "core"."trust_badges" FOR SELECT USING ((("vendor_id")::"text" = ("auth"."uid"())::"text"));



ALTER TABLE "core"."business_specializations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."category_form_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."document_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."event_sub_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."event_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."template_category_mapping" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."trust_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."vendor_business_form_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."vendor_business_offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."vendor_business_pricing_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."vendor_businesses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."vendor_otp" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "core"."vendors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Anyone can view approved reviews" ON "crm"."customer_reviews" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Customers can manage their reviews" ON "crm"."customer_reviews" USING ((("customer_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Customers can update their own data" ON "crm"."customers" FOR UPDATE USING ((("id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Customers can view their own data" ON "crm"."customers" FOR SELECT USING (((("id")::"text" = ("auth"."uid"())::"text") OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Customers can view their search history" ON "crm"."customer_searches" FOR SELECT USING (((("customer_id")::"text" = ("auth"."uid"())::"text") OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Manage communications through lead ownership" ON "crm"."lead_communications" USING ((("lead_id" IN ( SELECT "customer_leads"."id"
   FROM "crm"."customer_leads"
  WHERE (("customer_leads"."vendor_id")::"text" = ("auth"."uid"())::"text"))) OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Vendors can manage their notifications" ON "crm"."vendor_notifications" USING (((("vendor_id")::"text" = ("auth"."uid"())::"text") OR ("auth"."role"() = 'admin'::"text")));



CREATE POLICY "Vendors can respond to their reviews" ON "crm"."customer_reviews" FOR UPDATE USING ((("vendor_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Vendors can update their leads" ON "crm"."customer_leads" FOR UPDATE USING ((("vendor_id")::"text" = ("auth"."uid"())::"text"));



CREATE POLICY "Vendors can view their leads" ON "crm"."customer_leads" FOR SELECT USING (((("vendor_id")::"text" = ("auth"."uid"())::"text") OR ("auth"."role"() = 'admin'::"text")));



ALTER TABLE "crm"."customer_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."customer_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."customer_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."lead_communications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "crm"."vendor_notifications" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


