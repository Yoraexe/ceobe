// Tujuan: Mengelola berkas registri proyek lokal (.ceobe/projects.json) untuk pemetaan sesi proyek.
// Caller: src/telegram/sessionManager.ts, src/telegram/handlers/projectHandlers.ts
// Dependensi: fs, path, os
// Main Functions: readProjects, registerProject, removeProject
// Side Effects: Tidak ada.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import lockfile from 'proper-lockfile';

export interface ProjectRegistry {
  [name: string]: string; // name -> absolute path
}

function getProjectRegistryPath(): string {
  return path.join(os.homedir(), '.ceobe', 'projects.json');
}

export function readProjects(): ProjectRegistry {
  const filePath = getProjectRegistryPath();
  if (!fs.existsSync(filePath)) return {};
  let release: (() => void) | undefined;
  try {
    release = lockfile.lockSync(filePath);
  } catch {
    // proceed if lock cannot be acquired
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ProjectRegistry;
  } catch {
    return {};
  } finally {
    if (release) release();
  }
}

function writeProjects(projects: ProjectRegistry): void {
  const filePath = getProjectRegistryPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '{}', { encoding: 'utf8', mode: 0o600 });
  }

  let release: (() => void) | undefined;
  try {
    release = lockfile.lockSync(filePath, { retries: { retries: 5, minTimeout: 50, maxTimeout: 500 } });
  } catch {
    // proceed if lock cannot be acquired
  }

  try {
    const tempPath = filePath + '.tmp.' + crypto.randomUUID();
    fs.writeFileSync(tempPath, JSON.stringify(projects, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  } finally {
    if (release) release();
  }
}

export function registerProject(name: string, absolutePath: string): void {
  const resolved = path.resolve(absolutePath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Invalid project path '${absolutePath}': Directory does not exist.`);
  }
  const rootDir = path.parse(resolved).root;
  if (resolved === rootDir || resolved.toLowerCase() === 'c:\\windows' || resolved === '/etc') {
    throw new Error(`Cannot register system root directory '${resolved}' as a project.`);
  }
  const projects = readProjects();
  projects[name] = resolved;
  writeProjects(projects);
}

export function removeProject(name: string): void {
  const projects = readProjects();
  if (projects[name]) {
    delete projects[name];
    writeProjects(projects);
  }
}
