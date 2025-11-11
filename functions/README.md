# VantageFlow Cloud Functions

This directory contains Firebase Cloud Functions for user administration features.

## Features

- **listUsers**: Returns all users with their roles (Admin only)
- **setUserRole**: Updates a user's role (Admin only)
- **deleteUser**: Deletes a user account (Admin only, cannot delete self)

## Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Deploy Functions

```bash
npm run deploy
```

Or deploy from project root:

```bash
firebase deploy --only functions
```

## Local Development

### Run Functions Emulator

```bash
npm run serve
```

This starts the Firebase emulators for testing functions locally before deployment.

## Function Details

### listUsers()

Returns all Firebase Authentication users with their custom claims.

**Auth Required**: Yes (Admin only)

**Response**:
```json
{
  "users": [
    {
      "uid": "abc123",
      "email": "user@example.com",
      "displayName": "John Doe",
      "role": "admin",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastSignIn": "2025-01-15T12:00:00.000Z"
    }
  ]
}
```

### setUserRole(uid, role)

Sets custom claims for a user to assign their role.

**Auth Required**: Yes (Admin only)

**Parameters**:
- `uid` (string): User's Firebase UID
- `role` (string): One of 'admin', 'manager', 'member'

**Response**:
```json
{
  "success": true,
  "message": "User role set to admin"
}
```

### deleteUser(uid)

Permanently deletes a user account from Firebase Authentication.

**Auth Required**: Yes (Admin only)

**Parameters**:
- `uid` (string): User's Firebase UID

**Response**:
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

## Security

All functions enforce admin-only access by checking the caller's custom claims. Non-admin users will receive a `permission-denied` error.

## Error Handling

Functions return standard Firebase HTTPS errors:
- `unauthenticated`: User not signed in
- `permission-denied`: User lacks required permissions
- `invalid-argument`: Invalid parameters provided
- `internal`: Server-side error occurred

## Cost Considerations

Cloud Functions are billed based on:
- Number of invocations
- Compute time
- Network egress

User management operations are typically infrequent, so costs should be minimal for most use cases.

## Troubleshooting

### "functions/not-found" Error

The functions haven't been deployed yet. Run:
```bash
cd functions
npm install
npm run deploy
```

### Permission Denied

Ensure:
1. You're signed in as an admin user
2. Your admin role was set using the CLI tool: `cd firestore-admin && npm run set-role <email> admin`
3. You've signed out and back in after role assignment

### Build Errors

Delete `node_modules` and reinstall:
```bash
cd functions
rm -rf node_modules
npm install
npm run build
```
