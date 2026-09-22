/**
 * 🗑️ EntityTrashActionsBar — ο ΕΝΑΣ κανόνας στόχου + η ΜΙΑ ροή επαναφοράς (ADR-867 2026-09-22 · N.0.2).
 *
 * Πριν ζούσαν δίδυμα στις επαφές και στα ακίνητα. Εδώ κλειδώνεται ό,τι κοινό κρατούσαν:
 *   Σ — σε ποια ids δρα η μπάρα (επιλεγμένα > ενεργό > κανένα)
 *   Ε — επαναφορά: μήνυμα από το locale (πληθυντικός ICU) · ανανέωση ΚΑΙ σε αποτυχία (409 «ήδη επανήλθε»)
 *   Κ — κείμενα: μόνο «πίσω» + «προειδοποίηση» ανά οντότητα· τα γενικά ίδια παντού
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityTrashActionsBar, effectiveTrashIds, type EntityTrashText } from '../EntityTrashActionsBar';

const mockNotify = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ notify: mockNotify }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useIconSizes', () => ({
  useIconSizes: () => ({ xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5' }),
}));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { muted: '' }, bg: {}, border: {} }),
}));

const TEXT: EntityTrashText = {
  back: 'Πίσω στις Επαφές',
  warning: 'Οι επαφές διαγράφονται μετά από 30 ημέρες',
  restoreSuccess: (count) => `restored:${count}`,
  restoreFailed: 'restore-failed',
};

function renderBar(overrides: Partial<Parameters<typeof EntityTrashActionsBar>[0]> = {}) {
  const props = {
    selectedIds: [] as string[],
    activeId: null,
    onBack: jest.fn(),
    onRefresh: jest.fn(),
    onPermanentDelete: jest.fn(),
    trashCount: 3,
    entity: 'contacts',
    restore: jest.fn().mockResolvedValue(undefined),
    text: TEXT,
    ...overrides,
  };
  render(<EntityTrashActionsBar {...props} />);
  return props;
}

const restoreButton = () => screen.getByRole('button', { name: /restoreSelected/ });

beforeEach(() => mockNotify.mockReset());

describe('Σ — σε ποια ids δρα η μπάρα', () => {
  it('Σ1 — τα επιλεγμένα κερδίζουν το ενεργό· χωρίς επιλογή, το ενεργό· χωρίς τίποτα, κανένα', () => {
    expect(effectiveTrashIds(['a', 'b'], 'x')).toEqual(['a', 'b']);
    expect(effectiveTrashIds([], 'x')).toEqual(['x']);
    expect(effectiveTrashIds([], null)).toEqual([]);
  });

  it('Σ2 — χωρίς στόχο τα κουμπιά είναι ανενεργά', () => {
    renderBar();
    expect(restoreButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: /permanentDelete/ })).toBeDisabled();
  });
});

describe('Ε — η ροή επαναφοράς', () => {
  it('Ε1 — επιτυχία: υπηρεσία με το ενεργό id, μήνυμα από το locale με το πλήθος, ανανέωση', async () => {
    const props = renderBar({ activeId: 'c1' });
    fireEvent.click(restoreButton());
    await waitFor(() => expect(props.onRefresh).toHaveBeenCalledTimes(1));
    expect(props.restore).toHaveBeenCalledWith(['c1']);
    expect(mockNotify).toHaveBeenCalledWith('restored:1', { type: 'success' });
  });

  it('Ε2 — αποτυχία: μήνυμα αποτυχίας ΚΑΙ ανανέωση (ένα 409 σημαίνει «ήδη επανήλθε αλλού»)', async () => {
    // ⛔ MUTATION: βάλε το `onSettled()` μόνο στο try ⇒ η λίστα μένει μπαγιάτικη ⇒ κόκκινο.
    const props = renderBar({ selectedIds: ['a', 'b'], restore: jest.fn().mockRejectedValue(new Error('409')) });
    fireEvent.click(restoreButton());
    await waitFor(() => expect(props.onRefresh).toHaveBeenCalledTimes(1));
    expect(mockNotify).toHaveBeenCalledWith('restore-failed', { type: 'error' });
  });

  it('Ε3 — η οριστική διαγραφή περνά τα ΙΔΙΑ ids που βλέπει ο χρήστης', () => {
    const props = renderBar({ activeId: 'c9' });
    fireEvent.click(screen.getByRole('button', { name: /permanentDelete/ }));
    expect(props.onPermanentDelete).toHaveBeenCalledWith(['c9']);
  });
});

describe('Κ — κείμενα', () => {
  it('Κ1 — η οντότητα υπερβαίνει ΜΟΝΟ «πίσω» και «προειδοποίηση»· τα γενικά έρχονται από το namespace `trash`', () => {
    renderBar();
    expect(screen.getByRole('button', { name: /Πίσω στις Επαφές/ })).toBeInTheDocument();
    expect(screen.getByText(TEXT.warning)).toBeInTheDocument();
    expect(screen.getByText('trashCount')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'trashView' })).toBeInTheDocument();
  });
});
