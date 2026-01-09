import { Project, Phase, Task, TaskStatus, DurationUnit, Currency } from '../types';

export const parseProjectText = (text: string): Partial<Project> => {
  const lines = text.split('\n'); // Don't trim yet to preserve indentation detection

  if (lines.length === 0 || text.trim().length === 0) {
    return {};
  }

  const project: Partial<Project> = {
    name: 'New Project',
    description: '',
    phases: [],
    startDate: new Date(),
    duration: 4,
    durationUnit: DurationUnit.Weeks,
    team: { members: [] },
    cost: 0,
    currency: Currency.NGN
  };

  // --- Metadata Extraction ---

  // 1. Project Name
  // Heuristic: First non-empty line, or line starting with "Title:"
  const firstNonEmptyLine = lines.find(l => l.trim().length > 0) || '';
  if (firstNonEmptyLine.toLowerCase().startsWith('title:')) {
    project.name = firstNonEmptyLine.substring(6).trim();
  } else {
    // If first line implies a question or is short, use it. Otherwise "New Project"
    const cleanedFirst = firstNonEmptyLine.trim();
    if (cleanedFirst.length < 100) {
      project.name = cleanedFirst;
    }
  }

  // 2. Cost Extraction
  // Look for currency patterns across the whole text
  project.cost = extractTotalCost(text);
  project.currency = inferCurrency(text);


  // --- Structural Parsing ---
  const structure = parseStructure(lines);
  project.phases = structure.phases;

  // If we found tasks but no phases, wrap them in a default phase
  if (project.phases.length === 0 && structure.orphanedTasks.length > 0) {
    project.phases.push({
      id: `phase-default-${Date.now()}`,
      name: 'Implementation',
      weekRange: 'TBD',
      tasks: structure.orphanedTasks
    });
  }

  // 3. Description & Duration Inference
  // Everything before the first phase (or first task if no phases) is potential description
  const firstStructureLineIndex = structure.firstStructureLineIndex;
  if (firstStructureLineIndex > 0) {
    const descriptionLines = lines.slice(0, firstStructureLineIndex)
      .map(l => l.trim())
      .filter(l => l.length > 0 && l !== project.name); // Exclude title

    if (descriptionLines.length > 0) {
      project.description = descriptionLines.join('\n').slice(0, 500); // Limit length
    }
  }

  // Estimate duration based on task count if not explicit
  // Simple heuristic: 0.5 weeks per task, min 4 weeks, max 52
  const totalTasks = project.phases.reduce((acc, p) => acc + p.tasks.length + p.tasks.reduce((sAcc, t) => sAcc + (t.subTasks?.length || 0), 0), 0);
  project.duration = Math.max(4, Math.ceil(totalTasks * 0.5));

  return project;
};

// --- Helper Functions ---

function extractTotalCost(text: string): number {
  let total = 0;
  // Regex for "Cost: 50,000", "Budget: $500", "50000 NGN"
  // Matches: (Label)? (Currency)? (Amount) (Currency)?
  // We'll look for specific patterns to avoid summing up year numbers (2025) or quantities

  const costRegex = /(?:cost|budget|price|total|amount)[\s:]+(?:[₦$]|NGN|USD)?\s?([\d,]+(\.\d{1,2})?)/gi;
  let match;
  while ((match = costRegex.exec(text)) !== null) {
    const amountStr = match[1].replace(/,/g, '');
    const amount = parseFloat(amountStr);
    if (!isNaN(amount)) {
      total += amount;
    }
  }

  // Fallback: look for explicit currency symbols with numbers if no labels found
  if (total === 0) {
    const currencyRegex = /(?:[₦$]|NGN|USD)\s?([\d,]+(\.\d{1,2})?)/gi;
    while ((match = currencyRegex.exec(text)) !== null) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount)) {
        total += amount;
      }
    }
  }

  return total;
}

function inferCurrency(text: string): Currency {
  if (text.includes('$') || text.includes('USD')) return Currency.USD;
  return Currency.NGN;
}

// --- Structural Parsing Logic ---

interface ParsedPhase extends Phase {
  // Helper to keep track while parsing
}

interface StructuralResult {
  phases: Phase[];
  orphanedTasks: Task[];
  firstStructureLineIndex: number;
}

function parseStructure(lines: string[]): StructuralResult {
  const phases: Phase[] = [];
  let orphanedTasks: Task[] = [];

  let currentPhase: Phase | null = null;
  let currentParentTask: Task | null = null;
  let parentIndent = -1;
  let parentMarkerType: 'bullet' | 'number' | 'letter' | 'none' = 'none';

  let firstStructureLineIndex = -1;

  // Regex Checkers
  const patterns = {
    phaseHeader: /^(Phase|Stage|Step|Part)\s+\d+[:.]?|^(What's missing|Gap Analysis|Strategy|Vision|Inclusivity|Youth|EdTech|Change management)[:?]?/i,
    explicitPhase: /^(Phase|Stage|Step)\s+([A-Za-z0-9]+)[:.-]?\s+(.*)/i,
    bullet: /^(\s*)([-*•⁃])\s+(.*)/,
    number: /^(\s*)(\d+)[.)]\s+(.*)/,
    letter: /^(\s*)([a-z])[.)]\s+(.*)/i,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Detect Phase
    const isPhase =
      patterns.phaseHeader.test(trimmed) ||
      (trimmed.endsWith(':') && trimmed.length < 60) ||
      (trimmed.endsWith('?') && trimmed.length < 100);

    if (isPhase) {
      if (firstStructureLineIndex === -1) firstStructureLineIndex = i;

      let name = trimmed.replace(/[:?]$/, '');
      const explicitMatch = trimmed.match(patterns.explicitPhase);
      if (explicitMatch && explicitMatch[3]) name = explicitMatch[3];

      currentPhase = {
        id: `phase-${Date.now()}-${phases.length}`,
        name: name.trim(),
        weekRange: 'TBD',
        tasks: []
      };
      phases.push(currentPhase);

      // Reset task context on new phase
      currentParentTask = null;
      parentIndent = -1;
      parentMarkerType = 'none';
      continue;
    }

    // 2. Detect Task / List Item
    const bulletMatch = line.match(patterns.bullet);
    const numberMatch = line.match(patterns.number);
    const letterMatch = line.match(patterns.letter);

    const match = bulletMatch || numberMatch || letterMatch;

    if (match) {
      if (firstStructureLineIndex === -1) firstStructureLineIndex = i;

      const indent = match[1].length;
      // Determine marker type
      let markerType: 'bullet' | 'number' | 'letter' = 'bullet';
      if (numberMatch) markerType = 'number';
      else if (letterMatch) markerType = 'letter';

      const content = match[3].trim();

      // 3. Determine Hierarchy
      let isSubtask = false;

      if (currentParentTask) {
        // Hierarchy Strategy:
        // 1. Indentation Increase: If indent > parentIndent, it IS a subtask.
        // 2. Marker Hierarchy (for flat text or messy indents):
        //    - Number (1.) -> Letter (a.) = Subtask
        //    - Number (1.) -> Bullet (-)  = Subtask
        //    - Letter (a.) -> Bullet (-)  = Subtask
        //    - Same Type (1. -> 2.)       = Sibling (Not Subtask)

        // Note: we generally assume 2 spaces is a visual indent step.
        // If indent is exactly same as parent, check marker types.
        // If indent is smaller, it's definitely a sibling (or end of subtask block).

        if (indent > parentIndent + 1) {
          // Explicit indentation (fuzzy match > 1 space difference)
          isSubtask = true;
        } else if (Math.abs(indent - parentIndent) <= 1) {
          // Roughly same indentation (handling off-by-one errors)
          // Use Marker Logic for tie-breaking
          if (parentMarkerType === 'number' && (markerType === 'letter' || markerType === 'bullet')) {
            isSubtask = true;
          } else if (parentMarkerType === 'letter' && markerType === 'bullet') {
            isSubtask = true;
          }
        }
        // If indent < parentIndent, strictly a sibling (or ancestor sibling, but we only support 1 level deep so sibling of parent's parent -> sibling of parent for us)
      }

      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: content,
        status: TaskStatus.Zero,
        startDate: new Date(),
        endDate: new Date(),
        subTasks: []
      };

      if (isSubtask && currentParentTask) {
        if (!currentParentTask.subTasks) currentParentTask.subTasks = [];
        currentParentTask.subTasks.push(newTask);
        // Do NOT update currentParentTask; we stay attached to the same parent.
        // Unless we supported infinite nesting, which we don't (UI is 2-level).
      } else {
        // Sibling Task
        if (currentPhase) {
          currentPhase.tasks.push(newTask);
        } else {
          orphanedTasks.push(newTask);
        }
        // This becomes the new parent context
        currentParentTask = newTask;
        parentIndent = indent;
        parentMarkerType = markerType;
      }
    }
    else {
      // Text line, check for ALL CAPS header
      if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
        if (firstStructureLineIndex === -1) firstStructureLineIndex = i;
        currentPhase = {
          id: `phase-${Date.now()}-${phases.length}`,
          name: trimmed,
          weekRange: 'TBD',
          tasks: []
        };
        phases.push(currentPhase);
        currentParentTask = null;
        parentIndent = -1;
      }
    }
  }

  return { phases, orphanedTasks, firstStructureLineIndex };
}
