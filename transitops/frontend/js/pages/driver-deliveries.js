// driver-deliveries.js

let deliveries = [];
let selectedTripId = null;

// Canvas variables
let canvas, ctx;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-deliveries');
  
  await loadDeliveries();
  
  initSignaturePad();
  
  document.getElementById('epod-form').addEventListener('submit', handleEpodSubmit);
  document.getElementById('clear-signature').addEventListener('click', clearSignature);
});

async function loadDeliveries() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    // Get all trips, filter in frontend for ones needing delivery
    const res = await api.get(`/driver-portal/${user.driverProfileId}/trips`);
    if (res.success && res.data) {
      // Show trips that are dispatched or arrived
      deliveries = res.data.filter(t => ['dispatched', 'arrived'].includes(t.status));
      renderDeliveries();
    }
  } catch (err) {
    toast.error('Failed to load deliveries', err.message);
  } finally {
    loading.hide();
  }
}

function renderDeliveries() {
  const list = document.getElementById('delivery-list');
  
  if (deliveries.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 20px;">No pending deliveries at this time.</div>';
    return;
  }
  
  list.innerHTML = deliveries.map(t => {
    const canSubmit = t.status === 'arrived';
    const buttonHtml = canSubmit 
      ? `<button class="btn-primary" onclick="openEpodModal('${t._id}')">Capture EPOD</button>`
      : `<button class="btn-primary" style="opacity: 0.5; cursor: not-allowed;" title="You must arrive at the destination first." disabled>Capture EPOD</button>`;

    return `
      <div class="trip-item">
        <div>
          <div class="trip-route">${t.destination} <span style="font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); margin-left: 8px;">${t.status.toUpperCase()}</span></div>
          <div class="trip-meta">
            <span>${t.tripCode}</span>
            <span>Cargo: ${t.cargoWeight}kg</span>
          </div>
        </div>
        <div>
          ${buttonHtml}
        </div>
      </div>
    `;
  }).join('');
}

function openEpodModal(tripId) {
  const trip = deliveries.find(t => t._id === tripId);
  if (!trip) return;
  
  selectedTripId = tripId;
  document.getElementById('epod-route').innerText = trip.destination;
  document.getElementById('epod-code').innerText = trip.tripCode;
  
  document.getElementById('epod-qty').value = trip.cargoWeight; // default to expected weight
  
  clearSignature();
  document.getElementById('epod-modal').style.display = 'flex';
  
  // Resize canvas to match display size properly
  setTimeout(() => {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }, 100);
}

function closeEpodModal() {
  document.getElementById('epod-modal').style.display = 'none';
  document.getElementById('epod-form').reset();
  selectedTripId = null;
}

// --- Signature Pad Logic ---

function initSignaturePad() {
  canvas = document.getElementById('signature-pad');
  ctx = canvas.getContext('2d');
  
  // Touch events
  canvas.addEventListener('touchstart', handleStart, {passive: false});
  canvas.addEventListener('touchmove', handleMove, {passive: false});
  canvas.addEventListener('touchend', handleEnd);
  
  // Mouse events
  canvas.addEventListener('mousedown', handleStart);
  canvas.addEventListener('mousemove', handleMove);
  canvas.addEventListener('mouseup', handleEnd);
  canvas.addEventListener('mouseout', handleEnd);
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function handleStart(e) {
  e.preventDefault();
  isDrawing = true;
  const pos = getPos(e);
  lastX = pos.x;
  lastY = pos.y;
}

function handleMove(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getPos(e);
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(pos.x, pos.y);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  
  lastX = pos.x;
  lastY = pos.y;
}

function handleEnd(e) {
  if (!isDrawing) return;
  e.preventDefault();
  isDrawing = false;
}

function clearSignature() {
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function isCanvasEmpty() {
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}

async function handleEpodSubmit(e) {
  e.preventDefault();
  
  if (isCanvasEmpty()) {
    toast.error('Please capture the recipient\'s signature');
    return;
  }
  
  const user = auth.getUser();
  if (!selectedTripId || !user) return;
  
  const payload = {
    recipientName: document.getElementById('epod-name').value,
    quantityDelivered: Number(document.getElementById('epod-qty').value),
    condition: document.getElementById('epod-condition').value,
    customerSignature: canvas.toDataURL('image/png') // Convert canvas to Base64
  };
  
  try {
    loading.show();
    const res = await api.post(`/driver-portal/${user.driverProfileId}/trips/${selectedTripId}/epod`, payload);
    
    if (res.success) {
      toast.success('EPOD submitted successfully');
      closeEpodModal();
      await loadDeliveries(); // Reload list
    }
  } catch (err) {
    toast.error('Failed to submit EPOD', err.message);
  } finally {
    loading.hide();
  }
}
