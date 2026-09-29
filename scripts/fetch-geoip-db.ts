/**
 * @fileoverview **Η ΤΟΠΙΚΗ ΒΑΣΗ GeoIP** — κατεβάζει τη DB-IP City Lite του μήνα, την **επαληθεύει** και την αφήνει
 * εκεί που τη διαβάζει ο server (`data/geoip/dbip-city-lite.mmdb`). ADR-894.
 * @related `src/lib/geo/ip-geolocation.ts` (ο αναγνώστης) · `scripts/lib/cached-download.ts` (η ΜΙΑ λήψη πηγής) ·
 *   `.github/workflows/docker-build.yml` (τρέχει σε κάθε build — η βάση μπαίνει στο image)
 *
 * 🔑 **Γιατί στο image και όχι σε τόμο**: ίδιο image ⇒ ίδια βάση ⇒ αναπαραγώγιμη απάντηση· κανένα δεύτερο
 * σύστημα στον server να παρακολουθείται. Η DB-IP Lite είναι CC BY 4.0 — η αναδιανομή επιτρέπεται. Αν ποτέ
 * χρειαστεί το πρότυπο MaxMind (`geoipupdate` σε τόμο), ο αναγνώστης ακούει ήδη το `GEOIP_DB_PATH` και
 * ξαναφορτώνει όταν αλλάξει το αρχείο.
 *
 * 🔑 **Η έκδοση είναι ο μήνας**: `dbip-city-lite-YYYY-MM.mmdb.gz`. Τις πρώτες μέρες του μήνα η νέα μπορεί να
 * μην έχει δημοσιευτεί ⇒ ο προηγούμενος μήνας (δηλωμένη εφεδρεία, όχι σιωπηλή).
 *
 * ⛔ **Καμία βάση χωρίς απόδειξη**: πριν τη μετονομασία, ανοίγεται και ρωτιέται (τύπος `City`, γνωστή δημόσια
 * IP ⇒ χώρα). Μισό ή λάθος αρχείο δεν φτάνει ποτέ στο image.
 *
 * Χρήση: `pnpm run geoip:fetch` · `pnpm run geoip:fetch -- --refresh`
 */

import { createReadStream, createWriteStream, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

import { Reader, type CityResponse } from 'maxmind';

import { DEFAULT_GEOIP_DB_RELATIVE_PATH } from '../src/lib/geo/ip-geolocation-paths';
import { loadCachedSource, probeSource } from './lib/cached-download';

const REPO_ROOT = join(__dirname, '..');
const CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'geoip');
const TARGET = join(REPO_ROOT, DEFAULT_GEOIP_DB_RELATIVE_PATH);

/** Γνωστή δημόσια διεύθυνση (Google DNS) — ό,τι κι αν λέει για πόλη, **χώρα** οφείλει να έχει. */
const SANITY_IP = '8.8.8.8';

function editionOf(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function sourceUrl(edition: string): string {
  return `https://download.db-ip.com/free/dbip-city-lite-${edition}.mmdb.gz`;
}

/** Ο τρέχων μήνας, αλλιώς ο προηγούμενος — **μόνο** αν η πηγή απαντά 404 για τον τρέχοντα. */
async function pickEdition(now: Date): Promise<string> {
  const current = editionOf(now);
  const probe = await probeSource(sourceUrl(current));
  if (probe.status === 200) return current;
  if (probe.status !== 404) throw new Error(`${probe.url}: απρόσμενο HTTP ${probe.status}`);

  const previous = editionOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  console.log(`  ⚠️ η έκδοση ${current} δεν έχει δημοσιευτεί ακόμη — χρησιμοποιείται η ${previous}`);
  return previous;
}

async function gunzipAtomically(source: string, target: string): Promise<void> {
  mkdirSync(dirname(target), { recursive: true });
  const part = `${target}.part`;
  await pipeline(createReadStream(source), createGunzip(), createWriteStream(part));
  verifyDatabase(part);
  renameSync(part, target);
}

/** Η απόδειξη: σωστός τύπος και πραγματική απάντηση. Αλλιώς πετά και σβήνει το μισό αρχείο. */
function verifyDatabase(path: string): void {
  try {
    const reader = new Reader<CityResponse>(readFileSync(path));
    const { databaseType, buildEpoch } = reader.metadata;
    if (!/city/i.test(databaseType)) throw new Error(`λάθος τύπος βάσης: ${databaseType}`);
    const country = reader.get(SANITY_IP)?.country?.iso_code;
    if (!country) throw new Error(`η ${SANITY_IP} δεν έδωσε χώρα — η βάση δεν απαντά`);
    console.log(`  ✓ ${databaseType} · build ${buildEpoch.toISOString().slice(0, 10)} · ${SANITY_IP} → ${country}`);
  } catch (error) {
    rmSync(path, { force: true });
    throw error;
  }
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh');
  const edition = await pickEdition(new Date());
  const cached = await loadCachedSource({
    url: sourceUrl(edition),
    path: join(CACHE_DIR, `dbip-city-lite-${edition}.mmdb.gz`),
    label: `DB-IP City Lite ${edition}`,
    refresh,
  });
  await gunzipAtomically(cached.path, TARGET);
  console.log(`  → ${DEFAULT_GEOIP_DB_RELATIVE_PATH} (πηγή sha256 ${cached.meta.sha256.slice(0, 12)}…, ${cached.meta.lastModified ?? 'χωρίς Last-Modified'})`);
}

main().catch((error: unknown) => {
  console.error(`❌ geoip:fetch — ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
