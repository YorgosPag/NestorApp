/**
 * ADR-587 Φ3b-2 (Seam 2) — Coverage test: tool-active → contextual-tab resolver.
 *
 * Καρφώνει ότι το «static Map lookup + escape-hatch predicates» (`resolveToolActiveTrigger`)
 * είναι **behavior-preserving** vs το αρχικό ~30-branch if-chain:
 *   1. Κάθε map entry επιστρέφει το σωστό trigger.
 *   2. Τα escape-hatch (wall-drawing / column-region predicates, `guide-`/`dim-`
 *      prefixes, sticky line-modify) επιστρέφουν το σωστό trigger.
 *   3. **Disjointness invariant** — ΚΑΝΕΝΑ map key δεν πιάνεται από escape-hatch
 *      predicate. Αυτό είναι η ΑΠΟΔΕΙΞΗ ότι το «map-first, μετά predicates» δίνει
 *      ταυτόσημο αποτέλεσμα με το αρχικό interleaved if-chain (σειρά = αδιάφορη).
 *   4. Golden pins + unknown → null.
 *
 * Σπάει αν κάποιος προσθέσει map key που επικαλύπτει predicate (σιωπηλή αλλαγή
 * συμπεριφοράς) ή αν ξεχάσει tool→trigger entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 */

// Defensive: a transitive tab-barrel (contextual-stair-tab → stair bridge →
// useFloorMetadata → firestore) touches firebase/auth at import time, which calls
// `fetch` under node. Mock it (same guard as resolve-contextual-trigger-coverage.test.ts).
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import {
  TOOL_ACTIVE_TRIGGER,
  isLineModifyTool,
  resolveToolActiveTrigger,
} from '../resolve-tool-active-trigger';
import { isColumnRegionTool, isWallDrawingTool } from '../../systems/tools/region-tool-ids';
import { WALL_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-wall-tab';
import { COLUMN_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-column-tab';
import { STAIR_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-stair-tab';
import { LINE_TOOL_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-line-tool-tab';
import { GUIDES_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-guides-tab';
import { DIMENSIONS_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-dimensions-tab';
import { ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-annotation-symbol-tab';
import { SCALE_BAR_CONTEXTUAL_TRIGGER } from '../../ui/ribbon/data/contextual-scale-bar-tab';

describe('resolveToolActiveTrigger — static Map', () => {
  it('every map entry resolves to its registered trigger', () => {
    for (const [tool, expected] of TOOL_ACTIVE_TRIGGER) {
      expect(resolveToolActiveTrigger(tool, null)).toBe(expected);
    }
  });

  it('the multi-id families all map to the same shared trigger', () => {
    // 5 column variants → column tab.
    for (const t of ['column', 'column-from-perimeter', 'column-discrete-from-perimeter',
      'column-discrete-from-perimeter-walls', 'column-from-polygon']) {
      expect(resolveToolActiveTrigger(t, null)).toBe(COLUMN_CONTEXTUAL_TRIGGER);
    }
    // A sample of the 14 line tools → line-tool tab.
    for (const t of ['line', 'circle', 'rectangle', 'polyline', 'arc-3p', 'ellipse']) {
      expect(resolveToolActiveTrigger(t, null)).toBe(LINE_TOOL_CONTEXTUAL_TRIGGER);
    }
  });

  it('golden pins for representative single-tool tabs', () => {
    expect(resolveToolActiveTrigger('stair', null)).toBe(STAIR_CONTEXTUAL_TRIGGER);
    expect(resolveToolActiveTrigger('north-arrow', null)).toBe(ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER);
    // ADR-583 Φ3e — graphic scale-bar tool active → «Γραφική Κλίμακα» placement-defaults tab.
    expect(resolveToolActiveTrigger('scale-bar', null)).toBe(SCALE_BAR_CONTEXTUAL_TRIGGER);
    // ADR-583 Φ1b/Φ1c — every annotation-symbol kind opens the SAME shared contextual tab.
    for (const t of ['section-mark', 'grid-bubble', 'elevation-mark',
      'detail-callout', 'revision-tag']) {
      expect(resolveToolActiveTrigger(t, null)).toBe(ANNOTATION_SYMBOL_CONTEXTUAL_TRIGGER);
    }
  });
});

describe('resolveToolActiveTrigger — escape-hatch (predicate / prefix / sticky)', () => {
  it('wall-drawing tools → wall tab (predicate, not in map)', () => {
    for (const t of ['wall', 'wall-on-entity', 'wall-region-inside', 'wall-region-box', 'wall-from-perimeter']) {
      expect(isWallDrawingTool(t)).toBe(true);
      expect(resolveToolActiveTrigger(t, null)).toBe(WALL_CONTEXTUAL_TRIGGER);
    }
  });

  it('column-region tools → column tab (predicate, disjoint from the 5 explicit ids)', () => {
    for (const t of ['column-region-lines', 'column-region-inside', 'column-region-box']) {
      expect(isColumnRegionTool(t)).toBe(true);
      expect(TOOL_ACTIVE_TRIGGER.has(t)).toBe(false);
      expect(resolveToolActiveTrigger(t, null)).toBe(COLUMN_CONTEXTUAL_TRIGGER);
    }
  });

  it('`guide-` / `dim-` prefixed tools → their creation tabs', () => {
    expect(resolveToolActiveTrigger('guide-horizontal', null)).toBe(GUIDES_CONTEXTUAL_TRIGGER);
    expect(resolveToolActiveTrigger('guide-anything', null)).toBe(GUIDES_CONTEXTUAL_TRIGGER);
    expect(resolveToolActiveTrigger('dim-linear', null)).toBe(DIMENSIONS_CONTEXTUAL_TRIGGER);
    expect(resolveToolActiveTrigger('dim-angular', null)).toBe(DIMENSIONS_CONTEXTUAL_TRIGGER);
  });

  it('tab-neutral line-modify tools return the sticky last-non-modify trigger verbatim', () => {
    for (const t of ['trim', 'extend', 'offset', 'fillet', 'chamfer']) {
      expect(isLineModifyTool(t)).toBe(true);
      // Returns whatever the caller passes — preserves the current context.
      expect(resolveToolActiveTrigger(t, WALL_CONTEXTUAL_TRIGGER)).toBe(WALL_CONTEXTUAL_TRIGGER);
      expect(resolveToolActiveTrigger(t, null)).toBeNull();
    }
  });

  it('unknown / non-contextual tools → null', () => {
    expect(resolveToolActiveTrigger('select', null)).toBeNull();
    expect(resolveToolActiveTrigger('', null)).toBeNull();
    expect(resolveToolActiveTrigger('__nope__', null)).toBeNull();
  });
});

describe('resolveToolActiveTrigger — disjointness invariant (reorder safety proof)', () => {
  it('NO static map key is matched by any escape-hatch predicate/prefix', () => {
    // This is what makes "map-first, then predicates" identical to the original
    // interleaved if-chain: the two domains never overlap, so ordering is neutral.
    for (const tool of TOOL_ACTIVE_TRIGGER.keys()) {
      expect(isWallDrawingTool(tool)).toBe(false);
      expect(isColumnRegionTool(tool)).toBe(false);
      expect(tool.startsWith('guide-')).toBe(false);
      expect(tool.startsWith('dim-')).toBe(false);
      expect(isLineModifyTool(tool)).toBe(false);
    }
  });

  it('escape-hatch domains are mutually disjoint (each predicate sample fails the others)', () => {
    expect(isColumnRegionTool('wall-region-box')).toBe(false); // wall-drawing sample
    expect(isWallDrawingTool('column-region-box')).toBe(false); // column-region sample
    expect(isWallDrawingTool('guide-x')).toBe(false);
    expect(isLineModifyTool('dim-linear')).toBe(false);
  });
});
