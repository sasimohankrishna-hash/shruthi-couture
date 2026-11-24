import "./supabase-config.js";
import "./password-recovery.js";

const root = window;
const message = document.querySelector("#password-reset-message");

try {
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
  await root.CouturePasswordRecovery.startPasswordRecoveryPage({
    root,
    createClient,
  });
} catch {
  message.textContent =
    "The password recovery service could not be loaded. Check your connection and reload the page.";
}
