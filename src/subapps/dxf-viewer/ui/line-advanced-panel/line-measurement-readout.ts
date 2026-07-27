/**
 * line-measurement-readout — ADR-649 §measure-facts: οι δύο READ-ONLY μετρήσεις
 * («Περίμετρος» / «Εμβαδόν») της επιλεγμένης οντότητας στο ΑΡΙΣΤΕΡΟ Properties palette.
 *
 * Καθρέφτης του `hatch-bridge-read.ts:51` (`formatAreaForDisplay(computeHatchAreaMm2(hatch))`
 * πίσω από το `readout` control της γραμμοσκίασης) — ίδιο μοτίβο, ίδιος formatter, μηδέν
 * νέος υπολογισμός: ο **ένας** dispatcher `entityMeasurementFacts` δίνει τους αριθμούς σε
 * canonical mm και το `formatLengthForDisplay` / `formatAreaForDisplay` τους μετατρέπει
 * **μία φορά, στην άκρη του UI** (ADR-462).
 *
 * ⚠️ ΓΙΑΤΙ ΔΕΝ ΖΕΙ ΜΕΣΑ ΣΤΟ `useRibbonLineToolBridge` (δύο λόγοι, και οι δύο πραγματικοί):
 *
 *  1. **Διαφορετική σκηνή.** Το bridge λύνει την επιλογή με `levelManager.getLevelScene()`
 *     — την **ωμή** `SceneModel`, όπου ένα DXF INSERT ζει ως `BlockEntity` container. Το
 *     `LinePropertiesTab` λύνει την ΙΔΙΑ επιλογή πάνω στη σκηνή που **δείχνει**. Οι δύο
 *     διαφωνούν όποτε παίζουν containers, και οι μετρήσεις πρέπει να περιγράφουν αυτό που
 *     ο χρήστης ΒΛΕΠΕΙ επιλεγμένο — άρα διαβάζουμε την οντότητα του tab, όχι του bridge.
 *  2. **Μέγεθος αρχείου (N.7.1).** Το `useRibbonLineToolBridge.ts` είναι ήδη 486 γραμμές·
 *     νέος κλάδος εκεί θα το έσπρωχνε στο όριο των 500.
 *
 * Το tab αλυσιδώνει: `lineMeasurementReadout(key, entity) ?? bridge.getComboboxState(key)`.
 * Επειδή αυτό απαντά ΠΡΩΤΟ για τα δύο readout keys, το bridge δεν τα βλέπει ποτέ (και
 * επιπλέον τα early-return-άρει, μοτίβο `newLineType`) — καμία διαρροή στο color fallthrough.
 *
 * Pure — zero React/DOM. Jest-friendly.
 *
 * @see ../../systems/measure/entity-measurement-facts.ts — ο ΕΝΑΣ dispatcher «τι μετριέται»
 * @see ../ribbon/hooks/bridge/hatch-bridge-read.ts — το πρότυπο readout της γραμμοσκίασης
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

import type { Entity } from '../../types/entities';
import type { RibbonComboboxState } from '../ribbon/types/ribbon-types';
import {
  LINE_TOOL_RIBBON_KEYS,
  LINE_TOOL_PANEL_VISIBILITY_KEYS,
} from '../ribbon/hooks/bridge/line-tool-command-keys';
import { entityMeasurementFacts } from '../../systems/measure/entity-measurement-facts';
import {
  formatLengthForDisplay,
  formatAreaForDisplay,
} from '../../config/display-length-format';

/** Ό,τι δείχνει ένα readout όταν δεν υπάρχει αριθμός — ίδιο em-dash με τη γραμμοσκίαση. */
const NO_VALUE = '—';

/**
 * Η τιμή ενός readout key, ή `null` όταν το key **δεν** είναι δικό μας (ο καλών πέφτει
 * στο bridge). `'—'` σημαίνει «δικό μας key, αλλά αυτή η οντότητα δεν δίνει αριθμό» —
 * π.χ. η περίμετρος γραμμοσκίασης, που είναι σκόπιμα `null` στο `entityMeasurementFacts`.
 *
 * ΑΝΟΙΧΤΗ ΠΟΛΥΓΡΑΜΜΗ (κανόνας AutoCAD, απόφαση Giorgio 2026-07-27): το εμβαδόν
 * υπολογίζεται **σαν να έκλεινε** ενώ η περίμετρος **αγνοεί** το τμήμα κλεισίματος. Δεν
 * διακλαδίζεται εδώ — το `computePolygonAreaMetrics(vertices, closed)` το κάνει ήδη.
 */
export function lineMeasurementReadout(
  commandKey: string,
  entity: Entity | null,
): RibbonComboboxState | null {
  const isPerimeter = commandKey === LINE_TOOL_RIBBON_KEYS.readoutPerimeter;
  const isArea = commandKey === LINE_TOOL_RIBBON_KEYS.readoutArea;
  if (!isPerimeter && !isArea) return null;

  const facts = entity ? entityMeasurementFacts(entity) : null;
  if (!facts) return { value: NO_VALUE, options: [] };

  if (isPerimeter) {
    return {
      value: facts.perimeterMm === null ? NO_VALUE : formatLengthForDisplay(facts.perimeterMm),
      options: [],
    };
  }
  return { value: formatAreaForDisplay(facts.plan2DMm2), options: [] };
}

/**
 * Ορατότητα της ομάδας «Μετρήσεις», ή `null` όταν το key δεν είναι δικό μας.
 * Ορατή **μόνο** όταν η οντότητα όντως μετριέται — μια απλή γραμμή δεν τη δείχνει
 * (το μήκος της ζει ήδη στη «Γεωμετρία»· δύο θέσεις για τον ίδιο αριθμό = διπλότυπο UI).
 */
export function lineMeasurementVisibility(
  visibilityKey: string,
  entity: Entity | null,
): boolean | null {
  if (visibilityKey !== LINE_TOOL_PANEL_VISIBILITY_KEYS.measurable) return null;
  return entity ? entityMeasurementFacts(entity) !== null : false;
}
