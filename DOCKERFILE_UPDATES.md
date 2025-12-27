# Dockerfile Updates for Prisma Client Runtime DATABASE_URL

## Changes Made

### 1. Prisma Client Generation During Build
- Prisma Client is generated with a placeholder DATABASE_URL during build
- This prevents caching the wrong connection string
- The actual DATABASE_URL is provided at runtime via environment variables

### 2. Runtime DATABASE_URL Usage
- Prisma Client uses runtime DATABASE_URL via `datasources` config in `prismaClient.ts`
- No need to regenerate Prisma Client after deployment
- Connection string is read from environment at runtime

### 3. Prisma CLI Available in Production
- Prisma CLI is kept in production for migrations and troubleshooting
- Allows running `npm run prisma:generate` if needed
- Enables database migrations at runtime

## How It Works

1. **Build Time**:
   - Prisma Client is generated with placeholder URL
   - TypeScript is compiled
   - Application is built

2. **Runtime**:
   - Application reads `DATABASE_URL` from environment
   - Prisma Client uses runtime URL via `datasources` config
   - Connection is established with correct hostname and port

## Key Points

- ✅ Prisma Client doesn't cache wrong DATABASE_URL
- ✅ Uses runtime environment variables
- ✅ No need to rebuild when DATABASE_URL changes
- ✅ Prisma CLI available for migrations
- ✅ Proper error handling and logging

## Deployment

When deploying to Dokploy:

1. **Set DATABASE_URL** in environment variables:
   ```
   postgresql://claimlydb:claimly123@claimly-claimlydb-tgyd5o:5432/claimlydb
   ```

2. **Build the Docker image** (Dokploy does this automatically)

3. **Start the container** - Prisma will use the runtime DATABASE_URL

4. **Check logs** - Should show correct connection details

## Verification

After deployment, check logs for:
```
🔌 Prisma Client connecting to: postgresql://claimlydb:***@claimly-claimlydb-tgyd5o:5432/claimlydb
✅ Database connected successfully
```

## Troubleshooting

If connection still fails:

1. **Verify DATABASE_URL** is set correctly in Dokploy
2. **Check logs** for the actual URL being used
3. **Ensure port is 5432**, not 3306
4. **Verify hostname** matches your database service name
5. **Check network** - containers must be on same Docker network

