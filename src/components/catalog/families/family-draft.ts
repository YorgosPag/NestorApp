/**
 * @fileoverview **Το πρόχειρο οικογένειας προϊόντων** — καθαρές συναρτήσεις (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/families/family-draft
 *
 * 🔑 **Η οικογένεια είναι ΕΝΑ έγγραφο, επικυρωμένο ολόκληρο** από τον `validateFamily` του γραφέα — εδώ τρέχει πάνω
 *    στο πρόχειρο, απέναντι στη βιβλιοθήκη **όπως είναι τώρα**. Τα ευρήματα μοιράζονται στις καρτέλες με τη διαδρομή
 *    τους, ώστε κάθε καρτέλα να δείχνει πόσα προβλήματα έχει.
 * 🔑 **Αφαίρεση ιδιότητας = και από τις αναφορές της** (άξονες, επίπεδα, γραμμές πίνακα, κανόνες, όνομα/εικόνα):
 *    αλλιώς το πρόχειρο γεμίζει ευρήματα για κάτι που ο άνθρωπος ήδη αποφάσισε να βγάλει.
 * 🔑 Τα τοπικά αναγνωριστικά (γραμμές πίνακα, κανόνες) είναι **ντετερμινιστικά μέσα στο έγγραφο** (`prefix_N`, N =
 *    μέγιστο + 1) — όχι ρολόι, όχι τύχη: δεν είναι έγγραφα Firestore (N.6), είναι κλειδιά στοιχείων ενός πίνακα.
 */

import { hasAnyLocalizedText } from '@/i18n/localized-text';
import { familyDefinitionOf } from '@/subapps/catalog/schema/family-binding';
import { validateFamily } from '@/subapps/catalog/schema/validate-family';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '@/subapps/catalog/types/attribute';
import {
  compositeDisplaysOf,
  deriveFamilyAttributeIds,
  type CatalogFamilyDefinition,
  type CompositeDisplay,
  type ConsistencyRule,
  type FamilyTableRow,
  type VariantScheme,
} from '@/subapps/catalog/types/family';
import {
  isAxisAttributeType,
  isNumericAttributeType,
} from '@/subapps/catalog/vocabulary/attribute-types';
import { DEFAULT_LISTING_KIND, type CatalogListingKind } from '@/subapps/catalog/vocabulary/listing-kinds';
import type { AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';

/** Οι σύνθετες ενδείξεις **πριν** από τον πίνακα: εκεί δηλώνονται, ο πίνακας τις χρησιμοποιεί (§21.6). */
export const FAMILY_TABS = ['general', 'attributes', 'variants', 'composites', 'table', 'rules'] as const;
export type FamilyTab = (typeof FAMILY_TABS)[number];

export function emptyFamilyDraft(): CatalogFamilyDefinition {
  return {
    code: '',
    labels: {},
    description: {},
    attributes: [],
    labelAttributeId: null,
    imageAttributeId: null,
    variantSchemes: [],
    tableSpec: null,
    consistencyRules: [],
    listingKind: DEFAULT_LISTING_KIND,
    etimClass: null,
    installationAttributeId: null,
    compositeDisplays: [],
  };
}

/** Ο ορισμός της εγγραφής (κοινό SSoT με τον διακομιστή: `familyDefinitionOf`). */
export const familyDraftOf = (record: FamilyRecord): CatalogFamilyDefinition => familyDefinitionOf(record);

/** Αλλαγή είδους: ο δεσμός τοποθέτησης δεν επιβιώνει έξω από το δικό του είδος (§22 Υ5). */
export const withListingKind = (draft: CatalogFamilyDefinition, listingKind: CatalogListingKind): CatalogFamilyDefinition => ({
  ...draft,
  listingKind,
  installationAttributeId: listingKind === 'productWithInstallation' ? draft.installationAttributeId ?? null : null,
});

/** Η αποθηκευμένη μορφή (με το παράγωγο του γραφέα) — για την αισιόδοξη εγγραφή. */
export function storedFamilyOf(draft: CatalogFamilyDefinition) {
  return { ...draft, attributeIds: deriveFamilyAttributeIds(draft) };
}

export function validateFamilyDraft(
  draft: CatalogFamilyDefinition,
  attributes: ReadonlyMap<string, CatalogAttributeDefinition>,
  registry: MeasurementRegistry,
): readonly CatalogIssue[] {
  return validateFamily(draft, attributes, registry);
}

/** Σε ποια καρτέλα ανήκει ένα εύρημα — από την αρχή της διαδρομής του. */
export function tabOfIssue(issue: CatalogIssue): FamilyTab {
  if (issue.path.startsWith('attributes')) return 'attributes';
  if (issue.path.startsWith('variantSchemes')) return 'variants';
  if (issue.path.startsWith('tableSpec')) return 'table';
  if (issue.path.startsWith('consistencyRules')) return 'rules';
  if (issue.path.startsWith('compositeDisplays')) return 'composites';
  return 'general';
}

/** Το άδειο σχήμα του «Νέο σχήμα παραλλαγών» — ΕΝΑ πρότυπο, και για την προσθήκη και για την ερώτηση «ανέγγιχτο;». */
export function emptyVariantScheme(): VariantScheme {
  return { code: '', labels: {}, levels: [{ axisAttributeIds: [], attributeIds: [] }] };
}

/** Ανέγγιχτο = ακόμη ίδιο με το {@link emptyVariantScheme}: ο άνθρωπος το πρόσθεσε αλλά δεν έγραψε τίποτα σε αυτό. */
export function isPristineScheme(scheme: VariantScheme): boolean {
  const [only, ...rest] = scheme.levels;
  return scheme.code === '' && !hasAnyLocalizedText(scheme.labels) && rest.length === 0
    && only !== undefined && only.axisAttributeIds.length === 0 && only.attributeIds.length === 0;
}

const belongsTo = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}.`);

/**
 * Τα ευρήματα που **φαίνονται**: όσα ανήκουν σε ανέγγιχτο σχήμα αναβάλλονται ώς το πρώτο άγγιγμα (ADR-923 §23.2 K1).
 * Ένα στοιχείο που μόλις προστέθηκε είναι **ημιτελές, όχι λάθος** (Material · Figma · Linear: επικύρωση μετά την
 * αλληλεπίδραση). ⚠️ Μόνο η **προβολή** αλλάζει: ο φραγμός αποθήκευσης μετρά πάντα όλα τα ευρήματα.
 */
export function shownFamilyIssues(draft: CatalogFamilyDefinition, issues: readonly CatalogIssue[]): readonly CatalogIssue[] {
  const deferred = draft.variantSchemes.flatMap((scheme, index) => (isPristineScheme(scheme) ? [`variantSchemes[${index}]`] : []));
  if (deferred.length === 0) return issues;
  return issues.filter((issue) => !deferred.some((prefix) => belongsTo(issue.path, prefix)));
}

export function issueCountByTab(issues: readonly CatalogIssue[]): Readonly<Record<FamilyTab, number>> {
  const counts: Record<FamilyTab, number> = { general: 0, attributes: 0, variants: 0, composites: 0, table: 0, rules: 0 };
  for (const issue of issues) counts[tabOfIssue(issue)] += 1;
  return counts;
}

/** Οι ιδιότητες της οικογένειας, με τη σειρά της οικογένειας, όσες υπάρχουν στη βιβλιοθήκη. */
export function familyAttributes(draft: CatalogFamilyDefinition, library: ReadonlyMap<string, AttributeRecord>): AttributeRecord[] {
  return draft.attributes.flatMap((binding) => {
    const attribute = library.get(binding.attributeId);
    return attribute ? [attribute] : [];
  });
}

/** Υποψήφιοι άξονες: επιλογή · ναι/όχι · μέτρηση, χωρίς τιμή ανά γλώσσα/κανάλι. */
export const axisCandidates = (attributes: readonly AttributeRecord[]) =>
  attributes.filter((attribute) => isAxisAttributeType(attribute.type) && !attribute.localizable && !attribute.scopable);

export const numericAttributes = (attributes: readonly AttributeRecord[]) =>
  attributes.filter((attribute) => isNumericAttributeType(attribute.type));

export const textAttributes = (attributes: readonly AttributeRecord[]) =>
  attributes.filter((attribute) => attribute.type === 'text');

export const referenceAttributes = (attributes: readonly AttributeRecord[]) =>
  attributes.filter((attribute) => attribute.type === 'reference');

export const imageAttributes = (attributes: readonly AttributeRecord[]) =>
  attributes.filter((attribute) => attribute.type === 'asset' && attribute.config.assetKinds.includes('image'));

/** Επόμενο τοπικό αναγνωριστικό `prefix_N`, μοναδικό μέσα στο έγγραφο. */
export function nextLocalId(prefix: string, existing: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}_(\\d+)$`);
  const max = existing.reduce((top, id) => Math.max(top, Number(pattern.exec(id)?.[1] ?? 0)), 0);
  return `${prefix}_${max + 1}`;
}

/**
 * Αναφέρει ο κανόνας την ιδιότητα; Και η συνθήκη «όταν» μετράει (§21.5): κανόνας που χάνει τη συνθήκη του **φεύγει**,
 * δεν γίνεται καθολικός — το «≥ 380 V» χωρίς «όταν τριφασικό» θα έκρινε σιωπηλά και τα μονοφασικά.
 */
function ruleMentions(rule: ConsistencyRule, id: string): boolean {
  if (rule.when?.attributeId === id) return true;
  switch (rule.kind) {
    case 'unique': return rule.attributeId === id;
    case 'orderAcrossAttributes': return rule.attributeIds.includes(id);
    case 'monotonicAlongAxis': return rule.attributeId === id || rule.axisAttributeId === id;
    case 'compare': return rule.leftAttributeId === id || (rule.right.kind === 'attribute' && rule.right.attributeId === id);
  }
}

function rowMentions(row: FamilyTableRow, id: string): boolean {
  switch (row.kind) {
    case 'axis': return row.axisAttributeId === id;
    case 'attribute': return row.attributeId === id || row.axisFilter?.axisAttributeId === id;
    case 'groupHeader':
    case 'composite': return false;
  }
}

/** Οι γραμμές πίνακα που μένουν όταν φύγουν οι ενδείξεις `gone` — γραμμή προς ένδειξη που δεν υπάρχει είναι ορφανή. */
function withoutCompositeRows(draft: CatalogFamilyDefinition, gone: ReadonlySet<string>): CatalogFamilyDefinition {
  if (!draft.tableSpec || gone.size === 0) return draft;
  const rows = draft.tableSpec.rows.filter((row) => row.kind !== 'composite' || !gone.has(row.compositeId));
  return { ...draft, tableSpec: { ...draft.tableSpec, rows } };
}

/** Βγάζει τη σύνθετη ένδειξη **και** τις γραμμές πίνακα που τη δείχνουν (§21.6). */
export function withoutComposite(draft: CatalogFamilyDefinition, compositeId: string): CatalogFamilyDefinition {
  const compositeDisplays = compositeDisplaysOf(draft).filter((composite) => composite.id !== compositeId);
  return withoutCompositeRows({ ...draft, compositeDisplays }, new Set([compositeId]));
}

/**
 * Βγάζει την ιδιότητα **και** κάθε αναφορά της. Ένδειξη που έμεινε χωρίς μέρη φεύγει — και μαζί οι γραμμές πίνακα που
 * τη δείχνουν, αλλιώς ο άνθρωπος θα έβλεπε σφάλμα για κάτι που δεν έκανε.
 */
export function withoutFamilyAttribute(draft: CatalogFamilyDefinition, id: string): CatalogFamilyDefinition {
  const compositeDisplays = withoutCompositePart(compositeDisplaysOf(draft), id);
  const kept = new Set(compositeDisplays.map((composite) => composite.id));
  const gone = new Set(compositeDisplaysOf(draft).map((composite) => composite.id).filter((compositeId) => !kept.has(compositeId)));
  return withoutCompositeRows(withoutAttributeReferences(draft, id, compositeDisplays), gone);
}

function withoutAttributeReferences(draft: CatalogFamilyDefinition, id: string, compositeDisplays: CompositeDisplay[]): CatalogFamilyDefinition {
  return {
    ...draft,
    attributes: draft.attributes.filter((binding) => binding.attributeId !== id),
    labelAttributeId: draft.labelAttributeId === id ? null : draft.labelAttributeId,
    imageAttributeId: draft.imageAttributeId === id ? null : draft.imageAttributeId,
    installationAttributeId: draft.installationAttributeId === id ? null : draft.installationAttributeId,
    variantSchemes: draft.variantSchemes.map((scheme) => ({
      ...scheme,
      levels: scheme.levels.map((level) => ({
        axisAttributeIds: level.axisAttributeIds.filter((axis) => axis !== id),
        attributeIds: level.attributeIds.filter((attribute) => attribute !== id),
      })),
    })),
    tableSpec: draft.tableSpec ? { ...draft.tableSpec, rows: draft.tableSpec.rows.filter((row) => !rowMentions(row, id)) } : null,
    consistencyRules: draft.consistencyRules.filter((rule) => !ruleMentions(rule, id)),
    compositeDisplays,
  };
}

/** Το μέρος φεύγει από κάθε σύνθετη ένδειξη· ένδειξη που μένει χωρίς μέρη φεύγει ολόκληρη (§21.6). */
function withoutCompositePart(composites: readonly CompositeDisplay[], id: string): CompositeDisplay[] {
  return composites
    .map((composite) => ({ ...composite, parts: composite.parts.filter((part) => part.attributeId !== id) }))
    .filter((composite) => composite.parts.length > 0);
}
