const NodeCache = require('node-cache');
// Cache for 5 minutes by default
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

const cacheMiddleware = (duration) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Use the URL as the cache key
    const key = req.originalUrl;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    } else {
      // Overwrite res.json to capture the response body and cache it
      const originalJson = res.json;
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            // Safely convert Mongoose documents to plain objects by simulating the JSON serialization process
            const plainBody = JSON.parse(JSON.stringify(body));
            cache.set(key, plainBody, duration || 300);
          } catch (e) {
            console.error('Cache serialization error:', e.message);
          }
        }
        // Call the original res.json
        originalJson.call(res, body);
      };
      next();
    }
  };
};

const clearCache = (prefix) => (req, res, next) => {
  const keys = cache.keys();
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      cache.del(key);
    }
  }
  next();
};

module.exports = { cacheMiddleware, clearCache, cache };
