/**
 * @fileoverview ADR-949 Α-2 · Α-3 — **τι προτείνει στον υπολογιστή μια γραμμή εγγράφου**. Καθαρό: από γραμμή σε
 *   προτάσεις ανά πεδίο (+ σημαίες και διασταύρωση), από αποδοχή σε αλλαγή του προχείρου.
 * @related `objective-value-device-readers.ts` (οι γραμμές) · `objective-value-input-provenance.ts` (το «δηλώσατε από») ·
 *   `objective-value-zone.ts` (η ζώνη του χάρτη) · `lib/energy-certificate/pea-proposal.ts` (το μοτίβο πρόταση → επιβεβαίωση)
 * @module lib/objective-value/objective-value-document-reading
 *
 * 🔑 **Πρόταση, ποτέ εγγραφή** (TurboTax · ProConnect · ADR-949 Α4): η τιμή μπαίνει στο πρόχειρο μόνο όταν ο άνθρωπος
 *    την αποδεχθεί, και περνά από το **ίδιο** `UpdateDraft` με το χέρι.
 * 🔑 **Το είδος ακολουθεί τη γραμμή**: αποδοχή ορόφου ή επιφάνειας γράφει και το είδος της γραμμής (αποθήκη · θέση
 *    στάθμευσης · κατοικία) — επιφάνεια κατοικίας μέσα σε πρόχειρο αποθήκης θα ήταν άλλο ακίνητο. Ποσοστό, συνιδιοκτησία,
 *    ειδική κατάσταση και ημερομηνία άδειας είναι **κοινά** σε κάθε είδος και δεν το αλλάζουν.
 * 🔑 **Κυριότητα μόνο όταν αποδεικνύεται** (ΠΟΛ.1237/2014, στήλες 15-16 · ΠΟΛ.1149/1994 άρθ. 3 §1 · §12): ο υπολογιστής
 *    αποτιμά **πλήρη κυριότητα**· ποσοστό < 100 σε πλήρη κυριότητα = συνιδιοκτησία (×0,9). Ψιλή κυριότητα, επικαρπία,
 *    επιφανείας κ.λπ. **δεν** μοντελοποιούνται ⇒ σημαία, καμία πρόταση.
 * 🔑 **Ειδική κατάσταση μόνο όπου η διατύπωση ταυτίζεται**: στήλη 10 κωδ. 3 «Διατηρητέο κτίσμα, εφόσον έχει εκδοθεί η
 *    σχετική πράξη» ⇒ διατηρητέο. Ο κωδ. 1 καλύπτει απαλλοτρίωση **και** πρωτόκολλο κατεδάφισης ⇒ **δεν** είναι το
 *    «απαλλοτριωτέο» της μηχανής· σημαία για έλεγχο, όχι πρόταση.
 * 🔑 **Τιμή ζώνης εγγράφου = διασταύρωση, ποτέ πρόταση** (Α-3): αυθεντία είναι το δημόσιο μητρώο (ο χάρτης). Η τιμή του
 *    ΕΝΦΙΑ ισχύει κατά 1/1 του έτους της πράξης ⇒ «συμφωνεί» · «διαφέρει» · «παλαιότερη από την αναθεώρηση» · «δείξτε
 *    τη θέση». Οι μεγάλοι (TurboTax import · Zillow) αντιγράφουν την τιμή του εγγράφου· εδώ την **ελέγχουμε**.
 * 🔑 **Ημερομηνία άδειας μόνο από αρχική οικοδομική άδεια** (Α-3): ενημέρωση ⇒ σημαία που **ονομάζει** την αρχική ·
 *    μικρή κλίμακα ⇒ σημαία· ποτέ μαντεψιά (ένα κτίριο του 2003 με θερμοπρόσοψη του 2018 δεν είναι «του 2018»).
 * ⚠️ **Σημαίες, ποτέ σιωπή**: μεζονέτα (μία γραμμή στο Ε9/ΕΝΦΙΑ) ⇒ καμία πρόταση ορόφου/επιφάνειας· ημιτελές ⇒ σημαία·
 *    είδος που ο υπολογιστής δεν αποτιμά ⇒ καμία πρόταση.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';
import type { UnitPermitReference } from '@/lib/document-validity/unit-permit-text';

import type {
  ObjectiveValueDeclarationSource,
  ObjectiveValueDeclaredReading,
  ObjectiveValueDeclaredTarget,
  ObjectiveValueReadingApplication,
} from './objective-value-declared-reading';
import type {
  ObjectiveValueDocumentRow,
  ObjectiveValuePermitRow,
  ObjectiveValuePropertyRow,
  ObjectiveValueRowOwnership,
  ObjectiveValueZoneEvidence,
} from './objective-value-device-readers';
import type { LevelDraft, ObjectiveValueDraft } from './objective-value-draft';
import type { LegalEncumbrance, ObjectiveValueForm } from './objective-value-types';
import type { ObjectiveValueMapZone } from './objective-value-zone';

/** Μια πρόταση ανά πεδίο — κλειστή ένωση, ώστε τιμή και τρέχουσα να έχουν πάντα τον τύπο του πεδίου. */
export type ObjectiveValueFieldProposal =
  | { readonly field: 'floor' | 'area' | 'ownershipPct'; readonly value: number; readonly current: number | null }
  | { readonly field: 'coOwned'; readonly value: boolean; readonly current: boolean }
  | { readonly field: 'encumbrance'; readonly value: LegalEncumbrance; readonly current: LegalEncumbrance }
  | { readonly field: 'permitDate'; readonly value: string; readonly current: string | null };

export type ObjectiveValueReadField = ObjectiveValueFieldProposal['field'];

/** Οι σημαίες — καθεμία έχει κείμενο στο `evidence.reader.flags.*`. */
export type ObjectiveValueReadFlag =
  | 'maisonette-single-row'
  | 'unfinished'
  | 'form-unsupported'
  | 'form-changes'
  | 'right-not-full'
  | 'ownership-unread'
  | 'condition-to-check'
  | 'permit-update'
  | 'permit-update-unnamed'
  | 'permit-minor-works'
  | 'permit-unsupported'
  | 'permit-date-unread';

/**
 * Η διασταύρωση της τιμής ζώνης του εγγράφου με τον χάρτη — κείμενο στο `evidence.reader.zoneCheck.*`:
 * - `agrees`         — ίδια τιμή (ο χάρτης δείχνει το σωστό σημείο)
 * - `differs`        — ίδια περίοδος ισχύος, άλλη τιμή (μέτωπο; άλλο σημείο στον χάρτη;)
 * - `superseded`     — η τιμή του εγγράφου είναι παλαιότερη από την αναθεώρηση της ζώνης
 * - `needs-location` — δεν υπάρχει ζώνη χάρτη να συγκριθεί
 */
export type ObjectiveValueZoneCheck =
  | { readonly kind: 'agrees'; readonly year: number; readonly price: number }
  | { readonly kind: 'differs'; readonly year: number; readonly documentPrice: number; readonly mapPrice: number }
  | { readonly kind: 'superseded'; readonly year: number; readonly documentPrice: number; readonly validFrom: string }
  | { readonly kind: 'needs-location'; readonly year: number; readonly documentPrice: number };

export interface ObjectiveValueReadingProposal {
  readonly source: ObjectiveValueDeclarationSource;
  /** Το είδος της γραμμής ακινήτου — `null` για πράξη άδειας ή είδος που δεν αποτιμάται. */
  readonly form: ObjectiveValueForm | null;
  readonly fields: readonly ObjectiveValueFieldProposal[];
  readonly flags: readonly ObjectiveValueReadFlag[];
  readonly zoneCheck: ObjectiveValueZoneCheck | null;
  /** Για τη σημαία `permit-update`: η αρχική άδεια που ονομάζει η ενημέρωση. */
  readonly originalPermit: UnitPermitReference | null;
}

// ============================================================================
// ΠΡΟΤΑΣΗ — ΓΡΑΜΜΗ ΑΚΙΝΗΤΟΥ (Ε9 · ΕΝΦΙΑ)
// ============================================================================

/** Τι ξέρει ήδη το πρόχειρο για όροφο/επιφάνεια — στο έντυπο της **γραμμής** (αλλιώς κενό: άλλο ακίνητο). */
function currentOf(field: 'floor' | 'area', form: ObjectiveValueForm, draft: ObjectiveValueDraft): number | null {
  if (draft.form !== form) return null;
  if (form !== 'residence') return draft.area;
  const level = draft.levels[0];
  return field === 'floor' ? level?.floor ?? null : level?.area ?? null;
}

/** Μεζονέτα στο πρόχειρο + μία γραμμή (υψηλότερος όροφος · συνολική επιφάνεια) ⇒ δεν μοιράζεται σε επίπεδα. */
function isMaisonetteConflict(form: ObjectiveValueForm, draft: ObjectiveValueDraft): boolean {
  return form === 'residence' && draft.form === 'residence' && draft.levels.length > 1;
}

function placeFieldsOf(row: ObjectiveValuePropertyRow, form: ObjectiveValueForm, draft: ObjectiveValueDraft): ObjectiveValueFieldProposal[] {
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

function encumbranceFieldsOf(row: ObjectiveValuePropertyRow, draft: ObjectiveValueDraft): ObjectiveValueFieldProposal[] {
  if (row.encumbrance === null || draft.encumbrance === row.encumbrance) return [];
  return [{ field: 'encumbrance', value: row.encumbrance, current: draft.encumbrance }];
}

function flagsOf(row: ObjectiveValuePropertyRow, form: ObjectiveValueForm, draft: ObjectiveValueDraft): ObjectiveValueReadFlag[] {
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

/** Μισό λεπτό του ευρώ: οι τιμές ζώνης γράφονται με δύο δεκαδικά — κάτω από αυτό είναι η ίδια τιμή. */
const PRICE_TOLERANCE = 0.005;

/** **Η διασταύρωση** (βλ. 🔑 πάνω): ίση τιμή ⇒ συμφωνεί, όποιο κι αν είναι το έτος· αλλιώς το έτος κρίνει γιατί διαφέρει. */
export function zoneCheckOf(evidence: ObjectiveValueZoneEvidence | null, map: ObjectiveValueMapZone | null): ObjectiveValueZoneCheck | null {
  if (evidence === null) return null;
  const { price: documentPrice, year } = evidence;
  if (map === null) return { kind: 'needs-location', year, documentPrice };
  if (Math.abs(documentPrice - map.price) < PRICE_TOLERANCE) return { kind: 'agrees', year, price: documentPrice };
  // Ο φόρος του έτους Ε υπολογίζεται με τα στοιχεία της 1/1/Ε — ίδια μορφή `YYYY-MM-DD`, άρα σύγκριση κειμένου.
  if (`${year}-01-01` < map.validFrom) return { kind: 'superseded', year, documentPrice, validFrom: map.validFrom };
  return { kind: 'differs', year, documentPrice, mapPrice: map.price };
}

function propertyProposalOf(
  source: ObjectiveValueDeclarationSource,
  row: ObjectiveValuePropertyRow,
  draft: ObjectiveValueDraft,
  map: ObjectiveValueMapZone | null,
): ObjectiveValueReadingProposal {
  const base = { source, zoneCheck: zoneCheckOf(row.zoneEvidence, map), originalPermit: null };
  if (row.form === null) {
    return { ...base, form: null, fields: [], flags: [...(row.unfinished ? ['unfinished' as const] : []), 'form-unsupported'] };
  }
  const fields = [...placeFieldsOf(row, row.form, draft), ...ownershipFieldsOf(row.ownership, draft), ...encumbranceFieldsOf(row, draft)];
  return { ...base, form: row.form, fields, flags: flagsOf(row, row.form, draft) };
}

// ============================================================================
// ΠΡΟΤΑΣΗ — ΠΡΑΞΗ ΑΔΕΙΑΣ
// ============================================================================

function permitFlagOf(row: ObjectiveValuePermitRow): ObjectiveValueReadFlag | null {
  switch (row.act) {
    case 'initial':
      return row.issuedOn === null ? 'permit-date-unread' : null;
    case 'update':
      return row.originalPermit === null ? 'permit-update-unnamed' : 'permit-update';
    case 'minor-works':
      return 'permit-minor-works';
    case 'unsupported':
      return 'permit-unsupported';
  }
}

/** Μόνο η αρχική οικοδομική άδεια προτείνει ημερομηνία — και μόνο αν διαφέρει από το πρόχειρο. */
function permitProposalOf(
  source: ObjectiveValueDeclarationSource,
  row: ObjectiveValuePermitRow,
  draft: ObjectiveValueDraft,
): ObjectiveValueReadingProposal {
  const flag = permitFlagOf(row);
  const date = row.act === 'initial' ? row.issuedOn : null;
  const fields: ObjectiveValueFieldProposal[] =
    date === null || date === draft.permitDate ? [] : [{ field: 'permitDate', value: date, current: draft.permitDate }];
  return { source, form: null, fields, flags: flag === null ? [] : [flag], zoneCheck: null, originalPermit: row.originalPermit };
}

/** **Η πρόταση** για τη γραμμή που διάλεξε ο άνθρωπος· `map` = η ζώνη του χάρτη για τη διασταύρωση (ή καμία). */
export function readingProposalOf(
  document: ObjectiveValueEvidenceDocument,
  row: ObjectiveValueDocumentRow,
  draft: ObjectiveValueDraft,
  map: ObjectiveValueMapZone | null,
): ObjectiveValueReadingProposal {
  const source = { document, page: row.page };
  return row.kind === 'permit' ? permitProposalOf(source, row, draft) : propertyProposalOf(source, row, draft, map);
}

// ============================================================================
// ΑΠΟΔΟΧΗ → ΠΡΟΧΕΙΡΟ + ΔΗΛΩΣΗ
// ============================================================================

type PlaceProposal = Extract<ObjectiveValueFieldProposal, { field: 'floor' | 'area' }>;
type PermitDateProposal = Extract<ObjectiveValueFieldProposal, { field: 'permitDate' }>;

const isPlace = (proposal: ObjectiveValueFieldProposal): proposal is PlaceProposal =>
  proposal.field === 'floor' || proposal.field === 'area';

const isPermitDate = (proposal: ObjectiveValueFieldProposal): proposal is PermitDateProposal => proposal.field === 'permitDate';

function targetOf(field: 'floor' | 'area', form: ObjectiveValueForm): Exclude<ObjectiveValueDeclaredTarget, { input: 'permitDate' }> {
  if (form !== 'residence') return { input: 'area' };
  return field === 'floor' ? { input: 'levelFloor', level: 0 } : { input: 'levelArea', level: 0 };
}

function residenceLevelsOf(accepted: readonly PlaceProposal[], draft: ObjectiveValueDraft): readonly LevelDraft[] {
  const base: LevelDraft = draft.form === 'residence' ? draft.levels[0] ?? { floor: null, area: null } : { floor: null, area: null };
  return [accepted.reduce<LevelDraft>((next, { field, value }) => (field === 'floor' ? { ...next, floor: value } : { ...next, area: value }), base)];
}

/** Όροφος/επιφάνεια → είδος + επίπεδο (κατοικία) ή επιφάνεια (αποθήκη/στάθμευση). */
function placePatchOf(form: ObjectiveValueForm | null, accepted: readonly PlaceProposal[], draft: ObjectiveValueDraft): Partial<ObjectiveValueDraft> {
  if (form === null || accepted.length === 0) return {};
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
      case 'permitDate':
        return { ...patch, permitDate: proposal.value };
      default:
        return patch;
    }
  }, {});
}

/** Οι δηλώσεις για την προέλευση: όροφος/επιφάνεια (στο είδος της γραμμής) και ημερομηνία άδειας. */
function declaredOf(proposal: ObjectiveValueReadingProposal, accepted: readonly ObjectiveValueFieldProposal[]): ObjectiveValueDeclaredReading[] {
  const { form, source } = proposal;
  const place = form === null ? [] : accepted.filter(isPlace).map(({ field, value }) => ({ target: targetOf(field, form), value, source }));
  const permit = accepted.filter(isPermitDate).map(({ value }) => ({ target: { input: 'permitDate' as const }, value, source }));
  return [...place, ...permit];
}

/**
 * **Οι αποδεκτές προτάσεις → μία αλλαγή του προχείρου** + οι δηλώσεις για την προέλευση. Καμία αποδοχή ⇒ καμία αλλαγή
 * (ούτε το είδος).
 */
export function readingApplicationOf(
  proposal: ObjectiveValueReadingProposal,
  acceptedFields: ReadonlySet<ObjectiveValueReadField>,
  draft: ObjectiveValueDraft,
): ObjectiveValueReadingApplication {
  const accepted = proposal.fields.filter(({ field }) => acceptedFields.has(field));
  if (accepted.length === 0) return { patch: {}, declared: [] };
  const patch = { ...placePatchOf(proposal.form, accepted.filter(isPlace), draft), ...commonPatchOf(accepted) };
  return { patch, declared: declaredOf(proposal, accepted) };
}
