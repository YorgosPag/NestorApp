/**
 * ADR-401/449 — ο host resolver κολώνας για ΕΝΑ scene sync (N.0.2 boy-scout SSoT).
 *
 * Το «χτίσε host inputs από δοκάρια+πλάκες **μόνο** αν υπάρχει έστω μία attached κολώνα»
 * ζούσε **αυτολεξεί δύο φορές**: στο `bim-scene-attach-syncs.syncColumns` (πυρήνας) και στο
 * `bim-scene-structural-finish-sync.buildColumnVerticalExtents` (σοβάς). Το δεύτερο μάλιστα
 * **το δήλωνε στο doc του** («με ακριβώς το ίδιο context που χρησιμοποιεί ο πυρήνας») — ένα
 * σχόλιο που περιγράφει διπλότυπο αντί να το αποτρέπει.
 *
 * Δεν είναι κοσμητικό: αν οι δύο αποκλίνουν, ο σοβάς λύνει διαφορετικό ύψος από τον πυρήνα
 * που ντύνει — ακριβώς η κατηγορία σφάλματος που το ADR-449 height-SSoT υπάρχει για να κλείσει.
 *
 * Το `undefined` (καμία attached κολώνα) είναι **σημαντικό**, όχι απλή βελτιστοποίηση: οι
 * resolvers προφίλ το ελέγχουν για να πέσουν στο flat fast-path.
 *
 * @see ../../bim/geometry/column-vertical-profile — makeColumnHostResolver
 */

import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { makeColumnHostResolver } from '../../bim/geometry/column-vertical-profile';
import { buildWallHostInputs } from '../../bim/geometry/wall-host-plan-builder';

/** Ο resolver hosts (δοκάρια+πλάκες) όταν υπάρχει attached κολώνα, αλλιώς `undefined`. */
export function resolveColumnHostInput(
  entities: Bim3DEntities,
): ReturnType<typeof makeColumnHostResolver> | undefined {
  const hasAttached = entities.columns.some(
    (c) => c.params?.topBinding === 'attached' || c.params?.baseBinding === 'attached',
  );
  return hasAttached
    ? makeColumnHostResolver(buildWallHostInputs(entities.beams, entities.slabs))
    : undefined;
}
