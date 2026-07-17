/**
 * print-fidelity-notifications — ADR-667 Φ1.
 *
 * Toast registrar για τις **αποκλίσεις του τυπωμένου PDF από την οθόνη**. Πριν από αυτό, όταν
 * ένα γέμισμα «Εικόνα» υποβαθμιζόταν σε συμπαγές χρώμα (μεγάλη τοπογραφική επιφάνεια → γκρι),
 * ο χρήστης έπαιρνε **λάθος σχέδιο και καμία ένδειξη**.
 *
 * Ίδιο μοτίβο με τα αδέρφια του φακέλου (EventBus → `toast` με `t`) — μηδέν νέο κανάλι
 * ειδοποιήσεων (N.12). Ένα toast **ανά είδος** απώλειας με πλήθος (ICU plural), όχι ένα ανά
 * οντότητα: δέκα υποβαθμισμένα γεμίσματα = ένα μήνυμα «10 γεμίσματα…».
 *
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 * @see print/print-fidelity.ts — ο ορισμός των κωδικών (SSoT)
 */

import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { EventBus } from '../../systems/events/EventBus';
import type { PrintFidelityCode } from '../../print/print-fidelity';

/**
 * Κωδικός απώλειας → i18n κλειδί. Exhaustive `Record` ⇒ αν προστεθεί νέος
 * `PrintFidelityCode` χωρίς μήνυμα, **δεν κάνει compile** (αντί να σιωπήσει στο runtime —
 * ακριβώς η ασθένεια που θεραπεύει αυτό το ADR).
 */
const FIDELITY_MESSAGE_KEY: Readonly<Record<PrintFidelityCode, string>> = {
  'hatch-image-solid': 'print.fidelity.hatchImageSolid',
  'hatch-lines-dropped': 'print.fidelity.hatchLinesDropped',
  'hatch-density-collapsed': 'print.fidelity.hatchDensityCollapsed',
  'image-dropped': 'print.fidelity.imageDropped',
};

/**
 * ADR-667 Φ1 — «το PDF βγήκε, αλλά δεν είναι αυτό που είδες». Warning (όχι error): το αρχείο
 * παράχθηκε και είναι χρήσιμο· απλώς ο χρήστης πρέπει να **ξέρει** τι έχασε και πώς να το
 * πάρει πιστό (raster έξοδος).
 */
export function registerPrintFidelityNotifications(t: TFunction): Array<() => void> {
  return [
    EventBus.on('dxf:print-fidelity-degraded', ({ notes }) => {
      if (notes.length === 0) return;
      const lines = notes.map((n) => t(FIDELITY_MESSAGE_KEY[n.code], { count: n.count }));
      toast.warning(t('print.fidelity.title'), {
        description: `${lines.join(' ')} ${t('print.fidelity.rasterHint')}`,
      });
    }),
  ];
}
