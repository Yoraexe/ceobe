#!/usr/bin/env node
// Module: src/index.ts
// Tujuan: Main entrypoint defining CLI commands and orchestrating autonomous workflows.
// Caller: Executed directly via terminal CLI.
// Dependensi: commander, src/cli/commands/*
// Main Functions: CLI route handlers

import { Command } from 'commander';
import { printHelp, VERSION } from './ui/banner';

import { registerAutoCommand } from './cli/commands/auto';
import { registerPlanCommands } from './cli/commands/plan';
import { registerExecuteCommand } from './cli/commands/execute';
import { registerSystemCommands } from './cli/commands/system';
import { registerExportRulesCommand } from './cli/commands/exportRules';
import { registerPentestCommand } from './cli/commands/pentest';

const program = new Command();

// ── Suppress default help in favour of our custom one ─────────────────────────
program
  .name('ceobe')
  .description('Ceobe — Autonomous AI Engineering Orchestrator')
  .version(VERSION, '-v, --version', 'Show Ceobe version')
  .helpOption(false) // We render our own
  .addHelpCommand(false);

// Register commands
registerAutoCommand(program);
registerPlanCommands(program);
registerExecuteCommand(program);
registerSystemCommands(program);
registerExportRulesCommand(program);
registerPentestCommand(program);

// Help & default (no args)
program
  .command('help')
  .description('Tampilkan panduan lengkap Ceobe')
  .action(() => {
    printHelp();
  });

program.action(() => {
  printHelp();
});

// Parse args
program.parse(process.argv);
