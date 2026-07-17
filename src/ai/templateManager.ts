// Tujuan: Mengelola penyimpanan, pencarian, dan penerapan template blueprint rencana tugas (BRD, Design, Arch, Task, DevOps).
// Caller: src/ai/supervisor.ts
// Dependensi: fs, path, utils/context
// Main Functions: findMatchingTemplate, applyTemplate, saveTemplate
// Side Effects: Tidak ada.

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getProjectDir, log } from '../utils/context';

export interface TaskTemplate {
  id: string;
  description: string;
  brd: string;
  design: string;
  architecture: string;
  task: string;
  devops: string;
}

function getTemplatesFile(): string {
  return path.join(getProjectDir(), '.ceobe', 'templates.json');
}

export function getTemplates(): TaskTemplate[] {
  const file = getTemplatesFile();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

export function clearTemplates(): void {
  const file = getTemplatesFile();
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
  log(chalk.green(`[TemplateManager] All templates cleared.`));
}

export function deleteTemplate(id: string): boolean {
  const file = getTemplatesFile();
  const templates = getTemplates();
  const initialLength = templates.length;
  const newTemplates = templates.filter(t => t.id !== id);
  if (newTemplates.length < initialLength) {
    fs.writeFileSync(file, JSON.stringify(newTemplates, null, 2));
    log(chalk.green(`[TemplateManager] Template ${id} deleted.`));
    return true;
  }
  return false;
}

export function saveTemplate(description: string): void {
  const ceobeDir = path.join(getProjectDir(), '.ceobe');
  const readSafe = (file: string) => {
    const fullPath = path.join(ceobeDir, file);
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
  };

  const template: TaskTemplate = {
    id: `tpl_${Date.now()}`,
    description,
    brd: readSafe('brd.md'),
    design: readSafe('design.md'),
    architecture: readSafe('architecture.md'),
    task: readSafe('task.md'),
    devops: readSafe('devops.md'),
  };

  const templates = getTemplates();
  templates.push(template);
  
  const file = getTemplatesFile();
  if (!fs.existsSync(path.dirname(file))) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  
  fs.writeFileSync(file, JSON.stringify(templates, null, 2));
  log(chalk.green(`[TemplateManager] Saved successful task as template: ${template.id}`));
}

// Simple Jaccard similarity for matching
function calculateSimilarity(str1: string, str2: string): number {
  const set1 = new Set(str1.toLowerCase().split(/\s+/));
  const set2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  return intersection.size / union.size;
}

export function findMatchingTemplate(description: string, threshold = 0.85): TaskTemplate | null {
  const templates = getTemplates();
  let bestMatch: TaskTemplate | null = null;
  let highestScore = 0;

  for (const tpl of templates) {
    const score = calculateSimilarity(description, tpl.description);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = tpl;
    }
  }

  if (bestMatch && highestScore >= threshold) {
    log(chalk.cyan(`[TemplateManager] Found matching template (${(highestScore * 100).toFixed(1)}% match)`));
    return bestMatch;
  }
  return null;
}

export function applyTemplate(template: TaskTemplate): void {
  const ceobeDir = path.join(getProjectDir(), '.ceobe');
  if (!fs.existsSync(ceobeDir)) fs.mkdirSync(ceobeDir, { recursive: true });

  const writeSafe = (file: string, content: string) => {
    if (content) fs.writeFileSync(path.join(ceobeDir, file), content);
  };

  writeSafe('brd.md', template.brd);
  writeSafe('design.md', template.design);
  writeSafe('architecture.md', template.architecture);
  writeSafe('task.md', template.task);
  writeSafe('devops.md', template.devops);

  log(chalk.green(`[TemplateManager] Applied template ${template.id}. Planning phase can be bypassed.`));
}
