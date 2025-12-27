# 🚀 Quick Start Guide - How to Run Claimley Backend

## Step-by-Step Instructions

### 1. Prerequisites Check

Make sure you have installed:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **PostgreSQL** database server - [Download](https://www.postgresql.org/download/)
- **Firebase project** with Authentication enabled

Check Node.js version:
```bash
node --version
```

### 2. Install Dependencies

If you haven't already installed dependencies:
```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory (same level as `package.json`):

**Windows (PowerShell):**
```powershell
New-Item -Path .env -ItemType File
```

**Linux/Mac:**
```bash
touch .env
```

Then add the following content to `.env`:

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/claimly"

# Replace with your actual PostgreSQL credentials:
# - user: your PostgreSQL username (usually 'postgres')
# - password: your PostgreSQL password
# - localhost: your PostgreSQL host (or '127.0.0.1')
# - 5432: PostgreSQL port (default is 5432)
# - claimly: your database name

# JWT Configuration
JWT_SECRET="your_jwt_secret_change_this_to_a_random_string_in_production"

# Firebase Admin SDK Configuration
# Get these from Firebase Console > Project Settings > Service Accounts > Generate New Private Key
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"

# Server Configuration
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

**Important Notes:**
- Replace `user:password` in `DATABASE_URL` with your actual PostgreSQL credentials
- Generate a strong random string for `JWT_SECRET` (you can use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- For Firebase, download the service account JSON from Firebase Console and copy the values

### 4. Set Up PostgreSQL Database

**Option A: Using PostgreSQL Command Line (psql)**
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE claimly;

# Exit PostgreSQL
\q
```

**Option B: Using pgAdmin or another PostgreSQL client**
- Create a new database named `claimly`

### 5. Run Database Migrations

This will create all the database tables:
```bash
npm run migrate
```

**Note:** If you get a connection error, make sure:
- PostgreSQL server is running
- Your `.env` file has correct `DATABASE_URL`
- The database `claimly` exists

### 6. Generate Prisma Client

This generates the TypeScript types for your database:
```bash
npm run prisma:generate
```

### 7. Start the Development Server

```bash
npm run dev
```

You should see:
```
2024-XX-XX XX:XX:XX [info]: Server is running on port 3000 { port: 3000, env: 'development' }
```

### 8. Test the Server

Open your browser or use curl:
```bash
curl http://localhost:3000/health
```

You should get:
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

## 🎯 Running in Production

### Build the Project
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

## 📋 Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run migrate` | Run database migrations |
| `npm run migrate:deploy` | Deploy migrations (production) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:studio` | Open Prisma Studio (database GUI) |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage report |

## 🔧 Troubleshooting

### Error: Can't reach database server
**Solution:**
- Make sure PostgreSQL server is running
- Check your `DATABASE_URL` in `.env`
- Verify PostgreSQL is accessible: `psql -U postgres -d claimly`

### Error: Module not found
**Solution:**
- Run `npm install` to install dependencies

### Error: Firebase Admin SDK initialization failed
**Solution:**
- Check your Firebase credentials in `.env`
- Make sure the private key is properly formatted with `\n` for newlines
- Verify the service account has the correct permissions

### Error: Port 3000 already in use
**Solution:**
- Change `PORT` in `.env` to a different port (e.g., `3001`)
- Or stop the process using port 3000

### Prisma Client not found
**Solution:**
- Run `npm run prisma:generate`

## 📚 Next Steps

1. **Test API Endpoints**: Use Postman or curl to test the endpoints
2. **View Database**: Run `npm run prisma:studio` to open Prisma Studio
3. **Check Logs**: View logs in `logs/` directory
4. **Read API Docs**: See `README.md` for API endpoint documentation

## 🆘 Need Help?

- Check the `README.md` for detailed API documentation
- Check `TESTING.md` for testing and optimization details
- Review logs in `logs/error.log` for error details

