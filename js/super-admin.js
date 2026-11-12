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
  let courierRates = [];
  let platformCouriers = [];
  let editingRateId = null;

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
      "courier-rates": "Courier Rate Management",
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

    if (view === "courier-rates") {
      await loadCourierRates();
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

        <button type="button" id="openCourierRates">
          Manage Courier Rates
        </button>
      `;

      document.getElementById("openSellerShipments")
        .addEventListener("click", () => showView("seller-shipments"));

      document.getElementById("openCourierRates")
        .addEventListener("click", () => showView("courier-rates"));

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
      <div style="background:white;padding:22px;border-radius:12px">
        <p>Loading seller shipments...</p>
      </div>
    `;

    const { data, error } = await db
      .from("seller_shipments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      content.innerHTML = `
        <div style="background:white;padding:22px;border-radius:12px">
          <h3>Could not load seller shipments</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
      return;
    }

    sellerShipments = data || [];

    const sellerIds = [...new Set(sellerShipments.map(x => x.seller_id))];
    const courierIds = [...new Set(
      sellerShipments.map(x => x.courier_id).filter(Boolean)
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
          <div style="background:white;padding:22px;border-radius:12px">
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
          <div style="background:white;padding:22px;border-radius:12px">
            <h3>Could not load courier details</h3>
            <p>${escapeHTML(result.error.message)}</p>
          </div>
        `;
        return;
      }

      couriers = result.data || [];
    }

    const sellerMap = Object.fromEntries(sellers.map(s => [s.id, s]));
    const courierMap = Object.fromEntries(couriers.map(c => [c.id, c]));

    renderSellerShipments(sellerMap, courierMap);
  }

  function renderSellerShipments(sellerMap, courierMap) {
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
          <td><span class="seller-status">${escapeHTML(shipment.status)}</span></td>
          <td>
            <button type="button" class="manage-seller-shipment"
              data-id="${escapeHTML(shipment.id)}">Manage</button>
          </td>
        </tr>
      `;
    }).join("");

    content.innerHTML = `
      <div style="background:white;padding:22px;border-radius:12px">
        <div style="display:flex;justify-content:space-between;
          align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h2>Seller Shipments</h2>
            <p>Total bookings: ${sellerShipments.length}</p>
          </div>
          <button type="button" id="refreshSellerShipments">
            ↻ Refresh Shipments
          </button>
        </div>

        <input id="sellerShipmentSearch" type="search"
          placeholder="Search AWB, seller or receiver..."
          style="width:100%;padding:12px;margin:18px 0;
          border:1px solid #d7deea;border-radius:8px">

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:850px">
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

        <div id="sellerShipmentDetails" style="margin-top:24px"></div>
      </div>

      <style>
        #sellerShipmentRows td,
        #sellerShipmentRows th {
          padding:12px;text-align:left;border-bottom:1px solid #e8edf4;
        }
        #sellerShipmentRows small { color:#64748b; }
        .seller-status {
          display:inline-block;padding:5px 9px;border-radius:20px;
          background:#e8f1ff;color:#174b88;font-size:12px;font-weight:700;
        }
        .manage-seller-shipment,#refreshSellerShipments {
          padding:9px 13px;border:0;border-radius:7px;
          background:#174b88;color:white;cursor:pointer;
        }
        #sellerShipmentDetails input,
        #sellerShipmentDetails select,
        #sellerShipmentDetails textarea {
          width:100%;padding:11px;margin:7px 0 14px;
          border:1px solid #d7deea;border-radius:7px;box-sizing:border-box;
        }
        #sellerShipmentDetails button {
          padding:11px 16px;background:#174b88;color:white;
          border:0;border-radius:7px;cursor:pointer;
        }
      </style>
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
        openShipmentDetails(btn.dataset.id, sellerMap, courierMap);
      });
    });
  }

  // ==========================================
  // COURIER RATE MANAGEMENT
  // ==========================================

  async function loadCourierRates() {
    content.innerHTML = `
      <div style="background:white;padding:22px;border-radius:12px">
        <p>Loading courier rates...</p>
      </div>
    `;

    const [rateResult, courierResult] = await Promise.all([
      db.rpc("admin_list_platform_courier_rates"),
      db.from("platform_couriers")
        .select("id,name")
        .eq("active", true)
        .order("name")
    ]);

    if (rateResult.error) {
      content.innerHTML = `
        <div style="background:white;padding:22px;border-radius:12px">
          <h3>Could not load courier rates</h3>
          <p>${escapeHTML(rateResult.error.message)}</p>
        </div>
      `;
      return;
    }

    if (courierResult.error) {
      content.innerHTML = `
        <div style="background:white;padding:22px;border-radius:12px">
          <h3>Could not load courier partners</h3>
          <p>${escapeHTML(courierResult.error.message)}</p>
        </div>
      `;
      return;
    }

    courierRates = rateResult.data || [];
    platformCouriers = courierResult.data || [];

    renderCourierRates();
  }

  function renderCourierRates() {
    const rows = courierRates.map(rate => {
      const margin = Number(rate.seller_rate_per_kg || 0) -
        Number(rate.rate_per_kg || 0);

      return `
        <tr>
          <td><strong>${escapeHTML(rate.courier_name || "Courier")}</strong></td>
          <td>${escapeHTML(rate.service_name)}</td>
          <td>${escapeHTML(rate.from_zone)} → ${escapeHTML(rate.to_zone)}</td>
          <td>${escapeHTML(rate.min_weight)}–${escapeHTML(rate.max_weight)} KG</td>
          <td>₹${Number(rate.rate_per_kg || 0).toFixed(2)}</td>
          <td>₹${Number(rate.minimum_charge || 0).toFixed(2)}</td>
          <td>₹${Number(rate.cod_charge || 0).toFixed(2)}</td>
          <td>₹${Number(rate.seller_rate_per_kg || 0).toFixed(2)}</td>
          <td>₹${Number(rate.seller_minimum_charge || 0).toFixed(2)}</td>
          <td>₹${Number(rate.seller_cod_charge || 0).toFixed(2)}</td>
          <td style="color:${margin >= 0 ? "#15803d" : "#dc2626"}">
            ₹${margin.toFixed(2)}
          </td>
          <td>${rate.active ? "Active" : "Inactive"}</td>
          <td>
            <button type="button" class="edit-courier-rate"
              data-id="${escapeHTML(rate.id)}">Edit</button>
            <button type="button" class="toggle-courier-rate"
              data-id="${escapeHTML(rate.id)}"
              data-active="${rate.active ? "true" : "false"}">
              ${rate.active ? "Deactivate" : "Activate"}
            </button>
          </td>
        </tr>
      `;
    }).join("");

    content.innerHTML = `
      <div style="background:white;padding:22px;border-radius:12px">
        <div style="display:flex;justify-content:space-between;
          align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <h2>Courier Rate Management</h2>
            <p>Manage courier costs, seller prices and TeraShip margins.</p>
          </div>
          <div>
            <button type="button" id="refreshCourierRates">↻ Refresh</button>
            <button type="button" id="addCourierRate">+ Add Courier Rate</button>
          </div>
        </div>

        <div id="courierRateFormArea"></div>

        <p><strong>Total rate records:</strong> ${courierRates.length}</p>

        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:1250px">
            <thead>
              <tr>
                <th>Courier</th>
                <th>Service</th>
                <th>Zones</th>
                <th>Weight Slab</th>
                <th>Courier ₹/KG</th>
                <th>Courier Minimum</th>
                <th>Courier COD</th>
                <th>Seller ₹/KG</th>
                <th>Seller Minimum</th>
                <th>Seller COD</th>
                <th>Margin/KG</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="13" style="padding:18px">
                No courier rates configured yet. Add your first rate to begin.
              </td></tr>`}
            </tbody>
          </table>
        </div>

        <p style="margin-top:18px;color:#64748b;font-size:13px">
          Margin per KG is calculated as seller rate minus courier cost.
          Enter verified courier quotations before using these rates for live bookings.
        </p>
      </div>

      <style>
        #courierRateFormArea input,
        #courierRateFormArea select {
          width:100%;padding:10px;border:1px solid #d7deea;
          border-radius:7px;box-sizing:border-box;
        }
        #courierRateFormArea label {
          display:block;font-size:13px;font-weight:600;margin:10px 0 5px;
        }
        #courierRateFormArea .rate-grid {
          display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
          gap:12px;
        }
        #courierRateFormArea button,
        #refreshCourierRates,#addCourierRate,
        .edit-courier-rate,.toggle-courier-rate {
          padding:9px 13px;border:0;border-radius:7px;
          background:#174b88;color:white;cursor:pointer;margin:3px;
        }
        #courierRateFormArea .cancel-rate {
          background:#64748b;
        }
        #courierRateFormArea .rate-panel {
          margin:20px 0;padding:18px;border:1px solid #d7deea;
          border-radius:10px;background:#f8fafc;
        }
        #courierRateFormArea .rate-actions { margin-top:15px; }
        #courierRateFormArea .rate-message { margin-top:10px; }
        #courierRateFormArea .rate-check {
          display:flex;align-items:center;gap:8px;margin-top:12px;
        }
        #courierRateFormArea .rate-check input { width:auto; }
      </style>
    `;

    document.getElementById("refreshCourierRates")
      .addEventListener("click", loadCourierRates);

    document.getElementById("addCourierRate")
      .addEventListener("click", () => showCourierRateForm(null));

    document.querySelectorAll(".edit-courier-rate").forEach(button => {
      button.addEventListener("click", () => {
        const rate = courierRates.find(x => x.id === button.dataset.id);
        if (rate) showCourierRateForm(rate);
      });
    });

    document.querySelectorAll(".toggle-courier-rate").forEach(button => {
      button.addEventListener("click", async () => {
        const rate = courierRates.find(x => x.id === button.dataset.id);
        if (!rate) return;

        const nextActive = button.dataset.active !== "true";
        const action = nextActive ? "activate" : "deactivate";

        if (!confirm(`Are you sure you want to ${action} this rate?`)) return;

        await saveCourierRate(rate, nextActive);
      });
    });
  }

  function showCourierRateForm(rate) {
    editingRateId = rate ? rate.id : null;

    const courierOptions = platformCouriers.map(courier => `
      <option value="${escapeHTML(courier.id)}"
        ${rate && rate.courier_id === courier.id ? "selected" : ""}>
        ${escapeHTML(courier.name)}
      </option>
    `).join("");

    const area = document.getElementById("courierRateFormArea");
    if (!area) return;

    area.innerHTML = `
      <div class="rate-panel">
        <h3>${rate ? "Edit Courier Rate" : "Add New Courier Rate"}</h3>

        <form id="courierRateForm">
          <div class="rate-grid">
            <div>
              <label>Courier Partner</label>
              <select id="rateCourier" required>
                <option value="">Select courier</option>
                ${courierOptions}
              </select>
            </div>
            <div>
              <label>Service Name</label>
              <input id="rateService" required
                value="${escapeHTML(rate?.service_name || "Standard")}">
            </div>
            <div>
              <label>From Zone</label>
              <input id="rateFromZone" required
                value="${escapeHTML(rate?.from_zone || "All")}">
            </div>
            <div>
              <label>To Zone</label>
              <input id="rateToZone" required
                value="${escapeHTML(rate?.to_zone || "All")}">
            </div>
            <div>
              <label>Minimum Weight (KG)</label>
              <input id="rateMinWeight" type="number" min="0.01"
                step="0.01" required value="${rate?.min_weight ?? 0.5}">
            </div>
            <div>
              <label>Maximum Weight (KG)</label>
              <input id="rateMaxWeight" type="number" min="0.01"
                step="0.01" required value="${rate?.max_weight ?? 1}">
            </div>
            <div>
              <label>Courier Cost per KG (₹)</label>
              <input id="rateCourierPerKg" type="number" min="0"
                step="0.01" required value="${rate?.rate_per_kg ?? 0}">
            </div>
            <div>
              <label>Courier Minimum Charge (₹)</label>
              <input id="rateCourierMinimum" type="number" min="0"
                step="0.01" required value="${rate?.minimum_charge ?? 0}">
            </div>
            <div>
              <label>Courier COD Charge (₹)</label>
              <input id="rateCourierCod" type="number" min="0"
                step="0.01" required value="${rate?.cod_charge ?? 0}">
            </div>
            <div>
              <label>Seller Price per KG (₹)</label>
              <input id="rateSellerPerKg" type="number" min="0"
                step="0.01" required value="${rate?.seller_rate_per_kg ?? 0}">
            </div>
            <div>
              <label>Seller Minimum Charge (₹)</label>
              <input id="rateSellerMinimum" type="number" min="0"
                step="0.01" required value="${rate?.seller_minimum_charge ?? 0}">
            </div>
            <div>
              <label>Seller COD Charge (₹)</label>
              <input id="rateSellerCod" type="number" min="0"
                step="0.01" required value="${rate?.seller_cod_charge ?? 0}">
            </div>
          </div>

          <label class="rate-check">
            <input id="rateActive" type="checkbox"
              ${rate ? (rate.active ? "checked" : "") : "checked"}>
            Rate is active
          </label>

          <div class="rate-actions">
            <button type="submit" id="saveCourierRate">Save Rate</button>
            <button type="button" class="cancel-rate" id="cancelCourierRate">
              Cancel
            </button>
          </div>
          <p id="courierRateFormMessage" class="rate-message" role="status"></p>
        </form>
      </div>
    `;

    document.getElementById("cancelCourierRate")
      .addEventListener("click", () => {
        editingRateId = null;
        area.innerHTML = "";
      });

    document.getElementById("courierRateForm")
      .addEventListener("submit", async event => {
        event.preventDefault();

        const minWeight = Number(document.getElementById("rateMinWeight").value);
        const maxWeight = Number(document.getElementById("rateMaxWeight").value);

        if (maxWeight < minWeight) {
          document.getElementById("courierRateFormMessage").textContent =
            "Maximum weight must be greater than or equal to minimum weight.";
          return;
        }

        const rateData = {
          id: editingRateId,
          courier_id: document.getElementById("rateCourier").value,
          service_name: document.getElementById("rateService").value.trim(),
          from_zone: document.getElementById("rateFromZone").value.trim(),
          to_zone: document.getElementById("rateToZone").value.trim(),
          min_weight: minWeight,
          max_weight: maxWeight,
          rate_per_kg: Number(document.getElementById("rateCourierPerKg").value),
          minimum_charge: Number(document.getElementById("rateCourierMinimum").value),
          cod_charge: Number(document.getElementById("rateCourierCod").value),
          seller_rate_per_kg: Number(document.getElementById("rateSellerPerKg").value),
          seller_minimum_charge: Number(document.getElementById("rateSellerMinimum").value),
          seller_cod_charge: Number(document.getElementById("rateSellerCod").value),
          active: document.getElementById("rateActive").checked
        };

        const saveButton = document.getElementById("saveCourierRate");
        const messageBox = document.getElementById("courierRateFormMessage");

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {
          await saveCourierRate(rateData, rateData.active);
          editingRateId = null;
        } catch (error) {
          messageBox.textContent = error.message || "Could not save rate.";
          messageBox.style.color = "#dc2626";
          saveButton.disabled = false;
          saveButton.textContent = "Save Rate";
        }
      });
  }

  async function saveCourierRate(rate, activeValue) {
    const { data, error } = await db.rpc("admin_save_platform_courier_rate", {
      p_courier_id: rate.courier_id,
      p_service_name: rate.service_name,
      p_from_zone: rate.from_zone,
      p_to_zone: rate.to_zone,
      p_min_weight: rate.min_weight,
      p_max_weight: rate.max_weight,
      p_rate_per_kg: rate.rate_per_kg,
      p_minimum_charge: rate.minimum_charge,
      p_cod_charge: rate.cod_charge,
      p_seller_rate_per_kg: rate.seller_rate_per_kg,
      p_seller_minimum_charge: rate.seller_minimum_charge,
      p_seller_cod_charge: rate.seller_cod_charge,
      p_active: activeValue,
      p_id: rate.id || null
    });

    if (error) throw error;

    await loadCourierRates();
    return data;
  }

  async function openShipmentDetails(id, sellerMap, courierMap) {
    const shipment = sellerShipments.find(x => x.id === id);
    if (!shipment) return;

    const seller = sellerMap[shipment.seller_id] || {};
    const courier = courierMap[shipment.courier_id] || {};

    const details = document.getElementById("sellerShipmentDetails");

    details.innerHTML = `
      <hr>
      <h3>Manage Shipment: ${escapeHTML(shipment.awb_number)}</h3>

      <p><strong>Seller:</strong> ${escapeHTML(seller.business_name || "—")}</p>
      <p><strong>Contact:</strong> ${escapeHTML(seller.contact_person || "—")}</p>
      <p><strong>Seller Phone:</strong> ${escapeHTML(seller.phone || "—")}</p>
      <p><strong>Receiver:</strong> ${escapeHTML(shipment.receiver_name)}</p>
      <p><strong>Receiver Phone:</strong> ${escapeHTML(shipment.receiver_phone)}</p>
      <p><strong>Receiver Address:</strong>
        ${escapeHTML(shipment.receiver_address)},
        ${escapeHTML(shipment.receiver_city)},
        ${escapeHTML(shipment.receiver_state)}
        - ${escapeHTML(shipment.receiver_pincode)}
      </p>
      <p><strong>Courier:</strong> ${escapeHTML(courier.name || "—")}</p>
      <p><strong>Payment:</strong> ${escapeHTML(shipment.payment_mode)}</p>

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
              "Status was updated, but tracking event could not be saved: " +
              eventError.message
            );
          }

          statusMessage.textContent = "Tracking update saved successfully.";
          statusMessage.style.color = "#15803d";

          await loadSellerShipments();

        } catch (error) {
          statusMessage.textContent = error.message || "Could not save update.";
          statusMessage.style.color = "#dc2626";
          saveButton.disabled = false;
          saveButton.textContent = "Save Tracking Update";
        }
      });

    details.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ==========================================
  // SUPABASE CONNECTION CHECK
  // ==========================================

  if (!db) {
    showLogin();
    showMessage("Supabase connection is missing. Check supabase-config.js.");
    return;
  }

  // ==========================================
  // NAVIGATION
  // ==========================================

  document.querySelectorAll(".super-nav-item").forEach(item => {
    item.addEventListener("click", () => {
      showView(item.dataset.view);
    });
  });

  // ==========================================
  // SUPER ADMIN LOGIN
  // ==========================================

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

  // ==========================================
  // SUPER ADMIN LOGOUT
  // ==========================================

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

  // ==========================================
  // CHECK EXISTING LOGIN SESSION
  // ==========================================

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
