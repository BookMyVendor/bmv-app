-- Grant USAGE on schemas to PostgREST roles
GRANT USAGE ON SCHEMA cms TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA core TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA crm TO anon, authenticated, service_role;

-- Grant permissions on all tables in cms schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cms TO anon, authenticated, service_role;

-- Grant permissions on all tables in core schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO anon, authenticated, service_role;

-- Grant permissions on all tables in crm schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA crm TO anon, authenticated, service_role;

-- Grant permissions on all sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cms TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA crm TO anon, authenticated, service_role;

-- Grant permissions on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cms TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA core TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA crm TO anon, authenticated, service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA cms GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA crm GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;

