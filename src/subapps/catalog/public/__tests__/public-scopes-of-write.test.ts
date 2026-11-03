/**
 * Ποια δημόσια προβολή αγγίζει μια γραφή (ADR-923 §5.13 Δ3), και πόσο μεγαλώνει η συναλλαγή σε μεγάλη παρτίδα.
 */

import { distinctPublicScopes, publicScopeKey, publicScopesOfWrite } from '../public-scopes-of-write';

const keysOf = (kind: string, record: Record<string, unknown>) => publicScopesOfWrite(kind, record).map(publicScopeKey);

describe('publicScopesOfWrite', () => {
  it('το προφίλ παρόχου έχει δικό του scope και δεν ξεκινά πέρασμα καταλόγου', () => {
    expect(keysOf('supplierProfile', { id: 'cspro_1' })).toEqual(['profile']);
  });

  it('το SKU οδηγεί στη ρίζα, όχι στο άμεσο υπο-μοντέλο', () => {
    expect(keysOf('product', { id: 'p', modelId: 'sub', derived: { rootModelId: 'root' } })).toEqual(['model:root']);
  });

  it('χωρίς παράγωγα μένει ο άμεσος γονέας', () => {
    expect(keysOf('product', { id: 'p', modelId: 'sub' })).toEqual(['model:sub']);
  });

  it('απλό προϊόν ⇒ το δικό του id', () => {
    expect(keysOf('product', { id: 'p', modelId: null, derived: { rootModelId: null } })).toEqual(['model:p']);
  });

  it('το μοντέλο οδηγεί στη ρίζα του, ή στον εαυτό του αν είναι ρίζα', () => {
    expect(keysOf('productModel', { id: 'sub', derived: { rootModelId: 'root' } })).toEqual(['model:root']);
    expect(keysOf('productModel', { id: 'root', derived: { rootModelId: null } })).toEqual(['model:root']);
  });

  it.each(['attribute', 'attributeGroup', 'measurementFamily', 'category', 'family', 'asset', 'settings'])('%s ⇒ catalog', (kind) => {
    expect(keysOf(kind, { id: 'x' })).toEqual(['catalog']);
  });

  it('κανόνας ορατότητας μοντέλου ⇒ το μοντέλο · κάθε άλλος ⇒ catalog', () => {
    expect(keysOf('visibilityRule', { subject: { kind: 'productModel', modelId: 'm' } })).toEqual(['model:m']);
    expect(keysOf('visibilityRule', { subject: { kind: 'variant', variantId: 'v' } })).toEqual(['catalog']);
    expect(keysOf('visibilityRule', {})).toEqual(['catalog']);
  });

  it.each(['importBatch', 'importProposal', 'priceList', 'priceListLine', 'discountCondition', 'publicationRecipe'])('🔒 %s ⇒ κενό: δεν μεγαλώνει τη συναλλαγή', (kind) => {
    expect(keysOf(kind, { id: 'x', modelId: 'm' })).toEqual([]);
  });
});

describe('distinctPublicScopes', () => {
  it('μεγάλη παρτίδα: 500 SKU σε 3 μοντέλα ⇒ 3 εγγραφές outbox, όχι 500', () => {
    const scopes = Array.from({ length: 500 }, (_, index) =>
      publicScopesOfWrite('product', { id: `p${index}`, modelId: `m${index % 3}`, derived: { rootModelId: `m${index % 3}` } })).flat();
    expect(distinctPublicScopes(scopes).map(publicScopeKey).sort()).toEqual(['model:m0', 'model:m1', 'model:m2']);
  });
});
