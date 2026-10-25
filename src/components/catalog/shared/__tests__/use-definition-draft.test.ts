import { act, renderHook } from '@testing-library/react';

import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import { useDefinitionDraft } from '../use-definition-draft';

interface Def { readonly label: string }

const failure = (kind: CatalogFailure['kind'], issues: CatalogFailure['issues'] = []): CatalogFailure => ({
  kind,
  issues,
  currentRevision: null,
});

function setup(base: Def, identity = 'a') {
  return renderHook(({ b, id }) => useDefinitionDraft<Def>(b, id), { initialProps: { b: base, id: identity } });
}

describe('useDefinitionDraft — ποτέ σιωπηλή απώλεια του προχείρου', () => {
  it('καθαρό πρόχειρο ακολουθεί τη ζωντανή αλλαγή άλλου', () => {
    const { result, rerender } = setup({ label: 'Ψύξη' });
    rerender({ b: { label: 'Ψύξη (άλλος)' }, id: 'a' });
    expect(result.current.draft.label).toBe('Ψύξη (άλλος)');
    expect(result.current.dirty).toBe(false);
  });

  it('βρώμικο πρόχειρο ΔΕΝ πατιέται από ζωντανή αλλαγή', () => {
    const { result, rerender } = setup({ label: 'Ψύξη' });
    act(() => result.current.update({ label: 'δικό μου' }));
    rerender({ b: { label: 'Ψύξη (άλλος)' }, id: 'a' });
    expect(result.current.draft.label).toBe('δικό μου');
    expect(result.current.status).toBe('dirty');
  });

  it('422: το πρόχειρο μένει, τα ευρήματα φαίνονται', () => {
    const { result } = setup({ label: 'Ψύξη' });
    act(() => result.current.update({ label: '' }));
    const issues = [{ code: 'labelRequired' as const, path: 'labels' }];
    act(() => result.current.beginSave()({ ok: false, failure: failure('invalid', issues) }));
    expect(result.current.draft.label).toBe('');
    expect(result.current.serverIssues).toEqual(issues);
  });

  it('409: επιστρέφει στη ΝΕΟΤΕΡΗ βάση (όχι σε αυτή της στιγμής της αποθήκευσης)', () => {
    const { result, rerender } = setup({ label: 'v1' });
    act(() => result.current.update({ label: 'δικό μου' }));
    let settle: ReturnType<typeof result.current.beginSave> = () => undefined;
    act(() => { settle = result.current.beginSave(); });
    rerender({ b: { label: 'v2 (άλλος)' }, id: 'a' });
    expect(result.current.draft.label).toBe('δικό μου');
    act(() => settle({ ok: false, failure: failure('revisionMismatch') }));
    expect(result.current.draft.label).toBe('v2 (άλλος)');
  });

  it('βάση του CAS: καθαρό πρόχειρο ακολουθεί τη ζωντανή αναθεώρηση, βρώμικο κρατά αυτήν που ΔΙΑΒΑΣΕ ο άνθρωπος', () => {
    const { result, rerender } = renderHook(({ b, rev }) => useDefinitionDraft<Def>(b, 'a', rev), {
      initialProps: { b: { label: 'Ψύξη' }, rev: 1 },
    });
    rerender({ b: { label: 'Ψύξη (άλλος)' }, rev: 2 });
    expect(result.current.baseRevision).toBe(2);
    act(() => result.current.update({ label: 'δικό μου' }));
    rerender({ b: { label: 'Ψύξη (τρίτος)' }, rev: 3 });
    expect(result.current.baseRevision).toBe(2);
    act(() => result.current.beginSave()({ ok: false, failure: failure('revisionMismatch') }));
    expect(result.current.draft.label).toBe('Ψύξη (τρίτος)');
    expect(result.current.baseRevision).toBe(3);
  });

  it('πρόχειρο σε αποστολή ΔΕΝ είναι «μη αποθηκευμένο» — ξαναγίνεται μόνο αν ο γραφέας αρνηθεί', () => {
    const { result } = setup({ label: 'Ψύξη' });
    act(() => result.current.update({ label: 'δικό μου' }));
    expect(result.current.unsaved).toBe(true);
    let settle: ReturnType<typeof result.current.beginSave> = () => undefined;
    act(() => { settle = result.current.beginSave(); });
    expect(result.current.dirty).toBe(true);
    expect(result.current.unsaved).toBe(false);
    act(() => settle({ ok: false, failure: failure('invalid') }));
    expect(result.current.unsaved).toBe(true);
  });

  it('άλλη οντότητα ⇒ νέο πρόχειρο, ακόμη κι αν το προηγούμενο ήταν βρώμικο', () => {
    const { result, rerender } = setup({ label: 'a' });
    act(() => result.current.update({ label: 'αλλαγή' }));
    rerender({ b: { label: 'b' }, id: 'b' });
    expect(result.current.draft.label).toBe('b');
    expect(result.current.status).toBe('clean');
  });
});
