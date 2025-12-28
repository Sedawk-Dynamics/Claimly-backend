# ---- Stage 1: Dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app

# Install OpenSSL and other required libs
RUN apk add --no-cache openssl libssl3

COPY package*.json tsconfig.json ./
COPY prisma ./prisma

RUN npm install
RUN npx prisma generate

# ---- Stage 2: Build ----
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libssl3

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

RUN npm run build

# ---- Stage 3: Runtime ----
FROM node:22-alpine AS runner
WORKDIR /app

# ✅ Add OpenSSL runtime libs
RUN apk add --no-cache openssl libssl3

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/logo ./logo

# Verify logo file was copied
RUN ls -la /app/logo/ || echo "Warning: Logo directory not found"
RUN test -f "/app/logo/claimly logo png.png" && echo "✅ Logo file found" || echo "❌ Logo file not found"

RUN npm install --omit=dev

RUN mkdir -p /app/uploads
RUN mkdir -p /app/logo
VOLUME ["/app/uploads"]

ENV NODE_ENV=production
EXPOSE 3000

# Run migrations & start app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]    