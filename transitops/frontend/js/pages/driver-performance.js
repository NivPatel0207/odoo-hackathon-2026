// driver-performance.js

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-performance');
  
  await loadPerformanceData();
});

async function loadPerformanceData() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    const res = await api.get(`/driver-portal/${user.driverProfileId}/performance`);
    if (res.success && res.data) {
      renderPerformance(res.data);
    }
  } catch (err) {
    toast.error('Failed to load performance metrics', err.message);
  } finally {
    loading.hide();
  }
}

function renderPerformance(data) {
  // Update Score Ring
  const score = data.safetyScore || 0;
  document.getElementById('score-val').innerText = score;
  
  // Calculate dash offset: Circumference is ~502
  // offset = 502 - (502 * (score / 100))
  const circumference = 502;
  const offset = circumference - (circumference * (score / 100));
  
  // Apply with slight delay for animation effect
  setTimeout(() => {
    document.getElementById('score-ring').style.strokeDashoffset = offset;
    // color based on score
    if (score < 70) document.getElementById('score-ring').style.stroke = '#ef4444'; // red
    else if (score < 90) document.getElementById('score-ring').style.stroke = '#fcd34d'; // yellow
    else document.getElementById('score-ring').style.stroke = '#10b981'; // green
  }, 100);

  // Update Trip Stats
  const total = data.trips.total || 0;
  const completed = data.trips.completed || 0;
  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-completed').innerText = completed;
  
  const pct = total === 0 ? 0 : (completed / total) * 100;
  setTimeout(() => {
    document.getElementById('completion-bar').style.width = `${pct}%`;
  }, 100);

  // Update Feedback
  const list = document.getElementById('feedback-list');
  if (data.recentFeedback && data.recentFeedback.length > 0) {
    list.innerHTML = data.recentFeedback.map(fb => {
      const d = new Date(fb.date).toLocaleDateString();
      return `
        <div class="feedback-item">
          <div class="feedback-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div>
            <div style="color: white; font-weight: 500;">${fb.message}</div>
            <div style="color: var(--color-text-muted); font-size: 0.8rem; margin-top: 4px;">${d}</div>
          </div>
        </div>
      `;
    }).join('');
  }
}
