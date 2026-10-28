/**
 * TransitOps Auth & UI Utility Functions
 */

// ─── Auth ──────────────────────────────────────
const auth = {
  save: (token, user) => {
    localStorage.setItem('transitops_token', token);
    localStorage.setItem('transitops_user', JSON.stringify(user));
    auth.applyPreferences(user);
  },

  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('transitops_user'));
    } catch { return null; }
  },

  applyPreferences: (user) => {
    if (!user) return;
    
    // Theme
    const option = user.theme || 'system';
    if (option === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('transitops_theme', 'dark');
    } else if (option === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('transitops_theme', 'light');
    } else {
      // system
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('transitops_theme', 'light');
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('transitops_theme', 'dark');
      }
    }
    
    // Accent Color
    if (user.accentColor) document.documentElement.setAttribute('data-accent', user.accentColor);
    
    // Density
    if (user.density) document.documentElement.setAttribute('data-density', user.density);
    
    // Font Size
    if (user.fontSize) document.documentElement.setAttribute('data-font', user.fontSize);
    
    // Animations
    if (user.animations === false) {
      document.documentElement.setAttribute('data-animations', 'false');
    } else {
      document.documentElement.removeAttribute('data-animations');
    }
    
    // Sidebar State
    if (user.sidebarState === 'collapsed') {
      document.documentElement.setAttribute('data-sidebar', 'collapsed');
    } else {
      document.documentElement.removeAttribute('data-sidebar');
    }
  },

  logout: () => {
    localStorage.removeItem('transitops_token');
    localStorage.removeItem('transitops_user');
    window.location.href = 'index.html';
  },

  redirectHome: (role) => {
    if (role === 'driver') return 'driver-dashboard.html';
    if (role === 'dispatcher') return 'trips.html';
    if (role === 'safety_officer') return 'drivers.html';
    if (role === 'fleet_manager' || role === 'financial_analyst') return 'dashboard.html';
    return 'vehicles.html'; // Default for viewer or unknown
  },

  requireAuth: (allowedRoles = []) => {
    const token = localStorage.getItem('transitops_token');
    const user = auth.getUser();

    if (!token || !user) {
      window.location.href = 'index.html';
      return null;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      if (typeof toast !== 'undefined') toast.error('Access Denied', 'You do not have permission to view this page.');
      setTimeout(() => { window.location.href = auth.redirectHome(user.role); }, 1500);
      return null;
    }

    if (typeof appStore !== 'undefined') {
      appStore.setState({ user });
    }

    // Apply preferences immediately on every page load
    auth.applyPreferences(user);
    auth.initSessionTimeout();

    return user;
  },

  can: (...roles) => {
    const user = auth.getUser();
    return user && roles.includes(user.role);
  },

  initSessionTimeout: () => {
    // 15 minute idle timeout
    const TIMEOUT_MS = 15 * 60 * 1000; 
    let idleTimer;

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (typeof toast !== 'undefined') toast.error('Session Expired', 'You have been logged out due to inactivity.');
        setTimeout(() => auth.logout(), 2000);
      }, TIMEOUT_MS);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('scroll', resetTimer);
    resetTimer();
  }
};

// Immediately apply user preferences on script load
try {
  const currentSavedUser = auth.getUser();
  if (currentSavedUser) {
    auth.applyPreferences(currentSavedUser);
  } else {
    const savedTheme = localStorage.getItem('transitops_theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }
} catch (e) {}

// ─── Toast Notifications ───────────────────────
const toast = {
  init: () => {
    if (!document.getElementById('toast-container')) {
      const el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
    }
    toast.container = document.getElementById('toast-container');
  },

  show: (title, message = '', type = 'info', duration = 4000) => {
    if (!toast.container) toast.init();

    const svgs = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <div class="toast-icon">${svgs[type] || svgs.info}</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <div class="toast-progress">
        <div class="toast-progress-bar" style="animation-duration: ${duration}ms"></div>
      </div>
    `;

    toast.container.appendChild(el);

    setTimeout(() => {
      el.classList.add('toast-closing');
      setTimeout(() => el.remove(), 300);
    }, duration);
  },

  success: (msg, sub = '') => toast.show(msg, sub, 'success'),
  error: (msg, sub = '') => toast.show(msg, sub, 'error'),
  warning: (msg, sub = '') => toast.show(msg, sub, 'warning'),
  info: (msg, sub = '') => toast.show(msg, sub, 'info')
};

document.addEventListener('DOMContentLoaded', () => {
  toast.init();
});

// ─── Loading ───────────────────────────────────
const loading = {
  show: (containerId = null) => {
    if (containerId && document.getElementById(containerId)) {
      const el = document.getElementById(containerId);
      el.innerHTML = `
        <div class="skeleton-table w-full p-4">
          <div class="animate-pulse flex space-x-4 mb-4">
            <div class="flex-1 space-y-4 py-1">
              <div class="h-4 bg-slate-700 rounded w-3/4"></div>
              <div class="space-y-2">
                <div class="h-4 bg-slate-700 rounded"></div>
                <div class="h-4 bg-slate-700 rounded w-5/6"></div>
              </div>
            </div>
          </div>
          <div class="animate-pulse flex space-x-4">
            <div class="flex-1 space-y-4 py-1">
              <div class="h-4 bg-slate-700 rounded w-3/4"></div>
              <div class="space-y-2">
                <div class="h-4 bg-slate-700 rounded"></div>
                <div class="h-4 bg-slate-700 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    let el = document.getElementById('loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.className = 'loading-overlay';
      el.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(el);
    }
    el.classList.remove('hidden');
  },
  hide: () => {
    const el = document.getElementById('loading-overlay');
    if (el) el.classList.add('hidden');
  }
};

// ─── Modal ─────────────────────────────────────
const modal = {
  open: (id) => {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); }
  },
  close: (id) => {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); }
  },
  closeAll: () => {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
  }
};

// ─── UI Utilities ──────────────────────────────
const ui = {
  confirm: (message) => {
    return new Promise((resolve) => {
      let modalEl = document.getElementById('custom-confirm-modal');
      if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'custom-confirm-modal';
        modalEl.className = 'modal-backdrop';
        modalEl.innerHTML = `
          <div class="modal-content" style="max-width: 400px; text-align: center;">
            <h3 class="modal-title" style="margin-bottom: 1rem;">Confirm Action</h3>
            <p id="custom-confirm-msg" class="mb-5" style="color: var(--color-text-muted);"></p>
            <div class="flex gap-3 justify-center">
              <button class="btn btn-secondary" id="custom-confirm-cancel">Cancel</button>
              <button class="btn btn-primary" id="custom-confirm-ok">OK</button>
            </div>
          </div>
        `;
        document.body.appendChild(modalEl);
      }

      document.getElementById('custom-confirm-msg').innerText = message;
      modalEl.classList.remove('hidden');

      const onCancel = () => { cleanup(); resolve(false); };
      const onOk = () => { cleanup(); resolve(true); };

      document.getElementById('custom-confirm-cancel').onclick = onCancel;
      document.getElementById('custom-confirm-ok').onclick = onOk;

      const cleanup = () => {
        modalEl.classList.add('hidden');
      };
    });
  },
  alert: (title, message) => {
    return new Promise((resolve) => {
      let modalEl = document.getElementById('custom-alert-modal');
      if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'custom-alert-modal';
        modalEl.className = 'modal-backdrop';
        modalEl.innerHTML = `
          <div class="modal-content" style="max-width: 400px; text-align: center;">
            <h3 id="custom-alert-title" class="modal-title" style="margin-bottom: 1rem; color: var(--color-danger);"></h3>
            <p id="custom-alert-msg" class="mb-5" style="color: var(--color-text-muted);"></p>
            <div class="flex justify-center">
              <button class="btn btn-primary" id="custom-alert-ok">Understood</button>
            </div>
          </div>
        `;
        document.body.appendChild(modalEl);
      }

      document.getElementById('custom-alert-title').innerText = title;
      document.getElementById('custom-alert-msg').innerText = message;
      modalEl.classList.remove('hidden');

      const onOk = () => { 
        modalEl.classList.add('hidden'); 
        resolve(true); 
      };

      document.getElementById('custom-alert-ok').onclick = onOk;
    });
  }
};

// ─── Sidebar Rendering ─────────────────────────
const nav = {
  toggleSidebar: () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  },
  render: (activePage) => {
    const user = auth.getUser();
    if (!user) return;

    const allNavItems = [
      // Admin / Dispatcher Pages
      { href: 'dashboard.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>', label: 'Dashboard', page: 'dashboard', roles: ['fleet_manager', 'safety_officer', 'financial_analyst', 'dispatcher'] },
      { href: 'planner.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>', label: 'Planner', page: 'planner', roles: ['fleet_manager', 'safety_officer', 'dispatcher', 'financial_analyst', 'viewer'] },
      { href: 'team.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>', label: 'Team', page: 'team', roles: ['fleet_manager'] },
      { href: 'tracking.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>', label: 'Live Tracking', page: 'tracking', roles: ['fleet_manager', 'dispatcher', 'safety_officer'] },
      { href: 'vehicles.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>', label: 'Vehicles', page: 'vehicles', roles: ['fleet_manager', 'safety_officer', 'dispatcher', 'financial_analyst'] },
      { href: 'drivers.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>', label: 'Drivers', page: 'drivers', roles: ['fleet_manager', 'safety_officer', 'dispatcher', 'financial_analyst'] },
      { href: 'driver-hub.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Driver Hub (ELD)', page: 'driver-hub', roles: ['safety_officer', 'dispatcher', 'financial_analyst'] },
      { href: 'trips.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>', label: 'Trips', page: 'trips', roles: ['fleet_manager', 'dispatcher', 'financial_analyst', 'safety_officer'] },
      { href: 'dispatch.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>', label: 'Dispatch Board', page: 'dispatch', roles: ['fleet_manager', 'dispatcher'] },
      { href: 'maintenance.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>', label: 'Maintenance', page: 'maintenance', roles: ['fleet_manager', 'financial_analyst'] },
      { href: 'fuel-expense.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>', label: 'Fuel & Expenses', page: 'fuel-expense', roles: ['fleet_manager', 'financial_analyst'] },
      { href: 'payroll.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Payroll & Salaries', page: 'payroll', roles: ['fleet_manager', 'financial_analyst'] },
      { href: 'reports.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>', label: 'Reports', page: 'reports', roles: ['fleet_manager', 'financial_analyst'] },
      { href: 'analytics.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"></path></svg>', label: 'Analytics', page: 'analytics', roles: ['fleet_manager', 'financial_analyst'] },
      { href: 'audit-logs.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>', label: 'Audit Logs', page: 'audit-logs', roles: ['fleet_manager'] },
      
      // Driver Portal Pages
      { href: 'driver-dashboard.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>', label: 'Dashboard', page: 'driver-dashboard', roles: ['driver'] },
      { href: 'driver-trips.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>', label: 'My Trips', page: 'driver-trips', roles: ['driver'] },
      { href: 'driver-tracking.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>', label: 'Navigation / Tracking', page: 'driver-tracking', roles: ['driver'] },
      { href: 'driver-duty.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Duty & Hours', page: 'driver-duty', roles: ['driver'] },
      { href: 'driver-vehicle.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>', label: 'My Vehicle', page: 'driver-vehicle', roles: ['driver'] },
      { href: 'driver-deliveries.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>', label: 'Deliveries', page: 'driver-deliveries', roles: ['driver'] },
      { href: 'driver-expenses.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>', label: 'Fuel & Expenses', page: 'driver-expenses', roles: ['driver'] },
      { href: 'driver-incidents.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>', label: 'Incidents', page: 'driver-incidents', roles: ['driver'] },
      { href: 'driver-documents.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>', label: 'Documents', page: 'driver-documents', roles: ['driver'] },
      { href: 'driver-earnings.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Earnings', page: 'driver-earnings', roles: ['driver'] },
      { href: 'driver-performance.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>', label: 'Performance', page: 'driver-performance', roles: ['driver'] },
      { href: 'driver-profile.html', icon: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>', label: 'My Profile', page: 'driver-profile', roles: ['driver'] }
    ];

    const navItems = allNavItems.filter(item => item.roles.includes(user.role));

    if (user.role !== 'fleet_manager' && user.role !== 'financial_analyst') {
      const dbIdx = navItems.findIndex(i => i.page === 'dashboard');
      if (dbIdx !== -1) navItems.splice(dbIdx, 1);

      const rptIdx = navItems.findIndex(i => i.page === 'reports');
      if (rptIdx !== -1) navItems.splice(rptIdx, 1);
    }

    const roleLabels = {
      fleet_manager: 'Fleet Manager',
      dispatcher: 'Dispatcher',
      safety_officer: 'Safety Officer',
      financial_analyst: 'Financial Analyst'
    };

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = `
      <div class="sidebar-logo">
        <div class="logo-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg></div>
        <div class="logo-text">Transit<span>Ops</span></div>
        <button class="mobile-close-btn" onclick="nav.toggleSidebar()" style="display:none;">✕</button>
      </div>
      <nav class="sidebar-nav">
        <div class="nav-section-label">Navigation</div>
        ${navItems.map(item => `
          <a href="${item.href}" class="nav-item ${activePage === item.page ? 'active' : ''}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>
      <div class="sidebar-footer">
        <div class="user-info" style="cursor:pointer;" onclick="window.location.href='profile.html'">
          <div class="user-avatar" style="${user.profilePhoto ? `background-image: url(${user.profilePhoto}); background-size: cover; background-position: center; color: transparent;` : ''}">${user.profilePhoto ? '' : user.name.charAt(0).toUpperCase()}</div>
          <div class="user-details">
            <div class="user-name">${user.name}</div>
            <div class="user-role">${roleLabels[user.role] || user.role}</div>
          </div>
        </div>
        <button id="settings-btn" class="btn btn-ghost w-full sidebar-action-btn">
          <svg class="sidebar-action-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> <span class="sidebar-text">Settings</span>
        </button>
        <button id="logout-btn" class="btn btn-ghost w-full sidebar-action-btn">
          <span class="sidebar-action-icon">🚪</span> <span class="sidebar-text">Sign Out</span>
        </button>
      </div>
    `;

    document.getElementById('logout-btn')?.addEventListener('click', auth.logout);
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });

    // Inject mobile hamburger if not exists
    const appHeader = document.querySelector('.app-header');
    if (appHeader && !document.getElementById('mobile-menu-btn')) {
      const btn = document.createElement('button');
      btn.id = 'mobile-menu-btn';
      btn.className = 'mobile-menu-btn';
      btn.setAttribute('aria-label', 'Toggle navigation menu');
      btn.innerHTML = '☰';
      btn.onclick = nav.toggleSidebar;
      appHeader.prepend(btn);
    }

    if (appHeader && !document.getElementById('notification-center')) {
      const notifBtn = document.createElement('div');
      notifBtn.id = 'notification-center';
      notifBtn.className = 'notification-center';
      notifBtn.style.cssText = 'position:relative;cursor:pointer;margin-left:auto;margin-right:1rem;display:flex;align-items:center;';

      // Basic structure
      notifBtn.setAttribute('aria-label', 'View notifications');
      notifBtn.setAttribute('role', 'button');
      notifBtn.setAttribute('tabindex', '0');
      notifBtn.innerHTML = `
        <span style="font-size:1.5rem;" aria-hidden="true">🔔</span>
        <span id="notif-badge" aria-label="unread notifications" style="position:absolute;top:-5px;right:-5px;background:var(--color-danger);color:white;border-radius:50%;width:18px;height:18px;font-size:0.75rem;display:none;align-items:center;justify-content:center;font-weight:bold;">0</span>
        <div id="notif-dropdown" style="display:none;position:absolute;top:40px;right:0;width:300px;background:var(--color-bg-secondary);border:1px solid var(--color-border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:100;flex-direction:column;padding:10px;gap:8px;">
          <div style="font-weight:bold;padding-bottom:5px;border-bottom:1px solid var(--color-border);color:var(--color-text-primary);">Notifications</div>
          <div id="notif-list" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;"></div>
        </div>
      `;

      notifBtn.onclick = function (e) {
        const dropdown = document.getElementById('notif-dropdown');
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
        e.stopPropagation();
      };
      document.addEventListener('click', () => {
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) dropdown.style.display = 'none';
      });

      const headerActions = appHeader.querySelector('.flex.gap-3') || appHeader.querySelector('.header-actions');
      if (headerActions) {
        headerActions.parentNode.insertBefore(notifBtn, headerActions);
      } else {
        appHeader.appendChild(notifBtn);
      }

      // Fetch notifications with live polling
      try {
        const list = notifBtn.querySelector('#notif-list');
        if (list) {
          list.innerHTML = '<div style="color:white;background:blue;padding:10px;text-align:center;font-weight:bold;font-size:16px;">Loading API...</div>';
          
          let lastNotifIds = new Set();
          
          const fetchNotifs = async () => {
            if (window.api && window.api.getNotifications) {
              try {
                const res = await api.getNotifications();
                if (!res || !res.success) return;
                
                const unread = res.data.filter(n => !n.read);
                const badge = notifBtn.querySelector('#notif-badge');
                if (badge) {
                  badge.textContent = unread.length;
                  badge.style.display = unread.length > 0 ? 'flex' : 'none';
                }
                
                // Trigger live toasts for completely new unread notifications
                if (lastNotifIds.size > 0) {
                  const newUnread = unread.filter(n => !lastNotifIds.has(n._id));
                  newUnread.forEach(n => {
                    toast.show(n.title, n.message, n.type || 'info');
                  });
                }
                
                // Update tracker
                res.data.forEach(n => lastNotifIds.add(n._id));
                
                if (res.data.length === 0) {
                  list.innerHTML = '<div style="color:var(--color-text-muted);padding:10px;text-align:center;font-size:14px;">No notifications found</div>';
                  return;
                }
                
                list.innerHTML = res.data.map(n => `
                  <div style="font-size:14px;color:${n.read ? 'var(--color-text-primary)' : 'white'};padding:10px;margin-bottom:5px;border-radius:4px;background:${n.read ? 'var(--color-bg-tertiary)' : 'var(--color-primary)'};border-left:4px solid ${n.type === 'warning' ? 'orange' : n.type === 'error' ? 'red' : 'var(--color-success)'};cursor:pointer;" onclick="markNotifRead('${n._id}', this)">
                    <strong>${n.title || 'Notification'}</strong><br>
                    ${n.message}
                  </div>
                `).join('');
              } catch (err) { }
            }
          };
          
          fetchNotifs();
          if (window._notifInterval) clearInterval(window._notifInterval);
          window._notifInterval = setInterval(fetchNotifs, 5000); // Poll every 5s for live feel
        }
      } catch (e) {
        const list = notifBtn.querySelector('#notif-list');
        if (list) list.innerHTML = `<div style="color:white;background:red;padding:10px;">Sync JS Error: ${e.message}</div>`;
      }
    }
  }
};

window.markNotifRead = async (id, el) => {
  try {
    await api.markNotificationRead(id);
    el.style.background = 'transparent';
    const badge = document.getElementById('notif-badge');
    let count = parseInt(badge.textContent);
    if (count > 0) {
      count--;
      badge.textContent = count;
      if (count === 0) badge.style.display = 'none';
    }
  } catch (e) { }
};

// ─── Helpers ───────────────────────────────────
const fmt = {
  date: (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  datetime: (d) => d ? new Date(d).toLocaleString('en-IN') : '—',
  currency: (n) => n !== undefined ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
  number: (n) => n !== undefined ? Number(n).toLocaleString('en-IN') : '0',
  badge: (status) => {
    if (!status) return '';
    let icon = '';
    const s = status.toLowerCase();
    if (['completed', 'available', 'verified', 'closed', 'success'].includes(s)) icon = '✓ ';
    else if (['cancelled', 'suspended', 'urgent', 'error'].includes(s)) icon = '✗ ';
    else if (['in_shop', 'open', 'delayed', 'warning'].includes(s)) icon = '⚠ ';
    else if (['on_trip', 'dispatched'].includes(s)) icon = '▶ ';
    else icon = '• ';
    return `<span class="badge badge-${status}" aria-label="Status: ${status}">${icon}${status.replace(/_/g, ' ')}</span>`;
  },
  safetyScore: (score) => {
    const cls = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
    return `<div class="score-ring ${cls}">${score}</div>`;
  },
  mask: (str, visibleChars = 4) => {
    if (!str) return '—';
    if (!auth.can('fleet_manager', 'safety_officer', 'financial_analyst')) {
      if (str.length <= visibleChars) return '*'.repeat(str.length);
      return '*'.repeat(str.length - visibleChars) + str.slice(-visibleChars);
    }
    return str; // Full visibility for admins
  }
};

// Initialize toast container on load
document.addEventListener('DOMContentLoaded', () => toast.init());