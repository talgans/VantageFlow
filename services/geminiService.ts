
import { GoogleGenAI } from "@google/genai";
import { Project, Task, Phase } from '../types';

const getApiKey = () => {
    // In a real app, you'd use a more secure way to get the API key
    return process.env.API_KEY;
};

export const getProjectInsights = async (project: Project): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) {
        return "API_KEY is not configured. Please set it in your environment variables.";
    }
    const ai = new GoogleGenAI({ apiKey });

    const formatTasks = (tasks: Task[], indent = ''): string => {
        return tasks.map(task =>
            `${indent}- Task: "${task.name}"
${indent}  Status: ${task.status}
${indent}  Duration: ${task.startDate.toLocaleDateString()} to ${task.endDate.toLocaleDateString()}
${task.deliverables ? `${indent}  Deliverables: ${task.deliverables.join(', ')}` : ''}`
        ).join('\n');
    }

    const projectData = `
    Project Name: ${project.name}
    Description: ${project.description}
    Overall Duration: ${project.duration}

    Phases and Tasks:
    ${project.phases.map(phase => `
    Phase: "${phase.name}" (${phase.weekRange})
    ${formatTasks(phase.tasks, '  ')}
    `).join('\n')}
    `;

    const prompt = `
    Analyze the following project plan. Act as an expert project manager. Provide a concise analysis covering these three areas:
    1.  **Overall Health Assessment:** Give a summary of the project's current status (e.g., on-track, needs attention, at risk).
    2.  **Key Risk Identification:** Identify the top 2-3 potential risks or bottlenecks based on the tasks marked "At Risk" or tasks that are still "In Progress" in later phases.
    3.  **Actionable Recommendations:** Suggest 2-3 concrete actions to mitigate these risks and keep the project on schedule.

    Format your response in simple markdown. Use headings for each section.

    Project Data:
    ${projectData}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error fetching AI insights:", error);
        return "An error occurred while analyzing the project. Please check the console for details.";
    }
};
