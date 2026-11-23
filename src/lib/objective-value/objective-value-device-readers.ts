/**
 * @fileoverview ADR-949 Α-2 · Α-3 — **ποιο έγγραφο διαβάζεται στη συσκευή, και τι γραμμές δίνει**: από σελίδες με θέσεις
 *   σε γραμμές ουδέτερες ως προς το έγγραφο. Την πρόταση την κάνει το `objective-value-document-reading.ts`.
 * @related `config/objective-value/objective-value-evidence.ts` (τα έγγραφα — ίδια id) · `lib/document-validity/e9-text.ts` ·
 *   `lib/document-validity/enfia-assessment-text.ts` · `lib/document-validity/unit-permit-text.ts` (οι αναγνώστες) ·
 *   `components/objective-value/read-pdf-on-device.ts` (ο καταναλωτής)
 * @module lib/objective-value/objective-value-device-readers
 *
 * 🔑 **Δύο είδη γραμμής, κλειστή ένωση**: `property` (μια γραμμή κτίσματος — Ε9 ή ενότητα Δ του ΕΝΦΙΑ, που είναι
 *    ανατύπωσή του) και `permit` (η πράξη της άδειας). Ο μεταγλωττιστής αναγκάζει πρόταση και οθόνη να απαντήσουν και
 *    στα δύο — καμία γραμμή άδειας με «κενό όροφο».
 * 🔑 **Η τιμή ζώνης του εγγράφου είναι ΤΕΚΜΗΡΙΟ με «ισχύει κατά»**, όχι τιμή: η γραμμή ΕΝΦΙΑ φέρει τιμή + έτος ώστε να
 *    διασταυρωθεί με τον χάρτη· ποτέ δεν προτείνεται ως είσοδος.
 * 🔑 **Κυριότητα και ειδική κατάσταση μόνο όπου η διατύπωση ταυτίζεται** (ΠΟΛ.1237/2014 · ΠΟΛ.1149/1994): βλ.
 *    `objective-value-document-reading.ts`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import {
  E9_EXPROPRIATION_OR_DEMOLITION_CONDITION,
  E9_FULL_OWNERSHIP,
  E9_LISTED_CONDITION,
  E9_UNFINISHED_CONDITION,
  type E9Floor,
} from '@/lib/document-validity/e9-codes';
import { E9_MAX_PAGES, readE9Text, type E9BuildingRow } from '@/lib/document-validity/e9-text';
import { ENFIA_ASSESSMENT_MAX_PAGES, readEnfiaAssessmentText } from '@/lib/document-validity/enfia-assessment-text';
import {
  readUnitPermitText,
  UNIT_PERMIT_MAX_PAGES,
  type UnitPermitActKind,
  type UnitPermitReference,
} from '@/lib/document-validity/unit-permit-text';
import type { PdfPositionedPage } from '@/lib/pdf/pdf-page-text';

import type { LegalEncumbrance, ObjectiveValueForm } from './objective-value-types';

/**
 * Η κυριότητα όπως τη γράφει το έγγραφο: `full` = πλήρης κυριότητα με το ποσοστό της (`null` = αδιάβαστο) · `other` =
 * δικαίωμα που ο υπολογιστής δεν αποτιμά · `unread` = η στήλη δεν διαβάστηκε.
 */
export type ObjectiveValueRowOwnership =
  | { readonly kind: 'full'; readonly pct: number | null }
  | { readonly kind: 'other' }
  | { readonly kind: 'unread' };

/** Η τιμή ζώνης ενός εγγράφου με το έτος του: ο φόρος του έτους Ε υπολογίζεται με τα στοιχεία της 1/1/Ε. */
export interface ObjectiveValueZoneEvidence {
  /** €/τ.μ. */
  readonly price: number;
  readonly year: number;
}

/** Μια γραμμή κτίσματος, ουδέτερη ως προς το έγγραφο: ό,τι χρειάζεται η επιλογή και η πρόταση. */
export interface ObjectiveValuePropertyRow {
  readonly kind: 'property';
  readonly page: number;
  /** `null` = είδος που ο υπολογιστής δεν αποτιμά (επαγγελματική στέγη, ειδικό κτίριο, …). */
  readonly form: ObjectiveValueForm | null;
  /** Όροφος στην κλίμακα της μηχανής (`< 0` υπόγειο · `0` ισόγειο · `1` Α'). */
  readonly floor: number | null;
  readonly area: number | null;
  readonly ownership: ObjectiveValueRowOwnership;
  /** Η ειδική κατάσταση που ταυτίζεται με της μηχανής — `null` = καμία που να αποδεικνύεται. */
  readonly encumbrance: Exclude<LegalEncumbrance, 'none'> | null;
  /** Ειδική συνθήκη που αφορά τον υπολογισμό αλλά δεν ταυτίζεται με κάποια είσοδο ⇒ ο άνθρωπος ελέγχει. */
  readonly conditionToCheck: boolean;
  readonly unfinished: boolean;
  /** Μόνο για να ξεχωρίσει ο άνθρωπος τις γραμμές — ποτέ είσοδος του υπολογιστή. */
  readonly constructionYear: number | null;
  readonly address: string | null;
  /** Μόνο ΕΝΦΙΑ — για διασταύρωση, ποτέ πρόταση. `null` στο Ε9, ή όταν τιμή ή έτος δεν διαβάστηκαν. */
  readonly zoneEvidence: ObjectiveValueZoneEvidence | null;
}

/** Η πράξη της άδειας: τύπος, ημερομηνία και (για ενημέρωση) η αρχική άδεια που αναφέρει. */
export interface ObjectiveValuePermitRow {
  readonly kind: 'permit';
  readonly page: number;
  readonly act: UnitPermitActKind;
  /** `YYYY-MM-DD` — `null` = δεν διαβάστηκε με βεβαιότητα. */
  readonly issuedOn: string | null;
  readonly originalPermit: UnitPermitReference | null;
}

export type ObjectiveValueDocumentRow = ObjectiveValuePropertyRow | ObjectiveValuePermitRow;

interface DeviceReaderSpec {
  readonly maxPages: number;
  /** `null` = το έγγραφο δεν είναι αυτό που διαλέχτηκε. */
  readonly read: (pages: readonly PdfPositionedPage[]) => readonly ObjectiveValueDocumentRow[] | null;
}

/** Κατηγορία Ε9 (στήλη 9, ΠΟΛ.1237/2014) → έντυπο του υπολογιστή. Η μονοκατοικία είναι κατοικία (`objective-value-form-of-type.ts`). */
const E9_FORM_OF_CATEGORY: Readonly<Record<number, ObjectiveValueForm>> = { 1: 'residence', 2: 'residence', 5: 'storage', 6: 'parking' };

/** Όροφος Ε9 → κλίμακα μηχανής: `Υ` ⇒ −1 (κάθε υπόγειο μετρά ίδια, `objective-value-residence.ts`). */
function engineFloorOf(floor: E9Floor | null): number | null {
  if (floor === null) return null;
  return floor.kind === 'basement' ? -1 : floor.number;
}

function ownershipOf(row: E9BuildingRow): ObjectiveValueRowOwnership {
  if (row.rightKind === null) return { kind: 'unread' };
  return row.rightKind === E9_FULL_OWNERSHIP ? { kind: 'full', pct: row.ownershipPct } : { kind: 'other' };
}

/** Γραμμή Πίνακα 1 (Ε9 ή ανατύπωση στο ΕΝΦΙΑ) → γραμμή του υπολογιστή. */
function propertyRowOf(row: E9BuildingRow, zoneEvidence: ObjectiveValueZoneEvidence | null): ObjectiveValuePropertyRow {
  return {
    kind: 'property',
    page: row.page,
    form: E9_FORM_OF_CATEGORY[row.category] ?? null,
    floor: engineFloorOf(row.floor),
    area: row.mainArea,
    ownership: ownershipOf(row),
    encumbrance: row.specialCondition === E9_LISTED_CONDITION ? 'listed' : null,
    conditionToCheck: row.specialCondition === E9_EXPROPRIATION_OR_DEMOLITION_CONDITION,
    unfinished: row.specialCondition === E9_UNFINISHED_CONDITION,
    constructionYear: row.constructionYear,
    address: row.address,
    zoneEvidence,
  };
}

const E9_READER: DeviceReaderSpec = {
  maxPages: E9_MAX_PAGES,
  read: (pages) => {
    const result = readE9Text(pages);
    return result.kind === 'read' ? result.rows.map((row) => propertyRowOf(row, null)) : null;
  },
};

const ENFIA_READER: DeviceReaderSpec = {
  maxPages: ENFIA_ASSESSMENT_MAX_PAGES,
  read: (pages) => {
    const result = readEnfiaAssessmentText(pages);
    if (result.kind !== 'read') return null;
    const { year } = result;
    return result.rows.map((row) =>
      propertyRowOf(row, year === null || row.zonePrice === null ? null : { price: row.zonePrice, year }),
    );
  },
};

const PERMIT_READER: DeviceReaderSpec = {
  maxPages: UNIT_PERMIT_MAX_PAGES,
  read: (pages) => {
    const result = readUnitPermitText(pages);
    if (result.kind !== 'read') return null;
    const { page, kind, issuedOn, originalPermit } = result.act;
    return [{ kind: 'permit', page, act: kind, issuedOn, originalPermit }];
  },
};

/** **Το μητρώο.** Έγγραφο χωρίς γραμμή εδώ = ο οδηγός το δείχνει, αλλά δεν διαβάζεται στη συσκευή (το συμβόλαιο). */
const OBJECTIVE_VALUE_DEVICE_READERS: Readonly<Partial<Record<ObjectiveValueEvidenceDocument, DeviceReaderSpec>>> = {
  'owner-e9': E9_READER,
  'owner-enfia-assessment': ENFIA_READER,
  'unit-permit': PERMIT_READER,
};

export function deviceReaderOf(document: ObjectiveValueEvidenceDocument): DeviceReaderSpec | null {
  return OBJECTIVE_VALUE_DEVICE_READERS[document] ?? null;
}
