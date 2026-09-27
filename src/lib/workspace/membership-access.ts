import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΠΑΥΣΗΣ ΚΑΙ ΤΗΣ ΕΠΑΝΑΦΟΡΑΣ ΠΡΟΣΒΑΣΗΣ** — ADR-892 Φ2β (§12).
 * @related lib/workspace/end-membership (λήξη θητείας) · lib/workspace/grant-membership (είσοδος)
 * @module lib/workspace/membership-access
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΟΧΙ `grantWorkspaceMembership` ΓΙΑ ΤΗΝ ΕΠΑΝΑΦΟΡΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η είσοδος γράφει **νέα** θητεία (`joinedAt`/`enrollment`/`addedBy` από την αρχή). Η παύση δεν έκλεισε
 * θητεία — ο άνθρωπος **έμεινε μέλος** — άρα η επαναφορά είναι μετάβαση `suspended → active` που **κρατά**
 * την προέλευση (Atlassian: «they'll regain their roles and group memberships»).
 *
 * ⛔ **ΔΕΝ ΑΓΓΙΖΕΙ CLAIMS, ΣΥΝΕΔΡΙΕΣ, ΚΑΤΟΧΗ** — ίδιο δόγμα με τον γραφέα τέλους: το σώμα συναλλαγής
 * ξανατρέχει σε σύγκρουση. Τα ορχηστρώνει ο καλών **μετά** το commit (`server/workspace/member-exit`).
 * **Layering**: server — Admin SDK. Καμία κρίση «επιτρέπεται;» εδώ.
 */

import { FieldValue as AdminFieldValue, type Transaction } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { workspaceMemberRef } from '@/lib/workspace/workspace-member-ref';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';

const logger = createModuleLogger('membership-access');

export interface AccessChangeInput {
  readonly uid: string;
  readonly companyId: string;
  /** Ο διαχειριστής — ρητά, ποτέ ολόκληρο `AuthContext`. */
  readonly actorUid: string;
  /** Ελεύθερο κείμενο — `null` όταν δεν δόθηκε. */
  readonly reason: string | null;
}

/** **Παύση, ΜΕΣΑ σε συναλλαγή.** `merge: true` — ρόλος και προέλευση μένουν ανέγγιχτα. */
export function pauseWorkspaceAccessInTx(tx: Transaction, input: AccessChangeInput): void {
  tx.set(workspaceMemberRef(getAdminFirestore(), input.companyId, input.uid), accessPauseDocument(input), {
    merge: true,
  });
}

/**
 * **Επαναφορά, ΜΕΣΑ σε συναλλαγή.** Μόνο `status` + σβήσιμο του `accessPause`: το «ποιος/γιατί έγινε η
 * παύση» ζει από εδώ και πέρα **μόνο** στο ίχνος — αλλιώς ενεργό μέλος θα έφερε «σε παύση από Χ».
 */
export function restoreWorkspaceAccessInTx(tx: Transaction, input: AccessChangeInput): void {
  tx.set(workspaceMemberRef(getAdminFirestore(), input.companyId, input.uid), accessRestoreDocument(), {
    merge: true,
  });
}

/** Τα πεδία της παύσης — εξάγεται για την άγκυρα σχήματος (γραφέας ↔ `normalizeMembership`). */
export function accessPauseDocument(input: AccessChangeInput): Record<string, unknown> {
  return {
    status: 'suspended',
    accessPause: {
      pausedByUid: input.actorUid,
      reason: input.reason,
      pausedAt: AdminFieldValue.serverTimestamp(),
    },
    updatedAt: AdminFieldValue.serverTimestamp(),
  };
}

/** Τα πεδία της επαναφοράς — **κανένα** πεδίο προέλευσης (`joinedAt`/`enrollment`/`addedBy`/ρόλος). */
export function accessRestoreDocument(): Record<string, unknown> {
  return {
    status: 'active',
    accessPause: AdminFieldValue.delete(),
    updatedAt: AdminFieldValue.serverTimestamp(),
  };
}

/**
 * **Το ίχνος** — ίδια οντότητα με την είσοδο/έξοδο (ο **χώρος** άλλαξε), πεδίο `memberAccess`
 * (`active ↔ suspended`). ⚠️ Ποτέ μπλοκάρον, ποτέ μέσα σε συναλλαγή: η μετάβαση **έχει ήδη** γίνει.
 */
export async function recordAccessChangeAudit(
  input: AccessChangeInput & { readonly direction: 'pause' | 'restore'; readonly actorName: string | null },
): Promise<void> {
  const [oldValue, newValue] = input.direction === 'pause' ? ['active', 'suspended'] : ['suspended', 'active'];
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.COMPANY,
    entityId: input.companyId,
    entityName: null,
    action: 'updated',
    changes: [{ field: 'memberAccess', oldValue: `${input.uid}:${oldValue}`, newValue: `${input.uid}:${newValue}` }],
    performedBy: input.actorUid,
    performedByName: input.actorName,
    companyId: input.companyId,
  }).catch((error: unknown) => {
    logger.warn('Το ίχνος αλλαγής πρόσβασης απέτυχε (μη μπλοκάρον)', { error: getErrorMessage(error) });
  });
}
