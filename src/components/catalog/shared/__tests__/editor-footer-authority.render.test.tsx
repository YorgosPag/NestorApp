/**
 * **Το υποσέλιδο λέει την αλήθεια για τη δικαιοδοσία** (ADR-923 §5.10.5 — ζωντανό σφάλμα της Φάσης 2ε).
 *
 * Ζωντανά: ο επεξεργαστής **προϊόντος** έδειχνε «Μόνο ανάγνωση — η αλλαγή του **σχήματος** απαιτεί…» (α) όσο φόρτωνε η
 * ταυτότητα, σε άνθρωπο που **έχει** το δικαίωμα, και (β) με αιτιολογία άλλης δικαιοδοσίας. Το boolean `canManage`
 * είχε ήδη χάσει και το `pending` και το «ποια δικαιοδοσία».
 */

import { render, screen } from '@testing-library/react';

import type { CapabilityGate } from '@/auth/hooks/useCapability';
import { EditorFooter } from '../EditorFooter';

let gate: Partial<CapabilityGate> = { pending: true, verdict: 'denied-unauthenticated' };
const asked: string[] = [];

jest.mock('@/auth/hooks/useCapability', () => ({
  useCapability: (action: string) => { asked.push(action); return { action, reason: null, ...gate }; },
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

const editor = { status: 'clean' as const, discard: jest.fn() };

function renderFooter(authority: 'schema' | 'products') {
  return render(<EditorFooter editor={editor} issues={[]} authority={authority} onSave={jest.fn()} />);
}

beforeEach(() => { asked.length = 0; });

describe('EditorFooter — δικαιοδοσία', () => {
  it('όσο εκκρεμεί η ταυτότητα ΔΕΝ δηλώνει «μόνο ανάγνωση» ούτε δείχνει Αποθήκευση', () => {
    gate = { pending: true, verdict: 'denied-unauthenticated' };
    renderFooter('products');
    expect(screen.queryByText(/common\.readOnly/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'common.save' })).toBeNull();
  });

  it('άρνηση στα προϊόντα ⇒ η αιτιολογία των ΠΡΟΪΟΝΤΩΝ, όχι του σχήματος', () => {
    gate = { pending: false, verdict: 'denied-insufficient' };
    renderFooter('products');
    expect(asked).toContain('catalog:products:manage');
    expect(screen.getByText('common.readOnlyProducts')).toBeTruthy();
  });

  it('άρνηση στο σχήμα ⇒ η αιτιολογία του σχήματος', () => {
    gate = { pending: false, verdict: 'denied-insufficient' };
    renderFooter('schema');
    expect(asked).toContain('catalog:schema:manage');
    expect(screen.getByText('common.readOnly')).toBeTruthy();
  });

  it('χορήγηση ⇒ Αποθήκευση', () => {
    gate = { pending: false, verdict: 'granted-by-role' };
    renderFooter('products');
    expect(screen.getByRole('button', { name: 'common.save' })).toBeTruthy();
  });
});
