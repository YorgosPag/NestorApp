import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΔΗΛΩΣΗΣ ΟΡΟΦΟΥ** — υπογραφή και άρση (ADR-907 §11.7).
 * @related lib/listings/floor-plate/floor-plate-declaration (το πεδίο) · ./floor-plate.reader (η κρίση) · ./floorplan-declaration.service (το πρότυπο)
 * @module services/listings/floor-plate-declaration.service
 *
 * «Διαχειρίζομαι όλες τις μονάδες αυτού του ορόφου — δημοσίευση κάτοψης ορόφου»: **ποιος, πότε, στο ιστορικό**.
 *
 * 🔴 **Η ΚΡΙΣΗ ΤΡΕΧΕΙ ΠΡΙΝ ΑΠΟ ΤΗΝ ΥΠΟΓΡΑΦΗ, ΜΕ ΤΟΝ ΙΔΙΟ ΑΝΑΓΝΩΣΤΗ ΠΟΥ ΘΑ ΤΡΕΞΕΙ ΜΕΤΑ.** Δήλωση που ο αναγνώστης θα
 * αρνιόταν σιωπηλά σε κάθε επαναπροβολή θα ήταν υπογραφή χωρίς αποτέλεσμα — και ο άνθρωπος δεν θα μάθαινε ποτέ γιατί.
 * Εδώ η άρνηση επιστρέφεται **με όνομα και με το περίγραμμα που φταίει**, και τίποτα δεν γράφεται.
 *
 * ⚠️ Η κρίση **δεν** είναι εγγύηση διαρκείας: περίγραμμα που θα σχεδιαστεί αύριο άδετο θα κλείσει ξανά τον όροφο στην
 * επόμενη επαναπροβολή (όλα ή τίποτα). Η δήλωση μένει· η κάτοψη αποσύρεται ώσπου να διορθωθεί.
 *
 * ⛔ **Δεν πετά ποτέ** — η έκβαση επιστρέφεται. Η επαναπροβολή των αγγελιών του ορόφου είναι δουλειά της **πόρτας**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { versionedWrite } from '@/lib/firestore/version-check';
import {
  FLOOR_PLATE_DECLARATION_FIELD,
  readFloorPlateDeclaration,
  type FloorPlateDeclaration,
  type FloorPlateRefusal,
} from '@/lib/listings/floor-plate/floor-plate-declaration';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { EntityAuditService } from '@/services/entity-audit.service';

import {
  firstLinkedUnitOf,
  floorPlateSourceOf,
  readFloorPlateEvidence,
} from './floor-plate.reader';

const logger = createModuleLogger('FloorPlateDeclaration');

interface FloorPlateActor {
  readonly floorId: string;
  readonly companyId: string;
  readonly performedBy: string;
}

interface FloorPlateDeclarationRequest extends FloorPlateActor {
  readonly fileId: string;
}

/**
 * - `declared` · `withdrawn` — γράφτηκε τώρα
 * - `already` — η ίδια εικόνα ήταν ήδη υπογεγραμμένη· `absent` — δεν υπήρχε δήλωση να αρθεί (καμία γραφή, καμία γραμμή)
 * - `refused` — η κρίση αρνήθηκε· τίποτα δεν γράφτηκε
 * - `failed` — ο όροφος δεν διαβάστηκε ή η συναλλαγή απέτυχε
 */
export type FloorPlateDeclarationOutcome =
  | { readonly state: 'declared' | 'already'; readonly declaration: FloorPlateDeclaration }
  | { readonly state: 'withdrawn' | 'absent' | 'failed' }
  | { readonly state: 'refused'; readonly why: FloorPlateRefusal; readonly overlayId: string | null };

interface Written {
  readonly floorName: string | null;
  readonly before: FloorPlateDeclaration | null;
  readonly after: FloorPlateDeclaration | null;
}

/**
 * Η συναλλαγή: ανάγνωση → κηδεμονία → **μία** `update()` με τη σφραγίδα έκδοσης του ορόφου.
 *
 * @param next — τι δήλωση ζητείται, δεδομένης της τωρινής· `'keep'` ⇒ καμία γραφή.
 */
async function writeDeclaration(
  adminDb: AdminFirestore,
  actor: FloorPlateActor,
  next: (current: FloorPlateDeclaration | null) => FloorPlateDeclaration | null | 'keep',
): Promise<Written | 'kept' | 'failed'> {
  const ref = adminDb.collection(COLLECTIONS.FLOORS).doc(actor.floorId);

  return adminDb.runTransaction(async (transaction) => {
    const data = (await transaction.get(ref)).data();
    // 🔒 Ξένος μισθωτής = ανύπαρκτο — η κηδεμονία ξαναρωτιέται **μέσα** στη συναλλαγή.
    if (data === undefined || !isPayloadOwnedByCompany(data, actor.companyId)) return 'failed';
    const floor: Record<string, unknown> = data;

    const before = readFloorPlateDeclaration(floor);
    const after = next(before);
    if (after === 'keep') return 'kept';

    transaction.update(ref, versionedWrite(floor, { [FLOOR_PLATE_DECLARATION_FIELD]: after }, actor.performedBy).data);
    return { floorName: typeof floor.name === 'string' ? floor.name : null, before, after };
  });
}

/** Η γραμμή ιστορικού του **ορόφου** (ADR-195) — μετά το commit, ποτέ μέσα στο σώμα που ξαναεκτελείται. */
function recordDeclaration(actor: FloorPlateActor, written: Written): void {
  const audit = EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.FLOOR,
    entityId: actor.floorId,
    entityName: written.floorName,
    action: 'updated',
    changes: [{
      field: FLOOR_PLATE_DECLARATION_FIELD,
      oldValue: written.before?.fileId ?? null,
      newValue: written.after?.fileId ?? null,
    }],
    performedBy: actor.performedBy,
    performedByName: null,
    companyId: actor.companyId,
  });
  safeFireAndForget(audit, 'FloorPlateDeclaration.audit', { ...actor });
}

/** Θα έβγαινε αυτός ο όροφος στο κοινό με αυτή την εικόνα; — η κρίση του αναγνώστη, πριν από κάθε γραφή. */
async function refusalOf(adminDb: AdminFirestore, request: FloorPlateDeclarationRequest) {
  const evidence = await readFloorPlateEvidence(adminDb, request.companyId, request.floorId, request.fileId);
  if (!evidence.ok) return evidence;
  // 🔑 Η πόρτα δεν ρωτά για μία αγγελία· «δική μου» παίζει η πρώτη δεμένη μονάδα, ώστε να τρέξουν **όλοι** οι κανόνες.
  const judged = floorPlateSourceOf(evidence.evidence, firstLinkedUnitOf(evidence.evidence) ?? '');
  return judged.ok ? null : judged;
}

/**
 * **Υπόγραψε τη δήλωση του ορόφου για ΑΥΤΗ την εικόνα.**
 *
 * 🔑 **Ιδεμποτικό**: η ίδια εικόνα ήδη υπογεγραμμένη ⇒ `already`, χωρίς γραφή και χωρίς δεύτερη γραμμή ιστορικού — ο
 * αρχικός υπογράφων και η στιγμή του **μένουν**.
 */
export async function declareFloorPlate(
  adminDb: AdminFirestore,
  request: FloorPlateDeclarationRequest,
): Promise<FloorPlateDeclarationOutcome> {
  try {
    const refusal = await refusalOf(adminDb, request);
    if (refusal !== null) return { state: 'refused', why: refusal.why, overlayId: refusal.overlayId };

    const signed: FloorPlateDeclaration = { fileId: request.fileId, declaredBy: request.performedBy, declaredAt: nowISO() };
    let standing: FloorPlateDeclaration = signed;
    const written = await writeDeclaration(adminDb, request, (current) => {
      if (current?.fileId !== request.fileId) return signed;
      standing = current;
      return 'keep';
    });

    if (written === 'failed') return { state: 'failed' };
    if (written === 'kept') return { state: 'already', declaration: standing };
    recordDeclaration(request, written);
    return { state: 'declared', declaration: signed };
  } catch (error) {
    logger.error('Η δήλωση κάτοψης ορόφου απέτυχε', { ...request, error: getErrorMessage(error) });
    return { state: 'failed' };
  }
}

/** **Άρε τη δήλωση του ορόφου.** Η κάτοψη αποσύρεται από κάθε αγγελία στην επαναπροβολή που ακολουθεί (παράγωγα). */
export async function withdrawFloorPlate(
  adminDb: AdminFirestore,
  actor: FloorPlateActor,
): Promise<FloorPlateDeclarationOutcome> {
  try {
    const written = await writeDeclaration(adminDb, actor, (current) => (current === null ? 'keep' : null));
    if (written === 'failed') return { state: 'failed' };
    if (written === 'kept') return { state: 'absent' };
    recordDeclaration(actor, written);
    return { state: 'withdrawn' };
  } catch (error) {
    logger.error('Η άρση της δήλωσης κάτοψης ορόφου απέτυχε', { ...actor, error: getErrorMessage(error) });
    return { state: 'failed' };
  }
}
