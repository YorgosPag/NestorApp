/**
 * @fileoverview **Ένα id που χωρά σε αναφορά `url(#…)` του SVG** — μοτίβα, διαβαθμίσεις, μάσκες (ADR-920 Β4.8).
 * @related components/listing-detail/media/FloorPlateUnitLayer · components/listing-detail/terrain/TerrainMapSvg
 * @module hooks/media/useSvgFragmentId
 *
 * 🔑 Το `useId` της React δίνει σταθερό id σε server **και** client (μηδέν απόκλιση hydration), αλλά η **μορφή** του αλλάζει
 *   ανά έκδοση (18 `:r0:` · 19.1 `«r0»` · 19.2 `_r_0_`), και οι `:` / `«»` **δεν** ανήκουν σε fragment `url(#…)` — ένα τέτοιο id
 *   σπάει σιωπηλά το γέμισμα. Εδώ καθαρίζεται **μία** φορά, για κάθε μορφή, αντί για αντίγραφο σε κάθε σχέδιο. Το πρόθεμα
 *   ξεχωρίζει τα σχέδια στον ίδιο κόμβο DOM και εγγυάται ότι το id ξεκινά με γράμμα.
 */
import { useId } from 'react';

/** `prefix` = λατινικά γράμματα (π.χ. `fp`, `terrain`)· το αποτέλεσμα είναι έγκυρο fragment, μοναδικό ανά στιγμιότυπο. */
export function useSvgFragmentId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/gu, '')}`;
}
