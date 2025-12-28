# syntax=docker/dockerfile:1

ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app

# -------------------------
# Dependencies + Prisma Client (build-time)
# -------------------------
FROM base AS deps

# Native deps for packages like bcrypt (node-gyp) on Alpine
RUN apk add --no-cache python3 make g++ openssl

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Prisma schema is required for `postinstall` Prisma Client generation
COPY src/prisma ./src/prisma

# Install dependencies (this runs `postinstall` -> `prisma generate`)
# Use a build-time placeholder URL so Prisma can generate without leaking runtime secrets.
ARG PRISMA_DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
RUN DATABASE_URL="${PRISMA_DATABASE_URL}" npm ci

# -------------------------
# Development image (hot reload)
# -------------------------
FROM deps AS development

ENV NODE_ENV=development

COPY tsconfig.json ./tsconfig.json
COPY nodemon.json ./nodemon.json
COPY scripts ./scripts
COPY src ./src

# Create folders used at runtime
RUN mkdir -p uploads/users uploads/policies uploads/nominees uploads/receipts logs

EXPOSE 3000

CMD ["npm", "run", "dev"]

# -------------------------
# Build (TypeScript -> dist)
# -------------------------
FROM deps AS build

COPY tsconfig.json ./tsconfig.json
COPY scripts ./scripts
COPY src ./src

RUN npm run build

# Remove dev dependencies for runtime image
RUN npm prune --omit=dev

# -------------------------
# Production runtime
# -------------------------
FROM base AS runner

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set production environment
ENV NODE_ENV=production

# Copy built application + production deps
COPY --from=build --chown=nodejs:nodejs /app/package.json /app/package-lock.json ./
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/src/prisma ./src/prisma
COPY --from=build --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=build --chown=nodejs:nodejs /app/tsconfig.json ./tsconfig.json

# Install ts-node globally for running scripts (as root, then switch user)
RUN npm install -g ts-node typescript

# Create uploads + logs directories with proper permissions
RUN mkdir -p uploads/users uploads/policies uploads/nominees uploads/receipts logs && \
    chown -R nodejs:nodejs uploads logs

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const port=process.env.PORT||3000;require('http').get(`http://localhost:${port}/live`,(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1));"

# Start the application
# Prisma Client will use runtime DATABASE_URL from environment via datasources config
# See src/config/prismaClient.ts for how runtime DATABASE_URL is used
CMD ["node", "dist/index.js"]
