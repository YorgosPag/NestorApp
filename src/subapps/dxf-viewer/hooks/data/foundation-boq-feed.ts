/**
 * ADR-441 Slice 4 — foundation strip-grid NET BOQ feed.
 *
 * Bridges το pure SSoT `foundationStripNetGeometry` (bim/geometry) με το schedule:
 * παίρνει το ετερογενές `AnyBimEntity[]` και αντικαθιστά τη γεωμετρία **κάθε grid
 * strip** (πεδιλοδοκός γεννημένος από κάναβο — `hasGuideBindings`) με το NET μερίδιό
 * της (gross − ½ επικαλύψεων κόμβων). Έτσι το άθροισμα της στήλης όγκου στο schedule
 * δίνει τον καθαρό όγκο της εσχάρας, χωρίς διπλομέτρηση κόμβων (Revit/Tekla way).
 *
 * Standalone πεδιλοδοκοί/pad/tie-beam (χωρίς bindings) μένουν ως έχουν (gross —
 * χρεώνονται μεμονωμένα). Mirror φιλοσοφίας `slab-boq-feed` / `wall-boq-feed`.
 *
 * @see bim/geometry/foundation-grid-boq.ts — pure net math
 * @see ui/components/bim-schedule/BimScheduleDialog.tsx — call-site (pre-pass)
 */

import type { AnyBimEntity } from '../../bim/schedule/schedule-presets';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import { hasGuideBindings } from '../../bim/hosting/guide-binding-types';
import { foundationStripNetGeometry } from '../../bim/geometry/foundation-grid-boq';

/** Type-guard: hosted grid strip (πεδιλοδοκός από κάναβο). */
function isGridStrip(entity: AnyBimEntity): entity is FoundationEntity {
  return entity.type === 'foundation' && entity.kind === 'strip' && hasGuideBindings(entity);
}

/**
 * Επιστρέφει copy του `entities` όπου κάθε grid strip έχει NET γεωμετρία. Pure —
 * δεν mutate-άρει input. < 2 grid strips → καμία επικάλυψη δυνατή → passthrough.
 */
export function applyFoundationGridNet(entities: readonly AnyBimEntity[]): AnyBimEntity[] {
  const gridStrips = entities.filter(isGridStrip);
  if (gridStrips.length < 2) return [...entities];
  return entities.map((e) =>
    isGridStrip(e) ? { ...e, geometry: foundationStripNetGeometry(e, gridStrips) } : e,
  );
}
