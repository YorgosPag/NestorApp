/**
 * =============================================================================
 * useLocationsMap — ο χάρτης των διευθύνσεων έργου: τι ζωγραφίζεται, πού πάει ένα σύρσιμο
 * =============================================================================
 *
 * Εξήχθη από τον `ProjectLocationsTab` (490 γρ., N.7.1) — ADR-332 D27 Βήμα Β.
 *
 * 🔑 **Ό,τι βλέπεις είναι ό,τι αποθηκεύεται**: η πινέζα της φόρμας επεξεργασίας δείχνει τη
 * θέση που **θα γραφτεί** (`editPlacedPoint`), και η αναίρεση την επαναφέρει μαζί με το
 * κείμενο. Ως τις 2026-09-10 η πινέζα έμενε μετακινημένη ενώ η αποθήκευση την αγνοούσε.
 *
 * @module components/projects/tabs/locations/useLocationsMap
 */

import { useCallback, useMemo, useState, type RefObject } from 'react';
import type { ProjectAddress } from '@/types/project/addresses';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { AddressEditorHandle } from '@/components/shared/addresses/editor';
import { mapPinDropText, pendingPinAddress, type PinDrop } from '@/components/shared/addresses/pin-drop';
import { usePinDropGate } from '@/components/shared/addresses/usePinDropGate';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';

/** Η πινέζα της φόρμας προσθήκης — δεν είναι διεύθυνση, είναι θέση σε αναμονή. */
export const PENDING_ADDRESS_ID = '__pending_new__';

export interface VisibleAddress {
  readonly address: ProjectAddress;
  readonly originalIndex: number;
}

export interface PendingViewDrag {
  readonly drop: PinDrop;
  readonly originalIndex: number;
}

interface MapModelInput {
  readonly visibleAddresses: readonly VisibleAddress[];
  readonly localAddresses: readonly ProjectAddress[];
  readonly isAddFormOpen: boolean;
  readonly editingIndex: number | null;
  readonly pendingDragCoords: GeoPoint | null;
  readonly editPlacedPoint: GeoPoint | null;
  /** Ο τύπος που δείχνει η φόρμα προσθήκης — η πινέζα σε αναμονή γράφει τον ΙΔΙΟ. */
  readonly addFormType: ProjectAddress['type'];
}

/** Τι ζωγραφίζει ο χάρτης, ποια πινέζα είναι «ενεργή», ποιες είναι κλειδωμένες. */
export function useLocationsMapModel(input: MapModelInput) {
  const { visibleAddresses, localAddresses, isAddFormOpen, editingIndex, pendingDragCoords, editPlacedPoint, addFormType } = input;
  const editingId = editingIndex !== null ? localAddresses[editingIndex]?.id : undefined;

  // Η πινέζα που δουλεύεται στη φόρμα (amber + αναπήδηση).
  const activeEditingAddressId = isAddFormOpen ? PENDING_ADDRESS_ID : editingId;

  // Με ανοιχτή φόρμα παγώνουν όλες οι πινέζες εκτός από αυτή που δουλεύεται.
  const readOnlyAddressIds = useMemo<Set<string> | undefined>(() => {
    if (isAddFormOpen) return new Set(visibleAddresses.map(({ address }) => address.id));
    if (editingIndex === null || !editingId) return undefined;
    return new Set(visibleAddresses.filter(({ address }) => address.id !== editingId).map(({ address }) => address.id));
  }, [isAddFormOpen, editingIndex, editingId, visibleAddresses]);

  const mapAddresses = useMemo<ProjectAddress[]>(() => {
    const real = visibleAddresses.map(({ address }) =>
      address.id === editingId && editPlacedPoint
        ? { ...address, coordinates: { lat: editPlacedPoint.lat, lng: editPlacedPoint.lng } }
        : address,
    );
    return isAddFormOpen && pendingDragCoords
      ? [...real, pendingPinAddress(pendingDragCoords, PENDING_ADDRESS_ID, addFormType)]
      : real;
  }, [visibleAddresses, editingId, editPlacedPoint, isAddFormOpen, pendingDragCoords, addFormType]);

  return { activeEditingAddressId, readOnlyAddressIds, mapAddresses };
}

interface DragRoutingInput {
  readonly visibleAddresses: readonly VisibleAddress[];
  readonly isAddFormOpen: boolean;
  readonly editingIndex: number | null;
  readonly addEditorRef: RefObject<AddressEditorHandle | null>;
  readonly editEditorRef: RefObject<AddressEditorHandle | null>;
}

/**
 * **Πού πάει ένα σύρσιμο**: στη φόρμα προσθήκης, στη φόρμα επεξεργασίας, ή στον διάλογο της
 * προβολής. Σε **καμία** περίπτωση δεν γράφεται θέση πριν επιβεβαιώσει ο άνθρωπος (Β1β).
 */
export function useLocationsDragRouting(input: DragRoutingInput) {
  const { visibleAddresses, isAddFormOpen, editingIndex, addEditorRef, editEditorRef } = input;
  const [pendingViewDrag, setPendingViewDrag] = useState<PendingViewDrag | null>(null);
  // Β13: ο διάλογος της ΠΡΟΒΟΛΗΣ έχει τον ίδιο φύλακα με του editor — κλεισμένη χειρονομία δεν ξανανοίγει.
  const gate = usePinDropGate();

  const handleCombinedDragUpdate = useCallback((drop: PinDrop, index: number) => {
    const editorDrop = mapPinDropText(drop, (address) => storedAddressToResolved(address, 'projectAddress'));
    if (isAddFormOpen && index >= visibleAddresses.length) {
      addEditorRef.current?.setPendingDrag(editorDrop);
      return;
    }
    if (editingIndex !== null) {
      editEditorRef.current?.setPendingDrag(editorDrop);
      return;
    }
    if (!gate.admits(drop)) return;
    setPendingViewDrag({ drop, originalIndex: visibleAddresses[index]?.originalIndex ?? index });
  }, [isAddFormOpen, editingIndex, visibleAddresses, addEditorRef, editEditorRef, gate]);

  const clearViewDrag = useCallback(() => {
    gate.settle(pendingViewDrag?.drop);
    setPendingViewDrag(null);
  }, [gate, pendingViewDrag]);

  return { pendingViewDrag, clearViewDrag, handleCombinedDragUpdate };
}
