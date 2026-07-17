// Tujuan: Mengelola berkas penyimpanan API keys lokal (keys.json) untuk Ceobe CLI.
// Caller: src/cli/commands/system/keyCmd.ts, src/telegram/telegramDaemon.ts, src/cli/utils/keyWizard.ts
// Dependensi: fs, path, os, utils/keyDefinitions
// Main Functions: readAllKeys, setKey, getKeysStorePath
// Side Effects: Membaca/menulis berkas keys.json di home directory target.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
export { KeyDefinition, KEY_DEFINITIONS, getRequiredKeyForActiveProviders, findKeyDef } from './keyDefinitions';

export function getKeysStorePath(): string {
  return path.join(os.homedir(), '.ceobe', 'keys.json');
}

export function readAllKeys(): Record<string, string> {
  const filePath = getKeysStorePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Fix L-01: Runtime schema validation to prevent non-string injection from keys.json
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const validKeys: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') validKeys[k] = v;
    }
    return validKeys;
  } catch {
    return {};
  }
}

import { execFileSync } from 'child_process';

export function writeAllKeys(keys: Record<string, string>): void {
  const filePath = getKeysStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(keys, null, 2), { encoding: 'utf8', mode: 0o600 });
  
  if (os.platform() === 'win32') {
    try {
      execFileSync('icacls', [filePath, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`], { stdio: 'ignore' });
    } catch {
      // Silently ignore if icacls fails
    }
  }
}

export function getKey(name: string): string {
  return readAllKeys()[name] || '';
}

export function setKey(name: string, value: string): void {
  const keys = readAllKeys();
  keys[name] = value;
  writeAllKeys(keys);
}

export function removeKey(name: string): boolean {
  const keys = readAllKeys();
  if (!(name in keys)) return false;
  delete keys[name];
  writeAllKeys(keys);
  return true;
}
