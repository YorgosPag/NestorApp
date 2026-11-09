/**
 * ADR-929 §6.11 — **Αποφάσεις που επιβιώνουν σε αναπαραγωγή** (το persistent-naming πρόβλημα των CAD, στη μορφή του
 * βοηθού «Μοντέλο από το σχέδιο»).
 *
 * Ο άνθρωπος αποφασίζει ότι ένα αμφίσημο ορθογώνιο (Δ7) ΕΙΝΑΙ τοίχος. Η πηγή γραμμών όμως ξαναγεννιέται (crop/απόκρυψη,
 * νέα έκδοση σύντηξης, βαθμονόμηση) και το ορθογώνιο γεννιέται ξανά μετατοπισμένο κατά λίγα mm — ένα κλειδί-συμβολοσειρά
 * σε ακέραια mm θα άλλαζε και η απόφαση θα χανόταν σιωπηλά.
 *
 * 🔑 **Ταυτότητα = άγκυρα, όχι όνομα.** Η απόφαση κρατά το ίδιο το πολύγωνο, στο **πλαίσιο της πηγής** (`AnchorFrame`):
 *   σκηνή ⇒ συντεταγμένες σκηνής· εικόνα ⇒ pixel της αρχικής εικόνας, όπου η βαθμονόμηση και το crop δεν αλλάζουν τίποτα.
 * 🔑 **Ξαναβρίσκεται με αντιστοίχιση** ένα-προς-ένα, άπληστα κατά φθίνον IoU (η πρακτική της παρακολούθησης αντικειμένων),
 *   με ντετερμινιστική ισοπαλία (σειρά άγκυρας, μετά σειρά ορθογωνίου). Το IoU είναι ανθεκτικό εδώ: τα αμφίσημα είναι εξ
 *   ορισμού «κοντόχοντρα» (λόγος < `AMBIGUOUS_ASPECT_RATIO`), όχι λεπτές λωρίδες όπου 1 pixel θα έριχνε την επικάλυψη.
 * 🔑 **Καμία σιωπηλή απώλεια.** Άγκυρα χωρίς ζευγάρι γίνεται **ορφανή**: μένει αποθηκευμένη (μια αναίρεση μπορεί να φέρει
 *   πίσω το ορθογώνιο) και φαίνεται στον άνθρωπο, που αποφασίζει αν θα την πετάξει — το αντίθετο του Revit, που σβήνει.
 *
 * Επαναχρήση: τομή = `clipPolygonByConvex2D` (S-H, κυρτός κόφτης — ένα ορθογώνιο μέσω affine μένει παραλληλόγραμμο,
 * δηλαδή κυρτό) · εμβαδόν = `polygonArea`. Καμία δεύτερη γεωμετρία εδώ.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store.
 *
 * @see ./wall-proposal.ts (ο μόνος υπολογιστής)
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.11
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DetectedRectangle } from '../walls/wall-in-region';
import { clipPolygonByConvex2D } from '@/lib/geometry/planar-polygon-clip';
import { polygonArea } from '@/lib/geometry/planar-polygon';

/**
 * Το πλαίσιο της πηγής: **ποια** πηγή (`id`) και πώς ένα σημείο σκηνής γίνεται σημείο της (`toFrame`), όπου η ταυτότητα
 * δεν εξαρτάται από την τοποθέτηση.
 *
 * 🔑 ADR-929 §6.12 — το `id` είναι μέρος της ταυτότητας της απόφασης. Συντεταγμένες χωρίς πηγή δεν σημαίνουν τίποτα:
 *   τα pixel (120, 340) μιας εικόνας και τα ίδια pixel της εικόνας που την αντικατέστησε είναι **άλλο** σημείο του
 *   κτιρίου. Χωρίς το `id`, μια απόφαση της παλιάς εικόνας θα «έβρισκε» με επικάλυψη ένα ξένο ορθογώνιο της νέας —
 *   ψευδής αντιστοίχιση, χειρότερη από απώλεια (Revit: η ετικέτα θυμάται το στοιχείο **του συγκεκριμένου** link).
 */
export interface AnchorFrame {
  readonly id: string;
  readonly toFrame: (scenePoint: Point2D) => Point2D;
}

/** Πηγή σχέδιο: η σκηνή είναι ήδη το πλαίσιο της πηγής. */
export const SCENE_ANCHOR_FRAME: AnchorFrame = { id: 'scene', toFrame: (p) => ({ x: p.x, y: p.y }) };

/** Το `id` του πλαισίου μιας εικόνας υποβάθρου — με πρόθεμα, ώστε να μη συμπέσει ποτέ με το `'scene'`. */
export function imageAnchorFrameId(backgroundId: string): string {
  return `image:${backgroundId}`;
}

/** Μια απόφαση «αυτό ΕΙΝΑΙ τοίχος», αγκυρωμένη στο πολύγωνο του ορθογωνίου, στο πλαίσιο της πηγής `frameId`. */
export interface WallDecisionAnchor {
  readonly frameId: string;
  readonly polygon: readonly [Point2D, Point2D, Point2D, Point2D];
}

/** Η κατάσταση των αποφάσεων μέσα σε μία πρόταση. */
export interface WallProposalDecisions {
  /** Κλειδιά των αμφίσημων ορθογωνίων που καλύπτει απόφαση του ανθρώπου. */
  readonly acceptedKeys: ReadonlySet<string>;
  /**
   * Η άγκυρα κάθε αμφίσημου ορθογωνίου: η **αποθηκευμένη** (ίδιο αντικείμενο) όταν έχει απόφαση, αλλιώς μια νέα — ό,τι
   * χρειάζεται ο ελεγκτής για να προσθέσει ή να αφαιρέσει απόφαση χωρίς να ξέρει το πλαίσιο.
   */
  readonly anchorByKey: ReadonlyMap<string, WallDecisionAnchor>;
  /** Αποφάσεις που δεν βρήκαν το ορθογώνιό τους σε αυτή την πηγή — ορατές, όχι σβησμένες. */
  readonly orphaned: readonly WallDecisionAnchor[];
}

/** Η άγκυρα ενός ορθογωνίου στο πλαίσιο της πηγής. */
export function decisionAnchorOf(rect: DetectedRectangle, frame: AnchorFrame): WallDecisionAnchor {
  const [a, b, c, d] = rect.polygon;
  const to = frame.toFrame;
  return { frameId: frame.id, polygon: [to(a), to(b), to(c), to(d)] };
}

/** Τομή προς ένωση δύο κυρτών τετραπλεύρων (0 όταν κάποιο είναι εκφυλισμένο). */
function anchorIoU(a: WallDecisionAnchor, b: WallDecisionAnchor): number {
  const areaA = polygonArea(a.polygon);
  const areaB = polygonArea(b.polygon);
  if (!(areaA > 0) || !(areaB > 0)) return 0;
  const inter = polygonArea(clipPolygonByConvex2D(a.polygon, b.polygon));
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

interface Candidate {
  readonly anchorIndex: number;
  readonly rectIndex: number;
  readonly iou: number;
}

/** Όλα τα ζεύγη πάνω από το κατώφλι, ταξινομημένα: φθίνον IoU, μετά σειρά άγκυρας, μετά σειρά ορθογωνίου. */
function rankedCandidates(
  anchors: readonly WallDecisionAnchor[],
  fresh: readonly WallDecisionAnchor[],
  minIoU: number,
): Candidate[] {
  const out: Candidate[] = [];
  anchors.forEach((anchor, anchorIndex) => {
    fresh.forEach((rectAnchor, rectIndex) => {
      // §6.12 — άγκυρα άλλης πηγής δεν συγκρίνεται καν: μένει ορφανή, ορατή, ποτέ ψευδώς δεμένη.
      if (anchor.frameId !== rectAnchor.frameId) return;
      const iou = anchorIoU(anchor, rectAnchor);
      if (iou >= minIoU) out.push({ anchorIndex, rectIndex, iou });
    });
  });
  return out.sort((x, y) => y.iou - x.iou || x.anchorIndex - y.anchorIndex || x.rectIndex - y.rectIndex);
}

/**
 * Ξαναβρίσκει τις αποφάσεις στα αμφίσημα ορθογώνια της νέας πηγής. Ιδεμποτικό: ίδια είσοδος ⇒ ίδια αντιστοίχιση.
 * Επιστρέφει ποια ορθογώνια καλύπτονται από απόφαση, την άγκυρα κάθε ορθογωνίου και τις ορφανές.
 */
export function matchDecisionAnchors(
  ambiguous: readonly DetectedRectangle[],
  keyOf: ReadonlyMap<DetectedRectangle, string>,
  anchors: readonly WallDecisionAnchor[],
  frame: AnchorFrame,
  minIoU: number,
): WallProposalDecisions {
  const fresh = ambiguous.map((r) => decisionAnchorOf(r, frame));
  const anchorOfRect = new Map<number, WallDecisionAnchor>();
  const used = new Set<number>();
  for (const c of rankedCandidates(anchors, fresh, minIoU)) {
    if (used.has(c.anchorIndex) || anchorOfRect.has(c.rectIndex)) continue;
    used.add(c.anchorIndex);
    anchorOfRect.set(c.rectIndex, anchors[c.anchorIndex]);
  }
  const acceptedKeys = new Set<string>();
  const anchorByKey = new Map<string, WallDecisionAnchor>();
  ambiguous.forEach((rect, i) => {
    const key = keyOf.get(rect) ?? '';
    const stored = anchorOfRect.get(i);
    if (stored) acceptedKeys.add(key);
    anchorByKey.set(key, stored ?? fresh[i]);
  });
  return { acceptedKeys, anchorByKey, orphaned: anchors.filter((_, i) => !used.has(i)) };
}

/** Οι άγκυρες για κλειδιά μιας πρότασης (ό,τι κάνει ο άνθρωπος πατώντας «τοίχος» σε καθένα). */
export function decisionAnchorsForKeys(
  decisions: WallProposalDecisions,
  keys: Iterable<string>,
): WallDecisionAnchor[] {
  const out: WallDecisionAnchor[] = [];
  for (const key of keys) {
    const anchor = decisions.anchorByKey.get(key);
    if (anchor) out.push(anchor);
  }
  return out;
}
