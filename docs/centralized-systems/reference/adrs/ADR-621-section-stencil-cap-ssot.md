# ADR-621: Section stencil-cap SSoT — material builders + scene-mask + render-state guard

## Status
✅ **ACTIVE — 2026-07-10** — De-duplication of `src/subapps/dxf-viewer/bim-3d/systems/section/` (the ADR-366/452 stencil cut-cap subsystem). The seven stencil/cap material factories, the five hatch-texture builders, the four scene-parity masking loops, and the two renderer save/restore blocks each hand-rolled the same skeleton. Collapsed onto **two material SSoT constructors**, **one hatch-canvas helper**, **one scene-mask pair**, and **one RAII render-state guard** — every public function keeps its **identical public API**.

**Related:**
- **ADR-366 §A.3 / ADR-452** — the true-stencil cut-cap algorithm (warmup-seed single-pass parity, robust two-pass grey base, per-material colour/hatch overlays, selection emphasis) these helpers implement. All version-specific rationale (v2.18 depthTest, v2.19/v2.22 polygonOffset, v2.20 single-pass, v2.22 two-pass) is preserved verbatim on the thin wrappers.
- **ADR-483** — the `isSectionParityOverlay` predicate (edge fat-lines + M/V/N overlays excluded from the parity), now consumed by the shared `hideNonParityMeshes`.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the sibling-clone iteration to **zero** across all touched src files.
- **ADR-605/606/607/609/610/611/613/614/616/617/618** — the same multi-day jscpd sweep; ADR-621 extends it into `bim-3d/systems/section` (cluster #12).

---

## Context

A real SSoT audit (full reads of `section-stencil-materials`, `section-hatch-cap`, `section-cut-cap-groups`, `section-stencil-secondary-passes`, `section-stencil-renderer` + a fresh jscpd pass listing **16 intra-dir clone pairs / 256 cloned lines**) grouped the clones into four coherent shapes:

1. **Stencil/cap materials** (~130 cloned lines) — the four colour-less **parity** materials (`createSinglePassMaterial` / `createSinglePassCutParityMaterial` / `createBackParityMaterial` / `createFrontParityMaterial`) share a byte-identical body and differ ONLY in `side` / `depthTest` / `stencilZPass`; the **cap** materials (`createCapMaterial` / `createOpaqueCutCapMaterial` / `createSelectedCapMaterial` + `getHatchCapMaterial` + `getColorCapMaterial`) share the same `NotEqual(0)→Replace`, ref-0, DoubleSide / depthWrite-off mask and differ only in colour/opacity/texture, `depthTest`, and the optional coplanar `polygonOffset`.
2. **Hatch texture preamble** (~30 cloned lines, 5×) — every `build*Texture` opened with the same `createElement('canvas')` → `width/height = SZ` → `getContext('2d')` → `fillStyle = BG; fillRect` block before drawing its own pattern.
3. **Scene-parity masking** (~50 cloned lines, 3×) — `capCutSection`, `renderEmphasisCapForPlane`, and `renderHatchGroupForPlane` each traversed `mainScene`, hid the always-on-top overlays (always) plus every BIM mesh outside an isolate/selection set (optionally), collected a `hidden[]`, and restored it afterwards. A fourth site (`hideEdgeOverlaysForParity`) was the overlay-only variant.
4. **Renderer cap render-state** (~30 cloned lines, 2×) — `renderAxisCutCap` and the box `render()` loop both saved the four `autoClear*` flags + the scene background, forced the cap-pass state (all off, background nulled), ran the cap passes, and restored — inline.

---

## Decision

Big-player layering (Revit / Maxon C4D / Figma expose low-level material/scene primitives + thin per-purpose leaves), applied per family. All public function names, signatures, exported types, and behaviour are preserved; the only internal API change is the secondary passes taking a `PlaneCapPass` context object instead of nine positional args (no external consumer — the renderer is the sole caller).

### 1. `section-stencil-materials.ts` — two material SSoT constructors (family A)
- **`createParityStencilMaterial({ side, depthTest, zPass })`** — the colour-less parity skeleton (colorWrite OFF, `Always`/`Keep`/`Keep`). The four `create*Material` parity wrappers now return it with their own three values; the renderer test still pins each config.
- **`createCutCapMaterial({ color?, opacity?, map?, depthTest, polygonOffset? })`** — the `NotEqual(0)→Replace` cap skeleton (`transparent = opacity < 1`; optional `map`; optional coplanar `polygonOffset` as factor=units). Reused by the three cap wrappers **and** `getHatchCapMaterial` (textured) and `getColorCapMaterial` (per-colour), killing the cross-file cap clones.

### 2. `section-hatch-cap.ts` — `createHatchCanvas()` (family B)
- Returns `{ canvas, ctx }` pre-filled with the cut-surface background. The five hatch builders draw only their own pattern on it.

### 3. `section-parity-scene.ts` (new) — scene-mask + render-state SSoT (families C + D)
- **`hideNonParityMeshes(mainScene, keepMesh?)` / `restoreHidden(hidden)`** — hide overlays (always) + the BIM meshes `keepMesh` rejects (optional), returning the list to restore. The four masking sites collapse onto it; `keepMesh` expresses isolate-set / selection / per-material membership.
- **`withSectionCapRenderState(renderer, mainScene, body)`** — RAII guard that puts the renderer into the cap-pass state and restores it in a `finally` (even if `body` throws). Both renderer sites wrap their cap passes in it.

### 4. `section-stencil-secondary-passes.ts` — `PlaneCapPass` + `runMaskedParity` (family C)
- **`PlaneCapPass`** bundles the per-plane render invariants (renderer/scene/camera/gl/planes/size/center). **`runMaskedParity(ctx, pass, keepMesh)`** owns the shared warmup-seed → FRONT-override → masked scene render. The emphasis + hatch passes now differ only in their mask + final cap quad.

---

## Consequences

**Positive**
- **Section dir: 256 cloned lines / 16 pairs → 0** (full jscpd on the dir). Full-scan **3494 → 3447 (−47 clones)**; **zero** new sibling clones (`jscpd:diff` clean on all 6 touched src files).
- One material factory now backs every stencil/cap material in the subsystem; the scene-mask + render-state guards are the reusable spine for any future cap pass. `section-stencil-renderer.ts` shrank **494 → 423 lines** (further under the N.7.1 500-line ceiling).
- New parity test `section-parity-scene.test.ts` (5 cases) locks the mask + render-state contract (overlay always hidden, `keepMesh` masking, no phantom re-show, state set-during / restored-after / restored-on-throw). All pre-existing section suites green — **17/17** (12 prior + 5 new).

**Negative / risk**
- The secondary passes now take a `PlaneCapPass` object rather than positional args — an internal signature change; the renderer (sole caller) is updated in the same change, external consumers are none.
- `createCutCapMaterial`'s optional-field spread (`if (opts.x !== undefined)`) builds the same `MeshBasicMaterialParameters` the inline literals did; the renderer test asserts the opaque cap's `polygonOffsetFactor/Units < 0` and the parity configs unchanged.

**Baseline note (shared tree):** `.jscpd-baseline.json` was **NOT** relocked — the working tree carries other agents' uncommitted work (Tekton import, stair-from-region, rect-lock), so the absolute count conflates. CHECK 3.28 passes as-is (3447 ≤ baseline 3494); Giorgio re-runs `npm run jscpd:baseline` after committing to lock the true post-commit floor.

---

## Changelog
- **2026-07-10** — Initial. De-duplicated `bim-3d/systems/section/` (jscpd cluster #12) into four SSoT families: `createParityStencilMaterial` + `createCutCapMaterial` (section-stencil-materials), `createHatchCanvas` (section-hatch-cap), `hideNonParityMeshes`/`restoreHidden` + `withSectionCapRenderState` (new section-parity-scene), `PlaneCapPass` + `runMaskedParity` (section-stencil-secondary-passes). Renderer 494→423 L. Section clones 256→0; full-scan 3494→3447. Parity test added; 17/17 green.
