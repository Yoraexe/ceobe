// ==========================================
// Tujuan: Menyediakan antarmuka server Model Context Protocol (MCP) berbasis Stdio.
// Caller: CLI Entrypoint (ceobe mcp)
// Dependensi: readline, process, toolsCatalog, pentestSupervisor
// Main Functions: startMcpServer, handleJsonRpcRequest
// Side Effects: Membaca stdin dan menulis ke stdout untuk pertukaran pesan JSON-RPC.
// ==========================================

import * as readline from 'readline';
import { checkToolInstalled } from '../pentest/toolsCatalog';
import { runPentestLoop } from '../pentest/pentestSupervisor';

interface JsonRpcRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * Memulai loop pembacaan stdin untuk protokol MCP JSON-RPC.
 */
export function startMcpServer(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // Kirim inisialisasi awal ke stderr (log sistem) agar tidak mengotori stdout
  console.error('[MCP Server] Ceobe Model Context Protocol Server initialized (Stdio Transport).');

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed) as JsonRpcRequest;
      const response = await handleJsonRpcRequest(request);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const errResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`
        }
      };
      process.stdout.write(JSON.stringify(errResponse) + '\n');
    }
  });
}

/**
 * Menangani request JSON-RPC dari MCP Client.
 */
async function handleJsonRpcRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id: request.id
  };

  switch (request.method) {
    case 'initialize':
      response.result = {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'ceobe-mcp-server',
          version: '1.15.0'
        }
      };
      break;

    case 'tools/list':
      response.result = {
        tools: [
          {
            name: 'check_tool_status',
            description: 'Check if a security tool (e.g. nmap, sqlmap) is installed on the host system.',
            inputSchema: {
              type: 'object',
              properties: {
                toolName: { type: 'string', description: 'Name of the tool to verify.' }
              },
              required: ['toolName']
            }
          },
          {
            name: 'run_pentest',
            description: 'Start an autonomous penetration testing session on a target.',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', description: 'IP address or domain scope target.' },
                mode: { type: 'string', enum: ['auto', 'ctf', 'team', 'bug-bounty'], description: 'Attack execution engagement mode.' }
              },
              required: ['target']
            }
          }
        ]
      };
      break;

    case 'tools/call': {
      const toolName = request.params?.name;
      const args = request.params?.arguments || {};

      try {
        if (toolName === 'check_tool_status') {
          const isInstalled = checkToolInstalled(String(args.toolName));
          response.result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ tool: args.toolName, installed: isInstalled })
              }
            ]
          };
        } else if (toolName === 'run_pentest') {
          // Redirect stderr output agar klien tahu log berjalan
          console.error(`[MCP Tool] Launching pentest on: ${args.target} (Mode: ${args.mode || 'auto'})`);
          
          // Whitelist validation for mode (BUG-07)
          const validModes = ['auto', 'ctf', 'team', 'bug-bounty', 'red-team', 'blue-team', 'offensive', 'grey-hat', 'forensic', 'reverse-engineering', 'mobile-pentest'];
          const safeMode = validModes.includes(String(args.mode)) ? String(args.mode) : 'auto';

          // Jalankan pentest secara otonom tanpa blocking konfirmasi
          await runPentestLoop(String(args.target), safeMode as any, undefined, false);
          
          response.result = {
            content: [
              {
                type: 'text',
                text: `Successfully executed pentest loop on target: ${args.target}`
              }
            ]
          };
        } else {
          response.error = {
            code: -32601,
            message: `Method not found: tool '${toolName}' is not defined.`
          };
        }
      } catch (err) {
        response.error = {
          code: -32603,
          message: `Internal tool execution error: ${err instanceof Error ? err.message : String(err)}`
        };
      }
      break;
    }

    default:
      response.error = {
        code: -32601,
        message: `Method not found: ${request.method}`
      };
      break;
  }

  return response;
}
