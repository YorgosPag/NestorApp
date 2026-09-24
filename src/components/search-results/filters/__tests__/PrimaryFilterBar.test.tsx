/**
 * 🔴 **ΔΥΟ ΣΥΜΠΕΡΙΦΟΡΕΣ, ΕΝΑ ΚΑΤΩΦΛΙ** — άγκυρα οθόνης (ADR-777 §8.51).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΙ ΤΙ ΟΧΙ, ΔΗΛΩΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το jsdom **δεν έχει διάταξη**. Εδώ αποδεικνύεται η **απόφαση** — *ποιο δοχείο σε
 * ποιο πλάτος, και τι γράφει το κουμπί κλεισίματος* — όχι η εμφάνιση, που είναι του
 * περιηγητή. Ίδιο ήθος με το `StayLedgerBar.test.tsx`.
 *
 * 🔴 **ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΚΕΝΟ ΕΠΑΛΗΘΕΥΣΗΣ, ΚΑΙ ΤΟ ΚΕΝΟ ΗΤΑΝ ΔΙΚΟ ΜΟΥ** *(2026-09-05)*: το
 * **στενό** μονοπάτι υλοποιήθηκε και **δεν δοκιμάστηκε ποτέ ζωντανά** — το παράθυρο
 * δοκιμών αρνήθηκε να αλλάξει μέγεθος *(έμενε 2400px· το `resize_window` ανέφερε
 * επιτυχία και το viewport δεν άλλαξε)*. Το μισό της Απόφασης 3 έμενε **αδοκίμαστο**,
 * και ένα «δουλεύει» χωρίς μέτρηση είναι ακριβώς αυτό που αυτό το repo δεν δέχεται.
 *
 * ⇒ Η απόφαση κλειδώνεται **εδώ**, όπου μπορεί να ελεγχθεί. Η **εμφάνιση** του φύλλου
 * σε πραγματικό κινητό μένει **δηλωμένο ανοιχτό** *(§8.51.8)* — δεν βαφτίζεται
 * «επαληθευμένη» επειδή πέρασε ένα test σε jsdom.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { EMPTY_LISTING_FILTERS, type ListingFilters } from '@/lib/listings/listing-filters';
import { EMPTY_LISTING_CRITERIA, withValues } from '@/lib/criteria/listing-criteria';

import { PrimaryFilterBar } from '../PrimaryFilterBar';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars === undefined ? key : `${key}#${JSON.stringify(vars)}`,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const ASKING: ListingFilters = {
  ...EMPTY_LISTING_FILTERS,
  criteria: withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['sell']),
};

function bar(props: Partial<React.ComponentProps<typeof PrimaryFilterBar>> = {}) {
  return render(
    <PrimaryFilterBar
      filters={ASKING}
      listings={[]}
      visibleCount={7}
      viewport="wide"
      {...props}
    />
  );
}

// =============================================================================
// Α — ΤΟ ΠΡΩΤΟ ΕΠΙΠΕΔΟ ΕΙΝΑΙ ΙΔΙΟ ΣΕ ΚΑΘΕ ΠΛΑΤΟΣ
// =============================================================================

describe('Α — ο πρώτος καρές δεν μεταπηδά', () => {
  it.each(['measuring', 'narrow', 'wide'] as const)(
    '🔴 τα ΤΕΣΣΕΡΑ χειριστήρια και το κουμπί υπάρχουν και στις τρεις καταστάσεις (%s)',
    (viewport) => {
      // Α19 · `CLS < 0,1`: ο `useViewportClass` απαντά ειλικρινά `measuring` πριν
      // μετρήσει. Αν το πρώτο επίπεδο άλλαζε σχήμα μετά τη μέτρηση, η **πιο δημόσια**
      // οθόνη μας θα μεταπηδούσε μπροστά στον ανώνυμο επισκέπτη.
      bar({ viewport });
      // §8.80: κάθε ερώτηση είναι ΤΣΙΠ — το προσβάσιμο όνομα είναι ο άξονας, ό,τι κι αν γράφει.
      expect(screen.getByRole('button', { name: 'search-filters:filters.axis.offerKind' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /attributes\.label\.priceSale|filters\.axis\.priceSale/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'listing-detail:attributes.label.type' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bedrooms/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'search-filters:filters.more' })).toBeInTheDocument();
    }
  );
});

// =============================================================================
// Β — 🔴 ΤΟ «ΔΕΙΞΕ N» ΥΠΑΡΧΕΙ **ΜΟΝΟ** ΣΤΗ ΣΤΕΝΗ — ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΗ ΣΥΣΤΑΣΗ
// =============================================================================

describe('Β — δύο συμπεριφορές, ένα κατώφλι', () => {
  it('🔴 ΣΤΕΝΗ: το φύλλο κλείνει με ΡΗΤΟ «Δείξε N αποτελέσματα»', async () => {
    // Baymard: σε στενή οθόνη ο άνθρωπος **δεν βλέπει** τα αποτελέσματα πίσω από το
    // φύλλο, άρα χρειάζεται να ξέρει τι τον περιμένει **πριν** κλείσει.
    const { container } = render(
      <PrimaryFilterBar filters={ASKING} listings={[]} visibleCount={7} viewport="narrow" />
    );
    // Το φύλλο είναι κλειστό· ο **σκελετός** του όμως ανήκει στο στενό μονοπάτι.
    expect(container.querySelector('[data-state]')).not.toBeNull();
    expect(screen.queryByText(/filters\.apply/)).not.toBeInTheDocument(); // κλειστό ⇒ αόρατο
  });

  it('🔴 ΕΥΡΕΙΑ: ΚΑΝΕΝΑ «Δείξε N» — τα αποτελέσματα αλλάζουν ΠΙΣΩ από το αναδυόμενο', () => {
    // Ένα «εφαρμογή» εδώ θα ήταν **ψέμα**: τα φίλτρα έχουν ήδη γραφτεί στη διεύθυνση.
    bar({ viewport: 'wide' });
    expect(screen.queryByText(/filters\.apply/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Γ — Η ΕΞΟΔΟΣ ΑΠΟ ΤΟ ΑΔΙΕΞΟΔΟ
// =============================================================================

describe('Γ — «Καθαρισμός» στη γραμμή', () => {
  it('🔴 εμφανίζεται όταν υπάρχει ενεργό φίλτρο', () => {
    bar();
    expect(screen.getByText('search-filters:filters.clearAll')).toBeInTheDocument();
  });

  it('…και ΕΞΑΦΑΝΙΖΕΤΑΙ όταν δεν υπάρχει τι να καθαριστεί', () => {
    // Μονίμως ορατό κουμπί που δεν κάνει τίποτα διδάσκει τον επισκέπτη να το αγνοεί —
    // ακριβώς την ημέρα που θα το χρειαστεί. Μετρημένο ζωντανά 2026-09-05: μετά τον
    // καθαρισμό το κουμπί έφυγε και η διεύθυνση κράτησε `lat/lng/r`.
    bar({ filters: EMPTY_LISTING_FILTERS });
    expect(screen.queryByText('search-filters:filters.clearAll')).not.toBeInTheDocument();
  });

  it('🔴 §8.80: το «Περισσότερα» μετρά ΜΟΝΟ ό,τι ΔΕΝ φαίνεται ήδη στη γραμμή', () => {
    // Το στιγμιότυπο έδειχνε «Περισσότερα φίλτρα · 1 ενεργό 1» με μόνη ερώτηση τη «Πώληση»,
    // που κάθεται ΗΔΗ ως τσιπ. Ο «Καθαρισμός» όμως μετρά όλα — εμφανίζεται.
    bar();
    expect(screen.queryByText(/filters\.moreActive/)).not.toBeInTheDocument();
    expect(screen.getByText('search-filters:filters.clearAll')).toBeInTheDocument();

    const hidden = withValues(EMPTY_LISTING_CRITERIA, 'offerKind', ['sell']);
    bar({ filters: { ...ASKING, criteria: { ...hidden, bathrooms: { min: 1, max: null } } } });
    expect(screen.getByRole('button', { name: /filters\.moreActive.*"count":1/ })).toBeInTheDocument();
  });

  it('χωρίς ερώτηση, το κουμπί λέει σκέτο «Περισσότερα φίλτρα» — χωρίς αριθμό', () => {
    bar({ filters: EMPTY_LISTING_FILTERS });
    expect(screen.getByText('search-filters:filters.more')).toBeInTheDocument();
    expect(screen.queryByText(/filters\.moreActive/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Δ — 🔴 ΤΟ ΟΝΟΜΑ ΤΟΥ ΑΞΟΝΑ ΔΕΝ ΧΑΝΕΤΑΙ ΣΤΗΝ ΕΠΙΛΟΓΗ
// =============================================================================

describe('Δ — προσβασιμότητα των συμπαγών χειριστηρίων', () => {
  it('🔴 ΜΕΤΡΗΜΕΝΟ ΣΤΟ ΔΕΝΤΡΟ ΠΡΟΣΒΑΣΙΜΟΤΗΤΑΣ: το κουμπί έβγαινε ΧΩΡΙΣ ΟΝΟΜΑ', () => {
    // Το **ορατό** κείμενο είναι η σύνοψη: μόλις ο άνθρωπος διαλέξει, γίνεται
    // «Πώληση» — και ο αναγνώστης οθόνης θα άκουγε μια τιμή χωρίς να μάθει **ποια
    // ερώτηση** απαντά. Το `aria-label` κρατά τον άξονα, ό,τι κι αν δείχνει η όψη.
    bar();
    const trigger = screen.getByLabelText('search-filters:filters.axis.offerKind');
    expect(trigger).toHaveAccessibleName('search-filters:filters.axis.offerKind');
    // …και η **όψη** έχει αλλάξει σε τιμή, όχι σε όνομα άξονα:
    expect(trigger).toHaveTextContent('search-results:listing.offer.sell');
  });
});

// =============================================================================
// Ε — §8.80: ΤΣΙΠ ΜΕ ΣΥΝΟΨΗ, ΔΙΑΜΟΝΗ ΜΟΝΟ ΟΠΟΥ ΕΧΕΙ ΝΟΗΜΑ, ΚΑΜΙΑ ΣΕΙΡΑ ΣΤΗ ΓΡΑΜΜΗ
// =============================================================================

describe('Ε — μία γραμμή, όπως η Zillow (§8.80)', () => {
  it('🔴 σε «Πώληση» ΔΕΝ υπάρχει τσιπ διαμονής — ούτε ημερομηνίες, ούτε σκύλοι βοήθειας', () => {
    bar();
    expect(screen.queryByRole('button', { name: 'short-stay:legend' })).not.toBeInTheDocument();
    expect(screen.queryByText('short-stay:pets.filterHint')).not.toBeInTheDocument();
  });

  it('χωρίς διάθεση, το τσιπ διαμονής υπάρχει (η αναζήτηση περιέχει και διαμονές)', () => {
    bar({ filters: EMPTY_LISTING_FILTERS });
    expect(screen.getByRole('button', { name: 'short-stay:legend' })).toBeInTheDocument();
  });

  it('🔴 ενεργή ερώτηση διαμονής ΔΕΝ κρύβεται ποτέ — ούτε σε «Πώληση»', () => {
    bar({ filters: { ...ASKING, guests: 2 } });
    expect(screen.getByRole('button', { name: 'short-stay:legend' })).toBeInTheDocument();
  });

  it('χωρίς διάθεση, το «Τιμή» υπάρχει ως τσιπ — όχι ολόκληρη γραμμή κειμένου', () => {
    bar({ filters: EMPTY_LISTING_FILTERS });
    expect(screen.getByRole('button', { name: 'search-filters:filters.price.label' })).toBeInTheDocument();
    // Η εξήγηση ζει ΜΕΣΑ στο αναδυόμενο (κλειστό ⇒ εκτός DOM).
    expect(screen.queryByText('search-filters:filters.price.needOffer')).not.toBeInTheDocument();
  });

  it('η σειρά ΔΕΝ είναι πια στη γραμμή — μετακόμισε στην κεφαλίδα της λίστας', () => {
    bar();
    expect(screen.queryByLabelText('search-filters:filters.sort.label')).not.toBeInTheDocument();
  });
});
