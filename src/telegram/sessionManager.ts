import { readProjects } from '../utils/projectRegistry';

export interface ProjectSession {
  projectName: string;
  projectPath: string;
}

// Global in-memory session store mapping chatId -> ProjectSession
export const sessionStore = new Map<number, ProjectSession>();

export function getActiveSession(chatId: number): ProjectSession | undefined {
  return sessionStore.get(chatId);
}

export function switchSession(chatId: number, projectName: string): boolean {
  const projects = readProjects();
  if (projectName in projects) {
    sessionStore.set(chatId, {
      projectName,
      projectPath: projects[projectName],
    });
    return true;
  }
  return false;
}
