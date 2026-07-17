// ==========================================
// Tujuan: Mendaftarkan perintah CLI 'ceobe mcp' untuk menjalankan MCP Stdio Server.
// Caller: src/index.ts
// Dependensi: commander, src/ai/mcp/mcpServer
// Main Functions: registerMcpCommand
// Side Effects: Menjalankan Stdio loop untuk server MCP.
// ==========================================

import { Command } from 'commander';
import { startMcpServer } from '../../ai/mcp/mcpServer';

/**
 * Mendaftarkan command 'mcp' ke aplikasi Commander.
 */
export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description('Jalankan Ceobe sebagai Model Context Protocol (MCP) Server via Stdio')
    .action(() => {
      startMcpServer();
    });
}
