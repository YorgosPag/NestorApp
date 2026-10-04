/**
 * ΑΓΚΥΡΑ — **η εκκρεμής θέση ΛΕΓΕΤΑΙ στην κάρτα της διεύθυνσης του κτιρίου** (ADR-332 D29).
 *
 * Το hook (`useAddressPositionSettlement`) και η μνήμη (`address-positions-pending`) έχουν δικές τους
 * άγκυρες· εδώ κρίνεται το τελευταίο μέτρο — ότι η κατάσταση **φτάνει στην οθόνη**, στη σωστή
 * διεύθυνση, και ότι υποχωρεί μπροστά στην απόκλιση πινέζας.
 */

/* global describe, it, expect, jest */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ProjectAddress } from '@/types/project/addresses';
import type { AddressPositionsPending } from '@/services/addresses/address-positions-pending';
import type { AddressPositionDrift } from '@/lib/geocoding/address-position';
import { BuildingAddressesManualList } from '../BuildingAddressesManualList';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Η κάρτα διεύθυνσης δεν συμμετέχει στην ερώτηση — μόνο το ποια διεύθυνση είναι. */
jest.mock('@/components/shared/addresses', () => ({
  AddressCard: ({ address }: { address: { id: string } }) => <span data-testid={`card-${address.id}`} />,
}));

const SETTLED = { id: 'addr_settled', type: 'site', isPrimary: true, street: 'Τσιμισκή', number: '43', city: 'Θεσσαλονίκη' };
const PENDING = { id: 'addr_pending', type: 'entrance', isPrimary: false, street: 'Εγνατία', number: '1', city: 'Θεσσαλονίκη' };

const LOCATING = 'editor.positionPending.locating';
const DEFERRED = 'editor.positionPending.message';

interface Options {
  pendingPositions?: AddressPositionsPending;
  positionAdvisories?: readonly AddressPositionDrift[];
}

function renderList({ pendingPositions, positionAdvisories }: Options = {}) {
  render(
    <TooltipProvider>
      <BuildingAddressesManualList
        localAddresses={[SETTLED, PENDING] as unknown as ProjectAddress[]}
        onSetPrimary={async () => undefined}
        onEdit={() => undefined}
        onDelete={async () => undefined}
        onRelocate={() => undefined}
        onKeepPin={() => undefined}
        positionAdvisories={positionAdvisories}
        pendingPositions={pendingPositions}
      />
    </TooltipProvider>,
  );
}

/** Η κάρτα (`<article>`) της διεύθυνσης — για να κριθεί ΣΕ ΠΟΙΑ διεύθυνση μπήκε η ένδειξη. */
const cardOf = (addressId: string) => screen.getByTestId(`card-${addressId}`).closest('article');

describe('BuildingAddressesManualList — ένδειξη εκκρεμούς θέσης', () => {
  it('Ε1 — εντοπίζεται ⇒ η ένδειξη μπαίνει ΜΟΝΟ στην κάρτα της εκκρεμούς διεύθυνσης', () => {
    renderList({ pendingPositions: { ids: [PENDING.id], phase: 'locating' } });

    const notice = screen.getByText(LOCATING);
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveAttribute('aria-busy', 'true');
    expect(cardOf(PENDING.id)).toContainElement(notice);
    expect(cardOf(SETTLED.id)).not.toContainElement(notice);
  });

  it('Ε2 — ο εντοπισμός δεν ολοκληρώθηκε εγκαίρως ⇒ «θα υπολογιστεί στην επόμενη αποθήκευση»', () => {
    renderList({ pendingPositions: { ids: [PENDING.id], phase: 'deferred' } });

    expect(screen.queryByText(LOCATING)).toBeNull();
    expect(screen.getByText(DEFERRED)).toHaveAttribute('aria-busy', 'false');
  });

  it('Ε3 — χωρίς εκκρεμότητα (ή χωρίς το όρισμα) ⇒ καμία ένδειξη', () => {
    renderList();

    expect(screen.queryByText(LOCATING)).toBeNull();
    expect(screen.queryByText(DEFERRED)).toBeNull();
  });

  it('Ε4 — απόκλιση πινέζας στην ΙΔΙΑ διεύθυνση ⇒ μιλά η απόκλιση, όχι το «εκκρεμεί»', () => {
    renderList({
      pendingPositions: { ids: [PENDING.id], phase: 'locating' },
      positionAdvisories: [{ addressId: PENDING.id, distanceMetres: 420 } as AddressPositionDrift],
    });

    expect(screen.queryByText(LOCATING)).toBeNull();
  });
});
