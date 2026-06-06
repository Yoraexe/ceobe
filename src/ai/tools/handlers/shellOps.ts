import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../../../config/env';
import { getProjectDir } from '../../../utils/context';

const execAsync = promisify(exec);
export const activeBackgroundProcesses = new Map<string, ChildProcess>();

function detectProjectImage(): string {
  if (env.CEOBE_SANDBOX_IMAGE) {
    return env.CEOBE_SANDBOX_IMAGE;
  }
  const workspace = getProjectDir();
  if (fs.existsSync(path.join(workspace, 'go.mod'))) return 'golang:1.24-alpine';
  if (fs.existsSync(path.join(workspace, 'Cargo.toml'))) return 'rust:1.82-slim';
  if (fs.existsSync(path.join(workspace, 'requirements.txt')) || fs.existsSync(path.join(workspace, 'pyproject.toml'))) return 'python:3.13-slim';
  return 'node:22-slim'; // Default for Node/TS projects
}

function wrapInSandbox(cmd: string): string {
  if (env.CEOBE_SANDBOX !== 'docker') return cmd;
  const image = detectProjectImage();
  const workspace = getProjectDir().replace(/\\/g, '/');
  // Escape single quotes for safe shell execution inside docker
  const escapedCmd = cmd.replace(/'/g, "'\"'\"'");
  // Prevent host shell injection from workspace path (e.g. $() or backticks)
  const escapedWorkspace = workspace.replace(/(["\\$`])/g, '\\$1');
  return `docker run --rm -v "${escapedWorkspace}":/app -w /app ${image} sh -c '${escapedCmd}'`;
}

function isCommandAllowed(cmd: string): boolean {
  if (cmd.includes('`') || cmd.includes('$(') || cmd.includes('<') || cmd.includes('>')) return false; // Block command substitution and redirections
  const allowedPrefixes = ['npm ', 'npx ', 'tsc', 'git ', 'vitest', 'node ', 'dir', 'ls', 'bun ', 'go ', 'cargo ', 'docker ', 'python ', 'pip ', 'pnpm ', 'yarn ', 'pytest', 'flutter ', 'dart ', 'php ', 'composer ', 'artisan '];
  
  // Explicitly block shell-escape patterns within whitelisted tools
  if (cmd.includes('npm exec') || cmd.includes('npx -c') || cmd.includes('node -e') || cmd.includes('node --eval') || cmd.includes('node --print')) return false;

  const segments = cmd.split(/(?:&&|\|\||;|\||\n|\r)/).map(s => s.trim()).filter(s => s.length > 0);
  
  for (const segment of segments) {
     const segmentAllowed = allowedPrefixes.some(prefix => segment.startsWith(prefix));
     if (!segmentAllowed) return false;
  }
  return true;
}

export async function handleExecuteCommand(input: Record<string, any>): Promise<string> {
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

export async function handleStartBackgroundService(input: Record<string, any>): Promise<string> {
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

export async function handleStopBackgroundService(input: Record<string, any>): Promise<string> {
  const child = activeBackgroundProcesses.get(input.service_id);
  if (!child) {
     return `Error: No active service found with ID '${input.service_id}'.`;
  }
  
  child.kill('SIGKILL');
  activeBackgroundProcesses.delete(input.service_id);
  return `Successfully stopped background service '${input.service_id}'.`;
}
