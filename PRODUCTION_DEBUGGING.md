# Production Debugging Guide for Login/Signup Issues

## Recent Fixes Applied

### 1. **Enhanced Error Logging**
- Added console logging for errors in production (previously only logged to files)
- All errors now visible in server logs/console
- Validation errors are now properly logged with request details

### 2. **Improved Firebase Error Handling**
- Firebase initialization now throws errors instead of silently failing
- Added check to ensure Firebase is initialized before processing auth requests
- Better error messages when Firebase Admin SDK is not initialized

### 3. **Better Validation Error Handling**
- Email validation now properly handles empty strings, null, and undefined
- Validation errors return 400 status codes instead of 500
- Detailed error messages in validation responses

### 4. **Enhanced Error Messages**
- Production error handler now provides more context
- Validation errors include field paths and messages
- Firebase errors are properly categorized (500 for initialization, 400 for token issues)

## Common Production Issues to Check

### 1. **Firebase Configuration**
Check that these environment variables are set correctly in production:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**Common Issues:**
- Private key missing `\n` characters (should be escaped as `\\n` in .env)
- Private key not wrapped in quotes
- Missing BEGIN/END markers in private key
- Wrong project ID or client email

**How to Check:**
- Look for "Firebase Admin initialized successfully" in server startup logs
- If you see "Firebase Admin not initialized", check environment variables

### 2. **Database Connection**
Check that `DATABASE_URL` is correctly set:
```env
DATABASE_URL="postgresql://user:password@host:5432/database"
```

**Common Issues:**
- Database server not accessible from production server
- Wrong credentials
- Database doesn't exist
- Network/firewall blocking connection

### 3. **Environment Variables**
Ensure all required variables are set:
- `DATABASE_URL`
- `JWT_SECRET` (at least 32 characters in production)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `NODE_ENV=production`

### 4. **CORS Configuration**
The server allows all origins by default. If you need to restrict:
- Set `CORS_ORIGIN` environment variable
- Update CORS configuration in `src/index.ts`

## Debugging Steps

### 1. Check Server Logs
Look for these log messages:
- `✅ Firebase Admin SDK initialized` - Firebase is working
- `❌ Firebase Admin SDK not initialized` - Firebase configuration issue
- `✅ Database connected successfully` - Database is working
- `❌ Database connection failed` - Database issue

### 2. Check Error Logs
Error logs are written to:
- `logs/error.log` - Only errors
- `logs/combined.log` - All logs

### 3. Test Firebase Initialization
Check server startup logs for:
```
Firebase Admin initialized successfully
✅ Firebase Admin SDK initialized
```

If you don't see these, Firebase is not initialized.

### 4. Test Database Connection
Check server startup logs for:
```
✅ Database connected successfully
```

### 5. Check API Response
When registration fails, check:
- Status code (400 = validation error, 500 = server error)
- Error message in response
- Check server logs for detailed error

## Common Error Messages

### "Firebase Admin SDK not initialized"
**Cause:** Firebase environment variables not set or incorrect
**Fix:** Check `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

### "Invalid or expired Firebase token"
**Cause:** Client-side Firebase token is invalid
**Fix:** Check frontend Firebase configuration

### "Validation failed"
**Cause:** Request data doesn't match validation schema
**Fix:** Check request body format, especially email and phone number

### "Database connection failed"
**Cause:** Cannot connect to database
**Fix:** Check `DATABASE_URL`, database server accessibility, credentials

## Testing in Production

1. **Check Health Endpoint:**
   ```
   GET /health
   ```
   Should return database connection status

2. **Check Server Logs:**
   - Look for error messages when registration fails
   - Check Firebase initialization status
   - Check database connection status

3. **Test Registration:**
   - Send a registration request
   - Check response status and error message
   - Check server logs for detailed error

## Next Steps if Still Failing

1. Check server logs for specific error messages
2. Verify all environment variables are set correctly
3. Test Firebase Admin SDK initialization separately
4. Test database connection separately
5. Check network/firewall rules
6. Verify frontend is sending correct data format

