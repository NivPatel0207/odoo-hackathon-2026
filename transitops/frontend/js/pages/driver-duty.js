// driver-duty.js

let currentEldData = null;

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-duty');
  
  await loadEldStatus();
  
  // Start a local timer to update the "since" duration
  setInterval(updateDurations, 60000);
});

async function loadEldStatus() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    const res = await api.get(`/driver-portal/${user.driverProfileId}/eld`);
    if (res.success && res.data) {
      currentEldData = res.data;
      updateUI();
    }
  } catch (err) {
    toast.error('Failed to load ELD status', err.message);
  } finally {
    loading.hide();
  }
}

function updateUI() {
  if (!currentEldData) return;
  
  const status = currentEldData.currentStatus || 'OFF_DUTY';
  
  // Update Main Display
  const display = document.getElementById('main-status-display');
  display.className = `status-display status-${status}`;
  document.getElementById('current-status-text').innerText = status.replace('_', ' ');
  
  updateDurations();
  
  // Update Active Button
  document.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`btn-${status}`);
  if (activeBtn) activeBtn.classList.add('active');
  
  // Format Minutes to HH:MM
  const formatTime = (totalMinutes) => {
    const m = Math.floor(totalMinutes);
    const hrs = Math.floor(m / 60);
    const mins = m % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };
  
  // Update Timers
  if (currentEldData.metrics) {
    const driveRemaining = currentEldData.metrics.remainingDrivingMinutes || 0;
    const shiftRemaining = currentEldData.metrics.remainingOnDutyMinutes || 0;
    
    document.getElementById('drive-time').innerText = formatTime(driveRemaining);
    document.getElementById('shift-time').innerText = formatTime(shiftRemaining);
    
    // Warning colors
    document.getElementById('drive-time').style.color = driveRemaining < 60 ? '#f87171' : 'var(--color-text-primary)';
    document.getElementById('shift-time').style.color = shiftRemaining < 60 ? '#f87171' : 'var(--color-text-primary)';
  }
}

function updateDurations() {
  if (!currentEldData || !currentEldData.activeLog || !currentEldData.activeLog.startTime) {
    document.getElementById('current-status-duration').innerText = 'No active log';
    return;
  }
  
  const start = new Date(currentEldData.activeLog.startTime);
  const now = new Date();
  
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / 60000);
  
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  
  document.getElementById('current-status-duration').innerText = `Since ${start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} (${hrs}h ${mins}m)`;
}

async function changeStatus(newStatus) {
  if (currentEldData && currentEldData.currentStatus === newStatus) return;
  
  if (!confirm(`Change duty status to ${newStatus.replace('_', ' ')}?`)) return;
  
  const user = auth.getUser();
  try {
    loading.show();
    // Use the generic /eld POST endpoint which is securely implemented
    const res = await api.post(`/driver-portal/${user.driverProfileId}/eld`, { status: newStatus });
    if (res.success) {
      toast.success(`Status changed to ${newStatus.replace('_', ' ')}`);
      await loadEldStatus();
    }
  } catch (err) {
    toast.error('Failed to change status', err.message);
  } finally {
    loading.hide();
  }
}
