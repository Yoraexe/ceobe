import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { registerPlanCommands } from './plan';

describe('plan command CLI', () => {
  it('should register plan command to commander program', () => {
    const program = new Command();
    registerPlanCommands(program);

    const cmd = program.commands.find(c => c.name() === 'plan');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Buat BRD');
  });
});
