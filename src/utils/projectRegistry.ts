import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ProjectRegistry {
  [name: string]: string; // name -> absolute path
}

export function getProjectRegistryPath(): string {
  return path.join(os.homedir(), '.ceobe', 'projects.json');
}

export function readProjects(): ProjectRegistry {
  const filePath = getProjectRegistryPath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ProjectRegistry;
  } catch {
    return {};
  }
}

export function writeProjects(projects: ProjectRegistry): void {
  const filePath = getProjectRegistryPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function registerProject(name: string, absolutePath: string): void {
  const projects = readProjects();
  projects[name] = path.resolve(absolutePath);
  writeProjects(projects);
}

export function removeProject(name: string): boolean {
  const projects = readProjects();
  if (!(name in projects)) return false;
  delete projects[name];
  writeProjects(projects);
  return true;
}
