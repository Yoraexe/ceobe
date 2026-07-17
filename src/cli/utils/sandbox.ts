// Tujuan: Mengaktifkan mode isolasi sandbox (Docker) dengan mengubah variabel lingkungan (environment variables).
// Caller: src/cli/commands/auto.ts, src/cli/commands/execute.ts
// Dependensi: ui/banner, config/env
// Main Functions: activateSandbox
// Side Effects: Mengubah process.env dan memicu muat ulang konfigurasi env.

import { info } from '../../ui/banner';
import { reloadEnv } from '../../config/env';

export function activateSandbox(): void {
  process.env['CEOBE_SANDBOX'] = 'docker';
  reloadEnv();
  info('🐳 Sandbox Mode aktif — eksekusi diisolasi dalam Docker container.');
}
