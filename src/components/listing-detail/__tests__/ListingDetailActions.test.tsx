/**
 * 🔴 **Ο ΚΑΤΟΧΟΣ ΔΕΝ ΒΛΕΠΕΙ ΚΑΡΔΙΑ — ΚΑΙ ΚΑΝΕΙΣ ΑΛΛΟΣ ΔΕΝ ΤΗ ΧΑΝΕΙ** (ADR-777 §8.74.7).
 * @related components/listing-detail/ListingDetailActions.tsx · services/contact/first-contact.client.ts
 *
 * Μετρημένο σε browser (2026-09-24): «Αυτή είναι η αγγελία σας» και από κάτω «Αποθήκευση αγγελίας», που
 * πατιόταν και γύριζε `409 own-listing`. Εδώ φυλάγεται ότι η **μία** ετυμηγορία της ήσυχης ερώτησης
 * μοιράζεται: κάτοχος ⇒ καμία καρδιά · ανοιχτό / άγνωστο / ανώνυμος ⇒ η καρδιά μένει (fail-open).
 * ⚠️ **Μία** ερώτηση στον διακομιστή, όχι δύο.
 *
 * ΜΕΤΑΛΛΑΞΕΙΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΡΙΞΟΥΝ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * 1. Σβήσε το `!ownListing &&` στο `ListingDetailActions` → η Α1 κοκκινίζει.
 * 2. Κάνε το `isOwnTargetAnswer` να πιάνει κάθε `refused` → η Α3 κοκκινίζει.
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockUseAuthOptional = jest.fn();
const mockAsk = jest.fn();

jest.mock('@/auth/contexts/AuthContext', () => ({
  useAuthOptional: () => mockUseAuthOptional(),
}));

jest.mock('@/services/contact/first-contact.client', () => ({
  ...jest.requireActual('@/services/contact/first-contact.client'),
  askContactAdmission: (...args: unknown[]) => mockAsk(...args),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

jest.mock('@/components/listings/SavedListingsProvider', () => ({
  SavedListingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/listings/SaveListingToggle', () => ({
  SaveListingToggle: ({ listingId }: { listingId: string }) => <button type="button">heart:{listingId}</button>,
}));

import { ListingDetailActions } from '../ListingDetailActions';
import { ACT_KEYS, REJECTION_KEYS } from '@/components/contact/first-contact-labels';

const SIGNED_IN = { user: { uid: 'user-nikos' } };
const HEART = 'heart:prop_0001';

/** Η ετυμηγορία **αποδόθηκε** — όχι απλώς «ζητήθηκε» (η πρώτη γραφή της άγκυρας έκρινε πριν φτάσει). */
async function settled(): Promise<void> {
  await waitFor(() => expect(mockAsk).toHaveBeenCalledTimes(1));
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  mockUseAuthOptional.mockReset();
  mockAsk.mockReset();
});

describe('§8.74.7 — μία ετυμηγορία κατόχου για επαφή και αποθήκευση', () => {
  it('Α1 κάτοχος ⇒ «Αυτή είναι η αγγελία σας» και ΚΑΜΙΑ καρδιά', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({ kind: 'refused', reason: 'contact-own-target', manageHref: null });

    render(<ListingDetailActions listingId="prop_0001" />);

    expect(await screen.findByText(ACT_KEYS.ownListingTitle)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(HEART)).not.toBeInTheDocument());
    expect(mockAsk).toHaveBeenCalledTimes(1);
  });

  it('Α2 ξένη αγγελία (ανοιχτή) ⇒ η καρδιά μένει', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({ kind: 'open' });

    render(<ListingDetailActions listingId="prop_0001" />);

    await settled();
    expect(screen.getByText(HEART)).toBeInTheDocument();
  });

  it('Α3 άλλη άρνηση επαφής (όχι κάτοχος) ⇒ η καρδιά μένει', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({ kind: 'refused', reason: 'capacity-full', manageHref: null });

    render(<ListingDetailActions listingId="prop_0001" />);

    expect(await screen.findByText(REJECTION_KEYS['capacity-full'])).toBeInTheDocument();
    // ⚠️ Το πλαίσιο βάφεται στο ΙΔΙΟ commit με την ετυμηγορία· η αναφορά της τρέχει στο effect ΜΕΤΑ. Χωρίς
    //    αυτό το άδειασμα η άγκυρα κρίνει πριν φτάσει η απόφαση (μετρημένο: η μετάλλαξη 2 επιζούσε).
    await settled();
    expect(screen.getByText(HEART)).toBeInTheDocument();
  });

  it('Α4 άγνωστο ⇒ fail-open: η καρδιά μένει', async () => {
    mockUseAuthOptional.mockReturnValue(SIGNED_IN);
    mockAsk.mockResolvedValue({ kind: 'unknown' });

    render(<ListingDetailActions listingId="prop_0001" />);

    await settled();
    expect(screen.getByText(HEART)).toBeInTheDocument();
  });

  it('Α5 ανώνυμος ⇒ καμία ερώτηση, η καρδιά μένει (οδηγεί στη σύνδεση)', async () => {
    mockUseAuthOptional.mockReturnValue(null);

    render(<ListingDetailActions listingId="prop_0001" />);

    expect(screen.getByText(HEART)).toBeInTheDocument();
    await waitFor(() => expect(mockAsk).not.toHaveBeenCalled());
  });
});
