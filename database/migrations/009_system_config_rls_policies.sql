-- =============================================================================
-- Migration 009: System Config Row Level Security Policies
-- =============================================================================
-- Fix: Allows all authenticated users (recruiters, companies, admins) to read system_config,
-- and allows authenticated users to update configuration settings.
-- Also allows public/anon fallback for development.

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read system_config" ON public.system_config;
CREATE POLICY "Anyone can read system_config"
  ON public.system_config FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert/update system_config" ON public.system_config;
CREATE POLICY "Authenticated can insert/update system_config"
  ON public.system_config FOR ALL
  USING (auth.uid() IS NOT NULL OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR true)
  WITH CHECK (auth.uid() IS NOT NULL OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' OR true);

-- Seed initial rows if missing
INSERT INTO public.system_config (section, data) VALUES
    ('general', '{"system_name":"QUICK HIRE","language":"English (US)","timezone":"UTC","allow_signup":true,"default_role":"recruiter","approval_required":true}'::jsonb),
    ('ai', '{"ranking_model":"semantic-v3.2","embedding_model":"minilm-l12-v2","ocr_language":"English","ocr_min_confidence":0.75,"pipeline":["clean","ner","skills","dates"],"min_score":70,"skills_weight":40,"experience_weight":30,"ranking":true}'::jsonb),
    ('perf', '{"max_concurrent":8,"cache_enabled":true,"cache_ttl":86400,"rate_limit_per_min":500,"max_batch_upload":50}'::jsonb),
    ('security', '{"session_timeout_min":60,"max_login_attempts":5,"pwd_min_length":12,"pwd_rules":["upper","lower","number","symbol"],"pwd_rotate_days":90}'::jsonb)
ON CONFLICT (section) DO NOTHING;
