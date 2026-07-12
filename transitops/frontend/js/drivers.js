document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth()) return;
  nav.render('drivers');

  // RBAC UI Check
  if (!auth.can('safety_officer')) {
    const addBtn = document.getElementById('btn-add-driver');
    if (addBtn) addBtn.style.display = 'none';
  }

  loadDrivers();

  document.getElementById('filter-status').addEventListener('change', loadDrivers);
  document.getElementById('search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#driver-table-body tr').forEach(tr => {
      const text = tr.innerText.toLowerCase();
      tr.style.display = text.includes(term) ? '' : 'none';
    });
  });

  document.getElementById('driver-form').addEventListener('submit', handleDriverSubmit);
});

let allDrivers = [];

async function loadDrivers() {
  const status = document.getElementById('filter-status').value;
  const query = status ? `?status=${status}` : '';
  
  try {
    loading.show();
    const res = await api.getDrivers(query);
    if (res.success) {
      allDrivers = res.data;
      renderTable(allDrivers);
    }
  } catch (err) {
    toast.error('Failed to load drivers', err.message);
  } finally {
    loading.hide();
  }
}

function renderTable(drivers) {
  const tbody = document.getElementById('driver-table-body');
  if (drivers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-8">No drivers found.</td></tr>`;
    return;
  }

  const today = new Date();

  tbody.innerHTML = drivers.map(d => {
    const expiry = new Date(d.licenseExpiryDate);
    const isExpired = expiry < today;
    const expiryClass = isExpired ? 'text-danger font-bold' : '';

    return `
    <tr>
      <td><div class="primary-text">${d.name}</div><div class="sub-text">${d.contactNumber || 'No Contact'}</div></td>
      <td><div class="primary-text font-mono">${d.licenseNumber}</div></td>
      <td>Class ${d.licenseCategory}</td>
      <td class="${expiryClass}">${fmt.date(d.licenseExpiryDate)}${isExpired ? ' ⚠️' : ''}</td>
      <td>${fmt.safetyScore(d.safetyScore)}</td>
      <td>${fmt.badge(d.status)}</td>
      <td>
        <div class="table-actions">
          ${auth.can('safety_officer') ? `
            <button class="btn btn-sm btn-secondary" onclick="editDriver('${d._id}')">Edit</button>
            ${d.status !== 'suspended' ? `<button class="btn btn-sm btn-danger" onclick="suspendDriver('${d._id}')">Suspend</button>` : ''}
            ${d.status === 'suspended' ? `<button class="btn btn-sm btn-success" onclick="unsuspendDriver('${d._id}')">Restore</button>` : ''}
          ` : '<span class="text-muted" style="font-size:0.75rem;">View Only</span>'}
        </div>
      </td>
    </tr>
  `}).join('');
}

async function handleDriverSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('driver-id').value;
  const payload = {
    name: document.getElementById('d-name').value,
    licenseNumber: document.getElementById('d-license').value,
    licenseCategory: document.getElementById('d-category').value,
    licenseExpiryDate: document.getElementById('d-expiry').value,
    contactNumber: document.getElementById('d-contact').value,
    safetyScore: Number(document.getElementById('d-score').value)
  };

  try {
    loading.show();
    if (id) {
      await api.updateDriver(id, payload);
      toast.success('Driver updated successfully');
    } else {
      await api.createDriver(payload);
      toast.success('Driver registered successfully');
    }
    modal.close('driver-modal');
    e.target.reset();
    document.getElementById('driver-id').value = '';
    loadDrivers();
  } catch (err) {
    toast.error('Operation failed', err.message);
  } finally {
    loading.hide();
  }
}

function editDriver(id) {
  const d = allDrivers.find(x => x._id === id);
  if (!d) return;
  
  document.getElementById('driver-id').value = d._id;
  document.getElementById('d-name').value = d.name;
  document.getElementById('d-license').value = d.licenseNumber;
  document.getElementById('d-category').value = d.licenseCategory;
  document.getElementById('d-expiry').value = new Date(d.licenseExpiryDate).toISOString().split('T')[0];
  document.getElementById('d-contact').value = d.contactNumber;
  document.getElementById('d-score').value = d.safetyScore;
  
  modal.open('driver-modal');
}

async function suspendDriver(id) {
  if (!(await ui.confirm('Suspend this driver? They will be unable to take new trips.'))) return;
  try {
    loading.show();
    await api.updateDriver(id, { status: 'suspended' });
    toast.warning('Driver suspended');
    loadDrivers();
  } catch (err) {
    toast.error('Failed to suspend', err.message);
  } finally {
    loading.hide();
  }
}

async function unsuspendDriver(id) {
  if (!(await ui.confirm('Restore this driver to available status?'))) return;
  try {
    loading.show();
    await api.updateDriver(id, { status: 'available' });
    toast.success('Driver restored');
    loadDrivers();
  } catch (err) {
    toast.error('Failed to restore', err.message);
  } finally {
    loading.hide();
  }
}
