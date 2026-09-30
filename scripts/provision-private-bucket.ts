#!/usr/bin/env tsx
/**
 * **ΠΡΟΜΗΘΕΙΑ ΙΔΙΩΤΙΚΟΥ ΚΑΔΟΥ** — ADR-895 Α5 (γενίκευση του ADR-884 Φ2ζ ζ5).
 *
 * Η κατάσταση κάθε ιδιωτικού κάδου **δηλώνεται** στο `server/storage/private-bucket-registry`· αυτό το script ρωτά τον ΕΝΑ
 * μηχανισμό (`declared-private-bucket`). Καμία λογική εδώ — μόνο επιλογή και αναφορά.
 *
 * 🏆 **Ξηρό εξ ορισμού**: λέει αν ο κάδος υπάρχει και **τι αποκλίνει** από τη δήλωση — τίποτα δεν γράφεται.
 * 🔴 **`--apply` = δημιουργία/αλλαγή πόρου στο GCP** — ενέργεια του Giorgio, μόνο με «ναι».
 *
 * ΕΚΤΕΛΕΣΗ
 *   npm run provision:tour-media              # ξηρό — έλεγχος απόκλισης
 *   npm run provision:files-eu -- --apply     # δημιουργία / συμφιλίωση
 *
 * Το `NODE_OPTIONS=--conditions=react-server` είναι ο δηλωμένος μηχανισμός του `server-only` (βλ. `backfill-tour-face-scan.ts`).
 */

import { ensurePrivateBucket, inspectPrivateBucket, type PrivateBucketState } from '@/server/storage/declared-private-bucket';
import { DECLARED_PRIVATE_BUCKETS, declaredPrivateBucket } from '@/server/storage/private-bucket-registry';

import { applyEnvLocal } from './_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
const ID = ARGS.find((arg) => !arg.startsWith('--'));

function report(label: string, id: string, state: PrivateBucketState): void {
  console.log(`[PRIVATE BUCKET ${id}] ${label} · ${state.bucketName} · υπάρχει: ${state.exists ? 'ναι' : 'όχι'}`);
  console.log(state.drift.length === 0 ? '  ✅ ακριβώς όπως η δήλωση' : `  ⚠️ αποκλίνει: ${state.drift.join(', ')}`);
}

async function main(): Promise<void> {
  const decl = ID === undefined ? undefined : declaredPrivateBucket(ID);
  if (!decl) {
    console.error(`[PRIVATE BUCKET] άγνωστος κάδος «${ID ?? ''}» — δηλωμένοι: ${DECLARED_PRIVATE_BUCKETS.map((d) => d.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  report('ΠΡΙΝ', decl.id, await inspectPrivateBucket(decl));
  if (!APPLY) return;
  const after = await ensurePrivateBucket(decl);
  report('ΜΕΤΑ', decl.id, after);
  // Περιοχή/κλάση/HNS/retention δεν τα γράφει η συμφιλίωση — απόκλιση εκεί θέλει απόφαση ανθρώπου, όχι σιωπή.
  if (after.drift.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('[PRIVATE BUCKET] απέτυχε', error);
  process.exitCode = 1;
});
