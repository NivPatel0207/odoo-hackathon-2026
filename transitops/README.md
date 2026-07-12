# TransitOps

A comprehensive logistics and fleet management platform designed for Odoo Hackathon 2026.

## Prerequisites

Before running this application, ensure you have the following installed on your machine:
- **Node.js** (v16 or higher)
- **MongoDB** (Local instance running on the default port `27017`)

---

## 🛠️ Setup Instructions

### 1. Backend Setup

Open a terminal and navigate to the backend directory:
```bash
cd c:\Users\nivpa\odoo-hackathon-2026\transitops\backend
```

**Install Dependencies:**
```bash
npm install
```

**Environment Variables:**
Ensure that your `.env` file inside the `backend` directory contains the following configuration:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/transitops
JWT_SECRET=transitops_super_secret_jwt_key_2026
JWT_EXPIRE=7d
NODE_ENV=development
```

**Seed the Database (One-time only):**
This will populate the database with default users (roles), sample vehicles, drivers, and initial trips.
```bash
npm run seed
```

**Clear the Database:**
If you ever want to wipe all operational data (Vehicles, Drivers, Trips, Fuel, Maintenance) but keep your User accounts so you can start fresh, run:
```bash
npm run clear
```

**Start the Backend Server:**
```bash
npm run dev
```
*The server will start on `http://localhost:5000`.*

---

### 2. Frontend Setup

The frontend is built with pure HTML, CSS, and Vanilla JavaScript. It doesn't require any build step.

You can run the frontend in one of two ways:

**Method A: Simple File Open (Recommended for quick view)**
- Simply double-click the `c:\Users\nivpa\odoo-hackathon-2026\transitops\frontend\index.html` file to open it in your browser.

**Method B: Local Live Server (Recommended for active development)**
- Use an extension like **Live Server** in VS Code.
- Right-click `index.html` and select **"Open with Live Server"**.

---

## 🔐 Demo Credentials

When you navigate to the Login page (`index.html`), you can use the "Demo Accounts" auto-filler buttons to quickly log in with specific roles, or enter them manually:

- **Fleet Manager:** `manager@transitops.com` / `password123`
- **Dispatcher:** `dispatcher@transitops.com` / `password123`
- **Safety Officer:** `safety@transitops.com` / `password123`
- **Financial Analyst:** `finance@transitops.com` / `password123`

---

## ⚙️ Architecture

- **Backend:** Node.js, Express, MongoDB/Mongoose.
  - Implements secure JWT authentication & Role-Based Access Control (RBAC).
  - Business rules are strictly enforced at the controller level (e.g. blocking vehicle overload, enforcing maintenance cycles).
- **Frontend:** Vanilla JS fetching REST APIs.
  - Beautiful, responsive glassmorphism UI using modern CSS variables.
  - Modularized Javascript (`auth.js`, `api.js`, `trips.js`, etc.) handling API interactions gracefully with loading states and toast notifications.
