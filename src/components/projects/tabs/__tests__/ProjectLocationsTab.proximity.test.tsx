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

function locationsState(addresses: readonly ProjectAddress[], form: Form) {
  return {
    localAddresses: addresses,
    isAddFormOpen: form === 'add',
    editingIndex: form === 'edit' ? 0 : null,
    isInlineFormActive: true,
    isSaving: false,
    pendingDragCoords: null,
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

function renderTab(addresses: readonly ProjectAddress[], form: Form) {
  receivedSuggestions.length = 0;
  mockedLocations.mockReturnValue(locationsState(addresses, form));
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
