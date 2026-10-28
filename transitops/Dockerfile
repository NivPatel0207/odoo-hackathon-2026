# ---------------------------------------
# Stage 1: Build & Dependencies
# ---------------------------------------
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies only when package.json changes
COPY backend/package*.json ./
RUN npm ci --only=production

# ---------------------------------------
# Stage 2: Production Image
# ---------------------------------------
FROM node:18-alpine

# Set node environment to production
ENV NODE_ENV=production

WORKDIR /usr/src/app

# Copy dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy backend source code
COPY backend ./backend

# Install PM2 globally for process management
RUN npm install -g pm2

# Expose API port
EXPOSE 5000

# Run using PM2 ecosystem
CMD ["pm2-runtime", "backend/server.js", "-i", "max"]
