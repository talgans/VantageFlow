import { Project, Phase, Task, TaskStatus, DurationUnit, Currency } from '../types';

export const parseProjectText = (text: string): Partial<Project> => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  if (lines.length === 0) {
    return {};
  }

  const project: Partial<Project> = {
    name: '',
    description: '',
    phases: [],
    startDate: new Date(),
    duration: 4, // Default duration
    durationUnit: DurationUnit.Weeks,
    team: {
      members: []
    },
    cost: 0,
    currency: Currency.NGN
  };

  // Heuristic 1: First line is the project name
  project.name = lines[0];

  let currentPhase: Phase | null = null;
  let descriptionLines: string[] = [];
  let isParsingPhases = false;

  // Keywords that might indicate a new phase or section
  const phaseKeywords = [
    "Phase", "Stage", "Step",
    "What's missing", "Gap Analysis", "Missing",
    "Strategy", "Vision", "Inclusivity", "Youth", "EdTech", "Change management", "Political economy"
  ];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Check if line is a phase header
    // It is a phase if it starts with a keyword or ends with a colon
    const isPhaseHeader = phaseKeywords.some(keyword => line.toLowerCase().startsWith(keyword.toLowerCase())) || line.endsWith(':');

    if (isPhaseHeader) {
      isParsingPhases = true;

      // If we were building a description, stop now
      if (descriptionLines.length > 0 && !project.description) {
        project.description = descriptionLines.join('\n');
      }

      // Create new phase
      currentPhase = {
        id: `phase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: line.replace(':', '').trim(),
        weekRange: 'TBD',
        tasks: []
      };
      project.phases?.push(currentPhase);
      continue;
    }

    if (isParsingPhases && currentPhase) {
      // It's an item/task in the current phase
      // Remove bullet points if present
      const cleanLine = line.replace(/^[-*•]\s*/, '').trim();

      const newTask: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: cleanLine,
        status: TaskStatus.Zero,
        startDate: new Date(),
        endDate: new Date(),
        subTasks: []
      };

      currentPhase.tasks.push(newTask);
    } else {
      // Still in description territory
      descriptionLines.push(line);
    }
  }

  // If we never found phases, everything after line 0 is description
  if (!project.description && descriptionLines.length > 0) {
    project.description = descriptionLines.join('\n');
  }

  return project;
};
