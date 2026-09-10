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
