import { info } from '../../ui/banner';

export function activateSandbox(): void {
  process.env['CEOBE_SANDBOX'] = 'docker';
  info('🐳 Sandbox Mode aktif — eksekusi diisolasi dalam Docker container.');
}
