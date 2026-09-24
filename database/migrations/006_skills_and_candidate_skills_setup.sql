-- =============================================================================
-- Migration 006: Skills & Candidate Skills Policies and Seed
-- Run this in the Supabase Dashboard -> SQL Editor
-- =============================================================================

-- 1. Ensure skills table exists
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'technical',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Ensure candidate_skills table exists
CREATE TABLE IF NOT EXISTS public.candidate_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_candidate_skill UNIQUE (candidate_id, skill_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_skills_name ON public.skills(name);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_candidate ON public.candidate_skills(candidate_id);
CREATE INDEX IF NOT EXISTS idx_candidate_skills_skill ON public.candidate_skills(skill_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for skills table
DROP POLICY IF EXISTS skills_select ON public.skills;
CREATE POLICY skills_select ON public.skills
    FOR SELECT USING (true);

DROP POLICY IF EXISTS skills_insert ON public.skills;
CREATE POLICY skills_insert ON public.skills
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS skills_update ON public.skills;
CREATE POLICY skills_update ON public.skills
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS skills_delete ON public.skills;
CREATE POLICY skills_delete ON public.skills
    FOR DELETE USING (true);

-- 6. RLS Policies for candidate_skills table
DROP POLICY IF EXISTS candidate_skills_select ON public.candidate_skills;
CREATE POLICY candidate_skills_select ON public.candidate_skills
    FOR SELECT USING (true);

DROP POLICY IF EXISTS candidate_skills_insert ON public.candidate_skills;
CREATE POLICY candidate_skills_insert ON public.candidate_skills
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS candidate_skills_update ON public.candidate_skills;
CREATE POLICY candidate_skills_update ON public.candidate_skills
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS candidate_skills_delete ON public.candidate_skills;
CREATE POLICY candidate_skills_delete ON public.candidate_skills
    FOR DELETE USING (true);

-- 7. Seed Initial Core Skills
INSERT INTO public.skills (name, category) VALUES
    ('Python', 'technical'),
    ('Java', 'technical'),
    ('JavaScript', 'technical'),
    ('TypeScript', 'technical'),
    ('React', 'technical'),
    ('Node.js', 'technical'),
    ('Django', 'technical'),
    ('C++', 'technical'),
    ('C#', 'technical'),
    ('SQL', 'technical'),
    ('PostgreSQL', 'technical'),
    ('MongoDB', 'technical'),
    ('Machine Learning', 'technical'),
    ('Data Analysis', 'technical'),
    ('Docker', 'technical'),
    ('Kubernetes', 'technical'),
    ('AWS', 'technical'),
    ('Azure', 'technical'),
    ('Git/GitHub', 'technical'),
    ('REST APIs', 'technical'),
    ('Hardware Installation', 'technical'),
    ('Software Installation', 'technical'),
    ('Video Editing', 'technical'),
    ('Audio Editing', 'technical'),
    ('Audio Recording', 'technical'),
    ('Social Media Management', 'technical'),
    ('Sound & Lighting Management', 'technical'),
    ('Projector & Camera Operation', 'technical'),
    ('Sales Development', 'technical'),
    ('Organising & Planning Skills', 'technical'),
    ('Leadership', 'soft'),
    ('Communication Skills', 'soft'),
    ('Interpersonal Skills', 'soft'),
    ('Teamwork', 'soft'),
    ('Team Management', 'soft'),
    ('Team Leadership', 'soft'),
    ('Problem Solving', 'soft'),
    ('Critical Thinking', 'soft'),
    ('Dedicated', 'soft'),
    ('Diligent', 'soft'),
    ('Commitment to Excellence', 'soft'),
    ('Hard worker and responsible', 'soft'),
    ('Honest and Reliable', 'soft')
ON CONFLICT (name) DO NOTHING;

-- 8. Auto-link candidate skills from candidate structured_data JSONB
INSERT INTO public.candidate_skills (candidate_id, skill_id)
SELECT DISTINCT c.id AS candidate_id, s.id AS skill_id
FROM public.candidates c
CROSS JOIN LATERAL (
    SELECT jsonb_array_elements_text(COALESCE(c.structured_data->'skills'->'technical', '[]'::jsonb)) AS skill_name
    UNION
    SELECT jsonb_array_elements_text(COALESCE(c.structured_data->'skills'->'soft', '[]'::jsonb)) AS skill_name
    UNION
    SELECT jsonb_array_elements_text(COALESCE(c.structured_data->'all_skills', '[]'::jsonb)) AS skill_name
) extracted
JOIN public.skills s ON lower(trim(s.name)) = lower(trim(extracted.skill_name))
ON CONFLICT (candidate_id, skill_id) DO NOTHING;

-- 9. Refresh schema cache
NOTIFY pgrst, 'reload schema';
