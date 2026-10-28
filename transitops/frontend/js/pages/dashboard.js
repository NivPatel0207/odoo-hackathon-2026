document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth(['fleet_manager', 'safety_officer', 'financial_analyst', 'dispatcher'])) return;
  nav.render('dashboard');
  renderBreadcrumbs(['Dashboard']);

  try {
    loading.show();
    const res = await api.getDashboardKPIs();
    if (res.success) {
      renderKPIs(res.data);
      renderCharts(res.data);
    }
  } catch (err) {
    toast.error('Failed to load dashboard', err.message);
  } finally {
    loading.hide();
    // Start interactive onboarding for first-time users
    setTimeout(() => {
      if (typeof onboarding !== 'undefined') onboarding.start();
    }, 800);
  }
});

function renderKPIs(data) {
  if (!data) return;
  const kpiGrid = document.getElementById('kpi-grid');
  
  const statCards = [
    { title: 'Total Vehicles', value: data.vehicles.total, icon: '🚛', color: '#f59e0b', sub: `${data.vehicles.available} available`, trend: '+2% M/M' },
    { title: 'Active Trips', value: data.trips.dispatched, icon: '📍', color: '#3b82f6', sub: `${data.trips.total} total trips`, trend: '+15% W/W' },
    { title: 'Vehicles In Shop', value: data.vehicles.inShop, icon: '🔧', color: '#ef4444', sub: `${data.maintenance.open} open tickets`, trend: '-10% M/M' },
    { title: 'Drivers On Duty', value: data.vehicles.onTrip, icon: '👨‍✈️', color: '#10b981', sub: `${data.drivers.available} available`, trend: 'Steady' }
  ];

  kpiGrid.innerHTML = statCards.map(s => `
    <div class="stat-card" style="--accent-start: ${s.color}; --accent-end: ${s.color}dd; position:relative;">
      <div class="stat-icon" style="background: ${s.color}22; color: ${s.color};">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.title}</div>
      <div class="text-muted" style="font-size:0.75rem; margin-top:0.5rem; display:flex; justify-content:space-between;">
        <span>${s.sub}</span>
        <span style="color:${s.trend.startsWith('-') ? 'var(--color-success)' : 'var(--color-primary)'}; font-weight:bold;">${s.trend}</span>
      </div>
    </div>
  `).join('');
  
  const lastUpdated = new Date().toLocaleTimeString();
  if(!document.getElementById('last-updated')) {
    const headerTitle = document.querySelector('.header-title');
    if (headerTitle) headerTitle.innerHTML += `<span id="last-updated" style="font-size: 0.75rem; color: var(--color-text-muted); margin-left: 1rem; font-weight: normal;">Last updated: ${lastUpdated}</span>`;
  }

  const finGrid = document.getElementById('financial-grid');
  finGrid.innerHTML = `
    <div class="stat-card" style="--accent-start: #10b981;">
      <div class="stat-label">Total Revenue</div>
      <div class="stat-value" style="color:var(--color-success);">${fmt.currency(data.financial.totalRevenue)}</div>
      <div class="mt-2 flex justify-between" style="font-size:0.75rem; border-top:1px solid var(--color-border); padding-top:var(--space-2);">
        <span class="text-muted">Net Profit</span>
        <span class="font-bold text-success">${fmt.currency(data.financial.netProfit)}</span>
      </div>
    </div>
    <div class="stat-card" style="--accent-start: #ef4444;">
      <div class="stat-label">Total Operational Costs</div>
      <div class="stat-value" style="color:var(--color-danger);">${fmt.currency(data.financial.totalCosts)}</div>
      <div class="mt-2 flex justify-between" style="font-size:0.75rem; border-top:1px solid var(--color-border); padding-top:var(--space-2);">
        <span class="text-muted">Avg ROI</span>
        <span class="font-bold ${data.financial.roi >= 0 ? 'text-success' : 'text-danger'}">${data.financial.roi}%</span>
      </div>
    </div>
  `;
}

let profitChartInstance = null;
let fleetChartInstance = null;

function renderCharts(data) {
  if (!data || !data.financial) return;
  // Chart.js dark theme defaults
  const getCssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const textColor = getCssVar('--color-text-muted') || '#94a3b8';
  const borderColor = getCssVar('--color-border') || '#1e2d4a';
  const legendColor = getCssVar('--color-text-primary') || '#f1f5f9';

  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = borderColor;
  Chart.defaults.font.family = "'Inter', sans-serif";

  // 1. Profitability Bar Chart
  const ctxProfit = document.getElementById('profitabilityChart').getContext('2d');
  if (profitChartInstance) profitChartInstance.destroy();
  profitChartInstance = new Chart(ctxProfit, {
    type: 'bar',
    data: {
      labels: ['Revenue', 'Costs', 'Net Profit'],
      datasets: [{
        label: 'Amount (₹)',
        data: [data.financial.totalRevenue, data.financial.totalCosts, data.financial.netProfit],
        backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(245, 158, 11, 0.8)'],
        borderColor: ['#10b981', '#ef4444', '#f59e0b'],
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: borderColor } },
        x: { grid: { display: false } }
      }
    }
  });

  // 2. Fleet Composition Doughnut Chart
  const ctxFleet = document.getElementById('fleetStatusChart').getContext('2d');
  const retired = data.vehicles.total - (data.vehicles.available + data.vehicles.onTrip + data.vehicles.inShop);
  if (fleetChartInstance) fleetChartInstance.destroy();
  fleetChartInstance = new Chart(ctxFleet, {
    type: 'doughnut',
    data: {
      labels: ['Available', 'On Trip', 'In Shop', 'Retired'],
      datasets: [{
        data: [data.vehicles.available, data.vehicles.onTrip, data.vehicles.inShop, retired],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#64748b'],
        borderWidth: 0,
        cutout: '70%'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: legendColor, padding: 15, font: { size: 11 } }
        }
      }
    }
  });
}

window.refreshDashboard = async function() {
  try {
    loading.show();
    const res = await api.getDashboardKPIs();
    if (res.success) {
      renderKPIs(res.data);
      renderCharts(res.data);
      if (typeof toast !== 'undefined') toast.success('Dashboard refreshed successfully');
    }
  } catch (err) {
    if (typeof toast !== 'undefined') toast.error('Failed to refresh dashboard', err.message);
  } finally {
    loading.hide();
  }
};
