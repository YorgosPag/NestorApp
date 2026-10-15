'use client';

/**
 * ➕ Η ΔΗΜΙΟΥΡΓΙΑ ακινήτου στη θέση της (inline), μέσα στην ενιαία οθόνη (ADR-840 Σ3 · ADR-777 §8.30).
 *
 * Ζούσε μέσα στο `UnitsPageContent`. 🔑 **Ζητιέται και από ΑΛΛΗ οθόνη**: η καρτέλα `/properties/[id]` δείχνει
 * «Νέο Ακίνητο» και στέλνει `?new=1` (`ENTITY_ROUTES.properties.create`) — ανοίγει η **ίδια** φόρμα, ποτέ δεύτερη.
 *
 * ⚠️ **Μία φορά, και η σημαία φεύγει από τη διεύθυνση** μόλις τιμηθεί (`replace`): αλλιώς ένα refresh ή το «πίσω»
 *    θα ξανάνοιγε κενή φόρμα πάνω από ό,τι κοιτούσε ο άνθρωπος. (Ως το Σ3 έμενε στη διεύθυνση και την προστάτευε
 *    μόνο ένα `ref` — που χάνεται σε κάθε επαναφόρτωση.)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { NEW_PROPERTY_SELECTION_ID } from '@/hooks/usePropertySelectionUrlSync';
import { useUrlQuery } from '@/hooks/useUrlQuery';
import { replaceUrlSearchParams } from '@/lib/url-query-state';
import type { Property } from '@/types/property-viewer';

/** Η σημαία της διεύθυνσης — δημόσιο συμβόλαιο (`ENTITY_ROUTES.properties.create`). */
export const CREATE_PROPERTY_PARAM = 'new';

/** «Καμία επιλογή» — η τιμή που καθαρίζει την επιλογή στον `handlePolygonSelect`. */
const NO_SELECTION_ID = '__none__';

/** Το κενό πρότυπο: εκτός αγοράς, πρόχειρο — ποτέ «κρατημένο» (SSoT default). */
function blankProperty(): Property {
  return {
    id: NEW_PROPERTY_SELECTION_ID,
    name: '',
    type: '',
    status: 'unavailable',
    operationalStatus: 'draft',
    floor: 0,
    area: 0,
    layout: { bedrooms: 0, bathrooms: 0, wc: 0 },
    areas: { gross: 0 },
    orientations: [],
    buildingId: '',
    floorId: '',
    // ADR-284 Batch 7: Hierarchy field (required for in-building + standalone units)
    projectId: '',
    vertices: [],
    building: '',
    project: '',
  };
}

interface PropertyCreationArgs {
  readonly selectProperty: (propertyId: string, isShiftClick: boolean) => void;
  readonly refresh: () => void;
}

export interface PropertyCreation {
  readonly isCreating: boolean;
  readonly template: Property | null;
  readonly start: () => void;
  readonly created: (propertyId: string) => void;
  readonly cancel: () => void;
}

export function usePropertyCreation({ selectProperty, refresh }: PropertyCreationArgs): PropertyCreation {
  const [template, setTemplate] = useState<Property | null>(null);

  const start = useCallback(() => {
    setTemplate(blankProperty());
    selectProperty(NEW_PROPERTY_SELECTION_ID, false);
  }, [selectProperty]);

  const created = useCallback((propertyId: string) => {
    setTemplate(null);
    refresh();
    selectProperty(propertyId, false);
  }, [refresh, selectProperty]);

  const cancel = useCallback(() => {
    setTemplate(null);
    selectProperty(NO_SELECTION_ID, false);
  }, [selectProperty]);

  const requested = new URLSearchParams(useUrlQuery()).get(CREATE_PROPERTY_PARAM) === '1';
  const honored = useRef(false);
  useEffect(() => {
    if (!requested || honored.current) return;
    honored.current = true;
    start();
    replaceUrlSearchParams((live) => live.delete(CREATE_PROPERTY_PARAM));
  }, [requested, start]);

  return { isCreating: template !== null, template, start, created, cancel };
}
