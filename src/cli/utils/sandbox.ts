import { info } from '../../ui/banner';
import { reloadEnv } from '../../config/env';

export function activateSandbox(): void {
  process.env['CEOBE_SANDBOX'] = 'docker';
  reloadEnv();
  info('🐳 Sandbox Mode aktif — eksekusi diisolasi dalam Docker container.');
}
