// driver-notifications.js

document.addEventListener('DOMContentLoaded', async () => {
  auth.requireAuth(['driver']);
  nav.render('driver-notifications');
  
  await loadNotifications();
});

async function loadNotifications() {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    loading.show();
    const res = await api.get(`/notifications`);
    if (res.success) {
      renderNotifications(res.data);
    }
  } catch (err) {
    toast.error('Failed to load notifications', err.message);
  } finally {
    loading.hide();
  }
}

function getIconForType(type) {
  switch(type) {
    case 'error':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    case 'warning':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
    case 'success':
      return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    default:
      return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }
}

function renderNotifications(notifications) {
  const list = document.getElementById('notification-list');
  
  if (!notifications || notifications.length === 0) {
    list.innerHTML = '<div style="text-align: center; color: var(--color-text-muted); padding: 40px;">No notifications found. You\'re all caught up!</div>';
    return;
  }
  
  list.innerHTML = notifications.map(n => {
    const time = new Date(n.createdAt).toLocaleString();
    const unreadClass = n.read ? '' : 'unread';
    const btnHtml = n.read ? '' : `<button class="btn-read" onclick="markRead('${n._id}')">Mark as Read</button>`;
    
    // Convert newlines in message to <br> for proper rendering of incident payloads
    const formattedMessage = n.message ? n.message.replace(/\n/g, '<br>') : '';
    
    return `
      <div class="notification-item ${unreadClass}" id="notif-${n._id}">
        <div class="unread-dot"></div>
        <div class="notification-icon type-${n.type || 'info'}">
          ${getIconForType(n.type)}
        </div>
        <div class="notification-content">
          <div class="notification-header">
            <div class="notification-title">${n.title}</div>
            <div class="notification-time">${time}</div>
          </div>
          <div class="notification-body">
            ${formattedMessage}
          </div>
          ${btnHtml}
        </div>
      </div>
    `;
  }).join('');
}

async function markRead(notificationId) {
  const user = auth.getUser();
  if (!user || !user.driverProfileId) return;
  
  try {
    const res = await api.put(`/notifications/${notificationId}/read`);
    if (res.success) {
      const el = document.getElementById(`notif-${notificationId}`);
      if (el) {
        el.classList.remove('unread');
        const btn = el.querySelector('.btn-read');
        if (btn) btn.remove();
      }
    }
  } catch (err) {
    toast.error('Failed to mark read', err.message);
  }
}
