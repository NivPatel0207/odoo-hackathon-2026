document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth(['fleet_manager', 'financial_analyst'])) return;
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

  // Setup auto-calculation listeners
  const vehicleSelect = document.getElementById('f-vehicle');
  const quantityInput = document.getElementById('f-quantity');
  const manualCostInput = document.getElementById('f-manual-cost');
  
  vehicleSelect.addEventListener('change', calculateFuelCost);
  quantityInput.addEventListener('input', calculateFuelCost);
  manualCostInput.addEventListener('input', calculateFuelCost);
});

// Global variable to hold dynamic live rates fetched from the backend
let IN_FUEL_RATES = {};

function renderLiveRates() {
  const container = document.getElementById('header-live-rates');
  if (!container) return;
  
  container.innerHTML = `
    <span style="color: var(--color-text-muted); font-weight: 500;">Live Rates (₹):</span>
    <span style="color: #f59e0b; font-weight: 600;">Diesel: ${IN_FUEL_RATES.diesel.toFixed(2)}</span>
    <span style="color: #ef4444; font-weight: 600;">Petrol: ${IN_FUEL_RATES.gasoline.toFixed(2)}</span>
    <span style="color: #10b981; font-weight: 600;">CNG: ${IN_FUEL_RATES.cng.toFixed(2)}</span>
    <span style="color: #3b82f6; font-weight: 600;">EV: ${IN_FUEL_RATES.electric.toFixed(2)}</span>
  `;
}

function calculateFuelCost() {
  const vSelect = document.getElementById('f-vehicle');
  const quantity = Number(document.getElementById('f-quantity').value);
  const manualCost = document.getElementById('f-manual-cost').value;
  const costInput = document.getElementById('f-cost');
  const hint = document.getElementById('live-rate-hint');
  const lblQuantity = document.getElementById('lbl-quantity');

  if (vSelect.selectedIndex <= 0) {
    costInput.value = '';
    hint.innerText = 'Select vehicle to see live rate';
    if (lblQuantity) lblQuantity.innerText = 'Quantity (Liters / kWh)';
    return;
  }

  const fuelType = vSelect.options[vSelect.selectedIndex].getAttribute('data-fuel') || 'diesel';
  const unit = fuelType === 'electric' ? 'kWh' : 'L';
  if (lblQuantity) lblQuantity.innerText = `Quantity (${unit})`;

  const liveRate = IN_FUEL_RATES[fuelType] || 89.62;
  
  if (manualCost !== '' && Number(manualCost) > 0) {
    costInput.value = Number(manualCost).toFixed(2);
    if (quantity > 0) {
      const impliedRate = (Number(manualCost) / quantity).toFixed(2);
      hint.innerText = `Using Manual Total Cost (Avg: ₹${impliedRate} / ${unit})`;
    } else {
      hint.innerText = 'Using Manual Total Cost';
    }
    hint.style.color = '#f59e0b'; // warning/orange color
  } else {
    hint.innerText = `Live Rate: ₹${liveRate.toFixed(2)} / ${unit} (${fuelType.toUpperCase()})`;
    hint.style.color = 'var(--color-success)';
    if (quantity > 0) {
      costInput.value = (quantity * liveRate).toFixed(2);
    } else {
      costInput.value = '';
    }
  }
}

async function loadData() {
  try {
    loading.show();
    const [fuelRes, expRes, ratesRes] = await Promise.all([
      api.getFuelLogs(),
      api.getExpenses(),
      api.getLiveFuelRates()
    ]);
    
    if (ratesRes.success) {
      IN_FUEL_RATES = ratesRes.data;
      renderLiveRates();
    }
    
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
      <td>${l.quantity} ${l.vehicle?.fuelType === 'electric' ? 'kWh' : 'L'}</td>
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
      vRes.data.map(v => `<option value="${v._id}" data-fuel="${v.fuelType || 'diesel'}">${v.name} (${v.registrationNumber})</option>`).join('');
    
    vSelectF.innerHTML = vOptions;
    vSelectE.innerHTML = vOptions;
    
    tSelectF.innerHTML = '<option value="">None / General</option>' + 
      tRes.data.map(t => `<option value="${t._id}">${t.tripCode} - ${t.vehicle?.registrationNumber || 'Unknown'}</option>`).join('');
      
  } catch (err) {
    
  }
}

async function handleFuelSubmit(e) {
  e.preventDefault();
  const payload = {
    vehicle: document.getElementById('f-vehicle').value,
    date: document.getElementById('f-date').value,
    quantity: Number(document.getElementById('f-quantity').value),
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
    document.getElementById('live-rate-hint').innerText = 'Select vehicle to see live rate';
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
