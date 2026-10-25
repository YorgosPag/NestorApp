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
}
