// Tujuan: Mengelola knowledge graph dependensi (import/export) antar file.
// Caller: src/ai/memory/indexer.ts
// Dependensi: ts-morph, fs, path, utils/context

import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';
import { getProjectDir } from '../../utils/context';
import { isTypeScriptFile } from './astParser';

export interface DependencyNode {
  filePath: string;
  imports: string[];      // file paths yang di-import
  importedBy: string[];   // file paths yang meng-import file ini  
  exports: string[];      // exported symbol names
}

export function getDependencyGraphFilePath(): string {
  return path.join(getProjectDir(), '.ceobe', 'dependency-graph.json');
}

export function saveDependencyGraph(graph: Map<string, DependencyNode>): void {
  const filePath = getDependencyGraphFilePath();
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const obj = Object.fromEntries(graph);
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

export function loadDependencyGraph(): Map<string, DependencyNode> {
  const filePath = getDependencyGraphFilePath();
  if (!fs.existsSync(filePath)) {
    return new Map();
  }
  
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(data);
    return new Map(Object.entries(obj));
  } catch (error) {
    console.debug(`[DependencyGraph Debug] Failed to load dependency graph: ${error}`);
    return new Map();
  }
}

export function buildDependencyGraph(workspaceRoot: string, filesToProcess: string[]): Map<string, DependencyNode> {
  const graph = loadDependencyGraph();
  const project = new Project({ useInMemoryFileSystem: false });

  // Add files to project
  const tsFiles = filesToProcess.filter(isTypeScriptFile);
  if (tsFiles.length === 0) return graph;

  project.addSourceFilesAtPaths(tsFiles);

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const relPath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

    // Initialize node
    if (!graph.has(relPath)) {
      graph.set(relPath, { filePath: relPath, imports: [], importedBy: [], exports: [] });
    }
    const node = graph.get(relPath)!;

    // Reset current file's imports and exports to rebuild
    node.imports = [];
    node.exports = [];

    // Parse imports
    const importDecls = sourceFile.getImportDeclarations();
    for (const importDecl of importDecls) {
      const moduleSpecifierSourceFile = importDecl.getModuleSpecifierSourceFile();
      if (moduleSpecifierSourceFile) {
        const importedRelPath = path.relative(workspaceRoot, moduleSpecifierSourceFile.getFilePath()).replace(/\\/g, '/');
        if (!node.imports.includes(importedRelPath)) {
          node.imports.push(importedRelPath);
        }

        // Add inverse relation
        if (!graph.has(importedRelPath)) {
          graph.set(importedRelPath, { filePath: importedRelPath, imports: [], importedBy: [], exports: [] });
        }
        const importedNode = graph.get(importedRelPath)!;
        if (!importedNode.importedBy.includes(relPath)) {
          importedNode.importedBy.push(relPath);
        }
      }
    }

    // Parse exports
    const exportedDecls = sourceFile.getExportedDeclarations();
    for (const [name] of exportedDecls) {
      if (!node.exports.includes(name)) {
        node.exports.push(name);
      }
    }
  }

  return graph;
}

export function getAffectedFiles(filePath: string, graph: Map<string, DependencyNode>): string[] {
  const node = graph.get(filePath.replace(/\\/g, '/'));
  if (!node) return [];
  return node.importedBy;
}
