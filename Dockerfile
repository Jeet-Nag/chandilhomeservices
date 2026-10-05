# ============================================================
# Stage 1: Build client and server artifacts
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests for workspace installation
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install all dependencies (including devDependencies required for compilation)
RUN npm ci

# Copy shared code, TypeScript configs, and workspace sources
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY client/ ./client/
COPY server/ ./server/

# Compile frontend client SPA (outputs to /app/client/dist)
RUN npm --workspace=client run build

# Compile backend Fastify server (outputs to /app/server/dist)
RUN npm --workspace=server run build

# ============================================================
# Stage 2: Clean Production Dependencies
# ============================================================
FROM node:22-alpine AS prod-deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install strictly production dependencies
RUN npm ci --omit=dev

# ============================================================
# Stage 3: Production Runtime
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Standard production defaults (all overridable via container environment)
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV AUDIO_UPLOAD_DIR=/app/uploads

# Setup audio storage directory and ensure ownership by non-root node user
RUN mkdir -p /app/uploads/audio && chown -R node:node /app

# Copy production node_modules and root package definition
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/package.json ./package.json

# Copy compiled server and client distributions
COPY --from=builder --chown=node:node /app/server/package.json ./server/package.json
COPY --from=builder --chown=node:node /app/server/dist ./server/dist
COPY --from=builder --chown=node:node /app/server/src/db/migrations ./server/dist/server/src/db/migrations
COPY --from=builder --chown=node:node /app/server/src/db/seeds ./server/dist/server/src/db/seeds
COPY --from=builder --chown=node:node /app/client/dist ./client/dist

# Switch to non-root node user for security
USER node

# Declare volume for persistent audio uploads
VOLUME ["/app/uploads"]

# Expose default HTTP port
EXPOSE 3000

# Run database migrations and seeds via existing Migrator, then launch Fastify production server
CMD ["sh", "-c", "node --input-type=module -e \"import { Migrator } from './server/dist/server/src/db/migrator.js'; let migrator; try { migrator = new Migrator(); const res = await migrator.runMigrations(); console.log('[Migrator] Applied ' + res.applied.length + ' migrations, skipped ' + res.skipped.length + ' existing.'); const seeds = await migrator.runSeeds(); console.log('[Migrator] Executed ' + seeds.length + ' seed files.'); await migrator.close(); } catch (err) { console.error('[Migrator] Fatal migration error:', err); if (migrator) await migrator.close().catch(() => {}); process.exit(1); }\" && exec node server/dist/index.js"]

