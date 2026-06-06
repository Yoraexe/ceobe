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
}
