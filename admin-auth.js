(function initializeCoutureAdminAuth(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CoutureAdminAuth = api;
})(globalThis, function createAdminAuthModule() {
  class AdminAuthError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  function authErrorMessage(error) {
    const code = String(error?.code || error?.name || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    if (code === "email_not_confirmed") {
      return "Please verify your email before signing in.";
    }
    if (
      code === "invalid_credentials" ||
      code === "invalid_login_credentials" ||
      message.includes("invalid login credentials")
    ) {
      return "Incorrect email or password for this project's Supabase Auth account. The Supabase organization password is separate.";
    }
    if (
      error instanceof TypeError ||
      /network|fetch|timeout|connection/.test(`${code} ${message}`)
    ) {
      return "Unable to connect to Supabase. Check your network and try again.";
    }
    return "Sign-in failed. Check your credentials and try again.";
  }

  function passwordResetErrorMessage(error) {
    const code = String(error?.code || error?.name || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    if (
      error instanceof TypeError ||
      /network|fetch|timeout|connection/.test(`${code} ${message}`)
    ) {
      return "Unable to connect to Supabase. Check your network and try again.";
    }
    if (
      code.includes("rate_limit") ||
      message.includes("rate limit") ||
      message.includes("too many")
    ) {
      return "Too many recovery emails were requested. Please wait before trying again.";
    }
    return "Unable to send a password recovery email. Check the email address and try again.";
  }

  function passwordRecoveryRedirectUrl(currentUrl) {
    return new URL("reset-password.html", currentUrl).toString();
  }

  function validateApiUrl(apiBaseUrl) {
    let url;
    try {
      url = new URL(apiBaseUrl);
    } catch {
      throw new Error("The backend API URL is not configured correctly.");
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("The backend API URL must use HTTP or HTTPS.");
    }
    return url.origin;
  }

  function createAdminAuth({
    supabase,
    apiBaseUrl,
    fetchImpl = globalThis.fetch,
    onUnauthorized = () => {},
  }) {
    const baseUrl = validateApiUrl(apiBaseUrl);

    async function endSession(status) {
      let signOutError = null;
      try {
        const result = await supabase.auth.signOut();
        signOutError = result.error || null;
      } catch (error) {
        signOutError = error;
      }
      await onUnauthorized(status);
      return signOutError;
    }

    async function requestWithSession(session, path, options = {}) {
      if (!path.startsWith("/api/")) {
        throw new Error("Admin requests must use a backend API path.");
      }
      const url = new URL(path, `${baseUrl}/`);
      if (url.origin !== baseUrl) {
        throw new Error("Admin requests must use the configured backend.");
      }
      const headers = new Headers(options.headers || {});
      headers.set("Authorization", `Bearer ${session.access_token}`);

      try {
        return await fetchImpl(url, { ...options, headers });
      } catch {
        throw new Error(
          "Unable to reach the backend. Check your network and try again.",
        );
      }
    }

    async function verifyAdminSession(session) {
      if (!session?.access_token) return { status: "missing_session" };

      const response = await requestWithSession(
        session,
        "/api/admin/session",
      );
      if (response.status === 401 || response.status === 403) {
        const signOutError = await endSession(response.status);
        return {
          status: response.status === 403 ? "denied" : "expired",
          signOutError,
        };
      }
      if (!response.ok) {
        throw new Error(
          "The backend could not verify admin access. Please try again.",
        );
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The backend returned an invalid admin response.");
      }
      if (payload?.data?.isAdmin !== true) {
        const signOutError = await endSession(403);
        return { status: "denied", signOutError };
      }

      return {
        status: "authorized",
        email: payload.data.email || session.user?.email || "",
      };
    }

    async function login(email, password) {
      let signInResult;
      try {
        signInResult = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      } catch (error) {
        throw new Error(authErrorMessage(error));
      }
      if (signInResult.error) {
        throw new Error(authErrorMessage(signInResult.error));
      }

      let sessionResult;
      try {
        sessionResult = await supabase.auth.getSession();
      } catch (error) {
        throw new Error(authErrorMessage(error));
      }
      if (sessionResult.error) {
        throw new Error(authErrorMessage(sessionResult.error));
      }
      if (!sessionResult.data?.session?.access_token) {
        const signOutError = await endSession(401);
        return { status: "missing_session", signOutError };
      }
      return verifyAdminSession(sessionResult.data.session);
    }

    async function requestPasswordReset(email, redirectTo) {
      let result;
      try {
        result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo,
        });
      } catch (error) {
        throw new Error(passwordResetErrorMessage(error));
      }
      if (result.error) {
        throw new Error(passwordResetErrorMessage(result.error));
      }
    }

    async function restore() {
      let result;
      try {
        result = await supabase.auth.getSession();
      } catch (error) {
        throw new Error(authErrorMessage(error));
      }
      if (result.error) {
        const signOutError = await endSession(401);
        return { status: "expired", signOutError };
      }
      if (!result.data?.session?.access_token) {
        return { status: "missing_session" };
      }
      return verifyAdminSession(result.data.session);
    }

    async function logout() {
      let result;
      try {
        result = await supabase.auth.signOut();
      } catch {
        throw new Error("Could not sign out. Please try again.");
      }
      if (result.error) {
        throw new Error("Could not sign out. Please try again.");
      }
    }

    async function request(path, options = {}) {
      let result;
      try {
        result = await supabase.auth.getSession();
      } catch {
        await endSession(401);
        throw new AdminAuthError(
          401,
          "Your session could not be restored. Please sign in again.",
        );
      }
      const session = result.data?.session;
      if (result.error || !session?.access_token) {
        await endSession(401);
        throw new AdminAuthError(
          401,
          "Your session has expired. Please sign in again.",
        );
      }

      const response = await requestWithSession(session, path, options);
      if (response.status === 401 || response.status === 403) {
        await endSession(response.status);
        throw new AdminAuthError(
          response.status,
          response.status === 403
            ? "Administrator access is required."
            : "Your session has expired. Please sign in again.",
        );
      }
      return response;
    }

    return { login, requestPasswordReset, restore, logout, request };
  }

  function startAdminPage({ root, createClient }) {
    const loginPage = root.document.querySelector("#admin-login");
    const dashboard = root.document.querySelector("#admin-dashboard");
    const form = root.document.querySelector("#admin-login-form");
    const emailInput = root.document.querySelector("#admin-login-email");
    const passwordInput = root.document.querySelector("#admin-login-password");
    const submitButton = root.document.querySelector("#admin-login-submit");
    const forgotPasswordButton = root.document.querySelector(
      "#admin-forgot-password",
    );
    const message = root.document.querySelector("#admin-auth-message");
    const account = root.document.querySelector("#admin-account");
    const accountEmail = root.document.querySelector("#admin-account-email");
    const logoutButton = root.document.querySelector("#admin-logout");
    const config = root.COUTURE_SUPABASE_CONFIG || {};

    function showLogin(text = "") {
      dashboard.hidden = true;
      loginPage.hidden = false;
      account.hidden = true;
      accountEmail.textContent = "";
      passwordInput.value = "";
      message.textContent = text;
    }

    function showDashboard(email) {
      message.textContent = "";
      loginPage.hidden = true;
      dashboard.hidden = false;
      account.hidden = false;
      accountEmail.textContent = email;

      if (root.CoutureAdminDashboard) {
        void root.CoutureAdminDashboard.refresh();
        return;
      }
      const script = root.document.createElement("script");
      script.src = "admin.js";
      script.onerror = () => {
        const feedback = root.document.querySelector("#admin-feedback");
        feedback.textContent = "The admin dashboard could not be loaded.";
        feedback.classList.add("is-error");
      };
      root.document.body.append(script);
    }

    if (!config.url || !config.publishableKey || !config.apiBaseUrl) {
      showLogin(
        "Configure the Supabase project URL, publishable key, and backend URL in supabase-config.js.",
      );
      submitButton.disabled = true;
      return;
    }

    let supabase;
    let auth;
    try {
      supabase = createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
      auth = createAdminAuth({
        supabase,
        apiBaseUrl: config.apiBaseUrl,
        onUnauthorized(status) {
          showLogin(
            status === 403
              ? "Access denied. This account is not an administrator."
              : "Your session has expired. Please sign in again.",
          );
        },
      });
    } catch (error) {
      showLogin(error.message);
      submitButton.disabled = true;
      return;
    }

    root.CoutureAdminSession = auth;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submitButton.disabled = true;
      message.textContent = "";
      try {
        const result = await auth.login(emailInput.value.trim(), passwordInput.value);
        if (result.status === "authorized") {
          showDashboard(result.email);
        } else if (result.status === "denied") {
          showLogin("Access denied. This account is not an administrator.");
        } else {
          showLogin("No active session was created. Please sign in again.");
        }
      } catch (error) {
        showLogin(error.message);
      } finally {
        submitButton.disabled = false;
        passwordInput.value = "";
      }
    });

    forgotPasswordButton.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      if (!email || !emailInput.checkValidity()) {
        emailInput.reportValidity();
        return;
      }

      forgotPasswordButton.disabled = true;
      submitButton.disabled = true;
      message.classList.remove("is-success");
      message.textContent = "";
      try {
        const redirectTo = passwordRecoveryRedirectUrl(root.location.href);
        await auth.requestPasswordReset(email, redirectTo);
        message.classList.add("is-success");
        message.textContent =
          "If an account exists for this email, a password recovery link is on its way.";
      } catch (error) {
        message.textContent = error.message;
      } finally {
        forgotPasswordButton.disabled = false;
        submitButton.disabled = false;
      }
    });

    logoutButton.addEventListener("click", async () => {
      logoutButton.disabled = true;
      try {
        await auth.logout();
        showLogin("You have been signed out.");
      } catch (error) {
        showLogin(error.message);
      } finally {
        logoutButton.disabled = false;
      }
    });

    void auth
      .restore()
      .then((result) => {
        if (result.status === "authorized") {
          showDashboard(result.email);
        } else if (result.status === "denied") {
          showLogin("Access denied. This account is not an administrator.");
        } else if (result.status === "expired") {
          showLogin("Your session has expired. Please sign in again.");
        }
      })
      .catch((error) => showLogin(error.message));
  }

  return {
    AdminAuthError,
    authErrorMessage,
    createAdminAuth,
    passwordRecoveryRedirectUrl,
    startAdminPage,
  };
});
