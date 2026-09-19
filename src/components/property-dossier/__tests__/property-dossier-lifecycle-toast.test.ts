/**
 * Α38.5 — ADR-866 §2.10 Π3 · Β2: ΕΝΑ toast ανά φάκελο, και το «Αναίρεση» δεν έχει δική του διάρκεια.
 *
 * 🔴 Ζωντανή επαλήθευση 2026-09-19: μετά την επαναφορά, το παλιό «…αρχειοθετήθηκε · Αναίρεση» έμενε στη στοίβα δίπλα
 * στο «…επανήλθε» — μια ενέργεια που έπαψε να ισχύει. Gmail: νέο toast για το ίδιο αντικείμενο **αντικαθιστά** το παλιό.
 */

const success = jest.fn();
const error = jest.fn();

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ success, error }) }));
jest.mock('@/services/property-dossier/property-dossier.service', () => ({
  setPropertyDossierLifecycle: jest.fn(async () => ({ kind: 'saved' })),
}));

import { act, renderHook } from '@testing-library/react';
import { LIFECYCLE_TOAST_PREFIX, usePropertyDossierLifecycle } from '../usePropertyDossierLifecycle';

const DOSSIER = { id: 'pdos_1', label: 'Σπίτι' };

describe('Α38.5 — ένα toast κύκλου ζωής ανά φάκελο', () => {
  it('αρχειοθέτηση και επαναφορά μοιράζονται ΤΗΝ ΙΔΙΑ ταυτότητα · το «Αναίρεση» δεν ορίζει διάρκεια', async () => {
    const { result } = renderHook(() => usePropertyDossierLifecycle());
    await act(async () => { await result.current.archive(DOSSIER); });
    await act(async () => { await result.current.restore(DOSSIER); });

    const [archived, restored] = success.mock.calls.map(([, options]) => options as { id?: string; duration?: number; actions?: unknown[] });
    expect(archived.id).toBe(`${LIFECYCLE_TOAST_PREFIX}${DOSSIER.id}`);
    expect(restored.id).toBe(archived.id);
    expect(archived.actions).toHaveLength(1);
    expect(archived.duration).toBeUndefined();
  });
});
