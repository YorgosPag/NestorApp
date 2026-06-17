# ADR-470 — Structural Component Visibility (Σώμα / Σοβάς / Οπλισμός)

**Status:** 🟢 DONE 2026-06-17 (Opus, UNCOMMITTED — tsc + browser-verify + commit).
**Discipline:** DXF Viewer / BIM render visibility.
**Builds on:** ADR-449 (structural finish skin `showFinishSkin`), ADR-456 (reinforcement `showReinforcement`),
ADR-382 (visibility resolver), ADR-375 C.5 (`BimElementStyleOverride`), ADR-452 (cut-plane hide gate),
ADR-446 (Visual Style panel).

## 1. Context / Problem

Ο μηχανικός ήθελε, όπως στη Revit («Parts» / V/G subcategory visibility), να ελέγχει **ανά component**
ποια κομμάτια ενός δομικού στοιχείου προβάλλονται σε 2Δ + 3Δ:
- **σώμα σκυροδέματος** (core / στατικός πυρήνας),
- **σοβάς** (plaster / finish skin),
- **οπλισμός** (reinforcement / rebar),
σε **οποιονδήποτε** από τους 8 συνδυασμούς (π.χ. «μόνο οπλισμός», «σοβάς+οπλισμός»), και όταν ορίζει
**υψόμετρο τομής** να βλέπει μόνο τα ενεργοποιημένα components στο τρέχον επίπεδο.

Υπήρχαν ήδη 2 από τα 3: view-level toggles `showFinishSkin` (ADR-449) + `showReinforcement` (ADR-456),
πλήρως ενσύρματα σε 2Δ+3Δ. Έλειπαν: (α) toggle για το **σώμα**, (β) **per-element** override, (γ)
**cut-plane parity** για σοβά/οπλισμό (τα scene-level overlay passes δεν φιλτράρονταν με το cut plane),
(δ) ένα **ενοποιημένο** Revit-grade UI.

## 2. Decision

Ενοποίηση των 3 components κάτω από **ΕΝΑ SSoT** με Revit precedence **per-element override → per-view
flag → default**:

```
type StructuralComponent = 'core' | 'plaster' | 'reinforcement'
isStructuralComponentVisible(component, entity?) :
   ① entity.styleOverride.componentVisibility[component]   (αν ορισμένο)
   ② per-view flag (showStructuralCore | showFinishSkin | showReinforcement)
   ③ default (core ON · plaster ON · reinforcement OFF)
```

Τα legacy `isStructuralFinishVisible` (ADR-449) / `isReinforcementVisible` (ADR-456) γίνονται **thin
aliases** του resolver (component='plaster' / 'reinforcement', χωρίς entity) → μηδέν αλλαγή στα υπάρχοντα
call-sites. Defaults αμετάβλητα (back-compat). Νέο `showStructuralCore` default ON ⇒ μηδέν migration.

## 3. Architecture

### SSoT πυρήνας
- **NEW `config/bim-structural-components.ts`** — `StructuralComponent` type + `STRUCTURAL_COMPONENTS` +
  `STRUCTURAL_COMPONENT_DEFAULT_VISIBLE` (core/plaster ON, reinforcement OFF) + label keys. Pure (React-free).
- **NEW `bim/visibility/structural-component-visibility.ts`** — `isStructuralComponentVisible(component, entity?)`
  resolver (event-time, ADR-040). `ComponentVisibilityEntity = { styleOverride? }`.
- **MOD `config/bim-object-styles.ts`** — `BimElementStyleOverride += componentVisibility?: Partial<Record<StructuralComponent, boolean>>`.
- **MOD `config/bim-render-settings-types.ts`** + `state/bim-render-settings-store-types.ts` +
  `state/bim-render-settings-store.ts` — `showStructuralCore` (default true) + `setShowStructuralCore`
  (idempotent + 500ms debounced Firestore write, mirror των άλλων δύο).
- **MOD** `bim/finishes/structural-finish-visibility.ts` + `bim/structural/reinforcement/rebar-visibility.ts`
  → aliases του resolver.

### 2Δ (leaf renderers + scene overlay passes)
- **core gate** σε `ColumnRenderer`/`BeamRenderer`/`WallRenderer`/`FoundationRenderer`/`SlabRenderer`/
  `StairRenderer`: όταν `core` κρυμμένο → `finalizeRender(); return` (παραλείπει το σώμα, κρατά
  grips/selection). Σοβάς + οπλισμός είναι ΑΝΕΞΑΡΤΗΤΑ scene-level passes ⇒ «μόνο οπλισμός» δουλεύει.
- **cut-plane parity + per-element**: `DxfRenderer.drawColumnReinforcement2D` + `drawStructuralFinishSkin2D`
  + `dxf-foundation-reinforcement-overlay`: gate ανά entity με `isStructuralComponentVisible(...)` +
  `isHiddenByCutPlane(...)` (αντί view-level early-return).
- **per-element στα overlay passes**: `DxfEntity += styleOverride?` (forwarded από `buildBase` στον
  `dxf-scene-entity-converter`) ώστε το override να ισχύει ΚΑΙ στα scene passes (όχι μόνο στους leaf renderers).

### 3Δ (converters)
- **NEW `bim-3d/converters/structural-core-visibility-3d.ts`** — `applyStructuralCoreVisibility3D(result,
  coreMesh, entity)`: `coreMesh.visible=false` όταν core κρυμμένο (σοβάς/οπλισμός μένουν· tag/selection μένουν).
- **MOD** `bim-three-structural-converters` (column×2 + beam + slab) + `foundation-to-three` +
  `BimToThreeConverter` (wall single-solid): core gate + per-element σοβάς/οπλισμός (`composeColumnWithFinish`/
  `attachColumnRebar`/beam finishSkin/`attachFoundationRebar` διαβάζουν τον resolver με entity).

### Ribbon UI (δίπλα στο «Στυλ Προβολής»)
- **NEW `StructuralComponentVisibilitySelect.tsx`** — 3 chips (Σώμα/Σοβάς/Οπλισμός) → per-view flags.
- **NEW `StructuralComponentElementOverride.tsx`** — per-element override (👁/🚫/↺ ανά component) όταν
  υπάρχει selection· emit `bim:set-component-visibility` (μηδέν canvas coupling).
- **NEW `core/commands/entity-commands/SetComponentVisibilityCommand.ts`** — undoable batch override writer
  (Firestore-safe· persist μέσω `signalEntitiesAttached`).
- **NEW `hooks/useStructuralComponentOverride.ts`** — ακούει το event, φιλτράρει δομικά, εκτελεί command
  (wired στο `DxfViewerContent`, δίπλα στο `useStructuralFootingConnect`).
- **MOD** `RibbonPanel` routing + `view-tab-visual-styles` (προσθήκη widget) + `view-tab-bim-settings`
  (subsume τα παλιά `FINISH_SKIN_BUTTON`/`REINFORCEMENT_BUTTON` από το «Ορατότητα/Γραφικά»· τα contextual
  column/foundation tabs κρατούν τα quick-toggles τους).
- i18n: `ribbon.commands.componentVisibility.*` (el + en).

## 4. Consequences / Limitations

- ✅ 8-state per component (view) + per-element override (Revit-grade), 2Δ/3Δ parity, Firestore-persisted ανά level.
- ✅ Cut-plane parity: σοβάς+οπλισμός σέβονται πλέον το υψόμετρο τομής όπως το σώμα.
- ⚠️ **DEFER**: 3Δ core gate στον τοίχο **group path** (κουφώματα/πολυστρωματικά — blanket hide θα έκρυβε
  κουφώματα) + 3Δ σκάλα (composite). 3Δ scene-level σοβάς silhouette = per-view μόνο (per-element σοβάς
  στο 3Δ flat path αναλαμβάνεται από τον silhouette). multi-layer slab 3Δ core gate.
- BOQ/schedule αμετάβλητα (visibility-only — schedule = model, όχι view).

## 5. Tests

`bim/visibility/__tests__/structural-component-visibility.test.ts` — precedence (element>view>default),
per-view flags, «μόνο οπλισμός» combo, legacy alias parity. 11/11 GREEN.

## Changelog
- 2026-06-17 (Opus) — ADR created. Slices 0-4 IMPLEMENTED, UNCOMMITTED. 🔴 tsc + browser-verify + commit.
