/* TeraShip Dashboard — first clean working page.
   Uses the existing Supabase client and authenticated session.
   Courier rates, AWBs, labels and tracking are illustrative until real
   courier APIs/contracts are connected. Never use a service-role key here. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const money = value => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(Number(value || 0));
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const shortDate = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const db = window.supabaseClient;
  let shipments = [];
  let customers = [];
  let couriers = [];
  let currentUser = window.terashipUser || null;
  let currentProfile = window.terashipProfile || null;

  function showMessage(title, message, isError = false) {
    const host = $('#pageContent');
    if (!host) return;
    host.innerHTML = `
      <section class="ts-panel ts-message">
        <div class="ts-message-icon">${isError ? '!' : '…'}</div>
        <div><h2>${safe(title)}</h2><p>${safe(message)}</p></div>
      </section>`;
  }

  function addStyles() {
    if ($('#teraship-dashboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'teraship-dashboard-styles';
    style.textContent = `
      #pageContent .ts-dashboard{color:var(--ink,#18233b);font-family:inherit}
      #pageContent .ts-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:4px 0 22px;flex-wrap:wrap}
      #pageContent .ts-head h1{font-size:27px;margin:0 0 6px;color:var(--ink,#18233b)}
      #pageContent .ts-muted{color:var(--muted,#748099);font-size:13px;margin:0}
      #pageContent .ts-btn{border:0;border-radius:10px;padding:11px 16px;background:#3867e8;color:white;font-weight:700;cursor:pointer}
      #pageContent .ts-btn:disabled{opacity:.6;cursor:wait}
      #pageContent .ts-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;margin-bottom:18px}
      #pageContent .ts-stat,#pageContent .ts-panel{background:var(--white,#fff);border:1px solid var(--line,#e6eaf1);border-radius:15px;padding:18px;box-shadow:0 3px 14px rgba(24,35,59,.04)}
      #pageContent .ts-stat-label{font-size:13px;color:var(--muted,#748099);margin-bottom:10px}
      #pageContent .ts-stat-value{font-size:25px;font-weight:800;letter-spacing:-.5px}
      #pageContent .ts-stat-note{font-size:12px;color:var(--muted,#748099);margin-top:7px}
      #pageContent .ts-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,1fr);gap:16px}
      #pageContent .ts-panel h2{font-size:16px;margin:0 0 15px}
      #pageContent .ts-table-wrap{overflow-x:auto}
      #pageContent .ts-table{width:100%;border-collapse:collapse;min-width:580px}
      #pageContent .ts-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted,#748099);padding:10px 8px;border-bottom:1px solid var(--line,#e6eaf1)}
      #pageContent .ts-table td{padding:13px 8px;border-bottom:1px solid var(--line,#e6eaf1);font-size:13px}
      #pageContent .ts-table tr:last-child td{border-bottom:0}
      #pageContent .ts-awb{font-weight:750;color:#315fd2}
      #pageContent .ts-pill{display:inline-block;padding:5px 9px;border-radius:20px;background:#eef2f8;color:#526078;font-size:11px;font-weight:700;text-transform:capitalize}
      #pageContent .ts-pill.delivered{background:#e6f6ee;color:#13784d}
      #pageContent .ts-pill.booked,#pageContent .ts-pill.picked-up{background:#eaf0ff;color:#315fd2}
      #pageContent .ts-pill.cancelled,#pageContent .ts-pill.failed{background:#fff0ee;color:#b64235}
      #pageContent .ts-courier-row{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line,#e6eaf1);font-size:13px}
      #pageContent .ts-courier-row:last-child{border-bottom:0}
      #pageContent .ts-empty{padding:24px 12px;text-align:center;color:var(--muted,#748099);font-size:13px}
      #pageContent .ts-message{display:flex;align-items:center;gap:14px;margin:16px 0}
      #pageContent .ts-message h2{margin:0 0 5px;font-size:17px}
      #pageContent .ts-message p{margin:0;color:var(--muted,#748099);font-size:13px}
      #pageContent .ts-message-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#fff0e6;color:#b65a19;font-weight:900}
      @media(max-width:900px){#pageContent .ts-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#pageContent .ts-grid{grid-template-columns:1fr}}
      @media(max-width:480px){#pageContent .ts-stats{gap:9px}#pageContent .ts-stat{padding:13px}#pageContent .ts-stat-value{font-size:20px}#pageContent .ts-head h1{font-size:23px}}
    `;
    document.head.appendChild(style);
  }

  async function getAuthenticatedUser() {
         if (!db) {
      throw new Error('Supabase client is not loaded. Check js/supabase-config.js.');
    }

    const { data, error } = await db.auth.getSession();
    if (error) throw error;

    const sessionUser = data?.session?.user;
    if (!sessionUser) {
      throw new Error('Your login session is missing. Please sign out and sign in again.');
    }

    currentUser = sessionUser;

    if (!currentProfile || currentProfile.id !== sessionUser.id) {
      const result = await db.from('profiles')
        .select('id, full_name, role, organization_id')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (result.error) {
        throw new Error('Could not read your user profile: ' + result.error.message);
      }

      currentProfile = result.data;
      window.terashipUser = currentUser;
      window.terashipProfile = currentProfile;
    }

    if (!currentProfile) {
      throw new Error('Your login is active, but no profile row was found for this user in the profiles table.');
    }

    return sessionUser;
  }

  async function loadDashboardData() {
    await getAuthenticatedUser();

    const results = await Promise.all([
      db.from('shipments')
        .select('id, awb_number, booking_date, receiver_name, receiver_city, courier_charge, customer_charge, status, created_at, courier_id')
        .order('created_at', { ascending: false })
        .limit(100),

      db.from('customers')
        .select('id, name')
        .order('created_at', { ascending: false })
        .limit(1000),

      db.from('couriers')
        .select('id, name, active')
        .order('name', { ascending: true })
    ]);

    const labels = ['Shipments', 'Customers', 'Couriers'];

    for (let i = 0; i < results.length; i++) {
      if (results[i].error) {
        throw new Error(labels[i] + ' could not be loaded: ' + results[i].error.message);
      }
    }

    shipments = results[0].data || [];
    customers = results[1].data || [];
    couriers = (results[2].data || []).filter(c => c.active !== false);
  }

  function statusClass(status) {
    return String(status || 'pending')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }

  function renderDashboard() {
    const host = $('#pageContent');
    if (!host) return;

    addStyles();

    const total = shipments.length;
    const today = todayKey();

    const todayCount = shipments.filter(s =>
      String(s.booking_date || s.created_at || '').slice(0, 10) === today
    ).length;

    const delivered = shipments.filter(s =>
      String(s.status || '').toLowerCase() === 'delivered'
    ).length;

    const inTransit = shipments.filter(s =>
      ['in transit', 'in_transit', 'picked up', 'picked-up']
        .includes(String(s.status || '').toLowerCase())
    ).length;

    const billed = shipments.reduce((sum, s) =>
      sum + Number(s.customer_charge || 0), 0
    );

    const courierCost = shipments.reduce((sum, s) =>
      sum + Number(s.courier_charge || 0), 0
    );

    const courierMap = new Map(couriers.map(c => [c.id, c.name]));
    const courierCounts = new Map();

    shipments.forEach(s => {
      const name = courierMap.get(s.courier_id) || 'Not assigned';
      courierCounts.set(name, (courierCounts.get(name) || 0) + 1);
    });

    const courierRows = [...courierCounts.entries()]
      .sort((a, b) => b[1] - a[1]);

    const recentRows = shipments.slice(0, 8).map(s => `
      <tr>
        <td><span class="ts-awb">${safe(s.awb_number || '—')}</span></td>
        <td>${safe(s.receiver_name || '—')}
          <div class="ts-muted">${safe(s.receiver_city || '')}</div>
        </td>
        <td>${safe(courierMap.get(s.courier_id) || 'Not assigned')}</td>
        <td>${shortDate(s.booking_date || s.created_at)}</td>
        <td><span class="ts-pill ${statusClass(s.status)}">${safe(s.status || 'Pending')}</span></td>
      </tr>
    `).join('');

    host.innerHTML = `
      <main class="ts-dashboard">
        <header class="ts-head">
          <div>
            <h1>Dashboard</h1>
            <p class="ts-muted">
              Welcome${currentProfile?.full_name
                ? ', ' + safe(currentProfile.full_name)
                : ''}. Here's your shipment overview.
            </p>
          </div>
          <button class="ts-btn" id="tsRefreshBtn" type="button">
            ↻ Refresh dashboard
          </button>
        </header>

        <section class="ts-stats" aria-label="Shipment summary">
          <article class="ts-stat">
            <div class="ts-stat-label">Total shipments</div>
            <div class="ts-stat-value">${total}</div>
            <div class="ts-stat-note">Latest 100 records</div>
          </article>

          <article class="ts-stat">
            <div class="ts-stat-label">Booked today</div>
            <div class="ts-stat-value">${todayCount}</div>
            <div class="ts-stat-note">Based on booking date</div>
          </article>

          <article class="ts-stat">
            <div class="ts-stat-label">In transit</div>
            <div class="ts-stat-value">${inTransit}</div>
            <div class="ts-stat-note">${delivered} delivered in loaded records</div>
          </article>

          <article class="ts-stat">
            <div class="ts-stat-label">Customers</div>
            <div class="ts-stat-value">${customers.length}</div>
            <div class="ts-stat-note">${couriers.length} active courier services</div>
          </article>
        </section>

        <section class="ts-stats">
          <article class="ts-stat">
            <div class="ts-stat-label">Customer charges</div>
            <div class="ts-stat-value">${money(billed)}</div>
            <div class="ts-stat-note">From loaded shipment records</div>
          </article>

          <article class="ts-stat">
            <div class="ts-stat-label">Courier charges</div>
            <div class="ts-stat-value">${money(courierCost)}</div>
            <div class="ts-stat-note">Recorded courier cost</div>
          </article>

          <article class="ts-stat">
            <div class="ts-stat-label">Estimated difference</div>
            <div class="ts-stat-value">${money(billed - courierCost)}</div>
            <div class="ts-stat-note">Not a verified profit figure</div>
          </article>

          <article class="ts-stat">
            <div class="ts-stat-label">Delivered</div>
            <div class="ts-stat-value">${delivered}</div>
            <div class="ts-stat-note">From loaded shipment records</div>
          </article>
        </section>

        <section class="ts-grid">
          <article class="ts-panel">
            <h2>Recent shipments</h2>
            ${recentRows
              ? `<div class="ts-table-wrap">
                  <table class="ts-table">
                    <thead>
                      <tr>
                        <th>AWB number</th>
                        <th>Receiver</th>
                        <th>Courier</th>
                        <th>Booking date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>${recentRows}</tbody>
                  </table>
                </div>`
              : '<div class="ts-empty">No shipments found yet. Your new bookings will appear here.</div>'
            }
          </article>

          <article class="ts-panel">
            <h2>Courier summary</h2>
            ${courierRows.length
              ? courierRows.map(([name, count]) => `
                  <div class="ts-courier-row">
                    <span>${safe(name)}</span>
                    <strong>${count}</strong>
                  </div>
                `).join('')
              : '<div class="ts-empty">No shipment activity yet.</div>'
            }
            <p class="ts-muted" style="margin-top:14px">
              Courier pricing and tracking are demo-only until official courier integrations are connected.
            </p>
          </article>
              </section>
      </main>
    `;

    const refreshButton = $('#tsRefreshBtn');
    if (refreshButton) {
      refreshButton.addEventListener('click', async () => {
        refreshButton.disabled = true;
        refreshButton.textContent = 'Refreshing…';

        try {
          await loadDashboardData();
          renderDashboard();
        } catch (error) {
          console.error('TeraShip refresh error:', error);
          showMessage(
            'Could not refresh dashboard',
            error.message || 'Please try again.',
            true
          );
        } finally {
          const button = $('#tsRefreshBtn');
          if (button) {
            button.disabled = false;
            button.textContent = '↻ Refresh dashboard';
          }
        }
      });
    }
  }
  async function loadCustomersPage() {
    const host = $('#pageContent');
    if (!host) return;

    host.innerHTML = '<div class="empty-state">Loading customers...</div>';

    try {
      const result = await db.from('customers')
        .select('id, name, phone, email, address, city, state, pincode, gst_number, created_at')
        .order('created_at', { ascending: false });

      if (result.error) throw result.error;

      customers = result.data || [];
      renderCustomersPage();
    } catch (error) {
      showMessage('Customers could not load', error.message, true);
    }
  }

  function renderCustomersPage() {
    const host = $('#pageContent');
    if (!host) return;

    host.innerHTML = `
      <div class="page-heading">
        <div>
          <h1>Customers</h1>
          <p>Manage your courier customers and their contact details.</p>
        </div>
      </div>

      <section class="panel" style="margin-bottom:18px">
        <h2 id="customerFormTitle">Add New Customer</h2>

        <form id="customerForm">
          <input type="hidden" id="customerId">

          <div class="form-fields">
            <div class="field">
              <label>Customer Name *</label>
              <input id="customerName" required placeholder="Enter customer name">
            </div>

            <div class="field">
              <label>Mobile Number *</label>
              <input id="customerPhone" required placeholder="Mobile number">
            </div>

            <div class="field">
              <label>Email</label>
              <input id="customerEmail" type="email" placeholder="Email address">
            </div>

            <div class="field">
              <label>GST Number</label>
              <input id="customerGST" placeholder="GST number">
            </div>

            <div class="field full">
              <label>Address</label>
              <textarea id="customerAddress" placeholder="Full address"></textarea>
            </div>

            <div class="field">
              <label>City</label>
              <input id="customerCity" placeholder="City">
            </div>

            <div class="field">
              <label>State</label>
              <input id="customerState" placeholder="State">
            </div>

            <div class="field">
              <label>PIN Code</label>
              <input id="customerPincode" maxlength="6" placeholder="PIN code">
            </div>
          </div>

          <div style="display:flex;gap:10px;margin-top:18px">
            <button class="button primary" type="submit" id="customerSave">
              Save Customer
            </button>
            <button class="button" type="button" id="customerCancel">
              Clear Form
            </button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="panel-head">
          <h2>Customer List (${customers.length})</h2>
        </div>

        <div class="toolbar">
          <div class="searchbox">
            <input id="customerSearch" placeholder="Search by name or mobile number">
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>City</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="customerRows"></tbody>
          </table>
        </div>
      </section>
    `;

    const rows = $('#customerRows');

    function drawRows(search = '') {
      const term = search.toLowerCase();

      const filtered = customers.filter(c =>
        String(c.name || '').toLowerCase().includes(term) ||
        String(c.phone || '').toLowerCase().includes(term)
      );

      rows.innerHTML = filtered.length
        ? filtered.map(c => `
          <tr>
            <td><b>${safe(c.name)}</b></td>
            <td>${safe(c.phone || '—')}</td>
            <td>${safe(c.email || '—')}</td>
            <td>${safe(c.city || '—')}</td>
            <td>
              <button class="button small" data-edit="${safe(c.id)}">Edit</button>
              <button class="button small danger" data-delete="${safe(c.id)}">Delete</button>
            </td>
          </tr>
        `).join('')
        : '<tr><td colspan="5" class="empty-state">No customers found.</td></tr>';
    }

    drawRows();

    const customerSearch = $('#customerSearch');
if (customerSearch) customerSearch.addEventListener('input', event => {
      drawRows(event.target.value);
    });

    function clearCustomerForm() {
      $('#customerForm').reset();
      $('#customerId').value = '';
      $('#customerFormTitle').textContent = 'Add New Customer';
      $('#customerSave').textContent = 'Save Customer';
    }

    const customerCancel = $('#customerCancel');
if (customerCancel) customerCancel.addEventListener('click', clearCustomerForm);

    $('#customerForm').addEventListener('submit', async event => {
      event.preventDefault();

      const saveButton = $('#customerSave');
      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';

      try {
        const payload = {
          name: $('#customerName').value.trim(),
          phone: $('#customerPhone').value.trim(),
          email: $('#customerEmail').value.trim() || null,
          gst_number: $('#customerGST').value.trim() || null,
          address: $('#customerAddress').value.trim() || null,
          city: $('#customerCity').value.trim() || null,
          state: $('#customerState').value.trim() || null,
          pincode: $('#customerPincode').value.trim() || null
        };

        const id = $('#customerId').value;

        let result;

        if (id) {
          result = await db.from('customers')
            .update(payload)
            .eq('id', id);
        } else {
          if (!currentProfile?.organization_id) {
            throw new Error('Your organization ID is missing from your profile.');
          }

          payload.organization_id = currentProfile.organization_id;

          result = await db.from('customers').insert(payload);
        }

        if (result.error) throw result.error;

        alert(id ? 'Customer updated successfully.' : 'Customer added successfully.');

        await loadCustomersPage();

      } catch (error) {
        alert('Could not save customer: ' + error.message);
      } finally {
        const button = $('#customerSave');
        if (button) {
          button.disabled = false;
          button.textContent = 'Save Customer';
        }
      }
    });

    rows.addEventListener('click', async event => {
      const editButton = event.target.closest('[data-edit]');
      const deleteButton = event.target.closest('[data-delete]');

      if (editButton) {
        const customer = customers.find(c => c.id === editButton.dataset.edit);
        if (!customer) return;

        $('#customerId').value = customer.id;
        $('#customerName').value = customer.name || '';
        $('#customerPhone').value = customer.phone || '';
        $('#customerEmail').value = customer.email || '';
        $('#customerGST').value = customer.gst_number || '';
        $('#customerAddress').value = customer.address || '';
        $('#customerCity').value = customer.city || '';
        $('#customerState').value = customer.state || '';
        $('#customerPincode').value = customer.pincode || '';

        $('#customerFormTitle').textContent = 'Edit Customer';
        $('#customerSave').textContent = 'Update Customer';

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      if (deleteButton) {
        const id = deleteButton.dataset.delete;

        if (!confirm('Are you sure you want to delete this customer?')) return;

        try {
          const result = await db.from('customers')
            .delete()
            .eq('id', id);

          if (result.error) throw result.error;

          alert('Customer deleted successfully.');
          await loadCustomersPage();

        } catch (error) {
          alert('Could not delete customer: ' + error.message);
        }
      }
    });
  }
   
  async function loadBookingPage() {
    const host = $('#pageContent');
    if (!host) return;

    host.innerHTML = '<p>Loading booking form...</p>';

    try {
      await getAuthenticatedUser();

      const results = await Promise.all([
        db.from('customers')
          .select('id, name, phone, address, city, state, pincode')
          .order('name'),
        db.from('couriers')
          .select('id, name, active')
          .eq('active', true)
          .order('name')
      ]);

      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;

      customers = results[0].data || [];
      couriers = results[1].data || [];

      renderBookingPage();
    } catch (error) {
      showMessage('Booking form could not load', error.message, true);
    }
  }

  function renderBookingPage() {
    const host = $('#pageContent');
    if (!host) return;

    const customerOptions = customers.map(c =>
      `<option value="${safe(c.id)}">${safe(c.name)} — ${safe(c.phone || '')}</option>`
    ).join('');

    const courierOptions = couriers.map(c =>
      `<option value="${safe(c.id)}">${safe(c.name)}</option>`
    ).join('');

    host.innerHTML = `
      <main class="ts-dashboard">
        <header class="ts-head">
          <div>
            <h1>New Shipment Booking</h1>
            <p class="ts-muted">Create a shipment using your saved customers and courier services.</p>
          </div>
       </header>


<section class="ts-panel">
  <h2>Invoice Summary</h2>
            <div class="form-fields">
              <div class="field">
                <label>Select Customer *</label>
                <select id="bookCustomer" required>
                  <option value="">Choose customer</option>
                  ${customerOptions}
                </select>
              </div>

              <div class="field">
                <label>Courier Company *</label>
                <select id="bookCourier" required>
                  <option value="">Choose courier</option>
                  ${courierOptions}
                </select>
              </div>
            </div>

            <h2 style="margin-top:25px">Receiver Details</h2>

            <div class="form-fields">
              <div class="field">
                <label>Receiver Name *</label>
                <input id="bookReceiver" required>
              </div>
              <div class="field">
                <label>Receiver Mobile *</label>
                <input id="bookPhone" required>
              </div>
              <div class="field full">
                <label>Receiver Address *</label>
                <textarea id="bookAddress" required></textarea>
              </div>
              <div class="field">
                <label>City *</label>
                <input id="bookCity" required>
              </div>
              <div class="field">
                <label>State *</label>
                <input id="bookState" required>
              </div>
              <div class="field">
                <label>PIN Code *</label>
                <input id="bookPincode" maxlength="6" required>
              </div>
            </div>

            <h2 style="margin-top:25px">Parcel & Payment</h2>

            <div class="form-fields">
              <div class="field">
                <label>Weight (KG) *</label>
                <input id="bookWeight" type="number" min="0.01" step="0.01" required>
              </div>

              <div class="field">
                <label>Payment Mode *</label>
                <select id="bookPayment" required>
                  <option value="Prepaid">Prepaid</option>
                  <option value="COD">Cash on Delivery (COD)</option>
                </select>
              </div>

              <div class="field">
                <label>COD Amount (₹)</label>
                <input id="bookCOD" type="number" min="0" step="0.01" value="0">
              </div>

              <div class="field">
                <label>Courier Charge (₹)</label>
                <input id="bookCourierCharge" type="number" min="0" step="0.01" value="0" required>
              </div>

              <div class="field">
                <label>Customer Charge (₹)</label>
                <input id="bookCustomerCharge" type="number" min="0" step="0.01" value="0" required>
              </div>

              <div class="field full">
                <label>Shipment Notes</label>
                <textarea id="bookNotes" placeholder="Optional notes"></textarea>
              </div>
            </div>

            <p class="ts-muted" style="margin-top:15px">
              Demo booking only. Courier prices, AWB numbers and tracking are not connected to real courier systems.
            </p>

            <button class="ts-btn" id="bookSave" type="submit">
              Save Shipment Booking
            </button>
          </form>
        </section>
      </main>
    `;

    $('#bookingForm').addEventListener('submit', async event => {
      event.preventDefault();

      const button = $('#bookSave');
      button.disabled = true;
      button.textContent = 'Saving booking...';

      try {
        const customerId = $('#bookCustomer').value;
        const customer = customers.find(c => c.id === customerId);

        if (!customer) throw new Error('Please select a valid customer.');

        const paymentMode = $('#bookPayment').value;
        const codAmount = Number($('#bookCOD').value || 0);

        if (paymentMode === 'COD' && codAmount <= 0) {
          throw new Error('Enter a valid COD amount.');
        }

        if (!currentProfile?.organization_id) {
          throw new Error('Your organization ID is missing.');
        }

        const demoAwb = 'TS' +
          Date.now().toString().slice(-10) +
          Math.floor(Math.random() * 90 + 10);

        const payload = {
          organization_id: currentProfile.organization_id,
          customer_id: customerId,
          courier_id: $('#bookCourier').value,
          awb_number: demoAwb,
          booking_date: todayKey(),
          sender_name: currentProfile.full_name || 'SwiftRoute Logistics',
          sender_phone: '',
          sender_address: '',
          sender_pincode: '',
          receiver_name: $('#bookReceiver').value.trim(),
          receiver_phone: $('#bookPhone').value.trim(),
          receiver_address: $('#bookAddress').value.trim(),
          receiver_city: $('#bookCity').value.trim(),
          receiver_state: $('#bookState').value.trim(),
          receiver_pincode: $('#bookPincode').value.trim(),
          weight: Number($('#bookWeight').value),
          payment_mode: paymentMode,
          cod_amount: paymentMode === 'COD' ? codAmount : 0,
          courier_charge: Number($('#bookCourierCharge').value),
          customer_charge: Number($('#bookCustomerCharge').value),
          status: 'booked',
          notes: $('#bookNotes').value.trim() || null,
          created_by: currentUser.id
        };

        if (!payload.courier_id) {
          throw new Error('Please select a courier company.');
        }

        const result = await db.from('shipments').insert(payload);

        if (result.error) throw result.error;

        alert('Demo shipment booking saved successfully. Demo AWB: ' + demoAwb);

        await loadDashboardData();
        await loadShipmentsPage();

      } catch (error) {
        alert('Booking failed: ' + error.message);
        button.disabled = false;
        button.textContent = 'Save Shipment Booking';
      }
    });
  }
  async function loadShipmentsPage() {
    const host = $('#pageContent');
    if (!host) return;

    host.innerHTML = '<p>Loading shipments...</p>';

    try {
      await loadDashboardData();
      renderShipmentsPage();
    } catch (error) {
      showMessage('Shipments could not load', error.message, true);
    }
  }

  function renderShipmentsPage() {
    const host = $('#pageContent');
    if (!host) return;

    const courierMap = new Map(
      couriers.map(c => [c.id, c.name])
    );

    const rows = shipments.map(s => `
      <tr>
        <td>${safe(s.awb_number || '—')}</td>
        <td>${safe(shortDate(s.booking_date))}</td>
        <td>${safe(s.receiver_name || '—')}</td>

        <td>${safe(s.receiver_city || '—')}</td>
        <td>${safe(courierMap.get(s.courier_id) || '—')}</td>
        <td>${money(s.customer_charge || 0)}</td>
        <td>${safe(s.status || 'Booked')}</td>
      </tr>
    `).join('');

    host.innerHTML = `
      <main class="ts-dashboard">
        <header class="ts-head">
          <div>
            <h1>Shipments</h1>
            <p class="ts-muted">View all shipment bookings.</p>
          </div>
        </header>

        <section class="ts-panel">
          <h2>Shipment List</h2>

          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr>
                  <th>AWB Number</th>
                  <th>Booking Date</th>
                  <th>Receiver</th>
                  <th>City</th>
                  <th>Courier</th>
                  <th>Customer Charge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows || `
                  <tr>
                    <td colspan="7">No shipments booked yet.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    `;
  }
     async function saveTrackingUpdate(event) {
    event.preventDefault();

    const message = $('#adminTrackingMessage');
    const awb = $('#adminTrackingAwb').value.trim();

    message.textContent = 'Saving tracking update...';

    try {
      const { data: shipment, error: shipmentError } = await db
        .from('shipments')
        .select('id, organization_id, awb_number')
        .eq('awb_number', awb)
        .maybeSingle();

      if (shipmentError) throw shipmentError;
      if (!shipment) throw new Error('Shipment not found.');

      const update = {
        organization_id: shipment.organization_id,
        shipment_id: shipment.id,
        status: $('#adminTrackingStatus').value,
        location: $('#adminTrackingLocation').value.trim(),
        remarks: $('#adminTrackingRemarks').value.trim(),
        event_time: new Date().toISOString()
      };

      const { error: insertError } = await db
        .from('tracking_events')
        .insert(update);

      if (insertError) throw insertError;

      const { error: statusError } = await db
        .from('shipments')
        .update({ status: update.status })
        .eq('id', shipment.id);

      if (statusError) throw statusError;

      message.textContent = 'Tracking update saved successfully!';

      $('#adminTrackingForm').reset();

      $('#trackingAwb').value = awb;
      $('#trackingSearchForm').requestSubmit();

    } catch (error) {
      message.textContent = 'Error: ' + error.message;
    }
  }
     async function loadTrackingPage() {
    const host = $('#pageContent');
    if (!host) return;

    host.innerHTML = `
      <main class="ts-dashboard">
        <header class="ts-head">
          <div>
            <h1>Shipment Tracking</h1>
            <p class="ts-muted">Search and track your shipments using an AWB number.</p>
          </div>
        </header>

        <section class="ts-panel">
          <form id="trackingSearchForm">
            <div class="form-fields">
              <div class="field">
                <label>Enter AWB Number</label>
                <input id="trackingAwb" placeholder="Example: TS421311038165" required>
              </div>
            </div>
            <button class="ts-btn" type="submit">Track Shipment</button>
          </form>
        </section>

        <div id="trackingResult"></div>

<section class="ts-panel" style="margin-top:20px">
  <h2>Admin: Add Tracking Update</h2>

  <form id="adminTrackingForm">
    <div class="form-fields">
      <div class="field">
        <label>AWB Number</label>
        <input id="adminTrackingAwb" required placeholder="Enter AWB number">
      </div>

      <div class="field">
        <label>Shipment Status</label>
        <select id="adminTrackingStatus" required>
          <option value="picked_up">Picked Up</option>
          <option value="in_transit">In Transit</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="returned">Returned</option>
        </select>
      </div>

      <div class="field">
        <label>Current Location</label>
        <input id="adminTrackingLocation" placeholder="Enter current location">
      </div>

      <div class="field">
        <label>Remarks</label>
        <input id="adminTrackingRemarks" placeholder="Enter remarks">
      </div>
    </div>

    <button class="ts-btn" type="submit">Save Tracking Update</button>
  </form>

  <p id="adminTrackingMessage"></p>
</section>
      </main>
    `;
$('#adminTrackingForm').addEventListener('submit', saveTrackingUpdate);
    $('#trackingSearchForm').addEventListener('submit', async event => {
      event.preventDefault();

      const awb = $('#trackingAwb').value.trim();
      const resultHost = $('#trackingResult');

      resultHost.innerHTML = '<p>Searching shipment...</p>';

      try {
        const result = await db
          .from('shipments')
          .select('*')
          .eq('awb_number', awb)
          .maybeSingle();

        if (result.error) throw result.error;

        if (!result.data) {
          resultHost.innerHTML = '<p>No shipment found with this AWB number.</p>';
          return;
        }

        const shipment = result.data;

        const history = await db
          .from('tracking_events')
          .select('*')
          .eq('shipment_id', shipment.id)
          .order('event_time', { ascending: false });

        if (history.error) throw history.error;

        const events = history.data || [];

        resultHost.innerHTML = `
          <section class="ts-panel" style="margin-top:20px">
            <h2>Shipment Details</h2>
            <p><strong>AWB:</strong> ${safe(shipment.awb_number)}</p>
            <p><strong>Receiver:</strong> ${safe(shipment.receiver_name)}</p>
            <p><strong>Mobile:</strong> ${safe(shipment.receiver_phone)}</p>
            <p><strong>Destination:</strong> ${safe(shipment.receiver_city)}, ${safe(shipment.receiver_state)}</p>
            <p><strong>Courier:</strong> ${safe(couriers.find(c => c.id === shipment.courier_id)?.name || '—')}</p>
            <p><strong>Current Status:</strong> ${safe(shipment.status)}</p>
          </section>

          <section class="ts-panel" style="margin-top:20px">
            <h2>Tracking History</h2>
           ${
  events.length
    ? events.map((event, index) => `
  <div style="
    display:flex;
    gap:14px;
    padding:14px 0;
    border-bottom:1px solid #e5e7eb;
  ">
    <div style="
      width:12px;
      height:12px;
      min-width:12px;
      margin-top:5px;
      border-radius:50%;
      background:${event.status === 'delivered' ? '#16a34a' : '#2563eb'};
    "></div>

    <div>
      <strong style="font-size:15px">
        ${safe(String(event.status || '').replaceAll('_', ' ').toUpperCase())}
      </strong>

      <p style="margin:5px 0;color:#64748b">
        ${safe(event.location || 'Location not updated')}
      </p>

      <p style="margin:5px 0">
        ${safe(event.remarks || '')}
      </p>

      <small style="color:#94a3b8">
        ${safe(shortDate(event.event_time))}
      </small>
    </div>
  </div>
`).join('')
                : '<p>No tracking updates have been added yet.</p>'
            }
          </section>
        `;
      } catch (error) {
        resultHost.innerHTML =
          '<p>Tracking error: ' + safe(error.message) + '</p>';
         }
    });
  }
  async function loadBillingPage() {
    const host = $('#pageContent');
    if (!host) return;

    host.innerHTML = `
      <main class="ts-dashboard">
        <header class="ts-head">
          <div>
            <h1>Billing & COD Management</h1>
            <p class="ts-muted">Manage invoices, payments and cash on delivery.</p>
          </div>
        </header>
        
        <section class="ts-panel" style="margin-top:20px">
          <h2>Create New Invoice</h2>
          <label>Select Customer</label>
          <select id="invoiceCustomer">
            <option value="">Loading customers...</option>
          </select>
        </section>

        <section class="ts-panel">
          <h2>Invoice Summary</h2>
          <div id="invoiceSummary">Loading invoices...</div>
        </section>
        
        <section class="ts-panel" style="margin-top:20px">
          <h2>Invoices</h2>
          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Total Amount</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody id="invoiceRows">
                <tr><td colspan="5">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="ts-panel" style="margin-top:20px">
          <h2>COD Management</h2>
          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>Shipment ID</th>
                  <th>COD Amount</th>
                  <th>Collected</th>
                  <th>Pending</th>
                  <th>Settlement Status</th>
                </tr>
              </thead>
              <tbody id="codRows">
                <tr><td colspan="5">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    `;

    try {
      const [invoiceResult, codResult, customerResult] = await Promise.all([
  db.from('invoices')
    .select('*')
    .order('created_at', { ascending: false }),

  db.from('cod_records')
    .select('*')
    .order('created_at', { ascending: false }),

  db.from('customers')
    .select('id, name, phone')
    .order('created_at', { ascending: false })
]);
      if (invoiceResult.error) throw invoiceResult.error;
      if (codResult.error) throw codResult.error;
if (customerResult.error) throw customerResult.error;
      const invoices = invoiceResult.data || [];
      const codRecords = codResult.data || [];
const billingCustomers = customerResult.data || [];
       const customerSelect = $('#invoiceCustomer');

if (customerSelect) {
  customerSelect.innerHTML =
    '<option value="">Select a customer</option>' +
    billingCustomers.map(customer => `
      <option value="${safe(customer.id)}">
        ${safe(customer.name)} - ${safe(customer.phone || '')}
      </option>
    `).join('');
}
      const totalInvoices = invoices.reduce(
        (sum, invoice) => sum + Number(invoice.total_amount || 0), 0
      );

      const paidInvoices = invoices.filter(
        invoice => invoice.payment_status === 'paid'
      ).length;

      $('#invoiceSummary').innerHTML = `
        <p><strong>Total Invoices:</strong> ${invoices.length}</p>
        <p><strong>Total Billing:</strong> ${money(totalInvoices)}</p>
        <p><strong>Paid Invoices:</strong> ${paidInvoices}</p>
        <p><strong>Pending Invoices:</strong> ${invoices.length - paidInvoices}</p>
      `;

      $('#invoiceRows').innerHTML = invoices.length
        ? invoices.map(invoice => `
            <tr>
              <td>${safe(invoice.invoice_number)}</td>
              <td>${safe(shortDate(invoice.invoice_date))}</td>
              <td>${safe(customers.find(c => c.id === invoice.customer_id)?.name || '—')}</td>
              <td>${money(invoice.total_amount)}</td>
              <td>${safe(invoice.payment_status || 'unpaid')}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="5">No invoices found.</td></tr>';

      $('#codRows').innerHTML = codRecords.length
        ? codRecords.map(record => `
            <tr>
              <td>${safe(record.shipment_id || '—')}</td>
              <td>${money(record.cod_amount)}</td>
              <td>${money(record.collected_amount)}</td>
              <td>${money(Math.max(0, Number(record.cod_amount || 0) - Number(record.collected_amount || 0)))}</td>
              <td>${safe(record.settlement_status || 'pending')}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="5">No COD records found.</td></tr>';

    } catch (error) {
      host.insertAdjacentHTML(
        'beforeend',
        `<section class="ts-panel"><p>Billing error: ${safe(error.message)}</p></section>`
      );
    }
  }
  async function start() {
    showMessage(
      'Loading TeraShip dashboard',
      'Connecting to your secure database…'
    );

    try {
      await loadDashboardData();
      renderDashboard();
    } catch (error) {
      console.error('TeraShip dashboard error:', error);
      showMessage(
        'Could not load TeraShip dashboard',
        error?.message || 'Please check your Supabase connection and table permissions.',
        true
      );
    }
  }
  // TeraShip sidebar navigation
  const pageNames = {
    dashboard: 'Dashboard',
    shipments: 'Shipments',
    booking: 'Book a shipment',
    tracking: 'Track shipment',
    customers: 'Customers',
    billing: 'Billing & COD',
    reports: 'Reports',
    settings: 'Settings & integrations'
  };

  document.querySelectorAll('.nav-item[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      const page = button.dataset.page;

      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });

      button.classList.add('active');

      const crumb = document.getElementById('pageCrumb');
      if (crumb) crumb.textContent = pageNames[page] || 'Dashboard';

         if (page === 'dashboard') {
  renderDashboard();
} else if (page === 'customers') {
  loadCustomersPage();
} else if (page === 'shipments') {
  loadShipmentsPage();
} else if (page === 'booking') {
  loadBookingPage();
} else if (page === 'tracking') {
  loadTrackingPage();
} else if (page === 'billing') {
  loadBillingPage();
} else {
  showMessage(
    pageNames[page],
    'Navigation is working. This section will be configured next.'
  );
}

      document.getElementById('sidebar')?.classList.remove('open');
    });
  });
  start();
})();

