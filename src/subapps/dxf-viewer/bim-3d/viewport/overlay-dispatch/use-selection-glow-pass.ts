'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-555 + ADR-717 BEFORE EDITING
 *
 * use-selection-glow-pass — η ΟΠΤΙΚΗ ΕΠΙΒΕΒΑΙΩΣΗ της επιλογής raw-DXF μέσα στο 3D (ADR-717 v4).
 *
 * ## Γιατί υπάρχει
 *
 * Το raw-DXF υπόστρωμα του 3D είναι batched `THREE.LineSegments` ΑΝΑ ΧΡΩΜΑ
 * (`DxfToThreeConverter.buildColorGroup`): χιλιάδες οντότητες μοιράζονται ένα υλικό και ΔΕΝ
 * φέρουν per-entity `userData`. Άρα — σε αντίθεση με τα BIM meshes, που παίρνουν WebGL
 * silhouette (`SelectionOutlinePass`) — μια επιλεγμένη γραμμή κάτοψης ΔΕΝ μπορεί να αλλάξει
 * εμφάνιση στο GPU χωρίς να σπάσει το batching. Χωρίς αυτό το pass, η ΜΟΝΗ ένδειξη επιλογής
 * είναι οι λαβές — και οι λαβές είναι, εξ ορισμού, φραγμένες (`GRIPOBJLIMIT`, ADR-559).
 *
 * ## Τι κάνουν οι μεγάλοι παίκτες (η έρευνα που έλειπε από τις v1–v3)
 *
 * Και οι τέσσερις έχουν **δύο ΑΝΕΞΑΡΤΗΤΑ κανάλια**, όχι ένα:
 *
 *   **highlight** = «τι κρατάω» — πάντα ορατό, κλιμακώνει σε χιλιάδες, ΔΕΝ ρωτά τις λαβές·
 *   **handles/grips** = «τι μπορώ να πιάσω» — φραγμένα, γιατί κάθε λαβή είναι hit-target.
 *
 *   • **AutoCAD** (`SELECTIONEFFECT`, προεπιλογή 1): μπλε **λάμψη ΓΥΡΩ** από το αντικείμενο· το
 *     ίδιο το αντικείμενο κρατά το χρώμα του. Το `GRIPOBJLIMIT` σβήνει ΜΟΝΟ τις λαβές — το
 *     highlight παραμένει. Αυτό είναι το ακριβές ανάλογο της περίπτωσής μας (ωμό linework).
 *   • **ArchiCAD** (Work Environment → Selection & Element Information): «Highlight Element
 *     Surface» με **ρυθμιστή διαφάνειας** για τις επιφάνειες + «**bold contours**» για τα
 *     περιγράμματα· και shortcut ΠΡΟΣΩΡΙΝΗΣ ΑΠΟΚΡΥΨΗΣ του highlight (Ctrl/Alt+Space) ακριβώς
 *     επειδή το πραγματικό χρώμα είναι πληροφορία.
 *   • **Revit**: χρώμα επιλογής από Options → Graphics, ως **περίγραμμα + ημιδιαφανής** απόχρωση.
 *   • **Figma**: μπλε **περίγραμμα** γύρω από το σχήμα· το fill μένει ανέπαφο.
 *
 * Η σύγκλιση είναι απόλυτη: **το highlight προστίθεται ΓΥΡΩ, δεν αντικαθιστά**. Και είναι
 * ΟΜΟΙΟΜΟΡΦΟ — καμία εφαρμογή δεν αλλάζει συμπεριφορά ανάμεσα σε «μία» και «πολλές».
 *
 * ## Πού αστόχησαν οι v1–v3 (ADR-717 changelog)
 *
 * Και οι τρεις προσπάθησαν να απαντήσουν το ερώτημα «**κάθισαν λαβές;**» για να σβήσουν το
 * highlight — ερώτημα που **κανένας** μεγάλος παίκτης δεν κάνει. Η v2 το προέβλεπε (απέκλινε από
 * το `seatGrips`), η v3 το ρωτούσε στο store (και πάλι έβαφε μπλε, χωρίς διάγνωση). Το πραγματικό
 * ελάττωμα όμως δεν ήταν ΠΟΤΕ το gate: ήταν ότι το pass ζωγράφιζε **ΠΑΝΩ** στη γραμμή (2.5px,
 * alpha 0.85, αδιαφανές μπλε) — άρα σε λεπτό linework **αντικαθιστούσε** το χρώμα του layer, που
 * είναι δεδομένο (επίπεδο, υλικό, σύμβαση σχεδίου), όχι διακόσμηση. Η v4 διορθώνει την ΑΙΤΙΑ και
 * το gate εξαφανίζεται μαζί της.
 *
 * ## Η τεχνική: φωτοστέφανο με τρύπα (halo + `destination-out` core)
 *
 * Το overlay είναι Canvas2D **ΠΑΝΩ** από το WebGL — δεν μπορούμε να ζωγραφίσουμε «από κάτω».
 * Οπότε το φωτοστέφανο χτίζεται σε δύο χρόνους πάνω στον ΚΟΙΝΟ καμβά:
 *
 *   1. **N ομόκεντρες πινελιές** φθίνοντος πλάτους / αύξουσας αδιαφάνειας ({@link SELECTION_HALO_LAYERS})
 *      → μαλακή βαθμίδα ΧΩΡΙΣ `shadowBlur` (το Canvas2D blur είναι από τα ακριβότερα primitives —
 *      τρεις καθαρές πινελιές κοστίζουν κλάσμα του και δίνουν ελεγχόμενο προφίλ)·
 *   2. **`globalCompositeOperation = 'destination-out'`** με στενή πινελιά ({@link SELECTION_HALO_CORE_PX})
 *      → ΤΡΥΠΑΕΙ τον πυρήνα, οπότε η γραμμή του WebGL φαίνεται από μέσα **με το ΔΙΚΟ της χρώμα**.
 *
 * Αποτέλεσμα: δαχτυλίδι λάμψης γύρω από linework που παραμένει ακριβώς όπως ήταν. Το ίδιο που
 * βλέπει ο χρήστης στο AutoCAD, χωρίς καμία απώλεια πληροφορίας.
 *
 * ## Πώς κλιμακώνει (το μη-προφανές κομμάτι)
 *
 * Ένα αφελές pass θα έλυνε ids → οντότητες και θα ξανα-δειγματολητούσε περιγράμματα ΚΑΘΕ frame
 * όσο η κάμερα γυρίζει. Με 500 επιλεγμένες πολυγραμμές σε σκηνή 2.000 οντοτήτων αυτό είναι
 * O(N·M) αναζήτηση + πλήρης re-tessellation στα 60fps. Αντ' αυτού:
 *
 *   1. **resolve + δειγματοληψία μία φορά ανά ΑΛΛΑΓΗ ΕΠΙΛΟΓΗΣ**, όχι ανά frame — μέσω του
 *      bulk `findDxfEntitiesInScope` (ένα πέρασμα, ADR-717) και του ΚΟΙΝΟΥ
 *      `dxfEntityOutlineSegments` (ο ίδιος sampler που ζωγραφίζει το hover glow και που
 *      ελέγχει το marquee — μηδέν δεύτερη γεωμετρία)·
 *   2. **ομαδοποίηση ανά υψόμετρο ορόφου**, γιατί ο projector είναι ανά επίπεδο (ADR-537 δ):
 *      ένας projector ανά όροφο, όχι ένας ανά οντότητα·
 *   3. **προβολή ΜΙΑ φορά ανά frame, N πινελιές πάνω στα ΙΔΙΑ px** — το ακριβό κομμάτι είναι ο
 *      πολλαπλασιασμός πίνακα ανά κορυφή· οι στρώσεις του φωτοστέφανου ξαναδιαβάζουν τα ήδη
 *      προβεβλημένα σημεία, δεν ξαναπροβάλλουν.
 *
 * ADR-040 micro-leaf: η ΜΟΝΗ συνδρομή είναι το πλήθος επιλεγμένων `dxf-entity` (low-frequency,
 * ανοίγει/κλείνει το RAF). Τα ids διαβάζονται ΕΠΙΤΟΠΟΥ μέσα στο `paint` (getter, όχι snapshot).
 */

import { useRef, useSyncExternalStore, useCallback, useMemo } from 'react';
import type { Point2D } from '../../../rendering/types/Types';
import { UI_COLORS } from '../../../config/color-config';
import { SelectedEntitiesStore, subscribeSelection } from '../../../systems/selection/SelectedEntitiesStore';
import { makeGripPlanToCanvas } from '../../grips/grip-3d-screen-project';
import { dxfEntityOutlineSegments } from '../../grips/dxf-entity-outline';
import { dxfSceneUnitToMm } from '../../../utils/scene-units';
import { findDxfEntitiesInScope } from '../../scene/dxf-3d-floor-scope';
import type { BimOverlayFrame, BimOverlayPass } from './bim-overlay-pass';

/** Μία ομόκεντρη στρώση του φωτοστέφανου: πλάτος πινελιάς (CSS px) + αδιαφάνεια. */
export interface SelectionHaloLayer {
  readonly widthPx: number;
  readonly alpha: number;
}

/**
 * Το προφίλ της λάμψης, από έξω προς τα μέσα — φθίνον πλάτος, αύξουσα αδιαφάνεια. Τρεις στρώσεις
 * είναι το σημείο ισορροπίας: δύο δείχνουν «σκαλοπάτι», τέσσερις δεν ξεχωρίζουν οπτικά αλλά
 * πληρώνονται. Αντικαθιστά το `shadowBlur` (πολλαπλάσιο κόστος, ανεξέλεγκτο προφίλ).
 *
 * **ΑΜΕΤΑΒΛΗΤΟ**: κάθε στρώση πρέπει να είναι πλατύτερη από τον πυρήνα ({@link SELECTION_HALO_CORE_PX}),
 * αλλιώς η τρύπα την καταπίνει και η στρώση απλώς σπαταλιέται. Κλειδωμένο σε anchors.
 */
export const SELECTION_HALO_LAYERS: readonly SelectionHaloLayer[] = [
  { widthPx: 7.5, alpha: 0.14 },
  { widthPx: 5.0, alpha: 0.24 },
  { widthPx: 3.4, alpha: 0.42 },
];

/**
 * Πλάτος (CSS px) της τρύπας που ανοίγει το `destination-out` πάνω από τη γραμμή. Λίγο πλατύτερο
 * από την 1px γραμμή του `LineBasicMaterial` ώστε να περνούν και τα anti-aliased άκρα της — αν
 * ήταν ακριβώς 1px, το φωτοστέφανο θα «έτρωγε» τη μισή γραμμή και το χρώμα layer θα θόλωνε.
 */
export const SELECTION_HALO_CORE_PX = 1.9;

/** Τα plan-mm πολύγραμμα ΕΝΟΣ επιπέδου ορόφου, έτοιμα για προβολή. */
interface FloorOutlines {
  readonly floorElevationMm: number;
  readonly polylines: readonly Point2D[][];
}

/** Ό,τι χρειάζεται το `paint`, υπολογισμένο μία φορά ανά αλλαγή επιλογής. */
interface OutlineCache {
  readonly signature: string;
  readonly floors: readonly FloorOutlines[];
}

/**
 * Τα περιγράμματα (plan-mm) των επιλεγμένων raw-DXF οντοτήτων, ομαδοποιημένα ανά υψόμετρο.
 * Κάθε οντότητα περνά από τον ΚΟΙΝΟ sampler με τον δικό της συντελεστή μονάδας (ADR-537 γ),
 * ώστε το highlight να κάθεται πάνω στο wireframe σε ΟΠΟΙΑΔΗΠΟΤΕ μονάδα σκηνής.
 */
function buildFloorOutlines(ids: readonly string[]): FloorOutlines[] {
  const byElevation = new Map<number, Point2D[][]>();
  for (const found of findDxfEntitiesInScope(ids)) {
    const segments = dxfEntityOutlineSegments(found.entity, dxfSceneUnitToMm(found.scene));
    if (segments.length === 0) continue; // τύπος χωρίς γραμμική αναπαράσταση — δεν ζωγραφίζεται
    const bucket = byElevation.get(found.floorElevationMm);
    if (bucket) bucket.push(...segments);
    else byElevation.set(found.floorElevationMm, [...segments]);
  }
  return [...byElevation].map(([floorElevationMm, polylines]) => ({ floorElevationMm, polylines }));
}

/**
 * Προβολή ΜΙΑ φορά: plan-mm πολύγραμμα → canvas px. Το ακριβό βήμα (πολλαπλασιασμός πίνακα
 * κάμερας ανά κορυφή) γίνεται εδώ και μόνο εδώ· οι στρώσεις του φωτοστέφανου ξαναδιαβάζουν
 * το αποτέλεσμα. Πολύγραμμα με <2 κορυφές πέφτουν (δεν παράγουν πινελιά).
 */
function projectPolylines(
  project: (p: Point2D) => Point2D,
  polylines: readonly Point2D[][],
): Point2D[][] {
  const out: Point2D[][] = [];
  for (const poly of polylines) {
    if (poly.length < 2) continue;
    const pts: Point2D[] = new Array<Point2D>(poly.length);
    for (let i = 0; i < poly.length; i++) pts[i] = project(poly[i]);
    out.push(pts);
  }
  return out;
}

/** Χαράζει ΟΛΑ τα προβεβλημένα πολύγραμμα σε ΕΝΑ path (ένα `stroke()` για όλη την επιλογή). */
function tracePolylines(ctx: CanvasRenderingContext2D, polys: readonly Point2D[][]): void {
  ctx.beginPath();
  for (const poly of polys) {
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
  }
}

/**
 * Το φωτοστέφανο πάνω σε ΟΛΟΥΣ τους ορόφους μαζί: πρώτα οι ομόκεντρες στρώσεις, ΜΕΤΑ μία ενιαία
 * τρύπα. Η σειρά είναι ουσιώδης — αν κάθε όροφος έτρωγε τη δική του τρύπα πριν ζωγραφίσει ο
 * επόμενος, το linework του ενός ορόφου θα «έσβηνε» τη λάμψη του άλλου στα σημεία που
 * επικαλύπτονται στην κάτοψη (ADR-537 δ: οι όροφοι στοιβάζονται στην ίδια προβολή).
 */
export function paintSelectionHalo(
  ctx: CanvasRenderingContext2D,
  projected: readonly Point2D[][],
): void {
  if (projected.length === 0) return;
  ctx.strokeStyle = UI_COLORS.OVERLAY_GRIP_COLD; // ΤΟ ΙΔΙΟ μπλε με τις λαβές: ένα «χρώμα επιλογής»
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);

  for (const layer of SELECTION_HALO_LAYERS) {
    ctx.globalAlpha = layer.alpha;
    ctx.lineWidth = layer.widthPx;
    tracePolylines(ctx, projected);
    ctx.stroke();
  }

  // Ο πυρήνας φεύγει ΟΛΟΚΛΗΡΟΣ (alpha 1) — μερική διαγραφή θα άφηνε μπλε πέπλο πάνω στη γραμμή,
  // δηλαδή ακριβώς την αλλοίωση χρώματος που αυτό το pass υπάρχει για να ΜΗΝ κάνει.
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = SELECTION_HALO_CORE_PX;
  tracePolylines(ctx, projected);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

/** Ταυτότητα της τρέχουσας επιλογής — αλλάζει ⇔ πρέπει να ξαναχτιστούν τα περιγράμματα. */
export function selectionSignature(ids: readonly string[]): string {
  return ids.join('|');
}

/**
 * Ο ΚΑΝΟΝΑΣ «πότε μιλά το highlight», ως καθαρή συνάρτηση (ADR-717 v4).
 *
 * Εξάγεται επίτηδες, παρότι είναι πλέον μία σύγκριση: αυτή η απόφαση άλλαξε ΤΡΕΙΣ φορές μέσα σε μία
 * συνεδρία, κάθε φορά προσθέτοντας κι άλλη προϋπόθεση (κατώφλι λαβών → κατάσταση λαβών → BIM). Η
 * απάντηση των μεγάλων παικτών είναι ότι **δεν υπάρχει προϋπόθεση**: το highlight είναι το κανάλι
 * «τι κρατάω» και δεν ρωτά ποτέ ούτε τις λαβές ούτε το είδος της επιλογής. Το anchor υπάρχει για να
 * σπάσει θορυβωδώς αν κάποιος ξαναπροσθέσει gate — αυτή είναι η ΜΟΝΗ αστοχία που έχει συμβεί εδώ.
 *
 * Ειδικά για τα BIM ids: **δεν** τα ρωτάμε. Μια μεικτή επιλογή δίνει WebGL silhouette στα meshes ΚΑΙ
 * φωτοστέφανο στο linework — δύο υλοποιήσεις του ΙΔΙΟΥ σήματος στο ίδιο χρώμα, όχι δύο σήματα.
 *
 * @param dxfCount επιλεγμένες `dxf-entity` (0 ⇒ δεν υπάρχει τίποτα να δείξουμε)
 */
export function shouldShowSelectionHighlight(dxfCount: number): boolean {
  return dxfCount > 0;
}

/**
 * Το highlight-layer της επιλεγμένης raw-DXF γεωμετρίας ως dispatch pass.
 *
 * `hideOnMotion=false`: το highlight ΑΚΟΛΟΥΘΕΙ την κάμερα. Οι λαβές κρύβονται στην πλοήγηση
 * (είναι hit-targets, δεν έχουν νόημα όσο κινείσαι)· το «τι κρατάω» δεν κρύβεται ΠΟΤΕ — ίδιο με
 * AutoCAD/Revit/C4D, όπου η επιλογή παραμένει ορατή σε όλο το orbit.
 */
export function useSelectionGlowPass(): BimOverlayPass {
  const dxfCount = useSyncExternalStore(
    subscribeSelection,
    () => SelectedEntitiesStore.countByType('dxf-entity'),
    () => 0, // SSR: καμία επιλογή
  );
  const active = shouldShowSelectionHighlight(dxfCount);

  const cacheRef = useRef<OutlineCache | null>(null);

  /** Τα περιγράμματα της ΤΡΕΧΟΥΣΑΣ επιλογής, ξαναχτισμένα μόνο όταν η επιλογή όντως άλλαξε. */
  const outlinesNow = useCallback((): readonly FloorOutlines[] => {
    const ids = SelectedEntitiesStore.getSelectedEntityIds();
    const signature = selectionSignature(ids);
    const cached = cacheRef.current;
    if (cached && cached.signature === signature) return cached.floors;
    const floors = buildFloorOutlines(ids);
    cacheRef.current = { signature, floors };
    return floors;
  }, []);

  const paint = useCallback((frame: BimOverlayFrame): void => {
    const { ctx, camera, canvas } = frame;
    const floors = outlinesNow();
    if (floors.length === 0) return;
    const projected: Point2D[][] = [];
    for (const floor of floors) {
      // ADR-537 δ — ένας projector ΑΝΑ ΟΡΟΦΟ (το υψόμετρο είναι σταθερό μέσα στην ομάδα).
      const project = makeGripPlanToCanvas(camera, canvas, () => floor.floorElevationMm);
      projected.push(...projectPolylines(project, floor.polylines));
    }
    paintSelectionHalo(ctx, projected);
  }, [outlinesNow]);

  return useMemo(() => ({ active, hideOnMotion: false, paint }), [active, paint]);
}
