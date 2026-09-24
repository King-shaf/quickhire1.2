-- =============================================================================
-- Migration 006: Company Code, Recruiter ID Number, and Employee ID
-- =============================================================================

-- 1. Add company_code to companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS company_code TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_companies_company_code
  ON public.companies (LOWER(company_code));

-- 2. Add id_number and employee_id to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS id_number TEXT UNIQUE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_id TEXT;

CREATE INDEX IF NOT EXISTS idx_users_id_number
  ON public.users (LOWER(id_number));

CREATE INDEX IF NOT EXISTS idx_users_employee_id
  ON public.users (LOWER(employee_id));

-- 3. Notify postgrest to refresh schema cache
NOTIFY pgrst, 'reload schema';
