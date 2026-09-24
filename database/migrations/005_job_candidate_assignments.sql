-- =============================================================================
-- Migration 005: Job Candidate Assignments Table and Policies
-- =============================================================================

-- 1. Create job_candidate_assignments table
CREATE TABLE IF NOT EXISTS public.job_candidate_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'under_review', 'shortlisted', 'interview_scheduled', 'offer_extended', 'hired', 'rejected')),
    notes TEXT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_job_candidate_assignment UNIQUE (job_id, candidate_id)
);

-- 2. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_cand_assign_job_status ON public.job_candidate_assignments(job_id, status);
CREATE INDEX IF NOT EXISTS idx_job_cand_assign_candidate ON public.job_candidate_assignments(candidate_id);
CREATE INDEX IF NOT EXISTS idx_job_cand_assign_company ON public.job_candidate_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_job_cand_assign_date ON public.job_candidate_assignments(assigned_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.job_candidate_assignments ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS job_assignments_select ON public.job_candidate_assignments;
CREATE POLICY job_assignments_select ON public.job_candidate_assignments
    FOR SELECT USING (
        company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR assigned_by = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        OR auth.uid() IS NULL -- allow public anon fallback if anon key used in dev
    );

DROP POLICY IF EXISTS job_assignments_insert ON public.job_candidate_assignments;
CREATE POLICY job_assignments_insert ON public.job_candidate_assignments
    FOR INSERT WITH CHECK (
        company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR assigned_by = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        OR auth.uid() IS NULL
    );

DROP POLICY IF EXISTS job_assignments_update ON public.job_candidate_assignments;
CREATE POLICY job_assignments_update ON public.job_candidate_assignments
    FOR UPDATE USING (
        company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR assigned_by = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        OR auth.uid() IS NULL
    );

DROP POLICY IF EXISTS job_assignments_delete ON public.job_candidate_assignments;
CREATE POLICY job_assignments_delete ON public.job_candidate_assignments
    FOR DELETE USING (
        company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR assigned_by = auth.uid()
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        OR auth.uid() IS NULL
    );
