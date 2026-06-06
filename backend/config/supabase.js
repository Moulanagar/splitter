import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;

const getSupabaseClient = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
};

export const supabase = new Proxy({}, {
  get: (target, prop) => {
    return getSupabaseClient()[prop];
  }
});
