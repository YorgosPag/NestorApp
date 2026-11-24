/**
 * @fileoverview **ΔΙΟΡΘΩΣΗ ΑΝΑΓΝΩΣΗΣ** — ο άνθρωπος διαβάζει ο ίδιος το έγγραφο (ADR-950 §10).
 * @module lib/contacts/contact-evidence-corrections
 *
 * Πρότυπο αγοράς: human-in-the-loop review (Document AI · Textract A2I · Rossum · Docsumo) — κάθε τιμή που διάβασε η
 * μηχανή **διορθώνεται επιτόπου**, δίπλα στην εικόνα, και κρατιούνται **και τα δύο** (τι είπε η μηχανή, τι ο άνθρωπος,
 * ποιος, πότε). Χαμηλή βεβαιότητα = «ζητώ άνθρωπο», ποτέ αδιέξοδο.
 *
 * 🔑 **Η διόρθωση είναι ΑΝΑΓΝΩΣΗ, όχι εγγραφή στην επαφή.** Αντικαθιστά τα πεδία της γραμμής **μέσα στην ανάγνωση**
 *    (`applyEvidenceCorrections`)· η σύγκριση, η «Καταχώριση», η «Αποδοχή» και η «Αγνόηση» τρέχουν **όπως πριν**, πάνω
 *    στην τιμή του ανθρώπου. Κανένας δεύτερος δρόμος προς την επαφή.
 * 🔑 **Οι ίδιοι ελεγκτές** (`evidenceReadingKey`): ψηφίο ελέγχου ΑΦΜ · libphonenumber · κατάλογος ΔΟΥ · Τ.Κ. Ο άνθρωπος
 *    παρακάμπτει **μόνο** ό,τι αφορά τη μηχανή — χαμηλή εμπιστοσύνη · διαφωνία δεύτερης ανάγνωσης · «δεν βρέθηκε στον
 *    χάρτη» (τη διεύθυνση την επιβεβαιώνει ο ίδιος στον editor έδρας, με την πινέζα — Google Address Validation «Confirm»).
 * 🔑 **Δεμένη στην ανάγνωση της μηχανής** (σχήμα ADR-759, όπως η «Αγνόηση»): νέα ανάγνωση που λέει **άλλο** ⇒ η γραμμή
 *    το δείχνει (`stale`) και ξαναζητά κρίση — η διόρθωση **δεν** σβήνεται σιωπηλά.
 * 🔑 Ο ΕΝΑΣ γραφέας είναι ο διακομιστής (`server/files/evidence-corrections-writer`)· εδώ ζει ό,τι δεν χρειάζεται βάση.
 *
 * **Layering**: καθαρή — καμία I/O, κανένα ρολόι.
 */

import {
  CONTACT_DOCUMENT_EVIDENCE,
  EVIDENCE_FIELD_KEYS,
  isEvidenceAddressField,
  isEvidenceIssuerField,
  type EvidenceFieldKey,
  type EvidenceFieldSpec,
  type EvidenceRowKey,
} from '@/config/contact-document-evidence';
import { present } from '@/lib/comparison/field-judgment';
import {
  compareEvidenceWithForm,
  type EvidenceComparisonInput,
  type EvidenceReading,
  type EvidenceRow,
} from '@/lib/contacts/contact-evidence-comparison';
import { isEvidenceRowKey } from '@/lib/contacts/contact-evidence-dismissals';
import { evidenceReadingKey, groundEvidence } from '@/lib/contacts/contact-evidence-grounding';
import { isNonEmptyString, isOneOf, isPlainRecord } from '@/lib/type-guards';
import type { EvidenceCorrection } from '@/types/file-record';

/** Το όνομα του πεδίου στο `FileRecord` — ο γραφέας και ο αναγνώστης το παίρνουν **από εδώ**. */
export const EVIDENCE_CORRECTIONS_FIELD = 'evidenceCorrections';

export type EvidenceCorrectionValues = EvidenceCorrection['values'];

/** Η εμπιστοσύνη μιας ανθρώπινης ανάγνωσης — περνά κάθε κατώφλι· ο **ελεγκτής** του είδους την κρίνει ακόμη. */
const HUMAN_CONFIDENCE = 1;

// ============================================================================
// ΤΑ ΠΕΔΙΑ ΜΙΑΣ ΓΡΑΜΜΗΣ
// ============================================================================

/**
 * Τα πεδία ανάγνωσης που συνθέτουν **μία** γραμμή του πίνακα: διεύθυνση ⇒ τα μέρη της · αριθμός μητρώου ⇒ ο αριθμός και
 * ο εκδότης της **ίδιας** αρχής · αλλιώς το ένα πεδίο. `[]` ⇒ η γραμμή δεν ανήκει σε αυτό το `purpose`.
 */
export function evidenceRowFieldSpecs(purpose: string | null, row: EvidenceRowKey): readonly EvidenceFieldSpec[] {
  const specs = purpose ? CONTACT_DOCUMENT_EVIDENCE[purpose] ?? [] : [];
  if (row === 'address') {
    return specs.filter((spec, index) => isEvidenceAddressField(spec.key) && specs.findIndex((s) => s.key === spec.key) === index);
  }
  const spec = specs.find((s) => s.key === row);
  if (spec === undefined) return [];
  const issuer = spec.registry === undefined
    ? undefined
    : specs.find((s) => s.registry === spec.registry && isEvidenceIssuerField(s.key));
  return issuer === undefined ? [spec] : [spec, issuer];
}

const machinePrintedOf = (reading: EvidenceReading, key: EvidenceFieldKey): string | null =>
  present(reading.fields.find((field) => field.field === key)?.printed ?? null);

/**
 * Το «αποτύπωμα» της ανάγνωσης της **μηχανής** για μια γραμμή — ό,τι τύπωσε ανά πεδίο, με σταθερή σειρά. Το κρατά η
 * διόρθωση· αλλάζει μόνο αν μια νέα ανάγνωση πει άλλο. Ίδιο στον πελάτη (εκκρεμής εικόνα) και στον διακομιστή.
 */
export function machineReadingSignature(reading: EvidenceReading, specs: readonly EvidenceFieldSpec[]): string {
  return specs.map((spec) => machinePrintedOf(reading, spec.key) ?? '').join('|');
}

// ============================================================================
// ΕΛΕΓΧΟΣ ΤΗΣ ΤΙΜΗΣ ΤΟΥ ΑΝΘΡΩΠΟΥ
// ============================================================================

export interface EvidenceCorrectionCheck {
  readonly ok: boolean;
  /** Καθαρές τιμές — μόνο πεδία της γραμμής, μόνο μη κενά. */
  readonly values: EvidenceCorrectionValues;
  /** Πεδία που λείπουν ενώ απαιτούνται ή δεν περνούν τον ελεγκτή τους. */
  readonly invalid: readonly EvidenceFieldKey[];
}

/**
 * Περνά η διόρθωση; Κάθε τιμή από τον **ίδιο** ελεγκτή με τη μηχανή. Διεύθυνση: όποια μέρη δώσει ο άνθρωπος (τουλάχιστον
 * ένα)· κάθε άλλη γραμμή: **όλα** τα πεδία της (αριθμός μητρώου χωρίς εκδότη δεν επαληθεύεται από κανέναν — ADR-841 Α9.1).
 */
export function checkEvidenceCorrection(purpose: string | null, row: EvidenceRowKey, raw: Readonly<Record<string, unknown>>): EvidenceCorrectionCheck {
  const specs = evidenceRowFieldSpecs(purpose, row);
  const values: Partial<Record<EvidenceFieldKey, string>> = {};
  const invalid: EvidenceFieldKey[] = [];
  for (const spec of specs) {
    const entry = raw[spec.key];
    const value = present(typeof entry === 'string' ? entry : null);
    if (value === null) {
      if (row !== 'address') invalid.push(spec.key);
    } else if (evidenceReadingKey(spec.kind, value) === null) {
      invalid.push(spec.key);
    } else {
      values[spec.key] = value;
    }
  }
  return { ok: specs.length > 0 && invalid.length === 0 && Object.keys(values).length > 0, values, invalid };
}

// ============================================================================
// ΤΟ ΜΗΤΡΩΟ ΔΙΟΡΘΩΣΕΩΝ — ίδιο σχήμα με των «Αγνοήσεων»
// ============================================================================

function valuesOf(raw: unknown): EvidenceCorrectionValues | null {
  if (!isPlainRecord(raw)) return null;
  const values: Partial<Record<EvidenceFieldKey, string>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isOneOf(EVIDENCE_FIELD_KEYS, key) || !isNonEmptyString(value)) return null;
    values[key] = value;
  }
  return Object.keys(values).length === 0 ? null : values;
}

function correctionOf(raw: unknown): EvidenceCorrection | null {
  if (!isPlainRecord(raw)) return null;
  const { row, machineReadingAtCorrection, correctedBy, correctedAt } = raw;
  const values = valuesOf(raw.values);
  if (!isEvidenceRowKey(row) || values === null || typeof machineReadingAtCorrection !== 'string') return null;
  if (!isNonEmptyString(correctedBy) || !isNonEmptyString(correctedAt)) return null;
  return { row, values, machineReadingAtCorrection, correctedBy, correctedAt };
}

/** Ό,τι κρατά ο δίσκος, κριμένο — άκυρη γραμμή **παραλείπεται** (δεν σβήνει τις υπόλοιπες). */
export function readEvidenceCorrections(raw: unknown): readonly EvidenceCorrection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(correctionOf).filter((c): c is EvidenceCorrection => c !== null);
}

/** Νέο μητρώο με τη διόρθωση — αντικαθιστά όποια προηγούμενη για την **ίδια** γραμμή (ιδεμπότητα). */
export function withEvidenceCorrection(ledger: readonly EvidenceCorrection[], correction: EvidenceCorrection): readonly EvidenceCorrection[] {
  return [...ledger.filter((c) => c.row !== correction.row), correction];
}

/** Νέο μητρώο χωρίς τη διόρθωση της γραμμής — αν δεν υπήρχε, ίδιο περιεχόμενο. */
export function withoutEvidenceCorrection(ledger: readonly EvidenceCorrection[], row: EvidenceRowKey): readonly EvidenceCorrection[] {
  return ledger.filter((c) => c.row !== row);
}

// ============================================================================
// Η ΑΝΑΓΝΩΣΗ ΜΕ ΤΙΣ ΔΙΟΡΘΩΣΕΙΣ — μία είσοδος για πίνακα ΚΑΙ διακομιστή
// ============================================================================

/**
 * Η ανάγνωση όπως τη βλέπει η σύγκριση: τα πεδία κάθε διορθωμένης γραμμής **αντικαθίστανται ολόκληρα** από ό,τι είπε ο
 * άνθρωπος (μέρος που άφησε κενό = «δεν υπάρχει»), και η διαφωνία δεύτερης ανάγνωσης για αυτά **παύει** — την έλυσε.
 */
export function applyEvidenceCorrections(reading: EvidenceReading, purpose: string | null, corrections: readonly EvidenceCorrection[]): EvidenceReading {
  let fields = reading.fields;
  let consensus = reading.fieldConsensus;
  const humanRows: EvidenceRowKey[] = [];
  for (const correction of corrections) {
    const specs = evidenceRowFieldSpecs(purpose, correction.row);
    if (specs.length === 0) continue;
    const keys = new Set(specs.map((spec) => spec.key));
    const human = specs.flatMap((spec) => {
      const printed = correction.values[spec.key];
      return printed === undefined ? [] : [{ field: spec.key, printed, confidence: HUMAN_CONFIDENCE }];
    });
    fields = [...fields.filter((field) => !keys.has(field.field)), ...human];
    consensus = consensus?.filter((entry) => !keys.has(entry.field));
    humanRows.push(correction.row);
  }
  if (humanRows.length === 0) return reading;
  return { ...reading, fields, ...(consensus === undefined ? {} : { fieldConsensus: consensus }), humanRows };
}

/**
 * **Η σύγκριση με τις διορθώσεις** — η `compareEvidenceWithForm` πάνω στη διορθωμένη ανάγνωση, και σε κάθε διορθωμένη
 * γραμμή τι λέει **τώρα** η μηχανή και αν άλλαξε από τότε.
 */
export function compareEvidenceWithCorrections(
  input: EvidenceComparisonInput & { readonly corrections: readonly EvidenceCorrection[] },
): readonly EvidenceRow[] {
  const { corrections, ...comparison } = input;
  const rows = compareEvidenceWithForm({ ...comparison, reading: applyEvidenceCorrections(input.reading, input.purpose, corrections) });
  if (corrections.length === 0) return rows;
  return rows.map((row) => {
    const correction = corrections.find((c) => c.row === row.key);
    if (correction === undefined) return row;
    const specs = evidenceRowFieldSpecs(input.purpose, row.key);
    const machinePrinted = present(specs.map((spec) => machinePrintedOf(input.reading, spec.key) ?? '').join(' ').replace(/\s+/g, ' '));
    const stale = machineReadingSignature(input.reading, specs) !== correction.machineReadingAtCorrection;
    return { ...row, correction: { machinePrinted, stale } };
  });
}

/**
 * **Η γραμμή όπως ΘΑ είναι** αν ο άνθρωπος αποθηκεύσει αυτές τις τιμές — πριν γραφτεί οτιδήποτε. Η ίδια σύγκριση, με
 * τη διόρθωση υποθετικά στο μητρώο: ο διάλογος λέει **από πριν** την κρίση («Λείπει» · «Ταιριάζει» · «Διαφέρει») και
 * προσφέρει μόνο την πράξη που θα είναι όντως δυνατή μετά. `null` ⇒ η γραμμή δεν ανήκει σε αυτό το είδος εγγράφου.
 *
 * 🔑 Καμία δεύτερη λογική: ό,τι δείχνει η προεπισκόπηση είναι ό,τι θα δείξει ο πίνακας μετά την αποθήκευση.
 */
export function previewEvidenceCorrection(
  input: EvidenceComparisonInput & { readonly corrections: readonly EvidenceCorrection[] },
  row: EvidenceRowKey,
  values: EvidenceCorrectionValues,
): EvidenceRow | null {
  const specs = evidenceRowFieldSpecs(input.purpose, row);
  if (specs.length === 0 || Object.keys(values).length === 0) return null;
  const hypothetical: EvidenceCorrection = {
    row,
    values,
    machineReadingAtCorrection: machineReadingSignature(input.reading, specs),
    correctedBy: '',
    correctedAt: '',
  };
  const corrections = withEvidenceCorrection(input.corrections, hypothetical);
  return compareEvidenceWithCorrections({ ...input, corrections }).find((candidate) => candidate.key === row) ?? null;
}

// ============================================================================
// ΤΑ ΠΕΔΙΑ ΤΟΥ ΔΙΑΛΟΓΟΥ ΔΙΟΡΘΩΣΗΣ
// ============================================================================

export interface EvidenceCorrectionField {
  readonly key: EvidenceFieldKey;
  readonly kind: EvidenceFieldSpec['kind'];
  /** Ό,τι τύπωσε η μηχανή — `null` = δεν βρήκε. */
  readonly machine: string | null;
  /** Ό,τι είπε η **δεύτερη** ανάγνωση όταν διαφώνησε (ADR-950 §8.3) — επιλογή με ένα πάτημα. */
  readonly alternate: string | null;
  /** Η αρχική τιμή του πεδίου στον διάλογο: η διόρθωση, αλλιώς η μηχανή (ΔΟΥ: ο **κωδικός** που έλυσε η μηχανή). */
  readonly initial: string;
}

/**
 * Από πού ξεκινά το πεδίο όταν δεν υπάρχει διόρθωση. ΔΟΥ: ο **κωδικός** του καταλόγου που έλυσε ήδη η μηχανή (με τους
 * τόπους του χάρτη, όπως στη σύγκριση) — ο κατάλογος του διαλόγου (`DoyPicker`) μιλά κωδικούς, όχι τυπωμένα ονόματα·
 * διφορούμενο όνομα ⇒ το τυπωμένο, και ο άνθρωπος διαλέγει. Κάθε άλλο είδος: ό,τι τύπωσε η μηχανή.
 */
function machineInitial(reading: EvidenceReading, spec: EvidenceFieldSpec, machine: string | null): string {
  if (machine === null) return '';
  if (spec.kind !== 'taxOffice') return machine;
  const grounded = groundEvidence(spec.kind, machine, HUMAN_CONFIDENCE, 0, { places: reading.addressVerification?.places });
  return grounded.ok ? grounded.display : machine;
}

/** Τα πεδία που δείχνει ο διάλογος για μια γραμμή — με ό,τι ξέρουμε ήδη για το καθένα. */
export function evidenceCorrectionFields(
  reading: EvidenceReading,
  purpose: string | null,
  row: EvidenceRowKey,
  correction: EvidenceCorrection | null,
): readonly EvidenceCorrectionField[] {
  return evidenceRowFieldSpecs(purpose, row).map((spec) => {
    const machine = machinePrintedOf(reading, spec.key);
    const dispute = reading.fieldConsensus?.find((entry) => entry.field === spec.key && entry.state === 'disputed');
    // Διόρθωση που υπάρχει ⇒ ό,τι άφησε κενό ο άνθρωπος μένει κενό (δεν «ξαναγεμίζει» από τη μηχανή).
    const initial = correction === null ? machineInitial(reading, spec, machine) : correction.values[spec.key] ?? '';
    return { key: spec.key, kind: spec.kind, machine, alternate: present(dispute?.alternate ?? null), initial };
  });
}

/**
 * Ποια από τις δύο αναγνώσεις **περνά τον ελεγκτή** όταν η άλλη δεν περνά — π.χ. ΑΦΜ: το ψηφίο ελέγχου ξεχωρίζει τη
 * σωστή. `null` ⇒ καμία ή και οι δύο (ο άνθρωπος διαλέγει κοιτώντας την εικόνα — ποτέ μαντεψιά).
 */
export function preferredReading(field: EvidenceCorrectionField): string | null {
  // Χωρίς δεύτερη ανάγνωση δεν υπάρχει τίποτα να προτιμηθεί — ισχύει η αρχική τιμή του πεδίου.
  if (field.alternate === null) return null;
  const valid = [field.machine, field.alternate].filter((value): value is string => value !== null && evidenceReadingKey(field.kind, value) !== null);
  return valid.length === 1 ? valid[0] : null;
}
