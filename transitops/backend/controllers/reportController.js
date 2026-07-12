const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const FuelLog = require('../models/FuelLog');
const Expense = require('../models/Expense');
const Maintenance = require('../models/Maintenance');
const { exportToCsv } = require('../utils/csvExport');

// @desc    Get dashboard KPIs
// @route   GET /api/reports/dashboard
// @access  Private (all roles)
const getDashboardKPIs = async (req, res, next) => {
  try {
    const [
      totalVehicles,
      availableVehicles,
      onTripVehicles,
      inShopVehicles,
      retiredVehicles,
      totalDrivers,
      availableDrivers,
      suspendedDrivers,
      totalTrips,
      completedTrips,
      dispatchedTrips,
      cancelledTrips,
      openMaintenance
    ] = await Promise.all([
      Vehicle.countDocuments(),
      Vehicle.countDocuments({ status: 'available' }),
      Vehicle.countDocuments({ status: 'on_trip' }),
      Vehicle.countDocuments({ status: 'in_shop' }),
      Vehicle.countDocuments({ status: 'retired' }),
      Driver.countDocuments(),
      Driver.countDocuments({ status: 'available' }),
      Driver.countDocuments({ status: 'suspended' }),
      Trip.countDocuments(),
      Trip.countDocuments({ status: 'completed' }),
      Trip.countDocuments({ status: 'dispatched' }),
      Trip.countDocuments({ status: 'cancelled' }),
      Maintenance.countDocuments({ status: 'open' })
    ]);

    // Financial KPIs
    const revenueAgg = await Trip.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$revenue' }, totalDistance: { $sum: '$actualDistance' }, totalFuel: { $sum: '$fuelConsumed' } } }
    ]);
    const fuelCostAgg = await FuelLog.aggregate([
      { $group: { _id: null, totalFuelCost: { $sum: '$cost' } } }
    ]);
    const expenseCostAgg = await Expense.aggregate([
      { $group: { _id: null, totalExpenses: { $sum: '$amount' } } }
    ]);
    const maintenanceCostAgg = await Maintenance.aggregate([
      { $match: { status: 'closed' } },
      { $group: { _id: null, totalMaintCost: { $sum: '$cost' } } }
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalDistance = revenueAgg[0]?.totalDistance || 0;
    const totalFuelLiters = revenueAgg[0]?.totalFuel || 0;
    const totalFuelCost = fuelCostAgg[0]?.totalFuelCost || 0;
    const totalExpenses = expenseCostAgg[0]?.totalExpenses || 0;
    const totalMaintCost = maintenanceCostAgg[0]?.totalMaintCost || 0;
    const totalCosts = totalFuelCost + totalExpenses + totalMaintCost;
    const netProfit = totalRevenue - totalCosts;
    const fuelEfficiency = totalDistance > 0 && totalFuelLiters > 0 ? (totalDistance / totalFuelLiters).toFixed(2) : 0;
    const roi = totalCosts > 0 ? (((totalRevenue - totalCosts) / totalCosts) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        vehicles: { total: totalVehicles, available: availableVehicles, onTrip: onTripVehicles, inShop: inShopVehicles, retired: retiredVehicles },
        drivers: { total: totalDrivers, available: availableDrivers, suspended: suspendedDrivers },
        trips: { total: totalTrips, completed: completedTrips, dispatched: dispatchedTrips, cancelled: cancelledTrips },
        maintenance: { open: openMaintenance },
        financial: {
          totalRevenue: totalRevenue.toFixed(2),
          totalFuelCost: totalFuelCost.toFixed(2),
          totalExpenses: totalExpenses.toFixed(2),
          totalMaintenanceCost: totalMaintCost.toFixed(2),
          totalCosts: totalCosts.toFixed(2),
          netProfit: netProfit.toFixed(2),
          fuelEfficiencyKmPerL: parseFloat(fuelEfficiency),
          roi: parseFloat(roi)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get fuel efficiency report
// @route   GET /api/reports/fuel-efficiency
// @access  Private (all roles)
const getFuelEfficiencyReport = async (req, res, next) => {
  try {
    const report = await Trip.aggregate([
      { $match: { status: 'completed', actualDistance: { $gt: 0 }, fuelConsumed: { $gt: 0 } } },
      { $lookup: { from: 'vehicles', localField: 'vehicle', foreignField: '_id', as: 'vehicle' } },
      { $unwind: '$vehicle' },
      {
        $group: {
          _id: '$vehicle._id',
          vehicleName: { $first: '$vehicle.name' },
          regNumber: { $first: '$vehicle.registrationNumber' },
          totalDistance: { $sum: '$actualDistance' },
          totalFuel: { $sum: '$fuelConsumed' },
          tripCount: { $sum: 1 }
        }
      },
      { $addFields: { kmPerLiter: { $divide: ['$totalDistance', '$totalFuel'] } } },
      { $sort: { kmPerLiter: -1 } }
    ]);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// @desc    Get operational cost report
// @route   GET /api/reports/operational-cost
// @access  Private (all roles)
const getOperationalCostReport = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({}, 'name registrationNumber acquisitionCost');
    const report = await Promise.all(vehicles.map(async (v) => {
      const fuelCostAgg = await FuelLog.aggregate([{ $match: { vehicle: v._id } }, { $group: { _id: null, total: { $sum: '$cost' } } }]);
      const expCostAgg = await Expense.aggregate([{ $match: { vehicle: v._id } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
      const maintCostAgg = await Maintenance.aggregate([{ $match: { vehicle: v._id, status: 'closed' } }, { $group: { _id: null, total: { $sum: '$cost' } } }]);
      const revenueAgg = await Trip.aggregate([{ $match: { vehicle: v._id, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$revenue' } } }]);
      const fuelCost = fuelCostAgg[0]?.total || 0;
      const expCost = expCostAgg[0]?.total || 0;
      const maintCost = maintCostAgg[0]?.total || 0;
      const revenue = revenueAgg[0]?.total || 0;
      const totalCost = fuelCost + expCost + maintCost;
      return {
        vehicleId: v._id,
        name: v.name,
        registrationNumber: v.registrationNumber,
        fuelCost, expenseCost: expCost, maintenanceCost: maintCost,
        totalCost, revenue, profit: revenue - totalCost
      };
    }));
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// @desc    Export trips to CSV
// @route   GET /api/reports/export/trips
// @access  Private (financial_analyst, fleet_manager)
const exportTripsCSV = async (req, res, next) => {
  try {
    const trips = await Trip.find({ status: 'completed' })
      .populate('vehicle', 'name registrationNumber')
      .populate('driver', 'name licenseNumber');
    const data = trips.map(t => ({
      tripCode: t.tripCode,
      vehicle: t.vehicle?.name,
      registration: t.vehicle?.registrationNumber,
      driver: t.driver?.name,
      source: t.source,
      destination: t.destination,
      cargoWeight: t.cargoWeight,
      actualDistance: t.actualDistance,
      fuelConsumed: t.fuelConsumed,
      revenue: t.revenue,
      completedAt: t.completedAt
    }));
    exportToCsv(res, data, 'trips_report');
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboardKPIs, getFuelEfficiencyReport, getOperationalCostReport, exportTripsCSV };
