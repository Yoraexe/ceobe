// Tujuan: Menjalankan linter programatik pasca-eksekusi untuk memverifikasi kepatuhan terhadap engineering rules.
// Caller: src/ai/supervisor.ts
// Dependensi: fs, path, ts-morph

import * as fs from 'fs';
import * as path from 'path';
import { Project, SyntaxKind } from 'ts-morph';
import { getProjectDir } from '../../utils/context';

export interface RuleViolation {
  ruleId: string;
  severity: 'error' | 'warning';
  filePath: string;
  line?: number;
  message: string;
  fix?: string;
}

export async function checkRules(changedFiles: string[]): Promise<RuleViolation[]> {
  const violations: RuleViolation[] = [];
  const projectDir = getProjectDir();
  const tsConfigPath = path.join(projectDir, 'tsconfig.json');
  const project = fs.existsSync(tsConfigPath)
    ? new Project({ tsConfigFilePath: tsConfigPath, useInMemoryFileSystem: false })
    : new Project({ useInMemoryFileSystem: false });
  
  const existingFiles = new Set<string>();
  const tsFiles: string[] = [];

  for (const file of changedFiles) {
    const fullPath = path.isAbsolute(file) ? file : path.join(projectDir, file);
    if (fs.existsSync(fullPath)) {
      existingFiles.add(fullPath);
      if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
        tsFiles.push(fullPath);
      }
    }
  }

  if (tsFiles.length > 0) {
    project.addSourceFilesAtPaths(tsFiles);
  }

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    const relPath = path.relative(projectDir, filePath).replace(/\\/g, '/');
    // Fix M-23: Narrow the isController heuristic to prevent false positives on files that just have "api" in their path
    const isController = /(?:^|\/)(?:controllers|handlers|routes|endpoints)\//i.test(relPath) || (/\/api\//i.test(relPath) && !/\/utils\//i.test(relPath));
    
    // Rule #14: Mandatory File Header
    const firstStmt = sourceFile.getStatements()[0];
    let hasHeader = false;
    if (firstStmt) {
      const leadingComments = firstStmt.getLeadingCommentRanges();
      for (const comment of leadingComments) {
        if (comment.getText().includes('Tujuan:')) {
          hasHeader = true;
          break;
        }
      }
    }
    // Also check if file just has a comment at top even without statements
    if (!hasHeader && sourceFile.getText().includes('// Tujuan:')) {
      hasHeader = true;
    }
    if (!hasHeader) {
      violations.push({
        ruleId: 'RULE-14',
        severity: 'error',
        filePath: relPath,
        message: 'File is missing the mandatory header documentation (// Tujuan: ...)',
        fix: 'Add the standardized header comment at the top of the file.'
      });
    }

    // Process Imports
    const imports = sourceFile.getImportDeclarations();
    for (const importDecl of imports) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const line = importDecl.getStartLineNumber();

      // Rule #1: Layered Architecture (Controllers shouldn't import from db/repository directly)
      if (isController && (moduleSpecifier.includes('/repository') || moduleSpecifier.includes('/db'))) {
        violations.push({
          ruleId: 'RULE-01',
          severity: 'error',
          filePath: relPath,
          line,
          message: `Controllers should not directly import from data layers (${moduleSpecifier}).`,
          fix: 'Route database calls through a Service layer instead.'
        });
      }

      // Rule #13.2: No hallucinated imports (only for relative local imports)
      if (moduleSpecifier.startsWith('.')) {
        const moduleSourceFile = importDecl.getModuleSpecifierSourceFile();
        if (!moduleSourceFile) {
          // It might be a non-ts file or unresolvable
          const absoluteImport = path.resolve(path.dirname(filePath), moduleSpecifier);
          let found = false;
          const exts = ['.ts', '.tsx', '.js', '.jsx', '.json', ''];
          for (const ext of exts) {
            if (fs.existsSync(absoluteImport + ext) || fs.existsSync(path.join(absoluteImport, 'index' + ext))) {
              found = true;
              break;
            }
          }
          if (!found) {
            violations.push({
              ruleId: 'RULE-13',
              severity: 'error',
              filePath: relPath,
              line,
              message: `Hallucinated or unresolved import: '${moduleSpecifier}'`,
              fix: 'Verify the file path and ensure the module actually exists before importing.'
            });
          }
        }
      }
    }

    // Process DB Access & Queries
    if (isController) {
      // Rule #8: Database Access in Controllers
      const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
      for (const id of identifiers) {
        const text = id.getText();
        if (text === 'db' || text === 'prisma' || text === 'drizzle') {
          const parent = id.getParent();
          if (parent && parent.getKind() === SyntaxKind.PropertyAccessExpression) {
            violations.push({
              ruleId: 'RULE-08',
              severity: 'error',
              filePath: relPath,
              line: id.getStartLineNumber(),
              message: 'Direct database access detected in controller.',
              fix: 'Move database queries to a dedicated Repository or Service layer.'
            });
          }
        }
      }
    }

    // Rule #16: No SELECT * / N+1 Prevention
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const expr = callExpr.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr.asKind(SyntaxKind.PropertyAccessExpression);
        if (propAccess) {
          const methodName = propAccess.getName();
          if (['findMany', 'find', 'findOne', 'findFirst', 'update', 'delete', 'query'].includes(methodName)) {
            // Check for missing select clause in ORM
            const args = callExpr.getArguments();
            let hasSelect = false;
            if (args.length > 0 && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
              const obj = args[0].asKind(SyntaxKind.ObjectLiteralExpression);
              if (obj && obj.getProperty('select')) {
                hasSelect = true;
              }
            }
            if (!hasSelect) {
              violations.push({
                ruleId: 'RULE-16',
                severity: 'warning',
                filePath: relPath,
                line: callExpr.getStartLineNumber(),
                message: 'Unbounded query detected. No select clause provided.',
                fix: 'Always select specific columns rather than fetching all fields to optimize performance.'
              });
            }

            // Check if inside a loop
            const parentLoop = callExpr.getFirstAncestorByKind(SyntaxKind.ForStatement) || 
                               callExpr.getFirstAncestorByKind(SyntaxKind.ForInStatement) || 
                               callExpr.getFirstAncestorByKind(SyntaxKind.ForOfStatement);
            if (parentLoop) {
              violations.push({
                ruleId: 'RULE-16',
                severity: 'warning',
                filePath: relPath,
                line: callExpr.getStartLineNumber(),
                message: 'Database query inside a loop detected. High risk of N+1 problem.',
                fix: 'Use batch loaders, IN clauses, or eager loading/joins outside the loop.'
              });
            } else {
              // Check array map
              const parentCall = callExpr.getFirstAncestorByKind(SyntaxKind.CallExpression);
              if (parentCall) {
                const parentExpr = parentCall.getExpression();
                if (parentExpr.getKind() === SyntaxKind.PropertyAccessExpression) {
                  const pProp = parentExpr.asKind(SyntaxKind.PropertyAccessExpression);
                  if (pProp && pProp.getName() === 'map') {
                    violations.push({
                      ruleId: 'RULE-16',
                      severity: 'warning',
                      filePath: relPath,
                      line: callExpr.getStartLineNumber(),
                      message: 'Database query inside array.map() detected. High risk of N+1 problem.',
                      fix: 'Use batch loaders, IN clauses, or eager loading/joins instead of mapping queries.'
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    // Rule #16 (Raw SQL): No SELECT *
    const stringLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral);
    for (const str of stringLiterals) {
      if (str.getText().toUpperCase().includes('SELECT *')) {
        violations.push({
          ruleId: 'RULE-16',
          severity: 'warning',
          filePath: relPath,
          line: str.getStartLineNumber(),
          message: 'Raw SELECT * query detected.',
          fix: 'Explicitly specify the columns you need instead of using SELECT *.'
        });
      }
    }
  }

  return violations;
}
