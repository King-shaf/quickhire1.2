// Supabase Edge Function: embed query text and call match_candidates RPC
// Deploy: supabase functions deploy semantic-search
// Set secrets: HUGGINGFACE_API_KEY (or swap for your 384-dim embedding provider)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function embedQuery(text: string): Promise<number[]> {
  const hfKey = Deno.env.get('HUGGINGFACE_API_KEY');
  const model = Deno.env.get('EMBEDDING_MODEL') ?? 'sentence-transformers/all-MiniLM-L6-v2';

  if (hfKey) {
    const res = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
    });
    const json = await res.json();
    // HF returns nested array; flatten to 384 dims (truncate/pad if model differs)
    const flat: number[] = Array.isArray(json[0]) ? json[0] : json;
    return flat.slice(0, 384).concat(Array(Math.max(0, 384 - flat.length)).fill(0));
  }

  // Deterministic fallback hash embedding (dev only — replace with real model in prod)
  const vec = new Array(384).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 384] += text.charCodeAt(i) / 255;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { query, match_count = 20 } = await req.json();
    if (!query?.trim()) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const embedding = await embedQuery(query.trim());

    const { data, error } = await supabase.rpc('match_candidates', {
      query_embedding: embedding,
      match_count,
      match_threshold: 0.0,
    });

    if (error) throw error;

    return new Response(JSON.stringify(data ?? []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
