class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async create(data) {
    return await this.model.create(data);
  }

  async findById(id) {
    return await this.model.findById(id);
  }

  async findAll(filter = {}, options = {}) {
    let query = this.model.find(filter);
    
    // Pagination & Sorting logic
    if (options.sort) query = query.sort(options.sort);
    if (options.limit) {
      const page = options.page || 1;
      query = query.skip((page - 1) * options.limit).limit(options.limit);
    }
    
    return await query;
  }

  async update(id, data) {
    return await this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  }

  async delete(id) {
    return await this.model.findByIdAndDelete(id);
  }

  async count(filter = {}) {
    return await this.model.countDocuments(filter);
  }
}

module.exports = BaseRepository;
