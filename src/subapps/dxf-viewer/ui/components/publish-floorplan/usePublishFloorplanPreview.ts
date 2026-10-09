'use client';

/**
 * @fileoverview **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΤΗΣ ΔΗΜΟΣΙΑΣ ΚΑΤΟΨΗΣ** — μία προετοιμασμένη εικόνα, που φαίνεται **και** φεύγει (ADR-909 Α4).
 * @related ../../../io/floorplan-publish/publish-floorplan-to-property · ./PublishFloorplanDialog
 * @module subapps/dxf-viewer/ui/components/publish-floorplan/usePublishFloorplanPreview
 *
 * 🔴 **Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΔΕΝ ΕΙΝΑΙ ΠΡΟΑΙΡΕΤΙΚΗ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ «ΚΑΤΙ ΠΑΡΟΜΟΙΟ».** Το προφίλ έχει δηλωμένο
 * όριο: στο σκέτο DXF ισχύει «ό,τι είναι σε ορατό στρώμα». Ο μόνος τρόπος να ξέρει ο άνθρωπος τι θα δει το
 * κοινό είναι να το **δει** — άρα το `<img>` δείχνει το **ίδιο αντικείμενο `Blob`** που θα ανεβεί, όχι μια
 * δεύτερη απόδοση που «θα έπρεπε» να βγει ίδια.
 *
 * 🔑 Η εικόνα ξαναφτιάχνεται **μόνο** όταν αλλάξει κάτι που αλλάζει τα pixels *(άνοιγμα · ομάδες · χρώμα)*.
 * Κάθε νέα εικόνα έχει **νέο** κλειδί ιδεμποτίας· η ίδια εικόνα κρατά το ίδιο, ό,τι κι αν πατηθεί.
 *
 * ⏱️ Οι αλλαγές **μετά** το άνοιγμα περιμένουν λίγο πριν ζωγραφίσουν (ADR-909 Β2.8): πέντε γρήγορα κλικ
 * στους διακόπτες δίνουν **μία** λήψη 4096 px, όχι πέντε. Όσο περιμένει, η κατάσταση είναι ήδη `preparing` —
 * το κουμπί «Δημοσίευση» δεν μένει ποτέ ενεργό πάνω σε εικόνα που δεν αντιστοιχεί στους διακόπτες.
 */

import * as React from 'react';

import {
  prepareFloorplanPublication,
  type FloorplanPreparationRefusal,
  type PreparedFloorplan,
} from '../../../io/floorplan-publish/publish-floorplan-to-property';
import {
  publicFloorplanChoiceKey,
  type PublicFloorplanChoice,
} from '../../../print/public-floorplan/public-floorplan-presets';
import type { ExportDeps } from '../../../export/types';
import { DXF_TIMING } from '../../../config/dxf-timing';

export type FloorplanPreview =
  | { readonly status: 'preparing' }
  | { readonly status: 'ready'; readonly prepared: PreparedFloorplan; readonly url: string }
  | { readonly status: 'refused'; readonly refusal: FloorplanPreparationRefusal };

const PREPARING: FloorplanPreview = { status: 'preparing' };

/** Πόσο περιμένει μια αλλαγή επιλογής πριν ζητήσει νέα εικόνα. */
const CHOICE_SETTLE_MS = DXF_TIMING.ui.FLOORPLAN_PREVIEW_DEBOUNCE;

/**
 * @param collectDeps τα ζωντανά υλικά, διαβασμένα τη **στιγμή** της λήψης (`useExportDeps`).
 * @param choice ομάδες και χρώμα του διαλόγου — αλλαγή τους ξαναφτιάχνει την εικόνα.
 * @param retryAttempt μετρητής του «Δοκίμασε ξανά» — κάθε αύξηση ξαναζητά τα σχήματα 3Δ που απέτυχαν (Γ1β).
 */
export function usePublishFloorplanPreview(
  collectDeps: () => ExportDeps,
  choice: PublicFloorplanChoice,
  retryAttempt = 0,
): FloorplanPreview {
  const [preview, setPreview] = React.useState<FloorplanPreview>(PREPARING);
  // 🔑 Το `collectDeps` αλλάζει ταυτότητα σε κάθε ενημέρωση επιπέδων· η εικόνα **δεν** πρέπει να ξαναβγεί
  //    (και να αλλάξει κλειδί) επειδή ήρθε ένα snapshot. Διαβάζεται από ref, τη στιγμή της λήψης.
  const collectRef = React.useRef(collectDeps);
  collectRef.current = collectDeps;
  // 🔑 Η επιλογή συγκρίνεται ως **κείμενο**: νέο αντικείμενο με τις ίδιες ομάδες δεν είναι νέα εικόνα.
  const choiceKey = publicFloorplanChoiceKey(choice);
  const choiceRef = React.useRef(choice);
  choiceRef.current = choice;
  const openedRef = React.useRef(false);
  const attemptRef = React.useRef(retryAttempt);

  React.useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setPreview(PREPARING);
    // ADR-909 Γ1β — «Δοκίμασε ξανά»: ίδια επιλογή, νέα προσπάθεια για τα σχήματα 3Δ που απέτυχαν. Ρητή πράξη
    // ⇒ ζωγραφίζει αμέσως (δεν είναι αλλαγή διακόπτη που περιμένει τις επόμενες).
    const retryFailedShapes = attemptRef.current !== retryAttempt;
    attemptRef.current = retryAttempt;

    const prepare = (): void => {
      const pending = retryFailedShapes
        ? prepareFloorplanPublication(collectRef.current(), choiceRef.current, { retryFailedShapes })
        : prepareFloorplanPublication(collectRef.current(), choiceRef.current);
      void pending.then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setPreview({ status: 'refused', refusal: result.refusal });
          return;
        }
        url = URL.createObjectURL(result.prepared.blob);
        setPreview({ status: 'ready', prepared: result.prepared, url });
      });
    };

    // Το άνοιγμα ζωγραφίζει αμέσως· μόνο οι αλλαγές επιλογής περιμένουν.
    const timer = openedRef.current && !retryFailedShapes ? setTimeout(prepare, CHOICE_SETTLE_MS) : null;
    if (timer === null) prepare();
    openedRef.current = true;

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [choiceKey, retryAttempt]);

  return preview;
}
