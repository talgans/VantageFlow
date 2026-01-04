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
 * Infers project structure from text patterns:
 * - Headers/questions become phases
 * - Bullet points/lists become tasks
 * - Indented items become subtasks
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
  const words = text.toLowerCase();

  // Infer project name from first question or key topic
  let name = 'New Project';
  const firstLine = text.split('\n')[0];
  if (firstLine.includes('?')) {
    name = firstLine.replace('?', '').trim().slice(0, 80);
  } else if (firstLine.length > 5 && firstLine.length < 100) {
    name = firstLine.trim();
  }

  // Generate description from first few meaningful sentences
  const sentences = text.split(/[.?!]\s+/).filter(s => s.trim().length > 20);
  const description = sentences.slice(0, 2).join('. ').slice(0, 300);

  // Infer core system from keywords
  let coreSystem = 'General';
  const systemKeywords: Record<string, string[]> = {
    'EMIS': ['emis', 'data system', 'information system', 'database'],
    'Infrastructure': ['infrastructure', 'facility', 'building', 'equipment'],
    'Training': ['training', 'professional development', 'capacity building', 'teacher'],
    'Procurement': ['procurement', 'purchasing', 'acquisition'],
    'Governance': ['governance', 'policy', 'reform', 'leadership'],
    'Technology': ['technology', 'digital', 'edtech', 'innovation', 'platform'],
    'Curriculum': ['curriculum', 'pedagogy', 'learning', 'instruction'],
  };

  for (const [system, keywords] of Object.entries(systemKeywords)) {
    if (keywords.some(kw => words.includes(kw))) {
      coreSystem = system;
      break;
    }
  }

  // Infer duration based on text complexity and task count
  const taskIndicators = (text.match(/^[\s-]*[\u2022\-*•]/gm) || []).length;
  const duration = Math.max(4, Math.min(52, Math.ceil(taskIndicators * 0.5)));

  return {
    name: name || 'New Project',
    description: description || text.slice(0, 200),
    coreSystem,
    duration,
  };
}

function parseStructure(lines: string[]): Phase[] {
  const phases: Phase[] = [];
  let currentPhase: Phase | null = null;
  let currentTask: Task | null = null;
  let lastIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    const indent = line.search(/\S/);

    // Detect phase headers (questions, headings, or standalone bold statements)
    if (isPhaseHeader(trimmed, i, lines)) {
      // Save previous phase if it has content
      if (currentPhase && currentPhase.tasks.length > 0) {
        phases.push(currentPhase);
      }

      currentPhase = {
        id: `phase-${Date.now()}-${phases.length}`,
        name: cleanPhaseName(trimmed),
        weekRange: 'TBD',
        tasks: [],
      };
      currentTask = null;
      lastIndent = 0;
      continue;
    }

    // Detect tasks (bullet points, dashes, numbered items)
    if (isTaskLine(trimmed)) {
      const taskName = cleanTaskName(trimmed);

      // Skip if task name is too short or just whitespace
      if (taskName.length < 3) continue;

      // Determine if this is a subtask based on indentation
      const isSubtask = currentTask && indent > lastIndent && indent > 0;

      if (isSubtask) {
        // Add as subtask to current task
        if (!currentTask!.subTasks) currentTask!.subTasks = [];
        currentTask!.subTasks.push({
          id: `subtask-${Date.now()}-${currentTask!.subTasks.length}`,
          name: taskName,
          status: TaskStatus.Zero,
          startDate: new Date(),
          endDate: addDays(new Date(), 7),
        });
      } else {
        // Add as main task
        if (!currentPhase) {
          // Create default phase if none exists
          currentPhase = {
            id: `phase-${Date.now()}-0`,
            name: 'Implementation Tasks',
            weekRange: 'TBD',
            tasks: [],
          };
        }

        currentTask = {
          id: `task-${Date.now()}-${currentPhase.tasks.length}`,
          name: taskName,
          status: TaskStatus.Zero,
          startDate: new Date(),
          endDate: addDays(new Date(), 14),
          subTasks: [],
        };
        currentPhase.tasks.push(currentTask);
        lastIndent = indent;
      }
    }
    // Handle multi-line descriptions or continuation text
    else if (trimmed.length > 10 && !trimmed.endsWith(':')) {
      // Look ahead to see if next line is a bullet - if so, this might be a phase description
      const nextLine = lines[i + 1]?.trim();
      const isFollowedByBullet = nextLine && isTaskLine(nextLine);

      if (isFollowedByBullet && !currentTask) {
        // This is likely a phase description, create a new phase
        if (currentPhase && currentPhase.tasks.length > 0) {
          phases.push(currentPhase);
        }
        currentPhase = {
          id: `phase-${Date.now()}-${phases.length}`,
          name: trimmed.slice(0, 100),
          weekRange: 'TBD',
          tasks: [],
        };
        currentTask = null;
        lastIndent = 0;
      } else if (currentTask && trimmed.length < 150) {
        // Add as subtask detail if we have a current task and text is reasonable length
        if (!currentTask.subTasks) currentTask.subTasks = [];
        currentTask.subTasks.push({
          id: `subtask-${Date.now()}-${currentTask.subTasks.length}`,
          name: trimmed,
          status: TaskStatus.Zero,
          startDate: new Date(),
          endDate: addDays(new Date(), 7),
        });
      }
    }
  }

  // Add last phase
  if (currentPhase && currentPhase.tasks.length > 0) {
    phases.push(currentPhase);
  }

  // If no phases detected, create one default phase with any orphaned content
  if (phases.length === 0) {
    // Try to extract at least one phase from the content
    const firstMeaningfulLine = lines.find(l => l.trim().length > 10);
    phases.push({
      id: `phase-${Date.now()}-0`,
      name: firstMeaningfulLine?.trim().slice(0, 100) || 'Project Implementation',
      weekRange: 'TBD',
      tasks: [],
    });
  }

  return phases;
}

function isPhaseHeader(line: string, index: number, allLines: string[]): boolean {
  // Questions are often phase headers
  if (line.endsWith('?')) return true;

  // Lines ending with colon (like "What's missing:")
  if (line.endsWith(':') && line.length < 100 && line.length > 5) return true;

  // Check if line is followed by bullet points (strong indicator of a header)
  const nextLine = allLines[index + 1]?.trim();
  if (nextLine && isTaskLine(nextLine) && line.length < 100 && line.length > 5) {
    return true;
  }

  // Short standalone lines at the start or after empty line
  if (line.length < 100 && line.length > 5) {
    if (index === 0) return true;
    const prevLine = allLines[index - 1]?.trim();
    if (!prevLine || prevLine.length === 0) {
      // Check if this line is NOT a continuation of a previous bullet
      return !isTaskLine(line);
    }
  }

  // ALL CAPS lines (but not single words)
  if (line === line.toUpperCase() && line.split(' ').length > 1 && line.length > 3 && line.length < 100) {
    return true;
  }

  // Headers with common keywords
  const headerKeywords = ['phase', 'stage', 'step', 'objective', 'goal', 'requirement', 'component', 'section'];
  const lowerLine = line.toLowerCase();
  if (headerKeywords.some(kw => lowerLine.startsWith(kw)) && line.length < 100) {
    return true;
  }

  return false;
}

function isTaskLine(line: string): boolean {
  // Bullet points: -, *, •, ⁃, ◦, ▪, ▫
  if (/^[\-*•⁃◦▪▫]\s+/.test(line)) return true;

  // Numbered lists: 1. 2. 1) 2) etc
  if (/^\d+[\.)]\s+/.test(line)) return true;

  // Letter lists: a. b. a) b) A. B. etc
  if (/^[a-zA-Z][\.)]\s+/.test(line)) return true;

  // Indented dashes or bullets
  if (/^\s+[\-*•⁃◦▪▫]\s+/.test(line)) return true;

  // Checkboxes: [ ] [x] [X]
  if (/^\s*\[[\sxX]\]\s+/.test(line)) return true;

  return false;
}

function cleanPhaseName(text: string): string {
  return text
    .replace(/^[#\-*•⁃]+\s*/, '') // Remove leading symbols
    .replace(/[:?]+$/, '') // Remove trailing colons/questions
    .trim()
    .slice(0, 100);
}

function cleanTaskName(text: string): string {
  return text
    .replace(/^[\s\-*•⁃◦▪▫\d.()a-zA-Z)]+/, '') // Remove bullets, numbers, dashes, letters
    .replace(/^\[[\sxX]\]\s*/, '') // Remove checkboxes
    .replace(/^Yes\s*[–—-]\s*/i, '') // Remove "Yes –" prefix
    .replace(/^No\s*[–—-]\s*/i, '') // Remove "No –" prefix
    .replace(/^[–—-]\s*/, '') // Remove leading dash
    .trim()
    .slice(0, 200);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
