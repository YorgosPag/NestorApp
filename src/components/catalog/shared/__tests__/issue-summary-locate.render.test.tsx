/**
 * **Η σύνοψη ευρημάτων λέει ΠΟΥ με λέξεις** (ADR-923 §5.10.5 — ζωντανό σφάλμα της Φάσης 2ε).
 *
 * Ζωντανά, πάνω από τις καρτέλες του προϊόντος: «Η τιμή επαναλαμβάνεται… `values.cattr_3a6f5744-9fea-…`» — ωμό UUID.
 * Akeneo: η σύνοψη ονομάζει την ιδιότητα και σε πηγαίνει στο πεδίο.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { IssueSummary } from '../CatalogIssues';
import { attributeIdOfIssuePath } from '../../products/editor/editor-layout';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const issue: CatalogIssue = { code: 'consistencyRuleViolated', path: 'values.cattr_3a6f', params: { ruleId: 'rule_1', kind: 'unique' } };

describe('IssueSummary — εντοπισμός', () => {
  it('🔴 με locate ⇒ το ΟΝΟΜΑ της ιδιότητας ως σύνδεσμος στο πεδίο, ΟΧΙ η ωμή διαδρομή', () => {
    const onSelect = jest.fn();
    render(<IssueSummary issues={[issue]} title="t" locate={() => ({ label: 'Κωδικός', onSelect })} />);
    expect(screen.queryByText('values.cattr_3a6f')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Κωδικός' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('χωρίς locate (επεξεργαστές σχήματος) ⇒ η διαδρομή όπως πριν', () => {
    render(<IssueSummary issues={[issue]} title="t" />);
    expect(screen.getByText('values.cattr_3a6f')).toBeTruthy();
  });
});

describe('attributeIdOfIssuePath', () => {
  it('τιμή · λόγος απουσίας · βαθύτερη διαδρομή ⇒ η ιδιότητα · άλλο ⇒ null', () => {
    expect(attributeIdOfIssuePath('values.cattr_1')).toBe('cattr_1');
    expect(attributeIdOfIssuePath('noValueReasons.cattr_2')).toBe('cattr_2');
    expect(attributeIdOfIssuePath('values.cattr_3.*.el')).toBe('cattr_3');
    expect(attributeIdOfIssuePath('categoryIds[0]')).toBeNull();
  });
});
