document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth()) return;
  nav.render('dashboard');

  try {
    loading.show();
    const res = await api.getDashboard();
    if (res.success) {
      renderKPIs(res.data);
      renderCharts(res.data);
    }
  } catch (err) {
    toast.error('Failed to load dashboard', err.message);
  } finally {
    loading.hide();
  }
});

function renderKPIs(data) {
  const kpiGrid = document.getElementById('kpi-grid');
  
  const statCards = [
    { title: 'Total Vehicles', value: data.vehicles.total, icon: '🚛', color: '#f59e0b', sub: `${data.vehicles.available} available` },
    { title: 'Active Trips', value: data.trips.dispatched, icon: '📍', color: '#3b82f6', sub: `${data.trips.total} total trips` },
    { title: 'Vehicles In Shop', value: data.vehicles.inShop, icon: '🔧', color: '#ef4444', sub: `${data.maintenance.open} open tickets` },
    { title: 'Drivers On Duty', value: data.vehicles.onTrip, icon: '👨‍✈️', color: '#10b981', sub: `${data.drivers.available} available` }
  ];

  kpiGrid.innerHTML = statCards.map(s => `
    <div class="stat-card" style="--accent-start: ${s.color}; --accent-end: ${s.color}dd;">
      <div class="stat-icon" style="background: ${s.color}22; color: ${s.color};">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.title}</div>
      <div class="text-muted" style="font-size:0.75rem;">${s.sub}</div>
    </div>
  `).join('');

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

function renderCharts(data) {
  // Chart.js dark theme defaults
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = '#1e2d4a';
  Chart.defaults.font.family = "'Inter', sans-serif";

  // 1. Profitability Bar Chart
  const ctxProfit = document.getElementById('profitabilityChart').getContext('2d');
  new Chart(ctxProfit, {
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
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: '#1e2d4a' } },
        x: { grid: { display: false } }
      }
    }
  });

  // 2. Fleet Composition Doughnut Chart
  const ctxFleet = document.getElementById('fleetStatusChart').getContext('2d');
  const retired = data.vehicles.total - (data.vehicles.available + data.vehicles.onTrip + data.vehicles.inShop);
  new Chart(ctxFleet, {
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
          labels: { color: '#f1f5f9', padding: 15, font: { size: 11 } }
        }
      }
    }
  });
}
