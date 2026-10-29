/**
 * **Το πρόχειρο του πλέγματος γραμμών τιμοκαταλόγου** — καθαρό μοντέλο (ADR-923 §5.11 «3δ» Τμήμα 1).
 * @related components/catalog/products/variants/variant-rows.ts (το ίδιο ιδίωμα: πρόχειρο · αλλαγές · rebase)
 * @module components/catalog/pricing/price-line-rows
 *
 * 🔑 **Ταυτότητα γραμμής = το υποκείμενο** (SKU ή εργασία ΑΤΟΕ + περιοχή), όπως στον γραφέα (`priceLineSubjectKey`).
 *    Αλλαγή κωδικού σε αποθηκευμένη γραμμή = **διαγραφή** της παλιάς + **νέα** — ποτέ σιωπηλή μετακόμιση τιμής.
 * 🔑 **Επικύρωση = η ΙΔΙΑ με τον διακομιστή** (`validatePriceListLine` · `validateVersionLines`), ζωντανά ανά κελί.
 * 🔑 **Ζωντανή έκδοση + πρόχειρο** (rebase): γραμμή που άλλαξε **και** εδώ **και** αλλού ⇒ κρατιέται η ζωντανή και η
 *    δική μας αλλαγή **αναφέρεται** — ποτέ «τελευταίος γράφει, κερδίζει» πάνω σε τιμή.
 * 🔑 **Ανάλυση εργασίας** (`costItem`): η τιμή **είναι** το άθροισμα υλικό + εργασία + εξοπλισμός (RIB iTWO) — παράγεται,
 *    δεν πληκτρολογείται, άρα το «άθροισμα ≠ τιμή» δεν μπορεί να συμβεί από το πλέγμα.
 */

import { dequal } from 'dequal';

import { minorFromMajor, sumMinor, type MinorAmount } from '@/lib/money/money';
import { priceLineSubjectKey } from '@/subapps/catalog/pricing/price-line-subject';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validatePriceListLine, validateVersionLines, type PriceLineContext } from '@/subapps/catalog/schema/validate-pricing';
import type { CostBreakdown, PriceLineSubject, PriceListLineDefinition } from '@/subapps/catalog/types/price-list';
import type { PriceLineInput } from '@/subapps/catalog/types/price-list-requests';
import type { PriceListLineWire } from '@/subapps/catalog/types/pricing-views';
import { parseEnteredAmount } from '@/subapps/catalog/values/decimal-amount';
import type { PriceLineSubjectKind, PriceQuantity } from '@/subapps/catalog/vocabulary/pricing';

/** Πώς λύθηκε ο κωδικός: `pending` = στάλθηκε για επίλυση · `unknown` = δεν υπάρχει τέτοιο SKU. */
export type SubjectResolution = 'resolved' | 'pending' | 'unknown';

export interface PriceLineRow {
  /** Σταθερή ταυτότητα της γραμμής στο πλέγμα (αποθηκευμένη: το id της · νέα: προσωρινό). */
  readonly key: string;
  /** Ό,τι βλέπει/γράφει ο άνθρωπος: κωδικός SKU (`variant`) ή κωδικός ΑΤΟΕ (`costItem`). */
  readonly code: string;
  readonly region: string | null;
  readonly subject: PriceLineSubject | null;
  readonly resolution: SubjectResolution;
  readonly netPrice: MinorAmount | null;
  readonly priceQuantity: PriceQuantity;
  readonly unitCode: string;
  readonly discountGroupId: string | null;
  readonly breakdown: CostBreakdown | null;
  /** `null` ⇒ νέα, δεν έχει γραφτεί ακόμη. */
  readonly stored: PriceListLineWire | null;
}

export interface PriceLineDraft {
  readonly rows: readonly PriceLineRow[];
  /** Αποθηκευμένες γραμμές που ο άνθρωπος αφαίρεσε. */
  readonly removed: readonly PriceListLineWire[];
}

const MAX_PRICE_DECIMALS = 2;

/** Κείμενο τιμής → λεπτά: «12,50» · «1.200,5» — **ποτέ** τρίτο δεκαδικό (θα στρογγυλευόταν σιωπηλά) ή αρνητικό. */
export function minorFromEnteredText(text: string): MinorAmount | null {
  const parsed = parseEnteredAmount(text);
  if (parsed === null || parsed.decimals > MAX_PRICE_DECIMALS || parsed.value < 0) return null;
  return minorFromMajor(parsed.value);
}

export const EMPTY_BREAKDOWN: CostBreakdown = { material: 0, labor: 0, equipment: 0, defaultWasteBp: 0, materialVariantId: null };

/** Η τιμή μιας γραμμής εργασίας **είναι** το άθροισμα της ανάλυσής της. */
export const breakdownTotal = (breakdown: CostBreakdown): MinorAmount =>
  sumMinor([breakdown.material, breakdown.labor, breakdown.equipment]);

/**
 * Ό,τι βλέπει ο άνθρωπος για ένα υποκείμενο: ο κωδικός SKU (από το `expand` της όψης) ή ο κωδικός ΑΤΟΕ — `null` αν η
 * παραλλαγή δεν ζει πια. Ένα σημείο για το πλέγμα και την προεπισκόπηση δημοσίευσης.
 */
export function subjectCodeOf(subject: PriceLineSubject, skuIdentifiers: Readonly<Record<string, string>>): string | null {
  return subject.kind === 'variant' ? (skuIdentifiers[subject.variantId] ?? null) : subject.atoeCode;
}

export function rowOfStored(line: PriceListLineWire, skuIdentifiers: Readonly<Record<string, string>>): PriceLineRow {
  const { subject } = line;
  const code = subjectCodeOf(subject, skuIdentifiers);
  return {
    key: line.id,
    code: code ?? '',
    region: subject.kind === 'costItem' ? subject.region : null,
    subject,
    // Παραλλαγή που δεν ζει πια (δεν ήρθε κωδικός της) ⇒ «άγνωστο»: η οθόνη το λέει, δεν το κρύβει.
    resolution: code === null ? 'unknown' : 'resolved',
    netPrice: line.netPrice,
    priceQuantity: line.priceQuantity,
    unitCode: line.unitCode,
    discountGroupId: line.discountGroupId,
    breakdown: line.breakdown,
    stored: line,
  };
}

export function priceLineDraftOf(lines: readonly PriceListLineWire[], skuIdentifiers: Readonly<Record<string, string>>): PriceLineDraft {
  const rows = lines.map((line) => rowOfStored(line, skuIdentifiers)).sort((a, b) => a.code.localeCompare(b.code));
  return { rows, removed: [] };
}

export function newPriceLineRow(mode: PriceLineSubjectKind, key: string, unitCode: string): PriceLineRow {
  return {
    key,
    code: '',
    region: null,
    subject: null,
    resolution: 'pending',
    netPrice: mode === 'costItem' ? 0 : null,
    priceQuantity: 1,
    unitCode,
    discountGroupId: null,
    breakdown: mode === 'costItem' ? EMPTY_BREAKDOWN : null,
    stored: null,
  };
}

/** Ο άνθρωπος έγραψε κωδικό SKU: το υποκείμενο **περιμένει** επίλυση (ποτέ η παλιά ταυτότητα με νέο κωδικό). */
export function withEnteredCode(row: PriceLineRow, text: string): PriceLineRow {
  const code = text.trim();
  return code === row.code ? row : { ...row, code, subject: null, resolution: 'pending' };
}

/**
 * Η απάντηση της επίλυσης του `code`: κάθε γραμμή που **ακόμη** περιμένει αυτόν τον κωδικό παίρνει την παραλλαγή ή
 * γίνεται «άγνωστο SKU». Γραμμή που στο μεταξύ άλλαξε κωδικό δεν αγγίζεται — αργή απάντηση δεν γράφει σε ξένη γραμμή.
 */
export function resolvePriceLineCode(draft: PriceLineDraft, code: string, variantId: string | null): PriceLineDraft {
  let touched = false;
  const rows = draft.rows.map((row) => {
    if (row.resolution !== 'pending' || row.code !== code) return row;
    touched = true;
    return variantId === null
      ? { ...row, subject: null, resolution: 'unknown' as const }
      : { ...row, subject: { kind: 'variant' as const, variantId }, resolution: 'resolved' as const };
  });
  return touched ? { ...draft, rows } : draft;
}

/** Οι κωδικοί που περιμένουν επίλυση (μοναδικοί). */
export const pendingCodes = (draft: PriceLineDraft): readonly string[] =>
  [...new Set(draft.rows.filter((row) => row.resolution === 'pending' && row.code !== '').map((row) => row.code))];

/** Κωδικός ΑΤΟΕ + περιοχή ⇒ υποκείμενο (σύγχρονα — δεν χρειάζεται αναζήτηση). */
export function costItemSubject(code: string, region: string | null): PriceLineSubject | null {
  const atoeCode = code.trim();
  return atoeCode === '' ? null : { kind: 'costItem', atoeCode, region: region === null || region.trim() === '' ? null : region.trim() };
}

/** Η γραμμή όπως θα σταλεί — `null` αν λείπει υποκείμενο ή τιμή (δεν στέλνεται, φαίνεται ως εύρημα). */
export function lineInputOf(row: PriceLineRow): PriceLineInput | null {
  if (row.subject === null || row.resolution !== 'resolved' || row.netPrice === null) return null;
  return {
    subject: row.subject,
    netPrice: row.breakdown === null ? row.netPrice : breakdownTotal(row.breakdown),
    priceQuantity: row.priceQuantity,
    unitCode: row.unitCode,
    discountGroupId: row.discountGroupId,
    breakdown: row.breakdown,
  };
}

function storedInputOf(stored: PriceListLineWire): PriceLineInput {
  const { subject, netPrice, priceQuantity, unitCode, discountGroupId, breakdown } = stored;
  return { subject, netPrice, priceQuantity, unitCode, discountGroupId, breakdown };
}

const subjectMoved = (row: PriceLineRow): boolean =>
  row.stored !== null && (row.subject === null || priceLineSubjectKey(row.subject) !== priceLineSubjectKey(row.stored.subject));

export function isRowChanged(row: PriceLineRow): boolean {
  if (row.stored === null) return true;
  const input = lineInputOf(row);
  return input === null || !dequal(input, storedInputOf(row.stored));
}

export const isPriceLineDraftDirty = (draft: PriceLineDraft): boolean => draft.removed.length > 0 || draft.rows.some(isRowChanged);

/** Η αλλαγή που στέλνεται: νέες/αλλαγμένες γραμμές + διαγραφές (αφαιρεμένες, και η παλιά ταυτότητα όσων άλλαξαν κωδικό). */
export function priceLineChangesOf(draft: PriceLineDraft): { readonly upserts: readonly PriceLineInput[]; readonly deletes: readonly PriceLineSubject[] } {
  const changed = draft.rows.filter(isRowChanged);
  const upserts = changed.flatMap((row) => {
    const input = lineInputOf(row);
    return input === null ? [] : [input];
  });
  const moved = changed.filter(subjectMoved).flatMap((row) => (row.stored ? [row.stored.subject] : []));
  return { upserts, deletes: [...draft.removed.map((line) => line.subject), ...moved] };
}

// ── Ευρήματα (η ίδια επικύρωση με τον διακομιστή) ────────────────────────────

function definitionOf(row: PriceLineRow): PriceListLineDefinition | null {
  const input = lineInputOf(row);
  return input === null ? null : { ...input, versionId: '' };
}

/** Το υποκείμενο: κενός κωδικός · άγνωστο SKU· σε επίλυση ⇒ κανένα εύρημα (απλώς δεν στέλνεται ακόμη). */
function subjectIssues(row: PriceLineRow): CatalogIssue[] {
  if (row.code.trim() === '') return [{ code: 'priceLineSubjectRequired', path: 'subject' }];
  return row.resolution === 'unknown' ? [{ code: 'priceLineSkuUnknown', path: 'subject' }] : [];
}

function ownIssues(row: PriceLineRow, context: PriceLineContext): CatalogIssue[] {
  const subject = subjectIssues(row);
  const price: CatalogIssue[] = row.netPrice === null ? [{ code: 'priceAmountInvalid', path: 'netPrice' }] : [];
  const definition = definitionOf(row);
  return [...subject, ...price, ...(definition === null ? [] : validatePriceListLine(definition, context))];
}

/** Κάποια γραμμή περιμένει ακόμη την επίλυση του κωδικού της ⇒ η αποθήκευση περιμένει. */
export const hasPendingResolution = (draft: PriceLineDraft): boolean =>
  draft.rows.some((row) => row.resolution === 'pending' && row.code.trim() !== '');

/** Ευρήματα ανά γραμμή (κλειδί γραμμής → ευρήματα με διαδρομή **πεδίου**), μαζί με τα διπλότυπα υποκειμένου. */
export function priceLineIssues(draft: PriceLineDraft, context: PriceLineContext): ReadonlyMap<string, readonly CatalogIssue[]> {
  const result = new Map<string, CatalogIssue[]>();
  const add = (key: string, issues: readonly CatalogIssue[]) => { if (issues.length > 0) result.set(key, [...(result.get(key) ?? []), ...issues]); };
  draft.rows.forEach((row) => add(row.key, ownIssues(row, context)));
  const sendable = draft.rows.flatMap((row) => {
    const definition = definitionOf(row);
    return definition === null ? [] : [{ row, definition }];
  });
  for (const issue of validateVersionLines(sendable.map((entry) => entry.definition))) {
    const index = Number(/^lines\[(\d+)\]/.exec(issue.path)?.[1]);
    const entry = sendable[index];
    if (entry) add(entry.row.key, [{ ...issue, path: 'subject' }]);
  }
  return result;
}

// ── Rebase πάνω στη ζωντανή έκδοση ───────────────────────────────────────────

export interface RebasedPriceLines {
  readonly draft: PriceLineDraft;
  /** Γραμμές που άλλαξαν **και** εδώ **και** αλλού: κρατήθηκε η ζωντανή, η δική μας αλλαγή αναφέρεται (κωδικοί). */
  readonly conflicts: readonly string[];
}

/**
 * Νέα γραμμή του προχείρου που υπάρχει πλέον **αποθηκευμένη** (ίδιο υποκείμενο): η δική μας αποθήκευση έφτασε ⇒ η ζωντανή·
 * άλλος πρόσθεσε το ίδιο SKU με άλλη τιμή ⇒ κερδίζει η ζωντανή και η δική μας **αναφέρεται** — ποτέ δύο γραμμές ίδιου SKU.
 */
function rebaseNewRow(row: PriceLineRow, liveBySubject: ReadonlyMap<string, PriceLineRow>, conflicts: string[]): PriceLineRow {
  const twin = row.subject === null ? undefined : liveBySubject.get(priceLineSubjectKey(row.subject));
  if (!twin) return row;
  if (!dequal(lineInputOf(twin), lineInputOf(row))) conflicts.push(row.code);
  return twin;
}

function rebaseRow(row: PriceLineRow, live: PriceLineRow | undefined, conflicts: string[]): PriceLineRow | null {
  if (!live) return isRowChanged(row) ? { ...row, stored: null } : null;
  if (live.stored?.revision === row.stored.revision) return row;
  // Η ζωντανή έγινε ΙΔΙΑ με το πρόχειρο ⇒ η αλλαγή ήταν η δική μας (η αποθήκευση μόλις γράφτηκε) — όχι σύγκρουση.
  if (dequal(lineInputOf(live), lineInputOf(row))) return live;
  if (isRowChanged(row)) conflicts.push(row.code);
  return live;
}

export function rebasePriceLineDraft(draft: PriceLineDraft, base: PriceLineDraft): RebasedPriceLines {
  const live = new Map(base.rows.map((row) => [row.key, row]));
  const liveBySubject = new Map(base.rows.flatMap((row) => (row.subject ? [[priceLineSubjectKey(row.subject), row] as const] : [])));
  const conflicts: string[] = [];
  const rows = draft.rows
    .map((row) => (row.stored === null ? rebaseNewRow(row, liveBySubject, conflicts) : rebaseRow(row, live.get(row.key), conflicts)))
    .filter((row): row is PriceLineRow => row !== null);
  const known = new Set([...rows.map((row) => row.key), ...draft.removed.map((line) => line.id)]);
  const added = base.rows.filter((row) => !known.has(row.key));
  const removed = draft.removed.filter((line) => live.has(line.id));
  return { draft: { rows: [...rows, ...added], removed }, conflicts };
}
