/**
 * Κ-ΚΕΦ — **Η ΚΕΦΑΛΙΔΑ ΛΕΕΙ ΤΗΝ ΠΡΑΓΜΑΤΙΚΗ ΚΑΤΑΣΤΑΣΗ, ΠΟΤΕ «ΔΙΑΘΕΣΙΜΟ» ΑΠΟ ΠΡΟΕΠΙΛΟΓΗ**
 * (ADR-329 §3.9, ευρήματα Ε1 + Ε2 · ADR-777 §8.30.6 · §8.87).
 *
 * 🔴 **Η αφορμή, μετρημένη ζωντανά 2026-10-07 σε δύο ακίνητα**: η κεφαλίδα της σελίδας `/properties/[id]`
 * έγραφε «Διαθέσιμο» για ακίνητο **εκτός αγοράς**, **στον κάδο** και **στο αρχείο** — ακριβώς πάνω από την
 * ταινία «Αρχειοθετήθηκε» — ενώ η κάρτα της λίστας έγραφε «Μη διαθέσιμο» / «Στον κάδο». Η βάση ήταν σωστή·
 * έλεγε ψέματα η παρουσίαση.
 *
 * 🔑 **Γιατί χρειάζεται ΚΑΙ αυτό, ενώ ο κανόνας έχει ήδη test** (`property-card-price-labels.test.ts`, Κ-ΣΗΜΑ):
 * εκείνο εκτελεί τη **συνάρτηση**. Εδώ εκτελείται το **JSX** — ότι η κεφαλίδα *ζητά* τον κανόνα, τον ζωγραφίζει
 * στη γραμμή του τίτλου και δηλώνει τα namespaces του. Κανόνας σωστός που κανείς δεν καλεί είναι το ίδιο ψέμα
 * στην οθόνη (το `resolvePropertyBadge` είχε δύο καταναλωτές και **κανένα** test απόδοσης).
 */

/* global describe, it, expect, jest, beforeEach */

import { render, screen } from '@testing-library/react';
import { PropertyDetailsHeader } from '../PropertyDetailsHeader';
import type { Property } from '@/types/property';

const requestedNamespaces: string[][] = [];

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: (namespaces?: string | readonly string[]) => {
    requestedNamespaces.push([namespaces ?? []].flat() as string[]);
    return { t: (key: string) => key };
  },
}));

jest.mock('@/components/properties/detail/PropertyHeaderGallery', () => ({
  PropertyHeaderGallery: () => <figure data-testid="identity-gallery" />,
}));

const STATUS = /^commercialStatus\./;
const LIFECYCLE = /^trash:/;

function mountWith(facts: Record<string, unknown>, identity: 'full' | 'compact' = 'full') {
  const property = { id: 'prop_1', name: 'Δοκιμή', type: 'apartment', ...facts } as unknown as Property;
  return render(<PropertyDetailsHeader property={property} identity={identity} />);
}

beforeEach(() => {
  requestedNamespaces.length = 0;
});

describe('Κ-ΚΕΦ — το σήμα κατάστασης στην κεφαλίδα σελίδας', () => {
  it('🔴 εκτός αγοράς ⇒ «Μη διαθέσιμο» — και τίποτα που να θυμίζει προσφορά', () => {
    mountWith({ commercialStatus: 'unavailable', status: 'unavailable' });

    expect(screen.getByText('commercialStatus.unavailable')).toBeInTheDocument();
    expect(screen.getAllByText(STATUS)).toHaveLength(1);
  });

  it.each([
    ['αρχείο', 'archived', 'trash:archivedLabel'],
    ['κάδος', 'deleted', 'trash:trashedLabel'],
  ])('🔴 %s με ΠΑΛΙΟ `commercialStatus: for-sale` ⇒ η ετικέτα κύκλου ζωής, ΟΧΙ η εμπορική', (_label, status, expected) => {
    mountWith({ commercialStatus: 'for-sale', status });

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getAllByText(LIFECYCLE)).toHaveLength(1);
    expect(screen.queryByText(STATUS)).toBeNull();
  });

  it.each(['for-sale', 'for-rent', 'for-sale-and-rent', 'reserved', 'sold', 'rented'])(
    '🔴 `%s` ⇒ το ΔΙΚΟ του όνομα (ενοικίαση ≠ πώληση, ενοικιάστηκε ≠ πωλήθηκε)',
    (commercialStatus) => {
      mountWith({ commercialStatus });

      expect(screen.getByText(`commercialStatus.${commercialStatus}`)).toBeInTheDocument();
      expect(screen.getAllByText(STATUS)).toHaveLength(1);
    },
  );

  it('🔴 άγνωστη κατάσταση ⇒ ΚΑΝΕΝΑ σήμα — η κεφαλίδα στέκεται, δεν μαντεύει', () => {
    mountWith({ commercialStatus: 'κάτι-άλλο' });

    expect(screen.queryByText(STATUS)).toBeNull();
    expect(screen.queryByText(LIFECYCLE)).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Δοκιμή' })).toBeInTheDocument();
  });

  it('✅ το σήμα ζει στη ΓΡΑΜΜΗ ΤΟΥ ΤΙΤΛΟΥ, και η κατάσταση προηγείται του κοινού', () => {
    mountWith({ commercialStatus: 'for-sale' });

    const status = screen.getByText('commercialStatus.for-sale');
    const audience = screen.getByText('marketingAudience.public');
    const titleRow = screen.getByRole('heading', { level: 1, name: 'Δοκιμή' }).parentElement;

    expect(titleRow).toContainElement(status);
    expect(status.compareDocumentPosition(audience) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('🔴 τα namespaces του σήματος ΔΗΛΩΝΟΝΤΑΙ — εμπορική ετικέτα και ετικέτα κύκλου ζωής στην ίδια δήλωση', () => {
    mountWith({ commercialStatus: 'for-sale', status: 'deleted' });

    // Αλλιώς το σήμα δουλεύει μόνο επειδή κάποιος άλλος έτυχε να φορτώσει το namespace (CHECK 3.36 §8.1).
    const declaresBoth = requestedNamespaces.some(
      (namespaces) => namespaces.includes('properties-enums') && namespaces.includes('trash'),
    );
    expect(declaresBoth).toBe(true);
  });

  it('✅ `compact` (δεξιά στήλη): κανένα σήμα — το λέει η κάρτα της λίστας δίπλα', () => {
    mountWith({ commercialStatus: 'unavailable' }, 'compact');

    expect(screen.queryByText(STATUS)).toBeNull();
  });
});
