#!/usr/bin/env ts-node
/**
 * ADR-376 Phase A — Opening Tags Backfill Migration.
 *
 * One-off migration για legacy `floorplan_openings` records που γράφτηκαν
 * πριν την ενεργοποίηση του `OpeningMarkService` (ADR-376). Διαβάζει όλα
 * τα openings ανά (project, floorplan), allocates Mark per (floor, kind),
 * γράφει πίσω `params.mark`.
 *
 * Floor resolution: από `opening.floorId` → `floors/{floorId}.number`.
 * Skip rules:
 *   - Aν `params.mark` ήδη set → skip (idempotent)
 *   - Αν `floorId` λείπει → skip (blank-canvas opening — pending Phase B)
 *   - Αν floor doc δεν υπάρχει → skip + warn
 *
 * USAGE:
 *   npx ts-node scripts/bim/migrate-opening-tags.ts --dry-run   # default — preview
 *   npx ts-node scripts/bim/migrate-opening-tags.ts --apply     # commit changes
 *   npx ts-node scripts/bim/migrate-opening-tags.ts --apply --locale=el|en
 *
 * @author Enterprise Architecture Team
 * @date 2026-05-25
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { formatMark, parseMarkSeq } from '../../src/subapps/dxf-viewer/bim/services/opening-mark-service';
import type { OpeningKind } from '../../src/subapps/dxf-viewer/bim/types/opening-types';

// ────────────────────────────────────────────────────────────────────────────
// FIREBASE ADMIN
// ────────────────────────────────────────────────────────────────────────────

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.join(__dirname, '..', '..', 'config', 'firebase-service-account.json');

if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    console.log('✅ Firebase Admin initialized (ADC)');
  } catch {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
    console.log('✅ Firebase Admin initialized (service-account JSON)');
  }
}

const firestore = admin.firestore();

// ────────────────────────────────────────────────────────────────────────────
// PREFIXES (mirror i18n locale files — keep in sync με dxf-viewer.json)
// ────────────────────────────────────────────────────────────────────────────

const PREFIXES_EL: Readonly<Record<OpeningKind, string>> = {
  'door':                'Θ',
  'double-door':         'ΔΦ',
  'sliding-door':        'Σ',
  'double-sliding-door': 'ΔΣ',
  'pocket-door':         'ΧΘ',
  'bifold-door':         'ΠΤ',
  'overhead-door':       'ΓΚ',
  'revolving-door':      'ΠΕ',
  'french-door':         'ΔΘ',
  'window':              'Π',
  'fixed':               'ΣΥ',
  'double-hung-window':  'ΚΠ',
  'sliding-window':      'ΣΠ',
  'awning-window':       'ΑΠ',
  'hopper-window':       'ΑΚ',
  'tilt-turn-window':    'ΑΑ',
  'bay-window':          'ΠΡ',
};

const PREFIXES_EN: Readonly<Record<OpeningKind, string>> = {
  'door':                'D',
  'double-door':         'DD',
  'sliding-door':        'SD',
  'double-sliding-door': 'DSD',
  'pocket-door':         'PKT',
  'bifold-door':         'BFD',
  'overhead-door':       'OHD',
  'revolving-door':      'RVD',
  'french-door':         'FD',
  'window':              'W',
  'fixed':               'FX',
  'double-hung-window':  'DHW',
  'sliding-window':      'SLW',
  'awning-window':       'AWN',
  'hopper-window':       'HOP',
  'tilt-turn-window':    'TT',
  'bay-window':          'BAY',
};

const BASEMENT_PREFIX_EL = 'Υ';
const BASEMENT_PREFIX_EN = 'B';

// ────────────────────────────────────────────────────────────────────────────
// MIGRATION
// ────────────────────────────────────────────────────────────────────────────

interface OpeningDoc {
  id: string;
  floorId?: string;
  kind?: OpeningKind;
  params?: { mark?: string; kind?: OpeningKind };
  companyId?: string;
  projectId?: string;
  floorplanId?: string;
}

interface MigrationContext {
  readonly kindPrefix: Readonly<Record<OpeningKind, string>>;
  readonly basementPrefix: string;
  readonly apply: boolean;
}

interface Stats {
  total: number;
  skippedAlreadyMarked: number;
  skippedNoFloor: number;
  skippedNoFloorDoc: number;
  allocated: number;
  errors: number;
}

async function migrate(ctx: MigrationContext): Promise<Stats> {
  const stats: Stats = {
    total: 0,
    skippedAlreadyMarked: 0,
    skippedNoFloor: 0,
    skippedNoFloorDoc: 0,
    allocated: 0,
    errors: 0,
  };

  const snapshot = await firestore.collection('floorplan_openings').get();
  stats.total = snapshot.size;

  // Group by (projectId, floorplanId, kind, floorNumber) for sequential alloc.
  const buckets = new Map<string, { docs: OpeningDoc[]; floorNumber: number }>();
  const floorCache = new Map<string, number | null>();

  for (const d of snapshot.docs) {
    const doc = { id: d.id, ...d.data() } as OpeningDoc;
    if (doc.params?.mark) {
      stats.skippedAlreadyMarked++;
      continue;
    }
    if (!doc.floorId) {
      stats.skippedNoFloor++;
      continue;
    }

    let floorNumber: number | null;
    if (floorCache.has(doc.floorId)) {
      floorNumber = floorCache.get(doc.floorId) ?? null;
    } else {
      const floorSnap = await firestore.collection('floors').doc(doc.floorId).get();
      const data = floorSnap.data() as { number?: number } | undefined;
      floorNumber = typeof data?.number === 'number' ? data.number : null;
      floorCache.set(doc.floorId, floorNumber);
    }
    if (floorNumber === null) {
      stats.skippedNoFloorDoc++;
      continue;
    }

    const kind = doc.params?.kind ?? doc.kind;
    if (!kind) {
      stats.errors++;
      continue;
    }

    const key = `${doc.companyId}::${doc.projectId}::${doc.floorplanId}::${kind}::${floorNumber}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { docs: [], floorNumber };
      buckets.set(key, bucket);
    }
    bucket.docs.push(doc);
  }

  for (const [key, bucket] of buckets) {
    const [companyId, projectId, floorplanId, kindRaw] = key.split('::');
    const kind = kindRaw as OpeningKind;

    // Find max existing seq για αυτό το (company, project, floorplan, kind, floor)
    const existingSnap = await firestore
      .collection('floorplan_openings')
      .where('companyId', '==', companyId)
      .where('projectId', '==', projectId)
      .where('floorplanId', '==', floorplanId)
      .where('kind', '==', kind)
      .get();

    let maxSeq = 0;
    for (const d of existingSnap.docs) {
      const m = (d.data() as OpeningDoc).params?.mark;
      if (typeof m !== 'string') continue;
      const seq = parseMarkSeq(m, {
        kindPrefix: ctx.kindPrefix[kind],
        floorNumber: bucket.floorNumber,
        basementPrefix: ctx.basementPrefix,
      });
      if (seq !== null && seq > maxSeq) maxSeq = seq;
    }

    let next = maxSeq + 1;
    for (const doc of bucket.docs) {
      const mark = formatMark({
        kindPrefix: ctx.kindPrefix[kind],
        floorNumber: bucket.floorNumber,
        basementPrefix: ctx.basementPrefix,
        seq: next,
      });
      next++;
      const nextParams = { ...(doc.params ?? {}), mark };
      if (ctx.apply) {
        try {
          await firestore
            .collection('floorplan_openings')
            .doc(doc.id)
            .update({ params: nextParams });
          stats.allocated++;
        } catch (e) {
          console.warn(`❌ Failed to update opening ${doc.id}:`, e);
          stats.errors++;
        }
      } else {
        console.log(`[dry-run] ${doc.id} → ${mark}`);
        stats.allocated++;
      }
    }
  }

  return stats;
}

// ────────────────────────────────────────────────────────────────────────────
// ENTRY
// ────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const localeArg = args.find((a) => a.startsWith('--locale='));
  const locale = (localeArg?.split('=')[1] ?? 'el').toLowerCase();
  const useEn = locale === 'en';

  console.log(`\n🏷️  ADR-376 Opening Tags Migration — ${apply ? 'APPLY' : 'DRY-RUN'} (locale=${locale})\n`);

  const stats = await migrate({
    apply,
    kindPrefix: useEn ? PREFIXES_EN : PREFIXES_EL,
    basementPrefix: useEn ? BASEMENT_PREFIX_EN : BASEMENT_PREFIX_EL,
  });

  console.log('\n📊 Stats:');
  console.log(`  total openings:           ${stats.total}`);
  console.log(`  already marked (skip):    ${stats.skippedAlreadyMarked}`);
  console.log(`  no floorId (skip):        ${stats.skippedNoFloor}`);
  console.log(`  floor doc missing (skip): ${stats.skippedNoFloorDoc}`);
  console.log(`  allocated:                ${stats.allocated}`);
  console.log(`  errors:                   ${stats.errors}`);
  console.log(apply ? '\n✅ Apply complete.' : '\n💡 Re-run με --apply για commit.');
}

main().catch((e) => {
  console.error('💥 Fatal:', e);
  process.exit(1);
});
