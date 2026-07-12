/**
 * TransitOps API Client
 * Centralized fetch wrapper with JWT token management
 */

const API_BASE = 'http://localhost:5000/api';

const api = {
  getToken: () => localStorage.getItem('transitops_token'),

  headers: () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${api.getToken()}`
  }),

  async request(method, endpoint, body = null) {
    const options = {
      method,
      headers: api.headers()
    };
    if (body) options.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, options);
      const data = await res.json();
      if (res.status === 401) {
        auth.logout();
        return;
      }
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    } catch (err) {
      throw err;
    }
  },

  get:    (endpoint)       => api.request('GET', endpoint),
  post:   (endpoint, body) => api.request('POST', endpoint, body),
  put:    (endpoint, body) => api.request('PUT', endpoint, body),
  delete: (endpoint)       => api.request('DELETE', endpoint),

  // Auth
  login:    (body) => api.post('/auth/login', body),
  register: (body) => api.post('/auth/register', body),
  me:       ()     => api.get('/auth/me'),

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

  // Reports
  getDashboard:        ()      => api.get('/reports/dashboard'),
  getFuelEfficiency:   ()      => api.get('/reports/fuel-efficiency'),
  getOperationalCost:  ()      => api.get('/reports/operational-cost'),
  exportTripsCSV: () => `${API_BASE}/reports/export/trips?token=${api.getToken()}`
};
