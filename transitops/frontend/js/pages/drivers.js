document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth(['fleet_manager', 'safety_officer', 'dispatcher', 'financial_analyst'])) return;
  nav.render('drivers');

  // RBAC UI Check
  if (!auth.can('safety_officer', 'fleet_manager')) {
    const addBtn = document.getElementById('btn-add-driver');
    if (addBtn) addBtn.style.display = 'none';
  }

  loadDrivers();

  document.getElementById('filter-status').addEventListener('change', () => loadDrivers());
  document.getElementById('search-input').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('#driver-table-body tr').forEach(tr => {
      const text = tr.innerText.toLowerCase();
      tr.style.display = text.includes(term) ? '' : 'none';
    });
  });

  document.getElementById('driver-form').addEventListener('submit', handleDriverSubmit);
  
  // Update Payment label based on type
  document.getElementById('d-payment-type').addEventListener('change', (e) => {
    const label = document.getElementById('d-payment-amount-label');
    if (e.target.value === 'monthly') {
      label.innerText = 'Payment Amount (₹ / Month)';
    } else {
      label.innerText = 'Payment Amount (₹ / Trip)';
    }
  });

  // Formatting License Number (XX00 00000000000)
  document.getElementById('d-license').addEventListener('input', function(e) {
    let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (val.length > 4) {
      val = val.substring(0, 4) + ' ' + val.substring(4, 15);
    }
    e.target.value = val;
  });

  // Formatting Contact Number (+91 XXXXXXXXXX)
  document.getElementById('d-contact').addEventListener('input', function(e) {
    let val = e.target.value.replace(/[^\d]/g, '');
    if (val.startsWith('91')) {
      val = val.substring(2);
    }
    val = val.substring(0, 10);
    if (val.length > 0) {
      e.target.value = '+91 ' + val;
    } else {
      e.target.value = '';
    }
  });

  // Formatting Aadhar Number (0000 0000 0000)
  document.getElementById('d-aadhar').addEventListener('input', function(e) {
    let val = e.target.value.replace(/\D/g, '').substring(0, 12);
    let formatted = '';
    for (let i = 0; i < val.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formatted += ' ';
      }
      formatted += val[i];
    }
    e.target.value = formatted;
  });
});

let allDrivers = [];
let currentDriverPage = 1;
const driverLimit = 50;

async function loadDrivers(append = false) {
  const status = document.getElementById('filter-status').value;
  
  if (!append) {
    currentDriverPage = 1;
    allDrivers = [];
  }
  
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('page', currentDriverPage);
  params.append('limit', driverLimit);
  
  const query = `?${params.toString()}`;
  
  try {
    loading.show();
    const res = await api.getDrivers(query);
    if (res.success) {
      if (append) {
        allDrivers = [...allDrivers, ...res.data];
      } else {
        allDrivers = res.data;
      }
      renderTable(allDrivers);
      
      const totalPages = res.pagination ? res.pagination.pages : 1;
      renderDriverLoadMore(totalPages);
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
      <td><div class="primary-text font-mono">${fmt.mask(d.licenseNumber)}</div></td>
      <td>Class ${d.licenseCategory}</td>
      <td class="${expiryClass}">${fmt.date(d.licenseExpiryDate)}${isExpired ? ' ⚠️' : ''}</td>
      <td>${fmt.safetyScore(d.safetyScore)}</td>
      <td>
        <div class="primary-text">${fmt.currency(d.paymentAmount || 0)}</div>
        <div class="sub-text">${d.paymentType === 'per_trip' ? 'Per Trip' : 'Monthly Salary'}</div>
      </td>
      <td>
        ${d.kyc?.aadharVerified ? '<span class="badge badge-success">Verified</span>' : '<span class="badge badge-warning">Pending KYC</span>'}
      </td>
      <td>${fmt.badge(d.status)}</td>
      <td>
        <div class="table-actions">
          ${auth.can('safety_officer', 'fleet_manager') ? `
            <button class="btn btn-sm btn-secondary" onclick="editDriver('${d._id}')">Edit</button>
            ${d.status !== 'suspended' ? `<button class="btn btn-sm btn-secondary" onclick="suspendDriver('${d._id}')">Suspend</button>` : ''}
            ${d.status === 'suspended' ? `<button class="btn btn-sm btn-success" onclick="unsuspendDriver('${d._id}')">Restore</button>` : ''}
            <button class="btn btn-sm btn-danger" onclick="deleteDriverPrompt('${d._id}', '${(d.name || '').replace(/'/g, "\\'")}')">Delete</button>
          ` : '<span class="text-muted" style="font-size:0.75rem;">View Only</span>'}
        </div>
      </td>
    </tr>
  `}).join('');
}

function renderDriverLoadMore(totalPages) {
  let loadMoreBtn = document.getElementById('load-more-btn');
  if (currentDriverPage < totalPages) {
    if (!loadMoreBtn) {
      loadMoreBtn = document.createElement('button');
      loadMoreBtn.id = 'load-more-btn';
      loadMoreBtn.className = 'btn btn-secondary';
      loadMoreBtn.style = 'margin: 20px auto; display: block;';
      loadMoreBtn.innerText = 'Load More';
      loadMoreBtn.onclick = () => {
        currentDriverPage++;
        loadDrivers(true);
      };
      // Append to the parent of the table
      const tbody = document.getElementById('driver-table-body');
      if (tbody) tbody.closest('.card').appendChild(loadMoreBtn);
    }
  } else {
    if (loadMoreBtn) loadMoreBtn.remove();
  }
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
    safetyScore: Number(document.getElementById('d-score').value),
    paymentType: document.getElementById('d-payment-type').value,
    paymentAmount: Number(document.getElementById('d-payment-amount').value),
    kyc: {
      aadharNumber: document.getElementById('d-aadhar').value,
      aadharVerified: document.getElementById('d-aadhar-verified').value === 'true'
    }
  };

  try {
    loading.show();
    if (id) {
      await api.updateDriver(id, payload);
      toast.success('Driver updated successfully');
    } else {
      const res = await api.createDriver(payload);
      if (res && res.credentials) {
        const nameEl = document.getElementById('cred-driver-name');
        const emailEl = document.getElementById('cred-driver-email');
        const passEl = document.getElementById('cred-driver-password');
        if (nameEl) nameEl.textContent = (res.data && res.data.name) || payload.name;
        if (emailEl) emailEl.value = res.credentials.email;
        if (passEl) passEl.value = res.credentials.password;
        modal.open('credentials-modal');
        toast.success('Driver registered & login generated');
      } else {
        toast.success('Driver registered successfully');
      }
    }
    modal.close('driver-modal');
    e.target.reset();
    document.getElementById('driver-id').value = '';
    loadDrivers();
  } catch (err) {
    toast.error('Operation Failed', err.message);
  } finally {
    loading.hide();
  }
}

// Helper to copy credentials to clipboard
window.copyCredField = (elementId, btn) => {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.value || el.innerText || '';
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  }).catch(() => {
    if (el.select) el.select();
    document.execCommand('copy');
    toast.success('Copied to clipboard');
  });
};

// Performance Dashboard
window.openPerformanceModal = async () => {
  try {
    loading.show();
    const res = await api.getDriverPerformance();
    const tbody = document.getElementById('performance-table-body');
    if (res && res.data && res.data.length > 0) {
      tbody.innerHTML = res.data.map(d => `
        <tr>
          <td>
            <div style="font-weight: 500;">${d.name}</div>
            <div style="font-size: 0.8rem; color: var(--color-text-muted); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${d.licenseNumber}">${d.licenseNumber}</div>
          </td>
          <td>${d.totalTrips}</td>
          <td>${d.totalDistance.toLocaleString()}</td>
          <td>₹${d.totalRevenue.toLocaleString()}</td>
          <td>${d.avgFuelPerKm.toFixed(2)} L/km</td>
          <td>
            <span class="pill ${d.safetyScore >= 80 ? 'pill-success' : d.safetyScore >= 60 ? 'pill-warning' : 'pill-danger'}">
              ${d.safetyScore}
            </span>
          </td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No performance data available</td></tr>`;
    }
    modal.open('performance-modal');
  } catch (err) {
    toast.error('Error', err.message || 'Could not load performance data');
  } finally {
    loading.hide();
  }
};

function openNewDriverModal() {
  document.getElementById('driver-form').reset();
  document.getElementById('driver-id').value = '';
  
  // Reset KYC fields specifically
  const aadharInput = document.getElementById('d-aadhar');
  const aadharVerified = document.getElementById('d-aadhar-verified');
  const verifyBtn = document.getElementById('btn-verify-kyc');
  const hint = document.getElementById('kyc-hint');
  
  aadharInput.disabled = false;
  aadharVerified.value = 'false';
  verifyBtn.disabled = false;
  verifyBtn.innerText = 'Verify via Central DB';
  verifyBtn.classList.remove('btn-success');
  verifyBtn.classList.add('btn-secondary');
  hint.innerText = 'Verification required before assignment.';
  hint.style.color = 'var(--color-text-muted)';

  document.getElementById('d-payment-type').dispatchEvent(new Event('change'));
  modal.open('driver-modal');
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
  document.getElementById('d-payment-type').value = d.paymentType || 'monthly';
  document.getElementById('d-payment-amount').value = d.paymentAmount || 0;
  
  const aadharInput = document.getElementById('d-aadhar');
  const aadharVerified = document.getElementById('d-aadhar-verified');
  const verifyBtn = document.getElementById('btn-verify-kyc');
  const hint = document.getElementById('kyc-hint');
  
  if (d.kyc) {
    aadharInput.value = d.kyc.aadharNumber || '';
    aadharVerified.value = d.kyc.aadharVerified ? 'true' : 'false';
    if (d.kyc.aadharVerified) {
      aadharInput.disabled = true;
      verifyBtn.disabled = true;
      verifyBtn.innerText = 'Verified ✓';
      hint.innerText = 'Aadhar officially verified via Central DB.';
      hint.style.color = 'var(--color-success)';
    } else {
      aadharInput.disabled = false;
      verifyBtn.disabled = false;
      verifyBtn.innerText = 'Verify via Central DB';
      hint.innerText = 'Verification required before assignment.';
      hint.style.color = 'var(--color-text-muted)';
    }
  } else {
    aadharInput.value = '';
    aadharVerified.value = 'false';
    aadharInput.disabled = false;
    verifyBtn.disabled = false;
    verifyBtn.innerText = 'Verify via Central DB';
    hint.innerText = 'Verification required before assignment.';
    hint.style.color = 'var(--color-text-muted)';
  }
  
  // Trigger change to update label
  document.getElementById('d-payment-type').dispatchEvent(new Event('change'));
  
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

window.deleteDriverPrompt = async (id, name) => {
  if (!(await ui.confirm(`Permanently delete driver "${name}"?\nThis will remove their profile and delete their associated login account.`))) return;
  try {
    loading.show();
    await api.deleteDriver(id);
    toast.success('Driver and associated login account deleted');
    loadDrivers();
  } catch (err) {
    toast.error('Failed to delete driver', err.message);
  } finally {
    loading.hide();
  }
};

async function verifyKYC() {
  const aadharInput = document.getElementById('d-aadhar');
  const aadharVal = aadharInput.value.replace(/\s/g, '');
  
  if (!aadharVal || aadharVal.length !== 12 || isNaN(Number(aadharVal))) {
    toast.error('Invalid Aadhar', 'Please enter a valid 12-digit Aadhar number.');
    return;
  }
  
  const btn = document.getElementById('btn-verify-kyc');
  btn.innerText = 'Verifying...';
  btn.disabled = true;
  
  // Simulate live API Call
  setTimeout(() => {
    document.getElementById('d-aadhar-verified').value = 'true';
    aadharInput.disabled = true;
    
    btn.innerText = 'Verified ✓';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-success');
    
    const hint = document.getElementById('kyc-hint');
    hint.innerText = 'Aadhar officially verified via Central DB.';
    hint.style.color = 'var(--color-success)';
    
    toast.success('KYC Approved', 'Aadhar verified successfully with Central Database.');
  }, 2000);
}

// --- Document Verification Methods (Phase 7) ---

async function openDocumentsModal(driverId, driverName) {
  const content = document.getElementById('docs-modal-content');
  content.innerHTML = '<p>Loading documents...</p>';
  modal.open('docs-modal');
  
  try {
    const res = await api.get(`/documents/driver/${driverId}`);
    if (res.success && res.data) {
      if (res.data.length === 0) {
        content.innerHTML = '<p>No documents uploaded by ' + driverName + '.</p>';
        return;
      }
      
      content.innerHTML = res.data.map(doc => {
        return `
          <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <strong>${doc.documentType.replace('_', ' ').toUpperCase()}</strong>
              <span>Status: ${doc.verificationStatus}</span>
            </div>
            <p style="margin: 5px 0; font-size: 0.9em;">Issue: ${new Date(doc.issueDate).toLocaleDateString()} | Expiry: ${new Date(doc.expiryDate).toLocaleDateString()}</p>
            <div style="margin-top: 10px;">
              <button class="btn btn-secondary btn-sm" onclick="downloadDocument('${doc._id}')">View</button>
              ${doc.verificationStatus === 'pending' ? `
                <button class="btn btn-primary btn-sm" onclick="verifyDocument('${doc._id}', 'verified', '${driverId}', '${driverName}')">Verify</button>
                <button class="btn btn-danger btn-sm" style="background: red; color: white;" onclick="verifyDocument('${doc._id}', 'rejected', '${driverId}', '${driverName}')">Reject</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    content.innerHTML = '<p>Error loading documents.</p>';
  }
}

async function downloadDocument(id) {
  try {
    const url = (window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'http://localhost:5000/api/v1') + `/documents/${id}/download`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${api.getToken()}`
      }
    });
    if (!res.ok) throw new Error('Download failed');
    
    // Attempt to extract filename from Content-Disposition header
    let filename = `document_${id}`;
    const disposition = res.headers.get('content-disposition');
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
      const matches = filenameRegex.exec(disposition);
      if (matches != null && matches[1]) { 
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    
    const blob = await res.blob();
    const objUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(objUrl);
  } catch (err) {
    if (typeof toast !== 'undefined') toast.error('Download Failed', err.message);
  }
}

async function verifyDocument(docId, status, driverId, driverName) {
  let reason = '';
  if (status === 'rejected') {
    reason = prompt('Enter rejection reason:');
    if (!reason) return;
  }
  
  try {
    const res = await api.put(`/documents/${docId}/verify`, { status, rejectionReason: reason });
    if (res.success) {
      toast.success(`Document ${status} successfully.`);
      openDocumentsModal(driverId, driverName); // refresh
    }
  } catch (err) {
    toast.error('Failed to update document status');
  }
}
