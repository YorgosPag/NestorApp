/**
 * Επεξεργαστής προτύπου (ADR-928 §5.22 · Φ3γ-0b-2): «όπως στη βιβλιοθήκη» = απουσία κλειδιού · δεσμευμένη παράμετρος
 * μόνο ανάγνωση με το εύρημα του κριτή · αποθήκευση με CAS και φύλακα δικαιώματος · χάρτης ενοτήτων του προτύπου.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';

import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import { termsWithRetention } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';
import { issueCountsBySection, TEMPLATE_SECTION_MAP } from '../../../editor/editor-sections';
import { TemplateClausesSection } from '../TemplateClausesSection';
import { useTemplateEditor } from '../useTemplateEditor';

jest.setTimeout(60_000);

jest.mock('@/lib/workspace/navigation', () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock('@/providers/DirtyFormProvider', () => ({ useReportUnsavedEdits: jest.fn(), useUnsavedEditsSaver: jest.fn() }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    i18n: { language: 'el' },
  }),
}));
jest.mock('@/components/procurement/subcontracts/subcontract-messages', () => ({
  useSubcontractIssueMessage: () => (issue: { code: string; path: string }) => `${issue.code}@${issue.path}`,
}));

const LIBRARY: ApprovedLibrary = new Map(DEFAULT_CLAUSE_LIBRARY.map((draft, index) => [draft.clauseKey, { clauseId: `sccl_${index}`, version: 1, parameters: draft.parameters }]));
const TITLES = new Map(DEFAULT_CLAUSE_LIBRARY.map((draft) => [draft.clauseKey, draft.title]));
const [seed] = DEFAULT_TRADE_TEMPLATES;

describe('TemplateClausesSection — τιμές του προτύπου', () => {
  it('«όπως στη βιβλιοθήκη» κλείνει ⇒ τιμή = η προτιμώμενη· ανοίγει ⇒ το κλειδί φεύγει', () => {
    const own = DEFAULT_CLAUSE_LIBRARY.find((draft) => draft.parameters.some((parameter) => parameter.source.kind === 'clause'));
    const value = { ...seed, clauses: [{ clauseKey: own?.clauseKey ?? '', parameterOverrides: {} }] };
    const onChange = jest.fn();
    const { rerender } = render(<TemplateClausesSection value={value} onChange={onChange} library={LIBRARY} titles={TITLES} issues={[]} language="el" />);
    const toggles = screen.getAllByRole('switch');
    fireEvent.click(toggles[0]);
    const set = onChange.mock.calls[0][0];
    expect(Object.keys(set.clauses[0].parameterOverrides)).toHaveLength(1);
    rerender(<TemplateClausesSection value={set} onChange={onChange} library={LIBRARY} titles={TITLES} issues={[]} language="el" />);
    fireEvent.click(screen.getAllByRole('switch')[0]);
    expect(onChange.mock.calls[1][0].clauses[0].parameterOverrides).toEqual({});
  });

  it('δεσμευμένη παράμετρος: μόνο ανάγνωση, με το εύρημα του κριτή στο `clauses.N.bound.<key>`', () => {
    const value = { ...seed, clauses: [{ clauseKey: 'retention.performance', parameterOverrides: {} }], defaultTerms: termsWithRetention(400) };
    const retention = DEFAULT_CLAUSE_LIBRARY.find((draft) => draft.clauseKey === 'retention.performance');
    const bound = retention?.parameters.find((parameter) => parameter.source.kind === 'term');
    const path = `clauses.0.bound.${bound?.key}`;
    render(<TemplateClausesSection value={value} onChange={jest.fn()} library={LIBRARY} titles={TITLES} issues={[{ code: 'termOutsideTolerance', path }]} language="el" />);
    expect(screen.getByText(`termOutsideTolerance@${path}`)).toBeInTheDocument();
    expect(screen.getByText('subcontracts.sections.bound.editInTerms')).toBeInTheDocument();
  });
});

describe('useTemplateEditor — αποθήκευση', () => {
  const template = { ...seed, id: 'sctt_1', companyId: 'c', isArchived: false, revision: 7, createdAt: '', updatedAt: '', createdBy: '', updatedBy: '' } as SubcontractTradeTemplate;
  const authority = (canManageTemplates: boolean) => ({ pending: false, canPropose: true, canManageClauses: false, canManageTemplates, canSeed: false, actorUid: 'u' });

  function setup(canManage: boolean) {
    const updateTemplate = jest.fn(async () => ({ ok: true, record: template }));
    const actions = { createTemplate: jest.fn(), updateTemplate };
    const hook = renderHook(() => useTemplateEditor({ target: { kind: 'edit', template }, takenCodes: new Set(), library: LIBRARY, authority: authority(canManage), actions } as never));
    act(() => hook.result.current.update({ ...hook.result.current.draft, title: { el: 'Νέος τίτλος' } }));
    return { hook, updateTemplate };
  }

  it('με δικαίωμα: CAS με την αναθεώρηση που διαβάστηκε, ολικός ορισμός', async () => {
    const { hook, updateTemplate } = setup(true);
    expect(hook.result.current.saveBlock).toBeNull();
    await act(async () => { await hook.result.current.save(); });
    expect(updateTemplate).toHaveBeenCalledWith('sctt_1', expect.objectContaining({ expectedRevision: 7, definition: expect.objectContaining({ code: seed.code, title: { el: 'Νέος τίτλος' } }) }));
  });

  it('χωρίς δικαίωμα: η αποθήκευση λέει γιατί, και δεν στέλνει', async () => {
    const { hook, updateTemplate } = setup(false);
    expect(hook.result.current.saveBlock).toEqual({ kind: 'notAuthorized' });
    await act(async () => { await hook.result.current.save(); });
    expect(updateTemplate).not.toHaveBeenCalled();
  });
});

describe('editor-sections — ο χάρτης του προτύπου', () => {
  it('`defaultTerms…` ⇒ όροι/σχέδιο · `code`/`trade` ⇒ ταυτότητα · κανένα «μέρος»', () => {
    const counts = issueCountsBySection([
      { code: 'amountInvalid', path: 'defaultTerms.cashLimitPerPayment' },
      { code: 'scheduleInvalid', path: 'defaultTerms.paymentPlan.schedule' },
      { code: 'templateCodeTaken', path: 'code' },
      { code: 'tradeUnknown', path: 'trade' },
    ], TEMPLATE_SECTION_MAP);
    expect(counts).toEqual({ identity: 2, parties: 0, lines: 0, terms: 1, plan: 1, clauses: 0 });
  });
});
