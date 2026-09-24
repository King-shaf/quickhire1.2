-- =============================================================================
-- Migration 007: SA CIPC Company Registration, SA ID Number (13 digits), 
--                Date of Birth, Simple Company ID, and User/Company Sync
-- =============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Update Companies Table
-- Add registration_number (CIPC 14-digit format: YYYY/NNNNNN/NN)
-- Add company_code (Simple auto-generated company ID: CMP-XXXXXX)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS registration_number TEXT UNIQUE;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_companies_registration_number
  ON public.companies (LOWER(registration_number));

CREATE INDEX IF NOT EXISTS idx_companies_company_code
  ON public.companies (LOWER(company_code));

-- 3. Update Users Table
-- Ensure all columns required are present:
-- first_name, last_name, company_id, company_name, id_number (13 digits), 
-- employee_id, date_of_birth
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_name TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS id_number TEXT UNIQUE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_id TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_id_number
  ON public.users (LOWER(id_number));

CREATE INDEX IF NOT EXISTS idx_users_employee_id
  ON public.users (LOWER(employee_id));

CREATE INDEX IF NOT EXISTS idx_users_company_id
  ON public.users (company_id);

-- 4. Update handle_new_user() trigger to automatically migrate/sync all metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        username,
        role,
        is_active,
        first_name,
        last_name,
        company_name,
        id_number,
        employee_id,
        date_of_birth,
        company_id
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'username',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'role',
            'recruiter'
        ),
        TRUE,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'id_number',
        NEW.raw_user_meta_data->>'employee_id',
        CASE
            WHEN NEW.raw_user_meta_data->>'date_of_birth' IS NOT NULL AND NEW.raw_user_meta_data->>'date_of_birth' != ''
            THEN (NEW.raw_user_meta_data->>'date_of_birth')::DATE
            ELSE NULL
        END,
        CASE
            WHEN NEW.raw_user_meta_data->>'company_id' IS NOT NULL AND NEW.raw_user_meta_data->>'company_id' != ''
            THEN (NEW.raw_user_meta_data->>'company_id')::UUID
            ELSE NULL
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.users.username),
        first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
        company_name = COALESCE(EXCLUDED.company_name, public.users.company_name),
        role = COALESCE(EXCLUDED.role, public.users.role),
        id_number = COALESCE(EXCLUDED.id_number, public.users.id_number),
        employee_id = COALESCE(EXCLUDED.employee_id, public.users.employee_id),
        date_of_birth = COALESCE(EXCLUDED.date_of_birth, public.users.date_of_birth),
        company_id = COALESCE(EXCLUDED.company_id, public.users.company_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Notify PostgREST to immediately refresh schema cache
NOTIFY pgrst, 'reload schema';
