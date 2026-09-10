'use client';

/**
 * @fileoverview **Πού πάει ένα σύρσιμο** στις διευθύνσεις επαφής — ADR-332 D27 Βήμα Β-ΙΙ.
 * @module components/contacts/dynamic/useContactAddressDragRouting
 * @related components/projects/tabs/locations/useLocationsMap (`useLocationsDragRouting`, το πρότυπο)
 *
 * - **Έδρα** (θέση 0, ADR-319) → ο διάλογος **του editor της**: προοδευτικός (`pending`),
 *   «Μόνο η θέση», αναίρεση πινέζας — ο editor κουβαλά ήδη τον φύλακα χειρονομίας.
 * - **Υποκατάστημα** → ο διάλογος **της προβολής**, με δικό του φύλακα: κλεισμένη χειρονομία
 *   δεν ξανανοίγει όταν φτάσει η καθυστερημένη απάντηση της μηχανής (Β13).
 *
 * 🔴 Ως το Β-ΙΙ τα υποκαταστήματα εφαρμόζονταν **χωρίς διάλογο**, και το σύρσιμο χωρίς κείμενο
 * **επανέφερε** την πινέζα με μια ειδοποίηση. Σε **καμία** περίπτωση πλέον δεν γράφεται θέση
 * πριν επιβεβαιώσει ο άνθρωπος.
 */

import { useCallback, useState, type RefObject } from 'react';
import type { AddressEditorHandle } from '@/components/shared/addresses/editor';
import { mapPinDropText, type PinDrop } from '@/components/shared/addresses/pin-drop';
import { usePinDropGate } from '@/components/shared/addresses/usePinDropGate';
import { contactDraggedToResolved, type DragResolvedAddress } from '@/components/contacts/details/contact-pin-drop';

export interface PendingContactViewDrag {
  readonly drop: PinDrop<DragResolvedAddress>;
  /** Η θέση στη λίστα (ADR-319: 0 = έδρα) — πάντα ≥ 1 εδώ. */
  readonly addressIndex: number;
}

interface ContactDragRoutingInput {
  readonly hqEditorRef: RefObject<AddressEditorHandle | null>;
  /** Ανοίγει **σύγχρονα** τον editor της έδρας, ώστε το `ref` να υπάρχει πριν το `setPendingDrag`. */
  readonly openHqEditor: () => void;
}

export function useContactAddressDragRouting({ hqEditorRef, openHqEditor }: ContactDragRoutingInput) {
  const [pendingViewDrag, setPendingViewDrag] = useState<PendingContactViewDrag | null>(null);
  const gate = usePinDropGate();

  const handlePinDrop = useCallback((drop: PinDrop<DragResolvedAddress>, addressIndex: number) => {
    if (addressIndex === 0) {
      if (!hqEditorRef.current) openHqEditor();
      hqEditorRef.current?.setPendingDrag(mapPinDropText(drop, contactDraggedToResolved));
      return;
    }
    if (!gate.admits(drop)) return;
    setPendingViewDrag({ drop, addressIndex });
  }, [hqEditorRef, openHqEditor, gate]);

  const clearViewDrag = useCallback(() => {
    gate.settle(pendingViewDrag?.drop);
    setPendingViewDrag(null);
  }, [gate, pendingViewDrag]);

  return { pendingViewDrag, clearViewDrag, handlePinDrop };
}
