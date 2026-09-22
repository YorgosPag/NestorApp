/**
 * @fileoverview 🔴 **Η ΣΕΛΙΔΑ ΤΟΥ ΑΚΙΝΗΤΟΥ ΚΛΕΙΝΕΙ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ ΠΟΥ ΑΝΟΙΞΕ.**
 * @related ADR-777 §8.60.21.7 · components/owner-property/OwnerPropertyDetailContent.tsx ·
 *   components/owner-property/__tests__/form-destination-by-workspace.test.tsx (ομάδα Ε)
 *
 * Μετρημένο ζωντανά 2026-09-22 (emulator, `ext.owner`): «Επεξεργασία» → «Αποθήκευση» ⇒ `PATCH 200`,
 * η εγγραφή και το ίχνος ελέγχου γράφτηκαν — και η φόρμα έμενε **για πάντα** «Αποθηκεύεται…».
 *
 * Η ομάδα Ε του `form-destination-by-workspace` αποδεικνύει ότι η φόρμα **καλεί** το `onClose`.
 * Αυτή η άγκυρα αποδεικνύει το άλλο μισό: ότι η σελίδα **της το δίνει** και ότι το κλείσιμο
 * ξαναδείχνει την αγγελία. Η φόρμα αντικαθίσταται από στέλεχος — εδώ ρωτάμε **μόνο** για τη
 * σύνδεση, όχι για ό,τι ήδη ελέγχει η ομάδα Ε.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn(), forward: jest.fn(), refresh: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user_maria', email: 'maria@example.gr' } }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => {
  const stable = jest
    .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
    .keyEchoTranslation();
  return { useTranslation: () => stable };
});

jest.mock('@/services/realtime/hooks/useMyOwnerProperties', () => {
  const found = {
    state: 'found',
    property: jest
      .requireActual<typeof import('@/lib/owner-property/__tests__/owner-property-fixtures')>(
        '@/lib/owner-property/__tests__/owner-property-fixtures',
      )
      .validOwnerProperty(),
  };
  return { useMyOwnerProperty: () => found };
});

jest.mock('@/hooks/demand/usePlaceInterest', () => ({ usePlaceInterest: () => ({ kind: 'idle' }) }));

/** Τα παιδιά-πάνελ δεν είναι το ερώτημα — απομονώνονται. */
jest.mock('@/components/demand/PlaceInterestPanel', () => ({ PlaceInterestPanel: () => null }));
jest.mock('@/components/owner-property/OwnerListingCompletion', () => ({ OwnerListingCompletion: () => null }));
jest.mock('@/components/owner-property/OwnerMandatePanel', () => ({ OwnerMandatePanel: () => null }));
jest.mock('@/components/owner-property/OwnerPropertyCard', () => ({ OwnerPropertyCard: () => null }));
jest.mock('@/components/owner-property/OwnerPropertyHistory', () => ({ OwnerPropertyHistory: () => null }));
jest.mock('@/components/owner-property/PrivateMarketingOwnerSection', () => ({ PrivateMarketingOwnerSection: () => null }));

/** Στέλεχος φόρμας: «κλείνω» = καλώ ό,τι μου έδωσε η σελίδα (ή τίποτα, αν δεν μου έδωσε). */
jest.mock('@/components/owner-property/OwnerPropertyFormContent', () => ({
  OwnerPropertyFormContent: ({ onClose }: { onClose?: () => void }) => (
    <button type="button" onClick={() => onClose?.()}>
      form-stub-close
    </button>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { OwnerPropertyDetailContent } =
  require('@/components/owner-property/OwnerPropertyDetailContent') as typeof import('@/components/owner-property/OwnerPropertyDetailContent');

const EDIT = 'property-market:offer.detail.edit';

describe('🔴 Σ — η σελίδα του ακινήτου κλείνει την επεξεργασία που άνοιξε', () => {
  it('Σ0 — ο παρονομαστής: «Επεξεργασία» ανοίγει τη φόρμα στη θέση της προβολής', () => {
    render(<OwnerPropertyDetailContent ownerPropertyId={validOwnerProperty().id} />);
    fireEvent.click(screen.getByRole('button', { name: EDIT }));

    expect(screen.getByRole('button', { name: 'form-stub-close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: EDIT })).toBeNull();
  });

  it('🔴 Σ1 — η φόρμα κλείνει ⇒ ο άνθρωπος ΞΑΝΑΒΛΕΠΕΙ την αγγελία του', () => {
    render(<OwnerPropertyDetailContent ownerPropertyId={validOwnerProperty().id} />);
    fireEvent.click(screen.getByRole('button', { name: EDIT }));
    fireEvent.click(screen.getByRole('button', { name: 'form-stub-close' }));

    expect(screen.getByRole('button', { name: EDIT })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'form-stub-close' })).toBeNull();
  });
});
