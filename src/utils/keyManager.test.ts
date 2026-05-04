import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';

vi.mock('fs');
vi.mock('os', () => ({ homedir: vi.fn().mockReturnValue('/home/testuser') }));
vi.mock('chalk', () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    gray: (s: string) => s,
    underline: (s: string) => s,
    bgRed: { white: (s: string) => s },
  },
}));

import {
  getKeysStorePath,
  readAllKeys,
  writeAllKeys,
  getKey,
  setKey,
  removeKey,
  findKeyDef,
  maskKey,
  KEY_DEFINITIONS,
} from './keyManager';

describe('keyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getKeysStorePath', () => {
    it('should return path inside ~/.ceobe', () => {
      const p = getKeysStorePath();
      expect(p).toContain('.ceobe');
      expect(p).toContain('keys.json');
    });
  });

  describe('readAllKeys', () => {
    it('should return empty object if file does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      expect(readAllKeys()).toEqual({});
    });

    it('should return parsed keys if file exists', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({ GEMINI_API_KEY: 'abc123', ANTHROPIC_API_KEY: 'xyz789' })
      );
      const keys = readAllKeys();
      expect(keys.GEMINI_API_KEY).toBe('abc123');
    });

    it('should return empty object if file is malformed JSON', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('{ not valid json ');
      expect(readAllKeys()).toEqual({});
    });
  });

  describe('writeAllKeys', () => {
    it('should create directory and write file', () => {
      (fs.existsSync as any).mockReturnValue(false);
      (fs.mkdirSync as any).mockReturnValue(undefined);
      (fs.writeFileSync as any).mockReturnValue(undefined);

      writeAllKeys({ GEMINI_API_KEY: 'test' });

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      const args = (fs.writeFileSync as any).mock.calls[0];
      expect(JSON.parse(args[1]).GEMINI_API_KEY).toBe('test');
    });

    it('should not call mkdirSync if directory already exists', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.writeFileSync as any).mockReturnValue(undefined);
      writeAllKeys({ GLM_API_KEY: 'glm-key' });
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('getKey', () => {
    it('should return empty string if key not stored', () => {
      (fs.existsSync as any).mockReturnValue(false);
      expect(getKey('GEMINI_API_KEY')).toBe('');
    });

    it('should return stored key value', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({ GEMINI_API_KEY: 'my-key' }));
      expect(getKey('GEMINI_API_KEY')).toBe('my-key');
    });
  });

  describe('setKey', () => {
    it('should merge and write the new key', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({ GEMINI_API_KEY: 'old' }));
      (fs.writeFileSync as any).mockReturnValue(undefined);

      setKey('ANTHROPIC_API_KEY', 'new-claude-key');

      const written = JSON.parse((fs.writeFileSync as any).mock.calls[0][1]);
      expect(written.GEMINI_API_KEY).toBe('old');
      expect(written.ANTHROPIC_API_KEY).toBe('new-claude-key');
    });
  });

  describe('removeKey', () => {
    it('should return false if key does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      expect(removeKey('GEMINI_API_KEY')).toBe(false);
    });

    it('should remove key and return true', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify({ GEMINI_API_KEY: 'abc', GLM_API_KEY: 'xyz' }));
      (fs.writeFileSync as any).mockReturnValue(undefined);

      const result = removeKey('GEMINI_API_KEY');
      expect(result).toBe(true);
      const written = JSON.parse((fs.writeFileSync as any).mock.calls[0][1]);
      expect(written.GEMINI_API_KEY).toBeUndefined();
      expect(written.GLM_API_KEY).toBe('xyz');
    });
  });

  describe('findKeyDef', () => {
    it('should find by provider slug (gemini)', () => {
      const def = findKeyDef('gemini');
      expect(def).toBeDefined();
      expect(def!.envKey).toBe('GEMINI_API_KEY');
    });

    it('should find by provider slug (kimi)', () => {
      const def = findKeyDef('kimi');
      expect(def!.envKey).toBe('KIMI_API_KEY');
    });

    it('should find by full env key name', () => {
      const def = findKeyDef('GLM_API_KEY');
      expect(def!.provider).toBe('glm');
    });

    it('should return undefined for unknown provider', () => {
      expect(findKeyDef('unknown-xyz')).toBeUndefined();
    });
  });

  describe('maskKey', () => {
    it('should show (belum diset) for empty string', () => {
      expect(maskKey('')).toContain('belum diset');
    });

    it('should return **** for very short keys', () => {
      expect(maskKey('abc')).toBe('****');
    });

    it('should show partial key for longer values', () => {
      const masked = maskKey('AIzaSyABCDEFGH12345678');
      expect(masked).toContain('****');
      expect(masked).not.toBe('AIzaSyABCDEFGH12345678'); // Should be masked
    });
  });

  describe('KEY_DEFINITIONS', () => {
    it('should have at least 2 required keys', () => {
      const required = KEY_DEFINITIONS.filter(k => k.required);
      expect(required.length).toBeGreaterThanOrEqual(2);
    });

    it('should include gemini and anthropic as required', () => {
      const providers = KEY_DEFINITIONS.filter(k => k.required).map(k => k.provider);
      expect(providers).toContain('gemini');
      expect(providers).toContain('anthropic');
    });
  });
});
