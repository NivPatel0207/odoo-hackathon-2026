const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const Maintenance = require('../models/Maintenance');
const Driver = require('../models/Driver');
const FuelLog = require('../models/FuelLog');
const Expense = require('../models/Expense');

exports.assist = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const role = req.user.role; // Now available via protect middleware

    const query = message.toLowerCase();
    let reply = "I didn't quite catch that. You can ask me about fleet status, maintenance, trips, drivers, or fuel costs.";

    // 1. Fleet Status / Vehicles
    if (query.includes('vehicle') || query.includes('fleet') || query.includes('truck')) {
      if (!['fleet_manager', 'dispatcher', 'safety_officer', 'financial_analyst', 'viewer'].includes(role)) {
        reply = "Access Denied: Your role does not have authority to view fleet data.";
      } else {
        const total = await Vehicle.countDocuments();
        const available = await Vehicle.countDocuments({ status: 'available' });
        const onTrip = await Vehicle.countDocuments({ status: 'on_trip' });
        const inShop = await Vehicle.countDocuments({ status: 'in_shop' });
        
        if (role === 'viewer') {
          reply = `You have ${total} vehicles in your fleet.`;
        } else {
          reply = `You have ${total} vehicles in your fleet. Currently, ${available} are available, ${onTrip} are on active trips, and ${inShop} are in the shop for maintenance.`;
        }
      }
    }
    
    // 2. Maintenance Status
    else if (query.includes('maintenance') || query.includes('repair') || query.includes('shop') || query.includes('fix')) {
      if (!['fleet_manager', 'safety_officer'].includes(role)) {
        reply = "Access Denied: Your role does not have authority to view maintenance data.";
      } else {
        const open = await Maintenance.countDocuments({ status: 'open' });
        const urgent = await Maintenance.countDocuments({ maintenanceType: 'emergency', status: 'open' });
        
        if (open === 0) {
          reply = "Great news! There are currently no open maintenance tickets for any vehicles.";
        } else {
          reply = `There are ${open} open maintenance tickets. ${urgent > 0 ? `Please note that ${urgent} of them are marked as High priority and need immediate attention.` : 'None of them are marked as high priority right now.'}`;
        }
      }
    }

    // 3. Trip & Dispatch
    else if (query.includes('trip') || query.includes('dispatch') || query.includes('route')) {
      if (!['fleet_manager', 'dispatcher', 'financial_analyst', 'viewer'].includes(role)) {
        reply = "Access Denied: Your role does not have authority to view trip data.";
      } else {
        const active = await Trip.countDocuments({ status: { $in: ['dispatched', 'in_transit'] } });
        const completed = await Trip.countDocuments({ status: 'completed' });
        const delayed = await Trip.countDocuments({ status: 'delayed' });
        
        if (role === 'viewer') {
          reply = `We currently have ${active} active trips and ${completed} completed trips.`;
        } else {
          reply = `We currently have ${active} active trips. So far, ${completed} trips have been completed. ${delayed > 0 ? `Warning: ${delayed} trips are currently marked as delayed.` : 'All other trips are on schedule.'}`;
        }
      }
    }

    // 4. Financial / Fuel / Cost
    else if (query.includes('fuel') || query.includes('cost') || query.includes('expense') || query.includes('money')) {
      if (!['fleet_manager', 'financial_analyst'].includes(role)) {
        reply = "Access Denied: Your role does not have authority to view financial and cost data.";
      } else {
        const [fuelResult] = await FuelLog.aggregate([{ $group: { _id: null, total: { $sum: "$cost" } } }]);
        const [expResult] = await Expense.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]);
        
        const totalFuel = fuelResult ? fuelResult.total : 0;
        const totalExp = expResult ? expResult.total : 0;
        
        reply = `So far, you have spent ₹${totalFuel.toLocaleString('en-IN')} on fuel, and ₹${totalExp.toLocaleString('en-IN')} on other operational expenses.`;
      }
    }

    // 5. Drivers
    else if (query.includes('driver') || query.includes('staff')) {
      if (!['fleet_manager', 'dispatcher', 'safety_officer'].includes(role)) {
        reply = "Access Denied: Your role does not have authority to view driver details.";
      } else {
        const total = await Driver.countDocuments();
        const available = await Driver.countDocuments({ status: 'available' });
        const onDuty = await Driver.countDocuments({ status: 'on_trip' });
        
        reply = `You have ${total} registered drivers. ${available} are currently available for dispatch, and ${onDuty} are currently on duty.`;
      }
    }

    // Delay slightly to simulate AI thinking
    setTimeout(() => {
      res.json({ success: true, reply });
    }, 600);

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ success: false, message: 'Server error processing AI request' });
  }
};
