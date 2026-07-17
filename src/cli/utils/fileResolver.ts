// Tujuan: Memvalidasi dan meresolusi berkas input (mockup UI atau dokumen PRD) sebelum diproses oleh CLI planner.
// Caller: src/cli/commands/plan.ts, src/cli/commands/auto.ts
// Dependensi: fs, path, chalk, ui/banner
// Main Functions: resolveFileInput
// Side Effects: Membaca berkas input dan memverifikasi lokasinya agar tidak melintasi batas direktori proyek.

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { printError, info } from '../../ui/banner';

export function resolveFileInput(filePath: string, description?: string): string | object[] {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(abs)) {
    printError('File tidak ditemukan', abs, `Periksa path file Anda`);
    process.exit(1);
  }

  const rel = path.relative(process.cwd(), abs);
  if (rel.startsWith('..') && !path.isAbsolute(filePath)) {
    printError('Akses Ditolak', abs, `Path berada di luar direktori proyek saat ini`);
    process.exit(1);
  }
  const ext = path.extname(abs).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    info(`Membaca UI Mockup dari: ${chalk.white(abs)}`);
    const base64Data = fs.readFileSync(abs).toString('base64');
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return [
      { type: 'text', text: `UI mockup attached. Analyze and use as project requirements. Extra context: ${description || ''}` },
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } }
    ];
  }
  info(`Membaca PRD dari file: ${chalk.white(abs)}`);
  return fs.readFileSync(abs, 'utf8');
}
