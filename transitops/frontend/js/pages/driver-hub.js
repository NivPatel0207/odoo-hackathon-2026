// driver-hub.js

let selectedDriverId = null;
let timerInterval = null;
let currentEldData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth(['dispatcher', 'safety_officer', 'financial_analyst', 'driver'])) return;
  nav.render('driver-hub');
  
  // Only admins/dispatchers need to select a driver to simulate
  const user = auth.getUser();
  if (['dispatcher', 'safety_officer', 'financial_analyst'].includes(user.role)) {
    document.getElementById('admin-driver-selector').style.display = 'flex';
    
    // Role-based Access Control for panels
    if (user.role === 'dispatcher' || user.role === 'safety_officer') {
      // Hide Settlements
      const settlementCard = document.querySelector('.settlement-card');
      if(settlementCard) settlementCard.style.display = 'none';
      document.getElementById('driver-dashboard').style.gridTemplateColumns = '1fr';
    } else if (user.role === 'financial_analyst') {
      // Hide ELD
      const eldCard = document.querySelector('.eld-card');
      if(eldCard) eldCard.style.display = 'none';
      document.getElementById('driver-dashboard').style.gridTemplateColumns = '1fr';
    }

    await loadDriverOptions();
  } else if (user.role === 'driver') {
    // If the logged in user IS a driver
    selectedDriverId = user.driverProfileId; 
    document.getElementById('driver-dashboard').style.display = 'grid';
    
    const adminSelector = document.getElementById('admin-driver-selector');
    if (adminSelector) adminSelector.style.display = 'none';
    
    loadDriverData();
  }
});

async function loadDriverOptions() {
  try {
    const res = await api.getDrivers();
    const select = document.getElementById('driver-select');
    select.innerHTML = '<option value="">Select a driver to view hub...</option>';
    res.data.forEach(d => {
      select.innerHTML += `<option value="${d._id}">${d.name}</option>`;
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadDriverData() {
  const user = auth.getUser();
  if (user.role !== 'driver') {
    const select = document.getElementById('driver-select');
    if (select) {
      selectedDriverId = select.value;
    }
  }
  
  if (!selectedDriverId) {
    document.getElementById('driver-dashboard').style.display = 'none';
    const emptyState = document.getElementById('driver-empty-state');
    if(emptyState) emptyState.style.display = 'flex';
    return;
  }
  
  const emptyState = document.getElementById('driver-empty-state');
  if(emptyState) emptyState.style.display = 'none';
  document.getElementById('driver-dashboard').style.display = 'grid';
  
  const tasks = [];
  
  // Only fetch data the user's role is authorized to see, avoiding 403 redirects
  if (['fleet_manager', 'dispatcher', 'safety_officer', 'driver'].includes(user.role)) {
    tasks.push(fetchEldStatus());
  }
  if (['fleet_manager', 'financial_analyst', 'driver'].includes(user.role)) {
    tasks.push(fetchSettlements());
  }
  
  await Promise.all(tasks);
}

// ─── ELD LOGIC ───────────────────────────────────────

async function fetchEldStatus() {
  try {
    const res = await api.get(`/driver-portal/${selectedDriverId}/eld`);
    currentEldData = res.data;
    updateEldUI();
  } catch (err) {
    console.error('Failed to load ELD', err);
  }
}

async function changeEldStatus(status) {
  if (!selectedDriverId) return;
  try {
    loading.show();
    await api.post(`/driver-portal/${selectedDriverId}/eld`, { status });
    toast.success(`Duty status changed to ${status.replace('_', ' ')}`);
    await fetchEldStatus();
  } catch (err) {
    toast.error('Failed to change status', err.message);
  } finally {
    loading.hide();
  }
}

function updateEldUI() {
  if (!currentEldData) return;
  
  const status = currentEldData.currentStatus;
  const badge = document.getElementById('eld-status-badge');
  badge.className = `eld-status-badge status-${status.toLowerCase()}`;
  badge.innerText = status.replace('_', ' ');
  
  document.querySelectorAll('.eld-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-${status}`);
  if (activeBtn) activeBtn.classList.add('active');
  
  startTimer(currentEldData.metrics);
}

function startTimer(metrics) {
  if (timerInterval) clearInterval(timerInterval);
  
  const timerDisplay = document.getElementById('eld-timer');
  
  // Calculate remaining
  let remainingMins = metrics.remainingDrivingMinutes;
  
  const updateDisplay = () => {
    const timerCircle = document.getElementById('eld-timer-circle');
    // Total drive time in a day is 11 hours = 660 mins
    const maxMins = 660;
    
    if (remainingMins <= 0) {
      timerDisplay.innerText = "00:00";
      timerDisplay.style.color = "var(--color-danger)";
      if(timerCircle) {
        timerCircle.style.stroke = "var(--color-danger)";
        timerCircle.style.strokeDashoffset = "565.48"; // Empty ring
      }
      return;
    }
    const hrs = Math.floor(remainingMins / 60).toString().padStart(2, '0');
    const mins = Math.floor(remainingMins % 60).toString().padStart(2, '0');
    timerDisplay.innerText = `${hrs}:${mins}`;
    
    const isWarning = remainingMins < 60;
    timerDisplay.style.color = isWarning ? "var(--color-warning)" : "var(--color-text-primary)";
    
    if (timerCircle) {
      timerCircle.style.stroke = isWarning ? "var(--color-warning)" : "var(--color-primary)";
      // SVG circle radius = 90, circumference = 2 * PI * 90 = 565.48
      const fraction = remainingMins / maxMins;
      // 0 offset = full ring, 565.48 = empty ring
      const offset = 565.48 * (1 - fraction);
      timerCircle.style.strokeDashoffset = offset.toFixed(2);
    }
  };
  
  updateDisplay();
  
  // In a real ELD, it ticks down. We'll simulate 1 min every 60s if DRIVING.
  if (currentEldData.currentStatus === 'DRIVING') {
    timerInterval = setInterval(() => {
      remainingMins -= 1;
      updateDisplay();
    }, 60000);
  }
}

// ─── SETTLEMENT LOGIC ────────────────────────────────

async function fetchSettlements() {
  try {
    const res = await api.get(`/driver-portal/${selectedDriverId}/settlement`);
    const data = res.data;
    
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    document.getElementById('est-pay').innerText = formatter.format(data.estimatedPay);
    
    document.getElementById('pay-type').innerText = 
      `Estimated Pay (${data.driver.paymentType === 'per_trip' ? 'Per Trip' : 'Monthly Flat'})`;
      
    document.getElementById('pending-count').innerText = data.pendingTrips;
    
    const list = document.getElementById('pending-trips');
    if (data.trips.length === 0) {
      list.innerHTML = `<div class="text-muted" style="text-align:center; padding: 20px;">No pending trips to settle.</div>`;
    } else {
      list.innerHTML = data.trips.map(t => `
        <div class="trip-item">
          <div class="trip-item-left">
            <div style="font-weight: 600;">${t.tripCode}</div>
            <div style="font-size: 0.8rem; color: var(--color-text-muted);">${new Date(t.completedAt).toLocaleDateString()}</div>
          </div>
          <div style="font-weight: 700; color: var(--color-success);">+ ${data.driver.paymentType === 'per_trip' ? formatter.format(data.driver.paymentAmount || 0) : '—'}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load settlements', err);
  }
}
