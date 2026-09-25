'use client';

/**
 * # Η ΣΥΝΕΔΡΙΑ ΣΧΕΔΙΑΣΗΣ ΠΕΡΙΟΧΗΣ (ADR-885)
 *
 * Από το «Σχεδίαση» ως την «Εφαρμογή»: τα σχήματα που έχουν κλείσει, και ένα σχέδιο
 * κορυφή-κορυφή που δεν έχει κλείσει ακόμη.
 *
 * 🔑 **ΔΥΟ ΤΡΟΠΟΙ ΕΙΣΟΔΟΥ, ΜΙΑ ΚΑΤΑΣΤΑΣΗ.** Το **σύρσιμο** είναι ελεύθερη χειρονομία
 * (Zillow/Redfin/Idealista) και γίνεται σχήματα μέσω του `drawnShapesFromStroke`. Το
 * **πάτημα** προσθέτει κορυφή (Funda) μέσω του **υπάρχοντος** `useOutlineDraft` — της ίδιας
 * χειρονομίας που σχεδιάζει τόπο και εμβέλεια επαγγελματία (SPEC-777A §13.6), με την
 * ίδια αναίρεση και τον ίδιο κριτή. Κανένα δεύτερο μοντέλο «σχεδίου».
 *
 * 🏆 **Ανώτερο της Zillow**: η «Επεξεργασία» ξανανοίγει τη συνεδρία **με τα εφαρμοσμένα
 * σχήματα** — προσθέτεις ή αφαιρείς ένα, αντί να τα ξανασχεδιάσεις όλα.
 */

import { useCallback, useMemo, useState } from 'react';

import { useOutlineDraft } from '@/components/geo/outline-draft';
import {
  drawnAreaFromShapes,
  drawnShapesFromStroke,
  MAX_DRAWN_SHAPES,
} from '@/lib/listings/listing-drawn-area';
import type { GeoDrawnArea, GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/** Γιατί η τελευταία χειρονομία **δεν** έγινε σχήμα — ανακοινώνεται, ποτέ σιωπηλά. */
export type DrawAreaNotice = 'rejected' | 'full';

export interface DrawAreaSession {
  readonly active: boolean;
  readonly shapes: readonly GeoOutline[];
  /** Τα σημεία που πατήθηκαν ένα-ένα και δεν έχουν κλείσει ακόμη. */
  readonly trace: readonly GeoPoint[];
  /** Μπορεί να κλείσει το σχέδιο κορυφή-κορυφή σε σχήμα; */
  readonly canCloseTrace: boolean;
  readonly notice: DrawAreaNotice | null;
  /** Η περιοχή που **θα** εφαρμοστεί — για τη ζωντανή μέτρηση πριν την Εφαρμογή. */
  readonly preview: GeoDrawnArea | null;
  readonly start: (initial: GeoDrawnArea | null) => void;
  readonly cancel: () => void;
  readonly addStroke: (stroke: readonly GeoPoint[], toleranceM: number) => void;
  readonly addVertex: (point: GeoPoint) => void;
  readonly closeTrace: () => void;
  readonly undo: () => void;
  readonly removeShape: (index: number) => void;
  /** @returns η περιοχή προς εφαρμογή, ή `null` αν δεν σχεδιάστηκε τίποτα έγκυρο. */
  readonly finish: () => GeoDrawnArea | null;
}

export function useDrawAreaSession(): DrawAreaSession {
  const [active, setActive] = useState(false);
  const [shapes, setShapes] = useState<readonly GeoOutline[]>([]);
  const [notice, setNotice] = useState<DrawAreaNotice | null>(null);
  const draft = useOutlineDraft();
  const { clear: clearDraft } = draft;

  const start = useCallback(
    (initial: GeoDrawnArea | null) => {
      setShapes(initial?.shapes ?? []);
      setNotice(null);
      clearDraft();
      setActive(true);
    },
    [clearDraft]
  );

  const cancel = useCallback(() => {
    setActive(false);
    setNotice(null);
    clearDraft();
  }, [clearDraft]);

  const addStroke = useCallback(
    (stroke: readonly GeoPoint[], toleranceM: number) => {
      if (shapes.length >= MAX_DRAWN_SHAPES) {
        setNotice('full');
        return;
      }
      const added = drawnShapesFromStroke(stroke, toleranceM, shapes);
      setNotice(added.length === 0 ? 'rejected' : null);
      if (added.length > 0) setShapes([...shapes, ...added]);
    },
    [shapes]
  );

  // 🔑 Το σχέδιο κορυφή-κορυφή κλείνει μόνο αν η **ίδια πόρτα** της διεύθυνσης το δέχεται.
  const { outline } = draft;
  const withTrace = useMemo(
    () => (outline === null ? null : drawnAreaFromShapes([...shapes, outline])),
    [outline, shapes]
  );

  const closeTrace = useCallback(() => {
    if (withTrace === null) return;
    setShapes(withTrace.shapes);
    setNotice(null);
    clearDraft();
  }, [withTrace, clearDraft]);

  const { undo: undoVertex, vertices } = draft;
  const undo = useCallback(() => {
    setNotice(null);
    if (vertices.length > 0) undoVertex();
    else setShapes((current) => current.slice(0, -1));
  }, [vertices.length, undoVertex]);

  const removeShape = useCallback((index: number) => {
    setNotice(null);
    setShapes((current) => current.filter((_, i) => i !== index));
  }, []);

  const preview = useMemo(
    () => withTrace ?? (shapes.length > 0 ? drawnAreaFromShapes(shapes) : null),
    [withTrace, shapes]
  );

  const finish = useCallback((): GeoDrawnArea | null => {
    setActive(false);
    setNotice(null);
    clearDraft();
    return preview;
  }, [preview, clearDraft]);

  return {
    active,
    shapes,
    trace: vertices,
    canCloseTrace: withTrace !== null,
    notice,
    preview,
    start,
    cancel,
    addStroke,
    addVertex: draft.addVertex,
    closeTrace,
    undo,
    removeShape,
    finish,
  };
}
