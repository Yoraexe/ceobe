// Tujuan: Mendefinisikan dan menangani eksekusi tools (skills) sistem dasar (I/O, eksekusi) untuk Ceobe AI.
// Caller: src/ai/executor.ts
// Dependensi: fs, path, child_process, env, vectorStore, indexer
// Main Functions: tools (array), handleToolCall
// Side Effects: Read/write file system, execute terminal commands.

import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { env } from '../../config/env';
import { searchEmbeddings } from '../memory/vectorStore';
import { getEmbedding } from '../memory/indexer';
import { captureScreenshot, executeBrowserInteraction, BrowserAction } from '../../utils/browserAutomation';
import { markFileComplete } from '../../utils/stateManager';

const execAsync = promisify(exec);

export const activeBackgroundProcesses = new Map<string, ChildProcess>();

/**
 * Detects the appropriate Docker image for the current project.
 */
function detectProjectImage(): string {
  const workspace = env.TARGET_PROJECT_DIR;
  if (fs.existsSync(path.join(workspace, 'go.mod'))) return 'golang:1.24-alpine';
  if (fs.existsSync(path.join(workspace, 'Cargo.toml'))) return 'rust:1.82-slim';
  if (fs.existsSync(path.join(workspace, 'requirements.txt')) || fs.existsSync(path.join(workspace, 'pyproject.toml'))) return 'python:3.13-slim';
  return 'node:22-slim'; // Default for Node/TS projects
}

/**
 * Wraps a command in Docker if sandbox mode is enabled.
 */
function wrapInSandbox(cmd: string): string {
  if (env.CEOBE_SANDBOX !== 'docker') return cmd;
  const image = detectProjectImage();
  const workspace = env.TARGET_PROJECT_DIR.replace(/\\/g, '/');
  // Mount workspace as /app, run command inside container
  return `docker run --rm -v "${workspace}":/app -w /app ${image} sh -c "${cmd.replace(/"/g, '\\"')}"`;
}

function isCommandAllowed(cmd: string): boolean {
  const allowedPrefixes = ['npm ', 'npx ', 'tsc', 'git ', 'vitest', 'node ', 'dir', 'ls', 'bun ', 'go ', 'cargo ', 'docker ', 'python ', 'pip ', 'pnpm ', 'yarn ', 'pytest'];
  const segments = cmd.split(/(?:&&|\|\||;|\|)/).map(s => s.trim()).filter(s => s.length > 0);
  
  for (const segment of segments) {
     const segmentAllowed = allowedPrefixes.some(prefix => segment.startsWith(prefix));
     if (!segmentAllowed) return false;
  }
  return true;
}

export const tools = [
  {
    name: 'read_file',
    description: 'Reads the content of a file. Returns the file content as a string.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute or relative path to the file to read. (e.g. src/index.ts or D:/path/to/file)'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'write_file',
    description: 'Writes content to a file. Overwrites the file if it exists, creates it if it does not. Also creates necessary parent directories.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute or relative path to the file to write.'
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file.'
        }
      },
      required: ['file_path', 'content']
    }
  },
  {
    name: 'execute_command',
    description: 'Executes a bash/PowerShell command on the host system synchronously. Returns stdout and stderr. Use this for short-lived commands (builds, tests). Do NOT use this for starting servers, as it will block forever.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The terminal command to run (e.g., npm install, tsc, go build)'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'start_background_service',
    description: 'Starts a long-running process in the background (like a web server or database) without blocking execution. Returns immediately. Use stop_background_service to kill it later.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: {
          type: 'string',
          description: 'A unique identifier for this service (e.g., "api-server", "frontend")'
        },
        command: {
          type: 'string',
          description: 'The command to run (e.g., npm run dev, go run main.go)'
        }
      },
      required: ['service_id', 'command']
    }
  },
  {
    name: 'stop_background_service',
    description: 'Stops a process previously started with start_background_service.',
    input_schema: {
      type: 'object',
      properties: {
        service_id: {
          type: 'string',
          description: 'The unique identifier provided when starting the service.'
        }
      },
      required: ['service_id']
    }
  },
  {
    name: 'edit_file',
    description: 'Edits an existing file by replacing a specific string with new content. Use this to safely patch files without overwriting them completely.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute or relative path to the file to edit.'
        },
        target_content: {
          type: 'string',
          description: 'The exact string in the file to replace. Must match exactly, including whitespace.'
        },
        replacement_content: {
          type: 'string',
          description: 'The new content to replace the target_content with.'
        }
      },
      required: ['file_path', 'target_content', 'replacement_content']
    }
  },
  {
    name: 'rename_file',
    description: 'Renames a file in the file system.',
    input_schema: {
      type: 'object',
      properties: {
        old_path: {
          type: 'string',
          description: 'The current path of the file.'
        },
        new_path: {
          type: 'string',
          description: 'The new path for the file.'
        }
      },
      required: ['old_path', 'new_path']
    }
  },
  {
    name: 'move_file',
    description: 'Moves a file to a new directory. Automatically creates target directory if it does not exist.',
    input_schema: {
      type: 'object',
      properties: {
        source_path: {
          type: 'string',
          description: 'The path of the file to move.'
        },
        destination_path: {
          type: 'string',
          description: 'The destination directory or new file path.'
        }
      },
      required: ['source_path', 'destination_path']
    }
  },
  {
    name: 'create_directory',
    description: 'Creates a new directory (and any necessary parent directories).',
    input_schema: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'The absolute or relative path to the directory to create.'
        }
      },
      required: ['dir_path']
    }
  },
  {
    name: 'list_directory',
    description: 'Lists the contents of a directory.',
    input_schema: {
      type: 'object',
      properties: {
        dir_path: {
          type: 'string',
          description: 'The path to the directory to list (e.g. ./src)'
        }
      },
      required: ['dir_path']
    }
  },
  {
    name: 'search_in_files',
    description: 'Searches for a string pattern in files within a directory using grep/find.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The pattern to search for'
        },
        dir_path: {
          type: 'string',
          description: 'The directory to search in (e.g. ./src)'
        }
      },
      required: ['query', 'dir_path']
    }
  },
  {
    name: 'delete_file',
    description: 'Deletes a file from the file system.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The absolute or relative path to the file to delete.'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'semantic_search',
    description: 'Searches the codebase semantically based on meaning, not just exact keywords. Use this to find logic, features, or architecture patterns in the workspace memory.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The natural language question or concept to search for.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'visual_audit',
    description: 'Launches a headless browser to open a URL or local file, executes optional interactive actions, and returns a screenshot + logs. Use this to verify UI, test user flows, and debug frontend errors.',
    input_schema: {
      type: 'object',
      properties: {
        url_or_path: {
          type: 'string',
          description: 'The URL or local file path.'
        },
        actions: {
          type: 'array',
          description: 'Optional list of actions to perform (click, type, wait, press, scroll).',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['click', 'type', 'wait', 'press', 'scroll'] },
              selector: { type: 'string', description: 'CSS selector for the element.' },
              text: { type: 'string', description: 'Text to type.' },
              key: { type: 'string', description: 'Key to press (Enter, Escape, etc.).' },
              ms: { type: 'number', description: 'Milliseconds to wait.' }
            },
            required: ['type']
          }
        }
      },
      required: ['url_or_path']
    }
  }
];

function validatePath(filePath: string): string {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(env.TARGET_PROJECT_DIR, filePath);
  // Normalize both paths and convert to lowercase for case-insensitive comparison on Windows
  const normalizedPath = path.resolve(fullPath);
  const workspaceRoot = path.resolve(env.TARGET_PROJECT_DIR);
  
  // Case-insensitive check to prevent drive letter casing issues on Windows (e.g., C:\ vs c:\)
  if (!normalizedPath.toLowerCase().startsWith(workspaceRoot.toLowerCase())) {
    throw new Error(`Path traversal blocked: ${normalizedPath} is outside the workspace (${workspaceRoot})`);
  }
  return normalizedPath;
}

function recursiveSearch(dir: string, pattern: RegExp, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git') continue; // Ignore typical large dirs
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      recursiveSearch(fullPath, pattern, results);
    } else if (stat.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            results.push(`${fullPath}:${index + 1}:${line.trim()}`);
          }
        });
      } catch (e) {
        // Skip files that can't be read as utf8 (e.g., binaries)
      }
    }
  }
  return results;
}

export async function handleToolCall(toolName: string, input: any): Promise<any> {
  try {
    switch (toolName) {
      case 'read_file': {
        const fullPath = validatePath(input.file_path);
        if (!fs.existsSync(fullPath)) {
          return `Error: File not found at ${fullPath}`;
        }
        return fs.readFileSync(fullPath, 'utf8');
      }

      case 'write_file': {
        const fullPath = validatePath(input.file_path);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, input.content, 'utf8');
        markFileComplete(input.file_path);
        return `Successfully wrote to ${fullPath}`;
      }

      case 'execute_command': {
        const cmd: string = input.command.trim();
        if (!isCommandAllowed(cmd)) {
          return `Error: Command blocked. For security reasons, Ceobe can only run specific whitelisted commands (e.g., npm, bun, go, docker, python, git). Raw shell interpreters or unauthorized chained commands are strictly prohibited.`;
        }
        
        try {
          const actualCmd = wrapInSandbox(cmd);
          const { stdout, stderr } = await execAsync(actualCmd, { 
            cwd: env.TARGET_PROJECT_DIR,
            timeout: 120000 // 120s timeout (Docker may need longer)
          });
          let result = '';
          if (stdout) result += `STDOUT:\n${stdout}\n`;
          if (stderr) result += `STDERR:\n${stderr}\n`;
          return result || 'Command executed successfully with no output.';
        } catch (execErr: any) {
          return `Command failed:\n${execErr.message}\nSTDOUT:\n${execErr.stdout || ''}\nSTDERR:\n${execErr.stderr || ''}`;
        }
      }

      case 'start_background_service': {
        if (activeBackgroundProcesses.has(input.service_id)) {
           return `Error: Service ID '${input.service_id}' is already running. Stop it first.`;
        }
        
        const cmd: string = input.command.trim();
        if (!isCommandAllowed(cmd)) {
           return `Error: Command blocked. Background services must also use whitelisted commands for security.`;
        }

        const actualCmd = wrapInSandbox(cmd);
        
        const child = spawn(actualCmd, { 
          cwd: env.TARGET_PROJECT_DIR,
          shell: true,
          detached: false // Important: if Ceobe dies, the child dies
        });
        
        activeBackgroundProcesses.set(input.service_id, child);
        
        // Wait just a tiny bit to see if it crashes immediately
        await new Promise(r => setTimeout(r, 1000));
        
        if (child.exitCode !== null) {
           activeBackgroundProcesses.delete(input.service_id);
           return `Error: Service '${input.service_id}' crashed immediately with exit code ${child.exitCode}. Check your command.`;
        }
        
        return `Successfully started background service '${input.service_id}'. It is now running.`;
      }

      case 'stop_background_service': {
        const child = activeBackgroundProcesses.get(input.service_id);
        if (!child) {
           return `Error: No active service found with ID '${input.service_id}'.`;
        }
        
        child.kill('SIGKILL');
        activeBackgroundProcesses.delete(input.service_id);
        return `Successfully stopped background service '${input.service_id}'.`;
      }

      case 'edit_file': {
        const fullPath = validatePath(input.file_path);
        if (!fs.existsSync(fullPath)) {
          return `Error: File not found at ${fullPath}`;
        }
        
        let content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes(input.target_content)) {
          return `Error: target_content not found in the file. Make sure you matched whitespaces and formatting exactly.`;
        }
        
        content = content.replaceAll(input.target_content, input.replacement_content);
        fs.writeFileSync(fullPath, content, 'utf8');
        markFileComplete(input.file_path);
        return `Successfully edited ${fullPath}`;
      }

      case 'rename_file': {
        const oldPath = validatePath(input.old_path);
        const newPath = validatePath(input.new_path);
        if (!fs.existsSync(oldPath)) {
          return `Error: File not found at ${oldPath}`;
        }
        if (fs.existsSync(newPath)) {
          return `Error: Destination file already exists at ${newPath}`;
        }
        
        fs.renameSync(oldPath, newPath);
        return `Successfully renamed ${oldPath} to ${newPath}`;
      }

      case 'move_file': {
        const srcPath = validatePath(input.source_path);
        const destPath = validatePath(input.destination_path);
        if (!fs.existsSync(srcPath)) {
          return `Error: Source file not found at ${srcPath}`;
        }
        
        const destDir = path.extname(destPath) ? path.dirname(destPath) : destPath;
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        const finalDestPath = fs.statSync(srcPath).isFile() && !path.extname(destPath) 
           ? path.join(destPath, path.basename(srcPath))
           : destPath;
           
        if (fs.existsSync(finalDestPath)) {
           return `Error: Destination already exists at ${finalDestPath}`;
        }
        
        fs.renameSync(srcPath, finalDestPath);
        return `Successfully moved ${srcPath} to ${finalDestPath}`;
      }

      case 'create_directory': {
        const fullPath = validatePath(input.dir_path);
        if (fs.existsSync(fullPath)) {
          return `Directory already exists at ${fullPath}`;
        }
        fs.mkdirSync(fullPath, { recursive: true });
        return `Successfully created directory ${fullPath}`;
      }

      case 'list_directory': {
        const fullPath = validatePath(input.dir_path);
        if (!fs.existsSync(fullPath)) return `Error: Directory not found at ${fullPath}`;
        const files = fs.readdirSync(fullPath);
        return files.join('\n');
      }

      case 'search_in_files': {
        const fullPath = validatePath(input.dir_path);
        try {
          const pattern = new RegExp(input.query, 'i'); // Case-insensitive search
          const results = recursiveSearch(fullPath, pattern);
          if (results.length === 0) return 'No matches found.';
          // Limit results to prevent overwhelming output
          if (results.length > 100) {
             return results.slice(0, 100).join('\n') + `\n... and ${results.length - 100} more matches.`;
          }
          return results.join('\n');
        } catch (e: any) {
          return `Error during search: ${e.message}`;
        }
      }

      case 'delete_file': {
        const fullPath = validatePath(input.file_path);
        if (!fs.existsSync(fullPath)) {
          return `Error: File not found at ${fullPath}`;
        }
        fs.unlinkSync(fullPath);
        return `Successfully deleted ${fullPath}`;
      }

      case 'semantic_search': {
        try {
          const queryVector = await getEmbedding(input.query);
          if (queryVector.length === 0) return 'Error: Failed to generate embedding for query.';
          
          const results = searchEmbeddings(queryVector, 5);
          if (results.length === 0) return 'No relevant code found in memory. Please ensure the workspace has been indexed.';
          
          return results.map(r => `--- File: ${r.chunk.filePath} (Relevance Score: ${r.score.toFixed(3)}) ---\n${r.chunk.content}`).join('\n\n');
        } catch (e: any) {
          return `Error during semantic search: ${e.message}`;
        }
      }

      case 'visual_audit': {
        try {
          let target = input.url_or_path;
          // If it's not a URL, validate it as a local path
          if (!target.startsWith('http://') && !target.startsWith('https://')) {
            target = validatePath(target);
          }
          
          const result = await executeBrowserInteraction(target, input.actions || []);
          
          let logSummary = '';
          if (result.logs && result.logs.length > 0) {
            logSummary = `\n[BROWSER LOGS]\n${result.logs.join('\n')}\n`;
          }

          return [
            {
              type: 'text',
              text: `Captured ${result.url}. ${logSummary}\n[PAGE CONTENT PREVIEW]\n${result.content?.substring(0, 500)}...`
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: result.mediaType,
                data: result.base64Data
              }
            }
          ];
        } catch (e: any) {
          return `Error during visual audit: ${e.message}`;
        }
      }

      default:
        return `Error: Tool ${toolName} not recognized.`;
    }
  } catch (error: any) {
    return `Error executing ${toolName}: ${error.message}`;
  }
}
