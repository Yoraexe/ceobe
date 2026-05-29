import { log } from '../../utils/context';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { NormalizedTool } from '../providers/types';
import chalk from 'chalk';

export interface PluginDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
  handler: (input: any) => Promise<any>;
}

// Global registry for loaded plugins
export const loadedPlugins = new Map<string, PluginDefinition>();

export async function loadDynamicTools(projectDir: string): Promise<NormalizedTool[]> {
  const pluginsDir = path.join(projectDir, '.ceobe', 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  const files = fs.readdirSync(pluginsDir);
  const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.cjs') || f.endsWith('.mjs'));
  
  if (pluginFiles.length === 0) return [];

  log(chalk.blue(`[PluginLoader] Ditemukan ${pluginFiles.length} file plugin di .ceobe/plugins/`));

  // Ensure tsx is registered if we need to load .ts files
  const hasTs = pluginFiles.some(f => f.endsWith('.ts'));
  if (hasTs) {
    try {
      // Trying to register ts-node or tsx programmatically if not already
      // This is a best-effort approach. If the process was started with `tsx`, this is a no-op.
      if (!(process as any)[Symbol.for('ts-node.register.instance')]) {
         require('ts-node/register/transpile-only');
      }
    } catch (e) {
      // ignore
    }
  }

  const tools: NormalizedTool[] = [];

  for (const file of pluginFiles) {
    try {
      const fullPath = path.join(pluginsDir, file);
      const fileUrl = pathToFileURL(fullPath).href;
      
      // Dynamic import
      const module = await import(fileUrl);
      const plugin: PluginDefinition = module.default || module;

      if (!validatePlugin(plugin)) {
        log(chalk.yellow(`[PluginLoader] Plugin ${file} tidak valid (missing name, description, input_schema, or handler).`));
        continue;
      }

      loadedPlugins.set(plugin.name, plugin);
      
      tools.push({
        name: plugin.name,
        description: plugin.description,
        input_schema: plugin.input_schema
      });
      
      log(chalk.green(`[PluginLoader] ✅ Plugin '${plugin.name}' berhasil dimuat.`));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log(chalk.red(`[PluginLoader] Gagal memuat plugin ${file}: ${msg}`));
    }
  }

  return tools;
}

function validatePlugin(plugin: any): plugin is PluginDefinition {
  if (!plugin || typeof plugin !== 'object') return false;
  if (typeof plugin.name !== 'string') return false;
  if (typeof plugin.description !== 'string') return false;
  if (typeof plugin.input_schema !== 'object') return false;
  if (typeof plugin.handler !== 'function') return false;
  return true;
}

export async function handlePluginCall(name: string, input: any): Promise<any> {
  const plugin = loadedPlugins.get(name);
  if (!plugin) {
    throw new Error(`Plugin handler for '${name}' not found.`);
  }
  return await plugin.handler(input);
}
