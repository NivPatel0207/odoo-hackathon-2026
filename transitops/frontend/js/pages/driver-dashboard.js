// driver-dashboard.js

let timerInterval = null;
let currentEldData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth(['driver'])) return;
  nav.render('driver-dashboard');
  
  const user = auth.getUser();
  if (user.role === 'driver') {
    await loadDriverDashboardData(user.driverProfileId);
  }
});

async function loadDriverDashboardData(driverId) {
  try {
    loading.show();
    const res = await api.get(`/driver-portal/${driverId}/dashboard`);
    if (res.success && res.data) {
      renderDashboard(res.data);
    }
  } catch (err) {
    console.error('Failed to load dashboard data', err);
    toast.error('Could not load dashboard data.');
  } finally {
    loading.hide();
  }
}

function renderDashboard(data) {
  const { driver, activeTrip, upcomingTrips, completedTripsCount, eldStatus, assignedVehicle } = data;

  // 1. Header / Greeting
  const hour = new Date().getHours();
  let greeting = "Good Evening";
  if (hour < 12) greeting = "Good Morning";
  else if (hour < 18) greeting = "Good Afternoon";
  
  const greetEl = document.getElementById('dash-greeting');
  if (greetEl) greetEl.innerText = `${greeting}, ${driver.name.split(' ')[0]}`;

  // 2. ELD Status & Timer
  currentEldData = eldStatus;
  updateEldUI();

  // 3. Active Trip Widget
  const tripRouteEl = document.getElementById('dash-trip-route');
  const tripDetailsEl = document.getElementById('dash-trip-details');
  
  if (activeTrip) {
    if(tripRouteEl) tripRouteEl.innerText = `${activeTrip.source} → ${activeTrip.destination}`;
    if(tripDetailsEl) {
      const etaText = activeTrip.eta ? `ETA: ${new Date(activeTrip.eta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` : 'No ETA';
      tripDetailsEl.innerHTML = `<b>${activeTrip.tripCode}</b> &bull; ${etaText}`;
    }
  } else {
    if(tripRouteEl) tripRouteEl.innerText = 'No Active Trip';
    if(tripDetailsEl) tripDetailsEl.innerText = 'You have no trips currently in progress.';
  }

  // 4. Vehicle Widget
  const vehRegEl = document.getElementById('dash-vehicle-reg');
  const vehModelEl = document.getElementById('dash-vehicle-model');
  
  if (assignedVehicle) {
    if(vehRegEl) vehRegEl.innerText = assignedVehicle.registrationNumber || 'Unknown';
    if(vehModelEl) vehModelEl.innerText = `${assignedVehicle.make || ''} ${assignedVehicle.model || ''}`.trim() || 'Unknown Vehicle';
  } else {
    if(vehRegEl) vehRegEl.innerText = 'Unassigned';
    if(vehModelEl) vehModelEl.innerText = 'No vehicle currently assigned.';
  }

  // 5. Upcoming Schedule
  const listEl = document.getElementById('upcoming-trips-list');
  if (listEl) {
    if (!upcomingTrips || upcomingTrips.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 20px;">No upcoming trips scheduled.</div>';
    } else {
      listEl.innerHTML = upcomingTrips.map(t => {
        const dateDisplay = t.scheduledDate ? new Date(t.scheduledDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Not Set';
        return `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 16px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-weight: 600; color: var(--color-text-primary); font-size: 1.05rem;">${t.source} &rarr; ${t.destination}</span>
              <span style="color: var(--color-text-muted); font-size: 0.85rem;">${t.tripCode} &bull; ${t.priority.toUpperCase()} Priority</span>
            </div>
            <div style="text-align: right;">
              <span style="display: block; color: var(--color-primary); font-weight: 600; font-size: 0.9rem;">${dateDisplay}</span>
              <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; background: rgba(255,255,255,0.1); color: #fff; margin-top: 4px;">${t.status.toUpperCase()}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 6. Performance & Safety
  const compEl = document.getElementById('stat-completed-trips');
  if (compEl) compEl.innerText = completedTripsCount || 0;

  const score = driver.safetyScore || 100;
  const scoreEl = document.getElementById('safety-score-value');
  const ringEl = document.getElementById('safety-score-ring');
  
  if (scoreEl) scoreEl.innerText = score;
  if (ringEl) {
    ringEl.setAttribute('stroke-dasharray', `${score}, 100`);
    if (score >= 90) ringEl.setAttribute('stroke', 'var(--color-success)');
    else if (score >= 70) ringEl.setAttribute('stroke', 'var(--color-warning)');
    else ringEl.setAttribute('stroke', 'var(--color-danger)');
  }

  // 7. Compliance & Readiness Badges
  const badgeLicense = document.getElementById('badge-license');
  const valLicense = document.getElementById('val-license-status');
  if (badgeLicense && valLicense) {
    if (driver.licenseExpiryDate) {
      const expDate = new Date(driver.licenseExpiryDate);
      const now = new Date();
      const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) {
        valLicense.textContent = 'Expired';
        badgeLicense.className = 'compliance-badge status-danger';
      } else if (diffDays < 60) {
        valLicense.textContent = `Expiring (${diffDays}d)`;
        badgeLicense.className = 'compliance-badge status-warning';
      } else {
        const cat = driver.licenseCategory ? ` (Cat. ${driver.licenseCategory})` : '';
        valLicense.textContent = `Active${cat}`;
        badgeLicense.className = 'compliance-badge status-success';
      }
    } else {
      valLicense.textContent = 'Active';
      badgeLicense.className = 'compliance-badge status-success';
    }
  }

  const badgeKyc = document.getElementById('badge-kyc');
  const valKyc = document.getElementById('val-kyc-status');
  if (badgeKyc && valKyc) {
    const isVerified = driver.kycVerified ?? (driver.kyc?.aadharVerified ?? true);
    if (isVerified) {
      valKyc.textContent = 'Verified ✓';
      badgeKyc.className = 'compliance-badge status-success';
    } else {
      valKyc.textContent = 'Pending Verification';
      badgeKyc.className = 'compliance-badge status-warning';
    }
  }

  const badgeReadiness = document.getElementById('badge-readiness');
  const valReadiness = document.getElementById('val-readiness-status');
  if (badgeReadiness && valReadiness) {
    if (activeTrip) {
      valReadiness.textContent = `On Trip (${activeTrip.tripCode})`;
      badgeReadiness.className = 'compliance-badge status-success';
    } else if (driver.status === 'suspended') {
      valReadiness.textContent = 'Suspended';
      badgeReadiness.className = 'compliance-badge status-danger';
    } else {
      valReadiness.textContent = 'Ready for Dispatch';
      badgeReadiness.className = 'compliance-badge status-success';
    }
  }
}

// ─── ELD LOGIC ───────────────────────────────────────

async function changeEldStatus(status) {
  const user = auth.getUser();
  const driverId = user.driverProfileId;
  if (!driverId) return;
  try {
    loading.show();
    await api.post(`/driver-portal/${driverId}/eld`, { status });
    toast.success(`Duty status changed to ${status.replace('_', ' ')}`);
    // Reload dashboard to update ELD timers
    await loadDriverDashboardData(driverId);
  } catch (err) {
    toast.error('Failed to change status', err.message);
  } finally {
    loading.hide();
  }
}

function updateEldUI() {
  if (!currentEldData) return;
  
  const status = currentEldData.currentStatus;
  
  const dashStatus = document.getElementById('dash-status');
  if (dashStatus) {
    dashStatus.setAttribute('data-status', status);
    dashStatus.innerText = status.replace('_', ' ');
  }
  
  startTimer(currentEldData.metrics);
}

function startTimer(metrics) {
  if (timerInterval) clearInterval(timerInterval);
  
  let remainingMins = metrics.remainingDrivingMinutes;
  
  const updateDisplay = () => {
    const dashTimeEl = document.getElementById('dash-time-remaining');
    if (!dashTimeEl) return;

    if (remainingMins <= 0) {
      dashTimeEl.innerText = "00h 00m";
      dashTimeEl.style.color = "var(--color-danger)";
      return;
    }
    const hrs = Math.floor(remainingMins / 60).toString().padStart(2, '0');
    const mins = Math.floor(remainingMins % 60).toString().padStart(2, '0');
    
    dashTimeEl.innerText = `${hrs}h ${mins}m`;
    dashTimeEl.style.color = (remainingMins < 60) ? "var(--color-warning)" : "var(--color-text-primary)";
  };
  
  updateDisplay();
  
  if (currentEldData.currentStatus === 'DRIVING') {
    timerInterval = setInterval(() => {
      remainingMins -= 1;
      updateDisplay();
    }, 60000);
  }
}
