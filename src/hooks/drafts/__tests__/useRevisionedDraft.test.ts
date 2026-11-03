import { act, renderHook } from '@testing-library/react';

import { useRevisionedDraft, type DraftFailure } from '../useRevisionedDraft';

/**
 * ADR-928 Φ3γ — η πολιτική `hold`: η σύγκρουση δεν λύνεται ΠΟΤΕ σιωπηλά, ούτε εις βάρος του ανθρώπου που
 * επεξεργάζεται, ούτε εις βάρος του άλλου. Η πολιτική `reset` (κατάλογος) καλύπτεται από τη σουίτα του καταλόγου.
 */

interface Doc { readonly label: string }
interface Issue { readonly code: string; readonly path: string }

const mismatch = (currentRevision: number | null): DraftFailure<Issue> => ({ kind: 'revisionMismatch', issues: [], currentRevision });

function setupHold(base: Doc, revision = 1) {
  return renderHook(({ b, r }) => useRevisionedDraft<Doc, Issue>(b, 'a', r, 'hold'), { initialProps: { b: base, r: revision } });
}

describe('useRevisionedDraft — `hold`: το 409 δεν πατά το πρόχειρο', () => {
  it('409 ⇒ το πρόχειρο μένει, «πίσω» = ναι, η βάση του CAS ΔΕΝ προχωρά μόνη της', () => {
    const { result } = setupHold({ label: 'v1' });
    act(() => result.current.update({ label: 'δικό μου' }));
    act(() => result.current.beginSave()({ ok: false, failure: mismatch(2) }));
    expect(result.current.draft.label).toBe('δικό μου');
    expect(result.current.behind).toBe(true);
    expect(result.current.baseRevision).toBe(1);
    expect(result.current.unsaved).toBe(true);
  });

  it('«κράτα τις αλλαγές μου» ⇒ βάση = η αναθεώρηση που ανέφερε ο γραφέας, ακόμη κι αν η ζωντανή δεν έφτασε', () => {
    const { result } = setupHold({ label: 'v1' });
    act(() => result.current.update({ label: 'δικό μου' }));
    act(() => result.current.beginSave()({ ok: false, failure: mismatch(3) }));
    act(() => result.current.adoptLatestBase());
    expect(result.current.baseRevision).toBe(3);
    expect(result.current.behind).toBe(false);
    expect(result.current.draft.label).toBe('δικό μου');
  });

  it('«φόρτωσε τη νέα εκδοχή» ⇒ το πρόχειρο γίνεται η ζωντανή βάση, καθαρό', () => {
    const { result, rerender } = setupHold({ label: 'v1' });
    act(() => result.current.update({ label: 'δικό μου' }));
    rerender({ b: { label: 'v2 (άλλος)' }, r: 2 });
    act(() => result.current.discard());
    expect(result.current.draft.label).toBe('v2 (άλλος)');
    expect(result.current.baseRevision).toBe(2);
    expect(result.current.behind).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it('η ζωντανή αλλαγή του άλλου φαίνεται ΠΡΙΝ την αποθήκευση (βρώμικο + νεότερη αναθεώρηση ⇒ «πίσω»)', () => {
    const { result, rerender } = setupHold({ label: 'v1' });
    act(() => result.current.update({ label: 'δικό μου' }));
    rerender({ b: { label: 'v2 (άλλος)' }, r: 2 });
    expect(result.current.behind).toBe(true);
    expect(result.current.draft.label).toBe('δικό μου');
    act(() => result.current.adoptLatestBase());
    expect(result.current.baseRevision).toBe(2);
    expect(result.current.behind).toBe(false);
  });

  it('καθαρό πρόχειρο ακολουθεί σιωπηλά — δεν υπάρχει τίποτα να χαθεί, άρα ούτε «πίσω»', () => {
    const { result, rerender } = setupHold({ label: 'v1' });
    rerender({ b: { label: 'v2 (άλλος)' }, r: 2 });
    expect(result.current.draft.label).toBe('v2 (άλλος)');
    expect(result.current.behind).toBe(false);
    expect(result.current.baseRevision).toBe(2);
  });

  it('επιτυχής αποθήκευση μετά την υιοθέτηση ⇒ η σύγκρουση κλείνει', () => {
    const { result, rerender } = setupHold({ label: 'v1' });
    act(() => result.current.update({ label: 'δικό μου' }));
    act(() => result.current.beginSave()({ ok: false, failure: mismatch(2) }));
    act(() => result.current.adoptLatestBase());
    act(() => result.current.beginSave()({ ok: true, record: null }));
    rerender({ b: { label: 'δικό μου' }, r: 3 });
    expect(result.current.behind).toBe(false);
    expect(result.current.dirty).toBe(false);
    expect(result.current.baseRevision).toBe(3);
  });
});
