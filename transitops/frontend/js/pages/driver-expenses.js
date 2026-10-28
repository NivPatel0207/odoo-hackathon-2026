// driver-expenses.js

document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth(['driver']);
  nav.render('driver-expenses');
  
  document.getElementById('fuel-form').addEventListener('submit', handleFuelSubmit);
  document.getElementById('expense-form').addEventListener('submit', handleExpenseSubmit);
});

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));
  
  document.getElementById(`tab-${tabId}`).classList.add('active');
  document.getElementById(`form-${tabId}`).classList.add('active');
}

async function handleFuelSubmit(e) {
  e.preventDefault();
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  const payload = {
    quantity: Number(document.getElementById('fuel-qty').value),
    cost: Number(document.getElementById('fuel-cost').value),
    station: document.getElementById('fuel-station').value
  };
  
  const receiptFile = document.getElementById('fuel-receipt').files[0];
  if (receiptFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      payload.receiptBase64 = e.target.result;
      await submitFuel(payload, user.driverProfileId);
    };
    reader.readAsDataURL(receiptFile);
  } else {
    await submitFuel(payload, user.driverProfileId);
  }
}

async function submitFuel(payload, driverId) {
  try {
    loading.show();
    const res = await api.post(`/driver-portal/${driverId}/fuel`, payload);
    if (res.success) {
      toast.success('Fuel logged successfully');
      document.getElementById('fuel-form').reset();
    }
  } catch (err) {
    toast.error('Failed to log fuel', err.message);
  } finally {
    loading.hide();
  }
}

async function handleExpenseSubmit(e) {
  e.preventDefault();
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  const payload = {
    expenseType: document.getElementById('exp-type').value,
    amount: Number(document.getElementById('exp-amount').value),
    description: document.getElementById('exp-desc').value
  };
  
  const receiptFile = document.getElementById('exp-receipt').files[0];
  if (receiptFile) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      payload.receiptBase64 = e.target.result;
      await submitExpense(payload, user.driverProfileId);
    };
    reader.readAsDataURL(receiptFile);
  } else {
    await submitExpense(payload, user.driverProfileId);
  }
}

async function submitExpense(payload, driverId) {
  try {
    loading.show();
    const res = await api.post(`/driver-portal/${driverId}/expenses`, payload);
    if (res.success) {
      toast.success('Expense logged successfully');
      document.getElementById('expense-form').reset();
    }
  } catch (err) {
    toast.error('Failed to log expense', err.message);
  } finally {
    loading.hide();
  }
}
