/**
 * TransitOps API Client
 * Centralized fetch wrapper with JWT token management
 */

const API_BASE = window.APP_CONFIG ? window.APP_CONFIG.API_BASE_URL : 'http://localhost:5000/api/v1';

const api = {
  getToken: () => localStorage.getItem('transitops_token'),

  headers: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${api.getToken()}`
  }),

  activeRequests: new Map(),

  async request(method, endpoint, body = null, retries = (window.APP_CONFIG ? window.APP_CONFIG.MAX_RETRIES : 3)) {
    const options = {
      method,
      headers: api.headers(),
      cache: 'no-store'
    };
    if (body) options.body = JSON.stringify(body);
    
    // Request Deduplication / Abort previous identical requests
    const baseEndpoint = endpoint.split('?')[0];
    const requestKey = `${method}:${baseEndpoint}`;
    if (api.activeRequests.has(requestKey)) {
      api.activeRequests.get(requestKey).abort();
    }
    const controller = new AbortController();
    api.activeRequests.set(requestKey, controller);
    options.signal = controller.signal;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      api.activeRequests.delete(requestKey);
      
      const contentType = res.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}: ${res.statusText || 'Endpoint unavailable'}`);
        }
        data = { success: true, message: text };
      }
      
      if (res.status === 401 && !endpoint.includes('/auth/login')) {
        auth.logout();
        return;
      }
      if (res.status === 403) {
        window.location.href = `error.html?code=403`;
        return;
      }
      if (res.status === 500) {
        if (typeof toast !== 'undefined') toast.error('Server Error', 'An unexpected error occurred. Please try again.');
        throw new Error(data.message || 'Internal Server Error');
      }
      
      if (!res.ok) {
        let errorMsg = data.message || 'Request failed';
        if (data.errors && Array.isArray(data.errors)) {
          // Some validators use 'field', some use 'path'
          const details = data.errors.map(e => `${e.field || e.path}: ${e.message}`).join(' | ');
          errorMsg += ` - ${details}`;
        }
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        
        return null; // Return null for aborted requests to prevent unhandled rejections
      }
      api.activeRequests.delete(requestKey);
      
      if (retries > 0 && method === 'GET') {
        const delay = window.APP_CONFIG ? window.APP_CONFIG.RETRY_DELAY_MS : 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return api.request(method, endpoint, body, retries - 1);
      }
      throw err;
    }
  },

  get:    (endpoint)       => api.request('GET', endpoint),
  post:   (endpoint, body) => api.request('POST', endpoint, body),
  put:    (endpoint, body) => api.request('PUT', endpoint, body),
  delete: (endpoint)       => api.request('DELETE', endpoint),

  // Auth
  login: async (body) => {
    const res = await api.post('/auth/login', body);
    // Normalize backend response: if the user object is in res.data, copy it to res.user
    if (res && res.data && !res.user) res.user = res.data;
    return res;
  },
  register: async (body) => {
    // 1. Call the real backend so we get a REAL valid JWT token
    const res = await api.post('/auth/register', body);
    // Normalize backend response
    if (res && res.data && !res.user) res.user = res.data;
    
    if (res && res.success) {
      // 2. Sync with the frontend mock database so they appear on the Team Management page
      const users = JSON.parse(localStorage.getItem('transitops_users') || '[]');
      
      // Check if user already exists in local mock DB to prevent duplicates
      const exists = users.find(u => u.email === body.email);
      if (!exists) {
        // Use the real backend ID if available, otherwise generate one
        const realId = res.user ? (res.user._id || res.user.id) : ('u_' + Date.now());
        const newUser = { 
          _id: realId, 
          name: body.name, 
          email: body.email, 
          role: body.role, 
          status: 'active', 
          createdAt: new Date().toISOString() 
        };
        users.push(newUser);
        localStorage.setItem('transitops_users', JSON.stringify(users));
        api.logAction(`New user registered: ${body.name}`);
      }
    }
    return res;
  },
  forgotPassword: (body) => api.post('/auth/forgot-password', body),
  resetPassword: (body) => api.post('/auth/reset-password', body),
  me:       ()     => api.get('/auth/me'),
  updateProfile: (body) => api.put('/auth/me', body),
  updatePassword: (body) => api.put('/auth/password', body),

  
  // Users / Team (Admin only)
  getUsers: async () => api.get('/auth/users'),
  createUser: async (body) => api.post('/auth/users', body),
  updateUser: async (id, body) => api.put(`/auth/users/${id}`, body),
  deleteUser: async (id) => api.delete(`/auth/users/${id}`),

  // Payroll & Salary Settlements (Manager & Finance)
  getPayrollSummary: () => api.get('/payroll/summary'),
  getPayrollRoster: () => api.get('/payroll/roster'),
  disbursePayroll: (body) => api.post('/payroll/disburse', body),
  disburseAllPayroll: (body = {}) => api.post('/payroll/disburse-all', body),
  getPayrollHistory: (query = '') => api.get(`/payroll/history${query}`),


  // Vehicles
  getVehicles:    (query = '') => api.get(`/vehicles${query}`),
  getVehicle:     (id)         => api.get(`/vehicles/${id}`),
  createVehicle:  (body)       => api.post('/vehicles', body),
  updateVehicle:  (id, body)   => api.put(`/vehicles/${id}`, body),
  deleteVehicle:  (id)         => api.delete(`/vehicles/${id}`),

  // Drivers
  getDrivers:    (query = '') => api.get(`/drivers${query}`),
  getDriver:     (id)         => api.get(`/drivers/${id}`),
  createDriver:  (body)       => api.post('/drivers', body),
  updateDriver:  (id, body)   => api.put(`/drivers/${id}`, body),
  deleteDriver:  (id)         => api.delete(`/drivers/${id}`),

  // Trips
  getTrips:    (query = '') => api.get(`/trips${query}`),
  getTrip:     (id)         => api.get(`/trips/${id}`),
  createTrip:  (body)       => api.post('/trips', body),
  updateTrip:  (id, body)   => api.put(`/trips/${id}`, body),
  dispatchTrip: (id)        => api.put(`/trips/${id}/dispatch`, {}),
  completeTrip: (id, body)  => api.put(`/trips/${id}/complete`, body),
  cancelTrip:   (id)        => api.put(`/trips/${id}/cancel`, {}),
  rejectTrip:   (id)        => api.put(`/trips/${id}/reject`, {}),
  submitInspection: (id, body) => api.post(`/trips/${id}/inspection`, body),

  // Maintenance
  getMaintenance:    (query = '') => api.get(`/maintenance${query}`),
  createMaintenance: (body)       => api.post('/maintenance', body),
  closeMaintenance:  (id, body)   => api.put(`/maintenance/${id}/close`, body),
  updateMaintenance: (id, body)   => api.put(`/maintenance/${id}`, body),

  // Fuel & Expenses
  getFuelLogs:    (query = '') => api.get(`/fuel-expenses/fuel${query}`),
  createFuelLog:  (body)       => api.post('/fuel-expenses/fuel', body),
  getExpenses:    (query = '') => api.get(`/fuel-expenses/expenses${query}`),
  createExpense:  (body)       => api.post('/fuel-expenses/expenses', body),
  getLiveFuelRates: ()         => api.get('/fuel-expenses/live-rates'),

  // Analytics & Reports
  getDashboardKPIs:        ()      => api.get('/reports/dashboard'),
  getFuelEfficiency:   ()      => api.get('/reports/fuel-efficiency'),
  getOperationalCost:  ()      => api.get('/reports/operational-cost'),
  getDriverPerformance: ()     => api.get('/reports/driver-performance'),
  exportTripsCSV: async () => {
    try {
      const res = await fetch(`${API_BASE}/reports/export/trips`, {
        headers: { 'Authorization': `Bearer ${api.getToken()}` }
      });
      if (!res.ok) {
        let errMsg = 'Failed to export CSV';
        try { const errData = await res.json(); errMsg = errData.message || errMsg; } catch(e) {}
        throw new Error(errMsg);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `trips_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (typeof toast !== 'undefined') toast.error('Export Failed', err.message);
    }
  },

  // Notifications
  getNotifications:    ()      => api.get('/notifications'),
  markNotificationRead: (id)   => api.put(`/notifications/${id}/read`),

  // Planner
  getEvents:     (query = '') => api.get(`/planner${query}`),
  createEvent:   (body)       => api.post('/planner', body),
  updateEvent:   (id, body)   => api.put(`/planner/${id}`, body),
  deleteEvent:   (id)         => api.delete(`/planner/${id}`),

  // Audit Logs
  logAction: (action) => {
    const logs = JSON.parse(localStorage.getItem('transitops_audit_logs') || '[]');
    const user = auth.getUser();
    logs.unshift({
      id: 'log_' + Date.now(),
      action,
      user: user ? user.name : 'System',
      role: user ? user.role : 'system',
      timestamp: new Date().toISOString()
    });
    // Keep last 100 logs
    localStorage.setItem('transitops_audit_logs', JSON.stringify(logs.slice(0, 100)));
  },
  
  getAuditLogs: () => {
    return Promise.resolve({
      success: true,
      data: JSON.parse(localStorage.getItem('transitops_audit_logs') || '[]')
    });
  }
};

window.api = api;

// Initialize or upgrade mock users to match login screen demo credentials
const demoUsers = [
  { _id: 'u_mgr', name: 'Fleet Manager', email: 'manager@transitops.com', role: 'fleet_manager', status: 'active', createdAt: new Date().toISOString() },
  { _id: 'u_disp', name: 'Head Dispatcher', email: 'dispatcher@transitops.com', role: 'dispatcher', status: 'active', createdAt: new Date().toISOString() },
  { _id: 'u_safe', name: 'Safety Officer', email: 'safety@transitops.com', role: 'safety_officer', status: 'active', createdAt: new Date().toISOString() },
  { _id: 'u_fin', name: 'Financial Analyst', email: 'analyst@transitops.com', role: 'financial_analyst', status: 'active', createdAt: new Date().toISOString() }
];

const existingUsers = localStorage.getItem('transitops_users');
// If empty, or if it still has the old 'Alice' dummy data, reset it to match the login page
if (!existingUsers || existingUsers.includes('Alice Admin')) {
  localStorage.setItem('transitops_users', JSON.stringify(demoUsers));
}
