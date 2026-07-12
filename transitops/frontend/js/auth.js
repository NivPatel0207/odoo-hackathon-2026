/**
 * TransitOps Auth & UI Utility Functions
 */

// ─── Auth ──────────────────────────────────────
const auth = {
  save: (token, user) => {
    localStorage.setItem('transitops_token', token);
    localStorage.setItem('transitops_user', JSON.stringify(user));
  },

  getUser: () => {
    try {
      return JSON.parse(localStorage.getItem('transitops_user'));
    } catch { return null; }
  },

  logout: () => {
    localStorage.removeItem('transitops_token');
    localStorage.removeItem('transitops_user');
    window.location.href = 'index.html';
  },

  requireAuth: () => {
    const token = localStorage.getItem('transitops_token');
    if (!token) {
      window.location.href = 'index.html';
      return null;
    }
    return auth.getUser();
  },

  // Check if user has required role(s)
  can: (...roles) => {
    const user = auth.getUser();
    return user && roles.includes(user.role);
  }
};

// ─── Toast Notifications ───────────────────────
const toast = {
  container: null,

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
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
    `;
    toast.container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'slideInRight 0.25s ease reverse forwards';
      setTimeout(() => el.remove(), 250);
    }, duration);
  },

  success: (msg, sub = '') => toast.show(msg, sub, 'success'),
  error:   (msg, sub = '') => toast.show(msg, sub, 'error'),
  warning: (msg, sub = '') => toast.show(msg, sub, 'warning'),
  info:    (msg, sub = '') => toast.show(msg, sub, 'info')
};

// ─── Loading ───────────────────────────────────
const loading = {
  show: () => {
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

    const navItems = [
      { href: 'dashboard.html', icon: '📊', label: 'Dashboard', page: 'dashboard' },
      { href: 'vehicles.html',  icon: '🚛', label: 'Vehicles',  page: 'vehicles' },
      { href: 'drivers.html',   icon: '👨‍✈️', label: 'Drivers',   page: 'drivers' },
      { href: 'trips.html',     icon: '🗺️', label: 'Trips',     page: 'trips' },
      { href: 'maintenance.html', icon: '🔧', label: 'Maintenance', page: 'maintenance' },
      { href: 'fuel-expense.html', icon: '⛽', label: 'Fuel & Expenses', page: 'fuel-expense' },
      { href: 'reports.html',   icon: '📈', label: 'Reports',   page: 'reports' }
    ];

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
        <div class="logo-icon">🚚</div>
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
        <div class="user-info">
          <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
          <div class="user-details">
            <div class="user-name">${user.name}</div>
            <div class="user-role">${roleLabels[user.role] || user.role}</div>
          </div>
        </div>
        <button id="logout-btn" class="btn btn-ghost w-full" style="font-size:0.8rem;">
          🚪 Sign Out
        </button>
      </div>
    `;

    document.getElementById('logout-btn')?.addEventListener('click', auth.logout);
    
    // Inject mobile hamburger if not exists
    const appHeader = document.querySelector('.app-header');
    if (appHeader && !document.getElementById('mobile-menu-btn')) {
      const btn = document.createElement('button');
      btn.id = 'mobile-menu-btn';
      btn.className = 'mobile-menu-btn';
      btn.innerHTML = '☰';
      btn.onclick = nav.toggleSidebar;
      appHeader.prepend(btn);
    }
  }
};

// ─── Helpers ───────────────────────────────────
const fmt = {
  date: (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  datetime: (d) => d ? new Date(d).toLocaleString('en-IN') : '—',
  currency: (n) => n !== undefined ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—',
  number: (n) => n !== undefined ? Number(n).toLocaleString('en-IN') : '0',
  badge: (status) => `<span class="badge badge-${status}">${status.replace(/_/g, ' ')}</span>`,
  safetyScore: (score) => {
    const cls = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
    return `<div class="score-ring ${cls}">${score}</div>`;
  }
};

// Initialize toast container on load
document.addEventListener('DOMContentLoaded', () => toast.init());
