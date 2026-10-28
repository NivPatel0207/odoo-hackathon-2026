
document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth(['driver']);
  nav.render('driver-documents');
  
  const uploadForm = document.getElementById('upload-doc-form');
  if (uploadForm) {
    uploadForm.addEventListener('submit', handleUpload);
  }
  
  loadDocuments();
});

async function loadDocuments() {
  const grid = document.getElementById('doc-grid');
  grid.innerHTML = '<div style="color: var(--color-text-muted);">Loading documents...</div>';
  
  const driverId = auth.getDriverId();
  if (!driverId) {
    grid.innerHTML = '<div style="color: red;">Error: No driver profile linked to this user.</div>';
    return;
  }
  
  try {
    const res = await api.get(`/driver-portal/${driverId}/documents`);
    if (res.success) {
      renderDocuments(res.data);
    } else {
      grid.innerHTML = `<div style="color: red;">Failed to load documents: ${res.message || 'Unknown error'}</div>`;
    }
  } catch (error) {
    console.error("Error fetching documents:", error);
    grid.innerHTML = '<div style="color: red;">Network error while loading documents.</div>';
  }
}

function renderDocuments(docs) {
  const grid = document.getElementById('doc-grid');
  
  if (!docs || docs.length === 0) {
    grid.innerHTML = '<div style="color: var(--color-text-muted); grid-column: 1 / -1; text-align: center; padding: 2rem;">No documents found. Upload your required documents above.</div>';
    return;
  }
  
  grid.innerHTML = docs.map(doc => {
    // Format type
    const title = (doc.documentType || 'Document').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    // Status color
    let statusColor = 'var(--color-warning)';
    if (doc.verificationStatus === 'verified') statusColor = 'var(--color-success)';
    if (doc.verificationStatus === 'rejected') statusColor = 'var(--color-danger)';
    
    // Expiry
    let expiryHtml = '';
    if (doc.expiryDate) {
      const expDate = new Date(doc.expiryDate);
      const isExpired = expDate < new Date();
      expiryHtml = `<div style="font-size: 0.8rem; margin-top: 4px; color: ${isExpired ? 'var(--color-danger)' : 'var(--color-text-muted)'}">Expires: ${expDate.toLocaleDateString()} ${isExpired ? '(EXPIRED)' : ''}</div>`;
    }
    
    return `
    <div class="doc-card">
      <div class="doc-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8"/></svg>
      </div>
      <div class="doc-title">${title}</div>
      <div class="doc-meta">
        <span style="color: ${statusColor}; font-weight: 600; text-transform: uppercase; font-size: 0.75rem;">${doc.verificationStatus}</span>
        ${expiryHtml}
      </div>
      <button class="btn-view" onclick="downloadDocument('${doc._id}')">Download</button>
    </div>
  `}).join('');
}

async function handleUpload(e) {
  e.preventDefault();
  
  const type = document.getElementById('doc-type').value;
  const fileInput = document.getElementById('doc-file');
  const file = fileInput.files[0];
  
  if (!file) return;
  
  const driverId = auth.getDriverId();
  
  const formData = new FormData();
  formData.append('documentType', type);
  formData.append('file', file);
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerText;
  submitBtn.innerText = 'Uploading...';
  submitBtn.disabled = true;
  
  try {
    const res = await api.postMultipart(`/driver-portal/${driverId}/documents`, formData);
    if (res.success) {
      alert('Document uploaded successfully!');
      e.target.reset();
      loadDocuments();
    } else {
      alert(`Failed to upload: ${res.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Upload error:", error);
    alert('Error uploading document. Check network connection.');
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
}

window.downloadDocument = async function(docId) {
  try {
    const url = (window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'http://localhost:5000/api/v1') + `/documents/${docId}/download`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${api.getToken()}`
      }
    });
    if (!res.ok) throw new Error('Download failed');
    
    // Attempt to extract filename from Content-Disposition header
    let filename = `document-${docId}`;
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
    window.URL.revokeObjectURL(objUrl);
    a.remove();
  } catch (error) {
    console.error("Download error:", error);
    alert("Failed to download document. You may not have permission.");
  }
}
