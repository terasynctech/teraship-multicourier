window.SUPABASE_URL = "https://cocfjuwyrwnarwwqrlow.supabase.co";

// Paste your Supabase Publishable Key between the quotes.
window.SUPABASE_ANON_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
