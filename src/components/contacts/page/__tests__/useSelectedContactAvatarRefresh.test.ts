/**
 * ============================================================================
 * useSelectedContactAvatarRefresh — Unit tests (ADR-332 D21)
 * ============================================================================
 *
 * Το event `forceAvatarRerender` σπάει την cache της φωτογραφίας στο
 * `ContactDetailsHeader` και στο `useCacheBusting`. Ζούσε μέσα σε έναν
 * συγχρονιστή επιλογής που καταργήθηκε όταν η επιλογή έγινε παράγωγο του URL —
 * αυτά τα tests καρφώνουν ότι επιβίωσε **ακριβώς** ο κανόνας πυροδότησης:
 * ίδια επαφή + αλλαγμένα δεδομένα. Ούτε λιγότερο (χαμένη φωτογραφία), ούτε
 * περισσότερο (θόρυβος σε κάθε κλικ).
 *
 * @see src/components/contacts/page/useSelectedContactAvatarRefresh.ts
 */

import { renderHook } from '@testing-library/react';
import type { Contact } from '@/types/contacts';
import { useSelectedContactAvatarRefresh } from '../useSelectedContactAvatarRefresh';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

function contact(partial: Partial<Contact> & { id: string }): Contact {
  return { type: 'individual', firstName: 'Όνομα', lastName: 'Επώνυμο', ...partial } as Contact;
}

const ALICE = contact({ id: 'c1', firstName: 'Αλίκη' });

/** Πιάνει τα `forceAvatarRerender` που φτάνουν στο window. */
function listenForAvatarEvents(): { events: CustomEvent[]; stop: () => void } {
  const events: CustomEvent[] = [];
  const handler = (event: Event) => events.push(event as CustomEvent);
  window.addEventListener('forceAvatarRerender', handler);
  return { events, stop: () => window.removeEventListener('forceAvatarRerender', handler) };
}

describe('useSelectedContactAvatarRefresh', () => {
  let captured: ReturnType<typeof listenForAvatarEvents>;

  beforeEach(() => { captured = listenForAvatarEvents(); });
  afterEach(() => { captured.stop(); });

  it('δεν στέλνει τίποτα στην πρώτη θέαση μιας επαφής', () => {
    renderHook(({ c }) => useSelectedContactAvatarRefresh(c), {
      initialProps: { c: ALICE as Contact | null },
    });

    expect(captured.events).toHaveLength(0);
  });

  it('δεν στέλνει τίποτα χωρίς επιλογή', () => {
    renderHook(({ c }) => useSelectedContactAvatarRefresh(c), {
      initialProps: { c: null as Contact | null },
    });

    expect(captured.events).toHaveLength(0);
  });

  it('στέλνει event όταν αλλάζουν τα δεδομένα της ΙΔΙΑΣ επαφής', () => {
    const { rerender } = renderHook(({ c }) => useSelectedContactAvatarRefresh(c), {
      initialProps: { c: ALICE as Contact | null },
    });

    rerender({ c: contact({ id: 'c1', firstName: 'Αλίκη', lastName: 'Νέο' }) });

    expect(captured.events).toHaveLength(1);
    expect(captured.events[0].detail).toMatchObject({ contactId: 'c1', photoCount: 0 });
  });

  it('μεταφέρει τον αριθμό φωτογραφιών', () => {
    const withOne = contact({ id: 'c1', multiplePhotoURLs: ['a.jpg'] } as Partial<Contact> & { id: string });
    const withTwo = contact({ id: 'c1', multiplePhotoURLs: ['a.jpg', 'b.jpg'] } as Partial<Contact> & { id: string });

    const { rerender } = renderHook(({ c }) => useSelectedContactAvatarRefresh(c), {
      initialProps: { c: withOne as Contact | null },
    });
    rerender({ c: withTwo as Contact | null });

    expect(captured.events[0].detail).toMatchObject({ contactId: 'c1', photoCount: 2 });
  });

  it('ΔΕΝ στέλνει event σε αλλαγή επιλογής — άλλη επαφή δεν είναι αλλαγή δεδομένων', () => {
    const { rerender } = renderHook(({ c }) => useSelectedContactAvatarRefresh(c), {
      initialProps: { c: ALICE as Contact | null },
    });

    rerender({ c: contact({ id: 'c2', firstName: 'Βασίλης' }) });

    expect(captured.events).toHaveLength(0);
  });

  it('ΔΕΝ στέλνει event όταν τα δεδομένα είναι ίδια σε νέο αντικείμενο (ταυτότητα ≠ αλλαγή)', () => {
    const { rerender } = renderHook(({ c }) => useSelectedContactAvatarRefresh(c), {
      initialProps: { c: ALICE as Contact | null },
    });

    rerender({ c: { ...ALICE } as Contact });

    expect(captured.events).toHaveLength(0);
  });

  it('ξεχνά το προηγούμενο αποτύπωμα μετά από αποεπιλογή', () => {
    const { rerender } = renderHook(({ c }) => useSelectedContactAvatarRefresh(c), {
      initialProps: { c: ALICE as Contact | null },
    });

    rerender({ c: null });
    rerender({ c: contact({ id: 'c1', firstName: 'Αλίκη', lastName: 'Νέο' }) });

    // Πρώτη θέαση ξανά ⇒ δεν υπάρχει «πριν» για σύγκριση.
    expect(captured.events).toHaveLength(0);
  });
});
