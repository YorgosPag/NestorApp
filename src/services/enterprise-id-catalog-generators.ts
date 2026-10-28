/**
 * Γεννήτορες ταυτοτήτων του σχήματος καταλόγου (ADR-923 §5.9) — κρίκος της αλυσίδας
 * γεννητόρων, ακριβώς κάτω από την `EnterpriseIdService`:
 *
 *   EnterpriseIdService
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
}
