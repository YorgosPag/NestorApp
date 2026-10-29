import type { PriceListLineWire } from '@/subapps/catalog/types/pricing-views';
import {
  breakdownTotal,
  costItemSubject,
  isPriceLineDraftDirty,
  minorFromEnteredText,
  newPriceLineRow,
  pendingCodes,
  priceLineChangesOf,
  priceLineDraftOf,
  priceLineIssues,
  rebasePriceLineDraft,
  resolvePriceLineCode,
  withEnteredCode,
  type PriceLineRow,
} from '../price-line-rows';

const stored = (id: string, variantId: string, netPrice: number, revision = 1) =>
  ({
    id,
    revision,
    versionId: 'v1',
    subject: { kind: 'variant', variantId },
    netPrice,
    priceQuantity: 1,
    unitCode: 'pcs',
    discountGroupId: null,
    breakdown: null,
  }) as unknown as PriceListLineWire;

const SKUS = { prod_a: 'MFP-A', prod_b: 'MFP-B' };
const CONTEXT = { priceType: 'net_list', discountGroupIds: new Set<string>() } as const;
const base = priceLineDraftOf([stored('l_b', 'prod_b', 2000), stored('l_a', 'prod_a', 1000)], SKUS);
const edit = (row: PriceLineRow, patch: Partial<PriceLineRow>): PriceLineRow => ({ ...row, ...patch });

describe('minorFromEnteredText — ελληνικό πληκτρολόγιο, ποτέ σιωπηλή στρογγύλευση', () => {
  it.each([['12,50', 1250], ['1.200,5', 120050], ['0', 0], ['7', 700]])('«%s» ⇒ %d λεπτά', (text, minor) => {
    expect(minorFromEnteredText(text)).toBe(minor);
  });
  it.each(['12,505', '-1', 'abc', ''])('«%s» ⇒ άρνηση', (text) => expect(minorFromEnteredText(text)).toBeNull());
});

describe('πρόχειρο γραμμών', () => {
  it('ταξινόμηση κατά κωδικό SKU · αμετάβλητο = καθαρό', () => {
    expect(base.rows.map((row) => row.code)).toEqual(['MFP-A', 'MFP-B']);
    expect(isPriceLineDraftDirty(base)).toBe(false);
  });

  it('αλλαγή τιμής ⇒ ένα upsert · αφαίρεση ⇒ μία διαγραφή', () => {
    const draft = { rows: [edit(base.rows[0], { netPrice: 1080 })], removed: [base.rows[1].stored as PriceListLineWire] };
    const changes = priceLineChangesOf(draft);
    expect(changes.upserts.map((line) => line.netPrice)).toEqual([1080]);
    expect(changes.deletes).toEqual([{ kind: 'variant', variantId: 'prod_b' }]);
  });

  it('αλλαγή κωδικού αποθηκευμένης ⇒ διαγραφή της παλιάς ταυτότητας + νέα, ποτέ σιωπηλή μετακόμιση', () => {
    const moved = edit(base.rows[0], { code: 'MFP-C', subject: { kind: 'variant', variantId: 'prod_c' } });
    const changes = priceLineChangesOf({ rows: [moved], removed: [] });
    expect(changes.upserts[0].subject).toEqual({ kind: 'variant', variantId: 'prod_c' });
    expect(changes.deletes).toEqual([{ kind: 'variant', variantId: 'prod_a' }]);
  });

  it('εργασία ΑΤΟΕ: η τιμή ΕΙΝΑΙ το άθροισμα της ανάλυσης', () => {
    const row = edit(newPriceLineRow('costItem', 'n1', 'm'), {
      code: 'ΟΙΚ-22.10', subject: costItemSubject('ΟΙΚ-22.10', ' '), resolution: 'resolved',
      breakdown: { material: 1000, labor: 500, equipment: 250, defaultWasteBp: 300, materialVariantId: null },
    });
    expect(row.subject).toEqual({ kind: 'costItem', atoeCode: 'ΟΙΚ-22.10', region: null });
    expect(priceLineChangesOf({ rows: [row], removed: [] }).upserts[0].netPrice).toBe(breakdownTotal(row.breakdown!));
  });
});

describe('επίλυση κωδικού SKU', () => {
  it('νέος κωδικός ⇒ περιμένει επίλυση, ποτέ η παλιά ταυτότητα με νέο κωδικό· ίδιος κωδικός ⇒ αμετάβλητη', () => {
    const typed = withEnteredCode(base.rows[0], ' MFP-Z ');
    expect(typed).toMatchObject({ code: 'MFP-Z', subject: null, resolution: 'pending' });
    expect(withEnteredCode(base.rows[0], 'MFP-A')).toBe(base.rows[0]);
  });

  it('η απάντηση γράφει ΜΟΝΟ σε γραμμές που ακόμη περιμένουν τον ίδιο κωδικό', () => {
    const a = withEnteredCode(newPriceLineRow('variant', 'n1', 'pcs'), 'MFP-Z');
    const b = withEnteredCode(newPriceLineRow('variant', 'n2', 'pcs'), 'OTHER');
    const draft = { rows: [a, b], removed: [] };
    expect(pendingCodes(draft)).toEqual(['MFP-Z', 'OTHER']);
    const resolved = resolvePriceLineCode(draft, 'MFP-Z', 'prod_z');
    expect(resolved.rows[0]).toMatchObject({ subject: { kind: 'variant', variantId: 'prod_z' }, resolution: 'resolved' });
    expect(resolved.rows[1]).toBe(b);
    expect(resolvePriceLineCode(draft, 'OTHER', null).rows[1].resolution).toBe('unknown');
    expect(resolvePriceLineCode(draft, 'NOBODY', 'x')).toBe(draft);
  });
});

describe('ευρήματα — η ΙΔΙΑ επικύρωση με τον διακομιστή, ανά γραμμή', () => {
  it('κενός κωδικός · άγνωστο SKU · χωρίς τιμή', () => {
    const empty = edit(newPriceLineRow('variant', 'n1', 'pcs'), { netPrice: 100 });
    const unknown = edit(newPriceLineRow('variant', 'n2', 'pcs'), { code: 'NOPE', resolution: 'unknown', netPrice: 100 });
    const noPrice = edit(base.rows[0], { netPrice: null });
    const issues = priceLineIssues({ rows: [empty, unknown, noPrice], removed: [] }, CONTEXT);
    expect(issues.get('n1')?.map((i) => i.code)).toEqual(['priceLineSubjectRequired']);
    expect(issues.get('n2')?.map((i) => i.code)).toEqual(['priceLineSkuUnknown']);
    expect(issues.get('l_a')?.map((i) => i.code)).toEqual(['priceAmountInvalid']);
  });

  it('δύο γραμμές για το ίδιο SKU ⇒ διπλότυπο στη ΔΕΥΤΕΡΗ', () => {
    const twin = edit(newPriceLineRow('variant', 'n1', 'pcs'), { code: 'MFP-A', subject: base.rows[0].subject, resolution: 'resolved', netPrice: 1 });
    const issues = priceLineIssues({ rows: [...base.rows, twin], removed: [] }, CONTEXT);
    expect(issues.get('n1')?.map((i) => i.code)).toEqual(['priceLineSubjectDuplicate']);
  });
});

describe('rebase πάνω στη ζωντανή έκδοση', () => {
  it('ζωντανή αλλαγή σε γραμμή που ΔΕΝ πείραξα ⇒ υιοθετείται σιωπηλά', () => {
    const live = priceLineDraftOf([stored('l_b', 'prod_b', 2000), stored('l_a', 'prod_a', 1111, 2)], SKUS);
    const { draft, conflicts } = rebasePriceLineDraft(base, live);
    expect(draft.rows.find((row) => row.key === 'l_a')?.netPrice).toBe(1111);
    expect(conflicts).toEqual([]);
  });

  it('ζωντανή αλλαγή σε γραμμή που ΚΑΙ εγώ άλλαξα ⇒ κρατιέται η ζωντανή, η σύγκρουση αναφέρεται', () => {
    const mine = { rows: [edit(base.rows[0], { netPrice: 999 }), base.rows[1]], removed: [] };
    const live = priceLineDraftOf([stored('l_b', 'prod_b', 2000), stored('l_a', 'prod_a', 1111, 2)], SKUS);
    const { draft, conflicts } = rebasePriceLineDraft(mine, live);
    expect(draft.rows.find((row) => row.key === 'l_a')?.netPrice).toBe(1111);
    expect(conflicts).toEqual(['MFP-A']);
  });

  it('η ζωντανή έγινε ΙΔΙΑ με το πρόχειρο (η δική μου αποθήκευση) ⇒ καμία σύγκρουση', () => {
    const mine = { rows: [edit(base.rows[0], { netPrice: 1111 }), base.rows[1]], removed: [] };
    const live = priceLineDraftOf([stored('l_b', 'prod_b', 2000), stored('l_a', 'prod_a', 1111, 2)], SKUS);
    expect(rebasePriceLineDraft(mine, live).conflicts).toEqual([]);
  });

  const SKUS_C = { ...SKUS, prod_c: 'MFP-C' };
  const fresh = (netPrice: number) =>
    edit(newPriceLineRow('variant', 'tmp1', 'pcs'), { code: 'MFP-C', subject: { kind: 'variant', variantId: 'prod_c' }, resolution: 'resolved', netPrice });

  it('νέα γραμμή που αποθηκεύτηκε ⇒ υιοθετείται η αποθηκευμένη, ΠΟΤΕ δύο γραμμές ίδιου SKU', () => {
    const mine = { rows: [...base.rows, fresh(3000)], removed: [] };
    const live = priceLineDraftOf([stored('l_b', 'prod_b', 2000), stored('l_a', 'prod_a', 1000), stored('l_c', 'prod_c', 3000)], SKUS_C);
    const { draft, conflicts } = rebasePriceLineDraft(mine, live);
    expect(draft.rows.map((row) => row.key).sort()).toEqual(['l_a', 'l_b', 'l_c']);
    expect(conflicts).toEqual([]);
    expect(isPriceLineDraftDirty(draft)).toBe(false);
  });

  it('άλλος πρόσθεσε το ίδιο SKU με άλλη τιμή ⇒ κερδίζει η ζωντανή, η δική μου αναφέρεται', () => {
    const mine = { rows: [...base.rows, fresh(9999)], removed: [] };
    const live = priceLineDraftOf([stored('l_b', 'prod_b', 2000), stored('l_a', 'prod_a', 1000), stored('l_c', 'prod_c', 3000)], SKUS_C);
    const { draft, conflicts } = rebasePriceLineDraft(mine, live);
    expect(draft.rows.filter((row) => row.code === 'MFP-C').map((row) => row.netPrice)).toEqual([3000]);
    expect(conflicts).toEqual(['MFP-C']);
  });
});
