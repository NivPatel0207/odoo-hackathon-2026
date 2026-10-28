document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth(['fleet_manager', 'financial_analyst'])) return;
  nav.render('analytics');
  renderBreadcrumbs(['Analytics']);

  try {
    loading.show();
    const res = await api.getFuelEfficiency();
    if (res.success && res.data) {
      window.globalAnalyticsData = res.data;
      initFuelFilter(res.data);
    } else {
      showEmptyState();
    }
  } catch (err) {
    toast.error('Failed to load analytics', err.message);
    showEmptyState();
  } finally {
    loading.hide();
  }
});

function initFuelFilter(data) {
  const filterEl = document.getElementById('chart-fuel-filter');
  if (!filterEl) return;
  
  // Extract unique fuel types
  const fuelTypes = [...new Set(data.map(d => d.fuelType || 'diesel'))];
  
  // Map internal types to display labels
  const labels = {
    diesel: 'Diesel Vehicles',
    petrol: 'Petrol Vehicles',
    electric: 'Electric Vehicles (EV)',
    cng: 'CNG Vehicles'
  };

  if (fuelTypes.length === 0) {
    filterEl.innerHTML = '<option value="">No data</option>';
    filterEl.disabled = true;
    showEmptyState();
    return;
  }

  // Populate options
  filterEl.innerHTML = fuelTypes.map(type => 
    `<option value="${type}">${labels[type] || type.charAt(0).toUpperCase() + type.slice(1)}</option>`
  ).join('');

  filterEl.addEventListener('change', () => {
    renderFilteredView(filterEl.value);
  });

  // Trigger initial render
  renderFilteredView(filterEl.value);
}

function renderFilteredView(fuelType) {
  const data = window.globalAnalyticsData || [];
  const filtered = data.filter(d => (d.fuelType || 'diesel') === fuelType);
  
  renderFuelChart(filtered, fuelType);
  renderTopPerformers(filtered, fuelType);
}

function showEmptyState() {
  const chartContainer = document.getElementById('fuelChart')?.parentElement;
  if (chartContainer) {
    chartContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);font-size:0.9rem;">No trip data available yet. Complete some trips to see analytics.</div>';
  }
  const topPerf = document.getElementById('top-performers');
  if (topPerf) {
    topPerf.innerHTML = '<div style="color:var(--color-text-muted);text-align:center;padding:1rem;font-size:0.85rem;">No data available</div>';
  }
}

let fuelChartInstance = null;

function renderFuelChart(data, selectedFuelType) {
  const ctx = document.getElementById('fuelChart')?.getContext('2d');
  if (!ctx) return;
  
  if (fuelChartInstance) {
    fuelChartInstance.destroy();
  }
  
  if (!data || data.length === 0) {
    showEmptyState();
    return;
  }

  // Sort by km/L descending (best first)
  const sorted = [...data].sort((a, b) => (b.kmPerLiter || 0) - (a.kmPerLiter || 0));
  const labels = sorted.map(d => d.vehicleName || d.regNumber || 'Unknown Vehicle');
  
  // Display as Units/100km for clarity (lower is better visually)
  const efficiency = sorted.map(d => {
    const kpl = d.kmPerLiter || 0;
    return kpl > 0 ? parseFloat((100 / kpl).toFixed(2)) : 0;
  });

  const isElectric = selectedFuelType === 'electric';
  const unitName = isElectric ? 'kWh' : 'L';
  const yAxisLabel = isElectric ? 'kWh per 100 km (lower = better)' : 'Liters per 100 km (lower = better)';

  fuelChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `Energy/Fuel Use (${unitName}/100km)`,
        data: efficiency,
        backgroundColor: efficiency.map((v, i) => 
          i === 0 ? 'rgba(16, 185, 129, 0.8)' :
          i === efficiency.length - 1 ? 'rgba(239, 68, 68, 0.7)' :
          'rgba(59, 130, 246, 0.7)'
        ),
        borderColor: efficiency.map((v, i) =>
          i === 0 ? '#10b981' : i === efficiency.length - 1 ? '#ef4444' : '#3b82f6'
        ),
        borderWidth: 1,
        borderRadius: 4
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
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y} ${unitName}/100km`
          }
        }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          grid: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#1e2d4a' },
          title: { display: true, text: yAxisLabel, color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#94a3b8' },
          ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#94a3b8' }
        },
        x: { 
          grid: { display: false },
          ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--color-text-muted').trim() || '#94a3b8' }
        }
      }
    }
  });
}

function renderTopPerformers(data, selectedFuelType) {
  const container = document.getElementById('top-performers');
  if (!container) return;
  
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="text-muted text-center py-4">No data available in this category</div>';
    return;
  }

  // Best = highest km/L
  const sorted = [...data]
    .filter(d => d.kmPerLiter > 0)
    .sort((a, b) => (b.kmPerLiter || 0) - (a.kmPerLiter || 0))
    .slice(0, 5);
  
  if (sorted.length === 0) {
    container.innerHTML = '<div style="color:var(--color-text-muted);text-align:center;padding:1rem;font-size:0.85rem;">No data available</div>';
    return;
  }

  const isElectric = selectedFuelType === 'electric';
  const unitName = isElectric ? 'km/kWh' : 'km/L';

  container.innerHTML = sorted.map((d, i) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: var(--color-bg-tertiary); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 24px; height: 24px; border-radius: 50%; background: ${i === 0 ? '#10b981' : 'var(--color-primary)'}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.8rem;">${i + 1}</div>
        <div>
          <div style="font-weight: 500; font-size: 0.9rem;">${d.vehicleName || d.regNumber || 'Vehicle'}</div>
          <div style="font-size: 0.75rem; color: var(--color-text-muted);">${(d.totalDistance || 0).toLocaleString()} km over ${d.tripCount || 0} trips</div>
        </div>
      </div>
      <div style="font-weight: bold; color: var(--color-success); font-size: 0.9rem;">
        ${(d.kmPerLiter || 0).toFixed(1)} ${unitName}
      </div>
    </div>
  `).join('');
}
