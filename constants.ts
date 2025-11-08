
import { Project, TaskStatus } from './types';

export const MOCK_PROJECTS: Project[] = [
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
          // FIX: Corrected a typo in the task object key from `name: name:` to `name:`.
          { id: 't4-3', name: 'Establish cybersecurity & blockchain compliance framework', status: TaskStatus.NotStarted, startDate: new Date('2024-08-19'), endDate: new Date('2024-08-25') },
          { id: 't4-4', name: 'Conduct AI/Blockchain training for all staff & students', status: TaskStatus.NotStarted, startDate: new Date('2024-08-22'), endDate: new Date('2024-08-28') },
          { id: 't4-5', name: 'Final handover & sign-off', status: TaskStatus.NotStarted, startDate: new Date('2024-08-29'), endDate: new Date('2024-08-30'), deliverables: ['Smart ID & IoT access system live', 'Predictive dashboards in use', 'Cybersecurity & blockchain governance framework', 'Staff/student AI training completed', 'Project closed & handed over'] },
        ],
      },
    ],
  },
];
