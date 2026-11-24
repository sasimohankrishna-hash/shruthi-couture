(function initializeCouturePasswordRecovery(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CouturePasswordRecovery = api;
})(globalThis, function createPasswordRecoveryModule() {
  async function startPasswordRecoveryPage({ root, createClient }) {
    const form = root.document.querySelector("#password-reset-form");
    const passwordInput = root.document.querySelector("#password-reset-new");
    const confirmInput = root.document.querySelector("#password-reset-confirm");
    const submitButton = root.document.querySelector("#password-reset-submit");
    const message = root.document.querySelector("#password-reset-message");
    const config = root.COUTURE_SUPABASE_CONFIG || {};
    let recoverySession = null;
    let supabase;

    function showMessage(text, type = "error") {
      message.textContent = text;
      message.classList.remove("is-success");
      if (type === "success") message.classList.add("is-success");
    }

    function acceptRecoverySession(session) {
      if (!session?.access_token || !session.user?.id) return false;
      recoverySession = session;
      form.hidden = false;
      showMessage("Recovery link verified. Choose a new password.", "success");
      return true;
    }

    function invalidRecoveryMessage() {
      recoverySession = null;
      form.hidden = true;
      showMessage(
        "This password recovery link is invalid or expired. Request a new link from the Admin Panel.",
      );
    }

    if (!config.url || !config.publishableKey) {
      showMessage(
        "Configure the Supabase project URL and publishable key in supabase-config.js.",
      );
      return;
    }

    const callbackUrl = new URL(root.location.href);
    const callbackHash = new URLSearchParams(
      callbackUrl.hash.startsWith("#")
        ? callbackUrl.hash.slice(1)
        : callbackUrl.hash,
    );
    const hasCallbackError =
      callbackUrl.searchParams.has("error") ||
      callbackHash.has("error") ||
      callbackHash.has("error_code");
    const hasRecoveryCallback =
      callbackUrl.searchParams.has("code") ||
      callbackUrl.searchParams.get("type") === "recovery" ||
      callbackHash.get("type") === "recovery";

    if (hasCallbackError) {
      invalidRecoveryMessage();
      return;
    }

    try {
      supabase = createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch {
      showMessage("Could not initialize Supabase. Reload the page and try again.");
      return;
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        acceptRecoverySession(session);
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!recoverySession) {
        invalidRecoveryMessage();
        return;
      }
      if (passwordInput.value.length < 6) {
        showMessage("Your password must be at least 6 characters.");
        passwordInput.focus();
        return;
      }
      if (passwordInput.value !== confirmInput.value) {
        showMessage("The passwords do not match.");
        confirmInput.focus();
        return;
      }

      submitButton.disabled = true;
      showMessage("");
      try {
        const sessionResult = await supabase.auth.getSession();
        const currentSession = sessionResult.data?.session;
        if (
          sessionResult.error ||
          !currentSession?.access_token ||
          currentSession.user?.id !== recoverySession.user.id
        ) {
          throw new Error("recovery_session_expired");
        }

        const result = await supabase.auth.updateUser({
          password: passwordInput.value,
        });
        if (result.error) throw result.error;

        form.hidden = true;
        showMessage(
          "Your password has been updated. Returning to the Admin Panel…",
          "success",
        );
        root.setTimeout(() => {
          root.location.assign(
            new URL("admin.html", root.location.href).toString(),
          );
        }, 1500);
      } catch (error) {
        const code = String(error?.code || error?.message || "").toLowerCase();
        if (code.includes("weak_password") || code.includes("password")) {
          showMessage(
            "The password was not accepted. Choose a stronger password that meets this project's password requirements.",
          );
        } else if (code.includes("recovery_session_expired")) {
          invalidRecoveryMessage();
          form.hidden = true;
        } else {
          showMessage(
            "Unable to update your password. The recovery link may have expired; request a new one from the Admin Panel.",
          );
        }
      } finally {
        submitButton.disabled = false;
      }
    });

    if (!hasRecoveryCallback) {
      invalidRecoveryMessage();
      return;
    }

    showMessage("Verifying your password recovery link…");
    try {
      const result = await supabase.auth.getSession();
      if (result.error || !recoverySession) {
        invalidRecoveryMessage();
        return;
      }

      if (root.history?.replaceState) {
        root.history.replaceState(null, "", callbackUrl.pathname);
      }
    } catch {
      invalidRecoveryMessage();
    }
  }

  return { startPasswordRecoveryPage };
});
