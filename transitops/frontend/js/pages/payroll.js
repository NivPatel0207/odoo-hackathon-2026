// payroll.js - TransitOps Advanced Payroll & Salaries Management

let currentPayrollData = { staff: [], drivers: [] };
let currentHistoryData = [];
let currentFinancials = null;

// Filter & Sort States
const state = {
  drivers: {
    search: '',
    statusFilter: 'all', // 'all', 'pending', 'settled'
    sortCol: 'pendingAmount',
    sortDir: 'desc'
  },
  staff: {
    search: '',
    statusFilter: 'all', // 'all', 'pending', 'paid'
    sortCol: 'pendingAmount',
    sortDir: 'desc'
  },
  history: {
    search: '',
    typeFilter: '',
    sortCol: 'paidAt',
    sortDir: 'desc'
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth(['fleet_manager', 'financial_analyst'])) return;
  nav.render('payroll');

  await loadAllPayrollData();
});

// Helper: Initials
function getInitials(name) {
  if (!name) return 'TO';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Helper: Currency Formatter
function fmtCurrency(n, decimals = 0) {
  const num = Number(n || 0);
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

// ─── Render Solvency & Liquidity Banner ─────────
function renderSolvencyBanner(fin, pendingTotal) {
  if (!fin) return;
  const banner = document.getElementById('solvency-banner');
  const badge = document.getElementById('solvency-status-badge');
  const badgeText = document.getElementById('solvency-status-text');
  const icon = document.getElementById('solvency-icon');
  const revEl = document.getElementById('solvency-revenue');
  const costEl = document.getElementById('solvency-costs');
  const profitEl = document.getElementById('solvency-profit');
  const profitSub = document.getElementById('solvency-profit-sub');
  const covEl = document.getElementById('solvency-coverage');
  const bar = document.getElementById('solvency-progress-bar');
  const footerMsg = document.getElementById('solvency-footer-msg');

  if (revEl) revEl.innerText = fmtCurrency(fin.totalRevenue, 2);
  if (costEl) costEl.innerText = fmtCurrency(fin.totalOperationalCosts, 2);
  if (profitEl) profitEl.innerText = fmtCurrency(fin.netProfit, 2);

  const coverageRatio = fin.profitCoverageRatio || 0;
  if (covEl) covEl.innerText = `${coverageRatio}%`;
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, coverageRatio))}%`;

  if (!banner || !badge) return;

  banner.classList.remove('status-surplus', 'status-tight', 'status-deficit');
  badge.classList.remove('badge-surplus', 'badge-tight', 'badge-deficit');

  if (fin.solvencyStatus === 'SURPLUS') {
    banner.classList.add('status-surplus');
    badge.classList.add('badge-surplus');
    badgeText.innerText = 'SOLVENT • SURPLUS CASHFLOW';
    if (icon) icon.innerText = '✅';
    if (profitEl) profitEl.style.color = 'var(--color-success)';
    if (profitSub) profitSub.innerText = '100%+ Coverage for all pending payroll';
    if (bar) bar.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    if (footerMsg) footerMsg.innerText = `Healthy Solvency: Current completed trips generated ₹${(fin.netProfit || 0).toLocaleString('en-IN')} net profit, comfortably covering all pending payroll obligations of ₹${(pendingTotal || 0).toLocaleString('en-IN')}.`;
  } else if (fin.solvencyStatus === 'TIGHT_MARGIN') {
    banner.classList.add('status-tight');
    badge.classList.add('badge-tight');
    badgeText.innerText = 'TIGHT MARGIN • EXECUTIVE APPROVAL REQUIRED';
    if (icon) icon.innerText = '⚠️';
    if (profitEl) profitEl.style.color = '#f59e0b';
    if (profitSub) profitSub.innerText = `Partial coverage (${coverageRatio}% of pending)`;
    if (bar) bar.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
    if (footerMsg) footerMsg.innerText = `Operational Caution: Net operational profit (₹${(fin.netProfit || 0).toLocaleString('en-IN')}) is positive but below total pending payroll (₹${(pendingTotal || 0).toLocaleString('en-IN')}). Payouts exceeding profit require Fleet Manager Executive Deficit Draw authorization.`;
  } else {
    // DEFICIT
    banner.classList.add('status-deficit');
    badge.classList.add('badge-deficit');
    badgeText.innerText = 'DEFICIT • DISBURSAL LOCKED';
    if (icon) icon.innerText = '🛑';
    if (profitEl) profitEl.style.color = '#ef4444';
    if (profitSub) profitSub.innerText = 'Operating at an operational loss';
    if (bar) bar.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
    if (footerMsg) footerMsg.innerText = `Critical Solvency Alert: Company operational costs exceed completed trip revenue. Automatic salary disbursals are strictly locked. Only an authorized Fleet Manager can unlock emergency payroll draws from working capital.`;
  }
}

// ─── Tab Switching ─────────────────────────────
window.switchTab = (tabName) => {
  document.querySelectorAll('.tab-pill-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

  const btn = document.getElementById(`tab-btn-${tabName}`);
  const content = document.getElementById(`tab-${tabName}`);

  if (btn) btn.classList.add('active');
  if (content) content.classList.add('active');

  if (tabName === 'history' && currentHistoryData.length === 0) {
    loadPayrollHistory();
  }
};

// ─── Data Loading ──────────────────────────────
async function loadAllPayrollData() {
  try {
    loading.show();
    await Promise.all([
      loadPayrollSummary(),
      loadPayrollRoster()
    ]);
  } catch (err) {
    toast.error('Failed to load payroll data', err.message);
  } finally {
    loading.hide();
  }
}

// 1. KPI Summary
async function loadPayrollSummary() {
  try {
    const res = await api.getPayrollSummary();
    if (res.success && res.data) {
      const d = res.data;

      document.getElementById('kpi-this-month').innerText = fmtCurrency(d.thisMonthPaid, 2);
      document.getElementById('kpi-pending-total').innerText = fmtCurrency(d.pendingTotal, 2);
      document.getElementById('kpi-all-time').innerText = fmtCurrency(d.totalPaidAllTime, 2);
      document.getElementById('kpi-total-members').innerText = d.totalMembers || 0;

      const subtext = document.getElementById('kpi-pending-subtext');
      if (subtext) {
        subtext.innerText = `${d.pendingStaffCount || 0} staff & ${d.pendingDriverCount || 0} drivers pending`;
      }

      // Update badge counts on tabs
      const countDrv = document.getElementById('count-drivers-pending');
      const countStf = document.getElementById('count-staff-pending');
      if (countDrv) countDrv.innerText = d.pendingDriverCount || 0;
      if (countStf) countStf.innerText = d.pendingStaffCount || 0;

      // Solvency & Financial Integration
      if (d.financials) {
        currentFinancials = d.financials;
        renderSolvencyBanner(d.financials, d.pendingTotal);
      }
    }
  } catch (err) {
    console.error('Error loading payroll summary:', err);
  }
}

// 2. Roster Data
async function loadPayrollRoster() {
  try {
    const res = await api.getPayrollRoster();
    if (res.success && res.data) {
      currentPayrollData = res.data;
      updateFilterCounts();
      applyAndRenderDrivers();
      applyAndRenderStaff();
    }
  } catch (err) {
    console.error('Error loading payroll roster:', err);
  }
}

function updateFilterCounts() {
  const drivers = currentPayrollData.drivers || [];
  const staff = currentPayrollData.staff || [];

  const drvPending = drivers.filter(d => (d.pendingAmount || 0) > 0).length;
  const stfPending = staff.filter(s => !s.isPaidThisMonth && (s.baseSalary || 0) > 0).length;

  const elDrvAll = document.getElementById('count-drv-filter-all');
  const elDrvPen = document.getElementById('count-drv-filter-pending');
  if (elDrvAll) elDrvAll.innerText = drivers.length;
  if (elDrvPen) elDrvPen.innerText = drvPending;

  const elStfAll = document.getElementById('count-stf-filter-all');
  const elStfPen = document.getElementById('count-stf-filter-pending');
  if (elStfAll) elStfAll.innerText = staff.length;
  if (elStfPen) elStfPen.innerText = stfPending;
}

// ─── Driver Table Logic (Sort, Filter, Render) ───
window.setDriverStatusFilter = (status) => {
  state.drivers.statusFilter = status;
  document.querySelectorAll('#tab-drivers .filter-chip').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`filter-drv-${status}`);
  if (activeBtn) activeBtn.classList.add('active');
  applyAndRenderDrivers();
};

window.handleDriverSearch = () => {
  state.drivers.search = (document.getElementById('search-drivers').value || '').toLowerCase().trim();
  applyAndRenderDrivers();
};

window.handleSortDrivers = (colKey) => {
  if (state.drivers.sortCol === colKey) {
    state.drivers.sortDir = state.drivers.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.drivers.sortCol = colKey;
    state.drivers.sortDir = (colKey === 'name' || colKey === 'paymentType' || colKey === 'status') ? 'asc' : 'desc';
  }
  updateSortIndicators('drv', state.drivers.sortCol, state.drivers.sortDir);
  applyAndRenderDrivers();
};

function applyAndRenderDrivers() {
  let list = [...(currentPayrollData.drivers || [])];

  // 1. Status Filter
  if (state.drivers.statusFilter === 'pending') {
    list = list.filter(d => (d.pendingAmount || 0) > 0);
  } else if (state.drivers.statusFilter === 'settled') {
    list = list.filter(d => (d.pendingAmount || 0) === 0);
  }

  // 2. Search Filter
  if (state.drivers.search) {
    const q = state.drivers.search;
    list = list.filter(d =>
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.contactNumber && d.contactNumber.toLowerCase().includes(q)) ||
      (d.licenseNumber && d.licenseNumber.toLowerCase().includes(q))
    );
  }

  // 3. Sorting
  const col = state.drivers.sortCol;
  const dir = state.drivers.sortDir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    let valA = a[col];
    let valB = b[col];

    if (col === 'status') {
      valA = (a.pendingAmount || 0) > 0 ? 'pending' : 'settled';
      valB = (b.pendingAmount || 0) > 0 ? 'pending' : 'settled';
    } else if (col === 'lastPaidAt') {
      valA = a.lastPaidAt ? new Date(a.lastPaidAt).getTime() : 0;
      valB = b.lastPaidAt ? new Date(b.lastPaidAt).getTime() : 0;
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  renderDriversTable(list);
}

function renderDriversTable(drivers) {
  const tbody = document.getElementById('drivers-table-body');
  if (!drivers || drivers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-muted">
          <div style="padding: 24px;">
            <div style="font-size: 2rem; margin-bottom: 8px;">👨‍✈️</div>
            <div style="font-weight: 600; color: var(--color-text-primary);">No drivers match your criteria</div>
            <div style="font-size: 0.85rem; margin-top: 4px;">Try clearing filters or search keywords.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = drivers.map(d => {
    const isPending = (d.pendingAmount || 0) > 0;
    const modelBadge = d.paymentType === 'per_trip'
      ? `<span class="pill pill-primary" style="font-size: 0.75rem;">⚡ Per Trip (${fmtCurrency(d.baseRate)})</span>`
      : `<span class="pill pill-info" style="font-size: 0.75rem;">📅 Monthly Flat (${fmtCurrency(d.baseRate)})</span>`;

    const statusPill = isPending
      ? `<span class="status-chip status-chip-pending"><span class="status-dot"></span>Pending</span>`
      : `<span class="status-chip status-chip-settled"><span class="status-dot"></span>Settled</span>`;

    const lastPaidText = d.lastPaidAt
      ? `<div>${new Date(d.lastPaidAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}</div>
         <div class="text-muted" style="font-size:0.75rem; font-family: 'JetBrains Mono', monospace;">+${fmtCurrency(d.lastPaidAmount)}</div>`
      : `<span class="text-muted" style="font-size: 0.78rem;">None yet</span>`;

    const initials = getInitials(d.name);
    const subMeta = d.licenseNumber ? `Lic: ${d.licenseNumber}` : (d.contactNumber || 'No phone');

    return `
      <tr>
        <td>
          <div class="recipient-cell">
            <div class="recipient-avatar avatar-driver">${initials}</div>
            <div>
              <div class="recipient-title">${d.name}</div>
              <div class="recipient-subtitle">${subMeta}</div>
            </div>
          </div>
        </td>
        <td>${modelBadge}</td>
        <td>
          <div style="font-family: 'JetBrains Mono', monospace; font-weight: 600;">${d.pendingTripsCount || 0} Trips</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${d.paymentType === 'per_trip' ? 'Unsettled completed' : 'Monthly flat cycle'}</div>
        </td>
        <td>
          <span class="amount-text ${isPending ? 'amount-pending' : 'amount-settled'}">
            ${fmtCurrency(d.pendingAmount, 2)}
          </span>
        </td>
        <td>${statusPill}</td>
        <td>${lastPaidText}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-primary" onclick="openDriverPayoutModal('${d._id}')" ${!isPending && d.paymentType === 'per_trip' ? 'disabled' : ''}>
            <span>💰 Disburse</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── Staff Table Logic (Sort, Filter, Render) ─────
window.setStaffStatusFilter = (status) => {
  state.staff.statusFilter = status;
  document.querySelectorAll('#tab-staff .filter-chip').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`filter-stf-${status}`);
  if (activeBtn) activeBtn.classList.add('active');
  applyAndRenderStaff();
};

window.handleStaffSearch = () => {
  state.staff.search = (document.getElementById('search-staff').value || '').toLowerCase().trim();
  applyAndRenderStaff();
};

window.handleSortStaff = (colKey) => {
  if (state.staff.sortCol === colKey) {
    state.staff.sortDir = state.staff.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.staff.sortCol = colKey;
    state.staff.sortDir = (colKey === 'name' || colKey === 'role' || colKey === 'department' || colKey === 'status') ? 'asc' : 'desc';
  }
  updateSortIndicators('stf', state.staff.sortCol, state.staff.sortDir);
  applyAndRenderStaff();
};

function applyAndRenderStaff() {
  let list = [...(currentPayrollData.staff || [])];

  // 1. Status Filter
  if (state.staff.statusFilter === 'pending') {
    list = list.filter(u => !u.isPaidThisMonth && (u.baseSalary || 0) > 0);
  } else if (state.staff.statusFilter === 'paid') {
    list = list.filter(u => u.isPaidThisMonth);
  }

  // 2. Search Filter
  if (state.staff.search) {
    const q = state.staff.search;
    list = list.filter(u =>
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  }

  // 3. Sorting
  const col = state.staff.sortCol;
  const dir = state.staff.sortDir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    let valA = a[col];
    let valB = b[col];

    if (col === 'status') {
      valA = a.isPaidThisMonth ? 'paid' : (a.baseSalary > 0 ? 'pending' : 'unset');
      valB = b.isPaidThisMonth ? 'paid' : (b.baseSalary > 0 ? 'pending' : 'unset');
    } else if (col === 'lastPaidAt') {
      valA = a.lastPaidAt ? new Date(a.lastPaidAt).getTime() : 0;
      valB = b.lastPaidAt ? new Date(b.lastPaidAt).getTime() : 0;
    } else if (col === 'pendingAmount') {
      valA = a.pendingAmount || (a.isPaidThisMonth ? 0 : a.baseSalary) || 0;
      valB = b.pendingAmount || (b.isPaidThisMonth ? 0 : b.baseSalary) || 0;
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  renderStaffTable(list);
}

function renderStaffTable(staff) {
  const tbody = document.getElementById('staff-table-body');
  if (!staff || staff.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-muted">
          <div style="padding: 24px;">
            <div style="font-size: 2rem; margin-bottom: 8px;">👥</div>
            <div style="font-weight: 600; color: var(--color-text-primary);">No team members match your criteria</div>
            <div style="font-size: 0.85rem; margin-top: 4px;">Adjust role or department filter to view members.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = staff.map(u => {
    const roleLabel = (u.role || '').replace('_', ' ').toUpperCase();
    const isPending = !u.isPaidThisMonth && (u.baseSalary || 0) > 0;

    let statusPill = '';
    if (u.isPaidThisMonth) {
      statusPill = `<span class="status-chip status-chip-settled"><span class="status-dot"></span>Paid This Month</span>`;
    } else if ((u.baseSalary || 0) > 0) {
      statusPill = `<span class="status-chip status-chip-pending"><span class="status-dot"></span>Pending (${fmtCurrency(u.baseSalary)})</span>`;
    } else {
      statusPill = `<span class="status-chip status-chip-neutral"><span class="status-dot"></span>Salary Unset</span>`;
    }

    const lastPaidText = u.lastPaidAt
      ? `<div>${new Date(u.lastPaidAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}</div>
         <div class="text-muted" style="font-size:0.75rem; font-family: 'JetBrains Mono', monospace;">+${fmtCurrency(u.lastPaidAmount)}</div>`
      : `<span class="text-muted" style="font-size: 0.78rem;">None yet</span>`;

    const initials = getInitials(u.name);

    return `
      <tr>
        <td>
          <div class="recipient-cell">
            <div class="recipient-avatar avatar-staff">${initials}</div>
            <div>
              <div class="recipient-title">${u.name}</div>
              <div class="recipient-subtitle">${u.email}</div>
            </div>
          </div>
        </td>
        <td><span class="pill pill-primary" style="font-size: 0.75rem;">${roleLabel}</span></td>
        <td><span class="pill pill-neutral" style="font-size: 0.75rem;">${u.department || 'Operations'}</span></td>
        <td>
          <span class="amount-text" style="color: var(--color-text-primary);">
            ${fmtCurrency(u.baseSalary, 2)}
          </span>
        </td>
        <td>${statusPill}</td>
        <td>${lastPaidText}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-primary" onclick="openStaffPayoutModal('${u._id}')" ${u.isPaidThisMonth ? 'disabled' : ''}>
            <span>💰 Disburse</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── History Table Logic (Sort, Filter, Render) ───
window.loadPayrollHistory = async () => {
  const typeFilter = document.getElementById('filter-history-type')?.value;
  const query = typeFilter ? `?beneficiaryType=${typeFilter}` : '';

  try {
    loading.show();
    const res = await api.getPayrollHistory(query);
    if (res.success && res.data) {
      currentHistoryData = res.data;
      applyAndRenderHistory();
    }
  } catch (err) {
    toast.error('Failed to load payout history', err.message);
  } finally {
    loading.hide();
  }
};

window.handleHistorySearch = () => {
  state.history.search = (document.getElementById('search-history').value || '').toLowerCase().trim();
  applyAndRenderHistory();
};

window.handleSortHistory = (colKey) => {
  if (state.history.sortCol === colKey) {
    state.history.sortDir = state.history.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.history.sortCol = colKey;
    state.history.sortDir = (colKey === 'beneficiaryName' || colKey === 'role' || colKey === 'paymentMethod') ? 'asc' : 'desc';
  }
  updateSortIndicators('hist', state.history.sortCol, state.history.sortDir);
  applyAndRenderHistory();
};

function applyAndRenderHistory() {
  let list = [...currentHistoryData];

  // 1. Search Filter
  if (state.history.search) {
    const q = state.history.search;
    list = list.filter(r =>
      (r.beneficiaryName && r.beneficiaryName.toLowerCase().includes(q)) ||
      (r.transactionRef && r.transactionRef.toLowerCase().includes(q)) ||
      (r.role && r.role.toLowerCase().includes(q)) ||
      (r.paymentMethod && r.paymentMethod.toLowerCase().includes(q))
    );
  }

  // 2. Sorting
  const col = state.history.sortCol;
  const dir = state.history.sortDir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    let valA = a[col];
    let valB = b[col];

    if (col === 'paidAt') {
      valA = new Date(a.paidAt || a.createdAt).getTime();
      valB = new Date(b.paidAt || b.createdAt).getTime();
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return -1 * dir;
    if (valA > valB) return 1 * dir;
    return 0;
  });

  renderHistoryTable(list);
}

function renderHistoryTable(records) {
  const tbody = document.getElementById('history-table-body');
  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-muted">
          <div style="padding: 24px;">
            <div style="font-size: 2rem; margin-bottom: 8px;">📜</div>
            <div style="font-weight: 600; color: var(--color-text-primary);">No historical disbursements found</div>
            <div style="font-size: 0.85rem; margin-top: 4px;">Disburse a driver settlement or staff salary to create ledger entries.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => {
    const dateStr = new Date(r.paidAt || r.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = new Date(r.paidAt || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const methodStr = (r.paymentMethod || 'Bank Transfer').replace('_', ' ').toUpperCase();
    const isDriver = r.beneficiaryType === 'driver';
    const roleBadge = isDriver ? 'pill-warning' : 'pill-primary';
    const initials = getInitials(r.beneficiaryName);

    return `
      <tr>
        <td>
          <div style="font-weight: 600; font-family: 'JetBrains Mono', monospace; font-size: 0.88rem;">${dateStr}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${timeStr}</div>
        </td>
        <td>
          <div class="recipient-cell">
            <div class="recipient-avatar ${isDriver ? 'avatar-driver' : 'avatar-staff'}">${initials}</div>
            <div>
              <div class="recipient-title">${r.beneficiaryName}</div>
              <div class="recipient-subtitle">${r.trips && r.trips.length > 0 ? `${r.trips.length} Trips Settled` : 'Monthly Salary Disbursed'}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="pill ${roleBadge}" style="font-size: 0.72rem;">${(r.role || r.beneficiaryType).toUpperCase()}</span>
          ${r.isDeficitPayout ? `<span class="pill pill-danger" style="font-size: 0.65rem; margin-left: 4px;" title="Executive Deficit Draw: ${r.deficitOverrideReason || ''}">DEFICIT DRAW</span>` : ''}
        </td>
        <td><span class="pill pill-neutral" style="font-size: 0.72rem;">${methodStr}</span></td>
        <td style="font-family: 'JetBrains Mono', monospace; font-size: 0.88rem;">${fmtCurrency(r.basePay)}</td>
        <td>
          <span class="amount-text amount-settled" style="font-size: 1rem;">
            +${fmtCurrency(r.netPay, 2)}
          </span>
        </td>
        <td>
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--color-text-muted); background: rgba(255,255,255,0.03); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--color-border);">
            ${r.transactionRef || 'N/A'}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-secondary" onclick="viewPayslip('${r._id}')">
            <span>📄 Payslip</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ─── Visual Sort Indicator Updates ─────────────
function updateSortIndicators(prefix, activeCol, dir) {
  document.querySelectorAll(`[id^="sort-${prefix}-"]`).forEach(el => {
    el.innerText = '⇅';
    el.parentElement.classList.remove('sorted-asc', 'sorted-desc');
  });

  const activeIndicator = document.getElementById(`sort-${prefix}-${activeCol}`);
  if (activeIndicator) {
    activeIndicator.innerText = dir === 'asc' ? '▲' : '▼';
    activeIndicator.parentElement.classList.add(dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
  }
}

// ─── Modal Open Logics ─────────────────────────
window.openDriverPayoutModal = (driverId) => {
  const driver = currentPayrollData.drivers.find(d => d._id === driverId);
  if (!driver) return;

  // Reset solvency warning state
  const warningBox = document.getElementById('p-solvency-warning');
  if (warningBox) warningBox.classList.add('hidden');
  const confirmBox = document.getElementById('p-deficit-confirm');
  if (confirmBox) confirmBox.checked = false;
  const reasonBox = document.getElementById('p-deficit-reason');
  if (reasonBox) reasonBox.value = '';

  document.getElementById('p-member-id').value = driver._id;
  document.getElementById('p-beneficiary-type').value = 'driver';
  document.getElementById('p-recipient-name').innerText = driver.name;
  document.getElementById('p-recipient-role').innerText = 'Driver';
  document.getElementById('p-recipient-role').className = 'pill pill-warning';

  const avatar = document.getElementById('p-avatar');
  if (avatar) {
    avatar.className = 'recipient-avatar avatar-driver';
    avatar.innerText = getInitials(driver.name);
  }

  const tripCount = driver.pendingTripsCount || 0;
  document.getElementById('p-recipient-meta').innerText = driver.paymentType === 'per_trip'
    ? `${tripCount} Completed trips pending settlement (Rate: ₹${(driver.baseRate || 0).toLocaleString()}/trip)`
    : `Monthly flat rate (Base: ₹${(driver.baseRate || 0).toLocaleString()}/month)`;

  document.getElementById('p-base-pay').value = driver.pendingAmount || driver.baseRate || 0;
  document.getElementById('p-bonus').value = 0;
  document.getElementById('p-deductions').value = 0;
  document.getElementById('p-transaction-ref').value = 'TXN-' + Date.now().toString().slice(-6);
  document.getElementById('p-notes').value = driver.paymentType === 'per_trip'
    ? `Settlement for ${tripCount} completed trips`
    : `Monthly salary payout (${new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`;

  recalculateNetPay();
  modal.open('payout-modal');
};

window.openStaffPayoutModal = (userId) => {
  const user = currentPayrollData.staff.find(u => u._id === userId);
  if (!user) return;

  // Reset solvency warning state
  const warningBox = document.getElementById('p-solvency-warning');
  if (warningBox) warningBox.classList.add('hidden');
  const confirmBox = document.getElementById('p-deficit-confirm');
  if (confirmBox) confirmBox.checked = false;
  const reasonBox = document.getElementById('p-deficit-reason');
  if (reasonBox) reasonBox.value = '';

  document.getElementById('p-member-id').value = user._id;
  document.getElementById('p-beneficiary-type').value = 'staff';
  document.getElementById('p-recipient-name').innerText = user.name;
  document.getElementById('p-recipient-role').innerText = (user.role || '').replace('_', ' ').toUpperCase();
  document.getElementById('p-recipient-role').className = 'pill pill-primary';

  const avatar = document.getElementById('p-avatar');
  if (avatar) {
    avatar.className = 'recipient-avatar avatar-staff';
    avatar.innerText = getInitials(user.name);
  }

  document.getElementById('p-recipient-meta').innerText = `${user.department || 'Operations'} Department • Monthly Fixed Salary`;

  document.getElementById('p-base-pay').value = user.pendingAmount || user.baseSalary || 0;
  document.getElementById('p-bonus').value = 0;
  document.getElementById('p-deductions').value = 0;
  document.getElementById('p-transaction-ref').value = 'SAL-' + Date.now().toString().slice(-6);
  document.getElementById('p-notes').value = `Monthly salary for ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`;

  recalculateNetPay();
  modal.open('payout-modal');
};

// ─── Live Recalculation & Solvency Check ───────
window.recalculateNetPay = () => {
  const base = Number(document.getElementById('p-base-pay').value || 0);
  const bonus = Number(document.getElementById('p-bonus').value || 0);
  const deductions = Number(document.getElementById('p-deductions').value || 0);
  const net = Math.max(0, base + bonus - deductions);

  document.getElementById('p-net-pay-display').innerText = fmtCurrency(net, 2);
  
  const chipBase = document.getElementById('p-chip-base');
  const chipBonus = document.getElementById('p-chip-bonus');
  const chipDeductions = document.getElementById('p-chip-deductions');

  if (chipBase) chipBase.innerText = `Base: ${fmtCurrency(base)}`;
  if (chipBonus) chipBonus.innerText = `+ Bonus: ${fmtCurrency(bonus)}`;
  if (chipDeductions) chipDeductions.innerText = `- Deductions: ${fmtCurrency(deductions)}`;

  // Solvency check against live company net profit
  const warningBox = document.getElementById('p-solvency-warning');
  const warningDesc = document.getElementById('p-solvency-warning-desc');
  const overrideSection = document.getElementById('p-deficit-override-section');
  const submitBtn = document.getElementById('btn-submit-payout');

  const netProfit = currentFinancials ? (currentFinancials.netProfit || 0) : 0;
  const isDeficit = (netProfit <= 0) || (net > netProfit);

  if (isDeficit) {
    if (warningBox) warningBox.classList.remove('hidden');
    const user = auth.getUser();
    const isFleetManager = user && user.role === 'fleet_manager';
    const shortfall = Math.max(0, net - netProfit);

    if (warningDesc) {
      warningDesc.innerHTML = `This payout of <strong>${fmtCurrency(net)}</strong> exceeds available company net operational profit of <strong>${fmtCurrency(netProfit)}</strong> by <strong style="color: var(--color-danger);">${fmtCurrency(shortfall)}</strong>.`;
    }

    if (!isFleetManager) {
      if (overrideSection) overrideSection.style.display = 'none';
      if (warningBox) warningBox.classList.add('danger');
      if (warningDesc) {
        warningDesc.innerHTML += `<div style="margin-top: 6px; font-weight: 600; color: #ef4444;">🔒 Solvency Policy Enforcement: Payouts are locked when profit is insufficient. Only a Fleet Manager can authorize an Executive Deficit Draw.</div>`;
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.title = 'Disbursal locked due to company profit deficit';
      }
    } else {
      if (overrideSection) overrideSection.style.display = 'block';
      if (warningBox) warningBox.classList.remove('danger');
      toggleDeficitSubmitState();
    }
  } else {
    if (warningBox) warningBox.classList.add('hidden');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.title = '';
    }
  }
};

window.toggleDeficitSubmitState = () => {
  const warningBox = document.getElementById('p-solvency-warning');
  const submitBtn = document.getElementById('btn-submit-payout');
  if (!warningBox || warningBox.classList.contains('hidden')) {
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  const user = auth.getUser();
  if (user && user.role !== 'fleet_manager') {
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  const confirmed = document.getElementById('p-deficit-confirm')?.checked;
  const reason = (document.getElementById('p-deficit-reason')?.value || '').trim();

  if (submitBtn) {
    submitBtn.disabled = !(confirmed && reason.length >= 10);
    submitBtn.title = submitBtn.disabled ? 'Check authorization and provide justification (minimum 10 characters)' : '';
  }
};

// ─── Handle Payout Submit ──────────────────────
window.handlePayoutSubmit = async (e) => {
  e.preventDefault();

  const warningBox = document.getElementById('p-solvency-warning');
  const isDeficitWarning = warningBox && !warningBox.classList.contains('hidden');

  const payload = {
    memberId: document.getElementById('p-member-id').value,
    beneficiaryType: document.getElementById('p-beneficiary-type').value,
    basePay: Number(document.getElementById('p-base-pay').value),
    bonus: Number(document.getElementById('p-bonus').value),
    deductions: Number(document.getElementById('p-deductions').value),
    paymentMethod: document.getElementById('p-payment-method').value,
    transactionRef: document.getElementById('p-transaction-ref').value,
    notes: document.getElementById('p-notes').value
  };

  if (isDeficitWarning) {
    payload.deficitOverride = true;
    payload.deficitOverrideReason = (document.getElementById('p-deficit-reason')?.value || '').trim();
  }

  try {
    loading.show();
    const res = await api.disbursePayroll(payload);
    if (res.success) {
      toast.success(res.message || 'Payout successfully disbursed');
      modal.close('payout-modal');
      await loadAllPayrollData();
      if (document.getElementById('tab-history').classList.contains('active')) {
        await loadPayrollHistory();
      }
    }
  } catch (err) {
    toast.error('Payout failed', err.message);
  } finally {
    loading.hide();
  }
};

// ─── Batch Payroll Run ─────────────────────────
window.triggerBatchPayroll = async () => {
  const pendingTotal = Number((document.getElementById('kpi-pending-total')?.innerText || '').replace(/[^0-9.]/g, '') || 0);
  const netProfit = currentFinancials ? (currentFinancials.netProfit || 0) : 0;
  const user = auth.getUser();
  const isFleetManager = user && user.role === 'fleet_manager';

  const isDeficit = (netProfit <= 0) || (pendingTotal > netProfit);

  if (isDeficit) {
    if (!isFleetManager) {
      toast.error(
        'Batch Disbursal Blocked',
        `Solvency Policy: Total pending payroll (${fmtCurrency(pendingTotal)}) exceeds net operational profit (${fmtCurrency(netProfit)}). Only a Fleet Manager can authorize an Executive Deficit Draw.`
      );
      return;
    }

    // Open Executive Deficit Draw modal for Fleet Manager
    const shortfall = Math.max(0, pendingTotal - netProfit);
    document.getElementById('batch-deficit-required').innerText = fmtCurrency(pendingTotal);
    document.getElementById('batch-deficit-profit').innerText = fmtCurrency(netProfit);
    document.getElementById('batch-deficit-shortfall').innerText = fmtCurrency(shortfall);
    document.getElementById('batch-deficit-desc').innerHTML = `
      Batch payroll requirement of <strong>${fmtCurrency(pendingTotal)}</strong> exceeds current operational net profit of <strong>${fmtCurrency(netProfit)}</strong> by <strong style="color: var(--color-danger);">${fmtCurrency(shortfall)}</strong>.
    `;
    document.getElementById('batch-deficit-confirm').checked = false;
    document.getElementById('batch-deficit-reason').value = '';
    modal.open('deficit-override-modal');
    return;
  }

  // Normal Disbursal within positive profit
  const confirmed = await ui.confirm(
    `Total pending payroll is ${fmtCurrency(pendingTotal)}, fully covered by current net operational profit of ${fmtCurrency(netProfit)}.\n\nProceed to disburse batch payroll to all pending members?`
  );
  if (!confirmed) return;

  try {
    loading.show();
    const res = await api.disburseAllPayroll();
    if (res.success) {
      toast.success(res.message);
      await loadAllPayrollData();
      if (document.getElementById('tab-history').classList.contains('active')) {
        await loadPayrollHistory();
      }
    }
  } catch (err) {
    toast.error('Batch payroll failed', err.message);
  } finally {
    loading.hide();
  }
};

window.handleBatchDeficitSubmit = async (e) => {
  e.preventDefault();
  const confirmed = document.getElementById('batch-deficit-confirm').checked;
  const reason = (document.getElementById('batch-deficit-reason').value || '').trim();

  if (!confirmed || reason.length < 10) {
    toast.error('Validation Error', 'Please confirm authorization and provide justification (minimum 10 characters).');
    return;
  }

  try {
    loading.show();
    const res = await api.disburseAllPayroll({
      deficitOverride: true,
      deficitOverrideReason: reason
    });
    if (res.success) {
      toast.success(res.message);
      modal.close('deficit-override-modal');
      await loadAllPayrollData();
      if (document.getElementById('tab-history').classList.contains('active')) {
        await loadPayrollHistory();
      }
    }
  } catch (err) {
    toast.error('Batch deficit disbursal failed', err.message);
  } finally {
    loading.hide();
  }
};

// ─── View Payslip Modal ────────────────────────
window.viewPayslip = (settlementId) => {
  const s = currentHistoryData.find(x => x._id === settlementId);
  if (!s) return;

  const dateStr = new Date(s.paidAt || s.createdAt).toLocaleDateString([], { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = new Date(s.paidAt || s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const container = document.getElementById('payslip-modal-content');
  container.innerHTML = `
    <div class="voucher-cert">
      <div class="voucher-watermark">PAID</div>
      
      <!-- Voucher Brand Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 1px dashed var(--color-border); padding-bottom: 18px;">
        <div>
          <div style="font-size: 1.6rem; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--color-primary); letter-spacing: -0.02em;">TransitOps</div>
          <div style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 2px;">Smart Fleet Logistics & Operations Pvt Ltd</div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 6px;">Voucher No: <strong style="font-family: 'JetBrains Mono', monospace; color: var(--color-primary);">${s.transactionRef || s._id}</strong></div>
        </div>
        <div style="text-align: right;">
          <span class="status-chip status-chip-settled" style="font-size: 0.85rem; padding: 6px 14px;">
            <span class="status-dot"></span>OFFICIALLY RECONCILED
          </span>
          <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 6px;">Issued on: ${dateStr} (${timeStr})</div>
        </div>
      </div>

      <!-- Beneficiary & Disbursement Metadata Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; padding: 16px; background: rgba(255,255,255,0.025); border-radius: var(--radius-md); border: 1px solid var(--color-border);">
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.05em;">BENEFICIARY DETAILS</div>
          <div style="font-size: 1.15rem; font-weight: 700; color: var(--color-text-primary); margin-top: 2px;">${s.beneficiaryName}</div>
          <div style="font-size: 0.82rem; color: var(--color-text-muted); margin-top: 2px;">Role: <strong style="color: var(--color-text-secondary);">${(s.role || '').toUpperCase()}</strong> (${(s.beneficiaryType || '').toUpperCase()})</div>
        </div>
        <div>
          <div style="font-size: 0.72rem; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.05em;">DISBURSEMENT METHOD</div>
          <div style="font-size: 1.05rem; font-weight: 600; color: var(--color-text-primary); margin-top: 2px;">${(s.paymentMethod || 'Bank Transfer').replace('_', ' ').toUpperCase()}</div>
          <div style="font-size: 0.82rem; color: var(--color-text-muted); margin-top: 2px;">Authorized Officer: ${s.paidBy?.name || 'Finance Department'}</div>
        </div>
      </div>

      <!-- Itemized Compensation Breakdown -->
      <div style="margin-bottom: 20px;">
        <table class="data-table" style="width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
          <thead>
            <tr style="background: rgba(255, 255, 255, 0.04);">
              <th style="padding: 10px 14px;">Compensation Component</th>
              <th style="text-align: right; padding: 10px 14px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding: 12px 14px;">Base Scheduled Earnings / Rate</td>
              <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; padding: 12px 14px;">${fmtCurrency(s.basePay, 2)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 14px; color: var(--color-success);">Performance Incentives & Bonus (+)</td>
              <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--color-success); padding: 12px 14px;">+ ${fmtCurrency(s.bonus || 0, 2)}</td>
            </tr>
            <tr>
              <td style="padding: 12px 14px; color: var(--color-danger);">Statutory / Operational Deductions (-)</td>
              <td style="text-align: right; font-family: 'JetBrains Mono', monospace; font-weight: 600; color: var(--color-danger); padding: 12px 14px;">- ${fmtCurrency(s.deductions || 0, 2)}</td>
            </tr>
            <tr style="background: rgba(16, 185, 129, 0.08); font-weight: 700; font-size: 1.15rem; border-top: 2px solid rgba(16, 185, 129, 0.3);">
              <td style="padding: 14px; color: var(--color-text-primary);">Total Net Disbursed</td>
              <td style="text-align: right; font-family: 'JetBrains Mono', monospace; color: #34d399; padding: 14px;">${fmtCurrency(s.netPay, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${s.isDeficitPayout ? `
        <div style="margin-top: 16px; margin-bottom: 16px; padding: 14px 16px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md);">
          <div style="font-weight: 700; color: #f59e0b; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span> EXECUTIVE DEFICIT DRAW RECONCILIATION
          </div>
          <div style="font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 4px;">
            Disbursal authorized under Solvency Policy Override by <strong>${s.deficitOverrideBy?.name || 'Fleet Manager'}</strong>.
          </div>
          <div style="font-size: 0.78rem; font-style: italic; color: var(--color-text-muted); margin-top: 4px;">
            "${s.deficitOverrideReason || 'Working capital reserves allocation'}"
          </div>
        </div>
      ` : ''}

      ${s.notes ? `
        <div style="font-size: 0.82rem; color: var(--color-text-muted); background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--color-primary);">
          <strong>Auditor Remark:</strong> "${s.notes}"
        </div>
      ` : ''}
    </div>
  `;

  modal.open('payslip-modal');
};

// ─── Export to CSV ─────────────────────────────
window.exportPayrollHistory = () => {
  if (!currentHistoryData || currentHistoryData.length === 0) {
    toast.error('No payroll records to export');
    return;
  }

  const headers = ['Date', 'Beneficiary', 'Type', 'Role', 'Payment Mode', 'Base Pay', 'Bonus', 'Deductions', 'Net Disbursed', 'Reference', 'Notes'];
  const rows = currentHistoryData.map(r => [
    new Date(r.paidAt || r.createdAt).toISOString().split('T')[0],
    `"${r.beneficiaryName}"`,
    r.beneficiaryType,
    r.role,
    r.paymentMethod,
    r.basePay,
    r.bonus || 0,
    r.deductions || 0,
    r.netPay,
    `"${r.transactionRef || ''}"`,
    `"${r.notes || ''}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TransitOps_Payroll_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  toast.success('Payroll ledger exported to CSV');
};
