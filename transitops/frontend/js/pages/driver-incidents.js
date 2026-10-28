// driver-incidents.js

let driverTrips = [];

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-incidents');
  
  await loadActiveTrips();
  await loadDriverIncidents();
  
  document.getElementById('incident-form').addEventListener('submit', handleIncidentSubmit);
});

async function loadActiveTrips() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  try {
    const res = await api.get(`/driver-portal/${user.driverProfileId}/trips`);
    if (res.success && res.data) {
      driverTrips = res.data.filter(t => !['completed', 'cancelled', 'draft'].includes(t.status));
      const select = document.getElementById('inc-trip');
      select.innerHTML = '<option value="">None (Not Trip Related)</option>' + driverTrips.map(t => `<option value="${t._id}">${t.tripCode} - ${t.destination}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load trips', err);
  }
}

async function loadDriverIncidents() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    const res = await api.get(`/incidents/driver/${user.driverProfileId}`);
    if (res.success && res.data) {
      const list = document.getElementById('incident-list');
      if (res.data.length === 0) {
        list.innerHTML = '<div style="color: var(--color-text-muted); text-align: center;">No incidents reported.</div>';
        return;
      }
      
      list.innerHTML = res.data.map(inc => {
        let statusColor = '#94a3b8'; // default reported
        if (inc.status === 'investigating') statusColor = '#eab308';
        if (inc.status === 'resolved') statusColor = '#22c55e';
        
        return `
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <strong style="color: white; text-transform: capitalize;">${inc.type} - ${inc.severity}</strong>
              <span style="background: ${statusColor}; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase;">${inc.status}</span>
            </div>
            <div style="color: var(--color-text-muted); font-size: 0.9rem; margin-bottom: 8px;">${inc.location || 'Unknown Location'}</div>
            <div style="color: white; font-size: 0.95rem;">${inc.description}</div>
            ${inc.resolutionNotes ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); color: var(--color-text-muted); font-size: 0.85rem;"><strong>Resolution:</strong> ${inc.resolutionNotes}</div>` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Failed to load incidents', err);
  }
}

function handleFileRead(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

async function handleIncidentSubmit(e) {
  e.preventDefault();
  
  const confirmAlert = confirm("Are you sure you want to submit an incident report?");
  if (!confirmAlert) return;

  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  let mediaBase64 = null;
  const fileInput = document.getElementById('inc-media');
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    mediaBase64 = await handleFileRead(file);
  }

  const payload = {
    incidentType: document.getElementById('inc-type').value,
    severity: document.getElementById('inc-severity').value,
    location: document.getElementById('inc-location').value,
    description: document.getElementById('inc-desc').value,
    tripId: document.getElementById('inc-trip').value || null,
    mediaBase64
  };
  
  try {
    loading.show();
    const res = await api.post(`/driver-portal/${user.driverProfileId}/incident`, payload);
    if (res.success) {
      document.getElementById('incident-modal').style.display = 'none';
      document.getElementById('incident-form').reset();
      await loadDriverIncidents();
      toast.success('Incident reported successfully.');
    }
  } catch (err) {
    toast.error('Failed to report incident', err.message);
  } finally {
    loading.hide();
  }
}
