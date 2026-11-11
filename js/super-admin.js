
document.addEventListener("DOMContentLoaded", () => {
  const db = window.supabaseClient;

  const authScreen = document.getElementById("superAdminAuthScreen");
  const app = document.getElementById("superAdminApp");
  const form = document.getElementById("superAdminLoginForm");
  const button = document.getElementById("superAdminLoginButton");
  const message = document.getElementById("superAdminMessage");
  const signOut = document.getElementById("superAdminSignOut");
  const content = document.getElementById("superAdminContent");

  let franchises = [];
  let editingId = null;
  let slugTouched = false;

  function showMessage(text, isError = true) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#15803d";
  }

  function showLogin() {
    authScreen.hidden = false;
    app.hidden = true;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function makeSlug(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async function loadFranchises() {
    content.innerHTML = "<p>Loading franchises...</p>";

    const { data, error } = await db
      .from("organizations")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      content.innerHTML =
        `<p style="color:#dc2626">Could not load franchises: ${escapeHTML(error.message)}</p>`;
      return;
    }

    franchises = data || [];
    renderFranchises();
  }

  function renderFranchises() {
    content.innerHTML = `
      <div style="background:white;padding:24px;border-radius:12px;margin-bottom:20px">
        <h2 style="margin-top:0">Franchise Management</h2>
        <p>Register and manage courier franchise businesses.</p>

        <form id="franchiseForm">
          <input type="hidden" id="franchiseId">

          <label for="franchiseName">Franchise / Business Name</label>
          <input id="franchiseName" type="text" required
            placeholder="Example: Ranchi Courier Services"
            style="display:block;width:100%;box-sizing:border-box;padding:12px;margin:7px 0 15px">

          <label for="franchiseSlug">Unique Franchise Slug</label>
          <input id="franchiseSlug" type="text" required
            placeholder="ranchi-courier-services"
            style="display:block;width:100%;box-sizing:border-box;padding:12px;margin:7px 0 15px">

          <button type="submit" id="franchiseSaveButton"
            style="background:#173b78;color:white;padding:12px 22px;border:0;border-radius:7px;cursor:pointer">
            Add Franchise
          </button>

          <button type="button" id="franchiseCancelButton"
            style="display:none;padding:12px 18px;margin-left:8px">
            Cancel Edit
          </button>

          <p id="franchiseMessage" role="status"></p>
        </form>
      </div>

      <div style="background:white;padding:24px;border-radius:12px">
        <h2 style="margin-top:0">Registered Franchises (${franchises.length})</h2>

        <input id="franchiseSearch" type="search"
          placeholder="Search franchise name or slug..."
          style="display:block;width:100%;box-sizing:border-box;padding:12px;margin-bottom:18px">

        <div id="franchiseList"></div>
      </div>
    `;

    const franchiseForm = document.getElementById("franchiseForm");
    const nameInput = document.getElementById("franchiseName");
    const slugInput = document.getElementById("franchiseSlug");
    const saveButton = document.getElementById("franchiseSaveButton");
    const cancelButton = document.getElementById("franchiseCancelButton");
    const searchInput = document.getElementById("franchiseSearch");

    nameInput.addEventListener("input", () => {
      if (!slugTouched) {
        slugInput.value = makeSlug(nameInput.value);
      }
    });

    slugInput.addEventListener("input", () => {
      slugTouched = true;
    });

    searchInput.addEventListener("input", renderFranchiseList);

    cancelButton.addEventListener("click", resetFranchiseForm);

    franchiseForm.addEventListener("submit", async event => {
      event.preventDefault();

      const name = nameInput.value.trim();
      const slug = makeSlug(slugInput.value);
      const franchiseMessage = document.getElementById("franchiseMessage");

      if (!name || !slug) {
        franchiseMessage.textContent = "Please enter the franchise name and slug.";
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
      franchiseMessage.textContent = "";

      try {
        let result;

        if (editingId) {
          result = await db
            .from("organizations")
            .update({ name, slug })
            .eq("id", editingId);
        } else {
          result = await db
            .from("organizations")
            .insert({ name, slug });
        }

        if (result.error) throw result.error;

        franchiseMessage.textContent = editingId
          ? "Franchise updated successfully."
          : "New franchise created successfully.";

        franchiseMessage.style.color = "#15803d";

        resetFranchiseForm();
        await loadFranchises();

      } catch (error) {
        franchiseMessage.textContent =
          error.message || "Could not save franchise.";
        franchiseMessage.style.color = "#dc2626";
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = editingId ? "Update Franchise" : "Add Franchise";
      }
    });

    renderFranchiseList();
  }

  function resetFranchiseForm() {
    editingId = null;
    slugTouched = false;

    const franchiseForm = document.getElementById("franchiseForm");
    if (!franchiseForm) return;

    franchiseForm.reset();

    document.getElementById("franchiseId").value = "";
    document.getElementById("franchiseSaveButton").textContent = "Add Franchise";
    document.getElementById("franchiseCancelButton").style.display = "none";
  }

  function renderFranchiseList() {
    const list = document.getElementById("franchiseList");
    if (!list) return;

    const search = (
      document.getElementById("franchiseSearch").value || ""
    ).toLowerCase().trim();

    const filtered = franchises.filter(franchise =>
      franchise.name.toLowerCase().includes(search) ||
      franchise.slug.toLowerCase().includes(search)
    );

    if (!filtered.length) {
      list.innerHTML = "<p>No franchises found.</p>";
      return;
    }

    list.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="text-align:left;background:#eef2f8">
              <th style="padding:12px">Franchise Name</th>
              <th style="padding:12px">Slug</th>
              <th style="padding:12px">Created</th>
              <th style="padding:12px">Action</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(franchise => `
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:12px">${escapeHTML(franchise.name)}</td>
                <td style="padding:12px">${escapeHTML(franchise.slug)}</td>
                <td style="padding:12px">
                  ${franchise.created_at
                    ? escapeHTML(new Date(franchise.created_at).toLocaleDateString())
                    : "—"}
                </td>
                <td style="padding:12px">
                  <button type="button"
                    data-edit-franchise="${escapeHTML(franchise.id)}"
                    style="padding:8px 14px;cursor:pointer">
                    Edit
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    list.querySelectorAll("[data-edit-franchise]").forEach(editButton => {
      editButton.addEventListener("click", () => {
        const franchise = franchises.find(item =>
          item.id === editButton.dataset.editFranchise
        );

        if (!franchise) return;

        editingId = franchise.id;
        slugTouched = true;

        document.getElementById("franchiseName").value = franchise.name;
        document.getElementById("franchiseSlug").value = franchise.slug;
        document.getElementById("franchiseSaveButton").textContent =
          "Update Franchise";
        document.getElementById("franchiseCancelButton").style.display =
          "inline-block";

        document.getElementById("franchiseMessage").textContent =
          "Editing: " + franchise.name;

        document.getElementById("franchiseForm").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      });
    });
  }

  async function showOverview() {
    content.innerHTML = "<p>Loading dashboard...</p>";

    const { data, error } = await db
      .from("organizations")
      .select("id");

    if (error) {
      content.innerHTML =
        `<p style="color:#dc2626">Dashboard error: ${escapeHTML(error.message)}</p>`;
      return;
    }

    franchises = data || [];

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px">
        <div style="background:white;padding:24px;border-radius:12px;border:1px solid #e5eaf1">
          <p style="color:#64748b">Registered Franchises</p>
          <h1 style="font-size:32px;color:#1764d5">${franchises.length}</h1>
          <span style="color:#64748b;font-size:12px">Total registered businesses</span>
        </div>

        <div style="background:white;padding:24px;border-radius:12px;border:1px solid #e5eaf1">
          <p style="color:#64748b">Seller Management</p>
          <h2>Coming Soon</h2>
          <span style="color:#64748b;font-size:12px">Seller network management</span>
        </div>

        <div style="background:white;padding:24px;border-radius:12px;border:1px solid #e5eaf1">
          <p style="color:#64748b">Courier Partners</p>
          <h2>Coming Soon</h2>
          <span style="color:#64748b;font-size:12px">Courier network management</span>
        </div>

        <div style="background:white;padding:24px;border-radius:12px;border:1px solid #e5eaf1">
          <p style="color:#64748b">All Shipments</p>
          <h2>Coming Soon</h2>
          <span style="color:#64748b;font-size:12px">Platform-wide shipment overview</span>
        </div>
      </div>

      <div style="background:white;padding:24px;border-radius:12px;margin-top:22px">
        <h2>Welcome to TeraShip Control Center</h2>
        <p style="color:#64748b">
          Manage franchises, sellers, courier partners and shipping operations from one platform.
        </p>
      </div>
    `;
  }

  function showComingSoon(title) {
    content.innerHTML = `
      <div style="background:white;padding:30px;border-radius:12px">
        <h2>${escapeHTML(title)}</h2>
        <p style="color:#64748b">This module is planned and will be connected to the database in the next development stage.</p>
      </div>
    `;
  }

async function loadSellers() {
  content.innerHTML = "<p>Loading sellers...</p>";

  const { data, error } = await db
    .from("sellers")
    .select("id, business_name, contact_person, email, phone, city, state, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    content.innerHTML = `
      <p style="color:#dc2626">
        Could not load sellers: ${escapeHTML(error.message)}
      </p>`;
    return;
  }

  renderSellers(data || []);
}

function renderSellers(sellers) {
  content.innerHTML = `
    <div style="background:white;padding:24px;border-radius:12px;margin-bottom:20px">
      <h2 style="margin-top:0">Seller Management</h2>
      <p>Manage direct TeraShip seller registrations and approvals.</p>

      <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0">
        <div><strong>${sellers.length}</strong><br>Total Sellers</div>
        <div><strong>${sellers.filter(s => s.status === "pending").length}</strong><br>Pending</div>
        <div><strong>${sellers.filter(s => s.status === "approved").length}</strong><br>Approved</div>
        <div><strong>${sellers.filter(s => s.status === "rejected").length}</strong><br>Rejected</div>
      </div>

      <input id="sellerSearch" type="search"
        placeholder="Search business, contact, email or phone..."
        style="width:100%;box-sizing:border-box;padding:12px;margin-bottom:18px">

      <div id="sellerList"></div>
    </div>
  `;

  const searchInput = document.getElementById("sellerSearch");

  function displayList() {
    const search = searchInput.value.toLowerCase().trim();

    const filtered = sellers.filter(s =>
      [s.business_name, s.contact_person, s.email, s.phone]
        .some(value => String(value || "").toLowerCase().includes(search))
    );

    const list = document.getElementById("sellerList");

    if (!filtered.length) {
      list.innerHTML = "<p>No sellers found.</p>";
      return;
    }

    list.innerHTML = `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:850px">
          <thead>
            <tr style="background:#eef2f8;text-align:left">
              <th style="padding:12px">Business</th>
              <th style="padding:12px">Contact</th>
              <th style="padding:12px">Email / Phone</th>
              <th style="padding:12px">Location</th>
              <th style="padding:12px">Status</th>
              <th style="padding:12px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(s => `
              <tr style="border-bottom:1px solid #e5e7eb">
                <td style="padding:12px">${escapeHTML(s.business_name)}</td>
                <td style="padding:12px">${escapeHTML(s.contact_person)}</td>
                <td style="padding:12px">
                  ${escapeHTML(s.email)}<br>
                  ${escapeHTML(s.phone)}
                </td>
                <td style="padding:12px">
                  ${escapeHTML([s.city, s.state].filter(Boolean).join(", ") || "—")}
                </td>
                <td style="padding:12px">
                  <strong>${escapeHTML(s.status)}</strong>
                </td>
                <td style="padding:12px;white-space:nowrap">
                  ${s.status === "pending" ? `
                    <button data-seller-id="${escapeHTML(s.id)}"
                      data-seller-status="approved">Approve</button>
                    <button data-seller-id="${escapeHTML(s.id)}"
                      data-seller-status="rejected">Reject</button>
                  ` : s.status === "approved" ? `
                    <button data-seller-id="${escapeHTML(s.id)}"
                      data-seller-status="suspended">Suspend</button>
                  ` : `
                    <button data-seller-id="${escapeHTML(s.id)}"
                      data-seller-status="approved">Approve</button>
                  `}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    list.querySelectorAll("[data-seller-id]").forEach(actionButton => {
      actionButton.addEventListener("click", async () => {
        const sellerId = actionButton.dataset.sellerId;
        const newStatus = actionButton.dataset.sellerStatus;

        if (!confirm(`Are you sure you want to ${newStatus} this seller?`)) {
          return;
        }

        actionButton.disabled = true;
        actionButton.textContent = "Updating...";

        const { error } = await db
          .from("sellers")
          .update({
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", sellerId);

        if (error) {
          alert("Could not update seller: " + error.message);
          actionButton.disabled = false;
          actionButton.textContent =
            newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
          return;
        }

        alert("Seller status updated successfully.");
        await loadSellers();
      });
    });
  }

  searchInput.addEventListener("input", displayList);
  displayList();
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

        await showOverview();

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

  const menuTitles = {
    overview: "Overview",
    franchises: "Franchise Management",
    sellers: "Seller Management",
    couriers: "Courier Partners",
    shipments: "All Shipments",
    tracking: "Live Tracking",
    cod: "COD & Wallet",
    billing: "Billing & Invoices",
    subscriptions: "Subscriptions",
    reports: "Reports & Analytics",
    settings: "Settings"
  };

  document.querySelectorAll(".super-nav-item").forEach(item => {
    item.addEventListener("click", async () => {
      const view = item.dataset.view;
      if (!view) return;

      document.querySelectorAll(".super-nav-item").forEach(nav => {
        nav.classList.remove("active");
      });

      item.classList.add("active");

      const title = menuTitles[view] || "TeraShip";
      document.getElementById("superPageTitle").textContent = title;

      if (view === "overview") {
        await showOverview();
      } else if (view === "franchises") {
        await loadFranchises();
      } else if (view === "sellers") {
        await loadSellers();
      } else {
        showComingSoon(title);
      }
    });
  });

  checkSession();
});
