document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authenticate & Authorize
  const user = auth.requireAuth(['fleet_manager']);
  if (!user) return;

  // 2. Setup UI
  nav.render('team');
  renderBreadcrumbs(['Team Management']);
  
  // 3. Initialize Table
  const table = new TableBuilder('team-table', {
    title: 'Directory Roster',
    defaultSort: 'name',
    emptyState: '<div style="padding: 3rem; text-align: center; color: var(--color-text-muted);">No team members found</div>',
    columns: [
      {
        key: 'name',
        label: 'User',
        render: (u) => {
          // Generate a beautiful, deterministic gradient based on the user's name
          const colors = [
            'linear-gradient(135deg, #6366f1, #8b5cf6)', // Indigo to Purple
            'linear-gradient(135deg, #3b82f6, #06b6d4)', // Blue to Cyan
            'linear-gradient(135deg, #10b981, #3b82f6)', // Emerald to Blue
            'linear-gradient(135deg, #f59e0b, #ef4444)', // Amber to Red
            'linear-gradient(135deg, #ec4899, #8b5cf6)'  // Pink to Purple
          ];
          const charCode = u.name.charCodeAt(0) || 0;
          const bg = colors[charCode % colors.length];

          return `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 0.25rem 0;">
              <div style="width: 42px; height: 42px; border-radius: 12px; background: ${bg}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem; box-shadow: 0 4px 10px rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.15);">
                ${u.name.charAt(0).toUpperCase()}
              </div>
              <div style="display: flex; flex-direction: column; justify-content: center;">
                <div style="font-weight: 600; font-size: 0.95rem; color: var(--color-text-primary); letter-spacing: -0.01em;">${u.name}</div>
                <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-top: 2px;">${u.email}</div>
              </div>
            </div>
          `;
        }
      },
      {
        key: 'role',
        label: 'Role',
        render: (u) => {
          const roleMap = {
            'fleet_manager': 'Fleet Manager',
            'dispatcher': 'Dispatcher',
            'safety_officer': 'Safety Officer',
            'financial_analyst': 'Financial Analyst'
          };
          const label = roleMap[u.role] || u.role;
          
          let color = 'var(--color-primary)';
          if (u.role === 'fleet_manager') color = 'var(--color-danger)';
          if (u.role === 'safety_officer') color = 'var(--color-warning)';
          if (u.role === 'financial_analyst') color = 'var(--color-success)';
          
          return `<span style="padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background: color-mix(in srgb, ${color} 10%, transparent); color: ${color}; border: 1px solid color-mix(in srgb, ${color} 25%, transparent); box-shadow: 0 2px 5px color-mix(in srgb, ${color} 10%, transparent);">${label}</span>`;
        }
      },
      {
        key: 'status',
        label: 'Status',
        render: (u) => {
          // If the user ID or Email matches the currently logged in user, they are "Online".
          const currentUser = (typeof auth !== 'undefined') ? auth.getUser() : null;
          const isOnline = currentUser && (
            currentUser._id === u._id || 
            currentUser.id === u._id || 
            (currentUser.email && u.email && currentUser.email.toLowerCase() === u.email.toLowerCase())
          );
          
          if (isOnline) {
            return `
              <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); font-size: 0.8rem; font-weight: 500;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-success); box-shadow: 0 0 8px var(--color-success);"></span>
                Online
              </div>
            `;
          } else {
            return `
              <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); font-size: 0.8rem; font-weight: 500; color: var(--color-text-muted);">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--color-text-muted);"></span>
                Offline
              </div>
            `;
          }
        }
      },
      {
        key: 'createdAt',
        label: 'Joined',
        render: (u) => `<span style="font-weight: 500; color: var(--color-text-secondary);">${fmt.date(u.createdAt)}</span>`
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (u) => `
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end; padding-right: 1rem;">
            <button class="btn btn-icon" style="width: 32px; height: 32px; padding: 0; border-radius: 8px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); color: var(--color-text-secondary); transition: all 0.2s;" onclick="editUser('${u._id}')" onmouseover="this.style.color='var(--color-primary)'; this.style.borderColor='var(--color-primary)'" onmouseout="this.style.color='var(--color-text-secondary)'; this.style.borderColor='var(--color-border)'" aria-label="Edit">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn btn-icon" style="width: 32px; height: 32px; padding: 0; border-radius: 8px; background: var(--color-bg-tertiary); border: 1px solid var(--color-border); color: var(--color-text-secondary); transition: all 0.2s;" onclick="deleteUser('${u._id}')" onmouseover="this.style.color='var(--color-danger)'; this.style.borderColor='var(--color-danger)'" onmouseout="this.style.color='var(--color-text-secondary)'; this.style.borderColor='var(--color-border)'" aria-label="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        `
      }
    ]
  });

  table.renderSkeleton(4);
  
  // 4. Data Fetching
  let allUsers = [];

  const loadUsers = async () => {
    try {
      const res = await api.getUsers();
      if (res && res.success) {
        allUsers = res.data;
        applyFilters();
      }
    } catch (err) {
      toast.error('Failed to load team data');
    }
  };

  const applyFilters = () => {
    const q = document.getElementById('search-input').value.toLowerCase();
    const r = document.getElementById('filter-role').value;

    const filtered = allUsers.filter(u => {
      const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesRole = !r || u.role === r;
      return matchesSearch && matchesRole;
    });

    table.setData(filtered);
  };

  document.getElementById('search-input').addEventListener('input', debounce(applyFilters, 300));
  document.getElementById('filter-role').addEventListener('change', applyFilters);

  // 5. Modal & Form Logic
  const form = document.getElementById('user-form');
  
  window.openNewUserModal = () => {
    form.reset();
    document.getElementById('u-id').value = '';
    const salaryEl = document.getElementById('u-salary');
    if (salaryEl) salaryEl.value = '';
    const pwdGroup = document.getElementById('pwd-group');
    if (pwdGroup) pwdGroup.style.display = 'block';
    const pwdEl = document.getElementById('u-password');
    if (pwdEl) pwdEl.value = '';
    document.getElementById('user-modal-title').innerText = 'Add Team Member';
    modal.open('user-modal');
  };

  window.editUser = (id) => {
    const u = allUsers.find(x => x._id === id);
    if (!u) return;
    
    document.getElementById('u-id').value = u._id;
    document.getElementById('u-name').value = u.name;
    document.getElementById('u-email').value = u.email;
    document.getElementById('u-role').value = u.role;
    const salaryEl = document.getElementById('u-salary');
    if (salaryEl) salaryEl.value = u.salary || '';
    const pwdGroup = document.getElementById('pwd-group');
    if (pwdGroup) pwdGroup.style.display = 'none';
    
    document.getElementById('user-modal-title').innerText = 'Edit Team Member';
    modal.open('user-modal');
  };

  window.deleteUser = async (id) => {
    // Prevent self-deletion
    if (id === user._id) {
      toast.error('Action Denied', 'You cannot delete your own account.');
      return;
    }
    
    const confirmed = await ui.confirm('Are you sure you want to remove this team member? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await api.deleteUser(id);
      toast.success('Team member removed');
      loadUsers();
    } catch (err) {
      toast.error('Failed to delete team member');
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('u-id').value;
    const salaryVal = document.getElementById('u-salary')?.value;
    const data = {
      name: document.getElementById('u-name').value,
      email: document.getElementById('u-email').value,
      role: document.getElementById('u-role').value,
      salary: salaryVal ? Number(salaryVal) : 0
    };

    try {
      if (id) {
        await api.updateUser(id, data);
        toast.success('Team member updated');
      } else {
        const customPwd = document.getElementById('u-password')?.value?.trim();
        if (customPwd) {
          data.password = customPwd;
        }
        await api.createUser(data);
        const finalPwd = customPwd || 'password123';
        toast.success(`Team member added! Initial password: ${finalPwd}`);
      }
      modal.close('user-modal');
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'Operation failed');
    }
  });

  // Initial load
  await loadUsers();
});
