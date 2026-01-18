import { Phase, Task, TaskStatus } from '../types';

interface ParsedProject {
  name: string;
  description: string;
  coreSystem: string;
  duration: number; // in weeks
  phases: Phase[];
}

/**
 * Parses pasted text into a structured project format
 * Structure inference:
 * - First non-list line becomes project title
 * - Numbered items (1. 2. 3.) become phases
 * - Bullet points (- * •) under numbered items become tasks
 * - Nested bullet points become subtasks
 */
export function parseTextToProject(text: string): ParsedProject {
  const lines = text.split('\n').map(line => line.trimEnd());

  // Extract project metadata
  const metadata = inferProjectMetadata(text);

  // Parse phases and tasks
  const phases = parseStructure(lines);

  return {
    ...metadata,
    phases,
  };
}

function inferProjectMetadata(text: string): Omit<ParsedProject, 'phases'> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Find project name: first line that is NOT a numbered/bulleted item
  let name = 'New Project';
  for (const line of lines) {
    if (!isNumberedItem(line) && !isBulletItem(line)) {
      name = cleanTitle(line);
      break;
    }
  }

  // Generate description from first meaningful sentence or title
  const description = name.length > 30 ? name : `Project: ${name}`;

  // Infer core system from keywords
  const words = text.toLowerCase();
  let coreSystem = '';
  const systemKeywords: Record<string, string[]> = {
    'Technical': ['technical', 'system', 'api', 'database', 'code', 'software', 'platform', 'infrastructure'],
    'Business': ['business', 'strategy', 'revenue', 'sales', 'marketing', 'customer'],
    'Creative': ['creative', 'design', 'brand', 'ui', 'ux', 'graphic', 'visual'],
    'Research': ['research', 'analysis', 'study', 'survey', 'data', 'investigation'],
    'Compliance': ['compliance', 'regulation', 'audit', 'legal', 'policy', 'governance'],
  };

  for (const [system, keywords] of Object.entries(systemKeywords)) {
    if (keywords.some(kw => words.includes(kw))) {
      coreSystem = system;
      break;
    }
  }

  // Infer duration based on task count
  const bulletCount = (text.match(/^[\s]*[•\-*]\s+/gm) || []).length;
  const duration = Math.max(4, Math.min(52, Math.ceil(bulletCount * 0.5)));

  return {
    name,
    description,
    coreSystem,
    duration,
  };
}

function parseStructure(lines: string[]): Phase[] {
  const phases: Phase[] = [];
  let currentPhase: Phase | null = null;
  let currentTask: Task | null = null;
  let projectTitleFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    // Skip first non-list line (it's the project title)
    if (!projectTitleFound && !isNumberedItem(trimmed) && !isBulletItem(trimmed)) {
      projectTitleFound = true;
      continue;
    }

    // Numbered items (1. 2. 3.) become PHASES
    if (isNumberedItem(trimmed)) {
      // Save previous phase if it exists
      if (currentPhase) {
        phases.push(currentPhase);
      }

      const phaseName = cleanNumberedItem(trimmed);
      currentPhase = {
        id: `phase-${Date.now()}-${phases.length}`,
        name: phaseName,
        weekRange: 'TBD',
        tasks: [],
      };
      currentTask = null;
      continue;
    }

    // Bullet points become TASKS (or subtasks if deeply nested)
    if (isBulletItem(trimmed)) {
      const indent = getIndentLevel(line);
      const taskName = cleanBulletItem(trimmed);

      if (taskName.length < 3) continue;

      // If no phase exists, create a default one
      if (!currentPhase) {
        currentPhase = {
          id: `phase-${Date.now()}-0`,
          name: 'Tasks',
          weekRange: 'TBD',
          tasks: [],
        };
      }

      // Check if this is a nested bullet (subtask) vs top-level bullet (task)
      // A subtask has higher indent than the previous task
      const isSubtask = currentTask && indent > 0 && isNestedBullet(line);

      if (isSubtask && currentTask) {
        // Add as subtask
        if (!currentTask.subTasks) currentTask.subTasks = [];
        currentTask.subTasks.push({
          id: `subtask-${Date.now()}-${currentTask.subTasks.length}`,
          name: taskName,
          status: TaskStatus.Zero,
          startDate: new Date(),
          endDate: addDays(new Date(), 7),
        });
      } else {
        // Add as main task
        currentTask = {
          id: `task-${Date.now()}-${currentPhase.tasks.length}`,
          name: taskName,
          status: TaskStatus.Zero,
          startDate: new Date(),
          endDate: addDays(new Date(), 14),
          subTasks: [],
        };
        currentPhase.tasks.push(currentTask);
      }
    }
  }

  // Add last phase
  if (currentPhase) {
    phases.push(currentPhase);
  }

  // If no phases detected, create a default one
  if (phases.length === 0) {
    phases.push({
      id: `phase-${Date.now()}-0`,
      name: 'Project Tasks',
      weekRange: 'TBD',
      tasks: [],
    });
  }

  return phases;
}

// Check if line is a numbered item like "1. " or "1) " or "1: "
function isNumberedItem(line: string): boolean {
  return /^\d+[\.\):\s]\s*/.test(line);
}

// Check if line is a bullet point
function isBulletItem(line: string): boolean {
  // Bullet points: -, *, •, ⁃, ◦, ▪, ▫ (with or without leading spaces)
  return /^[\s]*[•\-*⁃◦▪▫]\s+/.test(line);
}

// Check if bullet is nested (has leading whitespace before the bullet)
function isNestedBullet(line: string): boolean {
  return /^\s{2,}[•\-*⁃◦▪▫]\s+/.test(line);
}

// Get indentation level
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

// Clean a numbered item to get just the text
function cleanNumberedItem(text: string): string {
  return text
    .replace(/^\d+[\.\):\s]\s*/, '')  // Remove "1. " or "1) " or "1: "
    .trim()
    .slice(0, 100);
}

// Clean a bullet item to get just the text
function cleanBulletItem(text: string): string {
  return text
    .replace(/^[\s]*[•\-*⁃◦▪▫]\s+/, '')  // Remove bullet and spaces
    .trim()
    .slice(0, 200);
}

// Clean title text
function cleanTitle(text: string): string {
  return text
    .replace(/^#+\s*/, '')  // Remove markdown headers
    .replace(/\*\*/g, '')   // Remove bold markers
    .replace(/[:?]+$/, '')  // Remove trailing colons/questions
    .trim()
    .slice(0, 100);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
