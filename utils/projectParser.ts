import { Project, Phase, Task, TaskStatus, DurationUnit, Currency, TeamMember } from '../types';

export interface ParserMetadata {
  sourceType: 'word_document' | 'meeting_notes' | 'text' | 'unknown';
  parseDate: string;
  confidence: number;
  warnings: string[];
}

export interface ParseResult {
  project: Partial<Project>;
  metadata: ParserMetadata;
}

export const parseProjectText = (text: string): ParseResult => {
  const lines = text.split('\n');
  const warnings: string[] = [];
  let confidence = 1.0;

  if (lines.length === 0 || text.trim().length === 0) {
    return {
      project: {},
      metadata: { sourceType: 'unknown', parseDate: new Date().toISOString(), confidence: 0, warnings: ['Empty input'] }
    };
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
  const linesToSkip = new Set<number>();
  const dateLineRegex = /^\d{1,2}[\s-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s-]\d{4}/i;

  let possibleTitle = '';
  // Enhanced Title Logic: Skip dates, skip implicit phases
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('title:')) {
      possibleTitle = line.substring(6).trim();
      linesToSkip.add(i);
      break;
    }
    // If line is NOT a date and NOT too long, candidate for title
    if (!possibleTitle && !dateLineRegex.test(line) && line.length < 100) {
      // Check if it's a Markdown Header acting as Title?
      const cleanLine = line.replace(/^#+\s+/, '');
      possibleTitle = cleanLine;
    }
  }
  project.name = possibleTitle || 'New Project';

  // 2. Cost Extraction
  project.cost = extractTotalCost(text);
  project.currency = inferCurrency(text);
  if (project.cost === 0 && text.length > 500) {
    warnings.push("No explicit budget found - estimated cost is 0");
    confidence -= 0.1;
  }

  // 3. Team Extraction
  const extractedTeam = extractTeam(text);
  project.team = { members: extractedTeam };
  if (extractedTeam.length === 0) {
    warnings.push("No team members detected");
  }

  // --- Structural Parsing ---
  const structure = parseStructure(lines);
  project.phases = structure.phases;

  // Handle "orphaned" tasks (those not under any phase)
  if (structure.orphanedTasks.length > 0) {
    if (project.phases.length === 0) {
      project.phases.push({
        id: `phase-default-${Date.now()}`,
        name: 'Implementation',
        weekRange: 'TBD',
        tasks: structure.orphanedTasks
      });
    } else {
      // Append to first phase acting as "General" or "Planning"
      project.phases[0].tasks.push(...structure.orphanedTasks);
    }
  }

  if (project.phases.length === 0) {
    warnings.push("No phases detected, check document structure");
    confidence -= 0.2;
  }

  // 4. Description & Timeline
  const firstStructureLineIndex = structure.firstStructureLineIndex;
  if (firstStructureLineIndex > 0) {
    const descriptionLines = lines.slice(0, firstStructureLineIndex)
      .map(l => l.trim())
      .filter(l => l.length > 0 && l !== project.name && !l.startsWith('Cost') && !l.startsWith('Budget'));

    if (descriptionLines.length > 0) {
      project.description = descriptionLines.join('\n').slice(0, 500);
    }
  }

  // Infer Duration
  const totalTasks = project.phases.reduce((acc, p) => acc + p.tasks.length + p.tasks.reduce((sAcc, t) => sAcc + (t.subTasks?.length || 0), 0), 0);
  project.duration = Math.max(4, Math.ceil(totalTasks * 0.5));

  // Check if dates were found in text (Expanded Regex)
  const dateRegexWide = /\b(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2}(?:,\s\d{4})?/gi;
  const foundDates = text.match(dateRegexWide) || [];

  if (foundDates.length > 0) {
    // Naive parsing: if we see dates, assume the first reasonable one might be start
  } else {
    warnings.push("No specific dates found, using default timeline");
  }

  return {
    project,
    metadata: {
      sourceType: text.includes('Meeting') ? 'meeting_notes' : 'text',
      parseDate: new Date().toISOString(),
      confidence: Math.max(0, parseFloat(confidence.toFixed(2))),
      warnings
    }
  };
};

// --- Helper Functions ---

function extractTotalCost(text: string): number {
  let total = 0;
  const costRegex = /(?:cost|budget|price|total|amount)[\s:]+(?:[₦$]|NGN|USD)?\s?([\d,]+(\.\d{1,2})?)/gi;
  let match;
  while ((match = costRegex.exec(text)) !== null) {
    const amountStr = match[1].replace(/,/g, '');
    const amount = parseFloat(amountStr);
    if (!isNaN(amount)) total += amount;
  }

  if (total === 0) {
    const currencyRegex = /(?:[₦$]|NGN|USD)\s?([\d,]+(\.\d{1,2})?)/gi;
    while ((match = currencyRegex.exec(text)) !== null) {
      const amountStr = match[1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount)) total += amount;
    }
  }
  return total;
}

function inferCurrency(text: string): Currency {
  if (text.includes('$') || text.includes('USD')) return Currency.USD;
  return Currency.NGN;
}

function extractTeam(text: string): TeamMember[] {
  const members: TeamMember[] = [];
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();

  const addMember = (name: string, email?: string, role?: 'primary' | 'secondary') => {
    const cleanName = name.replace(/[(),]/g, '').trim();
    if (!cleanName || cleanName.length < 2) return;
    if (seenNames.has(cleanName)) return;

    const finalEmail = email || `${cleanName.replace(/\s+/g, '.').toLowerCase()}@placeholder.com`;

    members.push({
      uid: `temp-${Date.now()}-${members.length}`,
      email: finalEmail,
      displayName: cleanName,
      leadRole: role
    });
    seenNames.add(cleanName);
    seenEmails.add(finalEmail);
  };

  // 1. Email extraction
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    const email = match[0];
    if (!seenEmails.has(email)) {
      addMember(email.split('@')[0], email);
    }
  }

  // 2. "Retreat: Name, Name" or "Team: Name, Name"
  const teamHeaderRegex = /(?:Retreat|Team|Attendees|Responsible|Members):\s*([^\n]+)/i;
  const headerMatch = text.match(teamHeaderRegex);
  if (headerMatch) {
    const names = headerMatch[1].split(/[,;]/).map(n => n.trim());
    names.forEach(name => addMember(name));
  }

  // 3. Mentions @Name
  const mentionRegex = /@([A-Z][a-zA-Z]+)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    addMember(match[1]);
  }

  // 4. Role Assignment (Owner: Sarah) or (Lead: John)
  const roleRegex = /\((?:Owner|Lead|Manager):\s*([A-Za-z]+)\)/gi;
  while ((match = roleRegex.exec(text)) !== null) {
    addMember(match[1], undefined, 'primary');
  }

  return members;
}

// --- Structural Parsing Logic ---

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

  const patterns = {
    // Added specific check to avoid capturing Dates as Phase Headers
    phaseHeader: /^(Phase|Stage|Step|Part)\s+\d+[:.]?|^(What's missing|Gap Analysis|Strategy|Vision|Inclusivity|Youth|EdTech|Change management|Objectives|Milestones)[:?]?/i,
    explicitPhase: /^(Phase|Stage|Step)\s+([A-Za-z0-9]+)[:.-]?\s+(.*)/i,
    markdownHeader: /^#\s+(.*)/, // Support # Header (Single # for Phase usually in pasted text)
    bullet: /^(\s*)([-*•⁃])\s+(.*)/,
    number: /^(\s*)(\d+)[.)]\s+(.*)/,
    letter: /^(\s*)([a-z])[.)]\s+(.*)/i,
    dateHeader: /^\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}/i
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. Detect Phase
    const isPhase =
      patterns.phaseHeader.test(trimmed) ||
      patterns.markdownHeader.test(trimmed) ||
      patterns.dateHeader.test(trimmed) ||
      (trimmed.endsWith(':') && trimmed.length < 60) ||
      (trimmed.endsWith('?') && trimmed.length < 100);

    if (isPhase) {
      if (firstStructureLineIndex === -1) firstStructureLineIndex = i;

      let name = trimmed.replace(/[:?]$/, '');
      const explicitMatch = trimmed.match(patterns.explicitPhase);
      if (explicitMatch && explicitMatch[3]) name = explicitMatch[3];

      const mdMatch = trimmed.match(patterns.markdownHeader);
      if (mdMatch) name = mdMatch[1];

      currentPhase = {
        id: `phase-${Date.now()}-${phases.length}`,
        name: name.trim(),
        weekRange: 'TBD',
        tasks: []
      };
      phases.push(currentPhase);

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
      let markerType: 'bullet' | 'number' | 'letter' = 'bullet';
      if (numberMatch) markerType = 'number';
      else if (letterMatch) markerType = 'letter';

      const content = match[3].trim();

      // 3. Hierarchy Check
      let isSubtask = false;

      if (currentParentTask) {
        if (indent > parentIndent + 1) {
          isSubtask = true;
        } else if (Math.abs(indent - parentIndent) <= 1) {
          // Logic: Number -> Letter = Subtask
          if (parentMarkerType === 'number' && (markerType === 'letter' || markerType === 'bullet')) {
            isSubtask = true;
          }
        }
      }

      // Enrich task
      const enrichedTask = enrichTask(content);

      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ...enrichedTask,
        startDate: new Date(),
        endDate: new Date(),
        subTasks: []
      };

      if (isSubtask && currentParentTask) {
        if (!currentParentTask.subTasks) currentParentTask.subTasks = [];
        currentParentTask.subTasks.push(newTask);
      } else {
        if (currentPhase) {
          currentPhase.tasks.push(newTask);
        } else {
          orphanedTasks.push(newTask);
        }
        currentParentTask = newTask;
        parentIndent = indent;
        parentMarkerType = markerType;
      }
    }
    else {
      // Text line check
      // Check for ALL CAPS Header
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

function enrichTask(content: string): Partial<Task> {
  let name = content;
  let status = TaskStatus.Zero;
  let priority = 'normal';

  // Status detection
  if (/\[x\]|\[X\]/.test(name) || /\b(done|completed)\b/i.test(name)) {
    status = TaskStatus.Hundred;
    name = name.replace(/\[x\]|\[X\]/g, '').trim();
  } else if (/\b(in progress|wip)\b/i.test(name)) {
    status = TaskStatus.TwentyFive;
  }

  // Priority
  if (/\[High\]|\(High\)|\bPriority: High\b/i.test(name)) {
    priority = 'high';
    name = name.replace(/\[High\]|\(High\)|\bPriority: High\b/i, '').trim();
  }

  return {
    name,
    status,
  };
}
