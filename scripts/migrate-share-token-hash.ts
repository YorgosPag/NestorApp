/**
 * =============================================================================
 * ΜΕΤΑΠΤΩΣΗ — διακριτικό κοινοποίησης → ΜΟΝΟ το αποτύπωμά του (ADR-884 Φ0.12)
 * =============================================================================
 *
 * **Γιατί**: μέχρι το Κ4 τα `shares` και `file_shares` κρατούσαν το διακριτικό **σε καθαρό
 * κείμενο**, σε συλλογή που ο κανόνας άφηνε ανώνυμο να απαριθμεί. Ο κώδικας πλέον ψάχνει
 * με `tokenHash` (και, μεταβατικά, με `token`). Αυτή η μετάπτωση υπολογίζει το
 * `tokenHash` από το **γνωστό** ωμό διακριτικό και **σβήνει** το `token` — οι παλιοί
 * σύνδεσμοι **συνεχίζουν** να ανοίγουν, αφού ο σύνδεσμος φέρει το ίδιο διακριτικό.
 *
 * ┌─ ΣΥΜΒΟΛΑΙΟ ────────────────────────────────────────────────────────────────┐
 * │ 🔒 Αποτύπωμα: ΑΠΟΚΛΕΙΣΤΙΚΑ το γνήσιο `hashShareToken` — ίδιο με το lookup.  │
 * │ 🔒 Γράφει ΜΟΝΟ `tokenHash` και σβήνει ΜΟΝΟ `token`. Τίποτε άλλο.            │
 * │ 🔒 Ιδεμποτική: χωρίς `token` ⇒ καμία γραφή.                                │
 * │ ⛔ `tokenHash` που ΔΙΑΦΩΝΕΙ με το `token` ⇒ ΑΝΑΦΟΡΑ, ποτέ γραφή.          │
 * │ ℹ️ Οι παλιοί κωδικοί (SHA-256 χωρίς salt) ΔΕΝ ξαναγράφονται εδώ — δεν      │
 * │    ξέρουμε τον κωδικό· αναβαθμίζονται στην πρώτη σωστή είσοδο (scrypt).     │
 * │    Το script τους ΜΕΤΡΑ, ώστε να φαίνεται πόσοι μένουν.                    │
 * │ 🔴 ΣΕΙΡΑ ΑΝΑΠΤΥΞΗΣ: δείκτες → push κώδικα → ΑΥΤΟ → κανόνες.                │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```bash
 * npx tsx scripts/migrate-share-token-hash.ts            # dry-run (μέτρηση)
 * npx tsx scripts/migrate-share-token-hash.ts --execute  # εγγραφή
 * ```
 *
 * @see src/lib/sharing/share-token.ts · src/server/sharing/share-token-lookup.ts
 */

import admin from 'firebase-admin';

import { COLLECTIONS } from '../src/config/firestore-collections';
import { hashShareToken } from '../src/lib/sharing/share-token';
import { applyEnvLocal } from './_shared/loadEnvLocal';
import { initAdminApp } from './_shared/firebaseAdminOps';

/** Η απόφαση για ένα έγγραφο — ονομασμένη, ποτέ boolean. */
export type TokenHashPlan =
  | { readonly kind: 'write'; readonly tokenHash: string }
  | { readonly kind: 'noop' }
  | { readonly kind: 'conflict' };

/** Ο παλιός hash κωδικού: 64 δεκαεξαδικά = SHA-256 χωρίς salt. */
const LEGACY_PASSWORD_HASH = /^[0-9a-f]{64}$/;

/** **Τι πρέπει να γραφτεί** σε αυτό το έγγραφο — χωρίς δίσκο. */
export async function planTokenHash(raw: Record<string, unknown>): Promise<TokenHashPlan> {
  const token = typeof raw.token === 'string' && raw.token !== '' ? raw.token : null;
  if (token === null) return { kind: 'noop' };
  const tokenHash = await hashShareToken(token);
  if (typeof raw.tokenHash === 'string' && raw.tokenHash !== tokenHash) return { kind: 'conflict' };
  return { kind: 'write', tokenHash };
}

/** Μένει παλιός κωδικός σε αυτό το έγγραφο; */
export function hasLegacyPasswordHash(raw: Record<string, unknown>): boolean {
  return typeof raw.passwordHash === 'string' && LEGACY_PASSWORD_HASH.test(raw.passwordHash);
}

/** Firestore επιτρέπει έως 500 πράξεις ανά batch· κρατάμε περιθώριο. */
const BATCH_SIZE = 400;

interface Tally { write: number; noop: number; conflict: number; legacyPasswords: number }

async function migrateCollection(db: admin.firestore.Firestore, collection: string, execute: boolean): Promise<Tally> {
  const snapshot = await db.collection(collection).get();
  const tally: Tally = { write: 0, noop: 0, conflict: 0, legacyPasswords: 0 };
  let batch = db.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (hasLegacyPasswordHash(data)) tally.legacyPasswords += 1;
    const plan = await planTokenHash(data);
    tally[plan.kind] += 1;
    if (plan.kind === 'conflict') console.log(`  ⛔ ${collection}/${doc.id}: tokenHash ΔΙΑΦΩΝΕΙ με το token — ΔΕΝ γράφεται`);
    if (plan.kind !== 'write' || !execute) continue;
    batch.update(doc.ref, { tokenHash: plan.tokenHash, token: admin.firestore.FieldValue.delete() });
    pending += 1;
    if (pending === BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (execute && pending > 0) await batch.commit();

  // Κάθε κάδος τυπώνεται, και τα μηδενικά: «0» που δεν φαίνεται διαβάζεται «δεν κοίταξα».
  console.log(
    `  ${collection}: σύνολο ${snapshot.size} · προς εγγραφή ${tally.write} · ήδη χωρίς ωμό διακριτικό ${tally.noop} · ` +
      `σε σύγκρουση ${tally.conflict} · παλιοί κωδικοί (αναβάθμιση στην πρώτη είσοδο) ${tally.legacyPasswords}`,
  );
  return tally;
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute');
  applyEnvLocal();
  const { db, projectId } = initAdminApp(admin);

  console.log(`\nΑποτύπωμα διακριτικών κοινοποίησης — ${execute ? 'EXECUTE (εγγραφή)' : 'DRY-RUN'} · ${projectId}\n`);
  const results = [
    await migrateCollection(db, COLLECTIONS.SHARES, execute),
    await migrateCollection(db, COLLECTIONS.FILE_SHARES, execute),
  ];
  console.log(execute ? '\nΓΡΑΦΤΗΚΑΝ.\n' : '\n(dry-run, τίποτα δεν γράφτηκε)\n');
  if (results.some((tally) => tally.conflict > 0)) process.exitCode = 1;
}

if (process.argv[1]?.includes('migrate-share-token-hash')) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
