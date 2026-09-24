-- =============================================================================
-- QuickHire: Consolidated Schema Fix + Schema Cache Refresh
-- Run this ENTIRE script in Supabase SQL Editor to fix the schema cache error.
-- This script is idempotent (safe to run multiple times).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. NOTIFY PostgREST to reload schema cache (fixes "column not in schema cache")
--    Run this first AND last to guarantee cache refresh.
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
SELECT pg_sleep(0.5);

-- =============================================================================
-- 1. Ensure required extensions exist
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- 2. Companies (multi-tenancy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    size TEXT,
    industry TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. Users (links to Supabase Auth) — ensure company_id + all columns exist
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    username TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'recruiter',
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    failed_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3a. Add missing columns individually (in case table already existed)
DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'recruiter';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3b. Fix role CHECK constraint to include 'company' role
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('recruiter', 'admin', 'company'));

-- =============================================================================
-- 4. FIXED handle_new_user trigger — now supports company_id + full metadata
-- =============================================================================
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
        CASE
            WHEN NEW.raw_user_meta_data->>'company_id' IS NOT NULL
            THEN (NEW.raw_user_meta_data->>'company_id')::UUID
            ELSE NULL
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.users.username),
        first_name = COALESCE(EXCLUDED.first_name, public.users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, public.users.last_name),
        role = COALESCE(EXCLUDED.role, public.users.role),
        company_id = COALESCE(EXCLUDED.company_id, public.users.company_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Re-)create trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 5. Candidates (with full AI/OCR fields + batch_id)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    raw_text TEXT,
    structured_data JSONB,
    embedding VECTOR(384),
    ocr_confidence FLOAT,
    source_file VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5a. Add missing columns
DO $$
BEGIN
    ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS batch_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- =============================================================================
-- 6. Skills (master list)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('technical', 'soft', 'domain')),
    aliases JSONB,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- 7. Candidate-Skills (many-to-many)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.candidate_skills (
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE,
    PRIMARY KEY (candidate_id, skill_id)
);

-- =============================================================================
-- 8. Job Descriptions — add missing status + department columns
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.job_descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description_text TEXT NOT NULL,
    embedding VECTOR(384),
    required_skills JSONB,
    preferred_skills JSONB,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8a. Add missing columns individually
DO $$
BEGIN
    ALTER TABLE public.job_descriptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'complete', 'error'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.job_descriptions ADD COLUMN IF NOT EXISTS department TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- =============================================================================
-- 9. Ranking Results
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.job_descriptions(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    similarity_score FLOAT NOT NULL,
    skill_match_score FLOAT NOT NULL,
    overall_score FLOAT NOT NULL,
    rank_position INTEGER NOT NULL,
    explanation TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, candidate_id)
);

-- =============================================================================
-- 10. Chat Logs — add missing role/message/response_parts/suggestions columns
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.chat_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id VARCHAR(100) NOT NULL,
    query_text TEXT,
    response_text TEXT,
    intent VARCHAR(100),
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10a. Add chatbot-service columns
DO $$
BEGIN
    ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'
        CHECK (role IN ('user', 'assistant'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS message TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS response_parts JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$
BEGIN
    ALTER TABLE public.chat_logs ADD COLUMN IF NOT EXISTS suggestions JSONB;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- =============================================================================
-- 11. Audit Logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 12. Upload Batches (CV upload tracking — referenced by frontend)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.upload_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'success', 'failed', 'partial')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from candidates -> upload_batches
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_batch_id_fkey;
DO $$
BEGIN
    ALTER TABLE public.candidates ADD CONSTRAINT candidates_batch_id_fkey
        FOREIGN KEY (batch_id) REFERENCES public.upload_batches(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 13. System Config (Admin settings persistence)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.system_config (
    section TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES public.users(id)
);

INSERT INTO public.system_config (section, data) VALUES
    ('general', '{"system_name":"QUICK HIRE","language":"English (US)","timezone":"UTC","allow_signup":true}'::jsonb),
    ('ai', '{"ranking_model":"semantic-v3.2","embedding_model":"minilm-l12-v2","ocr_language":"English","ocr_min_confidence":0.75,"pipeline":["clean","ner","skills","dates"]}'::jsonb),
    ('perf', '{"max_concurrent":8,"cache_enabled":true,"cache_ttl":86400,"rate_limit_per_min":500,"max_batch_upload":50}'::jsonb),
    ('security', '{"session_timeout_min":60,"max_login_attempts":5,"pwd_min_length":12,"pwd_rules":["upper","lower","number","symbol"],"pwd_rotate_days":90}'::jsonb)
ON CONFLICT (section) DO NOTHING;

-- =============================================================================
-- 14. Indexes for Performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_candidates_embedding ON public.candidates USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_embedding ON public.job_descriptions USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rankings_job_rank ON public.rankings(job_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_name ON public.candidates(name);
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_session ON public.chat_logs(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_candidates_company ON public.candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_job_descriptions_company ON public.job_descriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_candidates_batch ON public.candidates(batch_id);
CREATE INDEX IF NOT EXISTS idx_upload_batches_company ON public.upload_batches(company_id);

-- =============================================================================
-- 15. Trigger to auto-update updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_candidates_updated_at ON public.candidates;
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON public.candidates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 16. Semantic Search RPC (384-dim pgvector match function)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.match_candidates(
  query_embedding vector(384),
  match_count INT DEFAULT 20,
  match_threshold FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  raw_text TEXT,
  structured_data JSONB,
  ocr_confidence FLOAT,
  source_file TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.id,
    c.name,
    c.email,
    c.phone,
    c.raw_text,
    c.structured_data,
    c.ocr_confidence,
    c.source_file,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.candidates c
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_candidates(vector, INT, FLOAT) TO authenticated;

-- =============================================================================
-- 17. Row Level Security (RLS) Policies
-- =============================================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Companies: viewable by company members and admins
DROP POLICY IF EXISTS companies_select ON public.companies;
CREATE POLICY companies_select ON public.companies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.company_id = companies.id OR users.role = 'admin')
        )
    );

-- Users: view own profile and company members; admins see all
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users
    FOR SELECT USING (
        id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users AS u
            WHERE u.id = auth.uid()
            AND (u.role = 'admin' OR u.company_id = users.company_id)
        )
    );

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );

-- Insert policy for users (needed for self-signup metadata path)
DROP POLICY IF EXISTS users_insert ON public.users;
CREATE POLICY users_insert ON public.users
    FOR INSERT WITH CHECK (id = auth.uid());

-- Candidates: view company candidates or own uploaded; insert only for own company
DROP POLICY IF EXISTS candidates_select ON public.candidates;
CREATE POLICY candidates_select ON public.candidates
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.role = 'admin' OR users.company_id = candidates.company_id)
        )
    );

DROP POLICY IF EXISTS candidates_insert ON public.candidates;
CREATE POLICY candidates_insert ON public.candidates
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND company_id IS NOT NULL) OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')
    );

DROP POLICY IF EXISTS candidates_update ON public.candidates;
CREATE POLICY candidates_update ON public.candidates
    FOR UPDATE USING (
        user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS candidates_delete ON public.candidates;
CREATE POLICY candidates_delete ON public.candidates
    FOR DELETE USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Job Descriptions: view company jobs or own; insert only for own company
DROP POLICY IF EXISTS job_descriptions_select ON public.job_descriptions;
CREATE POLICY job_descriptions_select ON public.job_descriptions
    FOR SELECT USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.role = 'admin' OR users.company_id = job_descriptions.company_id)
        )
    );

DROP POLICY IF EXISTS job_descriptions_insert ON public.job_descriptions;
CREATE POLICY job_descriptions_insert ON public.job_descriptions
    FOR INSERT WITH CHECK (
        created_by = auth.uid()
        AND (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND company_id IS NOT NULL) OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')
    );

-- Rankings: view only for jobs the user can access
DROP POLICY IF EXISTS rankings_select ON public.rankings;
CREATE POLICY rankings_select ON public.rankings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.job_descriptions
            WHERE job_descriptions.id = rankings.job_id
            AND (job_descriptions.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.users
                    WHERE users.id = auth.uid()
                    AND (users.role = 'admin' OR users.company_id = job_descriptions.company_id)
                )
            )
        )
    );

-- Chat logs: users can see their own logs; admins see all
DROP POLICY IF EXISTS chat_logs_select ON public.chat_logs;
CREATE POLICY chat_logs_select ON public.chat_logs
    FOR SELECT USING (
        user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

DROP POLICY IF EXISTS chat_logs_insert ON public.chat_logs;
CREATE POLICY chat_logs_insert ON public.chat_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Audit logs: only admins can view
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs
    FOR SELECT USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    );

-- Skills: viewable by all authenticated users; insert/update only by admins
DROP POLICY IF EXISTS skills_select ON public.skills;
CREATE POLICY skills_select ON public.skills FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS skills_modify ON public.skills;
CREATE POLICY skills_modify ON public.skills FOR ALL USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- Candidate_skills: allow if candidate is visible
DROP POLICY IF EXISTS candidate_skills_select ON public.candidate_skills;
CREATE POLICY candidate_skills_select ON public.candidate_skills
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.candidates WHERE id = candidate_skills.candidate_id AND (user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'))
    );

-- Upload batches: company members read; recruiters insert/update own
DROP POLICY IF EXISTS "Company members read upload_batches" ON public.upload_batches;
CREATE POLICY "Company members read upload_batches"
  ON public.upload_batches FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Recruiters insert upload_batches" ON public.upload_batches;
CREATE POLICY "Recruiters insert upload_batches"
  ON public.upload_batches FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Recruiters update own upload_batches" ON public.upload_batches;
CREATE POLICY "Recruiters update own upload_batches"
  ON public.upload_batches FOR UPDATE
  USING (user_id = auth.uid());

-- System config: only admins
DROP POLICY IF EXISTS "Admins manage system_config" ON public.system_config;
CREATE POLICY "Admins manage system_config"
  ON public.system_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- =============================================================================
-- 18. Seed initial skills (optional, idempotent)
-- =============================================================================
INSERT INTO public.skills (id, name, category) VALUES
    (uuid_generate_v4(), 'Python', 'technical'),
    (uuid_generate_v4(), 'Java', 'technical'),
    (uuid_generate_v4(), 'JavaScript', 'technical'),
    (uuid_generate_v4(), 'React', 'technical'),
    (uuid_generate_v4(), 'Django', 'technical'),
    (uuid_generate_v4(), 'Machine Learning', 'technical'),
    (uuid_generate_v4(), 'SQL', 'technical'),
    (uuid_generate_v4(), 'Leadership', 'soft'),
    (uuid_generate_v4(), 'Communication', 'soft'),
    (uuid_generate_v4(), 'Teamwork', 'soft')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 19. FINAL: Force PostgREST schema cache reload
--     (This is what fixes "Could not find column X in schema cache")
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- Optional: verify company_id column now exists in the users table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'users'
  AND column_name  = 'company_id';
