import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import { readAllKeys, writeAllKeys, getKey, setKey, removeKey, findKeyDef, maskKey, printKeyTable } from './keyManager';

vi.mock('fs');
vi.mock('os');

describe('keyManager', () => {
  const mockHome = '/mock/home';
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(os.homedir).mockReturnValue(mockHome);
  });

  it('readAllKeys should return empty object if file does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readAllKeys()).toEqual({});
  });

  it('readAllKeys should return content if file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ TEST_KEY: 'val' }));
    expect(readAllKeys()).toEqual({ TEST_KEY: 'val' });
  });

  it('writeAllKeys should create dir and write with correct permissions', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    writeAllKeys({ KEY: 'VAL' });
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('keys.json'),
      expect.stringContaining('VAL'),
      expect.objectContaining({ mode: 0o600 })
    );
  });

  it('getKey and setKey should work', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ GEMINI_API_KEY: 'test-val' }));
    expect(getKey('GEMINI_API_KEY')).toBe('test-val');
    
    setKey('NEW_KEY', 'new-val');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('removeKey should return true if key existed and false otherwise', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ KEY1: 'val1' }));
    
    expect(removeKey('KEY1')).toBe(true);
    expect(removeKey('KEY2')).toBe(false);
  });

  it('findKeyDef should find by provider name or env key', () => {
    expect(findKeyDef('gemini')?.envKey).toBe('GEMINI_API_KEY');
    expect(findKeyDef('GEMINI_API_KEY')?.provider).toBe('gemini');
    expect(findKeyDef('anthropic')?.envKey).toBe('ANTHROPIC_API_KEY');
    expect(findKeyDef('nonexistent')).toBeUndefined();
  });

  it('maskKey should handle various string lengths', () => {
    expect(maskKey('')).toContain('belum diset');
    expect(maskKey('short')).toBe('****');
    expect(maskKey('verylongkey')).toBe('very****gkey');
  });

  it('printKeyTable should output to console', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ GEMINI_API_KEY: 'valid-key-here' }));
    
    printKeyTable();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('API Keys Ceobe'));
    spy.mockRestore();
  });
});
