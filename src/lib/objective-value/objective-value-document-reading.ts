/**
 * @fileoverview ADR-949 Α-2 — **ποιο έγγραφο διαβάζεται στη συσκευή, και τι προτείνει στον υπολογιστή**. Καθαρό: από
 *   σελίδες με θέσεις σε γραμμές, από γραμμή σε προτάσεις ανά πεδίο, από αποδοχή σε αλλαγή του προχείρου.
 * @related `config/objective-value/objective-value-evidence.ts` (τα έγγραφα — ίδια id) · `lib/document-validity/e9-text.ts`
 *   (ο αναγνώστης) · `objective-value-input-provenance.ts` (το «δηλώσατε από») · `lib/energy-certificate/pea-proposal.ts`
 *   (το μοτίβο πρόταση → επιβεβαίωση)
 * @module lib/objective-value/objective-value-document-reading
 *
 * 🔑 **Πρόταση, ποτέ εγγραφή** (TurboTax · ProConnect · ADR-949 Α4): η τιμή μπαίνει στο πρόχειρο μόνο όταν ο άνθρωπος
 *    την αποδεχθεί, και περνά από το **ίδιο** `UpdateDraft` με το χέρι.
 * 🔑 **Το είδος ακολουθεί τη γραμμή**: αποδοχή ορόφου ή επιφάνειας γράφει και το είδος της γραμμής (αποθήκη · θέση
 *    στάθμευσης · κατοικία) — επιφάνεια κατοικίας μέσα σε πρόχειρο αποθήκης θα ήταν άλλο ακίνητο. Ποσοστό, συνιδιοκτησία
 *    και ειδική κατάσταση είναι **κοινά** σε κάθε είδος και δεν το αλλάζουν.
 * 🔑 **Κυριότητα μόνο όταν αποδεικνύεται** (ΠΟΛ.1237/2014, στήλες 15-16 · ΠΟΛ.1149/1994 άρθ. 3 §1 · §12): ο υπολογιστής
 *    αποτιμά **πλήρη κυριότητα**· ποσοστό < 100 σε πλήρη κυριότητα = συνιδιοκτησία (×0,9). Ψιλή κυριότητα, επικαρπία,
 *    επιφανείας κ.λπ. **δεν** μοντελοποιούνται ⇒ σημαία, καμία πρόταση.
 * 🔑 **Ειδική κατάσταση μόνο όπου η διατύπωση ταυτίζεται**: στήλη 10 κωδ. 3 «Διατηρητέο κτίσμα, εφόσον έχει εκδοθεί η
 *    σχετική πράξη» ⇒ διατηρητέο. Ο κωδ. 1 καλύπτει απαλλοτρίωση **και** πρωτόκολλο κατεδάφισης ⇒ **δεν** είναι το
 *    «απαλλοτριωτέο» της μηχανής· σημαία για έλεγχο, όχι πρόταση.
 * ⚠️ **Σημαίες, ποτέ σιωπή**: μεζονέτα (το Ε9 έχει μία γραμμή, βλ. `e9-text.ts`) ⇒ καμία πρόταση ορόφου/επιφάνειας·
 *    ημιτελές ⇒ σημαία· είδος που ο υπολογιστής δεν αποτιμά ⇒ καμία πρόταση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import { E9_MAX_PAGES, E9_UNFINISHED_CONDITION, readE9Text, type E9BuildingRow, type E9Floor } from '@/lib/document-validity/e9-text';
import type { PdfPositionedPage } from '@/lib/pdf/pdf-page-text';

import type {
  ObjectiveValueDeclarationSource,
  ObjectiveValueDeclaredTarget,
  ObjectiveValueReadingApplication,
} from './objective-value-declared-reading';
import type { LevelDraft, ObjectiveValueDraft } from './objective-value-draft';
import type { LegalEncumbrance, ObjectiveValueForm } from './objective-value-types';

/**
 * Η κυριότητα όπως τη γράφει το έγγραφο: `full` = πλήρης κυριότητα με το ποσοστό της (`null` = αδιάβαστο) · `other` =
 * δικαίωμα που ο υπολογιστής δεν αποτιμά · `unread` = η στήλη δεν διαβάστηκε.
 */
export type ObjectiveValueRowOwnership =
  | { readonly kind: 'full'; readonly pct: number | null }
  | { readonly kind: 'other' }
  | { readonly kind: 'unread' };

/** Μια γραμμή εγγράφου, ουδέτερη ως προς το έγγραφο: ό,τι χρειάζεται η επιλογή και η πρόταση. */
export interface ObjectiveValueDocumentRow {
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
}

interface DeviceReaderSpec {
  readonly maxPages: number;
  /** `null` = το έγγραφο δεν είναι αυτό που διαλέχτηκε. */
  readonly read: (pages: readonly PdfPositionedPage[]) => readonly ObjectiveValueDocumentRow[] | null;
}

/** Κατηγορία Ε9 (στήλη 9, ΠΟΛ.1237/2014) → έντυπο του υπολογιστή. Η μονοκατοικία είναι κατοικία (`objective-value-form-of-type.ts`). */
const E9_FORM_OF_CATEGORY: Readonly<Record<number, ObjectiveValueForm>> = { 1: 'residence', 2: 'residence', 5: 'storage', 6: 'parking' };
/** Στήλη 15, κωδ. 1 «Πλήρης κυριότητα». */
const E9_FULL_OWNERSHIP = 1;
/** Στήλη 10, κωδ. 3 «Διατηρητέο κτίσμα, εφόσον έχει εκδοθεί η σχετική πράξη και έχει δημοσιευθεί σε Φ.Ε.Κ.». */
const E9_LISTED_CONDITION = 3;
/** Στήλη 10, κωδ. 1 «υπό αναγκαστική απαλλοτρίωση … ή πρωτόκολλο κατεδάφισης». */
const E9_EXPROPRIATION_OR_DEMOLITION_CONDITION = 1;

/** Όροφος Ε9 → κλίμακα μηχανής: `Υ` ⇒ −1 (κάθε υπόγειο μετρά ίδια, `objective-value-residence.ts`). */
function engineFloorOf(floor: E9Floor | null): number | null {
  if (floor === null) return null;
  return floor.kind === 'basement' ? -1 : floor.number;
}

function e9OwnershipOf(row: E9BuildingRow): ObjectiveValueRowOwnership {
  if (row.rightKind === null) return { kind: 'unread' };
  return row.rightKind === E9_FULL_OWNERSHIP ? { kind: 'full', pct: row.ownershipPct } : { kind: 'other' };
}

function e9RowOf(row: E9BuildingRow): ObjectiveValueDocumentRow {
  return {
    page: row.page,
    form: E9_FORM_OF_CATEGORY[row.category] ?? null,
    floor: engineFloorOf(row.floor),
    area: row.mainArea,
    ownership: e9OwnershipOf(row),
    encumbrance: row.specialCondition === E9_LISTED_CONDITION ? 'listed' : null,
    conditionToCheck: row.specialCondition === E9_EXPROPRIATION_OR_DEMOLITION_CONDITION,
    unfinished: row.specialCondition === E9_UNFINISHED_CONDITION,
    constructionYear: row.constructionYear,
    address: row.address,
  };
}

const E9_READER: DeviceReaderSpec = {
  maxPages: E9_MAX_PAGES,
  read: (pages) => {
    const result = readE9Text(pages);
    return result.kind === 'read' ? result.rows.map(e9RowOf) : null;
  },
};

/** **Το μητρώο.** Έγγραφο χωρίς γραμμή εδώ = ο οδηγός το δείχνει, αλλά δεν διαβάζεται ακόμη στη συσκευή (Α-3). */
const OBJECTIVE_VALUE_DEVICE_READERS: Readonly<Partial<Record<ObjectiveValueEvidenceDocument, DeviceReaderSpec>>> = {
  'owner-e9': E9_READER,
};

export function deviceReaderOf(document: ObjectiveValueEvidenceDocument): DeviceReaderSpec | null {
  return OBJECTIVE_VALUE_DEVICE_READERS[document] ?? null;
}

// ============================================================================
// ΠΡΟΤΑΣΗ
// ============================================================================

/** Μια πρόταση ανά πεδίο — κλειστή ένωση, ώστε τιμή και τρέχουσα να έχουν πάντα τον τύπο του πεδίου. */
export type ObjectiveValueFieldProposal =
  | { readonly field: 'floor' | 'area' | 'ownershipPct'; readonly value: number; readonly current: number | null }
  | { readonly field: 'coOwned'; readonly value: boolean; readonly current: boolean }
  | { readonly field: 'encumbrance'; readonly value: LegalEncumbrance; readonly current: LegalEncumbrance };

export type ObjectiveValueReadField = ObjectiveValueFieldProposal['field'];

/** Οι σημαίες — καθεμία έχει κείμενο στο `evidence.reader.flags.*`. */
export type ObjectiveValueReadFlag =
  | 'maisonette-single-row'
  | 'unfinished'
  | 'form-unsupported'
  | 'form-changes'
  | 'right-not-full'
  | 'ownership-unread'
  | 'condition-to-check';

export interface ObjectiveValueReadingProposal {
  readonly source: ObjectiveValueDeclarationSource;
  readonly form: ObjectiveValueForm | null;
  readonly fields: readonly ObjectiveValueFieldProposal[];
  readonly flags: readonly ObjectiveValueReadFlag[];
}

/** Τι ξέρει ήδη το πρόχειρο για όροφο/επιφάνεια — στο έντυπο της **γραμμής** (αλλιώς κενό: άλλο ακίνητο). */
function currentOf(field: 'floor' | 'area', form: ObjectiveValueForm, draft: ObjectiveValueDraft): number | null {
  if (draft.form !== form) return null;
  if (form !== 'residence') return draft.area;
  const level = draft.levels[0];
  return field === 'floor' ? level?.floor ?? null : level?.area ?? null;
}

/** Μεζονέτα στο πρόχειρο + μία γραμμή Ε9 (υψηλότερος όροφος · συνολική επιφάνεια) ⇒ δεν μοιράζεται σε επίπεδα. */
function isMaisonetteConflict(form: ObjectiveValueForm, draft: ObjectiveValueDraft): boolean {
  return form === 'residence' && draft.form === 'residence' && draft.levels.length > 1;
}

function placeFieldsOf(row: ObjectiveValueDocumentRow, form: ObjectiveValueForm, draft: ObjectiveValueDraft): ObjectiveValueFieldProposal[] {
  if (isMaisonetteConflict(form, draft)) return [];
  const wanted: readonly ['floor' | 'area', number | null][] =
    form === 'residence' ? [['floor', row.floor], ['area', row.area]] : [['area', row.area]];
  return wanted.flatMap(([field, value]) => (value === null ? [] : [{ field, value, current: currentOf(field, form, draft) }]));
}

/** Πλήρης κυριότητα με διαβασμένο ποσοστό ⇒ ποσοστό + συνιδιοκτησία, **μόνο** όσα διαφέρουν από το πρόχειρο. */
function ownershipFieldsOf(ownership: ObjectiveValueRowOwnership, draft: ObjectiveValueDraft): ObjectiveValueFieldProposal[] {
  if (ownership.kind !== 'full' || ownership.pct === null) return [];
  const { pct } = ownership;
  const currentPct = draft.ownershipPct ?? 100;
  const coOwned = pct < 100;
  return [
    ...(currentPct === pct ? [] : [{ field: 'ownershipPct' as const, value: pct, current: draft.ownershipPct }]),
    ...(draft.coOwned === coOwned ? [] : [{ field: 'coOwned' as const, value: coOwned, current: draft.coOwned }]),
  ];
}

function encumbranceFieldsOf(row: ObjectiveValueDocumentRow, draft: ObjectiveValueDraft): ObjectiveValueFieldProposal[] {
  if (row.encumbrance === null || draft.encumbrance === row.encumbrance) return [];
  return [{ field: 'encumbrance', value: row.encumbrance, current: draft.encumbrance }];
}

function flagsOf(row: ObjectiveValueDocumentRow, form: ObjectiveValueForm, draft: ObjectiveValueDraft): ObjectiveValueReadFlag[] {
  const ownershipUnread = row.ownership.kind === 'unread' || (row.ownership.kind === 'full' && row.ownership.pct === null);
  const flags: [ObjectiveValueReadFlag, boolean][] = [
    ['unfinished', row.unfinished],
    ['maisonette-single-row', isMaisonetteConflict(form, draft)],
    ['form-changes', draft.form !== form],
    ['right-not-full', row.ownership.kind === 'other'],
    ['ownership-unread', ownershipUnread],
    ['condition-to-check', row.conditionToCheck],
  ];
  return flags.flatMap(([flag, on]) => (on ? [flag] : []));
}

/** **Η πρόταση** για τη γραμμή που διάλεξε ο άνθρωπος. */
export function readingProposalOf(
  document: ObjectiveValueEvidenceDocument,
  row: ObjectiveValueDocumentRow,
  draft: ObjectiveValueDraft,
): ObjectiveValueReadingProposal {
  const source = { document, page: row.page };
  if (row.form === null) return { source, form: null, fields: [], flags: [...(row.unfinished ? ['unfinished' as const] : []), 'form-unsupported'] };
  const fields = [...placeFieldsOf(row, row.form, draft), ...ownershipFieldsOf(row.ownership, draft), ...encumbranceFieldsOf(row, draft)];
  return { source, form: row.form, fields, flags: flagsOf(row, row.form, draft) };
}

// ============================================================================
// ΑΠΟΔΟΧΗ → ΠΡΟΧΕΙΡΟ + ΔΗΛΩΣΗ
// ============================================================================

type PlaceProposal = Extract<ObjectiveValueFieldProposal, { field: 'floor' | 'area' }>;

const isPlace = (proposal: ObjectiveValueFieldProposal): proposal is PlaceProposal =>
  proposal.field === 'floor' || proposal.field === 'area';

function targetOf(field: 'floor' | 'area', form: ObjectiveValueForm): ObjectiveValueDeclaredTarget {
  if (form !== 'residence') return { input: 'area' };
  return field === 'floor' ? { input: 'levelFloor', level: 0 } : { input: 'levelArea', level: 0 };
}

function residenceLevelsOf(accepted: readonly PlaceProposal[], draft: ObjectiveValueDraft): readonly LevelDraft[] {
  const base: LevelDraft = draft.form === 'residence' ? draft.levels[0] ?? { floor: null, area: null } : { floor: null, area: null };
  return [accepted.reduce<LevelDraft>((next, { field, value }) => (field === 'floor' ? { ...next, floor: value } : { ...next, area: value }), base)];
}

/** Όροφος/επιφάνεια → είδος + επίπεδο (κατοικία) ή επιφάνεια (αποθήκη/στάθμευση). */
function placePatchOf(form: ObjectiveValueForm, accepted: readonly PlaceProposal[], draft: ObjectiveValueDraft): Partial<ObjectiveValueDraft> {
  if (accepted.length === 0) return {};
  if (form === 'residence') return { form, levels: residenceLevelsOf(accepted, draft) };
  return { form, area: accepted[0].value };
}

/** Τα κοινά πεδία — το 100% γράφεται ως κενό (η σύμβαση του προχείρου: κενό = 100%). */
function commonPatchOf(accepted: readonly ObjectiveValueFieldProposal[]): Partial<ObjectiveValueDraft> {
  return accepted.reduce<Partial<ObjectiveValueDraft>>((patch, proposal) => {
    switch (proposal.field) {
      case 'ownershipPct':
        return { ...patch, ownershipPct: proposal.value === 100 ? null : proposal.value };
      case 'coOwned':
        return { ...patch, coOwned: proposal.value };
      case 'encumbrance':
        return { ...patch, encumbrance: proposal.value };
      default:
        return patch;
    }
  }, {});
}

/**
 * **Οι αποδεκτές προτάσεις → μία αλλαγή του προχείρου** + οι δηλώσεις για την προέλευση (όροφος/επιφάνεια). Καμία
 * αποδοχή ⇒ καμία αλλαγή (ούτε το είδος).
 */
export function readingApplicationOf(
  proposal: ObjectiveValueReadingProposal,
  acceptedFields: ReadonlySet<ObjectiveValueReadField>,
  draft: ObjectiveValueDraft,
): ObjectiveValueReadingApplication {
  const { form } = proposal;
  const accepted = proposal.fields.filter(({ field }) => acceptedFields.has(field));
  if (form === null || accepted.length === 0) return { patch: {}, declared: [] };
  const place = accepted.filter(isPlace);
  const declared = place.map(({ field, value }) => ({ target: targetOf(field, form), value, source: proposal.source }));
  return { patch: { ...placePatchOf(form, place, draft), ...commonPatchOf(accepted) }, declared };
}
