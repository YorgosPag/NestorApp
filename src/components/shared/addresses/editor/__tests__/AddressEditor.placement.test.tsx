/**
 * @fileoverview **Η ΘΕΣΗ ΤΑΞΙΔΕΥΕΙ ΜΕΣΑ ΑΠΟ ΤΟΝ EDITOR** — ADR-332 D27 Βήμα Β.
 * @related editor/hooks/useAddressEditorDrag · shared/addresses/useFormPlacedPoint
 *
 * 🔴 Ως τις 2026-09-10 το `setPendingDrag` δεχόταν **μόνο κείμενο**: η θέση του χεριού χανόταν
 * πριν ανοίξει ο διάλογος, και καμία φόρμα δεν μπορούσε να την αποθηκεύσει. Εδώ εκτελείται ο
 * **πραγματικός** `AddressEditor` με τον πραγματικό διάλογο (mock μόνο στο Radix, δίκτυο, i18n)
 * και ρωτιέται **τι έφτασε στον γονιό** για κάθε απόφαση του ανθρώπου.
 */

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AddressEditor } from '../AddressEditor';
import type { AddressEditorHandle, EditorPinDrop } from '../AddressEditor.types';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, currentLanguage: 'el' }),
}));

jest.mock('@/lib/geocoding/geocoding-service', () => ({
  geocodeAddress: jest.fn().mockResolvedValue(null),
  geocodeAddressDetailed: jest.fn().mockResolvedValue({ kind: 'not-found' }),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('../components/AddressFieldTooltip', () => ({
  AddressFieldTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// --- Fixtures (μετρημένα, ADR-332 D27) ---

const DECLARED = { street: 'Σαμοθράκης', number: '16', city: 'Ελευθέριο Κορδελιό', postalCode: '56334' };
const MACHINE_TEXT = { street: 'Σαμοθράκης', city: 'Ελευθέριο Κορδελιό', postalCode: '56334' };
const DOOR = { lat: 40.6642462, lng: 22.8975146 };

const POSITION_ONLY = 'editor.dragConfirm.positionOnly';
const CONFIRM = 'editor.dragConfirm.confirm';
const CANCEL = 'editor.dragConfirm.cancel';

const RESOLVED_DROP: EditorPinDrop = { point: DOOR, text: { kind: 'resolved', address: MACHINE_TEXT } };

function renderWithDrop(drop: EditorPinDrop, withPlacement = true) {
  const ref = React.createRef<AddressEditorHandle>();
  const spies = {
    onChange: jest.fn(),
    onDragApplied: jest.fn(),
    onUndoRedo: jest.fn(),
    onPlace: jest.fn(),
    onRestore: jest.fn(),
  };
  render(
    <TooltipProvider>
      <AddressEditor
        ref={ref}
        value={DECLARED}
        onChange={spies.onChange}
        onDragApplied={spies.onDragApplied}
        onUndoRedo={spies.onUndoRedo}
        placement={withPlacement ? { onPlace: spies.onPlace, onRestore: spies.onRestore } : undefined}
      />
    </TooltipProvider>,
  );
  act(() => { ref.current?.setPendingDrag(drop); });
  return spies;
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('AddressEditor — «Μόνο η θέση»: θέση ΝΑΙ, κείμενο ΟΧΙ', () => {
  it('ο γονιός λαμβάνει τη θέση της πόρτας — και ΚΑΝΕΝΑ κείμενο της μηχανής (ο αριθμός 16 μένει)', () => {
    const spies = renderWithDrop(RESOLVED_DROP);

    fireEvent.click(screen.getByText(POSITION_ONLY));

    expect(spies.onPlace).toHaveBeenCalledWith(DOOR);
    expect(spies.onDragApplied).not.toHaveBeenCalled();
    expect(spies.onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('16')).toBeInTheDocument();
  });

  it('η αναίρεση επαναφέρει την ΠΙΝΕΖΑ (`onRestore(null)` = η θέση πριν τη φόρμα)', () => {
    const spies = renderWithDrop(RESOLVED_DROP);

    fireEvent.click(screen.getByText(POSITION_ONLY));
    fireEvent.click(screen.getByLabelText('editor.coordinator.undo'));

    expect(spies.onRestore).toHaveBeenCalledWith(null);
    expect(spies.onUndoRedo).toHaveBeenCalled();
  });
});

describe('AddressEditor — «Ναι, ενημέρωσε»: θέση ΚΑΙ κείμενο, από το ΙΔΙΟ σύρσιμο', () => {
  it('ο γονιός λαμβάνει και τη θέση και το κείμενο της μηχανής', () => {
    const spies = renderWithDrop(RESOLVED_DROP);

    fireEvent.click(screen.getByText(CONFIRM));

    expect(spies.onPlace).toHaveBeenCalledWith(DOOR);
    expect(spies.onDragApplied).toHaveBeenCalledWith(MACHINE_TEXT);
    expect(spies.onChange).toHaveBeenCalledWith(MACHINE_TEXT);
  });
});

describe('AddressEditor — «Άκυρο»: ΤΙΠΟΤΑ δεν τοποθετείται (Β1β)', () => {
  it('η ακύρωση δεν αφήνει ίχνος θέσης — και ζητά από τον γονιό να επαναφέρει την πινέζα', () => {
    const spies = renderWithDrop(RESOLVED_DROP);

    fireEvent.click(screen.getByText(CANCEL));

    expect(spies.onPlace).not.toHaveBeenCalled();
    expect(spies.onDragApplied).not.toHaveBeenCalled();
    expect(spies.onUndoRedo).toHaveBeenCalledTimes(1);
  });
});

describe('AddressEditor — θέση ΧΩΡΙΣ κείμενο (Β6) και καλών ΧΩΡΙΣ θέση', () => {
  it('404 ⇒ μόνο «Μόνο η θέση», και η θέση φτάνει στον γονιό', () => {
    const spies = renderWithDrop({ point: DOOR, text: { kind: 'not-found' } });

    expect(screen.queryByText(CONFIRM)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(POSITION_ONLY));

    expect(spies.onPlace).toHaveBeenCalledWith(DOOR);
    expect(spies.onChange).not.toHaveBeenCalled();
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: καλών ΧΩΡΙΣ `placement` (επαφές, ως το Β-ΙΙ) ⇒ ο editor ΔΕΝ υπόσχεται «Μόνο η θέση»', () => {
    renderWithDrop(RESOLVED_DROP, false);

    expect(screen.queryByText(POSITION_ONLY)).not.toBeInTheDocument();
    expect(screen.getByText(CONFIRM)).toBeInTheDocument();
  });
});
