// Tujuan: Memuat aturan Ceobe (ceobe-rules.md), draf template markdown, dan skill yang relevan dari repositori lokal.
// Caller: src/ai/utils/promptBuilder.ts, src/cli/commands/plan.ts
// Dependensi: fs, path, config/env, utils/context, ai/pentest/pentestSkillBridge
// Main Functions: readCeobeRules, readTemplate, readSpecificSkills, getAvailableSkills
// Side Effects: Membaca sistem berkas (file read) pada folder aturan, template, dan skill.

import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import chalk from 'chalk';
import { log } from './context';
import {
  getAvailablePentestSkillNames,
  loadPentestSkillsContent,
  discoverPentestSkills,
} from '../ai/pentest/pentestSkillBridge';

/**
 * Reads all .md files from a given directory and returns their concatenated content.
 */
function readAllFromDir(dirPath: string, extension: string = '.md'): string {
  if (!fs.existsSync(dirPath)) return '';
  
  let content = '';
  const files = fs.readdirSync(dirPath).filter(file => file.endsWith(extension));
  
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    try {
      const stat = fs.statSync ? fs.statSync(fullPath) : undefined;
      if (stat && typeof stat.size === 'number' && stat.size > 5 * 1024 * 1024) {
        log(chalk.yellow(`Skipped ${file}: Exceeds 5MB size limit.`));
        continue;
      }
      content += `\n--- File: ${file} ---\n`;
      content += fs.readFileSync(fullPath, 'utf-8');
      content += `\n-----------------------\n`;
    } catch (err) {
      log(chalk.red(`Failed to read ${fullPath}`) + ' ' + String(err));
    }
  }
  return content;
}

/**
 * Loads the Ceobe engineering rules and personas dynamically.
 */
export function readCeobeRules(): string {
  try {
    let combinedRules = '';
    
    const rulesDir = path.join(env.CEOBE_INSTALL_DIR, 'rules');
    const docsDir = path.join(env.CEOBE_INSTALL_DIR, 'docs');
    
    combinedRules += readAllFromDir(rulesDir);
    combinedRules += readAllFromDir(docsDir);
    
    return combinedRules;
  } catch (err) {
    log(chalk.red('Failed to load base Ceobe rules') + ' ' + String(err));
    return '';
  }
}

/**
 * Lists the available skills directories (the names of the skills).
 */
export function getAvailableSkills(): string[] {
  try {
    const skillsDir = path.join(env.CEOBE_INSTALL_DIR, 'skills');
    if (!fs.existsSync(skillsDir)) return [];
    
    return fs.readdirSync(skillsDir).filter(item => {
      const itemPath = path.join(skillsDir, item);
      return fs.statSync(itemPath).isDirectory();
    });
  } catch (err) {
     return [];
  }
}

/**
 * Reads only specific skill directories based on an array of names.
 */
export function readSpecificSkills(skillNames: string[]): string {
  let content = '';
  const skillsDir = path.join(env.CEOBE_INSTALL_DIR, 'skills');
  
  for (const name of skillNames) {
    const specificSkillDir = path.resolve(path.join(skillsDir, name));
    if (!specificSkillDir.startsWith(path.resolve(skillsDir))) continue; // Fix H-12: Prevent Path Traversal
    if (fs.existsSync(specificSkillDir)) {
      content += `\n--- SKILL RELEVANT: ${name.toUpperCase()} ---\n`;
      content += readAllFromDir(specificSkillDir);
    }
  }
  return content;
}

// ── Pentest Skill Accessors ───────────────────────────────────────────────────

/**
 * Returns all pentest skill names available in the skills/ directory.
 * These are skills with prefixes: pentest-, vuln-, recon-, payload-, etc.
 */
export function getPentestSkillNames(): string[] {
  return getAvailablePentestSkillNames();
}

/**
 * Reads the content of selected pentest skills (SKILL.md files).
 * Supports YAML-frontmatter format (Eunectes) and plain format (legacy Ceobe).
 */
export function readPentestSkillsContent(skillNames: string[]): string {
  return loadPentestSkillsContent(skillNames);
}

/**
 * Returns metadata for all available pentest skills.
 */
export function getPentestSkillsMeta() {
  return discoverPentestSkills();
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads a specific template file from the templates directory.
 */
export function readTemplate(templateName: string): string {
  try {
    const templatesDir = path.resolve(path.join(env.CEOBE_INSTALL_DIR, 'templates'));
    const templatePath = path.resolve(path.join(templatesDir, templateName));
    if (!templatePath.startsWith(templatesDir)) return ''; // Fix H-12: Prevent Path Traversal
    
    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf-8');
    }
    log(chalk.yellow(`Warning: Template ${templateName} not found. Proceeding without it.`));
    return '';
  } catch (err) {
    log(chalk.red(`Failed to load template ${templateName}`) + ' ' + String(err));
    return '';
  }
}
