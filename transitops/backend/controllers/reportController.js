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
      { $match: { status: 'completed', deleted: { $ne: true } } },
      { $group: { _id: null, totalRevenue: { $sum: '$revenue' }, totalDistance: { $sum: '$actualDistance' } } }
    ]);
    const fuelCostAgg = await FuelLog.aggregate([
      { $match: { deleted: { $ne: true } } },
      { $group: { _id: null, totalFuelCost: { $sum: '$cost' }, totalFuelQuantity: { $sum: '$quantity' } } }
    ]);
    const expenseCostAgg = await Expense.aggregate([
      { $match: { deleted: { $ne: true } } },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' } } }
    ]);
    const maintenanceCostAgg = await Maintenance.aggregate([
      { $match: { status: 'closed', deleted: { $ne: true } } },
      { $group: { _id: null, totalMaintCost: { $sum: '$cost' } } }
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalDistance = revenueAgg[0]?.totalDistance || 0;
    const totalFuelQuantity = fuelCostAgg[0]?.totalFuelQuantity || 0;
    const totalFuelCost = fuelCostAgg[0]?.totalFuelCost || 0;
    const totalExpenses = expenseCostAgg[0]?.totalExpenses || 0;
    const totalMaintCost = maintenanceCostAgg[0]?.totalMaintCost || 0;
    const totalCosts = totalFuelCost + totalExpenses + totalMaintCost;
    const netProfit = totalRevenue - totalCosts;
    const fuelEfficiency = totalDistance > 0 && totalFuelQuantity > 0 ? (totalDistance / totalFuelQuantity).toFixed(2) : 0;
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
    const vehicles = await Vehicle.find({}, 'name registrationNumber fuelType');
    
    const [distanceAgg, fuelAgg] = await Promise.all([
      Trip.aggregate([
        { $match: { status: 'completed', deleted: { $ne: true } } },
        { $group: { _id: '$vehicle', totalDistance: { $sum: '$actualDistance' }, tripCount: { $sum: 1 } } }
      ]),
      FuelLog.aggregate([
        { $match: { deleted: { $ne: true } } },
        { $group: { _id: '$vehicle', totalFuel: { $sum: '$quantity' } } }
      ])
    ]);

    const distMap = Object.fromEntries(distanceAgg.map(item => [item._id.toString(), { dist: item.totalDistance, count: item.tripCount }]));
    const fuelMap = Object.fromEntries(fuelAgg.map(item => [item._id.toString(), item.totalFuel]));

    const report = vehicles.map(v => {
      const distData = distMap[v._id.toString()] || { dist: 0, count: 0 };
      const totalFuel = fuelMap[v._id.toString()] || 0;
      return {
        vehicleId: v._id,
        vehicleName: v.name,
        regNumber: v.registrationNumber,
        fuelType: v.fuelType,
        totalDistance: distData.dist,
        totalFuel: totalFuel,
        tripCount: distData.count,
        kmPerLiter: totalFuel > 0 ? (distData.dist / totalFuel) : 0
      };
    }).filter(v => v.tripCount > 0 || v.totalFuel > 0);

    report.sort((a, b) => b.kmPerLiter - a.kmPerLiter);

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
    
    const [fuelCosts, expCosts, maintCosts, revenues] = await Promise.all([
      FuelLog.aggregate([{ $match: { deleted: { $ne: true } } }, { $group: { _id: '$vehicle', total: { $sum: '$cost' } } }]),
      Expense.aggregate([{ $match: { deleted: { $ne: true } } }, { $group: { _id: '$vehicle', total: { $sum: '$amount' } } }]),
      Maintenance.aggregate([{ $match: { status: 'closed', deleted: { $ne: true } } }, { $group: { _id: '$vehicle', total: { $sum: '$cost' } } }]),
      Trip.aggregate([{ $match: { status: 'completed', deleted: { $ne: true } } }, { $group: { _id: '$vehicle', total: { $sum: '$revenue' } } }])
    ]);

    const fuelMap = Object.fromEntries(fuelCosts.map(item => [item._id.toString(), item.total]));
    const expMap = Object.fromEntries(expCosts.map(item => [item._id.toString(), item.total]));
    const maintMap = Object.fromEntries(maintCosts.map(item => [item._id.toString(), item.total]));
    const revMap = Object.fromEntries(revenues.map(item => [item._id.toString(), item.total]));

    const report = vehicles.map(v => {
      const fuelCost = fuelMap[v._id.toString()] || 0;
      const expCost = expMap[v._id.toString()] || 0;
      const maintCost = maintMap[v._id.toString()] || 0;
      const revenue = revMap[v._id.toString()] || 0;
      const totalCost = fuelCost + expCost + maintCost;
      return {
        vehicleId: v._id,
        name: v.name,
        registrationNumber: v.registrationNumber,
        fuelCost, expenseCost: expCost, maintenanceCost: maintCost,
        totalCost, revenue, profit: revenue - totalCost
      };
    });
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

// @desc    Get driver performance report
// @route   GET /api/reports/driver-performance
// @access  Private (financial_analyst, fleet_manager)
const getDriverPerformanceReport = async (req, res, next) => {
  try {
    const report = await Trip.aggregate([
      { $match: { status: 'completed', deleted: { $ne: true } } },
      { $group: {
        _id: '$driver',
        totalTrips: { $sum: 1 },
        totalDistance: { $sum: '$actualDistance' },
        totalRevenue: { $sum: '$revenue' },
        totalFuel: { $sum: '$fuelConsumed' }
      }},
      { $lookup: { from: 'drivers', localField: '_id', foreignField: '_id', as: 'driver' } },
      { $unwind: '$driver' },
      { $project: {
        driverId: '$_id',
        name: '$driver.name',
        licenseNumber: '$driver.licenseNumber',
        totalTrips: 1, totalDistance: 1, totalRevenue: 1, totalFuel: 1,
        safetyScore: { $ifNull: ['$driver.safetyScore', 100] },
        avgFuelPerKm: { $cond: [{ $gt: ['$totalDistance', 0] }, { $divide: ['$totalFuel', '$totalDistance'] }, 0] }
      }},
      { $sort: { totalRevenue: -1 } }
    ]);
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

module.exports = { getDashboardKPIs, getFuelEfficiencyReport, getOperationalCostReport, getDriverPerformanceReport, exportTripsCSV };
