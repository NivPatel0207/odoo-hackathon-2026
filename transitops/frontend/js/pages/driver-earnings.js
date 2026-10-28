// driver-earnings.js

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-earnings');
  
  await loadEarningsData();
});

async function loadEarningsData() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    
    const pendingRes = await api.get(`/driver-portal/${user.driverProfileId}/settlement`);
    if (pendingRes.success && pendingRes.data) {
      const pendingVal = pendingRes.data.netPay ?? pendingRes.data.estimatedPay ?? pendingRes.data.basePay ?? 0;
      document.getElementById('val-pending').innerText = `₹${pendingVal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      
      const sub = document.getElementById('pending-trips-sub');
      if (sub && typeof pendingRes.data.pendingTrips === 'number') {
        const count = pendingRes.data.pendingTrips;
        sub.innerText = count === 1 ? '1 completed trip pending settlement' : `${count} completed trips pending settlement`;
      }
    }
    
    // Fetch historical paid settlements
    const historyRes = await api.get(`/driver-portal/${user.driverProfileId}/settlements/history`);
    if (historyRes.success && historyRes.data) {
      const totalVal = historyRes.data.totalEarnedAllTime || 0;
      document.getElementById('val-total-earned').innerText = `₹${totalVal.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      
      renderHistory(historyRes.data.history);
    }
    
  } catch (err) {
    toast.error('Failed to load earnings', err.message);
  } finally {
    loading.hide();
  }
}

function renderHistory(history) {
  const list = document.getElementById('history-list');
  
  if (!history || history.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 20px;">No settlement history found.</div>';
    return;
  }
  
  list.innerHTML = history.map(s => {
    const start = new Date(s.periodStart).toLocaleDateString();
    const end = new Date(s.periodEnd).toLocaleDateString();
    const netPay = s.netPay.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    return `
      <div class="history-item">
        <div>
          <div class="history-dates">${start} - ${end}</div>
          <div class="history-meta">Base: ₹${s.basePay} &bull; Deductions: ₹${s.deductions}</div>
          <button class="btn-download" onclick="toast.info('Downloading Payslip...')">Download PDF</button>
        </div>
        <div class="history-amount">
          +₹${netPay}
        </div>
      </div>
    `;
  }).join('');
}
