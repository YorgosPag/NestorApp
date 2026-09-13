/**
 * Άγκυρες απόδοσης — η καρτέλα διευθύνσεων επαφής ΚΡΑΤΑ θέση (ADR-332 D27 Β-ΙΙ Φ4/Φ5)
 *
 * Τρέχει η **πραγματική** καρτέλα: `AddressesSectionWithFullscreen` → `ContactAddressMapPreview`
 * → δρομολόγηση → διάλογος προβολής (`ContactViewDragConfirm` → `ViewDragConfirm`) → ιδιοκτήτης
 * έδρας → `setFormData`. Αντικαταστάτες **μόνο** στα άκρα: ο χάρτης (MapLibre), ο editor (ως
 * καταγραφέας με `setPendingDrag`) και το σώμα του διαλόγου (τρία κουμπιά).
 */

import React, { useState } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { initialFormData } from '@/types/ContactFormTypes';

// --- Άκρα -------------------------------------------------------------------

var mockMapProps: { current: Record<string, unknown> | null } = { current: null };
jest.mock('@/components/shared/addresses/AddressMap', () => ({
  AddressMap: (props: Record<string, unknown>) => {
    mockMapProps.current = props;
    return null;
  },
}));

var mockEditors: Array<Record<string, unknown>> = [];
var mockPendingDrags: unknown[] = [];
jest.mock('@/components/shared/addresses/editor', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    AddressEditor: R.forwardRef((props: Record<string, unknown> & { children?: React.ReactNode }, ref) => {
      mockEditors.push(props);
      R.useImperativeHandle(ref, () => ({ setPendingDrag: (drop: unknown) => mockPendingDrags.push(drop) }));
      return R.createElement('div', null, props.children);
    }),
    AddressSourceLabel: () => null,
    AddressCoordsBadge: () => null,
    // ⚠️ **Ο ΠΡΑΓΜΑΤΙΚΟΣ δείκτης φρεσκάδας** (ADR-332 D27 Ζ6). Ένα `() => null` εδώ έκανε τη
    //    μετάλλαξη «η κάρτα παίρνει την ΩΜΗ εγγραφή» να **επιζήσει**: η άγκυρα δεν μπορούσε να
    //    δει το badge που καταγγέλλει, άρα φύλαγε μόνο το υποσέλιδο — τη μισή διαδρομή.
    AddressFreshnessIndicator: jest.requireActual<typeof import('@/components/shared/addresses/editor/components/AddressFreshnessIndicator')>(
      '@/components/shared/addresses/editor/components/AddressFreshnessIndicator',
    ).AddressFreshnessIndicator,
    // ⚠️ **ΟΧΙ στοίχημα**: το `computeFreshness` είναι ο ΠΡΑΓΜΑΤΙΚΟΣ (ADR-332 D27 Ζ6). Το mock
    //    σκεπάζει το **barrel**, άρα σκέπαζε και τον καθαρό βοηθό — και όσο η κάρτα των επαφών
    //    δεν έπαιρνε θέση, κανείς δεν το καλούσε, οπότε η απουσία ήταν **αόρατη**. Μόλις το Ζ6
    //    έδωσε θέση στην κάρτα, το mock έσκασε: η ίδια η αστοχία είναι η απόδειξη ότι η αλλαγή
    //    φτάνει στην οθόνη. Ένα `() => null` εδώ θα ήταν δεύτερος, αποκλίνων κανόνας φρεσκάδας.
    computeFreshness: jest.requireActual<typeof import('@/components/shared/addresses/editor/helpers/computeFreshness')>(
      '@/components/shared/addresses/editor/helpers/computeFreshness',
    ).computeFreshness,
    AddressDragConfirmDialog: (p: { proposal: { kind: string }; onConfirm: () => void; onConfirmPositionOnly?: () => void; onCancel: () => void }) =>
      R.createElement('section', { 'data-testid': 'drag-dialog', 'data-kind': p.proposal.kind },
        R.createElement('button', { type: 'button', onClick: p.onConfirmPositionOnly }, 'position-only'),
        R.createElement('button', { type: 'button', onClick: p.onConfirm }, 'adopt'),
        R.createElement('button', { type: 'button', onClick: p.onCancel }, 'cancel')),
  };
});
jest.mock('@/components/shared/addresses/AddressWithHierarchy', () => ({ AddressWithHierarchy: () => null }));
jest.mock('@/components/contacts/addresses/AddressTypeSelector', () => ({ AddressTypeSelector: () => null }));
jest.mock('@/components/contacts/relationships/hooks/useDerivedWorkAddresses', () => ({
  useDerivedWorkAddresses: () => ({ derived: [] }),
}));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ notify: jest.fn() }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));
var mockRelocate = jest.fn(async () => undefined);
jest.mock('@/services/contacts.service', () => ({
  ContactsService: { relocateAddressPin: (...args: unknown[]) => mockRelocate(...args) },
}));

import { AddressesSectionWithFullscreen } from '../AddressesSectionWithFullscreen';
import { publishContactAddressAdvisories } from '@/services/contacts/contact-address-advisories';

// --- Fixtures ---------------------------------------------------------------

const HQ_POINT = { lat: 40.6401, lng: 22.9444 };
const DROP_POINT = { lat: 40.6329, lng: 22.9480 };
const HQ: CompanyAddress = {
  id: 'addr_hq', type: 'headquarters', street: 'Αγγελάκη', number: '5', postalCode: '54621', city: 'Θεσσαλονίκη',
  coordinates: HQ_POINT, source: 'dragged', verifiedAt: 7,
};
const BRANCH: CompanyAddress = {
  id: 'addr_br', type: 'branch', street: 'Μοναστηρίου', number: '10', postalCode: '56121', city: 'Εύοσμος',
};

function initial(): ContactFormData {
  return {
    ...initialFormData, id: 'cont_1', type: 'company', companyName: 'ALFA',
    street: HQ.street, streetNumber: HQ.number, postalCode: HQ.postalCode, city: HQ.city,
    companyAddresses: [HQ, BRANCH],
  };
}

var writes: ContactFormData[] = [];
function Harness({ disabled = false }: { disabled?: boolean }) {
  const [formData, setFormData] = useState<ContactFormData>(initial);
  const record: React.Dispatch<React.SetStateAction<ContactFormData>> = (value) => {
    const next = typeof value === 'function' ? value(formData) : value;
    writes.push(next);
    setFormData(next);
  };
  return (
    <TooltipProvider>
      <AddressesSectionWithFullscreen formData={formData} setFormData={record} disabled={disabled} />
    </TooltipProvider>
  );
}

type Drop = { point: { lat: number; lng: number }; gesture: number; text: Record<string, unknown> };
const drag = (drop: Drop, index: number) => act(() => {
  (mockMapProps.current!.onAddressDragUpdate as (d: Drop, i: number) => void)(drop, index);
});

beforeEach(() => {
  mockMapProps.current = null;
  mockEditors = [];
  mockPendingDrags = [];
  writes = [];
  mockRelocate.mockClear();
  publishContactAddressAdvisories('cont_1', []);
});

describe('ADR-332 D27 Β-ΙΙ — ο χάρτης δείχνει την ΑΠΟΘΗΚΕΥΜΕΝΗ θέση', () => {
  it('η πινέζα της έδρας φέρει τη θέση και την ταυτότητα της εγγραφής', () => {
    render(<Harness />);
    const pins = mockMapProps.current!.addresses as Array<{ id: string; coordinates?: unknown }>;
    expect(pins[0]).toMatchObject({ id: 'addr_hq', coordinates: HQ_POINT });
    expect(pins[1].id).toBe('addr_br');
  });
});

describe('ADR-332 D27 Β-ΙΙ — σύρσιμο υποκαταστήματος', () => {
  it('ο διάλογος ανοίγει ΑΜΕΣΩΣ (αναμονή) · «Μόνο η θέση» ⇒ θέση στο υποκατάστημα, κείμενο ίδιο', async () => {
    render(<Harness />);
    drag({ point: DROP_POINT, gesture: 9001, text: { kind: 'pending' } }, 1);

    expect(screen.getByTestId('drag-dialog').getAttribute('data-kind')).toBe('pending');
    await userEvent.click(screen.getByText('position-only'));

    const branch = writes[writes.length - 1].companyAddresses![1];
    expect(branch).toMatchObject({ street: 'Μοναστηρίου', coordinates: DROP_POINT, source: 'dragged' });
    expect(screen.queryByTestId('drag-dialog')).toBeNull();
  });

  it('κλεισμένη χειρονομία ΔΕΝ ξανανοίγει όταν φτάσει η απάντηση της μηχανής', async () => {
    render(<Harness />);
    drag({ point: DROP_POINT, gesture: 9002, text: { kind: 'pending' } }, 1);
    await userEvent.click(screen.getByText('position-only'));

    drag({ point: DROP_POINT, gesture: 9002, text: { kind: 'resolved', address: { street: 'Εγνατίας', number: '12' } } }, 1);
    expect(screen.queryByTestId('drag-dialog')).toBeNull();
  });

  it('«Άκυρο» ⇒ τίποτα δεν γράφεται και η πινέζα επιστρέφει', async () => {
    render(<Harness />);
    const resetBefore = mockMapProps.current!.dragResetKey as number;
    drag({ point: DROP_POINT, gesture: 9003, text: { kind: 'not-found' } }, 1);
    await userEvent.click(screen.getByText('cancel'));

    expect(writes).toEqual([]);
    expect(mockMapProps.current!.dragResetKey).toBe(resetBefore + 1);
  });
});

describe('ADR-332 D27 Β-ΙΙ — σύρσιμο έδρας', () => {
  it('πηγαίνει στον διάλογο ΤΟΥ EDITOR της, που προσφέρει «Μόνο η θέση» (placement)', () => {
    render(<Harness />);
    drag({ point: DROP_POINT, gesture: 9004, text: { kind: 'pending' } }, 0);

    expect(mockPendingDrags).toHaveLength(1);
    expect(mockPendingDrags[0]).toMatchObject({ point: DROP_POINT, text: { kind: 'pending' } });
    const hqEditor = mockEditors[mockEditors.length - 1];
    expect(hqEditor.placement).toEqual(expect.objectContaining({ onPlace: expect.any(Function) }));
  });

  it('D25: η αφετηρία εγγύτητας που ΦΤΑΝΕΙ στον editor είναι η θέση της επαφής', () => {
    render(<Harness />);
    drag({ point: DROP_POINT, gesture: 9005, text: { kind: 'pending' } }, 0);

    const hqEditor = mockEditors[mockEditors.length - 1] as { suggestions?: { proximityAnchor?: unknown } };
    expect(hqEditor.suggestions?.proximityAnchor).toEqual(HQ_POINT);
  });
});

describe('ADR-332 D27 Β-ΙΙ — «Μετακίνησε / Κράτα» (Φ2β)', () => {
  it('σε ΠΡΟΒΟΛΗ: η συμβουλή φαίνεται στην κάρτα και το «Μετακίνησε» ζητά ΑΥΤΗ τη διεύθυνση', async () => {
    publishContactAddressAdvisories('cont_1', [{ addressId: 'addr_br', distanceMetres: 800, toleranceMetres: 50 }]);
    render(<Harness disabled />);

    await userEvent.click(screen.getByText('editor.positionDrift.relocate'));
    expect(mockRelocate).toHaveBeenCalledWith('cont_1', 'addr_br');
  });

  it('σε ΕΠΕΞΕΡΓΑΣΙΑ: καμία συμβουλή (αλλιώς η επόμενη αποθήκευση θα αναιρούσε τη μετακίνηση)', () => {
    publishContactAddressAdvisories('cont_1', [{ addressId: 'addr_br', distanceMetres: 800, toleranceMetres: 50 }]);
    render(<Harness />);

    expect(screen.queryByText('editor.positionDrift.relocate')).toBeNull();
  });
});

/**
 * ADR-332 D27 **Ζ6** — η **μόνιμη** κατάσταση του υποσελίδου.
 *
 * 🔴 Οι άλλες δύο (απόκλιση, εκκρεμότητα) είναι απαντήσεις **της τελευταίας αποθήκευσης** και
 * δημοσιεύονται στη μνήμη. Αυτή προκύπτει από τα **ίδια τα αποθηκευμένα δεδομένα** — γι' αυτό
 * καθόταν στη βάση της ALFA χωρίς **κανένα** σημάδι, και γι' αυτό δεν χρειάζεται δημοσίευση.
 */
describe('ADR-332 D27 Ζ6 — «η θέση λύθηκε για ΑΛΛΟ κείμενο»', () => {
  /**
   * Το ζωντανό δείγμα: κείμενο «102», απόδειξη «100», `accuracy: 'exact'`.
   *
   * 🔴 **Το λεξιλόγιο ΕΙΝΑΙ μέρος του δείγματος** — μετρημένο στο Firestore, όχι επινοημένο:
   * η `CompanyAddress` λέει **`municipalityName`/`regionalUnitName`**, ενώ το `resolvedFor`
   * (που το φτιάχνει ο **διακομιστής** από την όψη) λέει **`municipality`/`regionalUnit`**.
   * Μια άγκυρα με μόνο `street`/`number`/`city` **δεν βλέπει** αυτή την ασυμμετρία και ήταν
   * πράσινη ενώ η εφαρμογή καταγγέλλει **κάθε** διεύθυνση επαφής για πάντα.
   */
  const CONTACT_VOCABULARY = {
    municipalityName: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
    regionalUnitName: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
    regionName: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
  } as const;
  const PROVED_VOCABULARY = {
    municipality: 'ΔΗΜΟΣ ΘΕΣΣΑΛΟΝΙΚΗΣ',
    regionalUnit: 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
    region: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
  } as const;

  const DRIFTED_BRANCH: CompanyAddress = {
    ...BRANCH,
    ...CONTACT_VOCABULARY,
    street: 'Εγνατία',
    number: '102',
    city: 'Θεσσαλονίκη',
    postalCode: '54623',
    coordinates: HQ_POINT,
    source: 'geocoded',
    verifiedAt: 7,
    geocodingMetadata: {
      confidence: 0.91,
      accuracy: 'exact',
      variantUsed: 1,
      resolvedFor: { ...PROVED_VOCABULARY, street: 'Εγνατία', number: '100', city: 'Θεσσαλονίκη', postalCode: '54623' },
    },
  };

  /** Ίδιο κείμενο με την απόδειξη — **στα δύο λεξιλόγια**. Πρέπει να ΣΙΩΠΑ. */
  const ALIGNED_BRANCH: CompanyAddress = {
    ...DRIFTED_BRANCH,
    number: '100',
  };

  /**
   * ⚠️ **ΦΡΕΣΚΟ `verifiedAt` ΠΑΝΤΟΥ, ΚΑΙ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΑΓΚΥΡΑΣ.** Το κοινό `HQ` fixture έχει
   * `verifiedAt: 7` (1970) ⇒ **`stale` λόγω ηλικίας**. Με αυτό μέσα, ένας έλεγχος «το badge λέει
   * stale» είναι πράσινος **ανεξάρτητα** από το Ζ6 — μετρημένο: η πρώτη εκδοχή βρήκε δύο τέτοια
   * badges και δεν μπορούσε να πει ποιο ήταν ποιο. Με φρέσκια επιβεβαίωση, `stale` μπορεί να
   * σημαίνει **μόνο** «λύθηκε για άλλο κείμενο».
   */
  const FRESH = Date.now();

  function DriftedHarness({ address }: { address: CompanyAddress }) {
    const [formData, setFormData] = useState<ContactFormData>(() => ({
      ...initial(),
      companyAddresses: [{ ...HQ, verifiedAt: FRESH }, { ...address, verifiedAt: FRESH }],
    }));
    return (
      <TooltipProvider>
        <AddressesSectionWithFullscreen formData={formData} setFormData={setFormData} disabled />
      </TooltipProvider>
    );
  }

  it('Ζ6-Ο3 — 🔴 η ειδοποίηση φαίνεται και το «Υπολογισμός» ζητά ΑΥΤΗ τη διεύθυνση', async () => {
    render(<DriftedHarness address={DRIFTED_BRANCH} />);

    await userEvent.click(screen.getByText('editor.positionStale.resolve'));
    expect(mockRelocate).toHaveBeenCalledWith('cont_1', 'addr_br');
  });

  it('Ζ6-Ο3α — 🔴 ΤΟ ΛΕΞΙΛΟΓΙΟ: κείμενο ίδιο με την απόδειξη ⇒ ΣΙΩΠΗ, παρότι τα ονόματα πεδίων διαφέρουν', () => {
    // Η επαφή λέει `municipalityName`, ο διακομιστής απέδειξε `municipality`. Αν ο πελάτης
    // κρίνει την **ωμή** εγγραφή αντί για την **όψη** (`contactAddressPositionView`), τα
    // διοικητικά πεδία διαβάζονται ως κενά ⇒ `differs` για **κάθε** διεύθυνση, για πάντα.
    // Μετρημένο ζωντανά: η έδρα της ALFA καταγγελλόταν ενώ `resolvedFor` ΚΑΙ κείμενο ήταν «104».
    render(<DriftedHarness address={ALIGNED_BRANCH} />);

    expect(screen.queryByText('editor.positionStale.resolve')).toBeNull();
    // …και το **badge** το ίδιο: η κάρτα κρίνει την ίδια όψη με το υποσέλιδο.
    expect(screen.queryByText('editor.freshness.stale')).toBeNull();
  });

  it('Ζ6-Ο3α2 — 🔴 το ΙΔΙΟ και στην ΚΑΡΤΑ: κείμενο ≠ απόδειξη ⇒ το badge λέει «stale»', () => {
    // Δεύτερη διαδρομή προς τον ίδιο άνθρωπο. Χωρίς αυτή, μια μετάλλαξη που δίνει στην κάρτα
    // την ωμή εγγραφή **επιζεί** — μετρημένο.
    render(<DriftedHarness address={DRIFTED_BRANCH} />);

    // Ακριβώς ΕΝΑ: η έδρα του ίδιου πίνακα είναι φρέσκια και χωρίς ισχυρισμό ⇒ σιωπά.
    expect(screen.getAllByText('editor.freshness.stale')).toHaveLength(1);
  });

  /**
   * 🔴 **Η ΕΔΡΑ ΕΙΝΑΙ ΑΛΛΟ COMPONENT.** Τα υποκαταστήματα τα ζωγραφίζει το
   * `CompanyAddressesSection`, την έδρα το `AddressesSectionWithFullscreen` — **δύο** σημεία
   * κλήσης της ίδιας κάρτας. Μια μετάλλαξη στην έδρα **επέζησε δύο φορές** επειδή όλες οι
   * άγκυρες Ζ6 έβαζαν το δείγμα σε **υποκατάστημα**: ο έλεγχος δεν μπορούσε να κοκκινίσει
   * για τον λόγο που ισχυριζόταν.
   */
  function HqHarness({ hq }: { hq: CompanyAddress }) {
    const [formData, setFormData] = useState<ContactFormData>(() => ({
      ...initial(),
      companyAddresses: [{ ...hq, id: HQ.id, type: 'headquarters', verifiedAt: FRESH }, BRANCH],
    }));
    return (
      <TooltipProvider>
        <AddressesSectionWithFullscreen formData={formData} setFormData={setFormData} disabled />
      </TooltipProvider>
    );
  }

  it('Ζ6-Ο3α3 — 🔴 Η ΕΔΡΑ: κείμενο ≠ απόδειξη ⇒ badge «stale» ΚΑΙ ειδοποίηση στη δική της κάρτα', () => {
    render(<HqHarness hq={DRIFTED_BRANCH} />);

    expect(screen.getAllByText('editor.freshness.stale')).toHaveLength(1);
    expect(screen.getByText('editor.positionStale.resolve')).toBeInTheDocument();
  });

  it('Ζ6-Ο3α4 — 🔴 Η ΕΔΡΑ ευθυγραμμισμένη ⇒ ΣΙΩΠΗ: η κάρτα της κρίνει την ΟΨΗ, όχι την ωμή εγγραφή', () => {
    // ⚠️ **Η άγκυρα που λείπει είναι ΠΑΝΤΑ η θετική.** Ένα *drifted* δείγμα βγάζει `differs` και
    // με τις δύο εκδοχές (με όψη επειδή ο αριθμός διαφέρει· με ωμή επειδή τα διοικητικά
    // διαβάζονται κενά) ⇒ η μετάλλαξη **επέζησε δύο φορές**. Μόνο το **ευθυγραμμισμένο**
    // δείγμα ξεχωρίζει τις δύο εκδοχές: όψη ⇒ σιωπή, ωμή ⇒ ψευδής καταγγελία.
    render(<HqHarness hq={ALIGNED_BRANCH} />);

    expect(screen.queryByText('editor.positionStale.resolve')).toBeNull();
    expect(screen.queryByText('editor.freshness.stale')).toBeNull();
  });

  it('Ζ6-Ο3β — ΠΑΛΙΑ εγγραφή χωρίς απόδειξη ⇒ ΣΙΩΠΗ (άγνοια δεν κατηγορεί)', () => {
    const legacy: CompanyAddress = {
      ...DRIFTED_BRANCH,
      geocodingMetadata: { confidence: 0.91, accuracy: 'exact', variantUsed: 1 },
    };
    render(<DriftedHarness address={legacy} />);

    expect(screen.queryByText('editor.positionStale.resolve')).toBeNull();
  });

  it('Ζ6-Ο3γ — η ΑΠΟΚΛΙΣΗ προηγείται: μετρημένα μέτρα είναι πιο συγκεκριμένα από «δεν αντιστοιχεί»', () => {
    publishContactAddressAdvisories('cont_1', [{ addressId: 'addr_br', distanceMetres: 800, toleranceMetres: 50 }]);
    render(<DriftedHarness address={DRIFTED_BRANCH} />);

    expect(screen.getByText('editor.positionDrift.relocate')).toBeInTheDocument();
    expect(screen.queryByText('editor.positionStale.resolve')).toBeNull();
  });
});
