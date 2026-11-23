const { createClient } = require("@supabase/supabase-js");

function validateSupabaseUrl(SUPABASE_URL) {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL must be configured.");
  }
  let url;
  try {
    url = new URL(SUPABASE_URL);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL.");
  }

  if (url.protocol !== "https:" && url.hostname !== "localhost") {
    throw new Error("SUPABASE_URL must use HTTPS outside localhost.");
  }

  return SUPABASE_URL;
}

const authOptions = {
  autoRefreshToken: false,
  persistSession: false,
  detectSessionInUrl: false,
};

function createSupabaseClient(env = process.env) {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env;

  if (!SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY must be configured.");
  }

  const url = validateSupabaseUrl(SUPABASE_URL);
  return createClient(url, SUPABASE_SECRET_KEY, {
    auth: authOptions,
  });
}

function createAuthenticatedSupabaseClient(accessToken, env = process.env) {
  const SUPABASE_PUBLISHABLE_KEY =
    env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY must be configured.",
    );
  }
  if (!accessToken) {
    throw new Error("A verified user access token is required.");
  }

  const url = validateSupabaseUrl(env.SUPABASE_URL);
  return createClient(url, SUPABASE_PUBLISHABLE_KEY, {
    auth: authOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

module.exports = {
  createAuthenticatedSupabaseClient,
  createSupabaseClient,
};
