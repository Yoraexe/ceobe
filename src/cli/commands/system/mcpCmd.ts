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
