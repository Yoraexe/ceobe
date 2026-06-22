// Module: src/ai/tools/systemTools.ts
// Tujuan: Mendefinisikan schema tools (skills) sistem dasar dan me-routing eksekusinya ke handler yang tepat.
// Caller: src/ai/executor.ts
// Dependensi: handlers/*, pluginLoader

import { handlePluginCall } from '../plugins/pluginLoader';
import { 
  handleReadFile, handleWriteFile, handleEditFile, handleRenameFile, 
  handleMoveFile, handleCreateDirectory, handleListDirectory, handleDeleteFile 
} from './handlers/fileOps';
import { 
  handleExecuteCommand, handleStartBackgroundService, handleStopBackgroundService,
  activeBackgroundProcesses 
} from './handlers/shellOps';
import { handleVisualAudit } from './handlers/webOps';
import { handleSearchCodebase, handleGrepCodebase } from './handlers/semanticOps';

// Export for backward compatibility (e.g. tests checking active processes)
export { activeBackgroundProcesses };

export const tools = [
  {
    name: 'read_file',
    description: 'Reads the content of a file. Returns the file content as a string.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'The absolute or relative path to the file to read. (e.g. src/index.ts or D:/path/to/file)' },
        start_line: { type: 'number', description: 'Optional. Start reading from this line number (1-indexed).' },
        end_line: { type: 'number', description: 'Optional. Stop reading at this line number (inclusive).' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'finish_task',
    description: 'Marks the current task as finished. Call this tool ONLY when you have fully completed the requested task, verified the results, and are ready to stop.',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'write_file',
    description: 'Writes content to a file. Overwrites the file if it exists, creates it if it does not. Also creates necessary parent directories.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'The absolute or relative path to the file to write.' },
        content: { type: 'string', description: 'The full content to write to the file.' }
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
        command: { type: 'string', description: 'The terminal command to run (e.g., npm install, tsc, go build)' }
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
        service_id: { type: 'string', description: 'A unique identifier for this service (e.g., "api-server", "frontend")' },
        command: { type: 'string', description: 'The command to run (e.g., npm run dev, go run main.go)' }
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
        service_id: { type: 'string', description: 'The unique identifier provided when starting the service.' }
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
        file_path: { type: 'string', description: 'The absolute or relative path to the file to edit.' },
        target_content: { type: 'string', description: 'The exact string in the file to replace. Must match exactly, including whitespace.' },
        replacement_content: { type: 'string', description: 'The new content to replace the target_content with.' }
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
        old_path: { type: 'string', description: 'The current path of the file.' },
        new_path: { type: 'string', description: 'The new path for the file.' }
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
        source_path: { type: 'string', description: 'The path of the file to move.' },
        destination_path: { type: 'string', description: 'The destination directory or new file path.' }
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
        dir_path: { type: 'string', description: 'The absolute or relative path to the directory to create.' }
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
        dir_path: { type: 'string', description: 'The path to the directory to list (e.g. ./src)' }
      },
      required: ['dir_path']
    }
  },
  {
    name: 'delete_file',
    description: 'Deletes a file from the file system.',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'The absolute or relative path to the file to delete.' }
      },
      required: ['file_path']
    }
  },
  {
    name: 'search_codebase',
    description: 'Searches the codebase semantically and via full-text keyword matching using Reciprocal Rank Fusion (RRF). This is the RECOMMENDED tool for finding files, logic, or architecture patterns.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The natural language question or concept to search for.' }
      },
      required: ['query']
    }
  },
  {
    name: 'grep_codebase',
    description: 'Searches for an exact keyword or regex pattern across all files in the workspace (ignores binary/node_modules). Best for finding exact variable names or import paths.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The exact string or regex pattern to search for.' },
        isRegex: { type: 'boolean', description: 'True if the query should be evaluated as a regular expression.' },
        includes: { type: 'array', items: { type: 'string' }, description: 'Optional list of file extensions to include (e.g. ["*.ts", "*.json"]).' }
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
        url_or_path: { type: 'string', description: 'The URL or local file path.' },
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

export async function handleToolCall(toolName: string, rawInput: Record<string, unknown>): Promise<unknown> {
  const input = rawInput as Record<string, any>;
  try {
    switch (toolName) {
      case 'read_file': return await handleReadFile(input);
      case 'write_file': return await handleWriteFile(input);
      case 'execute_command': return await handleExecuteCommand(input);
      case 'start_background_service': return await handleStartBackgroundService(input);
      case 'stop_background_service': return await handleStopBackgroundService(input);
      case 'edit_file': return await handleEditFile(input);
      case 'rename_file': return await handleRenameFile(input);
      case 'move_file': return await handleMoveFile(input);
      case 'create_directory': return await handleCreateDirectory(input);
      case 'list_directory': return await handleListDirectory(input);
      case 'delete_file': return await handleDeleteFile(input);
      case 'search_codebase': return await handleSearchCodebase(input);
      case 'grep_codebase': return await handleGrepCodebase(input);
      case 'visual_audit': return await handleVisualAudit(input);
      
      // finish_task is usually handled directly by the supervisor loop
      // so we don't strictly need a handler here, but it's safe to return empty if called.
      case 'finish_task': return 'Task marked as finished.';
      
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
