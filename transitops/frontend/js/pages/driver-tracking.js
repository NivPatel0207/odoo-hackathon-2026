// driver-tracking.js (Phase 8 - Real Telemetry)

let activeTrip = null;
let watchId = null;
let isTracking = false;

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-tracking');
  
  await loadActiveTrip();
  
  document.getElementById('delay-form').addEventListener('submit', handleDelaySubmit);
});

async function loadActiveTrip() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    const res = await api.get(`/driver-portal/${user.driverProfileId}/dashboard`);
    if (res.success && res.data && res.data.activeTrip) {
      activeTrip = res.data.activeTrip;
      document.getElementById('tracking-panel').style.display = 'block';
      document.getElementById('no-trip-overlay').style.display = 'none';
      populateUI();
    } else {
      document.getElementById('tracking-panel').style.display = 'none';
      document.getElementById('no-trip-overlay').style.display = 'flex';
    }
  } catch (err) {
    toast.error('Failed to load active trip');
    console.error(err);
  } finally {
    loading.hide();
  }
}

function populateUI() {
  if (!activeTrip) return;
  document.getElementById('nav-route').innerText = `${activeTrip.source} → ${activeTrip.destination}`;
  document.getElementById('nav-status').innerText = activeTrip.status.toUpperCase();
  
  const eta = activeTrip.eta ? new Date(activeTrip.eta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Calculating...';
  document.getElementById('nav-eta').innerText = eta;
  
  // Removed mock distance
  document.getElementById('nav-dist').innerText = 'Live GPS Enabled';
}

function toggleTracking() {
  if (isTracking) {
    stopTracking();
  } else {
    startTracking();
  }
}

function startTracking() {
  if (!("geolocation" in navigator)) {
    toast.error("Geolocation is not supported by your browser");
    return;
  }

  isTracking = true;
  document.getElementById('btn-toggle-tracking').innerText = "Stop Tracking";
  document.getElementById('btn-toggle-tracking').style.background = "#ef4444";
  
  const statusEl = document.getElementById('gps-status');
  statusEl.innerText = "ACTIVE";
  statusEl.style.background = "#22c55e";

  // Debounce API calls (max 1 per 10 seconds)
  let lastPing = 0;

  watchId = navigator.geolocation.watchPosition(
    async (position) => {
      document.getElementById('gps-lat').innerText = position.coords.latitude.toFixed(5);
      document.getElementById('gps-lng').innerText = position.coords.longitude.toFixed(5);
      document.getElementById('gps-acc').innerText = `${Math.round(position.coords.accuracy)}m`;
      document.getElementById('gps-spd').innerText = position.coords.speed ? `${(position.coords.speed * 3.6).toFixed(1)} km/h` : 'N/A';
      
      const now = Date.now();
      if (now - lastPing > 10000) {
        lastPing = now;
        await sendTelemetry(position.coords);
      }
    },
    (error) => {
      console.error("GPS Error", error);
      statusEl.innerText = "ERROR";
      statusEl.style.background = "#ef4444";
      if (error.code === 1) toast.error("Location permission denied. Please enable GPS.");
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function stopTracking() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  isTracking = false;
  document.getElementById('btn-toggle-tracking').innerText = "Start Tracking";
  document.getElementById('btn-toggle-tracking').style.background = "";
  
  const statusEl = document.getElementById('gps-status');
  statusEl.innerText = "STANDBY";
  statusEl.style.background = "#94a3b8";
}

async function sendTelemetry(coords) {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;

  const payload = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    speed: coords.speed,
    heading: coords.heading,
    recordedAt: new Date().toISOString()
  };

  try {
    await api.post(`/driver-portal/${user.driverProfileId}/tracking/location`, payload);
  } catch (err) {
    console.error("Failed to push telemetry", err);
  }
}

async function handleDelaySubmit(e) {
  e.preventDefault();
  const user = auth.getUser();
  if (!activeTrip) return;
  
  const payload = {
    reason: document.getElementById('delay-reason').value,
    description: document.getElementById('delay-notes').value
  };
  
  try {
    loading.show();
    const res = await api.post(`/driver-portal/${user.driverProfileId}/trips/${activeTrip._id}/delay`, payload);
    if (res.success) {
      toast.success('Delay reported to dispatch');
      document.getElementById('delay-modal').style.display = 'none';
      document.getElementById('delay-form').reset();
      
      document.getElementById('nav-status').innerText = 'DELAYED';
      document.getElementById('nav-status').style.background = 'rgba(220, 38, 38, 0.2)';
      document.getElementById('nav-status').style.color = '#fca5a5';
    }
  } catch (err) {
    toast.error('Failed to report delay', err.message);
  } finally {
    loading.hide();
  }
}
