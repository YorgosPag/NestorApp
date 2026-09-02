/**
 * @fileoverview **ΤΑ ΠΛΗΚΤΡΑ ΤΟΥ ΣΥΝΤΑΚΤΗ ΔΙΕΥΘΥΝΣΗΣ** — αναίρεση, επανάληψη, εξαναγκασμός.
 * @related AddressEditor · hooks/useAddressUndo
 *
 * Βγήκε από το `AddressEditor.tsx` στο όριο των 500 γραμμών (N.7.1, 2026-09-02). Είναι
 * **συνδρομή σε καθολικό συμβάν** και τίποτε άλλο — δεν αγγίζει κατάσταση, δεν αποδίδει.
 */
import { useEffect } from 'react';

export function useEditorKeyboard(
  canUndo: boolean,
  canRedo: boolean,
  onUndo: () => void,
  onRedo: () => void,
  onForceRegeocode: () => void,
): void {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        onUndo();
      } else if ((e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) {
        e.preventDefault();
        onRedo();
      } else if (e.key === 'r' && e.shiftKey) {
        e.preventDefault();
        onForceRegeocode();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [canUndo, canRedo, onUndo, onRedo, onForceRegeocode]);
}
