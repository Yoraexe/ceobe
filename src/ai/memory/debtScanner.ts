// Tujuan: Memindai codebase secara rekursif untuk mencari komentar technical debt khusus (ponytail: atau ceobe:).
// Caller: src/mcp/server.ts, cli commands
// Dependensi: path, fs, utils/context
// Main Functions: scanTechnicalDebt
// Side Effects: Membaca filesystem di bawah project directory.

import * as path from 'path';
import * as fs from 'fs';
import { getProjectDir } from '../../utils/context';


export interface DebtEntry {
  filePath: string;
  line: number;
  text: string;
  ceiling: string;
  upgrade: string;
  hasTrigger: boolean;
}

function getAllFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === 'dist' || file === 'build' || file === '.git' || file === '.ceobe') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      // Fix L-21: Scan all major source code extensions for tech debt, not just TS/TSX
      if (/\.(ts|tsx|js|jsx|py|go|sh|rb|php|java|c|cpp|h|hpp)$/i.test(file)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

export function scanTechnicalDebt(): DebtEntry[] {
  const projectDir = getProjectDir();
  const srcDir = path.join(projectDir, 'src');
  const files = fs.existsSync(srcDir) ? getAllFiles(srcDir) : getAllFiles(projectDir);

  const entries: DebtEntry[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(projectDir, file);
      
      // Fast path string inclusion check
      if (!content.toLowerCase().includes('ponytail:') && !content.toLowerCase().includes('ceobe:')) {
        continue;
      }
      
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes('ponytail:') || line.toLowerCase().includes('ceobe:')) {
          // Extract the comment part
          const match = line.match(/(?:\/\/|\/\*|\*)\s*(?:ponytail|ceobe):\s*(.+)/i);
          if (match) {
            const fullComment = match[1].trim();
            // Try to split by comma for ceiling and upgrade
            const parts = fullComment.split(',');
            const ceiling = parts[0]?.trim() || fullComment;
            let upgrade = '';
            
            // Reconstruct the upgrade part if commas existed
            if (parts.length > 1) {
                // Remove 'upgrade:' prefix if they wrote 'upgrade: trigger'
                upgrade = parts.slice(1).join(',').trim();
                upgrade = upgrade.replace(/^upgrade:\s*/i, '');
            }
            
            entries.push({
              filePath: relPath,
              line: i + 1,
              text: line.trim(),
              ceiling,
              upgrade,
              hasTrigger: !!upgrade
            });
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  return entries;
}
