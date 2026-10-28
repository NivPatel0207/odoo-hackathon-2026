const validate = (schema) => (req, res, next) => {
  try {
    const validatedData = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    
    // Inject validated data back into the request
    req.body = validatedData.body;
    req.query = validatedData.query;
    req.params = validatedData.params;
    
    next();
  } catch (err) {
    if (err.name === 'ZodError') {
      const errors = err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message
      }));
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    next(err);
  }
};

module.exports = validate;
