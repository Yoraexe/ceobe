import * as fs from 'fs';
import * as path from 'path';
import { getProjectDir } from '../../../utils/context';
import { markFileComplete } from '../../../utils/stateManager';

// Write Lock Map — prevents concurrent writes to the same file
const writeLocks = new Map<string, Promise<void>>();

export async function acquireLock(filePath: string): Promise<() => void> {
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

export function validatePath(filePath: string): string {
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


export async function handleReadFile(input: Record<string, any>): Promise<string> {
  const fullPath = validatePath(input.file_path);
  if (!fs.existsSync(fullPath)) {
    return `Error: File not found at ${fullPath}`;
  }
  const stats = fs.statSync(fullPath);
  if (stats.size > 500000) { 
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

export async function handleWriteFile(input: Record<string, any>): Promise<string> {
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

export async function handleEditFile(input: Record<string, any>): Promise<string> {
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
      try {
        if (target.length > 5000) {
          throw new Error('Target too large for regex fallback');
        }
        const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexTarget = escapedTarget.replace(/\s+/g, '\\s+');
        const regexGlobal = new RegExp(regexTarget, 'g');
        const matches = content.match(regexGlobal);
        
        if (matches) {
          if (matches.length > 1) {
            return `Error: target_content (with whitespace normalization) matches ${matches.length} times. Please provide a more unique target_content.`;
          }
          const regex = new RegExp(regexTarget);
          content = content.replace(regex, replacement);
          fs.writeFileSync(fullPath, content, 'utf8');
          await markFileComplete(input.file_path);
          return `Successfully edited ${fullPath} (using whitespace-normalized fallback)`;
        }
      } catch(e) { }
      
      return `Error: target_content not found in the file. Exact match and whitespace fallback failed.\nEnsure that the text you provided matches the file content.\nHint: use read_file to check the exact lines you want to replace.`;
    }
    const occurrences = content.split(target).length - 1;
    if (occurrences > 1) {
      return `Error: target_content occurs ${occurrences} times in the file. Please provide a more unique target_content block to ensure the correct code is edited.`;
    }
    
    content = content.replace(target, replacement);
    fs.writeFileSync(fullPath, content, 'utf8');
    await markFileComplete(input.file_path);
    return `Successfully edited ${fullPath}`;
  } finally {
    releaseLock();
  }
}

export async function handleRenameFile(input: Record<string, any>): Promise<string> {
  const oldPath = validatePath(input.old_path);
  const newPath = validatePath(input.new_path);
  if (!fs.existsSync(oldPath)) {
    return `Error: File not found at ${oldPath}`;
  }
  if (fs.existsSync(newPath)) {
    return `Error: Destination file already exists at ${newPath}`;
  }
  
  try {
    fs.renameSync(oldPath, newPath);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      fs.cpSync(oldPath, newPath, { recursive: true });
      fs.rmSync(oldPath, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
  return `Successfully renamed ${oldPath} to ${newPath}`;
}

export async function handleMoveFile(input: Record<string, any>): Promise<string> {
  const srcPath = validatePath(input.source_path);
  const destPath = validatePath(input.destination_path);
  if (!fs.existsSync(srcPath)) {
    return `Error: Source file not found at ${srcPath}`;
  }
  
  let finalDestPath = destPath;
  let destDir = path.dirname(destPath);
  
  const isDestDir = destPath.endsWith('/') || destPath.endsWith(path.sep) || 
                    (fs.existsSync(destPath) && fs.statSync(destPath).isDirectory());
  
  if (isDestDir) {
     destDir = destPath;
     if (fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
         finalDestPath = path.join(destPath, path.basename(srcPath));
     }
  }
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
     
  if (fs.existsSync(finalDestPath)) {
     return `Error: Destination already exists at ${finalDestPath}`;
  }
  
  try {
    fs.renameSync(srcPath, finalDestPath);
  } catch (err: any) {
    if (err.code === 'EXDEV') {
      fs.cpSync(srcPath, finalDestPath, { recursive: true });
      fs.rmSync(srcPath, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
  return `Successfully moved ${srcPath} to ${finalDestPath}`;
}

export async function handleCreateDirectory(input: Record<string, any>): Promise<string> {
  const fullPath = validatePath(input.dir_path);
  if (fs.existsSync(fullPath)) {
    return `Directory already exists at ${fullPath}`;
  }
  fs.mkdirSync(fullPath, { recursive: true });
  return `Successfully created directory ${fullPath}`;
}

export async function handleListDirectory(input: Record<string, any>): Promise<string> {
  const fullPath = validatePath(input.dir_path);
  if (!fs.existsSync(fullPath)) return `Error: Directory not found at ${fullPath}`;
  const files = fs.readdirSync(fullPath);
  return files.join('\n');
}


export async function handleDeleteFile(input: Record<string, any>): Promise<string> {
  const fullPath = validatePath(input.file_path);
  if (!fs.existsSync(fullPath)) {
    return `Error: File not found at ${fullPath}`;
  }
  fs.unlinkSync(fullPath);
  return `Successfully deleted ${fullPath}`;
}
