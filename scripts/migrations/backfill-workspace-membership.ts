#!/usr/bin/env tsx
/**
 * **ΣΥΜΦΙΛΙΩΣΗ CLAIMS ↔ ΘΕΣΕΩΝ ΧΩΡΟΥ** — ADR-867 Β9(β) Ε1 · ADR-787 §5.1(στ).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Μετρημένο 2026-09-21: γραφείο με **5** ανθρώπους με `companyId` στο token και **2** έγγραφα
 * `workspace_members`. Οι 3 περνούσαν την πόρτα ως `home` αλλά **έλειπαν από κάθε κατάλογο**
 * («Υπεύθυνος: Μέλος του γραφείου»). Από σήμερα το `setClaimsWithMirror` **αρνείται** claim
 * χωρίς θέση (`claims-seat.ts`) — αυτό κλείνει τη βρύση. Αυτό το αρχείο σφουγγίζει το πάτωμα:
 * τα claims που γράφτηκαν **πριν**.
 *
 * ⚠️ **Read-repair αδύνατο** (ίδιο σκεπτικό με το `backfill-first-contact-offerer.ts`): ο
 * κατάλογος ρωτά τα **έγγραφα**, άρα ο άνθρωπος χωρίς έγγραφο **δεν επιστρέφεται ποτέ** — δεν
 * υπάρχει στιγμή ανάγνωσης στην οποία θα θεραπευόταν.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔑 Η ΠΗΓΗ ΕΙΝΑΙ ΤΑ CLAIMS — ΟΧΙ Ο ΚΑΘΡΕΦΤΗΣ `users/{uid}.companyId`
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Η διαδρομή που αντικαθιστά (`api/admin/role-management/bootstrap`, ADR-244 — διαγράφηκε)
 * ρωτούσε τον **καθρέφτη**. Αλλά την πρόσβαση τη δίνει το **token** (`home`)· ένας καθρέφτης
 * που αποκλίνει θα άφηνε ακριβώς τους ανθρώπους που **μπαίνουν** χωρίς θέση. Ρωτάμε αυτό που
 * **ανοίγει την πόρτα**.
 *
 * 🔑 **Καμία κρίση εδώ.** Η κρίση είναι ο `judgeClaimsSeat` — ο **ίδιος** που φρουρεί κάθε νέα
 * γραφή claims· η γραφή είναι ο `grantWorkspaceMembership` — ο **ίδιος** γραφέας με την έγκριση
 * και την πρόσκληση (ADR-853 Μ2). Δύο απαντήσεις στο «τι είναι θέση;» είναι η βλάβη του ADR-749.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ ΤΙ ΔΕΝ ΘΕΡΑΠΕΥΕΙ — ΤΟ ΑΝΑΦΕΡΕΙ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * | Κατάσταση | Γιατί όχι αυτόματα |
 * |---|---|
 * | ανενεργή θέση (`suspended`) | κάποιος **αποφάσισε** αναστολή — ένα backfill που την ξανανοίγει ακυρώνει ανάκληση |
 * | ρόλος claim ≠ ρόλος θέσης | ποιος από τους δύο ισχύει είναι **απόφαση ανθρώπου** |
 * | claim χωρίς έγκυρο ρόλο | θέση με **εφευρεμένο** ρόλο θα ήταν ψέμα με υπογραφή |
 * | λογαριασμός **απενεργοποιημένος** | ενεργή θέση για κλειστό λογαριασμό = ανάκληση που αναιρείται |
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΕΚΤΕΛΕΣΗ — ξηρό εξ ορισμού· το ξηρό τρέξιμο ΕΙΝΑΙ η αναφορά απόκλισης (exit 1 αν ≠ 0)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   npm run backfill:workspace-membership
 *   npm run backfill:workspace-membership -- --apply --by=<uid του χειριστή>
 *
 * `--by` είναι **υποχρεωτικό** στη γραφή: το `addedBy` λέει ποιος **άνθρωπος** έκανε τη
 * συμφιλίωση — ποτέ ο ίδιος ο μετανάστης, ποτέ «σύστημα» χωρίς πρόσωπο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-867-network-messaging-core.md Β9(β)
 */

import type { UserRecord } from 'firebase-admin/auth';

import { getAdminAuth, getAdminFirestore } from '@/lib/firebaseAdmin';
import { judgeClaimsSeat, type ClaimsSeatVerdict } from '@/lib/auth/claims-seat';
import { readGlobalRoleClaim } from '@/lib/auth/identity-claims';
import { listActiveWorkspaceMembers, normalizeMembership } from '@/lib/auth/workspace-membership';
import { grantWorkspaceMembership, recordMembershipGrantAudit } from '@/lib/workspace/grant-membership';
import { workspaceMemberRef } from '@/lib/workspace/workspace-member-ref';

import { applyEnvLocal } from '../_shared/loadEnvLocal';

// ⚠️ ΠΡΙΝ από την πρώτη κλήση Admin SDK (αρχικοποιείται οκνηρά) — ίδιο ιδίωμα με το `destination-drift.ts`.
applyEnvLocal();

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OPERATOR = (args.find((a) => a.startsWith('--by=')) ?? '').slice('--by='.length) || null;

/** Τι έγινε σε **έναν** άνθρωπο — ποτέ `void`, ποτέ ισοπέδωση. */
type Outcome =
  | { readonly kind: 'in-sync' }
  | { readonly kind: 'would-seat' | 'seated'; readonly uid: string; readonly companyId: string; readonly role: string }
  | { readonly kind: 'needs-human'; readonly uid: string; readonly reason: string };

// =============================================================================
// 1. Ο ΕΝΑΣ ΑΝΘΡΩΠΟΣ
// =============================================================================

async function reconcile(user: UserRecord): Promise<Outcome> {
  const claims = user.customClaims ?? {};
  const companyId = claims.companyId;
  if (typeof companyId !== 'string' || companyId === '') return { kind: 'in-sync' };

  const snapshot = await workspaceMemberRef(getAdminFirestore(), companyId, user.uid).get();
  const seat = snapshot.exists ? normalizeMembership(user.uid, snapshot.data()) : null;
  const verdict = judgeClaimsSeat(claims, seat);
  if (verdict.kind === 'seated' || verdict.kind === 'no-workspace') return { kind: 'in-sync' };
  if (verdict.kind !== 'seat-missing') return { kind: 'needs-human', uid: user.uid, reason: describe(verdict) };

  const role = readGlobalRoleClaim(claims.globalRole);
  if (role.kind !== 'assigned') return { kind: 'needs-human', uid: user.uid, reason: `role-claim-${role.kind}` };
  if (user.disabled) return { kind: 'needs-human', uid: user.uid, reason: 'account-disabled' };

  const base = { uid: user.uid, companyId, role: role.role } as const;
  if (!APPLY || OPERATOR === null) return { kind: 'would-seat', ...base };
  return seatAndVerify(base.uid, companyId, role.role, OPERATOR);
}

function describe(verdict: ClaimsSeatVerdict): string {
  if (verdict.kind === 'role-mismatch') return `role-mismatch claim=${verdict.claimRole} seat=${verdict.seatRole}`;
  return verdict.kind;
}

/**
 * **Γράφει με τον ΕΝΑ γραφέα — και επαληθεύει από τη διαδρομή του ανθρώπου.**
 *
 * 🏆 Η επαλήθευση δεν ρωτά «έγραψα;» αλλά **«φαίνεται;»**: ξανατρέχει τον **ίδιο** κατάλογο που
 * διαβάζει ο επιλογέας της ομάδας (`listActiveWorkspaceMembers`). Πράσινο «το έγγραφο υπάρχει»
 * δεν αποδεικνύει αυτό που μας νοιάζει — ότι το όνομα **θα εμφανιστεί**.
 */
async function seatAndVerify(uid: string, companyId: string, role: Parameters<typeof grantWorkspaceMembership>[0]['globalRole'], by: string): Promise<Outcome> {
  const input = { uid, companyId, globalRole: role, grantedByUid: by, enrollment: 'backfill' } as const;
  if (!(await grantWorkspaceMembership(input))) return { kind: 'needs-human', uid, reason: 'write-failed' };
  await recordMembershipGrantAudit({ ...input, grantedByName: null });

  const roster = await listActiveWorkspaceMembers(getAdminFirestore(), companyId);
  if (!roster.some((member) => member.uid === uid)) return { kind: 'needs-human', uid, reason: 'written-but-invisible' };
  return { kind: 'seated', uid, companyId, role };
}

// =============================================================================
// 2. Η ΣΑΡΩΣΗ — όλοι οι λογαριασμοί, σελίδα-σελίδα
// =============================================================================

async function* allUsers(): AsyncGenerator<UserRecord> {
  let pageToken: string | undefined;
  do {
    const page = await getAdminAuth().listUsers(1000, pageToken);
    yield* page.users;
    pageToken = page.pageToken;
  } while (pageToken);
}

// =============================================================================
// 3. Η ΑΝΑΦΟΡΑ
// =============================================================================

function report(outcomes: readonly Outcome[]): number {
  const pending = outcomes.filter((o) => o.kind === 'would-seat');
  const seated = outcomes.filter((o) => o.kind === 'seated');
  const human = outcomes.filter((o) => o.kind === 'needs-human');
  const inSync = outcomes.length - pending.length - seated.length - human.length;

  console.log(`[SEAT BACKFILL] ${APPLY ? 'ΓΡΑΦΗ' : 'ΞΗΡΟ'} — λογαριασμοί: ${outcomes.length}, συνεπείς: ${inSync}`);
  for (const o of [...pending, ...seated]) {
    if (o.kind === 'would-seat' || o.kind === 'seated') {
      console.log(`  ${o.kind === 'seated' ? '✅ θέση γράφτηκε' : '➕ θα γραφτεί'}: ${o.uid} → ${o.companyId} (${o.role})`);
    }
  }
  for (const o of human) if (o.kind === 'needs-human') console.log(`  🔴 ΑΠΟΦΑΣΗ ΑΝΘΡΩΠΟΥ: ${o.uid} — ${o.reason}`);
  return pending.length + human.length;
}

async function main(): Promise<void> {
  if (APPLY && OPERATOR === null) {
    console.error('[SEAT BACKFILL] Η γραφή θέλει --by=<uid του χειριστή> (το addedBy δεν μένει ανώνυμο).');
    process.exitCode = 2;
    return;
  }
  const outcomes: Outcome[] = [];
  for await (const user of allUsers()) outcomes.push(await reconcile(user));
  const drift = report(outcomes);
  // 🔑 Το ξηρό τρέξιμο είναι **αναφορά απόκλισης**: ≠ 0 ⇒ exit 1, ώστε να μπορεί να γίνει έλεγχος.
  if (drift > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('[SEAT BACKFILL] απέτυχε', error);
  process.exitCode = 1;
});
