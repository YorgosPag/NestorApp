# ADR-597 — BIM Corner Snap System (Revit/ArchiCAD-grade Face-Corner Snapping)

> **Note**: This document is numbered **ADR-597**. It was historically drafted as ADR-370, then briefly renumbered ADR-371 — both collided with existing documents (`ADR-370-bim-readonly-visualization.md` and `ADR-371-bim-3d-readonly-viewer.md`). Resolved 2026-07-08 (big-player rule: immutable ADR numbers → the colliding doc takes a fresh unique number). ADR-597 is now the sole owner across docs + src + auto-memory.

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **IMPLEMENTED** 2026-05-22 — Phases 2A-2F complete. 27 files created/edited. Integration test (S1-S5) added 2026-05-22. Bugfix: SnapContext.ALL_MODES missing BIM types fixed 2026-05-22. Extension: Wall Face Corner Projection Snap (Revit-style) added 2026-05-22. Extension (ADR-398): Column Body Corner Projection Snap — move/resize/draw parity, added 2026-05-29 (§17). **Consolidation 2026-06-11: 5→1 generic `BimCharacteristicSnapEngine` + `bim-characteristic-points.ts` SSoT dispatcher; corner+midpoint+center για ΟΛΕΣ τις BIM οντότητες; 5 `BIM_*_CORNER` types → `BIM_CORNER`+`BIM_MIDPOINT`+`BIM_CENTER`; composition labels. **Bugfix 2026-06-11: «Μέσο/Κέντρο ποτέ» → priority numbers −1.7 (ίσα, αρνητικά) + iteration-order anti-starvation (§15) — BROWSER-VERIFIED (Giorgio).** commit pending.** |
| **Date** | 2026-05-22 |
| **Category** | DXF Viewer — Snapping / BIM Precision |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-597-bim-corner-snap-system.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Related ADRs** | ADR-040 (Preview Canvas Perf), ADR-087 (Snap Engine Config), ADR-137 (Snap Icon Geometry), ADR-378 (Snap System Master Architecture — supersedes phantom ADR-149), ADR-189 (Construction Guides), ADR-363 (BIM Drawing Mode — Phase 5.5d/5.5i column anchor template), ADR-362 (Dimensions) |
| **Implementation template** | `ColumnCenterSnapEngine` (ADR-363 Phase 5.5i) + `column-anchors.ts` (ADR-363 Phase 5.5d) |

---

## Summary

Επέκταση του Pro Snap Engine V2 με **4+1 νέους snap engines** που επιτρέπουν στον χρήστη να snap-άρει με ακρίβεια στις **γωνίες της διατομής** των BIM οντοτήτων (τοίχοι, δοκάρια, πλάκες, κολώνες, ανοίγματα), αντί μόνο στα κεντρικά grips του άξονα.

**Το πρόβλημα**: Όταν ο μηχανικός σχεδιάζει έναν τοίχο BIM, εμφανίζονται 3 grips πάνω στον άξονα (start/end/midpoint). Αν θέλει να ενώσει τις **εξωτερικές γωνίες** δύο τοίχων (industry-standard wall corner alignment), τα grips δεν αρκούν — βρίσκονται μισό πάχος μέσα από την πραγματική γωνία.

**Η λύση**: Ξεχωριστά snap engines που εκθέτουν τα 4 corner points (start-left, start-right, end-left, end-right για τοίχους — 4 outline vertices για δοκάρια — N polygon vertices για πλάκες — 4 bbox corners για κολώνες — 4 outline corners για ανοίγματα), διαθέσιμα ως snap targets με την υψηλότερη προτεραιότητα (-2 στην ιεραρχία ADR-378 §5).

Mirror του Revit "Wall Endpoint snap" + ArchiCAD "Hotspots on edges" + Vectorworks "Smart Edge" pattern.

---

## 1. Context

### 1.1 Η αφορμή (2026-05-22 dialogue)

Γιώργος: «Πάνω σε ένα σχέδιο DXF που ήδη έχω φορτώσει στον καμβά. Πώς μπορώ να ταυτίζω τις γωνίες αυτών των οντοτήτων μεταξύ τους, γιατί τα grips υπάρχουν μόνο στο κέντρο του άξονα του τοίχου και του δοκαριού. Αν θέλω να ταυτιστούν δύο γωνίες, τι πρέπει να κάνω; Τι κάνουν σε αυτήν την περίπτωση οι μεγάλοι παίκτες όπως η Revit;»

### 1.2 Γιατί δεν αρκούν τα υπάρχοντα

| Snap Engine | Τι κάνει | Γιατί δεν λύνει το πρόβλημα |
|---|---|---|
| `EndpointSnapEngine` (priority 0) | Snap στα endpoints των line/arc/polyline entities | Πιάνει τα ENDPOINTS των wall outerEdge/innerEdge polylines αλλά: (α) δεν έχει σημασιολογικό label "Γωνία τοίχου" — απλό "Άκρο", (β) δεν διαχωρίζει DXF γραμμές από BIM corners (mixed candidate list), (γ) δεν εγγυάται προτεραιότητα έναντι centerline grips. |
| `ColumnCenterSnapEngine` (priority -1) | Structural column axis center | Δίνει 1 σημείο (κέντρο). Δεν δίνει τις 4 γωνίες του rect/L/T footprint. |
| `IntersectionSnapEngine` (priority 0) | Τομές γραμμών | Δουλεύει μόνο όταν οι 2 outerEdge polylines τέμνονται ήδη — όχι όταν τις πλησιάζουμε. |

### 1.3 Industry alignment

| Λογισμικό | Αντίστοιχο feature |
|---|---|
| **Revit** | Endpoint + Midpoint snap on wall **reference lines** + face joins. Όταν 2 wall endpoints είναι κοντά → auto-join με clean miter cut. Face snap = exact corner. |
| **ArchiCAD** | "Hotspots" σε wall edges/corners — βαρειά τελείες που δείχνουν τα 4 ή 6 corners ανά τοίχο. |
| **Vectorworks** | "Smart Cursor" hover στις γωνίες παραμετρικών wall objects → snap label "Wall corner". |
| **AutoCAD** | OSnap ENDPOINT στις 4 γωνίες polyline outline — υπάρχει αλλά είναι generic, χωρίς BIM semantic. |

### 1.4 Decision

Δημιουργία **νέου επιπέδου snap** (BIM corners), παράλληλο με το υπάρχον BIM center axis (Phase 5.5i), που:
1. Δίνει σημασιολογικά labels («Γωνία τοίχου», «Γωνία δοκαριού», ...).
2. Έχει την υψηλότερη snap priority (-2 < -1 column center < 0 endpoint).
3. Έχει δικό του visual marker (L-bracket ┘) που διακρίνεται από το generic endpoint ■.
4. Καταναλώνει **υφιστάμενη γεωμετρία** (`WallGeometry.outerEdge`, `BeamGeometry.outline`, κλπ) — ZERO duplication.

---

## 2. Στόχοι (Goals)

| # | Στόχος | Phase |
|---|--------|-------|
| G1 | Snap στις 4 γωνίες ενός straight wall (start-left, start-right, end-left, end-right) | Phase 2 |
| G2 | Snap στις γωνίες των polyline/curved walls (N vertices × 2 faces) | Phase 2 |
| G3 | Snap στις outline corners δοκαριού (4 για straight, 2N για curved) | Phase 2 |
| G4 | Snap στα polygon vertices πλάκας | Phase 2 |
| G5 | Snap στις 4 bbox γωνίες κολώνας (rectangular/L/T/circular) | Phase 2 |
| G6 | Snap στις 4 corners παραστατών ανοίγματος (door/window jamb corners) | Phase 2 |
| G7 | Visual indicator διακριτικό από generic endpoint (L-bracket symbol) | Phase 4 |
| G8 | i18n labels (el + en) με ξεχωριστή έκφραση ανά entity type | Phase 4 |
| G9 | Settings UI toggle (default ON) | Phase 5 |
| G10 | 100% test coverage (5 anchor modules + 5 engines + integration) | Phase 6 |

---

## 3. Architecture

### 3.1 Layer Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  BIM Entity Layer (existing)                                 │
│  WallEntity / BeamEntity / SlabEntity / ColumnEntity /       │
│  OpeningEntity → geometry: { outerEdge / outline / polygon } │
└────────────────┬─────────────────────────────────────────────┘
                 │ (read-only consume)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Anchor SSoT Modules (NEW — pure functions)                  │
│  wall-corner-anchors.ts   → getWallCornerWorldPoints()       │
│  beam-corner-anchors.ts   → getBeamCornerWorldPoints()       │
│  slab-corner-anchors.ts   → getSlabCornerWorldPoints()       │
│  column-corner-anchors.ts → getColumnCornerWorldPoints()     │
│  opening-corner-anchors.ts→ getOpeningCornerWorldPoints()    │
└────────────────┬─────────────────────────────────────────────┘
                 │ (consume by snap engine)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Snap Engine Layer (NEW — extends BaseSnapEngine)            │
│  WallCornerSnapEngine / BeamCornerSnapEngine /               │
│  SlabCornerSnapEngine / ColumnCornerSnapEngine /             │
│  OpeningCornerSnapEngine                                     │
│    → initialize(): builds RBush spatial index per entity     │
│    → findSnapCandidates(): query within world radius         │
└────────────────┬─────────────────────────────────────────────┘
                 │ (registered in)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  SnapEngineRegistry (EDITED — +5 engine.set calls)           │
└────────────────┬─────────────────────────────────────────────┘
                 │ (orchestrated by)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  ProSnapEngineV2 (existing — no changes)                     │
│  findSnapPoint(cursor) → iterates by priority → returns      │
│    best candidate                                            │
└────────────────┬─────────────────────────────────────────────┘
                 │ (renders via)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  SnapIndicatorOverlay (EDITED — +5 SnapShape cases)          │
│  Cases: bim_wall_corner, bim_beam_corner, bim_slab_corner,   │
│         bim_column_corner, bim_opening_corner                │
│  Visual: ┘ L-bracket (corner mark)                           │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 SSoT Strategy (Zero Duplication)

| BIM Entity | Corner SSoT Source | Number of Corners |
|---|---|---|
| **Wall** (straight) | `wallEntity.geometry.outerEdge.points[0/last]` + `innerEdge.points[0/last]` | 4 |
| **Wall** (polyline N vertices) | outerEdge + innerEdge όλα τα vertices | 2N |
| **Wall** (curved) | start + end corners μόνο (subdivided Bezier = 17×2 = πολύς θόρυβος) | 4 |
| **Beam** (straight) | `beamEntity.geometry.outline.vertices[0..3]` | 4 |
| **Beam** (curved) | First & last 2 outline vertices (start corners + end corners) | 4 |
| **Slab** | `slabEntity.geometry.polygon.vertices[*]` | N (3+) |
| **Column** (rect/L/T) | `columnEntity.geometry.footprint.vertices[0..3]` (rect bbox) | 4 |
| **Column** (circular) | bbox-quad corners (N/S/E/W περιφερειακά) | 4 |
| **Opening** | `openingEntity.geometry.outline.vertices[0..3]` (4 jamb corners) | 4 |

**Σημαντικό**: ΟΛΕΣ οι corner sources είναι **υφιστάμενες υπολογισμένες γεωμετρίες**. Τα anchor modules κάνουν μόνο extract + tag — δεν κάνουν νέους geometric computations.

### 3.3 Priority Hierarchy

```
SNAP_ENGINE_PRIORITIES (tolerance-config.ts):
─────────────────────────────────────────────
-2  BIM_WALL_CORNER    ← NEW (highest)
-2  BIM_BEAM_CORNER    ← NEW
-2  BIM_SLAB_CORNER    ← NEW
-2  BIM_COLUMN_CORNER  ← NEW
-2  BIM_OPENING_CORNER ← NEW
-1  BIM_COLUMN_CENTER  ← existing (ADR-363 Phase 5.5i)
 0  ENDPOINT, INTERSECTION
 1  MIDPOINT, NODE
 2  INSERTION, DIM_DEF_POINT
 3  CENTER, DIM_LINE
...
```

**Γιατί -2**: Όταν cursor είναι κοντά σε wall corner, το ENDPOINT engine πιάνει το ίδιο σημείο (vertex του outerEdge polyline) με priority 0. Θέλουμε το BIM_WALL_CORNER να νικάει — γιατί δίνει σωστότερο semantic + δικό του visual + structured tooltip.

### 3.4 Visual Indicator

> ⚠️ **SUPERSEDED από §unified-glyph (2026-07-05).** Το αρχικό design έδινε ξεχωριστά
> σύμβολα στα BIM snaps (┘ corner, ▲ midpoint, ⊕ centre) με δικά τους χρώματα. Αυτό
> δημιουργούσε **δύο οπτικά λεξιλόγια για το ίδιο ΕΙΔΟΣ σημείου** (μια γωνία εμφανιζόταν
> ■ κόκκινο ως raw endpoint αλλά ┘ πορτοκαλί ως BIM γωνία). Οι μεγάλοι (Revit/AutoCAD)
> δείχνουν **ΕΝΑ** σύμβολο ανά είδος σημείου, με τη σημασιολογία στην **ετικέτα**. Βλ.
> §unified-glyph παρακάτω. Το παρακάτω L-bracket snippet κρατιέται μόνο ως ιστορικό.

```svg
<!-- ┘ L-bracket — corner mark (ΙΣΤΟΡΙΚΟ — καταργήθηκε, βλ. §unified-glyph)
     Stroke 2px, color = canvasUI.overlay.colors.snap.border -->
<svg viewBox="0 0 14 14">
  <polyline points="3,3 3,11 11,11"
            stroke={color}
            strokeWidth={2}
            fill="none"/>
</svg>
```

### 3.4b §unified-glyph (2026-07-05) — ΕΝΑ οπτικό λεξιλόγιο (Revit/AutoCAD-grade)

Ένα BIM `corner` / `midpoint` / `center` είναι το **ίδιο ΕΙΔΟΣ σημείου** με το γεωμετρικό
`endpoint` / `midpoint` / `center`. Άρα μοιράζονται **ίδιο σχήμα ΚΑΙ ίδιο χρώμα**:

| BIM τύπος | Σύμβολο | Χρώμα (= γεωμετρικό) |
|---|---|---|
| `bim_corner`   | ■ (endpoint square) | κόκκινο (`ENDPOINT`) |
| `bim_midpoint` | △ (midpoint triangle) | πράσινο (`MIDPOINT`) |
| `bim_center`   | ○ (center circle) | μπλε (`CENTER`) |

Η διάκριση οντότητας («Γωνία κολώνας» / «Μέσο τοίχου») ζει **ΜΟΝΟ** στην ετικέτα
(`bimLabel` → `resolveBimSnapLabelText`), όπως Revit/AutoCAD tooltips. Τα `bim_wall_face`
/ `bim_mep_connector` είναι **ξεχωριστά ΕΙΔΗ** σημείου → κρατούν δικό τους σύμβολο/χρώμα.

**SSoT υλοποίησης** (2 σημεία, εφαρμόζεται αυτόματα σε ΟΛΕΣ τις BIM/δομικές/ΗΜ οντότητες):
- Σχήμα: `canvas-v2/overlays/SnapIndicatorGlyph.tsx` — `case 'endpoint'|'bim_corner'` κ.λπ.
- Χρώμα: `rendering/ui/snap/snap-visual-config.ts` — `SNAP_COLORS` → `SNAP_MARKER_COLORS.ENDPOINT/MIDPOINT/CENTER`.
- Regression guard: `rendering/ui/snap/__tests__/snap-visual-config.test.ts` (4/4).

---

## 4. Type System Updates

### 4.1 `extended-types.ts` (1 edit)

```typescript
export enum ExtendedSnapType {
  // ... existing values ...
  BIM_COLUMN_CENTER = 'bim_column_center',  // existing (ADR-363 Phase 5.5i)

  // ADR-370: BIM corner snap (face corners of parametric entities)
  BIM_WALL_CORNER    = 'bim_wall_corner',
  BIM_BEAM_CORNER    = 'bim_beam_corner',
  BIM_SLAB_CORNER    = 'bim_slab_corner',
  BIM_COLUMN_CORNER  = 'bim_column_corner',
  BIM_OPENING_CORNER = 'bim_opening_corner',

  AUTO = 'auto'
}
```

In `DEFAULT_PRO_SNAP_SETTINGS`:
```typescript
enabledTypes: new Set([
  // ... existing values ...
  ExtendedSnapType.BIM_COLUMN_CENTER,
  ExtendedSnapType.BIM_WALL_CORNER,    // ADR-370
  ExtendedSnapType.BIM_BEAM_CORNER,    // ADR-370
  ExtendedSnapType.BIM_SLAB_CORNER,    // ADR-370
  ExtendedSnapType.BIM_COLUMN_CORNER,  // ADR-370
  ExtendedSnapType.BIM_OPENING_CORNER, // ADR-370
]),
priority: [
  // ADR-370: BIM corners — highest priority (face geometry precision)
  ExtendedSnapType.BIM_WALL_CORNER,
  ExtendedSnapType.BIM_BEAM_CORNER,
  ExtendedSnapType.BIM_SLAB_CORNER,
  ExtendedSnapType.BIM_COLUMN_CORNER,
  ExtendedSnapType.BIM_OPENING_CORNER,
  ExtendedSnapType.BIM_COLUMN_CENTER,  // existing — center axis
  ExtendedSnapType.INTERSECTION,
  ExtendedSnapType.ENDPOINT,
  // ... rest unchanged
],
perModePxTolerance: {
  // ... existing ...
  [ExtendedSnapType.BIM_COLUMN_CENTER]: 10,
  [ExtendedSnapType.BIM_WALL_CORNER]:    10,  // ADR-370
  [ExtendedSnapType.BIM_BEAM_CORNER]:    10,  // ADR-370
  [ExtendedSnapType.BIM_SLAB_CORNER]:    10,  // ADR-370
  [ExtendedSnapType.BIM_COLUMN_CORNER]:  10,  // ADR-370
  [ExtendedSnapType.BIM_OPENING_CORNER]: 10,  // ADR-370
}
```

### 4.2 `tolerance-config.ts` (1 edit)

```typescript
export const SNAP_ENGINE_PRIORITIES = {
  // ... existing ...
  BIM_COLUMN_CENTER: -1,
  // ADR-370: BIM corner snaps — highest priority
  BIM_WALL_CORNER:    -2,
  BIM_BEAM_CORNER:    -2,
  BIM_SLAB_CORNER:    -2,
  BIM_COLUMN_CORNER:  -2,
  BIM_OPENING_CORNER: -2,
} as const;
```

---

## 5. Anchor SSoT Modules (Phase 2B)

Όλα ακολουθούν αυστηρά το πρότυπο `bim/columns/column-anchors.ts` (ADR-363 Phase 5.5d):

### 5.1 `bim/walls/wall-corner-anchors.ts`

```typescript
/**
 * ADR-370 — Wall corner anchor world-point exposure (pure SSoT).
 * Mirror του column-anchors.ts (ADR-363 Phase 5.5d).
 *
 * Industry convention (Revit/ArchiCAD): wall corners ζουν στα 4 σημεία όπου
 * outerEdge και innerEdge faces τέμνονται με τα start/end caps του τοίχου.
 * Για polyline walls όλα τα vertices ×2 (inner+outer) — N×2 corners.
 * Για curved walls μόνο start/end faces (4 corners) — subdivisions = noise.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallEntity } from '../types/wall-types';
import { computeWallGeometry } from '../geometry/wall-geometry';

export type WallCornerAnchor =
  | 'start-left' | 'start-right'
  | 'end-left'   | 'end-right'
  | `vertex-${number}-left` | `vertex-${number}-right`;

export interface WallCornerWorldPoint {
  readonly anchor: WallCornerAnchor;
  readonly point: Point2D;
}

export function getWallCornerWorldPoints(
  wall: Readonly<WallEntity>,
): readonly WallCornerWorldPoint[] {
  const geom = wall.geometry ?? computeWallGeometry(wall.params, wall.kind);
  const outer = geom.outerEdge.points;
  const inner = geom.innerEdge.points;
  if (outer.length < 2 || inner.length < 2) return [];

  // Straight or curved: 4 corners (start/end × left/right)
  if (wall.kind !== 'polyline') {
    return [
      { anchor: 'start-left',  point: { x: outer[0]!.x,             y: outer[0]!.y } },
      { anchor: 'start-right', point: { x: inner[0]!.x,             y: inner[0]!.y } },
      { anchor: 'end-left',    point: { x: outer[outer.length-1]!.x, y: outer[outer.length-1]!.y } },
      { anchor: 'end-right',   point: { x: inner[inner.length-1]!.x, y: inner[inner.length-1]!.y } },
    ];
  }

  // Polyline: all vertices × 2 faces
  const result: WallCornerWorldPoint[] = [];
  for (let i = 0; i < outer.length; i++) {
    result.push(
      { anchor: `vertex-${i}-left`  as WallCornerAnchor, point: { x: outer[i]!.x, y: outer[i]!.y } },
      { anchor: `vertex-${i}-right` as WallCornerAnchor, point: { x: inner[i]!.x, y: inner[i]!.y } },
    );
  }
  return result;
}
```

### 5.2 `bim/beams/beam-corner-anchors.ts`

```typescript
/**
 * ADR-370 — Beam corner anchor world-point exposure (pure SSoT).
 *
 * Industry convention: beam outline = CCW polygon (width × length).
 * Straight/cantilever: 4 corners (outline vertices [0..3]).
 * Curved: outline has 2N vertices — εκθέτουμε μόνο τα 4 corners των 2 caps
 * (first 2 + last 2 = start-cap corners + end-cap corners).
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamEntity } from '../types/beam-types';
import { computeBeamGeometry } from '../geometry/beam-geometry';

export type BeamCornerAnchor =
  | 'start-plus' | 'start-minus'
  | 'end-plus'   | 'end-minus';

export interface BeamCornerWorldPoint {
  readonly anchor: BeamCornerAnchor;
  readonly point: Point2D;
}

export function getBeamCornerWorldPoints(
  beam: Readonly<BeamEntity>,
): readonly BeamCornerWorldPoint[] {
  const geom = beam.geometry ?? computeBeamGeometry(beam.params);
  const verts = geom.outline.vertices;
  if (verts.length < 4) return [];

  // outline CCW: [plus[0..N-1], minus[N-1..0]] — έτσι:
  //   start-plus  = verts[0]
  //   end-plus    = verts[N-1] (όπου N = halfLen)
  //   end-minus   = verts[N]   (πρώτο vertex του minus reverse)
  //   start-minus = verts[verts.length-1]
  const halfLen = verts.length / 2;
  return [
    { anchor: 'start-plus',  point: { x: verts[0]!.x,               y: verts[0]!.y } },
    { anchor: 'end-plus',    point: { x: verts[halfLen-1]!.x,       y: verts[halfLen-1]!.y } },
    { anchor: 'end-minus',   point: { x: verts[halfLen]!.x,         y: verts[halfLen]!.y } },
    { anchor: 'start-minus', point: { x: verts[verts.length-1]!.x,  y: verts[verts.length-1]!.y } },
  ];
}
```

### 5.3 `bim/slabs/slab-corner-anchors.ts`

```typescript
/**
 * ADR-370 — Slab corner anchor world-point exposure (pure SSoT).
 *
 * Slab outline = closed CCW polygon (N≥3 vertices). Όλα τα vertices είναι
 * corner snap points. Mirror του ArchiCAD slab corner hotspots.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SlabEntity } from '../types/slab-types';
import { computeSlabGeometry } from '../geometry/slab-geometry';

export interface SlabCornerWorldPoint {
  readonly anchor: `vertex-${number}`;
  readonly point: Point2D;
}

export function getSlabCornerWorldPoints(
  slab: Readonly<SlabEntity>,
): readonly SlabCornerWorldPoint[] {
  const geom = slab.geometry ?? computeSlabGeometry(slab.params);
  const verts = geom.polygon.vertices;
  if (verts.length < 3) return [];

  return verts.map((v, i) => ({
    anchor: `vertex-${i}` as const,
    point: { x: v.x, y: v.y },
  }));
}
```

### 5.4 `bim/columns/column-corner-anchors.ts`

```typescript
/**
 * ADR-370 — Column corner anchor world-point exposure (pure SSoT).
 *
 * Επαναχρησιμοποιεί τα 4 cardinal-diagonal anchors (nw/ne/se/sw) από το
 * υπάρχον column-anchors.ts (ADR-363 Phase 5.5d) — αυτά ΕΙΝΑΙ οι 4 corners
 * της bbox της κολώνας (rect/L/T/circular).
 *
 * Δεν διπλοκωδικοποιούμε — απλό re-tag των NW/NE/SW/SE anchor points.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ColumnEntity } from '../types/column-types';
import { getColumnAnchorWorldPoints } from './column-anchors';

export type ColumnCornerAnchor = 'nw' | 'ne' | 'se' | 'sw';

export interface ColumnCornerWorldPoint {
  readonly anchor: ColumnCornerAnchor;
  readonly point: Point2D;
}

const CORNER_SET: ReadonlyArray<ColumnCornerAnchor> = ['nw', 'ne', 'se', 'sw'];

export function getColumnCornerWorldPoints(
  column: Readonly<ColumnEntity>,
): readonly ColumnCornerWorldPoint[] {
  const all = getColumnAnchorWorldPoints(column);
  const result: ColumnCornerWorldPoint[] = [];
  for (const a of all) {
    if ((CORNER_SET as readonly string[]).includes(a.anchor)) {
      result.push({ anchor: a.anchor as ColumnCornerAnchor, point: a.point });
    }
  }
  return result;
}
```

### 5.5 `bim/walls/opening-corner-anchors.ts`

```typescript
/**
 * ADR-370 — Opening corner anchor world-point exposure (pure SSoT).
 *
 * Opening outline = 4-corner rectangle on host wall axis (width × wall.thickness).
 * Τα 4 vertices = οι 4 jamb corners (παραστάτες) — start-outer, start-inner,
 * end-outer, end-inner κατά το CCW του outline.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { OpeningEntity } from '../types/opening-types';
import type { WallEntity } from '../types/wall-types';
import { computeOpeningGeometry } from '../geometry/opening-geometry';

export type OpeningCornerAnchor = 'jamb-0' | 'jamb-1' | 'jamb-2' | 'jamb-3';

export interface OpeningCornerWorldPoint {
  readonly anchor: OpeningCornerAnchor;
  readonly point: Point2D;
}

export function getOpeningCornerWorldPoints(
  opening: Readonly<OpeningEntity>,
  hostWall: Readonly<WallEntity>,
): readonly OpeningCornerWorldPoint[] {
  const geom = opening.geometry ?? computeOpeningGeometry(opening.params, hostWall);
  const verts = geom.outline.vertices;
  if (verts.length < 4) return [];

  return [
    { anchor: 'jamb-0', point: { x: verts[0]!.x, y: verts[0]!.y } },
    { anchor: 'jamb-1', point: { x: verts[1]!.x, y: verts[1]!.y } },
    { anchor: 'jamb-2', point: { x: verts[2]!.x, y: verts[2]!.y } },
    { anchor: 'jamb-3', point: { x: verts[3]!.x, y: verts[3]!.y } },
  ];
}
```

**Σημείωση**: Το opening χρειάζεται host wall για να υπολογίσει geometry. Το snap engine θα κάνει lookup μέσω `entities.find(e => e.id === opening.params.wallId)`.

---

## 6. Snap Engines (Phase 2C)

Όλα ακολουθούν αυστηρά το πρότυπο `ColumnCenterSnapEngine.ts` (ADR-363 Phase 5.5i):

### 6.1 Skeleton (applies to all 5)

```typescript
/**
 * ADR-370 — XxxCornerSnapEngine.
 * Snaps to corner anchor points of Xxx entities.
 * Priority: -2 (BIM_XXX_CORNER) — supersedes ENDPOINT (0) and BIM_COLUMN_CENTER (-1).
 *
 * Industry convention: Revit "Endpoint on Wall Face" + ArchiCAD "Wall Corner Hotspot".
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import type { ISpatialIndex } from '../../core/spatial';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { isXxxEntity } from '../../types/entities';
import { getXxxCornerWorldPoints } from '../../bim/.../xxx-corner-anchors';

export class XxxCornerSnapEngine extends BaseSnapEngine {
  private spatialIndex: ISpatialIndex | null = null;

  constructor() {
    super(ExtendedSnapType.BIM_XXX_CORNER);
  }

  initialize(entities: EntityModel[]): void {
    this.spatialIndex = this.initializeSpatialIndex(
      entities,
      (entity) => extractXxxCorners(entity, entities),  // entities arg για opening's hostWall lookup
      'xxx_corner',
    );
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (!this.spatialIndex) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.BIM_XXX_CORNER;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.BIM_XXX_CORNER);

    const results = this.normalizeSnapResults(
      this.spatialIndex.querySnap(cursorPoint, radius, 'xxx_corner'),
    );

    const candidates: SnapCandidate[] = [];
    for (const result of results) {
      const { point, entity } = result.data;
      if (context.excludeEntityId && entity.id === context.excludeEntityId) continue;

      candidates.push(this.createCandidate(
        point,
        'bim-xxx-corner',
        result.distance,
        priority,
        entity.id,
      ));

      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  dispose(): void {
    this.spatialIndex?.clear();
  }
}

function extractXxxCorners(entity: EntityModel, allEntities?: EntityModel[]): Point2D[] {
  if (!isXxxEntity(entity)) return [];
  const corners = getXxxCornerWorldPoints(entity /* + hostWall lookup for opening */);
  return corners.map(c => c.point);
}
```

**Specifics per engine:**

| Engine | snapType | description | isGuard | anchor module |
|---|---|---|---|---|
| `WallCornerSnapEngine` | `BIM_WALL_CORNER` | `'bim-wall-corner'` | `isWallEntity` | `getWallCornerWorldPoints` |
| `BeamCornerSnapEngine` | `BIM_BEAM_CORNER` | `'bim-beam-corner'` | `isBeamEntity` | `getBeamCornerWorldPoints` |
| `SlabCornerSnapEngine` | `BIM_SLAB_CORNER` | `'bim-slab-corner'` | `isSlabEntity` | `getSlabCornerWorldPoints` |
| `ColumnCornerSnapEngine` | `BIM_COLUMN_CORNER` | `'bim-column-corner'` | `isColumnEntity` | `getColumnCornerWorldPoints` |
| `OpeningCornerSnapEngine` | `BIM_OPENING_CORNER` | `'bim-opening-corner'` | `isOpeningEntity` | `getOpeningCornerWorldPoints` (+ hostWall lookup) |

**Opening engine ειδοποίηση**: Πρέπει να λάβει `entities` array στο `extractOpeningCorners()` για να βρει το host wall μέσω `entities.find(e => isWallEntity(e) && e.id === opening.params.wallId)`. Αν host wall δεν βρεθεί (orphan), επιστρέφει `[]`.

---

## 7. Registry + Indicator + i18n (Phase 2D)

### 7.1 `SnapEngineRegistry.ts` edit

```typescript
// imports
import { WallCornerSnapEngine } from '../engines/WallCornerSnapEngine';
import { BeamCornerSnapEngine } from '../engines/BeamCornerSnapEngine';
import { SlabCornerSnapEngine } from '../engines/SlabCornerSnapEngine';
import { ColumnCornerSnapEngine } from '../engines/ColumnCornerSnapEngine';
import { OpeningCornerSnapEngine } from '../engines/OpeningCornerSnapEngine';

// In initializeEngines() — after BIM_COLUMN_CENTER:
// ADR-370 — BIM corner snaps (face precision)
this.engines.set(ExtendedSnapType.BIM_WALL_CORNER, new WallCornerSnapEngine());
this.engines.set(ExtendedSnapType.BIM_BEAM_CORNER, new BeamCornerSnapEngine());
this.engines.set(ExtendedSnapType.BIM_SLAB_CORNER, new SlabCornerSnapEngine());
this.engines.set(ExtendedSnapType.BIM_COLUMN_CORNER, new ColumnCornerSnapEngine());
this.engines.set(ExtendedSnapType.BIM_OPENING_CORNER, new OpeningCornerSnapEngine());
```

### 7.2 `SnapIndicatorOverlay.tsx` edits

**Add to `BIM_DESCRIPTION_KEY` map:**
```typescript
const BIM_DESCRIPTION_KEY: Record<string, string> = {
  'bim-wall':           'snapModes.labels.bim.wallAxis',
  'bim-slab':           'snapModes.labels.bim.slabEdge',
  'bim-opening':        'snapModes.labels.bim.openingJamb',
  'bim-column':         'snapModes.labels.bim.columnAxis',
  // ADR-370 corner snaps
  'bim-wall-corner':    'snapModes.labels.bim.wallCorner',
  'bim-beam-corner':    'snapModes.labels.bim.beamCorner',
  'bim-slab-corner':    'snapModes.labels.bim.slabCorner',
  'bim-column-corner':  'snapModes.labels.bim.columnCorner',
  'bim-opening-corner': 'snapModes.labels.bim.openingCorner',
};
```

**Add to `SnapShape()` switch (5 new cases):**
```typescript
// ┘ BIM_*_CORNER: L-bracket — face corner precision (ADR-370)
// Revit/ArchiCAD convention: distinct from generic endpoint ■
case 'bim_wall_corner':
case 'bim_beam_corner':
case 'bim_slab_corner':
case 'bim_column_corner':
case 'bim_opening_corner':
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <polyline
        points={`${strokeWidth},${strokeWidth} ${strokeWidth},${size - strokeWidth} ${size - strokeWidth},${size - strokeWidth}`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
      />
    </svg>
  );
```

### 7.3 i18n locale edits

**`src/i18n/locales/el/dxf-viewer-shell.json`** — add inside `snapModes.labels.bim`:
```json
{
  "snapModes": {
    "labels": {
      "bim": {
        "wallAxis": "Επί άξονα τοίχου",
        "slabEdge": "Επί ακμής πλάκας",
        "openingJamb": "Επί παραστάτη ανοίγματος",
        "columnAxis": "Επί άξονα κολώνας",
        "wallCorner": "Γωνία τοίχου",
        "beamCorner": "Γωνία δοκαριού",
        "slabCorner": "Γωνία πλάκας",
        "columnCorner": "Γωνία κολώνας",
        "openingCorner": "Γωνία ανοίγματος"
      }
    },
    "tooltips": {
      "bimWallCorner":    "Γωνίες Τοίχου — Snap στις γωνίες της διατομής (start/end × αριστερά/δεξιά)",
      "bimBeamCorner":    "Γωνίες Δοκαριού — Snap στις γωνίες outline (start/end × ±width)",
      "bimSlabCorner":    "Γωνίες Πλάκας — Snap στις κορυφές του πολυγώνου",
      "bimColumnCorner":  "Γωνίες Κολώνας — Snap στις 4 bbox γωνίες (NW/NE/SE/SW)",
      "bimOpeningCorner": "Γωνίες Ανοίγματος — Snap στους 4 παραστάτες (jambs)"
    }
  }
}
```

**`src/i18n/locales/en/dxf-viewer-shell.json`** — αντίστοιχα στα Αγγλικά (mirror keys).

---

## 8. Settings UI (Phase 2E)

**Στόχος**: Toggle for each of the 5 corner snap types.

**Phase 2E specifics will be defined when implementing — Sonnet first searches the existing snap settings panel via:**
```bash
grep -r "BIM_COLUMN_CENTER" src/subapps/dxf-viewer/ui --include='*.tsx'
```

Mirror του υπάρχοντος toggle για `BIM_COLUMN_CENTER`. Δεν υπάρχει new UI architecture — μόνο addition of 5 entries.

---

## 9. Test Strategy (Phase 2F)

### 9.1 Anchor module tests (5 files)

Pattern: `bim/{walls|beams|slabs|columns}/__tests__/{wall|beam|slab|column}-corner-anchors.test.ts` + `bim/walls/__tests__/opening-corner-anchors.test.ts`

**Test cases per module** (≥6 tests each):
1. Degenerate entity (length 0 / no vertices) returns `[]`
2. Straight entity returns expected 4 corners at calculated positions
3. Flipped wall (flip=true) returns swapped left/right
4. Polyline wall N=3 returns 6 corners
5. Curved wall returns only 4 corners (start/end caps)
6. Tagged anchor labels match enum (`start-left`, `end-right`, etc.)

### 9.2 Snap engine tests (5 files)

Pattern: `snapping/engines/__tests__/{Wall|Beam|Slab|Column|Opening}CornerSnapEngine.test.ts`

Mirror `ColumnCenterSnapEngine.test.ts` (10 test cases each):
1. No candidates with empty entity list
2. No candidates with no matching entity type
3. Single entity returns 4 corners
4. Cursor outside radius returns `[]`
5. `excludeEntityId` suppresses matching entity
6. Multiple entities returns independent corners
7. `description` field = `bim-xxx-corner`
8. `type` field = `ExtendedSnapType.BIM_XXX_CORNER`
9. `priority` = -2
10. (Opening only) Orphan opening (missing host) returns `[]`

### 9.3 Integration test

`__tests__/bim-corner-alignment.integration.test.ts`:

1. **Wall-to-wall corner alignment**: 2 walls, cursor over corner of wall A near corner of wall B → snap to wall A corner (BIM_WALL_CORNER beats ENDPOINT).
2. **Wall-to-column corner**: Wall corner near column NW corner → snap to nearer.
3. **Opening jamb-to-wall corner**: Opening corner aligns with adjacent wall corner.
4. **Priority verification**: ENDPOINT exists at same point as BIM_WALL_CORNER → corner wins.
5. **Toggle off**: Disable BIM_WALL_CORNER → fall back to ENDPOINT.

---

## 10. Phase Breakdown (Implementation Recipe)

**ΣΗΜΑΝΤΙΚΟ**: Όλες οι Phases 2-6 εκτελούνται με **Sonnet 4.6** (όχι Opus). Κάθε phase είναι αυτόνομη — Sonnet διαβάζει αυτό το ADR §X και το αντίστοιχο template file.

### Phase 2A — Type System Wiring (1 session, ~10 min)
**Files edited**: 2
- `src/subapps/dxf-viewer/snapping/extended-types.ts` (§4.1)
- `src/subapps/dxf-viewer/config/tolerance-config.ts` (§4.2)

**Validation**: `npx tsc --noEmit` no errors.

### Phase 2B — Anchor SSoT Modules (parallel subagents, ~20 min)
**Files created**: 5
- `src/subapps/dxf-viewer/bim/walls/wall-corner-anchors.ts` (§5.1)
- `src/subapps/dxf-viewer/bim/beams/beam-corner-anchors.ts` (§5.2)
- `src/subapps/dxf-viewer/bim/slabs/slab-corner-anchors.ts` (§5.3)
- `src/subapps/dxf-viewer/bim/columns/column-corner-anchors.ts` (§5.4)
- `src/subapps/dxf-viewer/bim/walls/opening-corner-anchors.ts` (§5.5)

**Template**: `src/subapps/dxf-viewer/bim/columns/column-anchors.ts`

### Phase 2C — Snap Engines (parallel subagents, ~25 min)
**Files created**: 5
- `src/subapps/dxf-viewer/snapping/engines/WallCornerSnapEngine.ts`
- `src/subapps/dxf-viewer/snapping/engines/BeamCornerSnapEngine.ts`
- `src/subapps/dxf-viewer/snapping/engines/SlabCornerSnapEngine.ts`
- `src/subapps/dxf-viewer/snapping/engines/ColumnCornerSnapEngine.ts`
- `src/subapps/dxf-viewer/snapping/engines/OpeningCornerSnapEngine.ts`

**Template**: `src/subapps/dxf-viewer/snapping/engines/ColumnCenterSnapEngine.ts` (§6.1)

### Phase 2D — Registry + Indicator + i18n (1 session, ~15 min)
**Files edited**: 4
- `src/subapps/dxf-viewer/snapping/orchestrator/SnapEngineRegistry.ts` (§7.1)
- `src/subapps/dxf-viewer/canvas-v2/overlays/SnapIndicatorOverlay.tsx` (§7.2)
- `src/i18n/locales/el/dxf-viewer-shell.json` (§7.3)
- `src/i18n/locales/en/dxf-viewer-shell.json` (mirror el)

### Phase 2E — Settings UI Toggles (1 session, ~15 min)
**Files edited**: 1-2 (TBD — locate via grep)
- Snap settings panel + 5 toggle entries

### Phase 2F — Tests (parallel subagents, ~30 min)
**Files created**: 11
- 5 anchor module tests (§9.1)
- 5 snap engine tests (§9.2)
- 1 integration test (§9.3)

**Total Phase 2 effort**: ~115 min Sonnet time, 30+ files touched, ~3,500 lines.

---

## 11. Google-Level Architecture Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive ή reactive; | **Proactive** — corners computed στο `initialize()` και spatial-indexed πριν τη χρήση. |
| 2 | Race condition possible; | **No** — pure functions, καμία shared mutable state. |
| 3 | Idempotent; | **Yes** — `getXxxCornerWorldPoints(entity)` με ίδια params → ίδια corners πάντα. |
| 4 | Belt-and-suspenders; | **Yes** — primary = corner engine; fallback = existing ENDPOINT engine πιάνει τα ίδια σημεία ως generic endpoints αν το BIM toggle off. |
| 5 | Single Source of Truth; | **Yes** — anchor modules consume υπάρχουσες `WallGeometry/BeamGeometry/...` — zero new geometry math. |
| 6 | Fire-and-forget ή await; | **Synchronous pure compute** — deterministic, no async. |
| 7 | Lifecycle owner; | **SnapEngineRegistry** owns engine instances. **`useGlobalSnapSceneSync()`** triggers `initialize()` per scene change (ADR-040). |

✅ **Google-level: YES** — pure SSoT pattern, mirror του proven ADR-363 Phase 5.5d/5.5i industry convention, deterministic, fully testable, ZERO new state machines.

---

## 12. Performance Considerations

- **Spatial index**: RBush O(log N) query — proven για ColumnCenter (Phase 5.5i).
- **Initialize cost**: O(N×4) για walls/beams/columns/openings, O(N×K) για slabs (K=polygon vertices). Negligible (<1ms για 1000 entities).
- **Re-init triggers**: Μόνο όταν entity list αλλάζει (ADR-040 fingerprint guard στο `useGlobalSnapSceneSync`). Drag του ίδιου entity → no re-init.
- **Memory**: 1 RBush per engine × 5 engines = 5 × O(N×corners) bytes. Για 1000 BIM entities × 4 corners = 20,000 entries × ~80 bytes = ~1.6 MB. Acceptable.

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Corner overlap με ENDPOINT engine candidates → confusing list | Medium | Priority -2 > 0 → corner ΠΑΝΤΑ νικάει. ENDPOINT μένει ως fallback. |
| Polyline walls με N=20 vertices → 40 corner candidates ανά τοίχο | Low | Spatial index O(log N), Tab cycling για multi-candidate. Δεν είναι common case. |
| Opening χωρίς host wall (orphan) | Low | `extractOpeningCorners()` returns `[]` αν `wallId` δεν matches. |
| Curved wall με 17 subdivisions → noise | Mitigated | Anchor module εκθέτει μόνο start/end caps (4 corners), όχι όλα τα Bezier subdivisions. |
| Visual confusion με quadrant ◇ symbol | Low | L-bracket ┘ είναι οπτικά διακριτικό. Test με real users post-launch. |

---

## 14. Migration & Rollout

- **Backward compatibility**: 100%. Νέα optional snap types — default enabled, μπορούν να γίνουν toggle off από settings UI.
- **DXF Viewer state**: No data migration required. Snap settings persist via existing settings sync (Phase 2E adds 5 new fields με defaults).
- **No data loss possible** — pure read-from-existing-geometry.
- **Feature flag**: NONE. Direct enablement (Boy Scout — minor feature addition).

---

## 15. Changelog

| Date | Phase | Change |
|---|---|---|
| 2026-05-22 | — | Initial ADR-370 design (Opus 4.7 + Γιώργος). |
| 2026-05-22 | Phase 2A | Type system: +5 `ExtendedSnapType` values, `enabledTypes`, `priority` order, `perModePxTolerance`. `tolerance-config.ts` priorities -2. |
| 2026-05-22 | Phase 2B | 5 anchor SSoT modules: `wall-corner-anchors.ts`, `beam-corner-anchors.ts`, `slab-corner-anchors.ts`, `column-corner-anchors.ts`, `opening-corner-anchors.ts`. |
| 2026-05-22 | Phase 2C | 5 snap engines: `WallCornerSnapEngine`, `BeamCornerSnapEngine`, `SlabCornerSnapEngine`, `ColumnCornerSnapEngine`, `OpeningCornerSnapEngine`. |
| 2026-05-22 | Phase 2D | `SnapEngineRegistry` +5 engine registrations. `SnapIndicatorOverlay` +5 L-bracket cases + `BIM_DESCRIPTION_KEY` entries. i18n el+en: `wallCorner`/`beamCorner`/`slabCorner`/`columnCorner`/`openingCorner` labels + `bim.*` tooltips. |
| 2026-05-22 | Phase 2E | `ProSnapToolbar`: `SNAP_MODE_KEYS` exhaustiveness fix (BIM_COLUMN_CENTER + 5 corner types), `BIM_MODES` constant, advanced panel BIM section with separator. |
| 2026-05-22 | Phase 2F | 12 test files: 5 anchor module tests + 5 snap engine tests + 1 type system test (`extended-types-bim-corner.test.ts`) + 1 integration test (`bim-corner-alignment.integration.test.ts`, S1-S5). |
| 2026-05-22 | Rename | ADR number corrected from ADR-370 → ADR-371 (collision with ADR-370-bim-readonly-visualization.md). Filename preserved for git-blame. |
| 2026-07-08 | Renumber | ADR number changed **ADR-371 → ADR-597** (second collision: ADR-371 also owned by `ADR-371-bim-3d-readonly-viewer.md`). Big-player rule (immutable/monotonic ADR numbers) → corner-snap takes a fresh unique gap number. File renamed `ADR-370-bim-corner-snap-system.md` → `ADR-597-bim-corner-snap-system.md` (git mv, blame preserved). Redirect stub `ADR-371-bim-corner-snap-system.md` deleted. All refs updated same commit: adr-index (rows + mirror), ADR-378 back-link, ~42 src files (both `ADR-370`/`ADR-371` corner-snap tokens → `ADR-597`), auto-memory. ADR-371 now belongs solely to the 3D Read-Only Viewer; ADR-370 solely to Read-Only Visualization. |
| 2026-05-22 | Bugfix | `SnapContext.ALL_MODES` δεν περιλάμβανε BIM/DIM snap types → `enabledModes` Set ποτέ δεν τα περιλάμβανε → `useSnapManager.updateSettings({ enabledTypes })` αντικαθιστούσε το `DEFAULT_PRO_SNAP_SETTINGS.enabledTypes` με Set χωρίς BIM types → οι 5 BIM corner snap engines ποτέ δεν αρχικοποιούνταν. Fix: +8 types στο `ALL_MODES` + matching default enabled state. File: `SnapContext.tsx`. |
| 2026-05-22 | Extension | **Wall Face Corner Projection Snap** (Revit-style). Όταν κάνει drag ένα endpoint grip τοίχου, τα face corners (cursor ± halfThickness × perp) ελκύονται στις BIM γωνίες γειτονικών οντοτήτων. Τα νέα αρχεία: `GripDragStore.ts` (imperative grip context store), `wall-face-corner-snap.ts` (projection utility). Edits: `useUnifiedGripInteraction.ts` (set/clearActiveDragGrip), `mouse-handler-move.ts` + `mouse-handler-up.ts` (face corner projection block). |
| 2026-05-29 | Refactor (ADR-398) | **Shared corner-projection SSoT** `systems/cursor/corner-projection-snap.ts` (`findBestCornerProjection`). Το query/best/correction loop ήταν διπλότυπο wall↔column → ένα core. **Ο τοίχος (`wall-face-corner-snap.ts`) μεταφέρθηκε** να το καταναλώνει (μηδέν behavior change). Νέα οντότητα = corners + core call, ποτέ re-implement. +4 core tests. |
| 2026-05-29 | Bugfix (ADR-398) | **Meter-scene corner-anchor unit mismatch** (root cause «δεν εμφανίζονται έλξεις/κείμενα στις γωνίες κολώνας»). `column-anchors.ts::localToWorld` πρόσθετε mm local offsets σε `position` (scene units) ΧΩΡΙΣ `mmScaleFor` → σε meter/cm scenes οι 4 corner anchors έπεφταν 1000×/10× off-screen → ΚΑΙ το passive `ColumnCornerSnapEngine` ΚΑΙ το νέο projection δεν έβρισκαν τίποτα στις ορατές γωνίες (ίδια κλάση με ADR-397 #2 grip fix, που είχε διορθωθεί μόνο στο `column-grip-utils`). Fix: ×`mmScaleFor(params)` στα offsets (mirror `computeColumnGeometry`). Διορθώνει επίσης beam→column anchor snap σε non-mm scenes (Boy Scout). +1 meter-scene test. mm scenes αμετάβλητα (s=1). |
| 2026-06-11 | Bugfix (Opus) | **«Μέσο/Κέντρο ποτέ δεν εμφανίζονται» (corner OK, midpoint/center όχι)** — δύο runtime selection bugs, ΟΧΙ ο dispatcher (τα candidates παράγονταν σωστά). (1) **Priority numbers**: `BIM_MIDPOINT 0.5` / `BIM_CENTER 2.5` ήταν **κάτω** (χειρότερα) από `ENDPOINT 0`/`INTERSECTION 0`/`MIDPOINT 1`/`CENTER 3` → στο κεντροειδές το `BIM_MIDPOINT` νικούσε το `BIM_CENTER` (sort=priority πρώτα) και τα generic line snaps έκρυβαν και τα δύο. Fix: **και τα δύο → −1.7** (αρνητικά όπως ο corner −2 ώστε να νικούν τα generic, **ίσα** μεταξύ τους ώστε η *απόσταση* να διαλέγει ⊕ στο κέντρο vs ▲ στο μέσο παρειάς — μηδέν priority-hijack). `tolerance-config.ts`. (2) **Iteration order / starvation**: ο `SnapOrchestrator` loop σπάει στο `maxCandidates=8`· ο `BIM_CORNER` ήταν θέση 2 του priority array (τρέχει πρώτος→φαίνεται) αλλά `BIM_MIDPOINT`(θέση 7)/`BIM_CENTER`(θέση 11) ήταν **μετά** τα `INTERSECTION`/`ENDPOINT`/`NEAREST` που σε πυκνό DXF γέμιζαν το budget → οι engines δεν έτρεχαν ποτέ. Fix: μετακίνηση `BIM_MIDPOINT`/`BIM_CENTER` αμέσως μετά τον `BIM_CORNER` (always-on structural snaps τρέχουν πρώτα). `extended-types.ts DEFAULT_PRO_SNAP_SETTINGS.priority`. +5 guard tests (priority negativity/equality + anti-starvation order + centroid distance-tiebreak). 34 jest pass (6+11+17). |
| 2026-06-11 | Consolidation (Opus) | **5→1 engine + characteristic-point SSoT (corner+midpoint+center για ΟΛΕΣ τις BIM)**. Giorgio: «ΙΔΙΟΣ κώδικας παντού, μηδέν διπλότυπο, όπως Revit». (a) NEW `bim/utils/bim-characteristic-points.ts` — ENA dispatcher που για κάθε BIM entity επιστρέφει `{corners, midpoints, center, labelRoot}` κάνοντας **reuse** τις υπάρχουσες SSoT γεωμετρίες (`get*CornerWorldPoints`, `getBimEntityEdgeMidpoints2D`, `getColumnAnchorWorldPoints`, `getFoundationGrips`, `getCentredBoxGrips`, `polygonCentroid`) — **μηδέν νέα γεωμετρία**. Καλύπτει wall/beam/slab/slab-opening/opening/column/foundation(pad+strip+tie-beam)/8 centred-box fixtures/roof/thermal-space/floor-finish/mep-underfloor/mep-segment. (b) NEW `BimCharacteristicSnapEngine` — ΜΙΑ παραμετρική κλάση (category corner/mid/center) **αντικαθιστά τα 5** `{Wall,Beam,Slab,Column,Opening}CornerSnapEngine` (διαγράφηκαν + τα 5 tests τους). (c) **Type collapse**: 5 `BIM_*_CORNER` → 1 `BIM_CORNER` + NEW `BIM_MIDPOINT`/`BIM_CENTER`. Touch: enum + `DEFAULT_PRO_SNAP_SETTINGS` (enabledTypes/priority/perModePxTolerance) + `tolerance-config` (BIM_CORNER −2, BIM_MIDPOINT 0.5, BIM_CENTER 2.5) + `SnapEngineRegistry` (3 instances) + `SnapIndicatorOverlay` (L `bim_corner` / ▲ `bim_midpoint` / ⊕ `bim_center`) + `SnapContext.ALL_MODES`/init + `ProSnapToolbar` `SNAP_MODE_KEYS`/`BIM_MODES` + `core/spatial` querySnap slot union (`bim_corner`/`bim_midpoint`/`bim_center`, αφαιρέθηκαν τα 5 obsolete). (d) **Composition labels** (`snap-description-keys.ts` `resolveBimSnapLabelText`/`resolveSnapLabelText`): `bim-<root>-<corner\|mid\|center>` → «Γωνία/Μέσο/Κέντρο» (`category.*`) + entity noun (`noun.*`), ώστε 3 categories × ~20 entities = ~23 i18n keys (όχι 60). Empty description («περίεργο σχήμα»: curved/polyline/L/T/I/U/circular/spiral/linear) → glyph ΧΩΡΙΣ label (req #4). Καταναλώνεται ΚΑΙ από 3D gizmo (`use-bim3d-edit-interaction`). (e) **Persist migration** (`SnapContext.migrateLegacySnapState`): pre-ADR-370 `dxfViewer.snap` blob δεν γνωρίζει κανένα νέο id → default-enable corner/mid/center μία φορά (αλλιώς εξαφανίζονται σε existing users — root cause «εξαφανίστηκαν τα σήματα»). 38 jest (15 dispatcher + 8 engine integration + 7 type + 8 description-keys) + 31 regression (ColumnCenter/WallFace/MepConnector) + tsc καθαρό (6 pre-existing errors άλλου agent στο bim-3d). DEFER: `ColumnCenterSnapEngine`→`BIM_CENTER` full collapse (προς το παρόν column center = legacy engine, dispatcher center=null για αποφυγή διπλού)· railing/mep-fitting/stair-non-straight v2. |
| 2026-05-29 | Extension (ADR-398) | **Column Body Corner Projection Snap** — column parity με τον τοίχο (§17). Όταν ο χρήστης μετακινεί (hot-grip 3-click), αλλάζει διαστάσεις (resize grips) ή σχεδιάζει κολώνα, οι 4 footprint γωνίες της προβάλλονται και η πιο κοντινή ελκύεται σε στόχο (το label δείχνει τον τύπο στόχου, π.χ. «Γωνία κολώνας»). NEW: `bim/columns/column-corner-snap.ts` (core SSoT) + `column-corner-snap.test.ts` (9/9). Refactor (params-based core, μηδέν duplication): `column-anchors.ts` (`getColumnAnchorWorldPointsFromParams`), `column-corner-anchors.ts` (`getColumnCornerWorldPointsFromParams`). Bridge: `GripDragStore.ts` (+`dragAnchor` + `setActiveDragGripAnchor`), `grip-hotgrip-actions.ts` (publish move base), `grip-mouse-handlers.ts` (publish columnGripKind + resize anchor), `column-tool-bridge-store.ts` + `useColumnTool.ts` (+`getSceneUnits`). Consumers: `mouse-handler-move.ts` (grip + draw branches), `mouse-handler-up.ts` (grip + draw commit). |
| 2026-07-05 | Bugfix (Opus 4.8) | **Runtime crash `Cannot read properties of undefined (reading 'outline')` σε ambient-alignment mouse-move πάνω σε slab.** Το `getSlabCornerWorldPoints` (`slab-corner-anchors.ts`) διάβαζε `slab.params.outline` με το `params` **αφύλακτο** — ένα ambient AutoAlign scan (`ambient-alignment-source` → `getBimCharacteristicPoints` → `polygonFootprint`) χτύπησε half-built/preview slab με `params === undefined` → throw που κατέβαζε ολόκληρο το canvas mouse-move (`handleMouseMove`). Fix: optional-chain `slab.params?.outline?.vertices` → `verts` undefined → ο υπάρχων `!verts` guard επιστρέφει `[]` (degenerate), τιμώντας το δηλωμένο defensive contract του module («returns [] rather than throwing»). Καμία behavior change όταν geometry/params υπάρχουν. File: `bim/slabs/slab-corner-anchors.ts` (1 γραμμή + comment). |
| 2026-07-02 | Bugfix (ADR-363 Φ1G.5) | **STATIONARY L/T/U/Π/polygon column εξέθετε μόνο τις 4 bbox γωνίες ως snap targets** → η reentrant (κοίλη) γωνία και οι μη-bbox πραγματικές κορυφές μιας σταθερής Γ-κολόνας ΔΕΝ ήταν στόχοι έλξης (ασυμμετρία με το moving side, που ήδη προβάλλει πραγματικές κορυφές). Fix: το `columnPoints` (`bim-characteristic-points.ts`) κάνει index τις **πραγματικές κορυφές footprint** μέσω `computeColumnGeometry(params).footprint.vertices` (ίδιο SSoT με τα per-vertex grips + το moving-column projection) → η σταθερή Γ/Τ/Π εκθέτει ΟΛΕΣ τις κορυφές (+ μέσα ΟΛΩΝ των πραγματικών πλευρών + κεντροειδές). **Circular εξαιρείται** (κρατά τα 4 perimeter anchors — η κυκλική τεσελίωση ~32-64 σημείων ΔΕΝ πρέπει να γίνει index)· **rectangular** → 4 πραγματικές = 4 bbox (μηδέν regression). File: `bim-characteristic-points.ts` (1 συνάρτηση) + test (L-shape 6 corners/6 midpoints/centroid + reentrant-inside-bbox assert). 37 jest GREEN (dispatcher + column-corner-snap + corner-projection). |

---

## 17. Column Body Corner Projection Snap (ADR-398 extension, 2026-05-29)

### 17.1 Πρόβλημα / parity gap

Το §5.4 + §6.4 (`ColumnCornerSnapEngine`) δίνει **passive** snap: ο κέρσορας
κολλάει στις γωνίες **άλλων** κολωνών (label «Γωνία κολώνας»). Έλειπε το
**active projection** του τοίχου (Changelog 2026-05-22 «Wall Face Corner
Projection Snap»): όταν ο χρήστης κινεί/σχεδιάζει την οντότητα, οι **δικές της**
γωνίες να προβάλλονται και να ελκύονται σε στόχους.

### 17.2 Διαφορά από τον τοίχο

| | Τοίχος (ADR-597) | Κολώνα (ADR-398) |
|---|---|---|
| Operation | drag endpoint grip | μετακίνηση σώματος / resize / σχεδίαση |
| Cursor | ≈ γωνία (axis), offset ±πάχος/2 | base point / resize handle / anchor |
| Σταθερό σημείο | άλλο άκρο | drag anchor (από `GripDragStore.dragAnchor`) |
| Corners | 2 face corners | 4 (N για polygon) footprint corners, best-wins |

### 17.3 SSoT αλυσίδα (zero duplication)

```
ColumnParams (proposed)
  → applyColumnGripDrag(gripKind, {delta})   // move/resize — ίδιος transform με commit
  → buildDefaultColumnParams(cursor, …)      // draw
        ↓
  getColumnCornerWorldPointsFromParams(params)   // params-based core (column-corner-anchors → column-anchors)
        ↓
  column-corner-snap.ts :: projectColumn → corner-projection-snap.ts :: findBestCornerProjection (SHARED core, ίδιο με wall) → findSnapPoint σε κάθε γωνία, best (self-match φιλτράρεται)
        ↓
  { snapResult (→ indicator + label στον στόχο), adjustedCursorPos (→ ghost anchor / commit) }
```

### 17.4 Wiring (4 consumers, single core)

- **Move** (hot-grip 3-click, `column-center`): base point γράφεται στο
  `GripDragStore.dragAnchor` μέσω `setActiveDragGripAnchor` (grip-hotgrip-actions
  await-base). `mouse-handler-move` (preview) + `mouse-handler-up` (commit)
  καλούν `findColumnGripCornerSnap` → override του effective cursor.
- **Resize** (press-drag `column-width`/`-depth`/variants): `grip-mouse-handlers`
  publish-άρει `columnGripKind` + `dragAnchor = grip.position`. Ο ίδιος consumer·
  το `applyColumnGripDrag` καταναλώνει μόνο το local-axis component της διόρθωσης.
- **Draw** (placement): `mouse-handler-move` (ghost: `ImmediateSnap.point =
  adjustedCursorPos`, indicator: `fullSnapResult = target`) + `mouse-handler-up`
  (commit) καλούν `findColumnDrawCornerSnap` με params από `columnToolBridgeStore`
  (+`getSceneUnits`). Ghost === commit (μάθημα ADR-397).

`column-rotation` εξαιρείται (γωνιακή πράξη, όχι corner-alignment).

### 17.4b 🔴 ROOT-CAUSE fix — meter-scene unit mismatch (2026-05-29)

Giorgio live test: «πάλι τα ίδια — δεν εμφανίζονται έλξεις/κείμενα στις γωνίες
κολώνας». Αιτία ΟΧΙ το νέο projection αλλά **προϋπάρχον** bug που έσπαγε ΚΑΙ το
passive `ColumnCornerSnapEngine`: το `column-anchors.ts::localToWorld` πρόσθετε mm
local offsets (`dx·width` κ.λπ.) στο `position` (scene units) **χωρίς**
`mmScaleFor`. Σε meter scene (`mmScaleFor=0.001`) μια 400mm κολώνα → corner anchors
στα `position ± 200` scene units (= 200 m) → off-screen → καμία έλξη στις ορατές
γωνίες (που ζωγραφίζονται σωστά μέσω `computeColumnGeometry`, το οποίο ΕΦΑΡΜΟΖΕΙ
`s`). Ίδια κλάση με ADR-397 #2 (grip off-screen), που είχε διορθωθεί ΜΟΝΟ στο
`column-grip-utils`, όχι στο snap-anchors path. Fix: `× mmScaleFor(params)` στα
offsets (`position` μένει αμετάβλητο). Μάθημα (ξανά): partial fix ενός unit-mismatch
= silent divergence σε άλλο pipeline.

### 17.4c ♻️ Shared SSoT core — `corner-projection-snap.ts` (2026-05-29)

Giorgio SSoT grilling: το πρώτο column draft είχε **διπλότυπο** το query/best/
correction loop με το `wall-face-corner-snap.ts` (ίδιος ακριβώς αλγόριθμος —
`adjustedCursorPos = cursor + (target − corner)` ≡ wall `adjustedAxisPos`). Fix:
νέο **`systems/cursor/corner-projection-snap.ts`** με `findBestCornerProjection(corners,
cursor, findSnapPoint, excludeEntityId?)` — ΕΝΑ loop. **ΚΑΙ ο τοίχος μεταφέρθηκε** να
το καταναλώνει (`wall-face-corner-snap` υπολογίζει 2 face corners → core· επιστρέφει
`adjustedAxisPos = core.adjustedCursorPos`, μηδέν αλλαγή συμπεριφοράς). Η κολώνα
υπολογίζει N footprint corners → core. Νέα οντότητα (beam/slab/opening) opt-in =
«υπολόγισε corners + κάλεσε core», ΠΟΤΕ re-implement. `FindSnapPoint`/
`CornerProjectionResult` types ζουν στον core (single import path).

### 17.5 Files

- **NEW (shared SSoT core)**: `systems/cursor/corner-projection-snap.ts` + `__tests__/corner-projection-snap.test.ts` (4/4).
- **NEW**: `bim/columns/column-corner-snap.ts` (column adapter → core), `__tests__/column-corner-snap.test.ts` (10/10).
- **MOD (migrated to core)**: `systems/cursor/wall-face-corner-snap.ts` (ADR-597 — loop αφαιρέθηκε, καταναλώνει core).
- **MOD**: `bim/columns/column-anchors.ts`, `bim/columns/column-corner-anchors.ts`,
  `systems/cursor/GripDragStore.ts`, `hooks/grips/grip-hotgrip-actions.ts`,
  `hooks/grips/grip-mouse-handlers.ts`, `systems/cursor/mouse-handler-move.ts`,
  `systems/cursor/mouse-handler-up.ts`,
  `ui/ribbon/hooks/bridge/column-tool-bridge-store.ts`, `hooks/drawing/useColumnTool.ts`.

### 17.6 Google-Level (N.7.2)

Proactive (projection at event time)· no race (pure core, single SSoT)·
idempotent· belt-and-suspenders (preview+commit share core)· SSoT (one core,
params-based anchors reused)· await (sync)· lifecycle owner explicit
(`GripDragStore` bridge + bridge store). ✅

### 17.7 §unified-glyph — ΕΝΑ οπτικό λεξιλόγιο (2026-07-05)

**Αφορμή (Giorgio)**: «Δύο συστήματα ελξεων;» — τα raw OSNAP έδειχναν ■/△/○ (endpoint/
midpoint/center) ενώ τα BIM έδειχναν ┘/▲/⊕ με άλλα χρώματα, για το **ίδιο ΕΙΔΟΣ σημείου**.
Απόφαση: ακολουθούμε Revit/AutoCAD — ΕΝΑ σύμβολο+χρώμα ανά είδος σημείου, η οντότητα στην
ετικέτα. Βλ. §3.4b. Scope: μόνο corner/midpoint/center (connector/wall-face = ξεχωριστά είδη).

- **MOD**: `canvas-v2/overlays/SnapIndicatorGlyph.tsx` — τα `bim_corner/midpoint/center`
  cases ενοποιήθηκαν με τα `endpoint/midpoint/center` (αφαιρέθηκαν τα ┘/▲/⊕ standalone).
- **MOD**: `rendering/ui/snap/snap-visual-config.ts` — `SNAP_COLORS[BIM_CORNER/MIDPOINT/CENTER]`
  → `SNAP_MARKER_COLORS.ENDPOINT/MIDPOINT/CENTER`.
- **MOD**: `config/color-config.ts` — αφαιρέθηκαν τα ορφανά `SNAP_MARKER_COLORS.BIM_CORNER/
  MIDPOINT/CENTER` primitives (Boy Scout).
- **MOD (docstrings)**: `canvas-v2/overlays/SnapIndicatorOverlay.tsx`.
- **NEW**: `rendering/ui/snap/__tests__/snap-visual-config.test.ts` (4/4 — colour-unification guard).

**Google-Level (N.7.2)**: SSoT (2 σημεία, αυτόματα σε όλες τις οντότητες)· idempotent (pure
mapping)· zero race· lifecycle owner explicit (SnapShape + SNAP_COLORS). ✅

### 17.8 §non-convex-fix + §L-label — σωστά characteristic points για L/Γ/T/U (2026-07-05)

**Αφορμή (Giorgio, screenshot L column)**: σε L/Γ κολόνα εμφανίζονταν κόκκινα snap σημάδια
**στο κενό/notch** (εκτός υλικού) και **δεν** έβγαινε το «Γωνία/Μέσο κολόνας». Δύο root-cause bugs
+ ένα policy:

- **Bug Α (midpoints)**: `footprintEdgeMidpoints` έκανε `sortPointsAroundCentroid` (angular sort)
  — σωστό για convex, αλλά για ΜΗ-ΚΥΡΤΑ (L/Γ/T/U) ανακάτευε τις κορυφές → ακμές που διέσχιζαν το
  notch → midpoints ΕΚΤΟΣ σχήματος. Fix: νέο `preOrdered` option — polygon footprints (ordered
  winding) παρακάμπτουν το sort.
- **Bug Β (center)**: `centroid2D` = **μέσος όρος κορυφών** → για L πέφτει στο notch. Fix: τα
  ordered polygons χρησιμοποιούν **area (shoelace) centroid** (`polygon2DAreaCentroid`), που μένει
  ΜΕΣΑ στο υλικό.
- **§L-label (policy)**: `getBimCharacteristicLabelRoot` επέστρεφε `null` για μη-ορθογώνιες
  κολόνες. Νέο: ΚΑΘΕ πολυγωνική κολόνα (rectangular/shear-wall/L/Γ/T/U/I/polygon/composite) →
  `'column'` → «Γωνία/Μέσο/Κέντρο κολόνας». Μόνο circular μένει χωρίς.

- **MOD**: `bim/geometry/shared/polygon-utils.ts` (`footprintEdgeMidpoints` +preOrdered· νέο
  `polygon2DAreaCentroid`), `bim/utils/bim-characteristic-points.ts` (footprintPoints ordered
  path· column/polygon callers· labelRoot column policy).
- **MOD (test)**: `bim/utils/__tests__/bim-characteristic-points.test.ts` — L-shape label='column'
  + regression guard (midpoints = πραγματικές ακμές, center εντός bbox). 17/17 PASS.

**Google-Level (N.7.2)**: root-cause (όχι hide)· SSoT (ΕΝΑ midpoints/centroid path για όλα τα
families)· idempotent (pure geometry)· regression-guarded. ✅

### 17.9 §κεντρικοποίηση — column key points = ΕΝΑ SSoT (2026-07-05)

**Αφορμή (Giorgio, follow-up)**: μετά το §non-convex-fix, τα «Γωνία/Μέσο κολόνας» εμφανίστηκαν
σωστά, ΑΛΛΑ **κόκκινα τετράγωνα (■ endpoint)** παρέμεναν στο κενό/notch της L. Root cause =
**προϋπάρχον διπλότυπο SSoT** (δεν το δημιούργησε ο agent):

- `bim/utils/bim-characteristic-points.ts` (ADR-370) → `BimCharacteristicSnapEngine` → **σωστές
  footprint γωνίες** (BIM_CORNER).
- `bim/utils/bim-entity-points.ts` (ADR-363) → `GeometricCalculations` (ENDPOINT snap) → για
  column επέστρεφε τα **9 bbox anchors** (`getColumnAnchorWorldPoints`) → για L/Γ/T/U έπεφταν
  **στο κενό** → φάντασμα ■ markers έξω από το σώμα.

**Κεντρικοποίηση (Giorgio διαταγή «τα προϋπάρχοντα διπλότυπα τα κεντρικοποιείς»)**: το column
branch του `getBimEntityKeyPoints2D` πλέον **delegates** στο ΕΝΑ characteristic-corner SSoT
(`getBimCharacteristicPointsOfCategory(entity, 'corner')`) → endpoint & BIM_CORNER δείχνουν στα
ΙΔΙΑ σωστά σημεία, μηδέν φάντασμα. Ωφελεί ΚΑΙ το `dim-association-service` (dimension association
σε πραγματικές γωνίες). Κανένα circular import (characteristic ⇏ entity-points).

- **MOD**: `bim/utils/bim-entity-points.ts` (column branch → characteristic SSoT· αφαίρεση
  `getColumnAnchorWorldPoints` import).
- **NEW**: `bim/utils/__tests__/bim-entity-points.test.ts` — L=6 real corners (όχι 9 bbox anchors)
  + toEqual το characteristic SSoT. 3/3 PASS.

**Google-Level (N.7.2)**: ΕΝΑ SSoT για column points (endpoint+BIM_CORNER)· root-cause· zero
duplication· regression-guarded. ✅

### 17.10 §κεντρικοποίηση full — ΟΛΑ τα polygon entities → ΕΝΑ SSoT (2026-07-05)

**Απόφαση (Giorgio, Revit-grade)**: το §17.9 ένωσε μόνο το column. Follow-up audit έδειξε ότι
`bim-entity-points.ts` (ADR-363) & `bim-characteristic-points.ts` (ADR-370) έκαναν **copy-paste
την ίδια** `outline/footprint.vertices` εξαγωγή για **ΟΛΑ** τα polygon entities. Κεντρικοποίηση:

- **Polygon-footprint** (slab / slab-opening / opening / column / floor-finish / thermal-space /
  mep-underfloor): `getBimEntityKeyPoints2D` → `getBimCharacteristicPointsOfCategory('corner')`,
  `getBimEntityEdgeMidpoints2D` → `…('midpoint')`. **Μία** πηγή γεωμετρίας, μηδέν divergence.
- **Linear** (beam / wall / space-separator): κρατούν **axis endpoints/midpoints**. Απόφαση
  Revit-grade — το «Endpoint» (άκρα location-line) είναι **διαφορετικός τύπος έλξης** από το
  «Corner» (γωνίες σώματος)· οι μεγάλοι ΔΕΝ τα ενοποιούν. Ισοδυναμία επιβεβαιωμένη (opening
  `getOpeningCornerWorldPoints` == `geometry.outline.vertices`) → μηδέν αλλαγή συμπεριφοράς σε
  snap/grips/dimensions· το σύνολο σημείων ανά function αμετάβλητο.

- **MOD**: `bim/utils/bim-entity-points.ts` — polygon branches → characteristic SSoT (combined),
  docstrings.
- **MOD (test)**: `bim/utils/__tests__/bim-entity-points.test.ts` — slab/opening `toEqual` το
  characteristic SSoT· wall/beam = axis endpoints (regression ότι ΔΕΝ έγιναν face corners). PASS.

**Google-Level (N.7.2)**: ΕΝΑ γεωμετρικό SSoT για όλα τα polygon BIM points· linear = ρητά
ξεχωριστός τύπος (Revit-standard)· zero duplication· zero behavioural change· regression-guarded. ✅

### 17.11 §projection-ssot — `projectPointTo2D` / `projectVerticesTo2D` SSoT (2026-07-05)

**Απόφαση (Giorgio, «ΝΑ ΤΟ ΚΕΝΤΡΙΚΟΠΟΙΗΣΟΥΜΕ ΘΕΛΩ» + «ΑΝ ΒΡΕΙΣ ΠΡΟΫΠΑΡΧΟΝΤΑ ΔΙΠΛΟΤΥΠΑ, ΤΑ
ΚΕΝΤΡΙΚΟΠΟΙΕΙΣ ΚΑΙ ΑΥΤΑ = ΔΙΑΤΑΓΗ», Revit/Maxon/Figma-grade)**: το geometry SSoT (`computeColumnGeometry`
/ `computeFoundationGeometry` / `computeBeamGeometry`) ήταν ήδη κοινό, αλλά το τελικό **`{x,y}` projection**
ενός point/footprint/outline ήταν copy-paste. SSoT audit (grep `to2D|verticesOf|toPoint2D|poly3to2`):
κανένα canonical export — μόνο διάσπαρτα *private* helpers σε 9 modules, σε **δύο μορφές**: single-point
`to2D(p)` & array `toPoint2D/verticesOf/poly3to2/.map(to2D)`. Δημιουργήθηκαν **ΔΥΟ** pure helpers (array =
`verts.map(single)`), zero-dep, winding-preserving.

- **NEW**: `bim/geometry/shared/polygon-utils.ts` → `projectPointTo2D(p): Point2D` (single) +
  `projectVerticesTo2D(vertices): Point2D[]` (array mirror). Generic επί `{x,y}` source· z drop· fresh
  objects (κανένα aliasing)· winding order διατηρείται (μηδέν αναδιάταξη — κρίσιμο για L/Γ/T/U).
- **Corner-projection snap (αρχικό task)**: `bim/columns/column-corner-snap.ts`,
  `bim/structural/member-grip-corner-snap.ts` (×3: column/beam-`.outline`/foundation),
  `bim/utils/bim-characteristic-points.ts` (`columnPoints` + private `verticesOf` delegate).
- **Προϋπάρχοντα διπλότυπα (ΔΙΑΤΑΓΗ Giorgio — single-point `to2D`)**: `bim/walls/wall-corner-anchors.ts`,
  `bim/walls/opening-corner-anchors.ts`, `bim/slabs/slab-corner-anchors.ts`, `bim/beams/beam-corner-anchors.ts`,
  `rendering/hitTesting/hit-test-entity-tests.ts`, `export/core/bim-to-dxf-primitives.ts` — private `to2D`
  διαγράφηκαν → `projectPointTo2D`/`projectVerticesTo2D`.
- **Προϋπάρχοντα διπλότυπα (array)**: `bim/framing/member-snap-targets.ts` (`toPoint2D` → deleted),
  `bim/placement/structural-placement-overlap.ts` (`toPoint2DArray` κρατά null/length guard, projection
  delegate), `hit-test-entity-tests.ts` (`poly3to2` → deleted).
- **NEW (test)**: `bim/geometry/shared/__tests__/polygon-utils-vertices2d.test.ts` — z-drop, winding
  preservation, fresh-object (no alias), empty input. PASS.

**Done (application-wide sweep — orchestrator, 2026-07-05)**: το εκκρεμές ευρύτερο πεδίο ολοκληρώθηκε.
**86 production αρχεία** (~90 call sites) του ΙΔΙΟΥ `{x,y}` idiom αντικαταστάθηκαν με το SSoT
(`projectPointTo2D` / `projectVerticesTo2D`) — zero behavioural change, per-site verified (ΟΧΙ τυφλό sed).
Orchestrator: fan-out σε 6 domain clusters (Sonnet) + 2 independent adversarial-verify agents (83/83 diffs
CLEAN, 0 flagged) + jest ανά domain.
- **Domains καλυμμένα**: `bim/geometry` (core+shared: wall-host-plan-builder, roof-*, column-vertical-profile,
  wall-geometry, straight-skeleton, segment-polygon-coverage, polygon-offset-utils, polygon-dilate,
  convex-polygon-difference) · `bim/walls` (preview-store, in-region, from-entity, cross-cutback, axis-clip,
  perimeter-*, filling-walls) · `bim/hosting` (wall/slab/foundation/column/beam) · `bim/structural` +
  `reinforcement` (slab-rebar-plan, column-bar-distribution, column-rebar-layout, perimeter-layout, cross-ties,
  circular-layout, beam-flange-context, organism/structural-graph) · `bim/columns` · `bim/beams` · `bim/hatch`
  (grips, firestore-service, completion) · `bim/ghosts` · `bim/roofs` · `bim/slabs` · `bim/foundations` ·
  `bim/finishes` · `bim/floor-finishes` · `bim/mep-underfloor` · `bim/mep-systems` (wire-waypoint-hit) ·
  `bim/renderers` (Wall/Opening/Furniture) · `bim/thermal` (heat-load resolvers) · `bim-3d` (scene syncs,
  converters, animation) · `hooks` (data/BOQ feeds, canvas cutbacks, drawing, auto-foundation) · `export`
  (bim-to-tek, overlay-dxf-collector) · `systems` (trim, polyline, offset, mep-routing, auto-area) · `utils`
  (region-operations) · `overlays` · `snapping` (DimDefPointSnapEngine) · `ui/ribbon` · `ai-assistant`.
- **GOTCHAS τηρήθηκαν** (per-site verify): reverse chains (`polygon-offset-utils`) → `projectVerticesTo2D(v).reverse()`·
  scale chains (`scalePoints(f, sceneToM).map(...)` σε bim-3d) → κρατήθηκε το inner call· z-widen (`{x,y,z:0}`),
  `[v.x,v.y]` tuples, arithmetic (offset/midpoint) → SKIPPED σωστά· local `to2D`/`toPlan`/`toVertex`/`copy`
  helpers διαγράφηκαν με cleanup των αχρησιμοποίητων imports.
- **Verification**: όλα τα σχετικά jest domains PASS. Προϋπάρχοντα (άσχετα) failures στο `section-context-slab.ts`
  (`slab.geometry.maxFreeSpanM` undefined — in-flight ADR-508 linear-member-framing work, ΟΧΙ αυτό το sweep) &
  σε slab-grips/finish-plan-geometry επιβεβαιώθηκαν ως pre-existing (stash-verified, αρχεία αμετάβλητα).

**Verification**: 212 tests PASS (23 suites: polygon-utils, characteristic-points, corner-snaps,
entity-points, wall/opening/slab/beam-corner-anchors, member-snap-targets, placement-overlap, hit-test, bim-to-dxf).

**Google-Level (N.7.2)**: ΔΥΟ pure projection SSoT· zero behavioural change (ίδιο output)· zero duplication
application-wide (snap/hit-test/export + 86 production αρχεία σε 6 domains)· regression-guarded (jest ανά domain +
adversarial verify 83/83 CLEAN)· μηδέν εναπομείναν array-form idiom σε production (grep-verified). ✅

---

## 18. Related Work & References

- **ADR-040** — Preview canvas perf (lifecycle owner = useGlobalSnapSceneSync).
- **ADR-087** — Snap engine config centralization (tolerance-config.ts).
- **ADR-137** — Snap icon geometry (SVG sizes via SNAP_ICON_GEOMETRY).
- **ADR-378** — Snap System Master Architecture + Priority Hierarchy §5 (BIM_*_CORNER = -2 entry in `SNAP_ENGINE_PRIORITIES`). Supersedes phantom ADR-149 reference.
- **ADR-363 Phase 5.5d** — Column anchor world points (template for §5.1-5.5 anchor modules).
- **ADR-363 Phase 5.5i** — ColumnCenterSnapEngine (template for §6 snap engines).

External references:
- Revit Endpoint snap on wall faces: Autodesk Revit User Guide § "Object Snaps".
- ArchiCAD Wall Hotspots: Graphisoft ArchiCAD 27 Reference Manual § "Drawing Aids".
- Vectorworks Smart Cursor: Vectorworks 2024 Getting Started Guide § "Snapping".

---

## 19. Extension — Stair characteristic points (2026-07-11)

**Αφορμή (Giorgio 2026-07-11):** «όταν κάνω hover πάνω από σκάλα να εμφανίζονται τα σημάδια
ελέγχου και να έλκομαι από αυτά» — snap **και** στα grips **και** σε κάθε σκαλοπάτι.

**Κενό:** η `StairEntity` ΔΕΝ είχε καταχώρηση στον `getBimCharacteristicPoints` dispatcher
→ επέστρεφε `EMPTY` → η σκάλα δεν πρόσφερε κανένα BIM_CORNER/MIDPOINT/CENTER snap.

**Fix (SSoT, μηδέν νέα γεωμετρία):**
- **NEW** `bim/stairs/stair-characteristic-points.ts` — `getStairCharacteristicPoints(stair)`:
  - `corners` = ΟΛΕΣ οι θέσεις των grips (`getStairGrips(stair).map(g => g.position)` — «ίδια με
    τα grips») **+** οι γωνίες ΚΑΘΕ σκαλοπατιού.
  - `midpoints` = τα μέσα των ακμών ΚΑΘΕ walkable επιφάνειας (`footprintEdgeMidpoints`, preOrdered).
  - Walkable επιφάνειες = `treadsBelowCut ∪ treadsAboveCut ∪ landings` (ADR-632 alias trap: το
    `treads` είναι legacy alias του `treadsBelowCut`, fallback για legacy geometry). **Τα
    `landings` (ADR-637 §5) είναι ΚΡΙΣΙΜΑ** — καλύπτουν τη ΓΩΝΙΑΚΗ περιοχή σε L/U/Γ σκάλες (+
    intermediate rest landings)· χωρίς αυτά η γωνιακή γωνία + τα landing σκαλοπάτια δεν πρόσφεραν
    κανένα snap (Giorgio 2026-07-11, screenshot κυκλωμένα σημεία). Projection 3D→2D με το
    `projectVerticesTo2D` SSoT (§16). Τα vertices είναι bare `Point3D[]` (`Polygon3D`).
- **`bim-characteristic-points.ts`**: `if (isStairEntity(e)) return stairPoints(e)` στον dispatcher·
  νέος `stairPoints` resolver (`center: null` — πολλά treads, χωρίς ενιαίο κεντροειδές)·
  `getBimCharacteristicLabelRoot` → `'stair'`. Η σκάλα ΔΕΝ περνά από τον κοινό `footprintPoints`
  core (δεν έχει ενιαίο footprint).
- **i18n**: 1 νέο key `snapModes.labels.bim.noun.stair` («σκάλας» / "of stair") → σύνθεση «Γωνία/
  Μέσο σκάλας» μέσω του υπάρχοντος `resolveBimSnapLabelText` (καμία νέα υποδομή).
- Ο generic `BimCharacteristicSnapEngine` καταναλώνει **αυτόματα** το νέο resolver — **καμία αλλαγή
  στα engines / registry / priorities**.

**Companion (render):** hover → εμφάνιση grips για ΟΛΕΣ τις οντότητες — βλ. ADR-040 changelog
2026-07-11 (overlay-only, bitmap-cache invariant).

**Tests:** `bim/stairs/__tests__/stair-characteristic-points.test.ts` (6 tests: grip positions ⊆
corners, tread corners > grips, per-surface midpoints, finite coords, straight + l-shape, **landing
vertices ⊆ corners** — γωνιακή περιοχή L/U). PASS.

**Files:** NEW `stair-characteristic-points.ts` + test· MOD `bim-characteristic-points.ts` +
`el/en dxf-viewer-shell.json`. ✅ Google-level: YES — SSoT reuse, μηδέν διπλότυπο, μηδέν engine
change. 🟡 UNCOMMITTED.
