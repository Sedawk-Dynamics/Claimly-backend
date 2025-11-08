FROM node:20-bullseye AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

# Build the TypeScript project with dev dependencies available
RUN npm run build

# Remove dev dependencies before copying to the runtime image
RUN npm prune --omit=dev

FROM node:20-bullseye AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/dist ./dist
COPY --from=deps /app/src/prisma ./src/prisma
COPY uploads ./uploads

EXPOSE 3000

CMD ["node", "dist/index.js"]

