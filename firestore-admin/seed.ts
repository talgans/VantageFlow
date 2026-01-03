import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Types matching VantageFlow data model
enum TaskStatus {
  Completed = 'Completed',
  InProgress = 'In Progress',
  NotStarted = 'Not Started',
  AtRisk = 'At Risk',
}

interface Task {
  id: string;
  name: string;
  status: TaskStatus;
  startDate: Date;
  endDate: Date;
  assignee?: string;
  deliverables?: string[];
  subTasks?: Task[];
}

interface Phase {
  id: string;
  name: string;
  weekRange: string;
  tasks: Task[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  coreSystem: string;
  duration: string;
  team: {
    name: string;
    size: number;
    manager: string;
  };
  cost: string;
  phases: Phase[];
}

// Mock data from constants.ts
const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Digital Transformation Project Plan (StrategicRefresh 1.0)',
    description: 'A comprehensive plan to fully automate university administration, academics, finance, HR, and student services through an AI-powered, data-driven ecosystem.',
    coreSystem: 'eUniversity ERP + AI, Data Analytics, Blockchain, IoT, Cloud Platforms',
    duration: '2 Months (Phased Rollout)',
    team: {
      name: 'Digital Transformation Team',
      size: 15,
      manager: 'Mohammed Mahmud (DLOC)',
    },
    cost: 'Covered by IDEAS Grant',
    phases: [
      {
        id: 'phase-1',
        name: 'Phase 1: Foundation',
        weekRange: 'Week 1',
        tasks: [
          { id: 't1-1', name: 'Establish Project Control Group (PCG)', status: TaskStatus.Completed, startDate: new Date('2024-07-01'), endDate: new Date('2024-07-02') },
          { id: 't1-2', name: 'Conduct rapid Business Process Review (BPR)', status: TaskStatus.Completed, startDate: new Date('2024-07-02'), endDate: new Date('2024-07-04') },
          { id: 't1-3', name: 'Deploy hybrid cloud & cybersecurity monitoring', status: TaskStatus.Completed, startDate: new Date('2024-07-03'), endDate: new Date('2024-07-07') },
          { id: 't1-4', name: 'Crash training on ERP + AI/Blockchain basics', status: TaskStatus.Completed, startDate: new Date('2024-07-05'), endDate: new Date('2024-07-07'), deliverables: ['Project charter approved', 'Cloud/data infrastructure deployed', 'Staff readiness baseline'] },
        ],
      },
      {
        id: 'phase-2',
        name: 'Phase 2: ERP + AI/Data Analytics',
        weekRange: 'Week 2-3',
        tasks: [
          { 
            id: 't2-1', 
            name: 'Deploy Core Modules (Admissions, Registration, etc.)', 
            status: TaskStatus.InProgress, 
            startDate: new Date('2024-07-08'), 
            endDate: new Date('2024-07-15'),
            subTasks: [
              { id: 't2-1-1', name: 'Configure Admissions Module', status: TaskStatus.Completed, startDate: new Date('2024-07-08'), endDate: new Date('2024-07-10') },
              { id: 't2-1-2', name: 'Configure Registration Module', status: TaskStatus.InProgress, startDate: new Date('2024-07-11'), endDate: new Date('2024-07-13') },
            ]
          },
          { id: 't2-2', name: 'Launch AI analytics dashboards', status: TaskStatus.InProgress, startDate: new Date('2024-07-12'), endDate: new Date('2024-07-21') },
          { id: 't2-3', name: 'Configure SMS/Email + AI chatbots', status: TaskStatus.AtRisk, startDate: new Date('2024-07-18'), endDate: new Date('2024-07-21'), deliverables: ['ERP live across all core modules', 'AI-powered dashboards operational', 'Payroll processed digitally', 'AI chatbot active'] },
        ],
      },
      {
        id: 'phase-3',
        name: 'Phase 3: Extended Digital + Blockchain',
        weekRange: 'Week 4-6',
        tasks: [
          { id: 't3-1', name: 'Deploy Google LMS with AI tutors', status: TaskStatus.NotStarted, startDate: new Date('2024-07-22'), endDate: new Date('2024-08-01') },
          { id: 't3-2', name: 'Launch self-service portals & mobile app', status: TaskStatus.NotStarted, startDate: new Date('2024-07-25'), endDate: new Date('2024-08-08') },
          { id: 't3-3', name: 'Implement blockchain-secured payments & certificates', status: TaskStatus.NotStarted, startDate: new Date('2024-08-01'), endDate: new Date('2024-08-11') },
          { id: 't3-4', name: 'Digitise research repository', status: TaskStatus.NotStarted, startDate: new Date('2024-08-05'), endDate: new Date('2024-08-11'), deliverables: ['Google LMS integrated with ERP', 'Blockchain-secured transcripts & certificates', 'Cashless payments running', 'AI plagiarism detection live'] },
        ],
      },
      {
        id: 'phase-4',
        name: 'Phase 4: Smart Campus + Governance',
        weekRange: 'Week 7-8',
        tasks: [
          { id: 't4-1', name: 'Roll out IoT-enabled smart ID & biometric access', status: TaskStatus.NotStarted, startDate: new Date('2024-08-12'), endDate: new Date('2024-08-18') },
          { id: 't4-2', name: 'Deploy predictive analytics for students & finances', status: TaskStatus.NotStarted, startDate: new Date('2024-08-15'), endDate: new Date('2024-08-22') },
          { id: 't4-3', name: 'Establish cybersecurity & blockchain compliance framework', status: TaskStatus.NotStarted, startDate: new Date('2024-08-19'), endDate: new Date('2024-08-25') },
          { id: 't4-4', name: 'Conduct AI/Blockchain training for all staff & students', status: TaskStatus.NotStarted, startDate: new Date('2024-08-22'), endDate: new Date('2024-08-28') },
          { id: 't4-5', name: 'Final handover & sign-off', status: TaskStatus.NotStarted, startDate: new Date('2024-08-29'), endDate: new Date('2024-08-30'), deliverables: ['Smart ID & IoT access system live', 'Predictive dashboards in use', 'Cybersecurity & blockchain governance framework', 'Staff/student AI training completed', 'Project closed & handed over'] },
        ],
      },
    ],
  },
];

/**
 * Recursively convert Date objects to Firestore Timestamps in tasks
 */
function convertTaskDatesToTimestamps(task: Task): any {
  const converted: any = {
    ...task,
    startDate: admin.firestore.Timestamp.fromDate(task.startDate),
    endDate: admin.firestore.Timestamp.fromDate(task.endDate),
  };

  if (task.subTasks && task.subTasks.length > 0) {
    converted.subTasks = task.subTasks.map(convertTaskDatesToTimestamps);
  }

  return converted;
}

/**
 * Convert a Project to Firestore-compatible format
 */
function convertProjectForFirestore(project: Project): any {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    coreSystem: project.coreSystem,
    duration: project.duration,
    team: project.team,
    cost: project.cost,
    phases: project.phases.map(phase => ({
      id: phase.id,
      name: phase.name,
      weekRange: phase.weekRange,
      tasks: phase.tasks.map(convertTaskDatesToTimestamps),
    })),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Initialize Firebase Admin SDK
 */
async function initializeFirebase(): Promise<admin.firestore.Firestore> {
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

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    return admin.firestore();
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    throw error;
  }
}

/**
 * Seed projects to Firestore
 */
async function seedProjects(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n📦 Starting data seeding...\n');

  const projectsCollection = db.collection('projects');

  try {
    // Use batch writes for atomic operations
    const batch = db.batch();

    for (const project of MOCK_PROJECTS) {
      const firestoreProject = convertProjectForFirestore(project);
      const docRef = projectsCollection.doc(project.id);
      batch.set(docRef, firestoreProject);
      console.log(`  ✓ Prepared project: ${project.name}`);
    }

    // Commit the batch
    await batch.commit();
    console.log('\n✅ Successfully seeded all projects to Firestore!');
    console.log(`   Total projects: ${MOCK_PROJECTS.length}`);

  } catch (error) {
    console.error('\n❌ Error seeding projects:', error);
    throw error;
  }
}

/**
 * Verify seeded data
 */
async function verifyData(db: admin.firestore.Firestore): Promise<void> {
  console.log('\n🔍 Verifying seeded data...\n');

  try {
    const snapshot = await db.collection('projects').get();
    
    console.log(`  ✓ Found ${snapshot.size} project(s) in Firestore`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Safety check for data structure
      if (!data.phases || !Array.isArray(data.phases)) {
        console.log(`  ⚠ ${doc.id}: "${data.name || 'Unknown'}" - Invalid or missing phases data`);
        return;
      }
      
      const taskCount = data.phases.reduce((total: number, phase: any) => {
        return total + (phase.tasks?.length || 0);
      }, 0);
      
      console.log(`  ✓ ${doc.id}: "${data.name}" with ${data.phases.length} phases and ${taskCount} tasks`);
    });

    console.log('\n✅ Data verification complete!');
  } catch (error) {
    console.error('\n❌ Error verifying data:', error);
    throw error;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('🚀 VantageFlow Firestore Data Seeding Script\n');
  console.log('=' .repeat(50));

  try {
    const db = await initializeFirebase();
    await seedProjects(db);
    await verifyData(db);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Seeding completed successfully!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('❌ Seeding failed:', error);
    console.error('='.repeat(50) + '\n');
    
    process.exit(1);
  }
}

// Run the script
main();
