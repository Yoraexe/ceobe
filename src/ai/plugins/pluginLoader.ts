// Tujuan: Memuat plugin kustom Ceobe dari direktori target secara dinamis dan mendaftarkannya sebagai runtime tools.
// Caller: src/ai/executor.ts, src/ai/tools/systemTools.ts
// Dependensi: fs, path, url
// Main Functions: loadDynamicTools, handlePluginCall, clearLoadedPlugins
// Side Effects: Membaca filesystem dan memuat kode executable pihak ketiga.

import { log } from '../../utils/context';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { NormalizedTool } from '../providers/types';
import chalk from 'chalk';

interface PluginDefinition {
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
const loadedPlugins = new Map<string, PluginDefinition>();

export function clearLoadedPlugins() {
  loadedPlugins.clear();
}

export async function loadDynamicTools(projectDir: string): Promise<NormalizedTool[]> {
  const pluginsDir = path.join(projectDir, '.ceobe', 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    return [];
  }

  const files = fs.readdirSync(pluginsDir);
  const pluginFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.cjs') || f.endsWith('.mjs'));
  
  if (pluginFiles.length === 0) return [];

  log(chalk.blue(`[PluginLoader] Ditemukan ${pluginFiles.length} file plugin di .ceobe/plugins/`));

  // Ensure tsx/ts-node is registered if we need to load .ts files
  const hasTs = pluginFiles.some(f => f.endsWith('.ts'));
  if (hasTs) {
    try {
      if (!(process as any)[Symbol.for('ts-node.register.instance')]) {
        require('ts-node/register/transpile-only');
      }
    } catch {
      // ignore
    }
  }

  const tools: NormalizedTool[] = [];
  const { askUserConfirmation } = await import('../../utils/modeManager');

  for (const file of pluginFiles) {
    try {
      const fullPath = path.join(pluginsDir, file);
      const realPath = fs.realpathSync(fullPath);
      const realPluginsDir = fs.realpathSync(pluginsDir);
      
      if (!realPath.startsWith(realPluginsDir)) {
        log(chalk.red(`[PluginLoader] ❌ Keamanan: Plugin ${file} berada di luar direktori plugins. Diabaikan.`));
        continue;
      }

      const fileUrl = pathToFileURL(realPath).href;
      
      log(chalk.yellow(`[PluginLoader] ⚠️ Keamanan: Meminta izin eksplisit untuk memuat plugin eksternal '${file}'...`));
      const approved = await askUserConfirmation(`Load external executable plugin code from '${file}'?`);
      if (!approved) {
        log(chalk.red(`[PluginLoader] ❌ Ditolak oleh pengguna. Plugin '${file}' tidak dimuat.`));
        continue;
      }
      
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
