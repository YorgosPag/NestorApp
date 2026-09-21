import 'server-only';

/**
 * @fileoverview **ΚΑΝΕΝΑ CLAIM ΧΩΡΟΥ ΧΩΡΙΣ ΘΕΣΗ ΣΤΟ ΒΙΒΛΙΟ** — ADR-867 Β9(β) Ε1 · ADR-787 §5.1(στ).
 * @related lib/auth/set-claims-with-mirror (ο ΕΝΑΣ δρόμος προς τα claims, που καλεί εδώ)
 * @related lib/workspace/grant-membership (ο ΕΝΑΣ γραφέας της θέσης)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ 2026-09-21
 * ─────────────────────────────────────────────────────────────────────────────
 * Γραφείο με **5** ανθρώπους που έχουν `companyId` στο token και **2** έγγραφα
 * `workspace_members`. Οι 3 περνούσαν την πόρτα ως `home` (το token αρκεί για το
 * *«ανήκει ο Χ στο W;»*) αλλά **έλειπαν από κάθε κατάλογο** (*«ποιοι ανήκουν στο W;»*):
 * υποψήφιοι ομάδας πράξης, διαχείριση ρόλων, μεταβίβαση αποχώρησης. Στην οθόνη:
 * «Υπεύθυνος: **Μέλος του γραφείου**» αντί για όνομα.
 *
 * Tokens **δεν ρωτιούνται ως λίστα**. Άρα το «ποιοι» μπορεί να το απαντήσει **μόνο** το
 * έγγραφο — και το claim είναι, σε όλους τους μεγάλους, **αντίγραφο** του καταλόγου:
 * GitHub (owner = γραμμή μέλους με `role: admin`) · Figma (admin = μέλος με δικαιώματα) ·
 * Google Workspace (ο χρήστης υπάρχει **πριν** γίνει super admin) · Microsoft Entra (όταν οι
 * ομάδες δεν χωρούν, το token λέει «ρώτα τον κατάλογο») · ACC / BIMcloud (ο διαχειριστής
 * είναι γραμμή στη λίστα μελών).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΔΩ — ΚΑΙ ΟΧΙ ΣΕ ΚΑΘΕ ΚΑΛΟΥΝΤΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Οκτώ** διαδρομές γράφουν claims και **όλες** περνούν από το `setClaimsWithMirror`. Η
 * βλάβη γεννήθηκε ακριβώς επειδή ο κανόνας «γράψε και το έγγραφο» ζούσε **στον καλούντα**:
 * τρεις τον θυμήθηκαν, τέσσερις όχι. Ένας φύλακας **στο στένωμα** κάνει την παράλειψη
 * **αδύνατη** αντί για «κακή πρακτική» — νέα, ένατη διαδρομή κληρονομεί τον κανόνα χωρίς να
 * τον ξέρει.
 *
 * ⚠️ **Η πόρτα (`decideMembership` → `home`) ΔΕΝ αλλάζει** — μένει **0 αναγνώσεις**. Ο φύλακας
 * εγγυάται ότι κάθε token που **γράφεται από σήμερα** έχει θέση· τα **παλαιότερα** tokens τα
 * κλείνει η μετανάστευση `scripts/migrations/backfill-workspace-membership.ts`, που είναι και
 * η **αναφορά απόκλισης** (ξηρό τρέξιμο ⇒ πρέπει να λέει 0).
 *
 * ⛔ **ΜΗΝ τον κάνεις «προειδοποίηση»**. Claim χωρίς θέση είναι άνθρωπος που **μπαίνει** στο
 * γραφείο και **δεν φαίνεται** πουθενά — δηλαδή πρόσβαση που κανένας έλεγχος πρόσβασης δεν
 * μπορεί να δει. Fail-closed, με όνομα.
 *
 * @module lib/auth/claims-seat
 */

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { normalizeMembership } from '@/lib/auth/workspace-membership';
import { workspaceMemberRef } from '@/lib/workspace/workspace-member-ref';
import type { WorkspaceMembership } from '@/types/workspace-membership';

/** Η κρίση — κλειστό σύνολο. Μόνο τα δύο πρώτα επιτρέπουν τη γραφή. */
export type ClaimsSeatVerdict =
  | { readonly kind: 'no-workspace' }
  | { readonly kind: 'seated' }
  | { readonly kind: 'seat-missing'; readonly companyId: string }
  | { readonly kind: 'seat-inactive'; readonly companyId: string }
  | { readonly kind: 'role-mismatch'; readonly companyId: string; readonly claimRole: string; readonly seatRole: string };

/**
 * **Η καθαρή κρίση** — «αντιστοιχεί αυτό το σύνολο claims σε ενεργή θέση;»
 *
 * 🔑 Ο ρόλος ελέγχεται **μόνο** όταν το claim δηλώνει ρόλο: ο απών ρόλος (`null`, ADR-853 §14)
 * είναι νόμιμη κατάσταση και δεν δίνει τίποτα (καμία παράκαμψη στον κριτή).
 */
export function judgeClaimsSeat(
  claims: Readonly<Record<string, unknown>>,
  seat: WorkspaceMembership | null,
): ClaimsSeatVerdict {
  const companyId = claims.companyId;
  if (typeof companyId !== 'string' || companyId === '') return { kind: 'no-workspace' };
  if (seat === null) return { kind: 'seat-missing', companyId };
  if (seat.status !== 'active') return { kind: 'seat-inactive', companyId };

  const claimRole = claims.globalRole;
  if (typeof claimRole === 'string' && claimRole !== seat.globalRole) {
    return { kind: 'role-mismatch', companyId, claimRole, seatRole: seat.globalRole };
  }
  return { kind: 'seated' };
}

/** Η άρνηση — με **όνομα**, ώστε ο καλών και το log να λένε **ποια** παραβίαση. */
export class ClaimsSeatViolation extends Error {
  constructor(
    readonly uid: string,
    readonly verdict: Exclude<ClaimsSeatVerdict, { kind: 'no-workspace' } | { kind: 'seated' }>,
  ) {
    // N.11: server invariant, never rendered — English keeps it out of the i18n surface.
    super(`[CLAIMS-SEAT] ${verdict.kind} for ${uid} in ${verdict.companyId}`);
    this.name = 'ClaimsSeatViolation';
  }
}

/**
 * **Ο φύλακας** — διαβάζει τη θέση (μία ανάγνωση, μόνο όταν τα claims ονομάζουν χώρο) και
 * **πετά** αν δεν αντιστοιχεί. Δεν γράφει τίποτα.
 *
 * ⚠️ Αποτυχία **ανάγνωσης** δεν μεταφράζεται σε «λείπει»: πετά αυτούσια (N.12 — άγνωστο ≠ κενό).
 */
export async function assertClaimsHaveSeat(uid: string, claims: Readonly<Record<string, unknown>>): Promise<void> {
  const companyId = claims.companyId;
  if (typeof companyId !== 'string' || companyId === '') return;

  const snapshot = await workspaceMemberRef(getAdminFirestore(), companyId, uid).get();
  const seat = snapshot.exists ? normalizeMembership(uid, snapshot.data()) : null;
  const verdict = judgeClaimsSeat(claims, seat);
  if (verdict.kind === 'no-workspace' || verdict.kind === 'seated') return;
  throw new ClaimsSeatViolation(uid, verdict);
}
