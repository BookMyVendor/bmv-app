-- Create a view in the public schema for core.vendors
CREATE OR REPLACE VIEW public.vendors AS
SELECT * FROM core.vendors;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO anon;

-- Grant USAGE on core schema
GRANT USAGE ON SCHEMA core TO authenticated;
GRANT USAGE ON SCHEMA core TO anon;

-- Grant permissions on underlying table
GRANT SELECT, INSERT, UPDATE, DELETE ON core.vendors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.vendors TO anon;

-- INSTEAD OF INSERT trigger for public.vendors
CREATE OR REPLACE FUNCTION public.vendors_insert()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, core
AS $$
BEGIN
  INSERT INTO core.vendors (
    id, 
    first_name, 
    last_name, 
    email, 
    phone, 
    image_file_id, 
    last_login, 
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.first_name, ''),
    COALESCE(NEW.last_name, ''),
    COALESCE(NEW.email, ''),
    NEW.phone,
    NEW.image_file_id,
    NEW.last_login,
    COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS vendors_insert_trigger ON public.vendors;
CREATE TRIGGER vendors_insert_trigger
INSTEAD OF INSERT ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.vendors_insert();

-- INSTEAD OF UPDATE trigger for public.vendors
CREATE OR REPLACE FUNCTION public.vendors_update()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, core
AS $$
BEGIN
  UPDATE core.vendors
  SET
    first_name = NEW.first_name,
    last_name = NEW.last_name,
    email = NEW.email,
    phone = NEW.phone,
    image_file_id = NEW.image_file_id,
    last_login = NEW.last_login,
    updated_at = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendors_update_trigger ON public.vendors;
CREATE TRIGGER vendors_update_trigger
INSTEAD OF UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.vendors_update();

-- INSTEAD OF DELETE trigger for public.vendors
CREATE OR REPLACE FUNCTION public.vendors_delete()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, core
AS $$
BEGIN
  DELETE FROM core.vendors WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendors_delete_trigger ON public.vendors;
CREATE TRIGGER vendors_delete_trigger
INSTEAD OF DELETE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.vendors_delete();

-- Add comment explaining the view
COMMENT ON VIEW public.vendors IS 'View that provides access to core.vendors table from the public schema. Supports INSERT, UPDATE, DELETE operations via INSTEAD OF triggers.';

