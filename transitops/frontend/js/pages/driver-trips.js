// driver-trips.js

let driverTrips = [];
let activeTrip = null;
let currentActionTripId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = auth.getUser();
  if (user && user.role === 'driver') {
    await loadTrips();
  }
  
  document.getElementById('inspection-form').addEventListener('submit', handleInspectionSubmit);
  document.getElementById('complete-form').addEventListener('submit', handleCompleteSubmit);
});

async function loadTrips() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    const res = await api.get(`/driver-portal/${user.driverProfileId}/trips`);
    if (res.success && res.data) {
      driverTrips = res.data;
      renderTrips();
    }
  } catch (err) {
    toast.error('Failed to load trips');
    console.error(err);
  } finally {
    loading.hide();
  }
}

function renderTrips() {
  const activeStatuses = ['assigned', 'accepted', 'loading', 'dispatched', 'in_transit', 'arrived', 'delayed'];
  activeTrip = driverTrips.find(t => activeStatuses.includes(t.status));
  
  renderActiveTrip();
  renderUpcomingTrips();
  renderHistoryTrips();
}

function renderActiveTrip() {
  const container = document.getElementById('active-trip-container');
  if (!activeTrip) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  document.getElementById('at-route').innerText = `${activeTrip.source} → ${activeTrip.destination}`;
  document.getElementById('at-trip-code').innerText = activeTrip.tripCode;
  document.getElementById('at-status').innerText = activeTrip.status.replace('_', ' ').toUpperCase();
  
  const dateDisplay = activeTrip.eta ? new Date(activeTrip.eta).toLocaleString() : (activeTrip.scheduledDate ? new Date(activeTrip.scheduledDate).toLocaleString() : 'Not Set');
  document.getElementById('at-eta').innerText = dateDisplay;
  
  if (activeTrip.vehicle) {
    document.getElementById('at-vehicle').innerText = `${activeTrip.vehicle.registrationNumber} (${activeTrip.vehicle.make})`;
  } else {
    document.getElementById('at-vehicle').innerText = 'Unassigned';
  }
  
  // Render Actions based on status
  const actionsContainer = document.getElementById('active-trip-actions');
  actionsContainer.innerHTML = '';
  
  const st = activeTrip.status;
  
  if (st === 'assigned') {
    actionsContainer.innerHTML = `
      <button class="btn-primary" onclick="updateTripStatus('${activeTrip._id}', 'accepted')">Accept Trip</button>
      <button class="btn-secondary" onclick="rejectTrip('${activeTrip._id}')" style="background: rgba(220, 38, 38, 0.2); color: #fca5a5;">Reject</button>
    `;
  } else if (st === 'accepted') {
    actionsContainer.innerHTML = `
      <button class="btn-primary" onclick="showInspectionModal('${activeTrip._id}')">Pre-Trip Inspection</button>
    `;
  } else if (st === 'loading' || st === 'delayed') { // sometimes delayed means failed inspection and fixed later
    actionsContainer.innerHTML = `
      <button class="btn-primary" onclick="updateTripStatus('${activeTrip._id}', 'in_transit')">Start Trip</button>
    `;
  } else if (st === 'dispatched' || st === 'in_transit') {
    actionsContainer.innerHTML = `
      <button class="btn-primary" onclick="updateTripStatus('${activeTrip._id}', 'arrived')">Mark as Arrived</button>
    `;
  } else if (st === 'arrived') {
    actionsContainer.innerHTML = `
      <button class="btn-primary" onclick="window.location.href='driver-deliveries.html'">Submit ePOD</button>
    `;
  }
}

function renderUpcomingTrips() {
  const upcoming = driverTrips.filter(t => t.status === 'draft' || (t.status === 'assigned' && (!activeTrip || t._id !== activeTrip._id)));
  const list = document.getElementById('upcoming-trips-list');
  
  if (upcoming.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 20px;">No upcoming trips.</div>';
    return;
  }
  
  list.innerHTML = upcoming.map(t => {
    const d = t.scheduledDate ? new Date(t.scheduledDate).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Not Set';
    return `
      <div class="trip-item">
        <div>
          <div class="trip-route">${t.source} → ${t.destination}</div>
          <div class="trip-meta">
            <span>${t.tripCode}</span>
            <span>${d}</span>
          </div>
        </div>
        <div style="text-align: right;">
          <span class="status-badge" style="background: rgba(255,255,255,0.1); display: inline-block; margin-bottom: 8px;">${t.status.toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistoryTrips() {
  const history = driverTrips.filter(t => ['completed', 'cancelled'].includes(t.status)).slice(0, 10);
  const list = document.getElementById('history-trips-list');
  
  if (history.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 20px;">No past trips.</div>';
    return;
  }
  
  list.innerHTML = history.map(t => {
    const d = t.completedAt ? new Date(t.completedAt).toLocaleDateString() : (t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : 'Unknown');
    const color = t.status === 'completed' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)';
    const textColor = t.status === 'completed' ? '#34d399' : '#f87171';
    
    return `
      <div class="trip-item" style="opacity: 0.8;">
        <div>
          <div class="trip-route" style="font-size: 1.05rem;">${t.source} → ${t.destination}</div>
          <div class="trip-meta">
            <span>${t.tripCode}</span>
            <span>${d}</span>
          </div>
        </div>
        <div>
          <span class="status-badge" style="background: ${color}; color: ${textColor};">${t.status.toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Actions
async function updateTripStatus(tripId, status) {
  const user = auth.getUser();
  try {
    loading.show();
    const res = await api.put(`/driver-portal/${user.driverProfileId}/trips/${tripId}/status`, { status });
    if (res.success) {
      toast.success(res.message || 'Status updated');
      await loadTrips();
    }
  } catch (err) {
    toast.error('Failed to update status', err.message);
  } finally {
    loading.hide();
  }
}

async function rejectTrip(tripId) {
  if (!confirm('Are you sure you want to reject this assigned trip?')) return;
  const user = auth.getUser();
  try {
    loading.show();
    const res = await api.put(`/driver-portal/${user.driverProfileId}/trips/${tripId}/reject`);
    if (res.success) {
      toast.success('Trip rejected');
      await loadTrips();
    }
  } catch (err) {
    toast.error('Failed to reject trip', err.message);
  } finally {
    loading.hide();
  }
}

// Modals
function showInspectionModal(tripId) {
  currentActionTripId = tripId;
  document.getElementById('inspection-form').reset();
  document.getElementById('inspection-modal').style.display = 'flex';
}

async function handleInspectionSubmit(e) {
  e.preventDefault();
  const user = auth.getUser();
  if (!currentActionTripId) return;
  
  const payload = {
    brakes: document.getElementById('insp-brakes').checked,
    tyres: document.getElementById('insp-tyres').checked,
    engine: document.getElementById('insp-engine').checked,
    headlights: document.getElementById('insp-headlights').checked,
    vehicleCondition: document.getElementById('insp-condition').value,
    notes: document.getElementById('insp-notes').value
  };
  
  try {
    loading.show();
    const res = await api.post(`/driver-portal/${user.driverProfileId}/trips/${currentActionTripId}/inspection`, payload);
    if (res.success) {
      toast.success('Inspection submitted successfully');
      document.getElementById('inspection-modal').style.display = 'none';
      await loadTrips();
    }
  } catch (err) {
    toast.error('Inspection failed', err.message);
  } finally {
    loading.hide();
  }
}

function showCompleteModal(tripId) {
  currentActionTripId = tripId;
  document.getElementById('complete-form').reset();
  document.getElementById('complete-modal').style.display = 'flex';
}

async function handleCompleteSubmit(e) {
  e.preventDefault();
  const user = auth.getUser();
  if (!currentActionTripId) return;
  
  const payload = {
    actualDistance: Number(document.getElementById('comp-distance').value),
    fuelConsumed: Number(document.getElementById('comp-fuel').value) || 0
  };
  
  try {
    loading.show();
    const res = await api.put(`/driver-portal/${user.driverProfileId}/trips/${currentActionTripId}/complete`, payload);
    if (res.success) {
      toast.success('Trip completed successfully!');
      document.getElementById('complete-modal').style.display = 'none';
      await loadTrips();
    }
  } catch (err) {
    toast.error('Failed to complete trip', err.message);
  } finally {
    loading.hide();
  }
}
