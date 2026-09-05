/**
 * @fileoverview **ΟΙ ΤΟΠΟΘΕΣΙΕΣ ΤΟΥ ΕΡΓΟΥ ΑΠΕΚΤΗΣΑΝ ΑΦΕΤΗΡΙΑ** — ADR-332 **D25**.
 * @related ADR-332 D23 *(ο κανόνας)* · utils/address/address-list-center
 *
 * Η οθόνη τοποθεσιών έργου είναι ο **δεύτερος** καταναλωτής που καλωδιώθηκε, και ο πιο
 * επιρρεπής στην αστοχία που το D23 μέτρησε: εδώ ένα έργο έχει **πολλές** διευθύνσεις
 * *(έδρα, εργοτάξιο, προσόψεις)* και οι υποψήφιοι που επιστρέφει ο πάροχος για μια
 * οδό χωρίς τοπωνύμιο απέχουν **212-349 km** μεταξύ τους. Χωρίς αφετηρία η σειρά τους
 * βγαίνει **μόνο** από τη βεβαιότητα του παρόχου.
 *
 * 🔑 **Εκτελείται η παραγωγική αλυσίδα**, με αντικαταστάτες μόνο στα δύο άκρα της:
 *
 *     ProjectLocationsTab  →  addressListCenter  →  LocationInlineForm  →  AddressEditor
 *
 * ⚠️ **Και οι ΔΥΟ φόρμες ελέγχονται.** Είναι δύο ξεχωριστά σημεία κλήσης του ίδιου
 * component στο ίδιο αρχείο· μια καλωδίωση που θυμήθηκε τη μία και ξέχασε την άλλη είναι
 * ακριβώς το είδος της μισής δουλειάς που **δεν φαίνεται πουθενά**.
 */

import React from 'react';
import { render } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Project } from '@/types/project';
import type { ProjectAddress } from '@/types/project/addresses';
import { ProjectLocationsTab } from '../ProjectLocationsTab';
import { useProjectLocations } from '../locations/useProjectLocations';

// --- Mocks ---

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Το τέρμα της αλυσίδας, ως καταγραφέας — τα παιδιά δεν αποδίδονται επίτηδες. */
const receivedSuggestions: unknown[] = [];
jest.mock('@/components/shared/addresses/editor', () => ({
  AddressEditor: (props: { suggestions?: unknown }) => {
    receivedSuggestions.push(props.suggestions);
    return null;
  },
  AddressDragConfirmDialog: () => null,
}));

/** Ο χάρτης απαιτεί Leaflet και δεν συμμετέχει στην ερώτηση. */
jest.mock('@/components/shared/addresses/AddressMap', () => ({
  AddressMap: () => null,
}));

jest.mock('../locations/useProjectLocations');

const mockedLocations = useProjectLocations as jest.MockedFunction<typeof useProjectLocations>;

// --- Fixtures ---

/** Το εργοτάξιο στη Θεσσαλονίκη — η **αποθηκευμένη** θέση του έργου. */
const SITE_POINT = { lat: 40.6401, lng: 22.9444 };

/** Καλαμαριά — εκεί που ο **άνθρωπος** έσυρε την εκκρεμή πινέζα. */
const DRAGGED_POINT = { lat: 40.5800, lng: 22.9500 };

/**
 * 🔴 **Το προεπιλεγμένο κέντρο Αθήνας** — όπου κάθεται η εκκρεμής πινέζα όταν **κανείς
 * δεν την άγγιξε** και το έργο δεν έχει καμία θέση.
 *
 * ⚠️ **Το fixture το κρατά ΠΑΝΤΑ γεμάτο, επίτηδες.** Στην παραγωγή το `pendingDragCoords`
 * είναι **ποτέ κενό** όσο η φόρμα προσθήκης είναι ανοιχτή· μόνο το `humanPlacedPoint`
 * ξεχωρίζει τη μαντεψιά από τη δήλωση. Ένα fixture που άφηνε και τα δύο κενά θα ήταν
 * πράσινο σε υλοποίηση που περνά τη μαντεμένη πινέζα — δηλαδή θα φύλαγε **σκέλος που η
 * παραγωγή δεν παράγει**.
 */
const GUESSED_PIN = { lat: 37.9838, lng: 23.7275 };

function address(overrides: Partial<ProjectAddress> = {}): ProjectAddress {
  return {
    id: 'addr-1',
    street: 'Εγνατία',
    number: '147',
    city: 'Θεσσαλονίκη',
    postalCode: '54630',
    country: 'Greece',
    type: 'site',
    isPrimary: true,
    ...overrides,
  } as ProjectAddress;
}

type Form = 'add' | 'edit';

function locationsState(
  addresses: readonly ProjectAddress[],
  form: Form,
  humanPlacedPoint: { lat: number; lng: number } | null = null,
) {
  return {
    localAddresses: addresses,
    humanPlacedPoint,
    isAddFormOpen: form === 'add',
    editingIndex: form === 'edit' ? 0 : null,
    isInlineFormActive: true,
    isSaving: false,
    // Πιστό στην παραγωγή: η πινέζα υπάρχει πάντα· η ανθρώπινη πράξη είναι η ΔΙΑΚΡΙΣΗ.
    pendingDragCoords: humanPlacedPoint ?? GUESSED_PIN,
    deleteDialogOpen: false,
    addHierarchy: {},
    editHierarchy: {},
    addType: 'site',
    editType: 'site',
    addBlockSide: '__clear__',
    editBlockSide: '__clear__',
    addLabel: '',
    editLabel: '',
    addIsPrimary: false,
    editIsPrimary: false,
    setAddHierarchy: jest.fn(),
    setEditHierarchy: jest.fn(),
    setAddType: jest.fn(),
    setEditType: jest.fn(),
    setAddBlockSide: jest.fn(),
    setEditBlockSide: jest.fn(),
    setAddLabel: jest.fn(),
    setEditLabel: jest.fn(),
    setAddIsPrimary: jest.fn(),
    handleEditIsPrimaryChange: jest.fn(),
    handleOpenAddForm: jest.fn(),
    handleCancelAdd: jest.fn(),
    handleSaveNewAddress: jest.fn(),
    handleStartEdit: jest.fn(),
    handleCancelEdit: jest.fn(),
    handleSaveEdit: jest.fn(),
    handleSetPrimary: jest.fn(),
    handleClearPrimaryAddress: jest.fn(),
    handleRequestDelete: jest.fn(),
    handleConfirmDelete: jest.fn(),
    handleAddressDragUpdate: jest.fn(),
    handlePendingDragUpdate: jest.fn(),
    handleMarkerClick: jest.fn(),
    setDeleteDialogOpen: jest.fn(),
  } as unknown as ReturnType<typeof useProjectLocations>;
}

function renderTab(
  addresses: readonly ProjectAddress[],
  form: Form,
  humanPlacedPoint: { lat: number; lng: number } | null = null,
) {
  receivedSuggestions.length = 0;
  mockedLocations.mockReturnValue(locationsState(addresses, form, humanPlacedPoint));
  // Το `FullscreenToggleButton` της οθόνης χρησιμοποιεί Radix `Tooltip`, που απαιτεί
  // πρόγονο `TooltipProvider`. Στην εφαρμογή τον δίνει το `ConditionalAppShell`· εδώ
  // αναπαρίσταται η ίδια συνθήκη, αλλιώς σκάει ο harness και όχι ο κώδικας.
  render(
    <TooltipProvider>
      <ProjectLocationsTab data={{ id: 'p-1' } as Project} />
    </TooltipProvider>,
  );
  return receivedSuggestions;
}

// --- Tests ---

describe('ProjectLocationsTab — η αφετηρία φτάνει και στις δύο φόρμες (D25)', () => {
  it.each<Form>(['add', 'edit'])(
    'φόρμα «%s»: η θέση του έργου φτάνει ως αφετηρία εγγύτητας',
    (form) => {
      const captured = renderTab([address({ coordinates: SITE_POINT })], form);

      expect(captured).toHaveLength(1);
      expect(captured[0]).toEqual({ proximityAnchor: SITE_POINT });
    },
  );

  it('καμία διεύθυνση με θέση ⇒ `undefined`, ποτέ μαντεμένο σημείο', () => {
    // ⛔ Ιδίως ΠΟΤΕ το προεπιλεγμένο κέντρο Αθήνας που χρησιμοποιεί το
    // `handleOpenAddForm` για να **τοποθετήσει πινέζα**: εκείνο απαντά άλλη ερώτηση
    // («πού να πιαστεί το χέρι;»), και ως αφετηρία θα ανέβαζε την Αθήνα πρώτη.
    const captured = renderTab([address({ coordinates: undefined })], 'add');

    expect(captured[0]).toEqual({ proximityAnchor: undefined });
  });

  it('το «φάντασμα» της καθαρισμένης κύριας δεν κλέβει την αφετηρία', () => {
    // Το `handleClearPrimaryAddress` κρατά τη θέση `isPrimary` με μια κενή εγγραφή.
    // Είναι `isPrimary: true` **χωρίς** συντεταγμένες ⇒ το `addressListCenter` οφείλει
    // να προσπεράσει και να δώσει τη θέση της επόμενης υπαρκτής.
    const captured = renderTab(
      [
        address({ id: 'ghost', street: '', city: '', isPrimary: true, coordinates: undefined }),
        address({ id: 'real', isPrimary: false, coordinates: SITE_POINT }),
      ],
      'edit',
    );

    expect(captured[0]).toEqual({ proximityAnchor: SITE_POINT });
  });
});

// =============================================================================
// Η ΠΙΝΕΖΑ ΠΟΥ ΕΣΥΡΕ Ο ΑΝΘΡΩΠΟΣ — ADR-332 D25 §πινέζα (απόφαση Giorgio 05/09)
// =============================================================================

/**
 * 🔑 **Ο άνθρωπος είπε «εδώ» πριν πληκτρολογήσει τίποτα.** Καμία συναγωγή από τη λίστα
 * δεν είναι ισχυρότερη από αυτό.
 *
 * 🔴 **Ο δεύτερος έλεγχος είναι ο σημαντικός.** Η εκκρεμής πινέζα **υπάρχει πάντα** όσο
 * η φόρμα προσθήκης είναι ανοιχτή — γεννιέται σε κεντροειδές, ή 150 m βόρεια, ή στο
 * **προεπιλεγμένο κέντρο Αθήνας**. Μια υλοποίηση που περνούσε το `pendingDragCoords`
 * χωρίς τη διάκριση θα ήταν πράσινη στον πρώτο έλεγχο και θα έκανε **την Αθήνα αφετηρία
 * κάθε νέου έργου** — η αστοχία που απέρριψε ρητά το D23, από άλλη πόρτα.
 */
describe('ProjectLocationsTab — η πινέζα του ανθρώπου νικάει το σημείο του έργου (D25)', () => {
  it('φόρμα προσθήκης: η ΣΥΡΜΕΝΗ πινέζα γίνεται αφετηρία, όχι η θέση του έργου', () => {
    const captured = renderTab([address({ coordinates: SITE_POINT })], 'add', DRAGGED_POINT);

    expect(captured[0]).toEqual({ proximityAnchor: DRAGGED_POINT });
  });

  it('🔴 πινέζα ΜΑΝΤΕΜΕΝΗ (ο άνθρωπος δεν την άγγιξε) ⇒ μιλά το έργο, ΠΟΤΕ η πινέζα', () => {
    // Το hook δίνει `humanPlacedPoint: null` όσο η πινέζα κάθεται στη μαντεμένη θέση.
    const captured = renderTab([address({ coordinates: SITE_POINT })], 'add', null);

    expect(captured[0]).toEqual({ proximityAnchor: SITE_POINT });
  });

  it('συρμένη πινέζα σε έργο ΧΩΡΙΣ καμία αποθηκευμένη θέση ⇒ αρκεί μόνη της', () => {
    const captured = renderTab([address({ coordinates: undefined })], 'add', DRAGGED_POINT);

    expect(captured[0]).toEqual({ proximityAnchor: DRAGGED_POINT });
  });

  it('🔴 φόρμα ΕΠΕΞΕΡΓΑΣΙΑΣ: αγνοεί την εκκρεμή πινέζα ακόμη κι αν υπάρχει', () => {
    // Δομικό, όχι τυχαίο: η εκκρεμής πινέζα ανήκει **αποκλειστικά** στη ροή προσθήκης.
    // Αν αυτό κοκκινίσει, κάποιος έδωσε **μία** αφετηρία και στις δύο φόρμες, και η
    // πινέζα μιας νέας διεύθυνσης διαρρέει σε εγγραφή που διορθώνεται.
    const captured = renderTab([address({ coordinates: SITE_POINT })], 'edit', DRAGGED_POINT);

    expect(captured[0]).toEqual({ proximityAnchor: SITE_POINT });
  });
});
