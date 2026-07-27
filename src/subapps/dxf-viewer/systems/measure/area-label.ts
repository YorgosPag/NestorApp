/**
 * ADR-649 / ADR-662 §12 — «Ετικέτα Εμβαδού»: pure builders (χωρίς React/state).
 *
 * SSoT για ΤΟ ΚΕΙΜΕΝΟ + ΤΗ ΘΕΣΗ + ΤΟ ΜΕΓΕΘΟΣ + ΤΟ text-entity της ετικέτας που ρίχνει
 * το 2-κλικ εργαλείο (`handleAreaLabelClick`). Μηδέν re-implementation:
 *   - εμβαδά    → `entityAreaFacts` (ανά τύπο· γραμμοσκίαση = outer−islands, TIN = τρίγωνα)
 *   - όριο      → `entityClosedRings` (ΙΔΙΟ SSoT με τις έλξεις, ADR-662 §11)
 *   - μορφή     → `formatAreaForDisplay` (ενεργή display-μονάδα, «25,00 m²»)
 *   - κέντρο    → `polygon2DAreaCentroid` (area-weighted, σωστό σε κοίλα L/T/U)
 *   - «μέσα;»   → `performDetailedHitTest` (σωστή σημασιολογία ανά τύπο)
 *   - bbox      → `boundsOfPoints` (fit-to-shape ύψος κειμένου)
 *   - υλικό     → `HATCH_PATTERN_CATALOG[patternName].labelKey` → genitive i18n
 *   - textNode  → `makeNode`/`makeRun` SSoT builders
 *   - id        → `generateEntityId` (enterprise-id SSoT, N.6)
 *
 * **ΔΥΟ ΓΡΑΜΜΕΣ ΟΤΑΝ ΥΠΑΡΧΕΙ ΑΝΑΓΛΥΦΟ** (απόφαση Giorgio 2026-07-27): επίπεδη οντότητα →
 * μία γραμμή «Εμβαδόν …»· τοπογραφική επιφάνεια → **και** δεύτερη «Επιφάνεια εδάφους …»
 * (Civil 3D «2D Area» / «3D Area»). Η διαφορά των δύο είναι η κλίση του εδάφους — και
 * είναι η πληροφορία που τιμολογείται σε εκσκαφή/επένδυση/φύτευση.
 *
 * **Μέγεθος κειμένου (fit-to-shape):** το ύψος ΔΕΝ κλιμακώνεται με το `drawingScale`
 * (που έκανε τα κείμενα δυσανάλογα μεγάλα)· προκύπτει από τις ΔΙΑΣΤΑΣΕΙΣ του ίδιου του
 * σχήματος ώστε η ετικέτα να χωράει πάντα μέσα του, ανεξάρτητα από κλίμακα/μονάδες.
 *
 * Ήταν `bim/hatch/hatch-area-label.ts` όσο το εργαλείο ήταν hatch-only.
 *
 * @see ./entity-area-facts — «τι εμβαδόν δίνει αυτή η οντότητα;»
 * @see ../../snapping/shared/entity-closed-rings — «ποιο είναι το κλειστό όριό της;»
 * @see docs/centralized-systems/reference/adrs/ADR-649-hatch-area-label-tool.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, TextEntity } from '../../types/entities';
import { isHatchEntity } from '../../types/entities';
import type { DxfTextNode } from '../../text-engine/types/text-ast.types';
import { i18n } from '@/i18n';
import { entityAreaFacts } from './entity-area-facts';
import { entityClosedRings, type ClosedRings } from '../../snapping/shared/entity-closed-rings';
import { performDetailedHitTest } from '../../rendering/hitTesting/hit-test-entity-tests';
import { formatAreaForDisplay } from '../../config/display-length-format';
import { polygon2DAreaCentroid } from '../../bim/geometry/shared/polygon-utils';
import { calculatePolygonArea } from '../../rendering/entities/shared/geometry-polyline-utils';
import { boundsOfPoints } from '../../services/clip/clip-geometry';
import { HATCH_PATTERN_CATALOG } from '../../data/hatch-pattern-catalog';
import { makeRun, makeParagraph, makeNode, DEFAULT_RUN_STYLE } from '../../text-engine/templates/defaults/template-helpers';
import { generateEntityId } from '../entity-creation/utils';

const NS = 'dxf-viewer-shell';

// Fit-to-shape tuning: το κείμενο καταλαμβάνει ~85% του πλάτους του bbox (με μέσο
// πλάτος χαρακτήρα ≈ 0.6× του ύψους) ΚΑΙ ≤35% του ύψους — ό,τι δώσει μικρότερο ύψος.
const LABEL_WIDTH_FILL = 0.85;
const LABEL_CHAR_WIDTH_RATIO = 0.6;
const LABEL_MAX_HEIGHT_FRACTION = 0.35;

/**
 * Το «εξωτερικό» δαχτυλίδι για αγκύρωση/διαστασιολόγηση: αυτό με το **μεγαλύτερο**
 * εμβαδόν. ΟΧΙ το `rings[0]`: στη γραμμοσκίαση το πρώτο ring ΕΙΝΑΙ εξ ορισμού το outer,
 * αλλά στην τοπογραφική επιφάνεια τα rings βγαίνουν από αλυσοποίηση μη-προσανατολισμένων
 * ακμών με **αυθαίρετη σειρά** — το `[0]` μπορεί κάλλιστα να είναι τρύπα.
 */
function largestRing(rings: ClosedRings): readonly Point2D[] | null {
  let best: readonly Point2D[] | null = null;
  let bestArea = -1;
  for (const ring of rings) {
    if (ring.length < 3) continue;
    const area = calculatePolygonArea(ring as Point2D[]);
    if (area > bestArea) {
      bestArea = area;
      best = ring;
    }
  }
  return best;
}

/**
 * Γενική (genitive) ονομασία υλικού για το pattern της γραμμοσκίασης, ή `null`.
 * Παράγει το «γρασιδιού» στο «Εμβαδόν γρασιδιού: 25,00 m²». Η γενική ζει ΜΟΝΟ στο
 * locale (`areaLabel.materials.<key>`, N.11) — αν λείπει, επιστρέφει `null` και η
 * ετικέτα πέφτει στο σκέτο «Εμβαδόν: …» (fallback χωρίς υλικό).
 *
 * Έννοια **αποκλειστικά** της γραμμοσκίασης: το έδαφος δεν έχει «pattern υλικού» — η
 * τοπογραφική επιφάνεια παίρνει τη γενική διατύπωση, και αυτό είναι σωστό, όχι κενό.
 */
export function resolveHatchMaterialGenitive(patternName?: string): string | null {
  if (!patternName) return null;
  const entry = HATCH_PATTERN_CATALOG[patternName];
  if (!entry) return null;
  // labelKey = 'ribbon.commands.hatchEditor.patterns.grass' → τελευταίο segment 'grass'.
  const patternKey = entry.labelKey.split('.').pop();
  if (!patternKey) return null;
  const key = `areaLabel.materials.${patternKey}`;
  return i18n.exists(key, { ns: NS }) ? i18n.t(key, { ns: NS }) : null;
}

/**
 * Οι γραμμές της ετικέτας — μία ή δύο:
 *   - «Εμβαδόν γρασιδιού: 25,00 m²»       (γραμμοσκίαση με αναγνωρίσιμο pattern)
 *   - «Εμβαδόν: 1.234,56 m²»               (χωρίς υλικό)
 *   - + «Επιφάνεια εδάφους: 1.289,03 m²»   (μόνο όταν η οντότητα έχει ανάγλυφο)
 *
 * Κενό array όταν η οντότητα δεν έχει μετρήσιμο εμβαδόν — ο καλών δεν φτιάχνει ετικέτα.
 */
export function buildAreaLabelLines(entity: Entity): string[] {
  const facts = entityAreaFacts(entity);
  if (!facts) return [];

  const prefix = i18n.t('areaLabel.areaPrefix', { ns: NS });
  const material = isHatchEntity(entity) ? resolveHatchMaterialGenitive(entity.patternName) : null;
  const planStr = formatAreaForDisplay(facts.plan2DMm2);
  const lines = [material ? `${prefix} ${material}: ${planStr}` : `${prefix}: ${planStr}`];

  if (facts.surface3DMm2 !== null) {
    const surfacePrefix = i18n.t('areaLabel.surfacePrefix', { ns: NS });
    lines.push(`${surfacePrefix}: ${formatAreaForDisplay(facts.surface3DMm2)}`);
  }
  return lines;
}

/**
 * Σημείο αγκύρωσης της ετικέτας (επιλογή Giorgio): αν το 2ο κλικ πέσει ΜΕΣΑ στην ίδια
 * οντότητα → κέντρο βάρους του μεγαλύτερου ring· αλλιώς (κλικ στον καμβά) → ακριβώς το
 * σημείο του κλικ. Το «μέσα;» το κρίνει το `performDetailedHitTest`, άρα κάθε τύπος
 * κρατά τη ΔΙΚΗ του σημασιολογία (γραμμοσκίαση even-odd, τοπογραφική οποιοδήποτε ring).
 */
export function resolveAreaLabelAnchor(entity: Entity, clickPoint: Point2D): Point2D {
  const inside = performDetailedHitTest(entity, clickPoint, 0) !== null;
  if (!inside) return clickPoint;
  const outer = largestRing(entityClosedRings(entity));
  return outer ? polygon2DAreaCentroid(outer as Point2D[]) : clickPoint;
}

/**
 * **Fit-to-shape** ύψος κειμένου (ίδιες μονάδες με τις συντεταγμένες του σχεδίου): όσο
 * χρειάζεται ώστε η **μακρύτερη** γραμμή να χωράει στο ~85% του πλάτους του bbox, χωρίς
 * **όλες** οι γραμμές μαζί να ξεπερνούν το ~35% του ύψους. Degenerate σχήμα → 1.
 */
export function fitAreaLabelHeight(lines: readonly string[], outer: readonly Point2D[] | null): number {
  if (!outer || outer.length < 3 || lines.length === 0) return 1;
  const b = boundsOfPoints(outer as Point2D[]);
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const byWidth = (LABEL_WIDTH_FILL * (b.maxX - b.minX)) / Math.max(1, longest * LABEL_CHAR_WIDTH_RATIO);
  const byHeight = (LABEL_MAX_HEIGHT_FRACTION * (b.maxY - b.minY)) / lines.length;
  const fit = Math.min(byWidth, byHeight);
  return fit > 0 ? fit : 1;
}

/**
 * `DxfTextNode` για την ετικέτα: μία κεντραρισμένη (MC) παράγραφος ανά γραμμή, με το
 * δοσμένο `height` (σε μονάδες σχεδίου).
 */
export function buildAreaLabelTextNode(lines: readonly string[], height: number): DxfTextNode {
  const paragraphs = lines.map((line) =>
    makeParagraph([makeRun(line, { ...DEFAULT_RUN_STYLE, height })], { justification: 1 }),
  );
  return makeNode(paragraphs, { attachment: 'MC' });
}

/**
 * Το ολοκληρωμένο `TextEntity` της ετικέτας εμβαδού (κείμενο + θέση + fit-to-shape ύψος
 * + textNode + enterprise id), έτοιμο για `completeEntity`, ή `null` όταν η οντότητα δεν
 * έχει μετρήσιμο εμβαδόν. Το `layerId: ''` αφήνει τον canonical create-path να αναθέσει
 * το ενεργό layer (mirror annotation symbol).
 */
export function buildAreaLabelEntity(entity: Entity, clickPoint: Point2D): TextEntity | null {
  const lines = buildAreaLabelLines(entity);
  if (lines.length === 0) return null;
  const height = fitAreaLabelHeight(lines, largestRing(entityClosedRings(entity)));
  return {
    id: generateEntityId(),
    type: 'text',
    layerId: '',
    position: resolveAreaLabelAnchor(entity, clickPoint),
    text: lines.join('\n'),
    textNode: buildAreaLabelTextNode(lines, height),
    rotation: 0,
  };
}
