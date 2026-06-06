import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDynamicTools, clearLoadedPlugins } from './pluginLoader';
import * as fs from 'fs';

vi.mock('fs');
vi.mock('../utils/context', () => ({
  getProjectDir: () => '/mock/dir',
  log: vi.fn(),
}));

describe('pluginLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLoadedPlugins();
  });

  describe('loadDynamicTools', () => {
    it('should return empty array if no plugins config file exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const tools = await loadDynamicTools('/mock/dir');
      expect(tools).toEqual([]);
    });

    it('should clear loaded plugins', async () => {
      // Just test that the clearLoadedPlugins function doesn't crash
      expect(() => clearLoadedPlugins()).not.toThrow();
    });
  });
});
