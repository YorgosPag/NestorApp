# ADR-371 — BIM Corner Snap System (Revit/ArchiCAD-grade Face-Corner Snapping)

> **Note**: This document is officially numbered **ADR-371**. The filename `ADR-370-bim-corner-snap-system.md` is preserved for git-blame continuity. ADR-370 is already taken by `ADR-370-bim-readonly-visualization.md`. See also `ADR-371-bim-corner-snap-system.md` (redirect stub in the same folder).

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✅ **IMPLEMENTED** 2026-05-22 — Phases 2A-2F complete. 27 files created/edited. Integration test (S1-S5) added 2026-05-22. Bugfix: SnapContext.ALL_MODES missing BIM types fixed 2026-05-22. Extension: Wall Face Corner Projection Snap (Revit-style) added 2026-05-22. |
| **Date** | 2026-05-22 |
| **Category** | DXF Viewer — Snapping / BIM Precision |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-370-bim-corner-snap-system.md` (official number: ADR-371) |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Related ADRs** | ADR-040 (Preview Canvas Perf), ADR-087 (Snap Engine Config), ADR-137 (Snap Icon Geometry), ADR-149 (Snap Engine Priorities), ADR-189 (Construction Guides), ADR-363 (BIM Drawing Mode — Phase 5.5d/5.5i column anchor template), ADR-362 (Dimensions) |
| **Implementation template** | `ColumnCenterSnapEngine` (ADR-363 Phase 5.5i) + `column-anchors.ts` (ADR-363 Phase 5.5d) |

---

## Summary

Επέκταση του Pro Snap Engine V2 με **4+1 νέους snap engines** που επιτρέπουν στον χρήστη να snap-άρει με ακρίβεια στις **γωνίες της διατομής** των BIM οντοτήτων (τοίχοι, δοκάρια, πλάκες, κολώνες, ανοίγματα), αντί μόνο στα κεντρικά grips του άξονα.

**Το πρόβλημα**: Όταν ο μηχανικός σχεδιάζει έναν τοίχο BIM, εμφανίζονται 3 grips πάνω στον άξονα (start/end/midpoint). Αν θέλει να ενώσει τις **εξωτερικές γωνίες** δύο τοίχων (industry-standard wall corner alignment), τα grips δεν αρκούν — βρίσκονται μισό πάχος μέσα από την πραγματική γωνία.

**Η λύση**: Ξεχωριστά snap engines που εκθέτουν τα 4 corner points (start-left, start-right, end-left, end-right για τοίχους — 4 outline vertices για δοκάρια — N polygon vertices για πλάκες — 4 bbox corners για κολώνες — 4 outline corners για ανοίγματα), διαθέσιμα ως snap targets με την υψηλότερη προτεραιότητα (-2 στην ιεραρχία ADR-149).

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

```svg
<!-- ┘ L-bracket — corner mark
     Stroke 2px, color = canvasUI.overlay.colors.snap.border -->
<svg viewBox="0 0 14 14">
  <polyline points="3,3 3,11 11,11"
            stroke={color}
            strokeWidth={2}
            fill="none"/>
</svg>
```

**Σημείωση rotation**: Στο Phase 4 μένει static (πάντα ┘). Σε μελλοντική phase μπορεί να περιστρέφεται προς το κέντρο της οντότητας (auto-orient), αλλά ξεκινάμε static για απλότητα.

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
| 2026-05-22 | Bugfix | `SnapContext.ALL_MODES` δεν περιλάμβανε BIM/DIM snap types → `enabledModes` Set ποτέ δεν τα περιλάμβανε → `useSnapManager.updateSettings({ enabledTypes })` αντικαθιστούσε το `DEFAULT_PRO_SNAP_SETTINGS.enabledTypes` με Set χωρίς BIM types → οι 5 BIM corner snap engines ποτέ δεν αρχικοποιούνταν. Fix: +8 types στο `ALL_MODES` + matching default enabled state. File: `SnapContext.tsx`. |
| 2026-05-22 | Extension | **Wall Face Corner Projection Snap** (Revit-style). Όταν κάνει drag ένα endpoint grip τοίχου, τα face corners (cursor ± halfThickness × perp) ελκύονται στις BIM γωνίες γειτονικών οντοτήτων. Τα νέα αρχεία: `GripDragStore.ts` (imperative grip context store), `wall-face-corner-snap.ts` (projection utility). Edits: `useUnifiedGripInteraction.ts` (set/clearActiveDragGrip), `mouse-handler-move.ts` + `mouse-handler-up.ts` (face corner projection block). |

---

## 16. Related Work & References

- **ADR-040** — Preview canvas perf (lifecycle owner = useGlobalSnapSceneSync).
- **ADR-087** — Snap engine config centralization (tolerance-config.ts).
- **ADR-137** — Snap icon geometry (SVG sizes via SNAP_ICON_GEOMETRY).
- **ADR-149** — Snap engine priorities (BIM_*_CORNER = -2 entry in `SNAP_ENGINE_PRIORITIES`).
- **ADR-363 Phase 5.5d** — Column anchor world points (template for §5.1-5.5 anchor modules).
- **ADR-363 Phase 5.5i** — ColumnCenterSnapEngine (template for §6 snap engines).

External references:
- Revit Endpoint snap on wall faces: Autodesk Revit User Guide § "Object Snaps".
- ArchiCAD Wall Hotspots: Graphisoft ArchiCAD 27 Reference Manual § "Drawing Aids".
- Vectorworks Smart Cursor: Vectorworks 2024 Getting Started Guide § "Snapping".
