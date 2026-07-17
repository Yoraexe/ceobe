import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as fs from 'fs';
import * as path from 'path';

import { scanTechnicalDebt } from '../ai/memory/debtScanner';
import { getProjectASTSummary } from '../ai/memory/indexer';
import { buildCodebaseAuditPrompt } from '../ai/utils/promptBuilder';
import { createProviderAdapter } from '../ai/providers/router';
import { env } from '../config/env';
import { checkBudget } from '../utils/costTracker';

export async function runMcpServer() {
  const server = new McpServer({
    name: 'ceobe-mcp',
    version: '1.0.0'
  });

  // Expose Ceobe's Engineering Rules as a Prompt
  server.prompt(
    'ceobe-engineering-rules',
    'Get Ceobe\'s strict engineering rules and guidelines for AI coding.',
    () => {
      const rulesPath = path.join(__dirname, '../../rules/engineering-rules.md');
      let rules = 'Rules not found.';
      if (fs.existsSync(rulesPath)) {
        rules = fs.readFileSync(rulesPath, 'utf8');
      }
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: rules
          }
        }]
      };
    }
  );

  // Tool 1: Extract AST Summary
  server.tool(
    'ceobe_extract_ast',
    'Extract a compact AST summary of the workspace to understand the architecture without exceeding token limits.',
    {},
    async () => {
      const ast = await getProjectASTSummary();
      return {
        content: [{ type: 'text', text: ast || 'No TypeScript files found.' }]
      };
    }
  );

  // Tool 2: Scan Technical Debt
  server.tool(
    'ceobe_scan_debt',
    'Scan the codebase for deliberate // ceobe: or // ponytail: tech debt shortcuts.',
    {},
    async () => {
      const entries = scanTechnicalDebt();
      if (entries.length === 0) {
        return { content: [{ type: 'text', text: 'No technical debt found. Clean ledger.' }] };
      }
      const text = entries.map(e => 
        `File: ${e.filePath}:${e.line}\nCeiling: ${e.ceiling}\nUpgrade: ${e.upgrade || '[ROT RISK - NO UPGRADE PATH]'}`
      ).join('\n\n');
      return { content: [{ type: 'text', text }] };
    }
  );

  // Tool 3: Trim Codebase
  server.tool(
    'ceobe_trim_codebase',
    'Run a full-repo bloat scan using Ceobe QA Auditor to find over-engineering.',
    {},
    async () => {
      try {
        checkBudget(env.CEOBE_MAX_BUDGET);
        const ast = await getProjectASTSummary();
        if (!ast) {
          return { content: [{ type: 'text', text: 'Empty workspace.' }] };
        }
        const prompt = buildCodebaseAuditPrompt(ast);
        const adapter = createProviderAdapter('qa');
        const genResult = await adapter.generate(prompt, 0.2);
        return {
          content: [{ type: 'text', text: genResult.text }]
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `Error during trim: ${err.message}` }], isError: true };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Need to log to stderr so we don't break stdout JSON-RPC
  console.error('Ceobe MCP Server running on stdio');
}
