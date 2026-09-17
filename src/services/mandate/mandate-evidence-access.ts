/**
 * @fileoverview **ΠΟΙΟΣ ΚΑΤΕΒΑΖΕΙ ΕΝΑ ΠΑΓΩΜΕΝΟ ΑΠΟΔΕΙΚΤΙΚΟ** — ο ένας κριτής, δύο διαδρομές (ADR-864 §19 · Α33-Α34).
 * @related lib/mandate/mandate-evidence.ts · services/mandate/private-marketing-actor.ts ·
 *   app/api/owner-properties/[ownerPropertyId]/mandate-evidence/[evidenceId]/route.ts ·
 *   app/api/mandate/[token]/evidence/[evidenceId]/route.ts
 * @module services/mandate/mandate-evidence-access
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΕΞΟΥΣΙΟΔΟΤΗΣΗ ΕΙΝΑΙ «ΕΙΣΑΙ ΜΕΡΟΣ ΑΥΤΗΣ ΤΗΣ ΕΝΤΟΛΗΣ;» — ΟΧΙ «ΕΙΝΑΙ ΤΟΥ ΣΠΙΤΙΟΥ ΣΟΥ;»
 * ────────────────────────────────────────────────────────────────────────────
 * Το αποδεικτικό ανήκει στη **σχέση**: ο ιδιοκτήτης (σύνδεσμος ή λογαριασμός) βλέπει κάθε αποδεικτικό των
 * **δικών του** εντολών· το γραφείο **μόνο** των δικών του. Η εύρεση είναι η **ίδια** με τις πράξεις
 * (`mandatesPartyTo`) — χωρίς φίλτρο ισχύος, γιατί την απόδειξη τη χρειάζεσαι **ακριβώς** όταν η εντολή λήξει.
 *
 * ⛔ **Η διαδρομή έρχεται ΑΠΟ ΤΗ ΒΑΣΗ**, ποτέ από το σύρμα· το σύρμα φέρνει μόνο `evidenceId`. Και ο κριτής
 * θεματοφυλακής ρωτιέται **κι αυτός**: διαδρομή εκτός `mandate-evidence/` (π.χ. χειροποίητο έγγραφο) ⇒ άρνηση.
 *
 * ⚠️ **Ανύπαρκτο = ξένο** (`absent`): αλλιώς η λήψη γίνεται μαντείο ύπαρξης αποδεικτικών άλλων.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { MANDATE_EVIDENCE_ROOT, evidencesOfMandate } from '@/lib/mandate/mandate-evidence';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { signedDownloadUrl } from '@/lib/storage/signed-download-url';
import { storagePathCustody } from '@/lib/storage/storage-path-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { auditActorOf, mandatesPartyTo, type ConsentActor } from '@/services/mandate/private-marketing-actor';
import { recordOwnerPropertyEvidenceAccess } from '@/services/owner-property/owner-property-audit';
import type { OwnerProperty } from '@/types/owner-property';
import type { AttestationEvidence } from '@/types/owner-property-mandate';

const logger = createModuleLogger('mandate-evidence-access');

/** **Ποιο αποδεικτικό δικαιούται αυτός ο δρων** — `null` = κανένα (ανύπαρκτο ή ξένο, το ίδιο). */
export function evidenceVisibleTo(property: OwnerProperty, who: ConsentActor, evidenceId: string): AttestationEvidence | null {
  const evidence = mandatesPartyTo(property, who)
    .flatMap(evidencesOfMandate)
    .find((candidate) => candidate.id === evidenceId);
  if (evidence === undefined) return null;
  const custody = storagePathCustody(evidence.path);
  return custody.kind === 'server-only' && custody.root === MANDATE_EVIDENCE_ROOT ? evidence : null;
}

export type EvidenceDownload =
  | { readonly kind: 'signed'; readonly url: string }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed' };

/** Κρίνε → υπόγραψε (15′, `attachment` με το ανθρώπινο όνομα) → κατέγραψε το άνοιγμα (Α34). */
export async function openMandateEvidence(
  adminDb: AdminFirestore,
  input: {
    readonly ownerPropertyId: string;
    /** Ο σύνδεσμος ξέρει τον δρώντα από πριν· ο λογαριασμός τον μαθαίνει **από την καταχώρηση** (`consentActorOfProperty`). */
    readonly who: ConsentActor | ((property: OwnerProperty) => ConsentActor);
    readonly evidenceId: string;
  },
): Promise<EvidenceDownload> {
  const snapshot = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(input.ownerPropertyId).get();
  const property = ownerPropertyFromDocument(snapshot.data(), input.ownerPropertyId);
  if (property === null) return { kind: 'absent' };
  const who = typeof input.who === 'function' ? input.who(property) : input.who;
  const evidence = evidenceVisibleTo(property, who, input.evidenceId.trim());
  if (evidence === null) return { kind: 'absent' };

  try {
    const signed = await signedDownloadUrl({ storagePath: evidence.path, downloadFileName: evidence.fileName });
    if (signed.outcome !== 'signed') return { kind: 'failed' };
    await recordOwnerPropertyEvidenceAccess(property, auditActorOf(who), evidence);
    return { kind: 'signed', url: signed.url };
  } catch (error) {
    logger.error('Το αποδεικτικό δεν υπογράφηκε για λήψη', {
      data: { ownerPropertyId: input.ownerPropertyId, evidenceId: evidence.id },
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}
