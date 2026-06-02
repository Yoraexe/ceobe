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
import { getProjectDir } from '../../utils/context';
import { searchEmbeddings } from '../memory/vectorStore';
import { getEmbedding } from '../memory/indexer';
import { executeBrowserInteraction } from '../../utils/browserAutomation';
import { markFileComplete } from '../../utils/stateManager';
import { handlePluginCall } from '../plugins/pluginLoader';

const execAsync = promisify(exec);

export const activeBackgroundProcesses = new Map<string, ChildProcess>();

/**
 * Detects the appropriate Docker image for the current project.
 */
function detectProjectImage(): string {
  const workspace = getProjectDir();
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
  const workspace = getProjectDir().replace(/\\/g, '/');
  // Mount workspace as /app, run command inside container
  return `docker run --rm -v "${workspace}":/app -w /app ${image} sh -c "${cmd.replace(/"/g, '\\"')}"`;
}

function isCommandAllowed(cmd: string): boolean {
  if (cmd.includes('`') || cmd.includes('$(')) return false; // Block command substitution
  const allowedPrefixes = ['npm ', 'npx ', 'tsc', 'git ', 'vitest', 'node ', 'dir', 'ls', 'bun ', 'go ', 'cargo ', 'docker ', 'python ', 'pip ', 'pnpm ', 'yarn ', 'pytest', 'flutter ', 'dart ', 'php ', 'composer ', 'artisan '];
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
        },
        start_line: {
          type: 'number',
          description: 'Optional. Start reading from this line number (1-indexed).'
        },
        end_line: {
          type: 'number',
          description: 'Optional. Stop reading at this line number (inclusive).'
        }
      },
      required: ['file_path']
    }
  },
  {
    name: 'finish_task',
    description: 'Marks the current task as finished. Call this tool ONLY when you have fully completed the requested task, verified the results, and are ready to stop.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
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

// Write Lock Map — prevents concurrent writes to the same file
const writeLocks = new Map<string, Promise<void>>();

async function acquireLock(filePath: string): Promise<() => void> {
  const normPath = path.resolve(filePath);
  const prev = writeLocks.get(normPath) ?? Promise.resolve();
  let release = () => {};
  const next = new Promise<void>((resolve) => { release = resolve; });
  writeLocks.set(normPath, next);
  await prev;
  return () => {
    if (writeLocks.get(normPath) === next) writeLocks.delete(normPath);
    release();
  };
}

function validatePath(filePath: string): string {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(getProjectDir(), filePath);
  // Normalize both paths and convert to lowercase for case-insensitive comparison on Windows
  const normalizedPath = path.resolve(fullPath);
  const workspaceRoot = path.resolve(getProjectDir());
  
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
      if (stat.size > 1000000) continue; // Skip files > 1MB
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

export async function handleToolCall(toolName: string, rawInput: Record<string, unknown>): Promise<unknown> {
  const input = rawInput as Record<string, any>;
  try {
    switch (toolName) {
      case 'read_file': {
        const fullPath = validatePath(input.file_path);
        if (!fs.existsSync(fullPath)) {
          return `Error: File not found at ${fullPath}`;
        }
        const stats = fs.statSync(fullPath);
        if (stats.size > 500000) { // Bump limit slightly but enforce pagination if large
          return `Error: File is extremely large (${stats.size} bytes). Please use search_in_files or semantic_search.`;
        }
        const content = fs.readFileSync(fullPath, 'utf8');
        const start = input.start_line ? Math.max(1, Number(input.start_line)) : 1;
        const end = input.end_line ? Number(input.end_line) : undefined;
        
        const lines = content.split('\n');
        const finalEnd = end ? Math.min(end, lines.length) : lines.length;
        
        if (start > 1 || finalEnd < lines.length) {
          const sliced = lines.slice(start - 1, finalEnd).join('\n');
          return `[Showing lines ${start} to ${finalEnd} of ${lines.length}]\n${sliced}`;
        }
        
        return content;
      }

      case 'finish_task': {
        return `Task marked as finished. The execution engine will now stop.`;
      }

      case 'write_file': {
        const fullPath = validatePath(input.file_path);
        const releaseLock = await acquireLock(fullPath);
        try {
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, input.content, 'utf8');
          await markFileComplete(input.file_path);
          return `Successfully wrote to ${fullPath}`;
        } finally {
          releaseLock();
        }
      }

      case 'execute_command': {
        const cmd: string = input.command.trim();
        if (!isCommandAllowed(cmd)) {
          return `Error: Command blocked. For security reasons, Ceobe can only run specific whitelisted commands (e.g., npm, bun, go, docker, python, git). Raw shell interpreters or unauthorized chained commands are strictly prohibited.`;
        }
        
        const truncateOutput = (s: string) => s.length > 5000 ? s.substring(s.length - 5000) + '\n...[TRUNCATED]' : s;
        try {
          const actualCmd = wrapInSandbox(cmd);
          const { stdout, stderr } = await execAsync(actualCmd, { 
            cwd: getProjectDir(),
            timeout: 120000 // 120s timeout (Docker may need longer)
          });
          
          let result = '';
          if (stdout) result += `STDOUT:\n${truncateOutput(stdout)}\n`;
          if (stderr) result += `STDERR:\n${truncateOutput(stderr)}\n`;
          return result || 'Command executed successfully with no output.';
        } catch (execErr: unknown) {
          
          const msg = execErr instanceof Error ? execErr.message : String(execErr);
          const out = (execErr as { stdout?: string }).stdout || '';
          const err = (execErr as { stderr?: string }).stderr || '';
          return `Command failed:\n${msg}\nSTDOUT:\n${truncateOutput(out)}\nSTDERR:\n${truncateOutput(err)}`;
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
          cwd: getProjectDir(),
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
        
        const releaseLock = await acquireLock(fullPath);
        try {
          let content = fs.readFileSync(fullPath, 'utf8');
          const target = String(input.target_content);
          const replacement = String(input.replacement_content);
          
          if (!content.includes(target)) {
            // Fallback: try whitespace-insensitive regex match
            try {
              const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regexTarget = escapedTarget.replace(/\s+/g, '\\s+');
              const regex = new RegExp(regexTarget);
              const match = content.match(regex);
              
              if (match && match.index !== undefined) {
                content = content.substring(0, match.index) + replacement + content.substring(match.index + match[0].length);
                fs.writeFileSync(fullPath, content, 'utf8');
                await markFileComplete(input.file_path);
                return `Successfully edited ${fullPath} (using whitespace-normalized fallback)`;
              }
            } catch(e) {
              // Regex compilation or match failed, fallback to strict error below
            }
            
            return `Error: target_content not found in the file. Exact match and whitespace fallback failed.\nEnsure that the text you provided matches the file content.\nHint: use read_file to check the exact lines you want to replace.`;
          }
          
          content = content.replaceAll(target, replacement);
          fs.writeFileSync(fullPath, content, 'utf8');
          await markFileComplete(input.file_path);
          return `Successfully edited ${fullPath}`;
        } finally {
          releaseLock();
        }
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
        } catch (e: unknown) {
          return `Error during search: ${e instanceof Error ? e.message : String(e)}`;
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
        } catch (e: unknown) {
          return `Error during semantic search: ${e instanceof Error ? e.message : String(e)}`;
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
        } catch (e: unknown) {
          return `Error during visual audit: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      default:
        try {
          return await handlePluginCall(toolName, input);
        } catch (e: unknown) {
          return `Error: Tool ${toolName} not recognized or plugin failed: ${e instanceof Error ? e.message : String(e)}`;
        }
    }
  } catch (error: unknown) {
    return `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
  }
}
