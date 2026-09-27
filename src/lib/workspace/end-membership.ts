import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ ΤΕΛΟΥΣ ΘΗΤΕΙΑΣ** — ADR-892 §3.2. Κατοπτρικός του `grant-membership.ts`.
 * @related lib/workspace/grant-membership (ο γραφέας εισόδου) · lib/workspace/member-exit-policy (η κρίση)
 * @module lib/workspace/end-membership
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΝΑΣ — ΚΑΙ ΓΙΑΤΙ ΕΔΩ
 * ─────────────────────────────────────────────────────────────────────────────
 * Αφαίρεση (διαχειριστής) και αποχώρηση (ο ίδιος) είναι η **ίδια** μετάβαση του ίδιου εγγράφου με
 * άλλον δρώντα. Δύο γραφείς θα απέκλιναν στο πρώτο νέο πεδίο (ADR-749) — όπως απέκλιναν οι τέσσερις
 * γραφείς εισόδου πριν τους ενώσει το ADR-853 Μ2.
 *
 * ⛔ **ΤΟ ΕΓΓΡΑΦΟ ΔΕΝ ΣΒΗΝΕΤΑΙ — ΠΟΤΕ.** Κλείνει η θητεία: ρόλος, `joinedAt`, `enrollment`, `addedBy`
 * **μένουν** — είναι το «ποιος ήταν μέλος, πότε, με ποιανού την πράξη» ενός ελέγχου πρόσβασης
 * (ISO 27001 A.5.18) και η πρώτη ύλη της επαναφοράς 90 ημερών (§3.5, GitHub).
 *
 * ⛔ **ΔΕΝ ΑΓΓΙΖΕΙ CLAIMS, ΣΥΝΕΔΡΙΕΣ, ΚΑΤΟΧΗ.** Όπως ο γραφέας εισόδου: αυτά είναι παρενέργειες με άμεσο
 * αποτέλεσμα, και το σώμα μιας συναλλαγής **ξανατρέχει** σε σύγκρουση (μετρημένο στην άγκυρα Τ3 του
 * `grant-membership`). Τα ορχηστρώνει ο καλών **μετά** το commit (`server/workspace/member-exit`).
 *
 * **Layering**: server — Admin SDK. Καμία κρίση «επιτρέπεται;» εδώ (ADR-801 στο σύνορο +
 * `judgeMemberExit` για τις αναλλοίωτες δεδομένων).
 */

import { FieldValue as AdminFieldValue, type Transaction } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { workspaceMemberRef } from '@/lib/workspace/workspace-member-ref';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { EndedMembershipStatus } from '@/types/workspace-membership';

const logger = createModuleLogger('end-membership');

/** Ό,τι χρειάζεται το τέλος θητείας — ο δρων **ρητά**, ποτέ ολόκληρο `AuthContext` (ίδιο ιδίωμα με την είσοδο). */
export interface EndMembershipInput {
  readonly uid: string;
  readonly companyId: string;
  /** `removed` (διαχειριστής) · `left` (ο ίδιος). */
  readonly ending: EndedMembershipStatus;
  readonly endedByUid: string;
  /** Ελεύθερο κείμενο — `null` όταν δεν δόθηκε. */
  readonly reason: string | null;
}

/**
 * **Η γραφή, ΜΕΣΑ σε συναλλαγή.** Καμία ανάγνωση (το Firestore θέλει όλες τις αναγνώσεις **πριν** από
 * κάθε γραφή — ο καλών διάβασε ήδη τη θέση για να την κρίνει) και καμία παρενέργεια (δες κεφαλίδα).
 *
 * 🔑 **`merge: true`** — γράφονται **μόνο** τα πεδία του τέλους· η προέλευση της θητείας μένει ανέγγιχτη.
 */
export function endWorkspaceMembershipInTx(tx: Transaction, input: EndMembershipInput): void {
  tx.set(workspaceMemberRef(getAdminFirestore(), input.companyId, input.uid), tenureEndDocument(input), {
    merge: true,
  });
}

/** Τα πεδία του τέλους — εξάγεται για την άγκυρα σχήματος (ένα σχήμα, δύο σημεία ανάγνωσης: γραφέας + μετάφραση). */
export function tenureEndDocument(input: EndMembershipInput): Record<string, unknown> {
  return {
    status: input.ending,
    tenureEnd: {
      endedByUid: input.endedByUid,
      reason: input.reason,
      endedAt: AdminFieldValue.serverTimestamp(),
    },
    updatedAt: AdminFieldValue.serverTimestamp(),
  };
}

/**
 * **Το ίχνος** — κατοπτρικό του `recordMembershipGrantAudit`: ίδια οντότητα (ο **χώρος** άλλαξε),
 * ίδιο πεδίο `members`, αντίστροφη κατεύθυνση (`uid → null`).
 *
 * ⚠️ Ποτέ μπλοκάρον, ποτέ μέσα σε συναλλαγή: η θητεία **έχει ήδη** κλείσει.
 */
export async function recordMembershipEndAudit(
  input: EndMembershipInput & { readonly endedByName: string | null },
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: input.companyId,
    entityName: null,
    action: 'updated',
    changes: [{ field: 'members', oldValue: input.uid, newValue: null }],
    performedBy: input.endedByUid,
    performedByName: input.endedByName,
    companyId: input.companyId,
  }).catch((error: unknown) => {
    logger.warn('Το ίχνος τέλους θητείας απέτυχε (μη μπλοκάρον)', { error: getErrorMessage(error) });
  });
}
