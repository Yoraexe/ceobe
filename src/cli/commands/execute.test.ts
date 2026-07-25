import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerExecuteCommand } from './execute';

describe('execute command CLI', () => {
  it('should register execute command to commander program', () => {
    const program = new Command();
    registerExecuteCommand(program);

    const cmd = program.commands.find(c => c.name() === 'execute');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Eksekusi task plan');
  });
});
