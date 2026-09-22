/**
 * ADR-367 §2.7 — η ένδειξη αποθήκευσης στην κεφαλίδα.
 *
 * Καρφώνει: (α) idle = **κανένα** ορατό chip, (β) το live region υπάρχει ΠΑΝΤΑ (αλλιώς το πρώτο
 * μήνυμα δεν ανακοινώνεται), (γ) κάθε κατάσταση λέει ΤΗ ΔΙΚΗ της πρόταση — ειδικά το
 * «μην κλείσετε την καρτέλα» εκτός σύνδεσης με εκκρεμείς αλλαγές.
 */

import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { SaveStatus } from '@/hooks/useSaveStatus';
import { SaveStatusIndicator } from '../SaveStatusIndicator';

let currentStatus: SaveStatus = 'idle';

jest.mock('@/hooks/useSaveStatus', () => ({
  useSaveStatus: () => currentStatus,
}));

/** Το i18n επιστρέφει το κλειδί: κλειδώνουμε *ποια πρόταση*, όχι *πώς μεταφράστηκε σήμερα*. */
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderIndicator(status: SaveStatus) {
  currentStatus = status;
  return render(
    <TooltipProvider>
      <SaveStatusIndicator />
    </TooltipProvider>,
  );
}

describe('SaveStatusIndicator', () => {
  it('idle → κανένα ορατό chip, αλλά το live region υπάρχει (άδειο)', () => {
    const { container } = renderIndicator('idle');
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it.each<[SaveStatus, string, string]>([
    ['saving', 'saveStatus.saving', 'saveStatus.savingHint'],
    ['saved', 'saveStatus.saved', 'saveStatus.savedHint'],
    ['offline', 'saveStatus.offline', 'saveStatus.offlineHint'],
    ['offline-pending', 'saveStatus.offlinePending', 'saveStatus.offlinePendingHint'],
  ])('%s → ανακοινώνει ετικέτα + εξήγηση', (status, label, hint) => {
    const { container } = renderIndicator(status);
    expect(screen.getByRole('status')).toHaveTextContent(`${label}. ${hint}`);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(label);
  });

  it('κάθε ορατή κατάσταση έχει ΔΙΚΟ της εικονίδιο (όχι μόνο χρώμα — CHECK 3.41)', () => {
    const icons = (['saving', 'saved', 'offline', 'offline-pending'] as const).map((status) => {
      const { container, unmount } = renderIndicator(status);
      const svgClass = container.querySelector('svg')?.getAttribute('class') ?? '';
      unmount();
      return svgClass.split(' ').find((c) => c.startsWith('lucide-') && c !== 'lucide-icon');
    });
    expect(new Set(icons).size).toBe(4);
  });
});
