import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runDoctor } from './doctor';
import * as keyManager from './keyManager';
import * as fs from 'fs';
import { env } from '../config/env';

vi.mock('fs');
vi.mock('./keyManager');
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    if (cmd.includes('docker')) {
      callback(new Error('not found'), { stdout: '', stderr: '' });
    } else {
      callback(null, { stdout: 'v1.0.0', stderr: '' });
    }
  })
}));

describe('doctor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should run diagnostics successfully with existing keys and workspace', async () => {
    vi.spyOn(keyManager, 'readAllKeys').mockReturnValue({ GEMINI_API_KEY: 'test' });
    vi.spyOn(keyManager, 'getRequiredKeyForActiveProviders').mockReturnValue(['GEMINI_API_KEY']);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockReturnValue({ size: 2048 } as any);
    
    env.CLOUDFLARE_ACCOUNT_ID = 'acc';
    env.CLOUDFLARE_GATEWAY_ID = 'gw';
    
    await expect(runDoctor()).resolves.toBeUndefined();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Ceobe Diagnostic Tool'));
  });

  it('should handle uninitialized workspace and missing keys', async () => {
    vi.spyOn(keyManager, 'readAllKeys').mockReturnValue({});
    vi.spyOn(keyManager, 'getRequiredKeyForActiveProviders').mockReturnValue(['GEMINI_API_KEY', 'ANTHROPIC_API_KEY']);
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    env.CLOUDFLARE_ACCOUNT_ID = '';
    
    await expect(runDoctor()).resolves.toBeUndefined();
  });
});
