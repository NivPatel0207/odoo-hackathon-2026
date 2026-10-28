let currentWeekStart = new Date();
// Ensure it's Monday
currentWeekStart.setDate(currentWeekStart.getDate() - (currentWeekStart.getDay() || 7) + 1);
currentWeekStart.setHours(0, 0, 0, 0);

let events = [];
let isEditing = false;
let currentEventId = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth(['fleet_manager', 'safety_officer', 'dispatcher', 'financial_analyst', 'viewer', 'driver'])) return;
  nav.render('planner');
  
  if (!auth.can('fleet_manager')) {
    // Non-managers shouldn't see create/edit functionality, but they can view
    const saveBtn = document.getElementById('btn-save-event');
    const deleteBtn = document.getElementById('btn-delete-event');
    const pdfBtn = document.getElementById('btn-export-pdf');
    if (saveBtn) saveBtn.style.display = 'none';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (pdfBtn) pdfBtn.style.display = 'none';
    
    // Make form read-only
    document.querySelectorAll('#event-form input, #event-form select, #event-form textarea').forEach(el => {
      el.disabled = true;
    });
  }

  document.getElementById('event-form').addEventListener('submit', handleEventSubmit);
  
  loadEvents();
});

function getWeekEnd(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function updateWeekLabel() {
  const end = getWeekEnd(currentWeekStart);
  const startStr = currentWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const endStr = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const label = document.getElementById('current-week-label');
  if (label) label.textContent = `${startStr} - ${endStr}`;
}

function nextWeek() {
  currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  loadEvents();
}

function prevWeek() {
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);
  loadEvents();
}

function goToToday() {
  currentWeekStart = new Date();
  currentWeekStart.setDate(currentWeekStart.getDate() - (currentWeekStart.getDay() || 7) + 1);
  currentWeekStart.setHours(0, 0, 0, 0);
  loadEvents();
}

async function loadEvents() {
  updateWeekLabel();
  loading.show('planner-grid');
  try {
    const startStr = currentWeekStart.toISOString();
    const endStr = getWeekEnd(currentWeekStart).toISOString();
    const res = await api.get(`/planner?startDate=${startStr}&endDate=${endStr}`);
    if (res && res.success) {
      events = res.data;
      renderGrid();
    }
  } catch (err) {
    toast.error('Error loading events');
  } finally {
    loading.hide();
  }
}

function renderGrid() {
  const grid = document.getElementById('planner-grid');
  grid.innerHTML = '';

  const filterType = document.getElementById('filter-type').value;

  // Header row (Empty corner + 7 days)
  let html = `<div class="planner-cell day-header" style="border-right: 2px solid var(--color-border); background: transparent;"></div>`;
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(currentWeekStart);
    day.setDate(day.getDate() + i);
    const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    const dayDate = day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    
    let cls = 'planner-cell day-header';
    const isToday = new Date().toDateString() === day.toDateString();
    if (isToday) cls += ' text-primary';
    
    html += `<div class="${cls}">${dayName} ${dayDate}</div>`;
  }

  // 24 hours
  for (let hour = 0; hour < 24; hour++) {
    const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
    html += `<div class="planner-cell time-label">${timeLabel}</div>`;

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const cellDate = new Date(currentWeekStart);
      cellDate.setDate(cellDate.getDate() + dayIndex);
      cellDate.setHours(hour, 0, 0, 0);
      
      const isoStr = cellDate.toISOString();
      const isToday = cellDate.toDateString() === new Date().toDateString();
      const onclickAttr = auth.can('fleet_manager') ? `onclick="openEventModal(null, '${isoStr}')"` : '';
      
      html += `
        <div class="planner-cell slot ${isToday ? 'today-column' : ''}" 
             data-time="${isoStr}" 
             ${onclickAttr}>
          <div style="position: absolute; right: 8px; top: 8px; opacity: 0.3;">
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>
      `;
    }
  }
  
  grid.innerHTML = html;

  // Render events inside their respective cells
  events.forEach(event => {
    if (filterType !== 'All' && event.type !== filterType) return;
    
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    
    // Check if event is within current week
    if (start < currentWeekStart || start > getWeekEnd(currentWeekStart)) return;

    // Find the cell that corresponds to the start hour
    const cellDate = new Date(start);
    cellDate.setMinutes(0, 0, 0); // Find the exact hour slot
    
    const cell = grid.querySelector(`.planner-cell[data-time="${cellDate.toISOString()}"]`);
    if (!cell) return; // Should not happen if it's within the week

    const startMin = start.getMinutes();
    const durationHours = (end - start) / (1000 * 60 * 60);

    const eventEl = document.createElement('div');
    const typeClass = event.type.toLowerCase().replace(' ', '-');
    eventEl.className = `planner-event type-${typeClass}`;
    
    // Position absolutely within the cell
    eventEl.style.top = `calc(${(startMin / 60) * 100}% + 1px)`;
    // Subtract 4px to leave a clean gap between back-to-back events
    eventEl.style.height = `calc(${durationHours * 100}% + ${Math.floor(durationHours - 1)}px - 4px)`;
    
    // Convert 12h format for display
    const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
    eventEl.innerHTML = `<div style="display:flex; flex-direction:column; justify-content:flex-start; overflow:hidden; height:100%;">
      <strong style="overflow:hidden; text-overflow:ellipsis;">${event.title}</strong>
      <div style="font-size:0.65rem; opacity:0.85; margin-top:2px; overflow:hidden; text-overflow:ellipsis;">${timeFmt.format(start)} - ${timeFmt.format(end)}</div>
    </div>`;
    
    // Event click listener
    eventEl.onclick = (e) => {
      e.stopPropagation();
      openEventModal(event);
    };
    
    cell.appendChild(eventEl);
  });
}

function openEventModal(event = null, defaultStartTime = null) {
  const form = document.getElementById('event-form');
  const titleEl = document.getElementById('event-modal-title');
  const deleteBtn = document.getElementById('btn-delete-event');
  
  isEditing = !!event;
  
  if (isEditing) {
    titleEl.textContent = auth.can('fleet_manager') ? 'Edit Event' : 'View Event';
    currentEventId = event._id;
    
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-type').value = event.type;
    document.getElementById('event-status').value = event.status;
    document.getElementById('event-description').value = event.description || '';
    
    // Convert UTC to local datetime string for input type="datetime-local"
    document.getElementById('event-start').value = new Date(new Date(event.startTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('event-end').value = new Date(new Date(event.endTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    if (auth.can('fleet_manager')) {
      deleteBtn.classList.remove('hidden');
    }
  } else {
    titleEl.textContent = 'Create Event';
    currentEventId = null;
    form.reset();
    
    if (defaultStartTime) {
      const start = new Date(defaultStartTime);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour default
      
      document.getElementById('event-start').value = new Date(start.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      document.getElementById('event-end').value = new Date(end.getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    deleteBtn.classList.add('hidden');
  }
  
  modal.open('event-modal');
}

async function handleEventSubmit(e) {
  e.preventDefault();
  if (!auth.can('fleet_manager')) return; // Extra safety
  
  const payload = {
    title: document.getElementById('event-title').value,
    type: document.getElementById('event-type').value,
    status: document.getElementById('event-status').value,
    description: document.getElementById('event-description').value,
    startTime: document.getElementById('event-start').value,
    endTime: document.getElementById('event-end').value
  };

  try {
    let res;
    if (isEditing) {
      res = await api.put(`/planner/${currentEventId}`, payload);
      toast.success('Event updated');
    } else {
      res = await api.post('/planner', payload);
      toast.success('Event created');
    }
    
    if (res.success) {
      modal.close('event-modal');
      loadEvents();
    }
  } catch (err) {
    toast.error('Failed to save event');
  }
}

async function deleteEvent() {
  if (!currentEventId || !auth.can('fleet_manager')) return;
  
  if (await ui.confirm('Are you sure you want to delete this event?')) {
    try {
      const res = await api.delete(`/planner/${currentEventId}`);
      if (res.success) {
        toast.success('Event deleted');
        modal.close('event-modal');
        loadEvents();
      }
    } catch (err) {
      toast.error('Failed to delete event');
    }
  }
}

async function clearVisibleSchedules() {
  if (!auth.can('fleet_manager')) return toast.error('Unauthorized', 'Only fleet managers can clear schedules.');
  
  // Find all events that are currently visible in the week
  const visibleEvents = events.filter(event => {
    const start = new Date(event.startTime);
    return start >= currentWeekStart && start <= getWeekEnd(currentWeekStart);
  });

  if (visibleEvents.length === 0) {
    return toast.info('Nothing to clear', 'There are no schedules in the current week to clear.');
  }

  const confirmed = await ui.confirm(
    '⚠️ Warning: Clear all visible schedules?', 
    `Are you absolutely sure you want to permanently delete all ${visibleEvents.length} schedules in the current week? This action cannot be undone.`
  );

  if (confirmed) {
    loading.show('planner-grid');
    try {
      // Delete all visible events one by one since there is no bulk delete endpoint
      const deletePromises = visibleEvents.map(event => api.delete(`/planner/${event._id}`));
      await Promise.all(deletePromises);
      
      toast.success('Schedules Cleared', `Successfully deleted ${visibleEvents.length} schedules.`);
      loadEvents();
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear some schedules', 'An error occurred while deleting.');
      loadEvents(); // Reload anyway to show remaining
    } finally {
      loading.hide();
    }
  }
}

async function copyToNextWeek() {
  if (!auth.can('fleet_manager')) return toast.error('Unauthorized', 'Only fleet managers can duplicate schedules.');
  
  const visibleEvents = events.filter(event => {
    const start = new Date(event.startTime);
    return start >= currentWeekStart && start <= getWeekEnd(currentWeekStart);
  });

  if (visibleEvents.length === 0) {
    return toast.info('Nothing to copy', 'There are no schedules in the current week to copy.');
  }

  const confirmed = await ui.confirm(
    'Repeat Next Week?', 
    `Are you sure you want to copy all ${visibleEvents.length} visible schedules to the exact same times next week?`
  );

  if (confirmed) {
    loading.show('planner-grid');
    try {
      const createPromises = visibleEvents.map(event => {
        const newStart = new Date(event.startTime);
        newStart.setDate(newStart.getDate() + 7);
        
        const newEnd = new Date(event.endTime);
        newEnd.setDate(newEnd.getDate() + 7);

        return api.post('/planner', {
          title: event.title,
          type: event.type,
          status: event.status,
          description: event.description,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString()
        });
      });
      
      await Promise.all(createPromises);
      toast.success('Schedules Copied', `Successfully copied ${visibleEvents.length} schedules to next week!`);
      
      // Automatically jump to next week to show the result
      nextWeek();
    } catch (err) {
      console.error(err);
      toast.error('Failed to copy some schedules', 'An error occurred while copying.');
      loading.hide();
    }
  }
}

async function exportPlanner() {
  if (!auth.can('fleet_manager')) {
    return toast.error('Unauthorized', 'Only fleet managers can export the weekly planner to PDF.');
  }

  if (typeof html2pdf === 'undefined') {
    return toast.error('PDF Library not loaded yet.');
  }
  
  loading.show();
  try {
    const element = document.querySelector('.planner-container');
    
    // Inject light-theme CSS to make it a standard printable document
    const printStyle = document.createElement('style');
    printStyle.innerHTML = `
      .planner-container {
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        padding: 10px !important;
      }
      .planner-cell { border-color: #dddddd !important; }
      .planner-cell.day-header { background: #f0f0f0 !important; border-bottom: 2px solid #aaaaaa !important; }
      .time-label { color: #555555 !important; border-right: 2px solid #aaaaaa !important; }
      .planner-event { font-size: 0.6rem !important; box-shadow: none !important; }
    `;
    document.head.appendChild(printStyle);
    
    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4], 
      filename:     `Weekly_Planner_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
    };
    
    await new Promise(r => setTimeout(r, 100)); // wait for styles to apply
    
    await html2pdf().set(opt).from(element).save();
    
    document.head.removeChild(printStyle);
    toast.success('Export Complete', 'Weekly_Planner.pdf downloaded successfully!');
  } catch (err) {
    toast.error('Failed to generate PDF', err.message);
  } finally {
    loading.hide();
  }
}
