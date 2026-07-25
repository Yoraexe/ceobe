// Module: src/ai/tools/toolValidator.ts
// Tujuan: Memvalidasi hasil dari tool untuk mencegah silent failures yang memicu halusinasi AI.
// Caller: src/ai/tools/systemTools.ts

export interface ValidationResult {
  valid: boolean;
  originalResult: unknown;
  enhancedResult: unknown;
  failureReason?: string;
}

/**
 * Validates the raw result from a tool handler before sending it back to the LLM.
 * If a tool failed silently or returned an error, this injects a [TOOL_FAILED] marker.
 */
export async function validateToolResult(toolName: string, _input: any, result: any): Promise<ValidationResult> {
  let valid = true;
  let failureReason = '';

  // 1. Universal String Error Check
  if (typeof result === 'string') {
    if (result.trim().startsWith('Error:') || result.startsWith('[TOOL_FAILED]') || result.includes('Command failed:')) {
      valid = false;
      failureReason = 'Explicit error detected in tool output.';
    }
  }

  // 2. Specific Tool Integrity Checks
  if (valid) {
    switch (toolName) {
      case 'write_file':
      case 'edit_file':
      case 'rename_file':
      case 'move_file':
      case 'delete_file':
      case 'create_directory':
        // These handlers generally return "Successfully...", "Directory already exists", or "Error:..."
        if (typeof result === 'string' && !result.toLowerCase().includes('success') && !result.toLowerCase().includes('already exists') && !result.toLowerCase().includes('task marked as finished')) {
           valid = false;
           failureReason = 'Did not receive explicit success confirmation from mutating tool.';
        }
        break;
      
      case 'visual_audit':
        if (typeof result === 'string') {
          valid = false;
          failureReason = 'Expected multimodal blocks, got string (likely an unhandled error).';
        } else if (Array.isArray(result) && result.length === 0) {
          valid = false;
          failureReason = 'Visual audit returned empty results.';
        }
        break;
        
      case 'execute_command':
        // Commands that exit with 0 might have no output.
        if (typeof result === 'string' && result.trim() === '') {
          return { valid: true, originalResult: result, enhancedResult: 'Command executed successfully with no stdout output.' };
        }
        break;
    }
  }

  // 3. Enhancement on Failure
  if (!valid) {
    let enhancedResult = result;
    if (typeof result === 'string') {
      if (!result.includes('[TOOL_FAILED]')) {
         enhancedResult = `[TOOL_FAILED: ${failureReason}]\n${result}`;
      }
    } else if (Array.isArray(result)) {
      // For multimodal arrays
      enhancedResult = [
         { type: 'text', text: `[TOOL_FAILED: ${failureReason}]` },
         ...result
      ];
    } else {
       enhancedResult = `[TOOL_FAILED: ${failureReason}]\n${JSON.stringify(result)}`;
    }
    return { valid, originalResult: result, enhancedResult, failureReason };
  }

  return { valid: true, originalResult: result, enhancedResult: result };
}
