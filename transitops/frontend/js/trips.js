document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth()) return;
  nav.render('trips');

  if (!auth.can('dispatcher', 'fleet_manager')) {
    const btn = document.getElementById('btn-create-trip');
    if (btn) btn.style.display = 'none';
  }

  loadTrips();
  document.getElementById('filter-status').addEventListener('change', loadTrips);
  document.getElementById('trip-form').addEventListener('submit', handleTripSubmit);
  document.getElementById('complete-form').addEventListener('submit', handleCompleteSubmit);
});

let allTrips = [];

async function loadTrips() {
  const status = document.getElementById('filter-status').value;
  const query = status ? `?status=${status}` : '';
  
  try {
    loading.show();
    const res = await api.getTrips(query);
    if (res.success) {
      allTrips = res.data;
      renderTable(allTrips);
    }
  } catch (err) {
    toast.error('Failed to load trips', err.message);
  } finally {
    loading.hide();
  }
}

function renderTable(trips) {
  const tbody = document.getElementById('trip-table-body');
  if (trips.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-8">No trips found.</td></tr>`;
    return;
  }

  tbody.innerHTML = trips.map(t => `
    <tr>
      <td><div class="primary-text font-mono font-bold">${t.tripCode}</div><div class="sub-text">${fmt.date(t.createdAt)}</div></td>
      <td><div class="primary-text">${t.source}</div><div class="sub-text">→ ${t.destination}</div></td>
      <td>
        <div class="primary-text">🚛 ${t.vehicle?.registrationNumber || 'Unknown'}</div>
        <div class="sub-text">👨‍✈️ ${t.driver?.name || 'Unknown'}</div>
      </td>
      <td>${fmt.number(t.cargoWeight)} kg</td>
      <td>${fmt.badge(t.status)}</td>
      <td>
        <div class="table-actions">
          ${auth.can('dispatcher', 'fleet_manager') ? renderActions(t) : '<span class="text-muted" style="font-size:0.75rem;">View Only</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderActions(t) {
  let html = '';
  if (t.status === 'draft') {
    html += `<button class="btn btn-sm btn-secondary" onclick="editTrip('${t._id}')">Edit</button>`;
    html += `<button class="btn btn-sm btn-primary" onclick="dispatchTrip('${t._id}')">Dispatch</button>`;
  }
  if (t.status === 'dispatched') {
    html += `<button class="btn btn-sm btn-success" onclick="openComplete('${t._id}')">Complete</button>`;
  }
  if (['draft', 'dispatched'].includes(t.status)) {
    html += `<button class="btn btn-sm btn-danger" onclick="cancelTrip('${t._id}')">Cancel</button>`;
  }
  return html;
}

async function populateSelects() {
  try {
    const vRes = await api.getVehicles('?status=available');
    const dRes = await api.getDrivers('?status=available');
    
    const vSelect = document.getElementById('t-vehicle');
    const dSelect = document.getElementById('t-driver');
    
    vSelect.innerHTML = '<option value="">Select a Vehicle...</option>' + 
      vRes.data.map(v => `<option value="${v._id}">${v.name} (${v.registrationNumber}) - Max: ${v.maxLoadCapacity}kg</option>`).join('');
      
    dSelect.innerHTML = '<option value="">Select a Driver...</option>' + 
      dRes.data.map(d => `<option value="${d._id}">${d.name} (${d.licenseNumber})</option>`).join('');
      
  } catch (err) {
    toast.error('Failed to load resources', err.message);
  }
}

async function openCreateModal() {
  document.getElementById('trip-form').reset();
  document.getElementById('t-id').value = '';
  loading.show();
  await populateSelects();
  loading.hide();
  modal.open('trip-modal');
}

async function editTrip(id) {
  const t = allTrips.find(x => x._id === id);
  if (!t) return;
  
  loading.show();
  await populateSelects();
  loading.hide();
  
  // Add current vehicle/driver to options if not available (so it shows up)
  const vSelect = document.getElementById('t-vehicle');
  const dSelect = document.getElementById('t-driver');
  
  if (t.vehicle && !vSelect.querySelector(`option[value="${t.vehicle._id}"]`)) {
    vSelect.innerHTML += `<option value="${t.vehicle._id}">${t.vehicle.registrationNumber}</option>`;
  }
  if (t.driver && !dSelect.querySelector(`option[value="${t.driver._id}"]`)) {
    dSelect.innerHTML += `<option value="${t.driver._id}">${t.driver.name}</option>`;
  }
  
  document.getElementById('t-id').value = t._id;
  document.getElementById('t-source').value = t.source;
  document.getElementById('t-destination').value = t.destination;
  document.getElementById('t-vehicle').value = t.vehicle?._id;
  document.getElementById('t-driver').value = t.driver?._id;
  document.getElementById('t-cargo').value = t.cargoWeight;
  document.getElementById('t-distance').value = t.plannedDistance;
  
  modal.open('trip-modal');
}

async function handleTripSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('t-id').value;
  const payload = {
    source: document.getElementById('t-source').value,
    destination: document.getElementById('t-destination').value,
    vehicle: document.getElementById('t-vehicle').value,
    driver: document.getElementById('t-driver').value,
    cargoWeight: Number(document.getElementById('t-cargo').value),
    plannedDistance: Number(document.getElementById('t-distance').value)
  };

  try {
    loading.show();
    if (id) {
      await api.updateTrip(id, payload);
      toast.success('Draft trip updated');
    } else {
      await api.createTrip(payload);
      toast.success('Draft trip created');
    }
    modal.close('trip-modal');
    loadTrips();
  } catch (err) {
    toast.error('Validation Error', err.message);
  } finally {
    loading.hide();
  }
}

async function dispatchTrip(id) {
  if (!(await ui.confirm('Dispatch this trip? Vehicle and driver will be marked as On Trip.'))) return;
  try {
    loading.show();
    await api.dispatchTrip(id);
    toast.success('Trip dispatched successfully!');
    loadTrips();
  } catch (err) {
    toast.error('Dispatch Blocked (Business Rule)', err.message);
  } finally {
    loading.hide();
  }
}

async function cancelTrip(id) {
  if (!(await ui.confirm('Cancel this trip? This action cannot be undone.'))) return;
  try {
    loading.show();
    await api.cancelTrip(id);
    toast.success('Trip cancelled');
    loadTrips();
  } catch (err) {
    toast.error('Failed to cancel', err.message);
  } finally {
    loading.hide();
  }
}

function openComplete(id) {
  document.getElementById('complete-form').reset();
  document.getElementById('c-id').value = id;
  modal.open('complete-modal');
}

async function handleCompleteSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('c-id').value;
  const payload = {
    actualDistance: Number(document.getElementById('c-distance').value),
    fuelConsumed: Number(document.getElementById('c-fuel').value),
    revenue: Number(document.getElementById('c-revenue').value)
  };
  
  try {
    loading.show();
    await api.completeTrip(id, payload);
    toast.success('Trip completed! Vehicle/Driver released.');
    modal.close('complete-modal');
    loadTrips();
  } catch (err) {
    toast.error('Failed to complete', err.message);
  } finally {
    loading.hide();
  }
}
