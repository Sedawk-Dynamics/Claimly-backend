# Admin Scripts - Production Guide

This guide explains how to run admin management scripts in production.

## Available Scripts

### 1. Check Admin Users
Check if admin users exist and view their information.

```bash
# Check all admins
npm run check:admin

# Check specific admin by email
ADMIN_EMAIL=admin@claimly.com npm run check:admin
```

**In Docker:**
```bash
docker exec -it claimly-backend npm run check:admin
```

### 2. Create Admin User
Create a new admin user (fails if admin already exists).

```bash
# Create admin with default credentials (development only)
npm run admin

# Create admin with custom credentials
ADMIN_EMAIL=admin@claimly.com \
ADMIN_PASSWORD=your_secure_password \
ADMIN_NAME="Admin Name" \
ADMIN_ROLE=SUPER_ADMIN \
npm run admin
```

**In Docker:**
```bash
docker exec -it claimly-backend \
  ADMIN_EMAIL=admin@claimly.com \
  ADMIN_PASSWORD=your_secure_password \
  npm run admin
```

### 3. Reset All Admins
⚠️ **DANGER**: Deletes ALL admin users and creates a new one.

```bash
# Reset all admins (requires FORCE_RESET=true)
FORCE_RESET=true \
ADMIN_EMAIL=admin@claimly.com \
ADMIN_PASSWORD=your_secure_password \
npm run admin
```

**In Docker:**
```bash
docker exec -it claimly-backend \
  FORCE_RESET=true \
  ADMIN_EMAIL=admin@claimly.com \
  ADMIN_PASSWORD=your_secure_password \
  npm run admin
```

## Production Requirements

### Environment Variables

When running in production (`NODE_ENV=production`):

1. **ADMIN_PASSWORD is REQUIRED** - Cannot use default password `admin123`
2. **Password must be at least 8 characters**
3. **FORCE_RESET=true** is required for reset operations

### Example Production Commands

```bash
# Set production environment
export NODE_ENV=production

# Create admin (production-safe)
ADMIN_EMAIL=admin@claimly.com \
ADMIN_PASSWORD=SecurePassword123! \
ADMIN_NAME="Production Admin" \
ADMIN_ROLE=SUPER_ADMIN \
npm run admin

# Check admin exists
ADMIN_EMAIL=admin@claimly.com npm run check:admin

# Reset all admins (production - use with caution!)
FORCE_RESET=true \
ADMIN_EMAIL=admin@claimly.com \
ADMIN_PASSWORD=NewSecurePassword123! \
npm run admin
```

## Docker Production Usage

### Running Scripts in Docker Container

1. **Check if container is running:**
```bash
docker ps | grep claimly-backend
```

2. **Run check-admin script:**
```bash
docker exec -it claimly-backend npm run check:admin
```

3. **Create admin in production:**
```bash
docker exec -it claimly-backend \
  -e NODE_ENV=production \
  -e ADMIN_EMAIL=admin@claimly.com \
  -e ADMIN_PASSWORD=SecurePassword123! \
  npm run admin
```

4. **Reset all admins (production):**
```bash
docker exec -it claimly-backend \
  -e NODE_ENV=production \
  -e FORCE_RESET=true \
  -e ADMIN_EMAIL=admin@claimly.com \
  -e ADMIN_PASSWORD=NewSecurePassword123! \
  npm run admin
```

### Using Docker Compose

If using docker-compose, you can run scripts like this:

```bash
# Check admins
docker-compose exec claimly-backend npm run check:admin

# Create admin
docker-compose exec -e ADMIN_EMAIL=admin@claimly.com \
  -e ADMIN_PASSWORD=SecurePassword123! \
  claimly-backend npm run admin
```

## Script Behavior

### Create Mode (Default)
- Creates admin if it doesn't exist
- Fails if admin already exists
- Safe to run multiple times (idempotent)

### Reset Mode (FORCE_RESET=true)
- ⚠️ **DELETES ALL ADMIN USERS**
- ⚠️ **DELETES ALL ADMIN ACTIONS**
- Creates a new admin user
- Requires `FORCE_RESET=true` in production

## Security Notes

1. **Never use default passwords in production**
2. **Use strong passwords** (minimum 8 characters, mix of letters, numbers, symbols)
3. **Store credentials securely** - Use environment variables or secrets management
4. **Reset operations are destructive** - Always backup database before reset
5. **Logs contain sensitive information** - Review logs carefully

## Troubleshooting

### Script fails with "Cannot use default password"
- Set `ADMIN_PASSWORD` environment variable with a strong password
- Password must be at least 8 characters in production

### Script fails with "Admin already exists"
- Admin with that email already exists
- Use `FORCE_RESET=true` to delete and recreate (⚠️ destructive)
- Or use a different email address

### Database connection errors
- Verify `DATABASE_URL` is set correctly
- Check database is accessible from container
- Verify network connectivity

### ts-node not found
- ts-node is installed globally in the Docker image
- If running locally, ensure `npm install` has been run
- Scripts use `ts-node` which requires TypeScript to be installed

## Automatic Admin Creation

The application automatically creates a default admin on startup if:
- Admin table exists
- No admin with default email exists
- Default credentials are configured in `src/config/bootstrap.ts`

**Note**: Automatic admin creation uses hardcoded defaults. For production, it's recommended to:
1. Disable automatic admin creation, OR
2. Use environment variables to configure default admin credentials

## Best Practices

1. **First Deployment**: Create admin manually using scripts
2. **Regular Checks**: Use `check:admin` to verify admin users exist
3. **Backup Before Reset**: Always backup database before reset operations
4. **Use Secrets Management**: Store passwords in environment variables or secrets manager
5. **Rotate Passwords**: Regularly update admin passwords
6. **Monitor Logs**: Check logs for admin creation/reset events

