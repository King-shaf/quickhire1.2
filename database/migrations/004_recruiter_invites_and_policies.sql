-- =============================================================================
-- Migration 004: Recruiter Invites, Candidate/Job Deletion, and Batch Policies
-- =============================================================================

-- 1. Create recruiter_invites table
CREATE TABLE IF NOT EXISTS public.recruiter_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.recruiter_invites ENABLE ROW LEVEL SECURITY;

-- Allow company members to view their invites
DROP POLICY IF EXISTS recruiter_invites_select ON public.recruiter_invites;
CREATE POLICY recruiter_invites_select ON public.recruiter_invites
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Allow company admins/members to insert invites
DROP POLICY IF EXISTS recruiter_invites_insert ON public.recruiter_invites;
CREATE POLICY recruiter_invites_insert ON public.recruiter_invites
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Allow company members/admins to update invites (e.g. revoke)
DROP POLICY IF EXISTS recruiter_invites_update ON public.recruiter_invites;
CREATE POLICY recruiter_invites_update ON public.recruiter_invites
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM public.users WHERE id = auth.uid()
        )
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- 2. Candidates & Jobs Delete RLS Policies (allow owner or admin to delete)
DROP POLICY IF EXISTS candidates_delete ON public.candidates;
CREATE POLICY candidates_delete ON public.candidates
    FOR DELETE USING (
        user_id = auth.uid()
        OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS job_descriptions_delete ON public.job_descriptions;
CREATE POLICY job_descriptions_delete ON public.job_descriptions
    FOR DELETE USING (
        created_by = auth.uid()
        OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- 3. Function to accept recruiter invitation
CREATE OR REPLACE FUNCTION public.accept_recruiter_invite(token_input TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invite_rec RECORD;
    curr_user_id UUID;
    comp_id UUID;
BEGIN
    curr_user_id := auth.uid();
    IF curr_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be logged in to accept an invitation.';
    END IF;

    -- Find the active invite
    SELECT * INTO invite_rec
    FROM public.recruiter_invites
    WHERE token = token_input
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid, expired, or already accepted invitation token.';
    END IF;

    comp_id := invite_rec.company_id;

    -- Update the recruiter's user profile with the company_id
    UPDATE public.users
    SET company_id = comp_id,
        role = 'recruiter'
    WHERE id = curr_user_id;

    -- Update invite status
    UPDATE public.recruiter_invites
    SET status = 'accepted'
    WHERE id = invite_rec.id;

    RETURN jsonb_build_object(
        'success', true,
        'company_id', comp_id,
        'message', 'Invitation accepted! You are now linked to the company.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_recruiter_invite(TEXT) TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
