import { describe, it, expect, vi } from 'vitest';
import { findMatchingTemplate, getTemplates } from './templateManager';
import * as fs from 'fs';

vi.mock('fs', async () => {
  const actualFs = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actualFs,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(JSON.stringify([
      {
        id: 'tpl_123',
        description: 'setup a react app with tailwind',
        brd: 'mock brd',
        design: 'mock design',
        architecture: 'mock arch',
        task: 'mock task',
        devops: 'mock devops'
      }
    ]))
  };
});

describe('Template Manager', () => {
  it('should find a matching template', () => {
    const match = findMatchingTemplate('setup a react app with tailwind and typescript', 0.6);
    expect(match).not.toBeNull();
    expect(match?.id).toBe('tpl_123');
  });

  it('should return null if below threshold', () => {
    const match = findMatchingTemplate('build a flutter app', 0.85);
    expect(match).toBeNull();
  });
});
