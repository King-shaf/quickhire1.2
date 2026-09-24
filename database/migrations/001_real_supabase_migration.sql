-- QuickHire migration: run in Supabase SQL editor BEFORE using the updated frontend.
-- Review each section; adjust RLS policies to match your existing setup.

-- ---------------------------------------------------------------------------
-- 1. Add 'company' role to users.role CHECK constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('recruiter', 'admin', 'company'));

-- ---------------------------------------------------------------------------
-- 2. job_descriptions: status + department
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_descriptions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'complete', 'error'));

ALTER TABLE public.job_descriptions
  ADD COLUMN IF NOT EXISTS department TEXT;

-- ---------------------------------------------------------------------------
-- 3. system_config (AdminConfig persistence)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_config (
  section TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Admins manage system_config"
  ON public.system_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

INSERT INTO public.system_config (section, data) VALUES
  ('general', '{"system_name":"QUICK HIRE","language":"English (US)","timezone":"UTC","allow_signup":true}'::jsonb),
  ('ai', '{"ranking_model":"semantic-v3.2","embedding_model":"minilm-l12-v2","ocr_language":"English","ocr_min_confidence":0.75,"pipeline":["clean","ner","skills","dates"]}'::jsonb),
  ('perf', '{"max_concurrent":8,"cache_enabled":true,"cache_ttl":86400,"rate_limit_per_min":500,"max_batch_upload":50}'::jsonb),
  ('security', '{"session_timeout_min":60,"max_login_attempts":5,"pwd_min_length":12,"pwd_rules":["upper","lower","number","symbol"],"pwd_rotate_days":90}'::jsonb)
ON CONFLICT (section) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. upload_batches (CV upload history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'success', 'failed', 'partial')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Company members read upload_batches"
  ON public.upload_batches FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Recruiters insert upload_batches"
  ON public.upload_batches FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Recruiters update own upload_batches"
  ON public.upload_batches FOR UPDATE
  USING (user_id = auth.uid());

-- Optional: link candidates to a batch
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.upload_batches(id);

-- ---------------------------------------------------------------------------
-- 5. pgvector semantic search RPC (384-dim embeddings)
-- Requires: CREATE EXTENSION IF NOT EXISTS vector;
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

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

-- Grant execute to authenticated users (RLS on candidates still applies if enabled)
GRANT EXECUTE ON FUNCTION public.match_candidates(vector, INT, FLOAT) TO authenticated;
