document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth(['fleet_manager'])) return;
  nav.render('audit-logs');
  renderBreadcrumbs(['Audit Logs']);
  
  loadAuditLogs();
});

async function loadAuditLogs() {
  const container = document.getElementById('audit-table');
  if (!container) return;
  
  try {
    const res = await api.getAuditLogs();
    
    if (res.data && res.data.length > 0) {
      container.innerHTML = `
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>User</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${res.data.map(log => `
            <tr>
              <td><div class="sub-text">${fmt.datetime(log.timestamp)}</div></td>
              <td><div class="primary-text">${log.user}</div></td>
              <td style="text-transform: capitalize;"><div class="badge badge-assigned">${log.role.replace('_', ' ')}</div></td>
              <td><div class="primary-text">${log.action}</div></td>
            </tr>
          `).join('')}
        </tbody>
      `;
    } else {
      container.innerHTML = `
        <tbody>
          <tr><td colspan="4" class="text-center text-muted py-8">No security logs found.</td></tr>
        </tbody>
      `;
    }
  } catch (err) {
    console.error('Failed to load audit logs', err);
    if(typeof toast !== 'undefined') toast.error('Error', 'Failed to load audit logs.');
  }
}

window.loadAuditLogs = loadAuditLogs;
