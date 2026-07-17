import ora from 'ora';
import chalk from 'chalk';
import { createProviderAdapter } from '../providers/router';
import { readCeobeRules } from '../../utils/contextLoader';
import { recordUsage } from '../../utils/costTracker';
import { log } from '../../utils/context';
import type { NormalizedContentBlock } from '../providers/types';

export interface AuditResult {
  passed: boolean;
  feedback?: string;
  affected?: {
    brd: boolean;
    design: boolean;
    arch: boolean;
    devops: boolean;
    task: boolean;
  };
}

function getQaAuditor() {
  const adapter = createProviderAdapter('qa');
  const tag = `[QA: ${adapter.name.toUpperCase()} / ${adapter.modelId}]`;
  return { adapter, tag };
}

export async function auditPlan(
  combinedContent: string,
  dynamicAlert: string,
  _selectedSkills: string[] = []
): Promise<AuditResult> {
  // ⚠️  CRITICAL: Always use the QA auditor, NOT the planner.
  const { adapter, tag } = getQaAuditor();
  const spinner = ora(`${tag} Auditing project plans for conflicts and rule violations...`).start();

  try {
    const rules = readCeobeRules();
    const prompt = `You are the Lead Quality Assurance Auditor for the Ceobe AI Engineering System.
STAGE 4: PLAN AUDIT & VALIDATION.

IMPORTANT: You are an INDEPENDENT auditor. The architect who wrote the plans below is a different AI.
Your role is to be the adversarial reviewer — look for gaps, contradictions, and blind spots.

Rules:
${rules}

Combined Content (BRD + Design + Architecture + Task Plan):
${combinedContent}

Your Job:
1. Verify if the Architecture contradicts the BRD or Design.
2. Verify if the Task List executes everything required by the Architecture and Design.
3. Verify if anything in the plans violates the Ceobe Engineering Rules or Skills constraints.

If everything is perfect and execution can proceed safely:
Reply EXACTLY with:
<AUDIT_RESULT>APPROVED</AUDIT_RESULT>

If there are any problems, reply with a detailed critique and provide a JSON map of which phases need to be regenerated: based on your findings:
\`\`\`json
{
  "brd": boolean,
  "design": boolean,
  "arch": boolean,
  "devops": boolean,
  "task": boolean
}
\`\`\`
`;

    const promptBlocks: NormalizedContentBlock[] = [
      { type: 'text', text: prompt, cache_control: true } as any
    ];
    if (dynamicAlert) {
      promptBlocks.push({ type: 'text', text: dynamicAlert });
    }

    const _genResult = await adapter.generate(promptBlocks, 0.1);
    if (_genResult.usage) { recordUsage({ model: adapter.modelId, inputTokens: _genResult.usage.input_tokens || 0, outputTokens: _genResult.usage.output_tokens || 0 }); }
    const output = _genResult.text;
// Fix M-37: Prevent bypass via prompt injection by requiring strict XML tags
    const isApproved = /<AUDIT_RESULT>\s*APPROVED\s*<\/AUDIT_RESULT>/i.test(output);
    if (isApproved) {
      spinner.succeed(chalk.green(`${tag} Audit PASSED. Blueprint is ready for execution.`));
      return { passed: true };
    } else {
      spinner.warn(chalk.yellow(`${tag} Audit FAILED. Conflicts or missing steps detected.`));
      log(chalk.cyan('\n--- Auditor Feedback ---\n'));
      log(output);
      log(chalk.cyan('\n-------------------------\n'));
      
      let affected = { brd: true, design: true, arch: true, devops: true, task: true };
      const jsonMatch = output.match(/\`\`\`json\s*(\{[\s\S]*?\})\s*\`\`\`/);
      if (jsonMatch && jsonMatch[1]) {
         try {
            const parsed = JSON.parse(jsonMatch[1]);
            affected = {
              brd: Boolean(parsed.brd),
              design: Boolean(parsed.design),
              arch: Boolean(parsed.arch),
              devops: Boolean(parsed.devops),
              task: Boolean(parsed.task)
            };
         } catch(e) {
            log(chalk.dim(`[Planner Debug] JSON parse failed during audit: ${e}`));
         }
      }

      return { passed: false, feedback: output, affected };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    spinner.fail(chalk.red(`${tag} Failed to audit the plans. Reason: ${msg}`));
    throw error;
  }
}
