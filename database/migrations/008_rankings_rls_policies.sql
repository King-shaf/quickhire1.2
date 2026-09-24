-- =============================================================================
-- Migration 008: Rankings Table Row Level Security (RLS) Policies
-- =============================================================================
-- Fix: Enables INSERT, UPDATE, and DELETE policies on public.rankings.
-- Previously only rankings_select existed, which caused PostgreSQL 42501 (RLS violation)
-- when attempting to persist candidate ranking results into the database.

-- 1. Ensure RLS is active on rankings
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- 2. Select policy (allow users to read rankings for jobs they or their company can view)
DROP POLICY IF EXISTS rankings_select ON public.rankings;
CREATE POLICY rankings_select ON public.rankings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.job_descriptions
            WHERE job_descriptions.id = rankings.job_id
            AND (
                job_descriptions.created_by = auth.uid()
                OR job_descriptions.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
                OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
            )
        )
        OR auth.uid() IS NULL
    );

-- 3. Insert policy (allow inserting scores for jobs belonging to recruiter/company or dev anon)
DROP POLICY IF EXISTS rankings_insert ON public.rankings;
CREATE POLICY rankings_insert ON public.rankings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.job_descriptions
            WHERE job_descriptions.id = rankings.job_id
            AND (
                job_descriptions.created_by = auth.uid()
                OR job_descriptions.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
                OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
            )
        )
        OR auth.uid() IS NULL
    );

-- 4. Update policy (allow updating scores when recalculating)
DROP POLICY IF EXISTS rankings_update ON public.rankings;
CREATE POLICY rankings_update ON public.rankings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.job_descriptions
            WHERE job_descriptions.id = rankings.job_id
            AND (
                job_descriptions.created_by = auth.uid()
                OR job_descriptions.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
                OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
            )
        )
        OR auth.uid() IS NULL
    );

-- 5. Delete policy (allow removing rankings when candidates/jobs are unassigned)
DROP POLICY IF EXISTS rankings_delete ON public.rankings;
CREATE POLICY rankings_delete ON public.rankings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.job_descriptions
            WHERE job_descriptions.id = rankings.job_id
            AND (
                job_descriptions.created_by = auth.uid()
                OR job_descriptions.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
                OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
            )
        )
        OR auth.uid() IS NULL
    );
