/**
 * Migration Script: Populate memberUids for existing projects
 * 
 * This script reads all projects and computes the memberUids array
 * from team.members and ownerId, then updates the document.
 * 
 * Run: npx ts-node migrateMemberUids.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
});

const db = admin.firestore();

interface TeamMember {
    uid: string;
    email?: string;
    displayName?: string;
}

async function migrateMemberUids() {
    console.log('Starting memberUids migration...');

    const projectsSnapshot = await db.collection('projects').get();
    console.log(`Found ${projectsSnapshot.size} projects to process.`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of projectsSnapshot.docs) {
        try {
            const projectData = doc.data();
            const projectId = doc.id;
            const projectName = projectData.name || 'Unnamed';

            // Compute memberUids
            const memberUids = new Set<string>();

            // Add owner
            if (projectData.ownerId) {
                memberUids.add(projectData.ownerId);
            }

            // Add team members
            const members: TeamMember[] = projectData.team?.members || [];
            members.forEach((m) => {
                if (m.uid) {
                    memberUids.add(m.uid);
                }
            });

            const memberUidsArray = Array.from(memberUids);

            // Check if already has memberUids
            const existingUids = projectData.memberUids || [];
            if (
                existingUids.length === memberUidsArray.length &&
                existingUids.every((uid: string) => memberUids.has(uid))
            ) {
                console.log(`  [SKIP] "${projectName}" - memberUids already up to date`);
                skippedCount++;
                continue;
            }

            // Update the document
            await db.collection('projects').doc(projectId).update({
                memberUids: memberUidsArray,
                isArchived: projectData.isArchived ?? false, // Set default if missing
            });

            console.log(`  [OK] "${projectName}" - memberUids: [${memberUidsArray.join(', ')}]`);
            updatedCount++;

        } catch (error: any) {
            console.error(`  [ERROR] Project ${doc.id}: ${error.message}`);
            errorCount++;
        }
    }

    console.log('\n--- Migration Complete ---');
    console.log(`  Updated: ${updatedCount}`);
    console.log(`  Skipped: ${skippedCount}`);
    console.log(`  Errors:  ${errorCount}`);
    console.log(`  Total:   ${projectsSnapshot.size}`);
}

migrateMemberUids()
    .then(() => {
        console.log('\nMigration finished successfully.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nMigration failed:', error);
        process.exit(1);
    });
