# ADR-571 — DXF Viewer Cyan / Construction Color SSoT (κεντροποίηση διάσπαρτων κυανών)

> **Status:** ✅ 🟢 IMPLEMENTED (UNCOMMITTED) — 2026-07-04 (βλ. §7 changelog)
> **Date:** 2026-07-04
> **Subapp:** `src/subapps/dxf-viewer` (https://nestorconstruct.gr/dxf/viewer)
> **Author:** Giorgio + agent
> **Related:** ADR-189 (Construction Grid & Guide colors), ADR-397 (rotation snappable grip cyan),
> ADR-408 (MEP connectors & systems — MEP palettes), ADR-413 (PBR material catalog), ADR-422 (thermal
> space overlay), ADR-515 (Snap Marker Visual SSoT), ADR-362 (DIMSTYLE — «μην hardcode-άρεις cyan»
> guardrail), N.11 (i18n/anti-hardcoding), N.12 (SSoT ratchet)

---

## 1. Πλαίσιο / Problem Statement

Ο Giorgio ζήτησε **βαθιά διερεύνηση όλων των κυανών (cyan/teal) χρωμάτων** σε **γραμμές & κείμενα**
στην υποεφαρμογή DXF Viewer, με το ερώτημα: **«ο κώδικας είναι διάσπαρτος ή κεντροποιημένος;»**.

Audit (3 Explore agents) → **πόρισμα**:
- **Πυρήνας render = ήδη κεντροποιημένος & σωστά wired** μέσω SSoT.
- **Περίμετρος = διάσπαρτη**: κυανές/teal **ΓΡΑΜΜΕΣ** hardcoded ως inline literals σε MEP renderers/ghosts,
  tool previews, guides duplicate, + drifted/dead διπλότυπα.
- **Κυανά ΚΕΙΜΕΝΑ = ήδη 100% κεντροποιημένα** (listening-dim `#29B6F6`, BIM snap labels) — μηδέν hardcode.

Απόφαση Giorgio: **πλήρης κεντροποίηση, συμπεριλαμβανομένων των MEP palettes** + αυτό το ADR.

### 1.1 Τι ήταν ΗΔΗ SSoT (καμία αλλαγή — τεκμηρίωση)

| Μηχανισμός | SSoT | Τιμή |
|---|---|---|
| Grip «snappable» (rotation) | `config/color-config.ts` `GRIP_SNAPPABLE_COLOR` (ADR-397) | `#00BCD4` |
| Guide X-άξονα | `config/color-config.ts` `UI_COLORS_BASE.GUIDE_X` (ADR-189) | `#00BCD4` |
| Snap markers 2D/3D | `SNAP_MARKER_COLORS` → `snap-visual-config.ts` → `snap-marker-core.ts` (ADR-515) | `#00e5ff` |
| Ghost previews | `rendering/ghost/index.ts` `GHOST_DEFAULTS.color` | `#00BFFF` |
| Focus outline (a11y) | `accessibility/bim-a11y-color-tokens.ts` | `#00ffff` |
| Cyan **κείμενα** | `overlay-line-style.ts` `listeningDim` + snap resolver | `#29B6F6` / `#00e5ff` |
| ACI 4 (industry cyan) | `settings/standards/aci.ts` `ACI_PALETTE[4]` | `#00FFFF` |

---

## 2. Απόφαση

Νέα ενότητα **«CONSTRUCTION / MEP / TOOL CYAN SSoT»** στο `config/color-config.ts`: ΕΝΑ named const ανά
**σημασιολογικό** κυανό/teal, **ΜΙΑ αναπαράσταση (μόνο hex)**. Όλοι οι consumers κάνουν `import` — **μηδέν
inline cyan/teal literal** στις στοχευμένες περιοχές (εκτός color-config & του ACI palette SSoT).

| Const (hex μόνο) | Τιμή | Σημασία / consumers |
|---|---|---|
| `MEP_WATER_COLOR` | `#0891b2` | plumbing/νερό stroke **+ equipment fill**: pipe ghost, manifold, water-proposal, 3D material, `MEP_SYSTEM_PALETTE[5]` |
| `MEP_WATER_GHOST_FILL` | `#22d3ee` | ανοιχτό κυανό — ghost/proposal fill (segment ghost, cold-water) |
| `MEP_TEAL_COLOR` | `#0d9488` | electrical panel + thermal + HVAC return-air (stroke **& fill**), `MEP_SYSTEM_PALETTE[10]` |
| `TOOL_ANCHOR_CYAN` | `#00E5FF` | beam-anchor highlight (stroke **& fill**), wall-split cut, 3D wire-waypoint hover |
| `LASSO_STROKE_CYAN` | `#0e7490` | freehand lasso path/ring/dot |
| `GIZMO_ENDPOINT_TEAL` | `#16b8c0` | 3D gizmo endpoint control ring |

Guide-X dedup: `systems/guides/guide-types.ts` `GUIDE_COLORS.X` + palette → `UI_COLORS_BASE.GUIDE_X`.
Construction layer default cyan → `ACI_PALETTE[4]`.

### 2.1 ΚΑΝΕΝΑ νέο helper / rgb-tuple — reuse υπαρχόντων SSoT (μηδέν διπλότυπο)

Τα translucent fills & τα 3D numerics **παράγονται** από το ΜΟΝΑΔΙΚΟ hex, μέσω **υπαρχόντων** SSoT
(δεν φτιάχτηκε νέος μετατροπέας, δεν αποθηκεύεται δεύτερη rgb αναπαράσταση):

- **hex → `rgba(...)`**: `hexToRgba(hex, alpha)` στο **`config/color-math.ts`** (reuse `parseHex`+`rgbaString`, ADR-509).
- **hex → 24-bit int (Three.js)**: `hexToTrueColor(hex)` στο **`utils/dxf-true-color.ts`** (documented bidirectional SSoT).

**Ενοποίηση προϋπαρχόντων διπλότυπων** (Boy-Scout, N.0.2 — δεν τα δημιούργησα εγώ):
- `bim/mep-systems/mep-system-color.ts` `hexToRgba` → delegate στο `color-math`· `hexToThreeInt` → delegate στο `hexToTrueColor` (κρατά null contract).
- `bim/utils/bim-vg-fill-tint.ts` `hexToRgba` → reuse `parseHex`+`rgbaString`.
- `bim/mep-manifolds/mep-manifold-symbol.ts`: το `ManifoldPalette.fillRgb` (ήταν πάντα = rgb του `strokeHex`) **αφαιρέθηκε**· consumers κάνουν `hexToRgba(strokeHex, alpha)`.

**Καμία οπτική αλλαγή** — όλες οι τιμές αμετάβλητες (καθαρό SSoT refactor).

---

## 3. Consumers που άλλαξαν (import αντί για literal)

- **MEP water** (`#0891b2`): `bim/mep-segments/MepSegmentGhostRenderer.ts`, `bim/mep-manifolds/mep-manifold-symbol.ts`,
  `components/dxf-layout/proposal-overlays/use-water-proposal-painter.ts`, `bim/materials/material-catalog-defs.ts`
  (numeric), `bim/mep-systems/mep-system-color.ts`.
- **MEP teal** (`#0d9488`): `bim/electrical-panels/ElectricalPanelGhostRenderer.ts`, `bim/renderers/ElectricalPanelRenderer.ts`,
  `bim/renderers/ThermalSpaceRenderer.ts`, `bim/mep-systems/mep-system-color.ts` (return-air).
- **Tool/preview** (`#00E5FF`/`#0e7490`/`#16b8c0`): `hooks/tools/useBeamBetweenMembersPreview.ts`,
  `hooks/tools/useWallSplitKnifePreview.ts`, `bim-3d/animation/WireWaypointHandles3D.ts`,
  `bim-3d/gizmo/gizmo-constants.ts`, `components/dxf-layout/LassoFreehandPreviewSubscriber.tsx`,
  `hooks/useConstructionLayerScaffold.tsx`.
- **Guides**: `systems/guides/guide-types.ts`.

---

## 4. Σκόπιμες ΜΗ-ενοποιήσεις (intentional — flagged για μελλοντική απόφαση)

Τα παρακάτω ΔΕΝ έγιναν derive (θα ήταν ξεχωριστό «ACI palette SSoT» refactor με ρίσκο)· πήραν **cross-ref
comment** στον canonical SSoT αντ' αυτού:

- **3 παράλληλοι ACI πίνακες**: `types/dxf-export.types.ts` (**export contract** προς Python ezdxf — frozen),
  `ui/text-templates/preview/dxf-color-to-css.ts` (σκόπιμα minimal preview table),
  `ui/text-toolbar/controls/aci-palette.ts` (RGB-tuple ramp για nearest-color picker). Canonical =
  `settings/standards/aci.ts` `ACI_PALETTE`.
- **`settings/io/migrationRegistry.ts`** `warm='#00FFFF'`: **ιστορικό pre-v7 default** αυτού του migration
  step — σκόπιμα frozen (ΟΧΙ drift προς το σημερινό `GRIP_WARM_COLOR '#FF7F00'`). Comment added.
- **`theme/tokens.color.css`** `--bim-focus-outline`: CSS-side mirror του TS a11y SSoT — comment added.

> Αν ο Giorgio θελήσει πλήρη ενοποίηση των ACI πινάκων, ανοίγει ξεχωριστό ADR («ACI palette SSoT»).

---

## 5. Κανόνας (going forward)

**Μην hardcode-άρεις cyan/teal literal** σε renderers/ghosts/tool-previews. Import από `config/color-config.ts`
(construction/MEP/tool) ή `settings/standards/aci.ts` (ACI index). Πρβλ. guardrail `dim-style-templates.ts`
(ADR-362): μην hardcode-άρεις cyan ως default dimension text color.

---

## 6. Verification

- ✅ **jest**: `mep-manifold-symbol.test.ts`, `material-catalog-defs.test.ts`, `dxf-color-to-css.test.ts`,
  `resolve-entity-style.test.ts` → 48/48 passed (τιμές αμετάβλητες, imports resolve).
- ✅ **grep proof**: μηδέν inline cyan/teal literal στις στοχευμένες περιοχές εκτός `color-config.ts`
  (debug namespace & documented ACI tables εξαιρούνται).
- ⏳ **Οπτικός έλεγχος**: pipe/panel/thermal/beam-anchor/wall-cut/lasso/gizmo/manifold — ίδια εμφάνιση.

---

## 7. Changelog

- **2026-07-04** — Δημιουργία ADR. Κεντροποίηση σε νέο CYAN/MEP/TOOL SSoT block (μόνο hex) στο
  `color-config.ts`, guide-X dedup, cross-ref comments στους ACI/migration/CSS.
- **2026-07-04 (rev.2 — μετά από έλεγχο Giorgio)** — Αφαιρέθηκε διπλότυπο helper `hexToThreeColor` & όλα
  τα `*_FILL_RGB` tuples· fills/numerics παράγονται πλέον από το hex μέσω **υπαρχόντων** SSoT
  (`color-math.hexToRgba`, `dxf-true-color.hexToTrueColor`). Ενοποιήθηκαν και τα προϋπάρχοντα διπλότυπα
  (`hexToRgba` ×2, `hexToThreeInt`, `ManifoldPalette.fillRgb`). **104/104 jest pass**.
  Status: IMPLEMENTED (UNCOMMITTED).
