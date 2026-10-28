const Trip = require('../models/Trip');

class TripRepository {
  async findTrips(filter, skip, limit, sort) {
    return await Trip.find(filter)
      .populate('vehicle', 'name registrationNumber vehicleType status')
      .populate('driver', 'name licenseNumber status safetyScore')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async countTrips(filter) {
    return await Trip.countDocuments(filter);
  }

  async findTripById(id) {
    return await Trip.findById(id).populate('vehicle').populate('driver');
  }

  async createTrip(data) {
    return await Trip.create(data);
  }

  async updateTrip(id, data) {
    return await Trip.findByIdAndUpdate(id, data, { new: true, runValidators: true })
      .populate('vehicle')
      .populate('driver');
  }

  async saveTrip(trip) {
    return await trip.save();
  }
}

module.exports = new TripRepository();
