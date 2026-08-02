/**
 * 🔴 ADR-739 §29.12 — **ΟΙ ΛΑΒΕΣ ΤΟΥ ΠΙΝΑΚΑ ΔΕΝ ΖΩΓΡΑΦΙΖΟΝΤΑΙ ΜΕΣΑ ΣΤΗ ΛΕΙΤΟΥΡΓΙΑ ΚΕΛΙΩΝ.**
 *
 * Ζητούμενο (ιδιοκτήτης, 2026-08-03, αυτολεξεί): «*σε edit mode του πίνακα οι λαβές του πίνακα
 * είναι εμφανείς — τις θέλω να εμφανίζονται **μόνον όταν βγαίνω** από το edit mode*».
 *
 * ## Γιατί ΔΕΝ είναι νέα έννοια αλλά **η ίδια δοκτρίνα του AutoCAD**
 * Ο φύλακας που υπάρχει ήδη εδώ λέει: «οι λαβές φαίνονται **μόνο** σε κατάσταση επιλογής —
 * καμία ενεργή εντολή· με ενεργό εργαλείο εξαφανίζονται, το εργαλείο έχει δικό του UX». Η
 * λειτουργία κελιών **είναι** ενεργή εντολή: κατέχει το πληκτρολόγιο (ADR-711) και, από το
 * §29, και το ποντίκι. Άρα δεν προστίθεται κριτήριο — **συμπληρώνεται** το υπάρχον με τον
 * δεύτερο τρόπο που μια εντολή μπορεί να είναι ενεργή σε αυτόν τον viewer.
 *
 * ⚠️ **Μην το μπερδέψεις με το §27.16 Ε4** («σε αμφισβήτηση νικά η λαβή»). Εκείνο απαντά
 * «*ποιος κερδίζει το χτύπημα;*» όταν λαβή και ζώνη δείκτη διεκδικούν το ίδιο pixel. Εδώ η
 * ερώτηση είναι άλλη: «*ζωγραφίζεται καθόλου;*». Το Ε4 μένει ακέραιο.
 *
 * @see canvas-v2/dxf-canvas/dxf-canvas-interactive-overlays.ts — η ΜΙΑ πύλη ζωγραφικής λαβών
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — ο ΕΝΑΣ ορισμός του κλειδώματος
 */

import { areGripsAllowed, paintInteractiveOverlays } from '../dxf-canvas-interactive-overlays';
import {
  __resetTableCanvasLockdownForTests,
  __setCanvasLockedByTableSessionForTests,
} from '../../../ui/table-cell-editor/use-table-canvas-lockdown';
import type { DxfEntityUnion, DxfRenderOptions } from '../dxf-types';
import type { DxfRenderer } from '../DxfRenderer';

/** Η κατάσταση όπου οι λαβές **επιτρέπονται** — κάθε test αλλάζει ΕΝΑ πράγμα. */
const ALLOWED = { activeTool: 'select', lockedByTableSession: false } as const;

describe('🔴 ADR-739 §29.12 — καμία λαβή όσο η λειτουργία πίνακα κατέχει τον καμβά', () => {
  it('βάση: με το εργαλείο επιλογής και χωρίς κλείδωμα, οι λαβές επιτρέπονται', () => {
    // Χωρίς αυτό το test, ένα «return false» παντού θα ήταν πράσινο σε όλα τα υπόλοιπα.
    expect(areGripsAllowed(ALLOWED)).toBe(true);
  });

  it('🔴 Δ3 — ΚΛΕΙΔΩΜΕΝΟΣ ΚΑΜΒΑΣ ⇒ καμία λαβή, ακόμα και με το εργαλείο επιλογής', () => {
    expect(areGripsAllowed({ ...ALLOWED, lockedByTableSession: true })).toBe(false);
  });

  it('🔴 το κλείδωμα νικά ΚΑΘΕ εργαλείο που κανονικά δείχνει λαβές', () => {
    // Τα εργαλεία που εξαιρούνται ρητά (ADR-363 Φ1J / ADR-419) δεν επιτρέπεται να γίνουν
    // παραθυράκι: μέσα στη λειτουργία πίνακα καμία λαβή δεν ζωγραφίζεται, από καμία αφορμή.
    for (const activeTool of [undefined, 'select', 'layering', 'wall-on-entity', 'wall-region-inside']) {
      expect(areGripsAllowed({ activeTool, lockedByTableSession: false })).toBe(true);
      expect(areGripsAllowed({ activeTool, lockedByTableSession: true })).toBe(false);
    }
  });

  it('ο υπάρχων φύλακας του εργαλείου μένει ακέραιος — καμία παλινδρόμηση', () => {
    // AutoCAD: ενεργή εντολή ⇒ καμία λαβή. Αυτό ίσχυε πριν και πρέπει να ισχύει μετά.
    expect(areGripsAllowed({ ...ALLOWED, activeTool: 'move' })).toBe(false);
    expect(areGripsAllowed({ ...ALLOWED, activeTool: 'line' })).toBe(false);
  });
});

/**
 * 🔴 **ΤΟ ANCHOR: «ΤΙ ΕΙΠΕ Ο ΖΩΓΡΑΦΟΣ;», ΟΧΙ «ΤΙ ΑΠΑΝΤΑ Η ΠΥΛΗ;»**
 *
 * Μια πύλη πράσινη σε απομόνωση δεν αποδεικνύει ότι κάποιος τη ρωτά: αν σβηστεί η ανάγνωση
 * του κλειδώματος από το `paintInteractiveOverlays`, τα από πάνω tests μένουν **όλα πράσινα**
 * και ο χρήστης ξαναβλέπει τις λαβές μέσα στη λειτουργία κελιών. Εδώ η ερώτηση είναι το
 * αποτέλεσμα: **τι `suppressGrips` έφτασε στην οντότητα;**
 */
const TABLE_ID = 'table-1';
const TABLE_ENTITY = { id: TABLE_ID, type: 'table' } as unknown as DxfEntityUnion;

interface PaintProbe {
  readonly suppressGrips: readonly boolean[];
  readonly renderer: DxfRenderer;
}

function paintProbe(): PaintProbe {
  const suppressGrips: boolean[] = [];
  const renderer = {
    renderSingleEntity: (
      _e: DxfEntityUnion, _t: unknown, _v: unknown, _mode: string,
      interaction: { readonly suppressGrips?: boolean },
    ): void => { suppressGrips.push(interaction.suppressGrips === true); },
  } as unknown as DxfRenderer;
  return { suppressGrips, renderer };
}

function paintSelectedTable(renderer: DxfRenderer): void {
  paintInteractiveOverlays({
    renderer,
    entityMap: new Map([[TABLE_ID, TABLE_ENTITY]]),
    membersByGroupId: new Map(),
    renderOptions: {
      selectedEntityIds: [TABLE_ID],
      hoveredEntityId: null,
    } as unknown as DxfRenderOptions,
    layersById: undefined,
    transform: { scale: 1, offsetX: 0, offsetY: 0 },
    viewport: { width: 800, height: 600 },
    activeTool: 'select',
  });
}

describe('🔴 ADR-739 §29.12 — ο ζωγράφος ΡΩΤΑΕΙ το κλείδωμα τη στιγμή του καρέ', () => {
  afterEach(() => { __resetTableCanvasLockdownForTests(); });

  it('βάση: χωρίς κλείδωμα, ο επιλεγμένος πίνακας ζωγραφίζεται ΜΕ τις λαβές του', () => {
    const { suppressGrips, renderer } = paintProbe();
    paintSelectedTable(renderer);
    expect(suppressGrips).toEqual([false]);
  });

  it('🔴 Δ3 — μέσα στη λειτουργία κελιών ο ίδιος πίνακας ζωγραφίζεται ΧΩΡΙΣ λαβές', () => {
    __setCanvasLockedByTableSessionForTests(true);
    const { suppressGrips, renderer } = paintProbe();
    paintSelectedTable(renderer);
    expect(suppressGrips).toEqual([true]);
  });
});
