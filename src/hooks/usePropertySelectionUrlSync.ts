'use client';

/**
 * @fileoverview **Η επιλογή ακινήτου ⇄ `?selected=`** — αμφίδρομα, χωρίς βρόχο.
 * @module hooks/usePropertySelectionUrlSync
 * @see ADR-840 Σ3 (§7.8) · lib/properties/property-filters-url (`PROPERTIES_SELECTED_PARAM`)
 *
 * Στην ενιαία οθόνη η επιλογή είναι **της οθόνης**, όχι του φακού: αλλάζεις λίστα → κάτοψη και το ίδιο ακίνητο μένει
 * επιλεγμένο· «πίσω» από την καρτέλα του ακινήτου επιστρέφει εκεί που ήσουν· ο σύνδεσμος ανοίγει με αυτό επιλεγμένο
 * (Figma: η επιλογή ζει στο URL — `node-id`).
 *
 * 🔑 **Γιατί δεν κάνει βρόχο** — κάθε κατεύθυνση αντιδρά σε αλλαγή της **δικής της** πηγής και μόνο:
 *  - **URL → επιλογή**: τρέχει όταν αλλάζει το `?selected=` (ή φτάνει ο κατάλογος). Δεν ακούει την επιλογή.
 *  - **επιλογή → URL**: τρέχει όταν αλλάζει η **κύρια** επιλογή (σε σχέση με την προηγούμενη τιμή της). Δεν ακούει το URL.
 * Και οι δύο είναι ιδεμποτείς (ίσο ⇒ καμία εγγραφή). Έτσι το «πίσω» (αλλαγή URL) δεν ξαναγράφεται από την παλιά
 * επιλογή, και η άφιξη με `?selected=` δεν σβήνεται από την αρχική κενή επιλογή.
 *
 * ⚠️ Πολλαπλή επιλογή (shift) ⇒ «καμία κύρια» ⇒ το κλειδί σβήνεται, αλλά η πολλαπλή επιλογή **δεν** καθαρίζεται.
 * ⚠️ Το πρότυπο νέου ακινήτου (`__new__`) δεν γράφεται ποτέ στη διεύθυνση: η δημιουργία σημαίνει «καμία κύρια
 *    επιλογή» ⇒ το κλειδί σβήνεται (αλλιώς μια ακύρωση θα άφηνε μπαγιάτικο `?selected=`).
 */

import { useEffect, useRef } from 'react';

import { PROPERTIES_SELECTED_PARAM } from '@/lib/properties/property-filters-url';
import { replaceUrlSearchParams } from '@/lib/url-query-state';
import { UNSAVED_PROPERTY_ID } from '@/lib/properties/unsaved-property';

/** Η ταυτότητα του προτύπου δημιουργίας — ποτέ στη διεύθυνση. */
export const NEW_PROPERTY_SELECTION_ID = UNSAVED_PROPERTY_ID;

interface SelectableProperty {
  readonly id: string;
  readonly floorId?: string;
}

export interface PropertySelectionUrlSyncArgs {
  /** `false` όταν η σελίδα ξέρει την ταυτότητα από τη **διαδρομή** (`/properties/[id]`) — τότε δεν αγγίζουμε το URL. */
  readonly enabled: boolean;
  readonly urlSelectedId: string | null;
  readonly selectedIds: readonly string[];
  readonly properties: readonly SelectableProperty[];
  readonly select: (ids: string[]) => void;
  readonly onSelectFloor?: (floorId: string) => void;
}

/** Η **κύρια** επιλογή: ακριβώς μία, και όχι το πρότυπο δημιουργίας. */
export function primarySelection(selectedIds: readonly string[]): string | null {
  return selectedIds.length === 1 && selectedIds[0] !== NEW_PROPERTY_SELECTION_ID ? selectedIds[0] : null;
}

function writeSelectedParam(id: string | null): void {
  replaceUrlSearchParams((live) => {
    if (id) live.set(PROPERTIES_SELECTED_PARAM, id);
    else live.delete(PROPERTIES_SELECTED_PARAM);
  });
}

export function usePropertySelectionUrlSync(args: PropertySelectionUrlSyncArgs): void {
  const { enabled, urlSelectedId, selectedIds, properties, select, onSelectFloor } = args;
  const primary = primarySelection(selectedIds);
  const catalogReady = properties.length > 0;

  // Τρέχουσες τιμές για τα effects χωρίς να γίνουν εξαρτήσεις — αλλιώς η κάθε κατεύθυνση θα άκουγε και την άλλη.
  const latest = useRef({ primary, selectedIds, properties, select, onSelectFloor });
  latest.current = { primary, selectedIds, properties, select, onSelectFloor };

  // URL → επιλογή
  useEffect(() => {
    if (!enabled || !catalogReady) return;
    const { primary: current, selectedIds: ids, properties: catalog } = latest.current;
    if (urlSelectedId === current) return;
    if (!urlSelectedId) {
      // «Πίσω» σε διεύθυνση χωρίς επιλογή — καθαρίζει μόνο ΜΙΑ κύρια επιλογή, ποτέ πολλαπλή ή δημιουργία.
      if (current && ids.length === 1) latest.current.select([]);
      return;
    }
    const property = catalog.find((item) => item.id === urlSelectedId);
    if (!property) return; // άγνωστη ταυτότητα στον σύνδεσμο ⇒ αγνοείται (ποτέ δεν σκάει η οθόνη)
    latest.current.select([urlSelectedId]);
    if (property.floorId) latest.current.onSelectFloor?.(property.floorId);
  }, [enabled, urlSelectedId, catalogReady]);

  // επιλογή → URL
  const previousPrimary = useRef(primary);
  useEffect(() => {
    if (previousPrimary.current === primary) return;
    previousPrimary.current = primary;
    if (!enabled || primary === urlSelectedId) return;
    writeSelectedParam(primary);
    // `urlSelectedId` διαβάζεται για την ισότητα, αλλά ΔΕΝ οδηγεί το effect (βλ. επικεφαλίδα).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, primary]);
}
