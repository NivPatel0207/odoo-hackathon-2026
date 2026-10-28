// driver-profile.js

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-profile');
  
  await loadProfile();
});

async function loadProfile() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    const res = await api.get(`/driver-portal/${user.driverProfileId}/profile`);
    if (res.success && res.data) {
      renderProfile(res.data);
    }
  } catch (err) {
    toast.error('Failed to load profile', err.message);
  } finally {
    loading.hide();
  }
}

function renderProfile(driver) {
  // Header
  document.getElementById('prof-name').innerText = driver.name || 'Unknown Driver';
  document.getElementById('prof-status').innerText = driver.status || 'Active';
  
  if (driver.name) {
    const initials = driver.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('prof-avatar').innerText = initials;
  }
  
  // Personal Details
  if (driver.user && driver.user.email) {
    document.getElementById('prof-email').innerText = driver.user.email;
  }
  document.getElementById('prof-phone').innerText = driver.contactNumber || '-';
  
  // License
  document.getElementById('prof-license').innerText = driver.licenseNumber || '-';
  document.getElementById('prof-class').innerText = driver.licenseCategory ? `Class ${driver.licenseCategory}` : '-';
  
  if (driver.licenseExpiryDate) {
    document.getElementById('prof-expiry').innerText = new Date(driver.licenseExpiryDate).toLocaleDateString();
  }
  
  // KYC
  if (driver.kyc) {
    document.getElementById('prof-aadhar').innerText = driver.kyc.aadharNumber || 'Not Provided';
    
    const badge = document.getElementById('prof-kyc-badge');
    if (driver.kyc.aadharVerified) {
      badge.innerText = 'Verified';
      badge.className = 'badge badge-verified';
    } else {
      badge.innerText = 'Pending';
      badge.className = 'badge badge-pending';
    }
  }
}
