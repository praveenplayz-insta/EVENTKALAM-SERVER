const { createClient } = require('@supabase/supabase-js');

// Full-access client: bypasses Row Level Security. Server-only, never expose this key to a browser.
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Acts AS the logged-in user making the request, so Postgres RLS and auth.uid() apply normally.
// This is how registration/cancellation stay protected by the same rules as direct browser calls.
const asUser = (accessToken) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

module.exports = { admin, asUser };
