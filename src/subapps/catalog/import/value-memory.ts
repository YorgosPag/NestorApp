/**
 * Η **μνήμη τιμών ανά προμηθευτή** (ADR-923 §5.5.2 Β10, Akeneo SDM Value Mapping) — η καθαρή μηχανή: τι κρίνει, τι εφαρμόζει, τι μαθαίνει.
 *
 * Αφορμή (σελ. 85 ARIES): οι φάσεις τυπώνονται «1Ph». Κανένας κωδικοποιητής δεν το διαβάζει, και δεν πρέπει: συνώνυμο πάνω στην ιδιότητα θα
 * γέμιζε τη βιβλιοθήκη με την ορολογία κάθε προμηθευτή. Ο άνθρωπος το διορθώνει **μία φορά** (1) και η μνήμη του προμηθευτή το εφαρμόζει.
 *
 * 🔑 **Μόνο πηγή που ΔΕΝ διαβάζεται**: η μνήμη συμπληρώνει κενά, ποτέ δεν αλλάζει τιμή που ο αναγνώστης διαβάζει. Η διόρθωση ενός λάθους του
 *    PDF σε ένα προϊόν («10» → «12») δεν γίνεται κανόνας για κάθε «10». Κείμενο (`text`) δεν κρίνεται ποτέ: τα διαβάζει όλα.
 * 🔑 **Θυμάται κείμενο, όχι τιμή**: η απάντηση περνά **κάθε φορά** από τον ίδιο `parseImportCell`. Αν αλλάξει η ιδιότητα (μονάδα, επιλογές),
 *    η μνήμη δεν εφαρμόζεται σιωπηλά — λέει «δεν ισχύει πλέον» (`usable: false`).
 * 🔑 **Εφαρμόζεται ως διόρθωση με προέλευση** (`ImportValueEdit.origin`): περνά από το **ένα** `applyHumanEdits`, με τα ίδια φρένα
 *    (`editSourceChanged`), και ο άνθρωπος είναι πάντα πρώτος — διεύθυνση με διόρθωση δεν την αγγίζει η μνήμη.
 * 🔑 **Μαθαίνει στην έγκριση** και σύγκρουση ⇒ τίποτα (`supplier-memory-core`).
 * @module subapps/catalog/import/value-memory
 */

import { normalizeMixedScriptHomoglyphs } from '@/utils/greek-text';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { ExtractedCell, ExtractedGroup, ImportProposalField, ImportProposalRow, ImportValueEdit, ImportValueMemoryAnswer, ImportValueMemoryDefinition } from '../types/catalog-import';
import type { ImportValueMemoryHint } from '../types/catalog-import-requests';
import { normalizeUniqueText } from '../values/normalize-unique';
import type { ValueTextContext } from '../values/value-text-codec';
import { editsByAddress, fieldAddress, fieldSourcesOf, type EditStamp, type FieldSource } from './human-edits';
import { valueMemoryKey } from './import-keys';
import { importTargetKey, readsImportCell } from './proposal-values';
import { learnedRecords, memoryOriginOf, memoryVerdict, type LearningStamp, type MemoryBook } from './supplier-memory-core';

type ValueMemoryBook = MemoryBook<ImportValueMemoryAnswer>;

/** Το σχήμα και ο κωδικοποιητής της οικογένειας: με αυτά κρίνεται «διαβάζεται;» — ο ίδιος κριτής με την πρόταση. */
export interface ValueMemorySchema {
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly context: ValueTextContext;
}

/** Μία πηγή που η μνήμη τιμών κρίνει: ένα κελί ιδιότητας, που ο κωδικοποιητής της δεν διαβάζει. */
interface UnreadSource {
  readonly attribute: CatalogAttributeDefinition;
  readonly cell: ExtractedCell & { readonly text: string };
}

const reads = (attribute: CatalogAttributeDefinition, text: string, unitCode: string | null, context: ValueTextContext): boolean =>
  readsImportCell(attribute, { text, unitCode }, context);

/** Το κείμενο της πηγής όπως μπαίνει στο κλειδί: η **ίδια** κανονικοποίηση με την ετικέτα γραμμής («1PH» ≡ «1Ph»). */
const valueLabelOf = (text: string): string => normalizeUniqueText(normalizeMixedScriptHomoglyphs(text.trim()));

/**
 * Η πηγή που αφορά τη μνήμη: **ένα** κελί (επαναλήψεις = άλλη απόφαση), ιδιότητα του σχήματος που δεν είναι κείμενο, μονάδα που δεν
 * αμφισβητείται, κείμενο που **δεν** διαβάζεται. Οτιδήποτε άλλο ⇒ `null`.
 */
function unreadSource(source: FieldSource, schema: ValueMemorySchema): UnreadSource | null {
  if (source.cells.length !== 1) return null;
  const [cell] = source.cells;
  const attribute = cell.target.kind === 'attribute' ? schema.attributes.get(cell.target.attributeId) : undefined;
  if (!attribute || attribute.type === 'text' || cell.text === null || cell.text.trim() === '') return null;
  if (cell.flags.some((flag) => flag.code === 'unitUnconfirmed')) return null;
  return reads(attribute, cell.text, cell.unitCode, schema.context) ? null : { attribute, cell: { ...cell, text: cell.text } };
}

const keyOf = (supplierContactId: string, { attribute, cell }: UnreadSource): string =>
  valueMemoryKey(supplierContactId, attribute.id, valueLabelOf(cell.text), cell.unitCode);

/** Οι πηγές χωρίς διόρθωση που δεν διαβάζονται, με το κλειδί τους. */
function openSources(group: ExtractedGroup, edits: readonly ImportValueEdit[] | undefined, supplierContactId: string, schema: ValueMemorySchema) {
  const taken = editsByAddress(edits);
  return fieldSourcesOf(group).flatMap((source) => {
    const unread = taken.has(fieldAddress(source.rowKey, source.targetKey)) ? null : unreadSource(source, schema);
    return unread ? [{ source, unread, key: keyOf(supplierContactId, unread) }] : [];
  });
}

/** Τα κλειδιά μνήμης μιας ανάγνωσης: για ανάγνωση με γνωστά ids, χωρίς ερώτημα (CHECK 3.91). */
export function valueMemoryKeysOf(group: ExtractedGroup, edits: readonly ImportValueEdit[] | undefined, supplierContactId: string, schema: ValueMemorySchema): string[] {
  return [...new Set(openSources(group, edits, supplierContactId, schema).map(({ key }) => key))];
}

export interface ValueMemoryApplication extends ValueMemorySchema {
  readonly supplierContactId: string;
  readonly book: ValueMemoryBook;
  readonly stamp: EditStamp;
}

/** Η απάντηση της μνήμης ισχύει **σήμερα**; Ο ίδιος κωδικοποιητής, με τη μονάδα της στήλης — όπως θα τη διαβάσει η διόρθωση. */
const usable = (answer: ImportValueMemoryAnswer, unread: UnreadSource, context: ValueTextContext): boolean =>
  answer.text.trim() !== '' && reads(unread.attribute, answer.text, unread.cell.unitCode, context);

/**
 * Οι **νέες** διορθώσεις της μνήμης για μια ανάγνωση: μόνο σε πεδία χωρίς διόρθωση, μόνο σε πηγή που δεν διαβάζεται, μόνο με ετυμηγορία
 * `apply`, μόνο αν η απάντηση διαβάζεται σήμερα. Καθαρή και ιδεμπότητη: δεύτερη κλήση με τις διορθώσεις της πρώτης δεν δίνει τίποτα.
 */
export function valueMemoryEditsFor(group: ExtractedGroup, edits: readonly ImportValueEdit[] | undefined, application: ValueMemoryApplication): ImportValueEdit[] {
  if (application.book.size === 0) return [];
  return openSources(group, edits, application.supplierContactId, application).flatMap(({ source, unread, key }) => {
    const entry = application.book.get(key);
    const verdict = memoryVerdict(entry);
    if (!entry || verdict.kind !== 'apply' || !usable(verdict.decision, unread, application.context)) return [];
    const origin = memoryOriginOf(entry.id, verdict);
    return [{ rowKey: source.rowKey, targetKey: source.targetKey, text: verdict.decision.text, sourceText: unread.cell.text, ...application.stamp, origin }];
  });
}

/** Πόσα πεδία εκκρεμών προτάσεων ιδιοτήτων γέμισε η μνήμη τιμών: όσα αναιρεί η «αναίρεση όλων από μνήμη». */
export const memoryEditCount = (proposals: readonly { readonly status: string; readonly purpose: string; readonly edits?: readonly ImportValueEdit[] }[]): number =>
  proposals.filter((proposal) => proposal.status === 'pending' && proposal.purpose === 'attributes')
    .reduce((sum, proposal) => sum + (proposal.edits ?? []).filter((edit) => edit.origin?.kind === 'memory').length, 0);

/** Τι ξέρει η μνήμη για ένα πεδίο που **δεν** εφάρμοσε, χωρίς την πρόταση (τη βάζει ο αναγνώστης της παρτίδας). */
type ValueMemoryHint = Omit<ImportValueMemoryHint, 'proposalId'>;

/** Οι υποδείξεις της μνήμης για τα πεδία που έμειναν χωρίς τιμή — ο **ίδιος** κανόνας `usable` με την εφαρμογή. */
export function valueMemoryHintsFor(group: ExtractedGroup, edits: readonly ImportValueEdit[] | undefined, application: ValueMemoryApplication): ValueMemoryHint[] {
  return openSources(group, edits, application.supplierContactId, application).flatMap(({ source, unread, key }) => {
    const entry = application.book.get(key);
    const verdict = memoryVerdict(entry);
    if (!entry || verdict.kind === 'none') return [];
    const options = entry.decisions.map(({ decision, count, lastBatchId }) => ({ text: decision.text, count, lastBatchId, usable: usable(decision, unread, application.context) }));
    return [{ rowKey: source.rowKey, targetKey: source.targetKey, memoryId: entry.id, verdict: verdict.kind, options }];
  });
}

/* ── Μάθηση στην έγκριση ──────────────────────────────────────────────────────────────────────────────────────────────── */

/** Ένα κλειδί που μαθαίνει η έγκριση, με **κάθε** διακριτή απάντηση της πρότασης (δύο διαφορετικές ⇒ η μνήμη μαθαίνει σύγκρουση). */
export interface LearnableValue {
  readonly key: string;
  readonly attributeId: string;
  readonly label: string;
  readonly printed: string;
  readonly unitCode: string | null;
  readonly answers: readonly string[];
}

/** Η διόρθωση που μαθαίνεται: η πηγή δεν άλλαξε από τότε, δεν διαβάζεται, και η απάντηση διαβάζεται. */
function learnableAnswer(edit: ImportValueEdit, unread: UnreadSource, context: ValueTextContext): string | null {
  if (edit.sourceTexts !== undefined || edit.sourceText !== unread.cell.text) return null;
  const answer = { kind: 'value' as const, text: edit.text.trim() };
  return usable(answer, unread, context) ? answer.text : null;
}

/** Τα πεδία που η έγκριση **δέχεται**: απορριμμένη τιμή δεν διδάσκει τίποτα. */
/** Ό,τι χρειάζεται η μάθηση από τις γραμμές της πρότασης: ποιο πεδίο, ποια απόφαση. */
type DecidedRow = Pick<ImportProposalRow, 'rowKey'> & { readonly fields: readonly Pick<ImportProposalField, 'target' | 'decision'>[] };

const acceptedAddresses = (rows: readonly DecidedRow[]): ReadonlySet<string> =>
  new Set(rows.flatMap((row) => row.fields.filter((field) => field.decision === 'accept').map((field) => fieldAddress(row.rowKey, importTargetKey(field.target)))));

/** Η πρόταση όπως την εγκρίνει ο άνθρωπος: η καθαρή ανάγνωση, οι διορθώσεις, και οι αποφάσεις πεδίων. */
export interface LearningProposal {
  readonly extracted: ExtractedGroup;
  readonly edits?: readonly ImportValueEdit[];
  readonly rows: readonly DecidedRow[];
}

/**
 * Οι τιμές που μαθαίνει η έγκριση μιας πρότασης: οι διορθώσεις της (του ανθρώπου **και** της μνήμης — «N εγκρίσεις») πάνω σε αδιάβαστη
 * πηγή, σε πεδία που η έγκριση δέχεται.
 */
export function learnableValues(proposal: LearningProposal, supplierContactId: string, schema: ValueMemorySchema): LearnableValue[] {
  const edits = editsByAddress(proposal.edits);
  const accepted = acceptedAddresses(proposal.rows);
  const found = new Map<string, LearnableValue>();
  for (const source of fieldSourcesOf(proposal.extracted)) {
    const address = fieldAddress(source.rowKey, source.targetKey);
    const edit = accepted.has(address) ? edits.get(address) : undefined;
    const unread = edit ? unreadSource(source, schema) : null;
    const answer = edit && unread ? learnableAnswer(edit, unread, schema.context) : null;
    if (!unread || answer === null) continue;
    const key = keyOf(supplierContactId, unread);
    const known = found.get(key);
    const answers = known ? [...new Set([...known.answers, answer])] : [answer];
    found.set(key, { key, attributeId: unread.attribute.id, label: valueLabelOf(unread.cell.text), printed: unread.cell.text, unitCode: unread.cell.unitCode, answers });
  }
  return [...found.values()];
}

const sameAnswer = (a: ImportValueMemoryAnswer, b: ImportValueMemoryAnswer): boolean => a.text === b.text;

/** Ο ορισμός του εγγράφου μνήμης μετά την έγκριση: +1 σε κάθε απάντηση που εγκρίθηκε. */
export function learnedValueEntry(current: ImportValueMemoryDefinition | null, supplierContactId: string, value: LearnableValue, stamp: LearningStamp): ImportValueMemoryDefinition {
  const decisions = value.answers.reduce((records, text) => learnedRecords(records, { kind: 'value' as const, text }, sameAnswer, stamp), current?.decisions ?? []);
  return {
    subject: 'value',
    code: value.key,
    supplierContactId,
    attributeId: value.attributeId,
    label: value.label,
    unitCode: value.unitCode,
    printedLabel: value.printed,
    decisions,
  };
}
