import { createClient } from '@supabase/supabase-js';

let __viteEnvCache = null;
const viteEnv = () => {
  if (__viteEnvCache !== null) return __viteEnvCache;
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      __viteEnvCache = import.meta.env;
    } else {
      __viteEnvCache = {};
    }
  } catch (_) {
    __viteEnvCache = {};
  }
  return __viteEnvCache;
};

const REACT_APP_SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL ||
  (viteEnv().REACT_APP_SUPABASE_URL) ||
  (viteEnv().VITE_SUPABASE_URL) ||
  undefined;

const REACT_APP_SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  (viteEnv().REACT_APP_SUPABASE_ANON_KEY) ||
  (viteEnv().VITE_SUPABASE_ANON_KEY) ||
  undefined;

export const supabase = createClient(REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY);

export default supabase;
