# TransitOps

Fleet & logistics operations platform — vehicle/driver management, trip lifecycle, fuel & expense tracking, maintenance, and reporting, with role-based access control.

## Tech Stack
- **Backend:** Node.js 18, Express, MongoDB 6.0 (Mongoose)
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Auth:** JWT + bcrypt
- **Docs:** Swagger UI (`/api-docs`)

## Prerequisites
- Node.js 18+
- MongoDB running locally or a connection string
- (Optional) Docker + Docker Compose

## Setup (local)

```bash
cd transitops/backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI and JWT_SECRET
npm run seed     # seeds demo users, vehicles, drivers, trips
npm run dev       # starts API on http://localhost:5000
```

Serve the frontend (`transitops/frontend`) with any static file server, e.g.:
```bash
npx serve transitops/frontend -p 5500
```

## Setup (Docker Compose)

```bash
cd transitops
docker compose up --build
```
Starts `api` (port 5000), `mongo` (port 27017), and `nginx` serving the frontend + proxying the API (port 80).

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | No | `5000` | API port |
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | **Yes** | — | Server refuses to start if unset |
| `JWT_EXPIRE` | No | `7d` | Access token TTL |
| `NODE_ENV` | No | `development` | `production` disables stack traces in errors |
| `FRONTEND_URL` | Recommended in prod | — | CORS allow-list origin |
| `ENCRYPTION_SECRET` | Strongly recommended | insecure fallback | Key for driver PII encryption |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | No | Ethereal test inbox | Password-reset emails |

## Demo Accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Fleet Manager | `manager@transitops.com` | `password123` |
| Dispatcher | `dispatcher@transitops.com` | `password123` |
| Safety Officer | `safety@transitops.com` | `password123` |
| Financial Analyst | `analyst@transitops.com` | `password123` |

## Useful Commands

| Command | Effect |
|---|---|
| `npm run dev` | Start API with nodemon (auto-restart) |
| `npm start` | Start API (production mode, no watch) |
| `npm run seed` | Seed demo data |
| `npm run clear` | Clear database |

## API Docs
- Swagger UI: `http://localhost:5000/api-docs`
- Health check: `GET http://localhost:5000/api/v1/health`
- Full endpoint reference: see `TransitOps_API_Documentation.pdf`

## Project Docs
PRD, TRD, Backend Schema, SRS, API Documentation, ER Diagram, UML Class Diagram, Trip Lifecycle Workflow, UI/UX Theme Guide — all in the project docs folder.

## Deployment
Kubernetes manifests: `k8s/deployment.yaml`, `k8s/service.yaml`. Production container runs via PM2 in cluster mode (`pm2-runtime backend/server.js -i max`).
