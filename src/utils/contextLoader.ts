import * as fs from 'fs';
import * as path from 'path';
import { env } from '../config/env';
import chalk from 'chalk';
import { log } from './context';

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
    const specificSkillDir = path.join(skillsDir, name);
    if (fs.existsSync(specificSkillDir)) {
      content += `\n--- SKILL RELEVANT: ${name.toUpperCase()} ---\n`;
      content += readAllFromDir(specificSkillDir);
    }
  }
  return content;
}

/**
 * Reads a specific template file from the templates directory.
 */
export function readTemplate(templateName: string): string {
  try {
    const templatePath = path.join(env.CEOBE_INSTALL_DIR, 'templates', templateName);
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
