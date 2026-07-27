/**
 * ADR-344 Φ-3D / ADR-537 §text — ο **3D** resolver αγκύρωσης του in-place text editor.
 *
 * Το δεύτερο μέλος του συμβολαίου {@link TextEditorAnchor}· ο πρώτος είναι ο 2D
 * (`ui/text-toolbar/text-editor-anchor-2d.ts`). Ό,τι ΔΕΝ αφορά την αγκύρωση ζει στο κοινό
 * `text-edit-session.ts` — αυτό το αρχείο απαντά μία και μόνη ερώτηση:
 *
 *   «σε ποιο pixel της οθόνης βρίσκεται αυτή τη στιγμή το κείμενο με αυτό το id;»
 *
 * ### Καμία νέα μαθηματική — μόνο σύνδεση υπαρχόντων SSoT
 * ```
 * findDxfEntityInScope(id)   → η οντότητα + το ΥΨΟΜΕΤΡΟ του ορόφου της + η σκηνή της (ADR-537 δ)
 *   → resolveTextEmBox()     → ΤΟ ΙΔΙΟ em-κουτί που διαβάζει ο glyph atlas για να στήσει τα γράμματα
 *   → dxfSceneUnitToMm()     → native μονάδες DXF → mm (ADR-537 γ: η σκηνή δεν είναι πάντα mm)
 *   → dxfPlanToWorld()       → mm κάτοψης → κόσμος Three.js (μέτρα, Y-up)
 *   → worldToScreen()        → client px· `null` όταν το σημείο είναι ΠΙΣΩ από την κάμερα
 * ```
 * Η επιλογή του `resolveTextEmBox` δεν είναι αυθαίρετη: είναι **ακριβώς** το κουτί που
 * διαβάζει το `glyph-atlas-text-layout.ts` για να τοποθετήσει τα quads των glyphs. Άρα ο
 * editor αγκυρώνεται εξ ορισμού εκεί που ζωγραφίζονται τα γράμματα — δομικά αδύνατο να
 * αποκλίνουν, όσο κι αν αλλάξει η στοίχιση, η περιστροφή ή το πλήθος γραμμών.
 *
 * ### Γιατί ΤΟ ΚΕΝΤΡΟ και όχι το σημείο εισαγωγής
 * Το `position` μιας οντότητας κειμένου είναι το **σημείο προσάρτησης** (πλέγμα 9 σημείων,
 * MTEXT group 71) — μπορεί να είναι πάνω-αριστερά, μέσο-δεξιά, οπουδήποτε. Αγκυρώνοντας
 * εκεί, ο editor θα κρεμόταν άλλοτε πάνω στα γράμματα και άλλοτε δίπλα τους, ανάλογα με τη
 * στοίχιση. Το κέντρο του em-κουτιού είναι το μόνο σημείο που είναι **πάντα** μέσα στο
 * κείμενο, οπότε ο editor κεντράρεται πάνω του.
 *
 * ### Τι ΔΕΝ κάνει (τεκμηριωμένη απόρριψη — δες `TextEditorAnchorLayer`)
 * Δεν παράγει προοπτικό transform. Το μέγεθος και ο προσανατολισμός του editor μένουν
 * σταθερά σε screen-space: AutoCAD `MTEXTFIXED = 2`, η **προεπιλογή** της, που εμφανίζει
 * περιστραμμένο/δυσανάγνωστο κείμενο «οριζόντια και σε ευανάγνωστο μέγεθος».
 *
 * Καθαρό ως προς React: μηδέν hooks. Αγγίζει THREE + DOM μόνο μέσα στο `project()`.
 */

import type * as THREE from 'three';
import type { DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import { resolveTextEmBox } from '../../bim/text/text-box';
import { dxfSceneUnitToMm } from '../../utils/scene-units';
import { findDxfEntityInScope } from '../scene/dxf-3d-floor-scope';
import { dxfPlanToWorld, worldToScreen } from '../viewport/coordinate-transforms';
import { subscribeToCameraMoves } from '../coordination/use-camera-projected-markers';
import type { TextEditorAnchor } from '../../ui/text-toolbar/TextEditorAnchorLayer';

/** Ό,τι χρειάζεται ο resolver από το ζωντανό 3D viewport, διαβασμένο τη στιγμή του tick. */
export interface Bim3DProjectionSource {
  readonly getCamera: () => THREE.Camera | null;
  readonly getCanvas: () => HTMLElement | null;
}

/**
 * Το κέντρο του em-κουτιού ενός κειμένου, σε client px, ή `null` όταν το κείμενο δεν είναι
 * στο ενεργό εύρος ορόφων, δεν είναι κείμενο, ή βρίσκεται πίσω από την κάμερα.
 *
 * Εξαγμένο από το {@link createTextEditorAnchor3D} ώστε να ελέγχεται με fake κάμερα χωρίς
 * να στηθεί ολόκληρο viewport.
 */
export function projectTextCentreToScreen(
  entityId: string,
  source: Bim3DProjectionSource,
): { x: number; y: number } | null {
  const found = findDxfEntityInScope(entityId);
  // ⚠️ 'text' ΚΑΙ για MTEXT: ο `convertTextEntity` κανονικοποιεί το MTEXT σε `type:'text'`
  // πριν φτάσει στο `DxfScene` («DxfEntityUnion has no `mtext` variant»). Ένας έλεγχος
  // για 'mtext' εδώ θα ήταν μόνιμα ψευδής.
  if (!found || found.entity.type !== 'text') return null;
  const camera = source.getCamera();
  const canvas = source.getCanvas();
  if (!camera || !canvas) return null;
  const box = resolveTextEmBox(found.entity as DxfText);
  const unitToMm = dxfSceneUnitToMm(found.scene);
  const world = dxfPlanToWorld(
    box.center.x * unitToMm,
    box.center.y * unitToMm,
    found.floorElevationMm,
  );
  return worldToScreen(world, camera, canvas);
}

/** Το subsystem id του scheduler για το tick του editor (μοναδικό — ένας editor τη φορά). */
const EDITOR_TICK_ID = 'bim-3d-text-editor-anchor';

/**
 * Ζωντανή αγκύρωση ενός κειμένου στο 3D viewport: ακολουθεί την κάμερα σε κάθε orbit/zoom/pan,
 * χωρίς κανένα React re-render (το `TextEditorAnchorLayer` μετακινεί το DOM επιτακτικά).
 *
 * Ο editor **κεντράρεται** πάνω στο κείμενο: το `project` επιστρέφει την άνω-αριστερή γωνία
 * ώστε το κουτί να έχει το κείμενο στο μέσο του — αλλιώς σε πλάγια λήψη θα κρεμόταν από τη
 * μία μεριά και θα σκέπαζε ό,τι διορθώνεις.
 */
export function createTextEditorAnchor3D(params: {
  readonly entityId: string;
  readonly source: Bim3DProjectionSource;
  readonly size: { readonly width: number; readonly height: number };
}): TextEditorAnchor {
  const { entityId, source, size } = params;
  return {
    size,
    project: () => {
      const centre = projectTextCentreToScreen(entityId, source);
      if (!centre) return null;
      return { x: centre.x - size.width / 2, y: centre.y - size.height / 2 };
    },
    subscribe: subscribeToCameraMoves(source.getCamera, EDITOR_TICK_ID, 'BIM 3D Text Editor Anchor'),
  };
}
