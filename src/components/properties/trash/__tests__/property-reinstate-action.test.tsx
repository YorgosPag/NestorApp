/**
 * @fileoverview **ΑΓΚΥΡΕΣ: Η «ΕΠΑΝΑΦΟΡΑ» ΠΑΝΩ ΣΤΗΝ ΕΓΓΡΑΦΗ** (ADR-329 §3.9 · ADR-281).
 * @related components/properties/trash/PropertyReinstateAction · property-reinstate
 *
 * Ό,τι μπορεί να πάει σιωπηλά λάθος εδώ είναι το **δέσιμο**, όχι η ροή: κουμπί αρχείου που καλεί τον
 * δρόμο του κάδου μεταγλωττίζεται, αποδίδεται, και απλώς αποτυγχάνει στον διακομιστή (ή, χειρότερα,
 * πετυχαίνει με άλλη σημασία). Άρα κάθε απόσυρση ελέγχεται **με το όνομα** του δρόμου της.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { TrashService } from '@/services/trash.service';

import { PropertyReinstateAction } from '../PropertyReinstateAction';

jest.mock('@/services/trash.service', () => ({
  TrashService: { bulkRestore: jest.fn(), bulkUnarchive: jest.fn() },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

const mockNotify = jest.fn();
const mockNotifications = { notify: mockNotify };
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => mockNotifications,
}));

const mockT = (key: string): string => key;
const mockTranslation = { t: mockT };
jest.mock('@/i18n', () => ({ useTranslation: () => mockTranslation }));

const mockIconSizes = { xs: 'h-3 w-3' };
jest.mock('@/hooks/useIconSizes', () => ({ useIconSizes: () => mockIconSizes }));

const bulkRestore = TrashService.bulkRestore as jest.Mock;
const bulkUnarchive = TrashService.bulkUnarchive as jest.Mock;

beforeEach(() => {
  bulkRestore.mockReset();
  bulkUnarchive.mockReset();
  mockNotify.mockReset();
});

describe('ADR-329 §3.9 — PropertyReinstateAction', () => {
  it('Ε1: ζωντανό ακίνητο ⇒ κανένα κουμπί', () => {
    const { container } = render(<PropertyReinstateAction property={{ id: 'prop_1', status: 'for-sale' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Ε2 🔴 αρχείο ⇒ ο δρόμος του ΑΡΧΕΙΟΥ, για αυτό το ένα ακίνητο', async () => {
    bulkUnarchive.mockResolvedValue(['taken-off-market']);
    render(<PropertyReinstateAction property={{ id: 'prop_1', status: 'archived' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'unarchive' }));

    await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
    expect(bulkUnarchive).toHaveBeenCalledWith('property', ['prop_1']);
    expect(bulkRestore).not.toHaveBeenCalled();
    // Ο διακομιστής είπε «εκτός αγοράς» ⇒ η ειδοποίηση το λέει (ίδιο μήνυμα με τη μπάρα της λίστας).
    expect(mockNotify).toHaveBeenCalledWith('unarchiveSuccessOffMarket', { type: 'success' });
  });

  it('Ε3 🔴 κάδος ⇒ ο δρόμος του ΚΑΔΟΥ, για αυτό το ένα ακίνητο', async () => {
    bulkRestore.mockResolvedValue(undefined);
    render(<PropertyReinstateAction property={{ id: 'prop_1', status: 'deleted' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'retiredBanner.restoreFromTrash' }));

    await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
    expect(bulkRestore).toHaveBeenCalledWith('property', ['prop_1']);
    expect(bulkUnarchive).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith('trash.restoreSuccess', { type: 'success' });
  });

  it('Ε4 🔴 διπλό πάτημα ⇒ ΜΙΑ επαναφορά', async () => {
    let finish: (value: string[]) => void = () => undefined;
    bulkUnarchive.mockReturnValue(new Promise<string[]>((resolve) => { finish = resolve; }));
    render(<PropertyReinstateAction property={{ id: 'prop_1', status: 'archived' }} />);

    const button = screen.getByRole('button', { name: 'unarchive' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(bulkUnarchive).toHaveBeenCalledTimes(1);

    finish([]);
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('Ε5: αποτυχία ⇒ το λέει, και το κουμπί ξαναγίνεται διαθέσιμο', async () => {
    bulkUnarchive.mockRejectedValue(new Error('boom'));
    render(<PropertyReinstateAction property={{ id: 'prop_1', status: 'archived' }} />);

    const button = screen.getByRole('button', { name: 'unarchive' });
    fireEvent.click(button);

    await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('unarchiveFailed', { type: 'error' }));
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});
