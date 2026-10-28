/**
 * Offline Mode Detection & Notification
 */
window.addEventListener('online', () => {
  appStore.setState({ isOffline: false });
  toast.success('Back Online', 'Network connection restored.');
  // Automatically reload data if possible
  if (typeof loadTrips === 'function') loadTrips();
});

window.addEventListener('offline', () => {
  appStore.setState({ isOffline: true });
  toast.error('You are offline', 'Changes will not be saved until connection is restored.', 'error', 10000);
});
