/**
 * @fileoverview **Νέα τιμή άξονα από τον έλεγχο εισαγωγής** (ADR-923 §5.5.2 Β7). Καθαρό.
 *
 * Ο άξονας είναι `select`: όταν ο πίνακας τυπώνει κωδικούς που καμία επιλογή δεν αναγνωρίζει, ο άνθρωπος φτιάχνει τις επιλογές **από
 * το ίδιο το πλαίσιο ελέγχου**, για όλες τις παραλλαγές μαζί (το Akeneo απορρίπτει την εισαγωγή και στέλνει τον άνθρωπο στις ρυθμίσεις).
 *
 * 🔑 **Απόδειξη πριν την εγγραφή**: κάθε κείμενο κρίνεται με τον **ίδιο** κανόνα που θα το διαβάσει ο αγωγός (`selectOptionCandidates`)
 *    πάνω στο **μελλοντικό** σχήμα. Η οθόνη το δείχνει ανά παραλλαγή και ο διακομιστής το ξανακρίνει: ένας κριτής, όχι δύο.
 * 🔑 Μόνο **προσθήκη** επιλογών: ποτέ αλλαγή ή αφαίρεση υπάρχουσας (αυτά ανήκουν στην οθόνη ιδιοτήτων, με τις κλειδαριές της).
 * 🔑 Ιδεμπότητο: επιλογή που υπάρχει ήδη με τον ίδιο κωδικό **και** την ίδια ετικέτα δεν ξαναπροστίθεται.
 * @module subapps/catalog/import/axis-options-from-review
 */

import { DEFAULT_LANGUAGE } from '@/i18n/languages';
import type { CatalogAttributeDefinition, SelectOption } from '../types/attribute';
import type { ImportProposalRow, ImportValueEdit } from '../types/catalog-import';
import type { ImportAxisOptionDraft as AxisOptionDraft } from '../types/catalog-import-requests';
import { isCatalogCode } from '../vocabulary/catalog-limits';
import { suggestCatalogCode } from '../vocabulary/suggest-catalog-code';
import { fieldAddress } from './human-edits';
import { optionCodeOf } from '../values/value-text-codec';
import { importTargetKey, selectOptionCandidates, selectOptionFor } from './proposal-values';

const AXIS_DRAFT_ISSUES = ['codeInvalid', 'codeTaken', 'codeRepeated', 'labelMissing', 'labelRepeated'] as const;
export type AxisDraftIssue = (typeof AXIS_DRAFT_ISSUES)[number];

/** Τι θα διαβάσει ο αγωγός σε ένα κείμενο με το μελλοντικό σχήμα. */
export type AxisTextVerdict =
  | { readonly kind: 'resolved'; readonly optionCode: string; readonly prefixOf: boolean }
  | { readonly kind: 'unmatched' }
  | { readonly kind: 'ambiguous'; readonly candidates: readonly string[] };

interface AxisOptionsPlan {
  /** Η ιδιότητα με τις νέες επιλογές στο τέλος. */
  readonly next: CatalogAttributeDefinition;
  /** Οι επιλογές που **δεν** υπάρχουν ήδη: αυτές γράφονται. Κενό ⇒ καμία εγγραφή σχήματος. */
  readonly added: readonly SelectOption[];
  /** Ευρήματα ανά θέση πρόχειρου. Κενό ⇒ το πρόχειρο στέκει. */
  readonly issues: ReadonlyMap<number, AxisDraftIssue>;
}

const optionsOf = (attribute: CatalogAttributeDefinition): readonly SelectOption[] => (attribute.type === 'select' ? attribute.config.options : []);
const labelOf = (option: SelectOption): string => option.labels[DEFAULT_LANGUAGE] ?? '';

/** Ο κωδικός της ετικέτας, με επίθημα όταν είναι πιασμένος: ντετερμινιστικά `_2`, `_3`… */
function freeCode(label: string, taken: ReadonlySet<string>): string {
  const base = suggestCatalogCode(label);
  if (base === '' || !taken.has(base)) return base;
  for (let index = 2; ; index += 1) {
    const candidate = `${base}_${index}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Οι γραμμές του πίνακα που ζητούν τιμή άξονα: λείπει (`axisValueMissing`) ή το τυπωμένο δεν είναι επιλογή (`optionUnknown`). */
export function rowsNeedingAxis(rows: readonly ImportProposalRow[], axisAttributeId: string): ImportProposalRow[] {
  const missing = (row: ImportProposalRow): boolean => row.issues.some((issue) => issue.code === 'axisValueMissing' && issue.path === `values.${axisAttributeId}`);
  const unknown = (row: ImportProposalRow): boolean =>
    row.fields.some((field) => field.target.kind === 'attribute' && field.target.attributeId === axisAttributeId && field.issues.some((issue) => issue.code === 'optionUnknown'));
  return rows.filter((row) => row.holderKind === 'product' && (missing(row) || unknown(row)));
}

const AXIS_PATH_PREFIX = 'values.';

/**
 * Οι ιδιότητες που **ίσως** είναι άξονας χωρίς τιμή, από τα ευρήματα μόνο (φθηνό, χωρίς βιβλιοθήκη): ο άξονας κάθε `axisValueMissing`
 * και η ιδιότητα κάθε `optionUnknown`. Αν είναι πράγματι άξονας το κρίνει όποιος έχει το σχήμα.
 */
export function axisCandidatesOf(rows: readonly ImportProposalRow[]): string[] {
  const ids = rows.filter((row) => row.holderKind === 'product').flatMap((row) => [
    ...row.issues.filter((issue) => issue.code === 'axisValueMissing' && issue.path.startsWith(AXIS_PATH_PREFIX)).map((issue) => issue.path.slice(AXIS_PATH_PREFIX.length)),
    ...row.fields.flatMap((field) => (field.target.kind === 'attribute' && field.issues.some((issue) => issue.code === 'optionUnknown') ? [field.target.attributeId] : [])),
  ]);
  return [...new Set(ids)];
}

/** Τι τυπώνει το PDF για μια παραλλαγή, και τι το διόρθωσε ο άνθρωπος (Β6) αν το διόρθωσε. */
export interface AxisRowText {
  readonly rowKey: string;
  readonly printed: string;
  readonly corrected: string | null;
}

/**
 * Το κείμενο κάθε γραμμής όπως το **τυπώνει το PDF** στο πεδίο ταυτότητας (`unique`): ό,τι θα διαβάσει ο αγωγός στη γραμμή κωδικών.
 * Το πεδίο φέρει ήδη τη διόρθωση του Β6, άρα η πηγή έρχεται από τον κατάλογο διορθώσεων (`sourceText` της διόρθωσης).
 */
export function axisRowTexts(rows: readonly ImportProposalRow[], edits: readonly ImportValueEdit[], isUnique: (attributeId: string) => boolean): AxisRowText[] {
  const byAddress = new Map(edits.map((edit) => [fieldAddress(edit.rowKey, edit.targetKey), edit]));
  return rows.map((row) => {
    const identity = row.fields.find((field) => field.target.kind === 'attribute' && isUnique(field.target.attributeId));
    const shown = (identity?.sourceText ?? row.label).trim();
    const edit = identity ? byAddress.get(fieldAddress(row.rowKey, importTargetKey(identity.target))) : undefined;
    const printed = edit ? (edit.sourceText ?? '').trim() : shown;
    return { rowKey: row.rowKey, printed, corrected: printed !== shown ? shown : null };
  });
}

/** Μία πρόταση ανά διαφορετικό κείμενο που **δεν** αναγνωρίζεται σήμερα. Ετικέτα = το τυπωμένο· κωδικός από την ετικέτα. */
export function suggestAxisOptions(attribute: CatalogAttributeDefinition, texts: readonly string[]): AxisOptionDraft[] {
  const taken = new Set(optionsOf(attribute).map((option) => option.code));
  const drafts: AxisOptionDraft[] = [];
  for (const text of new Set(texts.map((entry) => entry.trim()))) {
    if (text === '' || selectOptionFor(attribute, text) !== null) continue;
    const code = freeCode(text, taken);
    taken.add(code);
    drafts.push({ code, label: text });
  }
  return drafts;
}

function draftIssue(draft: AxisOptionDraft, existing: ReadonlyMap<string, SelectOption>, seen: { readonly codes: Set<string>; readonly labels: Set<string> }): AxisDraftIssue | null {
  const label = draft.label.trim();
  if (label === '') return 'labelMissing';
  if (!isCatalogCode(draft.code)) return 'codeInvalid';
  const present = existing.get(draft.code);
  if (present !== undefined && labelOf(present) !== label) return 'codeTaken';
  if (seen.codes.has(draft.code)) return 'codeRepeated';
  if (seen.labels.has(label)) return 'labelRepeated';
  return null;
}

/** Τα πρόχειρα πάνω στην ιδιότητα: ευρήματα ανά θέση, και η ιδιότητα όπως θα γραφτεί. */
export function withAxisOptions(attribute: CatalogAttributeDefinition, drafts: readonly AxisOptionDraft[]): AxisOptionsPlan {
  const existing = new Map(optionsOf(attribute).map((option) => [option.code, option]));
  const seen = { codes: new Set<string>(), labels: new Set<string>() };
  const issues = new Map<number, AxisDraftIssue>();
  const added: SelectOption[] = [];
  drafts.forEach((draft, index) => {
    const issue = draftIssue(draft, existing, seen);
    seen.codes.add(draft.code);
    seen.labels.add(draft.label.trim());
    if (issue !== null) issues.set(index, issue);
    else if (!existing.has(draft.code)) added.push({ code: draft.code, labels: { [DEFAULT_LANGUAGE]: draft.label.trim() } });
  });
  const next = attribute.type === 'select' ? { ...attribute, config: { ...attribute.config, options: [...attribute.config.options, ...added] } } : attribute;
  return { next, added, issues };
}

/**
 * Ο κανόνας του αγωγού σε κάθε κείμενο, με το μελλοντικό σχήμα. `prefixOf` = λύθηκε σε επιλογή που **υπήρχε ήδη**, και μόνο ως
 * **αρχή** του κειμένου (`MFP-68K1M-Q1AA1` → `MFP-68`): ο αγωγός το δέχεται, αλλά ο άνθρωπος πρέπει να το **δει** — μπορεί να είναι
 * άλλη συσκευή με τον ίδιο αριθμό.
 */
export function proveAxisTexts(next: CatalogAttributeDefinition, texts: readonly string[], before: CatalogAttributeDefinition = next): AxisTextVerdict[] {
  const existed = new Set(optionsOf(before).map((option) => option.code));
  return texts.map((text) => {
    const candidates = selectOptionCandidates(next, text);
    if (candidates.length === 1) {
      const prefixOf = existed.has(candidates[0]) && optionCodeOf(optionsOf(next), text) === null;
      return { kind: 'resolved', optionCode: candidates[0], prefixOf };
    }
    return candidates.length === 0 ? { kind: 'unmatched' } : { kind: 'ambiguous', candidates };
  });
}

export const allResolved = (verdicts: readonly AxisTextVerdict[]): boolean => verdicts.length > 0 && verdicts.every((verdict) => verdict.kind === 'resolved');

type AxisLineChoice =
  | { readonly kind: 'found'; readonly line: number }
  | { readonly kind: 'missing' }
  | { readonly kind: 'ambiguous'; readonly lines: readonly number[] };

/**
 * Η γραμμή του πίνακα που δίνει τον άξονα: εκείνη όπου **κάθε** παραλλαγή λύνεται σε επιλογή με το μελλοντικό σχήμα. Δύο τέτοιες ⇒
 * καμία· κανένας κανόνας δεν διαλέγει σιωπηλά. Ίδια τιμή σε δύο παραλλαγές **επιτρέπεται** εδώ: είναι λάθος της πηγής, που ο κριτής
 * δείχνει στο κελί (`axisComboDuplicate`) και ο άνθρωπος διορθώνει (Β6). Το Ε4 (`axisLines`) θα αρνιόταν όλη τη γραμμή γι' αυτό.
 */
export function axisLineOf(next: CatalogAttributeDefinition, lineTexts: readonly (readonly string[])[]): AxisLineChoice {
  const lines = lineTexts.flatMap((texts, line) => (texts.every((text) => text !== '') && allResolved(proveAxisTexts(next, texts)) ? [line] : []));
  if (lines.length === 1) return { kind: 'found', line: lines[0] };
  return lines.length === 0 ? { kind: 'missing' } : { kind: 'ambiguous', lines };
}
