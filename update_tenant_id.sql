CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(
        NULLIF(current_setting('request.headers', true)::json->>'x-tenant-id', ''),
        NULLIF(current_setting('app.tenant_id', true), '')
    )::UUID;
$$;
