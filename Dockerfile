# ==========================================
# Phase 1: Build & Prepare
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install standard dependencies
RUN npm ci

# Generate DB Client definitions early to secure TypeScript type assertions
RUN npx prisma generate

# Copy the rest of the application files
COPY . .

# Build the application (Runs Vite asset compile + server bundler)
RUN npm run build

# ==========================================
# Phase 2: Production Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Ensure production node variables match deployment standards
ENV NODE_ENV=production
ENV PORT=3000

# Copy output files and dependencies from Phase 1
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Ensure generator files are in place in the runner stage
RUN npx prisma generate

# Open up standard 3000 port
EXPOSE 3000

# Automate SQLite database migration or updates, run seeds, and boot up the Express server
CMD npx prisma db push && npx tsx prisma/seed.ts && npm start
