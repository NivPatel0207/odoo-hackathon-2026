document.addEventListener('DOMContentLoaded', () => {
  const user = auth.requireAuth();
  if (!user) return;
  
  // Create settings in the nav since it doesn't exist yet
  // We'll pass 'settings' to keep it highlighted if we add it to the sidebar later
  nav.render('settings'); 
  
  if (typeof renderBreadcrumbs === 'function') {
    renderBreadcrumbs(['Settings']);
  }

  initTabs();
  initPreferences(user);
  initPasswordChange();
});

function initTabs() {
  const navItems = document.querySelectorAll('.settings-nav-item');
  const sections = document.querySelectorAll('.settings-section');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all nav items
      navItems.forEach(nav => nav.classList.remove('active'));
      // Add active class to clicked nav item
      item.classList.add('active');

      // Hide all sections
      sections.forEach(sec => sec.classList.remove('active'));
      // Show targeted section
      const targetId = item.getAttribute('data-target');
      document.getElementById(targetId).classList.add('active');
    });
  });
}

function initPreferences(user) {
  const configs = [
    { key: 'theme', default: 'system', selector: '#theme-selector .theme-option', attr: 'data-theme-val' },
    { key: 'accentColor', default: 'orange', selector: '#accent-selector .theme-option', attr: 'data-accent-val' },
    { key: 'density', default: 'comfortable', selector: '#density-selector .theme-option', attr: 'data-density-val' },
    { key: 'fontSize', default: 'medium', selector: '#font-selector .theme-option', attr: 'data-font-val' },
    { key: 'animations', default: true, selector: '#animations-selector .theme-option', attr: 'data-animations-val' },
    { key: 'sidebarState', default: 'expanded', selector: '#sidebar-selector .theme-option', attr: 'data-sidebar-val' }
  ];

  configs.forEach(cfg => {
    let currentVal = user[cfg.key] !== undefined ? user[cfg.key] : cfg.default;
    // For boolean animations, convert to string for DOM matching
    if (cfg.key === 'animations') currentVal = String(currentVal);
    
    const btns = document.querySelectorAll(cfg.selector);
    
    // Highlight active
    btns.forEach(btn => {
      if (btn.getAttribute(cfg.attr) === String(currentVal)) {
        btn.classList.add('active');
      }
      
      btn.addEventListener('click', async () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        let newVal = btn.getAttribute(cfg.attr);
        if (cfg.key === 'animations') newVal = (newVal === 'true'); // Convert back to boolean
        
        // Locally apply and save
        user[cfg.key] = newVal;
        auth.save(localStorage.getItem('transitops_token'), user);
        
        // Save to backend
        try {
          const res = await api.updateProfile({ [cfg.key]: newVal });
          if (res && res.data) {
            Object.assign(user, res.data);
            auth.save(localStorage.getItem('transitops_token'), user);
          }
          
          const successMsg = document.getElementById('appearance-success');
          if (successMsg) {
            successMsg.style.display = 'block';
            setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
          }
        } catch (err) {
          console.error(`Failed to save ${cfg.key} to backend`, err);
        }
      });
    });
  });
}

function initPasswordChange() {
  const form = document.getElementById('password-form');
  const errorDiv = document.getElementById('password-error');
  const successDiv = document.getElementById('password-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (newPassword !== confirmPassword) {
      errorDiv.innerText = 'New passwords do not match';
      errorDiv.style.display = 'block';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = 'Updating...';

    try {
      const res = await api.updatePassword({ currentPassword, newPassword });
      
      if (res && res.success) {
        successDiv.innerText = res.message || 'Password successfully updated!';
        successDiv.style.display = 'block';
        if (typeof toast !== 'undefined') {
          toast.success('Password Updated', res.message || 'Password updated successfully');
        }
        form.reset();
      } else {
        errorDiv.innerText = res?.message || 'Failed to update password';
        errorDiv.style.display = 'block';
      }
    } catch (err) {
      errorDiv.innerText = err.message || 'Server error. Please try again later.';
      errorDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Change Password';
    }
  });
}
