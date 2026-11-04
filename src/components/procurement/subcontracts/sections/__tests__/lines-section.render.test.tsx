/**
 * Η ενότητα «Γραμμές» είναι **γενική** (ADR-928 Φ3γ-2 απόφαση 1): δένει τα ευρήματα του κριτή με το `path` που της
 * δίνεται, και επιστρέφει πάντα νέο αντικείμενο.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';
import { validateTradeTemplateDefinition } from '@/subapps/procurement/subcontracts/templates/validate-trade-template';
import type { AgreementLine } from '@/subapps/procurement/subcontracts/types/agreement-line';
import { SAMPLE_LINE } from '@/subapps/procurement/subcontracts/agreements/__tests__/agreement-fixtures';
import { LinesSection } from '../lines/LinesSection';

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

const lines: readonly AgreementLine[] = [SAMPLE_LINE, { ...SAMPLE_LINE, id: 'second', description: { el: 'Δεύτερη' } }];
const card = (position: number) => screen.getByRole('article', { name: `subcontracts.sections.lines.position:${JSON.stringify({ position })}` });

function renderLines(props: Partial<React.ComponentProps<typeof LinesSection>> = {}) {
  const onChange = jest.fn();
  render(
    <LinesSection value={lines} onChange={onChange} path="lines" issues={[]} language="el" secondaryLanguage={null}
      referencedLineIds={new Set()} {...props} />,
  );
  return onChange;
}

describe('LinesSection — ευρήματα με το `path` του κριτή', () => {
  it('εύρημα στο `lines.1.unitPrice` φαίνεται στη γραμμή 2 και όχι στη 1', () => {
    renderLines({ issues: [{ code: 'amountInvalid', path: 'lines.1.unitPrice' }] });
    expect(within(card(2)).getByText('amountInvalid@lines.1.unitPrice')).toBeInTheDocument();
    expect(within(card(1)).queryByText(/amountInvalid/)).toBeNull();
  });

  it('το πρόθεμα είναι αυτό που δόθηκε: με `path="draft.lines"` το `lines.0…` ΔΕΝ ανήκει στην ενότητα', () => {
    renderLines({ path: 'draft.lines', issues: [
      { code: 'lineDescriptionRequired', path: 'draft.lines.0.description' },
      { code: 'amountInvalid', path: 'lines.0.unitPrice' },
    ] });
    expect(within(card(1)).getByText('lineDescriptionRequired@draft.lines.0.description')).toBeInTheDocument();
    expect(screen.queryByText(/amountInvalid/)).toBeNull();
  });

  it('γενική και για το πρότυπο: τα ευρήματα του `validateTradeTemplateDefinition` δένονται στη σωστή γραμμή', () => {
    const template = DEFAULT_TRADE_TEMPLATES[0];
    const broken = { ...template, lines: template.lines.map((line, index) => (index === 1 ? { ...line, description: { el: '' } } : line)) };
    const issues = validateTradeTemplateDefinition(broken);
    expect(issues).toContainEqual({ code: 'lineDescriptionRequired', path: 'lines.1.description' });
    renderLines({ value: broken.lines, issues });
    expect(within(card(2)).getByText('lineDescriptionRequired@lines.1.description')).toBeInTheDocument();
  });
});

describe('LinesSection — κάθε αλλαγή δίνει νέο αντικείμενο', () => {
  it('αλλαγή περιγραφής: μόνο η γραμμή 1 αλλάζει, το αρχικό μένει ανέγγιχτο', () => {
    const onChange = renderLines();
    fireEvent.change(within(card(1)).getAllByRole('textbox')[0], { target: { value: 'Νέα περιγραφή' } });
    const [next] = onChange.mock.calls[0] as [readonly AgreementLine[]];
    expect(next[0].description.el).toBe('Νέα περιγραφή');
    expect(next[1]).toBe(lines[1]);
    expect(lines[0].description.el).toBe('Επίχρισμα τριπτό');
  });

  it('νέα γραμμή: id από το enterprise-id (πρόθεμα `scal`), μονάδα της τελευταίας γραμμής', () => {
    const onChange = renderLines();
    fireEvent.click(screen.getByRole('button', { name: 'subcontracts.sections.lines.add' }));
    const [next] = onChange.mock.calls[0] as [readonly AgreementLine[]];
    expect(next).toHaveLength(3);
    expect(next[2].id).toMatch(/^scal_/);
    expect(next[2].unit).toBe('m2');
  });

  it('διπλασιασμός: αμέσως μετά, με νέο id', () => {
    const onChange = renderLines();
    fireEvent.click(within(card(1)).getByRole('button', { name: `subcontracts.sections.lines.duplicate:${JSON.stringify({ position: 1 })}` }));
    const [next] = onChange.mock.calls[0] as [readonly AgreementLine[]];
    expect(next.map((line) => line.id)).toEqual(['plaster', expect.stringMatching(/^scal_/), 'second']);
  });
});
