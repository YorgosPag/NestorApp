# ADR-567 — Καμία δομική BIM οντότητα πάνω σε υπάρχουσα (no-overlap placement guard)

**Status:** ✅ 🟢 IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-07-03
**Domains:** DXF Viewer · BIM · Placement · Geometry
**Author:** Giorgio (order) + agent (impl)

---

## Context

Ο Giorgio (2026-07-03) ζήτησε: **ΠΟΤΕ** να μην μπορεί να τοποθετηθεί τοίχος σε περιοχή που
ήδη καταλαμβάνει άλλος τοίχος — και το ίδιο για **ΟΛΕΣ τις δομικές BIM οντότητες** («Δομικά»).

**Κανόνας (επιβεβαιωμένος):**
- **BLOCK** ουσιαστική επικάλυψη εμβαδού/όγκου — πλήρης (Α) ή μερική (Β).
- **ALLOW** γωνίες/ενώσεις/διασταυρώσεις που μοιράζονται μόνο παρειά/σημείο ή ένα μικρό
  τετράγωνο πάχος×πάχος (C) — αλλιώς δεν χτίζεται κανονική κάτοψη.

### Κατάσταση πριν
- Οι τοίχοι είχαν **στενό** guard: `isMemberCollinearOverlap` (axis-based, `use-wall-commit.ts`) —
  μπλόκαρε μόνο **ομοαξονικό/παράλληλο** διπλότυπο «πάνω-πάνω». Δεν έπιανε επικάλυψη υπό γωνία,
  ούτε άλλες οντότητες.
- **Κολόνες, δοκοί, πλάκες, θεμελιώσεις: κανένας hard guard** — μπαίναν οπουδήποτε.

---

## Decision

### 1. ΕΝΑ SSoT overlap guard — `bim/placement/structural-placement-overlap.ts`

Καθαρό (pure) module. **Reuse μόνο υπάρχοντα primitives** (N.0.2):
`safeIntersection` + `multiPolygonArea` (boolean/area SSoT), `wallFootprintPolygon` (miter-aware),
`resolveMemberFootprintVertices` (column/beam).

- `STRUCTURAL_OVERLAP_TYPES = { wall, column, beam, slab, foundation }` (Φ1).
- `structuralFootprintOf(entity): Point2D[] | null` — dispatch ανά τύπο στην υπάρχουσα geometry
  πηγή (wall→union footprint· column/beam→member footprint· foundation→`geometry.footprint`·
  slab→`geometry.polygon`).
- `findStructuralOverlap(candidateFootprint, existing, { excludeIds?, ratioThreshold? })` →
  `{ blockedById, ratio } | null`.

**Κατώφλι (ratio-based):** `ratio = εμβαδόν_τομής / min(area_candidate, area_existing)`.
- `DEFAULT_OVERLAP_RATIO_THRESHOLD = 0.25`.
- Άγγιγμα-μόνο (εμβαδόν τομής ≈ 0) → allow. `ratio ≥ κατώφλι` → block.

Παράδειγμα (τοίχος 3m × 0.2m, area 0.6m²):
| Σενάριο | overlap | ratio | Αποτέλεσμα |
|---|---|---|---|
| Διασταύρωση (+/T) | 0.04m² | 6.7% | ✅ ALLOW |
| Μισός-πάνω-στον-άλλο | 0.30m² | 50% | ❌ BLOCK |
| Διπλότυπο | ~0.60m² | ~100% | ❌ BLOCK |
| Γωνία (κοινή παρειά) | 0 | 0% | ✅ ALLOW |

**Host-child εξαιρέσεις εγγενείς:** `opening`/`slab-opening` δεν ανήκουν στο type set
(ζουν μέσα σε τοίχο/πλάκα) → ποτέ δεν μπλοκάρουν. Construction points/guides δεν είναι στο
`SceneModel.entities` → φυσικά εκτός.

### 2. Enforcement — 2 chokepoints (καλύπτουν όλα τα interactive draws)

- **`bim/scene/append-entity-to-scene.ts`** — `appendEntityToScene` (single) + `appendEntitiesToScene`
  (batch/region-fill). Guard ΠΡΙΝ το `CommandHistory.execute`. Batch: φιλτράρει τα overlapping ΚΑΙ
  εναντίον των ήδη-αποδεκτών του ίδιου batch· `count` = πόσα κόπηκαν.
- **`bim/walls/add-wall-to-scene.ts`** — `addWallToScene`. Guard ΠΡΙΝ trim-recompute/emit· no-op χωρίς
  `drawing:entity-created` → μηδέν persist. Το υπάρχον commit-time `isMemberCollinearOverlap`
  (κόκκινο ghost) **μένει** — ο append-guard είναι καθολικό belt-and-suspenders (N.7.2 #4).

### 3. Feedback

- **Toast:** νέο event `bim:placement-blocked { entityType, blockedById, count }` → non-blocking warning
  (`registerPerimeterBuildNotifications`, `sonner`). i18n `placementBlock.overlap` / `overlapBatch`.
- **Κόκκινο ghost (ευθύς τοίχος):** το wall preview (`wall-ghost-build.buildWallGhostEntity`) γίνεται 🔴
  όταν το footprint του φαντάσματος επικαλύπτει υπάρχουσα δομική — ΟΧΙ μόνο ομοαξονικά (το στενό
  `isMemberCollinearOverlap` έχανε τις κάθετες/υπό-γωνία). Ίδιο SSoT + κατώφλι με τον commit-guard →
  preview ≡ commit. Πηγή: `sceneSnapTargetsStore.structuralEntities` (νέο πεδίο, ίδια σκηνή).
- **Κόκκινο region highlight («Τοίχος/Κολόνα σε περιοχή»):** το hover preview
  (`useRegionPerimeterMouseMove` → `RegionPerimeterPreviewOverlay`) χρωματίζει **ανά ζώνη** — κάθε ζώνη
  που πέφτει πάνω σε υπάρχουσα δομική γίνεται 🔴 (νέο `RegionPerimeterZone.occupied`), οι ελεύθερες
  μένουν 🟢. `markOccupiedZones` καλεί το ΙΔΙΟ `findStructuralOverlap` με τα ΙΔΙΑ live `scene.entities`
  του append guard → preview ≡ commit. (Αυτό ήταν το path που έβλεπε ο Giorgio — region mode, όχι ευθύ.)
- **Perf:** AABB fast-reject στο `findStructuralOverlap` πριν το polygon-clipping (per-frame hover, N.17).
- Κόκκινο ghost για τα ΑΛΛΑ tools (κολόνα/δοκός/πλάκα/θεμελίωση) = Φ2 (ο append-guard τα μπλοκάρει ήδη).

---

## Consequences

- ✅ Google-level: YES — proactive (guard στη δημιουργία, πριν το scene mutation), idempotent,
  SSoT (ΕΝΑ overlap module), reuse όλων των geometry primitives, μονάδο-ανεξάρτητο (ratio).
- **Εκτός Φ1 (flag):**
  - Grid-generated walls/columns (`CreateWallsCommand` / adapter `addEntity`) παρακάμπτουν τα 2
    chokepoints — το grid δεν αυτο-επικαλύπτεται· Φ2 guard αν χρειαστεί.
  - stair / railing / roof — thin/σύνθετα footprints (παραγωγή από treads/bbox) → Φ2.
  - Καθολικό κόκκινο ghost (preview) για όλες τις οντότητες → Φ2 μέσω `placement-ghost-assembly.ts`.
  - Πολύ μικροί τοίχοι-stub (μήκος ≈ πάχος) σε ένωση → πιθανό ratio ≥ 25% (known limitation).

---

## Files

| Αρχείο | Αλλαγή |
|---|---|
| `bim/placement/structural-placement-overlap.ts` | **NEW** — SSoT guard |
| `bim/placement/__tests__/structural-placement-overlap.test.ts` | **NEW** — 17 jest ✅ |
| `bim/scene/append-entity-to-scene.ts` | guard (single + batch) |
| `bim/walls/add-wall-to-scene.ts` | guard (walls) |
| `systems/events/drawing-event-map-bim.ts` | `bim:placement-blocked` event |
| `hooks/notifications/perimeter-build-notifications.ts` | toast registrar |
| `i18n/locales/{el,en}/dxf-viewer-shell.json` | `placementBlock.*` |
| `hooks/drawing/wall-ghost-build.ts` | 🔴 ghost όταν footprint overlap (ευθύς τοίχος, preview ≡ commit) |
| `bim/framing/scene-snap-targets.ts` | νέο πεδίο `structuralEntities` |
| `systems/region-preview/RegionPerimeterPreviewStore.ts` | `RegionPerimeterZone.occupied` |
| `components/dxf-layout/RegionPerimeterPreviewOverlay.tsx` | per-zone χρώμα (🔴 occupied/oversized) |
| `hooks/canvas/useRegionPerimeterMouseMove.ts` | `markOccupiedZones` (region hover → 🔴) |

---

## Verification (browser, N.17 — ΟΧΙ tsc)
1. `/dxf/viewer` — τοίχος πάνω σε τοίχο (ίδιος άξονας) → δεν μπαίνει· κάθετα (T/+) → μπαίνει.
2. Κολόνα μέσα σε κολόνα/τοίχο → δεν μπαίνει· στη γωνία (touch) → OK.
3. Πλάκα-σε-πλάκα, πέδιλο-σε-πέδιλο → block· διπλανά/εφαπτόμενα → allow.
4. Region-fill → γεμίζει μόνο τα κενά κελιά. Toast στο μπλοκάρισμα.
5. `npx jest structural-placement-overlap` → 17/17 ✅.

---

## Changelog
- **2026-07-03** — Initial implementation (UNCOMMITTED). SSoT module + 2 chokepoints + event/toast/i18n
  + 17 jest. Φ1 = wall/column/beam/slab/foundation. Threshold default 25% (Giorgio-tunable).
- **2026-07-03** — Preview red-ghost fix (Giorgio browser-report: ghost έμενε πράσινο πάνω σε τοίχους).
  Wall ghost γίνεται 🔴 σε footprint overlap (όχι μόνο ομοαξονικό) μέσω `structuralEntities` +
  `findStructuralOverlap` + AABB fast-reject. 227 jest πράσινα.
