# TransitOps — Smart Transport Operations Platform
## Product Requirements Document (PRD)

**Project Type:** Personal Project
**Version:** 1.0

---

## 1. Problem Statement

Logistics companies commonly run transport operations on spreadsheets and paper logbooks. This causes:
- Scheduling conflicts (double-booked vehicles/drivers)
- Underutilized vehicles
- Missed maintenance windows
- Expired driver licenses going unnoticed
- Inaccurate expense tracking
- Poor operational visibility for management

## 2. Product Vision

A centralized web platform ("TransitOps") that digitizes the full lifecycle of transport operations — vehicle registration, driver management, trip dispatching, maintenance, fuel/expense logging — while enforcing hard business rules automatically (no double-assignment, no over-capacity cargo, no expired-license dispatch) and surfacing operational KPIs in real time.

## 3. Target Users / Personas

| Role | Goals | Key Screens Used |
|---|---|---|
| **Fleet Manager** | Oversee fleet assets, maintenance, lifecycle, utilization | Dashboard, Vehicle Registry, Maintenance |
| **Dispatcher (Driver-user)** | Create trips, assign vehicle+driver, monitor active deliveries | Trip Management, Dashboard |
| **Safety Officer** | Track license validity, driver compliance, safety scores | Driver Management, Dashboard |
| **Financial Analyst** | Review expenses, fuel cost, maintenance cost, profitability | Fuel & Expense, Reports |

> Note: the original brief lists "Driver" as a user persona who *creates trips* — in practice this behaves like a **Dispatcher**. We treat it as a distinct application role (`dispatcher`) separate from the **Driver master record** (the person who physically drives, tracked under Driver Management). This avoids ambiguity between "driver-the-user" and "driver-the-resource."

## 4. Scope

### 4.1 In Scope (Core Deliverables)
1. Authentication with Role-Based Access Control (RBAC)
2. Dashboard with KPIs + filters (vehicle type, status, region)
3. Vehicle Registry (CRUD)
4. Driver Management (CRUD)
5. Trip Management with full validation and lifecycle
6. Maintenance workflow with automatic status sync
7. Fuel & Expense logging with automatic cost roll-up
8. Reports & Analytics (Fuel Efficiency, Fleet Utilization, Operational Cost, Vehicle ROI) with CSV export
9. Responsive web UI

### 4.2 Nice-to-Have (Later Iteration)
- PDF export of reports
- Email reminders for expiring licenses
- Vehicle document management (file uploads, attachments)
- Advanced search/sort/filter
- Dark mode

### 4.3 Explicitly Not in Scope
- Payroll / driver salary processing
- Route optimization / GPS live tracking
- Customer-facing booking portal
- Invoicing / accounting integration (financial *analysis* only, not accounting ledgers)

## 5. User Stories

| ID | As a... | I want to... | So that... |
|---|---|---|---|
| US-01 | Fleet Manager | register a vehicle with a unique registration number | I can track it in the fleet |
| US-02 | Safety Officer | see driver license expiry at a glance | I can prevent non-compliant dispatch |
| US-03 | Dispatcher | create a trip only with available vehicle+driver | I never double-book a resource |
| US-04 | Dispatcher | be blocked if cargo weight exceeds vehicle capacity | I avoid unsafe/overloaded trips |
| US-05 | Fleet Manager | log a maintenance record | the vehicle is automatically pulled from dispatch pool |
| US-06 | Financial Analyst | see total operational cost per vehicle | I can evaluate profitability (ROI) |
| US-07 | Any authenticated user | see role-appropriate KPIs on a dashboard | I get instant operational visibility |
| US-08 | Financial Analyst | export reports to CSV | I can share data outside the platform |

## 6. Functional Requirements

**6.1 Authentication**
- Email/password login (hashed passwords, token-based session)
- RBAC: Fleet Manager, Dispatcher, Safety Officer, Financial Analyst
- No unauthenticated access to any module or API route

**6.2 Dashboard**
- KPIs: Active Vehicles, Available Vehicles, Vehicles in Maintenance, Active Trips, Pending Trips, Drivers On Duty, Fleet Utilization %
- Filters: vehicle type, status, region

**6.3 Vehicle Registry**
- Fields: Registration Number (unique), Name/Model, Type, Max Load Capacity, Odometer, Acquisition Cost, Status
- Status enum: `Available | On Trip | In Shop | Retired`

**6.4 Driver Management**
- Fields: Name, License Number, License Category, License Expiry Date, Contact Number, Safety Score, Status
- Status enum: `Available | On Trip | Off Duty | Suspended`

**6.5 Trip Management**
- Create trip: source, destination, vehicle (available only), driver (available only), cargo weight, planned distance
- Lifecycle: `Draft → Dispatched → Completed → Cancelled`

**6.6 Maintenance**
- Create maintenance record per vehicle
- Active maintenance record ⇒ vehicle auto-flips to `In Shop`, removed from dispatch pool

**6.7 Fuel & Expense Management**
- Fuel logs: liters, cost, date
- Other expenses: tolls, maintenance costs
- Auto-computed Total Operational Cost = Fuel + Maintenance (per vehicle)

**6.8 Reports & Analytics**
- Fuel Efficiency = Distance / Fuel
- Fleet Utilization
- Operational Cost
- Vehicle ROI = (Revenue − (Maintenance + Fuel)) / Acquisition Cost
- CSV export mandatory; PDF optional (future iteration)

## 7. Business Rules (Hard Validations — must never be bypassable)

| # | Rule |
|---|---|
| BR-1 | Vehicle registration number is globally unique |
| BR-2 | Retired or In Shop vehicles are excluded from dispatch selection lists |
| BR-3 | Drivers with expired license OR Suspended status cannot be assigned to trips |
| BR-4 | A vehicle/driver already `On Trip` cannot be assigned to a second trip |
| BR-5 | Cargo Weight ≤ Vehicle Max Load Capacity (hard block, not a warning) |
| BR-6 | Dispatch action ⇒ vehicle + driver status → `On Trip` (atomic) |
| BR-7 | Complete action ⇒ vehicle + driver status → `Available` (atomic) |
| BR-8 | Cancel (from Dispatched) ⇒ vehicle + driver status → `Available` (atomic) |
| BR-9 | Create active Maintenance record ⇒ vehicle status → `In Shop` |
| BR-10 | Close Maintenance ⇒ vehicle status → `Available`, **unless** vehicle is `Retired` |

## 8. Success Metrics
- All BR-1 through BR-10 demonstrably enforced through the API (not just documented)
- End-to-end workflow (see §10 Demo Scenario in TRD) runs without manual database edits
- Dashboard KPIs update in real time after each transaction
- All 4 roles show visibly different access/permissions in the UI

## 9. Assumptions & Open Questions
- "Region" filter has no defined field elsewhere in the original brief → we add a `region` field on Vehicle (simple string/enum) to support the filter, since no master data for regions is specified.
- "Revenue" (used in the ROI formula) is not otherwise defined as a captured field → we add a `revenue` field on Trip (Financial Analyst editable) to make ROI computable.
- Single-organization deployment assumed (no multi-tenancy requirement).
- Assume a trip has exactly one vehicle and one driver (no multi-leg / multi-vehicle trips).

---

**End of PRD.** See companion document `TransitOps_TRD.md` for the technical implementation plan (Node.js + Express.js + MongoDB backend, HTML/CSS/JavaScript frontend).
