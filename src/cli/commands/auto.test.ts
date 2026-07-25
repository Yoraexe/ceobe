import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerAutoCommand } from './auto';

describe('auto command CLI', () => {
  it('should register auto command to commander program', () => {
    const program = new Command();
    registerAutoCommand(program);

    const cmd = program.commands.find(c => c.name() === 'auto');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Jalankan pipeline penuh secara otonom');
  });
});
