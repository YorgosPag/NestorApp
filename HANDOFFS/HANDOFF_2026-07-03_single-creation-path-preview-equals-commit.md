# HANDOFF — «Μία διαδρομή δημιουργίας» τοίχων region-fill: preview ≡ commit 100%

**Ημερομηνία:** 2026-07-03
**Subapp:** DXF Viewer (`src/subapps/dxf-viewer`)
**Μοντέλο:** Opus 4.8 (geometry/architecture — κράτα Opus)
**ADR owner:** ADR-419 (επόμενη έκδοση **v2.4**)
**Εργαλείο-στόχος:** «Τοίχος μέσα σε περιοχή» (`wall-region-inside`) + «Τοίχος από περίγραμμα» (`wall-from-perimeter`)

---

## 🎯 ΣΤΟΧΟΣ (Giorgio, εγκεκριμένο)

Ο **εντοπισμός** πλαισίων (πράσινες διακεκομμένες) είναι σωστός, αλλά η **δημιουργία** τοίχων αποκλίνει
(«δείχνει-αλλά-δεν-φτιάχνει» / «φτιάχνει-αλλιώς»). Giorgio: **οι τοίχοι να βασίζονται ΜΟΝΟ σε ό,τι
εντοπίστηκε & εμφανίστηκε πράσινο — καμία διαφορετική αλυσίδα δημιουργίας. 100% ταύτιση.**

**Επιλογή Giorgio για τα rejected: (Α) κόκκινο + tooltip με ΛΟΓΟ** (π.χ. «πολύ κοντός τοίχος»).

---

## 🔍 ΡΙΖΑ (επαληθευμένη με deep code-trace — ΟΧΙ υπόθεση)

Η αλυσίδα **διχάζεται** μετά το `pick.rects`:

- **Preview** (`resolvePerimeterPreview` στο `hooks/canvas/useRegionPerimeterMouseMove.ts`):
  ζωγραφίζει το **ωμό `r.polygon`** κάθε rect (μόνο γεωμετρία, μηδέν model).
- **Commit** (`commitInRegionRects` → `buildFillingWalls` στο `hooks/drawing/use-wall-commit.ts:322`):
  `buildWallFillingRect` (**validator** — απορρίπτει length/thickness/height) → `extendFillingWallToNeighbors`
  (Revit auto-join, επεκτείνει άκρα στους γείτονες) → `onWallCreated` = `addWallToScene`
  (`bim/walls/add-wall-to-scene.ts` → `computeWallTrims`+`applyTrimPatches` = **miter/bevel** + structural-overlap block).

→ **3 στάδια** (validate + extend + miter) που το preview ΔΕΝ τρέχει = τα σημεία απόκλισης.

---

## 🏗️ ΛΥΣΗ (big-player: transaction-preview — το preview ΕΙΝΑΙ το μοντέλο, μη-δεσμευμένο)

**ΕΝΑ SSoT compute, δύο καταλήξεις (render vs persist).** Όλα τα enablers είναι **ήδη καθαρές
συναρτήσεις** → τρέχουν transient χωρίς mutation:
- `buildWallFillingRect` (`bim/walls/wall-in-region.ts`) — pure, null σε validator-reject.
- `extendFillingWallToNeighbors` (`bim/walls/wall-region-autojoin.ts`) — pure.
- `computeWallTrims` + `applyTrimPatches` (`bim/walls/wall-trims.ts`) — pure (add-wall-to-scene τα καλεί).
- `computeWallGeometry` (`bim/geometry/wall-geometry.ts`) → `wall.geometry.footprint.vertices`.
- `detectedRectAxis` (`bim/walls/wall-in-region.ts`, NEW αυτής της συνεδρίας) — άξονας/μήκος/πάχος SSoT.
- `collectColumnFootprints` (private στο add-wall-to-scene — ίσως χρειαστεί export ή re-impl 3 γραμμές).

### Βήματα υλοποίησης

**1. NEW pure `bim/walls/filling-walls-compute.ts`:**
```ts
export interface FillingWallReject { readonly rect: DetectedRectangle; readonly reason: string; } // reason = i18n key του validator
export interface FillingWallsResult { readonly walls: WallEntity[]; readonly rejected: FillingWallReject[]; }

// Build + validate + extend — VERBATIM από buildFillingWalls (use-wall-commit.ts:322-341),
// αλλά κρατά τον λόγο απόρριψης (κάλεσε validateWallParams για το key όταν buildWallFillingRect→null).
export function computeFillingWalls(
  rects: readonly DetectedRectangle[],
  overrides: WallParamOverrides,
  sceneUnits: SceneUnits,
  levelId: string,
  sceneEntities: readonly Entity[],
): FillingWallsResult

// Preview-only: τρέχει το ΙΔΙΟ computeWallTrims+applyTrimPatches transient σε [sceneWalls, ...walls]
// → επιστρέφει τα ΤΕΛΙΚΑ mitered footprints (Point2D[][]) ΧΩΡΙΣ mutation. (Reuse collectColumnFootprints.)
export function computeFillingWallFootprints(
  walls: readonly WallEntity[],
  sceneEntities: readonly Entity[],
): Point2D[][]
```
⚠️ **structural-overlap parity:** το `addWallToScene` κάνει no-op αν ο τοίχος επικαλύπτει υπάρχουσα δομική
(`findStructuralOverlap`). Για 100% parity, το `computeFillingWalls` πρέπει να μαρκάρει κι αυτά ως rejected
(reason = occupied/blocked). Το preview ΗΔΗ έχει `findStructuralOverlap` import στο useRegionPerimeterMouseMove
(zone.occupied) — reuse το ΙΔΙΟ SSoT.

**2. Commit — `use-wall-commit.ts` `buildFillingWalls`:** refactor να καλεί `computeFillingWalls`, μετά
`onWallCreated(w)` ανά τοίχο (το `addWallToScene` κάνει τον **authoritative** miter+neighbor-patch+persist —
ΜΗΝ διπλο-miter-άρεις στο commit). Επιστρέφει `built = walls.length`. Το `commitPerimeterFaces` (outer-perimeter)
ίδιο pattern (χρησιμοποιεί `result.rects`). Συμπεριφορά **ταυτόσημη** με τώρα.

**3. Preview — `resolvePerimeterPreview`:** αντικατέστησε το `pick.rects.map(r=>r.polygon)` με:
`computeFillingWalls(pick.rects, overrides, sceneUnits, levelId, entities)` → για κάθε buildable τοίχο
δείξε το footprint από `computeFillingWallFootprints` (πράσινο)· για κάθε `rejected` δείξε το `rect.polygon`
κόκκινο + `reason`. Το `overrides` = από `wallToolBridgeStore.get()?.overrides` (ίδιο με το commit· δες πώς
το commit παίρνει `s.overrides`). ⚠️ κράτα το `_lastSig` dedup (μηδέν recompute όσο μένει στην ίδια περιοχή).

**4. `systems/region-preview/RegionPerimeterPreviewStore.ts`:** `RegionPerimeterZone` += optional
`reason?: string` (i18n key) + optional `occupied?` (υπάρχει ήδη). Ο overlay
`RegionPerimeterPreviewOverlay.tsx` δείχνει κόκκινο όταν `reason`/`occupied` + `<title>`/tooltip με `t(reason)`.

**5. i18n (ΕΠΙΛΟΓΗ Α):** πρόσθεσε keys στο `src/i18n/locales/el/*.json` + `en/*.json` ΠΡΩΤΑ (N.11):
namespace `regionPerimeter.rejected.*` → π.χ. `lengthTooShort`, `thicknessExceedsMax`, `occupied`.
Χαρτογράφησε τα validator keys (`wall.validation.hardErrors.*`) → φιλικά μηνύματα.

**6. Tests** (`bim/walls/__tests__/filling-walls-compute.test.ts` NEW):
- `computeFillingWalls` παράγει ΙΔΙΑ walls (axis/thickness/extend) με το commit path.
- rejected: κοντός (<20mm) → reason `lengthTooShort`· χοντρός (>2000) → `thicknessExceedsMax`.
- `computeFillingWallFootprints`: T-junction → mitered footprint ≠ raw rect (miter εφαρμόστηκε).
- Regression: `wall-in-region`, `wall-footprint-decompose`, `perimeter-from-faces`, `wall-region-autojoin`,
  `wall-from-perimeter`, `auto-area/*` πρέπει να μένουν πράσινα.

**7. ADR-419 v2.4** — changelog: «μία διαδρομή δημιουργίας, preview≡commit 100% via computeFillingWalls SSoT».

---

## ⚠️ ΚΑΤΑΣΤΑΣΗ / ΚΑΝΟΝΕΣ

- **Shared tree με ΑΛΛΟΥΣ agents** (wall-merge/ADR-566, dimensions, κ.λπ.). **ΠΟΤΕ `git add -A`.** Stage μόνο δικά σου.
- **Προϋπάρχον fail** `bim/columns/__tests__/add-column-to-scene.test.ts` («commitHotGripCopy → column-center»,
  1 test) — **ΑΛΛΟΥ agent, ΟΧΙ δικό μας** (verified: αποτυγχάνει και με stashed τα δικά μας αρχεία). Αγνόησέ το.
- **ΟΧΙ tsc** (N.17) — μόνο jest στοχευμένα. **Commit/push = Giorgio.**
- Big-player level (Revit transaction-preview), FULL SSoT, ADR-driven. SSoT audit (grep) ΠΡΙΝ νέο helper.

---

## 📦 UNCOMMITTED ΔΟΥΛΕΙΑ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ (ADR-419 v2.0→v2.3) — να γίνει commit από Giorgio

Όλα browser-verify pending + commit (stage ΜΟΝΟ αυτά):
- `bim/walls/region-tolerance.ts` — v2.0 `resolveRegionLoopTolerances` (node-merge cap vs gap-closure).
- `bim/walls/perimeter-from-faces.ts` — v2.0 thread capped mergeTol.
- `hooks/drawing/use-wall-region-clicks.ts` — v2.0 route rects≥1 μέσω loop detector.
- `bim/types/wall-types.ts` — v2.1 `REGION_FILL_MIN_WALL_LENGTH_MM=20`.
- `bim/validators/wall-validator.ts` — v2.1 `minLengthMm` param.
- `hooks/drawing/wall-completion.ts` — v2.1 `buildWallEntity` minLengthMm.
- `bim/walls/wall-in-region.ts` — v2.1 region-fill floor + v2.3 `DetectedRectangle.axis?` + `detectedRectAxis` SSoT.
- `hooks/canvas/useRegionPerimeterMouseMove.ts` — v2.1 preview filter + v2.3 axis-aware label.
- `bim/walls/wall-footprint-decompose.ts` — v2.2 through-wins T-junction + v2.3 orient→axis.
- Tests: `wall-validator.test.ts`, `wall-in-region.test.ts`, `wall-footprint-decompose.test.ts`, `perimeter-from-faces.test.ts`.
- `docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md` (v2.0-v2.3 entries).

**Τι πέτυχαν (context):** v2.0 μικρό πλαίσιο δεν εντοπιζόταν (node-merge collapse)· v2.1 κοντά στελέχη δεν
γίνονταν τοίχοι (MIN_WALL_LENGTH_MM)· v2.2 ψηλός κάθετος διέκοπτε τον διαμπερή οριζόντιο (through-wins)·
v2.3 κοντός-χοντρός stub έβγαινε άξονα παράλληλο αντί κάθετο (explicit axis). Regression: 169/169 πράσινα.

---

## 🧪 Verification
- jest στοχευμένα (computeFillingWalls parity + rejected reasons + miter footprint + regression).
- Browser (`localhost:3000/dxf`, DXF `Αδείας.Κάτοψη ισογείου-EXPLODE_ΧΩΡΙΣ_ΧΑΤΣ.dxf`): «Τοίχος μέσα σε
  περιοχή» → hover: πράσινο = ΑΚΡΙΒΩΣ οι τοίχοι που θα γίνουν (extended+mitered)· κόκκινο+tooltip για rejected.
  Κλικ → οι ΙΔΙΟΙ ακριβώς τοίχοι.
