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
 * Όλα **ντετερμινιστικά v4** (`mintDeterministicV4Id`, ADR-841 Α9.6: ο επικυρωτής του έργου
 * δέχεται μόνο v4). Ίδιος χώρος + ίδιος κωδικός ⇒ **ίδιο** id ⇒ δεύτερη δημιουργία = σύγκρουση
 * στη συναλλαγή, όχι διπλότυπο.
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
}
