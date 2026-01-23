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

  // 4. Description & Project Type Inference
  const firstStructureLineIndex = structure.firstStructureLineIndex;

  // Generate description from phase names and project context
  if (!project.description || project.description.length === 0) {
    const phaseNames = project.phases.map(p => p.name).slice(0, 5);
    if (phaseNames.length > 0) {
      project.description = `Project covering: ${phaseNames.join(', ')}.`;
    } else if (firstStructureLineIndex > 0) {
      const descriptionLines = lines.slice(0, firstStructureLineIndex)
        .map(l => l.trim())
        .filter(l => l.length > 0 && l !== project.name && !l.startsWith('Cost') && !l.startsWith('Budget'));
      if (descriptionLines.length > 0) {
        project.description = descriptionLines.join(' ').slice(0, 500);
      }
    }
    if (!project.description) {
      project.description = `${project.name} - Project plan with ${project.phases.length} sections.`;
    }
  }

  // 5. Infer Project Type (coreSystem) from keywords
  project.coreSystem = inferCoreSystem(text);

  // 6. Infer Duration
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

  // Parse shorthand multipliers (K=thousand, M=million, B=billion)
  const parseAmount = (amountStr: string, suffix?: string): number => {
    const num = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(num)) return 0;
    const multiplier = suffix?.toUpperCase();
    if (multiplier === 'K') return num * 1000;
    if (multiplier === 'M') return num * 1000000;
    if (multiplier === 'B') return num * 1000000000;
    return num;
  };

  // Extended cost regex with fee/charge keywords and K/M/B support
  const costRegex = /(?:cost|budget|price|total|amount|fee|charge)[\s:]+(?:[₦$£€¥₹]|NGN|USD|GBP|EUR|JPY|INR)?\s?([\d,]+(?:\.\d{1,2})?)\s*([KMB])?/gi;
  let match;
  while ((match = costRegex.exec(text)) !== null) {
    total += parseAmount(match[1], match[2]);
  }

  if (total === 0) {
    // Fallback: standalone currency amounts with K/M/B support
    const currencyRegex = /(?:[₦$£€¥₹]|NGN|USD|GBP|EUR|JPY|INR)\s?([\d,]+(?:\.\d{1,2})?)\s*([KMB])?/gi;
    while ((match = currencyRegex.exec(text)) !== null) {
      total += parseAmount(match[1], match[2]);
    }
  }
  return total;
}

function inferCurrency(text: string): Currency {
  if (text.includes('£') || text.includes('GBP')) return Currency.USD; // Map to USD as fallback
  if (text.includes('€') || text.includes('EUR')) return Currency.USD;
  if (text.includes('$') || text.includes('USD')) return Currency.USD;
  if (text.includes('¥') || text.includes('JPY')) return Currency.USD;
  if (text.includes('₹') || text.includes('INR')) return Currency.USD;
  return Currency.NGN;
}

function inferCoreSystem(text: string): string {
  const lowerText = text.toLowerCase();

  // Keyword mappings for project types
  const typeKeywords: Record<string, string[]> = {
    'Technical': [
      'technical', 'system', 'api', 'database', 'code', 'software', 'platform',
      'infrastructure', 'server', 'deployment', 'cloud', 'network', 'ict',
      'digital', 'technology', 'app', 'application', 'integration', 'automation',
      'biometrics', 'connectivity', 'devices', 'dashboard', 'data'
    ],
    'Business': [
      'business', 'strategy', 'revenue', 'sales', 'marketing', 'customer',
      'stakeholder', 'kpi', 'budget', 'funding', 'roi', 'profit', 'growth',
      'operations', 'process', 'workflow', 'efficiency'
    ],
    'Creative': [
      'creative', 'design', 'brand', 'ui', 'ux', 'graphic', 'visual',
      'media', 'content', 'video', 'animation', 'illustration', 'art'
    ],
    'Research': [
      'research', 'analysis', 'study', 'survey', 'investigation', 'academic',
      'thesis', 'paper', 'publication', 'experiment', 'hypothesis', 'findings'
    ],
    'Compliance': [
      'compliance', 'regulation', 'audit', 'legal', 'policy', 'governance',
      'security', 'privacy', 'gdpr', 'standards', 'certification', 'risk'
    ]
  };

  // Count keyword matches for each type
  const scores: Record<string, number> = {};
  for (const [type, keywords] of Object.entries(typeKeywords)) {
    scores[type] = keywords.filter(kw => lowerText.includes(kw)).length;
  }

  // Find the type with most matches
  let bestType = 'Technical'; // Default
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  return bestType;
}

function extractTeam(text: string): TeamMember[] {
  const members: TeamMember[] = [];
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();

  // Title prefixes that indicate admin role
  const adminTitles = /^(Dr\.?|Prof\.?|CEO|VC|Director|Chairman|President)\s+/i;

  const addMember = (name: string, email?: string, role?: 'primary' | 'secondary') => {
    let cleanName = name.replace(/[(),]/g, '').trim();
    if (!cleanName || cleanName.length < 2) return;
    if (seenNames.has(cleanName)) return;

    // Detect admin role from title
    let detectedRole = role;
    if (adminTitles.test(cleanName)) {
      detectedRole = 'primary'; // Admin/leadership role
    }

    const finalEmail = email || `${cleanName.replace(/\s+/g, '.').toLowerCase()}@placeholder.com`;

    members.push({
      uid: `temp-${Date.now()}-${members.length}`,
      email: finalEmail,
      displayName: cleanName,
      leadRole: detectedRole
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
    // Phase detection with extended keywords (Milestone, Sprint, Quarter, Week)
    phaseHeader: /^(Phase|Stage|Step|Part|Milestone|Sprint|Quarter|Week)\s+\d*[:.]?|^(What's missing|Gap Analysis|Strategy|Vision|Inclusivity|Youth|EdTech|Change management|Objectives|Milestones)[:?]?/i,
    explicitPhase: /^(Phase|Stage|Step|Milestone|Sprint)\s+([A-Za-z0-9]+)[:.-]?\s+(.*)/i,
    markdownHeader: /^#\s+(.*)/, // Support # Header (Single # for Phase usually in pasted text)
    horizontalRule: /^[-_*]{3,}$/, // Detect --- or ___ or *** as section breaks
    bullet: /^(\s*)([-*•⁃○◦▪▫])\s+(.*)/,  // Extended bullet symbols
    number: /^(\s*)(\d+(?:\.\d+)*)[.)]\s+(.*)/,  // Support nested numbering 1.1.1
    letter: /^(\s*)([a-z])[.)]\s+(.*)/i,
    dateHeader: /^\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}/i
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect horizontal rule as section break (starts new phase context)
    if (patterns.horizontalRule.test(trimmed)) {
      currentParentTask = null;
      parentIndent = -1;
      parentMarkerType = 'none';
      continue;
    }

    // 1. Check if this is a numbered item at indent level 0 (should be a phase)
    const numberMatch = line.match(patterns.number);
    if (numberMatch && numberMatch[1].length === 0) {
      // Top-level numbered item = Phase
      if (firstStructureLineIndex === -1) firstStructureLineIndex = i;

      currentPhase = {
        id: `phase-${Date.now()}-${phases.length}`,
        name: numberMatch[3].trim(),
        weekRange: 'TBD',
        tasks: []
      };
      phases.push(currentPhase);

      currentParentTask = null;
      parentIndent = -1;
      parentMarkerType = 'none';
      continue;
    }

    // 2. Detect Phase (other patterns)
    const isPhase =
      patterns.phaseHeader.test(trimmed) ||
      patterns.markdownHeader.test(trimmed) ||
      patterns.dateHeader.test(trimmed) ||
      (trimmed.endsWith(':') && trimmed.length < 60 && !trimmed.includes('=')) ||
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

    // 3. Detect Task / List Item
    const bulletMatch = line.match(patterns.bullet);
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
      // 4. Check for indented plain text (no bullet/number) when inside a phase
      const leadingSpaces = line.length - line.trimStart().length;

      if (currentPhase && leadingSpaces >= 2 && trimmed.length > 0) {
        // This is indented text under a phase - treat as a task
        if (firstStructureLineIndex === -1) firstStructureLineIndex = i;

        const enrichedTask = enrichTask(trimmed);

        const newTask: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          ...enrichedTask,
          startDate: new Date(),
          endDate: new Date(),
          subTasks: []
        };

        // Check if this should be a subtask based on deeper indentation
        if (currentParentTask && leadingSpaces > parentIndent) {
          if (!currentParentTask.subTasks) currentParentTask.subTasks = [];
          currentParentTask.subTasks.push(newTask);
        } else {
          currentPhase.tasks.push(newTask);
          currentParentTask = newTask;
          parentIndent = leadingSpaces;
        }
        continue;
      }

      // 5. Text line check
      // Check for ALL CAPS Header (more restrictive - must be standalone, no colons/equals)
      if (trimmed.length > 10 &&
        trimmed.length < 50 &&
        trimmed === trimmed.toUpperCase() &&
        /^[A-Z\s]+$/.test(trimmed) &&
        !trimmed.includes(':') &&
        !trimmed.includes('=')) {
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
  let assignee: string | undefined;
  let dueDate: Date | undefined;

  // Status detection with extended checkbox symbols
  if (/\[x\]|\[X\]|☑|✓|✔/.test(name) || /\b(done|completed)\b/i.test(name)) {
    status = TaskStatus.Hundred;
    name = name.replace(/\[x\]|\[X\]|☑|✓|✔/g, '').trim();
  } else if (/\[ \]|☐|□/.test(name)) {
    status = TaskStatus.Zero;
    name = name.replace(/\[ \]|☐|□/g, '').trim();
  } else if (/\b(in progress|wip|ongoing)\b/i.test(name)) {
    status = TaskStatus.TwentyFive;
  }

  // Priority detection with extended levels
  if (/\[High\]|\(High\)|\bPriority:\s*High\b|\bP1\b|\bCritical\b/i.test(name)) {
    priority = 'high';
    name = name.replace(/\[High\]|\(High\)|\bPriority:\s*High\b|\bP1\b|\bCritical\b/gi, '').trim();
  } else if (/\[Low\]|\(Low\)|\bPriority:\s*Low\b|\bP3\b/i.test(name)) {
    priority = 'low';
    name = name.replace(/\[Low\]|\(Low\)|\bPriority:\s*Low\b|\bP3\b/gi, '').trim();
  } else if (/\bP2\b|\bMedium\b/i.test(name)) {
    priority = 'medium';
    name = name.replace(/\bP2\b|\bMedium\b/gi, '').trim();
  }

  // Assignee extraction: (assigned to X), (@username), (Owner: X)
  const assigneeMatch = name.match(/(?:assigned to|@|Owner:\s*)([A-Za-z][A-Za-z\s]{1,20})/i);
  if (assigneeMatch) {
    assignee = assigneeMatch[1].trim();
    name = name.replace(/\(assigned to [^)]+\)|@[A-Za-z]+|\(Owner:\s*[^)]+\)/gi, '').trim();
  }

  // Due date extraction: "by Jan 15", "due: 2026-01-20", "deadline: next Friday"
  const dueDatePatterns = [
    /(?:by|due|deadline)[:\s]+([A-Za-z]+\s+\d{1,2}(?:,?\s*\d{4})?)/i,  // "by Jan 15" or "by Jan 15, 2026"
    /(?:by|due|deadline)[:\s]+(\d{4}-\d{2}-\d{2})/i,  // "due: 2026-01-20"
    /(?:by|due|deadline)[:\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i  // "due: 01/20/2026"
  ];

  for (const pattern of dueDatePatterns) {
    const dateMatch = name.match(pattern);
    if (dateMatch) {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        dueDate = parsed;
        name = name.replace(pattern, '').trim();
        break;
      }
    }
  }

  // Clean up extra whitespace and punctuation
  name = name.replace(/\s{2,}/g, ' ').replace(/^[-–—:,]\s*/, '').trim();

  const result: Partial<Task> = { name, status };
  if (dueDate) result.endDate = dueDate;

  return result;
}
