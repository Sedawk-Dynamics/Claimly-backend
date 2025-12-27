# Database Connection Fix for Dokploy

## Problem
Health check shows database as disconnected even though you can connect via psql.

## Root Cause
In Docker/Dokploy deployments, the `DATABASE_URL` needs to use the correct hostname that's accessible from your application container.

## Solution

### 1. Check Your Current DATABASE_URL

From your psql connection, you're using:
```
postgresql://claimlydb:claimly123@claimly-claimlydb-tgyd50:5432/claimlydb
```

### 2. Update DATABASE_URL in Dokploy

In your Dokploy environment variables, set `DATABASE_URL` to:

**Option A: If database is in same Docker network (Recommended)**
```env
DATABASE_URL="postgresql://claimlydb:claimly123@claimly-claimlydb-tgyd50:5432/claimlydb"
```

**Option B: If using Docker service name**
```env
DATABASE_URL="postgresql://claimlydb:claimly123@claimlydb:5432/claimlydb"
```

**Option C: If database is on host network**
```env
DATABASE_URL="postgresql://claimlydb:claimly123@localhost:5432/claimlydb"
```

**Option D: If database is external (add SSL)**
```env
DATABASE_URL="postgresql://claimlydb:claimly123@claimly-claimlydb-tgyd50:5432/claimlydb?sslmode=prefer"
```

### 3. Common Issues in Dokploy

#### Issue 1: Hostname Resolution
- **Problem**: Container can't resolve `claimly-claimlydb-tgyd50`
- **Fix**: Use the Docker service name or internal IP
- **Check**: Run `ping claimly-claimlydb-tgyd50` from your app container

#### Issue 2: Network Isolation
- **Problem**: Containers are on different networks
- **Fix**: Ensure both containers are on the same Docker network
- **Check**: In Dokploy, verify both services are in the same stack/network

#### Issue 3: Port Not Exposed
- **Problem**: Database port 5432 not accessible
- **Fix**: Verify database service exposes port 5432 internally
- **Check**: Database should be accessible on port 5432 within Docker network

### 4. Test Connection from App Container

SSH into your application container and test:

```bash
# Test if hostname resolves
ping claimly-claimlydb-tgyd50

# Test connection
psql postgresql://claimlydb:claimly123@claimly-claimlydb-tgyd50:5432/claimlydb
```

### 5. Verify Environment Variable

In Dokploy, check that `DATABASE_URL` is set correctly:

1. Go to your application service
2. Check Environment Variables
3. Verify `DATABASE_URL` matches your database connection
4. Make sure there are no extra spaces or quotes

### 6. Restart Application

After updating `DATABASE_URL`:
1. Restart your application service in Dokploy
2. Check logs for connection messages
3. Test `/health` endpoint again

## Debugging Steps

### Step 1: Check Application Logs
```bash
# In Dokploy, check application logs
# Look for: "Database connected successfully" or "Database connection failed"
```

### Step 2: Verify DATABASE_URL Format
The URL should be:
```
postgresql://[user]:[password]@[host]:[port]/[database]
```

### Step 3: Test from Container
```bash
# Get into your app container
docker exec -it <container-name> sh

# Test connection
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => console.log('Connected')).catch(e => console.error('Failed:', e.message));"
```

### Step 4: Check Network Connectivity
```bash
# From app container, test if database host is reachable
nc -zv claimly-claimlydb-tgyd50 5432
```

## Quick Fix Checklist

- [ ] DATABASE_URL is set in Dokploy environment variables
- [ ] DATABASE_URL uses correct hostname (service name or IP)
- [ ] Database container is running
- [ ] Both containers are on same Docker network
- [ ] Port 5432 is accessible from app container
- [ ] Application has been restarted after DATABASE_URL change
- [ ] Check application logs for connection errors

## Example Dokploy Configuration

In Dokploy, your environment variables should look like:

```env
DATABASE_URL=postgresql://claimlydb:claimly123@claimly-claimlydb-tgyd50:5432/claimlydb
JWT_SECRET=your_jwt_secret_here
NODE_ENV=production
PORT=3000
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

## Still Not Working?

1. **Check Dokploy logs** for detailed error messages
2. **Verify network** - ensure containers can communicate
3. **Test connection** from app container using psql
4. **Check firewall** - ensure no firewall blocking internal Docker network
5. **Verify credentials** - username, password, database name are correct

## Contact

If still having issues, provide:
- Application container logs
- Database container logs  
- Output of `docker network ls` and `docker network inspect <network-name>`
- Your DATABASE_URL (with password masked)

