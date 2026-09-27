/**
 * @fileoverview **ΤΟ ΕΡΓΑΛΕΙΟ `pmtiles`** — καρφωμένη έκδοση, καρφωμένο αποτύπωμα ανά πλατφόρμα (ADR-891 Φ2).
 * @related ADR-891 §7 · `scripts/lib/cached-download.ts` · `scripts/build-basemap.ts`
 * @module scripts/lib/basemap/pmtiles-cli
 *
 * Το `go-pmtiles` (Protomaps, **BSD-3-Clause** — N.5 ✅) είναι ένα στατικό εκτελέσιμο. Δεν είναι πακέτο npm
 * και δεν μπαίνει στο `package.json`: το κατεβάζει ο γεννήτορας στην cache, **μόνο** όταν τρέχει.
 *
 * 🔴 **ΕΚΤΕΛΕΙΤΑΙ ΚΩΔΙΚΑΣ ΑΠΟ ΤΟ ΔΙΑΔΙΚΤΥΟ ⇒ ΤΟ sha256 ΕΙΝΑΙ ΚΑΡΦΩΜΕΝΟ ΕΔΩ.** Οι τιμές είναι τα `digest` της
 * σελίδας έκδοσης του GitHub, και η τιμή των Windows επαληθεύτηκε ξανά τοπικά (2026-09-27). Ασυμφωνία ⇒
 * κανένα αρχείο στον δίσκο, καμία εκτέλεση. Νέα έκδοση = **νέος πίνακας**, ποτέ «πάρε το latest».
 *
 * ⚠️ Τα ονόματα των αρχείων **δεν** ακολουθούν ένα πρότυπο (`go-pmtiles-1.31.2_Darwin…` με παύλα,
 * `go-pmtiles_1.31.2_Linux…` με κάτω παύλα) ⇒ γράφονται αυτούσια, δεν συντίθενται.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { loadCachedSource } from '../cached-download';

export const PMTILES_CLI_VERSION = '1.31.2';
const RELEASE_BASE = `https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_CLI_VERSION}`;

interface PmtilesAsset {
  readonly file: string;
  readonly sha256: string;
}

/** `process.platform-process.arch` → αρχείο έκδοσης + αποτύπωμα. */
const PMTILES_ASSETS: Readonly<Record<string, PmtilesAsset>> = {
  'win32-x64': { file: 'go-pmtiles_1.31.2_Windows_x86_64.zip', sha256: 'a658baa4d7e55020aef6ca17bd9ff9faa1582671266b36f58c52db0ac8e785a1' },
  'win32-arm64': { file: 'go-pmtiles_1.31.2_Windows_arm64.zip', sha256: '8780a17453c63af757917a694cbbb50b943db89cc3f1b07e6fd62c1ff8e6963b' },
  'linux-x64': { file: 'go-pmtiles_1.31.2_Linux_x86_64.tar.gz', sha256: '3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f' },
  'linux-arm64': { file: 'go-pmtiles_1.31.2_Linux_arm64.tar.gz', sha256: 'f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1' },
  'darwin-x64': { file: 'go-pmtiles-1.31.2_Darwin_x86_64.zip', sha256: '1f0dc02eee6c58312dd6c509faee1b5c32f0596568af1bf51f1b034e7a88a65b' },
  'darwin-arm64': { file: 'go-pmtiles-1.31.2_Darwin_arm64.zip', sha256: '40528f7f616fcbf91207cd48c8fc023d213f6d86c0cbf1f748732803d1880f3d' },
};

export function pmtilesAssetFor(platform: string, arch: string): PmtilesAsset {
  const asset = PMTILES_ASSETS[`${platform}-${arch}`];
  if (asset === undefined) throw new Error(`pmtiles ${PMTILES_CLI_VERSION}: καμία καρφωμένη έκδοση για ${platform}-${arch}`);
  return asset;
}

/**
 * Το `tar` που ανοίγει **και** zip. Στα Windows ζητείται ρητά το `System32\tar.exe` (bsdtar): στο PATH του
 * Git Bash το `tar` είναι GNU tar, που **δεν** ανοίγει zip.
 */
function archiveTool(): string {
  return process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
}

/** Τρέχει εντολή με την έξοδό της στην κονσόλα· κωδικός ≠ 0 ⇒ σφάλμα. */
export function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args[0] ?? ''}: κωδικός ${code}`))));
  });
}

/** Τρέχει εντολή και επιστρέφει ό,τι τύπωσε. */
export function capture(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(output) : reject(new Error(`${command} ${args[0] ?? ''}: κωδικός ${code}`))));
  });
}

/** Το εκτελέσιμο `pmtiles`, επαληθευμένο — από την cache ή από το GitHub. */
export async function ensurePmtilesCli(cacheDir: string): Promise<string> {
  const asset = pmtilesAssetFor(process.platform, process.arch);
  const toolDir = join(cacheDir, `go-pmtiles-${PMTILES_CLI_VERSION}`);
  const binary = join(toolDir, process.platform === 'win32' ? 'pmtiles.exe' : 'pmtiles');
  mkdirSync(toolDir, { recursive: true });

  const archive = await loadCachedSource({
    url: `${RELEASE_BASE}/${asset.file}`,
    path: join(toolDir, asset.file),
    label: `pmtiles ${PMTILES_CLI_VERSION}`,
    expectedSha256: asset.sha256,
  });
  if (!existsSync(binary)) await run(archiveTool(), ['-xf', archive.path, '-C', toolDir]);
  return binary;
}
