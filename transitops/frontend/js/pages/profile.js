document.addEventListener('DOMContentLoaded', async () => {
  const user = auth.requireAuth();
  if (!user) return;
  
  nav.render('profile'); 
  
  if (typeof renderBreadcrumbs === 'function') {
    renderBreadcrumbs(['Profile']);
  }

  // Immediately populate cached user to prevent layout shift
  populateProfile(user);

  // Dynamic live sync: Fetch latest user record from backend to always show latest salary
  try {
    const res = await api.me();
    if (res && res.success && res.data) {
      const freshUser = res.data;
      auth.save(api.getToken(), freshUser);
      populateProfile(freshUser);
    }
  } catch (err) {
    console.warn('Could not refresh profile from backend:', err);
  }
});

function populateProfile(user) {
  if (!user) return;
  
  const avatarEl = document.getElementById('profile-avatar');
  if (user.profilePhoto) {
    avatarEl.innerText = '';
    avatarEl.style.backgroundImage = `url(${user.profilePhoto})`;
  } else {
    avatarEl.style.backgroundImage = '';
    avatarEl.innerText = user.name.charAt(0).toUpperCase();
  }

  document.getElementById('profile-name').innerText = user.name;
  document.getElementById('profile-email').innerText = user.email;
  document.getElementById('profile-phone').innerText = user.phone || 'Not provided';
  
  const roleLabels = {
    fleet_manager: 'Fleet Manager',
    dispatcher: 'Dispatcher',
    safety_officer: 'Safety Officer',
    financial_analyst: 'Financial Analyst',
    viewer: 'Viewer',
    driver: 'Driver'
  };
  
  const formattedRole = roleLabels[user.role] || user.role;
  document.getElementById('profile-role').innerText = formattedRole;
  
  // Populate new header elements
  const nameHeader = document.getElementById('profile-name-header');
  if (nameHeader) nameHeader.innerText = user.name;
  const roleHeader = document.getElementById('profile-role-header');
  if (roleHeader) roleHeader.innerText = formattedRole;

  document.getElementById('profile-emp-id').innerText = user.employeeId || '-';
  document.getElementById('profile-dept').innerText = user.department || '-';
  document.getElementById('profile-location').innerText = user.location || '-';
  document.getElementById('profile-address').innerText = user.address || '-';
  document.getElementById('profile-emergency').innerText = user.emergencyContact || '-';
  document.getElementById('profile-status').innerText = user.status || 'Active';

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString();
  };

  document.getElementById('profile-last-login').innerText = formatDate(user.lastLogin);
  document.getElementById('profile-created').innerText = formatDate(user.createdAt);

  document.getElementById('profile-dob').innerText = user.dateOfBirth || '-';
  document.getElementById('profile-joined').innerText = user.joiningDate || '-';
  
  // Calculate served years
  if (user.joiningDate) {
    const joined = new Date(user.joiningDate);
    const now = new Date();
    let years = now.getFullYear() - joined.getFullYear();
    if (now.getMonth() < joined.getMonth() || (now.getMonth() === joined.getMonth() && now.getDate() < joined.getDate())) {
      years--;
    }
    document.getElementById('profile-served').innerText = `${Math.max(0, years)} years`;
  } else {
    document.getElementById('profile-served').innerText = '-';
  }

  // Dynamic Salary formatting
  const salaryGroup = document.getElementById('profile-salary-group');
  const salaryEl = document.getElementById('profile-salary');
  const salarySubtext = document.getElementById('profile-salary-subtext');

  if (salaryGroup && salaryEl) {
    salaryGroup.style.display = 'block';

    let displaySalary = '₹0.00';
    let subtext = 'Base monthly salary managed by Operations';

    if (user.role === 'driver' && user.driverProfileId) {
      const dp = typeof user.driverProfileId === 'object' ? user.driverProfileId : {};
      const rate = dp.paymentAmount || user.salary || 0;
      const type = dp.paymentType === 'per_trip' ? 'Trip' : 'Month';
      displaySalary = `₹${Number(rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${type}`;
      subtext = `Driver compensation model: ${dp.paymentType === 'per_trip' ? 'Per completed trip' : 'Fixed monthly flat'}`;
    } else if (user.salary && user.salary > 0) {
      displaySalary = `₹${Number(user.salary).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / Month`;
      subtext = 'Base monthly fixed salary (synced with Company Payroll)';
    } else {
      displaySalary = '₹0.00';
      subtext = 'Salary not yet configured by Fleet Management';
    }

    salaryEl.innerText = displaySalary;
    if (salarySubtext) salarySubtext.innerText = subtext;
  }
}

document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('edit-name').value;
  const email = document.getElementById('edit-email').value;
  const phone = document.getElementById('edit-phone').value;
  const employeeId = document.getElementById('edit-emp-id').value;
  const department = document.getElementById('edit-dept').value;
  const location = document.getElementById('edit-location').value;
  const address = document.getElementById('edit-address').value;
  const emergencyContact = document.getElementById('edit-emergency').value;
  const dateOfBirth = document.getElementById('edit-dob').value;
  const joiningDate = document.getElementById('edit-joined').value;
  
  const fileInput = document.getElementById('edit-photo');
  let profilePhoto = undefined;

  const saveProfile = async (photoData) => {
    // Deliberately omit salary: salary is strictly non-editable by user
    const payload = { name, email, phone, employeeId, department, location, address, emergencyContact, dateOfBirth, joiningDate };
    
    if (photoData) {
      payload.profilePhoto = photoData;
    } else if (window.shouldRemovePhoto) {
      payload.profilePhoto = ""; // Empty string tells backend to clear it
    }

    try {
      if (typeof loading !== 'undefined') loading.show();
      const res = await api.updateProfile(payload);
      if (res && res.success) {
        if (typeof toast !== 'undefined') toast.success('Profile updated successfully');
        
        // Update local storage with latest verified profile
        const token = api.getToken();
        auth.save(token, res.data);
        
        // Update UI
        populateProfile(res.data);
        nav.render('profile');
        modal.close('edit-profile-modal');
      }
    } catch (err) {
      if (typeof toast !== 'undefined') toast.error('Update failed', err.message);
    } finally {
      if (typeof loading !== 'undefined') loading.hide();
    }
  };

  if (fileInput.files && fileInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => saveProfile(e.target.result);
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    saveProfile(null);
  }
});

// Pre-fill form when opening modal
document.querySelector('button[onclick="modal.open(\'edit-profile-modal\')"]')?.addEventListener('click', () => {
  const user = auth.getUser();
  if (user) {
    document.getElementById('edit-name').value = user.name || '';
    document.getElementById('edit-email').value = user.email || '';
    document.getElementById('edit-phone').value = user.phone || '';
    document.getElementById('edit-emp-id').value = user.employeeId || '';
    document.getElementById('edit-dept').value = user.department || '';
    document.getElementById('edit-location').value = user.location || '';
    document.getElementById('edit-address').value = user.address || '';
    document.getElementById('edit-emergency').value = user.emergencyContact || '';
    document.getElementById('edit-dob').value = user.dateOfBirth || '';
    document.getElementById('edit-joined').value = user.joiningDate || '';
    document.getElementById('edit-photo').value = ''; // Reset file input
    document.getElementById('edit-photo-name').innerText = 'PNG, JPG, WEBP up to 2MB'; // Reset file name
    
    window.shouldRemovePhoto = false;
    const btnRemovePhoto = document.getElementById('btn-remove-photo');
    if (user.profilePhoto) {
      btnRemovePhoto.style.display = 'inline-block';
    } else {
      btnRemovePhoto.style.display = 'none';
    }
    
    // Always display salary as read-only / locked
    const editSalaryGroup = document.getElementById('edit-salary-group');
    const editSalaryInput = document.getElementById('edit-salary');
    if (editSalaryGroup && editSalaryInput) {
      editSalaryGroup.style.display = 'block';
      let sVal = '₹0.00';
      if (user.role === 'driver' && user.driverProfileId) {
        const dp = typeof user.driverProfileId === 'object' ? user.driverProfileId : {};
        const rate = dp.paymentAmount || user.salary || 0;
        sVal = `₹${Number(rate).toLocaleString('en-IN')} (${dp.paymentType === 'per_trip' ? 'Per Trip' : 'Monthly'})`;
      } else if (user.salary && user.salary > 0) {
        sVal = `₹${Number(user.salary).toLocaleString('en-IN')} / Month`;
      } else {
        sVal = '₹0.00 (Unset)';
      }
      editSalaryInput.value = sVal;
    }
  }
});

const fileInput = document.getElementById('edit-photo');
const fileNameDisplay = document.getElementById('edit-photo-name');
const dropzone = document.getElementById('photo-dropzone');
const btnRemovePhoto = document.getElementById('btn-remove-photo');

fileInput?.addEventListener('change', (e) => {
  const fileName = e.target.files[0] ? e.target.files[0].name : 'PNG, JPG, WEBP up to 2MB';
  fileNameDisplay.innerText = fileName;
  if (e.target.files[0]) {
    btnRemovePhoto.style.display = 'inline-block';
    window.shouldRemovePhoto = false;
  }
});

btnRemovePhoto?.addEventListener('click', () => {
  fileInput.value = '';
  fileNameDisplay.innerText = 'PNG, JPG, WEBP up to 2MB';
  btnRemovePhoto.style.display = 'none';
  window.shouldRemovePhoto = true;
});

// Drag and drop support
if (dropzone) {
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--color-primary)';
    dropzone.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--color-border)';
    dropzone.style.backgroundColor = 'transparent';
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--color-border)';
    dropzone.style.backgroundColor = 'transparent';
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      fileNameDisplay.innerText = e.dataTransfer.files[0].name;
      btnRemovePhoto.style.display = 'inline-block';
      window.shouldRemovePhoto = false;
    }
  });

  // Allow clicking anywhere in the dropzone to trigger file selection
  dropzone.addEventListener('click', (e) => {
    if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT') {
      fileInput.click();
    }
  });
}
