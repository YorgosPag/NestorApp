/**
 * Shared ribbon linetype options (SSoT).
 *
 * Μία και μοναδική πηγή για τη λίστα «Τύπος Γραμμής» σε ΟΛΑ τα contextual tabs
 * (line tool + dimensions + …): ByLayer + registry (ISO + runtime custom), όπου
 * κάθε επιλογή φέρει το inline-SVG preview descriptor (`thumbnail`) — ίδιο SSoT
 * με τον renderer (`buildLinetypeThumbnail`). Πριν, το mapping ήταν διπλό
 * (dim bridge inline + line bridge χωρίς thumbnail) → ενοποιήθηκε εδώ (N.0.2).
 *
 * Δυναμικό (function, όχι const): οι επιλογές διαβάζονται από το live
 * `LinetypeRegistry` — οι καταναλωτές το τυλίγουν σε `useMemo` keyed στο registry.
 *
 * @see components/buttons/RibbonComboboxThumbnail — ζωγραφίζει το `thumbnail`
 * @see rendering/linetype-thumbnail — γεωμετρία preview (ίδιο SSoT με τον renderer)
 * @see stores/LinetypeRegistry — `listSelectableLinetypeNames` (ByLayer + ISO + custom)
 */

import type { RibbonComboboxOption } from '../types/ribbon-types';
import { listSelectableLinetypeNames } from '../../../stores/LinetypeRegistry';

/**
 * ByLayer + οι εγγεγραμμένοι τύποι γραμμής, ο καθένας με το preview thumbnail του.
 * `isLiteralLabel: true` — το όνομα («ByLayer», «DASHED», …) δεν περνά από i18n.
 */
export function buildLinetypeRibbonOptions(): readonly RibbonComboboxOption[] {
  return listSelectableLinetypeNames().map((name) => ({
    value: name,
    labelKey: name,
    isLiteralLabel: true as const,
    thumbnail: { kind: 'linetype' as const, name },
  }));
}
