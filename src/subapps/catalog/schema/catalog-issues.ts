/**
 * =============================================================================
 * ΤΑ ΕΥΡΗΜΑΤΑ ΕΠΙΚΥΡΩΣΗΣ ΤΟΥ ΣΧΗΜΑΤΟΣ ΚΑΤΑΛΟΓΟΥ (ADR-923 §5.2)
 * =============================================================================
 *
 * Οι επικυρωτές επιστρέφουν **κωδικούς**, ποτέ κείμενο (N.11): η οθόνη τους μεταφράζει
 * από το `catalog:issues.<code>`, ο διακομιστής τους στέλνει στο 422. Το ίδιο εύρημα,
 * η ίδια λέξη, σε πελάτη και διακομιστή — επειδή είναι **η ίδια** συνάρτηση.
 *
 * Κλειστό σύνολο: νέος έλεγχος = νέος κωδικός εδώ = νέο κλειδί i18n (το `Record` του
 * καταναλωτή σπάει τη μεταγλώττιση αν λείψει).
 *
 * @module subapps/catalog/schema/catalog-issues
 */

export const CATALOG_ISSUE_CODES = [
  // ── γενικά ──
  'invalidCode',
  'duplicateCode',
  'labelRequired',
  'tooMany',
  'unknownReference',
  'codeImmutable',
  'typeLockedInUse',
  'unitLockedInUse',
  // ── οικογένεια μέτρησης ──
  'unitStandardMissing',
  'unitStandardNotIdentity',
  'unitInvalidFactor',
  'unitInvalidOffset',
  'unitSingleUnitViolated',
  'reservedPlatformCode',
  // ── ιδιότητα ──
  'measurementFamilyUnknown',
  'measurementUnitUnknown',
  'rangeInverted',
  'decimalsOutOfRange',
  'optionsRequired',
  'tableColumnsCount',
  'tableKeyColumnType',
  'tableColumnMeasurementMissing',
  'uniqueNotSupported',
  'localizableNotSupported',
  'invalidPattern',
  'assetKindsRequired',
  'invalidUri',
  'mappingIncomplete',
  // ── οικογένεια προϊόντων ──
  'attributeUnknown',
  'attributeDuplicate',
  'labelAttributeType',
  'imageAttributeType',
  'variantLevelsCount',
  'axesCount',
  'axisTypeNotAllowed',
  'axisLocalizedOrScoped',
  'attributeInMultipleLevels',
  'axisNotInFamily',
  'tableSchemeUnknown',
  'tableRowAttributeUnknown',
  'tableAxisFilterInvalid',
  'ruleAttributeNotNumeric',
  'ruleMeasurementMismatch',
  'ruleAxisUnknown',
  'ruleConstantUnitUnknown',
  // ── κατηγορία ──
  'categoryCycle',
  'categoryDepthExceeded',
  'categoryParentUnknown',
  // ── ιδιότητα (Φάση 2) ──
  'uniqueLocalizedOrScoped',
  // ── τιμές προϊόντων (Φάση 2α, ADR-923 §5.10) ──
  'valueTypeMismatch',
  'valueWrongLevel',
  'valueChannelSlotInvalid',
  'valueLocaleSlotInvalid',
  'localeNotEnabled',
  'valueEmpty',
  'valueTooLong',
  'valuePatternMismatch',
  'valueNotNumber',
  'valueTooManyDecimals',
  'valueNegative',
  'valueOutOfRange',
  'optionUnknown',
  'invalidDate',
  'assetKindNotAllowed',
  'tableColumnUnknown',
  'tableKeyMissing',
  'axisValueMissing',
  'axisComboDuplicate',
  'axisValueImmutable',
  'noValueConflict',
  'noValueOnAxis',
  // ── μοντέλα / προϊόντα / μέσα / ρυθμίσεις ──
  'familyMismatch',
  'variantSchemeUnknown',
  'modelHierarchyInvalid',
  'tooManyDescendants',
  'assetRoleKindMismatch',
  'channelLocalesRequired',
  // ── Φάση 2β: γραφείς δεδομένων + κλειδώματα σχήματος με προϊόντα (ADR-923 §5.10.2) ──
  'consistencyRuleViolated',
  'fieldImmutable',
  'uniqueValueTaken',
  'uniqueValueLooksLike',
  'richTextUnsafe',
  'referenceFamilyNotAllowed',
  'variantSchemeLockedInUse',
  'attributeLevelLockedInUse',
  'attributeRemovalLockedInUse',
  'attributeFlagLockedInUse',
  'optionLockedInUse',
  'localeLockedInUse',
  // ── Φάση 2γ: σύνδεση αρχείου ↔ μέσου (ADR-923 §5.10.3) ──
  'fileNotFound',
  'fileForeignOwner',
  'fileNotReady',
  'fileKindMismatch',
  'fileTypeConflict',
  'fileTooLarge',
  'renditionsNotReady',
  'renditionsFailed',
  // ── Φάση 2δ: δήλωση δικαιωμάτων μέσου (ADR-923 §5.10.4) ──
  'rightsCreatorRequired',
  'rightsTermDateRequired',
  // ── Φάση 3: τιμοκατάλογοι, ομάδες έκπτωσης, συνθήκες (ADR-923 §5.11) ──
  'priceAmountInvalid',
  'priceQuantityInvalid',
  'priceLineSubjectDuplicate',
  // 3δ (πλέγμα γραμμών): ο κωδικός λείπει · δεν αντιστοιχεί σε ζωντανό SKU — κρίνονται στον πελάτη πριν από την αποστολή.
  'priceLineSubjectRequired',
  'priceLineSkuUnknown',
  'discountGroupNotAccepted',
  // 3ε: τα αναλλοίωτα της λίστας κόστους (ο εσωτερικός master)
  'priceLineSubjectNotAccepted',
  'atoeCodeUnknown',
  'costListPriceType',
  'projectOnlyOnCostList',
  'costBreakdownRequired',
  'costBreakdownNotAllowed',
  'costBreakdownMismatch',
  'discountStepInvalid',
  'discountTiersRequired',
  'discountTierMinInvalid',
  'discountTierDuplicate',
  'discountTiersNotMonotonic',
  'validityRangeInverted',
  'discountConditionAmbiguous',
  'versionNotDraft',
  'versionValidFromRequired',
  'versionValidFromNotAfterPrevious',
  // ── Φάση 3β: αποθήκευση τιμοκαταλόγων (ADR-923 §5.11 «3β») ──
  'costListHasAudience',
  'fenceOutOfBounds',
  'priceListAudienceAmbiguous',
  'versionSeeding',
  'fenceConfirmationRequired',
  'fenceDigestStale',
  'unknownParty',
] as const;

export type CatalogIssueCode = (typeof CATALOG_ISSUE_CODES)[number];

/** Ένα εύρημα: ποιος έλεγχος, σε ποιο σημείο του εγγράφου (διαδρομή τύπου `units[2].factor`). */
export interface CatalogIssue {
  readonly code: CatalogIssueCode;
  readonly path: string;
  /** Τιμές για παρεμβολή ICU στο μήνυμα (π.χ. `{ max: 5 }`). */
  readonly params?: Readonly<Record<string, string | number>>;
}

/** Συλλέκτης ευρημάτων — κάθε επικυρωτής γράφει εδώ, ποτέ δεν ρίχνει εξαίρεση. */
export class IssueCollector {
  private readonly items: CatalogIssue[] = [];

  add(code: CatalogIssueCode, path: string, params?: Readonly<Record<string, string | number>>): void {
    this.items.push(params ? { code, path, params } : { code, path });
  }

  get issues(): readonly CatalogIssue[] {
    return this.items;
  }

  get ok(): boolean {
    return this.items.length === 0;
  }
}

/** Αναφέρει κάθε κωδικό που εμφανίζεται δεύτερη φορά (με τη διαδρομή του). */
export function reportDuplicates(
  collector: IssueCollector,
  codes: readonly string[],
  pathOf: (index: number) => string,
): void {
  const seen = new Set<string>();
  codes.forEach((code, index) => {
    if (seen.has(code)) collector.add('duplicateCode', pathOf(index), { code });
    seen.add(code);
  });
}
