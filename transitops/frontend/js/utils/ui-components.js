// ─── Table Builder ──────────────────────────────
class TableBuilder {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.columns = options.columns || [];
    this.data = [];
    this.sortCol = options.defaultSort || null;
    this.sortAsc = true;
    this.onRowClick = options.onRowClick || null;
    this.emptyStateMsg = options.emptyStateMsg || 'No data found';
    this.options = options;
  }

  setData(data) {
    this.data = data;
    this.render();
  }

  sortData(colKey) {
    if (this.sortCol === colKey) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortCol = colKey;
      this.sortAsc = true;
    }
    
    this.data.sort((a, b) => {
      let valA = a[this.sortCol];
      let valB = b[this.sortCol];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
    
    this.render();
  }

  render() {
    if (this.data.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted); opacity: 0.6; margin-bottom: 1.5rem;">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <h3 style="font-weight: 600; color: var(--color-text-primary); margin-bottom: 0.5rem; font-family: var(--font-heading);">${this.emptyStateMsg}</h3>
          <p style="font-size: 0.95rem; color: var(--color-text-muted);">Try adjusting your filters or creating a new record to get started.</p>
        </div>
      `;
      return;
    }

    const tableTitle = this.options.title || 'Data Table';
    let html = `<table class="data-table advanced-table"><caption>${tableTitle}</caption><thead><tr>`;
    
    // Headers
    this.columns.forEach(col => {
      let sortClass = '';
      if (this.sortCol === col.key) {
        sortClass = this.sortAsc ? 'sort-asc' : 'sort-desc';
      }
      html += `<th data-key="${col.key}" class="${sortClass}">${col.label}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // Rows
    this.data.forEach((row, i) => {
      html += `<tr data-index="${i}">`;
      this.columns.forEach(col => {
        let cellData = col.render ? col.render(row) : (row[col.key] || '—');
        html += `<td data-label="${col.label}">${cellData}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    this.container.innerHTML = html;

    // Attach sort listeners
    this.container.querySelectorAll('th').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.getAttribute('data-key');
        if (key) this.sortData(key);
      });
    });

    // Attach row click listeners
    if (this.onRowClick) {
      this.container.querySelectorAll('tbody tr').forEach(tr => {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          const idx = tr.getAttribute('data-index');
          this.onRowClick(this.data[idx]);
        });
      });
    }
  }

  renderSkeleton(rowCount = 5) {
    let rowsHtml = '';
    for (let i = 0; i < rowCount; i++) {
      let cellsHtml = this.columns.map(() => `
        <td><div class="skeleton" style="height: 20px; width: ${Math.floor(Math.random() * 40 + 40)}%; margin: 4px 0;"></div></td>
      `).join('');
      rowsHtml += `<tr>${cellsHtml}</tr>`;
    }

    let theadHtml = this.columns.map(col => `
      <th style="color: transparent;">Loading</th>
    `).join('');

    this.container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="advanced-table">
          <caption>Loading Data...</caption>
          <thead><tr>${theadHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }
}

// ─── Theme Toggle ───────────────────────────────
const themeManager = {
  init() {
    const savedTheme = localStorage.getItem('transitops_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('transitops_theme', next);
    
    // Also save to user preferences if logged in
    if (typeof auth !== 'undefined') {
      const user = auth.getUser();
      if (user) {
        user.theme = next;
        auth.save(localStorage.getItem('transitops_token'), user);
        if (typeof api !== 'undefined' && typeof api.updateProfile === 'function') {
          api.updateProfile({ theme: next }).catch(err => console.error('Failed to sync theme with backend', err));
        }
      }
    }
  }
};

// ─── Command Palette ────────────────────────────
const commandPalette = {
  commands: [
    { name: 'Go to Dashboard', action: () => window.location.href = 'dashboard.html' },
    { name: 'View Trips', action: () => window.location.href = 'trips.html' },
    { name: 'View Vehicles', action: () => window.location.href = 'vehicles.html' },
    { name: 'View Drivers', action: () => window.location.href = 'drivers.html' },
    { name: 'Log Maintenance', action: () => window.location.href = 'maintenance.html' },
    { name: 'Analytics', action: () => window.location.href = 'analytics.html' },
    { name: 'Reports', action: () => window.location.href = 'reports.html' },
    { name: 'Toggle Theme', action: () => themeManager.toggle() },
    { name: 'Sign Out', action: () => auth.logout() }
  ],
  
  init() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.open();
      }
    });
  },
  
  open() {
    if (document.getElementById('cmd-palette-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'cmd-palette-overlay';
    overlay.className = 'cmd-palette-overlay';
    
    overlay.innerHTML = `
      <div class="cmd-palette" id="cmd-palette">
        <input type="text" id="cmd-input" placeholder="Search commands... (e.g., 'Trips', 'Theme')" autocomplete="off">
        <div class="cmd-results" id="cmd-results"></div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    const input = document.getElementById('cmd-input');
    input.focus();
    this.renderResults();
    
    input.addEventListener('input', () => this.renderResults(input.value));
    
    // Close on overlay click or Escape
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });
    document.addEventListener('keydown', this.handleEsc);
  },
  
  close() {
    const overlay = document.getElementById('cmd-palette-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('keydown', this.handleEsc);
  },
  
  handleEsc: (e) => {
    if (e.key === 'Escape') commandPalette.close();
  },
  
  renderResults(query = '') {
    const resultsContainer = document.getElementById('cmd-results');
    const filtered = this.commands.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
    
    if (filtered.length === 0) {
      resultsContainer.innerHTML = '<div class="cmd-item" style="color:var(--color-text-muted);">No commands found</div>';
      return;
    }
    
    resultsContainer.innerHTML = filtered.map((c, i) => `
      <div class="cmd-item" data-index="${i}">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
        ${c.name}
      </div>
    `).join('');
    
    // Attach clicks
    resultsContainer.querySelectorAll('.cmd-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = item.getAttribute('data-index');
        this.close();
        filtered[idx].action();
      });
    });
  }
};



// ─── Breadcrumbs ────────────────────────────────
function renderBreadcrumbs(pathArray) {
  const pageContent = document.querySelector('.page-content');
  if (!pageContent) return;
  
  const bcDiv = document.createElement('div');
  bcDiv.className = 'breadcrumbs';
  
  let html = `<a href="dashboard.html">Home</a>`;
  pathArray.forEach(p => {
    html += `<span class="separator">/</span> <span>${p}</span>`;
  });
  bcDiv.innerHTML = html;
  
  pageContent.prepend(bcDiv);
}

// Auto-initialize Theme and Command Palette
document.addEventListener('DOMContentLoaded', () => {
  themeManager.init();
  commandPalette.init();
});

window.TableBuilder = TableBuilder;
window.renderBreadcrumbs = renderBreadcrumbs;
window.themeManager = themeManager;

// ─── Interactive Onboarding ─────────────────────
const onboarding = {
  STORAGE_KEY: 'transitops_onboarded',

  steps: [
    {
      target: '#sidebar',
      title: '👋 Welcome to TransitOps!',
      text: 'Use this sidebar to navigate between modules — Dashboard, Vehicles, Trips, and more.',
      position: 'right'
    },
    {
      target: '.global-search, #global-search-input',
      title: '🔍 Global Search',
      text: 'Press <kbd style="background:#1e2d4a;padding:2px 6px;border-radius:4px;font-size:0.85em;">/</kbd> from anywhere to search or jump to any page instantly.',
      position: 'bottom'
    },
    {
      target: '#notification-center',
      title: '🔔 Notifications',
      text: 'Real-time alerts for maintenance reminders, completed trips, and system events appear here.',
      position: 'bottom'
    },
    {
      target: '.stat-grid, .stat-card',
      title: '📊 Live KPIs',
      text: 'Your fleet performance at a glance — updated in real time every time you load the Dashboard.',
      position: 'bottom'
    }
  ],

  currentStep: 0,
  overlay: null,
  tooltip: null,

  start() {
    if (localStorage.getItem(this.STORAGE_KEY)) return;
    
    this.currentStep = 0;
    this._injectStyles();
    this._createOverlay();
    this._showStep(0);
  },

  _injectStyles() {
    if (document.getElementById('onboarding-styles')) return;
    const style = document.createElement('style');
    style.id = 'onboarding-styles';
    style.textContent = `
      .onboarding-overlay {
        position: fixed; inset: 0; z-index: 10000; pointer-events: none;
      }
      .onboarding-highlight {
        position: absolute;
        border-radius: 10px;
        box-shadow: 0 0 0 9999px rgba(0,0,0,0.65);
        transition: all 0.4s cubic-bezier(0.16,1,0.3,1);
        pointer-events: none;
        z-index: 10001;
      }
      .onboarding-tooltip {
        position: absolute;
        background: var(--color-bg-card, #1a2236);
        border: 1px solid var(--color-accent-blue, #3b82f6);
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
        max-width: 320px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        z-index: 10002;
        pointer-events: auto;
        animation: tooltipPop 0.3s cubic-bezier(0.16,1,0.3,1);
      }
      @keyframes tooltipPop {
        from { opacity:0; transform: scale(0.9); }
        to { opacity:1; transform: scale(1); }
      }
      .onboarding-title {
        font-family: var(--font-heading, 'Poppins', sans-serif);
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary, #f1f5f9);
        margin-bottom: 0.5rem;
      }
      .onboarding-text {
        font-size: 0.875rem;
        color: var(--color-text-secondary, #94a3b8);
        line-height: 1.6;
        margin-bottom: 1rem;
      }
      .onboarding-footer {
        display: flex; justify-content: space-between; align-items: center;
      }
      .onboarding-dots {
        display: flex; gap: 5px;
      }
      .onboarding-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: var(--color-border, #1e2d4a);
        transition: background 0.2s;
      }
      .onboarding-dot.active { background: var(--color-accent-blue, #3b82f6); }
      .onboarding-actions { display: flex; gap: 0.5rem; }
      .onboarding-skip {
        background: transparent; border: none; color: var(--color-text-muted, #64748b);
        font-size: 0.8rem; cursor: pointer; padding: 6px 10px;
      }
      .onboarding-skip:hover { color: var(--color-text-primary, #f1f5f9); }
      .onboarding-next {
        background: var(--color-accent-blue, #3b82f6); border: none;
        color: white; font-size: 0.85rem; font-weight: 600;
        padding: 8px 18px; border-radius: 8px; cursor: pointer;
        transition: opacity 0.2s;
      }
      .onboarding-next:hover { opacity: 0.85; }
    `;
    document.head.appendChild(style);
  },

  _createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';

    this.highlight = document.createElement('div');
    this.highlight.className = 'onboarding-highlight';

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'onboarding-tooltip';

    this.overlay.appendChild(this.highlight);
    this.overlay.appendChild(this.tooltip);
    document.body.appendChild(this.overlay);
  },

  _showStep(index) {
    const step = this.steps[index];
    if (!step) { this.finish(); return; }

    // Find target element
    let target = null;
    for (const sel of step.target.split(', ')) {
      target = document.querySelector(sel.trim());
      if (target) break;
    }

    // Position highlight
    if (target) {
      const rect = target.getBoundingClientRect();
      const pad = 8;
      this.highlight.style.cssText = `
        position: fixed;
        top: ${rect.top - pad}px;
        left: ${rect.left - pad}px;
        width: ${rect.width + pad * 2}px;
        height: ${rect.height + pad * 2}px;
        border-radius: 10px;
        box-shadow: 0 0 0 9999px rgba(0,0,0,0.65);
        z-index: 10001;
      `;

      // Position tooltip based on step.position
      let tipTop, tipLeft;
      if (step.position === 'right') {
        tipTop = rect.top + 32 + window.scrollY; // slightly down from the top
        tipLeft = rect.right + 16;
      } else {
        // default to bottom
        tipTop = Math.min(rect.bottom + 16, window.innerHeight - 150) + window.scrollY;
        tipLeft = Math.min(rect.left, window.innerWidth - 340);
      }
      
      this.tooltip.style.cssText = `top: ${tipTop}px; left: ${Math.max(8, tipLeft)}px;`;
    } else {
      // Centre tooltip if no target found
      this.highlight.style.cssText = 'display:none;';
      this.tooltip.style.cssText = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
    }

    // Build tooltip content
    const isLast = index === this.steps.length - 1;
    const dots = this.steps.map((_, i) =>
      `<div class="onboarding-dot ${i === index ? 'active' : ''}"></div>`
    ).join('');

    this.tooltip.innerHTML = `
      <div class="onboarding-title">${step.title}</div>
      <div class="onboarding-text">${step.text}</div>
      <div class="onboarding-footer">
        <div class="onboarding-dots">${dots}</div>
        <div class="onboarding-actions">
          <button class="onboarding-skip" id="ob-skip">Skip tour</button>
          <button class="onboarding-next" id="ob-next">${isLast ? '✓ Done' : 'Next →'}</button>
        </div>
      </div>
    `;

    document.getElementById('ob-next').onclick = () => {
      this.currentStep++;
      if (this.currentStep >= this.steps.length) { this.finish(); }
      else { this._showStep(this.currentStep); }
    };
    document.getElementById('ob-skip').onclick = () => this.finish();
    
    // Set focus to Next button for keyboard navigation
    document.getElementById('ob-next').focus();
  },

  finish() {
    localStorage.setItem(this.STORAGE_KEY, '1');
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
};

window.onboarding = onboarding;

// ─── Utility Functions ──────────────────────────
window.togglePasswordVisibility = function(inputId, btnElement) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  if (isPassword) {
    btnElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
  } else {
    btnElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  }
};
