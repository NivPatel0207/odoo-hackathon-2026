document.addEventListener('DOMContentLoaded', () => {
    if (!auth.requireAuth(['fleet_manager', 'dispatcher'])) return;
    
    nav.render('dispatch');
    renderBreadcrumbs(['Dispatch Board']);
    
    initDispatchBoard();
    
    // Setup form submit for Create Load
    const loadForm = document.getElementById('load-form');
    if (loadForm) loadForm.addEventListener('submit', handleCreateLoad);
    
    // Setup form submit for Quick Assign
    const assignForm = document.getElementById('assign-form');
    if (assignForm) assignForm.addEventListener('submit', handleAssignLoad);
});

let boardData = {
    unassignedLoads: [],
    availableVehicles: [],
    availableDrivers: []
};

let filters = { loadSearch: '', assetType: 'all' };
let sortableLoads, sortableAssets;

async function initDispatchBoard() {
    try {
        const response = await api.get('/trips/dispatch-board');
        if (response.success) {
            boardData = response.data;
            renderBoard();
        }
    } catch (error) {
        console.error('Failed to load dispatch board data:', error);
        alert('Error loading dispatch data. See console for details.');
    }
}

function renderBoard() {
    renderUnassignedLoads();
    renderAvailableAssets();
    initDragAndDrop();
    
    document.getElementById('unassigned-count').textContent = boardData.unassignedLoads.length;
    document.getElementById('assets-count').textContent = boardData.availableVehicles.length;

    // KPI Calculations
    const totalRevenue = boardData.unassignedLoads.reduce((sum, load) => sum + (load.revenue || load.rate || 0), 0);
    document.getElementById('kpi-revenue').textContent = `₹${totalRevenue.toLocaleString()}`;
    document.getElementById('kpi-loads').textContent = boardData.unassignedLoads.length;
    document.getElementById('kpi-assets').textContent = boardData.availableVehicles.length;
    
    // Fleet utilization
    const activeTrips = boardData.activeTrips || 0;
    const totalFleet = boardData.availableVehicles.length + activeTrips; 
    const utilPercent = totalFleet === 0 ? 0 : Math.round((activeTrips / totalFleet) * 100);
    document.getElementById('kpi-utilization').textContent = `${utilPercent}%`;
    document.getElementById('kpi-util-bar').style.width = `${utilPercent}%`;
}

function renderUnassignedLoads() {
    const container = document.getElementById('unassigned-loads-list');
    
    // Filter Loads
    const filteredLoads = boardData.unassignedLoads.filter(load => {
        if (!filters.loadSearch) return true;
        const search = filters.loadSearch.toLowerCase();
        return (load.customerName && load.customerName.toLowerCase().includes(search)) ||
               (load.source && load.source.toLowerCase().includes(search)) ||
               (load.destination && load.destination.toLowerCase().includes(search));
    });

    if (filteredLoads.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--color-text-muted);">No loads found matching criteria.</div>';
        return;
    }
    
    
    
    container.innerHTML = filteredLoads.map(load => {
        
        return `
        <div class="load-card" data-id="${load._id}">
            <div class="load-header">
                <div>
                    <div class="load-id">${load.tripCode}</div>
                    <div class="load-customer">${load.customerName || 'N/A'}</div>
                </div>
                <div class="load-rate">₹${load.revenue || load.rate || 0}</div>
            </div>
            <div class="load-route">
                <div style="font-weight: 500;">${load.source}</div>
                <svg class="route-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                <div style="font-weight: 500;">${load.destination}</div>
            </div>
            
            <div class="load-details" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; gap: 16px;">
                    <div>
                        <span style="font-weight: 600;">Commodity:</span> <span style="background: var(--color-bg-tertiary); padding: 2px 6px; border-radius: 4px;">${load.commodityType || 'General'}</span>
                    </div>
                    <div>
                        <span style="font-weight: 600;">Weight:</span> ${load.cargoWeight} kg
                    </div>
                </div>
                <button class="quick-assign-btn" onclick="openAssignModal('${load._id}')">Assign</button>
            </div>
        </div>
    `}).join('');
}

function renderAvailableAssets() {
    const container = document.getElementById('available-assets-list');
    
    // Simple pairing logic: pair a vehicle with an available driver for the UI
    const allPairedAssets = boardData.availableVehicles.map((vehicle, index) => {
        const driver = boardData.availableDrivers[index] || null;
        return { vehicle, driver };
    });

    // Filter Assets
    const filteredAssets = allPairedAssets.filter(pair => {
        if (filters.assetType === 'all') return true;
        return pair.vehicle.vehicleType === filters.assetType;
    });

    if (filteredAssets.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--color-text-muted);">No assets found matching criteria.</div>';
        return;
    }
    
    container.innerHTML = filteredAssets.map(pair => {
        // Dynamic icon based on vehicle type
        let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="11" rx="2" ry="2"></rect><line x1="2" y1="11" x2="22" y2="11"></line></svg>';
        if (pair.vehicle.vehicleType === 'van') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="12" rx="2" ry="2"></rect><circle cx="6" cy="19" r="2"></circle><circle cx="18" cy="19" r="2"></circle><path d="M14 7h6v5h-6z"></path></svg>';
        }
        
        return `
        <div class="asset-card">
            <div class="asset-header">
                <div class="asset-icon">
                    ${iconSvg}
                </div>
                <div class="asset-info" style="width: 100%;">
                    <div class="asset-name" style="margin-bottom: 6px;">${pair.vehicle.name} <span style="background: rgba(59, 130, 246, 0.1); color: var(--color-primary); font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">${pair.vehicle.registrationNumber}</span></div>
                    <div class="asset-meta" style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <span><strong style="color: var(--color-text-primary);">Type:</strong> <span style="text-transform: capitalize;">${pair.vehicle.vehicleType || 'N/A'}</span></span>
                            <span><strong style="color: var(--color-text-primary);">Capacity:</strong> ${pair.vehicle.maxLoadCapacity || 0} kg</span>
                        </div>
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <span><strong style="color: var(--color-text-primary);">Driver:</strong> ${pair.driver ? pair.driver.name : '<span style="color: var(--color-danger);">None Available</span>'}</span>
                            ${pair.driver && pair.driver.contactNumber ? `<span><strong style="color: var(--color-text-primary);">Phone:</strong> ${pair.driver.contactNumber}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="asset-dropzone" data-vehicle-id="${pair.vehicle._id}" data-driver-id="${pair.driver ? pair.driver._id : ''}">
                <div class="empty-drop-text">Drag a load here to assign</div>
            </div>
        </div>
    `}).join('');
}

function initDragAndDrop() {
    const loadList = document.getElementById('unassigned-loads-list');
    const dropzones = document.querySelectorAll('.asset-dropzone');
    
    if (sortableLoads) sortableLoads.destroy();
    
    // The source list
    sortableLoads = new Sortable(loadList, {
        group: {
            name: 'shared',
            pull: 'clone',
            put: false // Don't allow items to be put back here easily (they are assigned)
        },
        animation: 150,
        sort: false,
        onStart: function (evt) {
            document.body.classList.add('dragging-load');
        },
        onEnd: function (evt) {
            document.body.classList.remove('dragging-load');
        }
    });
    
    // The target dropzones
    dropzones.forEach(dz => {
        new Sortable(dz, {
            group: 'shared',
            animation: 150,
            onAdd: async function (evt) {
                const itemEl = evt.item;  // dragged HTMLElement
                const loadId = itemEl.getAttribute('data-id');
                const vehicleId = dz.getAttribute('data-vehicle-id');
                const driverId = dz.getAttribute('data-driver-id');
                
                if (!driverId) {
                    alert("Cannot assign to an asset without an available driver.");
                    itemEl.parentNode.removeChild(itemEl); // Remove the clone
                    renderBoard(); // re-render to reset state
                    return;
                }
                
                // Show loading state on card
                itemEl.style.opacity = '0.5';
                
                try {
                    // Make API call to assign
                    const res = await api.put(`/trips/${loadId}`, {
                        vehicle: vehicleId,
                        driver: driverId,
                        status: 'assigned'
                    });
                    
                    if (res.success) {
                        alert(`Load assigned successfully!`);
                        // Refresh board data
                        await initDispatchBoard();
                    } else {
                        throw new Error("API reported failure");
                    }
                } catch(e) {
                    console.error("Assignment failed:", e);
                    alert("Failed to assign load.");
                    itemEl.parentNode.removeChild(itemEl); // Remove the clone
                    renderBoard();
                }
            }
        });
    });
}

// --- Quick Assign Modal ---

function openAssignModal(loadId) {
    document.getElementById('a-load-id').value = loadId;
    document.getElementById('assign-load-id').textContent = `#${boardData.unassignedLoads.find(l => l._id === loadId)?.tripCode}`;
    
    const select = document.getElementById('a-asset-select');
    select.innerHTML = '';
    
    const pairedAssets = boardData.availableVehicles.map((vehicle, index) => {
        const driver = boardData.availableDrivers[index] || null;
        return { vehicle, driver };
    }).filter(p => p.driver); // Only show assets with drivers
    
    if (pairedAssets.length === 0) {
        select.innerHTML = '<option disabled selected>No available assets with drivers</option>';
    } else {
        pairedAssets.forEach(pair => {
            select.innerHTML += `<option value="${pair.vehicle._id}|${pair.driver._id}">${pair.vehicle.name} / Driver: ${pair.driver.name}</option>`;
        });
    }
    
    modal.open('assign-modal');
}

async function handleAssignLoad(e) {
    e.preventDefault();
    const loadId = document.getElementById('a-load-id').value;
    const assetVal = document.getElementById('a-asset-select').value;
    
    if (!assetVal || assetVal.includes('No available')) return;
    
    const [vehicleId, driverId] = assetVal.split('|');
    
    try {
        const res = await api.put(`/trips/${loadId}`, {
            vehicle: vehicleId,
            driver: driverId,
            status: 'assigned'
        });
        
        if (res.success) {
            modal.close('assign-modal');
            await initDispatchBoard();
        }
    } catch (e) {
        console.error("Assignment failed:", e);
        alert("Failed to assign load.");
    }
}

// --- Create Load Modal ---

function openCreateLoadModal() {
    document.getElementById('load-form').reset();
    modal.open('load-modal');
}

function calculateRevenue() {
    const rateType = document.getElementById('l-rate-type').value;
    const rate = parseFloat(document.getElementById('l-rate').value) || 0;
    
    if (rateType === 'flat') {
        document.getElementById('l-revenue').value = rate;
    } else if (rateType === 'per_mile') {
        const distance = parseFloat(document.getElementById('l-distance').value) || 0;
        document.getElementById('l-revenue').value = rate * distance;
    }
}

async function handleCreateLoad(e) {
    e.preventDefault();
    
    const rateType = document.getElementById('l-rate-type').value;
    const rate = parseFloat(document.getElementById('l-rate').value) || 0;
    const distance = parseFloat(document.getElementById('l-distance').value) || 0;
    
    let revenue = parseFloat(document.getElementById('l-revenue').value);
    
    // Fallback if they didn't click calculate or enter it manually
    if (isNaN(revenue)) {
        revenue = rateType === 'flat' ? rate : (rate * distance);
    }
    
    const payload = {
        customerName: document.getElementById('l-customer').value,
        source: document.getElementById('l-source').value,
        destination: document.getElementById('l-destination').value,
        commodityType: document.getElementById('l-commodity').value,
        cargoWeight: parseFloat(document.getElementById('l-weight').value),
        rateType: rateType,
        rate: rate,
        plannedDistance: distance,
        revenue: revenue,
        priority: document.getElementById('l-priority').value,
        eta: document.getElementById('l-eta').value || null,
        status: 'draft'
    };
    
    try {
        const res = await api.post('/trips', payload);
        if (res.success) {
            modal.close('load-modal');
            await initDispatchBoard();
        }
    } catch (err) {
        console.error('Failed to create load:', err);
        alert('Failed to create load. ' + (err.message || ''));
    }
}

// Global Event Listeners for Filters
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('load-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filters.loadSearch = e.target.value;
            renderUnassignedLoads();
            initDragAndDrop(); // Re-init sortable after DOM rewrite
        });
    }

    const filterSelect = document.getElementById('asset-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            filters.assetType = e.target.value;
            renderAvailableAssets();
            initDragAndDrop(); // Re-init sortable after DOM rewrite
        });
    }
});
