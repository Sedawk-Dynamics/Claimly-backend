# Production Deployment Guide

This guide covers deploying the Claimly backend to production.

## Prerequisites

- Node.js 20+ installed
- MySQL database (production-ready instance)
- Firebase project with service account configured
- Environment variables configured

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_URL="mysql://user:password@host:3306/claimly"

# JWT Configuration
# Generate a strong secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET="your_strong_jwt_secret_minimum_32_characters"

# Firebase Admin SDK Configuration
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# CORS Configuration (comma-separated list of allowed origins)
# Include all frontend domains that will make requests to this API
CORS_ORIGIN="https://web.claimly.co.in,https://admin.claimly.co.in"

# Security Configuration
DISABLE_TEST_AUTH=true
```

## Security Checklist

- [ ] JWT_SECRET is at least 32 characters long
- [ ] Database credentials are secure and not default
- [ ] CORS_ORIGIN is set to your production frontend domain(s)
- [ ] DISABLE_TEST_AUTH is set to `true`
- [ ] Firebase service account has minimal required permissions
- [ ] Database connection uses SSL/TLS
- [ ] All environment variables are set and validated

## Build and Deploy

### 1. Install Dependencies

```bash
npm ci --production=false
```

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

### 3. Run Database Migrations

```bash
npm run migrate:deploy
```

### 4. Build the Application

```bash
npm run build
```

### 5. Start the Server

```bash
npm start
```

## Docker Deployment

The project includes a Dockerfile for containerized deployment:

```bash
# Build the image
docker build -t claimly-backend .

# Run the container
docker run -d \
  --name claimly-backend \
  -p 3000:3000 \
  --env-file .env \
  claimly-backend
```

### Persistent uploads (important)

By default the Docker image contains whatever `uploads/` directory existed at build time. Files uploaded at runtime are stored inside the container filesystem and will be lost on container restart or redeploy unless you persist them.

Recommended options:

- Mount a host volume (simple, works for single-instance deploys):

```bash
docker run -d \
  --name claimly-backend \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/uploads:/app/uploads \
  claimly-backend
```

- Use Docker Compose with a named volume:

```yaml
version: '3.8'
services:
  claimly-backend:
    image: claimly-backend
    ports:
      - "3000:3000"
    env_file: .env
    volumes:
      - uploads-data:/app/uploads

volumes:
  uploads-data:
```

- For production scale or multi-replica setups, use external object storage (recommended):
  - Store uploads in S3/GCS and serve them via signed URLs or a CDN.
  - Update application logic to upload/read from S3 (or use a proxy service) rather than relying on the container filesystem.

If you continue to see `File not found` with an empty uploads directory in production, ensure your deployment mounts the volume correctly or switch to object storage. The server now logs a warning at startup when it detects empty/missing `uploads` directories in production.

## Health Check

The application includes a health check endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "OK",
  "message": "Server is running",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production"
}
```

## Production Features

### Security Headers
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Content-Security-Policy (production only)
- Permissions-Policy

### Rate Limiting
- General API: 1000 requests per 15 minutes (authenticated), 100 (unauthenticated)
- Authentication endpoints: 500 requests per 15 minutes
- Admin endpoints: 200 requests per 15 minutes
- File uploads: 20 requests per hour

### Error Handling
- Comprehensive error logging with Winston
- Error responses hide sensitive information in production
- Database connection errors are logged and handled gracefully

### Logging
- Logs are written to `logs/combined.log` and `logs/error.log`
- Console logging is disabled in production
- Structured JSON logging for easy parsing

## Monitoring

### Recommended Monitoring Tools
- Application performance monitoring (APM): New Relic, Datadog, or similar
- Error tracking: Sentry, Rollbar, or similar
- Log aggregation: ELK Stack, CloudWatch, or similar

### Key Metrics to Monitor
- Response times
- Error rates
- Database connection pool usage
- Memory and CPU usage
- Rate limit hits

## Troubleshooting

### Database Connection Issues
1. Verify DATABASE_URL is correct
2. Check database server is accessible
3. Verify database user has required permissions
4. Check firewall rules

### Firebase Initialization Issues
1. Verify FIREBASE_PRIVATE_KEY is properly formatted (with \n for newlines)
2. Check FIREBASE_CLIENT_EMAIL matches the service account
3. Verify service account has required permissions

### CORS Issues
1. Verify CORS_ORIGIN includes your frontend domain
2. Check that the origin matches exactly (including protocol and port)
3. Review CORS logs in application logs

## Backup and Recovery

### Database Backups
Set up regular database backups using your database provider's tools or:
```bash
mysqldump -u user -p claimly > backup_$(date +%Y%m%d).sql
```

### Application Logs
Logs are stored in the `logs/` directory. Consider:
- Setting up log rotation
- Archiving old logs
- Using a log aggregation service

## Scaling

### Horizontal Scaling
- Use a load balancer (nginx, AWS ALB, etc.)
- Ensure sessions are stateless (JWT tokens)
- Use a shared database or read replicas

### Vertical Scaling
- Monitor resource usage
- Adjust server resources as needed
- Optimize database queries

## Updates and Maintenance

### Updating the Application
1. Pull latest code
2. Run `npm ci`
3. Run `npm run prisma:generate`
4. Run `npm run migrate:deploy`
5. Run `npm run build`
6. Restart the application

### Database Migrations
Always test migrations in a staging environment first:
```bash
npm run migrate:deploy
```

## Support

For issues or questions, refer to:
- README.md for general information
- QUICKSTART.md for setup instructions
- POSTMAN_COLLECTION_GUIDE.md for API documentation

