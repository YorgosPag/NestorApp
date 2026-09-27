/**
 * @fileoverview **ΤΙ ΜΠΟΡΕΙ ΝΑ ΔΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ, ΚΑΙ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΠΑΕΙ** — ο γράφος του θεατή από το μανιφέστο
 * (ADR-884 Φ1 · §4.8). Καθαρό.
 * @related `server/spatial-tour/tour-viewer-stops.ts` (ο ΕΝΑΣ κριτής των στάσεων — εδώ **δεν** ξανακρίνεται τίποτα) ·
 *   `lib/spatial-tour/spatial-tour-graph.ts` (`levelKeyId`, αναλλοίωτα του γράφου) · `tour-viewer-bearing.ts`
 * @module lib/spatial-tour/viewer/tour-viewer-graph
 *
 * 🔑 **Κόμβος χωρίς στάση = αόρατος**: ο σύνδεσμος προς κόμβο που δεν έχει έτοιμη λήψη **δεν** γίνεται κουμπί — αλλιώς
 * ο επισκέπτης θα πατούσε «πήγαινε εκεί» και θα έβρισκε μαύρο (το ίδιο ψέμα που το `tour-viewer-stops` έκλεισε στην αγγελία).
 * 🔑 **Πλοήγηση προς τις δύο κατευθύνσεις**: ένας σύνδεσμος Α→Β επιτρέπει και το Β→Α (οι μεγάλοι δεν έχουν μονόδρομους
 * διαδρόμους)· τα διπλότυπα ενώνονται.
 * 🔑 **Όροφος χωρίς κάτοψη** (`position: null`, ADR-884 Δ5 `none`): `hasPlan: false`· η διόπτευση είναι το βελάκι που
 * έβαλε ο άνθρωπος στη φωτογραφία (`TourLink.bearingRad`, Φ2β), αλλιώς `null` ⇒ μόνο στη λίστα — ποτέ επινοημένη θέση.
 * Το βελάκι του Α→Β **δεν** αντιστρέφεται για το Β→Α: χωρίς θέσεις, η αντίθετη κατεύθυνση δεν είναι γνωστή.
 */

import type { TourManifest } from '@/server/spatial-tour/tour-view-session';
import type { TourManifestStop } from '@/lib/spatial-tour/tour-manifest-stop';
import type { TourLevel, TourLevelKey, TourNode, TourPoint } from '@/types/spatial-tour';

import { levelKeyId } from '../spatial-tour-graph';
import { bearingBetween } from './tour-viewer-bearing';

/** Ό,τι ξέρει ο θεατής για έναν όροφο — ταξιδεύει στο μανιφέστο (ADR-884 Φ2γ, `viewerLevelsOf`). */
export interface TourViewerLevel {
  readonly key: TourLevelKey;
  /** Ετικέτα για άνθρωπο — `null` ⇒ ο θεατής δείχνει τον αριθμό του ορόφου. */
  readonly label: string | null;
  /** Σειρά από κάτω προς τα πάνω. */
  readonly ordinal: number;
}

/**
 * **Οι όροφοι της περιήγησης όπως τους χρειάζεται ο θεατής.** Τοπικός όροφος ⇒ η σειρά του είναι ο αριθμός του· όροφος
 * BIM ⇒ η σειρά δήλωσης (το υψόμετρο του ορόφου ζει στο BIM — Φ3). Ετικέτα `null` ⇒ ο θεατής λέει «Όροφος {n}»: το όνομα
 * ενός ορόφου BIM θα έρθει με τη σύνδεση στο μοντέλο, όχι επινοημένο εδώ.
 */
export function viewerLevelsOf(levels: readonly TourLevel[]): TourViewerLevel[] {
  return levels.map((level, index) => ({ key: level.key, label: null, ordinal: level.key.kind === 'local' ? level.key.ordinal : index }));
}

export interface ViewerStop {
  readonly stop: TourManifestStop;
  readonly node: TourNode;
  readonly levelId: string;
  /** 1, 2, 3… μέσα στον όροφο — το «Σημείο N» όταν ο χώρος δεν δηλώθηκε (`TourNode.room`, Φ2στ · `useStopNames`). */
  readonly number: number;
}

export interface ViewerLevelEntry {
  readonly id: string;
  readonly label: string | null;
  readonly ordinal: number;
  readonly nodeIds: readonly string[];
  readonly hasPlan: boolean;
}

export interface TourViewerGraph {
  /** Ανά `nodeId` — μία στάση ανά κόμβο από κατασκευής (η πιο πρόσφατη λήψη, `selectViewerCaptures`). */
  readonly stops: ReadonlyMap<string, ViewerStop>;
  /** Μόνο όροφοι με τουλάχιστον μία στάση, από κάτω προς τα πάνω. */
  readonly levels: readonly ViewerLevelEntry[];
  readonly adjacency: ReadonlyMap<string, readonly string[]>;
}

export interface ViewerNeighbour {
  readonly nodeId: string;
  readonly number: number;
  /** Ο όροφος του γείτονα — η σκάλα οδηγεί σε **άλλον** όροφο και η ετικέτα πρέπει να το λέει. */
  readonly levelId: string;
  /** `null` όταν κάποιο άκρο δεν έχει θέση ή συμπίπτουν — ο σύνδεσμος δεν έχει κατεύθυνση να δειχθεί. */
  readonly bearing: number | null;
}

function levelEntries(
  stops: ReadonlyMap<string, ViewerStop>,
  levels: readonly TourViewerLevel[],
): ViewerLevelEntry[] {
  const declared = new Map(levels.map((level) => [levelKeyId(level.key), level]));
  const grouped = new Map<string, ViewerStop[]>();
  for (const entry of stops.values()) grouped.set(entry.levelId, [...(grouped.get(entry.levelId) ?? []), entry]);
  return [...grouped.entries()]
    .map(([id, entries]) => {
      const level = declared.get(id);
      const ordinal = level?.ordinal ?? (entries[0].node.levelKey.kind === 'local' ? entries[0].node.levelKey.ordinal : 0);
      return {
        id,
        label: level?.label ?? null,
        ordinal,
        nodeIds: entries.map((entry) => entry.node.id),
        hasPlan: entries.every((entry) => entry.node.position !== null),
      };
    })
    .sort((a, b) => a.ordinal - b.ordinal || a.id.localeCompare(b.id));
}

function adjacencyOf(stops: ReadonlyMap<string, ViewerStop>): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => out.set(a, (out.get(a) ?? new Set()).add(b));
  for (const { node } of stops.values()) {
    for (const link of node.links) {
      if (link.toNodeId === node.id || !stops.has(link.toNodeId)) continue;
      connect(node.id, link.toNodeId);
      connect(link.toNodeId, node.id);
    }
  }
  return new Map([...out.entries()].map(([id, set]) => [id, [...set]]));
}

/**
 * Ο γράφος του θεατή — ένα πέρασμα, ντετερμινιστικός. 🔑 **Η αρίθμηση ακολουθεί τη σειρά των ΚΟΜΒΩΝ, όχι των στάσεων**
 * (§4.10): οι στάσεις έρχονται με τη σειρά του ερωτήματος της βάσης — η οθόνη τοποθέτησης και ο θεατής θα έλεγαν
 * «Σημείο 2» για διαφορετικό σημείο.
 */
export function buildViewerGraph(
  manifest: Pick<TourManifest, 'nodes' | 'stops'>,
  levels: readonly TourViewerLevel[],
): TourViewerGraph {
  const stopOfNode = new Map<string, TourManifestStop>();
  for (const stop of manifest.stops) if (!stopOfNode.has(stop.nodeId)) stopOfNode.set(stop.nodeId, stop);
  const counters = new Map<string, number>();
  const stops = new Map<string, ViewerStop>();
  for (const node of manifest.nodes) {
    const stop = stopOfNode.get(node.id);
    if (stop === undefined) continue;
    const levelId = levelKeyId(node.levelKey);
    const number = (counters.get(levelId) ?? 0) + 1;
    counters.set(levelId, number);
    stops.set(node.id, { stop, node, levelId, number });
  }
  return { stops, levels: levelEntries(stops, levels), adjacency: adjacencyOf(stops) };
}

/** Οι γείτονες ενός κόμβου που **έχουν** στάση, με τη διόπτευση προς αυτούς. */
export function neighboursOf(graph: TourViewerGraph, nodeId: string): ViewerNeighbour[] {
  const from = graph.stops.get(nodeId);
  if (from === undefined) return [];
  return (graph.adjacency.get(nodeId) ?? []).flatMap((toId) => {
    const to = graph.stops.get(toId);
    if (to === undefined) return [];
    return [{ nodeId: toId, number: to.number, levelId: to.levelId, bearing: linkBearing(from, to) }];
  });
}

function pointsBearing(from: TourPoint | null, to: TourPoint | null): number | null {
  return from === null || to === null ? null : bearingBetween(from, to);
}

/** Το βελάκι που έβαλε ο άνθρωπος **σε αυτόν** τον κόμβο προς τον στόχο (Φ2β) — ποτέ το αντίστροφο του άλλου άκρου. */
function placedBearing(from: TourNode, toId: string): number | null {
  return from.links.find((link) => link.toNodeId === toId)?.bearingRad ?? null;
}

/**
 * **Η διόπτευση από στάση σε στάση** — από τις θέσεις στην κάτοψη, αλλιώς το βελάκι του ανθρώπου, αλλιώς `null`. Η ΜΙΑ
 * απάντηση: τη ρωτούν τα κουμπιά (`neighboursOf`) **και** η στροφή της μετάβασης (`useTourNavigation`).
 */
export function linkBearing(from: ViewerStop, to: ViewerStop): number | null {
  return pointsBearing(from.node.position, to.node.position) ?? placedBearing(from.node, to.node.id);
}

/** Η πρώτη στάση ενός ορόφου — εκεί προσγειώνεται η αλλαγή ορόφου (πρότυπο Matterport). */
export function firstNodeOfLevel(graph: TourViewerGraph, levelId: string): string | null {
  return graph.levels.find((level) => level.id === levelId)?.nodeIds[0] ?? null;
}

/** Η αρχική στάση — ο χαμηλότερος όροφος, το πρώτο του σημείο. */
export function initialNode(graph: TourViewerGraph): string | null {
  return graph.levels[0]?.nodeIds[0] ?? null;
}
