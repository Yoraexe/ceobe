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
  }
];

// Helper to resolve paths against the workspace root if they are relative
function resolvePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(env.TARGET_PROJECT_DIR, filePath);
}

export async function handleToolCall(toolName: string, input: any): Promise<string> {
  try {
    switch (toolName) {
      case 'read_file': {
        const fullPath = resolvePath(input.file_path);
        if (!fs.existsSync(fullPath)) {
          return `Error: File not found at ${fullPath}`;
        }
        return fs.readFileSync(fullPath, 'utf8');
      }

      case 'write_file': {
        const fullPath = resolvePath(input.file_path);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, input.content, 'utf8');
        return `Successfully wrote to ${fullPath}`;
      }

      case 'execute_command': {
        // Caution: In a real secure environment, commands must be sandboxed or require user approval.
        // For this AI engineering system, we allow execution within the workspace context.
        const { stdout, stderr } = await execAsync(input.command, { cwd: env.TARGET_PROJECT_DIR });
        let result = '';
        if (stdout) result += `STDOUT:\n${stdout}\n`;
        if (stderr) result += `STDERR:\n${stderr}\n`;
        return result || 'Command executed successfully with no output.';
      }

      default:
        return `Error: Tool ${toolName} not recognized.`;
    }
  } catch (error: any) {
    return `Error executing ${toolName}: ${error.message}`;
  }
}
