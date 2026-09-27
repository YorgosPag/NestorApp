/**
 * @fileoverview **ΤΙ ΒΛΕΠΕΙ Ο ΥΠΕΥΘΥΝΟΣ ΣΤΗΝ ΟΘΟΝΗ ΤΟΠΟΘΕΤΗΣΗΣ** — εισερχόμενα, σημεία ανά όροφο, βελάκια που λείπουν
 * (ADR-884 Φ2δ · §4.10). Καθαρό.
 * @related `viewer/tour-viewer-graph.ts` (`buildViewerGraph` · `neighboursOf` — ο **ίδιος** γράφος με τον θεατή, ώστε
 *   «Σημείο 2» να σημαίνει το ίδιο και στις δύο οθόνες) · `tour-capture-invariants.ts` (`selectEditorCaptures`) ·
 *   `tour-manifest-stop.ts` (ο ΕΝΑΣ ορισμός του «έτοιμη»)
 * @module lib/spatial-tour/tour-editor-model
 *
 * 🔑 **«Λείπει βελάκι» = ρωτά τον θεατή, δεν ξανακρίνει**: ένας γείτονας χωρίς διόπτευση (`neighboursOf` → `linkBearing`
 * → `null`) είναι ακριβώς αυτός που ο επισκέπτης θα έβρισκε **μόνο στη λίστα**. Με θέσεις κάτοψης η διόπτευση
 * παράγεται — τότε **δεν** λείπει τίποτα.
 * 🔑 **Το βελάκι της επιστροφής δεν μαντεύεται** (§4.10): χωρίς πυξίδα στη λήψη (`heading` = 0 όταν λείπει το XMP) το
 * «αντίθετο +π» θα έδειχνε λάθος τοίχο. Η οθόνη το δείχνει ως «λείπει» στο άλλο σημείο.
 */

import type { TourManifest } from '@/server/spatial-tour/tour-view-session';
import type { TourCapture } from '@/types/spatial-tour';

import { selectEditorCaptures } from './tour-capture-invariants';
import { isCaptureViewable, stopOfCapture, type TourManifestStop } from './tour-manifest-stop';
import { buildViewerGraph, neighboursOf, type TourViewerGraph } from './viewer/tour-viewer-graph';

/** Πού βρίσκεται μια ατοποθέτητη λήψη στον δρόμο προς τα πλακίδια. */
export type TourInboxReadiness = 'ready' | 'baking' | 'failed';

export interface TourInboxEntry {
  readonly capture: TourCapture;
  readonly readiness: TourInboxReadiness;
}

export interface TourEditorModel {
  /** Ο γράφος των σημείων που έχουν έτοιμη λήψη — **ίδια** κατασκευή και αρίθμηση με τον θεατή. */
  readonly graph: TourViewerGraph;
  /** Ατοποθέτητες λήψεις, νεότερη πρώτη. */
  readonly inbox: readonly TourInboxEntry[];
  /** Ανά σημείο: οι γείτονες προς τους οποίους **δεν** υπάρχει βελάκι. */
  readonly missingArrows: ReadonlyMap<string, readonly string[]>;
  /** Ανά σημείο: πόσες λήψεις κάθονται εκεί — η αφαίρεση της τελευταίας σβήνει το σημείο (επιβεβαίωση). */
  readonly capturesOnNode: ReadonlyMap<string, number>;
}

function readinessOf(capture: TourCapture): TourInboxReadiness {
  if (isCaptureViewable(capture)) return 'ready';
  return capture.tileset.state === 'failed' ? 'failed' : 'baking';
}

/**
 * **Νεότερη λήψη πρώτη** — η ΜΙΑ σειρά των εισερχομένων (πάνελ **και** οθόνη τοποθέτησης). Ισοπαλία ⇒ id, ώστε η λίστα
 * να μη «χορεύει» ανάμεσα σε δύο φορτώσεις.
 */
export function newestCaptureFirst(a: Pick<TourCapture, 'id' | 'capturedAt'>, b: Pick<TourCapture, 'id' | 'capturedAt'>): number {
  return Date.parse(b.capturedAt) - Date.parse(a.capturedAt) || b.id.localeCompare(a.id);
}

function inboxOf(captures: readonly TourCapture[]): TourInboxEntry[] {
  return captures
    .filter((capture) => capture.nodeId === null)
    .sort(newestCaptureFirst)
    .map((capture) => ({ capture, readiness: readinessOf(capture) }));
}

function editorStops(captures: readonly TourCapture[]): TourManifestStop[] {
  return selectEditorCaptures(captures).flatMap((capture) => {
    const stop = capture.nodeId === null ? null : stopOfCapture(capture, capture.nodeId);
    return stop === null ? [] : [stop];
  });
}

function countOnNode(captures: readonly TourCapture[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const { nodeId } of captures) if (nodeId !== null) out.set(nodeId, (out.get(nodeId) ?? 0) + 1);
  return out;
}

function missingArrowsOf(graph: TourViewerGraph): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const nodeId of graph.stops.keys()) {
    const missing = neighboursOf(graph, nodeId).filter((n) => n.bearing === null).map((n) => n.nodeId);
    if (missing.length > 0) out.set(nodeId, missing);
  }
  return out;
}

/** **Το μοντέλο της οθόνης** — από τον γράφο της συνεδρίας του υπευθύνου και όλες τις λήψεις (`GET …/captures`). */
export function buildTourEditorModel(
  manifest: Pick<TourManifest, 'nodes' | 'levels'>,
  captures: readonly TourCapture[],
): TourEditorModel {
  const graph = buildViewerGraph({ nodes: manifest.nodes, stops: editorStops(captures) }, manifest.levels);
  return { graph, inbox: inboxOf(captures), missingArrows: missingArrowsOf(graph), capturesOnNode: countOnNode(captures) };
}

/**
 * Ο γράφος **προεπισκόπησης** μιας ατοποθέτητης λήψης — ένα σημείο χωρίς όροφο και χωρίς συνδέσμους, ώστε η **ίδια**
 * σκηνή του θεατή να τη δείξει πριν αποφασιστεί πού πάει. `null` ⇒ δεν έχει ακόμη πλακίδια.
 */
export function previewGraphOf(capture: TourCapture): { readonly graph: TourViewerGraph; readonly nodeId: string } | null {
  const nodeId = `preview:${capture.id}`;
  const stop = stopOfCapture(capture, nodeId);
  if (stop === null) return null;
  const node = { id: nodeId, levelKey: { kind: 'local', ordinal: 0 }, position: null, links: [] } as const;
  return { graph: buildViewerGraph({ nodes: [node], stops: [stop] }, []), nodeId };
}
