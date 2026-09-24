
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zrrkyxrrglhotddwukml.supabase.co';
const SUPABASE_ANON_KEY = 'your-supabase-anon-key-here';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase client initialized successfully!');
console.log('Testing health check...');

// Just a simple test
supabase.from('companies').select('*').limit(1).then(response => {
  console.log('Response:', JSON.stringify(response, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
