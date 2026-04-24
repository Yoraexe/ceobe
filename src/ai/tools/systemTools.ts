import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { env } from '../../config/env';

const execAsync = promisify(exec);

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
    description: 'Executes a bash/PowerShell command on the host system. Returns stdout and stderr.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The terminal command to run (e.g., npm install express, tsc, dir)'
        }
      },
      required: ['command']
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
  }
];

function validatePath(filePath: string): string {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(env.TARGET_PROJECT_DIR, filePath);
  const normalizedPath = path.resolve(fullPath);
  const workspaceRoot = path.resolve(env.TARGET_PROJECT_DIR);
  
  if (!normalizedPath.startsWith(workspaceRoot)) {
    throw new Error(`Path traversal blocked: ${normalizedPath} is outside the workspace (${workspaceRoot})`);
  }
  return normalizedPath;
}

export async function handleToolCall(toolName: string, input: any): Promise<string> {
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
        return `Successfully wrote to ${fullPath}`;
      }

      case 'execute_command': {
        const blacklist = ['rm -rf /', 'mkfs', 'dd ', ':(){:|:&};:'];
        if (blacklist.some(cmd => input.command.includes(cmd))) {
          return `Error: Command blocked due to security restrictions.`;
        }
        
        try {
          const { stdout, stderr } = await execAsync(input.command, { 
            cwd: env.TARGET_PROJECT_DIR,
            timeout: 60000 // 60s timeout
          });
          let result = '';
          if (stdout) result += `STDOUT:\n${stdout}\n`;
          if (stderr) result += `STDERR:\n${stderr}\n`;
          return result || 'Command executed successfully with no output.';
        } catch (execErr: any) {
          return `Command failed:\n${execErr.message}\nSTDOUT:\n${execErr.stdout || ''}\nSTDERR:\n${execErr.stderr || ''}`;
        }
      }

      case 'list_directory': {
        const fullPath = validatePath(input.dir_path);
        if (!fs.existsSync(fullPath)) return `Error: Directory not found at ${fullPath}`;
        const files = fs.readdirSync(fullPath);
        return files.join('\n');
      }

      case 'search_in_files': {
        const fullPath = validatePath(input.dir_path);
        // Sanitize query to prevent shell injection
        const sanitizedQuery = input.query.replace(/["`$\\!;&|<>(){}]/g, '');
        if (!sanitizedQuery) {
          return 'Error: Query contains only special characters and was fully sanitized.';
        }
        try {
          const { stdout } = await execAsync(`grep -rn "${sanitizedQuery}" .`, { cwd: fullPath, timeout: 30000 });
          return stdout || 'No matches found.';
        } catch (e: any) {
           return e.stdout ? e.stdout : 'No matches found or grep not available.';
        }
      }

      default:
        return `Error: Tool ${toolName} not recognized.`;
    }
  } catch (error: any) {
    return `Error executing ${toolName}: ${error.message}`;
  }
}
