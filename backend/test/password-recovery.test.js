const test = require("node:test");
const assert = require("node:assert/strict");
const {
  startPasswordRecoveryPage,
} = require("../../password-recovery");

const recoverySession = {
  access_token: "recovery-access-token",
  user: { id: "owner-user-id" },
};

function createElement({ hidden = false, value = "" } = {}) {
  const listeners = {};
  const classes = new Set();
  return {
    hidden,
    value,
    disabled: false,
    textContent: "",
    focused: false,
    listeners,
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    addEventListener(name, callback) {
      listeners[name] = callback;
    },
    focus() {
      this.focused = true;
    },
  };
}

function createRecoveryHarness({
  href = "https://shruthi-couture.netlify.app/reset-password.html?code=one-time-code",
  session = recoverySession,
  emitRecoveryEvent = new URL(href).searchParams.has("code"),
} = {}) {
  const elements = {
    "#password-reset-form": createElement({ hidden: true }),
    "#password-reset-new": createElement(),
    "#password-reset-confirm": createElement(),
    "#password-reset-submit": createElement(),
    "#password-reset-message": createElement(),
  };
  const calls = { updateUser: [], navigations: [], timers: [] };
  let authStateListener;
  const supabase = {
    auth: {
      onAuthStateChange(callback) {
        authStateListener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      async getSession() {
        if (emitRecoveryEvent) {
          authStateListener("PASSWORD_RECOVERY", session);
        }
        return { data: { session }, error: null };
      },
      async updateUser(attributes) {
        calls.updateUser.push(attributes);
        return { data: { user: session.user }, error: null };
      },
    },
  };
  const url = new URL(href);
  const root = {
    COUTURE_SUPABASE_CONFIG: {
      url: "https://project.example.supabase.co",
      publishableKey: "sb_publishable_test",
    },
    document: {
      querySelector(selector) {
        return elements[selector];
      },
    },
    location: {
      href: url.toString(),
      assign(destination) {
        calls.navigations.push(destination);
      },
    },
    history: {
      replaceState(_state, _title, destination) {
        calls.replacedUrl = destination;
      },
    },
    setTimeout(callback, delay) {
      calls.timers.push({ callback, delay });
    },
  };

  return {
    calls,
    elements,
    root,
    supabase,
  };
}

test("recovery page rejects a normal visit even when an existing session exists", async () => {
  const harness = createRecoveryHarness({
    href: "https://shruthi-couture.netlify.app/reset-password.html",
  });

  await startPasswordRecoveryPage({
    root: harness.root,
    createClient: () => harness.supabase,
  });

  assert.equal(harness.elements["#password-reset-form"].hidden, true);
  assert.match(
    harness.elements["#password-reset-message"].textContent,
    /invalid or expired/,
  );
});

test("recovery URL cannot use an unrelated persisted session without a recovery event", async () => {
  const harness = createRecoveryHarness({
    emitRecoveryEvent: false,
  });

  await startPasswordRecoveryPage({
    root: harness.root,
    createClient: () => harness.supabase,
  });

  assert.equal(harness.elements["#password-reset-form"].hidden, true);
  assert.match(
    harness.elements["#password-reset-message"].textContent,
    /invalid or expired/,
  );
});

test("recovery callback updates the password and returns to Admin Panel", async () => {
  const harness = createRecoveryHarness();

  await startPasswordRecoveryPage({
    root: harness.root,
    createClient: () => harness.supabase,
  });

  assert.equal(harness.elements["#password-reset-form"].hidden, false);
  assert.equal(harness.calls.replacedUrl, "/reset-password.html");

  harness.elements["#password-reset-new"].value = "new-secure-password";
  harness.elements["#password-reset-confirm"].value = "new-secure-password";
  await harness.elements["#password-reset-form"].listeners.submit({
    preventDefault() {},
  });

  assert.deepEqual(harness.calls.updateUser, [
    { password: "new-secure-password" },
  ]);
  assert.match(
    harness.elements["#password-reset-message"].textContent,
    /password has been updated/,
  );
  assert.equal(harness.calls.timers[0].delay, 1500);
  harness.calls.timers[0].callback();
  assert.deepEqual(harness.calls.navigations, [
    "https://shruthi-couture.netlify.app/admin.html",
  ]);
});

test("recovery form requires matching passwords before calling Supabase", async () => {
  const harness = createRecoveryHarness();

  await startPasswordRecoveryPage({
    root: harness.root,
    createClient: () => harness.supabase,
  });

  harness.elements["#password-reset-new"].value = "new-secure-password";
  harness.elements["#password-reset-confirm"].value = "different-password";
  await harness.elements["#password-reset-form"].listeners.submit({
    preventDefault() {},
  });

  assert.deepEqual(harness.calls.updateUser, []);
  assert.equal(harness.elements["#password-reset-confirm"].focused, true);
  assert.match(
    harness.elements["#password-reset-message"].textContent,
    /passwords do not match/,
  );
});
