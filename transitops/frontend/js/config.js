/**
 * TransitOps Global Configuration
 */
const config = {
  API_BASE_URL: 'http://localhost:5000/api/v1',
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  APP_VERSION: '1.0.0',
  FEATURES: {
    OFFLINE_MODE: true,
    DARK_MODE: true
  }
};

window.APP_CONFIG = config;
