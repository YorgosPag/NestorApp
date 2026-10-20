/**
 * @fileoverview ADR-915 §35 — η **απόφαση** μόνιμης υποχρέωσης ακινήτου: ο ΕΝΑΣ αναγνώστης και ο ΕΝΑΣ γραφέας του
 *   `property_upkeep_declarations` (deny-all — μόνο εδώ).
 * @related upkeep-declaration-schema.ts (σχήμα · ταυτότητα) · lib/document-validity/property-upkeep.ts (η απαίτηση) ·
 *   obligor-designations.server.ts (το ιδίωμα)
 * @module services/document-registry/upkeep-declarations.server
 *
 * 🔑 **Μία απόφαση ανά (χώρος, ακίνητο, είδος)**, ντετερμινιστική ⇒ επιβεβαίωση/εξαίρεση = `set`, «ξανά ρώτα» =
 *    `delete`, καμία διπλή εγγραφή. Χώρος = γραφείο `{ companyId }` ή ιδιώτης χωρίς μεσίτη `{ userId }` (§37).
 * 🔑 **Ξένο ≡ ανύπαρκτο**: έγγραφο άλλου βιβλίου δεν διαβάζεται ποτέ ως απόφαση (`isOwnedByCustody`, ο ΙΔΙΟΣ κριτής
 *    με ιστορικό και αρχεία).
 * 🔑 **Ιστορικό στην καρτέλα του ακινήτου** (ADR-195): η απόφαση, ο λόγος εξαίρεσης **και** τι πρότεινε η εφαρμογή τότε
 *    — το έγγραφο ξαναγράφεται στην επόμενη απόφαση, το ίχνος μένει.
 * ⚠️ Μη αναγνώσιμο έγγραφο ⇒ παραλείπεται **και** αναφέρεται — ποτέ «λείπει» από μαντεψιά.
 * ⚠️ **Κανένας σύνθετος δείκτης**: μία ισότητα (`companyId ==`).
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { STANDING_OBLIGATION_KINDS, type DocumentKind } from '@/config/document-validity/document-validity';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import type { UpkeepDecision, UpkeepExemptionReason, UpkeepProposal } from '@/lib/document-validity/property-upkeep';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyOnly, isOwnedByCustody, type CustodyScope } from '@/lib/workspace/custody-scope';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { RegistryPropertyScope } from './document-registry.types';
import { parseUpkeepDeclaration, upkeepDeclarationIdOf, type StoredUpkeepDeclaration } from './upkeep-declaration-schema';

const logger = createModuleLogger('upkeep-declarations');

/**
 * Τα πεδία του ιστορικού **ενός** είδους (ονόματα στο `common-audit:audit.fields.*`, τιμές στους καταλόγους
 * `document-registry:upkeep.*` — `audit-value-catalogs.ts`). `null` = το είδος δεν είναι μόνιμη υποχρέωση.
 */
export interface UpkeepAuditFields {
  readonly decision: string;
  readonly exemption: string;
  readonly proposal: string;
}

export const UPKEEP_AUDIT_FIELDS: Readonly<Record<DocumentKind, UpkeepAuditFields | null>> = {
  'energy-certificate': null,
  'building-identity': null,
  'tax-clearance': null,
  'insurance-clearance': null,
  'enfia-certificate': null,
  'electrical-installation': {
    decision: 'electricalInstallationStandingObligation',
    exemption: 'electricalInstallationStandingObligationExemption',
    proposal: 'electricalInstallationStandingObligationProposal',
  },
};

function declarationsCollection(db: Firestore) {
  return db.collection(COLLECTIONS.PROPERTY_UPKEEP_DECLARATIONS);
}

export interface UpkeepDeclarationsReading {
  readonly declarations: readonly StoredUpkeepDeclaration[];
  readonly truncated: boolean;
}

/** Ένα έγγραφο → απόφαση **αυτού του βιβλίου**, ή τίποτα. Ξένο ≡ ανύπαρκτο· χαλασμένο ⇒ παραλείπεται **και** αναφέρεται. */
function ownDeclarationsOf(id: string, raw: unknown, owner: CustodyScope): StoredUpkeepDeclaration[] {
  const parsed = parseUpkeepDeclaration(raw);
  if (parsed !== null && isOwnedByCustody(parsed, owner)) return [parsed];
  logger.warn('Μη αναγνώσιμη απόφαση μόνιμης υποχρέωσης — παραλείφθηκε', { declarationId: id });
  return [];
}

/** Όλες οι αποφάσεις του γραφείου (φραγμένα). */
export async function readUpkeepDeclarations(db: Firestore, companyId: string, cap: number): Promise<UpkeepDeclarationsReading> {
  const snapshot = await declarationsCollection(db).where(FIELDS.COMPANY_ID, '==', companyId).limit(cap + 1).get();
  const declarations = snapshot.docs.slice(0, cap).flatMap((doc) => ownDeclarationsOf(doc.id, doc.data(), { companyId }));
  return { declarations, truncated: snapshot.size > cap };
}

/**
 * §36 — οι αποφάσεις **ενός** ακινήτου (καρτέλα ακινήτου): ένα `getAll` στις ντετερμινιστικές ταυτότητες, μία ανά είδος
 * μόνιμης υποχρέωσης. Κανένα ερώτημα, κανένα όριο, κανένας δείκτης. §37: στο βιβλίο του χώρου που το διαχειρίζεται.
 */
export async function readPropertyUpkeepDeclarations(
  db: Firestore,
  owner: CustodyScope,
  propertyId: string,
): Promise<readonly StoredUpkeepDeclaration[]> {
  const refs = STANDING_OBLIGATION_KINDS.map((kind) => declarationsCollection(db).doc(upkeepDeclarationIdOf(owner, propertyId, kind)));
  if (refs.length === 0) return [];
  const snapshots = await db.getAll(...refs);
  return snapshots.flatMap((snapshot) => (snapshot.exists ? ownDeclarationsOf(snapshot.id, snapshot.data(), owner) : []));
}

/** Η νέα απόφαση· `null` = «ξανά ρώτα» (το έγγραφο σβήνεται, η υποχρέωση γυρίζει σε πρόταση). */
export interface UpkeepDecisionInput {
  readonly decision: UpkeepDecision;
  readonly exemptionReason: UpkeepExemptionReason | null;
}

export interface UpkeepDeclarationWrite {
  /** Το βιβλίο — ο χώρος που διαχειρίζεται το ακίνητο (§37). Εκεί και η απόφαση **και** το ιστορικό της. */
  readonly owner: CustodyScope;
  readonly actorUid: string;
  readonly actorName: string | null;
  readonly property: { readonly id: string; readonly scope: RegistryPropertyScope; readonly name: string | null };
  readonly documentKind: DocumentKind;
  readonly next: UpkeepDecisionInput | null;
  /** Η πρόταση **τώρα**, υπολογισμένη από τον διακομιστή — μένει στο έγγραφο και στο ίχνος. */
  readonly proposal: UpkeepProposal;
  readonly nowIso: string;
}

export type UpkeepDeclarationOutcome = 'changed' | 'unchanged';

const sameDecision = (current: StoredUpkeepDeclaration | null, next: UpkeepDecisionInput | null): boolean =>
  current === null || next === null
    ? current === next
    : current.decision === next.decision && current.exemptionReason === next.exemptionReason;

async function recordDeclarationAudit(write: UpkeepDeclarationWrite, previous: StoredUpkeepDeclaration | null): Promise<void> {
  const fields = UPKEEP_AUDIT_FIELDS[write.documentKind];
  if (fields === null) return;
  const { next, property } = write;
  await EntityAuditService.recordChange({
    entityType: property.scope === 'property' ? 'property' : 'owner_property',
    entityId: property.id,
    entityName: property.name,
    action: 'updated',
    changes: [
      { field: fields.decision, oldValue: previous?.decision ?? null, newValue: next?.decision ?? null },
      { field: fields.exemption, oldValue: previous?.exemptionReason ?? null, newValue: next?.exemptionReason ?? null },
      // Η βάση της απόφασης: τι πρότεινε η εφαρμογή **τη στιγμή** που ο άνθρωπος αποφάσισε.
      { field: fields.proposal, oldValue: previous?.proposalAtDecision.verdict ?? null, newValue: next === null ? null : write.proposal.verdict },
    ].filter((change) => change.oldValue !== change.newValue),
    performedBy: write.actorUid,
    performedByName: write.actorName,
    ...custodyOnly(write.owner),
  });
}

function storedOf(write: UpkeepDeclarationWrite, id: string, next: UpkeepDecisionInput): StoredUpkeepDeclaration {
  return {
    id,
    ...custodyOnly(write.owner),
    propertyId: write.property.id,
    scope: write.property.scope,
    documentKind: write.documentKind,
    decision: next.decision,
    exemptionReason: next.decision === 'not-required' ? next.exemptionReason : null,
    proposalAtDecision: write.proposal,
    declaredByUid: write.actorUid,
    declaredAt: write.nowIso,
  };
}

/**
 * Γράφει (ή σβήνει) την απόφαση. Ανάγνωση και εγγραφή στην **ίδια** συναλλαγή: δύο ταυτόχρονες αποφάσεις δεν γράφουν
 * ποτέ λάθος «από» στο ιστορικό. Ίδια απόφαση με την τρέχουσα ⇒ καμία εγγραφή, κανένα ίχνος (ιδεμποτές).
 */
export async function writeUpkeepDeclaration(db: Firestore, write: UpkeepDeclarationWrite): Promise<UpkeepDeclarationOutcome> {
  const ref = declarationsCollection(db).doc(upkeepDeclarationIdOf(write.owner, write.property.id, write.documentKind));
  const outcome = await db.runTransaction(async (tx) => {
    const parsed = parseUpkeepDeclaration((await tx.get(ref)).data());
    const previous = parsed !== null && isOwnedByCustody(parsed, write.owner) ? parsed : null;
    if (sameDecision(previous, write.next)) return { changed: false, previous };
    if (write.next === null) tx.delete(ref);
    else tx.set(ref, storedOf(write, ref.id, write.next));
    return { changed: true, previous };
  });
  if (!outcome.changed) return 'unchanged';
  await recordDeclarationAudit(write, outcome.previous);
  return 'changed';
}
