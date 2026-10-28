class BaseService {
  constructor(repository) {
    this.repository = repository;
  }

  async create(data) {
    return await this.repository.create(data);
  }

  async getById(id) {
    const item = await this.repository.findById(id);
    if (!item) throw new Error('Resource not found');
    return item;
  }

  async getAll(query = {}) {
    // Extract pagination and sorting from query
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const sort = query.sort || '-createdAt';
    
    // Build filter (excluding pagination/sort fields)
    const filter = { ...query };
    delete filter.page;
    delete filter.limit;
    delete filter.sort;

    // Execute with pagination
    const data = await this.repository.findAll(filter, { page, limit, sort });
    const total = await this.repository.count(filter);
    
    return {
      data,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async update(id, data) {
    const updated = await this.repository.update(id, data);
    if (!updated) throw new Error('Resource not found');
    return updated;
  }

  async delete(id) {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new Error('Resource not found');
    return deleted;
  }
}

module.exports = BaseService;
