#!/usr/bin/env tsx
/**
 * Dev/ops-only CLI for ADR-312 Phase 3 back-fill of DXF thumbnails.
 *
 * Invokes the same SSoT helper used by POST /api/admin/migrate-dxf-thumbnails
 * but bypasses HTTP + super_admin auth because it runs locally with the
 * service account already configured via .env.local.
 *
 * USAGE:
 *   tsx --require dotenv/config scripts/run-dxf-thumbnail-migration.ts \
 *     --companyId=comp_... [--limit=10] [--dryRun]
 */

import * as fs from 'fs';
import * as path from 'path';
import Module from 'module';

// Shim `server-only` — Next.js ships no real package; it's a bundler-time marker.
const origResolve = (Module as unknown as { _resolveFilename: Function })._resolveFilename;
(Module as unknown as { _resolveFilename: Function })._resolveFilename = function (
  req: string,
  ...rest: unknown[]
): string {
  if (req === 'server-only') {
    return path.join(__dirname, 'server-only-shim.js');
  }
  return origResolve.call(this, req, ...rest);
};
const shimPath = path.join(__dirname, 'server-only-shim.js');
if (!fs.existsSync(shimPath)) fs.writeFileSync(shimPath, 'module.exports = {};');

// Manually load .env.local (dotenv not installed at top level).
(function loadEnv(): void {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
})();

interface CliArgs {
  companyId: string;
  limit: number;
  dryRun: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: Partial<CliArgs> = { limit: 10, dryRun: false };
  for (const a of args) {
    if (a.startsWith('--companyId=')) out.companyId = a.slice('--companyId='.length);
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice('--limit='.length));
    else if (a === '--dryRun') out.dryRun = true;
  }
  if (!out.companyId) {
    console.error('Missing --companyId=comp_...');
    process.exit(2);
  }
  return out as CliArgs;
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log('Running DXF thumbnail migration with:', args);
  // Dynamic import — must happen AFTER the server-only shim above.
  const { runDxfThumbnailMigration } = await import(
    '../src/app/api/admin/migrate-dxf-thumbnails/helpers'
  );
  const report = await runDxfThumbnailMigration(args);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
