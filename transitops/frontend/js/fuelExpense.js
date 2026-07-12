document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth()) return;
  nav.render('fuel-expense');

  if (!auth.can('financial_analyst', 'fleet_manager')) {
    const btnFuel = document.getElementById('btn-log-fuel');
    const btnExp = document.getElementById('btn-log-exp');
    if (btnFuel) btnFuel.style.display = 'none';
    if (btnExp) btnExp.style.display = 'none';
  }

  // Pre-fill today's date in modals
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-date').value = today;
  document.getElementById('e-date').value = today;

  loadData();

  document.getElementById('fuel-form').addEventListener('submit', handleFuelSubmit);
  document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
});

async function loadData() {
  try {
    loading.show();
    const [fuelRes, expRes] = await Promise.all([
      api.getFuelLogs(),
      api.getExpenses()
    ]);
    
    if (fuelRes.success) renderFuelTable(fuelRes.data);
    if (expRes.success) renderExpenseTable(expRes.data);
    
    // Pre-load dropdowns in background
    if (auth.can('financial_analyst', 'fleet_manager')) {
      populateDropdowns();
    }
  } catch (err) {
    toast.error('Failed to load data', err.message);
  } finally {
    loading.hide();
  }
}

function renderFuelTable(logs) {
  const tbody = document.getElementById('fuel-table-body');
  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No fuel logs found.</td></tr>`;
    return;
  }
  tbody.innerHTML = logs.map(l => `
    <tr>
      <td>${fmt.date(l.date)}</td>
      <td>
        <div class="primary-text font-mono">${l.vehicle?.registrationNumber || 'Unknown'}</div>
        <div class="sub-text">${l.trip ? `Trip: ${l.trip.tripCode}` : ''}</div>
      </td>
      <td>${l.liters} L</td>
      <td class="font-bold text-danger">${fmt.currency(l.cost)}</td>
    </tr>
  `).join('');
}

function renderExpenseTable(expenses) {
  const tbody = document.getElementById('expense-table-body');
  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No expenses found.</td></tr>`;
    return;
  }
  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td>${fmt.date(e.date)}</td>
      <td><div class="primary-text font-mono">${e.vehicle?.registrationNumber || 'Unknown'}</div></td>
      <td style="text-transform: capitalize;">${e.expenseType}</td>
      <td class="font-bold text-danger">${fmt.currency(e.amount)}</td>
    </tr>
  `).join('');
}

async function populateDropdowns() {
  try {
    const [vRes, tRes] = await Promise.all([
      api.getVehicles(),
      api.getTrips('?status=completed')
    ]);
    
    const vSelectF = document.getElementById('f-vehicle');
    const vSelectE = document.getElementById('e-vehicle');
    const tSelectF = document.getElementById('f-trip');
    
    const vOptions = '<option value="">Select Vehicle...</option>' + 
      vRes.data.map(v => `<option value="${v._id}">${v.name} (${v.registrationNumber})</option>`).join('');
    
    vSelectF.innerHTML = vOptions;
    vSelectE.innerHTML = vOptions;
    
    tSelectF.innerHTML = '<option value="">None / General</option>' + 
      tRes.data.map(t => `<option value="${t._id}">${t.tripCode} - ${t.vehicle?.registrationNumber || 'Unknown'}</option>`).join('');
      
  } catch (err) {
    console.error('Dropdown load error', err);
  }
}

async function handleFuelSubmit(e) {
  e.preventDefault();
  const payload = {
    vehicle: document.getElementById('f-vehicle').value,
    date: document.getElementById('f-date').value,
    liters: Number(document.getElementById('f-liters').value),
    cost: Number(document.getElementById('f-cost').value)
  };
  const tripId = document.getElementById('f-trip').value;
  if (tripId) payload.trip = tripId;

  try {
    loading.show();
    await api.createFuelLog(payload);
    toast.success('Fuel log added');
    modal.close('fuel-modal');
    e.target.reset();
    document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
    loadData();
  } catch (err) {
    toast.error('Failed to add fuel', err.message);
  } finally {
    loading.hide();
  }
}

async function handleExpenseSubmit(e) {
  e.preventDefault();
  const payload = {
    vehicle: document.getElementById('e-vehicle').value,
    expenseType: document.getElementById('e-type').value,
    amount: Number(document.getElementById('e-amount').value),
    date: document.getElementById('e-date').value,
    description: document.getElementById('e-desc').value
  };

  try {
    loading.show();
    await api.createExpense(payload);
    toast.success('Expense recorded');
    modal.close('expense-modal');
    e.target.reset();
    document.getElementById('e-date').value = new Date().toISOString().split('T')[0];
    loadData();
  } catch (err) {
    toast.error('Failed to add expense', err.message);
  } finally {
    loading.hide();
  }
}
