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
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

import { execSync } from 'child_process';

export function writeAllKeys(keys: Record<string, string>): void {
  const filePath = getKeysStorePath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(keys, null, 2), { encoding: 'utf8', mode: 0o600 });
  
  if (os.platform() === 'win32') {
    try {
      execSync(`icacls "${filePath}" /inheritance:r /grant:r "%USERNAME%:F"`, { stdio: 'ignore' });
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
