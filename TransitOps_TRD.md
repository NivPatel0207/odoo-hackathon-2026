# TransitOps — Smart Transport Operations Platform
## Technical Requirements Document (TRD)

**Project Type:** Personal Project
**Version:** 1.0
**Companion Document:** `TransitOps_PRD.md`

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js |
| Backend framework | Express.js |
| Database | MongoDB |
| ODM | Mongoose |
| Auth | JWT (JSON Web Token) + bcrypt for password hashing |
| Frontend | HTML5, CSS3, vanilla JavaScript (fetch API for REST calls) |
| API style | RESTful JSON API |
| Environment config | dotenv (`.env`) |
| Dev tooling | nodemon (dev server), morgan (request logging) |

## 2. Project Structure

```
transitops/
├── backend/
│   ├── server.js                     # entry point
│   ├── config/
│   │   └── db.js                     # MongoDB connection
│   ├── models/
│   │   ├── User.js
│   │   ├── Vehicle.js
│   │   ├── Driver.js
│   │   ├── Trip.js
│   │   ├── Maintenance.js
│   │   ├── FuelLog.js
│   │   └── Expense.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── vehicleController.js
│   │   ├── driverController.js
│   │   ├── tripController.js
│   │   ├── maintenanceController.js
│   │   ├── fuelExpenseController.js
│   │   └── reportController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── vehicleRoutes.js
│   │   ├── driverRoutes.js
│   │   ├── tripRoutes.js
│   │   ├── maintenanceRoutes.js
│   │   ├── fuelExpenseRoutes.js
│   │   └── reportRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js          # JWT verification
│   │   ├── roleMiddleware.js          # RBAC guard
│   │   └── errorMiddleware.js
│   ├── utils/
│   │   └── csvExport.js
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── index.html                     # login
    ├── dashboard.html
    ├── vehicles.html
    ├── drivers.html
    ├── trips.html
    ├── maintenance.html
    ├── fuel-expense.html
    ├── reports.html
    ├── css/
    │   ├── style.css
    │   └── components.css
    └── js/
        ├── api.js                     # centralized fetch wrapper + auth header
        ├── auth.js
        ├── dashboard.js
        ├── vehicles.js
        ├── drivers.js
        ├── trips.js
        ├── maintenance.js
        ├── fuelExpense.js
        └── reports.js
```

## 3. Data Model (Mongoose Schemas)

### 3.1 `User`
| Field | Type | Notes |
|---|---|---|
| `name` | String | required |
| `email` | String | required, unique |
| `passwordHash` | String | bcrypt hash, never returned in API responses |
| `role` | String (enum) | `fleet_manager \| dispatcher \| safety_officer \| financial_analyst` |
| `createdAt` | Date | default: now |

### 3.2 `Vehicle`
| Field | Type | Notes |
|---|---|---|
| `name` | String | Vehicle Name/Model |
| `registrationNumber` | String | `unique: true, index: true` — enforces BR-1 |
| `vehicleType` | String (enum) | Truck / Van / Bike / Trailer |
| `maxLoadCapacity` | Number | kg |
| `odometer` | Number | km |
| `acquisitionCost` | Number | for ROI |
| `region` | String | supports dashboard filter (PRD assumption) |
| `status` | String (enum) | `available \| on_trip \| in_shop \| retired`, default `available` |
| `createdAt` / `updatedAt` | Date | timestamps: true |

### 3.3 `Driver`
| Field | Type | Notes |
|---|---|---|
| `name` | String | |
| `licenseNumber` | String | `unique: true` |
| `licenseCategory` | String (enum) | LMV / HMV |
| `licenseExpiryDate` | Date | used in BR-3 |
| `contactNumber` | String | |
| `safetyScore` | Number | 0–100 |
| `status` | String (enum) | `available \| on_trip \| off_duty \| suspended` |

### 3.4 `Trip`
| Field | Type | Notes |
|---|---|---|
| `tripCode` | String | auto-generated, e.g. `TRIP-0001` |
| `source` | String | |
| `destination` | String | |
| `vehicle` | ObjectId → `Vehicle` | ref, must be `available` at dispatch |
| `driver` | ObjectId → `Driver` | ref, must be `available` + license valid at dispatch |
| `cargoWeight` | Number | validated against `vehicle.maxLoadCapacity` |
| `plannedDistance` | Number | km |
| `actualDistance` | Number | filled on completion |
| `fuelConsumed` | Number | filled on completion |
| `revenue` | Number | for ROI (PRD assumption) |
| `status` | String (enum) | `draft \| dispatched \| completed \| cancelled` |

### 3.5 `Maintenance`
| Field | Type | Notes |
|---|---|---|
| `vehicle` | ObjectId → `Vehicle` | ref |
| `description` | String | e.g. "Oil Change" |
| `cost` | Number | rolls into operational cost |
| `dateStart` | Date | |
| `dateEnd` | Date | null = still open |
| `status` | String (enum) | `open \| closed` |

### 3.6 `FuelLog`
| Field | Type | Notes |
|---|---|---|
| `vehicle` | ObjectId → `Vehicle` | |
| `trip` | ObjectId → `Trip` | optional |
| `date` | Date | |
| `liters` | Number | |
| `cost` | Number | |

### 3.7 `Expense`
| Field | Type | Notes |
|---|---|---|
| `vehicle` | ObjectId → `Vehicle` | |
| `expenseType` | String (enum) | `toll \| other` |
| `amount` | Number | |
| `date` | Date | |

## 4. State Machines

### 4.1 Vehicle Status
```
available ──(dispatch trip)──▶ on_trip ──(complete/cancel trip)──▶ available
available ──(open maintenance)──▶ in_shop ──(close maintenance)──▶ available
                                                 │
                                                 └─(if vehicle.status == retired)─▶ stays retired
any ──(manual admin action)──▶ retired  (terminal state, excluded from dispatch)
```

### 4.2 Driver Status
```
available ──(dispatch trip)──▶ on_trip ──(complete/cancel trip)──▶ available
available ──(admin action)──▶ off_duty / suspended
```

### 4.3 Trip Lifecycle
```
draft ──(dispatch)──▶ dispatched ──(complete)──▶ completed
draft ──(cancel)──▶ cancelled
dispatched ──(cancel)──▶ cancelled  (releases vehicle+driver back to available)
```

### 4.4 Maintenance Lifecycle
```
(create) ──▶ open  [vehicle.status → in_shop]
open ──(close)──▶ closed  [vehicle.status → available, unless vehicle.status == retired]
```

## 5. REST API Design

### 5.1 Auth
| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public (or admin-only, per deployment) | Create user account |
| POST | `/api/auth/login` | Public | Returns JWT + role |
| GET | `/api/auth/me` | Authenticated | Current user profile |

### 5.2 Vehicles
| Method | Route | Access |
|---|---|---|
| GET | `/api/vehicles` | All authenticated (supports `?status=&type=&region=`) |
| GET | `/api/vehicles/:id` | All authenticated |
| POST | `/api/vehicles` | Fleet Manager |
| PUT | `/api/vehicles/:id` | Fleet Manager |
| DELETE | `/api/vehicles/:id` | Fleet Manager |

### 5.3 Drivers
| Method | Route | Access |
|---|---|---|
| GET | `/api/drivers` | All authenticated |
| GET | `/api/drivers/:id` | All authenticated |
| POST | `/api/drivers` | Safety Officer |
| PUT | `/api/drivers/:id` | Safety Officer |
| DELETE | `/api/drivers/:id` | Safety Officer |

### 5.4 Trips
| Method | Route | Access |
|---|---|---|
| GET | `/api/trips` | All authenticated |
| POST | `/api/trips` | Dispatcher (creates as `draft`) |
| PUT | `/api/trips/:id` | Dispatcher (edit while `draft`) |
| POST | `/api/trips/:id/dispatch` | Dispatcher — runs BR-1..BR-6 validation |
| POST | `/api/trips/:id/complete` | Dispatcher — runs BR-7 |
| POST | `/api/trips/:id/cancel` | Dispatcher — runs BR-8 |

### 5.5 Maintenance
| Method | Route | Access |
|---|---|---|
| GET | `/api/maintenance` | Fleet Manager, Financial Analyst |
| POST | `/api/maintenance` | Fleet Manager — triggers BR-9 |
| POST | `/api/maintenance/:id/close` | Fleet Manager — triggers BR-10 |

### 5.6 Fuel Logs & Expenses
| Method | Route | Access |
|---|---|---|
| GET / POST | `/api/fuel-logs` | Financial Analyst |
| GET / POST | `/api/expenses` | Financial Analyst |

### 5.7 Dashboard & Reports
| Method | Route | Description |
|---|---|---|
| GET | `/api/dashboard/kpis` | Returns all KPI values (see §7) |
| GET | `/api/reports/fuel-efficiency` | Per-trip / per-vehicle efficiency |
| GET | `/api/reports/operational-cost` | Per-vehicle cost roll-up |
| GET | `/api/reports/roi` | Per-vehicle ROI |
| GET | `/api/reports/export/csv?type=` | Streams CSV for the requested report type |

## 6. Core Business Logic — Implementation Notes

```js
// controllers/tripController.js

exports.dispatchTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('vehicle driver');
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    const { vehicle, driver } = trip;

    if (vehicle.status !== 'available') {
      return res.status(400).json({ message: 'Vehicle is not available.' }); // BR-2, BR-4
    }
    if (driver.status !== 'available') {
      return res.status(400).json({ message: 'Driver is not available.' }); // BR-4
    }
    if (driver.status === 'suspended' || driver.licenseExpiryDate < new Date()) {
      return res.status(400).json({ message: 'Driver is suspended or license expired.' }); // BR-3
    }
    if (trip.cargoWeight > vehicle.maxLoadCapacity) {
      return res.status(400).json({ message: 'Cargo weight exceeds vehicle capacity.' }); // BR-5
    }

    // Atomic-ish update — use a MongoDB session/transaction in production
    vehicle.status = 'on_trip';
    driver.status = 'on_trip';
    trip.status = 'dispatched';

    await Promise.all([vehicle.save(), driver.save(), trip.save()]); // BR-6

    res.json(trip);
  } catch (err) {
    next(err);
  }
};

exports.completeTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('vehicle driver');
    const { actualDistance, fuelConsumed } = req.body;

    trip.actualDistance = actualDistance;
    trip.fuelConsumed = fuelConsumed;
    trip.status = 'completed';

    trip.vehicle.odometer += actualDistance;
    trip.vehicle.status = 'available'; // BR-7
    trip.driver.status = 'available';  // BR-7

    await Promise.all([trip.vehicle.save(), trip.driver.save(), trip.save()]);
    res.json(trip);
  } catch (err) {
    next(err);
  }
};

exports.cancelTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findById(req.params.id).populate('vehicle driver');

    if (trip.status === 'dispatched') {
      trip.vehicle.status = 'available'; // BR-8
      trip.driver.status = 'available';  // BR-8
      await Promise.all([trip.vehicle.save(), trip.driver.save()]);
    }
    trip.status = 'cancelled';
    await trip.save();

    res.json(trip);
  } catch (err) {
    next(err);
  }
};
```

```js
// controllers/maintenanceController.js

exports.createMaintenance = async (req, res, next) => {
  try {
    const maintenance = await Maintenance.create({ ...req.body, status: 'open' });
    await Vehicle.findByIdAndUpdate(maintenance.vehicle, { status: 'in_shop' }); // BR-9
    res.status(201).json(maintenance);
  } catch (err) {
    next(err);
  }
};

exports.closeMaintenance = async (req, res, next) => {
  try {
    const maintenance = await Maintenance.findById(req.params.id).populate('vehicle');
    maintenance.status = 'closed';
    maintenance.dateEnd = new Date();
    await maintenance.save();

    if (maintenance.vehicle.status !== 'retired') {
      maintenance.vehicle.status = 'available'; // BR-10
      await maintenance.vehicle.save();
    }

    res.json(maintenance);
  } catch (err) {
    next(err);
  }
};
```

**Mongoose-level enforcement (defense in depth, mirrors BR-1):**
```js
// models/Vehicle.js
registrationNumber: { type: String, required: true, unique: true, index: true }
```

> Note: `unique: true` in Mongoose creates a MongoDB unique index — it is a database-level guarantee, not just an application check. Combine with a try/catch around `E11000 duplicate key` errors in the controller to return a clean 400 response instead of a raw MongoDB error.

## 7. KPI / Report Computation

| KPI | Formula |
|---|---|
| Active Vehicles | `count(Vehicle)` where `status != 'retired'` |
| Available Vehicles | `count(Vehicle, status='available')` |
| Vehicles in Maintenance | `count(Vehicle, status='in_shop')` |
| Active Trips | `count(Trip, status='dispatched')` |
| Pending Trips | `count(Trip, status='draft')` |
| Drivers On Duty | `count(Driver, status='on_trip')` |
| Fleet Utilization % | `(vehicles on_trip / total active vehicles) × 100` |
| Fuel Efficiency | `trip.actualDistance / trip.fuelConsumed` |
| Operational Cost (per vehicle) | `Σ fuelLog.cost + Σ maintenance.cost + Σ expense.amount` |
| Vehicle ROI | `(Σ trip.revenue − (Σ maintenance.cost + Σ fuelLog.cost)) / vehicle.acquisitionCost` |

Implementation: MongoDB aggregation pipelines (`$match`, `$group`, `$lookup`) in `reportController.js`, exposed via the `/api/reports/*` and `/api/dashboard/kpis` endpoints.

## 8. Authentication & RBAC

- **Login flow:** `POST /api/auth/login` → verify `bcrypt.compare(password, user.passwordHash)` → sign JWT with `{ id, role }` payload → client stores token (e.g. `localStorage` on the frontend, or an httpOnly cookie for stronger security).
- **`authMiddleware.js`:** verifies JWT on every protected route, attaches `req.user`.
- **`roleMiddleware.js`:** `requireRole('fleet_manager', 'dispatcher')` — rejects with `403` if `req.user.role` isn't in the allowed list.

| Role | Permissions |
|---|---|
| `fleet_manager` | Full CRUD: Vehicle, Maintenance; Read: Trip, Fuel/Expense |
| `dispatcher` | Full CRUD: Trip; Read-only: Vehicle, Driver |
| `safety_officer` | Full CRUD: Driver; Read-only: Trip |
| `financial_analyst` | Full CRUD: Fuel Log, Expense; Read-only: everything (for reports) |

## 9. Frontend Architecture (HTML/CSS/JavaScript)

- **Structure:** one HTML page per module (multi-page app, no build step required) — simpler to demo and debug than a SPA framework for this scope.
- **`js/api.js`:** centralized `fetch` wrapper that attaches the JWT (`Authorization: Bearer <token>`) to every request and handles 401 redirects to login.
- **`js/dashboard.js`:** fetches `/api/dashboard/kpis` on load, renders KPI cards; can use `<canvas>` + a lightweight charting approach (e.g. Chart.js via CDN) for Fleet Utilization visualization.
- **Role-based UI:** after login, decode the JWT payload (or call `/api/auth/me`) and conditionally show/hide nav links and action buttons per role — but always enforce the real permission check server-side too (never trust the frontend alone).
- **Styling:** `css/style.css` for layout/typography, `css/components.css` for reusable components (cards, tables, badges, buttons) — keep it clean and consistent (a small design-token approach: define CSS variables for colors/spacing at the top of `style.css`).

## 10. Non-Functional Requirements
- **Validation:** both client-side (basic UX feedback) and server-side (source of truth) — never rely on frontend validation alone for business rules.
- **Error handling:** centralized Express error-handling middleware (`errorMiddleware.js`) returning consistent `{ message, status }` JSON shape.
- **Environment config:** `.env` for `MONGO_URI`, `JWT_SECRET`, `PORT` — never hardcode secrets.
- **Password security:** bcrypt with salt rounds ≥ 10; never store or log plaintext passwords.
- **CORS:** enable `cors` middleware scoped to the frontend's origin.
- **Logging:** `morgan` for request logs in development.

## 11. Demo Scenario (End-to-End Validation Script)
1. Register vehicle `Van-05`, capacity 500 kg → status `available`
2. Register driver `Alex`, valid license
3. Create trip, cargo weight 450 kg (as `draft`)
4. Attempt dispatch with 550 kg cargo first → API returns `400` (BR-5 blocked), then correct to 450 kg → dispatch succeeds
5. Confirm Vehicle + Driver auto-flip to `on_trip` in the database
6. Complete trip (enter odometer + fuel consumed) → both auto-flip to `available`
7. Create maintenance record (Oil Change) → vehicle auto-flips to `in_shop`, disappears from a new trip's vehicle dropdown
8. Close maintenance → vehicle back to `available`
9. Check Reports: Fuel Efficiency and Operational Cost reflect the above

## 12. Suggested Build Order
1. Project scaffold (`backend/` + `frontend/`), MongoDB connection, `.env` setup
2. `User` model + auth (register/login/JWT) + `authMiddleware` + `roleMiddleware`
3. `Vehicle` and `Driver` models + CRUD routes/controllers + basic frontend pages
4. `Trip` model + full lifecycle logic (BR-1 to BR-8)
5. `Maintenance` model + BR-9/BR-10 sync logic
6. `FuelLog` + `Expense` models + operational cost aggregation
7. Dashboard KPIs endpoint + frontend dashboard page
8. Reports endpoints (Fuel Efficiency, Utilization, ROI) + CSV export
9. RBAC polish across all routes + run through §11 demo scenario end-to-end
10. Styling pass, responsiveness check, final bug fixes

---

**End of TRD.** See companion document `TransitOps_PRD.md` for product scope and business rationale.
