/**
 * @fileoverview **Η ΣΥΓΧΩΝΕΥΣΗ ΜΙΑΣ ΕΠΕΞΕΡΓΑΣΙΑΣ ΑΓΓΕΛΙΑΣ** — γράφεται μόνο ό,τι άλλαξε ο άνθρωπος, πάνω στο φρέσκο
 * έγγραφο· ερώτηση μόνο όταν δύο άλλαξαν το **ίδιο** πεδίο σε **άλλη** τιμή.
 * @related ADR-953 §3 · services/owner-property/owner-property-content-update.ts (η κρίση του διακομιστή) ·
 *   hooks/owner-property/useOwnerListingEdit.ts (η φόρμα)
 * @module lib/owner-property/owner-property-edit
 *
 * 🔑 **Καθαρές συναρτήσεις, καμία I/O** — η ίδια μηχανή τρέχει στον περιηγητή (ποια πεδία άλλαξα;) και στον
 * διακομιστή (συγκρούονται με ό,τι γράφτηκε στο μεταξύ;). Δύο υλοποιήσεις θα διαφωνούσαν στο τι σημαίνει «ίδια τιμή».
 *
 * 🔴 **Η ΕΚΔΟΣΗ ΕΙΝΑΙ ΤΟΥ ΠΕΡΙΕΧΟΜΕΝΟΥ, ΟΧΙ ΤΟΥ ΕΓΓΡΑΦΟΥ** (`OwnerProperty.contentEdit.at`). Το `updatedAt` το
 * ανεβάζουν και πράξεις που **δεν** αγγίζουν πεδία του προσχεδίου (απόσυρση · κοινό · εντολή · δηλώσεις)· κριτήριο
 * πάνω του θα ρωτούσε τον άνθρωπο για «σύγκρουση» με μια αλλαγή κοινού. Τα πεδία του προσχεδίου έχουν **έναν**
 * γραφέα, άρα μία σφραγίδα αρκεί — και λέει **ποιος**.
 */

import { sortKeysDeep } from '@/lib/sort-keys-deep';
import type { OwnerPropertyDraft } from '@/types/owner-property';

// =============================================================================
// 1. ΤΑ ΠΕΔΙΑ ΚΑΙ Ο ΤΡΟΠΟΣ ΠΟΥ ΣΥΓΧΩΝΕΥΕΤΑΙ ΤΟ ΚΑΘΕΝΑ — μία δήλωση
// =============================================================================

/**
 * Πώς συγχωνεύεται ένα πεδίο του προσχεδίου.
 *
 * - `whole` — μία τιμή· δύο διαφορετικές αλλαγές ⇒ σύγκρουση.
 * - `per-file` — χάρτης `fileId → τιμή`· κρίνεται **ανά αρχείο** (δύο λεζάντες σε άλλες φωτογραφίες δεν συγκρούονται).
 * - `file-set` — η δήλωση `publishedFileIds`· ενώνεται ως **σύνολο** και δεν συγκρούεται ποτέ.
 */
type DraftFieldMerge = 'whole' | 'per-file' | 'file-set';

/**
 * ⚠️ **`Record<keyof OwnerPropertyDraft, …>`**: νέο πεδίο στο προσχέδιο **δεν μεταγλωττίζεται** μέχρι να δηλωθεί
 * εδώ πώς συγχωνεύεται — αλλιώς θα έμενε έξω από το `changed` και δεν θα γραφόταν **ποτέ**.
 */
const OWNER_PROPERTY_DRAFT_MERGE: Record<keyof OwnerPropertyDraft, DraftFieldMerge> = {
  title: 'whole',
  type: 'whole',
  areaSqm: 'whole',
  floor: 'whole',
  floorKind: 'whole',
  unitNumber: 'whole',
  bedrooms: 'whole',
  offers: 'whole',
  place: 'whole',
  media: 'whole',
  publishedFileIds: 'file-set',
  publishedFileFocalPoints: 'per-file',
  publishedFileCaptureSpots: 'per-file',
  publishedFileFloorplanNorth: 'per-file',
  publishedFileCaptions: 'per-file',
};

export type OwnerPropertyDraftField = keyof OwnerPropertyDraft;

/** Τα πεδία του προσχεδίου, με σταθερή σειρά — η σειρά της δήλωσης από πάνω. */
export const OWNER_PROPERTY_DRAFT_FIELDS = Object.keys(OWNER_PROPERTY_DRAFT_MERGE) as readonly OwnerPropertyDraftField[];

export function isOwnerPropertyDraftField(value: unknown): value is OwnerPropertyDraftField {
  return typeof value === 'string' && Object.hasOwn(OWNER_PROPERTY_DRAFT_MERGE, value);
}

// =============================================================================
// 2. ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΟΥ ΑΙΤΗΜΑΤΟΣ
// =============================================================================

/** Το μέλος `_edit` του `PATCH /api/owner-properties/{id}` — τι άλλαξε ο άνθρωπος, και πάνω σε ποια έκδοση. */
export interface OwnerPropertyEdit {
  /** Το `contentEdit.at` του εγγράφου που φόρτωσε η φόρμα· `null` = το έγγραφο δεν είχε ακόμη σφραγίδα. */
  readonly baseContentAt: string | null;
  /** Ποια πεδία άλλαξε ο άνθρωπος σε σχέση με ό,τι φόρτωσε. */
  readonly changed: readonly OwnerPropertyDraftField[];
  /** Η τιμή-βάση **μόνο** των αλλαγμένων πεδίων (απουσία κλειδιού = το πεδίο δεν υπήρχε). */
  readonly base: Partial<OwnerPropertyDraft>;
  /** Δεύτερη αποστολή μετά από 409: «κράτα τη δική μου» σε αυτά τα πεδία. */
  readonly keepMine: readonly OwnerPropertyDraftField[];
}

/** Τι έκρινε η συγχώνευση. */
type OwnerPropertyEditMerge =
  | {
      readonly kind: 'merged';
      /** Το πλήρες προσχέδιο που θα γραφτεί: οι τιμές του διακομιστή, με τις δικές μου αλλαγές από πάνω. */
      readonly draft: OwnerPropertyDraft;
      /** Ποια πεδία διαφέρουν πράγματι από το τρέχον έγγραφο — κενό ⇒ δεν υπάρχει τίποτα να γραφτεί. */
      readonly written: readonly OwnerPropertyDraftField[];
    }
  | { readonly kind: 'conflict'; readonly fields: readonly OwnerPropertyDraftField[] };

/**
 * **Η σύγκρουση όπως ταξιδεύει στο 409** — ποια πεδία, πότε, και με ποιον.
 *
 * 🔑 Το «ποιος» είναι **όνομα** και **«εσύ ο ίδιος»**, ποτέ uid: η οθόνη δεν έχει τι να κάνει με ταυτότητα, και το
 * `bySelf` ξεχωρίζει τη δεύτερη καρτέλα του ίδιου ανθρώπου από τον συνεργάτη.
 */
export interface OwnerListingConflict {
  readonly fields: readonly OwnerPropertyDraftField[];
  /** Πότε γράφτηκε το περιεχόμενο που συγκρούεται· `null` = έγγραφο χωρίς σφραγίδα. */
  readonly at: string | null;
  readonly bySelf: boolean;
  readonly byName: string | null;
}

/** Το `conflict` ενός σώματος 409 — `null` αν δεν έχει το σχήμα (ποτέ ελεύθερο κείμενο διακομιστή στην οθόνη). */
export function ownerListingConflictFrom(value: unknown): OwnerListingConflict | null {
  if (value === null || typeof value !== 'object') return null;
  const { fields, at, bySelf, byName } = value as Readonly<Record<string, unknown>>;
  if (!Array.isArray(fields)) return null;
  const named = fields.filter(isOwnerPropertyDraftField);
  if (named.length === 0) return null;
  return {
    fields: named,
    at: typeof at === 'string' ? at : null,
    bySelf: bySelf === true,
    byName: typeof byName === 'string' && byName.trim() !== '' ? byName : null,
  };
}

// =============================================================================
// 3. ΙΣΟΤΗΤΑ ΤΙΜΩΝ — μία διατύπωση
// =============================================================================

/**
 * Βαθιά ισότητα, αδιάφορη στη σειρά κλειδιών· `undefined` ≡ απόν κλειδί (το JSON τα πετά και τα δύο).
 * ⚠️ `null` ≠ απόν: «δεν καταχωρήθηκε» είναι **τιμή** σε αυτό το μοντέλο.
 */
function sameDraftValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortKeysDeep(a)) === JSON.stringify(sortKeysDeep(b));
}

type FileMap = Readonly<Record<string, unknown>>;

const fileMapOf = (value: unknown): FileMap =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as FileMap) : {};

const fileIdsOf = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];

// =============================================================================
// 4. ΠΕΛΑΤΗΣ — ποια πεδία άλλαξα;
// =============================================================================

/**
 * **Το `_edit` μιας αποθήκευσης**: προσχέδιο τώρα έναντι προσχεδίου-βάσης.
 *
 * 🔴 **Και τα δύο προσχέδια από την ΙΔΙΑ μηχανή** (`ownerPropertyDraftFrom`). Ποτέ σύγκριση προσχεδίου με ωμό
 * έγγραφο: η διαδρομή έγγραφο → φόρμα → προσχέδιο δεν είναι εγγυημένα ταυτοτική, και κάθε διαφορά κανονικοποίησης
 * θα φαινόταν «αλλαγή του ανθρώπου».
 */
export function ownerPropertyEditOf(
  baseDraft: OwnerPropertyDraft,
  draft: OwnerPropertyDraft,
  baseContentAt: string | null,
  keepMine: readonly OwnerPropertyDraftField[] = [],
): OwnerPropertyEdit {
  const changed = OWNER_PROPERTY_DRAFT_FIELDS.filter((field) => !sameDraftValue(baseDraft[field], draft[field]));
  return {
    baseContentAt,
    changed,
    base: pickDraftFields(baseDraft, changed),
    keepMine: keepMine.filter((field) => changed.includes(field)),
  };
}

/** Τα ζητούμενα πεδία ενός (μερικού) προσχεδίου — **χωρίς** `undefined` κλειδιά (το Firestore και το JSON τα πετούν). */
export function pickDraftFields(
  source: Partial<OwnerPropertyDraft>,
  fields: readonly OwnerPropertyDraftField[],
): Partial<OwnerPropertyDraft> {
  const picked: Partial<Record<OwnerPropertyDraftField, unknown>> = {};
  for (const field of fields) {
    if (source[field] !== undefined) picked[field] = source[field];
  }
  return picked as Partial<OwnerPropertyDraft>;
}

// =============================================================================
// 5. ΔΙΑΚΟΜΙΣΤΗΣ — συγκρούονται με ό,τι γράφτηκε στο μεταξύ;
// =============================================================================

/** Ό,τι χρειάζεται η κρίση ενός πεδίου. */
interface FieldCase {
  readonly mine: unknown;
  readonly base: unknown;
  readonly theirs: unknown;
  /** Έγραψε κάποιος περιεχόμενο μετά το φόρτωμα της φόρμας; */
  readonly concurrent: boolean;
  readonly keepMine: boolean;
}

/** Η έκβαση ενός πεδίου: η τιμή που γράφεται, ή σύγκρουση. */
type FieldVerdict = { readonly value: unknown } | 'conflict';

/** Ο πίνακας του ADR-953 §3.3, για **μία** τιμή. */
function mergeWhole({ mine, base, theirs, concurrent, keepMine }: FieldCase): FieldVerdict {
  if (!concurrent || keepMine || sameDraftValue(theirs, base)) return { value: mine };
  if (sameDraftValue(theirs, mine)) return { value: theirs };
  return 'conflict';
}

/** Ο ίδιος πίνακας, **ανά αρχείο**: κρίνεται μόνο το αρχείο που άλλαξα εγώ. */
function mergePerFile(fieldCase: FieldCase): FieldVerdict {
  if (!fieldCase.concurrent) return { value: fieldCase.mine };

  const [mine, base, theirs] = [fileMapOf(fieldCase.mine), fileMapOf(fieldCase.base), fileMapOf(fieldCase.theirs)];
  const merged: Record<string, unknown> = { ...theirs };
  let conflicted = false;

  for (const fileId of new Set([...Object.keys(base), ...Object.keys(mine)])) {
    if (sameDraftValue(mine[fileId], base[fileId])) continue;
    const verdict = mergeWhole({ ...fieldCase, mine: mine[fileId], base: base[fileId], theirs: theirs[fileId] });
    if (verdict === 'conflict') conflicted = true;
    else if (verdict.value === undefined) delete merged[fileId];
    else merged[fileId] = verdict.value;
  }
  return conflicted ? 'conflict' : { value: merged };
}

/**
 * Η δήλωση αρχείων ως **σύνολο**: οι αφαιρέσεις και οι προσθήκες μου πάνω στη δήλωση του διακομιστή.
 * ⚠️ Όταν άλλαξε και ο άλλος τη δήλωση, κρατιέται η **δική του** σειρά (η αναδιάταξή μου χάνεται — ADR-953 §5).
 */
function mergeFileSet({ mine, base, theirs, concurrent }: FieldCase): FieldVerdict {
  if (!concurrent || mine === undefined || sameDraftValue(theirs, base)) return { value: mine };

  const [mineIds, baseIds, theirIds] = [fileIdsOf(mine), fileIdsOf(base), fileIdsOf(theirs)];
  const removed = new Set(baseIds.filter((id) => !mineIds.includes(id)));
  const kept = theirIds.filter((id) => !removed.has(id));
  const added = mineIds.filter((id) => !baseIds.includes(id) && !kept.includes(id));
  return { value: [...kept, ...added] };
}

const FIELD_MERGERS: Record<DraftFieldMerge, (fieldCase: FieldCase) => FieldVerdict> = {
  whole: mergeWhole,
  'per-file': mergePerFile,
  'file-set': mergeFileSet,
};

/** Τα πεδία του προσχεδίου όπως τα κρατά ένα έγγραφο — χωρίς `undefined` κλειδιά. */
export function draftFieldsOf(source: OwnerPropertyDraft): OwnerPropertyDraft {
  // ⚠️ Τα υποχρεωτικά πεδία υπάρχουν στην πηγή (ο τύπος της το εγγυάται)· πέφτουν μόνο τα απόντα προαιρετικά.
  return pickDraftFields(source, OWNER_PROPERTY_DRAFT_FIELDS) as OwnerPropertyDraft;
}

/**
 * **Συγχώνευση τριών δρόμων ανά πεδίο** (ADR-953 §3.3).
 *
 * @param current — τα πεδία του προσχεδίου όπως είναι **τώρα** στο έγγραφο (φρέσκια ανάγνωση συναλλαγής).
 * @param currentContentAt — το `contentEdit.at` του φρέσκου εγγράφου· `null` = καμία σφραγίδα ακόμη.
 * @param draft — το πλήρες προσχέδιο της φόρμας.
 * @param edit — τι δηλώνει η φόρμα ότι άλλαξε, και πάνω σε ποια έκδοση.
 */
export function mergeOwnerPropertyEdit(
  current: OwnerPropertyDraft,
  currentContentAt: string | null,
  draft: OwnerPropertyDraft,
  edit: OwnerPropertyEdit,
): OwnerPropertyEditMerge {
  const concurrent = currentContentAt !== edit.baseContentAt;
  const merged: Record<string, unknown> = { ...draftFieldsOf(current) };
  const conflicts: OwnerPropertyDraftField[] = [];

  for (const field of edit.changed) {
    const verdict = FIELD_MERGERS[OWNER_PROPERTY_DRAFT_MERGE[field]]({
      mine: draft[field],
      base: edit.base[field],
      theirs: current[field],
      concurrent,
      keepMine: edit.keepMine.includes(field),
    });
    if (verdict === 'conflict') conflicts.push(field);
    else if (verdict.value === undefined) delete merged[field];
    else merged[field] = verdict.value;
  }
  if (conflicts.length > 0) return { kind: 'conflict', fields: conflicts };

  const next = merged as unknown as OwnerPropertyDraft;
  const written = OWNER_PROPERTY_DRAFT_FIELDS.filter((field) => !sameDraftValue(current[field], next[field]));
  return { kind: 'merged', draft: next, written };
}
