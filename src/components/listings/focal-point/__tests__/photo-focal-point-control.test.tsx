/**
 * @fileoverview 🎯 **Ο ΔΙΑΛΟΓΟΣ ΣΗΜΕΙΟΥ ΕΣΤΙΑΣΗΣ — τι επιστρέφει κάθε κουμπί** (ADR-880).
 *
 * Το κρίσιμο συμβόλαιο δεν είναι οπτικό: είναι *«πότε γίνεται το σημείο ΔΗΛΩΣΗ του ανθρώπου;»*. Μια
 * «Εφαρμογή» χωρίς άγγιγμα που θα πάγωνε το αυτόματο ως ανθρώπινο θα έκοβε κάθε μελλοντική βελτίωση του
 * κινητήρα από αυτή τη φωτογραφία — σιωπηλά.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PhotoFocalPointControl } from '../PhotoFocalPointControl';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

const mockSuggestion = jest.fn();
jest.mock('@/services/filesystem/focal-point-suggestion.client', () => ({
  fetchFocalPointSuggestion: (...args: unknown[]) => mockSuggestion(...args),
}));

const K = 'property-market:photoFocalPoint';

function renderControl(over: Partial<React.ComponentProps<typeof PhotoFocalPointControl>> = {}) {
  const onApply = jest.fn();
  render(
    <PhotoFocalPointControl
      name="Σαλόνι"
      src="https://example.test/salon.jpg"
      declared={null}
      onApply={onApply}
      suggestionTarget={null}
      {...over}
    />,
  );
  return onApply;
}

async function openDialog(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole('button', { name: `${K}.triggerAria` }));
  return screen.findByRole('button', { name: `${K}.surfaceAria` });
}

beforeEach(() => mockSuggestion.mockReset());

describe('PhotoFocalPointControl', () => {
  it('πληκτρολόγιο: Shift+→ μετακινεί 10%, και η «Εφαρμογή» επιστρέφει το σημείο του ανθρώπου', async () => {
    const onApply = renderControl();
    const surface = await openDialog();

    fireEvent.keyDown(surface, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(surface, { key: 'ArrowUp' });
    await userEvent.click(screen.getByRole('button', { name: `${K}.apply` }));

    expect(onApply).toHaveBeenCalledWith({ x: 0.6, y: 0.49 });
  });

  it('🔴 «Εφαρμογή» ΧΩΡΙΣ άγγιγμα ⇒ `null` (το αυτόματο ΔΕΝ παγώνει ως ανθρώπινο)', async () => {
    const onApply = renderControl();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: `${K}.apply` }));
    expect(onApply).toHaveBeenCalledWith(null);
  });

  it('με υπάρχουσα δήλωση, «Εφαρμογή» χωρίς άγγιγμα την ΚΡΑΤΑ', async () => {
    const onApply = renderControl({ declared: { x: 0.2, y: 0.3 } });
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: `${K}.apply` }));
    expect(onApply).toHaveBeenCalledWith({ x: 0.2, y: 0.3 });
  });

  it('«Αυτόματο» ⇒ `null` ακόμη και με δήλωση· «Ακύρωση» ⇒ τίποτα', async () => {
    const onApply = renderControl({ declared: { x: 0.2, y: 0.3 } });
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: `${K}.useAuto` }));
    expect(onApply).toHaveBeenCalledWith(null);

    onApply.mockClear();
    await openDialog();
    await userEvent.click(screen.getByRole('button', { name: 'common:buttons.cancel' }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('η πρόταση του διακομιστή ζητείται ΜΟΝΟ όταν ανοίξει ο διάλογος, με το σωστό διαμέρισμα', async () => {
    mockSuggestion.mockResolvedValue({ kind: 'ready', point: { x: 0.7, y: 0.2 } });
    renderControl({ suggestionTarget: { fileId: 'file_a', custody: 'personal' } });
    expect(mockSuggestion).not.toHaveBeenCalled();

    await openDialog();
    await waitFor(() => expect(mockSuggestion).toHaveBeenCalledWith('file_a', 'personal'));
    expect(await screen.findByText(`${K}.suggestionReady`)).toBeTruthy();
  });

  it('η πρόταση απομνημονεύεται ανά αρχείο: δεύτερο άνοιγμα ⇒ καμία δεύτερη κλήση', async () => {
    mockSuggestion.mockResolvedValue({ kind: 'ready', point: { x: 0.4, y: 0.6 } });
    renderControl({ suggestionTarget: { fileId: 'file_memo', custody: 'company' } });

    await openDialog();
    expect(await screen.findByText(`${K}.suggestionReady`)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'common:buttons.cancel' }));
    await openDialog();

    expect(mockSuggestion).toHaveBeenCalledTimes(1);
  });

  it('οκνηρό URL: επιλύεται ΜΟΝΟ στο άνοιγμα', async () => {
    const resolveSrc = jest.fn().mockResolvedValue('https://example.test/lazy.jpg');
    renderControl({ src: undefined, resolveSrc });
    expect(resolveSrc).not.toHaveBeenCalled();

    await openDialog();
    expect(resolveSrc).toHaveBeenCalledTimes(1);
  });

  it('🔴 αποτυχημένη επίλυση URL ⇒ μήνυμα αποτυχίας, ΟΧΙ ατέρμονο «φορτώνει»', async () => {
    const resolveSrc = jest.fn().mockRejectedValue(new Error('storage/unauthorized'));
    renderControl({ src: undefined, resolveSrc });

    await userEvent.click(screen.getByRole('button', { name: `${K}.triggerAria` }));

    expect(await screen.findByText(`${K}.imageLoadFailed`)).toBeTruthy();
    expect(screen.queryByText(`${K}.imageLoading`)).toBeNull();
  });

  it('η κατάσταση του κουμπιού λέει αν η εστίαση είναι αυτόματη ή δική σας', () => {
    renderControl({ declared: { x: 0.2, y: 0.3 } });
    expect(screen.getByText(`${K}.stateManual`)).toBeTruthy();
  });
});
