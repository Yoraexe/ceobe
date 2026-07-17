// Tujuan: Menyediakan perintah CLI 'ceobe mcp' untuk mengaktifkan server Model Context Protocol terpadu.
// Caller: src/cli/commands/system.ts
// Dependensi: commander, mcp/server
// Main Functions: registerMcpCommand
// Side Effects: Tidak ada.

import { Command } from 'commander';
import { runMcpServer } from '../../../mcp/server';

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Menjalankan Ceobe MCP (Model Context Protocol) Server pada stdio transport.')
    .action(async () => {
      try {
        await runMcpServer();
      } catch (err: any) {
        console.error(`MCP Server Error: ${err.message}`);
        process.exit(1);
      }
    });
}
