/**
 * ADR-923 §5.10.4 Β4 — το πρόχειρο του πλέγματος παραλλαγών: στήλες επιπέδου, μία δέσμη, rebase ανά γραμμή.
 */
import { MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { MFP_MODEL, MFP_MODEL_ID, MFP_VARIANTS, mfpVariantId } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil-products.fixture';
import type { StoredMemberShape } from '@/subapps/catalog/aggregate/aggregate-members';
import { writeHolderValue } from '@/subapps/catalog/values/holder-edit';

import {
  cellIssues,
  isDraftDirty,
  newVariantRows,
  rebaseVariantDraft,
  variantBatchOf,
  variantColumnIds,
  variantDraftOf,
  type VariantDraft,
} from '../variant-rows';

const scheme = MFP_FAMILY.variantSchemes[0];
const derived = (sortKey: string) => ({ sortKey }) as never;
const members = (revisions: number[] = MFP_VARIANTS.map(() => 1), variants = MFP_VARIANTS): StoredMemberShape[] => [
  { kind: 'productModel', record: { ...MFP_MODEL, id: MFP_MODEL_ID, revision: 1, derived: derived('mfp') } },
  ...variants.map((variant, index): StoredMemberShape => ({ kind: 'product', record: { ...variant, id: mfpVariantId(index), revision: revisions[index], derived: derived(`k${index}`) } })),
];
const plain = { scopable: false, localizable: false };
const edit = (draft: VariantDraft, index: number, amount: string): VariantDraft => ({
  ...draft,
  rows: draft.rows.map((row, i) => (i === index ? { ...row, definition: writeHolderValue(row.definition, 'cooling_h', plain, 'print', 'el', { type: 'measurement', amount, unitCode: 'kW' }) } : row)),
});

describe('στήλες + πρόχειρο', () => {
  it('στήλες επιπέδου: πρώτα ο άξονας (μέγεθος), μετά οι ιδιότητες που κατέχει το SKU · ρίζα 2 επιπέδων ⇒ null', () => {
    const columns = variantColumnIds(scheme, 0)!;
    expect(columns[0]).toBe('size');
    expect(columns).toContain('cooling_h');
    expect(columns).not.toContain('description');
    expect(variantColumnIds(scheme, 1)).toBeNull();
    expect(variantColumnIds(null, 0)).toBeNull();
  });

  it('πρόχειρο από τα ζωντανά: οι 7 παραλλαγές με σειρά sortKey · καθαρό ⇒ κενή δέσμη', () => {
    const draft = variantDraftOf(members(), MFP_MODEL_ID);
    expect(draft.rows.map((row) => row.id)).toEqual(MFP_VARIANTS.map((_, i) => mfpVariantId(i)));
    expect(isDraftDirty(draft)).toBe(false);
    expect(variantBatchOf(draft)).toEqual({ upserts: [], deletes: [] });
  });

  it('δέσμη: ΜΟΝΟ ό,τι άλλαξε, CAS με την αναθεώρηση που διαβάστηκε · νέες με id πελάτη και null · διαγραφές', () => {
    const base = variantDraftOf(members([3, 1, 1, 1, 1, 1, 1]), MFP_MODEL_ID);
    const fresh = newVariantRows([{ size: { '*': { '*': { type: 'select', optionCode: 'mfp_34' } } } }], { modelId: MFP_MODEL_ID, familyId: 'fan_coil' }, () => 'cprod_new');
    const draft: VariantDraft = { rows: [...edit(base, 0, '9.9').rows.slice(0, 6), ...fresh], removed: [base.rows[6].stored!] };
    const batch = variantBatchOf(draft);
    expect(batch.upserts.map((upsert) => [upsert.id, upsert.expectedRevision])).toEqual([[mfpVariantId(0), 3], ['cprod_new', null]]);
    expect(batch.deletes).toEqual([{ id: mfpVariantId(6), expectedRevision: 1 }]);
  });

  it('ευρήματα στο κελί τους (variants.<id>.values.<attr>)', () => {
    const issue = { code: 'consistencyRuleViolated' as const, path: `variants.${mfpVariantId(2)}.values.heating_h`, params: { ruleId: 'r' } };
    expect(cellIssues([issue], mfpVariantId(2), 'heating_h')).toEqual([issue]);
    expect(cellIssues([issue], mfpVariantId(2), 'heating_m')).toEqual([]);
  });
});

describe('🔴 rebase ανά γραμμή — καμία απώλεια επικόλλησης επειδή κάποιος άλλαξε ΜΙΑ γραμμή', () => {
  it('άλλος άλλαξε τη γραμμή 5 · εμείς τις 0–1 ⇒ οι δικές μας μένουν, η 5 παίρνει τη ζωντανή, ΚΑΜΙΑ σύγκρουση', () => {
    const draft = edit(edit(variantDraftOf(members(), MFP_MODEL_ID), 0, '9.1'), 1, '9.2');
    const remoteVariants = MFP_VARIANTS.map((variant, i) => (i === 5 ? writeHolderValue(variant, 'cooling_h', plain, 'print', 'el', { type: 'measurement', amount: '5.5', unitCode: 'kW' }) : variant));
    const live = variantDraftOf(members([1, 1, 1, 1, 1, 2, 1], remoteVariants), MFP_MODEL_ID);
    const { draft: rebased, conflicts } = rebaseVariantDraft(draft, live);
    expect(conflicts).toEqual([]);
    expect(rebased.rows[0].definition).toEqual(draft.rows[0].definition);
    expect(rebased.rows[5].definition).toEqual(remoteVariants[5]);
  });

  it('η ΙΔΙΑ γραμμή άλλαξε και αλλού ⇒ κρατά τη ζωντανή και ΑΝΑΦΕΡΕΙ τη σύγκρουση', () => {
    const draft = edit(variantDraftOf(members(), MFP_MODEL_ID), 0, '9.1');
    const live = variantDraftOf(members([2, 1, 1, 1, 1, 1, 1]), MFP_MODEL_ID);
    expect(rebaseVariantDraft(draft, live).conflicts).toEqual([mfpVariantId(0)]);
  });

  it('🔴 μετά από ΔΙΚΗ μας αποθήκευση: ζωντανή = πρόχειρο ⇒ ΟΧΙ σύγκρουση, καθαρό · νέα γραμμή «δένεται»', () => {
    const draft = edit(variantDraftOf(members(), MFP_MODEL_ID), 0, '9.1');
    const saved = MFP_VARIANTS.map((variant, i) => (i === 0 ? draft.rows[0].definition : variant));
    const live = variantDraftOf(members([2, 1, 1, 1, 1, 1, 1], saved), MFP_MODEL_ID);
    const rebased = rebaseVariantDraft(draft, live);
    expect(rebased.conflicts).toEqual([]);
    expect(isDraftDirty(rebased.draft)).toBe(false);
  });

  it('🔴 νέα γραμμή «δένεται» μετά την αποθήκευση ΑΚΟΜΗ κι αν το Firestore γυρίσει τα κλειδιά με ΑΛΛΗ σειρά', () => {
    // Ζωντανά: η επικόλληση χτίζει τα `values` με τη σειρά των στηλών· το έγγραφο επιστρέφει άλλη σειρά κλειδιών.
    const reversed = <T extends object>(map: T): T => Object.fromEntries(Object.entries(map).reverse()) as T;
    const [fresh] = newVariantRows([MFP_VARIANTS[0].values], { modelId: MFP_MODEL_ID, familyId: 'fan_coil' }, () => 'cpr_new');
    const draft: VariantDraft = { rows: [fresh], removed: [] };
    const stored = { ...fresh.definition, values: reversed(fresh.definition.values) };
    const live = variantDraftOf([
      { kind: 'productModel', record: { ...MFP_MODEL, id: MFP_MODEL_ID, revision: 1, derived: derived('mfp') } },
      { kind: 'product', record: { ...reversed(stored), id: 'cpr_new', revision: 1, derived: derived('k') } },
    ], MFP_MODEL_ID);
    const rebased = rebaseVariantDraft(draft, live);
    expect(rebased.draft.rows[0].stored).not.toBeNull();
    expect(isDraftDirty(rebased.draft)).toBe(false);
  });
});
