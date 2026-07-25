import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerExportRulesCommand } from './exportRules';

describe('exportRules command CLI', () => {
  it('should register export-rules command to commander program', () => {
    const program = new Command();
    registerExportRulesCommand(program);

    const cmd = program.commands.find(c => c.name() === 'export-rules');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Ekspor aturan Ceobe');
  });
});
