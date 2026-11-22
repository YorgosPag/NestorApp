'use client';

/**
 * @fileoverview **ΠΟΥ ΚΥΛΑ ΤΟ ΝΕΡΟ** — η σταγόνα του καρφιτσωμένου σημείου σε κείμενο: πόσο, προς τα πού, πόσο κατεβαίνει, πού
 *   καταλήγει (ADR-920 §14.10 Ε3 · §5 «Βέλη απορροής νερού»).
 * @related `@/lib/terrain/inspect/terrain-flow-path` (η διαδρομή) · ./TerrainInspectCard (ο γονέας) · ./TerrainInspectLayer ·
 *   ./3d/terrain-3d-inspect-overlay (η ίδια διαδρομή στον χάρτη και στο 3Δ)
 * @module components/listing-detail/terrain/TerrainFlowSummary
 *
 * 🔑 **Κανένα εργαλείο αγγελίας δεν το κάνει**: ο αγοραστής βλέπει πού θα πάει το νερό της βροχής από το σημείο που θα
 *   έχτιζε — και διαβάζει με λέξεις αυτό που η γραμμή δείχνει (ποτέ μόνο χρώμα). Πάντα με την ένδειξη «ενδεικτικό» (Α3).
 */

import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { orientationOfAzimuth } from '@/lib/geometry/azimuth-orientation';
import type { FlowPath } from '@/lib/terrain/inspect/terrain-flow-path';

import { distanceLabel, elevationLabel } from './terrain-inspect-words';

type T = ReturnType<typeof useTranslation>['t'];

const NS = 'listing-detail:terrain.map.flow';
const TOWARDS = 'listing-detail:terrain.stats.towards';
/** Κάτω από αυτό το μήκος η σταγόνα «δεν κουνήθηκε» — δεν λέμε «κυλά 0,0 m». */
const STILL_M = 0.05;

function movementOf(t: T, flow: FlowPath): string {
  const direction = orientationOfAzimuth(flow.overallAzimuthDeg);
  if (flow.lengthM < STILL_M || direction === null) return t(`${NS}.stays`);
  return t(`${NS}.result`, {
    length: distanceLabel(t, flow.lengthM),
    direction: t(`${TOWARDS}.${direction}`),
    drop: elevationLabel(t, flow.dropM),
  });
}

export function TerrainFlowSummary({ flow, t }: { readonly flow: FlowPath; readonly t: T }) {
  return (
    <section className="flex flex-col gap-1 border-t border-border pt-2" data-terrain-flow-summary="" data-end={flow.end}>
      <h3 className="m-0 text-xs font-medium text-foreground">{t(`${NS}.drop`)}</h3>
      <p className="m-0 text-foreground">{movementOf(t, flow)} {t(`${NS}.end.${flow.end}`)}</p>
      <p className="m-0 text-muted-foreground">{t(`${NS}.indicative`)}</p>
    </section>
  );
}
