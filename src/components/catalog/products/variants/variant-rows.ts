/**
 * **Το πρόχειρο του πλέγματος παραλλαγών** — καθαρό (ADR-923 §5.10.4 Β4).
 *
 * Γραμμή = μία παραλλαγή (SKU) του μοντέλου· στήλες = οι **άξονες** του επιπέδου + οι ιδιότητες που **κατέχει** το
 * επίπεδο (Δ1). Από το πρόχειρο βγαίνουν: το σύνολο προς κρίση (`editAggregate`), η **μία** δέσμη αποστολής (μόνο ό,τι
 * άλλαξε — CAS ανά παραλλαγή, νέες με id γεννημένο στον πελάτη) και τα ευρήματα **ανά κελί**.
 *
 * @module components/catalog/products/variants/variant-rows
 */

import { dequal } from 'dequal';

import type { StoredMemberShape, StoredProductShape } from '@/subapps/catalog/aggregate/aggregate-members';
import { productDefinitionOf, type AggregateEdits } from '@/subapps/catalog/aggregate/edit-aggregate';
import { memberPath } from '@/subapps/catalog/aggregate/judge-aggregate';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { VariantScheme } from '@/subapps/catalog/types/family';
import type { CatalogProductDefinition, ProductValues } from '@/subapps/catalog/types/product';
import type { VariantBatch } from '@/subapps/catalog/types/product-requests';
import { axesAtDepth, leafDepth } from '@/subapps/catalog/values/attribute-levels';

export interface VariantRow {
  /** Σταθερή ταυτότητα της γραμμής = το id της παραλλαγής (οι νέες το παίρνουν στον πελάτη). */
  readonly id: string;
  readonly definition: CatalogProductDefinition;
  /** `null` ⇒ νέα (δεν έχει γραφτεί ακόμη). */
  readonly stored: StoredProductShape | null;
}

export interface VariantDraft {
  readonly rows: readonly VariantRow[];
  /** Αποθηκευμένες παραλλαγές που ο άνθρωπος αφαίρεσε. */
  readonly removed: readonly StoredProductShape[];
}

/** Οι στήλες του επιπέδου: πρώτα οι άξονες, μετά οι ιδιότητες που κατέχει το επίπεδο. `null` ⇒ τα παιδιά δεν είναι SKU. */
export function variantColumnIds(scheme: VariantScheme | null, parentDepth: number): readonly string[] | null {
  const childDepth = parentDepth + 1;
  if (!scheme || childDepth !== leafDepth(scheme)) return null;
  const level = scheme.levels[childDepth - 1];
  return [...axesAtDepth(scheme, childDepth), ...level.attributeIds.filter((id) => !level.axisAttributeIds.includes(id))];
}

/** Το πρόχειρο από τα ζωντανά μέλη: οι παραλλαγές με γονέα `parentId`, με τη σειρά των αξόνων τους (σταθερή). */
export function variantDraftOf(members: readonly StoredMemberShape[], parentId: string): VariantDraft {
  const rows = members
    .filter((member): member is Extract<StoredMemberShape, { kind: 'product' }> => member.kind === 'product' && member.record.modelId === parentId)
    .map((member) => ({ id: member.record.id, definition: productDefinitionOf(member.record), stored: member.record }))
    .sort((a, b) => (a.stored.derived?.sortKey ?? a.id).localeCompare(b.stored.derived?.sortKey ?? b.id));
  return { rows, removed: [] };
}

/** Νέες γραμμές από τις τιμές αξόνων του γεννήτορα (id γεννημένο στον πελάτη). */
export function newVariantRows(combos: readonly ProductValues[], template: Pick<CatalogProductDefinition, 'modelId' | 'familyId'>, idOf: () => string): VariantRow[] {
  return combos.map((values) => ({ id: idOf(), stored: null, definition: { ...template, values, noValueReasons: {}, categoryIds: [] } }));
}

/** Ισότητα **περιεχομένου** (όχι σειράς κλειδιών): το Firestore επιστρέφει τα maps με άλλη σειρά απ' ό,τι τα έχτισε η επικόλληση. */
const sameDefinition = (a: CatalogProductDefinition, b: CatalogProductDefinition) => dequal(a, b);

/** Άλλαξε η γραμμή σε σχέση με ό,τι είναι γραμμένο; (νέα ⇒ πάντα) */
export function isRowChanged(row: VariantRow): boolean {
  return row.stored === null || !sameDefinition(row.definition, productDefinitionOf(row.stored));
}

/** Το σύνολο προς κρίση: ενημερώσεις όσων άλλαξαν, νέες, διαγραφές. */
export function variantEdits(draft: VariantDraft): AggregateEdits {
  const updates = new Map(draft.rows.filter((row) => row.stored !== null && isRowChanged(row)).map((row) => [row.id, row.definition] as const));
  const creates = draft.rows.filter((row) => row.stored === null).map((row) => ({ id: row.id, definition: row.definition }));
  return { updates, creates, deletes: draft.removed.map((record) => record.id) };
}

/** Η **μία** δέσμη `PUT …/variants` — μόνο ό,τι άλλαξε, CAS ανά παραλλαγή. */
export function variantBatchOf(draft: VariantDraft): VariantBatch {
  const upserts = draft.rows.filter(isRowChanged).map((row) => (row.stored === null
    ? { id: row.id, expectedRevision: null, definition: row.definition }
    : { id: row.id, expectedRevision: row.stored.revision, definition: row.definition }));
  return { upserts, deletes: draft.removed.map((record) => ({ id: record.id, expectedRevision: record.revision })) };
}

export function isDraftDirty(draft: VariantDraft): boolean {
  return draft.removed.length > 0 || draft.rows.some(isRowChanged);
}

/** Τα ευρήματα ενός κελιού (`variants.<id>.values.<attr>` και ό,τι από κάτω). */
export function cellIssues(issues: readonly CatalogIssue[], rowId: string, attributeId: string): CatalogIssue[] {
  const path = `${memberPath(rowId)}.values.${attributeId}`;
  return issues.filter((issue) => issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${memberPath(rowId)}.noValueReasons.${attributeId}`));
}

/** Ευρήματα που **δεν** δένονται σε κελί (τοποθέτηση, όριο απογόνων) — στην περίληψη πάνω από το πλέγμα. */
export function unplacedIssues(issues: readonly CatalogIssue[], columnIds: readonly string[]): CatalogIssue[] {
  return issues.filter((issue) => !columnIds.some((column) => issue.path.includes(`.values.${column}`) || issue.path.includes(`.noValueReasons.${column}`)));
}

export interface RebasedDraft {
  readonly draft: VariantDraft;
  /** Παραλλαγές που άλλαξαν **και** εδώ **και** αλλού: κρατήθηκε η ζωντανή, η δική μας αλλαγή αναφέρεται. */
  readonly conflicts: readonly string[];
}

function rebaseRow(row: VariantRow, live: VariantRow | undefined, conflicts: string[]): VariantRow | null {
  if (!live) return row.stored === null ? row : null;
  if (row.stored === null) return { ...live, definition: row.definition };
  if (live.stored?.revision === row.stored.revision) return row;
  // Η ζωντανή έγινε ΙΔΙΑ με το πρόχειρο ⇒ η αλλαγή ήταν η δική μας (η αποθήκευση μόλις γράφτηκε) — όχι σύγκρουση.
  if (sameDefinition(live.definition, row.definition)) return live;
  if (isRowChanged(row)) conflicts.push(row.id);
  return live;
}

/**
 * **Rebase ανά γραμμή** (Figma · Google Sheets): το ζωντανό σύνολο άλλαξε ενώ υπάρχει πρόχειρο. Ό,τι **δεν** συγκρούεται
 * μένει (μια επικόλληση 7 γραμμών **δεν** χάνεται επειδή κάποιος άλλαξε μία)· γραμμή που άλλαξε **και** από τις δύο
 * πλευρές παίρνει τη ζωντανή και αναφέρεται· νέες γραμμές «δένονται» μόλις γραφτούν· γραμμές που πρόσθεσε άλλος μπαίνουν.
 */
export function rebaseVariantDraft(draft: VariantDraft, base: VariantDraft): RebasedDraft {
  const live = new Map(base.rows.map((row) => [row.id, row]));
  const conflicts: string[] = [];
  const rows = draft.rows.map((row) => rebaseRow(row, live.get(row.id), conflicts)).filter((row): row is VariantRow => row !== null);
  const known = new Set([...rows.map((row) => row.id), ...draft.removed.map((record) => record.id)]);
  const added = base.rows.filter((row) => !known.has(row.id));
  const removed = draft.removed.filter((record) => live.has(record.id));
  return { draft: { rows: [...rows, ...added], removed }, conflicts };
}
