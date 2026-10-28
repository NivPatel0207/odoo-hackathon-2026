/**
 * Frontend Constants
 */

const CONSTANTS = {
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    DEFAULT_PAGE: 1
  },
  ROLES: {
    MANAGER: 'fleet_manager',
    DISPATCHER: 'dispatcher',
    SAFETY: 'safety_officer',
    FINANCE: 'financial_analyst'
  },
  TOAST_DURATION: 4000
};

if (typeof window !== 'undefined') {
  window.CONSTANTS = CONSTANTS;
}
