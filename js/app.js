/* TeraShip application — Supabase-backed customer and shipment records.
   Courier prices, AWBs, labels and tracking remain illustrative until real
   courier APIs/contracts are connected. Never place a Supabase service-role key here. */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const money = n => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(Number(n || 0));
  const date = d => d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) : '—';
  const nowISO = () => new Date().toISOString();
  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const rateGuide = {
    'Blue Dart': { code: 'BD', color: '#eaf0ff', base: 88, eta: '1–2 days' },
    'DTDC': { code: 'DT', color: '#fff0e6', base: 68, eta: '2–4 days' },
    'Delhivery': { code: 'DL', color: '#e7f7ef', base: 62, eta: '2–3 days' },
    'XpressBees': { code: 'XB', color: '#fff4d8', base: 59, eta: '2–4 days' },
    'Ecom Express': { code: 'EC', color: '#f3eaff', base: 64, eta: '2–4 days' },
    'India Post': { code: 'IP', color: '#e4f6f7', base: 48, eta: '3–6 days' }
  };

  const db = window.supabaseClient;
  const authUser = window.terashipUser;
  const profile = window.terashipProfile;

  const state = {
    page: 'dashboard',
    selectedCourierId: '',
    selectedRate: null,
    customers: [],
    shipments: [],
    couriers: [],
    invoices: [],
    trackingQuery: '',
    loading: true
  };

  const pageTitles = {
    dashboard: 'Dashboard', shipments: 'Shipments', booking: 'Book a shipment',
    tracking: 'Track shipment', customers: 'Customers', billing: 'Billing & COD',
    reports: 'Reports', settings: 'Settings & integrations'
  };

  function toast(message) {
    const t = $('#toast');
    if (!t) { alert(message); return; }
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  function showError(prefix, error) {
    console.error(prefix, error);
    toast(`${prefix}: ${error?.message || 'Please try again.'}`);
  }

  function statusClass(status) {
    return ({
      'Delivered': 'delivered', 'In Transit': 'transit',
      'Out for Delivery': 'transit', 'Booked': 'booked',
      'Pending': 'pending', 'Exception': 'exception',
      'Cancelled': 'cancelled'
    })[status] || 'pending';
  }
  const badge = s => `<span class="badge ${statusClass(s)}">${escapeHtml(s || 'Pending')}</span>`;
  const total = arr => arr.reduce((sum, x) => sum + Number(x || 0), 0);
  const delivered = () => state.shipments.filter(s => s.status === 'Delivered').length;
  const inTransit = () => state.shipments.filter(s => ['In Transit', 'Out for Delivery'].includes(s.status)).length;
  const todayCount = () => state.shipments.filter(s =>
    s.created && new Date(s.created).toDateString() === new Date().toDateString()).length;

  function normalizeCustomer(row) {
    return {
      id: row.id, name: row.name || '', contact: row.name || '',
      phone: row.phone || '', email: row.email || '',
      city: row.city || '', address: row.address || '',
      state: row.state || '', pincode: row.pincode || '',
      balance: 0
    };
  }

  function normalizeShipment(row) {
    const customer = state.customers.find(c => c.id === row.customer_id);
    const courier = state.couriers.find(c => c.id === row.courier_id);
    return {
      id: row.id,
      awb: row.awb_number || '',
      customerId: row.customer_id,
      customer: customer?.name || 'Customer record unavailable',
      sender: row.sender_name || '',
      senderPhone: row.sender_phone || '',
      senderCity: row.sender_address || '',
      senderPin: row.sender_pincode || '',
      receiver: row.receiver_name || '',
      receiverPhone: row.receiver_phone || '',
      receiverCity: row.receiver_city || '',
      receiverPin: row.receiver_pincode || '',
      receiverAddress: row.receiver_address || '',
      weight: Number(row.weight || 0),
      service: row.payment_mode || 'Prepaid',
      amount: Number(row.customer_charge || 0),
      courierCharge: Number(row.courier_charge || 0),
      cod: Number(row.cod_amount || 0),
      courierId: row.courier_id,
      courier: courier?.name || 'Courier unavailable',
      status: row.status || 'Booked',
      created: row.created_at || row.booking_date,
      eta: 'Estimate unavailable',
      timeline: [['Shipment booked', 'Shipment record saved in TeraShip', row.created_at || nowISO()]]
    };
  }

  async function loadData() {
    if (!db || !authUser?.id || !profile?.organization_id) {
      throw new Error('Supabase session or organization profile is missing. Please sign out and sign in again.');
    }
    const [customerResult, courierResult] = await Promise.all([
      db.from('customers').select('*').order('created_at', { ascending: false }),
      db.from('couriers').select('*').eq('active', true).order('name')
    ]);
    if (customerResult.error) throw customerResult.error;
    if (courierResult.error) throw courierResult.error;

    state.customers = (customerResult.data || []).map(normalizeCustomer);
    state.couriers = courierResult.data || [];

    const shipmentResult = await db.from('shipments').select('*').order('created_at', { ascending: false });
    if (shipmentResult.error) throw shipmentResult.error;
    state.shipments = (shipmentResult.data || []).map(normalizeShipment);
    state.loading = false;
  }

  function heading(title, desc, actions = '') {
    return `<div class="page-heading"><div><div class="eyebrow">TERASHIP WORKSPACE</div><h1>${title}</h1><p>${desc}</p></div><div class="heading-actions">${actions}</div></div>`;
  }
  function stat(label, value, note, icon) {
    return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></article>`;
  }

  function shipmentRows(list) {
    if (!list.length) return `<tr><td colspan="8"><div class="empty-state"><b>No shipments found</b>Book a shipment to see it here.</div></td></tr>`;
    return list.map(s => `<tr>
      <td><span class="mono">${escapeHtml(s.awb)}</span><br><small class="muted">${escapeHtml(String(s.id).slice(0, 8))}</small></td>
      <td><b>${escapeHtml(s.customer)}</b><br><small class="muted">${escapeHtml(s.receiverCity)}</small></td>
      <td>${escapeHtml(s.courier)}</td><td>${s.weight} kg</td>
      <td>${s.service === 'COD' ? money(s.cod) : 'Prepaid'}</td>
      <td>${badge(s.status)}</td><td>${date(s.created)}</td>
      <td><button class="button small" data-action="track" data-awb="${escapeHtml(s.awb)}">View</button></td>
    </tr>`).join('');
  }

  function recentTable(list = state.shipments.slice(0, 5)) {
    return `<div class="panel table-panel"><div class="panel-head"><div><h2>Recent shipments</h2><p>Latest shipment records in your organization</p></div><button class="text-link" data-page="shipments">View all shipments →</button></div>
    <div class="table-wrap"><table><thead><tr><th>AWB / Shipment</th><th>Customer / Destination</th><th>Courier</th><th>Weight</th><th>Payment</th><th>Status</th><th>Booked</th><th>Action</th></tr></thead><tbody>${shipmentRows(list)}</tbody></table></div></div>`;
  }

  function dashboard() {
    const max = Math.max(1, ...[18, 24, 17, 29, 22, 32, 27]);
    const bars = [18, 24, 17, 29, 22, 32, 27];
    const chart = bars.map((n, i) => `<div class="bar-group"><div class="bar secondary" style="height:${n / max * 72}%"></div><div class="bar" style="height:${Math.max(8, (n + 7) / max * 100)}%"></div><span class="bar-label">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span></div>`).join('');
    const courierRows = state.couriers.map(c => {
      const info = rateGuide[c.name] || { code: c.name.slice(0, 2).toUpperCase(), color: '#edf1f8', eta: 'API not connected' };
      const count = state.shipments.filter(s => s.courierId === c.id).length;
      return `<div class="courier-row"><div class="courier-logo" style="background:${info.color}">${info.code}</div><div class="courier-info"><b>${escapeHtml(c.name)}</b><small>Illustrative service estimate only</small></div><div class="courier-count">${count}<small>shipments</small></div></div>`;
    }).join('') || '<div class="empty-state">No active courier partners found.</div>';
    return heading('Good day, Admin 👋', 'Here is your organization’s shipment activity.', `<button class="button" data-action="export">↓ Export data</button><button class="button primary" data-page="booking">＋ Book shipment</button>`)
      + `<div class="grid stats-grid">${stat('Total shipments', state.shipments.length, 'Saved shipment records', '▤')}${stat('In transit', inTransit(), 'Includes out for delivery', '↗')}${stat('Delivered', delivered(), `${state.shipments.length ? Math.round(delivered() / state.shipments.length * 100) : 0}% of recorded shipments`, '✓')}${stat('Today’s bookings', todayCount(), 'Created today', '＋')}</div>
      <div class="grid dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Shipment activity</h2><p>Illustrative chart — not historical database analytics</p></div><div class="chart-legend"><span>Bookings</span><span>Delivered</span></div></div><div class="bar-chart">${chart}</div></section>
      <section class="panel"><div class="panel-head"><div><h2>Courier partners</h2><p>Shipment distribution by partner</p></div><button class="text-link" data-page="settings">Manage →</button></div><div class="courier-list">${courierRows}</div></section></div>${recentTable()}`;
  }

  function shipmentsPage() {
    return heading('Shipments', 'Search, filter and manage shipment records.', `<button class="button" data-action="export">↓ Export CSV</button><button class="button primary" data-page="booking">＋ New shipment</button>`)
      + `<div class="toolbar"><div class="searchbox"><span>⌕</span><input id="shipmentSearch" placeholder="Search AWB, customer or destination…"></div>
      <select id="statusFilter"><option value="">All statuses</option>${['Booked', 'In Transit', 'Out for Delivery', 'Delivered', 'Exception', 'Cancelled'].map(s => `<option>${s}</option>`).join('')}</select>
      <select id="courierFilter"><option value="">All couriers</option>${state.couriers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('')}</select></div>
      <div id="shipmentTable">${recentTable(state.shipments)}</div>`;
  }

  function customerOptions() {
    return state.customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  }

  function bookingPage() {
    const courierOptions = state.couriers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    return heading('Book a shipment', 'Save a shipment record to Supabase. This does not book a pickup with the courier.', `<button class="button" data-action="resetBooking">Reset form</button>`)
      + `<form id="bookingForm"><div class="booking-layout"><div>
      <section class="form-section"><h2>01 · Customer & shipment type</h2><div class="form-fields">
      <div class="field"><label for="customerId">Customer account *</label><select id="customerId" required>${customerOptions()}</select></div>
      <div class="field"><label for="serviceType">Payment type *</label><select id="serviceType"><option>Prepaid</option><option>COD</option></select></div>
      <div class="field"><label for="weight">Actual weight (kg) *</label><input id="weight" type="number" min=".1" step=".1" value="1" required></div>
      <div class="field"><label for="dimensions">Dimensions (cm)</label><input id="dimensions" placeholder="e.g. 20 × 15 × 10"></div>
      <div class="field"><label for="declaredValue">Declared value (₹)</label><input id="declaredValue" type="number" min="0" value="1000"></div>
      <div class="field" id="codField"><label for="codAmount">COD amount (₹)</label><input id="codAmount" type="number" min="0" value="0"></div>
      </div></section>
      <section class="form-section"><h2>02 · Sender details</h2><div class="form-fields">
      <div class="field"><label for="senderName">Sender / business name *</label><input id="senderName" required placeholder="Business name"></div>
      <div class="field"><label for="senderPhone">Sender mobile *</label><input id="senderPhone" required inputmode="numeric" placeholder="10-digit mobile"></div>
      <div class="field"><label for="senderCity">Pickup city *</label><input id="senderCity" required placeholder="e.g. Ranchi"></div>
      <div class="field"><label for="senderPin">Pickup PIN code</label><input id="senderPin" inputmode="numeric" maxlength="6" placeholder="834001"></div>
      </div></section>
      <section class="form-section"><h2>03 · Receiver details</h2><div class="form-fields">
      <div class="field"><label for="receiverName">Receiver name *</label><input id="receiverName" required placeholder="Full name"></div>
      <div class="field"><label for="receiverPhone">Receiver mobile *</label><input id="receiverPhone" required inputmode="numeric" placeholder="10-digit mobile"></div>
      <div class="field"><label for="receiverCity">Destination city *</label><input id="receiverCity" required placeholder="e.g. Kolkata"></div>
      <div class="field"><label for="receiverPin">Destination PIN code *</label><input id="receiverPin" required inputmode="numeric" maxlength="6" placeholder="700001"></div>
      <div class="field full"><label for="receiverAddress">Full delivery address *</label><textarea id="receiverAddress" required placeholder="House / street / landmark / area"></textarea></div>
      <div class="field full"><label for="notes">Shipment notes (optional)</label><input id="notes" placeholder="Fragile, handling notes, reference"></div>
      </div></section>
      <div class="callout warning">TeraShip saves the shipment record and generates a demo reference only. No courier pickup, valid AWB, shipping label, live tracking or COD transfer is created.</div>
      </div><aside class="panel rate-panel"><div class="panel-head"><div><h2>04 · Courier selection</h2><p>Illustrative prices for presentation only</p></div></div>
      <div id="rateOptions"></div><div class="field" style="margin:13px 0"><label for="customerCharge">Customer charge (₹)</label><input id="customerCharge" type="number" min="0" value="149"><small>Enter the amount you intend to charge.</small></div>
      <div class="callout">Courier rates are estimates, not live quotes. Serviceability, volumetric weight, GST and surcharges are not checked.</div>
      <button class="button primary wide" type="submit">Save shipment record</button></aside></div></form>`;
  }

  function ratesMarkup() {
    if (!state.couriers.length) return '<div class="empty-state">No active courier partners. Add active couriers in Supabase first.</div>';
    return state.couriers.map(c => {
      const info = rateGuide[c.name] || { code: c.name.slice(0, 2).toUpperCase(), base: 70, eta: 'API not connected' };
      const estimate = info.base * Math.max(1, Number($('#weight')?.value || 1));
      const selected = state.selectedCourierId === c.id;
      return `<label class="rate-option ${selected ? 'selected' : ''}"><input type="radio" name="courier" value="${escapeHtml(c.id)}" ${selected ? 'checked' : ''}>
        <span class="courier-logo">${info.code}</span><span class="rate-copy"><b>${escapeHtml(c.name)}</b><small>Illustrative estimate · ${info.eta}</small></span><strong>${money(estimate)}</strong></label>`;
    }).join('');
  }

  function renderRates() {
    const target = $('#rateOptions');
    if (target) target.innerHTML = ratesMarkup();
  }

  function customersPage() {
    const rows = state.customers.map(c => `<tr><td><b>${escapeHtml(c.name)}</b><br><small class="muted">${escapeHtml(c.email)}</small></td>
      <td>${escapeHtml(c.phone)}</td><td>${escapeHtml(c.city)}</td>
      <td>${state.shipments.filter(s => s.customerId === c.id).length}</td>
      <td><button class="button small" data-action="customerDetails" data-id="${escapeHtml(c.id)}">View</button>
      <button class="button small" data-action="customerStatement" data-id="${escapeHtml(c.id)}">Statement</button></td></tr>`).join('');
    return heading('Customers', 'Customer accounts stored in your Supabase database.', `<button class="button primary" data-action="addCustomer">＋ Add customer</button>`)
      + `<div class="panel table-panel"><div class="panel-head"><div><h2>Customer directory</h2><p>${state.customers.length} customer accounts</p></div><button class="text-link" data-action="exportCustomers">Export CSV →</button></div>
      <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Mobile</th><th>City</th><th>Shipments</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="5"><div class="empty-state">No customers yet. Add your first customer.</div></td></tr>'}</tbody></table></div></div>`;
  }

  function renderTracking(awb) {
    const s = state.shipments.find(x => x.awb.toLowerCase() === String(awb || '').toLowerCase());
    if (!s) return '<div class="empty-state"><b>No matching shipment</b>Check the reference and try again.</div>';
    const steps = ['Booked', 'In Transit', 'Out for Delivery', 'Delivered'];
    const current = Math.max(0, steps.indexOf(s.status));
    const progress = steps.map((step, i) => `<div class="track-step ${i <= current ? 'done' : ''}"><span class="track-dot"></span><div><b>${step}</b><small>${i === 0 ? date(s.created) : i === current ? 'Current TeraShip demo status' : 'Awaiting update'}</small></div></div>`).join('');
    return `<div class="panel tracking-card"><div class="tracking-top"><div><span class="eyebrow">SHIPMENT REFERENCE</span><h2 class="mono">${escapeHtml(s.awb)}</h2></div>${badge(s.status)}</div>
      <div class="tracking-meta"><div><small>Receiver</small><b>${escapeHtml(s.receiver)}</b></div><div><small>Destination</small><b>${escapeHtml(s.receiverCity)} ${escapeHtml(s.receiverPin)}</b></div><div><small>Courier</small><b>${escapeHtml(s.courier)}</b></div><div><small>Weight</small><b>${s.weight} kg</b></div></div>
      <div class="timeline">${progress}</div><div class="callout warning">This timeline shows status entered in TeraShip only. It is not live courier tracking.</div>
      <button class="button" data-action="advance" data-awb="${escapeHtml(s.awb)}">Advance demo status</button>
      <button class="button" data-action="label" data-awb="${escapeHtml(s.awb)}">Print demo label</button></div>`;
  }

  function trackingPage() {
    return heading('Track shipment', 'Find a shipment by its TeraShip reference.', '')
      + `<div class="panel track-search"><form id="trackingForm"><input id="trackingInput" placeholder="Enter AWB / TeraShip reference" value="${escapeHtml(state.trackingQuery)}" required><button class="button primary">Track</button></form></div>
      <div id="trackingResult">${state.trackingQuery ? renderTracking(state.trackingQuery) : '<div class="empty-state">Enter a shipment reference above.</div>'}</div>`;
  }

  function billingPage() {
    const cod = state.shipments.filter(s => s.service === 'COD');
    const prepaid = state.shipments.filter(s => s.service !== 'COD');
    const codValue = total(cod.map(s => s.cod));
    return heading('Billing & COD', 'Shipment charges and COD records from saved shipments.', `<button class="button" data-action="exportCOD">Export COD CSV</button>`)
      + `<div class="grid stats-grid">${stat('COD shipments', cod.length, 'Recorded COD shipments', '₹')}${stat('COD value', money(codValue), 'Not a courier remittance figure', '↔')}${stat('Prepaid shipments', prepaid.length, 'Recorded prepaid shipments', '✓')}${stat('Total customer charges', money(total(state.shipments.map(s => s.amount))), 'Customer charges entered', '₹')}</div>
      <div class="panel table-panel"><div class="panel-head"><div><h2>COD register</h2><p>Reconciliation is not connected to courier accounts.</p></div></div><div class="table-wrap"><table><thead><tr><th>AWB</th><th>Customer</th><th>Courier</th><th>COD amount</th><th>Shipment status</th><th>Remittance</th></tr></thead><tbody>
      ${cod.map(s => `<tr><td class="mono">${escapeHtml(s.awb)}</td><td>${escapeHtml(s.customer)}</td><td>${escapeHtml(s.courier)}</td><td>${money(s.cod)}</td><td>${badge(s.status)}</td><td>Not connected</td></tr>`).join('') || '<tr><td colspan="6">No COD shipments recorded.</td></tr>'}</tbody></table></div></div>`;
  }

  function reportsPage() {
    return heading('Reports', 'Export the records currently available in Supabase.', '')
      + `<div class="grid report-grid">
      <article class="panel report-card"><h2>Shipment report</h2><p>All shipment references, destinations, charges and statuses.</p><button class="button primary" data-action="export">Download CSV</button></article>
      <article class="panel report-card"><h2>Customer report</h2><p>Customer directory and shipment counts.</p><button class="button primary" data-action="exportCustomers">Download CSV</button></article>
      <article class="panel report-card"><h2>Courier performance</h2><p>Counts based on TeraShip status entries, not carrier scans.</p><button class="button primary" data-action="exportCourier">Download CSV</button></article>
      <article class="panel report-card"><h2>COD report</h2><p>COD amounts entered in shipment records; no remittance data.</p><button class="button primary" data-action="exportCOD">Download CSV</button></article></div>`;
  }

  function settingsPage() {
    return heading('Settings & integrations', 'Organization and courier setup.', '')
      + `<div class="grid settings-grid"><section class="panel"><h2>Organization</h2><div class="settings-line"><span>Business</span><b>SwiftRoute Logistics</b></div>
      <div class="settings-line"><span>Organization ID</span><b class="mono">${escapeHtml(profile.organization_id)}</b></div>
      <div class="settings-line"><span>Signed in as</span><b>${escapeHtml(authUser.email)}</b></div>
      <div class="settings-line"><span>Database</span><b class="status-good">Supabase connected</b></div></section>
      <section class="panel"><h2>Courier partners</h2><p class="muted">Active courier records from Supabase.</p>
      ${state.couriers.map(c => `<div class="settings-line"><span>${escapeHtml(c.name)}</span><b>${c.active ? 'Active' : 'Inactive'}</b></div>`).join('') || 'No active couriers'}
      <div class="callout warning">Courier API credentials and contracts are not configured. Rates, AWBs, labels, pickup booking and tracking are demo-only.</div></section>
      <section class="panel"><h2>Security</h2><p>Use only the Supabase publishable/anon key in the public website. Keep service-role keys on a secure server, never in GitHub Pages.</p><p class="muted">Access is controlled by Supabase Auth and row-level security policies.</p></section></div>`;
  }

  function render() {
    const content = $('#pageContent');
    if (!content) return;
    const pages = {
      dashboard, shipments: shipmentsPage, booking: bookingPage,
      tracking: trackingPage, customers: customersPage, billing: billingPage,
      reports: reportsPage, settings: settingsPage
    };
    const title = pageTitles[state.page] || 'Dashboard';
    $('#pageTitle') && ($('#pageTitle').textContent = title);
    $$('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.page === state.page));
    content.innerHTML = (pages[state.page] || dashboard)();
    if (state.page === 'booking') {
      renderRates();
      const form = $('#bookingForm');
      form?.addEventListener('change', e => {
        if (e.target.name === 'courier') {
          state.selectedCourierId = e.target.value;
          renderRates();
        }
      });
      $('#weight')?.addEventListener('input', renderRates);
      form?.addEventListener('submit', submitBooking);
    }
    if (state.page === 'shipments') {
      const apply = () => {
        const q = ($('#shipmentSearch')?.value || '').toLowerCase();
        const status = $('#statusFilter')?.value || '';
        const courier = $('#courierFilter')?.value || '';
        const filtered = state.shipments.filter(s =>
          (!q || [s.awb, s.customer, s.receiverCity].some(v => String(v).toLowerCase().includes(q))) &&
          (!status || s.status === status) && (!courier || s.courierId === courier));
        $('#shipmentTable').innerHTML = recentTable(filtered);
      };
      $('#shipmentSearch')?.addEventListener('input', apply);
      $('#statusFilter')?.addEventListener('change', apply);
      $('#courierFilter')?.addEventListener('change', apply);
    }
    if (state.page === 'tracking') {
      $('#trackingForm')?.addEventListener('submit', e => {
        e.preventDefault();
        state.trackingQuery = $('#trackingInput').value.trim();
        $('#trackingResult').innerHTML = renderTracking(state.trackingQuery);
      });
    }
  }

  async function submitBooking(e) {
    e.preventDefault();
    const val = id => $('#' + id)?.value.trim() || '';
    const customerId = val('customerId');
    const courierId = state.selectedCourierId || $('input[name="courier"]:checked')?.value || '';
    const weight = Number(val('weight'));
    const service = val('serviceType');
    const codAmount = service === 'COD' ? Number(val('codAmount')) : 0;
    if (!customerId) return toast('Add a customer account before booking.');
    if (!courierId) return toast('Please select a courier partner.');
    if (!(weight > 0)) return toast('Enter a valid shipment weight.');
    const courier = state.couriers.find(c => c.id === courierId);
    const info = rateGuide[courier?.name] || { base: 70 };
    const estimated = Math.round(info.base * Math.max(1, weight));
    const customerCharge = Number(val('customerCharge') || estimated);
    const awb = `TS${Date.now().toString().slice(-10)}`;
    const payload = {
      organization_id: profile.organization_id,
      customer_id: customerId,
      courier_id: courierId,
      awb_number: awb,
      booking_date: new Date().toISOString().slice(0, 10),
      sender_name: val('senderName'),
      sender_phone: val('senderPhone'),
      sender_address: val('senderCity'),
      sender_pincode: val('senderPin'),
      receiver_name: val('receiverName'),
      receiver_phone: val('receiverPhone'),
      receiver_address: val('receiverAddress'),
      receiver_city: val('receiverCity'),
      receiver_state: '',
      receiver_pincode: val('receiverPin'),
      weight,
      payment_mode: service,
      cod_amount: codAmount,
      courier_charge: estimated,
      customer_charge: customerCharge,
      status: 'Booked',
      notes: val('notes') || null,
      created_by: authUser.id
    };
    const button = $('#bookingForm button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Saving shipment…'; }
    try {
      const { error } = await db.from('shipments').insert(payload);
      if (error) throw error;
      await loadData();
      state.page = 'shipments';
      render();
      toast(`Shipment record saved. Demo reference: ${awb}`);
    } catch (error) {
      showError('Could not save shipment', error);
      if (button) { button.disabled = false; button.textContent = 'Save shipment record'; }
    }
  }

  function openModal() {
    $('#modalBackdrop')?.classList.add('open');
  }
  function closeModal() {
    $('#modalBackdrop')?.classList.remove('open');
  }

  function labelHtml(s) {
    return `<div class="shipping-label"><div class="label-head"><b>TERASHIP</b><span>DEMO LABEL · NOT VALID FOR SHIPPING</span></div>
      <div class="label-section"><b>SHIP TO</b><h2>${escapeHtml(s.receiver)}</h2><p>${escapeHtml(s.receiverAddress)}<br>${escapeHtml(s.receiverCity)} ${escapeHtml(s.receiverPin)}</p><strong>${escapeHtml(s.receiverPhone)}</strong></div>
      <div class="label-grid"><div><b>SHIPMENT REF</b><span>${escapeHtml(s.awb)}</span></div><div><b>COURIER</b><span>${escapeHtml(s.courier)}</span></div><div><b>WEIGHT</b><span>${s.weight} kg</span></div><div><b>PAYMENT</b><span>${escapeHtml(s.service)}</span></div></div>
      <div class="barcode"></div><div class="label-foot"><span>FROM: ${escapeHtml(s.sender)}</span><span>${date(s.created)}</span></div></div>`;
  }
  function showLabel(s) {
    const w = window.open('', '_blank', 'width=600,height=700');
    if (!w) return toast('Please allow pop-ups to print the demo label.');
    w.document.write(`<!doctype html><html><head><title>TeraShip demo label</title><style>
        *{box-sizing:border-box}body{font:14px Arial,sans-serif;padding:20px;color:#111}.shipping-label{border:2px solid #111;padding:18px;max-width:520px;margin:auto}
        .label-head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px}.label-head b{font-size:25px}.label-head span{font-size:10px;font-weight:bold}
        .label-section{padding:18px 0;border-bottom:1px solid #777}.label-section h2{font-size:23px;margin:8px 0}.label-section p{line-height:1.5}
        .label-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:15px 0}
        .label-grid b{display:block;font-size:11px}.label-grid span{font-size:12px}.barcode{height:48px;background:repeating-linear-gradient(90deg,#111 0,#111 2px,white 2px,white 4px,#111 4px,#111 5px,white 5px,white 8px);margin:15px 0}
        .label-foot{display:flex;justify-content:space-between;font-size:10px}@page{size:A6;margin:8mm}</style></head><body>${labelHtml(s)}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  function download(name, rows) {
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    toast('CSV export prepared.');
  }

  function exportShipments(list = state.shipments) {
    download('teraship-shipments.csv', [['AWB', 'Shipment ID', 'Customer', 'Courier', 'Sender city', 'Receiver', 'Destination city', 'PIN', 'Weight kg', 'Payment type', 'Charge INR', 'COD INR', 'Status', 'Booked at'],
      ...list.map(s => [s.awb, s.id, s.customer, s.courier, s.senderCity, s.receiver, s.receiverCity, s.receiverPin, s.weight, s.service, s.amount, s.cod, s.status, s.created])]);
  }
  function exportCOD() {
    download('teraship-cod.csv', [['AWB', 'Customer', 'Courier', 'COD INR', 'Status', 'Reconciliation'],
      ...state.shipments.filter(s => s.service === 'COD').map(s => [s.awb, s.customer, s.courier, s.cod, s.status, 'Not reconciled'])]);
  }
  function exportCustomers() {
    download('teraship-customers.csv', [['Customer ID', 'Name', 'Phone', 'Email', 'City', 'Shipments'],
      ...state.customers.map(c => [c.id, c.name, c.phone, c.email, c.city, state.shipments.filter(s => s.customerId === c.id).length])]);
  }
  function exportCourier() {
    download('teraship-courier-performance.csv', [['Courier', 'Shipments', 'Booked', 'In Transit', 'Out for Delivery', 'Delivered'],
      ...state.couriers.map(c => [c.name, state.shipments.filter(s => s.courierId === c.id).length,
        ...['Booked', 'In Transit', 'Out for Delivery', 'Delivered'].map(st => state.shipments.filter(s => s.courierId === c.id && s.status === st).length)])]);
  }

  function addCustomer() {
    $('#modalTitle').textContent = 'Add customer account';
    $('#modalBody').innerHTML = `<form id="customerForm"><div class="form-fields">
      <div class="field"><label>Business / customer name *</label><input id="newName" required></div>
      <div class="field"><label>Mobile number *</label><input id="newPhone" required inputmode="tel"></div>
      <div class="field"><label>Email</label><input id="newEmail" type="email"></div>
      <div class="field"><label>City *</label><input id="newCity" required></div>
      <div class="field full"><label>Address</label><input id="newAddress"></div>
      <div class="field"><label>State</label><input id="newState"></div>
      <div class="field"><label>PIN code</label><input id="newPincode" inputmode="numeric" maxlength="6"></div>
      </div><div style="margin-top:18px;display:flex;gap:8px"><button class="button primary">Save customer</button><button class="button" type="button" id="cancelCustomer">Cancel</button></div></form>`;
    openModal();
    $('#cancelCustomer').onclick = closeModal;
    $('#customerForm').onsubmit = async e => {
      e.preventDefault();
      const value = id => $('#' + id).value.trim();
      const payload = {
        organization_id: profile.organization_id,
        name: value('newName'),
        phone: value('newPhone'),
        email: value('newEmail') || null,
        city: value('newCity'),
        address: value('newAddress') || null,
        state: value('newState') || null,
        pincode: value('newPincode') || null
      };
      const submit = $('#customerForm').querySelector('[type="submit"]');
      submit.disabled = true; submit.textContent = 'Saving…';
      try {
        const { error } = await db.from('customers').insert(payload);
        if (error) throw error;
        await loadData();
        closeModal(); render();
        toast('Customer saved to Supabase.');
      } catch (error) {
        showError('Could not save customer', error);
        submit.disabled = false; submit.textContent = 'Save customer';
      }
    };
  }

  function customerDetails(id) {
    const c = state.customers.find(x => x.id === id);
    if (!c) return;
    const shipments = state.shipments.filter(s => s.customerId === id);
    $('#modalTitle').textContent = c.name;
    $('#modalBody').innerHTML = `<div class="grid billing-grid"><div class="billing-stat"><span>Shipments</span><b>${shipments.length}</b></div><div class="billing-stat"><span>Account balance</span><b>Not configured</b></div><div class="billing-stat"><span>Delivered</span><b>${shipments.filter(s => s.status === 'Delivered').length}</b></div></div>
      <p><b>Phone:</b> ${escapeHtml(c.phone)}<br><b>Email:</b> ${escapeHtml(c.email)}<br><b>City:</b> ${escapeHtml(c.city)}<br><b>Address:</b> ${escapeHtml(c.address)}</p>
      <h3 style="font-size:13px">Recent shipments</h3><div class="table-wrap"><table><thead><tr><th>AWB</th><th>Courier</th><th>Status</th></tr></thead><tbody>
      ${shipments.map(s => `<tr><td class="mono">${escapeHtml(s.awb)}</td><td>${escapeHtml(s.courier)}</td><td>${badge(s.status)}</td></tr>`).join('') || '<tr><td colspan="3">No shipments yet</td></tr>'}</tbody></table></div>`;
    openModal();
  }

  function customerStatement(id) {
    const c = state.customers.find(x => x.id === id);
    if (!c) return;
    const shipments = state.shipments.filter(s => s.customerId === id);
    download(`customer-${String(c.id).slice(0, 8)}-statement.csv`, [['AWB', 'Date', 'Courier', 'Destination', 'Charge INR', 'COD INR', 'Status'],
      ...shipments.map(s => [s.awb, s.created, s.courier, s.receiverCity, s.amount, s.cod, s.status])]);
  }

  async function advanceStatus(awb) {
    const s = state.shipments.find(x => x.awb === awb);
    if (!s) return;
    const sequence = ['Booked', 'In Transit', 'Out for Delivery', 'Delivered'];
    const index = sequence.indexOf(s.status);
    const next = sequence[Math.min(Math.max(index, 0) + 1, sequence.length - 1)];
    if (next === s.status) { toast('Shipment is already marked delivered.'); return; }
    try {
      const { error } = await db.from('shipments').update({ status: next }).eq('id', s.id);
      if (error) throw error;
      await loadData();
      if (state.page === 'tracking') $('#trackingResult').innerHTML = renderTracking(awb);
      else render();
      toast('TeraShip status updated to ' + next + '. This is not a courier tracking update.');
    } catch (error) { showError('Could not update shipment status', error); }
  }

  document.addEventListener('click', async e => {
    const page = e.target.closest('[data-page]');
    if (page) { state.page = page.dataset.page; render(); return; }
    const action = e.target.closest('[data-action]');
    if (!action) return;
    const a = action.dataset.action;
    if (a === 'export') exportShipments();
    if (a === 'exportCOD') exportCOD();
    if (a === 'exportCustomers') exportCustomers();
    if (a === 'exportCourier') exportCourier();
    if (a === 'track') { state.trackingQuery = action.dataset.awb; state.page = 'tracking'; render(); return; }
    if (a === 'label') {
      const shipment = state.shipments.find(x => x.awb === action.dataset.awb);
      if (shipment) showLabel(shipment);
    }
    if (a === 'advance') await advanceStatus(action.dataset.awb);
    if (a === 'addCustomer') addCustomer();
    if (a === 'customerDetails') customerDetails(action.dataset.id);
    if (a === 'customerStatement') customerStatement(action.dataset.id);
    if (a === 'resetBooking') { state.selectedRate = null; state.selectedCourierId = ''; render(); }
  });

  $('#modalClose')?.addEventListener('click', closeModal);
  $('#modalBackdrop')?.addEventListener('click', e => { if (e.target.id === 'modalBackdrop') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  $('#mobileMenu')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('open'));
  $('#dismissBanner')?.addEventListener('click', () => $('.demo-banner')?.classList.add('hidden'));
  $('#helpBtn')?.addEventListener('click', () => {
    $('#modalTitle').textContent = 'About TeraShip';
    $('#modalBody').innerHTML = `<p><b>TeraShip by TeraSyncTech</b> stores customer and shipment records in your Supabase organization.</p>
      <ul><li>Customer and shipment records are database-backed.</li><li>Courier prices are illustrative.</li><li>AWB references and labels are demo-only.</li><li>Tracking is not connected to courier networks.</li><li>Live courier booking requires authorized carrier APIs and backend integration.</li></ul>
      <div class="callout warning">Do not use the demo label as a real shipping label. Do not store payment-card data or publish secret keys.</div>`;
    openModal();
  });
  $('#profileMenu')?.addEventListener('click', () => toast(authUser?.email || 'Signed-in administrator'));
  if ($('#year')) $('#year').textContent = new Date().getFullYear();

  async function start() {
    const content = $('#pageContent');
    if (content) content.innerHTML = '<div class="empty-state"><b>Connecting to TeraShip database…</b>Please wait.</div>';
    try {
      await loadData();
      render();
    } catch (error) {
      console.error('TeraShip startup error:', error);
      if (content) content.innerHTML = `<div class="empty-state"><b>Could not load TeraShip data</b>${escapeHtml(error?.message || 'Check the Supabase connection and table permissions.')}</div>`;
      toast('Database connection failed. Check the browser console or Supabase policies.');
    }
  }

  start();
})();
     
