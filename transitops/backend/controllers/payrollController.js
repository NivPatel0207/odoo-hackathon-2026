const Settlement = require('../models/Settlement');
const Driver = require('../models/Driver');
const User = require('../models/User');
const Trip = require('../models/Trip');
const FuelLog = require('../models/FuelLog');
const Expense = require('../models/Expense');
const Maintenance = require('../models/Maintenance');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

// Helper: Get start of current month
const getStartOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: Calculate company operational financials
const getCompanyFinancials = async () => {
  const [revenueAgg, fuelCostAgg, expenseCostAgg, maintenanceCostAgg] = await Promise.all([
    Trip.aggregate([
      { $match: { status: 'completed', deleted: { $ne: true } } },
      { $group: { _id: null, totalRevenue: { $sum: '$revenue' } } }
    ]),
    FuelLog.aggregate([
      { $match: { deleted: { $ne: true } } },
      { $group: { _id: null, totalFuelCost: { $sum: '$cost' } } }
    ]),
    Expense.aggregate([
      { $match: { deleted: { $ne: true } } },
      { $group: { _id: null, totalExpenses: { $sum: '$amount' } } }
    ]),
    Maintenance.aggregate([
      { $match: { status: 'closed', deleted: { $ne: true } } },
      { $group: { _id: null, totalMaintCost: { $sum: '$cost' } } }
    ])
  ]);

  const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
  const totalFuelCost = fuelCostAgg[0]?.totalFuelCost || 0;
  const totalExpenses = expenseCostAgg[0]?.totalExpenses || 0;
  const totalMaintenanceCost = maintenanceCostAgg[0]?.totalMaintCost || 0;
  const totalOperationalCosts = totalFuelCost + totalExpenses + totalMaintenanceCost;
  const netProfit = totalRevenue - totalOperationalCosts;

  return {
    totalRevenue,
    totalFuelCost,
    totalExpenses,
    totalMaintenanceCost,
    totalOperationalCosts,
    netProfit
  };
};

// @desc    Get aggregated payroll metrics & summary
// @route   GET /api/v1/payroll/summary
// @access  Private (fleet_manager, financial_analyst)
const getPayrollSummary = async (req, res, next) => {
  try {
    const startOfMonth = getStartOfMonth();

    // 1. All-time and current month paid settlements
    const allPaid = await Settlement.find({ status: 'paid' });
    const totalPaidAllTime = allPaid.reduce((sum, s) => sum + (s.netPay || 0), 0);
    const thisMonthPaid = allPaid
      .filter(s => new Date(s.paidAt || s.createdAt) >= startOfMonth)
      .reduce((sum, s) => sum + (s.netPay || 0), 0);

    // 2. Pending Staff Salaries
    const staffMembers = await User.find({
      role: { $in: ['fleet_manager', 'dispatcher', 'safety_officer', 'financial_analyst', 'viewer'] },
      status: { $ne: 'Inactive' }
    });

    let pendingStaffAmount = 0;
    let pendingStaffCount = 0;

    for (const u of staffMembers) {
      const salary = u.salary || 0;
      if (salary > 0) {
        const paidThisMonth = allPaid.some(s => 
          s.beneficiaryType === 'staff' && 
          s.user && s.user.toString() === u._id.toString() &&
          new Date(s.paidAt || s.createdAt) >= startOfMonth
        );
        if (!paidThisMonth) {
          pendingStaffAmount += salary;
          pendingStaffCount++;
        }
      }
    }

    // 3. Pending Driver Payouts
    const drivers = await Driver.find({ status: { $ne: 'retired' } });
    let pendingDriverAmount = 0;
    let pendingDriverCount = 0;

    const settledTripIds = new Set(
      allPaid.flatMap(s => (s.trips || []).map(t => t.toString()))
    );

    for (const d of drivers) {
      if (d.paymentType === 'per_trip') {
        const completedTrips = await Trip.find({
          driver: d._id,
          status: 'completed',
          _id: { $nin: Array.from(settledTripIds) }
        });
        const pay = completedTrips.length * (d.paymentAmount || 2500);
        if (pay > 0) {
          pendingDriverAmount += pay;
          pendingDriverCount++;
        }
      } else {
        // Monthly flat salary
        const salary = d.paymentAmount || 0;
        const paidThisMonth = allPaid.some(s => 
          s.beneficiaryType === 'driver' && 
          s.driver && s.driver.toString() === d._id.toString() &&
          new Date(s.paidAt || s.createdAt) >= startOfMonth
        );
        if (!paidThisMonth && salary > 0) {
          pendingDriverAmount += salary;
          pendingDriverCount++;
        }
      }
    }

    const financials = await getCompanyFinancials();
    const pendingTotal = pendingStaffAmount + pendingDriverAmount;

    let solvencyStatus = 'SURPLUS';
    if (financials.netProfit <= 0) {
      solvencyStatus = 'DEFICIT';
    } else if (financials.netProfit < pendingTotal) {
      solvencyStatus = 'TIGHT_MARGIN';
    }

    res.status(200).json({
      success: true,
      data: {
        totalPaidAllTime,
        thisMonthPaid,
        pendingTotal,
        pendingStaffAmount,
        pendingStaffCount,
        pendingDriverAmount,
        pendingDriverCount,
        totalMembers: staffMembers.length + drivers.length,
        settlementsCount: allPaid.length,
        financials: {
          ...financials,
          solvencyStatus,
          isProfitable: financials.netProfit > 0,
          profitCoverageRatio: pendingTotal > 0 ? Number(((financials.netProfit / pendingTotal) * 100).toFixed(1)) : 100
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get complete roster with current pending pay
// @route   GET /api/v1/payroll/roster
// @access  Private (fleet_manager, financial_analyst)
const getPayrollRoster = async (req, res, next) => {
  try {
    const startOfMonth = getStartOfMonth();
    const allPaid = await Settlement.find({ status: 'paid' }).sort({ paidAt: -1 });

    // Settled trips set
    const settledTripIds = new Set(
      allPaid.flatMap(s => (s.trips || []).map(t => t.toString()))
    );

    // 1. Process Staff Roster
    const staffMembers = await User.find({
      role: { $in: ['fleet_manager', 'dispatcher', 'safety_officer', 'financial_analyst', 'viewer'] }
    }).select('-passwordHash').sort({ name: 1 });

    const staffRoster = staffMembers.map(u => {
      const userSettlements = allPaid.filter(s => s.user && s.user.toString() === u._id.toString());
      const lastSettlement = userSettlements[0];
      const isPaidThisMonth = userSettlements.some(s => new Date(s.paidAt || s.createdAt) >= startOfMonth);
      const salary = u.salary || 0;

      return {
        _id: u._id,
        beneficiaryType: 'staff',
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        department: u.department || 'Operations',
        paymentType: 'monthly',
        baseSalary: salary,
        pendingAmount: isPaidThisMonth ? 0 : salary,
        isPaidThisMonth,
        lastPaidAt: lastSettlement ? lastSettlement.paidAt : null,
        lastPaidAmount: lastSettlement ? lastSettlement.netPay : null,
        status: isPaidThisMonth ? 'Paid this Month' : (salary > 0 ? 'Pending Payout' : 'Salary Unset')
      };
    });

    // 2. Process Driver Roster
    const drivers = await Driver.find({ status: { $ne: 'retired' } }).sort({ name: 1 });
    const driverRoster = [];

    for (const d of drivers) {
      const driverSettlements = allPaid.filter(s => s.driver && s.driver.toString() === d._id.toString());
      const lastSettlement = driverSettlements[0];
      const isPaidThisMonth = driverSettlements.some(s => new Date(s.paidAt || s.createdAt) >= startOfMonth);

      let pendingAmount = 0;
      let pendingTripsCount = 0;
      let unsettledTrips = [];

      if (d.paymentType === 'per_trip') {
        unsettledTrips = await Trip.find({
          driver: d._id,
          status: 'completed',
          _id: { $nin: Array.from(settledTripIds) }
        }).select('_id tripCode source destination completedAt');

        pendingTripsCount = unsettledTrips.length;
        pendingAmount = pendingTripsCount * (d.paymentAmount || 2500);
      } else {
        // Monthly flat
        pendingAmount = isPaidThisMonth ? 0 : (d.paymentAmount || 0);
      }

      driverRoster.push({
        _id: d._id,
        beneficiaryType: 'driver',
        name: d.name,
        licenseNumber: d.licenseNumber,
        contactNumber: d.contactNumber,
        role: 'Driver',
        status: d.status,
        paymentType: d.paymentType || 'monthly',
        baseRate: d.paymentAmount || 0,
        pendingTripsCount,
        unsettledTrips,
        pendingAmount,
        isPaidThisMonth,
        lastPaidAt: lastSettlement ? lastSettlement.paidAt : null,
        lastPaidAmount: lastSettlement ? lastSettlement.netPay : null,
        paymentStatus: pendingAmount > 0 ? 'Pending Payout' : 'Settled'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        staff: staffRoster,
        drivers: driverRoster
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Disburse payout / salary for a specific member
// @route   POST /api/v1/payroll/disburse
// @access  Private (fleet_manager, financial_analyst)
const disbursePayout = async (req, res, next) => {
  try {
    const {
      beneficiaryType,
      memberId,
      basePay,
      bonus = 0,
      deductions = 0,
      paymentMethod = 'bank_transfer',
      transactionRef = '',
      notes = '',
      periodStart,
      periodEnd,
      deficitOverride = false,
      deficitOverrideReason = ''
    } = req.body;

    if (!memberId || !beneficiaryType) {
      return res.status(400).json({ success: false, message: 'Member ID and beneficiary type are required' });
    }

    const netPay = Math.max(0, Number(basePay || 0) + Number(bonus || 0) - Number(deductions || 0));

    // Solvency Check against operational net profit
    const financials = await getCompanyFinancials();
    const isDeficit = (financials.netProfit <= 0) || (netPay > financials.netProfit);

    if (isDeficit) {
      if (req.user.role !== 'fleet_manager') {
        return res.status(403).json({
          success: false,
          code: 'DEFICIT_BLOCKED',
          message: `Disbursal blocked by Solvency Policy. Company operational net profit (₹${financials.netProfit.toLocaleString('en-IN')}) cannot cover this payout of ₹${netPay.toLocaleString('en-IN')}. Only a Fleet Manager can authorize an Executive Deficit Draw.`
        });
      }

      if (!deficitOverride || !deficitOverrideReason || deficitOverrideReason.trim().length < 10) {
        return res.status(409).json({
          success: false,
          code: 'DEFICIT_OVERRIDE_REQUIRED',
          message: `Payout of ₹${netPay.toLocaleString('en-IN')} exceeds available net profit (₹${financials.netProfit.toLocaleString('en-IN')}). Executive Deficit Draw authorization and justification required.`,
          data: {
            netProfit: financials.netProfit,
            shortfall: Math.max(0, netPay - financials.netProfit),
            requiredAmount: netPay
          }
        });
      }
    }

    let settlementData = {
      beneficiaryType,
      basePay: Number(basePay || 0),
      bonus: Number(bonus || 0),
      deductions: Number(deductions || 0),
      netPay,
      paymentMethod,
      transactionRef,
      notes,
      periodStart: periodStart ? new Date(periodStart) : getStartOfMonth(),
      periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
      status: 'paid',
      paidAt: new Date(),
      paidBy: req.user._id
    };

    if (isDeficit && deficitOverride) {
      settlementData.isDeficitPayout = true;
      settlementData.deficitOverrideBy = req.user._id;
      settlementData.deficitOverrideReason = deficitOverrideReason.trim();
    }

    if (beneficiaryType === 'driver') {
      const driver = await Driver.findById(memberId);
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

      // Gather unsettled completed trips
      const allPaid = await Settlement.find({ driver: driver._id, status: 'paid' });
      const settledTripIds = new Set(allPaid.flatMap(s => (s.trips || []).map(t => t.toString())));

      const completedTrips = await Trip.find({
        driver: driver._id,
        status: 'completed',
        _id: { $nin: Array.from(settledTripIds) }
      });

      settlementData.driver = driver._id;
      settlementData.beneficiaryName = driver.name;
      settlementData.role = 'Driver';
      settlementData.trips = completedTrips.map(t => t._id);

      // Also link to user account if driver user account exists
      const linkedUser = await User.findOne({ driverProfileId: driver._id });
      if (linkedUser) settlementData.user = linkedUser._id;

    } else {
      // Staff member
      const user = await User.findById(memberId);
      if (!user) return res.status(404).json({ success: false, message: 'Staff member not found' });

      settlementData.user = user._id;
      settlementData.beneficiaryName = user.name;
      settlementData.role = user.role;
    }

    const settlement = await Settlement.create(settlementData);

    // If deficit override was applied, record audit log and notify
    if (settlement.isDeficitPayout) {
      await AuditLog.create({
        action: 'CREATE',
        modelName: 'Settlement',
        documentId: settlement._id,
        userId: req.user._id,
        changes: {
          action: 'DEFICIT_PAYROLL_OVERRIDE',
          beneficiaryName: settlementData.beneficiaryName,
          netPay,
          netProfit: financials.netProfit,
          shortfall: Math.max(0, netPay - financials.netProfit),
          reason: deficitOverrideReason.trim()
        }
      });

      await Notification.create({
        title: '⚠️ Executive Deficit Payout Disbursed',
        message: `Fleet Manager ${req.user.name} authorized an Executive Deficit Payout of ₹${netPay.toLocaleString('en-IN')} for ${settlementData.beneficiaryName}. Reason: ${deficitOverrideReason.trim()}`,
        type: 'warning',
        referenceId: settlement._id
      });
    }

    res.status(201).json({
      success: true,
      message: `Salary of ₹${netPay.toLocaleString('en-IN')} disbursed successfully to ${settlementData.beneficiaryName}${isDeficit ? ' (Deficit Draw Authorized)' : ''}`,
      data: settlement
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Batch disburse all pending payroll
// @route   POST /api/v1/payroll/disburse-all
// @access  Private (fleet_manager, financial_analyst)
const disburseAllPending = async (req, res, next) => {
  try {
    const { deficitOverride = false, deficitOverrideReason = '' } = req.body || {};
    const startOfMonth = getStartOfMonth();
    const allPaid = await Settlement.find({ status: 'paid' });
    const settledTripIds = new Set(allPaid.flatMap(s => (s.trips || []).map(t => t.toString())));

    // Pre-calculate pending staff items
    const staffMembers = await User.find({
      role: { $in: ['fleet_manager', 'dispatcher', 'safety_officer', 'financial_analyst', 'viewer'] },
      status: { $ne: 'Inactive' }
    });

    const pendingStaffList = [];
    for (const u of staffMembers) {
      const salary = u.salary || 0;
      if (salary > 0) {
        const paidThisMonth = allPaid.some(s => 
          s.beneficiaryType === 'staff' && 
          s.user && s.user.toString() === u._id.toString() &&
          new Date(s.paidAt || s.createdAt) >= startOfMonth
        );
        if (!paidThisMonth) {
          pendingStaffList.push({ user: u, salary });
        }
      }
    }

    // Pre-calculate pending driver items
    const drivers = await Driver.find({ status: { $ne: 'retired' } });
    const pendingDriverList = [];

    for (const d of drivers) {
      let amount = 0;
      let tripsToSettle = [];

      if (d.paymentType === 'per_trip') {
        const completedTrips = await Trip.find({
          driver: d._id,
          status: 'completed',
          _id: { $nin: Array.from(settledTripIds) }
        });
        amount = completedTrips.length * (d.paymentAmount || 2500);
        tripsToSettle = completedTrips.map(t => t._id);
      } else {
        const salary = d.paymentAmount || 0;
        const paidThisMonth = allPaid.some(s => 
          s.beneficiaryType === 'driver' && 
          s.driver && s.driver.toString() === d._id.toString() &&
          new Date(s.paidAt || s.createdAt) >= startOfMonth
        );
        if (!paidThisMonth && salary > 0) {
          amount = salary;
        }
      }

      if (amount > 0) {
        pendingDriverList.push({ driver: d, amount, tripsToSettle });
      }
    }

    const totalBatchAmount = pendingStaffList.reduce((sum, item) => sum + item.salary, 0) +
      pendingDriverList.reduce((sum, item) => sum + item.amount, 0);

    if (totalBatchAmount === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending salaries or settlements to disburse.',
        data: { disbursedCount: 0, totalDisbursed: 0 }
      });
    }

    const financials = await getCompanyFinancials();
    const isDeficit = (financials.netProfit <= 0) || (totalBatchAmount > financials.netProfit);

    if (isDeficit) {
      if (req.user.role !== 'fleet_manager') {
        return res.status(403).json({
          success: false,
          code: 'DEFICIT_BLOCKED',
          message: `Batch disbursal blocked by Solvency Policy. Company operational net profit (₹${financials.netProfit.toLocaleString('en-IN')}) cannot cover total pending payroll of ₹${totalBatchAmount.toLocaleString('en-IN')}. Only a Fleet Manager can authorize an Executive Deficit Draw.`
        });
      }

      if (!deficitOverride || !deficitOverrideReason || deficitOverrideReason.trim().length < 10) {
        return res.status(409).json({
          success: false,
          code: 'DEFICIT_OVERRIDE_REQUIRED',
          message: `Batch payroll of ₹${totalBatchAmount.toLocaleString('en-IN')} exceeds available net profit (₹${financials.netProfit.toLocaleString('en-IN')}). Executive Deficit Draw authorization and justification required.`,
          data: {
            netProfit: financials.netProfit,
            shortfall: Math.max(0, totalBatchAmount - financials.netProfit),
            requiredAmount: totalBatchAmount
          }
        });
      }
    }

    // Execute batch creation
    let disbursedCount = 0;
    let totalDisbursed = 0;

    for (const item of pendingStaffList) {
      const u = item.user;
      const salary = item.salary;
      await Settlement.create({
        beneficiaryType: 'staff',
        user: u._id,
        beneficiaryName: u.name,
        role: u.role,
        basePay: salary,
        netPay: salary,
        paymentMethod: 'bank_transfer',
        transactionRef: 'BATCH-' + Date.now().toString().slice(-6),
        notes: `Automated monthly payroll cycle (${new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
        periodStart: startOfMonth,
        periodEnd: new Date(),
        status: 'paid',
        paidAt: new Date(),
        paidBy: req.user._id,
        isDeficitPayout: isDeficit,
        deficitOverrideBy: isDeficit ? req.user._id : undefined,
        deficitOverrideReason: isDeficit ? deficitOverrideReason.trim() : undefined
      });
      disbursedCount++;
      totalDisbursed += salary;
    }

    for (const item of pendingDriverList) {
      const d = item.driver;
      const amount = item.amount;
      const linkedUser = await User.findOne({ driverProfileId: d._id });
      await Settlement.create({
        beneficiaryType: 'driver',
        driver: d._id,
        user: linkedUser ? linkedUser._id : undefined,
        beneficiaryName: d.name,
        role: 'Driver',
        trips: item.tripsToSettle,
        basePay: amount,
        netPay: amount,
        paymentMethod: 'bank_transfer',
        transactionRef: 'BATCH-DRV-' + Date.now().toString().slice(-6),
        notes: `Batch settlement payout (${new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })})`,
        periodStart: startOfMonth,
        periodEnd: new Date(),
        status: 'paid',
        paidAt: new Date(),
        paidBy: req.user._id,
        isDeficitPayout: isDeficit,
        deficitOverrideBy: isDeficit ? req.user._id : undefined,
        deficitOverrideReason: isDeficit ? deficitOverrideReason.trim() : undefined
      });
      disbursedCount++;
      totalDisbursed += amount;
    }

    if (isDeficit) {
      await AuditLog.create({
        action: 'CREATE',
        modelName: 'Settlement',
        documentId: req.user._id,
        userId: req.user._id,
        changes: {
          action: 'DEFICIT_BATCH_PAYROLL_OVERRIDE',
          disbursedCount,
          totalDisbursed,
          netProfit: financials.netProfit,
          shortfall: Math.max(0, totalDisbursed - financials.netProfit),
          reason: deficitOverrideReason.trim()
        }
      });

      await Notification.create({
        title: '⚠️ Executive Batch Deficit Payout Disbursed',
        message: `Fleet Manager ${req.user.name} authorized a batch deficit payout of ₹${totalDisbursed.toLocaleString('en-IN')} across ${disbursedCount} members. Reason: ${deficitOverrideReason.trim()}`,
        type: 'warning'
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${disbursedCount} payroll payouts totaling ₹${totalDisbursed.toLocaleString('en-IN')}${isDeficit ? ' (Executive Deficit Draw Authorized)' : ''}`,
      data: { disbursedCount, totalDisbursed, isDeficit }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get complete payout history & audit log
// @route   GET /api/v1/payroll/history
// @access  Private (fleet_manager, financial_analyst)
const getPayrollHistory = async (req, res, next) => {
  try {
    const { beneficiaryType, search } = req.query;
    const filter = { status: 'paid' };

    if (beneficiaryType) filter.beneficiaryType = beneficiaryType;
    if (search) {
      filter.$or = [
        { beneficiaryName: { $regex: search, $options: 'i' } },
        { transactionRef: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    const history = await Settlement.find(filter)
      .populate('driver', 'name licenseNumber contactNumber')
      .populate('user', 'name email role department')
      .populate('paidBy', 'name email')
      .populate('deficitOverrideBy', 'name email role')
      .populate('trips', 'tripCode source destination completedAt')
      .sort({ paidAt: -1 });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPayrollSummary,
  getPayrollRoster,
  disbursePayout,
  disburseAllPending,
  getPayrollHistory
};
