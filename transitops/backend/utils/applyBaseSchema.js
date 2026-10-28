const mongooseDelete = require('mongoose-delete');
const { updateIfCurrentPlugin } = require('mongoose-update-if-current');
const mongoose = require('mongoose');

/**
 * Applies enterprise standards to a Mongoose Schema:
 * 1. Soft Delete plugin (adds `deleted`, `deletedAt`, `deletedBy`)
 * 2. Optimistic Locking plugin (handles concurrent updates with `__v`)
 * 3. Base Fields (`createdBy`, `updatedBy`)
 */
const applyBaseSchema = (schema) => {
  // Base Fields
  schema.add({
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  });

  // Soft Delete
  schema.plugin(mongooseDelete, { 
    deletedAt: true, 
    deletedBy: true, 
    overrideMethods: 'all' 
  });

  // Optimistic Concurrency Control
  schema.plugin(updateIfCurrentPlugin);

  // Indexes on timestamps (for frequently queried fields)
  schema.index({ createdAt: -1 });
  schema.index({ updatedAt: -1 });

  return schema;
};

module.exports = applyBaseSchema;
