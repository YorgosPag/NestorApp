#!/usr/bin/env node
/**
 * Codemod: migrate `new Date().toISOString()` → `nowISO()` from @/lib/date-local
 *
 * AST-aware migration using ts-morph. Preserves formatting, comments and
 * import order. Idempotent: re-running on an already-migrated tree is a no-op.
 *
 * Only matches the EXACT pattern `new Date().toISOString()` (zero-arg constructor,
 * zero-arg method). Calls like `new Date(x).toISOString()` are intentionally
 * preserved — they convert a known input, not a wall-clock read.
 *
 * @see ADR-314 Phase C.1
 *
 * Usage:
 *   node scripts/migrate-toisostring.mjs [--dir <path>] [--apply] [--limit N]
 *
 * Defaults to dry-run. Pass --apply to write changes.
 */

import { Project, QuoteKind, SyntaxKind } from 'ts-morph';
import path from 'node:path';
import process from 'node:process';

// ─── CLI ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dirIdx = args.indexOf('--dir');
const dir = dirIdx >= 0 ? args[dirIdx + 1] : 'src';
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

const ROOT = process.cwd();
const CANONICAL_IMPORT = '@/lib/date-local';
const SSOT_FILE = path.join(ROOT, 'src', 'lib', 'date-local.ts').replace(/\\/g, '/');

// ─── Allowlist (must match registry entry for `date-local` module) ───────
const SKIP_PATTERNS = [
  /[\\/]__tests__[\\/]/,
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
  /\.d\.ts$/,
  /[\\/]node_modules[\\/]/,
  /[\\/]i18n[\\/]locales[\\/]/,
];

const shouldSkip = (file) => {
  const norm = file.replace(/\\/g, '/');
  if (norm === SSOT_FILE) return true;
  return SKIP_PATTERNS.some((re) => re.test(file));
};

// ─── Project setup ───────────────────────────────────────────────────────
console.log(`[codemod] mode=${apply ? 'APPLY' : 'DRY-RUN'} dir=${dir} limit=${limit === Infinity ? '∞' : limit}`);

const project = new Project({
  tsConfigFilePath: path.join(ROOT, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
  manipulationSettings: { quoteKind: QuoteKind.Single },
});

const targetGlob = path
  .join(ROOT, dir, '**/*.{ts,tsx}')
  .replace(/\\/g, '/');
project.addSourceFilesAtPaths(targetGlob);

const allFiles = project
  .getSourceFiles()
  .filter((sf) => !shouldSkip(sf.getFilePath()));
console.log(`[codemod] candidate files: ${allFiles.length}`);

// ─── Match: new Date().toISOString() (zero-arg both) ─────────────────────
const isTargetCall = (call) => {
  const expr = call.getExpression();
  if (!expr || expr.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
  if (call.getArguments().length !== 0) return false;
  const pae = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  if (pae.getName() !== 'toISOString') return false;
  const inner = pae.getExpression();
  if (!inner || inner.getKind() !== SyntaxKind.NewExpression) return false;
  const newExpr = inner.asKindOrThrow(SyntaxKind.NewExpression);
  if (newExpr.getExpression().getText() !== 'Date') return false;
  const newArgs = newExpr.getArguments();
  if (newArgs.length !== 0) return false;
  return true;
};

// ─── Run ─────────────────────────────────────────────────────────────────
let modifiedCount = 0;
let totalReplacements = 0;
const conflictFiles = [];

for (const sf of allFiles) {
  if (modifiedCount >= limit) break;
  const filePath = sf.getFilePath();

  const calls = sf
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(isTargetCall);
  if (calls.length === 0) continue;

  // Idempotency: existing canonical import?
  const existingImport = sf
    .getImportDeclarations()
    .find((imp) => imp.getModuleSpecifierValue() === CANONICAL_IMPORT);
  const alreadyImports =
    !!existingImport &&
    existingImport.getNamedImports().some((ni) => ni.getName() === 'nowISO');

  // Conflict: local binding named `nowISO` that is NOT our canonical import
  const hasLocalNowISO =
    sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((vd) => vd.getName() === 'nowISO') ||
    sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).some((fd) => fd.getName?.() === 'nowISO') ||
    sf.getDescendantsOfKind(SyntaxKind.Parameter).some((p) => p.getName() === 'nowISO');

  if (hasLocalNowISO && !alreadyImports) {
    conflictFiles.push(filePath);
    continue;
  }

  for (const call of calls) {
    call.replaceWithText('nowISO()');
    totalReplacements++;
  }

  if (!alreadyImports) {
    if (existingImport) {
      existingImport.addNamedImport('nowISO');
    } else {
      sf.addImportDeclaration({
        moduleSpecifier: CANONICAL_IMPORT,
        namedImports: ['nowISO'],
      });
    }
  }

  modifiedCount++;
  console.log(`  [${apply ? 'APPLY' : 'DRY'}] ${path.relative(ROOT, filePath)}  (${calls.length})`);
}

if (apply) {
  console.log(`[codemod] saving ${modifiedCount} files…`);
  await project.save();
}

console.log(`\n=== SUMMARY ===`);
console.log(`mode:         ${apply ? 'APPLY' : 'DRY-RUN'}`);
console.log(`scanned:      ${allFiles.length}`);
console.log(`modified:     ${modifiedCount}`);
console.log(`replacements: ${totalReplacements}`);
console.log(`conflicts:    ${conflictFiles.length}`);

if (conflictFiles.length > 0) {
  console.log(`\nConflicts (local 'nowISO' identifier — manual review):`);
  for (const f of conflictFiles) console.log(`  - ${path.relative(ROOT, f)}`);
}

process.exit(0);
