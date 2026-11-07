
document.addEventListener("DOMContentLoaded", () => {
  const db = window.supabaseClient;

  const authScreen = document.getElementById("authScreen");
  const appShell = document.getElementById("appShell");
  const loginForm = document.getElementById("loginForm");
  const loginButton = document.getElementById("loginButton");
  const authMessage = document.getElementById("authMessage");
  const signOutButton = document.getElementById("signOutBtn");

  let appLoaded = false;

  function showMessage(message, isError = true) {
    authMessage.textContent = message;
    authMessage.style.color = isError ? "#dc2626" : "#15803d";
  }

  function showLogin() {
    authScreen.classList.remove("hidden");
    appShell.classList.add("hidden");
  }

  function loadDashboard() {
    authScreen.classList.add("hidden");
    appShell.classList.remove("hidden");

    if (appLoaded) return;

    appLoaded = true;

    const script = document.createElement("script");
    script.src = "js/app.js";
    script.onload = () => console.log("TeraShip dashboard loaded.");
    script.onerror = () => {
      appLoaded = false;
      alert("Dashboard could not load. Please check js/app.js in GitHub.");
    };

    document.body.appendChild(script);
  }

  async function verifyUser(user) {
    if (!user) {
      showLogin();
      return false;
    }

    const { data: profile, error } = await db
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (error || !profile) {
      await db.auth.signOut();
      showLogin();
      showMessage("Your account profile was not found. Please contact the administrator.");
      return false;
    }

    if (!["admin", "staff"].includes(profile.role)) {
      await db.auth.signOut();
      showLogin();
      showMessage("Access denied. This account is not authorized for the TeraShip portal.");
      return false;
    }

    loadDashboard();
    return true;
  }

  if (!db) {
    showMessage("Supabase connection is missing. Please check supabase-config.js.");
    return;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    loginButton.disabled = true;
    loginButton.textContent = "Signing in...";
    showMessage("");

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await verifyUser(data.user);
    } catch (error) {
      showMessage(error.message || "Login failed. Please try again.");
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "Sign in securely";
    }
  });

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;

    const { error } = await db.auth.signOut();

    if (error) {
      alert("Sign out failed: " + error.message);
      signOutButton.disabled = false;
      return;
    }

    window.location.reload();
  });

  async function checkExistingSession() {
    showLogin();

    const { data, error } = await db.auth.getSession();

    if (error) {
      showMessage(error.message);
      return;
    }

    if (data.session) {
      await verifyUser(data.session.user);
    }
  }

  checkExistingSession();
});
