#!/usr/bin/env tsx
/**
 * **ΠΡΟΜΗΘΕΙΑ ΚΑΔΟΥ ΜΕΣΩΝ ΠΕΡΙΗΓΗΣΗΣ** — ADR-884 Φ2ζ ζ5 · §12 Δ11.
 *
 * Ο ιδιωτικός κάδος της ΕΕ (`europe-west3`) για την καραντίνα ανεβάσματος και τα πλακίδια. Η κατάσταση του κάδου **δηλώνεται**
 * στο `config/gcs-buckets` (`GCS_TOUR_MEDIA_BUCKET_CONFIG`)· αυτό το script ρωτά τον ΕΝΑ γραφέα (`tour-media-provision`).
 * Καμία λογική εδώ — μόνο επιλογή και αναφορά.
 *
 * 🏆 **Ξηρό εξ ορισμού**: λέει αν ο κάδος υπάρχει και **τι αποκλίνει** από τη δήλωση — τίποτα δεν γράφεται.
 * 🔴 **`--apply` = δημιουργία/αλλαγή πόρου στο GCP** — ενέργεια του Giorgio (handoff §2 βήμα 3). Τρέχει **ΠΡΙΝ** από το deploy
 *   του ζ5: οι νέες περιηγήσεις γεννιούνται `tour-eu` και το πρώτο τους ανέβασμα χρειάζεται τον κάδο.
 *
 * ΕΚΤΕΛΕΣΗ
 *   npm run provision:tour-media              # ξηρό — έλεγχος απόκλισης
 *   npm run provision:tour-media -- --apply   # δημιουργία / συμφιλίωση
 *
 * Το `NODE_OPTIONS=--conditions=react-server` είναι ο δηλωμένος μηχανισμός του `server-only` (βλ. `backfill-tour-face-scan.ts`).
 */

import { ensureTourMediaBucket, inspectTourMediaBucket, type TourMediaBucketState } from '@/server/spatial-tour/tour-media-provision';

import { applyEnvLocal } from './_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const APPLY = process.argv.slice(2).includes('--apply');

function report(label: string, state: TourMediaBucketState): void {
  console.log(`[TOUR MEDIA BUCKET] ${label} · ${state.bucketName} · υπάρχει: ${state.exists ? 'ναι' : 'όχι'}`);
  console.log(state.drift.length === 0 ? '  ✅ ακριβώς όπως η δήλωση' : `  ⚠️ αποκλίνει: ${state.drift.join(', ')}`);
}

async function main(): Promise<void> {
  const before = await inspectTourMediaBucket();
  report('ΠΡΙΝ', before);
  if (!APPLY) return;
  const after = await ensureTourMediaBucket();
  report('ΜΕΤΑ', after);
  // Περιοχή/κλάση δεν αλλάζουν σε υπάρχοντα κάδο — απόκλιση εκεί θέλει απόφαση ανθρώπου, όχι σιωπή.
  if (after.drift.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('[TOUR MEDIA BUCKET] απέτυχε', error);
  process.exitCode = 1;
});
