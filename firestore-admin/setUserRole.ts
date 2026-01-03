import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Set custom claims (role) for a user in Firebase Authentication
 * Usage: npm run set-role <email> <role>
 * Roles: admin, manager, member
 */

interface RoleMapping {
  admin: string;
  manager: string;
  member: string;
}

const VALID_ROLES: RoleMapping = {
  admin: 'admin',
  manager: 'manager',
  member: 'member',
};

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
  try {
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        'serviceAccountKey.json not found!\n' +
        'Please download it from Firebase Console:\n' +
        '1. Go to Project Settings > Service Accounts\n' +
        '2. Click "Generate new private key"\n' +
        '3. Save as serviceAccountKey.json in the firestore-admin folder'
      );
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    console.log('✅ Firebase Admin SDK initialized\n');
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    throw error;
  }
}

/**
 * Set user role via custom claims
 */
async function setUserRole(email: string, role: string): Promise<void> {
  // Validate role
  if (!Object.values(VALID_ROLES).includes(role)) {
    throw new Error(
      `Invalid role: "${role}"\n` +
      `Valid roles are: ${Object.keys(VALID_ROLES).join(', ')}`
    );
  }

  try {
    // Get user by email
    console.log(`🔍 Looking up user: ${email}`);
    const user = await admin.auth().getUserByEmail(email);
    
    console.log(`✓ Found user: ${user.uid}`);

    // Set custom claims
    console.log(`🔐 Setting role to: ${role}`);
    await admin.auth().setCustomUserClaims(user.uid, { role });

    console.log(`\n✅ Successfully set role for ${email}`);
    console.log(`   User ID: ${user.uid}`);
    console.log(`   Role: ${role}`);
    console.log('\n⚠️  Note: User must sign out and sign in again for changes to take effect');
    console.log('   Or wait for the 10-minute auto-refresh');

  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error(
        `User not found: ${email}\n` +
        'Make sure the user has signed up in the application first.'
      );
    }
    throw error;
  }
}

/**
 * List all users and their roles
 */
async function listUsers(): Promise<void> {
  console.log('📋 Listing all users and their roles:\n');
  
  try {
    const listUsersResult = await admin.auth().listUsers();
    
    if (listUsersResult.users.length === 0) {
      console.log('No users found in the system.');
      return;
    }

    console.log(`Total users: ${listUsersResult.users.length}\n`);
    
    for (const user of listUsersResult.users) {
      const role = user.customClaims?.role || 'member (default)';
      console.log(`📧 ${user.email}`);
      console.log(`   ID: ${user.uid}`);
      console.log(`   Role: ${role}`);
      console.log(`   Created: ${user.metadata.creationTime}`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error listing users:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🚀 VantageFlow User Role Management\n');
  console.log('='.repeat(50) + '\n');

  try {
    initializeFirebase();

    const args = process.argv.slice(2);
    
    // Handle list command
    if (args[0] === 'list' || args.length === 0) {
      await listUsers();
      process.exit(0);
      return;
    }

    // Handle set role command
    const [email, role] = args;

    if (!email || !role) {
      console.log('Usage:');
      console.log('  npm run set-role <email> <role>   Set user role');
      console.log('  npm run set-role list              List all users\n');
      console.log('Valid roles: admin, manager, member\n');
      console.log('Examples:');
      console.log('  npm run set-role admin@example.com admin');
      console.log('  npm run set-role manager@example.com manager');
      console.log('  npm run set-role user@example.com member');
      console.log('  npm run set-role list');
      process.exit(1);
      return;
    }

    await setUserRole(email.toLowerCase().trim(), role.toLowerCase().trim());
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Role update completed!\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Error:', error.message || error);
    console.error('='.repeat(50) + '\n');
    
    process.exit(1);
  }
}

// Run the script
main();
