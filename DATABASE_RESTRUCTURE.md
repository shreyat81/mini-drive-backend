# MongoDB Database Restructure Guide

## What Changed

### Before
- Database: `test` (default)
- Collections: Mixed in default database
- No explicit database in connection string

### After
- Database: `minidrive` (dedicated)
- Collections: `users`, `files`, `accessrequests`, `uploads.files`, `uploads.chunks`
- Explicit database name in MongoDB URI
- Explicit collection names in schemas

## Changes Made

### 1. Updated MongoDB Connection URI
**File**: `.env`
```
OLD: mongodb+srv://...mongodb.net/?appName=miniDrive1
NEW: mongodb+srv://...mongodb.net/minidrive?retryWrites=true&w=majority&appName=miniDrive1
```

The database name `minidrive` is now explicitly specified in the URI.

### 2. Added Explicit Collection Names to Models

#### User Model (`src/models/User.js`)
```javascript
}, {
  collection: 'users' // Explicitly set collection name
});
```

#### File Model (`src/models/File.js`)
```javascript
}, {
  collection: 'files' // Explicitly set collection name
});
```

#### AccessRequest Model (`src/models/AccessRequest.js`)
```javascript
}, {
  collection: 'accessrequests' // Explicitly set collection name
});
```

## New Database Structure

```
minidrive (database)
├── users                  (User accounts and authentication)
├── files                  (File metadata and permissions)
├── accessrequests         (File access requests)
├── uploads.files          (GridFS file metadata)
└── uploads.chunks         (GridFS file chunks - binary data)
```

## What Happens Now

### For Fresh Installation
- New data will automatically go into the `minidrive` database
- All collections will be properly organized
- No action needed!

### For Existing Data Migration

If you have existing data in the `test` database, you have two options:

#### Option 1: Start Fresh (Recommended for Development)
The application will start with a clean database. The default admin account will be automatically created.

**Pros**: Clean start, no migration issues
**Cons**: Lose existing test data

#### Option 2: Migrate Existing Data

If you have important data in the `test` database, follow these steps:

**Using MongoDB Compass:**
1. Connect to your MongoDB cluster
2. Select the `test` database
3. For each collection (`users`, `files`, `accessrequests`, `uploads.files`, `uploads.chunks`):
   - Export the collection (Documents → Export)
   - Switch to `minidrive` database (create if needed)
   - Import the collection

**Using MongoDB Atlas UI:**
1. Go to your cluster in MongoDB Atlas
2. Click "Browse Collections"
3. Create new database `minidrive`
4. Use the copy/move functionality to transfer collections

**Using mongodump/mongorestore (Command Line):**
```bash
# Dump data from test database
mongodump --uri="mongodb+srv://user:pass@cluster.mongodb.net/test" --out=./backup

# Restore to minidrive database
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net/minidrive" ./backup/test
```

**Using MongoDB Shell:**
```javascript
// Connect to your cluster
mongosh "mongodb+srv://user:pass@cluster.mongodb.net"

// Switch to test database
use test

// Copy each collection to minidrive database
db.users.aggregate([{ $match: {} }, { $out: { db: "minidrive", coll: "users" } }])
db.files.aggregate([{ $match: {} }, { $out: { db: "minidrive", coll: "files" } }])
db.accessrequests.aggregate([{ $match: {} }, { $out: { db: "minidrive", coll: "accessrequests" } }])
db['uploads.files'].aggregate([{ $match: {} }, { $out: { db: "minidrive", coll: "uploads.files" } }])
db['uploads.chunks'].aggregate([{ $match: {} }, { $out: { db: "minidrive", coll: "uploads.chunks" } }])
```

## Testing the Changes

1. **Start the backend:**
   ```bash
   cd mini-drive-backend
   npm run dev
   ```

2. **Check the logs:**
   You should see:
   ```
   Connected to MongoDB
   Default admin admin@123.com already exists (or created)
   Server is running on port 5001
   ```

3. **Verify in MongoDB Atlas:**
   - Go to MongoDB Atlas → Browse Collections
   - You should see the `minidrive` database
   - Collections will appear as you use the application

4. **Test the application:**
   - Try logging in with admin credentials
   - Upload a file
   - Check MongoDB Atlas to see data in `minidrive` database

## Benefits of This Structure

1. **Clear Organization**: Dedicated database for your application
2. **Better Scalability**: Easier to manage and backup
3. **Production Ready**: Professional database structure
4. **Easier Debugging**: Clear separation from test data
5. **Multiple Environments**: Can easily create `minidrive-dev`, `minidrive-staging`, `minidrive-prod`

## Environment-Specific Databases (Recommended)

For different environments, you can use different database names:

**Development** (`.env.development`):
```
MONGODB_URI=...mongodb.net/minidrive-dev?retryWrites=true&w=majority
```

**Staging** (`.env.staging`):
```
MONGODB_URI=...mongodb.net/minidrive-staging?retryWrites=true&w=majority
```

**Production** (`.env.production`):
```
MONGODB_URI=...mongodb.net/minidrive?retryWrites=true&w=majority
```

## Rollback (If Needed)

If you need to rollback to the old setup:

1. Update `.env`:
   ```
   MONGODB_URI=mongodb+srv://...mongodb.net/?appName=miniDrive1
   ```

2. Remove collection specifications from models (optional)

3. Restart the server

## Next Steps

1. ✅ Changes have been applied
2. 🔄 Restart your backend server
3. 🧪 Test the application
4. 📊 Verify data in MongoDB Atlas
5. 🗑️ (Optional) Delete old `test` database data once confirmed working

## Support

If you encounter any issues:
1. Check MongoDB connection string is correct
2. Verify credentials haven't expired
3. Check MongoDB Atlas network access (IP whitelist)
4. Review server logs for specific error messages
