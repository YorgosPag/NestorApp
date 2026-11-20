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

/* global describe, it, expect, jest, beforeEach, afterEach */

import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { LISTING_REACH_SETTLE_MS } from '@/lib/listings/listing-presence';
import { PropertyDetailsHeader } from '../PropertyDetailsHeader';
import type { Property } from '@/types/property';
import { getCompatNamespaces } from '@/i18n/namespace-compat';

const requestedNamespaces: string[][] = [];

/**
 * Ό,τι ΦΟΡΤΩΝΕΙ μια δήλωση — δηλωμένα + compat splits, όπως το `resolveAllNamespaces()` του hook (ADR-280 §11).
 * Το `['properties', 'trash']` φορτώνει και το `properties-enums`· η χειρόγραφη λίστα της οικογένειας απαγορεύεται
 * (CHECK 3.108), άρα η άγκυρα ρωτά τον ΧΑΡΤΗ, όχι το γράμμα της δήλωσης.
 */
const loadedBy = (namespaces: readonly string[]): string[] => [
  ...namespaces,
  ...namespaces.flatMap((ns) => [...getCompatNamespaces(ns)]),
];

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: (namespaces?: string | readonly string[]) => {
    requestedNamespaces.push([namespaces ?? []].flat() as string[]);
    return { t: (key: string) => key };
  },
}));

jest.mock('@/components/properties/detail/PropertyHeaderGallery', () => ({
  PropertyHeaderGallery: () => <figure data-testid="identity-gallery" />,
}));

// ADR-777 §8.103.2 — ο κόσμος (το δημόσιο έγγραφο) ελέγχεται από το test· προεπιλογή «φορτώνει» = κανένας ισχυρισμός.
const mockLookup: { value: { state: string; listing?: unknown } } = { value: { state: 'loading' } };
jest.mock('@/services/realtime/hooks/usePublicListings', () => ({
  usePublicListing: () => mockLookup.value,
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const STATUS = /^commercialStatus\./;
const LIFECYCLE = /^trash:/;

function mountWith(facts: Record<string, unknown>, identity: 'full' | 'compact' = 'full') {
  const property = { id: 'prop_1', name: 'Δοκιμή', type: 'apartment', ...facts } as unknown as Property;
  return render(<PropertyDetailsHeader property={property} identity={identity} />);
}

beforeEach(() => {
  requestedNamespaces.length = 0;
  mockLookup.value = { state: 'loading' };
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

  // ADR-777 §8.103 — ίδια σειρά με την κάρτα της λίστας: πρώτα «δημοσιεύθηκε;», μετά η κατάσταση.
  it('✅ το σήμα ζει στη ΓΡΑΜΜΗ ΤΟΥ ΤΙΤΛΟΥ, και η παρουσία προηγείται της κατάστασης', () => {
    mountWith({ commercialStatus: 'for-sale' });

    const status = screen.getByText('commercialStatus.for-sale');
    const presence = screen.getByText('listingPresence.public');
    const titleRow = screen.getByRole('heading', { level: 1, name: 'Δοκιμή' }).parentElement;

    expect(titleRow).toContainElement(status);
    expect(presence.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('🔴 τα namespaces του σήματος ΔΗΛΩΝΟΝΤΑΙ — εμπορική ετικέτα και ετικέτα κύκλου ζωής στην ίδια δήλωση', () => {
    mountWith({ commercialStatus: 'for-sale', status: 'deleted' });

    // Αλλιώς το σήμα δουλεύει μόνο επειδή κάποιος άλλος έτυχε να φορτώσει το namespace (CHECK 3.36 §8.1).
    const declaresBoth = requestedNamespaces.some(
      (declared) => loadedBy(declared).includes('properties-enums') && loadedBy(declared).includes('trash'),
    );
    expect(declaresBoth).toBe(true);
  });

  // 🔄 Ανατράπηκε 2026-11-20 (ADR-777 §8.103): ως τότε «κανένα σήμα — το λέει η κάρτα της λίστας δίπλα».
  it('✅ `compact` (δεξιά στήλη): το ΙΔΙΟ σήμα κατάστασης, στη γραμμή του τίτλου', () => {
    mountWith({ commercialStatus: 'unavailable' }, 'compact');

    const status = screen.getByText(STATUS);
    const titleRow = screen.getByRole('heading', { level: 3, name: 'Δοκιμή' }).parentElement;
    expect(titleRow).toContainElement(status);
  });
});

/**
 * Κ-ΚΟΣΜ — **ΠΡΟΘΕΣΗ ⇄ ΚΟΣΜΟΣ** (ADR-777 §8.103.2). Το σήμα λέει ό,τι ισχύει **έξω**, όχι μόνο ό,τι αποφασίστηκε μέσα:
 * σύνδεσμος μόνο προς σελίδα που υπάρχει· «Δεν έφτασε» / «Ακόμη στο κοινό» μόνο αφού η απόκλιση **επιμείνει**.
 */
describe('Κ-ΚΟΣΜ — η παρουσία απέναντι στο δημόσιο έγγραφο', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('✅ «Στο κοινό» + η σελίδα υπάρχει ⇒ σύνδεσμος προς /listing/<id>, σε ΝΕΑ καρτέλα', () => {
    mockLookup.value = { state: 'found', listing: {} };
    mountWith({ commercialStatus: 'for-sale' });

    const link = screen.getByRole('link', { name: 'listingPresence.openPublic' });
    expect(link).toHaveAttribute('href', '/listing/prop_1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toContainElement(screen.getByText('listingPresence.public'));
  });

  it('🔴 όσο ο κόσμος είναι άγνωστος ⇒ κανένας σύνδεσμος, καμία προειδοποίηση', () => {
    mountWith({ commercialStatus: 'for-sale' });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('listingPresence.public')).toBeInTheDocument();
  });

  it('🔴 «Στο κοινό» χωρίς δημόσιο έγγραφο ⇒ «Δεν έφτασε στο κοινό» ΜΟΝΟ μετά την καθίζηση, χωρίς σύνδεσμο', () => {
    mockLookup.value = { state: 'absent' };
    mountWith({ commercialStatus: 'for-sale' });

    // Μέσα στο παράθυρο: η αποθήκευση μόλις έγινε, ο γραφέας ίσως δεν έγραψε ακόμη — καμία ψευδής προειδοποίηση.
    expect(screen.getByText('listingPresence.public')).toBeInTheDocument();
    expect(screen.queryByText('listingPresence.reach.missing')).toBeNull();

    act(() => { jest.advanceTimersByTime(LISTING_REACH_SETTLE_MS); });

    expect(screen.getByText('listingPresence.reach.missing')).toBeInTheDocument();
    expect(screen.getByText('listingPresence.reach.missingHint')).toBeInTheDocument();
    expect(screen.queryByText('listingPresence.public')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('🔴 «Εκτός αγγελίας» ενώ η δημόσια σελίδα ζει ⇒ «Ακόμη στο κοινό», με σύνδεσμο προς ό,τι βλέπει ο κόσμος', () => {
    mockLookup.value = { state: 'found', listing: {} };
    mountWith({ commercialStatus: 'unavailable', status: 'unavailable' });

    act(() => { jest.advanceTimersByTime(LISTING_REACH_SETTLE_MS); });

    expect(screen.getByText('listingPresence.reach.lingering')).toBeInTheDocument();
    expect(screen.getByText('listingPresence.reach.lingeringHint')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'listingPresence.openPublic' })).toHaveAttribute('href', '/listing/prop_1');
  });
});
