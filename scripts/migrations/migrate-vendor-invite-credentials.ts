#!/usr/bin/env tsx
/**
 * MIGRATION — ωμό `vendor_invites.token` → διαπιστευτήριο `legacy` (ADR-876 §5 Φ6).
 *
 *   npm run migrate:vendor-invite-credentials                          ← ΞΗΡΟ τρέξιμο (προεπιλογή): αναφορά
 *   npm run migrate:vendor-invite-credentials -- --apply               ← EXPAND: γράφει τα διαπιστευτήρια `legacy`,
 *                                                                        το `token` ΜΕΝΕΙ (ο παλιός κώδικας δουλεύει)
 *   npm run migrate:vendor-invite-credentials -- --apply --contract    ← EXPAND + CONTRACT: σβήνει `token`,
 *                                                                        `'expired'` → `'revoked'`
 *
 * 🔑 **EXPAND/CONTRACT — μηδέν διακοπή** (ADR-876 §5.4): expand ΠΡΙΝ από το push (οι παλιοί σύνδεσμοι
 * ανοίγουν και με τον νέο κώδικα από την πρώτη στιγμή) · push · expand + contract ΜΕΤΑ το push (πιάνει
 * προσκλήσεις που γέννησε ο παλιός κώδικας στο μεταξύ). Το contract ΔΕΝ τρέχει πριν το push: ο παλιός
 * κώδικας δεν ξέρει το `'revoked'` και θα άνοιγε ανακλημένη πρόσκληση.
 *
 * Η απόφαση ανά έγγραφο ζει στον καθαρό σχεδιαστή `vendor-invite-credential-migration.ts` (jest).
 * Εδώ μόνο I/O: ανάγνωση `vendor_invites` + λίστας ανάκλησης, batch εγγραφές (≤ 400 πράξεις),
 * και η **μέγιστη λήξη ζωντανού παλιού συνδέσμου** — η ημερομηνία της Φ7 (απόσυρση legacy).
 *
 * ⚠️ Ιδεμποτικό: ντετερμινιστικό ID · το expand γράφει ΜΟΝΟ διαπιστευτήρια που λείπουν (ποτέ δεν ξαναγράφει
 *    ανάκληση/χρήση) · το contract σβήνει το `token` ⇒ δεύτερο τρέξιμο = noop.
 * ⚠️ Χρειάζεται το ΙΔΙΟ `VENDOR_PORTAL_SECRET` με την παραγωγή (αλλιώς όλα βγαίνουν «μη επαληθεύσιμα»).
 */

import { FieldValue, type Firestore, type WriteBatch } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { requireTokenSecret } from '@/lib/tokens/signed-token';
import { VENDOR_PORTAL_SECRET_ENV } from '@/services/vendor-portal/vendor-invite-credential';
import {
  planLegacyInvite,
  summarizeMigration,
  type LegacyInvitePlan,
  type LegacyInviteRecord,
} from '@/services/vendor-portal/vendor-invite-credential-migration';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά).
applyEnvLocal();

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--apply');
const CONTRACT = ARGS.includes('--contract');
const BATCH_LIMIT = 400;

interface PlannedInvite {
  readonly id: string;
  readonly plan: LegacyInvitePlan;
}

function isoOf(value: unknown): string | null {
  const candidate = value as { toDate?: () => Date } | null;
  return candidate?.toDate ? candidate.toDate().toISOString() : null;
}

async function revokedNonces(db: Firestore): Promise<ReadonlySet<string>> {
  const snap = await db.collection(COLLECTIONS.VENDOR_INVITE_TOKENS).where('revoked', '==', true).get();
  return new Set(snap.docs.map((d) => d.id));
}

async function planAll(db: Firestore, nowIso: string): Promise<PlannedInvite[]> {
  const ctx = { secret: requireTokenSecret(VENDOR_PORTAL_SECRET_ENV), nowIso, revokedNonces: await revokedNonces(db) };
  const snap = await db.collection(COLLECTIONS.VENDOR_INVITES).get();
  return Promise.all(
    snap.docs.map(async (doc) => {
      const data = doc.data();
      const record: LegacyInviteRecord = {
        id: doc.id,
        rfqId: String(data.rfqId ?? ''),
        companyId: String(data.companyId ?? ''),
        status: String(data.status ?? ''),
        token: data.token,
        createdAtIso: isoOf(data.createdAt),
      };
      return { id: doc.id, plan: await planLegacyInvite(record, ctx) };
    }),
  );
}

function inviteUpdate(plan: Exclude<LegacyInvitePlan, { kind: 'noop' }>): Record<string, unknown> {
  const revoke = plan.kind === 'status_only' || plan.revoke;
  return {
    token: FieldValue.delete(),
    ...(revoke ? { status: 'revoked' } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Ποια διαπιστευτήρια **υπάρχουν ήδη**. 🔴 Το expand γράφει ΜΟΝΟ ό,τι λείπει: δεύτερο τρέξιμο μετά το push
 * με `set` θα ξανάγραφε διαπιστευτήριο που ο PM στο μεταξύ ανακάλεσε ή που χρησιμοποιήθηκε — δηλαδή θα
 * **ξεανακαλούσε** σύνδεσμο.
 */
async function existingCredentialIds(db: Firestore, pending: readonly PlannedInvite[]): Promise<ReadonlySet<string>> {
  const refs = pending.flatMap(({ plan }) =>
    plan.kind === 'migrate' ? [db.collection(COLLECTIONS.VENDOR_INVITE_CREDENTIALS).doc(plan.credential.id)] : [],
  );
  const snaps = refs.length > 0 ? await db.getAll(...refs) : [];
  return new Set(snaps.filter((snap) => snap.exists).map((snap) => snap.id));
}

type Operation = (batch: WriteBatch, db: Firestore) => void;

/** Κάθε πράξη που θα εκτελεστεί — expand (διαπιστευτήρια που λείπουν) και, αν ζητηθεί, contract (πρόσκληση). */
function operations(pending: readonly PlannedInvite[], existing: ReadonlySet<string>, contract: boolean): Operation[] {
  return pending.flatMap(({ id, plan }) => {
    if (plan.kind === 'noop') return [];
    const ops: Operation[] = [];
    if (plan.kind === 'migrate' && !existing.has(plan.credential.id)) {
      const { credential } = plan;
      ops.push((batch, db) => batch.set(db.collection(COLLECTIONS.VENDOR_INVITE_CREDENTIALS).doc(credential.id), credential));
    }
    if (contract) ops.push((batch, db) => batch.update(db.collection(COLLECTIONS.VENDOR_INVITES).doc(id), inviteUpdate(plan)));
    return ops;
  });
}

async function apply(db: Firestore, pending: readonly PlannedInvite[], contract: boolean): Promise<number> {
  const ops = operations(pending, await existingCredentialIds(db, pending), contract);
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + BATCH_LIMIT)) op(batch, db);
    await batch.commit();
  }
  return ops.length;
}

/** Επανεπαλήθευση: expand ⇒ κάθε διαπιστευτήριο υπάρχει · contract ⇒ κανένα έγγραφο δεν εκκρεμεί. */
async function residue(db: Firestore, contract: boolean): Promise<number> {
  const again = await planAll(db, new Date().toISOString());
  if (contract) return again.filter((p) => p.plan.kind !== 'noop').length;
  const existing = await existingCredentialIds(db, again);
  return again.filter((p) => p.plan.kind === 'migrate' && !existing.has(p.plan.credential.id)).length;
}

async function main(): Promise<void> {
  const db = getAdminFirestore();
  const nowIso = new Date().toISOString();
  const planned = await planAll(db, nowIso);
  const report = summarizeMigration(planned.map((p) => p.plan), nowIso);
  const pending = planned.filter((p) => p.plan.kind !== 'noop');

  console.log(`🔎 Προσκλήσεις: ${report.total} · προς διαπιστευτήριο: ${report.migrate} · μόνο κατάσταση: ${report.statusOnly} · μη επαληθεύσιμα token (σβήνονται στο contract): ${report.stripped} · ήδη καθαρές: ${report.noop}`);
  console.log(`📅 Μέγιστη λήξη ζωντανού παλιού συνδέσμου (ημερομηνία Φ7): ${report.maxLiveLegacyExpiry ?? '— κανένας'}`);

  if (!APPLY) {
    console.log(pending.length === 0 ? '✅ Απόκλιση 0.' : '⚠️  Ξηρό τρέξιμο. `-- --apply` = expand · `-- --apply --contract` = expand + contract.');
    process.exit(pending.length === 0 ? 0 : 1);
  }

  const written = await apply(db, pending, CONTRACT);
  const left = await residue(db, CONTRACT);
  const phase = CONTRACT ? 'expand + contract' : 'expand';
  console.log(left === 0 ? `✍️  ${phase}: ${written} πράξεις. ✅ Απόκλιση 0.` : `❌ ${phase}: απομένουν ${left}.`);
  process.exit(left === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('❌ Η μετανάστευση απέτυχε:', error);
  process.exit(1);
});
