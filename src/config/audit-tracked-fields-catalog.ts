/**
 * Τα παρακολουθούμενα πεδία του **σχήματος καταλόγου** (ADR-923 §5.9 · ADR-195) — ποιες αλλαγές
 * αφήνουν ίχνος στο ιστορικό. Χωριστό αρχείο (όπως τα `-dxf-bim` των IDs) ώστε το
 * `audit-tracked-fields.ts` να μη μεγαλώνει· το `getTrackedFieldsForEntityAuditType` απλώς δείχνει εδώ.
 *
 * 🔑 Τα σύνθετα πεδία (ρυθμίσεις τύπου, παραλλαγές, πίνακας, κανόνες) γράφονται ως **κανονικοποιημένο JSON**
 * (`lib/legal/canonical-json`, ταξινομημένα κλειδιά): η προβολή είναι **ταυτότητα** — δύο διαφορετικές τιμές
 * δίνουν διαφορετικό κείμενο, άρα καμία αλλαγή δεν χάνεται, και η ίδια τιμή δίνει **πάντα** το ίδιο κείμενο,
 * άρα καμία ψεύτικη αλλαγή από αλλαγμένη σειρά κλειδιών.
 * Οι ετικέτες των πεδίων ζουν στο namespace `catalog` (`audit.fields.*`).
 *
 * 🔑 **Τιμές προϊόντων: ιστορικό ΑΝΑ ΙΔΙΟΤΗΤΑ** (ADR-923 §5.10 Θωράκιση 6). Ένα JSON ολόκληρου του `values` θα
 * έγραφε «άλλαξε το values» με 14 τιμές πριν και 14 μετά, για μία αλλαγή βάρους. Η μηχανή (`catalog-kinds.ts`)
 * προβάλλει τον χάρτη σε **συλλογή** `[{ attributeId, slots }]` πριν από τη σύγκριση, και η μηχανή ιστορικού
 * (ADR-195 Φ11, `kind: 'collection'`) δίνει **μία** γραμμή ανά ιδιότητα που προστέθηκε / αφαιρέθηκε / άλλαξε —
 * Akeneo versioning ανά ιδιότητα.
 * @module config/audit-tracked-fields-catalog
 */

import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import { AUDIT_VALUE_CATALOGS as V } from './audit-value-catalogs';
import { structuredAuditValue as structured, trackedFieldDefsIn, type AuditFieldVocabulary } from './audit-tracked-field-builders';

const defs = trackedFieldDefsIn('catalog:audit.fields');

/*
 * 🔑 ΟΙ ΛΕΞΕΙΣ ΤΩΝ ΤΙΜΩΝ (ADR-923 §23.5 Β1). Ως 2026-11-06 οι ετικέτες μεταφράζονταν αλλά οι τιμές έβγαιναν ωμές:
 * «none», «disposal: null, downloadCount: 0, …». Κάθε απαρίθμηση δείχνει πλέον στο λεξιλόγιο της οθόνης (μία λέξη ανά
 * τιμή), και κάθε πολύγλωσσο κείμενο ονομάζει τις γλώσσες του. Όνομα πεδίου ≠ λεξιλόγιο: το `status` μιας έκδοσης δεν
 * είναι το `status` ενός έργου, γι' αυτό η δήλωση είναι ανά οντότητα και όχι ανά όνομα.
 */
const enumOf = (catalog: AuditFieldVocabulary['enumCatalog']): AuditFieldVocabulary => ({ enumCatalog: catalog });
const MULTILINGUAL: AuditFieldVocabulary = { nestedKeyCatalog: V.catalogLanguage };
const multilingual = (...fields: readonly string[]): Record<string, AuditFieldVocabulary> =>
  Object.fromEntries(fields.map((field) => [field, MULTILINGUAL]));

export const CATALOG_ATTRIBUTE_TRACKED_FIELDS = defs(
  ['type', 'groupId', 'localizable', 'scopable', 'unique', 'searchable', 'orderKey', 'isDeleted'],
  ['labels', 'description', 'config', 'mappings'],
  { type: enumOf(V.catalogAttributeType), ...multilingual('labels', 'description') },
);

export const CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS = defs(['orderKey', 'isDeleted'], ['labels'], multilingual('labels'));

export const CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS = defs(
  ['standardUnitCode', 'singleUnit', 'isDeleted'],
  ['labels', 'units'],
  multilingual('labels'),
);

export const CATALOG_CATEGORY_TRACKED_FIELDS = defs(
  ['parentId', 'orderKey', 'vatRate', 'isDeleted'],
  ['labels', 'mappings'],
  multilingual('labels'),
);

/** Το όνομα του πεδίου της προβολής ανά ιδιότητα — ένα όνομα για μηχανή και περιγραφέα. */
export const CATALOG_VALUES_AUDIT_FIELD = 'values';

/** Η γραμμή της προβολής: μία ιδιότητα με όλες τις θέσεις της (κανάλι × γλώσσα). */
export interface CatalogValuesAuditRow {
  readonly attributeId: string;
  readonly slots: unknown;
}

/** Χάρτης `values` → συλλογή, με σταθερή σειρά (η σειρά δεν είναι αλλαγή). */
export function catalogValuesAuditRows(values: unknown): CatalogValuesAuditRow[] {
  if (values === null || typeof values !== 'object') return [];
  return Object.entries(values as Record<string, unknown>)
    .map(([attributeId, slots]) => ({ attributeId, slots }))
    .sort((a, b) => a.attributeId.localeCompare(b.attributeId));
}

const valuesByAttribute: TrackedFieldDef = {
  kind: 'collection',
  label: CATALOG_VALUES_AUDIT_FIELD,
  labelKey: `catalog:audit.fields.${CATALOG_VALUES_AUDIT_FIELD}`,
  keyBy: 'attributeId',
  labelFields: ['attributeId'],
  trackSubFields: ['slots'],
  subFieldValues: { slots: (item) => structured(item.slots) },
};

export const CATALOG_FAMILY_TRACKED_FIELDS = defs(
  ['labelAttributeId', 'imageAttributeId', 'listingKind', 'installationAttributeId', 'isDeleted'],
  ['labels', 'description', 'attributes', 'variantSchemes', 'tableSpec', 'consistencyRules', 'compositeDisplays'],
  { listingKind: enumOf(V.catalogListingKind), ...multilingual('labels', 'description') },
);

// ── Φάση 2 (ADR-923 §5.10) — δεδομένα. Τα παράγωγα (`derived`) ΔΕΝ παρακολουθούνται: τα γράφει ο γραφέας,
//    και ένας επανυπολογισμός πληρότητας δεν είναι «αλλαγή» κανενός ανθρώπου.

// ADR-934 Σ1β: η ταυτότητα εμπορίου (μάρκα · GTIN · MPN · «χωρίς GTIN») — **επίπεδα** πεδία ⇒ μία γραμμή ιστορικού ανά
// πεδίο («GTIN: — → 5201234567890»). Τα κλειδιά της (`derived.tradeKeys`) είναι παράγωγα και ΔΕΝ παρακολουθούνται.
export const CATALOG_PRODUCT_MODEL_TRACKED_FIELDS = {
  ...defs(['familyId', 'variantSchemeCode', 'parentId', 'brand', 'isDeleted'], ['categoryIds', 'noValueReasons']),
  [CATALOG_VALUES_AUDIT_FIELD]: valuesByAttribute,
};

export const CATALOG_PRODUCT_TRACKED_FIELDS = {
  ...defs(
    ['modelId', 'familyId', 'brand', 'gtin', 'mpn', 'noGtinReason', 'isDeleted'],
    ['categoryIds', 'noValueReasons'],
    { noGtinReason: enumOf(V.catalogNoValueReason) },
  ),
  [CATALOG_VALUES_AUDIT_FIELD]: valuesByAttribute,
};

export const CATALOG_ASSET_TRACKED_FIELDS = defs(
  ['role', 'kind', 'fileId', 'isDeleted'],
  ['labels', 'description', 'rights'],
  { role: enumOf(V.catalogAssetRole), kind: enumOf(V.catalogAssetKind), ...multilingual('labels', 'description') },
);

export const CATALOG_SETTINGS_TRACKED_FIELDS = defs([], ['channelLocales']);

export const CATALOG_SUPPLIER_PROFILE_TRACKED_FIELDS = defs([], ['description', 'projects', 'quoteIntake']);

// ── Φάση 3β (ADR-923 §5.11) — τιμοκατάλογοι. Τα παράγωγα (`derived`: `linesRevision`, σπορά, κλειδιά δεικτών) ΔΕΝ
//    παρακολουθούνται. Η σφραγίδα (`seal`) ναι: είναι η **πράξη** της δημοσίευσης, με ποιον φράχτη και τι επιβεβαιώθηκε.

export const CATALOG_PRICE_LIST_TRACKED_FIELDS = defs(
  ['kind', 'priceType', 'changeFenceBp', 'isDeleted'],
  ['labels', 'audience'],
  {
    kind: enumOf(V.catalogPriceListKind),
    priceType: enumOf(V.catalogPriceType),
    audience: { itemCatalogs: { kind: V.catalogPriceAudience } },
    ...multilingual('labels'),
  },
);

export const CATALOG_PRICE_LIST_VERSION_TRACKED_FIELDS = defs(
  ['number', 'status', 'validFrom', 'basedOnVersionId', 'isDeleted'],
  ['seal'],
  { status: enumOf(V.catalogPriceVersionStatus) },
);

export const CATALOG_PRICE_LIST_LINE_TRACKED_FIELDS = defs(
  ['netPrice', 'priceQuantity', 'unitCode', 'discountGroupId', 'isDeleted'],
  ['subject', 'breakdown'],
  { unitCode: enumOf(V.catalogUnit) },
);

export const CATALOG_DISCOUNT_GROUP_TRACKED_FIELDS = defs(['isDeleted'], ['labels'], multilingual('labels'));

export const CATALOG_CUSTOMER_GROUP_TRACKED_FIELDS = defs(['isDeleted'], ['labels'], multilingual('labels'));

export const CATALOG_CUSTOMER_ASSIGNMENT_TRACKED_FIELDS = defs(['customerGroupId', 'isDeleted'], ['party']);

export const CATALOG_PUBLICATION_RECIPE_TRACKED_FIELDS = defs(
  ['language', 'paper', 'isDeleted'],
  ['labels', 'title', 'scope', 'pricing', 'theme', 'templates', 'profiles', 'footerNote'],
  { language: enumOf(V.catalogLanguage), paper: enumOf(V.catalogPaper), ...multilingual('labels', 'title', 'footerNote') },
);

export const CATALOG_PUBLICATION_RUN_TRACKED_FIELDS = defs(
  ['recipeId', 'status', 'failure', 'audienceKey', 'inputHash'],
  ['retention'],
  {
    status: enumOf(V.catalogPublicationStatus),
    failure: enumOf(V.catalogPublicationFailure),
    // `none` · `anonymous` · `customerGroup:<id>` — το είδος από τον κατάλογο, η ταυτότητα ως έχει (resolver).
    audienceKey: enumOf(V.catalogPriceAudience),
    retention: { nestedKeyCatalog: V.catalogRetentionParts, itemCatalogs: { cause: V.catalogDisposalCause } },
  },
);
/** Δημοσιευμένη έκδοση (§5.15): ο κύκλος ζωής της (δημοσίευση → αντικατάσταση / απόσυρση) και σε ποιο κοινό. Το αρχείο δεν αλλάζει ποτέ. */
export const CATALOG_EDITION_TRACKED_FIELDS = defs(
  ['status', 'supersededBy', 'endedAt'],
  ['audience'],
  { status: enumOf(V.catalogEditionStatus), audience: { itemCatalogs: { kind: V.catalogPriceAudience } } },
);
export const CATALOG_VISIBILITY_RULE_TRACKED_FIELDS = defs(
  ['visibility', 'isDeleted'],
  ['subject', 'audience'],
  { visibility: enumOf(V.catalogVisibility), audience: { itemCatalogs: { kind: V.catalogPriceAudience } } },
);
export const SUPPLY_REQUEST_LINK_TRACKED_FIELDS = defs(['state', 'generation'], [], { state: enumOf(V.catalogSupplyLinkState) });
export const SUPPLY_RELATIONSHIP_TRACKED_FIELDS = defs(
  ['state', 'supplierContactId', 'customerRef', 'acceptedByUid', 'approvedByUid', 'endedBySide'],
  [],
  { state: enumOf(V.catalogSupplyState), endedBySide: enumOf(V.catalogSupplySide) },
);

export const CATALOG_DISCOUNT_CONDITION_TRACKED_FIELDS = defs(
  ['discountGroupId', 'validFrom', 'validUntil', 'isDeleted'],
  ['audience', 'rule'],
);

// ── Φάση 4 (ADR-923 §5.5.1) — εισαγωγή. Της πρότασης παρακολουθείται η ΠΡΑΞΗ, όχι το περιεχόμενο: οι τιμές γράφουν ιστορικό
//    στην ίδια την οντότητα όταν εφαρμοστούν. Τα πεδία του ελέγχου αλλάζουν συνεχώς και δεν είναι δεδομένα του καταλόγου.

export const CATALOG_IMPORT_PROFILE_TRACKED_FIELDS = defs(
  ['label', 'purpose', 'supplierContactId', 'familyId', 'skipRows', 'sheetIndex', 'isDeleted'],
  ['columns'],
  { purpose: enumOf(V.catalogImportPurpose) },
);

export const CATALOG_IMPORT_BATCH_TRACKED_FIELDS = defs(
  ['status', 'fileName', 'contentSha256', 'sourceKind', 'fileId', 'profileId', 'profileRevision', 'run', 'isDeleted'],
  ['target'],
  { status: enumOf(V.catalogImportBatchStatus), sourceKind: enumOf(V.catalogImportSourceKind) },
);

export const CATALOG_IMPORT_PROPOSAL_TRACKED_FIELDS = defs(
  ['status', 'groupKey', 'appliedAt', 'appliedBy', 'isDeleted'],
  [],
  { status: enumOf(V.catalogImportProposalStatus) },
);

// ADR-923 §5.5.2 Β5 — η μνήμη ετικετών: παρακολουθείται ΤΙ θυμάται (οι αποφάσεις με τους μετρητές τους), γιατί αυτό εφαρμόζεται
// μόνο του σε επόμενους καταλόγους· το «ποιος το δίδαξε» φαίνεται στο ιστορικό. §5.5.2 Β10: η ίδια συλλογή κρατά και τη μνήμη τιμών
// (`subject: 'value'`, ανά ιδιότητα αντί για οικογένεια).
export const CATALOG_IMPORT_LABEL_MEMORY_TRACKED_FIELDS = defs(
  ['subject', 'supplierContactId', 'familyId', 'attributeId', 'label', 'unitCode', 'printedLabel', 'isDeleted'],
  ['decisions'],
);

// ── Φάση 6β (ADR-923 §5.13 Ε1α) — έλεγχος προμηθευτή. Παρακολουθείται η πράξη· το αποτύπωμα ΑΦΜ δεν μπαίνει ποτέ στο ιστορικό.

export const SUPPLIER_BRAND_CLAIM_TRACKED_FIELDS = defs(
  ['status', 'relation', 'evidenceFileId', 'decidedBy', 'reviewNote'],
  ['grant'],
  { status: enumOf(V.catalogReviewStatus), relation: enumOf(V.catalogBrandRelation) },
);

export const SUPPLIER_VERIFICATION_TRACKED_FIELDS = defs(
  ['status', 'evidenceFileId', 'decidedBy', 'reviewNote'],
  [],
  { status: enumOf(V.catalogReviewStatus) },
);
