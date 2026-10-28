// driver-vehicle.js

let vehicleData = null;

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-vehicle');
  
  await loadVehicleData();
  
  document.getElementById('defect-form').addEventListener('submit', handleDefectSubmit);
});

async function loadVehicleData() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    const res = await api.get(`/driver-portal/${user.driverProfileId}/vehicle`);
    if (res.success && res.data) {
      vehicleData = res.data;
      if (!vehicleData.vehicle) {
        document.getElementById('unassigned-state').style.display = 'block';
        document.getElementById('vehicle-content').style.display = 'none';
      } else {
        document.getElementById('unassigned-state').style.display = 'none';
        document.getElementById('vehicle-content').style.display = 'block';
        populateUI();
      }
    }
  } catch (err) {
    toast.error('Failed to load vehicle data', err.message);
  } finally {
    loading.hide();
  }
}

function populateUI() {
  const { vehicle, maintenance } = vehicleData;
  
  document.getElementById('veh-name').innerText = vehicle.name;
  document.getElementById('veh-reg').innerText = vehicle.registrationNumber;
  document.getElementById('veh-type').innerText = vehicle.vehicleType;
  document.getElementById('veh-fuel').innerText = vehicle.fuelType;
  document.getElementById('veh-odo').innerText = vehicle.odometer.toLocaleString();
  document.getElementById('veh-capacity').innerText = vehicle.maxLoadCapacity.toLocaleString() + ' kg';
  
  const maintenanceList = document.getElementById('maintenance-list');
  if (!maintenance || maintenance.length === 0) {
    maintenanceList.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 20px;">No open defects or upcoming maintenance.</div>';
    return;
  }
  
  maintenanceList.innerHTML = maintenance.map(m => {
    const isDefect = m.maintenanceType === 'corrective' && m.status === 'open';
    const color = isDefect ? '#fca5a5' : '#6ee7b7';
    const bg = isDefect ? 'rgba(220,38,38,0.1)' : 'rgba(16,185,129,0.1)';
    const dateStr = m.dateStart ? new Date(m.dateStart).toLocaleDateString() : 'N/A';
    
    return `
      <div class="list-item" style="background: ${bg}; border-left: 4px solid ${color}; margin-bottom: 8px; border-radius: 8px;">
        <div>
          <div style="font-weight: 600; color: ${color};">${m.description}</div>
          <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 4px;">
            ${isDefect ? 'Reported:' : 'Scheduled:'} ${dateStr}
          </div>
        </div>
        <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: ${color};">
          ${isDefect ? 'Open Defect' : 'Preventive'}
        </div>
      </div>
    `;
  }).join('');
}

async function handleDefectSubmit(e) {
  e.preventDefault();
  const user = auth.getUser();
  
  const payload = {
    description: document.getElementById('defect-desc').value
  };
  
  try {
    loading.show();
    const res = await api.post(`/driver-portal/${user.driverProfileId}/vehicle/defect`, payload);
    if (res.success) {
      toast.success('Defect reported successfully');
      document.getElementById('defect-modal').style.display = 'none';
      document.getElementById('defect-form').reset();
      
      // Reload the vehicle data to show the new defect
      await loadVehicleData();
    }
  } catch (err) {
    toast.error('Failed to report defect', err.message);
  } finally {
    loading.hide();
  }
}
