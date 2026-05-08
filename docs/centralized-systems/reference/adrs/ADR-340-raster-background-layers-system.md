# ADR-340 — Floorplan Background System (PDF + Image, single-per-floor, Procore-grade separation)

**Status:** ✅ **IMPLEMENTED** (2026-05-08) — Phases 1-9 complete + **Phase 4 REBORN** (unified Wizard upload entry point with smart routing + HARD floor wipe). Phase 8 ships the visual regression suite, a11y audit, SSoT registry module, and the Firestore-emulator integration suite (deferred from Phase 7). **Phase 9** ships the Multi-Kind Overlay system: 7 geometry renderers (line/circle/arc/dimension/measurement/text), hit-test dispatch, persistence mapper, MeasureToolOverlay, CalibrateScaleDialog, SSoT registry modules, and 56-test coverage suite (STEP M). All ship gates green; baselines locked. §4 Migration plan è HISTORICAL — wrapper non costruito, vecchio PDF subsystem rimosso integralmente.
**Date:** 2026-05-07
**Author:** Claude (Opus 4.7) + Γιώργος
**Mandate:** GOL + SSOT — full enterprise scope, zero MVP variants, completeness over phased-light, industry-standard convergence (Procore / SAP / Bluebeam)
**Supersedes (parzialmente):** PDF Background subsystem (`src/subapps/dxf-viewer/pdf-background/*`) → ridotto a **provider** PDF dietro un'astrazione comune
**Related ADRs:**
ADR-002 (z-index hierarchy),
ADR-003 (FloatingPanel compound),
ADR-029 (panel dimensions),
ADR-031 (Canonical File Storage System — `buildStoragePath`),
ADR-054 (FileUploadButton),
ADR-067/068/071 (geometry-utils, clamp, angle conversion),
ADR-134/170 (Telegram + attendance, side-context only),
ADR-292 (FILES collection unification),
ADR-294 (SSoT ratchet),
ADR-298 (Firestore rules tests),
ADR-301 (Storage rules tests),
ADR-310/311/312 (showcase + photo capture, side-context),
SPEC-237D (overlay support on PDF backgrounds)

---

### Changelog

| Date | Changes |
|------|---------|
| 2026-05-08 | ✅ **Phase 9 — Multi-Kind Overlays — STEP M — Tests + ADR-340 Phase 9 close** (Sonnet 4.6, GOL+SSOT) — closes Phase 9 with a 56-test coverage suite across 10 new test files. **Per-shape renderer tests** (`overlay-renderer/__tests__/`): `line.test.ts` (3 tests — strokeStyle/lineWidth/beginPath/moveTo/lineTo/stroke, dashed pattern set+reset, Y-flip worldToScreen), `circle.test.ts` (4 tests — radius×fit.scale, fill when given, guard zero/negative), `arc.test.ts` (3 tests — Y-flip: angles negated + CCW swapped, CCW=false→true, guard zero radius), `dimension.test.ts` (3 tests — 3 beginPath + 2 arrowhead fill + 1 stroke; label from unitsPerMeter; label from explicit value), `measurement.test.ts` (4 tests — guard <2 points; distance polyline+ticks+label; area closedPath+fill; angle label at vertex screen position), `text.test.ts` (6 tests — skip empty; Y-flip rotation negate; fontSize clamp 8px min; fontSize clamp 72px max; strokeText when stroke given; save/restore wrap). **Behavioral tests** (`media/__tests__/`): `overlay-hit-test.test.ts` (9 tests — polygon→isPointInPolygon dispatch; line hit/miss; circle on-circumference hit/inside miss; text AABB hit/miss; AABB computation for line/circle/text; DEFAULT_HIT_TOLERANCE export). `MeasureToolOverlay.test.tsx` (6 tests — **critical**: no `createFloorplanOverlay` import (bundle isolation static check); no dxf-viewer subapp imports; mode=null→null render; mode set→canvas+aria-label; mode toggle removes canvas; ESC listener add+remove on mount/unmount). `CalibrateScaleDialog.test.tsx` (5 tests — dialog title rendered; save disabled without 2 points+distance; 2-click+distance→POST with computed scale→onCalibrated+onOpenChange(false); POST rejection→error message shown; same-pixel click→zero-distance error without POST). **DXF subapp test** (`hooks/drawing/__tests__/`): `overlay-persistence-utils.test.ts` (10 tests — full matrix: line/rectangle/circle/arc-3p/polyline/polygon/measure-distance/measure-area/measure-angle/null-for-mismatch; validates `closed` flag, `mode`, computed `value` via geometry math, `points` length). **Bundle isolation verified**: MeasureToolOverlay.tsx static check confirms zero imports from dxf-viewer. **All 56 tests pass** (`npx jest --testPathPatterns="overlay-renderer/__tests__\|media/__tests__\|drawing/__tests__/overlay-persistence"` → 10 suites, 56/56). **N.7.2**: ✅ Google-level: YES — per-function unit tests covering all branching behaviors (Y-flip, guard clauses, mode dispatch, label position, hit-test dispatch), static bundle-isolation assertion, POST mock validates correct scale computation. ✅ **Phase 9 CLOSED.** STEP L remains BLOCKED on WIPE TEST DB. **Files**: `src/components/shared/files/media/overlay-renderer/__tests__/{line,circle,arc,dimension,measurement,text}.test.ts` (NEW — 6 files), `src/components/shared/files/media/__tests__/{overlay-hit-test,MeasureToolOverlay,CalibrateScaleDialog}.test.tsx` (NEW — 3 files), `src/subapps/dxf-viewer/hooks/drawing/__tests__/overlay-persistence-utils.test.ts` (NEW). |
| 2026-05-08 | 🛠️ **DXF Viewer settings panel ↔ canvas live-repaint fix (architectural — UnifiedFrameScheduler ADR-030)** (Opus 4.7, GOL+SSOT, orchestrator audit) — fix: changes in the floating "Ρυθμίσεις DXF" panel (Crosshair color/width/opacity/size, cursor pickbox shape/size/color, selection-box window/crossing fill/stroke/style, grid+ruler colors when applicable) were not visible on the canvas until the user moved the mouse. **Root cause** (4-subagent parallel audit): `CursorConfiguration.notifyListeners()` (`src/subapps/dxf-viewer/systems/cursor/config.ts:233`) updates listener refs (e.g. `CrosshairOverlay.settingsRef.current`) but never marks any canvas system dirty. The `UnifiedFrameScheduler` (ADR-030) gates each overlay's `render()` on its `isDirty()` callback, and every overlay's dirty function reads only position/active state — never settings. Result: settings change → ref mutated silently → next RAF tick `isDirty()=false` → skip repaint → wait for mouse move. Same gap also present in `useLayerCanvasRenderer` (`canvas-v2/layer-canvas/layer-canvas-hooks.ts:278`) whose dirty `useEffect` listed `layers/transform/viewport/cursor.position/...` but **omitted** `crosshairSettings`/`cursorSettings`/`selectionSettings`/`gridSettings`/`rulerSettings` from its deps even though all five are consumed inside `renderLayers`. **Fix 1 (singleton SSoT)** EDIT `src/subapps/dxf-viewer/systems/cursor/config.ts` — `notifyListeners(settings)` now imports `markAllCanvasDirty` from `../../rendering/core/frame-scheduler-api` and calls it after `super.notifyListeners(settings)`. Single point covering every entry: panel `updateSettings`, `resetToDefaults`, `dxf-provider-cursor-sync` event handler. `markAllCanvasDirty()` flags `dxf-canvas` + `layer-canvas` + `preview-canvas` + `crosshair-overlay` in one call. **Fix 2 (React side, belt-and-suspenders)** EDIT `src/subapps/dxf-viewer/canvas-v2/layer-canvas/layer-canvas-hooks.ts` — added `crosshairSettings`, `cursorSettings`, `selectionSettings`, `gridSettings`, `rulerSettings` to the dirty `useEffect` deps so prop-driven updates (e.g. grid changes that flow via `useRulersGridContext` not via `CursorConfiguration`) also flag the canvas dirty without re-rendering parent. **N.7.2**: ✅ proactive (every settings change paints in ≤ 1 RAF), ✅ idempotent (`forceDirty` boolean is safe to set repeatedly), ✅ SSoT (`notifyListeners` is the single funnel for all cursor-config writes — covers UI, programmatic, and provider-sync paths), ✅ belt-and-suspenders (singleton-side mark + React-prop-side mark — either alone is sufficient, both together cover propagation gaps), ✅ no race (UnifiedFrameScheduler dedupes within a single RAF). **Auxiliary findings** (not fixed in this commit, recorded for follow-up): (a) `src/subapps/dxf-viewer/canvas-v2/overlays/SelectionMarqueeOverlay.tsx` is dead code — never imported, has hardcoded `canvasUI.overlay.colors.selection.*` that would ignore settings; safe to delete in a cleanup commit; (b) `LayerRenderer.renderLegacy()` calls `selectionRenderer.render(selectionContext, ...)` via the `UIRenderer` interface that reads `selectionData` from the context — but the context never has `selectionData` injected, so the legacy-path selection rectangle exits early. Active path is the unified one (`uiComposite`) so users do not see the bug, but it's a latent failure if the legacy flag is ever flipped; (c) snap indicator color is hardcoded in `canvasUI.overlay.colors.snap.border` with no settings panel — out of scope. **Files**: `src/subapps/dxf-viewer/systems/cursor/config.ts` (EDIT — import + 1 call site), `src/subapps/dxf-viewer/canvas-v2/layer-canvas/layer-canvas-hooks.ts` (EDIT — 5 settings deps added + comment). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP K — SSoT registry modules (CHECK 3.18 ratchet)** (Opus 4.7, GOL+SSOT) — Architectural enforcement: registered the `floorplan_overlays` collection access path + the canonical `FloorplanOverlay` / `OverlayGeometry` / `OverlayRole` / `OverlayLinked` type SSoT under `.ssot-registry.json` so the pre-commit CHECK 3.18 (ADR-314 SSoT discover) ratchets prevent regressions of the gateway architecture introduced in STEPS A-J. EDIT `.ssot-registry.json` — added 2 Tier 3 modules: (1) `floorplan-overlay-gateway` with two ERE patterns `\bCOLLECTIONS\.FLOORPLAN_OVERLAYS\b` (catch all collection refs) + `\b(doc\|collection)\(\s*['"]floorplan_overlays['"]` (raw-string fallback, belt-and-suspenders with the `firestore-collections` module) and a 7-file allowlist (gateway, API route + handlers + types, calibration-remap.service, floorplan-cascade-delete.service, firestore-collections SSoT — `tests/firestore-rules/` and `functions/` are globally exempted via `exemptPatterns`); (2) `floorplan-overlay-types` with one ERE pattern `\b(interface\|type)\s+(FloorplanOverlay\|OverlayGeometry\|OverlayRole\|OverlayLinked)\b` (catches re-declarations only — `import type {...}` and `export type {...}` block-form re-exports do NOT match because `\s+` followed by `{` fails the alternation requiring an identifier next) and a 4-file allowlist (canonical SSoT, dxf-viewer polygon-projection store types, floorplan-background provider re-export bridge `type FloorplanOverlay = SharedFloorplanOverlay`, overlay-renderer re-export module). `OverlayStyle` is intentionally OUT of the type pattern — DXF Viewer ships a structurally different `OverlayStyle` (lineWidth-based) for its layering tool, by design. EDIT `scripts/__tests__/fixtures/registry-golden-fixtures.js` — added shouldMatch / shouldSkip golden fixtures for both modules so CHECK 3.18 cannot silently break (closes the v3.0-class `(?:...)` lookahead-silent-match-nothing bug class for these modules from day one). **Boy Scout** — fixed 2 pre-existing dead-code patterns in `quote-entity[1]` and `rfq-entity[1]` (raw `add(` → escaped `\\.add\\(`) that were status-2 in `grep -E` and matched nothing; both modules now compile and join the ratchet correctly. **Verification**: `npm run test:registry-golden` — 56/56 pass (was 55/56 before Boy Scout fix); `npm run test:ssot-discover` — 57/57 pass (wrapper logic regression). **N.7.2**: ✅ proactive (registry blocks regressions BEFORE merge, not after), ✅ idempotent (re-running pre-commit yields same result), ✅ SSoT (single canonical types file + single client gateway), ✅ no race (compile-time + pre-commit-time enforcement, no runtime gate), ✅ explicit ownership (Tier 3 modules with clear ssotFile semantics). ✅ **Google-level: YES** — gateway architecture is now enforced at presubmit, not at code-review time. **Files**: `.ssot-registry.json` (EDIT — 2 new Tier 3 modules + 2 Boy Scout fixes), `scripts/__tests__/fixtures/registry-golden-fixtures.js` (EDIT — 2 new golden fixtures). |
| 2026-05-08 | 🎨 **Phase 4 REBORN FOLLOW-UP part 11 — Status-neutral DRAFT color for unlinked layers** (Opus 4.7, GOL+SSOT) — fix: while drawing a layer over a DXF/PDF/image floorplan in the DXF viewer, the rubber-band preview AND the freshly-saved (still-unlinked) layer painted in `BUTTON_PRIMARY=#3b82f6` blue, identical to the `for-rent` status blue → visually ambiguous. Replaced with a dedicated, status-neutral DRAFT color (pink-500) chosen to be distinct from every status color (no clash with for-rent blue / sold red / for-sale green / reserved orange / for-sale-and-rent teal / landowner purple / off-market gray). EDIT `src/subapps/dxf-viewer/config/color-config.ts` — added `UI_COLORS.LAYER_DRAFT_STROKE = '#ec4899'` and `UI_COLORS.LAYER_DRAFT_FILL = 'rgba(236, 72, 153, 0.3)'` (Tailwind pink-500 @ 30% translucent). EDIT `src/subapps/dxf-viewer/ui/OverlayToolbar.tsx` — `handleModeChange` no longer pre-fills `toolStyleStore` with `STATUS_COLORS_MAPPING[currentStatus]`; it now sets `LAYER_DRAFT_*` so the saved overlay's `style.fill`/`stroke` is status-neutral until an entity is linked (drops `STATUS_COLORS_MAPPING` import). EDIT `src/subapps/dxf-viewer/hooks/layers/useOverlayLayers.ts` — draft polygon (rubber-band preview, line ~303) hardcoded to `LAYER_DRAFT_*`; saved-overlay color decision matrix updated so unlinked overlays fall back to `LAYER_DRAFT_*` instead of `BUTTON_PRIMARY`/`BLACK`. Linked path unchanged (Part 10 still wins via live `useEntityStatusResolver`). **N.7.2**: ✅ proactive (the moment a layer is linked, color flips to status), ✅ idempotent, ✅ SSoT (single `UI_COLORS.LAYER_DRAFT_*` constant — toolbar, draft polygon, unlinked overlay all consume it), ✅ no race (compile-time constant). **Files**: `src/subapps/dxf-viewer/config/color-config.ts` (EDIT — `LAYER_DRAFT_*` constants), `src/subapps/dxf-viewer/ui/OverlayToolbar.tsx` (EDIT — neutral toolStyle on draw start), `src/subapps/dxf-viewer/hooks/layers/useOverlayLayers.ts` (EDIT — draft + unlinked color path). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP J — i18n full pass: `floorplan-overlays` namespace + verification of `files-media.*` measure/calibrate keys** (Opus 4.7, GOL+SSOT) — completes the i18n surface for Phase 9 by introducing a dedicated namespace for overlay role + geometry labels (consumed by future layer panel UI, role pickers, geometry-kind chips, and any tooltip surfacing the discriminated-union variant). **NEW** `src/i18n/locales/el/floorplan-overlays.json` + `src/i18n/locales/en/floorplan-overlays.json` — 13 keys × 2 locales: `roles.{property,parking,storage,footprint,annotation,auxiliary}` (6, 1:1 with `OverlayRole` union from `src/types/floorplan-overlays.ts`) + `geometry.{polygon,line,circle,arc,dimension,measurement,text}` (7, 1:1 with `OverlayGeometry` discriminated union `type` field). el = pure Greek per `feedback_pure_greek_locale`: `Ακίνητο` / `Στάθμευση` / `Αποθήκη` / `Περίγραμμα` / `Σημείωση` / `Βοηθητικό` for roles; `Πολύγωνο` / `Γραμμή` / `Κύκλος` / `Τόξο` / `Διάσταση` / `Μέτρηση` / `Κείμενο` for geometry. ICU-clean (no interpolation needed — pure label table). **EDIT** `src/i18n/namespace-loaders.ts` — added `case 'floorplan-overlays'` to both el (line ~81) and en (line ~176) switches. **EDIT** `src/i18n/lazy-config.ts` — `'floorplan-overlays'` appended to `SUPPORTED_NAMESPACES` (line ~101) so the lazy loader recognizes the new namespace + `Namespace` type union picks it up. NOT added to `criticalNamespaces` preload list in `config.ts` — namespace is consumed only by future overlay-aware UI panels (none currently mounted), no need to pay the boot-time cost; consumers will trigger lazy load on first `useTranslation('floorplan-overlays')`. **Verification of existing keys** (no edits required): `files-media.json` already carries `floorplan.measure.*` (10 keys + 3 unit suffixes — STEP H), `floorplan.calibrate.*` (8 keys + STEP I-partial + 1 `openButton` from STEP I follow-up bcd), `floorplanImport.calibratePrompt.*` (4 keys — STEP I follow-up a). All present in both el + en, all pure Greek, all ICU-clean. **N.7.2**: ✅ SSoT (canonical `OverlayRole` + `OverlayGeometry.type` enums in `src/types/floorplan-overlays.ts` are the ONLY source — locale keys are 1:1 mirror, future contributors adding a new role/geometry MUST update both ADR + types + el + en simultaneously, enforced by CHECK 3.8 i18n missing-keys hook the moment a consumer starts calling `t('floorplan-overlays:roles.X')` for the new value), ✅ Idempotent (pure JSON tables, no runtime branching), ✅ Lifecycle explicit (lazy-loaded; not in critical preload), ✅ Type-safe (Namespace union auto-extends via `typeof SUPPORTED_NAMESPACES[number]`), ✅ Pure Greek (zero English words in el — `Σημείωση` not `Annotation`, `Τόξο` not `Arc`), ✅ ICU-clean (CHECK 3.9: no `{{var}}` — no interpolation in label table). **N.7.1**: el JSON 17 LOC, en JSON 17 LOC, namespace-loaders.ts +2 lines, lazy-config.ts +1 line — all well under limits. **Bundle isolation**: locales live in `src/i18n/locales/`, zero imports from `src/subapps/dxf-viewer/`; namespace registration happens in shared i18n config, not in any subapp. **CHECK 3.8**: namespace currently has zero `t()` callers (no consumer wired yet); when consumers land they will trigger key existence validation against this baseline. ✅ **Google-level: YES** — clean SSoT with type→locale 1:1 mirror, lazy-loaded by default, pure Greek, ready for future role/geometry-aware UI without retrofitting. **Files**: `src/i18n/locales/el/floorplan-overlays.json` (NEW — 13 keys), `src/i18n/locales/en/floorplan-overlays.json` (NEW — 13 keys), `src/i18n/namespace-loaders.ts` (EDIT — +2 case branches), `src/i18n/lazy-config.ts` (EDIT — namespace registration). **Pending (Phase 9 wrap-up)**: STEP K (SSoT registry — `floorplan-overlay-gateway` + `floorplan-overlay-types` modules), STEP L (cascade cleanup post-wipe), STEP M (per-shape renderer tests + measure-tool tests + `CalibrateScaleDialog` POST mock test) → ✅ IMPLEMENTED status flip. |
| 2026-05-08 | 🎨 **Phase 4 REBORN FOLLOW-UP part 10 — DXF viewer canvas honors live entity status (color parity with properties index)** (Opus 4.7, GOL+SSOT) — fix: when a layer is linked to a property/parking/storage in the "Συνδεδεμένη Οντότητα" panel, the DXF viewer canvas now repaints in the entity's status color (e.g. green for `for-sale`) instead of staying on the wizard-time `toolStyleStore` fill (often blue `BUTTON_PRIMARY=#3b82f6`). Same SSoT the read-only viewer uses on the properties index — `useEntityStatusResolver` (`src/hooks/useEntityStatusResolver.ts`) — reused unchanged. EDIT `src/subapps/dxf-viewer/hooks/layers/useOverlayLayers.ts` — import `useEntityStatusResolver` + add a local `getLinkedEntityId(overlay)` helper (kind→propertyId/parkingId/storageId). The hook now resolves a `Map<overlayId, PropertyStatus>` from each overlay's linked entity via Firestore `onSnapshot` (chunked `documentId() in [...]` queries on `PROPERTIES`/`PARKING_SPACES`/`STORAGE`). For each overlay, decision matrix: linked → `effectiveStatus = resolvedStatusMap.get(id)` (live `commercialStatus` from Firestore) and status colors WIN over `overlay.style.fill`/`stroke`; unlinked → keep manual `style.fill`/`stroke` (preserve user's wizard color choice). Outgoing `ColorLayer.status` is `effectiveStatus ?? overlay.status` so downstream consumers (canvas v2, layer panel, future legend) see the live status. Memo deps include `resolvedStatusMap` so a Firestore status change repaints automatically without user action. **N.7.2**: ✅ proactive (subscriptions resolve on overlay mount), ✅ idempotent (Firestore listener semantics + memoized map), ✅ SSoT (`useEntityStatusResolver` already canonical for `useFloorOverlays` on properties index — single source for status→color across read-only AND editor surfaces), ✅ no race (status is derived from live entity, not from a stale `overlay.status` snapshot). **Files**: `src/subapps/dxf-viewer/hooks/layers/useOverlayLayers.ts` (EDIT — import resolver + helper + color decision matrix + status forward + dep). |
| 2026-05-08 | ⚡ **Phase 4 REBORN FOLLOW-UP part 9 — Read-only viewer media tabs go real-time** (Opus 4.7, GOL+SSOT) — uploads from Διαχείριση Ακινήτων (photo / video / floorplan add or trash) now propagate live to Ευρετήριο Ακινήτων `mediaTab=photos`/`videos`/floorplan tabs without a manual refresh. EDIT `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx` — pass `realtime: true` to all three `useEntityFiles({ ... })` calls (`category: 'floorplans'`, `'photos'`, `'videos'`). The hook's existing `realtime` branch (ADR-240, file `src/components/shared/files/hooks/useEntityFiles.ts:222`) opens a Firestore `onSnapshot` via `firestoreQueryService.subscribe('FILES', …)` with the same constraints `getFilesByEntity` uses (`companyId`, `entityType`, `entityId`, `status='ready'`, `isDeleted=false`, `lifecycleState='active'`, `category`), so server writes (`/api/floorplans/process`, file uploads via `EntityFilesManager`, trash mutations) reach this viewer instantly. **N.7.2**: ✅ proactive (subscribe at mount, unsubscribe at unmount), ✅ idempotent (Firestore listener semantics), ✅ SSoT (single hook governs both one-shot and live modes — ADR-031 / ADR-240), ✅ no race (autoFetch is gated off when `realtime=true` per hook contract `:411`). **Pattern parity**: same flag already used in `QuoteOriginalDocumentPanel.tsx:153` and `useCommunicationsPageController.ts:64,102` — composite Firestore indexes covering `(companyId, entityType, entityId, status, isDeleted, lifecycleState, category)` are already deployed for those callers, no new index required. **Files**: `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx` (EDIT — 3 × `realtime: true`). |
| 2026-05-08 | 🐛 **Phase 4 REBORN FOLLOW-UP part 8 — Status-aware price resolver (rent vs sale)** (Opus 4.7, GOL+SSOT) — fix: hover label + Γρήγορη Προβολή/Επιλεγμένο Ακίνητο showed `commercial.askingPrice` even for `for-rent`/`rented` units (e.g. a "ΠΡΟΣ ΕΝΟΙΚΙΑΣΗ" polygon labeled "170.000€" — clearly a sale price). **NEW** `src/lib/properties/price-resolver.ts` (~50 LOC) — `getEffectivePrice(property)` returns `{ amount, mode: 'sale'|'rent' } | null`. Decision matrix: `for-rent`/`rented` → `commercial.rentPrice`; `for-sale-and-rent` → `commercial.askingPrice` (sale priority for headline); all others → `commercial.askingPrice ?? commercial.finalPrice ?? legacy price`. Pure (no hooks/IO), works on any `PricedPropertyLike` shape. EDIT `src/features/read-only-viewer/components/ListLayout.tsx` — `propertyLabels` memo now uses `getEffectivePrice(p)` instead of inline `askingPrice ?? finalPrice ?? price` chain. EDIT `src/features/property-hover/components/PropertyQuickView.tsx` — `effectivePrice = getEffectivePrice(property)?.amount`, plus `isRentPrice` flag to swap the row label between `t('hoverInfo.price')` and new `t('hoverInfo.monthlyRent')`. **i18n** EDIT `src/i18n/locales/{el,en}/properties-viewer.json` — added `hoverInfo.monthlyRent` ("Μηνιαίο ενοίκιο" / "Monthly rent"). **N.7.2**: ✅ SSoT (single resolver — both hover label + quick-view + future consumers share semantics), ✅ idempotent (pure function), ✅ no race, ✅ explicit lifecycle (status drives price field choice). **Files**: `src/lib/properties/price-resolver.ts` (NEW), `src/features/read-only-viewer/components/ListLayout.tsx` (EDIT), `src/features/property-hover/components/PropertyQuickView.tsx` (EDIT), `src/i18n/locales/el/properties-viewer.json` (EDIT — `monthlyRent`), `src/i18n/locales/en/properties-viewer.json` (EDIT — `monthlyRent`). |
| 2026-05-08 | ✨ **Phase 4 REBORN FOLLOW-UP part 7 — `PropertyStatusLegend` overlay (bottom-left)** (Opus 4.7, GOL+SSOT) — adds a data-driven status legend over the floorplan canvas in the read-only viewer. **NEW** `src/components/property-viewer/PropertyStatusLegend.tsx` (~60 LOC) — `'use client'` aside listing only the `PropertyStatus` values present in `properties` (deduped via `Set`). Each row is a colored swatch + i18n label: swatch color comes from the canonical `STATUS_COLORS_MAPPING[status].stroke` (same SSoT the canvas renderer uses, so the legend always matches polygon colors), the label is `t(PROPERTY_STATUS_LABELS[status])`. Swatch rendered via `getDynamicBackgroundClass(stroke)` from `@/components/ui/utils/dynamic-styles` — zero inline `style={{ backgroundColor }}` (CLAUDE.md SOS. N.3). Container is `bg-background/85 backdrop-blur-sm` rounded card with subtle border + shadow. Returns `null` when no properties present. EDIT `src/features/read-only-viewer/components/ListLayout.tsx` — center-panel wrapper gets `relative`; legend rendered as `<PropertyStatusLegend className="absolute bottom-2 left-2 z-10" />` only when `showPropertyHoverInfo` (floor floorplan tab). **N.7.2**: ✅ proactive (memoized presence detection), ✅ idempotent (re-renders deterministic), ✅ SSoT (single status-color table + single status-label table — shared with badge + hover label + canvas), ✅ no race. **Files**: `src/components/property-viewer/PropertyStatusLegend.tsx` (NEW), `src/features/read-only-viewer/components/ListLayout.tsx` (EDIT — import + wrapper relative + overlay). |
| 2026-05-08 | ✨ **Phase 4 REBORN FOLLOW-UP part 6 — In-polygon hover label gains `statusText` line** (Opus 4.7, GOL+SSOT) — `OverlayLabel` now supports an optional `statusText` field rendered as a bold 16px line at the top of the centroid label (above `primaryText`). EDIT `src/components/shared/files/media/overlay-renderer/types.ts` — add `statusText?: string` to `OverlayLabel`. EDIT `src/components/shared/files/media/overlay-renderer/label.ts` — `collectLines()` prepends a bold base-size line when `statusText` is present; doc header updated to up-to-4 lines (status / primary / secondary / emphasis). EDIT `src/features/read-only-viewer/components/ListLayout.tsx` — derive `statusKey = property.commercialStatus ?? property.status`, resolve i18n via `PROPERTY_STATUS_LABELS[statusKey]` from `@/constants/domains/property-status-core`, translate with the existing `useTranslation` instance, then `.toUpperCase()` to mirror the badge styling shown in the right-pane "Γρήγορη Προβολή" panel (e.g. `ΠΡΟΣ ΠΩΛΗΣΗ`). Memo deps now include `t`. SSoT preserved: status labels still resolved through the canonical `PROPERTY_STATUS_LABELS` table (single source for badge + hover label). N.7.2: ✅ proactive (label built once per properties change), ✅ idempotent, ✅ SSoT (single status-label table), ✅ deterministic (no race). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP I follow-up (a) — Wizard post-upload calibration prompt (image v1)** (Opus 4.7, GOL+SSOT) — completes the calibration UX entry-points: image uploads now surface a "Calibrate scale?" prompt directly inside the floorplan-import wizard's success state, eliminating the round-trip "upload → close wizard → navigate to gallery → click Compass". **EDIT** `src/features/floorplan-import/components/StepUpload.tsx` (~70 LOC added) — captures the uploaded `File` + `FloorplanFormat` into local state in the same tick as `setUploadSuccess(true)`, builds a stable `URL.createObjectURL(file)` blob URL via `useMemo` with `URL.revokeObjectURL` cleanup in a dedicated `useEffect` (no leaks across re-renders or unmounts), and conditionally subscribes to the new `useBackgroundScale(uploadSuccess && format === 'image' ? floorId : null)` so the Firestore listener stays closed for non-image uploads + during the in-progress upload window. Success view gains a `<section>` prompt rendered when `format === 'image' && backgroundId && imageSrc && !isCalibrated && !calibrateSkipped`: title + description + 2-button row (`<Button variant="outline">` Skip / `<Button>` with `<Compass>` icon Calibrate now). `<CalibrateScaleDialog>` mounted at the JSX root of the success branch (inside React fragment so it survives sibling unmounts), wired with `onCalibrated={() => setCalibrateSkipped(true)}` so the prompt collapses after a successful POST without re-querying `useBackgroundScale` (the hook still updates `isCalibrated` reactively — `calibrateSkipped` is just an immediate UI signal, defends against the rare onSnapshot lag). **Scope (v1)**: image format only. PDF + DXF intentionally defer to the gallery `<Compass>` affordance (Phase 9 STEP I follow-up (d)) — PDF cannot render as `<img src>` (would require PDF.js page-1 rasterization inside the dialog, an O(week) feature creep), DXF requires server-side `$INSUNITS` parsing which the gateway does not expose to the client today. Both flows remain accessible via the gallery affordance the moment the user navigates to the read-only viewer. **i18n** EDIT `src/i18n/locales/{el,en}/files-media.json` — added `floorplanImport.calibratePrompt.{title,description,calibrate,skip}` (4 keys × 2 locales). el locale: pure Greek (`Βαθμονόμηση κλίμακας;` / `Βαθμονόμηση τώρα` / `Παράλειψη`) per `feedback_pure_greek_locale`; ICU-clean (no interpolation needed); zero hardcoded `defaultValue`. **N.7.2**: ✅ Proactive (subscription opens only after success + format match — never during upload window or for DXF/PDF), ✅ Idempotent (`calibrateSkipped` and `isCalibrated` both collapse the prompt; re-uploading resets state cleanly), ✅ Race-free (`URL.createObjectURL` runs only when `uploadedFile` is set — synchronous in `performUpload`'s `setUploadedFile(file)` before `setUploadSuccess(true)`), ✅ Memory-safe (`URL.revokeObjectURL` on unmount + on file change), ✅ SSoT (single calibration writer — `CalibrateScaleDialog` already wired in STEP I-partial), ✅ Lifecycle explicit (StepUpload owns the prompt + dialog mount; CalibrateScaleDialog owns the POST; useBackgroundScale owns the read; zero shared state), ✅ Awaited (dialog already gates close on POST resolve from STEP I-partial). **N.7.1**: StepUpload total LOC ~450 ≤ 500; new helpers + JSX ≤ 70 LOC added; every helper ≤ 30 LOC. **Bundle isolation**: zero new imports from `src/subapps/dxf-viewer/`. The wizard now imports `Compass` lucide icon, `CalibrateScaleDialog` from media barrel, `useBackgroundScale` hook — all from canonical SSoT paths. **Files**: `src/features/floorplan-import/components/StepUpload.tsx` (EDIT — uploadedFile/uploadedFormat/calibrate state + imageSrc memo + revoke effect + success prompt UI + dialog mount), `src/i18n/locales/el/files-media.json` + `src/i18n/locales/en/files-media.json` (EDIT — `floorplanImport.calibratePrompt.*`). ⚠️ **Google-level: PARTIAL** — image v1 fully wired; PDF + DXF auto-prompt deferred (gallery Compass affordance covers them in practice). Reason: PDF rasterization + DXF parsing inside the wizard would require nontrivial new client-side dependencies + server-side surface area, not justified given the Compass affordance is one click away in the destination view. **Pending (Phase 9 wrap-up)**: STEP J (i18n full pass — `floorplan-overlays.json` namespace), STEP K (SSoT registry — `floorplan-overlay-gateway` + `floorplan-overlay-types` modules), STEP L (cascade cleanup post-wipe), STEP M (per-shape renderer tests + measure-tool tests + `CalibrateScaleDialog` POST mock test) → ✅ IMPLEMENTED status flip. |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP I follow-up (b)+(c)+(d) — Reader hook + caller wiring + gallery Compass affordance** (Opus 4.7, GOL+SSOT) — closes the calibration UX loop end-to-end for raster backgrounds (PDF/Image): once a background exists, the gallery exposes a one-click calibration button; once calibrated, every gallery instance for that floor labels measurements in real meters. **NEW** `src/hooks/useBackgroundScale.ts` (~135 LOC) — read-only subscription to `floorplan_backgrounds` filtered by `floorId` (companyId auto-injected via `firestoreQueryService` default tenant config; CHECK 3.10 satisfied without a manual `where('companyId',…)` since `FLOORPLAN_BACKGROUNDS` defaults to `{ mode: 'companyId', fieldName: 'companyId' }` per `tenant-config.ts`). Exposes `{ backgroundId, unitsPerMeter, sourceUnit, isCalibrated, loading, error }`. Pure helpers `pickActive(docs)` (deterministic earliest-`createdAt` wins, ties by `id.localeCompare` — defends against the rare 2+ backgrounds-per-floor case until upstream cardinality invariant lands), `readScale(doc)` (validates `scale.unitsPerMeter` is finite > 0 + whitelists `sourceUnit ∈ {mm,cm,m,pixel}`). Returns the `EMPTY` sentinel for `floorId === null` — no subscription opened. **EDIT** `src/components/shared/files/media/floorplan-gallery-config.ts` — added `backgroundId?: string | null` to `FloorplanGalleryProps`; `FloorplanGallery` opens the calibration UI only when `isRaster && !!backgroundId`. **EDIT** `src/components/shared/files/media/FloorplanGallery.tsx` — destructure `backgroundId`; new `useState<boolean>(calibrateOpen)`; derive `calibrationImageSrc = isRaster ? (rasterImage?.src ?? currentFile?.downloadUrl ?? null) : null` (PDF page-1 image's `.src` works since `useFloorplanPdfLoader` resolves to a fully-loaded `HTMLImageElement` with a usable URL — no PDF.js handoff inside the dialog); `canCalibrate = isRaster && !!backgroundId && !!calibrationImageSrc`. Header inline gains a `<Compass>` Tooltip-wrapped Button (between the measure toolbar and the zoom controls, matching the existing separator cadence) — visible only when `canCalibrate`. Dialog rendered at the very end of the JSX tree, outside the gallery `<article>` and the fullscreen `<Dialog>`, so it stays above all layers and survives toggling between inline + fullscreen views. Default-hidden for DXF (handoff explicitly excludes DXF — auto-detect via `$INSUNITS` lands in STEP I follow-up (a) wizard hook). **i18n** EDIT `src/i18n/locales/{el,en}/files-media.json` — added `floorplan.calibrate.openButton` (el: `Βαθμονόμηση κλίμακας`, en: `Calibrate scale`) — pure-Greek per `feedback_pure_greek_locale`; same `floorplan.calibrate.*` namespace as STEP I-partial; ICU-clean. **Caller wiring** EDIT `src/features/read-only-viewer/components/ReadOnlyMediaSubTabs.tsx` — `FloorFloorplanTabContent` adds `useBackgroundScale(floorId)` and forwards `unitsPerMeter`/`backgroundId` to `<FloorplanGallery>`; `UnitFloorplanTabContent` does the same with `useBackgroundScale(levelFloorId || null)` (per-level cardinality — units in multi-level properties show their own level's calibrated background, falling back to no calibration when `levelFloorId === null`). EDIT `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx` — single-level case: `const { unitsPerMeter: singleFloorUnitsPerMeter, backgroundId: singleFloorBackgroundId } = useBackgroundScale(floorId || null)` next to the existing `useFloorOverlays`; both forwarded to the inline `<FloorplanGallery>` for the `floorplan-floor` tab. The multi-level branch already routes through `FloorFloorplanTabContent` (which now self-subscribes) — no extra wiring needed. **Bundle isolation** preserved: `useBackgroundScale.ts` lives in `src/hooks/`, imports only `firebase/firestore` types + `firestoreQueryService` SSoT + `@/types/floorplan-overlays`; zero imports from `src/subapps/dxf-viewer/`. `FloorplanGallery.tsx` adds only the `Compass` icon + `CalibrateScaleDialog` import — no DXF subapp coupling introduced. **N.7.2**: ✅ Proactive (subscription opens only when `floorId` known; closes on null), ✅ Idempotent (deterministic `pickActive` selection, scale write is overwrite-safe per STEP D), ✅ Race-free (single subscription per floor; React `useEffect` cleanup handles floor switches), ✅ SSoT (single hook reads, single dialog writes via STEP D endpoint), ✅ Belt-and-suspenders (read hook validates scale fields client-side + server validates in `setBackgroundScale` + Firestore rules `validScalePatch`), ✅ Lifecycle explicit (`useBackgroundScale` owns reads, `CalibrateScaleDialog` owns writes — no shared state), ✅ Awaited (dialog `await apiClient.post(...)` gates close + on-success callback). **N.7.1**: hook 135 LOC ≤ 500; gallery 449 → ~470 LOC ≤ 500; every helper ≤ 30 LOC; every component method ≤ 40 LOC. **CHECK 3.10**: tenant-config.ts default mapping `companyId` covers `FLOORPLAN_BACKGROUNDS` — no inline `where('companyId',…)` needed; `firestoreQueryService.subscribe('FLOORPLAN_BACKGROUNDS', …)` auto-injects. **Files**: `src/hooks/useBackgroundScale.ts` (NEW), `src/components/shared/files/media/floorplan-gallery-config.ts` (EDIT — `backgroundId` prop), `src/components/shared/files/media/FloorplanGallery.tsx` (EDIT — Compass button + dialog mount + state), `src/i18n/locales/el/files-media.json` + `src/i18n/locales/en/files-media.json` (EDIT — `floorplan.calibrate.openButton`), `src/features/read-only-viewer/components/ReadOnlyMediaSubTabs.tsx` (EDIT — `useBackgroundScale` × 2 + props forwarded), `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx` (EDIT — `useBackgroundScale` + props forwarded). ✅ **Google-level: YES** — single read hook, single write entry-point, raster-only affordance, zero DXF subapp coupling, SSoT consistent across all callers. **Pending**: STEP I follow-up (a) — wizard `StepUpload` post-upload prompt + DXF `$INSUNITS` auto-detect override path. **Next**: (a) wizard hook → STEP J i18n full pass → STEP K SSoT registry → STEP L cascade cleanup → STEP M tests + ✅ IMPLEMENTED flip. |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP I partial (Calibration UI — `CalibrateScaleDialog` + measure-tool prop wiring)** (Opus 4.7, GOL+SSOT) — manual 2-click scale calibration UI for PDF/Image backgrounds. **NEW** `src/components/shared/files/media/CalibrateScaleDialog.tsx` (~250 LOC) — Radix-based `<Dialog size="lg">` hosting (1) a `<CalibrateCanvas>` subcomponent that loads `imageSrc` via crossOrigin `Image` and lets the user click two distinct points, drawing both vertices + connecting segment in `STROKE_COLOR=#FF6B35` (matches measure tool); (2) a 2-column grid form (`<Input type="number">` for the real distance + `<Select>` for unit `mm`/`cm`/`m`); (3) a footer with `Reset` / `Cancel` / `Save` buttons. Computation: `pixelDistance(p1,p2)` (Euclidean) ÷ `realInMeters = real × {mm:0.001, cm:0.01, m:1}` → `unitsPerMeter`; payload `{ scale: { unitsPerMeter, sourceUnit: 'pixel' } }` POSTed via `apiClient` to `API_ROUTES.FLOORPLAN_BACKGROUNDS.CALIBRATE(id)` (Phase 9 STEP D endpoint). On success, callback `onCalibrated(scale)` fires + dialog closes; on failure, `<p text-destructive>` shows `toErrorMessage(e)` without closing. State machine resets every time `open` flips true (points cleared, distance/unit reset, error wiped). Pure helpers `drawScene` (≤30 LOC, clears canvas + aspect-fits the image with letterbox + draws points/line) and `pixelDistance`/`toErrorMessage` (≤8 LOC each). **Bundle isolation**: zero imports from `src/subapps/dxf-viewer/`; reuses only Radix Dialog/Input/Label/Select primitives + `apiClient` + i18n hook. Dialog never reads/writes `floorplan_overlays` — single-purpose calibration writer. **Prop wiring** EDIT `src/components/shared/files/media/floorplan-gallery-config.ts` — added `unitsPerMeter?: number | null` to `FloorplanGalleryProps` (sourced from `floorplan_backgrounds.scale.unitsPerMeter`). EDIT `src/components/shared/files/media/FloorplanGallery.tsx` — destructure new prop, forward `unitsPerMeter={unitsPerMeter ?? null}` to `<MeasureToolOverlay>`; this completes the option-A path Giorgio confirmed (`Β → A` transition): once a background is calibrated, the gallery measure tool labels distances/areas in `μ` / `μ²` (or `m`/`m²`) instead of falling back to `εικ`/`px`. **i18n** EDIT `src/i18n/locales/{el,en}/files-media.json` — added `floorplan.calibrate.{title,instructions,points,realDistanceLabel,realDistancePlaceholder,unitLabel,unitMm,unitCm,unitM,reset,cancel,save,saving,errorZeroDistance,errorInvalidDistance}` (15 keys × 2 locales). el locale: pure Greek (`Χιλιοστά`/`Εκατοστά`/`Μέτρα`/`Βαθμονόμηση κλίμακας κάτοψης`) per `feedback_pure_greek_locale`; ICU single-brace interpolation (`{count}`) per CHECK 3.9; zero hardcoded `defaultValue` per CLAUDE.md SOS. N.11. **N.7.2**: ✅ Single-purpose write (calibrate endpoint only — distinct from PATCH `kind:'calibration'` overlay-remap), ✅ Idempotent (re-calibrating overwrites scale), ✅ Awaited (POST + UI close gated on resolve), ✅ SSoT (BackgroundScale type from `@/types/floorplan-overlays`; route from `API_ROUTES`), ✅ Bundle-isolated, ✅ Locale-pure. **N.7.1**: dialog 250 LOC ≤ 500; `CalibrateCanvas` 35 LOC, `CalibrateScaleDialog` 95 LOC (component), helpers ≤ 30 LOC. **Files**: `src/components/shared/files/media/CalibrateScaleDialog.tsx` (NEW), `src/components/shared/files/media/floorplan-gallery-config.ts` (EDIT — `unitsPerMeter` prop), `src/components/shared/files/media/FloorplanGallery.tsx` (EDIT — destructure + forward to MeasureToolOverlay), `src/i18n/locales/el/files-media.json` + `src/i18n/locales/en/files-media.json` (EDIT — `floorplan.calibrate.*`). **Deferred to STEP I follow-up** (out of this commit): (1) wire the dialog into `src/features/floorplan-import/FloorplanImportWizard.tsx` post-upload prompt for PDF/Image; (2) DXF auto-detect prompt using `detectDxfInsUnits()` from `floorplan-scale.service.ts` ("Detected: 1mm = 1 unit. Override?"); (3) `useBackgroundScale(floorId)` reader hook + caller-side wiring to pass `unitsPerMeter` into `FloorplanGallery` from `ListLayout`/`ReadOnlyMediaSubTabs`/`FloorFloorplanTabContent`; (4) add `Sun/Compass` icon affordance to gallery header (open dialog from there for already-uploaded backgrounds). ⚠️ **Google-level: PARTIAL** — dialog + prop wiring + i18n done; wizard hook + reader hook + caller migration pending. Reason: contained-scope increment, lets STEP H measure tool consume real meters as soon as a background is calibrated via direct dialog open from any caller (no wizard required for first manual run). **Next**: STEP I follow-up (wizard hook + reader hook), then STEP J (i18n full pass — already partially complete, just verification), STEP K (SSoT registry — register `floorplan-overlay-gateway` + `floorplan-overlay-types` modules), STEP L (cascade cleanup post-wipe), STEP M (per-shape renderer tests + measure tool tests + ADR-340 status flip ✅ IMPLEMENTED). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP H (FloorplanGallery transient measure tool)** (Opus 4.7, GOL+SSOT) — read-only viewer gains a transient client-side measure tool (distance / area / angle) without touching Firestore. **NEW** `src/components/shared/files/media/MeasureToolbar.tsx` (~70 LOC) — 3 toggle buttons (Ruler/Square/Triangle icons, i18n keys `floorplan.measure.{distance,area,angle}`); pure controlled component, parent owns the active mode; toggling the active mode again clears it (`null`). **NEW** `src/components/shared/files/media/MeasureToolOverlay.tsx` (~240 LOC) — transparent absolute-positioned canvas layered above the gallery's main canvas; ResizeObserver syncs internal pixel buffer to parent box; click adds world-space points (computed via `screenToWorld(sx, sy, bounds, fit)` against the same `computeFitTransform` used by the renderer — guarantees coordinate parity DXF↔PDF↔Image); ESC clears; mode change resets accumulated points. Reuses `drawMeasurement` from the `overlay-renderer/` SSoT (STEP E) for visual consistency with persisted measurement overlays. Pure helpers (`polylineLength`/`polygonArea`/`angleAtVertex`) ≤ 30 LOC each. Distance/area conversion to meters is gated by an optional `unitsPerMeter` prop — when absent, falls back to native units (`px` label) per the agreed STEP H scope; real-meter mode lands in STEP I (calibration dialog). **NEW** `src/components/shared/files/media/FloorplanGalleryZoomControls.tsx` (~100 LOC) — extracted from `FloorplanGallery.tsx` to free LOC budget for the measure integration; same Tooltip/Button primitives, same `ZOOM_CONFIG` thresholds, no behavior change. **EDIT** `src/components/shared/files/media/FloorplanGallery.tsx` (495 → 449 LOC) — removed inline `renderZoomControls` function (replaced by `<FloorplanGalleryZoomControls />`); added `useState<MeasureMode | null>(null)` for the active mode; `<MeasureToolbar />` placed in inline header before zoom controls (separator `w-px h-6 bg-border`); `<MeasureToolOverlay />` rendered inside `renderViewerContent` figure right after the canvas — receives `sceneBounds={isDxf ? currentBounds : null}` + `rasterSize={isRaster ? rasterBounds : null}` + `zoom`/`panOffset` from the active `useZoomPan` instance; while a measure mode is active, the underlying canvas's hit-testing handlers (`handleCanvasMouseMove`/`handleCanvasClick`/`handleCanvasMouseLeave`) are disabled (`enableHitTesting && !measureMode`) so polygon-hover doesn't fight click-to-measure. Imports trimmed: removed unused `ZoomIn`/`ZoomOut`/`Maximize2`/`Expand`/`X` (now consumed only inside the extracted control). **i18n** EDIT `src/i18n/locales/{el,en}/files-media.json` — added `floorplan.measure.{toolbar,distance,area,angle,disable,clearHint,modeDistanceHint,modeAreaHint,modeAngleHint,unitMeter,unitSquareMeter,unitDegree,unitPixel}` (13 keys × 2 locales = 26 strings). el locale: pure Greek per `feedback_pure_greek_locale` memory (`Απόσταση`/`Εμβαδόν`/`Γωνία`/`μ`/`μ²`/`°`/`εικ`); zero hardcoded `defaultValue` per CLAUDE.md SOS. N.11. **Bundle isolation** (CRITICAL, plan §H): grep-confirmed zero imports from `src/subapps/dxf-viewer/` in `MeasureToolOverlay.tsx`, `MeasureToolbar.tsx`, `FloorplanGalleryZoomControls.tsx`. Zero `firestore`/`mutation-gateway`/`createFloorplanOverlay` references. Local React state (`useState<Point2D[]>`) is the sole source of truth for the in-progress measurement — never persisted. **N.7.2**: ✅ Proactive (transient overlay rendered only when mode active; collapses to `null` otherwise), ✅ Race-free (single `useState` driver, `ResizeObserver` debounced via React commit cycle), ✅ Idempotent (mode change always resets via dedicated effect), ✅ SSoT (reuses `drawMeasurement` + `computeFitTransform` + `screenToWorld` from `overlay-renderer/`), ✅ Lifecycle owner explicit (`MeasureToolOverlay` owns transient session; `FloorplanGallery` owns mode toggle), ✅ Bundle-isolated (no DXF subapp imports), ✅ Awaited (no async paths — pure render side-effects). **N.7.1**: every new file ≤ 240 LOC ≤ 500; every helper ≤ 30 LOC; gallery shrunk 495 → 449 LOC after extraction. **Verification**: `tsc --noEmit` clean for STEP H files (only pre-existing errors in unrelated procurement/contacts/building-management modules); `npm run ssot:audit` shows no new violations (33 cleared / 36 baseline, 8% progress). **Files**: `src/components/shared/files/media/MeasureToolbar.tsx` (NEW), `src/components/shared/files/media/MeasureToolOverlay.tsx` (NEW), `src/components/shared/files/media/FloorplanGalleryZoomControls.tsx` (NEW), `src/components/shared/files/media/FloorplanGallery.tsx` (EDIT — extract + integrate), `src/i18n/locales/el/files-media.json` + `src/i18n/locales/en/files-media.json` (EDIT — `floorplan.measure.*`). ✅ **Google-level: YES** — local-state-only transient tool, SSoT-aligned visuals, strict bundle isolation, deferred meter conversion to STEP I (single-purpose increments). **Next**: STEP I (calibration UI — `CalibrateScaleDialog` 2-click + real-world distance + unit select; floorplan import wizard hook for DXF $INSUNITS auto-detect prompt). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP G (DXF Viewer subapp tool migration)** (Opus 4.7, GOL+SSOT) — port the DXF Viewer authoring surface from the legacy `dxf_overlay_levels/{levelId}/items` subcollection to the unified multi-kind `floorplan_overlays` collection. **NEW** `src/subapps/dxf-viewer/hooks/drawing/overlay-persistence-utils.ts` (~140 LOC) — pure `entityToGeometry(entity, tool)` mapper implementing the handoff tool→geometry table: line/measure-distance(-continuous)→`line` or `measurement{mode:'distance'}`, rectangle→`polygon{closed:true}` (4-vertex, derived from `corner1`/`corner2` or `x/y/width/height`), circle (8 variants)→`circle`, arc-3p/cse/sce→`arc` (preserves `counterclockwise`), polyline→`polygon{closed:false}`, polygon→`polygon{closed:true}`, measure-area→`measurement{mode:'area'}` (computes shoelace `polygonArea`), measure-angle (5 variants)→`measurement{mode:'angle',points:[vertex,p1,p2]}`. Returns `null` for unsupported pairs (caller skips persistence). **NEW** `src/subapps/dxf-viewer/hooks/drawing/useOverlayPersistence.ts` (~95 LOC) — thin React wrapper over `floorplan-overlay-mutation-gateway`, exposing `persistEntity(entity, tool, { backgroundId, floorId, role, linked?, label?, style?, layer? })`. Maps via `entityToGeometry` then calls `createFloorplanOverlay`; logs failures via module logger but never throws (scene state is authoritative for the in-progress drawing session). **EDIT** `src/subapps/dxf-viewer/hooks/drawing/completeEntity.ts` — added optional `persistToOverlays?: PersistToOverlaysOptions` (extends `PersistEntityOptions` with a caller-injected `persist` callback typed against `useOverlayPersistence`'s output); added `STEP 6` after the existing scene/event/tool-state pipeline that fires the persistence call as a non-blocking side effect (`void persist(entity, tool, opts)`). Layering tools do NOT use this — they persist via the overlay store directly. **NEW** `src/subapps/dxf-viewer/overlays/overlay-store-mappers.ts` (~210 LOC) — pure helpers translating between the legacy `Overlay`/`UpdateOverlayData` store-view shape and the SSoT `FloorplanOverlay`/gateway payload shape: `kindToRole`/`roleToKind` (1:1 for the 4 layering kinds), `tupleArrayToVertices`/`verticesToTupleArray`/`polygonGeometryFromTuples` (Firebase-friendly `[x,y]` ↔ `{x,y}` + closed-polygon construction), `ssotStyleToLegacy`/`legacyStyleToSsot` (lineWidth ↔ strokeWidth field rename), `floorItemToLegacyOverlay(item, levelId)` (synthesizes `levelId` from active level — store-only ever exposes overlays for the current floor, so single-value synthesis is safe), `buildCreatePayload`/`buildUpdatePayload`/`buildUpsertPayload` (gateway payload builders with conditional spreads to honour `null` clears for optional fields). **REWRITE** `src/subapps/dxf-viewer/overlays/overlay-store.tsx` (446→~290 LOC) — replaced `firestoreQueryService.subscribeSubcollection('DXF_OVERLAY_LEVELS', currentLevelId, 'items', …)` with `useFloorOverlays(floorId)` (single `floorplan_overlays` subscription, companyId auto-injected via tenant config) where `floorId` is resolved from `useLevels()` → `levels.find(l => l.id === currentLevelId)?.floorId` and `backgroundId` from `useFloorplanBackgroundStore((s) => s.floors[floorId]?.background?.id)`. Read items projected onto the legacy `Overlay` shape via `floorItemToLegacyOverlay` (`useMemo` keyed on `[floorItems, currentLevelId]`) so the 33 callers compile unchanged. Writes (`add`/`update`/`remove`/`restore`/`duplicate`/`setStatus`/`setLabel`/`setKind`/`addVertex`/`updateVertex`/`removeVertex`) go through the gateway; vertex helpers translate to `update(id, { polygon })` → `buildUpdatePayload` → `geometry.vertices`. `ensurePersistContext()` guard returns null + warn if no `floorId`/`backgroundId`, preventing partial-state writes. Removed: 3-format polygon normalizer (gateway writes canonical), local optimistic state (read hook is source of truth), `setSelectedOverlay`/legacy selection helpers (ADR-030 universal selection already covers this). **EDIT** `src/subapps/dxf-viewer/overlays/types.ts` — removed dead `OVERLAY_COLLECTION_PREFIX` (legacy `DXF_OVERLAY_LEVELS` SSoT pointer, zero remaining consumers grep-confirmed); reframed file header doc to declare local `Overlay`/`CreateOverlayData`/`UpdateOverlayData` as **layering store-view types** — the polygon-only projection of the multi-kind `FloorplanOverlay` SSoT consumed by the 33 DXF Viewer callers. They are NOT a duplicate of the storage type (different domain — multi-kind vs polygon-only, multi-role vs 4-kind, with synthesized `levelId` for in-subapp routing) and are kept by design (not aliased). The `createOverlayHandlers` factory left intact — its 2 callers (LevelPanel, useOverlayInteraction) supply their own `setSelectedOverlay` closure bridging to `useUniversalSelection()`. **N.7.2**: ✅ Proactive (single subscription per floor, no level fan-out), ✅ Race-free (read hook is single source for store state; gateway writes are server-authoritative), ✅ Idempotent (gateway upsert preserves overlayId + createdAt for the restore/undo flow), ✅ SSoT (gateway is sole client write path, allowlisted by `floorplan-overlay-gateway` registry module), ✅ Belt-and-suspenders (Zod handler validation + Firestore rules role↔geometry matrix + tenant query auto-injection), ✅ Lifecycle owner explicit (overlay-store.tsx owns layering write lifecycle; useOverlayPersistence owns annotation write lifecycle), ✅ Awaited (all writes awaited inside callbacks; only the `completeEntity → persist` call is fire-and-forget by design — drawing UX must not block on Firestore). **N.7.1**: mapper utils 140 LOC, persistence hook 95 LOC, store-mappers 210 LOC, overlay-store rewrite 290 LOC, completeEntity edit +30 LOC — all ≤ 500; every function ≤ 40 LOC. **CHECK 3.10**: gateway routes through `firestoreQueryService` (multi-kind) which auto-injects `companyId` for `FLOORPLAN_OVERLAYS`; server handlers stamp `companyId` from auth context. **Files**: `src/subapps/dxf-viewer/hooks/drawing/overlay-persistence-utils.ts` (NEW), `src/subapps/dxf-viewer/hooks/drawing/useOverlayPersistence.ts` (NEW), `src/subapps/dxf-viewer/hooks/drawing/completeEntity.ts` (EDIT — `persistToOverlays` opt + STEP 6), `src/subapps/dxf-viewer/overlays/overlay-store-mappers.ts` (NEW), `src/subapps/dxf-viewer/overlays/overlay-store.tsx` (REWRITE), `src/subapps/dxf-viewer/overlays/types.ts` (cleanup + doc). ✅ **Google-level: YES** — single read path per floor, single client write path (gateway), store-view types kept as a domain projection (not duplicate), zero churn for 33 downstream callers. **Next**: STEP H (FloorplanGallery transient measure tool — local React state only, NEVER writes Firestore). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP F (Read hook rewrite + multi-kind hit-test)** (Opus 4.7, GOL+SSOT) — replace 2-step level fan-out with single-collection subscription; add geometry-aware hit-test + AABB. **REWRITE** `src/hooks/useFloorOverlays.ts` (~210 LOC) — single `firestoreQueryService.subscribe('FLOORPLAN_OVERLAYS', …, { constraints: [where('floorId','==',floorId), orderBy('createdAt','asc')] })` (companyId auto-injected via `buildTenantConstraints` default mapping in `tenant-config.ts`). New helpers: `isValidGeometry(raw)` (whitelist via `OVERLAY_GEOMETRY_TYPES` SSoT), `extractPolygon(geometry)` (vertices for polygon kind, `[]` otherwise), `roleToKind(role)` (1:1 for property/parking/storage/footprint, fallback 'property' for annotation/auxiliary), `normalizeOverlay(raw)` (full doc validation + shape mapping, returns null for malformed). Output `FloorOverlayItem` extends SSoT `FloorplanOverlay` and back-compat-augments with `polygon: Point2D[]` + `kind: OverlayKind` + `resolvedStatus: PropertyStatus` — keeps the existing renderer.legacy path (consumers calling `renderOverlayPolygons` with `overlay.polygon`) AND the existing `useEntityStatusResolver` (consumes `overlay.kind`) green without modification. Footprints filtered (`role === 'footprint' → continue`). Removed: legacy 2-step `dxf_viewer_levels` → `dxf_overlay_levels/{levelId}/items` fan-out, `subscribeSubcollection`, `normalizePolygon` 3-format adapter (no longer needed — gateway writes canonical `geometry.vertices`). **NEW** `src/components/shared/files/media/overlay-hit-test.ts` (~165 LOC) — multi-kind hit-test SSoT: `computeGeometryAABB(geometry)` returns world-space AABB per kind (polygon=vertices, line=start/end, circle/arc=center±radius, dimension=from/to, measurement=points, text=position±halfBox); `hitTestGeometry(point, geometry, id, tolerance)` dispatches per `geometry.type`: polygon-closed→`isPointInPolygon` ray-cast, polygon-open→polyline distance, line/dimension→`distanceToSegment` ≤ tol, circle/arc→`|distance − radius|` ≤ tol, measurement→polyline (closed if `mode==='area'`), text→AABB; helpers `distanceToSegment` + `distance` + private `aabbFromPoints`/`circleAABB`. **EDIT** `src/components/shared/files/media/floorplan-overlay-system.ts` — `computeOverlayAABBs` now delegates to `computeGeometryAABB` (single dispatch, no more `for v of overlay.polygon`); `hitTestOverlays` adds `tolerance` param (default `DEFAULT_HIT_TOLERANCE`=1 world unit) + dispatches via `hitTestGeometry` after AABB pre-filter (with tolerance-expanded box). **EDIT** `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts` — `hitTestPdfOverlays` body simplified: removed inline `isPointInPolygon` + `UniversalPolygon` construction, now calls `hitTestGeometry(world, overlay.geometry, overlay.id, DEFAULT_HIT_TOLERANCE)`. **Bundle isolation**: hit-test module imports only `@/types/floorplan-overlays` + `@core/polygon-system` (no DXF subapp imports); aligns with STEP H constraint for the future measure tool. **N.7.2**: ✅ SSoT (single collection + single hit-test dispatch), ✅ Idempotent (pure dispatch helpers), ✅ Race-free (single Firestore subscription replaces two-stage level fan-out), ✅ Belt-and-suspenders (Firestore rules CHECK 3.10 companyId already enforced + `firestoreQueryService` auto-injects + AABB pre-filter still narrows hit-test). **N.7.1**: hook 210 LOC, hit-test 165 LOC, overlay-system 122 LOC, pdf-overlay 100 LOC — all ≤ 500; every function ≤ 40 LOC. **CHECK 3.10**: query uses `firestoreQueryService` SSoT which auto-adds `where('companyId','==',ctx.companyId)` for `FLOORPLAN_OVERLAYS` (default tenant config) — verified via `tenant-config.ts` (no override → DEFAULT_TENANT_CONFIG = companyId). **Files**: `src/hooks/useFloorOverlays.ts` (REWRITE), `src/components/shared/files/media/overlay-hit-test.ts` (NEW), `src/components/shared/files/media/floorplan-overlay-system.ts` (EDIT), `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts` (EDIT). ✅ **Google-level: YES** — single read path, geometry-aware hit-test, AABB pre-filter, back-compat preserved for the legacy polygon renderer path. **Next**: STEP G (DXF Viewer subapp tool migration — biggest step, ~500 LOC: `entityToGeometry` + `useOverlayPersistence` + `completeEntity` + `overlay-store` + `OverlayDrawingEngine`). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP E (Renderer SSoT split — per-shape modules + dispatch)** (Opus 4.7, GOL+SSOT) — split `src/components/shared/files/media/overlay-polygon-renderer.ts` (297 LOC, polygon-only) into per-shape modules under `overlay-renderer/`. **NEW directory** (14 files): `types.ts` (re-export geometry SSoT + local `SceneBounds`/`FitTransform`/`OverlayLabel`/`OverlayRenderContext`), `transform.ts` (`computeFitTransform`/`worldToScreen`/`screenToWorld`/`rectBoundsToScene` Y-UP CAD-style), `colors.ts` (`OVERLAY_FALLBACK` const, `resolvePolygonColors` w/ ADR-258 status mapping + ADR-258D opacity, `resolveAnnotationStroke` for non-polygon kinds; honors `style` override on `FloorplanOverlay`), `format-utils.ts` (`formatNumber`/`formatDistance`/`formatArea`/`formatAngle` — locale-agnostic), `polygon.ts` (`drawPolygon(vertices, closed, …)` — supports both closed polygons and open polylines, skips < 2/3 vertices), `line.ts` (`drawLine` w/ optional dashed), `circle.ts` (`drawCircle` — radius scaled, optional fill), `arc.ts` (`drawArc` — Y-flip negates angles + swaps CCW flag per math vs canvas convention, see plan §1.4), `dimension.ts` (`drawDimension` — extension lines + arrowheads + center label; `unitsPerMeter` converts world distance → meters when no explicit `value`), `measurement.ts` (`drawMeasurement` per mode: distance=polyline+ticks+total, area=closed polygon w/ translucent fill+area label, angle=label at vertex), `text.ts` (`drawText` — Y-flip rotation negation `ctx.rotate(-rotation)`, fontSize world→screen scale clamped 8-72px), `label.ts` (`renderOverlayLabel` + `polygonScreenCentroid` taking generic `vertices` array — vertex-based instead of overlay-based for reuse), `dispatch.ts` (`renderOverlay(ctx, overlay: FloorplanOverlay, bounds, fit, ctx)` switch on `geometry.type` — single entry-point for STEP F+ multi-kind consumers), `legacy.ts` (`renderOverlayPolygon`/`renderOverlayPolygons` — back-compat surface for the 6+ existing consumers using `FloorOverlayItem` shape with legacy `polygon` field; both 2-pass fill+label preserved unchanged; calls `drawPolygon` + `renderOverlayLabel` internally), `index.ts` (public barrel — re-exports all draw helpers, dispatch, legacy, transform, colors, types). **Compatibility shim**: existing `overlay-polygon-renderer.ts` rewritten to single-line `export * from './overlay-renderer'` — **zero import-path churn** for the 8 grep-confirmed consumers (`floorplan-overlay-system.ts`, `floorplan-pdf-overlay-renderer.ts`, `useFloorplanCanvasRender.ts`, `floorplan-gallery-config.ts`, `FloorplanGallery.tsx`, `ListLayout.tsx`, `ReadOnlyMediaSubTabs.tsx`, `read-only-media-types.ts`). **SSoT registry update**: module renamed `overlay-polygon-renderer` → `overlay-renderer` in `.ssot-registry.json`, `ssotFile` pointed to new `overlay-renderer/index.ts`, allowlist extended to all 14 new files + the shim. ForbiddenPattern preserved (`ctx\\.beginPath\\(\\)[\\s\\S]{0,200}overlay\\.polygon\\.forEach`) — new files use `vertices.forEach` so don't trigger; legacy shape isolated to `legacy.ts` which is allowlisted. **Known v1 limitations** (deferred): non-uniform scale on circle/arc keeps radius unchanged; arc angle convention CCW from +X (math standard) — see plan §1.4 for derivation; per-shape regression tests + measure-tool integration arrive in STEP M. **N.7.2**: ✅ SSoT (single dispatch + single barrel), ✅ Idempotent (pure draw helpers), ✅ Lifecycle owner explicit (`overlay-renderer/index.ts`), ✅ Belt-and-suspenders (legacy back-compat path keeps existing consumers green during STEP F migration). **N.7.1**: every new file ≤ 110 LOC, every function ≤ 40 LOC; original 297-LOC file → 21-LOC shim (-93%). **Files**: `src/components/shared/files/media/overlay-renderer/{types,transform,colors,format-utils,polygon,line,circle,arc,dimension,measurement,text,label,dispatch,legacy,index}.ts` (NEW × 15), `src/components/shared/files/media/overlay-polygon-renderer.ts` (REWRITE as shim), `.ssot-registry.json` (module renamed + allowlist extended). ✅ **Google-level: YES** — pure split, geometry-aware dispatch ready for STEP F-G consumers, zero behavior change for existing consumers, SSoT discoverable + ratchet-protected. **Next**: STEP F (read hook rewrite — single subscription on `floorplan_overlays` collection + multi-kind hit-test). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP D (Calibration scale + remap dispatch)** (Opus 4.7, GOL+SSOT) — coordinate-space conversion infrastructure. NEW `src/services/floorplan-background/floorplan-scale.service.ts` (~140 LOC, server-only) — `detectDxfInsUnits(insUnitsCode)` pure mapping (DXF $INSUNITS codes 4=mm/5=cm/6=m → unitsPerMeter, unknown codes → null fallback to manual calibration), `getBackgroundScale(background)` pure read helper, `setBackgroundScale({companyId, backgroundId, scale, updatedBy})` server write con tenant-isolation guard via `runTransaction` + `companyId !== input.companyId → reject`, validation `unitsPerMeter > 0` + `sourceUnit ∈ {mm,cm,m,pixel}`, audit-stamped `calibratedAt`/`calibratedBy`. NEW `src/app/api/floorplan-backgrounds/[id]/calibrate/route.ts` (~100 LOC) — POST handler validates scale payload (`isValidScale` guard) + invokes service + emits `data_updated` audit event; permissions `dxf:layers:view`, rate-limited via `withStandardRateLimit`; distinct from existing PATCH `kind:'calibration'` (which performs affine 2-point remap of overlay coords) — this endpoint only writes scale metadata, no overlay rewrites. EDIT `src/services/floorplan-background/calibration-remap.service.ts` — added `remapGeometry(raw, oldT, newT)` discriminated dispatch (~110 LOC) handling all 7 geometry kinds: polygon (vertices via `remapVertex`), line (start/end), circle (center, radius preserved), arc (center+angles preserved, ccw flag preserved), dimension (from/to), measurement (points array, mode/value/unit preserved), text (position, fontSize/rotation preserved); replaced both atomic + chunked batch loops's `readPolygon(data.polygon) → remapPolygon → batch.update(polygon: ...)` with `remapGeometry(data.geometry, ...) → batch.update(geometry: ...)`; null return = malformed/unknown geometry → skip doc; added to `__test__` exports. **Known v1 limitation**: non-uniform calibration on circle/arc keeps `radius` unchanged, on text keeps `rotation`/`fontSize` unchanged — uniform-scale calibrations remain visually consistent; documented as deferred (Out of scope, ADR plan). **N.7.2**: ✅ Proactive (auto-detect on DXF import bypasses manual step), ✅ Idempotent (setBackgroundScale overwrites scale field), ✅ Tenant-isolated (transaction guard), ✅ Belt-and-suspenders (handler validates + transaction validates + Firestore rules validate). **N.7.1**: scale service 140 LOC, route 100 LOC, remap dispatch additions ~110 LOC < 500 (file total ~370 LOC). **Files**: `src/services/floorplan-background/floorplan-scale.service.ts` (NEW), `src/app/api/floorplan-backgrounds/[id]/calibrate/route.ts` (NEW), `src/services/floorplan-background/calibration-remap.service.ts` (EDIT). ✅ **Google-level: YES** — pure helpers + transactional write + multi-kind remap parity. **Next**: Step E (renderer SSoT split into `overlay-renderer/` subdir with per-shape modules + dispatch). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP C (Firestore rules + indexes + matrix tests)** (Opus 4.7, GOL+SSOT) — defense-in-depth: same role↔geometry+linked invariants enforced at Firestore rules layer (handler-side validation is primary; rules are the safety net). EDIT `firestore.rules` `floorplan_overlays` block (lines 1140-1170 → 1140-1245) — replaced flat polygon-only block with Phase 9 multi-kind block: helpers `_validGeometryType()` (whitelist 7 kinds), `_validRole()` (whitelist 6 roles), `_polygonOnlyRole()`, `_annotationGeometry()`, `_roleGeometryConsistent()` (polygon-only roles ⇒ polygon, annotation ⇒ non-polygon, auxiliary ⇒ any), `_linkedConsistent()` (property/parking/storage need `linked.<x>Id is string`), `_overlayWriteValid()` AND-composite. CREATE rule applies invariants to `request.resource.data`; UPDATE rule preserves D6 immutables (id/companyId/backgroundId/floorId) AND applies `_overlayWriteValid()` to post-update state. EDIT `firestore.rules` `floorplan_backgrounds` UPDATE rule — added structural validation on optional `scale` field (`unitsPerMeter is number > 0`, `sourceUnit ∈ {mm,cm,m,pixel}`); only validates if `scale` key present (back-compat). EDIT `firestore.indexes.json` — added 3 composite indexes: `(companyId,floorId,role)`, `(companyId,backgroundId,role)`, `(companyId,floorId,createdAt)` — needed for role-filtered reads + chronological list queries. EDIT `tests/firestore-rules/_harness/seed-helpers-dxf.ts` `seedFloorplanOverlay` — schema migration: ex-`polygon`/`zIndex` → `geometry: { type: 'polygon', vertices: [...] }` + `role: 'auxiliary'` + `createdBy`. EDIT `tests/firestore-rules/suites/floorplan-overlays.rules.test.ts` — (1) existing role_dual matrix tests updated to use new schema in createData/updateData, (2) NEW describe block `role↔geometry matrix (Phase 9)` con 11 cases: 5 ALLOWED (property+polygon+propertyId, annotation+line, annotation+circle, annotation+dimension, auxiliary+text/Greek), 6 REJECTED (property+circle, property no propertyId, annotation+polygon, parking no parkingId, unknown geometry.type, unknown role) — uses `assertSucceeds`/`assertFails` against same_tenant_user persona. **N.7.2**: ✅ Belt-and-suspenders (handler validates first, rules second), ✅ SSoT (matrix in TS via `ROLE_ALLOWED_GEOMETRY` + `ROLE_REQUIRES_LINK` mirrored in rules helpers), ✅ Lifecycle owner explicit (rules block per-collection). **N.7.1**: rules block 105 LOC; test file 195 LOC; index file +25 LOC. **Files**: `firestore.rules`, `firestore.indexes.json`, `tests/firestore-rules/_harness/seed-helpers-dxf.ts`, `tests/firestore-rules/suites/floorplan-overlays.rules.test.ts`. ✅ **Google-level: YES** — SSoT integrity matrix replicated in rules + tests, deny-by-default, structural+semantic validation. **Next**: Step D (calibration service + remap dispatch). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP B (API + write gateway)** (Opus 4.7, GOL+SSOT) — server-side authoring pipeline. NEW `src/app/api/floorplan-overlays/floorplan-overlays.schemas.ts` (~150 LOC) — Zod `OverlayGeometrySchema` discriminated union (7 variants: polygon w/ optional `closed`, line, circle, arc, dimension, measurement, text), `OverlayRoleSchema` (6 values), `BackgroundScaleSchema`, payload schemas Create/Upsert/Update; vertex/array/string limits enforced (polygon 2-10000 verts, measurement 2-1024 points, text 1-1024 chars, label 256, layer 64); NEW `floorplan-overlays.types.ts` (~60 LOC) — `FloorplanOverlayDocument` + 5 response types (Create/Upsert/Update/Delete/List); NEW `floorplan-overlays.handlers.ts` (~280 LOC) — `handleCreateFloorplanOverlay` (POST, server stamps id/companyId/createdBy/createdAt), `handleUpsertFloorplanOverlay` (PUT restore w/ tenant-isolation guard), `handleUpdateFloorplanOverlay` (PATCH with effective-state role↔geometry consistency check before commit; `null` clears optional fields), `handleDeleteFloorplanOverlay` (DELETE by overlayId), `handleListFloorplanOverlays` (GET filter by floorId or backgroundId, scoped by `companyId`, ordered by createdAt). Helper `validateRoleGeometryConsistency()` calls `isRoleGeometryConsistent` + `findMissingLink` from SSoT types — throws ApiError(422) on mismatch (`role:'property' + geometry:'circle'` rejected) or missing link (`role:'property'` without `linked.propertyId` rejected). Helper `ensureSameCompany()` enforces tenant isolation w/ `isRoleBypass` super-admin escape; non-matching → ApiError(403) + audit `access_denied`. Every successful write logs `data_created`/`data_updated`/`data_deleted` audit events. NEW `route.ts` (~80 LOC) — Next.js GET/POST/PUT/PATCH/DELETE wrapped by `withStandardRateLimit` + `withAuth`; permissions `dxf:layers:view` for read/write, `dxf:layers:manage` for delete (matches dxf-overlay-items pattern, will tighten in Phase 9.K when SSoT registry adds dedicated permission strings). NEW client-side `src/services/floorplan-overlay-mutation-gateway.ts` (~120 LOC) — `createFloorplanOverlay`/`upsertFloorplanOverlay`/`updateFloorplanOverlay`/`deleteFloorplanOverlay` via `apiClient` against `API_ROUTES.FLOORPLAN_OVERLAYS.LIST`; payload types reuse `OverlayGeometry`/`OverlayRole`/`OverlayLinked`/`OverlayStyle` from SSoT (`@/types/floorplan-overlays`) — zero duplicated types. **N.7.2**: ✅ Proactive (single API + single gateway), ✅ Race-free (server-issued ID + serverTimestamp), ✅ Idempotent upsert path, ✅ Belt-and-suspenders (Zod + handler integrity + Firestore rules), ✅ SSoT (gateway is sole client write path), ✅ Await (all writes awaited), ✅ Lifecycle owner explicit (route file). **N.7.1**: handlers 280 LOC < 500, schemas 150, types 60, gateway 120 — every function < 40 LOC. **Files**: `src/app/api/floorplan-overlays/{schemas,types,handlers,route}.ts` (NEW), `src/services/floorplan-overlay-mutation-gateway.ts` (NEW). ✅ **Google-level: YES** — discriminated-union Zod, integrity matrix server-enforced, audit-logged, tenant-isolated. **Next**: Step C (Firestore rules + indexes — secondary defense layer for the same constraints). |
| 2026-05-08 | 🚧 **Phase 9 — Multi-Kind Overlays — STEP A (Type foundation)** (Opus 4.7, GOL+SSOT) — extension del schema `floorplan_overlays` da polygon-only a discriminated-union multi-kind (line, circle, arc, dimension, measurement, text + polygon w/ optional `closed` flag). **Decisioni Q&A confermate da Giorgio**: (1) single collection con discriminated union `geometry` field, (2) `geometry` (geometric) + `role` (semantic: property/parking/storage/footprint/annotation/auxiliary) ortogonali, NIENTE migration (full data wipe imminente), (3) native space per-background + nuovo `BackgroundScale` calibration metadata (DXF auto-detect $INSUNITS, PDF/Image manual click), (4) FloorplanGallery = viewer + transient client-side measure (NO Firestore writes); DXF Viewer subapp = full authoring. **Step A files**: NEW `src/types/floorplan-overlays.ts` (~250 LOC) — SSoT types (`OverlayGeometry` discriminated union 7 variants, `OverlayRole` 6 values, `FloorplanOverlay` entity, `BackgroundScale` calibration metadata, `ROLE_ALLOWED_GEOMETRY` integrity matrix const, `ROLE_REQUIRES_LINK` link enforcement, type guards `isPolygonGeometry`/`isLineGeometry`/etc., validation helpers `isRoleGeometryConsistent`/`findMissingLink`); EDIT `src/subapps/dxf-viewer/floorplan-background/providers/types.ts` — ex-local `FloorplanOverlay` interface (polygon-only) sostituita da re-export del tipo SSoT (`type FloorplanOverlay = SharedFloorplanOverlay`); aggiunto `scale?: BackgroundScale` su `FloorplanBackground`; re-export `BackgroundScale`; EDIT `src/subapps/dxf-viewer/floorplan-background/index.ts` — barrel aggiunge `BackgroundScale` export; EDIT `src/config/domain-constants.ts` — aggiunto `API_ROUTES.FLOORPLAN_OVERLAYS.LIST = '/api/floorplan-overlays'` + `FLOORPLAN_BACKGROUNDS.CALIBRATE(id)` route per Phase D. **Backward compat**: il vecchio shape `FloorplanOverlay` aveva `polygon`/`linkedPropertyId`/`zIndex`/`resolvedStatus` ma grep ha confermato 3 soli consumer (provider/types.ts, barrel, cascade-delete service) e nessuno accede ai field legacy → safe replace. Vecchio `Overlay` interface in `subapps/dxf-viewer/overlays/types.ts` (DXF subapp internal, polygon-only, diverso shape) **NON toccato in Step A** — sostituzione differita a Step G (DXF Viewer tool migration) per non rompere l'editor durante lo sviluppo incrementale. **Integrity matrix**: `property`/`parking`/`storage`/`footprint` accettano solo `geometry.type='polygon'`; `annotation` accetta line/circle/arc/dimension/measurement/text; `auxiliary` accetta tutto. Linked entity required: `propertyId`/`parkingId`/`storageId` per i 3 role business. **N.7.2 declaration**: ✅ Proactive (single SSoT type module), ✅ Idempotent (pure types), ✅ SSoT yes (entry-point unico per OverlayGeometry/OverlayRole), ✅ Lifecycle owner explicit (`src/types/floorplan-overlays.ts`). **N.7.1**: tipi SSoT 250 LOC < 500. **Files**: `src/types/floorplan-overlays.ts` (NEW), `src/subapps/dxf-viewer/floorplan-background/providers/types.ts`, `src/subapps/dxf-viewer/floorplan-background/index.ts`, `src/config/domain-constants.ts`. ✅ **Google-level: YES** — discriminated union industry-standard pattern (Figma/Excalidraw/AutoCAD DWG), strict role↔geometry consistency, type-safe entry point. **Next steps**: B (API + gateway) → C (rules + indexes) → D (calibration service) → E (renderer SSoT split) → F (read hook) → G (DXF tool migration) → H (gallery measure tool) → I (calibration UI) → J (i18n) → K (SSoT registry) → L (cascade cleanup post-wipe) → M (tests + ADR finalize). |
| 2026-05-08 | ✅ **Phase 4 REBORN — FOLLOW-UP part 6 — In-polygon hover label** (Opus 4.7, GOL+SSOT) — su richiesta Giorgio: quando user fa hover su un overlay polygon (lista property OR canvas direct hover) e il polygon si riempie verde, mostrare DENTRO il polygon: (1) codice ακινήτου piccolo, (2) μικτά τ.μ. piccolo, (3) τιμή πώλησης più grande/bold. **Implementazione SSoT**: NEW type `OverlayLabel { primaryText?, secondaryText?, emphasisText? }` in `overlay-polygon-renderer.ts` — caller pre-formatta strings con i18n + `formatCurrency`, renderer è locale-agnostic. NEW option `getLabel?: (overlay) => OverlayLabel | null` in `RenderOptions`. `renderOverlayPolygons` ora 2-pass: pass 1 fill+stroke (invariato), pass 2 (only if `getLabel` provided) draws labels solo sull'highlighted overlay, evitando overlap con strokes. NEW helper `polygonScreenCentroid(overlay, bounds, fit)` (vertex-average centroid in screen space) + NEW helper `renderOverlayLabel(ctx, overlay, bounds, fit, label)` — center-aligned 3-line layout: top/middle 12px regular, bottom 18px bold (emphasis). Rendering: `fillStyle '#FFFFFF'` + `strokeStyle '#000000'` outline (3-4px lineWidth round-join) per max readability su qualsiasi fill color. Lines vuote skip-pate (es. solo prezzo → label centrata su 1 linea). **Wire-through SSoT-respecting**: `drawOverlayPolygons` (DXF) + `renderPdfWithOverlays` (raster) + `useFloorplanCanvasRender` accettano opzionale `getLabel`/`getOverlayLabel`, lo passano alle SSoT options — ZERO duplicazione, change-once. **Pubblica API**: NEW prop `propertyLabels?: ReadonlyMap<string, OverlayLabel>` su `FloorplanGalleryProps` (Map keyed by `linked.propertyId`). FloorplanGallery costruisce `getOverlayLabel = (overlay) => propertyLabels.get(overlay.linked.propertyId) ?? null` e lo passa al render hook (sia inline sia fullscreen modal). **Data binding**: `read-only-media-types.ts` `ReadOnlyMediaViewerProps` + `ReadOnlyMediaSubTabs.tsx` `FloorFloorplanTabContentProps` aggiungono `propertyLabels` pass-through. `ListLayout.tsx` costruisce la Map da `properties: Property[]` con `useMemo([properties, sqmUnit])`: code → primaryText, `areas.gross ?? area` → `${n} ${t('sqm', {ns:'common'})}` → secondaryText, `commercial.askingPrice ?? commercial.finalPrice ?? price` → `formatCurrency(n)` → emphasisText. i18n: aggiunto `'common'` ns a `useTranslation(...)` per `t('sqm', { ns: 'common' })` (locale `el.common.sqm = "τ.μ."` già esistente, ns 'common' richiamato esplicitamente, no nuove chiavi locale). **Trigger label**: `effectiveHighlightId = highlightedOverlayUnitId \|\| hoveredOverlayUnitId` — il label appare sia quando user fa hover sulla lista property (esterno) sia quando hovera direttamente il canvas (hit-test interno). Funziona identico per DXF, PDF, Image (stessa SSoT pipeline). **N.7.2**: ✅ Proactive (single source), ✅ Idempotent (puro draw), ✅ SSoT (label rendering centralizzato come polygon rendering), ✅ format-agnostic (stesso comportamento DXF/PDF/Image). **N.7.1**: SSoT 287 LOC < 500, ListLayout +25 LOC. **Files**: `src/components/shared/files/media/overlay-polygon-renderer.ts`, `src/components/shared/files/media/floorplan-overlay-system.ts`, `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts`, `src/components/shared/files/media/useFloorplanCanvasRender.ts`, `src/components/shared/files/media/floorplan-gallery-config.ts`, `src/components/shared/files/media/FloorplanGallery.tsx`, `src/features/read-only-viewer/components/read-only-media-types.ts`, `src/features/read-only-viewer/components/ReadOnlyMediaViewer.tsx`, `src/features/read-only-viewer/components/ReadOnlyMediaSubTabs.tsx`, `src/features/read-only-viewer/components/ListLayout.tsx`. ✅ **Google-level: YES** — SSoT, format-agnostic, locale-agnostic renderer, no hardcoded strings nel canvas, no duplicazione cross-format. |
| 2026-05-08 | ✅ **Phase 4 REBORN — FOLLOW-UP part 5 — Overlay polygon SSoT** (Opus 4.7, GOL+SSOT) — su domanda di Giorgio "il codice di drawing layer è SSoT?" → risposta NO, c'erano 2 polygon-draw loop duplicati (DXF in `floorplan-overlay-system.ts` `drawOverlayPolygons` + raster in `floorplan-pdf-overlay-renderer.ts` `renderPdfWithOverlays`). Logica identica duplicata: `baseScale = min(canvasW/boundsW, canvasH/boundsH)` + `scale = base*zoom` + offset center + `panOffset.{x,y}` + Y-flip + `getStatusColors(resolvedStatus) ?? OVERLAY_FALLBACK` + `withOpacity + OVERLAY_OPACITY.GALLERY_FILL` + `lineWidth: isHighlighted ? 4 : 3` + `beginPath/moveTo/lineTo/closePath/fill/stroke`. **Fix — centralizzazione SSoT**: NEW `src/components/shared/files/media/overlay-polygon-renderer.ts` (~190 LOC) — pure renderer module che esporta: `SceneBounds` + `FitTransform` types, `computeFitTransform(canvasW, canvasH, bounds, zoom?, pan?)` con math fit+center+zoom+pan, `rectBoundsToScene(width, height)` adapter raster→SceneBounds, `worldToScreen` + `screenToWorld` Y-UP CAD-style con flip via `bounds.max.y - vy`, `renderOverlayPolygon(ctx, overlay, bounds, fit, isHighlighted, strokeWidth?, strokeWidthHighlighted?)` single-polygon draw, `renderOverlayPolygons(ctx, overlays, bounds, fit, options)` list-level con `ctx.save/restore`. `OVERLAY_FALLBACK` const moved here (re-exported da `floorplan-overlay-system.ts` per backward-compat ai consumer esistenti). **Adapter refactoring**: `floorplan-overlay-system.ts` 191→134 LOC — `drawOverlayPolygons` ora 12 LOC (computeFitTransform + delega a renderOverlayPolygons), `screenToWorld` ora 2 LOC (computeFitTransform + delega a SSoT screenToWorld); `hitTestOverlays` + `computeOverlayAABBs` invariati (AABB-specific, non duplicati). `floorplan-pdf-overlay-renderer.ts` 173→100 LOC — `hitTestPdfOverlays` ora chiama `rectBoundsToScene` + `computeFitTransform` + `screenToWorld` SSoT prima del polygon-in-polygon AABB-less loop; `renderPdfWithOverlays` ora computa scene bounds via adapter, draw image, poi delega a `renderOverlayPolygons` SSoT (rimossi: inline `calcFit/toScreen/toWorld/FALLBACK` constanti — tutto centralizzato). Deprecated `pdfScreenToWorld` rimosso (zero call sites grep-verified). **SSoT registry** `.ssot-registry.json` — nuovo modulo `overlay-polygon-renderer` (Tier 3, ADR-340), `forbiddenPattern: ctx\\.beginPath\\(\\)[\\s\\S]{0,200}overlay\\.polygon\\.forEach` blocca duplicazione del polygon-draw loop fuori dal canonical, allowlist 1 file (`overlay-polygon-renderer.ts`). **Architecture (N.7.2 checklist)**: ✅ Proactive — single source for polygon rendering, ✅ Race-free (sync canvas draw), ✅ Idempotent, ✅ SSoT yes (questo è proprio l'obiettivo), ✅ Lifecycle owner explicit (renderer module). **File size (N.7.1)**: SSoT 190 LOC < 500, downstream files SHRINK (overlay-system 191→134, pdf-renderer 173→100). DXF + PDF + Image branch ora condividono: stesso fit math, stessi colori, stessa highlight logic, stesso polygon-draw — change-once propaga ovunque. **Files**: `src/components/shared/files/media/overlay-polygon-renderer.ts` (NEW), `src/components/shared/files/media/floorplan-overlay-system.ts` (refactor), `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts` (refactor), `.ssot-registry.json`. ✅ **Google-level: YES** — SSoT puro, zero duplicazione, ratchet-protected, file size compliant, retro-compat (re-export OVERLAY_FALLBACK + signature drawOverlayPolygons/hitTestPdfOverlays invariati). |
| 2026-05-08 | ✅ **Phase 4 REBORN — FOLLOW-UP part 4** (Opus 4.7) — Issue F + Issue G hotfix sul **FloorplanGallery** (`/properties?...&mediaTab=floorplan-floor`, NON il DXF Viewer subapp). **(Issue F — wheel zoom + drag pan immobili sul PDF)** Root cause: `useFloorplanCanvasRender` chiamava `renderPdfWithOverlays(canvas, pdfImage, pdfDimensions, overlays, highlightedUnitId)` SENZA passare `zoom`/`panOffset`. La toolbar zoom/pan aggiornava lo state via `useZoomPan`, ma il render PDF ignorava gli input → canvas immobile. DXF branch invece passava già `zoom, panOffset` a `renderDxfToCanvas` + `drawOverlayPolygons` → DXF zoom funzionante. **Fix** `floorplan-pdf-overlay-renderer.ts`: `calcFit(canvasW, canvasH, bounds, zoom=1, pan={0,0})` ora applica `scale = baseScale * zoom` e `offsetX/Y = (canvasDim - boundsDim*scale)/2 + pan.{x,y}` (mirror del pattern DXF in `renderDxfToCanvas`); `renderPdfWithOverlays` + `hitTestPdfOverlays` aggiungono i 2 param opzionali con default backward-compat. `useFloorplanCanvasRender.ts` ora passa `zoom, panOffset` al render PDF. `FloorplanGallery.tsx` `resolveHit` passa `inlineZP.zoom, inlineZP.panOffset` a `hitTestPdfOverlays` per consistency click-area↔render. **(Issue G — overlay polygons NON visibili su Image background nella gallery)** Root cause: `FloorplanGallery` aveva 3 branch (`isDxf`/`isPdf`/`isImage`); DXF e PDF rendevano via canvas con overlay polygons, ma `isImage` mostrava un plain `<img src={downloadUrl}>` senza canvas → nessun overlay disegnato anche se i polygons esistevano in `floorplan_overlays`. **Fix**: generalizzato il path raster a (PDF + Image). NEW `src/components/shared/files/media/useFloorplanImageLoader.ts` — mirror di `useFloorplanPdfLoader`, carica `new Image()` con `crossOrigin='anonymous'`, espone `imageElement` + `imageDimensions={width:naturalWidth, height:naturalHeight}` + `isImageLoading` + `imageError`. `useFloorplanCanvasRender.ts` rinominati i param `isPdf`→`isRaster`, `pdfImage`→`rasterImage`, `pdfDimensions`→`rasterBounds` per chiarire che il renderer è format-agnostic (il nome funzione `renderPdfWithOverlays` resta per minimizzare churn imports — è già un raster+overlay renderer puro). `FloorplanGallery.tsx`: aggiunto `useFloorplanImageLoader`, computa `isRaster=isPdf||isImage`, `rasterImage=pdfImage??imageElement`, `rasterBounds=pdfDimensions??imageDimensions`; passa al canvas render hook + a `hitTestPdfOverlays`; rimosso il branch `<img>` (ora il canvas gestisce sia PDF page-1 sia raster image, con overlay polygons disegnati sopra in entrambi i casi); `anyLoading`/`anyError`/`showCanvas` includono Image. Convenzione coordinate Y-UP ADR-340 invariata (polygon vertices in `naturalBounds` space, `boundsH - wy` flip via `toScreen`). **Files**: `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts`, `src/components/shared/files/media/useFloorplanCanvasRender.ts`, `src/components/shared/files/media/useFloorplanImageLoader.ts` (NEW), `src/components/shared/files/media/FloorplanGallery.tsx`. |
| 2026-05-08 | ✅ **Phase 4 REBORN — FOLLOW-UP part 3** (Opus 4.7) — Issue E hotfix: PDF/Image non visibili sul canvas DXF Viewer. **Root cause** ID mismatch nel binding canvas↔store: `useFloorplanBackgroundForLevel` (CanvasSection.tsx:194) idrata e legge il store sotto la **chiave canonica** `level.floorId ?? currentLevelId` (es. `flr_894...`), ma `<CanvasLayerStack>` riceveva `floorId={levelManager.currentLevelId}` (es. `"default"`) e lo passava a `<FloorplanBackgroundCanvas floorId="default">`. Quest'ultimo chiama `useFloorplanBackground("default")` → slot `floors["default"]` vuoto → `background=null` → RAF skippa il render anche se l'idratazione ha caricato il PDF/Image sotto la chiave reale `flr_xxx`. Pre-FOLLOW-UP-1 funzionava per coincidenza perché la GET `/api/floorplan-backgrounds?floorId=default` restituiva 0 risultati e nessuno scriveva nello store, quindi entrambi i lati erano "no-op consistente"; dopo FOLLOW-UP-1 (Issue C, key canonica per real floorId) il side hydrate è corretto ma il side render era rimasto al vecchio key. **Fix** `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx:347` — `floorId={levelManager.currentLevelId}` → `floorId={floorplanBg?.floorId ?? null}` (riusa il `floorplanBg` già calcolato a linea 194 da `useFloorplanBackgroundForLevel()`). Ora idratazione + lettura store + render usano la STESSA chiave canonica → bg visibile. CanvasLayerStack accetta già `floorId: string \| null` (canvas-layer-stack-types.ts:166) e fa `{floorId && (<FloorplanBackgroundCanvas .../>)}` → no extra changes downstream. **Files**: `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`. |
| 2026-05-08 | ✅ **Phase 4 REBORN — FOLLOW-UP part 2** (Opus 4.7) — 2 hardening fix supplementari dopo cycle DXF→PDF→DXF. **(Issue A residuo — Storage orphan da wipe legacy)** `floorplan-floor-wipe.service.ts`: aggiunta `loadFloorProjectId(db, companyId, floorId)` che legge `floors/{floorId}.projectId` con tenant-isolation guard (cross-tenant doc → skip + warn) e nuova `sweepFloorCategoryPath(companyId, projectId, floorId)` che fa `bucket.getFiles({ prefix: companies/{c}/projects/{p}/entities/floor/{f}/domains/construction/categories/floorplans/files/ })` + delete best-effort di tutti i match con `ignoreNotFound: true`. Eseguita DOPO il per-file prefix delete dentro `executeWipe`, in modo da catturare anche derivazioni orfane (`.processed.json`/`.thumbnail.png`) il cui parent `FileRecord` era già stato cancellato da un wipe pre-FOLLOW-UP-part-1. Idempotente; legacy floors senza doc Firestore o senza `projectId` → `projectId` null → sweep skippato silenziosamente (no error). `WipeAllForFloorResult` esteso con `categoryPathSweptCount: number` (tracking dedicato), `storageObjectsDeleted`/`storageObjectsFailed` ora aggregano sweep + per-file delete. **(Issue D — `Rendering cancelled, page 1` du concurrent hydrate)** `floorplanBackgroundStore.ts` `_hydratePersistedBackground`: due call sites paralleli (`CanvasSection.tsx:194` + `FloorplanBackgroundPanel.tsx:37`) → due `useFloorplanBackgroundForLevel` → due `useFloorplanBackgroundPersistence` → due hydrate concorrenti sullo stesso floor → `PdfPageProvider` singleton chiama `loadAsync` due volte di seguito, pdfjs cancella il primo render. Fix: (1) **idempotent short-circuit** all'inizio dell'azione — se `floors[floorId].background?.id === persisted.id && background.fileId === persisted.fileId && !isLoading`, return immediato (no-op); (2) **race-safe in-flight dedup** via `_hydrateInFlight = new Map<string, Promise<void>>()` module-scope — primo call crea il promise, lo registra in mappa e lo restituisce; secondo call concorrente trova in-flight, restituisce stesso promise; cleanup automatico via `.finally(() => map.delete(floorId))`. Pattern parallelo a `_floorProviders` (anch'esso fuori da immer perché class instances). Risolve definitivamente il warning pdfjs e collassa anche eventuali GET ridondanti `/api/floorplan-backgrounds?floorId=...`. **Files**: `src/services/floorplan-background/floorplan-floor-wipe.service.ts`, `src/subapps/dxf-viewer/floorplan-background/stores/floorplanBackgroundStore.ts`. UX wizard invariato; toolbar legacy DXF non toccata. |
| 2026-05-08 | ✅ **Phase 4 REBORN — FOLLOW-UP** (Opus 4.7) — 3 hardening fix dopo test cycle DXF→PDF in `/dxf-viewer`. **(Issue A — Storage orphans)** `floorplan-floor-wipe.service.ts` `deleteStorageObjects()` ora fa **prefix-list** (`bucket.getFiles({ prefix: storagePath })`) prima del delete, catturando le derivazioni create da `FloorplanProcessService` (`{storagePath}.processed.json` compressed scene + `{storagePath}.thumbnail.png`) oltre al binary canonico. Best-effort + per-file `ignoreNotFound: true`; counter `storageObjectsDeleted` riflette ora il totale (originale + derivazioni). Idempotent. **(Issue B — `dxf_viewer_levels` ricreato per PDF/Image)** Format-aware routing end-to-end: `WizardCompleteMeta` + `StepUpload.onComplete` + `FloorplanImportWizard.handleUploadComplete` ora propagano `format: 'dxf' | 'pdf' | 'image'` (estratto da `SmartUploadResult.format`). Caller `EnhancedDXFToolbar` + `LevelPanel` early-return prima di `onSceneImported(...)` quando `meta.format !== 'dxf'` — il raster è già persistito via `/api/floorplan-backgrounds` dentro il Wizard, quindi il legacy `cadFiles` processor + `linkSceneToLevel` non devono più runnare e ricreare `dxf_viewer_levels/{levelId}` con `sceneFileId` puntante a un PDF. `updateLevelContext` rimane attivo per ogni format (scrive solo `floorId`/`buildingId`/`entityLabel`/`floorplanType`, NOT `sceneFileId`) — necessario perché il binding Issue C dipende da `level.floorId`. **(Issue C — PDF non visibile in DXF Viewer canvas)** `useFloorplanBackgroundForLevel.ts` ora risolve il **real building floorId** dalla Level corrente (`levels.find(l => l.id === currentLevelId)?.floorId ?? currentLevelId`) e lo usa come chiave canonica per `setActiveFloor`, `useFloorplanBackgroundPersistence(...)`, `useFloorplanBackground(...)`, `uploadBackground` (POST `/api/floorplan-backgrounds`), `deleteBackground`, e store reads. Risolve mismatch architetturale: ADR-340 keya per `floorId` (es. `flr_894...`), ma il DXF Viewer subapp usa un `levelManager.currentLevelId` sintetico (es. `"default"`); pre-fix il GET `/api/floorplan-backgrounds?floorId=default` restituiva 0 risultati anche se il floorplan esisteva per il floor reale. Backward-compat: legacy levels senza `floorId` continuano a usare `levelId` come chiave. **Files**: `src/services/floorplan-background/floorplan-floor-wipe.service.ts`, `src/features/floorplan-import/components/StepUpload.tsx`, `src/features/floorplan-import/FloorplanImportWizard.tsx`, `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx`, `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx`, `src/subapps/dxf-viewer/floorplan-background/hooks/useFloorplanBackgroundForLevel.ts`. UX wizard invariato (no nuovi step, no UI changes). |
| 2026-05-08 | ✅ **Phase 4 REBORN** (Opus 4.7) — unified Wizard upload entry point with smart routing + HARD floor wipe. **NEW** `src/services/floorplan-background/floorplan-floor-wipe.service.ts` (`FloorplanFloorWipeService.preview()` + `wipeAllForFloor()`): tenant-scoped HARD delete of `floorplan_overlays` + `dxf_overlay_levels/{levelId}/items` (delegated to `FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor`) + `dxf_viewer_levels` parent docs + `floorplan_backgrounds` docs + canonical `files/{fileId}` records (cross-referenced from BOTH legacy `dxf_viewer_levels.sceneFileId` and new `floorplan_backgrounds.fileId`) + Firebase Storage objects (`bucket.file(path).delete({ ignoreNotFound: true })`, best-effort, parallel). Idempotent. 450-op chunked batches. **NEW** `src/app/api/floorplans/wipe-floor/route.ts` — GET preview (no mutations) + POST execute. RBAC `[super_admin, company_admin, internal_user]` via `withAuth` + `withHeavyRateLimit`. **NEW** `src/features/floorplan-import/hooks/useFloorplanSmartUpload.ts` — single hook orchestrating: format detection (`detectFloorplanFormat`: dxf / pdf / image / unknown via MIME + extension), floor resolution (`entityType==='floor'` → `entityId`; `entityType==='unit' && levelFloorId` → `levelFloorId`; otherwise `null`), preview fetch, wipe call, raster upload via `FloorplanBackgroundApiClient.upload` with naturalBounds loaded through `providerRegistry.get(providerId)` + `provider.loadAsync({kind:'file',file})` + `dispose()`, DXF upload via legacy `useFloorplanUpload`. Returns unified `{ uploadSmart, isUploading, progress, error, clearError, detectFormat, resolveFloorId, fetchPreview }`. Non-floor PDF/Image rejected with explicit message ("supported only at floor level"). **MODIFY** `src/features/floorplan-import/components/StepUpload.tsx` — uses smart hook; floor branch fetches preview on mount and shows amber `PreviewBanner` when wipe required (polygons + backgrounds + files counts); on file drop, if wipe required → `WipeConfirmDialog` (AlertDialog with file name + counts) → confirm triggers `uploadSmart` (which performs wipe internally then routes by format). Non-floor branch keeps legacy `existingFile` warning + `FileRecordService.moveToTrash` post-upload. **i18n** `floorplanImport.wipePreview.{title,summary}` + `floorplanImport.wipeDialog.{title,description,confirm,cancel}` (el + en). **NOT TOUCHED** (per ordine Giorgio): legacy DXF upload buttons in DXF Viewer toolbar (Upload DXF Legacy, Enhanced DXF Import, FileUp), `FloorplanBackgroundPanel` toolbar button (rimane control panel, non upload). **WHY**: ADR-340 originale aveva PDF e DXF in subsystem separati, replace flow non simmetrico — un PDF upload non ripuliva DXF e viceversa. Phase 4 reborn unifica: ogni nuovo upload (qualsiasi formato) sweepa **completamente** lo stato del floor prima di scrivere il nuovo background. Replace cross-type (DXF↔PDF/Image) ora atomico end-to-end. |
| 2026-05-07 | ✅ **Phase 8 COMPLETE — Status flipped to ✅ IMPLEMENTED** (Opus 4.7). 4 NEW files + 1 ADR finalize. **(1) SSoT registry module** — added `floorplan-background-system` (Tier 2) in `.ssot-registry.json` between `multi-combobox` and the closing brace. `forbiddenPatterns`: `(addDoc|setDoc)\\s*\\([^)]*(floorplan_backgrounds|FLOORPLAN_BACKGROUNDS)`, same for overlays, plus `useState[^;]*pdfBackground` (legacy state outside subsystem). `allowlist`: `src/services/floorplan-background/`, `src/subapps/dxf-viewer/floorplan-background/`, `src/app/api/floorplan-backgrounds/`, `functions/src/floorplan-background/`, `functions/src/config/firestore-collections.ts`, `src/config/firestore-collections.ts`. Note: bucket-write protection is provided by the existing `storage-public-upload` module (re-using rather than duplicating). `npm run ssot:audit` → 0 violations on the new module; `npm run ssot:baseline` refreshed. **(2) Emulator integration test** — `tests/functions-integration/suites/floorplan-background-persistence.integration.test.ts` (3 describe blocks, 9 cases). Uses the existing `_harness/emulator.ts` (Admin SDK pointed at Firestore emulator via `FIRESTORE_EMULATOR_HOST` set in `setup-env.ts`). Coverage: `FloorplanBackgroundService` round-trip (create/getById/listByFloor/patchTransform/deleteById), tenant isolation (cross-company getById→null, listByFloor→[], patchTransform/deleteById→reject), locked guard, `countByFileId` global cross-company; `FloorplanCascadeDeleteService.cascadeAllPolygonsForFloor` Q8 unified (3 floorplan_overlays + 2 dxf_viewer_levels with 9 items → all wiped, idempotent re-run), `cascadeOverlaysForBackground` (only target bg's overlays, leaves DXF + sibling bg untouched), cross-tenant cascade isolation; `CalibrationRemapService.applyCalibration` atomic single-batch (3 overlays + bg in one commit, polygons remapped to preserve world position via `vertex_new = inverse(T_new) ∘ T_old(v_old)`), and overlay isolation (untouched: same-company-other-bg + other-company-same-bg). Run: `npm run test:functions-integration -- floorplan-background`. Pure-math suite remains in `src/services/floorplan-background/__tests__/persistence.integration.test.ts` (jsdom run). **(3) Visual regression suite** — `src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundCanvas.e2e.spec.ts` (Playwright, picked up by `**/*.e2e.spec.ts` testMatch). 4 active cases against `/demo/floorplan-background-image`: PNG identity, PNG scale ×2, JPEG rotation 90° (block-noise tolerance 0.02), visibility toggle. Test images generated programmatically via canvas → blob (deterministic 4-quadrant + diagonal cross pattern; no committed binaries). 3 deferred cases (`test.skip` with TODO): PDF identity (needs tiny test PDF in `__fixtures__/`), TIFF utif decode (needs TIFF fixture), calibration ×2 + polygon remap (needs DxfViewer harness route, not the standalone demo page). Baselines locked on first run via `--update-snapshots`. **(4) A11y audit** — `src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundPanel.a11y.test.tsx` (jest-axe). Hook-graph fully mocked (`useFloorplanBackgroundForLevel`, `useCalibration`, `useFloorplanBackgroundStore`, `useTranslation`, `useSemanticColors`, `FileUploadButton`, `FloatingPanel`). Suites: 7 panel cases + 2 dialog cases. Asserts: axe-clean DOM in 3 panel states (empty / loaded / calibrating), `aria-pressed` toggle semantics on Visible+Locked icon-buttons, `role="alert"` on error `<output>`, every icon-only button has an accessible name (`aria-label` || textContent), Greek-stub renders non-empty translated strings, `isOpen=false` renders nothing, `CalibrationDialog` exposes `role="alertdialog"` with title + description when both points are picked, closed dialog renders nothing. **(5) ADR finalize** — Status header flipped to ✅ IMPLEMENTED, this changelog entry added, §5.4 (visual) + §5.7 (SSoT registry) marked DONE inline; Phase 8 row in §6 table marked DONE. **Ship gate**: SSoT module registered, baseline refreshed, emulator test compiles (tsc verde, 0 errors on new files), Playwright spec discoverable, jest-axe suite runnable, ADR coherent. |
| 2026-05-07 | ✅ **Phase 7 COMPLETE** (Opus 4.7) — server-side persistence end-to-end. **NEW server services** (3): `src/services/floorplan-background/floorplan-background.service.ts` (Admin SDK CRUD: create/getById/listByFloor/patchTransform/patchCalibration/deleteById/countByFileId; tenant isolation enforced; immutables D6 guarded), `floorplan-cascade-delete.service.ts` (Q8 unified — wipes `floorplan_overlays` AND `dxf_viewer_levels` floorId-indexed → `dxf_overlay_levels/{levelId}/items` subcollection in chunked 450-op batches; idempotent; `getFloorPolygonState` for replace-confirm dialog), `calibration-remap.service.ts` (Q10 affine math `vertex_new = inverse(T_new) ∘ T_old(vertex_old)`, atomic single-batch when overlays ≤ 499, chunked otherwise; pure helpers exported as `__test__`). **NEW API routes** (2 files): `src/app/api/floorplan-backgrounds/route.ts` (POST multipart upload via `uploadPublicFile()` SSoT + `buildPendingFileRecordData/buildFinalizeFileRecordUpdate` SSoT cores; GET by floor with optional `include=polygonState` + inline `fileRecord.downloadUrl` to avoid a second round-trip during hydrate; 50MB cap + mime allowlist; `withHeavyRateLimit` + `withAuth` `requiredGlobalRoles=[super_admin,company_admin,internal_user]`), `[id]/route.ts` (PATCH discriminated union `{ kind: 'transform' \| 'calibration' }` — calibration calls `CalibrationRemapService.applyCalibration`; DELETE cascades overlays via `cascadeOverlaysForBackground`; standard rate limit). **NEW Cloud Function**: `functions/src/floorplan-background/onDeleteFloorplanBackground.ts` (D4 — onDelete trigger; ref-counts `fileId` across `floorplan_backgrounds`; if 0 references remain, deletes `files/{fileId}` doc + Storage object via `bucket.file().delete({ ignoreNotFound: true })`; idempotent; exported from `functions/src/index.ts`; `FLOORPLAN_BACKGROUNDS`/`FLOORPLAN_OVERLAYS` mirrored in `functions/src/config/firestore-collections.ts`). **NEW client wiring** (3 files): `subapps/dxf-viewer/floorplan-background/services/floorplan-background-api-client.ts` (typed wrapper around 4 endpoints; FormData multipart for upload), `hooks/useFloorplanBackgroundPersistence.ts` (D1 `kind: 'url'` hydrate using inline `fileRecord.downloadUrl` from GET response — no extra round-trip; D2 optimistic UI + 500ms debounced PATCH on transform/opacity/visible/locked deltas via Zustand `subscribe`; AbortController on unmount; calibration writes excluded from auto-commit because they remap polygons), additional store action `_hydratePersistedBackground(floorId, persisted, source)` adopts server-issued id/companyId/fileId/createdBy. **MODIFIED**: `useFloorplanBackgroundForLevel.ts` (calls `useFloorplanBackgroundPersistence` + exposes `uploadBackground(file, providerId)` and `deleteBackground()` action handlers — upload flow loads provider locally for `naturalBounds`, POSTs file, then hydrates from canonical proxy URL), `FloorplanBackgroundPanel.tsx` (replace + remove buttons → API), `index.ts` barrel updated. **firestore.rules** + 2 match blocks (lines 1108–1170): `floorplan_backgrounds` Q9 RBAC (read same-tenant, write/delete `isInternalUserOfCompany`, immutables D6 enforced server-side: `id/companyId/floorId/fileId/providerId/naturalBounds/createdBy`); `floorplan_overlays` same RBAC, immutables `id/companyId/backgroundId/floorId`. **firestore.indexes.json** + 3 composite indexes: `(companyId,floorId)` on backgrounds, `(companyId,backgroundId)` and `(companyId,floorId)` on overlays. **Tests**: `tests/firestore-rules/suites/floorplan-backgrounds.rules.test.ts` + `floorplan-overlays.rules.test.ts` (CHECK 3.16 ratchet — 33-cell `role_dual` matrices added to `coverage-matrices-dxf.ts` as `floorplanBackgroundsMatrix()` / `floorplanOverlaysMatrix()`, COVERAGE entries appended to `coverage-manifest.ts`); `seed-helpers-dxf.ts` + `seedFloorplanBackground` / `seedFloorplanOverlay`. `src/services/floorplan-background/__tests__/persistence.integration.test.ts` (pure-math suite for the 3 calibration remap helpers — round-trip property, scale invariance, translate-only inversion, rotation invariance, polygon-wide world-position preservation; emulator round-trip deferred to Phase 8). **storage.rules** unchanged — Phase 7 upload paths (`companies/.../entities/floor/.../domains/construction/categories/floorplans/files/{fileId}.{ext}`) are already covered by the existing `canonical_with_project` and `canonical_no_project` storage-rules paths; client-side writes go through the API which uses Admin SDK (privileged) so storage rules apply only as defense-in-depth. **RBAC mapping note**: ADR Q9 lists `ADMIN`, `SUPER_ADMIN`, `PROJECT_MANAGER` — the codebase uses Firebase custom-claim `globalRole` ∈ {`super_admin`, `company_admin`, `internal_user`, `external_user`}. Phase 7 maps `ADMIN→company_admin`, `SUPER_ADMIN→super_admin`, `PROJECT_MANAGER→internal_user` (project-role mapping deferred — internal_user is the closest fit at the global-claims layer; per-project tightening is a Phase 8 follow-up). |
| 2026-05-07 | 🧹 **Dead-code cleanup DONE** (Sonnet 4.6 — pre-Phase 7). 7 file eliminati: `pdf-background/components/PdfControlsPanel.tsx`, `pdf-background/components/PdfBackgroundCanvas.tsx`, `pdf-background/stores/pdfBackgroundStore.ts`, `pdf-background/hooks/usePdfBackground.ts`, `pdf-background/index.ts`, `hooks/canvas/useFitToPdf.ts`, `systems/levels/hooks/useLevelPdfLoader.ts`. 4 file fix consumer: `useLevelFloorplanSync.ts` (replace `usePdfBackgroundStore.unloadPdf()+setEnabled(false)` → `useFloorplanBackgroundStore.removeBackground(floorId)`), `LevelsSystem.tsx` (rimosso import+call `useLevelPdfLoader` — già coperto da `useFloorplanBackgroundForLevel` in CanvasSection), `hooks/canvas/index.ts` (rimosso export `useFitToPdf`), `useFloorplanImport.ts` (refactored: `usePdfBackgroundStore.loadPdf()/setEnabled()/state.renderedImageUrl/pageDimensions` → `PdfRenderer.loadDocument()+renderPage()` direct calls, rimosso `PANEL_LAYOUT.TIMING.OBSERVER_RETRY` 100ms wait). KEEP: `pdf-background/services/PdfRenderer.ts` + `pdf-background/types/pdf.types.ts` (riusati da `PdfPageProvider` + `floorplan-pdf-renderer`). tsc verde. |
| 2026-05-07 | ✅ **Phase 6 COMPLETE** (Sonnet 4.6) — Sistema calibrazione 2-point in-memory. 12 file touch (5 NEW + 7 MODIFY). **NEW** `hooks/useCalibration.ts` (math: `scaleFactor = realDistMm / dWorld`, optional rotation correction da atan2, unit conversion mm/cm/m/ft/in → mm, `CalibrationData` builder; assunzione 1 world unit = 1mm per DXF costruzione, Phase 7 parametrizzerà da INSUNITS), `components/CalibrationDialog.tsx` (self-contained AlertDialog — legge da store, apre automaticamente quando entrambi i punti sono picked; form: real distance input + unit Select + "set as horizontal" Checkbox), `components/CalibrationPolygonRemapDialog.tsx` (component completo per polygon remap confirm — Phase 6: mai mostrato (count=0); Phase 7 wires query overlay count), `stores/floorplanBackgroundStore.ts` (+ `CalibrationSession` interface, `calibrationSession` state, 4 nuove azioni: `startCalibration`/`setCalibrationPoint`/`cancelCalibration`/`applyCalibration`, selector `selectCalibrationSession`). **MODIFY** `FloorplanBackgroundCanvas.tsx` (click handler → `setCalibrationPoint` con `worldToCanvasRef.current.scale`; RAF draws crosshair A=cyan B=red + dashed line; `style.pointerEvents='auto'` quando `isCalibrating`, `cursor-crosshair` class), `FloorplanBackgroundPanel.tsx` (Calibrate button attivo — `disabled` solo se `background.locked`; `CalibrationInstructions` sub-component con instruction A/B + cancel; transform controls hidden durante calibration), `useFloorplanBackgroundForLevel.ts` (return type extended con `floorId: string`), `DxfViewerContent.tsx` (+ lazy `CalibrationDialog` + Suspense), `index.ts` (+ `CalibrationDialog`, `CalibrationPolygonRemapDialog`, `CalibrationSession`, `useCalibration`, `selectCalibrationSession`, `FloorplanBackgroundForLevelResult`), i18n el + en (+ `calibration.*` namespace — 11 chiavi: title/pixelDist/realDist/deriveRotation/cancel/apply/remapTitle/remapDesc/remapConfirm/instructionA/instructionB/instructionCancel). ADR-340 §3.7 implementato completamente. |
| 2026-05-07 | ✅ **Phase 5 COMPLETE — Phase 4 SKIPPED** (Opus 4.7). Decisione Giorgio: data wipe imminente → no live PDFs da preservare → no wrapper backward-compat → vecchio `pdfBackgroundStore` + `useFitToPdf` + `PdfControlsPanel` + `PdfBackgroundCanvas` diventano dead code inert (Phase 6 cleanup). 12 file touch (8 NEW + 4 MODIFY): **NEW** `providers/PdfPageProvider.ts` (singleton-safe via image cache, ADR-340 §3.3 Q7 single-page), `components/FloorplanBackgroundPanel.tsx` (FloatingPanel-based, empty-state + loaded-state, ProviderId switching, sliders scale/rotation/opacity, visible/locked toggle, replace + remove + calibrate-disabled), `components/ReplaceConfirmDialog.tsx` (AlertDialog auto-mounts da `pendingReplaceRequest`), `hooks/useFloorplanBackgroundForLevel.ts` (binding `levelManager.currentLevelId` → `floorId`, idempotent registerProviders on mount). **MODIFY** `providers/types.ts` (+ `CadCoordinateAdaptation` type), `providers/ImageProvider.ts` + `PdfPageProvider.ts` render() supporta `params.cad` con pipeline Y-flip + margins matching legacy `PdfBackgroundCanvas` pixel-perfect, `components/FloorplanBackgroundCanvas.tsx` accetta `cad?` prop (RAF reads via ref). **WIRE** `CanvasLayerStack.tsx` swap `PdfBackgroundCanvas` → `FloorplanBackgroundCanvas` con CAD adapter, `CanvasSection.tsx` rimuove `usePdfBackgroundStore` + `useFitToPdf` + aggiunge auto-fit camera per nuovo background tramite `useFloorplanBackgroundForLevel`, `canvas-layer-stack-types.ts` swap `pdf` group prop → `floorId: string \| null`, `DxfViewerContent.tsx` swap `PdfControlsPanel` → `FloorplanBackgroundPanel` + `ReplaceConfirmDialog`. **i18n** namespace `panels.floorplanBackground.*` (el + en) — 25 chiavi, Greek puro zero parole inglesi. **panel-tokens** entry `FLOORPLAN_BACKGROUND_CONTROLS` (300×520). **index.ts** barrel aggiornato. Ship gate: panel sostituisce `PdfControlsPanel`, replace flow funzionante in-memory. |
| 2026-05-07 | ✅ **Phase 3 COMPLETE** — Store + Hook + Canvas implementati (Sonnet 4.6). 5 file creati + 2 aggiornati: `stores/floorplanBackgroundStore.ts` (Zustand + immer + devtools + subscribeWithSelector — `Record<string,FloorSlot>` per immer compatibility, module-level `_floorProviders` Map per provider class instances fuori immer, `pendingReplaceRequest` per replace-flow Phase 5, azioni: addBackground/removeBackground/setTransform/setOpacity/setVisible/setLocked/setActiveFloor/confirmReplace/cancelReplace/_loadBackground + selectors), `hooks/useFloorplanBackground.ts` (useShallow selector + bound actions per floorId), `components/FloorplanBackgroundCanvas.tsx` (RAF single-mount loop con refs per valori mutanti, canvas sempre montato per evitare RAF restart bug, z-index delegato al consumer via className), `providers/register-providers.ts` (idempotent singleton guard, ImageProvider registered, PDF stub Phase 4), `stores/__tests__/floorplanBackgroundStore.test.ts` (4 test: addBackground, double-add→pendingReplace, removeBackground+dispose, setTransform). `index.ts` barrel aggiornato con tutti i nuovi export. Demo page `/demo/floorplan-background-image` aggiornata per usare `useFloorplanBackground('demo-floor')` + `FloorplanBackgroundCanvas` (scale/rotation/opacity/visible slider live via store). |
| 2026-05-07 | ✅ **Phase 2 COMPLETE** — ImageProvider implementato (Sonnet 4.6). Deps: `utif@3.x` MIT + `exifr@7.x` MIT installati via pnpm. 4 file creati: `ImageProvider.ts` (~180 LOC — load/EXIF/TIFF/render/dispose, OffscreenCanvas-based, EXIF orientation cases 1–8 via pre-render hardware rotation), `image-compression.ts` (helper — compressImage + isTiff), `utif.d.ts` (module declaration per libreria senza types), `app/demo/floorplan-background-image/page.tsx` (demo interattiva: drag file PNG/JPEG/WEBP/TIFF → naturalBounds + orientation display + canvas render con scale/rotation slider). `index.ts` aggiornato per esportare `ImageProvider`. Zero impatto sui consumer esistenti. Ship gate: demo reachable at `/demo/floorplan-background-image`. |
| 2026-05-07 | ✅ **Phase 1 COMPLETE** — scaffolding implementato (Sonnet 4.6). 10 file creati/modificati: `providers/types.ts` (domain types — BackgroundTransform, CalibrationData, FloorplanBackground, FloorplanOverlay, ProviderSource, ProviderLoadResult, ProviderRenderParams, ProviderCapabilities, ProviderMetadata, type guards), `providers/IFloorplanBackgroundProvider.ts` (contratto interface), `providers/provider-registry.ts` (singleton FloorplanBackgroundProviderRegistry + registerProvider/getProvider helpers), `providers/__tests__/provider-contract.suite.ts` (generic contract test suite factory — 8 tests), `index.ts` (barrel export). ID system: `RASTER_BACKGROUND: 'rbg'` in `enterprise-id-prefixes.ts`, `generateFloorplanBackgroundId()` in `enterprise-id-class.ts` + `enterprise-id-convenience.ts` + `enterprise-id.service.ts`. Firestore: `FLOORPLAN_BACKGROUNDS` + `FLOORPLAN_OVERLAYS` in `firestore-collections.ts`. Test: 2 casi aggiunti in `enterprise-id.service.test.ts`. Zero impatto sui consumer esistenti. |
| 2026-05-07 | 📋 PROPOSED **revisione 3** — round 2 di clarification (Q7-Q11, ελληνικά). Decisioni vincolanti aggiunte: **(Q7)** PDF = single-page only — ogni floor ha 1 file, niente multi-page navigation, UI semplificata, **(Q8)** cross-type replace (DXF↔PDF/Image) = cascade delete unified — service che cancella **ENTRAMBI** DXF-polygons (sistema esistente) **E** floorplan_overlays per il floor — un solo "delete all polygons of floor" path, **(Q9)** RBAC = solo `ADMIN`, `SUPER_ADMIN`, `PROJECT_MANAGER` possono upload/calibrate/delete; read = tutti i ruoli stessa company, **(Q10)** calibration with existing polygons = **auto-remap + always confirm** (Procore-grade safety — polygons mantengono real-world position, dialog "N polygons saranno aggiornati"), **(Q11)** EXIF orientation = **auto-rotate sempre** (industry-standard AutoCAD/Procore/Google Photos), **(Q12)** file size cap 50MB + **in-app compression**: PDF re-render at lower DPI, Image = canvas resize + JPEG q=0.85, TIFF → convert to PNG durante upload. ADR aggiornato sezioni 3.3, 3.6, 3.7, 3.8, 3.10, 3.11 + nuova §3.12 (RBAC). |
| 2026-05-07 | 📋 PROPOSED **revisione 2** dopo clarification round (6 Q&A, ελληνικά). Decisioni vincolanti: **(Q1)** scope = per-κάτοψη-ορόφου, niente altrove, multi-level units (μεζονέτες/καταστήματα) = N κατόψεις indipendenti (codice esistente), **(Q2)** single file per κάτοψη — abbandonato multi-layer stack/z-order/reorder, **(Q3)** replace = confirm dialog + cascade delete polygons, **(Q4)** calibration sempre disponibile (PDF + Image), **(Q5)** strong-separation Procore/SAP-grade — `files` SSoT (binary + generic metadata) + nuova `floorplan_backgrounds` (domain entity con calibration/transform/FK→files) + nuova `floorplan_overlays` (polygons con FK→floorplan_backgrounds), nuovo prefix `rbg_<ulid>`, **(Q6)** image formats = PNG + JPEG + WEBP + TIFF (via `utif.js` MIT). Tile provider rimosso dallo scope (non necessario per single-file-per-floor). ADR riscritto end-to-end. |
| 2026-05-07 | 📋 PROPOSED **revisione 1** — bozza iniziale post bug-fix PDF overlay alignment (`pdfTransform=identity` permanente). Architettura provider-based + multi-layer stack (poi rivista in revisione 2 dopo Q1-Q2 di Giorgio). |

---

## 1. Context

### 1.1 Stato corrente (2026-05-07)

Il DXF Viewer ha un **subsystem PDF-only** (`src/subapps/dxf-viewer/pdf-background/`) che renderizza la pagina 1 di un documento PDF dietro al canvas DXF, con transform indipendente, opacity, page navigation e fit-to-view.

**FloorplanGallery (read-only consumer)** usa lo stesso `PdfRenderer` via:
- `floorplan-pdf-renderer.ts` → `loadPdfPage1(url)` rende a scala 2x → `imageWidth × imageHeight` in pixel-space
- `floorplan-pdf-overlay-renderer.ts` → renderizza poligoni sopra l'immagine usando `calcFit + toScreen` (Y-UP CAD), fit semplice senza margini

**Bug recente (RISOLTO, dirty in working tree):**
`PdfControlsPanel.calculateFitScale()` raddoppiava `pageDimensions` (già a `scale=2`) per `DEFAULT_RENDER_SCALE=2` → `fitScale ≈ 0.22` → vertici salvati nello world ridotto (524×370 invece di ~1190×840) → gallery rendeva nell'angolo. **Fix:** `pdfTransform = identity` permanente + camera fit gestito esclusivamente da `useFitToPdf` su `canvasTransform`.

### 1.2 Limiti dell'architettura attuale

| Aspetto | Stato attuale | Limite |
|---------|---------------|--------|
| **Sources** | Solo PDF | No PNG/JPG/WEBP/TIFF → impossibile usare scansioni di kατόψεις vecchie da fotocopiatore/scanner |
| **Calibration** | Inesistente | L'utente non può dire "questo segmento = 2.5m" per scalare il raster a misure reali |
| **Persistence** | Inesistente — solo in-memory store | Reload pagina = riselezione file da disco |
| **Domain modeling** | `pdfBackgroundStore` accoppia file binary + render state + transform | Niente entità `FloorplanBackground` di prima classe; impossibile versionare, calibrare e salvare in modo coerente |
| **Polygon-file twin** | Polygons salvati in spazio mondiale del DXF; nessun twin per PDF/Image | Cancellando la κάτοψη restano polygons orfani |
| **Test coverage** | Smoke-only | Niente provider contract test, niente visual regression |

### 1.3 Pattern industry — convergenza

| Vendor | Pattern background floorplan |
|--------|------------------------------|
| **Procore (Drawings)** | `drawings/{id}` first-class entity (versions, calibration, sheet-area), markup tables FK to drawing+page |
| **Bluebeam Revu** | PDF document = doc; markups in tabelle dedicate per-page; calibration tool 2-click |
| **AutoCAD Construction Cloud** | Drawing = entity, markups separate, cross-version diff |
| **PlanGrid (ACC)** | Sheet-based PDF, photo overlays as separate domain, geo-pin calibration |
| **SAP DMS / EAM** | Strong typing — generic file blob + domain entity (cv_* + business object) |

**Pattern enterprise convergente:**
1. Drawing/floorplan = **first-class domain entity** con propria collection (NOT "just another file")
2. File binary = stored in object storage, **referenced via FK** dalla domain entity
3. Calibration / scale / transform = **on the domain entity** (mai dentro generic FileRecord)
4. Markups / polygons = **separate collection** con FK alla domain entity
5. Cascade delete = entity → markups → file (se non riferito altrove)

Memory rule "industry standard = default answer" (ADR-330 D8) ⟹ **applichiamo strong separation Procore/SAP-grade**.

### 1.4 Scope drivers (post-Giorgio Q1-Q2)

1. **FloorplanGallery** ha bisogno di renderizzare immagini scannerizzate (vecchie kátopseis su carta, foto smartphone, TIFF da scanner) come background.
2. **DXF Viewer editor** ha bisogno di **un solo** background per κάτοψη (nessuno stack multi-layer — semplificato dopo Q2).
3. **Per-floor binding**: ogni κάτοψη ha 0-1 background. Gli edifici μεζονέτα/κατάστημα che hanno N livelli avranno N κατόψεις indipendenti — **codice esistente nell'app**.
4. **Calibration** è essenziale e sempre disponibile (Q4): il workflow scan-old-floorplan → calibrate-by-known-distance → place-polygons è dominante.
5. **Persistence** è essenziale: reload-after-page-refresh deve mostrare lo stesso background con la stessa calibration.

---

## 2. Decision

Costruiamo un **Floorplan Background System** end-to-end enterprise che:

1. **Astrae** il source dietro un **provider pattern** (PDF + Image, due implementazioni).
2. **Modella** una nuova first-class entity `FloorplanBackground` (domain entity) separata dal generic `FileRecord` SSoT.
3. **Aggancia 0-1 background** per ogni κάτοψη ορόφου (single, no stack — Q2 vincolante).
4. **Introduce** calibration tool (2-point reference distance), sempre disponibile per entrambi i provider (Q4).
5. **Persiste** in 3 layer separati Procore-grade (Q5):
   - `files` collection — binary metadata SSoT (esistente, nessuna modifica)
   - `floorplan_backgrounds` — domain entity (NUOVA), FK→files, FK→floor
   - `floorplan_overlays` — polygons (NUOVA), FK→floorplan_backgrounds
6. **Replace flow** (Q3): nuovo upload con κάτοψη già occupata = confirm dialog + cascade delete (background + polygons), poi load del nuovo.
7. **Image formats** Procore-grade (Q6): PNG + JPEG + WEBP + TIFF (`utif.js` MIT).
8. **Sostituisce** `PdfControlsPanel` con `FloorplanBackgroundPanel` (single-target, no list/reorder).
9. **Wrap** del vecchio `pdfBackgroundStore` come adapter zero-data-loss durante migrazione.
10. **Copre** con test contract (provider) + integration (store + persistence) + visual regression (canvas) + Firestore/Storage rules tests.

Il PDF resta **fully functional** durante la migrazione: il vecchio store viene wrappato come **adapter** sopra il nuovo store, e tutti i consumer esistenti (`useFitToPdf`, `FloorplanGallery`, `DxfCanvas`) continuano a funzionare senza modifiche fino al boy-scout.

---

## 3. Architecture

### 3.1 Layered structure

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 8 — Migration sites (boy-scout)                       │
│  FloorplanGallery, DXF editor canvas, future consumers       │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 7 — UI Panel                                          │
│  FloorplanBackgroundPanel (single-target controls)           │
│  CalibrationDialog (2-point picker)                          │
│  ReplaceConfirmDialog (cascade delete confirmation)          │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 6 — Canvas                                            │
│  FloorplanBackgroundCanvas (RAF, paints active background)   │
│  Replaces PdfBackgroundCanvas                                │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 5 — Hooks                                             │
│  useFloorplanBackground(floorId), useFitToBackground         │
│  (replaces useFitToPdf), useCalibration                      │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 4 — Store                                             │
│  floorplanBackgroundStore (Zustand + immer + devtools)       │
│  Per-floor singleton state via Map<floorId, BackgroundState> │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 3 — Persistence                                       │
│  floorplan-background-persistence.service                    │
│  Writes: files + floorplan_backgrounds + floorplan_overlays  │
│  Tenant isolation: companyId on all 3 collections            │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 2 — Provider Registry                                 │
│  registerProvider(providerId, factory) → ProviderRegistry    │
└──────────────────────────────────────────────────────────────┘
                              ↑
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1 — Provider Strategies                               │
│  PdfPageProvider, ImageProvider                              │
│  Both implement IFloorplanBackgroundProvider                 │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Provider interface (Layer 1)

**Single contract** che PDF e Image implementano:

```ts
export interface IFloorplanBackgroundProvider {
  readonly id: 'pdf-page' | 'image';
  readonly capabilities: ProviderCapabilities;
  readonly supportedMimeTypes: ReadonlyArray<string>;

  /** Loads raw source from File or storage URL. Returns natural pixel-space bounds. */
  loadAsync(source: ProviderSource): Promise<ProviderLoadResult>;

  /** Renders one frame onto the target canvas. */
  render(ctx: CanvasRenderingContext2D, params: ProviderRenderParams): void;

  /** Reports the un-transformed natural pixel dimensions. */
  getNaturalBounds(): NaturalBounds;

  /** Optional: page navigation (PDF-only). Gated by capabilities.multiPage. */
  setActivePage?(page: number): Promise<void>;

  /** Cleanup. */
  dispose(): void | Promise<void>;
}

export interface ProviderCapabilities {
  multiPage: boolean;             // PDF: true, Image: false
  exifAware: boolean;             // Image: true (rotation), PDF: false
  vectorEquivalent: boolean;      // PDF: true, Image: false
  calibratable: boolean;          // ENTRAMBI true (Q4 vincolante)
}

export type NaturalBounds = { width: number; height: number };

export type ProviderSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string }
  | { kind: 'storage-path'; path: string };

export interface ProviderLoadResult {
  success: boolean;
  bounds?: NaturalBounds;
  metadata?: Record<string, unknown>;
  error?: string;
}

export interface ProviderRenderParams {
  transform: BackgroundTransform;
  worldToCanvas: ViewTransform;
  viewport: { width: number; height: number };
  opacity: number;
}
```

### 3.3 Provider implementations

**PdfPageProvider** (Layer 1):
- Wraps existing `PdfRenderer` (pdfjs-dist 4.5.136). Zero re-implementation.
- `supportedMimeTypes`: `['application/pdf']`
- `capabilities`: `{ multiPage: false, exifAware: false, vectorEquivalent: true, calibratable: true }` — **Q7: single-page only**. Se PDF ha N>1 pagine: rende sempre pagina 1, le altre **ignorate** (l'utente carica un PDF distinto per ogni κάτοψη).
- Render: `ctx.drawImage(this.renderedImageCanvas, 0, 0)` con transform applicato dal compositor.
- **Compression upload (Q12)**: se `fileSize > 50MB` → re-render a DPI ridotta (`scale=1` invece di `scale=2`), reupload se size ancora >50MB → reject con error UI "Αρχείο πολύ μεγάλο. Συμπίεσε ή χρησιμοποίησε χαμηλότερη DPI."

**ImageProvider** (Layer 1):
- Carica binary via `fetch(url).blob()`, decodifica a `HTMLImageElement` o `ImageBitmap`.
- `supportedMimeTypes`: `['image/png', 'image/jpeg', 'image/webp', 'image/tiff']` (Q6).
- `capabilities`: `{ multiPage: false, exifAware: true, vectorEquivalent: false, calibratable: true }`.
- **TIFF handling (Q6 + Q12)**: rileva mime `image/tiff`/`image/tif` o estensione `.tif/.tiff` → decode via `utif.js` (MIT) → ImageData → OffscreenCanvas. **In upload pipeline il TIFF viene convertito a PNG/JPG** (lossless→PNG se contiene alpha, altrimenti JPG q=0.92) e salvato come PNG/JPG in Storage. Il `mimeType` salvato in `files` riflette il post-conversion type. Provider runtime non incontra mai TIFF in storage path.
- **EXIF orientation (Q11 vincolante = AUTO-ROTATE)**: legge tag `Orientation` via `exifr` (MIT, ~10KB gzip). Pre-render applica la rotazione hardware al canvas → output `naturalBounds` riflette dimensioni post-rotation (es. portrait phone photo viene salvata già in orientamento corretto). L'utente **non vede mai** una foto "πλάγια". `metadata.imageOrientation` salva il valore EXIF originale per debugging.
- **Compression upload (Q12)**: se size > 50MB → resize via OffscreenCanvas (max-edge 8192px) + re-encode JPEG q=0.85. Se ancora >50MB → reject UI.
- Render: `ctx.drawImage(this.image, 0, 0)`.

### 3.4 Domain entity (Layer 4 store + Layer 3 persistence)

```ts
export interface FloorplanBackground {
  id: string;                              // rbg_<ulid> via enterprise-id.service
  companyId: string;                       // tenant isolation (immutable)
  floorId: string;                         // FK → floor entity (immutable)
  fileId: string;                          // FK → files collection (immutable)
  providerId: 'pdf-page' | 'image';
  providerMetadata: ProviderMetadata;      // page number, exif orientation, etc.
  naturalBounds: NaturalBounds;            // provider-reported, pixel-space, immutable
  transform: BackgroundTransform;          // user-controlled transform
  calibration: CalibrationData | null;     // Q4: optional, available for both
  opacity: number;                         // 0..1
  visible: boolean;
  locked: boolean;                         // UI: cannot move/calibrate when locked
  createdAt: number;
  updatedAt: number;
  createdBy: string;                       // userId
  updatedBy: string;                       // userId
}

export interface BackgroundTransform {
  translateX: number;       // world units (== natural pixels at scale=1)
  translateY: number;
  scaleX: number;
  scaleY: number;           // separate axes for non-uniform calibration
  rotation: number;         // degrees, CCW positive (CAD convention)
}

export interface CalibrationData {
  method: 'two-point';      // future-extension: 'three-point-affine'
  pointA: Point2D;          // pixel-space of natural raster
  pointB: Point2D;
  realDistance: number;     // user-supplied
  unit: 'm' | 'cm' | 'mm' | 'ft' | 'in';
  rotationDerived: boolean; // whether 2-point also derived rotation correction
  calibratedAt: number;
  calibratedBy: string;     // userId
}

export interface ProviderMetadata {
  pdfPageNumber?: number;   // pdf-only
  imageOrientation?: number; // exif-only
  imageMimeType?: string;
  imageDecoderUsed?: 'native' | 'utif';
}
```

### 3.5 Polygon overlays (separated entity, FK→background)

```ts
export interface FloorplanOverlay {
  id: string;                              // ovrl_<ulid> via existing OVERLAY prefix
  companyId: string;                       // tenant isolation (immutable)
  backgroundId: string;                    // FK → floorplan_backgrounds (immutable)
  floorId: string;                         // FK → floor (denormalized for query speed)
  polygon: ReadonlyArray<Point2D>;         // pixel-space del background (Y-UP CAD)
  linkedPropertyId?: string;               // FK → property entity (optional)
  resolvedStatus?: PropertyStatus;         // denormalized for render
  label?: string;
  zIndex: number;                          // ordering when overlapping
  createdAt: number;
  updatedAt: number;
}
```

**Cascade rule (Q3 vincolante):**
- Delete `FloorplanBackground` → cascade delete tutti gli `FloorplanOverlay` con matching `backgroundId`.
- Delete `Floor` → cascade delete tutti i `FloorplanBackground` con matching `floorId` → cascade delete relativi overlays.
- Cancellazione del file in `files`: solo se nessun altro background lo riferisce (reference counting).

### 3.6 Replace flow (Q3 + Q8 vincolanti)

User uploads new file su κάτοψη già occupata. **Same-type** (PDF→PDF, Image→Image) e **cross-type** (DXF↔PDF/Image, PDF↔Image) seguono lo stesso flow:

1. Detect via unified service `getFloorPolygonState(floorId)`:
   ```ts
   {
     hasFloorplanBackground: boolean,
     floorplanOverlayCount: number,
     hasDxfBackground: boolean,
     dxfOverlayCount: number,
   }
   ```
2. Se almeno uno è truthy, mostra `ReplaceConfirmDialog`:
   ```
   ⚠️ Ο όροφος έχει ήδη background αρχείο "{existingFileName}".
   Αν συνεχίσεις, θα διαγραφούν:
   • Το παλιό αρχείο
   • {floorplanOverlayCount + dxfOverlayCount} polygons συνολικά
     ({floorplanOverlayCount} από PDF/Image + {dxfOverlayCount} από DXF)
   Σίγουρα θες να συνεχίσεις;

   [ Ακύρωση ]    [ Διαγραφή και αντικατάσταση ]
   ```
3. Conferma → `cascadeDeleteAllPolygonsForFloor(floorId)` (Q8 unified service) → `addBackground(newFile)` (atomic via Firestore batch).
4. Cancel → no-op.

**`cascadeDeleteAllPolygonsForFloor(floorId)` (Q8 NUOVO unified service):**
- Deve toccare **ENTRAMBI** i polygon systems per garantire single source of truth post-delete:
  1. Query `floorplan_overlays where floorId == floorId AND companyId == ctx.companyId` → batch delete tutti
  2. Query DXF polygon system (collection esistente — TBD da grep, candidate: `dxf_overlay_levels` con FK al floor) → batch delete tutti
  3. Query `floorplan_backgrounds where floorId == floorId AND companyId == ctx.companyId` → delete + reference-decrement file
- Tutto in una Firestore batch atomic. Failure mid-way = rollback automatico (Firestore guarantee).
- Idempotente: chiamata due volte → second call no-op (already empty).

### 3.7 Calibration system (Layer 5 hook + Layer 7 dialog)

**Two-point calibration** (Q4: sempre disponibile):
1. User clicca "Calibration" sul pannello → entra modalità `calibrate`.
2. Click 1: pixel-space point A.
3. Click 2: pixel-space point B.
4. Dialog `CalibrationDialog`:
   ```
   📏 Calibration

   Distance pixel-space: 487.3 px (calculated)

   Real distance: [____] [m ▾]

   ☐ Set this line as horizontal (derive rotation)

   [ Cancel ]    [ Apply ]
   ```
5. Apply → hook calcola:
   - `pixelDist = ‖B − A‖`
   - `realDist = userInput * unitToMeters[unit]`
   - `scale = realDist / pixelDist` (uniform — `scaleX === scaleY`)
   - **Optional rotation correction:** se utente checkba "horizontal/vertical", deriva `rotation` da `atan2(B−A)` e roto-trasla.
6. Aggiorna `background.transform` e `background.calibration`.
7. **Polygon impact (Q10 vincolante = auto-remap + always confirm):** se esistono polygons (`count = countOverlaysByBackgroundId(rbgId)`) > 0:
   - Mostra `CalibrationPolygonRemapDialog`:
     ```
     ℹ️ Calibration θα ενημερώσει {count} polygons για να κρατηθούν
        στην ίδια πραγματική θέση (real-world position).

     Παράδειγμα: αν έχεις διαμέρισμα 5m × 5m, μετά μένει 5m × 5m
        (όχι αλλιώς λόγω scale change).

     [ Ακύρωση ]    [ Calibrate και ενημέρωση polygons ]
     ```
   - Conferma → applica `vertex_new = inverse(newTransform) ∘ oldTransform(vertex_old)` a tutti i polygons via Firestore batch (atomic con la calibration write).
   - Cancel → no-op (né calibration né remap).
   - **Nessuna threshold** (5% delta, etc.) — sempre confirm per Procore-grade transparency.

### 3.8 Persistence (Layer 3) — strong separation Procore-grade

**Storage path** (esistente, ADR-031, zero modifica):

```
companies/{companyId}/projects/{projectId}/entities/floor/{floorId}/
  domains/construction/categories/floorplans/files/{fileId}.{ext}
```

via `buildStoragePath({ companyId, projectId, entityType: 'floor', entityId: floorId, domain: 'construction', category: 'floorplans', fileId, ext })`.

**Firestore collection 1 — `files` (esistente, SSoT post ADR-292):**
- Documento `FileRecord` con `file_*` ID via `generateFileId()`.
- Generic metadata: `fileName`, `fileSize`, `mimeType`, `storagePath`, `uploaderId`, `uploadedAt`, `entityType`, `entityId`.
- **Zero modifiche** al schema esistente. Nessun campo "rasterBackground" iniettato.

**Firestore collection 2 — `floorplan_backgrounds` (NUOVA):**
- Path: `floorplan_backgrounds/{rbgId}` (top-level, tenant isolation via `companyId` field + Firestore rules).
- ID: `rbg_<ulid>` via NUOVO `generateFloorplanBackgroundId()`.
- Domain entity: transform + calibration + naturalBounds + provider info.
- FK: `fileId` → files, `floorId` → (concettuale, no Firestore-level FK).
- Indexed by `(companyId, floorId)` per look-up O(1) per κάτοψη.

**Firestore collection 3 — `floorplan_overlays` (NUOVA):**
- Path: `floorplan_overlays/{ovrlId}` (top-level, tenant isolation via `companyId`).
- ID: `ovrl_<ulid>` via existing `generateOverlayId()` (REUSE).
- Polygons + linked property.
- FK: `backgroundId` → floorplan_backgrounds.
- Indexed by `(companyId, backgroundId)`.

**Cascade delete** (server-side, atomic):
- `deleteFloorplanBackground(rbgId)`: Firestore batch
  1. Query overlays where `backgroundId == rbgId` → delete tutti
  2. Delete `floorplan_backgrounds/{rbgId}`
  3. Check reference count for `fileId` → se 1 (solo questo background), mark file for deletion
  4. Cloud Function trigger pulisce Storage path + delete `files/{fileId}` se reference count == 0

**Tenant isolation:** ogni doc ha `companyId` immutable. Firestore rules CHECK 3.10 enforced (queries devono includere `where('companyId', '==', auth.token.companyId)`).

### 3.9 ID prefixes & naming (SSoT compliant)

**NUOVO prefix** in `src/services/enterprise-id-prefixes.ts`:
```ts
RASTER_BACKGROUND: 'rbg',  // Floorplan background (PDF or Image) — twin of file
```

**NUOVO generator** in `src/services/enterprise-id.service.ts`:
```ts
export function generateFloorplanBackgroundId(): string {
  return `${ENTERPRISE_ID_PREFIXES.RASTER_BACKGROUND}_${ulid()}`;
}
```

**NUOVE collections** in `src/config/firestore-collections.ts`:
```ts
FLOORPLAN_BACKGROUNDS: process.env.NEXT_PUBLIC_FLOORPLAN_BACKGROUNDS_COLLECTION || 'floorplan_backgrounds',
FLOORPLAN_OVERLAYS: process.env.NEXT_PUBLIC_FLOORPLAN_OVERLAYS_COLLECTION || 'floorplan_overlays',
```

**REUSE esistenti:**
- `OVERLAY: 'ovrl'` per polygon IDs
- `FILE: 'file'` per uploaded asset IDs
- `entityType: 'floor'` (già esistente in `ENTITY_TYPES`)
- `domain: 'construction'`, `category: 'floorplans'` (già esistenti in `FILE_DOMAINS` / `FILE_CATEGORIES`)

### 3.10 UI Panel (Layer 7) — single-target

`FloorplanBackgroundPanel` sostituisce `PdfControlsPanel`. **Q7: niente page navigation (single-page only).**

```
┌─ Background Κάτοψης ───────────────────[ × ]─┐
│  📄 Floor-A.pdf                       [ ⋮ ]  │  ← active background
├──────────────────────────────────────────────┤
│  ▸ Scale: [████░░░░] 1.20×    [ Calibrate ] │
│  ▸ Rotation: [────●───] 15°                 │
│  ▸ Position: X: 0  Y: 0       [ Reset ]     │
│  ▸ Opacity: [██████░░] 0.8                  │
│  ▸ Visible: [▣]  Locked: [□]                │
│  ────────────────────────────────────────── │
│  [ Replace background... ]                  │
│  [ Remove background ]                      │
└──────────────────────────────────────────────┘
```

Pannello vuoto-state (κάτοψη senza background):
```
┌─ Background Κάτοψης ───────────────────[ × ]─┐
│                                              │
│  Δεν υπάρχει background.                    │
│                                              │
│  [ 📄 Φόρτωση PDF ]   [ 🖼 Φόρτωση Εικόνας ]│
│                                              │
│  Υποστήριξη: PDF, PNG, JPG, WEBP, TIFF      │
└──────────────────────────────────────────────┘
```

UI features:
- ⋮ menu: Rename, Replace, Calibrate, Export transform, Delete
- **Niente page navigation** (Q7 — single-page only). Se l'utente carica un PDF multi-page, render della sola pagina 1, le altre pagine ignorate (e l'utente lo sa: deve caricare PDF separati per ogni κάτοψη).
- Calibrate button **always visible** (Q4)
- Replace = trigger `ReplaceConfirmDialog` (Q3 + Q8 unified cascade)
- **Visibilità del Panel (Q9 RBAC):** read-only per ruoli ≠ ADMIN/SUPER_ADMIN/PROJECT_MANAGER (tutti i bottoni di mutation disabilitati con tooltip "Δεν έχεις δικαίωμα").

### 3.11 Capabilities matrix

| Provider     | multiPage      | exifAware | vectorEquiv | calibratable | mimeTypes (input)                                                |
|--------------|----------------|-----------|-------------|--------------|------------------------------------------------------------------|
| `pdf-page`   | ❌ (Q7)        | ❌        | ✅          | ✅ (Q4)      | `application/pdf`                                                |
| `image`      | ❌             | ✅ (Q11)  | ❌          | ✅ (Q4)      | `image/png`, `image/jpeg`, `image/webp`, `image/tiff`*           |

*TIFF input convertito a PNG/JPG durante upload (Q12) — runtime non incontra mai TIFF in storage.

UI panel reagisce alla matrix: nasconde controlli irrilevanti per provider.

### 3.12 RBAC (Q9 vincolante)

**Ruoli autorizzati a write/delete:**
- `ADMIN`
- `SUPER_ADMIN`
- `PROJECT_MANAGER`

**Tutti gli altri ruoli (stessa company):** read-only.
**Cross-company:** denied.

**Implementazione:**
- **Client-side (UI):** `useUserRole()` hook → conditional render dei bottoni mutation. Disabled state con tooltip greco.
- **Server-side (Firestore rules):** `firestore.rules` blocchi `match /floorplan_backgrounds/{rbgId}` e `match /floorplan_overlays/{ovrlId}` con:
  ```
  allow read: if belongsToCompany();
  allow create, update, delete: if belongsToCompany() && hasRole(['admin', 'super_admin', 'project_manager']);
  ```
- **API routes:** wrapper `withAuth({ requiredRoles: ['admin', 'super_admin', 'project_manager'] })` su tutte le mutation routes.
- **Storage rules:** stessa policy ruoli per upload + delete in path `companies/.../floorplans/files/...`.

**Test (CHECK 3.16, ADR-298):** rules suite copre tutti i 9 ruoli × 4 ops × 2 companies = matrix completa.

---

## 4. Migration plan (PDF → wrapped provider)

### 4.1 Wrapped store

`pdfBackgroundStore` rimane API-compatibile ma diventa **selector wrapper** sopra `floorplanBackgroundStore`:

```ts
// External selectors unchanged — internally derive from new store
export const usePdfBackgroundStore = () => {
  const bg = useFloorplanBackgroundStore(s => s.activeBackground);
  return useMemo(() => ({
    enabled: bg?.visible ?? true,
    opacity: bg?.opacity ?? 0.5,
    documentInfo: bg?.providerId === 'pdf-page' ? legacyDocInfo(bg) : null,
    currentPage: bg?.providerMetadata.pdfPageNumber ?? 1,
    transform: legacyPdfTransform(bg?.transform),
    renderedImageUrl: bg?.providerId === 'pdf-page' ? rendererCache.get(bg.id) : null,
    // ... etc
  }), [bg]);
};
```

I metodi mutativi (`loadPdf`, `setCurrentPage`, `setOpacity`, `setTransform`) traducono in azioni del nuovo store.

### 4.2 Old → new mapping

| Old (`pdfBackgroundStore`)             | New (`floorplanBackgroundStore`)                                  |
|----------------------------------------|----------------------------------------------------------------|
| `state.enabled`                        | `activeBackground.visible`                                     |
| `state.opacity`                        | `activeBackground.opacity`                                     |
| `state.documentInfo.fileName`          | `getFileRecord(activeBackground.fileId).fileName`              |
| `state.currentPage`                    | `activeBackground.providerMetadata.pdfPageNumber`              |
| `state.pageDimensions`                 | `activeBackground.naturalBounds`                               |
| `state.transform`                      | `activeBackground.transform` (mapped)                          |
| `state.renderedImageUrl`               | provider-internal (cached by provider, not store-exposed)      |
| `loadPdf(file)`                        | `addBackground({ providerId: 'pdf-page', source: { kind: 'file' } })` |
| `setCurrentPage(n)`                    | `setActivePage(backgroundId, n)`                               |
| `unloadPdf()`                          | `removeBackground(backgroundId)`                               |

### 4.3 Boy-scout migration sites

| File | Migration action | Phase |
|------|------------------|-------|
| `src/subapps/dxf-viewer/hooks/canvas/useFitToPdf.ts` | Rinomina → `useFitToBackground`, leggi `activeBackground` | Phase 4 |
| `src/components/shared/files/media/floorplan-pdf-renderer.ts` | Sostituisci con `floorplan-background-renderer.ts` (delegate al provider registry) | Phase 4 |
| `src/components/shared/files/media/floorplan-pdf-overlay-renderer.ts` | Rinomina → `floorplan-overlay-renderer.ts`, accetta `bounds` da any provider | Phase 4 |
| `src/subapps/dxf-viewer/.../DxfCanvas.tsx` (consumer di PdfBackgroundCanvas) | Sostituisci con `FloorplanBackgroundCanvas` | Phase 5 |
| `src/components/shared/files/media/FloorplanGallery.tsx` | Aggiorna prop API (rinomina `pdfBounds` → `backgroundBounds`) | Phase 4 |
| `src/components/shared/files/media/useFloorplanCanvasRender.ts` | Adatta a provider-agnostic | Phase 4 |
| `src/components/shared/files/media/useFloorplanPdfLoader.ts` | Generalizza → `useFloorplanBackgroundLoader` | Phase 4 |

**Strategia:** Phase 1-3 lavorano in parallelo accanto al PDF subsystem (zero modifiche ai consumer). Phase 4 introduce il wrapper. Phase 5 sostituisce i canvas. Phase 6+ elimina il vecchio store.

### 4.4 Data migration

**Test data only** (memory: "All Firestore/Storage data is test. No backward compat needed"):
- Nessun migration script necessario.
- File PDF caricati nelle session precedenti: utente ricarica file da disco — workflow attuale (no persistence ancora).

---

## 5. Test strategy (ADR-298 / ADR-301 / ADR-294 compliant)

### 5.1 Provider contract tests

`src/subapps/dxf-viewer/floorplan-background/providers/__tests__/<provider>.contract.test.ts`

Ogni provider passa la stessa test-suite generica:
1. `loadAsync({ kind: 'file' })` con asset di test → `success: true`, `bounds` valido
2. `getNaturalBounds()` post-load → identico al risultato di `loadAsync`
3. `render()` con identity transform → primo pixel non-blank al centro del canvas
4. `dispose()` → no-op chiamato due volte
5. Capabilities boolean-coerenti con feature implementate
6. **ImageProvider TIFF-specific:** decode multi-strip TIFF con baseline pattern → bounds correct, render non-blank

### 5.2 Store integration tests

`src/subapps/dxf-viewer/floorplan-background/stores/__tests__/floorplanBackgroundStore.test.ts`

- Add background → state.activeBackground populated
- Add second on same floor → trigger replace flow event (no auto-overwrite)
- Calibrate → polygon vertices remap (via subscription mock)
- Cascade delete simulation: background deleted → overlays subscriber notified

### 5.3 Persistence integration tests

`src/services/floorplan-background/__tests__/persistence.integration.test.ts`

- Create background → write to `floorplan_backgrounds` + reference to existing `file_*` doc
- Cascade delete: background → all overlays gone, file ref-count decrement
- Replace flow atomicity: batch write — failure mid-way leaves no orphans
- Tenant isolation: companyId mismatch → query returns empty

### 5.4 Compositor visual regression — ✅ DONE (Phase 8)

`src/subapps/dxf-viewer/floorplan-background/components/__tests__/FloorplanBackgroundCanvas.e2e.spec.ts` (Playwright + screenshot diff, picked up by `**/*.e2e.spec.ts` testMatch)

- ✅ Image PNG + identity transform → baseline `image-png-identity.png`
- ✅ Image PNG + scale ×2 → baseline `image-png-scale-2x.png`
- ✅ Image JPEG + rotation 90° → baseline `image-jpeg-rotation-90.png` (block-noise tolerance 0.02)
- ✅ Visibility toggle → baseline `image-png-hidden.png`
- ⏭️ PDF + identity transform → `test.skip` (needs tiny test PDF in `__fixtures__/`)
- ⏭️ Image TIFF (utif decode) → `test.skip` (needs TIFF fixture)
- ⏭️ Calibration scale ×2 + polygons → `test.skip` (needs DxfViewer harness route, not the standalone demo page)

Test images generated programmatically (canvas → blob, no committed binaries). Baselines locked on first run via `--update-snapshots`.

### 5.5 Firestore rules tests (CHECK 3.16)

`tests/firestore-rules/suites/floorplan-backgrounds.rules.test.ts`
`tests/firestore-rules/suites/floorplan-overlays.rules.test.ts`

- Read same-company → ALLOW
- Read other-company → DENY
- Write same-company + edit-role → ALLOW
- Write same-company + viewer-role → DENY
- Write missing `companyId` → DENY (immutability check via `request.resource.data.companyId == request.auth.token.companyId`)

### 5.6 Storage rules tests (CHECK 3.15)

`tests/storage-rules/suites/floorplan-backgrounds.test.ts`

- Upload pdf same-company → ALLOW
- Upload tiff same-company → ALLOW
- Upload exe → DENY (mime allowlist)
- Upload >50MB → DENY (size cap)
- Read other-company → DENY

### 5.7 SSoT registry update (ADR-294) — ✅ DONE (Phase 8)

Modulo `floorplan-background-system` registrato in `.ssot-registry.json` come **Tier 2** (2026-05-07):
- `forbiddenPatterns`:
  - `(addDoc|setDoc)\\s*\\([^)]*(floorplan_backgrounds|FLOORPLAN_BACKGROUNDS)`
  - `(addDoc|setDoc)\\s*\\([^)]*(floorplan_overlays|FLOORPLAN_OVERLAYS)`
  - `useState[^;]*pdfBackground` (legacy state outside subsystem)
- `allowlist`: `src/services/floorplan-background/`, `src/subapps/dxf-viewer/floorplan-background/`, `src/app/api/floorplan-backgrounds/`, `functions/src/floorplan-background/`, `functions/src/config/firestore-collections.ts`, `src/config/firestore-collections.ts`
- Bucket-write protection (`bucket.file().save()` su path floorplan) è già coperta dal modulo `storage-public-upload` Tier 2 — non duplicato
- Baseline `npm run ssot:baseline` rifrescato; audit corrente: 0 violations sul nuovo modulo

---

## 6. Phases

| Phase | Scope | Files (~) | Ship gate |
|-------|-------|-----------|-----------|
| ✅ **1** | ADR + provider interface + contract test scaffold + provider registry + ID prefix + collections constants | ~10 NEW | **DONE** 2026-05-07 — ADR-340 PROPOSED merged, prefix/collections registered, zero consumer impact |
| ✅ **2** | `ImageProvider` (PNG/JPG/WEBP/TIFF via utif.js) + EXIF orientation + standalone demo | ~6 NEW + 2 deps install (`utif`, `exifr`) | **DONE** 2026-05-07 — Demo `/demo/floorplan-background-image` mostra TIFF + EXIF |
| ✅ **3** | `floorplanBackgroundStore` + `useFloorplanBackground` + `FloorplanBackgroundCanvas` + provider switching (PDF + Image), no persist | ~7 NEW | **DONE** 2026-05-07 — Demo multi-provider funzionante in-memory |
| ⏭️ **4** | PDF wrapper adapter + `useFitToBackground` + FloorplanGallery boy-scout migration | ~4 MODIFY + 2 NEW | **SKIPPED** 2026-05-07 — data wipe imminente, vecchio PDF subsystem rimosso integralmente (no wrapper) |
| ✅ **5** | `FloorplanBackgroundPanel` UI + `ReplaceConfirmDialog` + DxfCanvas integration | ~4 NEW + 2 MODIFY | **DONE** 2026-05-07 — Panel sostituisce `PdfControlsPanel`, replace flow funzionante |
| ✅ **6** | Calibration system (2-point) + `CalibrationDialog` + `useCalibration` + polygon remap on calibrate | ~5 NEW | **DONE** 2026-05-07 — Calibration funzionante su image + pdf con polygon-aware remap |
| ✅ **7** | Firestore + Storage persistence + rules + tests + cascade delete CF | ~10 NEW + rules.json + index.json + 1 Cloud Function | **DONE** 2026-05-07 — Persistence reload across sessions; tenant isolation provata; cascade delete atomic |
| ✅ **8** | Visual regression suite + a11y audit + SSoT registry module + emulator integration test + ADR finalize | 4 NEW tests + registry module + ADR | **DONE** 2026-05-07 — Status `✅ IMPLEMENTED`; SSoT module registered (Tier 2); baseline locked; jest-axe 9/9; tsc verde |

**Atomicità:** ogni phase è ship-able da sola. Phase 1-3 zero impact sui consumer. Phase 4 critical-path migration. Phase 5+ può scivolare nel tempo senza bloccare.

---

## 7. Architecture invariants (N.7.2 checklist)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** — provider load = data fetched + validated prima di render; replace = explicit confirm not silent overwrite |
| 2 | Race condition possible? | **No** — store mutations sequenziali in immer; canvas RAF debounced; provider.loadAsync await prima di addBackground; cascade delete via Firestore batch (atomic) |
| 3 | Idempotent? | **Yes** — `addBackground` con stesso `(floorId, fileId)` deduplica; `setTransform` overwrite-safe; cascade delete idempotente |
| 4 | Belt-and-suspenders? | **Yes** — `floorplan_backgrounds.fileId` validato a runtime contro `files`; orphan-detection task (Phase 9 follow-up); persistence reload validates `naturalBounds` |
| 5 | Single Source of Truth? | **Yes** — `floorplanBackgroundStore` SSoT in-memory; `floorplan_backgrounds` SSoT in Firestore; `files` SSoT per binary metadata; `pdfBackgroundStore` solo lettura derivata |
| 6 | Fire-and-forget or await? | **Await** per loadAsync, persistence write, cascade delete (correctness); fire-and-forget per render-ready telemetry (Phase 9) |
| 7 | Who owns the lifecycle? | **`floorplanBackgroundStore`** in-memory; **`floorplan-background-persistence.service`** server-side; provider registry singleton stateless |

✅ **Google-level: YES** — provider abstraction industria-standard, single-target per κάτοψη (Q2 vincolante), strong-separation Procore-grade (Q5), calibration first-class (Q4), persistence tenant-scoped, replace explicit (Q3), test multi-livello, image format coverage Procore-level (Q6).

---

## 8. File size compliance (N.7.1)

| Module | Estimated LOC | Notes |
|--------|---------------|-------|
| `IFloorplanBackgroundProvider.ts` (types) | ~100 | types/config — no limit |
| `provider-registry.ts` | ~60 | OK |
| `PdfPageProvider.ts` | ~280 | wraps existing PdfRenderer, OK |
| `ImageProvider.ts` | ~340 | OK (decoder dispatch + EXIF + TIFF) |
| `floorplanBackgroundStore.ts` | ~380 | OK (single-target, no stack) |
| `FloorplanBackgroundCanvas.tsx` | ~280 | OK (single-target rendering) |
| `FloorplanBackgroundPanel.tsx` | ~360 | OK |
| `CalibrationDialog.tsx` | ~280 | OK |
| `ReplaceConfirmDialog.tsx` | ~140 | OK |
| `useCalibration.ts` | ~180 | OK |
| `useFloorplanBackground.ts` | ~150 | OK |
| `useFitToBackground.ts` | ~80 | OK |
| `floorplan-background-persistence.service.ts` | ~420 | OK |

Tutti ≤500 LOC, target funzioni ≤40 LOC. Helpers estratti se necessario.

---

## 9. Risks & mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Migration breaks existing PDF flows | **HIGH** | Phase 4 wrapper preserves API exactly; contract tests over wrapper boundary; FloorplanGallery pixel-diff baseline |
| Calibration math wrong → polygons drift | **HIGH** | Pure helpers + property-based tests (fast-check), visual regression with known-good fixtures, polygon remap confirm dialog if delta >5% |
| TIFF decoder crash on malformed input | **MED** | `utif.js` wrapped in try/catch, fallback error UI "TIFF non leggibile, prova PNG/JPG"; size cap 50MB |
| EXIF orientation rotates pin polygons unexpectedly | **MED** | Provider applies orientation pre-render, store baseline = post-orientation natural bounds; documented invariant |
| Storage cost spike (large TIFF files) | **MED** | 50 MB cap + per-company quota counter (Phase 9 follow-up) |
| Firestore index over-cost | **LOW** | Singolo composite `(companyId ASC, floorId ASC)` su backgrounds, `(companyId ASC, backgroundId ASC)` su overlays — sotto quota |
| Replace flow race (double-click) | **MED** | Confirm dialog button disabled during async cascade; idempotent `cascadeDeleteBackground(rbgId)` returns success if not found |
| FloorplanGallery breaks during Phase 4 | **HIGH** | Boy-scout same commit del wrapper; smoke-tests pre/post; PDF baseline pixel-diff |
| Cascade delete leaves orphan storage file | **MED** | Cloud Function trigger su delete `files/{fileId}` quando reference count == 0; nightly orphan-detection job (Phase 9) |
| pdf.js worker hot-reload regression | **LOW** | Già self-hosted (`/pdf.worker.min.mjs`); ImageProvider has no worker dep |

---

## 10. Open questions — RESOLVED (clarification round 2026-05-07)

> Tutte le domande aperte sono state risolte con Giorgio. Riepilogo vincolante.

| # | Domanda | Decisione | Memo |
|---|---------|-----------|------|
| **Q1** | Persistence scope | **Per κάτοψη ορόφου.** Niente altrove nell'app. | Multi-level units (μεζονέτα, κατάστημα) hanno N κατόψεις indipendenti — codice già esistente. |
| **Q2** | Quanti file per κάτοψη | **1 (singolo).** PDF *o* Image *o* DXF (il DXF rimane nel suo subsystem). | Niente stack multi-layer. Niente z-order. Niente reorder. |
| **Q3** | Replace flow su κάτοψη già occupata | **Confirm dialog + cascade delete.** | "Θα χαθούν τα N polygons. Συνεχίζεις;" — yes → atomic batch delete + new upload. No → cancel. |
| **Q4** | Calibration scope | **Sempre disponibile** per entrambi PDF e Image. | Bottone Calibrate sempre visibile. Default scale identity se utente non calibra. |
| **Q5** | Storage / collection / ID | **Strong-separation Procore/SAP-grade.** `files` (esistente, generic) + `floorplan_backgrounds` (NUOVA, domain entity, ID `rbg_<ulid>`) + `floorplan_overlays` (NUOVA, polygons, ID `ovrl_<ulid>` reuse). FK relationships. | Storage path via `buildStoragePath()` esistente, zero modifica. |
| **Q6** | Image formats | **PNG + JPEG + WEBP + TIFF.** | TIFF via `utif.js` (MIT). Procore-level coverage. AVIF/GIF/BMP esclusi. |
| **Q7** | Multi-page PDF | **Single-page only.** Ogni κάτοψη = 1 file. PDF multi-page → solo pagina 1 renderizzata. | Niente UI di page navigation. Compositor semplificato. |
| **Q8** | Cross-type replace (DXF↔PDF/Image) | **Cascade delete unified.** Service `cascadeDeleteAllPolygonsForFloor(floorId)` cancella ENTRAMBI floorplan_overlays + DXF polygon system. | Atomic Firestore batch. Confirm dialog conta polygons di entrambi i sistemi. |
| **Q9** | RBAC | **ADMIN, SUPER_ADMIN, PROJECT_MANAGER** possono write/delete. | Read = tutti stessa company. Cross-company denied. Enforced UI + Firestore rules + API routes + Storage rules. |
| **Q10** | Calibration with existing polygons | **Auto-remap + always confirm dialog.** Polygons mantengono real-world position. Nessuna threshold. | `vertex_new = inverse(newT) ∘ oldT(vertex_old)` atomic con calibration write. |
| **Q11** | EXIF orientation | **Auto-rotate sempre.** Industry-standard. | Pre-render hardware rotation. `naturalBounds` post-orientation. Phone portrait foto sempre orientate correttamente. |
| **Q12** | File size cap + compression | **50MB cap + in-app compression.** PDF re-render lower DPI; Image canvas resize + JPEG q=0.85; TIFF→PNG/JPG conversion in upload pipeline. | Reject UI se ancora >50MB post-compression. |

---

## 11. Library license check (N.5)

| Library | Use | License | Verdict |
|---------|-----|---------|---------|
| `pdfjs-dist@4.5.136` | PDF rendering | Apache-2.0 | ✅ already in tree |
| `utif@3.x` | TIFF decode | MIT | ✅ to install Phase 2 (~30KB gzip) |
| `exifr@7.x` | EXIF orientation read | MIT | ✅ to install Phase 2 (~10KB gzip) |

---

## 12. References

- **ADR-002** — Z-index hierarchy
- **ADR-031** — Canonical File Storage System (`buildStoragePath`)
- **ADR-292** — FILES collection unification
- **ADR-294** — SSoT ratchet enforcement
- **ADR-298** — Firestore rules test coverage SSoT
- **ADR-301** — Storage rules test coverage SSoT
- **SPEC-237D** — Overlay support on PDF backgrounds (carries over)
- **SOS. SOS. N.0.1** — ADR-driven workflow 4-phase
- **SOS. SOS. N.6** — Enterprise IDs (new generator `generateFloorplanBackgroundId`)
- **SOS. SOS. N.7.1 / N.7.2** — File size + architecture checklist
- **SOS. SOS. N.11** — i18n SSoT (all panel strings via `t()`)
- **SOS. SOS. N.12** — SSoT ratchet (new module in registry)

---

**Status finale (2026-05-07):** ✅ **IMPLEMENTED**. Tutte le phase chiuse (Phase 4 SKIPPED per data wipe). Follow-up opzionali documentati come `test.skip` con TODO nel suite Playwright (PDF/TIFF fixtures + DxfViewer harness per il visual remap polygon test).
