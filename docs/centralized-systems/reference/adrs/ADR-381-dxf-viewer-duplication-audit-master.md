# ADR-381 — DXF Viewer Subsystem Duplication Audit (Master)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **RESEARCH COMPLETE** 2026-05-27 — 7 parallel domain audits executed (read-only). Implementation roadmap pending — sub-ADRs εκκρεμούν ανά finding. |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Architecture Audit (Master) |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-381-dxf-viewer-duplication-audit-master.md` |
| **Author** | Claude Opus 4.7 (orchestrator) + 7× Haiku 4.5 (parallel Explore agents) + Γιώργος Παγώνης |
| **Scope** | `src/subapps/dxf-viewer/` (DXF Viewer subapp + bim-3d + canvas-v2 + rendering + systems + snapping + bim/* + ui/ribbon) |
| **Companion of** | ADR-040 (rendering lifecycle), ADR-378 (snap master), ADR-379/380 (audit coverage), ADR-314 (SSoT discover ratchet), ADR-294 (SSoT registry), ADR-299 (ratchet roadmap) |
| **Industry alignment benchmark** | Revit Family system, AutoCAD command registry, ArchiCAD V/G resolver, Autodesk Forge Viewer, Bentley AccuSnap |

---

## Summary

Master audit ADR που τεκμηριώνει την **κατάσταση διπλοτύπων υποσυστημάτων** στο DXF Viewer (`/dxf/viewer` route) μετά από συστηματικό έλεγχο 7 παράλληλων domains. Η αρχιτεκτονική του rendering layer (ADR-040) και του snap layer (ADR-378) είναι **καθαρή και Google-level**. Το **entity layer (7 BIM entities)** είναι **50% copy-paste**, και 3 cross-cutting concerns (visibility, preferences, commands) εμφανίζουν **fragmented SSoT** με **≥1 ύποπτο production bug**.

**Η αφορμή (2026-05-27 dialogue)**:

> Γιώργος: «Όταν μιλάμε για σύστημα rendering μιλάμε για πολλά ή για ένα; Είναι σωστό αυτό που έχουμε; Αν σου έλεγα να ελέγξεις για διπλότυπα συστήματα γενικά στο `/dxf/viewer` — όχι rendering — τι θα έψαχνες; Τι θα έλεγχε η Revit;»

**Η απάντηση μετά από scan**: Από 7 domains audited:
- ✅ 2 clean (stores, coordinate transforms)
- 🟡 2 medium (commands/shortcuts, geometry)
- 🔴 3 critical (visibility, BIM entity lifecycle, preferences)

**Total opportunity**: ~1500+ LOC reduction + 1 πιθανό production bug + 3 νέα SSoT establishment.

---

## 1. Context & Methodology

### 1.1 Audit scope

Audited 7 disjoint domains μέσα στο `src/subapps/dxf-viewer/`:

| # | Domain | Approach | Agent model |
|---|---|---|---|
| 1 | Stores (Zustand + Context + useState) | Grep patterns + classification per domain | Haiku 4.5 |
| 2 | 7 BIM entity lifecycle pipelines | 5-pillar structural comparison (firestore / grips / audit / persistence / renderer / 3D) | Haiku 4.5 |
| 3 | Commands / Tools / Shortcuts | Registry map + event listener cascade analysis | Haiku 4.5 |
| 4 | Coordinate Transform Pipelines | Matrix algebra comparison 2D vs 3D vs canvas-v2 | Haiku 4.5 |
| 5 | Visibility / Layer / Floor systems | Resolver topology + cross-paradigm consultation | Haiku 4.5 |
| 6 | Geometry Kernels | Operation duplication map (intersection / offset / bounds / projection) | Haiku 4.5 |
| 7 | Settings / Preferences | Service inventory + persistence + debounce/race patterns | Haiku 4.5 |

**Method**: Read-only Explore agents, parallel execution (single batch), each ~60-200s. Total wallclock < 4 min για όλα.

### 1.2 Industry benchmark

Revit-style audit checklist applied σε κάθε domain:

| # | Revit question | Στο Nestor |
|---|---|---|
| 1 | Single Source of Truth ανά domain; | Mixed (βλ. §2) |
| 2 | Family/Type uniformity (lifecycle identical per entity); | ❌ partial (audit-clients fixed, υπόλοιπα copy-paste) |
| 3 | View Engine separation (Plan/3D/Schedule/Section read ίδιο model); | ✅ yes |
| 4 | Command Registry centralization; | ✅ core + ❌ context-menu split |
| 5 | Geometry Kernel single; | ✅ αλγόριθμοι + ❌ bounding-box types |
| 6 | Properties Panel uniformity; | (out of scope) |
| 7 | Cross-cutting concerns ως aspects; | Mixed (audit ✅ via ADR-379/380, prefs ❌) |
| 8 | Event Bus topology; | (covered in ADR-040) |
| 9 | Settings hierarchy single resolver; | ❌ 7 παράλληλα services |
| 10 | i18n + Notifications + Audit registry-based; | ✅ via ADR-279/280, ADR-195, ADR-379/380 |

---

## 2. Findings (per domain)

### 2.1 ✅ Stores (62 Zustand + 7 Context) — CLEAN

**Verdict**: Mostly clean. Phase XXII.C (TransformContext deletion) was the correct call και η discipline υπάρχει.

| Finding | Status |
|---|---|
| 62 Zustand stores | No intra-store duplication detected |
| 7 React Contexts | 5 legitimate (config bridges), 2 backward-compat shims |
| `LineSettingsContext` + `TextSettingsContext` | Bridge shims delegating to `DxfSettingsStore`. Intentional graceful-degrade pattern (ADR-040 defensive). |
| `SnapContext` (mode toggles) vs `ImmediateSnapStore` (geometry) | Correct separation: persistent prefs vs transient frame data. |
| `SelectionStore` (2D marquee) vs `Selection3DStore` (BIM entity) | Correct paradigm split, not duplication. |
| `HoverStore`, `ImmediatePositionStore`, `ImmediateSnapStore`, `ImmediateTransformStore` | All ADR-040 micro-leaf compliant. Zero React state mirroring. |

**Action**: NONE (low priority documentation polish only).

---

### 2.2 ✅ Coordinate Transforms — CLEAN

**Verdict**: 2D pipeline SSoT'd σε `CoordinateTransforms.ts`. 3D delegates στο Three.js native projection. Zero matrix-math copy-paste.

| Finding | Status |
|---|---|
| `rendering/core/CoordinateTransforms.ts` (512 LOC) | Single source για 2D affine math |
| `bim-3d/viewport/coordinate-transforms.ts` (149 LOC) | Three.js projection wrapper |
| `systems/cursor/ImmediateTransformStore.ts` | State holder SSoT |
| `systems/zoom/utils/calculations.ts` | Delegates στο core, removed local duplicate previously |
| `MM_TO_M = 0.001` constant | ⚠️ scattered σε 5 BIM geometry files + 3D viewport (same value everywhere — low risk) |
| 2D ↔ 3D viewport sync | ❌ **NONE** — independent systems (intentional currently) |

**Action**: Low-priority centralize `MM_TO_M` σε `config/scene-units.ts` (~1h Haiku, trivial).

---

### 2.3 🟡 Commands / Shortcuts / Tools — MEDIUM (centralized config, fragmented listeners)

**Verdict**: Configuration κεντρικοποιημένο, αλλά event-listener layer fragmented. Context menu actions ΔΕΝ είναι ICommand → δεν undo-able.

| Layer | Status | Files |
|---|---|---|
| ICommand interface | ✅ SSoT | `core/commands/interfaces.ts` (~76 command classes) |
| Command Registry (deserialization + undo/redo) | ✅ SSoT | `core/commands/CommandRegistry.ts` |
| Keyboard shortcuts config | ✅ SSoT | `config/keyboard-shortcuts.ts` + `bim-3d/shortcuts/keyboard-shortcuts-3d.ts` |
| Keyboard event listeners | 🟡 **4 hooks + 8 tool-specific** | `useKeyboardShortcuts` + `use3DShortcuts` + `useCanvasKeyboardShortcuts` + `useDxfToolbarShortcuts` + 8× `keyboard-handlers/*` |
| Ribbon command keys | 🟡 **11 bridge files** | `bridge/*-command-keys.ts` (stair/wall/beam/column/opening/slab/slab-opening/array/line-tool/xline/dim) — linear branch dispatch |
| Context menu actions | 🔴 **NOT ICommand** | `grip-context-menu-actions.ts` (procedural callbacks → NO undo) |
| ESC priority bus (ADR-364) | ✅ Centralized | `EscapeCommandBus` με priority levels |

**Known risks**:
- **Multi-layer listener cascade**: 4 listeners σε `window.keydown capture:true`. Implied mount-order, not explicit priority. Race possible.
- **Chord dispatcher timeout race**: 350ms window για multi-char (S+T=stair). Held-key cases fall through to fallback.
- **Ribbon bridge scalability**: O(domains) dispatch in `useRibbonCommands.ts`. +1 branch per new BIM entity.

**Action**: see §3 — M1 (context-menu → ICommand) + ribbon auto-registry.

---

### 2.4 🟡 Geometry — MEDIUM (algorithms clean, types fragmented)

**Verdict**: Αλγόριθμοι ΔΕΝ είναι copy-pasted. Το πρόβλημα είναι **type schism στα bounding boxes**.

| Operation | File count | Verdict |
|---|---|---|
| Line intersection | 8 files | ✅ Core SSoT exists (`GeometricCalculations.getLineIntersection()`) |
| Polyline offset | 2 files | ✅ Acceptable (rendering vs BIM domain split) |
| Point-to-line distance | 3 files | ✅ Delegated to SSoT |
| **Bounding box** | **14 files / 7 incompatible variants** | 🔴 **`{min,max}` vs `{minX,maxX}` confusion** — 30+ consumers import wrong variant |
| Polygon area / centroid | 5 files | ✅ BIM has SSoT (`polygon-utils.ts`) |
| Viewport representation | 8 definitions | 🟡 Snap engines have 5 identical copies |

**Action**: see §3 — M2 (canonical `BoundingBox` type + conversion utility).

---

### 2.5 🔴 Visibility / Layer / Floor — CRITICAL (suspected production bug)

**Verdict**: 5 παράλληλα visibility sources, **ZERO unified resolver**, 2D/3D divergence.

| Source | 2D effect | 3D effect |
|---|---|---|
| V/G category (`objectStyles`) | ✅ early-return guard | ✅ blocks mesh creation |
| **`Layer.visible`** | 🔴 **NOT CHECKED in render path** | 🔴 **completely ignored** |
| Floor visibility (`applyFloorVisibility`) | N/A | ✅ post-hoc `mesh.visible` mutation |
| Building visibility (`applyBuildingVisibility`) | N/A | ✅ post-hoc `mesh.visible` mutation |
| ViewTemplate (`view-template-store`) | ✅ via objectStyles merge | ✅ via objectStyles merge |

**Suspected bugs to verify**:
1. User κρύβει layer στο 2D → entity παραμένει visible; **YES** (per audit grep — `WallRenderer` δεν consults `layer.visible`).
2. Switch 2D → 3D, layer κρυμμένο στο 2D → entity ξανά visible στο 3D; **YES** (3D never reads LayerStore).
3. Ghost-mode floor + V/G hidden post-hoc → ghost μπορεί να εξαφανιστεί ολόκληρο.

**Action**: see §3 — **C1 (HIGHEST PRIORITY)**: SSoT `resolveIsEntityVisible(entity, view, ctx)` consulted πριν render σε **και τα δύο** paradigms.

---

### 2.6 🔴 BIM Entity Lifecycle (7 entities × 5-6 pillars) — CRITICAL

**Verdict**: ~50% του BIM codebase είναι copy-paste. Audit-clients JUST consolidated (ADR-379/380), τα υπόλοιπα 5 pillars εκκρεμούν.

| Pillar | Files | Status | Estimated LOC saved |
|---|---|---|---|
| **firestore-services** | 7 (wall/column/slab/beam/opening/slab-opening/stair) | 🟡 PARTIAL — ~220-253 LOC each, structurally identical, διαφέρουν μόνο σε collection name + type params | ~140 LOC (35%) |
| **grips** | 6 (wall/opening/column/slab/beam/stair) | 🔴 MISSING base — 1,252 LOC total, 60% duplication σε `unitAxis()`, `perpUnit()`, `project2D()`, rotation, boundary clipping | ~750 LOC (60%) |
| **audit-clients** | 7 | ✅ **JUST CONSOLIDATED** ADR-379+380 (`bim-audit-helpers.ts` + `diffTrackedFields` + tracked-fields registries) | — (done) |
| **persistence hooks** | 1 (μόνο stair) | 🔴 MISSING — υπόλοιπα entity types κάνουν direct Firestore calls, χωρίς debounced soft-lock pattern | unknown |
| **2D renderers** | 4-7 (wall/column/slab/beam + opening/slab-opening + stair) | 🟡 PARTIAL — `BaseEntityRenderer` exists (ADR-040, ADR-065) με `finalizeRender()` SSoT. Override `render()` per entity. Hatch/fill/grips patterns differ. | medium |
| **3D converters** | 2 (`BimToThreeConverter` 254 LOC + `StairToThreeConverter` 329 LOC) | 🔴 MISSING base — extrude→rotate→tag pattern duplicated | ~120 LOC (20%) |

**Template προς replication**: `bim-audit-helpers.ts` + tracked-fields registries (ADR-379) είναι το ιδανικό pattern. Apply σε firestore + grips + persistence.

**Action**: see §3 — **C2**: BaseGripDefinition + BaseEntityFirestoreService + persistence hook base.

---

### 2.7 🔴 Settings / Preferences — CRITICAL (7 parallel services + 3 race patterns)

**Verdict**: 7 ανεξάρτητα preference services, **NO unified resolver**, **3 different debounce/race-protection implementations**, και **triple-source** για "Line/Text General".

| # | Service | Scope | Persistence | Debounce | Race-guard |
|---|---|---|---|---|---|
| 1 | `DxfSettingsStore` | Line/Text/Grip overrides | localStorage | none | none |
| 2 | `BimRenderSettingsStore` | Per-view BIM render (drawingScale, viewRange, objectStyles) | Firestore | 500ms inline (`pendingTimers` Map) | epoch quiet-window (2s) |
| 3 | `Bim3DPreferencesService` | 3D viewport UI prefs | Firestore | none | none |
| 4 | `OpeningTagStyleService` | Per-project opening tag style (ADR-376 C.2) | Firestore | 200ms inline | none |
| 5 | `UserSettingsRepository` | Cross-device SettingsState sync | Firestore | inherited ~500ms | hash-equality skip |
| 6 | `EnterpriseDxfSettingsProvider` | Hierarchical (general → mode-specific) | dual (LS + FS) | 500ms (`stableHash`) | stable-hash dedupe |
| 7 | `layer-picker-persistence` | Current/recent layers per project+level | localStorage | none | none |

**Overlap zones**:
- **Line/Text General**: triple-source (#1 + #5 + #6). Ποιος είναι SSoT;
- **BIM V/G colors**: μόνο #2, αλλά no cross-project override (ADR-375 Phase C.4 TBD)
- **Layer Picker Current**: dual-sync (#7 localStorage + #5 Firestore slice `dxfViewer.dxfSettings.layerPicker`)

**Action**: see §3 — **C3**: PreferenceResolver SSoT + extract `Debouncer<T>` + `useLocalWriteGuard()` utility.

---

## 3. Priority-Ranked Action List

| Priority | # | Action | Sub-ADR (proposed) | Effort | LOC saved | Risk |
|---|---|---|---|---|---|---|
| ✅ | **C1** | **VisibilityResolver SSoT** (5→1) + fix `layer.visible` bug + 2D/3D consultation parity | **[ADR-382](./ADR-382-visibility-resolver-ssot.md)** ✅ COMPLETE 2026-05-27 | ~3 days Opus (delivered) | medium | ⚠️ production logic — **closed** |
| 🔴 | **C2** | BaseGripDefinition + `shared-grip-math.ts` | **ADR-383** | ~60h Opus | ~750 | medium |
| 🔴 | **C3** | PreferenceResolver SSoT + extract `Debouncer<T>` + `useLocalWriteGuard()` | **ADR-384** | ~2 weeks Opus | ~400 | LOW |
| 🟡 | **M1** | `BaseEntityFirestoreService<TDoc, TParams, TSave>` (mirror audit pattern) | **ADR-385** | ~80h Opus | ~140 | LOW |
| 🟡 | **M2** | Canonical `BoundingBox` type + conversion utilities (`{min,max}` ↔ `{minX,maxX}`) | **ADR-386** | ~1 day Sonnet | small | medium (30+ imports) |
| 🟡 | **M3** | BIM Persistence Hook base pattern (mirror `use-stair-persistence`) | **ADR-387** | ~1 week Sonnet | varies | LOW |
| 🟡 | **M4** | `BaseThreeBuilder` (extrude→rotate→tag SSoT για 3D converters) | **ADR-388** | ~50h Opus | ~120 | medium |
| 🟢 | **L1** | Context menu actions → ICommand pattern (undo-able, testable) | **ADR-389** | ~2 weeks Opus | — (correctness) | medium |
| 🟢 | **L2** | Ribbon bridge auto-registry (eliminate `useRibbonCommands` linear branch) | **ADR-390** | ~1 week Sonnet | small | LOW |
| 🟢 | **L3** | Centralize `MM_TO_M` + unit scales σε `config/scene-units.ts` | (folded σε ADR-381 §4 changelog) | ~1h Haiku | trivial | LOW |

**Cumulative**: ~1500+ LOC reduction + 1 production bug fix + 4 νέα SSoT establishments (Visibility / Preferences / FirestoreService base / Grip base).

---

## 4. Phase Roadmap (next sessions)

Κάθε action → δικό του ADR + δικιά του συνεδρία (per N.8 orchestrator/Plan Mode rule).

**Recommended sequence**:

1. **First session — C1 (Visibility)**: Plan Mode με Opus 4.7. Verify το `layer.visible` bug με live test. Draft ADR-382. Implementation σε ξεχωριστή συνεδρία.
2. **Second session — C2 (Grips)**: Sonnet 4.6 (well-scoped refactor). Mirror του ADR-379 pattern.
3. **Third session — C3 (Preferences)**: Opus 4.7 (cross-cutting, settings hierarchy). Largest scope.
4. **Bundled sessions — M1-M4**: Sonnet 4.6 για mechanical refactors.
5. **Cleanup session — L1-L3**: Haiku για trivials, Opus για context-menu ICommand.

**Total estimated effort**: ~3-4 εβδομάδες developer time για να φτάσει το DXF Viewer σε **Google-level entity-layer + cross-cutting SSoT**.

---

## 5. What this audit confirmed (positive)

Πριν προτείνουμε αλλαγές, πρέπει να αναγνωριστεί τι **ήδη είναι Google-level**:

| Subsystem | Pattern | Equivalent industry |
|---|---|---|
| **Rendering** (ADR-040) | Single `UnifiedFrameScheduler` + micro-leaf subscribers | Adobe Illustrator, Figma, Linear |
| **Snap** (ADR-378) | Single `ProSnapEngineV2` + Registry + 26 engines | Revit OSNAP, AutoCAD, ArchiCAD |
| **Audit** (ADR-379/380) | `EntityAuditService` + `diffTrackedFields` + tracked-fields registries | Revit element history |
| **Commands core** | `CommandRegistry` + `ICommand` interface | AutoCAD COMMAND, Revit External Commands |
| **i18n** (ADR-279/280) | Runtime resolver + locale JSON SSoT | Industry standard |
| **Notification keys** (ADR-294) | `NOTIFICATION_KEYS` registry + domain hooks | Industry standard |
| **Snap context separation** (ADR-040 Phase II) | Mode toggles in Context, geometry in ImmediateStore | Frame-rate critical separation |
| **Phase XXII.C cleanup** | Removed orphan `TransformContext` duplicate | Shows team discipline |

**Verdict**: Η **orchestration layer** της εφαρμογής (πώς συντονίζονται τα συστήματα μεταξύ τους) είναι ώριμη. Το **entity layer** (πώς ορίζεται κάθε BIM entity μέσα στο pipeline) και **3 cross-cutting concerns** (visibility, prefs, context-menu commands) χρειάζονται προσοχή.

---

## 6. Open Questions (για επόμενη συνεδρία)

1. **Visibility bug verification**: είναι όντως bug ή feature; (Σε κάποια CAD apps το layer.visible **είναι** mode-dependent — π.χ. plot-only). Πρώτο step του ADR-382 = manual reproduction.
2. **PreferenceResolver hierarchy**: User > Project > System > Default; Ή Project > User > System > Default; (Revit follows Project > User, AutoCAD follows User > Drawing.)
3. **BIM Family base pattern**: TypeScript generics ή abstract class; Φοβάμαι ότι generics + inheritance combo θα δημιουργήσει type juggling. Worth a spike.
4. **Context-menu ICommand migration**: do-while: εφαρμογή σε νέα context menus first και existing remain procedural μέχρι touch (Boy Scout) — ή batched refactor; (ADR-389 question.)
5. **3D BaseThreeBuilder**: αξίζει αν έχουμε μόνο 2 converters σήμερα; (ROI threshold = 4+ converters συνήθως. Με stair να ζητάει ήδη ξεχωριστή υλοποίηση, ίσως χρειαζόμαστε 3D-level templating.)

---

## 7. Cross-references

**Established SSoTs (αυτό το ADR ΔΕΝ τους ξανα-εφευρίσκει)**:
- ADR-040 micro-leaf rendering lifecycle
- ADR-065 grip rendering centralization
- ADR-195 audit value catalogs
- ADR-278/279/280 i18n SSoT
- ADR-294 SSoT ratchet + NOTIFICATION_KEYS registry
- ADR-314 SSoT discover ratchet (CHECK 3.18)
- ADR-355 firestoreQueryService subscribe
- ADR-364 EscapeCommandBus priority
- ADR-375 BIM render settings + V/G
- ADR-378 Snap master architecture
- ADR-379/380 BIM audit coverage

**Νέα ADRs που γεννιούνται από αυτό το audit** (αρίθμηση εκκρεμή):
- ADR-382 Visibility Resolver SSoT (HIGHEST PRIORITY)
- ADR-383 BIM Grip Family Base
- ADR-384 Preference Resolver SSoT + Debouncer/QuietWindow
- ADR-385 BaseEntityFirestoreService
- ADR-386 Canonical BoundingBox Type
- ADR-387 BIM Persistence Hook Base
- ADR-388 3D BaseThreeBuilder (under review — ROI threshold)
- ADR-389 Context-Menu → ICommand Migration
- ADR-390 Ribbon Bridge Auto-Registry

---

## 8. Changelog

| Date | Author | Note |
|---|---|---|
| 2026-05-27 | Opus 4.7 (orchestrator) + 7× Haiku 4.5 + Γιώργος | Initial draft. 7-parallel-domain audit results consolidated. Roadmap defined. Implementation pending επόμενες συνεδρίες. |
