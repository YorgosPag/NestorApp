/**
 * @fileoverview **Η ΕΠΙΛΟΓΗ ΤΟΥ ΑΝΘΡΩΠΟΥ** στη «Δημοσίευση κάτοψης»: ποιες ομάδες φαίνονται και με ποιο χρώμα — και τα **πρότυπα** που τη γεμίζουν με ένα κλικ (ADR-909 Β2.8).
 * @related ./public-floorplan-profile (ο πίνακας «πάντα / ποτέ / ομάδα») · `@/lib/listings/floorplan-render-recipe` (`PUBLIC_FLOORPLAN_GROUPS`)
 * @module subapps/dxf-viewer/print/public-floorplan/public-floorplan-presets
 *
 * Το σχήμα είναι των μεγάλων:
 *
 * | εδώ | Revit | ArchiCAD |
 * |---|---|---|
 * | πρότυπο | View Template | Layer / Model View Options Combination |
 * | ομάδα | κατηγορία στο Visibility/Graphics | στρώμα μέσα σε Layer Combination |
 * | ενότητα «κτίσμα» / «σχέδιο» | Model / Annotation Categories | — |
 * | χρώμα, **ανεξάρτητο** από το πρότυπο | Print Setup: Color · Black Lines · Grayscale | Pen Set |
 *
 * 🔑 **Το πρότυπο ΔΕΝ γράφεται στη συνταγή** — γράφονται οι ομάδες που προέκυψαν. Αν αύριο αλλάξει το
 * «Τεχνική», οι ήδη δημοσιευμένες κατόψεις εξακολουθούν να λένε **τι ακριβώς έδειχναν**.
 *
 * ⛔ **Καθαρό module** — κανένα store, κανένα React.
 */

import {
  PUBLIC_FLOORPLAN_GROUPS,
  canonicalFloorplanGroups,
  type PublicFloorplanGroup,
} from '@/lib/listings/floorplan-render-recipe';

import type { PrintPlotStyle } from '../../config/print-color-policy';

/**
 * Οι στάθμες χρώματος που προσφέρονται για **δημόσια** κάτοψη — τρεις από τις τέσσερις της εκτύπωσης.
 * Το `by-pen` είναι πίνακας πενών plotter: δεν έχει νόημα σε εικόνα αγγελίας.
 */
export const PUBLIC_FLOORPLAN_PLOT_STYLES = [
  'monochrome',
  'grayscale',
  'colour',
] as const satisfies readonly PrintPlotStyle[];

export type PublicFloorplanPlotStyle = (typeof PUBLIC_FLOORPLAN_PLOT_STYLES)[number];

/** Ό,τι διάλεξε ο άνθρωπος. Οι ομάδες είναι **πάντα** σε κανονική μορφή. */
export interface PublicFloorplanChoice {
  readonly groups: readonly PublicFloorplanGroup[];
  readonly plotStyle: PublicFloorplanPlotStyle;
}

/** «Κτίσμα και εξοπλισμός» (μοντέλο BIM) ή «Σχέδιο» (σκέτο DXF και σχολιασμός). */
export type PublicFloorplanSection = 'model' | 'drawing';

export const PUBLIC_FLOORPLAN_SECTIONS: readonly PublicFloorplanSection[] = ['model', 'drawing'];

/** `Record` πάνω στις ομάδες: νέα ομάδα χωρίς ενότητα **δεν μεταγλωττίζεται**. */
export const PUBLIC_FLOORPLAN_GROUP_SECTION: Readonly<Record<PublicFloorplanGroup, PublicFloorplanSection>> = {
  furniture: 'model',
  electrical: 'model',
  heating: 'model',
  plumbing: 'model',
  texts: 'drawing',
  hatches: 'drawing',
  orientation: 'drawing',
};

export function publicFloorplanGroupsOf(section: PublicFloorplanSection): readonly PublicFloorplanGroup[] {
  return PUBLIC_FLOORPLAN_GROUPS.filter((group) => PUBLIC_FLOORPLAN_GROUP_SECTION[group] === section);
}

export const PUBLIC_FLOORPLAN_PRESET_IDS = ['listing', 'furnished', 'technical'] as const;

export type PublicFloorplanPresetId = (typeof PUBLIC_FLOORPLAN_PRESET_IDS)[number];

/** Ό,τι έδειχνε η έκδοση 1 χωρίς επίπλωση: κείμενα, γραμμοσκιάσεις, Βορράς και κλίμακα. */
const LISTING_GROUPS: readonly PublicFloorplanGroup[] = ['texts', 'hatches', 'orientation'];

/** Τα πρότυπα ορίζουν **μόνο** ομάδες· το χρώμα είναι δικός του άξονας. */
export const PUBLIC_FLOORPLAN_PRESETS: Readonly<Record<PublicFloorplanPresetId, readonly PublicFloorplanGroup[]>> = {
  listing: canonicalFloorplanGroups(LISTING_GROUPS),
  furnished: canonicalFloorplanGroups(['furniture', ...LISTING_GROUPS]),
  technical: PUBLIC_FLOORPLAN_GROUPS,
};

/** Με αυτό ανοίγει ο διάλογος: το πρότυπο «Αγγελία», μαύρο σε λευκό. */
export const DEFAULT_PUBLIC_FLOORPLAN_CHOICE: PublicFloorplanChoice = {
  groups: PUBLIC_FLOORPLAN_PRESETS.listing,
  plotStyle: 'monochrome',
};

/** Ποιο πρότυπο **είναι** αυτές οι ομάδες — `null` όταν ο άνθρωπος τις έχει προσαρμόσει. */
export function publicFloorplanPresetOf(groups: readonly PublicFloorplanGroup[]): PublicFloorplanPresetId | null {
  const key = canonicalFloorplanGroups(groups).join();
  return PUBLIC_FLOORPLAN_PRESET_IDS.find((id) => PUBLIC_FLOORPLAN_PRESETS[id].join() === key) ?? null;
}

export function withFloorplanGroup(
  choice: PublicFloorplanChoice,
  group: PublicFloorplanGroup,
  shown: boolean,
): PublicFloorplanChoice {
  const groups = new Set(choice.groups);
  if (shown) groups.add(group);
  else groups.delete(group);
  return { ...choice, groups: canonicalFloorplanGroups(groups) };
}

/** Ταυτότητα της επιλογής ως κείμενο — ίδια επιλογή ⇒ ίδιο κλειδί ⇒ **όχι** νέα εικόνα. */
export function publicFloorplanChoiceKey(choice: PublicFloorplanChoice): string {
  return `${choice.plotStyle}|${canonicalFloorplanGroups(choice.groups).join()}`;
}
