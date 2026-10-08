import 'server-only';

/**
 * @fileoverview **Η ΔΗΜΟΣΙΕΥΣΗ ΕΙΝΑΙ Η ΟΝΟΜΑΣΤΙΚΗ ΔΗΛΩΣΗ** — η παραγόμενη κάτοψη μπαίνει στο `publishedFloorplans` (ADR-909 Α8).
 * @related app/api/properties/[id]/floorplan (ο καλών) · services/iso19650/succession-inheritance (η μεταφορά στη διαδοχή)
 * @module services/listings/floorplan-declaration.service
 *
 * Ο επιλογέας υλικού ζητά από κάθε κάτοψη **και** `classification: 'public'` **και** ονομαστική δήλωση
 * στο έγγραφο του ακινήτου *(ADR-841 Α17.7 — δεν χαλαρώνει)*. Στον διάλογο «Δημοσίευση κάτοψης» ο
 * άνθρωπος **έχει ήδη** ονομάσει το ακίνητο· δεύτερο κλικ σε άλλη οθόνη θα ήταν η ίδια πράξη δύο φορές.
 *
 * | περίπτωση | ποιος γράφει τη δήλωση |
 * |---|---|
 * | παραγόμενη **διαδέχεται** δηλωμένη παραγόμενη | ο `transitionContainer('supersede')` — **ήδη**, στην ίδια συναλλαγή με την αρχειοθέτηση |
 * | **πρώτη** παραγόμενη του επιπέδου, ή ο προκάτοχος είχε ξε-δηλωθεί | **εδώ** |
 *
 * 🔑 **Ιδεμποτικό**: ήδη δηλωμένη ⇒ καμία γραφή, καμία γραμμή ιστορικού. Γι' αυτό καλείται **πάντα**
 * μετά τη διαδοχή, χωρίς να ρωτά τι έκανε εκείνη.
 *
 * ⛔ **Δεν πετά ποτέ**: το αρχείο έχει ήδη ανέβει. Αποτυχία εδώ σημαίνει *«ανέβηκε, δεν δηλώθηκε»* —
 * επιστρέφεται με όνομα, και ο άνθρωπος τη δηλώνει από την καρτέλα «Κάτοψη».
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { versionedWrite } from '@/lib/firestore/version-check';
import { declaredFileIds, type DeclaredFileIds } from '@/lib/listings/declared-file-ids';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { EntityAuditService } from '@/services/entity-audit.service';
import { PUBLISHED_MEDIA_LIMIT } from '@/services/upload/utils/storage-path-public-shelf';

const logger = createModuleLogger('FloorplanDeclaration');

/** Το πεδίο της δήλωσης — μέλος της κλειστής λίστας `AGENCY_DECLARATION_FIELDS`. */
const DECLARATION_FIELD = 'publishedFloorplans';

/**
 * - `declared` — γράφτηκε τώρα
 * - `already` — ήταν ήδη δηλωμένη *(η διαδοχή τη μετέφερε, ή δεύτερη κλήση)*
 * - `full` — το ράφι δεν χωρά άλλη κάτοψη· τίποτα δεν γράφτηκε
 * - `failed` — το ακίνητο δεν διαβάστηκε ή η συναλλαγή απέτυχε
 */
export type FloorplanDeclarationOutcome = 'declared' | 'already' | 'full' | 'failed';

interface FloorplanDeclarationRequest {
  readonly propertyId: string;
  readonly companyId: string;
  readonly fileId: string;
  readonly performedBy: string;
}

/**
 * **Χωρά η νέα κάτοψη στη δήλωση;** — καθαρό, ώστε η πόρτα να το ρωτήσει **πριν** γράψει οτιδήποτε.
 *
 * 🔑 Προκάτοχος που είναι **ήδη** δηλωμένος δίνει τη θέση του στον διάδοχο *(η διαδοχή αλλάζει το id
 * επί τόπου)* ⇒ δεν χρειάζεται νέα θέση. Κάθε άλλη περίπτωση θέλει μία ελεύθερη.
 */
export function floorplanDeclarationHasRoom(
  declared: DeclaredFileIds,
  supersedes: readonly string[],
): boolean {
  if (supersedes.some((id) => declared.includes(id))) return true;
  return declared.length < PUBLISHED_MEDIA_LIMIT;
}

/** Η δήλωση όπως είναι **αποθηκευμένη** στο ακίνητο — ό,τι δεν διαβάζεται είναι «καμία». */
export function declaredFloorplansOf(property: Readonly<Record<string, unknown>>): DeclaredFileIds {
  return declaredFileIds(property[DECLARATION_FIELD]);
}

interface Written {
  readonly propertyName: string | null;
  readonly before: DeclaredFileIds;
  readonly after: DeclaredFileIds;
}

/** Η συναλλαγή: ανάγνωση → κρίση → **μία** `update()` με τη σφραγίδα έκδοσης του ακινήτου. */
async function appendDeclaration(
  adminDb: AdminFirestore,
  request: FloorplanDeclarationRequest,
): Promise<Written | Exclude<FloorplanDeclarationOutcome, 'declared'>> {
  const ref = adminDb.collection(COLLECTIONS.PROPERTIES).doc(request.propertyId);

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    // 🔒 Ξένος μισθωτής = ανύπαρκτο — η κηδεμονία ξαναρωτιέται **μέσα** στη συναλλαγή.
    if (data === undefined || !isPayloadOwnedByCompany(data, request.companyId)) return 'failed';
    const property: Record<string, unknown> = data;

    const before = declaredFloorplansOf(property);
    if (before.includes(request.fileId)) return 'already';
    if (before.length >= PUBLISHED_MEDIA_LIMIT) return 'full';

    const after = [...before, request.fileId];
    // ⚠️ Η ΜΙΑ σφραγίδα έκδοσης: browser με παλιά εικόνα της δήλωσης παίρνει σύγκρουση `_v` αντί να την πατήσει.
    transaction.update(ref, versionedWrite(property, { [DECLARATION_FIELD]: after }, request.performedBy).data);
    return { propertyName: typeof property.name === 'string' ? property.name : null, before, after };
  });
}

/** Η γραμμή ιστορικού του **ακινήτου** — μετά το commit, ποτέ μέσα στο σώμα που ξαναεκτελείται. */
function recordDeclaration(request: FloorplanDeclarationRequest, written: Written): Promise<string | null> {
  return EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: request.propertyId,
    entityName: written.propertyName,
    action: 'updated',
    changes: [{ field: DECLARATION_FIELD, oldValue: written.before.join(', '), newValue: written.after.join(', ') }],
    performedBy: request.performedBy,
    performedByName: null,
    companyId: request.companyId,
  });
}

/**
 * **Δήλωσε την παραγόμενη κάτοψη ως υλικό αυτής της αγγελίας.**
 *
 * ⚠️ Καλείται **πριν** από την επαναπροβολή: η αγγελία προβάλλεται με τη δήλωση ήδη γραμμένη.
 */
export async function declarePublishedFloorplan(
  adminDb: AdminFirestore,
  request: FloorplanDeclarationRequest,
): Promise<FloorplanDeclarationOutcome> {
  try {
    const outcome = await appendDeclaration(adminDb, request);
    if (typeof outcome === 'string') {
      if (outcome !== 'already') logger.warn('Η παραγόμενη κάτοψη ανέβηκε αλλά ΔΕΝ δηλώθηκε', { ...request, outcome });
      return outcome;
    }
    safeFireAndForget(recordDeclaration(request, outcome), 'FloorplanDeclaration.audit', { ...request });
    return 'declared';
  } catch (error) {
    logger.error('Η δήλωση της παραγόμενης κάτοψης απέτυχε', { ...request, error: getErrorMessage(error) });
    return 'failed';
  }
}
