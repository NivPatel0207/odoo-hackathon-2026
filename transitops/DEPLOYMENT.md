# TransitOps Production Deployment Guide

## 1. Environments & Secrets Management
- We use strict environment separation: `.env.development`, `.env.staging`, `.env.production`.
- **Never** commit production secrets to Git. In production, use AWS Secrets Manager or HashiCorp Vault to inject `MONGO_URI`, `JWT_SECRET`, and `ENCRYPTION_SECRET` into the Docker containers at runtime.

## 2. Docker & Compose Setup
- A multi-stage `Dockerfile` handles the build and strips `devDependencies`.
- `docker-compose up -d` handles standing up the Nginx Reverse Proxy, the Node.js API, and MongoDB in a unified network.

## 3. Kubernetes Scaling
If traffic exceeds a single machine, we utilize the manifests in `/k8s/`:
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```
The deployment specifies a minimum of 3 replicas with readiness/liveness probes and CPU/Memory limits.

## 4. Disaster Recovery & Backups
- A backup script is located at `backend/scripts/backup.js`.
- Run a cron job on the database host to execute `mongodump` daily.
- If a catastrophic failure occurs, use `mongorestore` to recover from the latest daily dump.

## 5. CI/CD & Rollbacks
- GitHub Actions automatically builds and tests code on every pull request to `main`.
- If a bad deployment occurs, revert the Git commit, wait for CI to build the previous image tag, and restart the pods via Kubernetes (`kubectl rollout undo deployment transitops-api`) or Docker Compose.
