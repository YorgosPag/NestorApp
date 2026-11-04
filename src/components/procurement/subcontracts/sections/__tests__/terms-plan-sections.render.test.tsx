/**
 * Όροι και σχέδιο πληρωμών (ADR-928 Φ3γ-2 αποφάσεις 1 και 2): γενικές ενότητες, και η ζώνη της ρήτρας **στο πεδίο του
 * όρου**. Και το λανθάνον σφάλμα: το εύρημα της δεσμευμένης παραμέτρου φαίνεται πλέον στη ρήτρα.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import { boundTermsAt, boundTermsOf, NO_BOUND_TERMS } from '@/subapps/procurement/subcontracts/agreements/bound-terms';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { validateTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/templates/validate-trade-template';
import { boundRetention, LIBRARY, retentionInput, termsWithRetention } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import { ClauseCard } from '../../editor/ClauseCard';
import { PaymentPlanSection } from '../plan/PaymentPlanSection';
import type { BoundTermsView } from '../section-types';
import { TermsSection } from '../terms/TermsSection';

jest.setTimeout(60_000);

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key),
    i18n: { language: 'el' },
  }),
}));
jest.mock('@/components/procurement/subcontracts/subcontract-messages', () => ({
  useSubcontractIssueMessage: () => (issue: SubcontractIssue) => `${issue.code}@${issue.path}`,
}));

const NONE: BoundTermsView = { at: NO_BOUND_TERMS, setReason: null, titleOf: (key) => key };
const common = { language: 'el' as const, secondaryLanguage: null };

describe('TermsSection — γενική: ίδια ενότητα για το πρότυπο (`defaultTerms`)', () => {
  it('τα ευρήματα του `validateTradeTemplateDefinition` δένονται στο πεδίο τους', () => {
    const template = DEFAULT_TRADE_TEMPLATES[0];
    const broken = { ...template, defaultTerms: { ...template.defaultTerms, cashLimitPerPayment: -1 } };
    const issues = validateTradeTemplateDefinition(broken);
    expect(issues).toContainEqual({ code: 'amountInvalid', path: 'defaultTerms.cashLimitPerPayment' });
    render(<TermsSection {...common} value={broken.defaultTerms} onChange={jest.fn()} path="defaultTerms" issues={issues} bound={NONE} lines={broken.lines} />);
    expect(screen.getByText('amountInvalid@defaultTerms.cashLimitPerPayment')).toBeInTheDocument();
  });
});

describe('PaymentPlanSection — η ζώνη της ρήτρας κράτησης στο πεδίο της κράτησης', () => {
  const terms = termsWithRetention(400);
  const clauses = [retentionInput];
  const bound = boundTermsOf(clauses, LIBRARY, terms);

  function renderPlan(issues: readonly SubcontractIssue[], setReason = jest.fn()) {
    const view: BoundTermsView = { at: boundTermsAt(bound, 'paymentPlan'), setReason, titleOf: () => 'Κράτηση καλής εκτέλεσης' };
    render(<PaymentPlanSection {...common} value={terms.paymentPlan} onChange={jest.fn()} path="terms.paymentPlan" issues={issues} bound={view} />);
    return setReason;
  }

  it('4% ⇒ «θέλει έγκριση» δίπλα στο ποσοστό, με τον τίτλο της ρήτρας (όχι τον κωδικό)', () => {
    renderPlan([]);
    expect(screen.getByText('subcontracts.editor.zone.needsApproval')).toBeInTheDocument();
    expect(screen.getByText(/bound\.governedBy.*Κράτηση καλής εκτέλεσης/)).toBeInTheDocument();
    expect(screen.queryByText(/retention\.performance/)).toBeNull();
  });

  it('ο λόγος γράφεται ΕΔΩ και φτάνει στην παράμετρο της ρήτρας', () => {
    const setReason = renderPlan([]);
    fireEvent.change(screen.getByRole('textbox', { name: 'subcontracts.editor.clauses.reason' }), { target: { value: 'μικρό έργο' } });
    expect(setReason).toHaveBeenCalledWith(expect.objectContaining({ clauseIndex: 0, clausePath: 'clauses.0.parameterValues.rate' }), 'μικρό έργο');
  });

  it('το εύρημα του κριτή στο `clausePath` φαίνεται στο πεδίο του όρου', () => {
    renderPlan([{ code: 'deviationReasonRequired', path: 'clauses.0.parameterValues.rate' }]);
    expect(screen.getByText('deviationReasonRequired@clauses.0.parameterValues.rate')).toBeInTheDocument();
  });
});

describe('ClauseCard — 🔴 το εύρημα της δεσμευμένης παραμέτρου ΔΕΝ είναι πια αόρατο', () => {
  it('φαίνεται στην κάρτα της ρήτρας, μαζί με σύνδεσμο προς το πεδίο', () => {
    const edits = { setValue: jest.fn(), setReason: jest.fn(), reset: jest.fn(), remove: jest.fn(), upgrade: null };
    render(
      <ClauseCard index={0} input={retentionInput} title={{ el: 'Κράτηση' }} inForce={{ clauseId: 'sccl_retention', version: 1, parameters: [boundRetention] }}
        terms={termsWithRetention(400)} savedDeviations={{}} issues={[{ code: 'deviationReasonRequired', path: 'clauses.0.parameterValues.rate' }]} language="el" edits={edits} />,
    );
    expect(screen.getByText('deviationReasonRequired@clauses.0.parameterValues.rate')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'subcontracts.sections.bound.editInTerms' })).toHaveAttribute('href', '#editor-plan');
  });
});
