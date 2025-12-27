# Dokploy Database Connection Fix - Port 3306 Error

## 🚨 Critical Issue

Your application is trying to connect to port **3306** (MySQL) instead of port **5432** (PostgreSQL).

**Error**: `Can't reach database server at claimly-claimlydb-08xn8j:3306`

## ✅ Immediate Fix

### Update DATABASE_URL in Dokploy

In your Dokploy application environment variables, set `DATABASE_URL` to:

```env
DATABASE_URL=postgresql://claimlydb:claimly123@claimly-claimlydb-08xn8j:5432/claimlydb
```

**Important**: Make sure the port is **5432** (PostgreSQL), NOT 3306 (MySQL).

### Step-by-Step in Dokploy

1. **Go to your application service** in Dokploy
2. **Click on "Environment Variables"** or "Config"
3. **Find `DATABASE_URL`** variable
4. **Update it to**:
   ```
   postgresql://claimlydb:claimly123@claimly-claimlydb-08xn8j:5432/claimlydb
   ```
5. **Save** the changes
6. **Restart** your application service

## Common DATABASE_URL Formats

### ✅ Correct Format (PostgreSQL)
```
postgresql://username:password@hostname:5432/database
```

### ❌ Wrong Formats
```
# Missing port (backend will default to 5432, but it's safer to specify explicitly)
postgresql://username:password@hostname/database

# Wrong port (MySQL port)
postgresql://username:password@hostname:3306/database

# Wrong protocol
mysql://username:password@hostname:5432/database
```

## Your Correct DATABASE_URL

Based on your psql connection, use:

```env
DATABASE_URL=postgresql://claimlydb:claimly123@claimly-claimlydb-08xn8j:5432/claimlydb
```

**Breakdown**:
- Protocol: `postgresql://`
- Username: `claimlydb`
- Password: `claimly123`
- Host: `claimly-claimlydb-08xn8j`
- Port: `5432` ← **CRITICAL: Must be 5432**
- Database: `claimlydb`

## Verification

After updating and restarting:

1. **Check health endpoint**:
   ```bash
   curl https://api.claimly.co.in/health
   ```
   Should show: `"database": { "status": "connected" }`

2. **Check application logs** in Dokploy:
   - Should see: `✅ Database connected successfully`
   - Should NOT see: `Can't reach database server at ...:3306`

## Why This Happened

Some platforms/services provide a `DATABASE_URL` without an explicit port. In older builds, passing that raw value through could lead Prisma to attempt the wrong default port (seen as `:3306` in logs).

The backend now prevents this by:
1. Normalizing missing ports to **5432**
2. Failing fast if **3306** is detected (prevents accidental MySQL connections)
3. Logging clear, actionable error messages

## Still Having Issues?

### Check 1: Verify Port in DATABASE_URL
```bash
# In Dokploy, check your environment variable
echo $DATABASE_URL
# Should show: ...:5432/claimlydb
```

### Check 2: Test Connection from Container
```bash
# SSH into your app container
docker exec -it <your-app-container> sh

# Test connection
psql postgresql://claimlydb:claimly123@claimly-claimlydb-08xn8j:5432/claimlydb
```

### Check 3: Verify Database Service
- Database container should be running
- Port 5432 should be exposed
- Both containers should be on same network

## Quick Checklist

- [ ] DATABASE_URL uses `postgresql://` protocol
- [ ] Port is **5432** (not 3306)
- [ ] Hostname matches your database service name
- [ ] Username and password are correct
- [ ] Database name is correct
- [ ] Application has been restarted after change
- [ ] Health check shows database connected

## After Fix

Once fixed, you should see in logs:
```
✅ Database connected successfully
```

And health check will show:
```json
{
  "status": "OK",
  "database": {
    "status": "connected",
    "latency": "Xms"
  }
}
```

