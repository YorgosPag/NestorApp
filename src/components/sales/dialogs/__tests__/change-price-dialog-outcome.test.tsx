/**
 * =============================================================================
 * ΑΓΚΥΡΑ ΚΑΛΟΥΝΤΑ — «Αλλαγή Τιμής» μετά τον έλεγχο επιπτώσεων (ADR-777 §8.69.13)
 * =============================================================================
 *
 * 🔴 Το ζωντανό εύρημα (§8.69.11 #3): «Συνέχεια» ⇒ `PATCH 200`, **αλλά** ο διάλογος έμενε ανοιχτός
 * χωρίς μήνυμα. Εδώ ο φύλακας είναι mock που επιστρέφει κάθε έκβαση, και ελέγχεται ο κανόνας του
 * καλούντα: κλείσιμο + επιτυχία **μόνο** σε `completed`, σφάλμα σε `failed`, σιωπή αλλιώς.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { GuardResult } from '@/hooks/impact-guard/guard-result';

const runExistingPropertyUpdate = jest.fn<Promise<GuardResult>, unknown[]>();
const notifySuccess = jest.fn();
const notifyError = jest.fn();

jest.mock('@/hooks/useGuardedPropertyMutation', () => ({
  useGuardedPropertyMutation: () => ({
    checking: false,
    ImpactDialog: null,
    runExistingPropertyUpdate: (...args: unknown[]) => runExistingPropertyUpdate(...args),
  }),
}));
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ success: notifySuccess, error: notifyError }),
}));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/i18n/namespace-bundles', () => ({ COMMON_NAMESPACES: [] }));
jest.mock('@/lib/design-system', () => ({}));
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => ({ sm: 'icon-sm' }) }));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ text: { info: 'info', muted: 'muted' } }),
}));
// Ο διάλογος εδώ είναι μόνο δοχείο: ελέγχεται ο ΚΑΛΩΝ, όχι το Radix ή τα θεματικά χρώματα του.
jest.mock('@/components/ui/dialog', () => {
  const Slot = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) => (open ? <section>{children}</section> : null),
    DialogContent: Slot,
    DialogHeader: Slot,
    DialogTitle: Slot,
    DialogDescription: Slot,
    DialogFooter: Slot,
  };
});
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));
jest.mock('@/components/ui/numeric-field', () => ({
  NumericField: ({ value }: { value: number }) => <input aria-label="price" readOnly value={value} />,
}));
jest.mock('@/services/property/property-mutation-feedback', () => ({
  translatePropertyMutationError: (error: Error) => `translated:${error.message}`,
}));

// eslint-disable-next-line import/first -- τα mocks πρέπει να δηλωθούν πριν τα imports
import { ChangePriceDialog } from '../ChangePriceDialog';

const UNIT = { id: 'prop_1', commercialStatus: 'for-sale', commercial: { askingPrice: 170_000 } };

function renderDialog() {
  const onOpenChange = jest.fn();
  const onSuccess = jest.fn();
  render(<ChangePriceDialog unit={UNIT as never} open onOpenChange={onOpenChange} onSuccess={onSuccess} />);
  fireEvent.click(screen.getByText('common.save'));
  return { onOpenChange, onSuccess };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ChangePriceDialog — ο καλών κρίνει την ΕΚΒΑΣΗ, όχι ένα boolean', () => {
  it('🔴 `completed` (και μετά από «Συνέχεια») ⇒ κλείνει, ενημερώνει, λέει επιτυχία', async () => {
    runExistingPropertyUpdate.mockResolvedValue({ outcome: 'completed' });

    const { onOpenChange, onSuccess } = renderDialog();

    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('viewer.messages.updateSuccess'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
  });

  it.each(['cancelled', 'blocked'] as const)('`%s` ⇒ σιωπή: ο διάλογος μένει, κανένα μήνυμα', async (outcome) => {
    runExistingPropertyUpdate.mockResolvedValue({ outcome });

    const { onOpenChange, onSuccess } = renderDialog();

    await waitFor(() => expect(runExistingPropertyUpdate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('common.save')).toBeEnabled());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('🔴 `failed` ⇒ μεταφρασμένο σφάλμα, καμία επιτυχία (ήταν `console.error` μετά από «Συνέχεια»)', async () => {
    runExistingPropertyUpdate.mockResolvedValue({ outcome: 'failed', error: new Error('boom') });

    const { onOpenChange } = renderDialog();

    await waitFor(() => expect(notifyError).toHaveBeenCalledWith('translated:boom'));
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
