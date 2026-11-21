
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
  let sellers = [];
  let sellerShipments = [];
  let sellerMap = {};
  let courierMap = {};

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
    if (!message) return;
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

    const userLabel = document.getElementById("superAdminUser");
    if (userLabel) {
      userLabel.textContent = "Signed in: " + user.email;
    }

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
      sellers: "Seller Management",
      "seller-shipments": "Seller Shipments",
      shipments: "All Shipments",
      tracking: "Live Tracking",
      franchises: "Franchise Management",
      couriers: "Courier Partners",
      cod: "COD & Wallet",
      billing: "Billing & Invoices",
      subscriptions: "Subscriptions",
      reports: "Reports & Analytics",
      settings: "Settings"
    };

    if (pageTitle) {
      pageTitle.textContent = titles[view] || "Platform Management";
    }

    if (view === "overview") {
      renderOverview();
      return;
    }

    if (view === "sellers") {
      await loadSellerManagement();
      return;
    }

    if (view === "seller-shipments") {
      await loadSellerShipments();
      return;
    }

    content.innerHTML = `
      <div class="super-panel">
        <h3>${escapeHTML(titles[view] || "Platform Management")}</h3>
        <p>This section will be connected in the next upgrade.</p>
      </div>
    `;
  }

  function renderOverview() {
    content.innerHTML = `
      <div class="super-panel">
        <h2>Welcome to TeraShip</h2>
        <p>Platform Control Center</p>
        <p>Super Admin authentication successful.</p>
        <div class="super-dashboard-actions">
          <button type="button" id="openSellers">Manage Sellers</button>
          <button type="button" id="openShipments">Seller Shipments</button>
        </div>
      </div>
    `;

    document.getElementById("openSellers")
      .addEventListener("click", () => showView("sellers"));

    document.getElementById("openShipments")
      .addEventListener("click", () => showView("seller-shipments"));
  }

  async function loadSellerManagement() {
    content.innerHTML = `
      <div class="super-panel">
        <p>Loading seller records...</p>
      </div>
    `;

    const { data, error } = await db
      .from("sellers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      content.innerHTML = `
        <div class="super-panel">
          <h3>Could not load sellers</h3>
          <p>${escapeHTML(error.message)}</p>
          <button type="button" id="retrySellers">Retry</button>
        </div>
      `;

      document.getElementById("retrySellers")
        .addEventListener("click", loadSellerManagement);
      return;
    }

    sellers = data || [];
    renderSellerManagement();
  }

  function renderSellerManagement() {
    const pending = sellers.filter(s => s.status === "pending").length;
    const approved = sellers.filter(s => s.status === "approved").length;
    const rejected = sellers.filter(s => s.status === "rejected").length;

    const rows = sellers.map(seller => `
      <tr>
        <td><strong>${escapeHTML(seller.business_name)}</strong></td>
        <td>${escapeHTML(seller.contact_person)}</td>
        <td>${escapeHTML(seller.phone)}</td>
        <td>${escapeHTML(seller.email)}</td>
        <td>
          <span class="seller-status-badge ${escapeHTML(seller.status)}">
            ${escapeHTML(seller.status.toUpperCase())}
          </span>
        </td>
        <td>
          <button type="button"
            class="view-seller-btn"
            data-id="${escapeHTML(seller.id)}">View</button>
          ${seller.status !== "approved" ? `
            <button type="button"
              class="approve-seller-btn"
              data-id="${escapeHTML(seller.id)}">Approve</button>
          ` : ""}
          ${seller.status !== "rejected" ? `
            <button type="button"
              class="reject-seller-btn"
              data-id="${escapeHTML(seller.id)}">Reject</button>
          ` : ""}
        </td>
      </tr>
    `).join("");

    content.innerHTML = `
      <div class="super-panel">
        <div class="seller-heading">
          <div>
            <h2>Seller Management</h2>
            <p>Manage registrations and seller approval.</p>
          </div>
          <button type="button" id="refreshSellers">Refresh</button>
        </div>

        <div class="seller-stat-grid">
          <div class="seller-stat">
            <span>Total Sellers</span>
            <strong>${sellers.length}</strong>
          </div>
          <div class="seller-stat">
            <span>Pending</span>
            <strong>${pending}</strong>
          </div>
          <div class="seller-stat">
            <span>Approved</span>
            <strong>${approved}</strong>
          </div>
          <div class="seller-stat">
            <span>Rejected</span>
            <strong>${rejected}</strong>
          </div>
        </div>

        <input id="sellerSearch"
          type="search"
          placeholder="Search business, contact, phone or email...">

        <select id="sellerStatusFilter">
          <option value="all">All Sellers</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <div class="seller-table-wrap">
          <table class="seller-management-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="sellerManagementRows">
              ${rows || `<tr><td colspan="6">No sellers found.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div id="sellerProfileDetails"></div>
        <p id="sellerActionMessage" role="status"></p>
      </div>
    `;

    document.getElementById("refreshSellers")
      .addEventListener("click", loadSellerManagement);

    document.getElementById("sellerSearch")
      .addEventListener("input", filterSellerRows);

    document.getElementById("sellerStatusFilter")
      .addEventListener("change", filterSellerRows);

    document.querySelectorAll(".view-seller-btn").forEach(btn => {
      btn.addEventListener("click", () => viewSellerProfile(btn.dataset.id));
    });

    document.querySelectorAll(".approve-seller-btn").forEach(btn => {
      btn.addEventListener("click", () => changeSellerStatus(btn.dataset.id, "approved"));
    });

    document.querySelectorAll(".reject-seller-btn").forEach(btn => {
      btn.addEventListener("click", () => changeSellerStatus(btn.dataset.id, "rejected"));
    });

    filterSellerRows();
  }

  function filterSellerRows() {
    const search = document.getElementById("sellerSearch");
    const filter = document.getElementById("sellerStatusFilter");
    const term = search.value.toLowerCase();
    const selectedStatus = filter.value;

    const filtered = sellers.filter(seller => {
      const text = [
        seller.business_name,
        seller.contact_person,
        seller.phone,
        seller.email,
        seller.city
      ].join(" ").toLowerCase();

      return text.includes(term) &&
        (selectedStatus === "all" || seller.status === selectedStatus);
    });

    document.getElementById("sellerManagementRows").innerHTML =
      filtered.length
        ? filtered.map(seller => `
          <tr>
            <td><strong>${escapeHTML(seller.business_name)}</strong></td>
            <td>${escapeHTML(seller.contact_person)}</td>
            <td>${escapeHTML(seller.phone)}</td>
            <td>${escapeHTML(seller.email)}</td>
            <td>
              <span class="seller-status-badge ${escapeHTML(seller.status)}">
                ${escapeHTML(seller.status.toUpperCase())}
              </span>
            </td>
            <td>
              <button type="button" class="view-seller-btn"
                data-id="${escapeHTML(seller.id)}">View</button>
              ${seller.status !== "approved" ? `
                <button type="button" class="approve-seller-btn"
                  data-id="${escapeHTML(seller.id)}">Approve</button>
              ` : ""}
              ${seller.status !== "rejected" ? `
                <button type="button" class="reject-seller-btn"
                  data-id="${escapeHTML(seller.id)}">Reject</button>
              ` : ""}
            </td>
          </tr>
        `).join("")
        : `<tr><td colspan="6">No matching sellers found.</td></tr>`;

    document.querySelectorAll(".view-seller-btn").forEach(btn => {
      btn.addEventListener("click", () => viewSellerProfile(btn.dataset.id));
    });

    document.querySelectorAll(".approve-seller-btn").forEach(btn => {
      btn.addEventListener("click", () => changeSellerStatus(btn.dataset.id, "approved"));
    });

    document.querySelectorAll(".reject-seller-btn").forEach(btn => {
      btn.addEventListener("click", () => changeSellerStatus(btn.dataset.id, "rejected"));
    });
  }

  function viewSellerProfile(id) {
    const seller = sellers.find(item => item.id === id);
    if (!seller) return;

    const details = document.getElementById("sellerProfileDetails");

    details.innerHTML = `
      <div class="seller-profile-card">
        <h3>Seller Profile</h3>
        <p><strong>Business:</strong> ${escapeHTML(seller.business_name)}</p>
        <p><strong>Contact:</strong> ${escapeHTML(seller.contact_person)}</p>
        <p><strong>Email:</strong> ${escapeHTML(seller.email)}</p>
        <p><strong>Phone:</strong> ${escapeHTML(seller.phone)}</p>
        <p><strong>Pickup Address:</strong> ${escapeHTML(seller.pickup_address || "—")}</p>
        <p><strong>City:</strong> ${escapeHTML(seller.city || "—")}</p>
        <p><strong>State:</strong> ${escapeHTML(seller.state || "—")}</p>
        <p><strong>Pincode:</strong> ${escapeHTML(seller.pincode || "—")}</p>
        <p><strong>GST Number:</strong> ${escapeHTML(seller.gst_number || "—")}</p>
        <p><strong>Status:</strong> ${escapeHTML(seller.status)}</p>
        <p><strong>Registered:</strong> ${
          seller.created_at
            ? escapeHTML(new Date(seller.created_at).toLocaleString())
            : "—"
        }</p>
        <button type="button" id="closeSellerProfile">Close Profile</button>
      </div>
    `;

    document.getElementById("closeSellerProfile")
      .addEventListener("click", () => {
        details.innerHTML = "";
      });

    details.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function changeSellerStatus(id, newStatus) {
    if (!["approved", "rejected"].includes(newStatus)) return;

    const seller = sellers.find(item => item.id === id);
    if (!seller) return;

    const action = newStatus === "approved" ? "approve" : "reject";

    if (!confirm(
      `Are you sure you want to ${action} ${seller.business_name}?`
    )) return;

    const statusMessage = document.getElementById("sellerActionMessage");
    statusMessage.textContent = "Updating seller status...";
    statusMessage.style.color = "#174b88";

    const { error } = await db
      .from("sellers")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      statusMessage.textContent = "Could not update seller: " + error.message;
      statusMessage.style.color = "#dc2626";
      return;
    }

    statusMessage.textContent =
      seller.business_name + " has been " + newStatus + ".";
    statusMessage.style.color = "#15803d";

    await loadSellerManagement();
  }

  async function loadSellerShipments() {
    content.innerHTML = `
      <div class="super-panel">
        <p>Loading seller shipments...</p>
      </div>
    `;

    const { data, error } = await db
      .from("seller_shipments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      content.innerHTML = `
        <div class="super-panel">
          <h3>Could not load seller shipments</h3>
          <p>${escapeHTML(error.message)}</p>
          <button type="button" id="retryShipments">Retry</button>
        </div>
      `;

      document.getElementById("retryShipments")
        .addEventListener("click", loadSellerShipments);
      return;
    }

    sellerShipments = data || [];

    const sellerIds = [...new Set(
      sellerShipments.map(x => x.seller_id).filter(Boolean)
    )];

    const courierIds = [...new Set(
      sellerShipments.map(x => x.courier_id).filter(Boolean)
    )];

    let sellersData = [];
    let couriersData = [];

    if (sellerIds.length) {
      const result = await db
        .from("sellers")
        .select("id,business_name,contact_person,email,phone")
        .in("id", sellerIds);

      if (result.error) {
        content.innerHTML = `
          <div class="super-panel">
            <h3>Could not load seller details</h3>
            <p>${escapeHTML(result.error.message)}</p>
          </div>
        `;
        return;
      }

      sellersData = result.data || [];
    }

    if (courierIds.length) {
      const result = await db
        .from("platform_couriers")
        .select("id,name")
        .in("id", courierIds);

      if (result.error) {
        content.innerHTML = `
          <div class="super-panel">
            <h3>Could not load courier details</h3>
            <p>${escapeHTML(result.error.message)}</p>
          </div>
        `;
        return;
      }

      couriersData = result.data || [];
    }

    sellerMap = Object.fromEntries(
      sellersData.map(s => [s.id, s])
    );

    courierMap = Object.fromEntries(
      couriersData.map(c => [c.id, c])
    );

    renderSellerShipments();
  }

  function renderSellerShipments() {
    const rows = sellerShipments.map(shipment => {
      const seller = sellerMap[shipment.seller_id] || {};
      const courier = courierMap[shipment.courier_id] || {};

      return `
        <tr>
          <td><strong>${escapeHTML(shipment.awb_number)}</strong></td>
          <td>
            ${escapeHTML(seller.business_name || "Seller")}
            <br><small>${escapeHTML(seller.contact_person || "")}</small>
          </td>
          <td>
            ${escapeHTML(shipment.receiver_name)}
            <br><small>${escapeHTML(shipment.receiver_phone)}</small>
          </td>
          <td>${escapeHTML(courier.name || shipment.service_name || "—")}</td>
          <td>${escapeHTML(shipment.parcel_weight)} KG</td>
          <td>
            <span class="seller-status-badge">
              ${escapeHTML(shipment.status)}
            </span>
          </td>
          <td>
            <button type="button" class="manage-seller-shipment"
              data-id="${escapeHTML(shipment.id)}">Manage</button>
          </td>
        </tr>
      `;
    }).join("");

    content.innerHTML = `
      <div class="super-panel">
        <div class="seller-heading">
          <div>
            <h2>Seller Shipments</h2>
            <p>Total bookings: ${sellerShipments.length}</p>
          </div>
          <button type="button" id="refreshSellerShipments">Refresh</button>
        </div>

        <input id="sellerShipmentSearch" type="search"
          placeholder="Search AWB, seller or receiver...">

        <div class="seller-table-wrap">
          <table class="seller-management-table">
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
              ${rows || `<tr><td colspan="7">No seller shipments found.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div id="sellerShipmentDetails"></div>
      </div>
    `;

    document.getElementById("refreshSellerShipments")
      .addEventListener("click", loadSellerShipments);

    document.getElementById("sellerShipmentSearch")
      .addEventListener("input", event => {
        const term = event.target.value.toLowerCase();

        document.querySelectorAll("#sellerShipmentRows tr").forEach(row => {
          row.style.display = row.textContent.toLowerCase().includes(term)
            ? ""
            : "none";
        });
      });

    document.querySelectorAll(".manage-seller-shipment").forEach(btn => {
      btn.addEventListener("click", () => {
        openShipmentDetails(btn.dataset.id);
      });
    });
  }

  async function openShipmentDetails(id) {
    const shipment = sellerShipments.find(x => x.id === id);
    if (!shipment) return;

    const seller = sellerMap[shipment.seller_id] || {};
    const courier = courierMap[shipment.courier_id] || {};

    const details = document.getElementById("sellerShipmentDetails");

    details.innerHTML = `
      <div class="seller-profile-card">
        <h3>Manage Shipment: ${escapeHTML(shipment.awb_number)}</h3>

        <p><strong>Seller:</strong> ${escapeHTML(seller.business_name || "—")}</p>
        <p><strong>Contact:</strong> ${escapeHTML(seller.contact_person || "—")}</p>
        <p><strong>Receiver:</strong> ${escapeHTML(shipment.receiver_name || "—")}</p>
        <p><strong>Receiver Phone:</strong> ${escapeHTML(shipment.receiver_phone || "—")}</p>
        <p><strong>Receiver Address:</strong>
          ${escapeHTML(shipment.receiver_address || "")},
          ${escapeHTML(shipment.receiver_city || "")},
          ${escapeHTML(shipment.receiver_state || "")}
          - ${escapeHTML(shipment.receiver_pincode || "")}
        </p>
        <p><strong>Courier:</strong> ${escapeHTML(courier.name || shipment.service_name || "—")}</p>
        <p><strong>Payment:</strong> ${escapeHTML(shipment.payment_mode || "—")}</p>

        <form id="sellerTrackingForm">
          <label>Shipment Status</label>
          <select id="sellerNewStatus" required>
            ${statuses.map(status => `
              <option value="${status}"
                ${shipment.status === status ? "selected" : ""}>
                ${status.replaceAll("_", " ").toUpperCase()}
              </option>
            `).join("")}
          </select>

          <label>Current Location</label>
          <input id="sellerTrackingLocation"
            placeholder="Example: Ranchi Hub" required>

          <label>Tracking Remarks</label>
          <textarea id="sellerTrackingRemarks"
            placeholder="Enter shipment update..." required></textarea>

          <button type="submit" id="saveSellerTracking">
            Save Tracking Update
          </button>
          <p id="sellerTrackingMessage" role="status"></p>
        </form>
      </div>
    `;

    document.getElementById("sellerTrackingForm")
      .addEventListener("submit", async event => {
        event.preventDefault();

        const saveButton = document.getElementById("saveSellerTracking");
        const statusMessage = document.getElementById("sellerTrackingMessage");

        const newStatus = document.getElementById("sellerNewStatus").value;
        const location = document.getElementById("sellerTrackingLocation").value.trim();
        const remarks = document.getElementById("sellerTrackingRemarks").value.trim();

        if (!location || !remarks) {
          statusMessage.textContent = "Enter location and tracking remarks.";
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
              location,
              remarks
            });

          if (eventError) {
            throw new Error(
              "Shipment status was updated, but tracking history could not be saved: " +
              eventError.message
            );
          }

          alert("Tracking update saved successfully.");
          await loadSellerShipments();

        } catch (error) {
          statusMessage.textContent = error.message || "Could not save tracking update.";
          statusMessage.style.color = "#dc2626";
          saveButton.disabled = false;
          saveButton.textContent = "Save Tracking Update";
        }
      });

    details.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addSuperAdminStyles() {
    if (document.getElementById("superAdminV2Styles")) return;

    const style = document.createElement("style");
    style.id = "superAdminV2Styles";

    style.textContent = `
      .super-panel {
        background: #fff;
        padding: 24px;
        border-radius: 14px;
        box-shadow: 0 4px 18px rgba(15, 23, 42, .06);
        margin-bottom: 20px;
      }

      .super-panel h2,
      .super-panel h3 {
        color: #172b4d;
        margin-top: 0;
      }

      .super-panel p {
        color: #64748b;
      }

      .seller-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 20px;
      }

      .seller-stat-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(120px, 1fr));
        gap: 14px;
        margin: 20px 0;
      }

      .seller-stat {
        padding: 18px;
        background: #f1f5fb;
        border-radius: 11px;
      }

      .seller-stat span {
        display: block;
        color: #64748b;
        font-size: 13px;
      }

      .seller-stat strong {
        display: block;
        margin-top: 7px;
        font-size: 25px;
        color: #174b88;
      }

      .super-panel input,
      .super-panel select,
      .super-panel textarea {
        box-sizing: border-box;
        padding: 11px 13px;
        border: 1px solid #d7deea;
        border-radius: 8px;
        font: inherit;
        margin: 7px 0 14px;
      }

      #sellerSearch,
      #sellerStatusFilter,
      #sellerShipmentSearch {
        max-width: 100%;
      }

      #sellerSearch,
      #sellerShipmentSearch {
        width: 100%;
      }

      .super-panel button {
        padding: 10px 15px;
        background: #174b88;
        color: white;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
        margin: 3px;
      }

      .super-panel button:hover {
        background: #103764;
      }

      .super-panel button:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .seller-table-wrap {
        width: 100%;
        overflow-x: auto;
        margin-top: 15px;
      }

      .seller-management-table {
        width: 100%;
        min-width: 850px;
        border-collapse: collapse;
      }

      .seller-management-table th,
      .seller-management-table td {
        text-align: left;
        padding: 13px 11px;
        border-bottom: 1px solid #e8edf4;
      }

      .seller-management-table th {
        background: #f8fafc;
        color: #475569;
        font-size: 13px;
      }

      .seller-management-table td {
        color: #334155;
        font-size: 13px;
      }

      .seller-status-badge {
        display: inline-block;
        padding: 5px 9px;
        border-radius: 20px;
        background: #e8f1ff;
        color: #174b88;
        font-size: 11px;
        font-weight: 700;
      }

      .seller-status-badge.approved {
        background: #dcfce7;
        color: #166534;
      }

      .seller-status-badge.pending {
        background: #fef3c7;
        color: #92400e;
      }

      .seller-status-badge.rejected {
        background: #fee2e2;
        color: #991b1b;
      }

      .seller-profile-card {
        margin-top: 22px;
        padding: 20px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        background: #f8fafc;
      }

      .seller-profile-card form {
        max-width: 600px;
        margin-top: 20px;
      }

      .seller-profile-card label {
        display: block;
        font-weight: 600;
        color: #334155;
      }

      .seller-profile-card input,
      .seller-profile-card select,
      .seller-profile-card textarea {
        display: block;
        width: 100%;
      }

      .seller-profile-card textarea {
        min-height: 90px;
      }

      .super-dashboard-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }

      @media(max-width: 700px) {
        .seller-stat-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .super-panel {
          padding: 15px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (!db) {
    showLogin();
    showMessage("Supabase connection is missing. Check supabase-config.js.");
    return;
  }

  if (!authScreen || !app || !form || !button ||
      !message || !signOut || !content || !pageTitle) {
    console.error("TeraShip Super Admin: Required HTML elements are missing.");
    return;
  }

  addSuperAdminStyles();

  document.querySelectorAll(".super-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      showView(item.dataset.view);
    });
  });

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
