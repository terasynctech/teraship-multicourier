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

  start();
})();

