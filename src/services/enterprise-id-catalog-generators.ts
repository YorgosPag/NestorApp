/**
 * Γεννήτορες ταυτοτήτων του σχήματος καταλόγου (ADR-923 §5.9) — κρίκος της αλυσίδας
 * γεννητόρων, κάτω από την `EnterpriseIdService` και τους γεννήτορες υπεργολαβίας (ADR-928):
 *
 *   EnterpriseIdService
 *     ↑ extends
 *   SubcontractIdGenerators
 *     ↑ extends
 *   CatalogIdGenerators        ← εδώ
 *     ↑ extends
 *   CompositeKeyIdGenerators   (και η υπόλοιπη αλυσίδα)
 *
 * Το σχήμα, τα μοντέλα και τα μέσα είναι **ντετερμινιστικά v4** (`mintDeterministicV4Id`, ADR-841 Α9.6: ο
 * επικυρωτής του έργου δέχεται μόνο v4). Ίδιος χώρος + ίδιος κωδικός ⇒ **ίδιο** id ⇒ δεύτερη δημιουργία =
 * σύγκρουση στη συναλλαγή, όχι διπλότυπο.
 *
 * Εξαίρεση **μία**, επίτηδες (ADR-923 §5.10 Δ3): το **SKU** είναι **τυχαίο** — ο κωδικός του είναι ιδιότητα
 * `unique` που διορθώνεται (το PDF γράφει «016–15–001» με en dash), και ταυτότητα που αλλάζει όταν διορθώνεις
 * ένα τυπογραφικό λάθος δεν είναι ταυτότητα. Τη μοναδικότητα του κωδικού την κρατά η **κράτηση** (`cuval`),
 * ντετερμινιστική από (χώρος, ιδιότητα, κανονικοποιημένη τιμή).
 * @module services/enterprise-id-catalog-generators
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { CompositeKeyIdGenerators } from './enterprise-id-composite-key-generators';

const P = ENTERPRISE_ID_PREFIXES;

const seedOf = (kind: string, companyId: string, code: string) => `catalog:${kind}:${companyId}:${code}`;

export abstract class CatalogIdGenerators extends CompositeKeyIdGenerators {
  generateDeterministicCatalogAttributeId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_ATTRIBUTE, seedOf('attribute', companyId, code));
  }

  generateDeterministicCatalogAttributeGroupId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_ATTRIBUTE_GROUP, seedOf('attribute-group', companyId, code));
  }

  generateDeterministicCatalogMeasurementFamilyId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_MEASUREMENT_FAMILY, seedOf('measurement-family', companyId, code));
  }

  generateDeterministicCatalogCategoryId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_CATEGORY, seedOf('category', companyId, code));
  }

  generateDeterministicCatalogFamilyId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_FAMILY, seedOf('family', companyId, code));
  }

  // ── Φάση 2 (ADR-923 §5.10) ──

  generateDeterministicCatalogProductModelId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PRODUCT_MODEL, seedOf('product-model', companyId, code));
  }

  /** SKU — **τυχαίο** (Δ3): ο κωδικός είναι ιδιότητα με κράτηση, όχι η ταυτότητα του εγγράφου. */
  generateCatalogProductId(): string {
    return this.generateId(P.CATALOG_PRODUCT).id;
  }

  generateDeterministicCatalogAssetId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_ASSET, seedOf('asset', companyId, code));
  }

  /** Το προφίλ του παρόχου — **ένα** έγγραφο ανά χώρο (ADR-923 §22 Υ8). */
  generateDeterministicCatalogSupplierProfileId(companyId: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_SUPPLIER_PROFILE, `catalog:supplier-profile:${companyId}`);
  }

  /** Ένα έργο του portfolio: καμία φυσική ταυτότητα, δύο έργα μπορούν να έχουν το ίδιο όνομα. */
  generateCatalogPortfolioProjectId(): string {
    return this.generateId(P.CATALOG_PORTFOLIO_PROJECT).id;
  }

  /** Οι ρυθμίσεις του καταλόγου — **ένα** έγγραφο ανά χώρο (singleton). */
  generateDeterministicCatalogSettingsId(companyId: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_SETTINGS, `catalog:settings:${companyId}`);
  }

  /**
   * Η κράτηση μιας μοναδικής τιμής. Το `uniqueKey` είναι ήδη κανονικοποιημένο (`uniqueValueKey`): «016–15–001» και
   * « 016-15-001 » δίνουν **το ίδιο** id ⇒ η δεύτερη κράτηση συγκρούεται μέσα στη συναλλαγή.
   */
  generateDeterministicCatalogUniqueValueId(companyId: string, attributeId: string, uniqueKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_UNIQUE_VALUE, `catalog:unique:${companyId}:${attributeId}:${uniqueKey}`);
  }

  // ── Φάση 3β (ADR-923 §5.11) — τιμοκατάλογοι. Το «κλειδί» είναι κωδικός ή ΦΥΣΙΚΟ κλειδί (ίδιος τρόπος `code`) ──

  generateDeterministicCatalogPriceListId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PRICE_LIST, seedOf('price-list', companyId, code));
  }

  /** Κλειδί = `priceListVersionKey(λίστα, αριθμός)` ⇒ δεύτερη «έκδοση 3» της ίδιας λίστας συγκρούεται στη συναλλαγή. */
  generateDeterministicCatalogPriceListVersionId(companyId: string, versionKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PRICE_LIST_VERSION, seedOf('price-list-version', companyId, versionKey));
  }

  /** Κλειδί = `priceListLineKey(έκδοση, υποκείμενο)` ⇒ μία γραμμή ανά υποκείμενο **δομικά**, και ιδεμπότητη αντιγραφή. */
  generateDeterministicCatalogPriceListLineId(companyId: string, lineKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PRICE_LIST_LINE, seedOf('price-list-line', companyId, lineKey));
  }

  generateDeterministicCatalogDiscountGroupId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_DISCOUNT_GROUP, seedOf('discount-group', companyId, code));
  }

  generateDeterministicCatalogCustomerGroupId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_CUSTOMER_GROUP, seedOf('customer-group', companyId, code));
  }

  /** Κλειδί = `pricingPartyKey(συμβαλλόμενος)` ⇒ **μία** ομάδα πελάτη ανά συμβαλλόμενο (SAP), δομικά. */
  generateDeterministicCatalogCustomerAssignmentId(companyId: string, partyKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_CUSTOMER_ASSIGNMENT, seedOf('customer-assignment', companyId, partyKey));
  }

  generateDeterministicCatalogPublicationRecipeId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PUBLICATION_RECIPE, seedOf('publication-recipe', companyId, code));
  }

  /** Κλειδί = hash εισόδων (ADR-923 §5.6): ίδιες είσοδοι ⇒ **ίδιο** έγγραφο, άρα το ίδιο αρχείο. */
  generateDeterministicCatalogPublicationRunId(companyId: string, inputHash: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PUBLICATION_RUN, seedOf('publication-run', companyId, inputHash));
  }

  /**
   * Δημοσιευμένη έκδοση — **τυχαία** (ADR-923 §5.15 Η1): αποσυρμένη έκδοση δεν ξαναζωντανεύει, η επαναδημοσίευση του ίδιου
   * αρχείου στο ίδιο κοινό είναι **νέα** εγγραφή. Η ιδεμποτία της πράξης ζει στον γραφέα (υπάρχουσα ισχύουσα ⇒ επιστρέφεται).
   */
  generateCatalogEditionId(): string {
    return this.generateId(P.CATALOG_EDITION).id;
  }

  /** Συνθήκη — **τυχαία**: δύο συνθήκες του ίδιου κοινού σε διαδοχικές περιόδους είναι νόμιμες. */
  generateCatalogDiscountConditionId(): string {
    return this.generateId(P.CATALOG_DISCOUNT_CONDITION).id;
  }

  /** Υποδοχή ασάφειας: όσοι μοιράζονται κλειδί **συγκρούονται** στη συναλλαγή (το ερώτημα δεν κλειδώνει «φαντάσματα»). */
  generateDeterministicCatalogPricingSlotId(companyId: string, slotKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PRICING_SLOT, seedOf('pricing-slot', companyId, slotKey));
  }

  /** Σήμα όψης τιμών (ADR-905): γραφέας και listener **υπολογίζουν** το id — κανένα ερώτημα, κανένα `list`. */
  generateDeterministicCatalogPricingViewSignalId(companyId: string, viewKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PRICING_VIEW_SIGNAL, seedOf('pricing-view-signal', companyId, viewKey));
  }

  /** Outbox δημόσιας προβολής (ADR-923 §5.13 Δ3): ένα έγγραφο ανά `{ companyId, scope }`, γραφέας και αδειαστής υπολογίζουν το id. */
  generateDeterministicCatalogPublicOutboxId(companyId: string, scopeKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_PUBLIC_OUTBOX, seedOf('public-outbox', companyId, scopeKey));
  }

  // ── Φάση 4 (ADR-923 §5.5.1) — εισαγωγή ──

  generateDeterministicCatalogImportProfileId(companyId: string, code: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_IMPORT_PROFILE, seedOf('import-profile', companyId, code));
  }

  /** Κλειδί = `importBatchKey(αρχείο, στόχος, έκδοση προφίλ, εκτέλεση)` ⇒ ίδια είσοδος δίνει την ίδια παρτίδα, δομικά. */
  generateDeterministicCatalogImportBatchId(companyId: string, batchKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_IMPORT_BATCH, seedOf('import-batch', companyId, batchKey));
  }

  /** Κλειδί = `importProposalKey(παρτίδα, σύνολο)` ⇒ η επανάληψη μιας ανάγνωσης ξαναγράφει την ίδια πρόταση. */
  generateDeterministicCatalogImportProposalId(companyId: string, proposalKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_IMPORT_PROPOSAL, seedOf('import-proposal', companyId, proposalKey));
  }

  /** Κλειδί = `importPageReadingKey(…)` ⇒ το ξαναδιάβασμα της ίδιας σελίδας ξαναγράφει το ίδιο έγγραφο. */
  generateDeterministicCatalogImportPageReadingId(companyId: string, readingKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_IMPORT_PAGE_READING, seedOf('import-page-reading', companyId, readingKey));
  }

  /** Κλειδί = `labelMemoryKey(προμηθευτής, οικογένεια, ετικέτα, μονάδα)` ⇒ **ένα** έγγραφο μνήμης ανά γραμμή του προμηθευτή (§5.5.2 Β5). */
  generateDeterministicCatalogImportLabelMemoryId(companyId: string, memoryKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_IMPORT_LABEL_MEMORY, seedOf('import-label-memory', companyId, memoryKey));
  }

  /** Κλειδί = `visibilityRuleKey` ⇒ **ένας** κανόνας ανά (αντικείμενο, κοινό), δομικά (ADR-923 §5.12 Δ1). */
  generateDeterministicCatalogVisibilityRuleId(companyId: string, ruleKey: string): string {
    return this.mintDeterministicV4Id(P.CATALOG_VISIBILITY_RULE, seedOf('visibility-rule', companyId, ruleKey));
  }

  /** Η **σειρά** των δύο άκρων είναι ταυτότητα: Α προμηθεύει Β ≠ Β προμηθεύει Α (ADR-923 §5.12 Σ1). */
  generateDeterministicSupplyRelationshipId(supplierCompanyId: string, buyerCompanyId: string): string {
    return this.mintDeterministicV4Id(P.SUPPLY_RELATIONSHIP, seedOf('supply-relationship', supplierCompanyId, buyerCompanyId));
  }

  generateSupplyInvitationId(): string {
    return this.generateId(P.SUPPLY_INVITATION).id;
  }

  /** Η κατοχή μάρκας: **ένα** έγγραφο ανά (χώρος, μάρκα), άρα η ανανέωση ξαναγράφει το ίδιο (ADR-923 §16). */
  generateDeterministicSupplierBrandClaimId(companyId: string, brandKey: string): string {
    return this.mintDeterministicV4Id(P.SUPPLIER_BRAND_CLAIM, seedOf('supplier-brand-claim', companyId, brandKey));
  }

  /** **Ένας** σύνδεσμος ανά χώρο, δομικά: η ανανέωση ανεβάζει τη γενιά του, δεν γεννά δεύτερο (Σ2). */
  generateDeterministicSupplyRequestLinkId(companyId: string): string {
    // ⛔ Μην «διορθώσεις» το δεύτερο όρισμα που λείπει: το id είναι η διεύθυνση ήδη γραμμένων εγγράφων (GOLDEN_IDS).
    return this.mintDeterministicV4Id(P.SUPPLY_REQUEST_LINK, seedOf('supply-request-link', companyId));
  }

  /**
   * Η επαφή **προμηθευτή της πλατφόρμας** στις επαφές του αγοραστή (ADR-923 §5.13 Ε6γ): **μία** ανά (αγοραστής,
   * προμηθευτής), με πρόθεμα `cont_`, ώστε το «υπάρχει ήδη;» να είναι ένα `tx.get` χωρίς ερώτημα και δείκτη, και
   * δύο ταυτόχρονα αιτήματα προσφοράς να συγκλίνουν στο ίδιο έγγραφο. Η σειρά είναι ταυτότητα: η επαφή ανήκει
   * στον αγοραστή. Χωρίς τυχαίο αδελφό από σχεδιασμό (`DETERMINISTIC_ONLY`): η τυχαία επαφή είναι το `generateContactId`.
   */
  generateDeterministicPlatformCompanyContactId(buyerCompanyId: string, supplierCompanyId: string): string {
    return this.mintDeterministicV4Id(P.CONTACT, seedOf('platform-company-contact', buyerCompanyId, supplierCompanyId));
  }
}
