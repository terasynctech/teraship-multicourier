
document.addEventListener("DOMContentLoaded", () => {
  const db = window.supabaseClient;

  const authScreen = document.getElementById("superAdminAuthScreen");
  const app = document.getElementById("superAdminApp");
  const form = document.getElementById("superAdminLoginForm");
  const button = document.getElementById("superAdminLoginButton");
  const message = document.getElementById("superAdminMessage");
  const signOut = document.getElementById("superAdminSignOut");

  function showMessage(text, isError = true) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#15803d";
  }

  function showLogin() {
    authScreen.hidden = false;
    app.hidden = true;
  }

  async function verifySuperAdmin(user) {
    if (!user) {
      showLogin();
      return false;
    }

    const { data, error } = await db
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      showLogin();
      showMessage("Could not verify Super Admin access: " + error.message);
      return false;
    }

    if (!data) {
      await db.auth.signOut();
      showLogin();
      showMessage("Access denied. This account is not a registered Super Admin.");
      return false;
    }

    authScreen.hidden = true;
    app.hidden = false;

    document.getElementById("superAdminUser").textContent =
      "Signed in: " + user.email;

    document.getElementById("superAdminContent").innerHTML = `
      <div style="background:white;padding:25px;border-radius:12px">
        <h2>Platform Dashboard</h2>
        <p>Super Admin authentication successful.</p>
        <p>Your platform administrator account is verified.</p>
        <p>Next: Franchise, Seller, Courier and Shipment management.</p>
      </div>
    `;

    return true;
  }

  if (!db) {
    showMessage("Supabase connection is missing. Check supabase-config.js.");
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    button.disabled = true;
    button.textContent = "Verifying access...";

    try {
      const email = document.getElementById("superAdminEmail").value.trim();
      const password = document.getElementById("superAdminPassword").value;

      const { data, error } = await db.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await verifySuperAdmin(data.user);
    } catch (error) {
      showMessage(error.message || "Login failed.");
    } finally {
      button.disabled = false;
      button.textContent = "Sign in as Super Admin";
    }
  });

  signOut.addEventListener("click", async () => {
    signOut.disabled = true;

    const { error } = await db.auth.signOut();

    if (error) {
      alert("Sign out failed: " + error.message);
      signOut.disabled = false;
      return;
    }

    window.location.reload();
  });

  async function checkSession() {
    showLogin();

    const { data, error } = await db.auth.getSession();

    if (error) {
      showMessage(error.message);
      return;
    }

    if (data.session) {
      await verifySuperAdmin(data.session.user);
    }
  }

  checkSession();
});
