/**
 * Centralized State Management (Observer Pattern)
 */
class Store {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener); // unsubscribe function
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

const appStore = new Store({
  user: null,
  isOffline: !navigator.onLine,
  activeTripsCount: 0
});

window.appStore = appStore;
