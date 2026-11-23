import "./supabase-config.js";
import "./admin-order-table.js";
import "./admin-auth.js";

const root = window;
const message = document.querySelector("#admin-auth-message");

try {
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  root.CoutureAdminAuth.startAdminPage({ root, createClient });
} catch {
  message.textContent =
    "The Supabase sign-in client could not be loaded. Check your connection and reload the page.";
}
