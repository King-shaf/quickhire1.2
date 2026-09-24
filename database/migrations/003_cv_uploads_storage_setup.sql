-- =============================================================================
-- QuickHire: Dynamic Policy Purge & Non-Recursive RLS Migration
-- Run this script in your Supabase SQL Editor to wipe old recursive policies
-- and set fresh, working policies across storage and database tables.
-- =============================================================================

-- 1. Dynamically DROP ALL existing policies on relevant tables (wipes recursive policies)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename, schemaname
        FROM pg_policies
        WHERE schemaname IN ('public', 'storage')
          AND tablename IN ('users', 'candidates', 'companies', 'job_descriptions', 'upload_batches', 'objects')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- 2. Create 'cv-uploads' storage bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cv-uploads',
  'cv-uploads',
  true,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

-- 3. Storage Objects Policies for 'cv-uploads'
CREATE POLICY "Public read access for cv-uploads" ON storage.objects FOR SELECT USING (bucket_id = 'cv-uploads');
CREATE POLICY "Public insert access for cv-uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cv-uploads');
CREATE POLICY "Public update access for cv-uploads" ON storage.objects FOR UPDATE USING (bucket_id = 'cv-uploads');
CREATE POLICY "Public delete access for cv-uploads" ON storage.objects FOR DELETE USING (bucket_id = 'cv-uploads');

-- 4. USERS TABLE - Fresh non-recursive policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON public.users FOR SELECT USING (true);
CREATE POLICY users_insert ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY users_update ON public.users FOR UPDATE USING (true);
CREATE POLICY users_delete ON public.users FOR DELETE USING (true);

-- 5. CANDIDATES TABLE - Fresh non-recursive policies
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidates_select ON public.candidates FOR SELECT USING (true);
CREATE POLICY candidates_insert ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY candidates_update ON public.candidates FOR UPDATE USING (true);
CREATE POLICY candidates_delete ON public.candidates FOR DELETE USING (true);

-- 6. COMPANIES TABLE
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_select ON public.companies FOR SELECT USING (true);
CREATE POLICY companies_insert ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY companies_update ON public.companies FOR UPDATE USING (true);

-- 7. JOB DESCRIPTIONS TABLE
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY job_descriptions_select ON public.job_descriptions FOR SELECT USING (true);
CREATE POLICY job_descriptions_insert ON public.job_descriptions FOR INSERT WITH CHECK (true);
CREATE POLICY job_descriptions_update ON public.job_descriptions FOR UPDATE USING (true);

-- 8. UPLOAD BATCHES TABLE
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY upload_batches_select ON public.upload_batches FOR SELECT USING (true);
CREATE POLICY upload_batches_insert ON public.upload_batches FOR INSERT WITH CHECK (true);
CREATE POLICY upload_batches_update ON public.upload_batches FOR UPDATE USING (true);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
