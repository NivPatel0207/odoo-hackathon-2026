document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth(['fleet_manager', 'dispatcher', 'financial_analyst', 'safety_officer', 'driver'])) return;
  nav.render('trips');
  renderBreadcrumbs(['Trips Management']);

  if (!auth.can('dispatcher', 'fleet_manager')) {
    const btn = document.getElementById('btn-create-trip');
    if (btn) btn.style.display = 'none';
  }

  loadTrips();

  // Filter Event Listeners
  document.getElementById('btn-apply-filters').addEventListener('click', () => loadTrips());
  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', window.debounce(() => loadTrips(), 500));
  }
  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-priority').value = '';
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    loadTrips();
  });

  document.getElementById('trip-form').addEventListener('submit', handleTripSubmit);
  document.getElementById('complete-form').addEventListener('submit', handleCompleteSubmit);
  document.getElementById('status-form').addEventListener('submit', handleStatusSubmit);

  if (typeof flatpickr !== 'undefined') {
    etaPicker = flatpickr("#t-eta", {
      enableTime: true,
      dateFormat: "Y-m-d\\TH:i",
      altInput: true,
      altFormat: "d-m-Y h:i K",
      allowInput: true
    });
  }
});

let etaPicker;
let allTrips = [];
let currentPage = 1;
const limit = 50;

async function loadTrips(append = false) {
  const search = document.getElementById('filter-search').value;
  const status = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;
  const startDate = document.getElementById('filter-start-date').value;
  const endDate = document.getElementById('filter-end-date').value;

  if (!append) {
    currentPage = 1;
    allTrips = [];
  }

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  if (priority) params.append('priority', priority);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  params.append('page', currentPage);
  params.append('limit', limit);

  try {
    if (!append) loading.show('skeleton-table');
    const res = await api.getTrips(`?${params.toString()}`);
    if (res.success) {
      if (append) {
        allTrips = [...allTrips, ...res.data];
      } else {
        allTrips = res.data;
      }
      updateStatsCards(allTrips);
      renderTable(allTrips);

      const totalPages = res.pagination ? res.pagination.pages : 1;
      renderLoadMore(totalPages);
    }
  } catch (err) {
    toast.error('Failed to load trips', err.message);
  } finally {
    loading.hide();
  }
}

function updateStatsCards(trips) {
  const total = trips.length;
  const running = trips.filter(t => ['dispatched', 'in_transit'].includes(t.status)).length;
  const completed = trips.filter(t => t.status === 'completed').length;
  const delayed = trips.filter(t => t.status === 'delayed').length;

  document.getElementById('stat-total').innerText = total;
  document.getElementById('stat-running').innerText = running;
  document.getElementById('stat-completed').innerText = completed;
  document.getElementById('stat-delayed').innerText = delayed;
}

function renderTable(trips) {
  const containerId = 'trip-table-container';
  // Check if container exists, if not, wrap the tbody with it or change the HTML structure.
  // Actually, I should just get the parent table and replace it with a div id="trip-table-container", but since I can't easily modify the HTML here, I will replace the wrapper if it exists, or just inject it.

  // Wait, let's just replace the innerHTML of the wrapper. The original HTML has a table with tbody id="trip-table-body".
  // Let's replace the whole table element with our TableBuilder container.
  let tbody = document.getElementById('trip-table-body');
  let tableEl = tbody ? tbody.closest('table') : null;
  let container = document.getElementById('trip-table-container');

  if (tableEl && !container) {
    container = document.createElement('div');
    container.id = 'trip-table-container';
    tableEl.parentNode.replaceChild(container, tableEl);
  }

  const columns = [
    { key: 'tripCode', label: 'Trip', render: (t) => `<div class="primary-text font-mono font-bold">${t.tripCode}</div><div class="sub-text">${fmt.date(t.createdAt)}</div>` },
    { key: 'route', label: 'Route', render: (t) => `<div class="primary-text">${t.source}</div><div class="sub-text">→ ${t.destination}</div>` },
    {
      key: 'assignment', label: 'Assignment', render: (t) => {
        if (!t.vehicle && !t.driver) {
          return `<div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(234, 179, 8, 0.1); color: #eab308; border-radius: 6px; font-size: 0.8rem; font-weight: 500;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Pending Assignment</div>`;
        }
        const vName = t.vehicle ? `<div class="primary-text" style="display:flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> ${t.vehicle.registrationNumber}</div>` : '';
        const dName = t.driver ? `<div class="sub-text mt-1" style="display:flex; align-items:center; gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${t.driver.name}</div>` : '';
        return `${vName}${dName}`;
      }
    },
    { key: 'plannedDistance', label: 'Distance / ETA', render: (t) => `<div class="primary-text">${fmt.number(t.plannedDistance)} km</div><div class="sub-text">ETA: ${t.eta ? fmt.date(t.eta) : 'Not Set'}</div>` },
    {
      key: 'cargoWeight', label: 'Cargo / Priority', render: (t) => {
        let prioClass = t.priority === 'urgent' ? 'priority-urgent' : (t.priority === 'high' ? 'priority-high' : (t.priority === 'low' ? 'priority-low' : 'priority-medium'));
        return `<div><span class="badge ${prioClass}">${(t.priority || 'Medium').toUpperCase()}</span></div><div class="sub-text mt-1">${fmt.number(t.cargoWeight)} kg</div>`;
      }
    },
    {
      key: 'status', label: 'Status', render: (t) => {
        let progress = 0;
        if (t.status === 'assigned') progress = 5;
        else if (t.status === 'accepted') progress = 10;
        else if (t.status === 'loading') progress = 20;
        else if (t.status === 'dispatched') progress = 30;
        else if (t.status === 'in_transit') progress = 60;
        else if (t.status === 'arrived') progress = 80;
        else if (t.status === 'delivered') progress = 90;
        else if (t.status === 'completed') progress = 100;
        return `<div>${fmt.badge(t.status)}</div>${!['cancelled', 'delayed'].includes(t.status) ? `<div class="progress-container"><div class="progress-bar" style="width: ${progress}%"></div></div>` : ''}`;
      }
    },
    { key: 'actions', label: 'Actions', render: (t) => `<div class="table-actions" onclick="event.stopPropagation()">${(auth.can('dispatcher', 'fleet_manager', 'driver')) ? renderActions(t) : '<span class="text-muted" style="font-size:0.75rem;">View Only</span>'}</div>` }
  ];

  const tb = new TableBuilder('trip-table-container', {
    columns,
    defaultSort: 'createdAt',
    emptyStateMsg: 'No trips found',
    onRowClick: (t) => viewTrip(t._id)
  });
  tb.setData(trips);
}

function renderLoadMore(totalPages) {
  let loadMoreBtn = document.getElementById('load-more-btn');
  if (currentPage < totalPages) {
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'btn btn-secondary';
      loadMoreBtn.style = 'margin: 20px auto; display: block;';
      loadMoreBtn.innerText = 'Load More';
      loadMoreBtn.onclick = () => {
        currentPage++;
        loadTrips(true);
      };
      const container = document.getElementById('trip-table-container');
      if (container) container.parentNode.appendChild(loadMoreBtn);
    }
  } else {
    if (loadMoreBtn) loadMoreBtn.remove();
  }
}

function renderActions(t) {
  let html = '';
  // View Icon
  html += `<button class="icon-action-btn" title="View Details" onclick="viewTrip('${t._id}')">👁️</button>`;

  if (auth.can('driver')) {
    if (t.status === 'assigned' || t.status === 'draft') {
      html += `<button class="btn btn-sm btn-primary" onclick="updateDriverStatus('${t._id}', 'accepted')">Accept Trip</button>`;
      html += `<button class="btn btn-sm btn-danger" onclick="rejectDriverTrip('${t._id}')">Reject Trip</button>`;
    } else if (t.status === 'accepted') {
      html += `<button class="btn btn-sm btn-primary" onclick="updateDriverStatus('${t._id}', 'loading')">Arrived at Pickup</button>`;
    } else if (t.status === 'loading') {
      html += `<button class="btn btn-sm btn-primary" onclick="openInspection('${t._id}')">Start Trip</button>`;
    } else if (t.status === 'dispatched') {
      html += `<button class="btn btn-sm btn-primary" onclick="openInspection('${t._id}')">Start Driving</button>`;
    } else if (t.status === 'in_transit') {
      html += `<button class="btn btn-sm btn-success" onclick="updateDriverStatus('${t._id}', 'delivered')">Arrived at Destination</button>`;
    } else if (t.status === 'delivered') {
      html += `<button class="btn btn-sm btn-success" onclick="openComplete('${t._id}')">Complete Trip</button>`;
    }
    return html;
  }

  if (t.status === 'draft' || t.status === 'assigned' || t.status === 'pending_approval') {
    html += `<button class="icon-action-btn" title="Edit Trip" onclick="editTrip('${t._id}')">✏️</button>`;
  }

  if (t.status === 'pending_approval' && auth.can('fleet_manager')) {
    html += `<button class="icon-action-btn success" title="Approve" onclick="approveTrip('${t._id}')">✔️</button>`;
    html += `<button class="icon-action-btn danger" title="Reject" onclick="rejectTrip('${t._id}')">❌</button>`;
  }

  // Status Update Dropdown (More)
  html += `<button class="icon-action-btn" title="Update Status" onclick="openStatusModal('${t._id}')">⚙️</button>`;

  if (['draft', 'assigned', 'loading', 'dispatched', 'in_transit'].includes(t.status)) {
    html += `<button class="icon-action-btn danger" title="Cancel Trip" onclick="cancelTrip('${t._id}')">❌</button>`;
  }

  if (t.status === 'delivered' || t.status === 'in_transit') {
    html += `<button class="icon-action-btn success" title="Complete Trip" onclick="openComplete('${t._id}')">✅</button>`;
  }
  return html;
}

async function updateDriverStatus(id, status) {
  try {
    loading.show();
    const res = await api.put(`/trips/${id}/status`, { status });
    if (!res.success) throw new Error(res.message);
    toast.success('Trip status updated');
    loadTrips();
  } catch (err) {
    toast.error('Failed to update status', err.message);
  } finally {
    loading.hide();
  }
}

async function rejectDriverTrip(id) {
  if (!(await ui.confirm('Are you sure you want to reject this trip? It will be sent back to dispatch.'))) return;
  try {
    loading.show();
    const res = await api.rejectTrip(id);
    if (!res.success) throw new Error(res.message);
    toast.success('Trip rejected and sent back to dispatch');
    loadTrips();
  } catch (err) {
    toast.error('Failed to reject trip', err.message);
  } finally {
    loading.hide();
  }
}

function viewTrip(id) {
  const t = allTrips.find(x => x._id === id);
  if (!t) return;

  document.getElementById('view-title').innerText = `Trip: ${t.tripCode}`;
  document.getElementById('view-content').innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div><strong>Status:</strong> ${t.status.toUpperCase()}</div>
      <div><strong>Priority:</strong> ${(t.priority || 'Medium').toUpperCase()}</div>
      <div><strong>Source:</strong> ${t.source}</div>
      <div><strong>Destination:</strong> ${t.destination}</div>
      <div><strong>Vehicle:</strong> ${t.vehicle?.name} (${t.vehicle?.registrationNumber})</div>
      <div><strong>Driver:</strong> ${t.driver?.name}</div>
      <div><strong>Cargo:</strong> ${t.cargoWeight} kg</div>
      <div><strong>ETA:</strong> ${t.eta ? fmt.date(t.eta) : 'Not set'}</div>
    </div>
  `;
  modal.open('view-modal');
}

async function populateSelects() {
  try {
    const vRes = await api.getVehicles('?status=available');
    const dRes = await api.getDrivers('?status=available');

    const vSelect = document.getElementById('t-vehicle');
    const dSelect = document.getElementById('t-driver');

    vSelect.innerHTML = '<option value="">Select a Vehicle...</option>' +
      vRes.data.map(v => `<option value="${v._id}">${v.name} (${v.registrationNumber}) - Max: ${v.maxLoadCapacity}kg</option>`).join('');

    dSelect.innerHTML = '<option value="">Select a Driver...</option>' +
      dRes.data.map(d => {
        const scoreStr = d.safetyScore ? ` | Safety: ${d.safetyScore}/100` : '';
        return `<option value="${d._id}">${d.name} (${d.licenseNumber})${scoreStr}</option>`;
      }).join('');

  } catch (err) {
    toast.error('Failed to load resources', err.message);
  }
}

async function openCreateModal() {
  document.getElementById('trip-form').reset();
  document.getElementById('t-id').value = '';
  if (etaPicker) etaPicker.clear();
  loading.show();
  await populateSelects();
  loading.hide();
  modal.open('trip-modal');
}

async function editTrip(id) {
  const t = allTrips.find(x => x._id === id);
  if (!t) return;

  loading.show();
  await populateSelects();
  loading.hide();

  const vSelect = document.getElementById('t-vehicle');
  const dSelect = document.getElementById('t-driver');

  if (t.vehicle && !vSelect.querySelector(`option[value="${t.vehicle._id}"]`)) {
    vSelect.innerHTML += `<option value="${t.vehicle._id}">${t.vehicle.registrationNumber}</option>`;
  }
  if (t.driver && !dSelect.querySelector(`option[value="${t.driver._id}"]`)) {
    dSelect.innerHTML += `<option value="${t.driver._id}">${t.driver.name}</option>`;
  }

  document.getElementById('t-id').value = t._id;
  document.getElementById('t-source').value = t.source;
  document.getElementById('t-destination').value = t.destination;
  document.getElementById('t-vehicle').value = t.vehicle?._id || '';
  document.getElementById('t-driver').value = t.driver?._id || '';
  document.getElementById('t-cargo').value = t.cargoWeight;
  document.getElementById('t-distance').value = t.plannedDistance;
  document.getElementById('t-priority').value = t.priority || 'medium';
  if (t.eta) {
    const date = new Date(t.eta);
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
    if (etaPicker) etaPicker.setDate(localISOTime);
    else document.getElementById('t-eta').value = localISOTime;
  } else {
    if (etaPicker) etaPicker.clear();
    else document.getElementById('t-eta').value = '';
  }

  modal.open('trip-modal');
}

async function handleTripSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('t-id').value;
  const payload = {
    source: document.getElementById('t-source').value,
    destination: document.getElementById('t-destination').value,
    vehicle: document.getElementById('t-vehicle').value || null,
    driver: document.getElementById('t-driver').value || null,
    cargoWeight: Number(document.getElementById('t-cargo').value),
    plannedDistance: Number(document.getElementById('t-distance').value),
    priority: document.getElementById('t-priority').value,
    eta: document.getElementById('t-eta').value || null
  };

  if (auth.getUser().role === 'dispatcher' && ['high', 'urgent'].includes(payload.priority)) {
    payload.status = 'pending_approval';
  }

  try {
    loading.show();
    if (id) {
      await api.updateTrip(id, payload);
      toast.success('Draft trip updated');
    } else {
      await api.createTrip(payload);
      toast.success('Draft trip created');
    }
    modal.close('trip-modal');
    loadTrips();
  } catch (err) {
    toast.error('Validation Error', err.message);
  } finally {
    loading.hide();
  }
}

function openStatusModal(id) {
  const t = allTrips.find(x => x._id === id);
  if (!t) return;
  document.getElementById('s-id').value = id;
  document.getElementById('s-status').value = t.status;
  modal.open('status-modal');
}

async function handleStatusSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('s-id').value;
  const status = document.getElementById('s-status').value;

  try {
    loading.show();
    const res = await api.put(`/trips/${id}/status`, { status });
    if (!res.success) throw new Error(res.message);
    toast.success('Status updated successfully');
    modal.close('status-modal');
    loadTrips();
  } catch (err) {
    toast.error('Failed to update status', err.message);
  } finally {
    loading.hide();
  }
}

async function cancelTrip(id) {
  if (!(await ui.confirm('Cancel this trip? This action cannot be undone.'))) return;
  try {
    loading.show();
    await api.cancelTrip(id);
    toast.success('Trip cancelled');
    loadTrips();
  } catch (err) {
    toast.error('Failed to cancel', err.message);
  } finally {
    loading.hide();
  }
}

let signaturePadCtx = null;
let signaturePadCanvas = null;
let isDrawing = false;
let epodPhotoBase64 = null;

function initSignaturePad() {
  signaturePadCanvas = document.getElementById('c-epod-signature-pad');
  if (!signaturePadCanvas) return;

  signaturePadCtx = signaturePadCanvas.getContext('2d');
  signaturePadCtx.strokeStyle = '#000000';
  signaturePadCtx.lineWidth = 2;
  signaturePadCtx.lineCap = 'round';

  const getPos = (e) => {
    const rect = signaturePadCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (signaturePadCanvas.width / rect.width),
      y: (clientY - rect.top) * (signaturePadCanvas.height / rect.height)
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    signaturePadCtx.beginPath();
    signaturePadCtx.moveTo(pos.x, pos.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    signaturePadCtx.lineTo(pos.x, pos.y);
    signaturePadCtx.stroke();
  };

  const endDraw = (e) => {
    e.preventDefault();
    isDrawing = false;
  };

  signaturePadCanvas.addEventListener('mousedown', startDraw);
  signaturePadCanvas.addEventListener('mousemove', draw);
  signaturePadCanvas.addEventListener('mouseup', endDraw);
  signaturePadCanvas.addEventListener('mouseout', endDraw);

  signaturePadCanvas.addEventListener('touchstart', startDraw, { passive: false });
  signaturePadCanvas.addEventListener('touchmove', draw, { passive: false });
  signaturePadCanvas.addEventListener('touchend', endDraw, { passive: false });
}

function clearSignature() {
  if (signaturePadCtx && signaturePadCanvas) {
    signaturePadCtx.clearRect(0, 0, signaturePadCanvas.width, signaturePadCanvas.height);
  }
}

function previewEpodPhoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      epodPhotoBase64 = e.target.result;
      const preview = document.getElementById('c-epod-photo-preview');
      preview.style.display = 'block';
      preview.querySelector('img').src = epodPhotoBase64;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function closeComplete() {
  document.getElementById('complete-trip-modal').style.display = 'none';
}

function openInspection(id) {
  document.getElementById('inspection-trip-id').value = id;
  document.getElementById('inspection-form').reset();
  modal.open('inspection-modal');
}

function closeInspection() {
  modal.close('inspection-modal');
}

async function submitInspection(e) {
  e.preventDefault();
  const id = document.getElementById('inspection-trip-id').value;
  const form = e.target;
  const formData = new FormData(form);

  const payload = {
    brakes: formData.get('brakes') === 'on',
    tyres: formData.get('tyres') === 'on',
    headlights: formData.get('headlights') === 'on',
    indicators: formData.get('indicators') === 'on',
    horn: formData.get('horn') === 'on',
    mirrors: formData.get('mirrors') === 'on',
    engine: formData.get('engine') === 'on',
    oil: formData.get('oil') === 'on',
    coolant: formData.get('coolant') === 'on',
    fuel: formData.get('fuel') === 'on',
    emergencyKit: formData.get('emergencyKit') === 'on',
    fireExtinguisher: formData.get('fireExtinguisher') === 'on',
    documents: formData.get('documents') === 'on',
    vehicleCondition: formData.get('vehicleCondition')
  };

  try {
    loading.show();
    const res = await api.submitInspection(id, payload);
    if (!res.success) throw new Error(res.message);
    toast.success('Inspection passed! Trip started.');
    closeInspection();
    await api.put(`/trips/${id}/status`, { status: 'in_transit' });
    loadTrips();
  } catch (err) {
    closeInspection();
    toast.error('Inspection Failed', err.message);
    await ui.alert('Safety Alert', err.message);
    loadTrips();
  } finally {
    loading.hide();
  }
}

function openComplete(id) {
  document.getElementById('complete-form').reset();
  document.getElementById('c-id').value = id;

  const revGroup = document.getElementById('revenue-group');
  const epodSection = document.getElementById('epod-section');

  clearSignature();
  epodPhotoBase64 = null;
  const preview = document.getElementById('c-epod-photo-preview');
  if (preview) preview.style.display = 'none';

  if (auth.can('driver')) {
    if (revGroup) revGroup.style.display = 'none';
    document.getElementById('c-revenue').removeAttribute('required');

    // Drivers see ePOD
    if (epodSection) epodSection.style.display = 'block';
    if (!signaturePadCanvas) initSignaturePad();

    document.getElementById('c-epod-recipient').setAttribute('required', 'true');
    document.getElementById('c-epod-qty').setAttribute('required', 'true');
  } else {
    if (revGroup) revGroup.style.display = 'block';
    document.getElementById('c-revenue').setAttribute('required', 'true');

    // Non-drivers don't do ePOD
    if (epodSection) epodSection.style.display = 'none';
    document.getElementById('c-epod-recipient').removeAttribute('required');
    document.getElementById('c-epod-qty').removeAttribute('required');
  }

  modal.open('complete-modal');
}

async function handleCompleteSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('c-id').value;
  const payload = {
    actualDistance: Number(document.getElementById('c-distance').value),
    fuelConsumed: Number(document.getElementById('c-fuel').value)
  };

  if (!auth.can('driver')) {
    payload.revenue = Number(document.getElementById('c-revenue').value);
  } else {
    // Collect ePOD data
    // Check if signature is empty (rough check)
    let signatureBase64 = null;
    if (signaturePadCanvas) {
      const blank = document.createElement('canvas');
      blank.width = signaturePadCanvas.width;
      blank.height = signaturePadCanvas.height;
      if (signaturePadCanvas.toDataURL() !== blank.toDataURL()) {
        signatureBase64 = signaturePadCanvas.toDataURL();
      }
    }

    payload.epod = {
      recipientName: document.getElementById('c-epod-recipient').value,
      quantityDelivered: Number(document.getElementById('c-epod-qty').value),
      condition: document.querySelector('input[name="c-epod-condition"]:checked').value,
      customerSignature: signatureBase64,
      deliveryPhoto: epodPhotoBase64
    };
  }

  try {
    loading.show();
    await api.completeTrip(id, payload);
    toast.success('Trip completed! Vehicle/Driver released.');
    modal.close('complete-modal');
    loadTrips();
  } catch (err) {
    toast.error('Failed to complete', err.message);
  } finally {
    loading.hide();
  }
}

async function approveTrip(id) {
  if (await ui.confirm('Approve this high-priority trip?')) {
    try {
      loading.show();
      await api.updateTrip(id, { status: 'assigned' });
      toast.success('Trip Approved');
      loadTrips();
      if (typeof api.logAction === 'function') api.logAction('Approved High Priority Trip: ' + id);
    } catch (err) {
      toast.error('Failed to approve', err.message);
    } finally {
      loading.hide();
    }
  }
}

async function rejectTrip(id) {
  if (await ui.confirm('Reject this trip? It will be marked as cancelled.')) {
    try {
      loading.show();
      await api.updateTrip(id, { status: 'cancelled' });
      toast.success('Trip Rejected');
      loadTrips();
      if (typeof api.logAction === 'function') api.logAction('Rejected High Priority Trip: ' + id);
    } catch (err) {
      toast.error('Failed to reject', err.message);
    } finally {
      loading.hide();
    }
  }
}
