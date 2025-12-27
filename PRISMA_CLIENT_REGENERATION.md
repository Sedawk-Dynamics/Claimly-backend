# Prisma Client Regeneration - Fix for Cached DATABASE_URL

## Problem

Prisma Client might be using a cached/old DATABASE_URL even after you update the environment variable. This happens because Prisma Client is generated at build time and may cache the connection string.

## Solution: Regenerate Prisma Client

After updating `DATABASE_URL` in Dokploy, you need to regenerate Prisma Client.

### Option 1: Rebuild the Application (Recommended)

In Dokploy:
1. **Update DATABASE_URL** environment variable
2. **Rebuild** your application service
3. This will regenerate Prisma Client with the new DATABASE_URL

### Option 2: Regenerate in Container

If you can access the container:

```bash
# SSH into your app container
docker exec -it <your-app-container> sh

# Regenerate Prisma Client
npm run prisma:generate

# Restart the application
```

### Option 3: Add to Build Process

Ensure your Dockerfile or build process includes:

```dockerfile
# In your Dockerfile, ensure Prisma Client is generated
RUN npm run prisma:generate
```

## Verification

After regenerating, check the logs. You should see:

```
🔌 Prisma Client connecting to: postgresql://claimlydb:***@claimly-claimlydb-tgyd5o:5432/claimlydb
✅ Database connected successfully
```

**NOT**:
```
Can't reach database server at claimly-claimlydb-08xn8j:3306
```

## Quick Fix Steps

1. **Update DATABASE_URL** in Dokploy:
   ```
   postgresql://claimlydb:claimly123@claimly-claimlydb-tgyd5o:5432/claimlydb
   ```

2. **Rebuild** your application in Dokploy

3. **Check logs** - should show correct hostname and port 5432

4. **Test health endpoint**:
   ```bash
   curl https://api.claimly.co.in/health
   ```

## Why This Happens

Prisma Client is a generated library that includes connection logic. When you generate it:
- It reads `DATABASE_URL` from environment at **build time**
- The connection string can be partially baked into the generated code
- Changing `DATABASE_URL` at runtime might not work if Prisma Client was generated with a different URL

## Prevention

The code now:
1. Forces Prisma to use runtime `DATABASE_URL` via `datasources` config
2. Creates new Prisma Client instance in production (not cached)
3. Logs the actual URL being used for debugging
4. Validates port is 5432, not 3306

## Still Not Working?

1. **Check environment variable is actually set**:
   ```bash
   # In container
   echo $DATABASE_URL
   ```

2. **Verify it's the correct format**:
   ```
   postgresql://user:pass@host:5432/database
   ```

3. **Check application logs** for the "Prisma Client connecting to" message

4. **Rebuild the application** to ensure Prisma Client is regenerated

