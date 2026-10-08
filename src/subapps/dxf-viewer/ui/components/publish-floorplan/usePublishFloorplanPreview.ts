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
 * 🔑 Η εικόνα ξαναφτιάχνεται **μόνο** όταν αλλάξει κάτι που αλλάζει τα pixels *(άνοιγμα · επίπλωση)*. Κάθε
 * νέα εικόνα έχει **νέο** κλειδί ιδεμποτίας· η ίδια εικόνα κρατά το ίδιο, ό,τι κι αν πατηθεί.
 */

import * as React from 'react';

import {
  prepareFloorplanPublication,
  type FloorplanPreparationRefusal,
  type PreparedFloorplan,
} from '../../../io/floorplan-publish/publish-floorplan-to-property';
import type { ExportDeps } from '../../../export/types';

export type FloorplanPreview =
  | { readonly status: 'preparing' }
  | { readonly status: 'ready'; readonly prepared: PreparedFloorplan; readonly url: string }
  | { readonly status: 'refused'; readonly refusal: FloorplanPreparationRefusal };

const PREPARING: FloorplanPreview = { status: 'preparing' };

/**
 * @param collectDeps τα ζωντανά υλικά, διαβασμένα τη **στιγμή** της λήψης (`useExportDeps`).
 * @param furniture η επιλογή του διαλόγου — αλλαγή της ξαναφτιάχνει την εικόνα.
 */
export function usePublishFloorplanPreview(
  collectDeps: () => ExportDeps,
  furniture: boolean,
): FloorplanPreview {
  const [preview, setPreview] = React.useState<FloorplanPreview>(PREPARING);
  // 🔑 Το `collectDeps` αλλάζει ταυτότητα σε κάθε ενημέρωση επιπέδων· η εικόνα **δεν** πρέπει να ξαναβγεί
  //    (και να αλλάξει κλειδί) επειδή ήρθε ένα snapshot. Διαβάζεται από ref, τη στιγμή της λήψης.
  const collectRef = React.useRef(collectDeps);
  collectRef.current = collectDeps;

  React.useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setPreview(PREPARING);

    void prepareFloorplanPublication(collectRef.current(), { furniture }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setPreview({ status: 'refused', refusal: result.refusal });
        return;
      }
      url = URL.createObjectURL(result.prepared.blob);
      setPreview({ status: 'ready', prepared: result.prepared, url });
    });

    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [furniture]);

  return preview;
}
