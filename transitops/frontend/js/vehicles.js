document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth()) return;
  nav.render('vehicles');

  // RBAC UI Check
  if (!auth.can('fleet_manager')) {
    const addBtn = document.getElementById('btn-add-vehicle');
    if (addBtn) addBtn.style.display = 'none';
  }

  loadVehicles();

  document.getElementById('filter-status').addEventListener('change', loadVehicles);
  document.getElementById('search-input').addEventListener('input', (e) => {
    // Simple frontend filtering for search
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#vehicle-table-body tr').forEach(tr => {
      const text = tr.innerText.toLowerCase();
      tr.style.display = text.includes(term) ? '' : 'none';
    });
  });

  document.getElementById('vehicle-form').addEventListener('submit', handleVehicleSubmit);
});

let allVehicles = [];

async function loadVehicles() {
  const status = document.getElementById('filter-status').value;
  const query = status ? `?status=${status}` : '';
  
  try {
    loading.show();
    const res = await api.getVehicles(query);
    if (res.success) {
      allVehicles = res.data;
      renderTable(allVehicles);
    }
  } catch (err) {
    toast.error('Failed to load vehicles', err.message);
  } finally {
    loading.hide();
  }
}

function renderTable(vehicles) {
  const tbody = document.getElementById('vehicle-table-body');
  if (vehicles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-8">No vehicles found.</td></tr>`;
    return;
  }

  tbody.innerHTML = vehicles.map(v => `
    <tr>
      <td><div class="primary-text font-mono">${v.registrationNumber}</div></td>
      <td><div class="primary-text">${v.name}</div><div class="sub-text">${v.region}</div></td>
      <td style="text-transform: capitalize;">${v.vehicleType}</td>
      <td>${fmt.number(v.maxLoadCapacity)} kg</td>
      <td>${fmt.number(v.odometer)} km</td>
      <td>${fmt.badge(v.status)}</td>
      <td>
        <div class="table-actions">
          ${auth.can('fleet_manager') ? `
            <button class="btn btn-sm btn-secondary" onclick="editVehicle('${v._id}')">Edit</button>
            ${v.status !== 'retired' ? `<button class="btn btn-sm btn-ghost" onclick="retireVehicle('${v._id}')">Retire</button>` : ''}
          ` : '<span class="text-muted" style="font-size:0.75rem;">View Only</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

async function handleVehicleSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('vehicle-id').value;
  const payload = {
    registrationNumber: document.getElementById('v-reg').value,
    name: document.getElementById('v-name').value,
    vehicleType: document.getElementById('v-type').value,
    maxLoadCapacity: Number(document.getElementById('v-capacity').value),
    acquisitionCost: Number(document.getElementById('v-cost').value),
    odometer: Number(document.getElementById('v-odometer').value)
  };

  try {
    loading.show();
    if (id) {
      await api.updateVehicle(id, payload);
      toast.success('Vehicle updated successfully');
    } else {
      await api.createVehicle(payload);
      toast.success('Vehicle registered successfully');
    }
    modal.close('vehicle-modal');
    e.target.reset();
    document.getElementById('vehicle-id').value = '';
    loadVehicles();
  } catch (err) {
    toast.error('Operation failed', err.message);
  } finally {
    loading.hide();
  }
}

function editVehicle(id) {
  const v = allVehicles.find(x => x._id === id);
  if (!v) return;
  
  document.getElementById('vehicle-id').value = v._id;
  document.getElementById('v-reg').value = v.registrationNumber;
  document.getElementById('v-name').value = v.name;
  document.getElementById('v-type').value = v.vehicleType;
  document.getElementById('v-capacity').value = v.maxLoadCapacity;
  document.getElementById('v-cost').value = v.acquisitionCost;
  document.getElementById('v-odometer').value = v.odometer;
  
  modal.open('vehicle-modal');
}

async function retireVehicle(id) {
  if (!(await ui.confirm('Are you sure you want to retire this vehicle? It will be permanently removed from dispatch.'))) return;
  try {
    loading.show();
    await api.updateVehicle(id, { status: 'retired' });
    toast.success('Vehicle retired');
    loadVehicles();
  } catch (err) {
    toast.error('Failed to retire', err.message);
  } finally {
    loading.hide();
  }
}
