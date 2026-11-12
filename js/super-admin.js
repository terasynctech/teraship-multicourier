
document.addEventListener("DOMContentLoaded", () => {
  const db = window.supabaseClient;

  const authScreen = document.getElementById("superAdminAuthScreen");
  const app = document.getElementById("superAdminApp");
  const form = document.getElementById("superAdminLoginForm");
  const button = document.getElementById("superAdminLoginButton");
  const message = document.getElementById("superAdminMessage");
  const signOut = document.getElementById("superAdminSignOut");
  const content = document.getElementById("superAdminContent");
  const pageTitle = document.getElementById("superPageTitle");

  let currentUser = null;
  let currentView = "overview";
  let sellerShipments = [];

  const statuses = [
    "booked",
    "picked_up",
    "in_transit",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "exception"
  ];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[char]);
  }

  function showMessage(text, isError = true) {
    message.textContent = text;
    message.style.color = isError ? "#dc2626" : "#15803d";
  }

  function showLogin() {
    authScreen.hidden = false;
    app.hidden = true;
  }

  function showApp() {
    authScreen.hidden = true;
    app.hidden = false;
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

    if (error || !data) {
      await db.auth.signOut();
      showLogin();

      showMessage(
        error
          ? "Could not verify Super Admin access: " + error.message
          : "Access denied. This account is not a registered Super Admin."
      );

      return false;
    }

    currentUser = user;
    showApp();

    document.getElementById("superAdminUser").textContent =
      "Signed in: " + user.email;

    await showView("overview");
    return true;
  }

  function setActiveMenu(view) {
    document.querySelectorAll(".super-nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.view === view);
    });
  }

  async function showView(view) {
    currentView = view;
    setActiveMenu(view);

    const titles = {
      overview: "Overview",
      "seller-shipments": "Seller Shipments",
      shipments: "All Shipments",
      tracking: "Live Tracking",
      sellers: "Seller Management",
      franchises: "Franchise Management",
      couriers: "Courier Partners",
      cod: "COD & Wallet",
      billing: "Billing & Invoices",
      subscriptions: "Subscriptions",
      reports: "Reports & Analytics",
      settings: "Settings"
    };

    pageTitle.textContent = titles[view] || "Platform Management";

    if (view === "seller-shipments") {
      await loadSellerShipments();
      return;
    }

    if (view === "overview") {
      content.innerHTML = `
        <div class="super-welcome">
          <div>
            <h2>Platform Dashboard</h2>
            <p>Super Admin authentication successful.</p>
            <p>Your platform administrator account is verified.</p>
          </div>
        </div>

        <button type="button" id="openSellerShipments">
          View Seller Shipments
        </button>
      `;

      document.getElementById("openSellerShipments")
        .addEventListener("click", () => {
          showView("seller-shipments");
        });

      return;
    }

    content.innerHTML = `
      <div style="background:white;padding:22px;border-radius:12px">
        <h3>${escapeHTML(titles[view] || "Platform Management")}</h3>
        <p>This section is not connected in this version.</p>
      </div>
    `;
  }

  async function loadSellerShipments() {
    content.innerHTML = `
      <div class="seller-admin-card">
        <p>Loading seller shipments...</p>
      </div>
    `;

    const { data, error } = await db
      .from("seller_shipments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      content.innerHTML = `
        <div class="seller-admin-card">
          <h3>Could not load seller shipments</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
      return;
    }

    sellerShipments = data || [];

    const sellerIds = [...new Set(
      sellerShipments.map(item => item.seller_id)
    )];

    const courierIds = [...new Set(
      sellerShipments.map(item => item.courier_id).filter(Boolean)
    )];

    let sellers = [];
    let couriers = [];

    if (sellerIds.length) {
      const result = await db
        .from("sellers")
        .select("id,business_name,contact_person,email,phone")
        .in("id", sellerIds);

      if (result.error) {
        content.innerHTML = `
          <div class="seller-admin-card">
            <h3>Could not load seller details</h3>
            <p>${escapeHTML(result.error.message)}</p>
          </div>
        `;
        return;
      }

      sellers = result.data || [];
    }

    if (courierIds.length) {
      const result = await db
        .from("platform_couriers")
        .select("id,name")
        .in("id", courierIds);

      if (result.error) {
        content.innerHTML = `
          <div class="seller-admin-card">
            <h3>Could not load courier details</h3>
            <p>${escapeHTML(result.error.message)}</p>
          </div>
        `;
        return;
      }

      couriers = result.data || [];
    }

    const sellerMap = Object.fromEntries(
      sellers.map(seller => [seller.id, seller])
    );

    const courierMap = Object.fromEntries(
      couriers.map(courier => [courier.id, courier])
    );

    renderSellerShipments(sellerMap, courierMap);
  }

  function renderSellerShipments(sellerMap, courierMap) {
    const rows = sellerShipments.map(shipment => {
      const seller = sellerMap[shipment.seller_id] || {};
      const courier = courierMap[shipment.courier_id] || {};

      return `
        <tr>
          <td>
            <strong>${escapeHTML(shipment.awb_number)}</strong>
          </td>

          <td>
            ${escapeHTML(seller.business_name || "Seller")}
            <br>
            <small>${escapeHTML(seller.contact_person || "")}</small>
          </td>

          <td>
            ${escapeHTML(shipment.receiver_name)}
            <br>
            <small>${escapeHTML(shipment.receiver_phone)}</small>
          </td>

          <td>
            ${escapeHTML(
              courier.name || shipment.service_name || "—"
            )}
          </td>

          <td>${escapeHTML(shipment.parcel_weight)} KG</td>

          <td>
            <span class="seller-status">
              ${escapeHTML(shipment.status)}
            </span>
          </td>

          <td>
            <button
              type="button"
              class="manage-seller-shipment"
              data-id="${escapeHTML(shipment.id)}">
              Manage
            </button>
          </td>
        </tr>
      `;
    }).join("");

    content.innerHTML = `
      <div class="seller-admin-card">

        <div class="seller-admin-heading">
          <div>
            <h2>Seller Shipments</h2>
            <p>Total bookings: ${sellerShipments.length}</p>
          </div>

          <button type="button" id="refreshSellerShipments">
            ↻ Refresh Shipments
          </button>
        </div>

        <input
          id="sellerShipmentSearch"
          type="search"
          placeholder="Search AWB, seller or receiver..."
          class="seller-search">

        <div style="overflow-x:auto">
          <table class="seller-table">
            <thead>
              <tr>
                <th>Internal AWB</th>
                <th>Seller</th>
                <th>Receiver</th>
                <th>Courier</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody id="sellerShipmentRows">
              ${rows || `
                <tr>
                  <td colspan="7">No seller shipments found.</td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <div id="sellerShipmentDetails" style="margin-top:24px"></div>
      </div>

      <style>
        .seller-admin-card {
          background: white;
          padding: 22px;
          border-radius: 12px;
          overflow: hidden;
        }

        .seller-admin-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .seller-search {
          width: 100%;
          padding: 12px;
          margin: 18px 0;
          border: 1px solid #d7deea;
          border-radius: 8px;
          box-sizing: border-box;
        }

        .seller-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 850px;
        }

        .seller-table td,
        .seller-table th {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e8edf4;
        }

        .seller-table small {
          color: #64748b;
        }

        .seller-status {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          background: #e8f1ff;
          color: #174b88;
          font-size: 12px;
          font-weight: 700;
        }

        .seller-admin-card button {
          padding: 10px 15px;
          border: 0;
          border-radius: 7px;
          background: #174b88;
          color: white;
          cursor: pointer;
        }

        .seller-admin-card button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        #sellerShipmentDetails input,
        #sellerShipmentDetails select,
        #sellerShipmentDetails textarea {
          display: block;
          width: 100%;
          padding: 11px;
          margin: 7px 0 14px;
          border: 1px solid #d7deea;
          border-radius: 7px;
          box-sizing: border-box;
        }
      </style>
    `;

    document.getElementById("refreshSellerShipments")
      .addEventListener("click", loadSellerShipments);

    document.getElementById("sellerShipmentSearch")
      .addEventListener("input", event => {
        const term = event.target.value.toLowerCase();

        document.querySelectorAll("#sellerShipmentRows tr")
          .forEach(row => {
            row.style.display =
              row.textContent.toLowerCase().includes(term)
                ? ""
                : "none";
          });
      });

    document.querySelectorAll(".manage-seller-shipment")
      .forEach(btn => {
        btn.addEventListener("click", () => {
          openShipmentDetails(
            btn.dataset.id,
            sellerMap,
            courierMap
          );
        });
      });
  }

  async function openShipmentDetails(id, sellerMap, courierMap) {
    const shipment = sellerShipments.find(item => item.id === id);
    if (!shipment) return;

    const seller = sellerMap[shipment.seller_id] || {};
    const courier = courierMap[shipment.courier_id] || {};

    const details = document.getElementById("sellerShipmentDetails");

    details.innerHTML = `
      <hr>

      <h3>Manage Shipment: ${escapeHTML(shipment.awb_number)}</h3>

      <p><strong>Seller:</strong>
        ${escapeHTML(seller.business_name || "—")}
      </p>

      <p><strong>Contact:</strong>
        ${escapeHTML(seller.contact_person || "—")}
      </p>

      <p><strong>Seller Phone:</strong>
        ${escapeHTML(seller.phone || "—")}
      </p>

      <p><strong>Receiver:</strong>
        ${escapeHTML(shipment.receiver_name)}
      </p>

      <p><strong>Receiver Phone:</strong>
        ${escapeHTML(shipment.receiver_phone)}
      </p>

      <p><strong>Receiver Address:</strong>
        ${escapeHTML(shipment.receiver_address)},
        ${escapeHTML(shipment.receiver_city)},
        ${escapeHTML(shipment.receiver_state)}
        - ${escapeHTML(shipment.receiver_pincode)}
      </p>

      <p><strong>Courier:</strong>
        ${escapeHTML(courier.name || "—")}
      </p>

      <p><strong>Payment:</strong>
        ${escapeHTML(shipment.payment_mode)}
      </p>

      <form id="sellerTrackingForm">

        <label for="sellerNewStatus">Shipment Status</label>

        <select id="sellerNewStatus" required>
          ${statuses.map(status => `
            <option
              value="${status}"
              ${shipment.status === status ? "selected" : ""}>
              ${status.replaceAll("_", " ").toUpperCase()}
            </option>
          `).join("")}
        </select>

        <label for="sellerTrackingLocation">Current Location</label>

        <input
          id="sellerTrackingLocation"
          placeholder="Example: Ranchi Hub"
          required>

        <label for="sellerTrackingRemarks">Tracking Remarks</label>

        <textarea
          id="sellerTrackingRemarks"
          placeholder="Enter shipment update..."
          required></textarea>

        <button type="submit" id="saveSellerTracking">
          Save Tracking Update
        </button>

        <p id="sellerTrackingMessage" role="status"></p>
      </form>
    `;

    document.getElementById("sellerTrackingForm")
      .addEventListener("submit", async event => {
        event.preventDefault();

        const saveButton =
          document.getElementById("saveSellerTracking");

        const statusMessage =
          document.getElementById("sellerTrackingMessage");

        const newStatus =
          document.getElementById("sellerNewStatus").value;

        const location =
          document.getElementById("sellerTrackingLocation")
            .value.trim();

        const remarks =
          document.getElementById("sellerTrackingRemarks")
            .value.trim();

        if (!location || !remarks) {
          statusMessage.textContent =
            "Enter location and tracking remarks.";
          return;
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
          const { error: updateError } = await db
            .from("seller_shipments")
            .update({
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq("id", shipment.id);

          if (updateError) throw updateError;

          const { error: eventError } = await db
            .from("seller_tracking_events")
            .insert({
              seller_shipment_id: shipment.id,
              status: newStatus,
              location: location,
              remarks: remarks
            });

          if (eventError) {
            throw new Error(
              "Status updated, but tracking event could not be saved: " +
              eventError.message
            );
          }

          statusMessage.textContent =
            "Tracking update saved successfully.";

          statusMessage.style.color = "#15803d";

          await loadSellerShipments();

        } catch (error) {
          statusMessage.textContent =
            error.message || "Could not save update.";

          statusMessage.style.color = "#dc2626";

          saveButton.disabled = false;
          saveButton.textContent = "Save Tracking Update";
        }
      });

    details.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (!db) {
    showLogin();
    showMessage(
      "Supabase connection is missing. Check supabase-config.js."
    );
    return;
  }

  // Sidebar navigation
  document.querySelectorAll(".super-nav-item")
    .forEach(item => {
      item.addEventListener("click", () => {
        showView(item.dataset.view);
      });
    });

  // Super Admin login
  form.addEventListener("submit", async event => {
    event.preventDefault();

    button.disabled = true;
    button.textContent = "Verifying access...";

    try {
      const email =
        document.getElementById("superAdminEmail").value.trim();

      const password =
        document.getElementById("superAdminPassword").value;

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

  // Sign out
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

  // Restore login session
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
