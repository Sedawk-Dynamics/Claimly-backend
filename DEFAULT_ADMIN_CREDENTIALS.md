# Default Admin Credentials

## Production Default Admin

The backend is configured with default admin credentials that will be automatically created on server startup if no admin exists.

### Credentials

- **Email**: `admin@claimly.com`
- **Password**: `Claimly@123`
- **Name**: `Admin User`
- **Role**: `SUPER_ADMIN`

## Automatic Creation

The default admin is automatically created by the bootstrap process when:
1. Server starts up
2. Database connection is established
3. Admin table exists
4. No admin with email `admin@claimly.com` exists

This happens in `src/config/bootstrap.ts` and is called from `src/index.ts` during server startup.

## Production Behavior

### Automatic Creation (Recommended)
- On first server startup, if no admin exists, the default admin is created automatically
- If admin already exists, no new admin is created (idempotent)
- Works in both development and production environments

### Manual Creation
You can also create the admin manually using the admin script:

```bash
# Using default credentials
npm run admin

# Or with explicit credentials
ADMIN_EMAIL=admin@claimly.com \
ADMIN_PASSWORD=Claimly@123 \
npm run admin
```

## Security Notes

1. **Default Password**: The default password `Claimly@123` is configured for production use
2. **First Login**: Change the password after first login in production
3. **Environment Variables**: You can override defaults using environment variables:
   - `ADMIN_EMAIL` - Override default email
   - `ADMIN_PASSWORD` - Override default password
   - `ADMIN_NAME` - Override default name
   - `ADMIN_ROLE` - Override default role

## Verification

To verify the admin was created:

```bash
# Check if admin exists
npm run check:admin

# Or check specific email
ADMIN_EMAIL=admin@claimly.com npm run check:admin
```

## Configuration Location

The default credentials are configured in:
- **File**: `src/config/bootstrap.ts`
- **Constants**:
  - `DEFAULT_ADMIN_EMAIL = 'admin@claimly.com'`
  - `DEFAULT_ADMIN_PASSWORD = 'Claimly@123'`
  - `DEFAULT_ADMIN_NAME = 'Admin User'`
  - `DEFAULT_ADMIN_ROLE = 'SUPER_ADMIN'`

## Docker Production

In Docker, the default admin will be created automatically on first container start:

```bash
# Start container
docker run -d --name claimly-backend \
  -p 3000:3000 \
  --env-file .env \
  claimly-backend

# Check admin was created
docker exec -it claimly-backend npm run check:admin
```

## Changing Default Credentials

To change the default credentials:

1. **Edit `src/config/bootstrap.ts`**:
   ```typescript
   const DEFAULT_ADMIN_EMAIL = 'your-email@claimly.com';
   const DEFAULT_ADMIN_PASSWORD = 'YourSecurePassword123!';
   ```

2. **Rebuild and restart** the application

3. **Or use environment variables** to override without code changes

## Important Notes

- ⚠️ The default admin is only created if it doesn't already exist
- ⚠️ If you delete the admin, it will be recreated on next server restart
- ⚠️ To prevent automatic creation, remove or comment out the `ensureDefaultAdmin()` call in `src/index.ts`
- ✅ The password `Claimly@123` meets production security requirements (8+ chars, mixed case, numbers, symbols)

