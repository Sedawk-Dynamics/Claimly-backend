FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (including dev dependencies needed for Prisma generation)
RUN npm ci --only=production=false

# Copy Prisma schema first (needed for generation)
COPY src/prisma ./src/prisma
COPY tsconfig.json ./

# Generate Prisma Client with placeholder URL to avoid caching wrong connection
# Prisma Client will use runtime DATABASE_URL via datasources config in prismaClient.ts
RUN DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" \
    npm run prisma:generate

# Copy remaining source files
COPY src ./src

# Build the TypeScript project
RUN npm run build

# Remove dev dependencies (Prisma CLI will be kept as it's needed for migrations)
RUN npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set production environment
ENV NODE_ENV=production

# Copy built application
COPY --from=deps --chown=nodejs:nodejs /app/package.json /app/package-lock.json ./
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/dist ./dist
COPY --from=deps --chown=nodejs:nodejs /app/src/prisma ./src/prisma

# Copy scripts and config (needed for production troubleshooting)
COPY --chown=nodejs:nodejs scripts ./scripts
COPY --chown=nodejs:nodejs tsconfig.json ./

# Install ts-node globally for running scripts (as root, then switch user)
RUN npm install -g ts-node typescript

# Create uploads directory with proper permissions
RUN mkdir -p uploads/users uploads/policies uploads/nominees uploads/receipts && \
    chown -R nodejs:nodejs uploads

# Create logs directory
RUN mkdir -p logs && \
    chown -R nodejs:nodejs logs

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
# Prisma Client will use runtime DATABASE_URL from environment via datasources config
# See src/config/prismaClient.ts for how runtime DATABASE_URL is used
CMD ["node", "dist/index.js"]
