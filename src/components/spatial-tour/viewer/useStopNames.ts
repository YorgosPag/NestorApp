'use client';

/**
 * @fileoverview **ΤΑ ΟΝΟΜΑΤΑ ΤΩΝ ΣΗΜΕΙΩΝ** — «Γραφείο», «Υπνοδωμάτιο 2», αλλιώς «Σημείο 3», στη γλώσσα του επισκέπτη
 * (ADR-884 Φ2στ · §4.12). Η ΜΙΑ μετάφραση πάνω στο ΕΝΑ καθαρό SSoT (`tourRoomDisplay`).
 * @related `lib/spatial-tour/tour-room.ts` (τι λέγεται — καθαρό) · `tour-viewer-labels.ts` (`TOUR_ROOM_TYPE_KEY`) ·
 *   καταναλωτές: βελάκια + επικεφαλίδα + στήλη (θεατής) · λίστες + φόρμες (επεξεργαστής)
 * @module components/spatial-tour/viewer/useStopNames
 *
 * 🔑 **Ενιαίος χώρος** («Κουζίνα / Καθιστικό») ενώνεται με ` / ` — σημείο στίξης, όχι λέξη προς μετάφραση.
 */

import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { tourRoomDisplay, type TourRoomDisplay } from '@/lib/spatial-tour/tour-room';
import type { TourViewerGraph } from '@/lib/spatial-tour/viewer/tour-viewer-graph';
import type { TourNode } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_ROOM_NUMBERED_KEY, TOUR_ROOM_TYPE_KEY, TOUR_VIEWER_KEYS } from './tour-viewer-labels';

const TYPE_JOINER = ' / ';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Μία εμφάνιση → κείμενο. Εξάγεται για τον επεξεργαστή (προεπισκόπηση πριν την αποθήκευση). */
export function roomDisplayText(t: Translate, display: TourRoomDisplay): string {
  if (display.kind === 'label') return display.text;
  const name = display.types.map((type) => t(TOUR_ROOM_TYPE_KEY[type])).join(TYPE_JOINER);
  return display.ordinal === null ? name : t(TOUR_ROOM_NUMBERED_KEY, { name, ordinal: display.ordinal });
}

/** Τα σημεία κάθε ορόφου με τη σειρά τους — από εκεί η αρίθμηση όμοιων χώρων. */
function nodesByLevel(graph: TourViewerGraph): ReadonlyMap<string, readonly TourNode[]> {
  return new Map(graph.levels.map((level) => [
    level.id,
    level.nodeIds.flatMap((id) => {
      const node = graph.stops.get(id)?.node;
      return node === undefined ? [] : [node];
    }),
  ]));
}

/**
 * **Πώς λέγεται ένα σημείο ΕΚΤΟΣ γράφου** (ξαναψήνεται μετά από θόλωμα, ζ3) — ο χώρος του με την ίδια αρίθμηση όμοιων·
 * `null` όταν δεν έχει χώρο (ο καλών δείχνει την ημερομηνία της λήψης: «Σημείο N» δεν υπάρχει εκτός γράφου).
 */
export function useOffGraphPointName(): (node: TourNode | null, levelPeers: readonly TourNode[]) => string | null {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  return useCallback((node: TourNode | null, levelPeers: readonly TourNode[]) => {
    const display = node === null ? null : tourRoomDisplay(node, levelPeers);
    return display === null ? null : roomDisplayText(t, display);
  }, [t]);
}

/** **Πώς λέγεται το σημείο `nodeId`** — ο χώρος του, αλλιώς «Σημείο N»· κενό για άγνωστο σημείο. */
export function useStopNames(graph: TourViewerGraph): (nodeId: string) => string {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const levels = useMemo(() => nodesByLevel(graph), [graph]);
  return useCallback((nodeId: string) => {
    const stop = graph.stops.get(nodeId);
    if (stop === undefined) return '';
    const display = tourRoomDisplay(stop.node, levels.get(stop.levelId) ?? [stop.node]);
    return display === null ? t(TOUR_VIEWER_KEYS.point, { number: stop.number }) : roomDisplayText(t, display);
  }, [graph, levels, t]);
}
