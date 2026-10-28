document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth(['fleet_manager', 'financial_analyst'])) return;
  nav.render('maintenance');

  if (!auth.can('fleet_manager', 'safety_officer')) {
    const btn = document.getElementById('btn-create-maint');
    if (btn) btn.style.display = 'none';
  }

  loadMaintenance();
  document.getElementById('filter-status').addEventListener('change', () => loadMaintenance());
  document.getElementById('maint-form').addEventListener('submit', handleCreateSubmit);
  document.getElementById('close-form').addEventListener('submit', handleCloseSubmit);
});

let allMaintenance = [];
let currentMaintPage = 1;
const maintLimit = 50;

async function loadMaintenance(append = false) {
  const status = document.getElementById('filter-status').value;
  
  if (!append) {
    currentMaintPage = 1;
    allMaintenance = [];
  }
  
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', currentMaintPage);
  params.append('limit', maintLimit);
  
  const query = `?${params.toString()}`;
  
  try {
    loading.show();
    const res = await api.getMaintenance(query);
    if (res.success) {
      if (append) {
        allMaintenance = [...allMaintenance, ...res.data];
      } else {
        allMaintenance = res.data;
      }
      renderTable(allMaintenance);
      
      const totalPages = res.pagination ? res.pagination.pages : 1;
      renderMaintLoadMore(totalPages);
    }
  } catch (err) {
    toast.error('Failed to load maintenance logs', err.message);
  } finally {
    loading.hide();
  }
}

function renderTable(records) {
  const tbody = document.getElementById('maint-table-body');
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-8">No maintenance records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr>
      <td>
        <div class="primary-text font-mono">${r.vehicle?.registrationNumber || 'Unknown'}</div>
        <div class="sub-text">${r.vehicle?.name || ''}</div>
      </td>
      <td><div class="primary-text" style="max-width:250px; white-space:normal;">${r.description}</div></td>
      <td style="text-transform: capitalize;">${r.maintenanceType}</td>
      <td>${fmt.currency(r.cost)}</td>
      <td>
        <div class="primary-text">${fmt.date(r.dateStart)}</div>
        <div class="sub-text">${r.dateEnd ? fmt.date(r.dateEnd) : 'Ongoing'}</div>
      </td>
      <td>${fmt.badge(r.status)}</td>
      <td>
        <div class="table-actions">
          ${auth.can('fleet_manager', 'safety_officer') && r.status === 'open' ? `
            <button class="icon-action-btn success" title="Close Ticket" onclick="openCloseModal('${r._id}')">✅</button>
            <button class="icon-action-btn" title="Edit Ticket" onclick="editMaintenance('${r._id}')">✏️</button>
          ` : (r.status === 'open' ? '<span class="text-muted" style="font-size:0.75rem;">View Only</span>' : '<span class="text-muted" style="font-size:0.75rem;">Closed</span>')}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderMaintLoadMore(totalPages) {
  let loadMoreBtn = document.getElementById('load-more-btn');
  if (currentMaintPage < totalPages) {
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'btn btn-secondary';
      loadMoreBtn.style = 'margin: 20px auto; display: block;';
      loadMoreBtn.innerText = 'Load More';
      loadMoreBtn.onclick = () => {
        currentMaintPage++;
        loadMaintenance(true);
      };
      const tbody = document.getElementById('maint-table-body');
      if (tbody) tbody.closest('.card').appendChild(loadMoreBtn);
    }
  } else {
    if (loadMoreBtn) loadMoreBtn.remove();
  }
}

async function openCreateModal() {
  document.getElementById('maint-form').reset();
  
  try {
    loading.show();
    // Only available vehicles can be put into maintenance
    const res = await api.getVehicles('?status=available');
    const select = document.getElementById('m-vehicle');
    select.innerHTML = '<option value="">Select a Vehicle...</option>' + 
      res.data.map(v => `<option value="${v._id}">${v.name} (${v.registrationNumber})</option>`).join('');
    modal.open('maint-modal');
  } catch (err) {
    toast.error('Failed to load vehicles', err.message);
  } finally {
    loading.hide();
  }
}

async function handleCreateSubmit(e) {
  e.preventDefault();
  const payload = {
    vehicle: document.getElementById('m-vehicle').value,
    description: document.getElementById('m-desc').value,
    maintenanceType: document.getElementById('m-type').value
  };

  try {
    loading.show();
    await api.createMaintenance(payload);
    toast.success('Maintenance logged', 'Vehicle status changed to In Shop (BR-9)');
    modal.close('maint-modal');
    loadMaintenance();
  } catch (err) {
    toast.error('Error logging maintenance', err.message);
  } finally {
    loading.hide();
  }
}

function openCloseModal(id) {
  document.getElementById('close-form').reset();
  document.getElementById('c-id').value = id;
  modal.open('close-modal');
}

async function handleCloseSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('c-id').value;
  const payload = {
    cost: Number(document.getElementById('c-cost').value),
    notes: document.getElementById('c-notes').value
  };
  
  try {
    loading.show();
    await api.closeMaintenance(id, payload);
    toast.success('Maintenance closed', 'Vehicle restored to Available (BR-10)');
    modal.close('close-modal');
    loadMaintenance();
  } catch (err) {
    toast.error('Failed to close', err.message);
  } finally {
    loading.hide();
  }
}
