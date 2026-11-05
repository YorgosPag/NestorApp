/**
 * Συγγραφή ρήτρας (ADR-928 §5.22 · Φ3γ-0b-1): chip παραμέτρου στο σώμα · «Κάνε το παράμετρο» από επιλογή ·
 * χάρακας ζωνών · υποβολή με CAS (409 ⇒ λωρίδα σύγκρουσης, επιτυχία ⇒ ουρά ελέγχου).
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';

import { clauseBody, paragraph, param } from '@/subapps/procurement/subcontracts/clauses/clause-body-builders';
import { retentionBody, retentionRate } from '@/subapps/procurement/subcontracts/clauses/__tests__/clause-fixtures';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import { ClauseBodyEditor } from '../ClauseBodyEditor';
import { ToleranceEditor } from '../ToleranceEditor';
import { useClauseAuthoring } from '../useClauseAuthoring';

jest.setTimeout(60_000);

const push = jest.fn();
jest.mock('@/lib/workspace/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/providers/DirtyFormProvider', () => ({ useReportUnsavedEdits: jest.fn() }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    i18n: { language: 'el' },
  }),
}));
jest.mock('@/components/procurement/subcontracts/subcontract-messages', () => ({
  useSubcontractIssueMessage: () => (issue: { code: string; path: string }) => `${issue.code}@${issue.path}`,
}));

beforeAll(() => {
  // ProseMirror ζητά γεωμετρία που το jsdom δεν έχει.
  const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
  Range.prototype.getBoundingClientRect = () => rect as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});

const editorOf = (container: HTMLElement): Editor => (container.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor;

describe('ClauseBodyEditor — chip παραμέτρου και «Κάνε το παράμετρο»', () => {
  it('το chip δείχνει ετικέτα · τιμή όπως τυπώνεται, όχι το κλειδί', async () => {
    render(<ClauseBodyEditor id="b" label="Κείμενο" blocks={retentionBody.blocks} parameters={[retentionRate]} onChange={jest.fn()} />);
    expect(await screen.findByText('Ποσοστό κράτησης')).toBeInTheDocument();
    expect(screen.getByText(/5\s?%/)).toBeInTheDocument();
  });

  it('επιλογή «5%» ⇒ νέα παράμετρος ποσοστού 5%, και το chip στη θέση του κειμένου — σε ΜΙΑ αλλαγή', async () => {
    const onChange = jest.fn();
    const { container } = render(<ClauseBodyEditor id="b" label="Κείμενο" blocks={[paragraph('Κράτηση 5% ανά λογαριασμό.')]} parameters={[]} onChange={onChange} />);
    await waitFor(() => expect(editorOf(container)).toBeTruthy());
    act(() => {
      editorOf(container).commands.setTextSelection({ from: 9, to: 11 });
    });
    fireEvent.click(await screen.findByRole('button', { name: /makeParameter$/ }));
    fireEvent.change(screen.getByLabelText('subcontracts.library.authoring.parameter.label'), { target: { value: 'Ποσοστό κράτησης' } });
    fireEvent.click(screen.getByRole('button', { name: 'subcontracts.library.authoring.newParameter.create' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const [blocks, added] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(added).toMatchObject({ key: 'pososto_kratisis', kind: 'percent', preferred: { kind: 'percent', value: 500 } });
    expect(blocks).toEqual([paragraph('Κράτηση ', param('pososto_kratisis'), ' ανά λογαριασμό.')]);
  });

  it('αλλαγή απ\' έξω (απόρριψη αλλαγών) ξαναγράφει την όψη· η δική του αλλαγή όχι', async () => {
    const { container, rerender } = render(<ClauseBodyEditor id="b" label="Κείμενο" blocks={[paragraph('Πρώτο.')]} parameters={[]} onChange={jest.fn()} />);
    await waitFor(() => expect(editorOf(container)).toBeTruthy());
    rerender(<ClauseBodyEditor id="b" label="Κείμενο" blocks={clauseBody('Κ', paragraph('Δεύτερο.')).blocks} parameters={[]} onChange={jest.fn()} />);
    await waitFor(() => expect(editorOf(container).getText()).toBe('Δεύτερο.'));
  });
});

describe('ToleranceEditor — χάρακας και λέξεις του εγκρίνοντος', () => {
  it('πέντε ζώνες + ★, και τα τέσσερα όρια', () => {
    const { container } = render(<ToleranceEditor id="t" definition={retentionRate} onChange={jest.fn()} issues={[]} />);
    expect(container.querySelectorAll('svg rect')).toHaveLength(6);
    for (const bound of ['walkMin', 'freeMin', 'freeMax', 'walkMax']) {
      expect(screen.getByLabelText(`subcontracts.library.authoring.tolerance.bounds.${bound}`)).toBeInTheDocument();
    }
  });
});

describe('useClauseAuthoring — υποβολή με CAS', () => {
  const clause = { id: 'sccl_1', clauseKey: 'retention.performance', title: { el: 'Κράτηση' }, currentVersion: 1, latestVersion: 1, openProposal: null, isArchived: false, revision: 4 } as unknown as SubcontractClause;
  const base = { version: 1, state: 'approved', body: retentionBody, parameters: [retentionRate], translations: {} } as unknown as SubcontractClauseVersion;
  const authority = { pending: false, canPropose: true, canManageClauses: false, canManageTemplates: false, canSeed: false, actorUid: 'u1' };

  function setup(outcome: unknown) {
    const proposeClauseVersion = jest.fn(async () => outcome);
    const actions = { createClause: jest.fn(), proposeClauseVersion };
    const hook = renderHook(() => useClauseAuthoring({ mode: 'propose', clause, base, takenKeys: new Set(), authority, actions } as never));
    act(() => hook.result.current.update({ ...hook.result.current.draft, body: { ...base.body, heading: 'Νέα επικεφαλίδα' } }));
    return { hook, proposeClauseVersion };
  }

  it('στέλνει την αναθεώρηση που διάβασε ο άνθρωπος· επιτυχία ⇒ ουρά ελέγχου στη ρήτρα', async () => {
    push.mockClear();
    const { hook, proposeClauseVersion } = setup({ ok: true, record: { clauseId: 'sccl_1' } });
    expect(hook.result.current.saveBlock).toBeNull();
    await act(async () => { await hook.result.current.submit('Νέα διατύπωση'); });
    expect(proposeClauseVersion).toHaveBeenCalledWith('sccl_1', expect.objectContaining({ expectedRevision: 4, proposalReason: 'Νέα διατύπωση' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining('clause=sccl_1')));
  });

  it('409 ⇒ το πρόχειρο μένει, «πίσω» και η υποβολή κλειστή ώσπου να διαλέξει ο άνθρωπος', async () => {
    const { hook } = setup({ ok: false, failure: { kind: 'revisionMismatch', issues: [], currentRevision: 5 } });
    await act(async () => { await hook.result.current.submit(null); });
    expect(hook.result.current.draft.body.heading).toBe('Νέα επικεφαλίδα');
    expect(hook.result.current.behind).toBe(true);
    expect(hook.result.current.saveBlock).toEqual({ kind: 'conflict' });
  });
});
