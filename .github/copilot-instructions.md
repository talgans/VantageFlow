# VantageFlow AI Coding Instructions

## Project Overview
VantageFlow is a KPI dashboard for tracking project progress using a rubric-based system with Gantt-like views, charts, and AI-powered analytics via Google Gemini AI. Built as a React/TypeScript single-page application using Vite and Google AI Studio's CDN-based deployment model.

## Architecture & Key Components

### State Management Pattern
- **Authentication Context**: `AuthContext` provides user auth state, role, and auth methods throughout the app
- **Real-time Firestore sync**: `App.tsx` subscribes to Firestore via `subscribeToProjects()` for automatic updates
- **No manual state updates**: Firestore operations trigger real-time listeners that update component state automatically
- **Functional updates**: Still use `setProjects(currentProjects => ...)` pattern for local state operations

### Component Hierarchy
```
index.tsx (AuthProvider wrapper)
├─ App.tsx (Firestore subscription + state)
   ├─ Header (user info, sign in/out)
   ├─ LoginModal (authentication UI)
   ├─ MasterDashboard (project list + overview charts)
   │  └─ ProjectStatusPieChart (recharts visualization)
   └─ ProjectDetail (single project view)
      ├─ GanttChart (timeline visualization)
      ├─ AI Insights panel (Gemini integration)
      └─ Nested task lists with drag-and-drop
```

### Type System (`types.ts`)
- `Project` → `Phase[]` → `Task[]` → optional `subTasks: Task[]`
- `TaskStatus` enum drives UI colors and progress calculations
- `UserRole` enum (`Admin`, `Manager`, `Member`) controls permissions via Firebase custom claims
- `AuthUser` interface: Firebase user with extracted role from custom claims
- **Critical**: Dates are `Date` objects in memory, `Timestamp` in Firestore - always convert bidirectionally

## Development Workflows

### Running Locally
```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
```

### Environment Configuration
- Set `GEMINI_API_KEY` in `.env.local` (Vite loads as `process.env.GEMINI_API_KEY`)
- Vite config (`vite.config.ts`) aliases `process.env.API_KEY` and `process.env.GEMINI_API_KEY` to the same value
- Accessed in code via `process.env.API_KEY` in `geminiService.ts`
- **Firestore config**: Add Firebase credentials to `.env.local`:
  ```
  VITE_FIREBASE_API_KEY=your-api-key
  VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
  VITE_FIREBASE_PROJECT_ID=your-project-id
  VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
  VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
  VITE_FIREBASE_APP_ID=your-app-id
  ```

### Deployment Target
- Designed for **Google AI Studio's CDN deployment** (see `index.html` importmap)
- Dependencies loaded via `https://aistudiocdn.com/` - no npm bundling for production
- Uses Vite for dev experience but deployed as vanilla HTML/JS/TS

## Project-Specific Conventions

### Firebase Authentication Pattern
- **AuthContext** (`contexts/AuthContext.tsx`): Provides `useAuth()` hook with `user`, `signIn`, `signOut`, `signUp`
- **Custom claims for RBAC**: User roles stored in Firebase custom claims (`admin`, `manager`, `member`)
- **Token refresh**: Automatic refresh every 10 minutes to sync role changes
- **Usage**: `const { user, signIn, signOut } = useAuth();`
- **Permission helper**: `canModifyProjects(user)` checks if user can edit/delete

### Firestore Integration Pattern
- **Service layer**: `services/firestoreService.ts` handles all database operations
- **Real-time listeners**: `subscribeToProjects()` returns unsubscribe function for cleanup
- **Date conversion**: Always convert `Date` ↔ `Timestamp` using helper functions
- **CRUD operations**: `createProject()`, `updateProject()`, `deleteProject()` - all async with error handling
- **Auto-sync**: Firestore changes automatically update React state via listeners

### Styling System
- **Tailwind via CDN** (`<script src="https://cdn.tailwindcss.com"></script>`)
- **No CSS files** - all styling is inline Tailwind classes
- **Custom color palette** defined in `index.html` script:
  - `brand-primary`, `brand-secondary`, `brand-light` for UI accents
  - `status-completed`, `status-inprogress`, `status-notstarted`, `status-atrisk` for task states
- Dark theme baseline: `bg-slate-900`, `text-slate-200`, `border-slate-700`

### Icon Pattern
- SVG icons exported from `components/icons/index.tsx`
- Pass className props for size/color: `<ArrowLeftIcon className="w-5 h-5" />`
- Use Heroicons-style paths (no library dependency)

### Task Management Patterns
- **Recursive task structure**: Tasks can have `subTasks` (unlimited nesting)
- **Progress calculation**: `calculateTaskProgress()` in `ProjectDetail.tsx` recurses through subtasks
  - Completed = 100%, In Progress/At Risk = 50%, Not Started = 0%
- **Inline editing**: Use `InlineTaskForm` component for adding tasks/subtasks/phases
- **Drag-and-drop**: Tasks support reordering with visual drop indicators (`isDropTargetAbove/Below`)

### Modal Pattern
- Modals render conditionally in `App.tsx` return JSX (not portals)
- `ProjectModal`: Create/edit projects (controlled by `editingProject` state)
- `ConfirmationModal`: Reusable delete confirmation with custom title/message

### AI Integration
- Service: `services/geminiService.ts` exports `getProjectInsights(project)`
- Model: `gemini-2.5-flash` for fast analytics
- Prompt structure: Asks for health assessment, risk identification, recommendations
- Error handling: Returns user-friendly string on API failure (no throws)

## Firestore Backend Integration

### Setup & Installation
```bash
npm install firebase
```

### Service Architecture
- Create `services/firestoreService.ts` to handle all Firestore operations
- Initialize Firebase app with config from environment variables
- Use modular SDK: `import { getFirestore, collection, doc, ... } from 'firebase/firestore'`

### Data Model Structure
```
projects (collection)
  ├─ {projectId} (document)
     ├─ id: string
     ├─ name: string
     ├─ description: string
     ├─ coreSystem: string
     ├─ duration: string
     ├─ team: { name, size, manager }
     ├─ cost: string
     ├─ phases: Phase[] (stored as nested array)
     └─ createdAt: Timestamp
```

### Date Handling for Firestore
- **Writing**: Convert `Date` objects to Firestore `Timestamp` before saving
  ```typescript
  import { Timestamp } from 'firebase/firestore';
  const firestoreTask = {
    ...task,
    startDate: Timestamp.fromDate(task.startDate),
    endDate: Timestamp.fromDate(task.endDate)
  };
  ```
- **Reading**: Convert Firestore `Timestamp` back to `Date` objects
  ```typescript
  const projectFromFirestore = {
    ...doc.data(),
    phases: doc.data().phases.map(phase => ({
      ...phase,
      tasks: phase.tasks.map(task => ({
        ...task,
        startDate: task.startDate.toDate(),
        endDate: task.endDate.toDate(),
        subTasks: task.subTasks?.map(/* recursive conversion */)
      }))
    }))
  };
  ```

### Required Service Functions
Create these exports in `services/firestoreService.ts`:
- `fetchProjects(): Promise<Project[]>` - Real-time listener with `onSnapshot`
- `createProject(project: Omit<Project, 'id'>): Promise<string>` - Use `addDoc` with auto-generated ID
- `updateProject(project: Project): Promise<void>` - Use `updateDoc` with full project data
- `deleteProject(projectId: string): Promise<void>` - Use `deleteDoc`

### App.tsx Integration Pattern
Replace `useState<Project[]>(MOCK_PROJECTS)` with Firestore real-time sync:
```typescript
const [projects, setProjects] = useState<Project[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const unsubscribe = subscribeToProjects((projectsFromDb) => {
    setProjects(projectsFromDb);
    setLoading(false);
  });
  return () => unsubscribe();
}, []);
```

### CRUD Operations in App.tsx
- **Create**: `handleSaveProject` → call `createProject(projectData)` → Firestore updates trigger `onSnapshot`
- **Update**: `handleUpdateProject` → call `updateProject(updatedProject)` → Firestore updates trigger `onSnapshot`
- **Delete**: `handleConfirmDeleteProject` → call `deleteProject(projectId)` → Firestore updates trigger `onSnapshot`
- **No manual `setProjects` calls** - real-time listener handles all state updates

### Error Handling Pattern
```typescript
try {
  await createProject(newProject);
  showToast('Project created successfully');
} catch (error) {
  console.error('Firestore error:', error);
  showToast('Failed to create project. Please try again.');
}
```

### Recursive Subtask Conversion
When converting tasks with `subTasks`, create a recursive helper:
```typescript
const convertTaskDates = (task: any): Task => ({
  ...task,
  startDate: task.startDate.toDate(),
  endDate: task.endDate.toDate(),
  subTasks: task.subTasks?.map(convertTaskDates)
});
```

### Security Rules (Firestore)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      // Adjust based on your auth requirements
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Testing with Mock Data
- Keep `MOCK_PROJECTS` in `constants.ts` for development fallback
- Add a flag in `.env.local`: `VITE_USE_MOCK_DATA=false` to toggle between mock and Firestore
- Useful for offline development and testing UI without backend calls

### Common Firestore Pitfalls
1. **Nested arrays are expensive** - Firestore charges per document read; consider flattening if performance issues arise
2. **Timestamp conversion** - Always convert before saving and after reading; forget this and dates become objects
3. **Real-time listener cleanup** - Always return unsubscribe function in `useEffect` to prevent memory leaks
4. **Optimistic updates** - Update local state immediately, then sync to Firestore for better UX
5. **ID generation** - Firestore auto-generates IDs; update your create flow to use returned document ID

## Critical Implementation Details

### Date Handling in Gantt Chart
- `getProjectTimeline()` flattens all tasks to find min/max dates
- Timeline grid: `GANTT_DAY_WIDTH = 32px` constant for day column sizing
- Weekend highlighting: Check `day.getDay() === 0 || day.getDay() === 6`

### Sorting System
- `sortTasks()` in `ProjectDetail.tsx` recursively sorts tasks and subtasks
- Sort keys: `name`, `startDate`, `status`, `deliverables` (by count)
- Direction toggle: Click column headers to cycle ascending/descending

### Role-Based Permissions
- `canModify(role)` helper: Only Admin/Manager can edit
- UI elements conditionally render edit buttons based on `canEdit` prop
- No backend validation - this is client-side only

## Common Pitfalls

1. **Date/Timestamp conversion**: Always convert between `Date` and Firestore `Timestamp` in service layer
2. **Auth state timing**: Check `loading` state before rendering auth-dependent UI
3. **Listener cleanup**: Always return `unsubscribe()` from `useEffect` for Firestore listeners
4. **Custom claims delay**: New users don't have custom claims immediately - defaults to `Member`
5. **Async CRUD operations**: All Firestore operations are async - use try/catch and show loading states
6. **Subtask recursion**: Remember to handle `subTasks` array recursively in conversion functions
7. **Modal state sync**: Close modals by setting controlling state to `null`, not just closing the modal

## File Organization
- Root: Core app files (`App.tsx`, `types.ts`, `constants.ts`)
- `components/`: UI components (modals, charts, detail views)
- `components/icons/`: SVG icon exports
- `services/`: External integrations (Gemini AI, Firebase config, Firestore service)
- `contexts/`: React contexts (AuthContext for authentication)
- `firestore-admin/`: Admin scripts for database seeding (separate Node.js environment)
- No `src/` directory - flat structure at root level
