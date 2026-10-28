# TransitOps — Project Knowledge Base & Architecture Reference

> **Generated:** October 2026  
> **Location:** Root Workspace (`c:/Users/nivpa/odoo-hackathon-2026/PROJECT_KNOWLEDGE_BASE.md`)  
> **Companion Document:** Artifact `project_analysis.md`

This document serves as the persistent, comprehensive technical specification and architectural blueprint for the TransitOps codebase so agents and developers do not need to re-scan the entire project repeatedly.

---

## 1. Quick Reference & Core Facts

- **App Name:** TransitOps (Smart Transport Operations Platform — Odoo Hackathon 2026)
- **Architecture:** Node.js Express REST API (`/api/v1`) + MongoDB (Mongoose 8.4) + Vanilla JS / CSS3 (no framework/build step) + Nginx reverse proxy + Docker / K8s.
- **Port:** Backend runs on `5000` (or `PORT`), Nginx on `80`.
- **Database:** MongoDB default `mongodb://127.0.0.1:27017/transitops`.
- **Auth:** JWT Bearer tokens in `Authorization` header, rate limited, 15-minute idle session timeout.
- **Demo Users (Password: `password123`):**
  - `manager@transitops.com` (`fleet_manager`)
  - `dispatcher@transitops.com` (`dispatcher`)
  - `safety@transitops.com` (`safety_officer`)
  - `analyst@transitops.com` (`financial_analyst`)
  - `driver@transitops.com` (`driver`)

---

## 2. Directory Structure Map

```
odoo-hackathon-2026/
├── Documents/
│   ├── TransitOps_PRD.pdf, TransitOps_TRD.pdf, TransitOps_SRS.pdf, etc.
│   ├── file formate/ (TransitOps_PRD.md, TransitOps_TRD.md)
│   └── presentation/ (TransitOps_Pitch_Deck.pptx)
├── PROJECT_KNOWLEDGE_BASE.md    <-- You are here
└── transitops/
    ├── .env.development, .env.staging, .env.production
    ├── Dockerfile, docker-compose.yml, ecosystem.config.js, DEPLOYMENT.md
    ├── k8s/ (deployment.yaml, service.yaml)
    ├── nginx/ (nginx.conf)
    ├── backend/
    │   ├── server.js            # Express server bootstrap & routes
    │   ├── seed.js, clear.js    # Data seeding and reset scripts
    │   ├── config/ (db.js, env.js)
    │   ├── constants/ (index.js)
    │   ├── models/              # 15 Mongoose models (User, Vehicle, Driver, Trip, etc.)
    │   ├── controllers/         # 14 controllers (driverPortal, trip, auth, vehicle, etc.)
    │   ├── routes/              # 14 route modules
    │   ├── services/            # tripService.js, authService.js, baseService.js
    │   ├── repositories/        # tripRepository.js, userRepository.js, baseRepository.js
    │   ├── middleware/          # authMiddleware, roleMiddleware, cacheMiddleware, validate, errorMiddleware
    │   ├── validators/          # entityValidators.js, authValidator.js (Zod)
    │   ├── utils/               # applyBaseSchema.js, encryption.js, logger.js, auditLogger.js
    │   └── scripts/             # 10 Phase test scripts + test_critical_remediation.js
    └── frontend/
        ├── index.html           # Login & password reset
        ├── 16 Fleet Views       # dashboard, dispatch, trips, vehicles, drivers, maintenance, etc.
        ├── 14 Driver Views      # driver-dashboard, driver-trips, driver-duty, driver-deliveries, etc.
        ├── css/ (style.css, components.css)
        └── js/
            ├── config.js        # API_BASE_URL: http://localhost:5000/api/v1
            ├── store.js         # appStore observer state
            ├── services/        # api.js, auth.js, offline.js
            ├── utils/           # ui-components.js, constants.js, debounce.js
            └── pages/           # 29 controller scripts for each HTML view
```

---

## 3. Data Models & Schemas

All 15 Mongoose schemas use `applyBaseSchema(schema)`:
- `mongoose-delete`: Adds soft delete flags (`deleted`, `deletedAt`, `deletedBy`).
- `mongoose-update-if-current`: Optimistic locking via `__v`.
- `createdBy`, `updatedBy` user references.
- Timestamps indexed.

### Sensitive Data Encryption
Driver PII (`licenseNumber`, `contactNumber`, `kyc.aadharNumber`) is encrypted at rest using AES-256-CBC via `mongooseFieldEncryption` keyed by `process.env.ENCRYPTION_SECRET`. Server throws a fatal boot error if `ENCRYPTION_SECRET` is missing.

---

## 4. Key Business Rules (BR Engine)

- **BR-1 & BR-2:** Vehicle and Driver must exist and cannot be in `retired` or `suspended` status.
- **BR-3 & BR-4:** Assets must be `available` (or `draft`) to be assigned or dispatched; driver license expiry date must be in the future.
- **BR-5:** Cargo weight cannot exceed vehicle `maxLoadCapacity`.
- **BR-6:** Scheduling conflicts strictly blocked: overlapping non-terminal trips for the same vehicle or driver in window `[scheduledDate, eta]` throw an error with the conflicting `tripCode`.
- **BR-7:** Trip State Machine: `draft` → `assigned` → `accepted` → `loading` → `dispatched` → `in_transit` → `arrived` → `delivered` → `completed`. Terminal trips cannot be modified.
- **BR-8:** Pre-trip safety inspection check: If critical items (`brakes`, `tyres`, `engine`, `headlights`) fail, the vehicle is grounded to `in_shop` and trip marked `delayed`.
- **BR-9:** Maintenance ticket creation blocked if vehicle is currently `on_trip` or `retired`.
- **BR-10:** Mileage warning triggered when vehicle odometer is within 500 km of `nextMaintenanceMileage`.
- **BR-11:** IDOR prevention: Driver portal endpoints restrict access exclusively to the authenticated driver's linked profile.
- **BR-12 (Driver Account Automation):** On driver hiring/creation, login ID is automatically generated from the normalized license number (`driver.<cleanLicense>@transitops.com`) with memorable password `Transit@2026`. A linked `User` record (`role: 'driver'`, `driverProfileId: driver._id`) is atomically created. Deleting a driver cascades deletion to the linked user account; `npm run clear` wipes all driver `User` records while preserving staff accounts.
- **BR-13 (Company-Wide Payroll & Settlement Engine):** Fleet Managers and Financial Analysts disburse salaries and settlements to all company members (drivers via per-trip/monthly settlements and staff via fixed monthly salaries). Payouts atomically generate a `Settlement` voucher (`status: 'paid'`), calculate live adjustments ($Base + Bonus - Deductions$), mark settled trips, and immediately reflect in the Driver Portal (`driver-earnings.html`) under Total Earned & Settlement History while resetting Pending Payout.

---

## 5. Architectural Findings & Note for Next Tasks

1. **Unmounted Routes in `server.js`**:
   The following routes are implemented in `backend/routes/` and called by frontend pages, but need to be mounted in `backend/server.js`:
   - `v1Router.use('/documents', require('./routes/documentRoutes'));`
   - `v1Router.use('/incidents', require('./routes/incidentRoutes'));`
   - `v1Router.use('/tracking', require('./routes/trackingRoutes'));`
2. **Test Scripts Runner**:
   11 test scripts exist in `backend/scripts/` (`test_phase1.js` to `test_phase10.js` + `test_critical_remediation.js`).
3. **Role Constants**:
   `constants/index.js` lists `['admin', 'dispatcher', 'fleet_manager', 'driver', 'analyst']`. The active system roles are: `['fleet_manager', 'dispatcher', 'safety_officer', 'financial_analyst', 'viewer', 'driver']`.
