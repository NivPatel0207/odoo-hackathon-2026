document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth(['fleet_manager', 'safety_officer', 'dispatcher', 'financial_analyst'])) return;
  nav.render('vehicles');

  // RBAC UI Check
  if (!auth.can('fleet_manager')) {
    const btn = document.getElementById('btn-add-vehicle');
    if (btn) btn.style.display = 'none';
  }

  loadVehicles();

  document.getElementById('filter-status').addEventListener('change', () => loadVehicles());
  document.getElementById('search-input').addEventListener('input', (e) => {
    // Simple frontend filtering for search
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#vehicle-table-body tr').forEach(tr => {
      const text = tr.innerText.toLowerCase();
      tr.style.display = text.includes(term) ? '' : 'none';
    });
  });

  document.getElementById('vehicle-form').addEventListener('submit', handleVehicleSubmit);

  // Auto-fill specs based on selected model
  const vehicleSpecs = {
    // Tata Motors
    'Tata Ace': { type: 'truck', fuel: 'diesel', capacity: 750 },
    'Tata Intra': { type: 'truck', fuel: 'diesel', capacity: 1000 },
    'Tata Yodha': { type: 'pickup', fuel: 'diesel', capacity: 1500 },
    'Tata 407': { type: 'truck', fuel: 'diesel', capacity: 2250 },
    'Tata 709': { type: 'truck', fuel: 'diesel', capacity: 4000 },
    'Tata 1109': { type: 'truck', fuel: 'diesel', capacity: 7000 },
    'Tata 1512': { type: 'truck', fuel: 'diesel', capacity: 10000 },
    'Tata Prima': { type: 'trailer', fuel: 'diesel', capacity: 40000 },
    'Tata Signa': { type: 'trailer', fuel: 'diesel', capacity: 45000 },
    'Tata Ultra': { type: 'truck', fuel: 'diesel', capacity: 7500 },
    // Ashok Leyland
    'Ashok Leyland Dost': { type: 'truck', fuel: 'diesel', capacity: 1250 },
    'Ashok Leyland Bada Dost': { type: 'truck', fuel: 'diesel', capacity: 1860 },
    'Ashok Leyland Partner': { type: 'truck', fuel: 'diesel', capacity: 4000 },
    'Ashok Leyland Boss': { type: 'truck', fuel: 'diesel', capacity: 8000 },
    'Ashok Leyland Ecomet': { type: 'truck', fuel: 'diesel', capacity: 11000 },
    'Ashok Leyland U-Truck': { type: 'trailer', fuel: 'diesel', capacity: 35000 },
    // Mahindra
    'Mahindra Bolero Pik-Up': { type: 'pickup', fuel: 'diesel', capacity: 1500 },
    'Mahindra Supro': { type: 'van', fuel: 'diesel', capacity: 850 },
    'Mahindra Jeeto': { type: 'truck', fuel: 'diesel', capacity: 600 },
    'Mahindra Furio': { type: 'truck', fuel: 'diesel', capacity: 12000 },
    'Mahindra Blazo': { type: 'truck', fuel: 'diesel', capacity: 35000 },
    // Eicher
    'Eicher Pro 2000': { type: 'truck', fuel: 'diesel', capacity: 5000 },
    'Eicher Pro 3000': { type: 'truck', fuel: 'diesel', capacity: 12000 },
    'Eicher Pro 6000': { type: 'trailer', fuel: 'diesel', capacity: 35000 },
    'Eicher Pro 8000': { type: 'trailer', fuel: 'diesel', capacity: 49000 },
    // BharatBenz
    'BharatBenz 1015R': { type: 'truck', fuel: 'diesel', capacity: 5500 },
    'BharatBenz 1215R': { type: 'truck', fuel: 'diesel', capacity: 7500 },
    'BharatBenz 1923C': { type: 'truck', fuel: 'diesel', capacity: 12000 },
    'BharatBenz 2823R': { type: 'truck', fuel: 'diesel', capacity: 20000 },
    'BharatBenz 4228R': { type: 'trailer', fuel: 'diesel', capacity: 28000 },
    // Volvo / Scania
    'Volvo FH': { type: 'trailer', fuel: 'diesel', capacity: 50000 },
    'Volvo FMX': { type: 'trailer', fuel: 'diesel', capacity: 45000 },
    'Scania P-Series': { type: 'trailer', fuel: 'diesel', capacity: 40000 },
    'Scania G-Series': { type: 'trailer', fuel: 'diesel', capacity: 45000 },
    // Others
    'Force Traveller': { type: 'van', fuel: 'diesel', capacity: 2000 },
    'Force Urbania': { type: 'van', fuel: 'diesel', capacity: 2500 },
    'SML Isuzu Sartaj': { type: 'truck', fuel: 'diesel', capacity: 2500 },
    'SML Isuzu Samrat': { type: 'truck', fuel: 'diesel', capacity: 4500 }
  };

  const inputField = document.getElementById('v-name');
  const dropdown = document.getElementById('v-name-dropdown');
  const vehicleKeys = Object.keys(vehicleSpecs);

  function renderDropdown(filterText = '') {
    dropdown.innerHTML = '';
    const term = filterText.toLowerCase().trim();
    
    // Filter matching vehicles
    const matches = vehicleKeys.filter(key => key.toLowerCase().includes(term));
    
    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="autocomplete-no-results">No matching models found</div>`;
      dropdown.classList.add('show');
      return;
    }

    matches.forEach(match => {
      const div = document.createElement('div');
      div.className = 'autocomplete-item';
      
      // Determine a fun little icon based on type for the dropdown
      const type = vehicleSpecs[match].type;
      let icon = '🚚'; // default truck
      if (type === 'van') icon = '🚐';
      if (type === 'pickup') icon = '🛻';
      if (type === 'trailer') icon = '🚛';
      if (type === 'bus') icon = '🚌';

      div.innerHTML = `<span class="autocomplete-item-icon">${icon}</span> ${match}`;
      
      // On click, set value and trigger spec fill
      div.addEventListener('click', () => {
        inputField.value = match;
        dropdown.classList.remove('show');
        fillSpecs(match);
      });
      
      dropdown.appendChild(div);
    });
    
    dropdown.classList.add('show');
  }

  function fillSpecs(modelName) {
    const spec = vehicleSpecs[modelName];
    if (spec) {
      document.getElementById('v-type').value = spec.type;
      document.getElementById('v-fuel').value = spec.fuel;
      document.getElementById('v-capacity').value = spec.capacity;
      toast.info('Auto-Filled', `Specs loaded for ${modelName}`);
    }
  }

  // Event Listeners for Custom Autocomplete
  inputField.addEventListener('focus', () => renderDropdown(inputField.value));
  inputField.addEventListener('input', (e) => {
    renderDropdown(e.target.value);
    fillSpecs(e.target.value); // Attempt to fill if exact match typed
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!inputField.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });

});

let allVehicles = [];
let currentVehiclePage = 1;
const vehicleLimit = 50;

async function loadVehicles(append = false) {
  const status = document.getElementById('filter-status').value;
  
  if (!append) {
    currentVehiclePage = 1;
    allVehicles = [];
  }
  
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', currentVehiclePage);
  params.append('limit', vehicleLimit);
  
  const query = `?${params.toString()}`;
  
  try {
    loading.show();
    const res = await api.getVehicles(query);
    if (res.success) {
      if (append) {
        allVehicles = [...allVehicles, ...res.data];
      } else {
        allVehicles = res.data;
      }
      renderTable(allVehicles);
      
      const totalPages = res.pagination ? res.pagination.pages : 1;
      renderVehicleLoadMore(totalPages);
    }
  } catch (err) {
    toast.error('Failed to load vehicles', err.message);
  } finally {
    loading.hide();
  }
}

function renderTable(vehicles) {
  const tbody = document.getElementById('vehicle-table-body');
  if (vehicles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-8">No vehicles found.</td></tr>`;
    return;
  }

  tbody.innerHTML = vehicles.map(v => `
    <tr>
      <td><div class="primary-text font-mono">${fmt.mask(v.registrationNumber)}</div></td>
      <td><div class="primary-text">${v.name}</div><div class="sub-text">${v.region}</div></td>
      <td style="text-transform: capitalize;">${v.vehicleType || 'Truck'}</td>
      <td style="text-transform: capitalize;">${v.fuelType || 'Diesel'}</td>
      <td>${fmt.number(v.maxLoadCapacity)} kg</td>
      <td>${fmt.currency(v.acquisitionCost || 0)}</td>
      <td>${fmt.number(v.odometer)} km</td>
      <td>${fmt.badge(v.status)}</td>
      <td>
        <div class="table-actions">
          ${auth.can('fleet_manager') ? `
            <button class="icon-action-btn" title="Edit Vehicle" onclick="editVehicle('${v._id}')">✏️</button>
            <button class="icon-action-btn danger" title="Delete Vehicle" onclick="deleteVehicle('${v._id}')">🗑️</button>
          ` : '<span class="text-muted" style="font-size:0.75rem;">View Only</span>'}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderVehicleLoadMore(totalPages) {
  let loadMoreBtn = document.getElementById('load-more-btn');
  if (currentVehiclePage < totalPages) {
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'btn btn-secondary';
      loadMoreBtn.style = 'margin: 20px auto; display: block;';
      loadMoreBtn.innerText = 'Load More';
      loadMoreBtn.onclick = () => {
        currentVehiclePage++;
        loadVehicles(true);
      };
      // Append to the parent of the table
      const tbody = document.getElementById('vehicle-table-body');
      if (tbody) tbody.closest('.card').appendChild(loadMoreBtn);
    }
  } else {
    if (loadMoreBtn) loadMoreBtn.remove();
  }
}

async function handleVehicleSubmit(e) {
  e.preventDefault();
  
  const rawReg = document.getElementById('v-reg').value;
  const regNumber = rawReg.toUpperCase().trim();
  const regRegex = /^[A-Z]{2}[0-9]{2}[A-Z]{1,3}[0-9]{4}$/;
  
  if (!regRegex.test(regNumber)) {
    toast.error('Invalid Registration Number', 'Please enter a valid format (e.g., GJ05AV7728).');
    return;
  }

  const id = document.getElementById('vehicle-id').value;
  const payload = {
    registrationNumber: regNumber,
    name: document.getElementById('v-name').value,
    vehicleType: document.getElementById('v-type').value,
    fuelType: document.getElementById('v-fuel').value,
    maxLoadCapacity: Number(document.getElementById('v-capacity').value),
    acquisitionCost: Number(document.getElementById('v-cost').value),
    odometer: Number(document.getElementById('v-odometer').value)
  };

  try {
    loading.show();
    if (id) {
      await api.updateVehicle(id, payload);
      toast.success('Vehicle updated successfully');
    } else {
      await api.createVehicle(payload);
      toast.success('Vehicle registered successfully');
    }
    modal.close('vehicle-modal');
    e.target.reset();
    document.getElementById('vehicle-id').value = '';
    loadVehicles();
  } catch (err) {
    toast.error('Operation failed', err.message);
  } finally {
    loading.hide();
  }
}

function editVehicle(id) {
  const v = allVehicles.find(x => x._id === id);
  if (!v) return;
  
  document.getElementById('vehicle-id').value = v._id;
  document.getElementById('v-reg').value = v.registrationNumber;
  document.getElementById('v-name').value = v.name;
  document.getElementById('v-type').value = v.vehicleType || 'truck';
  document.getElementById('v-fuel').value = v.fuelType || 'diesel';
  document.getElementById('v-capacity').value = v.maxLoadCapacity;
  document.getElementById('v-cost').value = v.acquisitionCost;
  document.getElementById('v-odometer').value = v.odometer;
  
  modal.open('vehicle-modal');
}

async function retireVehicle(id) {
  if (!(await ui.confirm('Are you sure you want to retire this vehicle? It will be permanently removed from dispatch.'))) return;
  try {
    loading.show();
    await api.updateVehicle(id, { status: 'retired' });
    toast.success('Vehicle retired');
    loadVehicles();
  } catch (err) {
    toast.error('Failed to retire', err.message);
  } finally {
    loading.hide();
  }
}

async function deleteVehicle(id) {
  if (!(await ui.confirm('Are you sure you want to permanently delete this vehicle?'))) return;
  try {
    loading.show();
    await api.deleteVehicle(id);
    toast.success('Vehicle deleted successfully');
    loadVehicles();
  } catch (err) {
    toast.error('Failed to delete', err.message);
  } finally {
    loading.hide();
  }
}
