const { z } = require('zod');

const TripSchema = z.object({
  source: z.string().min(1, 'Source is required'),
  destination: z.string().min(1, 'Destination is required'),
  vehicle: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID').optional().or(z.literal('')),
  driver: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid driver ID').optional().or(z.literal('')),
  cargoWeight: z.number().min(0, 'Cargo weight cannot be negative'),
  plannedDistance: z.number().min(0).optional(),
  actualDistance: z.number().min(0).optional(),
  fuelConsumed: z.number().min(0).optional(),
  revenue: z.number().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.enum(['draft', 'assigned', 'loading', 'dispatched', 'in_transit', 'delivered', 'completed', 'delayed', 'cancelled']).optional(),
  notes: z.string().optional(),
  eta: z.string().or(z.date()).optional(),
  customerName: z.string().optional(),
  commodityType: z.string().optional(),
  rateType: z.enum(['flat', 'per_mile']).optional(),
  rate: z.number().min(0).optional(),
  pickupTime: z.string().or(z.date()).optional(),
  deliveryTime: z.string().or(z.date()).optional()
});

const VehicleSchema = z.object({
  registrationNumber: z.string().min(1, 'Registration number is required'),
  name: z.string().min(1, 'Name is required'),
  vehicleType: z.enum(['truck', 'van', 'bus', 'pickup', 'trailer', 'tanker']).optional(),
  fuelType: z.enum(['diesel', 'gasoline', 'cng', 'electric', 'hybrid']).optional(),
  maxLoadCapacity: z.number().min(1, 'Max load capacity must be positive'),
  acquisitionCost: z.number().min(0).optional(),
  odometer: z.number().min(0).optional(),
  status: z.enum(['available', 'on_trip', 'in_shop', 'retired']).optional()
});

const DriverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
  licenseCategory: z.string().optional(),
  licenseExpiryDate: z.string().or(z.date()).optional(),
  contactNumber: z.string().optional(),
  paymentType: z.enum(['monthly', 'per_trip']).optional(),
  paymentAmount: z.number().min(0).optional(),
  safetyScore: z.number().min(0).max(100).optional(),
  kyc: z.object({
    aadharNumber: z.string().optional(),
    aadharVerified: z.boolean().optional()
  }).optional(),
  status: z.enum(['available', 'on_trip', 'on_leave', 'suspended']).optional()
});

const validate = (schema) => (req, res, next) => {
  try {
    const schemaToUse = ['PUT', 'PATCH'].includes(req.method) ? schema.partial() : schema;
    req.body = schemaToUse.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.issues.map(e => ({ path: e.path.join('.'), message: e.message }))
      });
    }
    next(error);
  }
};

const FuelLogSchema = z.object({
  vehicle: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID').min(1, 'Vehicle is required'),
  trip: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid trip ID').optional().or(z.literal('')),
  date: z.string().or(z.date()).optional(),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  costPerUnit: z.number().min(0).optional(),
  cost: z.number().min(0, 'Fuel cost cannot be negative'),
  station: z.string().optional()
});

const ExpenseSchema = z.object({
  vehicle: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID').min(1, 'Vehicle is required'),
  trip: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid trip ID').optional().or(z.literal('')),
  expenseType: z.enum(['toll', 'insurance', 'tax', 'fine', 'parking', 'other']),
  amount: z.number().min(0, 'Amount cannot be negative'),
  date: z.string().or(z.date()).optional(),
  description: z.string().optional()
});

const MaintenanceSchema = z.object({
  vehicle: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID').min(1, 'Vehicle is required'),
  description: z.string().min(1, 'Maintenance description is required'),
  maintenanceType: z.enum(['preventive', 'corrective', 'inspection', 'emergency']).optional(),
  cost: z.number().min(0, 'Cost cannot be negative').optional(),
  dateStart: z.string().or(z.date()).optional(),
  dateEnd: z.string().or(z.date()).optional(),
  status: z.enum(['open', 'closed']).optional(),
  notes: z.string().optional()
});

const EventSchema = z.object({
  title: z.string().min(1, 'Event title is required'),
  type: z.enum(['Meeting', 'Maintenance', 'Trip', 'Driver Shift', 'Other']).optional(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  description: z.string().optional(),
  status: z.enum(['Planned', 'Ongoing', 'Completed', 'Cancelled']).optional()
});

const EldStatusSchema = z.object({
  status: z.enum(['OFF_DUTY', 'SLEEPER', 'DRIVING', 'ON_DUTY']),
  location: z.string().optional(),
  vehicle: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid vehicle ID').optional().or(z.literal(''))
});

module.exports = {
  validateTrip: validate(TripSchema),
  validateVehicle: validate(VehicleSchema),
  validateDriver: validate(DriverSchema),
  validateFuelLog: validate(FuelLogSchema),
  validateExpense: validate(ExpenseSchema),
  validateMaintenance: validate(MaintenanceSchema),
  validateEvent: validate(EventSchema),
  validateEldStatus: validate(EldStatusSchema),
  TripSchema,
  VehicleSchema,
  DriverSchema,
  FuelLogSchema,
  ExpenseSchema,
  MaintenanceSchema,
  EventSchema,
  EldStatusSchema
};
