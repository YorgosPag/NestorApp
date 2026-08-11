'use client';

/**
 * @fileoverview **ΤΟ ΣΧΕΔΙΟ ΩΣ ΚΑΤΑΣΤΑΣΗ** — κορυφή-κορυφή, με τα ίδια όρια που κρίνει ο διακομιστής.
 * @related ADR-777 · SPEC-777A §13.6 (η εναλλακτική) · §14.4 · lib/places/place-claim-validation
 * @module components/geo/outline-draft
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΞΗΧΘΗ **ΠΡΙΝ** ΓΡΑΦΤΕΙ ΔΕΥΤΕΡΗ ΦΟΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σχεδίαση περιγράμματος χρειάζεται σε **δύο** ερωτήσεις τομέα που δεν έχουν καμία
 * άλλη σχέση μεταξύ τους:
 *
 * - *«πού είναι ο τόπος;»* → χειρονομία `drawn` (§13.6, η εναλλακτική στα κενά του OSM)
 * - *«πού ψάχνεις;»* → **Ζ4**, σχεδιασμένη περιοχή αναζήτησης
 *
 * Η **χειρονομία** όμως είναι μία: κλικ, κλικ, κλικ. Γραμμένη δύο φορές θα ήταν
 * κλώνος που μπλοκάρει το **CHECK 3.28** — και, χειρότερα, θα απέκλινε: η μία οθόνη
 * θα μάθαινε αναίρεση και η άλλη όχι.
 *
 * 🔑 **Τα όρια εισάγονται, δεν ξαναγράφονται.** Το ελάχιστο εμβαδόν και ο υπολογισμός
 * του είναι **οι ίδιοι** που κρίνει ο διακομιστής (`MIN_OUTLINE_AREA_SQM` ·
 * `geoOutlineAreaSqm` · `isSimpleGeoOutline`). Δεύτερη τιμή εδώ θα άφηνε τον άνθρωπο
 * να πατήσει υποβολή και να πάρει άρνηση για σχήμα που η οθόνη είχε **δεχτεί**.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Eraser, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { geoOutlineAreaSqm, isSimpleGeoOutline } from '@/lib/geo/geo-ring';
import { MIN_OUTLINE_AREA_SQM } from '@/lib/places/place-claim-validation';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

/** Γιατί το τρέχον σχέδιο **δεν είναι ακόμη σχήμα**. `null` = είναι. */
type DraftDefect = 'outline-too-few-vertices' | 'outline-degenerate' | 'outline-self-intersecting';

export interface OutlineDraft {
  readonly vertices: readonly GeoPoint[];
  readonly areaSqm: number;
  /** `null` όταν το σχέδιο είναι έγκυρο σχήμα. */
  readonly defect: DraftDefect | null;
  /** Το έγκυρο περίγραμμα, ή `null`. **Το μόνο πράγμα που επιτρέπεται να υποβληθεί.** */
  readonly outline: GeoOutline | null;
  readonly addVertex: (point: GeoPoint) => void;
  readonly undo: () => void;
  readonly clear: () => void;
  readonly reset: (outline: GeoOutline | null) => void;
}

export function useOutlineDraft(initial: GeoOutline | null = null): OutlineDraft {
  const [vertices, setVertices] = useState<readonly GeoPoint[]>(initial ?? []);

  const addVertex = useCallback((point: GeoPoint) => {
    setVertices((current) => [...current, point]);
  }, []);
  const undo = useCallback(() => setVertices((current) => current.slice(0, -1)), []);
  const clear = useCallback(() => setVertices([]), []);
  const reset = useCallback((outline: GeoOutline | null) => setVertices(outline ?? []), []);

  const { areaSqm, defect } = useMemo(() => {
    if (vertices.length < 3) {
      return { areaSqm: 0, defect: 'outline-too-few-vertices' as const };
    }
    const sqm = geoOutlineAreaSqm(vertices);
    // ⚠️ **Ίδια σειρά ελέγχων με τον διακομιστή**: εκφυλισμός **πριν** την αυτοτομή,
    // γιατί ένας συνευθειακός δακτύλιος δεν τέμνεται γνησίως και θα περνούσε ως
    // «απλός» — σωστή απάντηση σε λάθος ερώτηση.
    if (sqm < MIN_OUTLINE_AREA_SQM) return { areaSqm: sqm, defect: 'outline-degenerate' as const };
    if (!isSimpleGeoOutline(vertices)) {
      return { areaSqm: sqm, defect: 'outline-self-intersecting' as const };
    }
    return { areaSqm: sqm, defect: null };
  }, [vertices]);

  return {
    vertices,
    areaSqm,
    defect,
    outline: defect === null ? vertices : null,
    addVertex,
    undo,
    clear,
    reset,
  };
}

/**
 * Τα χειριστήρια του σχεδίου.
 *
 * ⚠️ Το ελάττωμα ανακοινώνεται **με το όνομά του** και όχι ως «άκυρο σχήμα»: το
 * *«τέμνει τον εαυτό του»* είναι **οδηγία**, το *«άκυρο»* είναι γρίφος. Τα κλειδιά
 * είναι **τα ίδια** που στέλνει ο διακομιστής (`place.defect.*`) — μία διατύπωση για
 * το ίδιο πρόβλημα, όποιος κι αν το ανακάλυψε.
 */
export function OutlineDraftControls({ draft }: { draft: OutlineDraft }): React.ReactElement {
  const { t } = useTranslation(['search-results']);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {t('place.draw.vertices', { count: draft.vertices.length })}
      </span>

      {draft.defect === null && (
        <span className="text-sm text-muted-foreground">
          {t('place.draw.area', { sqm: Math.round(draft.areaSqm) })}
        </span>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={draft.undo}
        disabled={draft.vertices.length === 0}
      >
        <Undo2 className="mr-2 size-4" aria-hidden />
        {t('place.draw.undo')}
      </Button>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={draft.clear}
        disabled={draft.vertices.length === 0}
      >
        <Eraser className="mr-2 size-4" aria-hidden />
        {t('place.draw.clear')}
      </Button>

      {/* Σιωπή σε **άδειο** σχέδιο: ο άνθρωπος που δεν άρχισε δεν έκανε λάθος. */}
      {draft.vertices.length > 0 && draft.defect !== null && (
        <span className="text-sm text-destructive" role="alert">
          {t(`place.defect.${draft.defect}`)}
        </span>
      )}
    </div>
  );
}
