import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDynamicTools, clearLoadedPlugins } from './pluginLoader';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs');
vi.mock('../../../utils/context', () => ({
  getProjectDir: () => '/mock/dir',
  log: vi.fn(),
}));

vi.mock('../../utils/modeManager', () => ({
  confirmToolCall: vi.fn().mockResolvedValue(true)
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

    it('should block symlink escaping workspace', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['evil-plugin.ts'] as unknown as fs.Dirent[]);
      vi.mocked(fs.realpathSync).mockReturnValue('/etc/shadow');
      
      const tools = await loadDynamicTools('/mock/dir');
      expect(tools).toEqual([]);
    });

    it('should block plugin without valid signature', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['good-plugin.ts'] as unknown as fs.Dirent[]);
      vi.mocked(fs.readFileSync).mockImplementation((filepath) => {
        return 'export const tool = {}; // No signature';
      });
      vi.mocked(fs.realpathSync).mockReturnValue('/mock/dir/.ceobe/plugins/good-plugin.ts');
      
      const tools = await loadDynamicTools('/mock/dir');
      expect(tools).toEqual([]);
    });
  });
});
