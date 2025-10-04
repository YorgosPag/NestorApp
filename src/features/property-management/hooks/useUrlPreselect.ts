'use client';

import * as React from 'react';

type Args = {
  selectedId: string | null;
  properties: any[];
  onSelectFloor?: (id: string) => void;
  setSelectedProperties: (ids: string[]) => void;
};

/**
 * Αναπαράγει την υπάρχουσα συμπεριφορά:
 * - Τρέχει όταν υπάρχει selectedId + properties.length > 0
 * - Αποφεύγει πολλαπλές εκτελέσεις μέσω ref (όπως στο αρχικό)
 * - setTimeout(100) πριν το onSelectFloor για να μην προκληθεί loop
 * - Ίδιο dependency pattern: [selectedId, properties.length]
 */
export function useUrlPreselect({ selectedId, properties, onSelectFloor, setSelectedProperties }: Args) {
  const hasSelectedRef = React.useRef(false);

  React.useEffect(() => {
    if (selectedId && !hasSelectedRef.current && properties.length > 0) {
      const propertyToSelect = properties.find((p) => p.id === selectedId);
      if (propertyToSelect) {
        hasSelectedRef.current = true; // Mark as run
        setSelectedProperties([selectedId]);

        if (propertyToSelect.floorId && onSelectFloor) {
          setTimeout(() => {
            onSelectFloor(propertyToSelect.floorId);
          }, 100);
        }
      }
    }
  }, [selectedId, properties, onSelectFloor, setSelectedProperties]);
}
