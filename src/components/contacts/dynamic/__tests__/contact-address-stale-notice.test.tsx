/**
 * Άγκυρες **ΟΡΑΤΟΤΗΤΑΣ** του Ζ6 — ADR-332 D27.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΜΕΣΑ ΣΤΟ `AddressesSectionWithFullscreen.placement`
 * ────────────────────────────────────────────────────────────────────────────
 * Εκείνη η σουίτα κάνει `jest.mock('@/components/shared/addresses/editor')` — δηλαδή
 * **μοκάρει τα ίδια τα όργανα** που το Ζ6 προσπαθεί να ταΐσει. Μια άγκυρα εκεί θα ήταν
 * **πράσινη χωρίς να μεταγλωττίσει τίποτα από αυτά που ισχυρίζεται**: ακριβώς το περιστατικό
 * της προηγούμενης συνεδρίας, όπου ο `BuildingAddressesEditor` ήταν mocked και **790 πράσινα**
 * δεν απέδειξαν ότι ο αλλαγμένος κώδικας καν μεταγλωττίστηκε.
 *
 * Εδώ τρέχουν **τα πραγματικά** `computeFreshness`, `positionTextVerdict`,
 * `AddressFreshnessIndicator`, `AddressSourceLabel`, `SharedAddressActionCard`.
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));
// ⚠️ **Τα hooks του design system ΔΕΝ μοκάρονται**: τρέχουν τα πραγματικά. Μια πρώτη εκδοχή
// τα μόκαρε με μισά αντικείμενα και έσκαγε στο `badge.tsx` (που ζητά και `useBorderTokens`) —
// δηλαδή το mock θα ήταν **δεύτερο, αποκλίνον αντίγραφο** του design system μέσα στο test.

import { render, screen } from '@testing-library/react';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AddressLike } from '@/lib/geocoding/address-position';

const NOW = Date.now();
const resolvedFor = { street: 'Εγνατία', number: '100', city: 'Θεσσαλονίκη' };
const metadata = { confidence: 0.91, accuracy: 'exact' as const, variantUsed: 1 };

/** Το ζωντανό δείγμα, με απόδειξη: κείμενο «102», θέση λυμένη για «100». */
const DRIFTED: AddressLike = {
  street: 'Εγνατία',
  number: '102',
  city: 'Θεσσαλονίκη',
  coordinates: { lat: 40.6345573, lng: 22.9461936 },
  source: 'geocoded',
  verifiedAt: NOW - 5000,
  geocodingMetadata: { ...metadata, resolvedFor },
};

function renderCard(position?: AddressLike) {
  // Τα badges του εμπλουτισμού ζουν μέσα σε tooltip — ο πάροχος είναι μέρος του πλαισίου
  // απόδοσης της εφαρμογής, όχι της άγκυρας.
  return render(
    <TooltipProvider>
      <SharedAddressActionCard
        id="hq"
        streetLine="Εγνατία 102"
        typeLabel="Έδρα"
        isEditing={false}
        {...(position ? { position } : {})}
      />
    </TooltipProvider>,
  );
}

describe('Ζ6-Ο2 — ο εμπλουτισμός ΕΙΝΑΙ στη σελίδα της επαφής', () => {
  it('χωρίς θέση ⇒ καμία σειρά εμπλουτισμού (η προηγούμενη συμπεριφορά των επαφών)', () => {
    renderCard();
    expect(screen.queryByText('editor.freshness.fresh')).not.toBeInTheDocument();
    expect(screen.queryByText('editor.source.geocoded')).not.toBeInTheDocument();
  });

  it('🔴 θέση λυμένη για ΑΛΛΟ κείμενο ⇒ το badge λέει «stale», όχι «fresh»', () => {
    // Το `verifiedAt` είναι 5 δευτερόλεπτα πριν — κατά την ηλικία θα ήταν «fresh».
    renderCard(DRIFTED);

    expect(screen.getByText('editor.freshness.stale')).toBeInTheDocument();
    expect(screen.queryByText('editor.freshness.fresh')).not.toBeInTheDocument();
    // Και η προέλευση εμφανίζεται — τα τρία badges ήταν ΑΠΟΝΤΑ από αυτή την οθόνη ως το Ζ6.
    expect(screen.getByText('editor.source.geocoded')).toBeInTheDocument();
  });

  it('ίδιο κείμενο ⇒ «fresh», καμία ψεύτικη καταγγελία', () => {
    renderCard({ ...DRIFTED, number: '100' });

    expect(screen.getByText('editor.freshness.fresh')).toBeInTheDocument();
  });

  it('ΠΑΛΙΑ εγγραφή χωρίς απόδειξη ⇒ «fresh» (άγνοια ≠ κατηγορία)', () => {
    renderCard({ ...DRIFTED, geocodingMetadata: metadata });

    expect(screen.getByText('editor.freshness.fresh')).toBeInTheDocument();
  });
});
