import { executeBrowserInteraction } from '../../../utils/browserAutomation';
import { validatePath } from './fileOps';

export async function handleVisualAudit(input: Record<string, any>): Promise<any> {
  try {
    let target = input.url_or_path;
    // If it's not a URL, validate it as a local path
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = validatePath(target);
    }
    
    const result = await executeBrowserInteraction(target, input.actions || []);
    
    let logSummary = '';
    if (result.logs && result.logs.length > 0) {
      logSummary = `\n[BROWSER LOGS]\n${result.logs.join('\n')}\n`;
    }

    return [
      {
        type: 'text',
        text: `Captured ${result.url}. ${logSummary}\n[PAGE CONTENT PREVIEW]\n${result.content?.substring(0, 500)}...`
      },
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: result.mediaType,
          data: result.base64Data
        }
      }
    ];
  } catch (e: unknown) {
    return `Error during visual audit: ${e instanceof Error ? e.message : String(e)}`;
  }
}
