/**
 * =============================================================================
 * ΜΕΤΑΠΤΩΣΗ Τ.Κ. — PROTECTED ROUTE (bypass role only)
 * =============================================================================
 *
 * GET  → dry-run preview: τι θα άλλαζε, χωρίς καμία εγγραφή.
 * POST → εκτέλεση.
 *
 * ΓΙΑΤΙ `createMigrationRoute` ΚΑΙ ΟΧΙ χειροκίνητοι wrappers: η κανονικοποίηση
 * Τ.Κ. είναι **καθολική** — δεν υπάρχει «ο Τ.Κ. αυτού του οργανισμού». Δεν
 * χρειάζεται λοιπόν το `NextRequest` για `?companyId=` (ο μόνος λόγος που το
 * `migrate-address-labels` κράτησε δικούς του wrappers). Αντιγράφοντάς τους εδώ
 * θα έφτιαχνα ακριβώς το sibling clone που πιάνει το `jscpd:diff` (N.18) —
 * guard (ADR-703) + audit + error body έρχονται από το SSoT (ADR-704 §4.1).
 *
 * Το Admin SDK παρακάμπτει τους Firestore rules· εδώ αυτό είναι το ζητούμενο και
 * όχι παράλειψη scope: μόνο bypass role φτάνει ως εδώ (browse doctrine, ADR-702).
 *
 * @see ./migration-operations για το «τι» και το «γιατί».
 */

import 'server-only';

import { createMigrationRoute } from '@/lib/admin-migration-runner';
import { migratePostalCodes } from './migration-operations';

export const { GET, POST } = createMigrationRoute({
  name: 'migrate-postal-codes',
  run: async (db, { dryRun }) => {
    const report = await migratePostalCodes(db, dryRun);
    return {
      body: { ...report },
      audit: {
        affectedDocuments: report.affectedDocuments,
        affectedAddresses: report.affectedAddresses,
      },
    };
  },
});
