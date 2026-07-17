// Tujuan: Mendaftarkan seluruh perintah CLI sub-sistem (benchmark, cost, mcp, status, rollback, dll.) ke commander.
// Caller: src/index.ts
// Dependensi: commander, system/*
// Main Functions: registerSystemCommands
// Side Effects: Tidak ada.

import { Command } from 'commander';
import { registerIndexCommand } from './system/indexCmd';
import { registerDoctorCommand } from './system/doctorCmd';
import { registerModeCommand } from './system/modeCmd';
import { registerSetupCommand } from './system/setupCmd';
import { registerLogCommand } from './system/logCmd';
import { registerStatusCommand } from './system/statusCmd';
import { registerResetCommand } from './system/resetCmd';
import { registerKeyCommand } from './system/keyCmd';
import { registerDaemonCommand } from './system/daemonCmd';
import { registerRollbackCommand } from './system/rollbackCmd';
import { registerCostCommand } from './system/costCmd';
import { registerSkillCommand } from './system/skillCmd';
import { registerReflectCommand } from './system/reflectCmd';
import { registerReconCommand } from './system/reconCmd';
import { registerTemplateCommand } from './system/templateCmd';
import { registerBenchmarkCommand } from './system/benchmarkCmd';
import { registerDebtCommand } from './system/debtCmd';
import { registerMcpCommand } from './system/mcpCmd';
import { registerTrimCommand } from './system/trimCmd';

export function registerSystemCommands(program: Command): void {
  registerIndexCommand(program);
  registerDoctorCommand(program);
  registerModeCommand(program);
  registerSetupCommand(program);
  registerLogCommand(program);
  registerStatusCommand(program);
  registerResetCommand(program);
  registerKeyCommand(program);
  registerDaemonCommand(program);
  registerRollbackCommand(program);
  registerCostCommand(program);
  registerSkillCommand(program);
  registerReflectCommand(program);
  registerReconCommand(program);
  registerTemplateCommand(program);
  registerBenchmarkCommand(program);
  registerDebtCommand(program);
  registerMcpCommand(program);
  registerTrimCommand(program);
}
