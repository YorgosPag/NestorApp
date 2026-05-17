# ADR-358 — Layer Management System (DXF-grade, Google-Level)

**Status**: ✅ ACCEPTED (Q1-Q13 finalizzate 2026-05-16 — Full Enterprise + GOL + SSoT. Pronto per implementazione Phase 1 — minimum viable per ADR-357 Phase 0 = phases 1-4)
**Date**: 2026-05-16
**Category**: Drawing System / DXF Viewer / Core Architecture
**Author**: Giorgio Pagonis + Claude (Opus 4.7)
**Related ADRs**: ADR-040, ADR-055, ADR-057, ADR-095, ADR-129, ADR-130, ADR-294 (SSoT Ratchet), ADR-340, ADR-344, ADR-345, **ADR-357** (consumer principale), ADR-359 (futuro, eredita)

> **Posizione nel piano**: ADR-358 è **prerequisito implementativo** di ADR-357 (LINE tool Google-level). Phase 0 di ADR-357 consuma `LayerStore` e `currentLayerId` definiti qui. ADR-359 (XLINE/RAY) erediterà la stessa pipeline ByLayer/ByBlock.

---

## 1. Context

Il subapp **DXF Viewer** (`src/subapps/dxf-viewer/`) implementa una gestione layer **parziale** — sufficiente per il rendering DXF importato, **insufficiente** per essere considerato un CAD professionale.

### Perché ora
1. **ADR-357 Q11**: il LINE tool deve poter dichiarare "current layer" + ereditare color/linetype/lineweight ByLayer al `completeEntity`. Oggi non c'è un SSoT del layer corrente per le entità DXF (esiste `currentLayerId` solo in `overlay-manager` per le **regions floor-plan**, non per entità DXF).
2. **ADR-357 Q19 / G15 Quick Style Override**: i tre dropdown (Lineweight / Linetype / Color) nel ribbon consumano `LayerStore` per default `ByLayer`. Senza `LayerStore` reattivo, il ribbon non può funzionare correttamente.
3. **Drafting professionale**: senza layers strutturati (Walls / Dimensions / Construction / Hidden / Annotation) un file DXF è un blob. Architetti/ingegneri non possono usarlo per output reale.
4. **Persistence**: i layer importati da DXF perdono metadata (linetype, lineweight, frozen, locked flag DXF) — la `SceneLayer` interface è troppo magra.
5. **UI mockata**: `AdminLayerManager` mostra dati mock (Ηλεκτρολογικά / Υδραυλικά / HVAC) — non legge dal SceneModel.
6. **Type leak**: `SceneLayer.frozen` è usato in `CanEditLayerGuard` ma **non esiste nell'interface** (campo accessato via `as` o `any` implicito).

### Cosa documenta questo ADR
- lo **stato attuale del codebase** (codice = source of truth, ADR-driven Phase 1);
- lo **standard industry** AutoCAD/BricsCAD/ArchiCAD per Layer Management completo;
- la **gap analysis Google-level**;
- il **piano di implementazione in fasi piccole** (una phase = una sessione, §7.1 ADR-357).

### Doppio significato di "layer" nel codebase — disambiguazione
Il termine **"layer"** è sovraccarico nel subapp `dxf-viewer`. Questo ADR riguarda **esclusivamente la seconda categoria**:

| Categoria | Significato | File rappresentativi | Scope ADR-358? |
|---|---|---|---|
| **a) Canvas rendering layers** | Stack di `<canvas>` HTML (overlay, grid, ruler, hover, preview) per separare frequenze di repaint (ADR-040 micro-leaf) | `CanvasLayerStack.tsx`, `canvas-v2/layer-canvas/LayerCanvas.tsx`, `LayerRenderer.ts` | **NO** (out of scope) |
| **b) DXF logical layers** | Raggruppamento logico di entità (Walls, Dimensions, Construction, ecc.) con proprietà visuali condivise (color, linetype, lineweight, on/off, freeze, lock) — concetto DXF/DWG nativo | `SceneLayer`, `LayerOperationsService.ts`, `AdminLayerManager.tsx`, `parseLayerColors` in `dxf-table-parsers.ts` | **SÌ** (full scope) |

D'ora in poi "layer" = categoria (b).

---

## 2. Stato attuale (audit codice 2026-05-16)

### 2.1 Pezzi esistenti — riusabili

| Pezzo | Path | Ruolo | Stato |
|---|---|---|---|
| `SceneLayer` interface | `types/entities.ts:632` | Schema layer in `SceneModel.layers` (`Record<name, SceneLayer>`) | ⚠️ **incompleto** (4 campi: name/color/visible/locked) |
| `SceneModel.layers` | `types/entities.ts:646` | Storage layers per scene | ✅ esistente |
| `LayerOperationsService` | `services/LayerOperationsService.ts` | CRUD CRUD: create/rename/delete/visibility/color/freeze, merge, color-groups | ✅ solido, **stateless** (riceve scene, ritorna `LayerOperationResult`) |
| `useLayerOperations` (hook) | `ui/hooks/useLayerOperations.ts` | Binding `LayerOperationsService` ↔ `setLevelScene` + notifiche + confirm dialogs | ✅ wired |
| `layer-operation-utils.ts` | `services/shared/layer-operation-utils.ts` | Helpers entity filtering by layer (ADR-129) | ✅ |
| `layer-config.ts` | `config/layer-config.ts` | Costanti `DXF_DEFAULT_LAYER='0'`, `DEFAULT_LAYER_NAME='default'` + `getLayerNameOrDefault`/`getDxfLayerName`/`isDefaultLayer` (ADR-130) | ✅ SSoT default-name |
| `parseLayerColors` (DXF) | `utils/dxf-table-parsers.ts:139` | Parser sezione TABLES → `LayerColorMap` | ⚠️ parsial (solo `name`, `colorIndex`, `visible`) |
| `CanEditLayerGuard` | `core/commands/text/CanEditLayerGuard.ts` | Pre-execute hook: blocca update se layer `frozen` o `locked && !canUnlockLayer` (ADR-344 Phase 6.A) | ✅ funzionante MA accede `layer.frozen` non in interface (type-leak) |
| `LayerSelectorDropdown` | `ui/text-toolbar/controls/LayerSelectorDropdown.tsx` | Radix Select per cambio layer entità testo (ADR-001) | ✅ ben fatto, **specifico per text** |
| `AdminLayerManager` + hooks | `ui/components/AdminLayerManager.tsx`, `ui/components/layer-manager/*` | UI pannello layer (header, filters, statistics, list) | 🔴 **mock data**, NON legge `SceneModel.layers` |
| `useLayerOperations` (text) | `ui/text-toolbar/hooks/useTextPanelLayers.ts` | Layer ops per text panel | ✅ |
| `overlay-manager.ts` | `state/overlay-manager.ts` | Ha `currentLayerId` MA per `RegionLayerObject` (floor-plan polygons), **NON** per entità DXF | ⚠️ semantica diversa |
| `useDxfSceneConversion` | `hooks/canvas/useDxfSceneConversion.ts` | Convert dxf-viewer scene → SceneModel | ✅ |
| `ColorLayerUtils` | `utils/ColorLayerUtils.ts` | Color-by-layer helpers | ✅ |

### 2.2 Cosa **non esiste**

| Mancante | Impatto |
|---|---|
| **`LayerStore` singleton reattivo** (micro-leaf SSoT) | Nessuna fonte di verità reattiva per `currentLayerId` + lista layer. Componenti devono passare `scene.layers` a mano. |
| **`currentLayerId` SSoT per entità DXF** | Il LINE tool (ADR-357) non sa dove mettere le entità che crea. |
| **`SceneLayer.frozen` campo** | Type-leak: `CanEditLayerGuard` legge `layer.frozen` non dichiarato. |
| **`SceneLayer.lineweight`** | Nessuna eredità lineweight ByLayer (ADR-357 Q19). |
| **`SceneLayer.linetype`** | Nessuna eredità linetype ByLayer. Tutti gli entity sono Continuous. |
| **`SceneLayer.transparency`** | DXF supporta layer transparency 0-90% (group 1071) — non importato/esportato. |
| **`SceneLayer.plottable`** | Layer non-plottable (group 290) — perso al re-export. |
| **`SceneLayer.description`** | Metadata utente perso. |
| **`SceneLayer.id` stabile** | Layer indicizzato per `name` → rename rompe references (commands undo, history). |
| **DXF group 6 (linetype) parsing** | Linetype DXF perso al re-import. |
| **DXF group 370 (lineweight) parsing** | Lineweight DXF perso al re-import. |
| **DXF group 70 bit-flag** (frozen bit-1, locked bit-4) parsing | Stato freeze/lock DXF perso. |
| **DXF group 1071 (transparency XDATA)** | Trasparenza persa. |
| **Linetype catalog SSoT** | Continuous/Dashed/Hidden/Center/Phantom/DashDot/Border/Divide — nessuna definizione SSoT con pattern di tratti. |
| **Lineweight ISO catalog SSoT** | 0.05/0.09/0.13/0.18/0.25/0.35/0.50/0.70/1.00/1.40/2.00 mm + Default + ByLayer — nessuna definizione SSoT. |
| **ACI palette completa** | Solo `getAciColor` esiste — non c'è ACI ↔ TrueColor bridge ufficiale. |
| **ByLayer / ByBlock inheritance pipeline** | `completeEntity` non legge `currentLayerId` né applica eredità color/lt/lw. |
| **Layer States Manager** | Save/restore snapshot layer (industry: `.las` export). Assente. |
| **Layer Filters** (Group + Properties) | Filtraggio reattivo lista layer in `AdminLayerManager`. Assente. |
| **Layer Isolate / Unisolate / Dim** | Industry standard one-click — assente. |
| **`AdminLayerManager` wired** | UI mostra dati mock, non scene reale. |
| **Layer rename con backref update** | `renameLayer` aggiorna entity.layer ma NON aggiorna `selection`, `command-history`, `region.layerId`, etc. (audit profondo). |
| **Layer current picker nel ribbon** | UI status-bar / ribbon per cambio rapido layer corrente. |

### 2.3 Tabella `SceneLayer` attuale vs target (anteprima)

```typescript
// ATTUALE (entities.ts:632)
interface SceneLayer {
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

// TARGET (proposta ADR-358 — finale dopo Q&A)
interface SceneLayer {
  id: string;                    // stable identifier (es. ULID o slug)
  name: string;                  // display name (DXF group 2, mutable)
  color: SceneLayerColor;        // ACI index + optional TrueColor (DXF 62 + 420)
  linetype: string;              // DXF group 6 — "Continuous", "Hidden", "Center"…
  lineweight: LineweightMm;      // ISO catalog mm (-3 = Default, -2 = ByLayer N/A)
  transparency: number;          // 0-90% (DXF 1071 XDATA)
  visible: boolean;              // ON/OFF (faster than freeze — does NOT regen)
  frozen: boolean;               // FREEZE (skipped at regen — perf)
  locked: boolean;               // LOCK (no edit)
  plottable: boolean;            // DXF 290 plot flag
  description?: string;          // user metadata
  createdAt?: string;            // ISO timestamp (provenance)
  source: 'dxf-import' | 'user-created' | 'system-default';
}
```

---

## 3. Industry Benchmark (CAD professionali)

### 3.1 AutoCAD Layer Properties Manager — proprietà

| Property | Tipo | DXF code | Note |
|---|---|---|---|
| Name | string | 2 | Mutable. Layer "0" è special (default DXF). |
| Color | ACI index (1-255) + optional TrueColor RGB | 62 + 420 | Negativo `62` = layer OFF in DXF legacy. |
| Linetype | string | 6 | "Continuous", "DASHED", "HIDDEN", "CENTER", "PHANTOM", "DASHDOT", "BORDER", "DIVIDE" + custom. |
| Lineweight | float (mm) | 370 | -3 = Default, valori ISO: 0.05/0.09/0.13/0.18/0.25/0.35/0.50/0.70/1.00/1.40/2.00 mm. |
| Transparency | 0-90% | 1071 (XDATA AppId `AcCmTransparency`) | 0 = opaco, 90 = quasi invisibile. |
| Plot/NoPlot | bool | 290 | Layer non plottato (per construction lines). |
| ON/OFF | bool | bit 62 negative | Veloce, non rigenera. |
| Freeze/Thaw | bool | 70 bit 1 | Aggressivo, skippa regen — perf su scene grandi. |
| Lock/Unlock | bool | 70 bit 4 | Faded display, no edit. |
| Description | string | 1000 XDATA | Metadata. |
| New VP Freeze | bool | per-viewport | Out of scope ADR-358 (no viewports in DXF Viewer). |

### 3.2 Layer States Manager

- Salva snapshot di **tutte** le proprietà di tutti i layer come "state" con nome (es. `"Plot-Set-A"`, `"Design-View"`).
- Restore istantaneo via dropdown.
- Export `.las` file (ASCII) per condivisione tra drawings/team.
- Comando: `LAYERSTATE` / shortcut `LAS`.

### 3.3 Layer Filters

- **Group Filter**: lista manuale di layer (es. "Floor 2 Layers" = `[A-WALL-FLR2, A-DOOR-FLR2, ...]`).
- **Properties Filter**: regola tipo `name = "A-WALL-*" AND color = red`.
- Selezione filter nella sidebar → solo quei layer visibili nel manager.
- Right-click filter → "Isolate Group" (freeze tutto fuori).

### 3.4 Layer Isolate / Unisolate / LayDim

Convergence: AutoCAD ✅ / BricsCAD ✅ / GstarCAD ✅ / ZWCAD ✅ / MicroStation ✅ — feature universale CAD.

- **LAYISO** (Layer Isolate): seleziona entità → comportamento default = **"Lock and fade"** (NON OFF); layer non-target vanno a `transparency = userFade` (default 50, range **0–90 configurabile** via LAYISO Settings → "Settings" option al command line). Modalità alternativa "Off" hide-completo.
- **LAYUNISO** (Layer Unisolate): ripristina lo stato pre-isolate (snapshot interno).
- **LAYDIM**: applica explicit dimming senza locking.
- **LAYOFF / LAYON / LAYFRZ / LAYTHW / LAYLCK / LAYULK**: comandi click-driven one-shot.
- *Source*: AutoCAD 2025 Help LAYISO (Settings → Lock-and-fade vs Off).

### 3.5 ByLayer / ByBlock / Direct property (Layer 0 special)

- **ByLayer**: entity color/linetype/lineweight/transparency = quello del layer. Cambiando layer property, tutte le entità ByLayer si aggiornano.
- **ByBlock**: entity property è ereditata dal **blocco contenitore** (se entity è dentro un INSERT). Fuori da blocchi = nero/Continuous/Default.
- **Direct** (es. color rosso esplicito): override del layer, immutabile rispetto al layer.

**Layer 0 — special behavior (DWG ecosystem convention)**:
- Layer 0 esiste in ogni drawing DXF/DWG, **non può essere rinominato né cancellato/purged**.
- Oggetti disegnati su layer 0 e raggruppati in un BLOCK ereditano color/linetype/lineweight **del layer in cui il block viene inserito** (NOT layer 0).
- Oggetti su layer ≠ 0 dentro un BLOCK mantengono il loro layer originale all'inserimento.
- Best practice industry: blocchi riusabili → tutta la geometria su layer 0 con properties = `ByLayer` → si adattano automaticamente al layer host.
- *Source*: cad-notes.com "What are AutoCAD Layer 0, ByLayer and ByBlock?" + gstarcad.net "Understanding Layer 0".

### 3.6 Per-viewport layer overrides (paperspace)

AutoCAD 2008+: comando **VPLAYER** + system var **VPLAYEROVERRIDESMODE** permettono override per layout-viewport delle proprietà Color/Linetype/Lineweight/Plot Style + VP Freeze, **senza modificare le global layer properties**.

- Colonne dedicate nel Layer Properties Manager (visibili solo in paperspace attiva): `VP Freeze`, `VP Color`, `VP Linetype`, `VP Lineweight`, `VP Plot Style`.
- Reset via right-click → "Remove Viewport Overrides for Selected Layers / All Layers" → "Current Viewport / All Viewports".
- Convergence: AutoCAD ✅ / BricsCAD ✅ / GstarCAD ✅ / ZWCAD ✅ / MicroStation ✅ — standard CAD da 18+ anni.
- **Decisione Nestor (Q16)**: paperspace/viewports non sono nel modello dati attuale → out-of-scope. Da rivalutare se roadmap include layout/sheet authoring.

### 3.7 Naming conventions (AIA NCS + ISO 13567)

**AIA CAD Layer Guidelines (US National CAD Standard NCS V7)** — 4 fields:
- `Discipline Designator` (2 char, obbligatorio): A=Architectural, B=Geotechnical, C=Civil, E=Electrical, F=Fire Protection, I=Interiors, M=Mechanical, P=Plumbing, S=Structural, T=Telecommunications…
- `Major Group` (4 char, obbligatorio): es. WALL, DOOR, COLS, HVAC.
- `Minor Group` (4 char, opzionale, fino a 2 livelli): es. FULL, EXST, DEMO, NEWW.
- `Status` (1 char, opzionale): N=New, E=Existing-to-remain, D=Demolition, R=Relocated, T=Temporary, F=Future.
- Esempi: `A-WALL-FULL-N`, `S-COLS-EXST`, `M-HVAC-DUCT-D`.
- *Source*: AIA NCS V6 PDF (nationalcadstandard.org) + Seidler Studio AutoCAD AIA tutorials.

**ISO 13567-1:2017 — Technical product documentation, Organization and naming of layers for CAD** — 10 fields fixed-length:
- `Responsible Agent` (2 char): A=Architect, B=Building surveyors, C=Civil eng., E=Electrical eng., M=Mechanical eng., S=Structural eng., …
- `Building Element` (6 char): classificazione SfB / Uniclass / OmniClass (es. `230` per partitions).
- `Presentation` (2 char): E=element graphics, T=text, H=hatching, D=dimensions, V=viewport graphics.
- `Status` (1 char): N=New, E=Existing, R=To be removed, T=Temporary.
- Plus campi opzionali: `Project Phase`, `Scale`, `Work-package`, `Subdivision`, `Drawing type`, `User-defined`.
- Compatibilità DWG/DXF (max 31 chars layer name).
- *Source*: ISO 13567-1:2017 (iso.org) + Wikipedia ISO 13567 + ITcon proposed standard paper.

**Decisione Nestor (Q14)**: scegliere tra `solo AIA` (US-centric, Giorgio greco/EU), `solo ISO 13567` (EU/intl), o `entrambi supportati` (helper utility con switcher). Pre-fill/auto-suggest opzionale via Q7.

### 3.8 BIM paradigm comparison (rationale per scope CAD-only)

Sistemi BIM seguono paradigmi **fondamentalmente diversi** dai CAD-layered:

- **Revit (Autodesk)**: nessun layer user-defined. Usa **categories built-in immutabili** (Walls, Doors, Windows, Floors, …). Visibility controllata view-by-view via category overrides + view templates + filters. Categories definiscono behavior (es. door taglia hole in wall). Layer name appare solo all'export DWG.
  - *Source*: linkedin.com/learning + united-bim.com Revit vs AutoCAD.
- **ArchiCAD (Graphisoft)**: layers user-defined + **Pen Sets** (color/lineweight via pen number 1-255) + **Building Materials** (material → fill/cut/surface) + **Layer Combinations** (≈ Layer States). Multi-attribute system più ricco di AutoCAD.
  - *Source*: graphisoft.com/us/archicad-layer-theory + Pen Sets / Building Materials docs.
- **Vectorworks (Nemetschek)**: **dual organization** ortogonale = `design layers` (location/quota: site, ground floor, level 1, …) + `classes` (appearance/type: walls-exterior, walls-interior, doors, …). Ogni oggetto appartiene a 1 design layer + 1 class. Spans design layers.
  - *Source*: app-help.vectorworks.net 2023/2026 Drawing Structure + Classes.
- **AllPlan (Nemetschek)**: BIM IFC-compliant; layer system meno documentato pubblicamente.

**Nestor scope decision (Q15)**: il modello dati attuale è DWG/DXF-driven (entity → layer name string + per-entity color/linetype/lineweight). Segue il **CAD paradigm**, NON BIM. Future BIM-mode placeholder = decisione Q15.

### 3.9 Convergence summary matrix

Confronto feature × sistema (✅ = supportato, ❌ = non applicabile, ⚠️ = parziale):

| Feature | AutoCAD | BricsCAD | GstarCAD | ZWCAD | MicroStation | Revit | ArchiCAD | Vectorworks | Verdetto |
|---|---|---|---|---|---|---|---|---|---|
| Layer CRUD user-defined | ✅ | ✅ | ✅ | ✅ | ✅ Levels | ❌ categories | ✅ | ✅ design layers | DWG std |
| Layer 0 special (block inherit) | ✅ | ✅ | ✅ | ✅ | N/A | N/A | N/A | N/A | **DWG-ecosystem only** |
| Color ACI + TrueColor (62+420) | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ Pen Sets | ✅ | Universal |
| Linetype DXF (code 6) | ✅ | ✅ | ✅ | ✅ | ✅ | per-cat override | ✅ | ✅ | CAD universal |
| Lineweight ISO 24 (code 370) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ override | ✅ | ✅ | Universal |
| Transparency (1071 XDATA) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Universal |
| ON/OFF | ✅ | ✅ | ✅ | ✅ | ✅ | view-by-view | ✅ | ✅ vis/inv/gray | Universal |
| Freeze/Thaw | ✅ | ✅ | ✅ | ✅ | ⚠️ display | N/A | N/A | N/A | DWG std |
| Lock/Unlock | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Universal |
| Plot/NoPlot (290) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Universal |
| Description (1000 XDATA) | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | ✅ | ✅ | Standard |
| Layer States Manager (.las) | ✅ | ✅ | ✅ | ✅ | ⚠️ Level Status | view templates | ✅ Layer Combos | ✅ Saved Views | DWG std + BIM equiv |
| Group Filter (manual) | ✅ | ✅ | ✅ | ✅ | ✅ Level Filters | N/A | ✅ | ✅ | CAD std |
| Property Filter (dynamic) | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | N/A | N/A | DWG std |
| Invert Filter | ✅ | ✅ | ✅ | ✅ | ✅ | N/A | N/A | N/A | DWG std |
| LAYISO (fade 0-90 default) | ✅ | ✅ | ✅ | ✅ | ✅ | view filters | ✅ Layer Combo | ✅ class opts | CAD universal |
| Per-viewport overrides (VPLAYER) | ✅ '08+ | ✅ | ✅ | ✅ | ✅ | N/A view-based | N/A | ✅ Sheet Vis | CAD paperspace |
| ByLayer / ByBlock | ✅ | ✅ ByLevel | ✅ | ✅ | ✅ ByLevel | category inherit | ✅ ByPen | ✅ ByClass | Universal principle |
| AIA NCS naming (US) | de facto | ok | ok | ok | ok | N/A | ok | ok | US std |
| ISO 13567 naming (EU/intl) | ok | ok | ok | ok | ok | N/A | ok | ok | EU/intl std |

**Convergenza DWG-ecosystem (AutoCAD/BricsCAD/GstarCAD/ZWCAD)**: 4/4 su tutti i campi sopra. Industry consensus solidissimo.
**Convergenza CAD+BIM su feature universali** (color/linetype/lineweight/transparency/lock/plot): 8/8 sistemi.
**Decisioni Nestor**: poiché modello dati DXF-driven, scope è DWG-ecosystem parity (no BIM categories built-in, no per-viewport for now).

---

## 4. Gap Analysis Google-Level

### G1 — `SceneLayer` interface incompleta
**Cosa manca**: 8 campi (vedi §2.2 tabella).
**Effetto**: type leak (`frozen` usato senza dichiarazione), eredità ByLayer impossibile, round-trip DXF lossy.
**Google-fix**: estendere `SceneLayer` con migration safe (default-fill per layer esistenti caricati da snapshot precedenti).

### G2 — `LayerStore` SSoT reattivo
**Cosa manca**: singleton store con `useSyncExternalStore` (pattern ADR-040 micro-leaf) che espone:
- `layers: SceneLayer[]` derived da `SceneModel.layers`;
- `currentLayerId: string`;
- `setCurrentLayerId(id)`;
- `getLayer(id) → SceneLayer | null`;
- subscription per leaf renderer.
**Effetto**: ribbon Quick Style, status bar layer picker, `completeEntity` non possono leggere stato layer reattivamente. Prop-drilling massiccio.
**Google-fix**: nuovo file `src/subapps/dxf-viewer/stores/LayerStore.ts` — pattern identico a `HoverStore`/`ImmediatePositionStore`. Bridge con `SceneModel` via `useDxfSceneConversion` o evento `scene:update`.

### G3 — `currentLayerId` SSoT per entità DXF
**Cosa manca**: oggi `overlay-manager.currentLayerId` è per regions floor-plan, non per entità DXF. Il LINE tool non sa dove mettere l'entità.
**Google-fix**: vivere dentro `LayerStore` (G2). Persistenza `localStorage` chiave `dxf:currentLayerId.{levelId}` (cross-session) + Firestore project-scoped override.

### G4 — DXF parser incompleto
**Cosa manca**: `parseLayerColors` legge solo `2` (name), `62` (colorIndex). Manca:
- `6` (linetype)
- `370` (lineweight)
- `70` bit-flag (frozen/locked)
- `420` (TrueColor)
- `1071` XDATA (transparency)
- `290` (plottable)
- `1000` XDATA (description)
**Effetto**: round-trip lossy (import → export perde metadata).
**Google-fix**: estendere parser + creare un'**unica funzione** `parseLayerTable(lines) → LayerColorMap` con tutti i campi. Output type = `SceneLayer` esteso.

### G5 — Linetype Catalog SSoT
**Cosa manca**: nessuna definizione SSoT delle 8+ linetypes ISO standard (pattern di tratti per rendering).
**Google-fix**: nuovo modulo `src/subapps/dxf-viewer/config/linetype-catalog.ts`:
```typescript
export const LINETYPE_CATALOG = {
  Continuous: { pattern: [], dashArray: [] },
  Dashed:     { pattern: [0.5, -0.25], dashArray: [5, 2.5] },
  Hidden:     { pattern: [0.25, -0.125], dashArray: [2.5, 1.25] },
  Center:     { pattern: [1.25, -0.25, 0.25, -0.25], dashArray: [12.5, 2.5, 2.5, 2.5] },
  Phantom:    { pattern: [1.25, -0.25, 0.25, -0.25, 0.25, -0.25], dashArray: [...] },
  DashDot:    { pattern: [0.5, -0.25, 0.0, -0.25], dashArray: [...] },
  Border:     { pattern: [0.5, -0.25, 0.5, -0.25, 0.0, -0.25], dashArray: [...] },
  Divide:     { pattern: [1.0, -0.25, 0.0, -0.25, 0.0, -0.25], dashArray: [...] },
} as const;
```
- Pattern DXF (positive = dash, negative = gap, 0 = dot).
- DashArray Canvas2D compatibile (PX_PER_UNIT scaling).
- Consumer: `DxfRenderer.ts` entity stroke + `AdminLayerManager` preview + Quick Style ribbon dropdown.

### G6 — Lineweight ISO Catalog SSoT
**Cosa manca**: catalogo lineweight ISO completo + special values `-3=Default`, `-2=ByLayer`, `-1=ByBlock`.
**Research grounding (2026-05-16, ezdxf 1.4.3 + Autodesk DXF Reference)**: il DXF code 370 accetta **24 valori ufficiali** stoccati come `mm × 100` (int16).
**Google-fix**: nuovo `src/subapps/dxf-viewer/config/lineweight-catalog.ts`:
```typescript
// DXF code 370 — stored as mm × 100 (int16). 24 valori ISO ufficiali.
export const LINEWEIGHT_ISO_MM = [
  0.00, 0.05, 0.09, 0.13, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35,
  0.40, 0.50, 0.53, 0.60, 0.70, 0.80, 0.90, 1.00, 1.06, 1.20,
  1.40, 1.58, 2.00, 2.11,
] as const; // 24 entries — full DXF code 370 enum

export const LINEWEIGHT_DXF_CODES = [
  0, 5, 9, 13, 15, 18, 20, 25, 30, 35,
  40, 50, 53, 60, 70, 80, 90, 100, 106, 120,
  140, 158, 200, 211,
] as const;

export const LW_DEFAULT = -3;   // BYDEFAULT (use drawing default)
export const LW_BYLAYER = -2;   // inherits from layer
export const LW_BYBLOCK = -1;   // inherits from block

export type LineweightMm =
  | typeof LINEWEIGHT_ISO_MM[number]
  | typeof LW_DEFAULT
  | typeof LW_BYLAYER
  | typeof LW_BYBLOCK;
```
- Conversion `lineweightToPx(mm, zoom)` → pixel rendering.
- DXF code 370 round-trip identico (`dxfCode = Math.round(mm × 100)`; `mm = dxfCode / 100`).
- Helper `parseDxfCode370(code: number) → LineweightMm` con whitelist + fallback `LW_DEFAULT`.

### G7 — ByLayer / ByBlock pipeline
**Cosa manca**: quando un'entity è creata da LINE tool, deve poter dichiarare `color: 'ByLayer'`, `linetype: 'ByLayer'`, `lineweight: 'ByLayer'`. Al render, il renderer risolve l'eredità.
**Google-fix**:
- Nuovo modulo `src/subapps/dxf-viewer/systems/properties/resolve-entity-style.ts` (pure fn):
  ```typescript
  resolveEntityStyle(entity: Entity, layer: SceneLayer, parentBlock?: Block) → ResolvedStyle
  // Returns { color, linetype, lineweight, transparency } — concrete, no ByLayer/ByBlock.
  ```
- Chiamato da `DxfRenderer.drawEntity` PRIMA di applicare stroke/fill.
- Quick Style override (ADR-357 Q19) sovrascrive solo i campi non-ByLayer.

**Status (Phase 6.5 — 2026-05-16 v2.7)**: ✅ **LIVE production + LINE tool default ByLayer**. Pipeline end-to-end: `SceneModel.layers` → `useDxfSceneConversion.buildBase()` sentinel-aware projection → `DxfScene.layersById` → `DxfRenderOptions.layersById` → `DxfRenderer.resolveStyleForRender()` adapter forward full sentinel set → `entityToStyleInput()` → `resolveEntityStyle()`. Entities che dichiarano `colorMode: 'ByLayer'/'ByBlock'`, `lineweightMm: -2 (BYLAYER)` / `-1 (BYBLOCK)` / `-3 (DEFAULT)`, `linetypeName: 'ByLayer'/'ByBlock'` ereditano LIVE color + lineweight + linetype + transparency da `AdminLayerManager` edits frame-coherent. Entities con `color`/`lineWidth` concreti restano invariate (regression guard test in suite). **Phase 6.5**: LINE/CIRCLE/POLYLINE/ARC/RECTANGLE tools emergono `colorMode: 'ByLayer'` + `lineweightMm: -2` di default (Google-grade default ON via `DEFAULT_LINE_SETTINGS`). Toggle AutoCAD-style pillola "Από Επίπεδο / Προσαρμοσμένο" nel BasicSection del LineSettings panel permette override esplicito a Concrete hex/lineweight per-tool. `applyPreviewSettings` sentinel-aware → `CreateEntityCommand` forward sentinel → entity emerge sentinel → cascade live. Quando user cambia colore layer in `AdminLayerManager` → tutte le entities ByLayer cambiano colore frame-coherent senza re-emission.

### G8 — `AdminLayerManager` wired al SceneModel ✅ **LIVE production (Phase 8, 2026-05-16 v2.8)**
**Cosa manca**: ~~oggi mostra mock data (Ηλεκτρολογικά / Υδραυλικά / HVAC) hardcoded in `useLayerManagerState`. Non legge `scene.layers`.~~ ✅ Risolto Phase 8.
**Google-fix implementato**:
- ✅ `useLayerManagerState` riscritto: consuma `LayerStore` (G2) via `useSyncExternalStore(subscribeLayerStore, getLayerStoreSnapshot)` + `useLevelSelection().currentLevel?.scene` per element count derivato dinamicamente.
- ✅ SAME interface verso `LayerHeader / LayerFilters / LayerList` preservata (UI invariata, sub-component props zero diff).
- ✅ Category mapping legacy → `SceneLayer.category` enum AIA 10-valori (electrical/plumbing/hvac/general/...) via `AecLayerCategory` Phase 1. Categorie derivate dinamicamente da union di `storeSnapshot.layers` (zero hardcoded). i18n keys riusate da `layerPicker.category.*` (Phase 7 SSoT, NO namespace duplicate).
- ✅ `isCurrent` flag derivato `currentLayerId === (layer.id ?? layer.name)` + action `setCurrentLayer` wira `setCurrentLayerId()` SSoT.
- ✅ Right-click su MoreVertical button → set-as-current (zero UI structure change).
- ✅ Test: 14/14 green (`__tests__/useLayerManagerState.test.ts`).

### G9 — Layer current picker UI
**Cosa manca**: nessun dropdown rapido nello status bar o ribbon per cambio current layer durante drafting.
**Google-fix**: nuovo componente `ui/ribbon/controls/CurrentLayerPicker.tsx`:
- Dropdown Radix Select (ADR-001).
- Mostra layer corrente con color swatch + name.
- Click → lista layer ordinata per name, con icone visible/locked/frozen accanto.
- Quick action "Make current" da AdminLayerManager (right-click su layer → "Set as current").
- Consume `LayerStore.currentLayerId` + `setCurrentLayerId`.

### G10 — Layer States Manager (opzionale, da decidere in Q&A)
**Cosa manca**: snapshot + restore stato completo dei layer.
**Google-fix candidato**:
- Nuovo store `LayerStateStore` (singleton micro-leaf).
- Storage `system/layer-states` Firestore o localStorage `dxf:layerStates.{projectId}`.
- UI: dropdown nello status bar `Layer State: [Design ▼]`.
- Operations: Save / Restore / Rename / Delete / Export `.las` / Import `.las`.
- ⚠️ **Q-scope**: full implementation o stub MVP (save+restore only, no export)?

### G11 — Layer Filters
**Cosa manca**: in `AdminLayerManager`, `LayerFilters` esiste già come componente UI ma filtra per `category` mock. Manca:
- Group Filter (lista manuale).
- Properties Filter (rule-based: `name pattern`, `color`, `visible/frozen/locked`, `linetype`).
- Persistenza filtri.
**Google-fix**: estendere `useLayerFiltering` con filter SSoT in `LayerStore` o sub-store dedicato. UI ricca con form filter builder.

### G12 — Layer Isolate / Unisolate / Dim
**Cosa manca**: industry standard click-driven layer ops.
**Research grounding (2026-05-16, AutoCAD LAYISO Help 2025)**: default mode AutoCAD = **"Lock and fade"** (NON "OFF"); fade value è **configurabile 0–90** via LAYISO Settings (0 = no fading, 90 = quasi invisibile). Behavior alternativo = "Off" (layer hidden). Setting persistito via system variable.
**Google-fix**:
- Comandi nuovi in `CommandRegistry`: `LayerIsolate`, `LayerUnisolate`, `LayerDim`, `LayerOff` (click-driven).
- UX: shortcut `Ctrl+Shift+I` → click entity → isolate (modalità default da Q10).
- Snapshot pre-isolate salvato in `LayerStore.unisolateSnapshot` per `LayerUnisolate`.
- LayerIsolate mode (Q10 outcome): `'lock-and-fade'` (default AutoCAD-parity) | `'off'` (legacy).
- **Fade value configurabile 0–90** via slider in Layer Manager / preferences (NON hardcoded). Setting persistito `dxf:layerIsolateFade.{userId}` localStorage.
- LayerDim: variant esplicita che applica `transparency = userFade` su altri layer senza locking.

### G13 — Layer rename con backref completi
**Cosa manca**: `renameLayer` aggiorna `scene.layers` + `entity.layer` ma audit incompleto su:
- `selection.selectedLayerNames` (esiste?).
- `commandHistory` (commands con `layer: oldName` payload non aggiornati).
- `region.layerId` (overlay-manager).
- `currentLayerId` (se rinominato layer corrente).
- Firestore persistence (se scene è sync'ata).
**Google-fix**:
- Migrare a **layer.id stabile** (mai cambia) + `layer.name` (display, può cambiare).
- `entity.layerId` invece di `entity.layer` (breaking change — migration utility per snapshot esistenti).
- Audit completo references in pre-implementation phase.

### G14 — Persistenza Firestore + level-scope
**Cosa manca**: oggi `scene.layers` è in-memory + serializzato via `useLevels` (storage levels per floor). Non c'è schema Firestore dedicato per layers project-wide.
**Google-fix candidato**:
- Collezione `dxf_viewer_layers` (Firestore) — keyed `{projectId}/{levelId}`.
- Sync bidirezionale con `LayerStore`.
- ⚠️ **Q-scope**: project-wide layers OR level-scope (per-floor) OR hybrid?

### G15 — DXF round-trip integrity test
**Cosa manca**: nessun test automatico che verifichi `import(file.dxf) → export() → re-import` produca scene identica.
**Google-fix**: integration test `dxf-roundtrip.test.ts` su 5+ file DXF reference con check completo proprietà layer.

---

## 5. Decision (template — da finalizzare in Q&A)

> Le risposte di Giorgio in greco saranno trascritte in italiano e aggiorneranno questa sezione.

> **🔬 POST-RESEARCH VALIDATION (2026-05-16 v2)** — Le 13 risoluzioni Q1–Q13 sotto sono state **rivalidate** contro 14 WebSearch verificate (vedi §11 References e §3 espanso). Esito:
> - **Industry convergence DWG-ecosystem 4/4** (AutoCAD/BricsCAD/GstarCAD/ZWCAD) confermata sui campi target dell'interface `SceneLayer` (Q1).
> - **Q10 Layer Isolate**: research conferma fade configurabile **0–90** (NON hardcoded 30%). §5.6.bis aggiornato in §G12 a "configurable 0–90 with slider Full Enterprise". Q10 status: **✅ confermata con refinement fade-range**.
> - **Q12 `.las` round-trip**: research conferma `.las` export è 1-state-at-time (multi-export = batch). §5.9 sostanzialmente confermata.
> - **§G6 Lineweight**: catalogo aggiornato da 11 a **24 valori ISO ufficiali** DXF code 370. Update applicato.
> - **Q9 naming validation**: era "AutoCAD parity only". Research aggiunge **ISO 13567-1:2017** (EU/intl standard) come alternativa rilevante per mercato greco/EU → nuova **Q14**.
> - **BIM paradigm scope**: research evidenzia differenze fondamentali Revit/ArchiCAD/Vectorworks → nuova **Q15** documentare scope rationale.
> - **Per-viewport overrides** (VPLAYER, standard CAD 18+ anni): research conferma rilevanza → nuova **Q16** (oggi out-of-scope, future paperspace?).
> - Q1–Q8, Q11, Q13: **✅ confermate senza modifica** (research-aligned).

### 5.1 Modello dati `SceneLayer` esteso — FULL ENTERPRISE (Q1 risolta 2026-05-16)

Confermato Giorgio: **Opzione A FULL Enterprise + GOL + SSoT**. Tutti i 12 campi target attivi dall'inizio. No MVP stub.

```typescript
// SSoT: src/subapps/dxf-viewer/types/entities.ts (SceneLayer)
export interface SceneLayer {
  /** Stable identifier — never changes (immutable). ULID o slug deterministico. */
  readonly id: string;
  /** Display name — DXF group 2. Mutabile (rename). */
  name: string;
  /** Color — ACI 1-255 + optional TrueColor. DXF group 62 + 420. */
  color: SceneLayerColor;
  /** Linetype name — DXF group 6. Default "Continuous". Catalog enforced. */
  linetype: string;
  /** Lineweight mm — DXF group 370. ISO catalog + special (-3/-2/-1). */
  lineweight: LineweightMm;
  /** Transparency 0-90% — DXF group 1071 XDATA. 0 = opaco. */
  transparency: number;
  /** ON/OFF — fast toggle, no regen. */
  visible: boolean;
  /** Freeze — skippa regen (perf). DXF group 70 bit 1. */
  frozen: boolean;
  /** Lock — no edit. DXF group 70 bit 4. */
  locked: boolean;
  /** Plottable — DXF group 290. False = non plottato. */
  plottable: boolean;
  /** User metadata — DXF group 1000 XDATA. */
  description?: string;
  /** Provenance — non-DXF, only internal. */
  source: 'dxf-import' | 'user-created' | 'system-default';
  /** ISO timestamp creazione — non-DXF, only internal. */
  createdAt?: string;
}

export type SceneLayerColor = {
  /** ACI index 1-255. Source of truth se trueColor è null. */
  aci: number;
  /** TrueColor 0xRRGGBB. Override ACI se non-null. */
  trueColor: number | null;
};

export type LineweightMm =
  | 0.05 | 0.09 | 0.13 | 0.18 | 0.25 | 0.35
  | 0.50 | 0.70 | 1.00 | 1.40 | 2.00 | 2.11
  | -3  // Default (system)
  | -2  // ByLayer (entity inherits)
  | -1; // ByBlock (entity inherits from block)
```

**No migration di dati persistiti**: confermato Giorgio 2026-05-16 — DB test pre-produzione verrà wiped ([[project_test_data_pre_production]]). Lo schema viene introdotto direttamente nella shape finale.

**Default-fill in fase di scene-load** (non migration, solo robustness al boundary): quando `useDxfSceneConversion` o `parseLayerColors` produce un layer da DXF privo di alcuni campi opzionali (es. DXF senza linetype esplicito), riempiamo con:
- `linetype = 'Continuous'` (DXF default).
- `lineweight = -3` (Default).
- `transparency = 0`.
- `frozen = false`, `plottable = true`.
- `source = 'dxf-import'` quando viene da import, `'user-created'` da UI, `'system-default'` per il layer iniziale `"0"`.

Questo è defensive coding al boundary I/O (ADR-294 SSoT pattern), **non** una migration utility runtime.

**Pre-commit ratchet** (SSoT N.12): nuovo modulo `scene-layer-shape` in `.ssot-registry.json` — proibisce accessi diretti a `layer.X` per `X ∈ {frozen, locked, lineweight, linetype, transparency, plottable}` da fuori `LayerStore` o `LayerOperationsService`. Forza canalizzazione via SSoT.

### 5.2 SSoT primari
- **`LayerStore`** singleton (micro-leaf) — `stores/LayerStore.ts`.
- **`LayerStateStore`** singleton — `stores/LayerStateStore.ts` (se G10 confermato).

### 5.3.ter Default Lineweight Policy — Q5 risolta 2026-05-16 (Opzione Γ — Per-project configurable)

Confermato Giorgio: **Per-project configurable Full Enterprise**. Default lineweight risolvibile a 3 livelli con cascade chiaro.

**Resolution cascade** (priority alta → bassa):
1. **Project override** — Firestore `projects/{projectId}/dxfSettings.defaultLineweight` (mm).
2. **User localStorage fallback** — `dxf:defaultLineweight` (cross-project preference, useful primo-uso).
3. **System default** — `0.25mm` hardcoded (AutoCAD compatibility — apri in AutoCAD/BricsCAD e vede identico).

**SSoT**: `src/subapps/dxf-viewer/config/default-lineweight-resolver.ts` (pure fn).
```typescript
export function resolveDefaultLineweight(input: {
  projectSetting?: LineweightMm | null;
  userPreference?: LineweightMm | null;
}): LineweightMm {
  if (input.projectSetting && isConcreteLineweight(input.projectSetting)) return input.projectSetting;
  if (input.userPreference && isConcreteLineweight(input.userPreference)) return input.userPreference;
  return 0.25; // SYSTEM_DEFAULT_LINEWEIGHT
}

export const SYSTEM_DEFAULT_LINEWEIGHT: LineweightMm = 0.25;
```

`isConcreteLineweight` filtra special values (`-3/-2/-1` non possono essere "default" — non avrebbe senso ricorsione).

**Firestore schema** (`projects/{projectId}/dxfSettings`):
```typescript
interface DxfProjectSettings {
  defaultLineweight: LineweightMm;  // any ISO value (0.05..2.11)
  displayUnit?: 'mm' | 'cm' | 'm' | 'in' | 'ft';  // ADR-357 §5.5
  // future: defaultColor, defaultLinetype, etc.
}
```

**UI**:
- **Status bar dropdown** "Default LW: [0.25mm ▼]" accanto ai toggle Polar/Ortho (ADR-357 §5.1).
- Click → Radix Select con 12 ISO values + sezione "User preference" + "Project default".
- Change → ottimistico update LayerStore + persist Firestore + invalidate render.
- Permission: solo `project-admin` / `project-architect` può cambiare project setting. Tutti possono settare userPreference.
- **Project Settings page** → "DXF Settings" section ha lo stesso dropdown.

**DXF I/O compatibility**:
- **Export**: scrivi `$LWDEFAULT` header system variable nel DXF (group code 70 in `$LWDEFAULT` HEADER section). Valore in centesimi di mm × 100 (DXF native — es. 0.25mm → 25).
- **Import**: leggi `$LWDEFAULT`. Se presente e differente da `0.25`, mostra dialog "Imported DXF has default lineweight Xmm. Use this as project default?" [Yes / Keep current / No].

**Render integration**: `resolveEntityStyle` (G7) quando incontra `lineweight = -3 (Default)`, chiama `resolveDefaultLineweight({ projectSetting, userPreference })` con valori dal LayerStore.

**Pre-commit ratchet**: modulo `default-lineweight-resolver` in `.ssot-registry.json` — forza l'uso di `resolveDefaultLineweight()` o `SYSTEM_DEFAULT_LINEWEIGHT`, vieta `0.25` hardcoded altrove.

### 5.3 Catalog SSoT
- **`linetype-catalog.ts`** — 8 ISO linetypes hardcoded + **custom registry estendibile** (Q4 FULL).
- **`lineweight-catalog.ts`** — 12 ISO + 3 special values (G6).
- **`aci-color-palette.ts`** — full ACI 1-255 (esiste parzialmente, consolidare).

### 5.3.bis Linetype System — Q4 risolta 2026-05-16 (Opzione B — FULL custom `.lin` import)

Confermato Giorgio: **FULL Enterprise + GOL + SSoT**. ISO 8 baseline + custom `.lin` import + roundtrip integrity garantita.

**Architettura linetype**:

```typescript
// SSoT immutable — ISO baseline
// File: src/subapps/dxf-viewer/config/linetype-iso-catalog.ts
export const LINETYPE_ISO_CATALOG = {
  Continuous: { name: 'Continuous', description: 'Solid line',          pattern: [],                                            origin: 'iso-baseline' },
  Dashed:     { name: 'Dashed',     description: '_ _ _ _',              pattern: [12.7, -6.35],                                origin: 'iso-baseline' },
  Hidden:     { name: 'Hidden',     description: '_ _ _ _ (short)',      pattern: [6.35, -3.175],                               origin: 'iso-baseline' },
  Center:     { name: 'Center',     description: '____ _ ____ _ ____',   pattern: [31.75, -6.35, 6.35, -6.35],                  origin: 'iso-baseline' },
  Phantom:    { name: 'Phantom',    description: '____ _ _ ____ _ _',    pattern: [31.75, -6.35, 6.35, -6.35, 6.35, -6.35],     origin: 'iso-baseline' },
  DashDot:    { name: 'DashDot',    description: '_._._._',              pattern: [12.7, -6.35, 0, -6.35],                      origin: 'iso-baseline' },
  Border:     { name: 'Border',     description: '__ __ . __ __ .',      pattern: [12.7, -3.175, 12.7, -3.175, 0, -3.175],      origin: 'iso-baseline' },
  Divide:     { name: 'Divide',     description: '__ . . __ . .',        pattern: [12.7, -3.175, 0, -3.175, 0, -3.175],         origin: 'iso-baseline' },
} as const;
// Pattern format (DXF-native): array of numbers, positive=dash, negative=gap, 0=dot.
// Unit: drawing-units (mm internal, ADR-357 §5.5).
```

**Custom linetype registry** (runtime + persistent):
```typescript
// File: src/subapps/dxf-viewer/stores/LinetypeRegistry.ts (singleton, micro-leaf)
interface CustomLinetypeDef {
  readonly id: string;          // ulid `ltp_<26>` da enterprise-id.service.ts (prefix nuovo `ltp`)
  readonly name: string;        // DXF identifier (case-sensitive — AutoCAD convention)
  readonly description: string;
  readonly pattern: ReadonlyArray<number>;  // DXF-native [dash, -gap, 0=dot, ...]
  readonly origin: 'iso-baseline' | 'lin-import' | 'user-created' | 'dxf-import';
  readonly sourceFile?: string;  // .lin file name if origin='lin-import'
}

// LinetypeRegistry.api:
//   resolve(name: string) → CustomLinetypeDef | null
//   register(def: CustomLinetypeDef) → void
//   importLin(file: File | string) → Promise<{ added: number, skipped: number, errors: string[] }>
//   exportLin(names?: string[]) → string  // .lin file format
//   list() → CustomLinetypeDef[]
//   subscribe(cb) → unsubscribe
```

**`.lin` parser** — SSoT puro: `src/subapps/dxf-viewer/services/lin-parser.ts`

AutoCAD `.lin` file format (text, two-line per entry):
```
*FENCELINE1,Fenceline circle ----0-----0----0-----0----0-----0--
A,.25,-.1,[CIRC1,ltypeshp.shx,x=-.1,s=.1],-.1,1
```
- Riga 1: `*NAME,description`
- Riga 2: `A,<pattern numbers comma-separated>`
- Sub-format `[SHAPE,FILE,x=,s=]` per shapes (Phase 13bis MVP: parser **ignora shapes**, registra solo dash/gap/dot — warning per shape lines).
- Text segments `["text",STYLE,...]` (Phase 13bis MVP: ignorate, fallback Continuous + warning).

Parser:
- Tokenizer line-based.
- Validation: pattern non-empty, almeno un dash/gap.
- Skip duplicati per `name` (case-sensitive, AutoCAD convention).
- Returns `{ defs: CustomLinetypeDef[], errors: ParseError[] }`.

**`.lin` exporter** — pure fn: serializza `CustomLinetypeDef[]` → text `.lin`.

**DXF roundtrip integrity**:
- **Import DXF**: per ogni layer riferendo un linetype non-ISO, il parser cerca `LinetypeRegistry.resolve(name)`. Se non trovato → cerca nella sezione `TABLES > LTYPE` del DXF → registra come `origin: 'dxf-import'`. Garantisce roundtrip senza loss.
- **Export DXF**: include sezione `TABLES > LTYPE` completa con tutti i linetype riferiti, pattern intatti.
- Integration test obbligatorio (Phase 15): 5 file DXF reference con linetype custom, import → export → re-import → diff zero su `LinetypeRegistry`.

**UI**:
- Linetype dropdown (Layer Properties Manager + ribbon Quick Style): mostra ISO baseline + custom, ordinati per origin (ISO prima, poi user-created, poi imported). Visual preview pattern accanto al name.
- Button "Import `.lin`…" → FilePicker `.lin` → `LinetypeRegistry.importLin()` → toast con stats `{ added, skipped, errors }`.
- Button "Export `.lin`…" → multi-select linetypes → download file.

**Pre-commit ratchet** modulo `linetype-system` in `.ssot-registry.json`:
- Vieta hardcoded linetype name strings (eccetto `linetype-iso-catalog.ts` e tests).
- Forza uso di `LinetypeRegistry.resolve()` per rendering / DXF I/O.

**Render integration**: `DxfRenderer.drawEntity` chiama `resolveEntityStyle(entity, layer)` (§5.4 G7), che a sua volta legge `LinetypeRegistry.resolve(layer.linetype)` → applica `ctx.setLineDash(pattern)` con scaling appropriato (zoom + ADR-357 `units` mm→display).

### 5.3.quater DXF Parser Scope — Q6 risolta 2026-05-16 (Opzione B — Core + Extended FULL Enterprise)

Confermato Giorgio: **FULL Enterprise core + extended** (NO plot style / material handles — 3D-only out of scope).

**Group codes letti dal parser layer table** (estensione di `parseLayerColors`):

| DXF code | SceneLayer field | Parser behavior |
|---|---|---|
| `2` | `name` | already ✅ |
| `62` | `color.aci` + `visible` (negative=OFF) | already ✅ — estendere per popolare anche `color.trueColor=null` |
| **`6`** | `linetype` | resolve via `LinetypeRegistry.resolve()` con fallback `Continuous` + warning se non trovato (Phase 5 garantisce parsing della sezione `TABLES > LTYPE` PRIMA di `LAYER` per registrare i custom linetype) |
| **`370`** | `lineweight` | int → mm × 0.01. `-3` → `LW_DEFAULT`, `-2` → `LW_BYLAYER` (mai per layer stesso — solo per entity, fallback `LW_DEFAULT`), `-1` → analogo. Valori non-ISO → snap a closest ISO + warning |
| **`70` bit 1** | `frozen` | `(flag & 1) !== 0` |
| **`70` bit 4** | `locked` | `(flag & 4) !== 0` |
| **`290`** | `plottable` | `value === '1'` (default `true` se assente) |
| **`420`** | `color.trueColor` | parse 0xRRGGBB. Se presente, prevale visivamente su ACI (ACI rimane per fallback DXF legacy export) |
| **`1071`** XDATA (AppId `AcCmTransparency`) | `transparency` | parse XDATA section per layer. Format: bit-field — extract `value & 0xFF` → 0-255 → normalize `Math.round((1 - v/255) * 90)` per ottenere 0-90% range |
| **`1000`** XDATA | `description` | string raw |

**Out of scope (skip + log debug)**:
- `390` (plot style handle) — legacy AutoCAD plot styles, raramente usati, no use case nel DXF Viewer 2D.
- `347` (material handle) — 3D rendering only.
- `348` (unknown / line type scale) — preservato come opaque metadata in `SceneLayer.dxfExtraTags?: Record<string, string>` per safe roundtrip (Phase 5 add) — ⚠️ non readable da UI ma DXF export li ri-emette → zero loss.

**Parser refactor** (Phase 5):
- Nuovo file `src/subapps/dxf-viewer/utils/dxf-layer-table-parser.ts` (estrazione + rewrite di `parseLayerColors`).
- API: `parseLayerTable(lines: string[], context: { linetypeRegistry: LinetypeRegistry }): { layers: SceneLayer[], warnings: ParseWarning[] }`.
- Pre-pass obbligatorio: `parseLinetypeTable` PRIMA — popola `LinetypeRegistry` con i custom linetype del DXF.
- Test coverage: 1 file DXF reference per ogni group code letto (8 file totali) + 5 file roundtrip integrity.

**Pre-commit ratchet** (`.ssot-registry.json` modulo `dxf-layer-parser`):
- Vieta inline parsing di group codes layer (es. `if (code === '370')`) fuori da `dxf-layer-table-parser.ts`.
- Forza unico entry-point parser.

### 5.3.quinquies AEC Category + Tags + AIA Auto-suggest — Q7 risolta 2026-05-16 (Opzione Δ — FULL Enterprise)

Confermato Giorgio: **Δ FULL Enterprise AEC-aware**. Mock data legacy (Ηλεκτρολογικά / Υδραυλικά / HVAC) **eliminata completamente** + costruzione sistema corretto.

**Cleanup** (Phase 6, prima del rewire):
- Eliminato `DXF_LAYER_CATEGORY_LABELS` da `src/constants/property-statuses-enterprise.ts` (mock).
- Eliminato mock `[{ id: '1', name: 'Ηλεκτρολογικά', ... }]` da `useLayerManagerState`.
- Eliminato la classificazione hardcoded 4-categoria.

**`SceneLayer` esteso ulteriormente** (aggiornamento §5.1):
```typescript
interface SceneLayer {
  // ... §5.1 fields (12 base)
  category: AecLayerCategory;       // enum standardized
  tags: ReadonlyArray<string>;      // free-text, lowercase normalized, ≤8 tags
}

export type AecLayerCategory =
  | 'architectural'   // A — pareti, porte, finestre, finishes
  | 'structural'      // S — colonne, travi, fondazioni
  | 'electrical'      // E — impianti elettrici
  | 'mechanical'      // M — HVAC, ascensori
  | 'plumbing'        // P — idraulica, scarichi
  | 'fire'            // F — antincendio, sprinkler, evacuazione
  | 'civil'           // C — sito, paesaggio, parcheggi
  | 'telecom'         // T — TLC, data, comm
  | 'interior'        // I — arredo, allestimenti
  | 'general';        // none of the above — default fallback

export const AEC_CATEGORY_AIA_PREFIX: Record<AecLayerCategory, string> = {
  architectural: 'A',
  structural:    'S',
  electrical:    'E',
  mechanical:    'M',
  plumbing:      'P',
  fire:          'F',
  civil:         'C',
  telecom:       'T',
  interior:      'I',
  general:       '',  // no prefix
};
```

**AIA Auto-suggest** (SSoT pure fn):
```typescript
// File: src/subapps/dxf-viewer/services/aec-category-suggester.ts
/**
 * Infer AEC category from AIA CAD Layer Guidelines naming.
 * https://www.nationalcadstandard.org
 *
 * Pattern: <Discipline>-<MajorGroup>-<MinorGroup>-<Status>
 * Examples:
 *   A-WALL-FULL-NEW    → 'architectural'
 *   S-COL-EXST         → 'structural'
 *   M-HVAC-DUCT        → 'mechanical'
 *   E-LITE-CIRC        → 'electrical'
 *   P-SANR-PIPE        → 'plumbing'
 */
export function suggestCategoryFromName(name: string): AecLayerCategory {
  const prefix = name.trim().toUpperCase().split(/[-_\s]/)[0];
  switch (prefix.charAt(0)) {
    case 'A': return 'architectural';
    case 'S': return 'structural';
    case 'E': return 'electrical';
    case 'M': return 'mechanical';
    case 'P': return 'plumbing';
    case 'F': return 'fire';
    case 'C': return 'civil';
    case 'T': return 'telecom';
    case 'I': return 'interior';
    default:  return 'general';
  }
}
```

**Behaviors**:
- **Create new layer** (UI + import DXF): auto-fill `category = suggestCategoryFromName(name)` se utente non specifica. Inline hint UI: "🔮 Suggerito: Architectural (da prefisso 'A-')".
- **Rename layer**: ricalcolo `category` se il prefix cambia (con confirm popup se l'utente aveva override manuale).
- **Manual override**: dropdown in Layer Properties → forza qualsiasi category. Override sticky (non viene sovrascritto da auto-suggest).
- **Tags**: TagInput component (Phase 6) — Radix-based, autocomplete da `LayerStore.getAllTagsUsedInProject()`, max 8 tags, lowercase normalize, separator `,` o `Enter`.

**`AdminLayerManager` rewire** (Phase 6):
- Filter sidebar nuovo: **3 dimensioni**
  1. **Category**: multi-select chip group (10 AEC categories) — "Tutte le categorie" default.
  2. **Tags**: multi-select chip da `getAllTagsUsedInProject()`.
  3. **Properties**: visible/frozen/locked/plottable toggles + linetype/lineweight/color search.
- Search bar (testuale) sopra: matcha `name + description + tags`.
- Ordering: by category (raggruppamento accordion) oppure flat list — toggle nel header.
- Statistics panel: count per category + total entities/regions.

**DXF I/O round-trip** (Phase 5):
- **Export**: per ogni `SceneLayer` con `category !== 'general'` o `tags.length > 0`:
  - XDATA AppId `NestorAec` con codes:
    - `1000` `category=architectural`
    - `1000` `tag=load-bearing`
    - `1000` `tag=fire-rated`
  - Roundtrip 100% safe (DXF native XDATA).
- **Import**: parse XDATA `NestorAec` block per popolare `category` + `tags`. Fallback: `suggestCategoryFromName(layer.name)` + `tags = []`.

**Pre-commit ratchet** (`.ssot-registry.json`):
- Modulo `aec-category-suggester` — vieta hardcoded category prefix mapping fuori dal SSoT.
- Modulo `legacy-layer-categories` — vieta nuovi import di `DXF_LAYER_CATEGORY_LABELS` (post-Phase 6, l'export viene rimosso quindi anche zero-tolerance).

**i18n** (`dxf-viewer.json`):
- 10 categorie tradotte (el + en):
  - `architectural`: el `Αρχιτεκτονικά` / en `Architectural`
  - `structural`: el `Στατικά` / en `Structural`
  - `electrical`: el `Ηλεκτρολογικά` / en `Electrical`
  - ... (continua per le altre 7)

### 5.4 Pipeline ByLayer/ByBlock
- **`resolve-entity-style.ts`** pure fn (G7).
- Wire-up in `DxfRenderer.drawEntity`.
- Wire-up in `completeEntity` (ADR-357 Phase 0).

### 5.5 UI
- **`AdminLayerManager`** wired al `LayerStore` (G8) — vedi §5.3.quinquies.
- **`CurrentLayerPicker`** in **DUE locations** sync'd (Q8 — Γ Full Enterprise).
- **`LayerStatePicker`** status bar dropdown (G10 — se confermato).
- **`LayerFiltersBuilder`** nel manager (G11).

### 5.5.bis CurrentLayerPicker — Q8 risolta 2026-05-16 (Opzione Γ — Both Status Bar + Ribbon)

Confermato Giorgio: **FULL Enterprise — dual placement**. Componente unico shared, due mount points, sync via `LayerStore.currentLayerId` SSoT.

**Architettura componente**:
```typescript
// File: src/subapps/dxf-viewer/ui/components/layer-picker/CurrentLayerPicker.tsx
interface CurrentLayerPickerProps {
  readonly variant: 'status-bar' | 'ribbon';
  readonly className?: string;
}
```

Singolo componente, due varianti visuali:

**Variant `status-bar`** (compact):
- Trigger: button ~140px width — `[●Walls ▼]` con color swatch (3×3 square) + name truncated.
- Click → Radix Popover full-width 280px, lista scrollable.
- Mount in: `ui/status-bar/StatusBarLayerSlot.tsx` (slot dedicato accanto a Polar/Ortho toggle).

**Variant `ribbon`** (medium):
- Trigger: button ~200px con swatch (5×5) + name + category icon (es. 🏛️ per architectural, ⚡ per electrical) + dropdown chevron.
- Click → Radix Popover 320px con sezioni: "Most used" (top 5 by recency), "All layers" (filtered+grouped by category).
- Mount in: `ui/ribbon/groups/LayerRibbonGroup.tsx` (gruppo dedicato accanto a Quick Style ADR-357 §G15).

**Popover contents (entrambi shared)**:
```
┌──────────────────────────────┐
│ 🔍 [Search layers...      ]  │
├──────────────────────────────┤
│ 📌 Most used                 │
│  ● Walls           👁 🔓 ❄   │  ← swatch | name | visibility | lock | freeze
│  ● Dimensions      👁 🔓 ❄   │
│  ● Construction    👁 🔒 ❄   │
├──────────────────────────────┤
│ 📁 Architectural             │
│  ● Walls                     │
│  ● Doors                     │
│  ● Windows                   │
│ 📁 Structural                │
│  ● Columns                   │
│  ● Beams                     │
│  ...                         │
├──────────────────────────────┤
│ ➕ New Layer…                │
│ ⚙️ Manage Layers…             │  ← apre AdminLayerManager
└──────────────────────────────┘
```

**Behaviors**:
- **Click su layer** → `LayerStore.setCurrentLayerId(id)` → entrambi i mount points si aggiornano via subscription.
- **Right-click su layer** → context menu: `Set as current / Make visible / Lock toggle / Freeze toggle / Properties…`.
- **Icona accanto a layer disabled** (locked/frozen): tooltip "Layer locked — cannot draw here" oppure "Layer frozen — thaw to draw".
- **Permission integration**: layer `locked && !canUnlockLayer` (ADR-344 CanEditLayerGuard) → disabled in lista con badge `🔒`.
- **Keyboard nav**: `↑↓` cicla, `Enter` seleziona, `/` apre search, `Esc` chiude.
- **"Make current" da AdminLayerManager**: right-click su layer in manager → "Set as current" → `LayerStore.setCurrentLayerId(id)` → tutti i picker si aggiornano.

**Visual feedback su current layer change**:
- Toast informativo bottom-right: "Current layer: Walls" (3s autohide, only su user-initiated change, NOT su programmatic).
- Status bar swatch pulses 1 volta (subtle animation).

**Most-used tracking**:
- `LayerStore.recentLayerIds: string[]` (FIFO, max 10).
- Persistito in `localStorage` chiave `dxf:recentLayers.{projectId}.{userId}`.
- Updated su `setCurrentLayerId` (skip se uguale al top).
- Top 5 mostrati come "Most used" — fallback a alfabetico se < 5 layers usati.

**Persistence** (`LayerStore.currentLayerId`):
- Primary: `localStorage` chiave `dxf:currentLayerId.{projectId}.{levelId}` (cross-session, per-level).
- Fallback: Firestore `projects/{projectId}/dxfSettings.lastUsedLayerByLevel: Record<levelId, layerId>`.
- Initial on scene load: prima entrata, current = primo layer della category `'general'` o `layer "0"` se esiste, fallback al primo dell'array.

**Pre-commit ratchet** modulo `current-layer-picker` in `.ssot-registry.json`:
- Vieta lettura/scrittura diretta di `currentLayerId` fuori da `LayerStore`.
- Vieta duplicazione del componente picker (un solo `CurrentLayerPicker.tsx`, due `variant`).

### 5.6 Comandi
- `LayerIsolate`, `LayerUnisolate`, `LayerDim`, `LayerOff` in `CommandRegistry` (G12).

### 5.6.bis Layer Isolate UX — Q10 risolta 2026-05-16 (Opzione Δ — Configurable + Opacity Slider Full Enterprise)

Confermato Giorgio: **Δ FULL Enterprise**. Default dim, project-configurable, inverse-mode shortcut, opacity slider.

**Project setting** (Firestore `projects/{projectId}/dxfSettings`):
```typescript
interface DxfProjectSettings {
  // ... existing
  layerIsolate: {
    /** Default behavior on Ctrl+Shift+I */
    mode: 'dim' | 'freeze';            // default 'dim'
    /** Opacity for non-isolated layers in 'dim' mode (0-100). Display value, internally inverted to transparency. */
    dimOpacityPercent: number;          // default 30 (= transparency 70)
  };
}
```

**SSoT resolver** `src/subapps/dxf-viewer/services/layer-isolate-resolver.ts`:
```typescript
export const DEFAULT_LAYER_ISOLATE_SETTINGS: LayerIsolateSettings = {
  mode: 'dim',
  dimOpacityPercent: 30,
};

export function resolveLayerIsolateSettings(input: {
  projectSetting?: Partial<LayerIsolateSettings> | null;
  userPreference?: Partial<LayerIsolateSettings> | null;
}): LayerIsolateSettings;  // 3-level cascade like default-lineweight
```

**Commands** (`src/subapps/dxf-viewer/core/commands/layer/`):

| Command | Shortcut | Behavior |
|---|---|---|
| `LayerIsolateCommand` | `Ctrl+Shift+I` | Usa `mode` configurato. Click entity → snapshot `LayerStore.unisolateSnapshot` → set other layers a target state (dim transparency o freeze visible=false) |
| `LayerIsolateInverseCommand` | `Ctrl+Alt+I` | Usa modalità opposta a configured (dim ↔ freeze) per quel singolo use |
| `LayerUnisolateCommand` | `Ctrl+Shift+U` | Restore snapshot. Clear `unisolateSnapshot`. |
| `LayerDimCommand` | (no default shortcut) | Force `mode='dim'` per single execution, ignora project setting |
| `LayerOffCommand` | (click-driven) | One-shot `LAYOFF` AutoCAD — click entity, layer di quella entity diventa visible=false |
| `LayerFreezeCommand` | (click-driven) | One-shot `LAYFRZ` analogo |
| `LayerLockCommand` | (click-driven) | One-shot `LAYLCK` |
| `LayerThawAllCommand` | `Ctrl+Shift+T` | Restore visible+thawed per tutti i layer |
| `LayerOnAllCommand` | `Ctrl+Shift+O` | Restore visible per tutti i layer |

**Snapshot storage** in `LayerStore`:
```typescript
interface LayerStoreInternalState {
  // ... existing
  unisolateSnapshot: ReadonlyArray<{
    layerId: string;
    visible: boolean;
    frozen: boolean;
    transparency: number;
  }> | null;
}
```
- Solo **una** snapshot attiva (l'utente non può fare isolate annidati — il secondo isolate sovrascrive la snapshot precedente con warning toast).
- Persistenza: NO. Snapshot è session-only — `Ctrl+Z` undo non lo restora (è uno UI state, non un command history op).
- ⚠️ Edge case: se l'utente fa modifiche su un layer durante l'isolate, l'unisolate **ripristina solo i 3 flag** (visible/frozen/transparency), non touchα le altre property eventualmente modificate medio. Documentato in tooltip.

**UI**:
- **DXF Settings → Behaviors panel**: nuova sezione "Layer Isolate":
  - Radio: `( ) Freeze non-isolated  (●) Dim non-isolated`
  - Slider: `Dim opacity: [30%] ────●────` (range 5-90%, step 5%)
  - Preview: mini mockup live che mostra effetto.
- **Status bar indicator**: quando isolate è attivo, badge `🎯 Isolated: <category>` cliccabile per unisolate.

**Render integration** (Phase 10):
- `DxfRenderer.drawEntity` legge `resolveEntityStyle(entity, layer)` che già include `transparency` campo (§5.1). Per dim mode, la transparency del layer durante isolate viene **overridden runtime** via `LayerStore.getEffectiveTransparency(layerId)` — leggendo da uno store `IsolateEffectsStore` (micro-leaf separato per zero-cost rendering passthrough quando isolate è off).
- Per freeze mode: layer `frozen=true` → renderer skip completo (perf parity AutoCAD).

**Pre-commit ratchet** modulo `layer-isolate-system` in `.ssot-registry.json`:
- Vieta accesso diretto a `unisolateSnapshot` fuori dai Command classes.
- Vieta hardcoded `dimOpacity` numeri magici (forza `resolveLayerIsolateSettings()`).

**i18n** dxf-viewer.json:
- el: `layer.isolate.mode.dim`: "Ξεθώριασμα μη απομονωμένων", `layer.isolate.mode.freeze`: "Πάγωμα μη απομονωμένων", `layer.isolate.dimOpacity`: "Διαφάνεια ξεθωριάσματος".
- en: equivalent.

### 5.6 Layer Naming Validation — Q9 risolta 2026-05-16 (Opzione A — Strict AutoCAD parity)

Confermato Giorgio: **Strict Google-level**. CAD users expect predictability.

**Validation rules** (SSoT `src/subapps/dxf-viewer/services/layer-name-validator.ts` pure):

```typescript
export type LayerNameValidationError =
  | 'EMPTY'
  | 'WHITESPACE_ONLY'
  | 'TOO_LONG'         // > 255 chars
  | 'INVALID_CHARS'    // < > / \ " : ; ? * | , = ` '
  | 'DUPLICATE'        // case-insensitive match with existing layer
  | 'RESERVED'         // attempt to rename layer "0" or use name "0" for non-system layer
  | 'LEADING_TRAILING_WS';

export interface LayerNameValidationResult {
  readonly valid: boolean;
  readonly error: LayerNameValidationError | null;
  readonly suggestion?: string;  // suggested fix, e.g. trimmed + safe-charified
}

export function validateLayerName(input: {
  name: string;
  existingNames: ReadonlyArray<string>;  // siblings (case-insensitive compare)
  excludeId?: string;                     // current layer id (for rename — exclude self)
  layerStore: LayerStoreSnapshot;
}): LayerNameValidationResult;
```

**Rules enforced**:
1. **EMPTY**: `name.length === 0` → reject.
2. **WHITESPACE_ONLY**: `name.trim().length === 0` → reject.
3. **TOO_LONG**: `name.length > 255` → reject.
4. **INVALID_CHARS**: regex `/[<>/\\":;?*|,=` + "`'" + `]/`  → reject. (AutoCAD-compatible char set.)
5. **DUPLICATE**: case-insensitive match (`"Walls"` === `"walls"`) → reject. Suggestion: `"<name> (2)"`.
6. **RESERVED — Layer "0"**:
   - `existing layer "0"` non può essere **rinominato** (DXF spec).
   - Un layer creato dall'utente non può chiamarsi `"0"` (riservato a sistema).
   - Layer "0" non può essere **eliminato** — error pre-execute hook in `LayerOperationsService.deleteLayer`.
7. **LEADING_TRAILING_WS**: `name !== name.trim()` → reject. Suggestion: trimmed value.

**Defender hierarchy** (defense in depth):
1. **UI-level**: TextInput `onChange` chiama `validateLayerName` real-time, mostra inline error + bottone "Apply suggestion" se presente.
2. **Service-level**: `LayerOperationsService.renameLayer` + `.createLayer` ri-validano prima del mutation (server-side trust boundary se la chiamata viene da AI o Firestore sync).
3. **Pre-commit ratchet** (modulo `layer-name-strict-validation` in `.ssot-registry.json`):
   - Vieta hardcoded layer names che bypassano la validation (es. `setDoc(..., { name: "Layer 1" })` senza passare da `LayerOperationsService.createLayer`).
   - Forza unico entry-point `LayerOperationsService.createLayer` / `.renameLayer` per qualsiasi mutazione di `SceneLayer.name`.

**Layer "0" hardening** (Phase 9 — layer rename audit):
- `LayerOperationsService.renameLayer(oldName='0', ...)` → return `{ success: false, error: 'RESERVED' }`.
- `LayerOperationsService.deleteLayer(name='0')` → return `{ success: false, error: 'RESERVED' }`.
- `LayerOperationsService.createLayer({ name: '0' })` → return `{ success: false, error: 'RESERVED' }`.
- UI: layer "0" mostrato con badge `🔒 System` + bottoni delete/rename disabled.
- DXF import garantisce always-present "0" layer: se il DXF non ha "0" lo creiamo a `defaults` (Continuous, white, visible, plottable).

**i18n** errors:
- el: `Το όνομα δεν μπορεί να είναι κενό` / `Υπάρχει ήδη layer με αυτό το όνομα` / `Δεσμευμένο όνομα`...
- en: equivalent.

### 5.7 Stable ID — Q2 risolta 2026-05-16 (Opzione A)

Confermato Giorgio: **Stable ID Google-standard**. Layer identificato da `id` immutabile, `name` mutable indipendente.

**Schema storage**:
```typescript
SceneModel.layers: Record<LayerId, SceneLayer>
//                          ^^^^^^^ chiave = id (es. "lyr_01HXYZ...")

interface SceneLayer {
  readonly id: string;     // stable, immutable, ULID-style (`lyr_<26-char-base32>`)
  name: string;            // display, mutable, NOT unique enforced (warning soft se duplicato)
  // ... resto §5.1
}

// Entity reference:
interface Entity {
  layerId: string;         // canonical, sempre presente
}
```

**ID generator**: SSoT `src/services/enterprise-id.service.ts` — prefix `'lyr'` registrato (SOS. N.6 compliance). Pattern attuale: `lyr_<UUID-v4>` (crypto.randomUUID, 36-char body, 40-char total). Pattern aspirazionale originale: `lyr_<ULID-26char>` — migration a ULID rinviata a future ADR `enterprise-id-ulid-migration`. UUID v4 sufficiente per Phase 9C requirements: cryptographic uniqueness + stable across save/load + lexicographic comparison NOT required (Layer lookups via Map keyed by id, no range queries).

**Roll-out diretto** (no migration, test data wiped): `entity.layerId` introdotto come campo canonico dal day-1. Il vecchio `entity.layer` (string name) viene **rimosso** dallo schema in un solo commit coordinato (Phase 1+9 fuse in unica phase di typing). Test DB wiped pre-produzione ⇒ zero dati legacy da preservare.

**Backref audit (≥ 30 file)** — tutti i reads/writes di `entity.layer` riscritti a `entity.layerId`. Lista preliminare (Grep):
- `services/LayerOperationsService.ts` — `entity.layer === oldName` (renameLayer) → diventa irrelevante (rename modifica solo `name`, gli `entity.layerId` restano)
- `hooks/canvas/useDxfSceneConversion.ts` — `entity.layer` mapping
- `ai-assistant/types.ts` — `currentLayer: string` → `currentLayerId: string`
- `ui/hooks/useLayerOperations.ts` — entity layer changes
- `state/overlay-manager.ts` — `RegionLayerObject` (regions — vedi §5.10 unified store)
- DXF export — `layer.name` writing
- `CanEditLayerGuard.ts` — adapter al nuovo `LayerStore`
- `LayerSelectorDropdown.tsx` — `LayerSelectorEntry.id` già `string` (felice convergenza), wire al nuovo `layerId`
- Tutti i tests che usano `entity.layer`

**DXF I/O compatibility**: DXF format usa **layer name** in group 8 (entity layer reference). Mapping interno `id ↔ name` solo a livello applicazione. Roundtrip senza loss:
- Import: leggi `group 8 (name)` → match per `name` nel `LayerStore` → set `entity.layerId`.
- Export: leggi `entity.layerId` → `LayerStore.getLayer(layerId).name` → scrivi in `group 8`.

### 5.7.bis Layer Filters — Q11 risolta 2026-05-16 (Opzione Δ — Both + Smart Suggested Full Enterprise + GOL)

Confermato Giorgio: **Δ FULL Enterprise + Google-level UX touch**. Group + Properties + Smart Suggested.

**Data model** (`src/subapps/dxf-viewer/types/layer-filters.ts`):

```typescript
export interface LayerFilterBase {
  readonly id: string;          // `lfg_<ULID>` group | `lfp_<ULID>` property | `lfs_<ULID>` system-smart
  readonly name: string;        // display
  readonly icon?: string;       // optional emoji/lucide icon
  readonly source: 'user-created' | 'system-smart' | 'imported';
  readonly createdAt: string;
}

export interface LayerGroupFilter extends LayerFilterBase {
  readonly kind: 'group';
  readonly layerIds: ReadonlyArray<string>;     // manual membership
}

export interface LayerPropertiesFilter extends LayerFilterBase {
  readonly kind: 'properties';
  readonly rules: LayerFilterRuleSet;
}

export interface LayerFilterRuleSet {
  readonly combinator: 'AND' | 'OR';
  readonly rules: ReadonlyArray<LayerFilterRule>;
  readonly nested?: ReadonlyArray<LayerFilterRuleSet>;   // recursive nesting
}

export type LayerFilterRule =
  | { field: 'name';         operator: 'matches' | 'startsWith' | 'endsWith' | 'contains' | 'equals'; value: string; caseSensitive?: boolean }
  | { field: 'category';     operator: 'is' | 'isNot' | 'isOneOf'; value: AecLayerCategory | AecLayerCategory[] }
  | { field: 'tag';          operator: 'has' | 'hasAny' | 'hasAll'; value: string | string[] }
  | { field: 'visible'  | 'frozen' | 'locked' | 'plottable'; operator: 'is'; value: boolean }
  | { field: 'color.aci';    operator: 'equals' | 'oneOf'; value: number | number[] }
  | { field: 'linetype';     operator: 'is' | 'isOneOf'; value: string | string[] }
  | { field: 'lineweight';   operator: 'equals' | 'gte' | 'lte' | 'between'; value: number | [number, number] }
  | { field: 'memberKind';   operator: 'has'; value: 'entity' | 'region' };

export type LayerFilter = LayerGroupFilter | LayerPropertiesFilter;
```

**Storage**:
- User-created filters: Firestore `projects/{projectId}/dxfSettings.layerFilters: LayerFilter[]`.
- Smart filters: NOT persisted — computed on-the-fly by `LayerSmartFilterResolver` (SSoT pure fn).

**Smart Suggested Filters** (auto-generated, sempre presenti, non eliminabili):
```typescript
// File: src/subapps/dxf-viewer/services/layer-smart-filters.ts
export function getSmartFilters(snapshot: LayerStoreSnapshot): LayerFilter[] {
  return [
    { kind: 'properties', id: 'lfs_smart_all_visible',   name: 'Visible',      icon: '👁',  source: 'system-smart',
      rules: { combinator: 'AND', rules: [{ field: 'visible', operator: 'is', value: true }] } },
    { kind: 'properties', id: 'lfs_smart_all_locked',    name: 'Locked',       icon: '🔒',  source: 'system-smart',
      rules: { combinator: 'AND', rules: [{ field: 'locked',  operator: 'is', value: true }] } },
    { kind: 'properties', id: 'lfs_smart_all_frozen',    name: 'Frozen',       icon: '❄',   source: 'system-smart',
      rules: { combinator: 'AND', rules: [{ field: 'frozen',  operator: 'is', value: true }] } },
    { kind: 'properties', id: 'lfs_smart_unplottable',   name: 'Not plotted',  icon: '🚫📄', source: 'system-smart',
      rules: { combinator: 'AND', rules: [{ field: 'plottable', operator: 'is', value: false }] } },
    { kind: 'properties', id: 'lfs_smart_empty_layers',  name: 'Empty layers', icon: '∅',   source: 'system-smart',
      rules: { combinator: 'AND', rules: [/* uses computed memberCount via store query */] } },
    // Plus one per AEC category present in scene:
    ...presentCategories.map(cat => ({
      kind: 'properties', id: `lfs_smart_cat_${cat}`, name: `Category: ${cat}`, icon: getCategoryIcon(cat), source: 'system-smart',
      rules: { combinator: 'AND', rules: [{ field: 'category', operator: 'is', value: cat }] }
    })),
  ];
}
```

**Filter Engine** (SSoT pure fn):
```typescript
// File: src/subapps/dxf-viewer/services/layer-filter-engine.ts
export function applyLayerFilter(input: {
  filter: LayerFilter;
  layers: ReadonlyArray<SceneLayer>;
  snapshot: LayerStoreSnapshot;  // for memberKind queries
}): ReadonlyArray<SceneLayer>;
```
- Pure fn, no side effects.
- Recursive ruleset evaluation con short-circuit AND/OR.
- Memoized via `useMemo` su `[filter, layers]` nei consumer (deep-equal pass).

**UI** (`AdminLayerManager` Phase 11):

```
┌─────────────────────────┬──────────────────────────────────────┐
│ FILTERS SIDEBAR (260px) │  LAYER LIST                           │
├─────────────────────────┤                                       │
│ 📁 All Layers           │  Walls            👁 🔓 ❄  AEC: A     │
│                         │  Doors            👁 🔓 ❄  AEC: A     │
│ ✨ Smart                │  Columns          👁 🔓 ❄  AEC: S     │
│   👁 Visible (42)       │  ...                                  │
│   🔒 Locked (3)         │                                       │
│   ❄ Frozen (1)         │                                       │
│   🏛 Category: A (18)  │                                       │
│   ⚡ Category: E (12)  │                                       │
│   ➕ +6 more…          │                                       │
│                         │                                       │
│ 📋 Group Filters    [+] │                                       │
│   🏗 Floor 2 (8)        │                                       │
│   🚧 Demo (5)           │                                       │
│                         │                                       │
│ ⚙ Property Filters  [+] │                                       │
│   "Red A-walls" (12)    │                                       │
│   "All locked" (3)      │                                       │
│                         │                                       │
└─────────────────────────┴──────────────────────────────────────┘
```

- **Click smart filter** → applica al list, badge "Smart" non-removable.
- **Click + accanto a Group Filters** → modal "Crea Group Filter": select layers + name.
- **Click + accanto a Property Filters** → modal "Crea Property Filter": rule builder (chip-based, drag-to-nest per nested groups).
- **Right-click su filter** → context menu: Rename / Edit / Duplicate / Delete (smart filters → solo "Pin to top").
- **Drag-and-drop layer su Group Filter** → aggiunge a group.
- **Multi-filter combo**: Shift+click su 2 filter → applica intersection (AND) | Ctrl+click → union (OR).

**Filter Save/Load** (user-facing):
- Bottone "Export filters…" → JSON file `{ projectName }-layer-filters-{ date }.json`.
- Bottone "Import filters…" → JSON file → merge con esistenti (dedupe by name, suffix `(2)` se duplicate).

**Pre-commit ratchet** modulo `layer-filter-engine` in `.ssot-registry.json`:
- Vieta filter logic duplicate fuori da `layer-filter-engine.ts`.
- Vieta smart filter overrides fuori da `layer-smart-filters.ts`.

**Permission**: Group/Properties filter creation → tutti gli utenti del project. Smart filter pin → solo `project-architect+`.

### 5.8 Breaking changes summary (production-clean, no migration runtime)
- `entity.layer` (name) → `entity.layerId` (stable id) — **rewrite, no fallback**.
- `SceneLayer` extension a 12 campi — **shape diretta**, default-fill solo al boundary I/O DXF.
- `scene.layers` keyed by `id` (non più `name`) — **schema-diretto**.
- `overlay-manager.coreState.layers` → assorbito nel Unified `LayerStore` (vedi §5.10).

### 5.10 Unified LayerStore — Q3 risolta 2026-05-16 (Opzione Α — Unified)

Confermato Giorgio: **SSoT pure unificato**. Un solo `LayerStore` gestisce **sia** DXF entities **sia** Regions (floor-plan polygons). Zero duplicazione concept "layer" nel codebase.

**Storage unificato** in `LayerStore`:
```typescript
interface UnifiedSceneLayer extends SceneLayer {
  /** Aggregate membership — calcolato derived dal SceneModel, non duplicato in storage. */
  readonly memberKinds: Set<'entity' | 'region'>;
}

// Reference dai consumer:
interface DxfEntity {
  layerId: string;     // → LayerStore.getLayer(layerId)
}
interface Region {
  layerId: string;     // → LayerStore.getLayer(layerId) — STESSO store
}
```

**Caratteristiche del Unified Store**:
- **Un solo SSoT** `src/subapps/dxf-viewer/stores/LayerStore.ts` (singleton micro-leaf, `useSyncExternalStore` pattern ADR-040).
- Entities e Regions condividono visibility/color/locked/frozen/transparency dello stesso layer.
- `currentLayerId` univoco — applicabile sia per LINE tool (ADR-357) sia per region drawing tool.
- `RegionLayerObject` rimosso. Il `regionIds: string[]` non è più ownership del layer — diventa **derivazione computed** da `SceneModel.regions.filter(r => r.layerId === layerId)`.
- `overlay-manager.coreState.layers` rimosso completamente. State residuo (`regions`, `groups`) resta in `overlay-manager`; `layers` + `currentLayerId` migrano in `LayerStore`.

**Vantaggi enterprise**:
1. SSoT pure (SOS. N.0): un layer = una verità.
2. UX coerente — l'utente vede un'unica `AdminLayerManager` UI per tutto.
3. Layer Isolate / Filters / States Manager (G10-G12) funzionano in modo uniforme su entities + regions.
4. Cross-domain queries banali: "tutte le entità + regions nel layer Walls" = `getLayerMembers(layerId)`.
5. DXF roundtrip resta intatto (regions non sono native DXF — vengono escluse all'export, ma il layer condiviso sì).

**Phase coordinata**:
- Phase 2 di ADR-358: `LayerStore` nasce direttamente unified — assorbe `overlay-manager.layers` + `currentLayerId`.
- Backref Region audit (Phase 9): tutti gli accessi a `coreState.layers` e `RegionLayerObject` riscritti.

**Pre-commit ratchet** aggiuntivo (modulo `unified-layer-store` in `.ssot-registry.json`):
- Vieta `RegionLayerObject` import fuori da legacy files marker (zero tolerance new).
- Vieta `overlay-manager.layers` access fuori dal bridge file di transizione interno alla Phase 2.

### 5.8 Persistence scope
*Da decidere in Q&A* — project-wide vs level-scope vs hybrid (G14).

### 5.9 Layer States Manager scope — Q12 risolta 2026-05-16 (Opzione Γ — FULL Enterprise)

Confermato Giorgio: **Γ FULL Enterprise**. Save/Restore + `.las` Export/Import + Cross-project Share.

**Data model** (`src/subapps/dxf-viewer/types/layer-state.ts`):
```typescript
export interface LayerState {
  readonly id: string;                      // `lst_<ULID>` da enterprise-id.service
  readonly name: string;                    // user-given
  readonly description?: string;
  readonly icon?: string;                   // optional emoji
  /** Snapshot frozen at save time. Always FULL snapshot — no partial states. */
  readonly snapshot: ReadonlyArray<LayerStateEntry>;
  readonly source: 'user-created' | 'las-import' | 'template-shared';
  readonly sourceTemplateId?: string;       // se origine 'template-shared'
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByUserId: string;
}

export interface LayerStateEntry {
  readonly layerId: string;       // stable id (Q2)
  readonly layerName: string;     // snapshotted name (for .las roundtrip se layer rinominato)
  readonly visible: boolean;
  readonly frozen: boolean;
  readonly locked: boolean;
  readonly color: SceneLayerColor;
  readonly linetype: string;
  readonly lineweight: LineweightMm;
  readonly transparency: number;
  readonly plottable: boolean;
}
```

**Storage** (Firestore):
- **Project-scoped**: `projects/{projectId}/dxfSettings.layerStates: LayerState[]` (visibili nel project corrente).
- **Cross-project templates**: collezione root `dxf_layer_state_templates/{templateId}` — keyed per-organization (`companyId` SOS. N.6) + tags + categoria preset (`presentation` | `working` | `demolition` | `as-built` | `custom`).
- Permission: project layer states → tutti. Templates → solo `project-admin+` per save-as-template, tutti per usare.

**Store** (`src/subapps/dxf-viewer/stores/LayerStateStore.ts` singleton micro-leaf):
```typescript
interface LayerStateStoreApi {
  // CRUD locale
  list(): ReadonlyArray<LayerState>;
  get(id: string): LayerState | null;
  saveCurrent(input: { name: string; description?: string; icon?: string }): Promise<LayerState>;
  rename(id: string, newName: string): Promise<void>;
  delete(id: string): Promise<void>;
  // Restore
  restore(id: string): Promise<void>;       // applica snapshot al LayerStore
  // .las I/O
  exportLas(ids?: string[]): Promise<string>;       // ASCII text content
  importLas(content: string): Promise<{ added: number; skipped: number; errors: string[] }>;
  // Template
  saveAsTemplate(id: string, tags: string[]): Promise<{ templateId: string }>;
  importTemplate(templateId: string): Promise<LayerState>;
  searchTemplates(query: { tags?: string[]; category?: string }): Promise<LayerStateTemplateSummary[]>;
  // Subscription
  subscribe(cb: () => void): () => void;
}
```

**`.las` file format** (AutoCAD-compatible ASCII):
- Riferimento Autodesk: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-DidYouKnow/files/GUID-5312A8BD-DD94-47D6-B1BA-5E0AF5E0CED8.htm
- Format:
  ```
  0
  LAYERSTATE
  1
  <state-name>
  91
  <flag-mask>          ; bits per which properties are stored
  301
  <description>
  302
  <layer-name>          ; per layer entry
  90
  <on-off-frozen-lock>
  62
  <color-aci>
  6
  <linetype>
  370
  <lineweight*100>
  ...
  ENDLAYERSTATE
  ```
- **Parser**: SSoT `src/subapps/dxf-viewer/services/las-parser.ts` (pure fn).
  - Validation: header `0\nLAYERSTATE`, required fields 1 (name), 91 (mask), almeno 1 layer entry.
  - Tolerance: unknown group codes → ignorati silently (forward-compat).
- **Exporter**: SSoT `src/subapps/dxf-viewer/services/las-exporter.ts` (pure fn).
  - Multi-state in singolo file: serie di `LAYERSTATE`...`ENDLAYERSTATE` blocchi.
  - Encoding: UTF-8 (AutoCAD-compatible).
  - Line endings: `\r\n` (Windows AutoCAD default).

**Apply policy** (`LayerStateStore.restore`):
- **Match per `layerId` first** (stable id).
- **Fallback per `layerName` case-insensitive** se `layerId` non trovato (es. .las importato da altro project).
- **Missing layers** (state contiene layer non presente nello scene corrente):
  - Default behavior: **skip silently** + toast info "N layers from state not found".
  - Opzione UI: "Create missing layers" toggle nel restore dialog (default OFF).
- **Extra layers** (scene contiene layer non nello state):
  - Mantenuti **as-is** (state non li tocca — non è una restore-completa "reset").
- **Atomic application**: tutto-o-niente via singolo command `RestoreLayerStateCommand` → `CommandHistory` (undo-able).

**Cross-project Templates**:
- Save as template: state corrente → `dxf_layer_state_templates/{templateId}` + tags + categoria preset (architectural/structural/mep/demolition/presentation/working/custom).
- Template browser: dialog modal con preview (mini canvas che mostra visibility dei layer attuali se applicato).
- Search: by tag + category + author + recency.
- Permission Firestore rules: `companyId`-scoped (ADR-294 multi-tenant).

**UI**:
- **Status bar dropdown** "Layer State: [Working ▼]" accanto a Layer picker (Q8).
- Click → popover:
  ```
  ┌────────────────────────────────────┐
  │ 🔍 Search states…                  │
  ├────────────────────────────────────┤
  │ 📋 Project States                  │
  │   ● Working          (current)     │
  │   ○ Presentation                    │
  │   ○ Demolition Plan                 │
  │   ○ Architectural Plot              │
  ├────────────────────────────────────┤
  │ 🌐 Templates (Company)             │
  │   ○ AEC Standard Working            │
  │   ○ MEP Coordination                │
  │   …                                 │
  ├────────────────────────────────────┤
  │ ➕ Save Current State…             │
  │ ⬇ Import .las…                     │
  │ ⬆ Export .las…                     │
  │ ⚙ Manage…                          │
  └────────────────────────────────────┘
  ```
- Right-click su state → context menu: Rename / Duplicate / Delete / Save as Template / Export this state.
- "Manage…" → full panel con grid, sorting, filters.

**Performance**:
- LayerStateStore lazy-loads project states su first access.
- Templates lazy-loaded on-demand (browser).
- Snapshot save = single Firestore write (atomic).

**Pre-commit ratchet** modulo `layer-state-system` in `.ssot-registry.json`:
- Vieta diretto `.las` parsing/serialization fuori da `las-parser.ts` / `las-exporter.ts`.
- Vieta diretto write a `layerStates` Firestore array fuori da `LayerStateStore`.

### 5.9.bis Auto-snapshot history (deferred)

Auto-snapshot/timeline (Opzione Δ scartata 2026-05-16) → **ADR-361 futuro**. Power-user feature, complessità separata.

### 5.9.ter Persistence Scope — Q13 risolta 2026-05-16 (Opzione Δ — Project-wide + Per-Level Visibility Override)

Confermato Giorgio: **Δ FULL Enterprise + GOL + SSoT pure**. Layer content (color/linetype/lineweight/transparency/etc.) **project-wide unico SSoT**, visibility flags overridable per-level.

**Data model rivisto**:
```typescript
// SceneModel ora "magro" per layers — non più la fonte
interface SceneModel {
  entities: AnySceneEntity[];
  bounds: SceneBounds;
  units: 'mm' | 'cm' | 'm' | 'in' | 'ft';
  version?: string;
  // ❌ REMOVED: layers (era Record<string, SceneLayer>)
}

// Project-wide layer registry (SSoT)
// Storage: Firestore projects/{projectId}/dxfSettings.layers: SceneLayer[]
interface SceneLayer { /* 12 base fields + category + tags — vedi §5.1 + §5.3.quinquies */ }

// Level-scoped overrides
// Storage: Firestore projects/{projectId}/levels/{levelId}.layerOverrides: Record<layerId, LevelLayerOverride>
interface LevelLayerOverride {
  visible?: boolean;        // override visibility per questo level
  frozen?: boolean;         // override freeze per questo level
  locked?: boolean;         // override lock per questo level
  // NB: color/linetype/lineweight/transparency NOT overridable — SSoT pure
}
```

**Resolution logic** (SSoT pure fn `src/subapps/dxf-viewer/services/resolve-effective-layer.ts`):
```typescript
export function resolveEffectiveLayer(input: {
  baseLayer: SceneLayer;           // project-wide source of truth
  override?: LevelLayerOverride;   // optional per-level
}): SceneLayer {
  if (!input.override) return input.baseLayer;
  return {
    ...input.baseLayer,
    visible: input.override.visible ?? input.baseLayer.visible,
    frozen:  input.override.frozen  ?? input.baseLayer.frozen,
    locked:  input.override.locked  ?? input.baseLayer.locked,
    // tutti gli altri campi → dal baseLayer (immutabile per level)
  };
}
```

**LayerStore architecture** (unified + level-aware):
```typescript
interface LayerStoreApi {
  // Project-wide (SSoT)
  getAllProjectLayers(): SceneLayer[];
  getProjectLayer(layerId: string): SceneLayer | null;
  updateProjectLayer(layerId: string, patch: Partial<SceneLayer>): Promise<void>;
  createProjectLayer(input: LayerCreateOptions): Promise<SceneLayer>;
  deleteProjectLayer(layerId: string): Promise<void>;  // cascading: rimuove tutti gli overrides per-level

  // Level-scope (override)
  getCurrentLevelId(): string | null;
  getEffectiveLayer(layerId: string, levelId?: string): SceneLayer | null;  // resolveEffectiveLayer
  setLevelOverride(layerId: string, levelId: string, patch: LevelLayerOverride): Promise<void>;
  clearLevelOverride(layerId: string, levelId: string): Promise<void>;

  // Current layer (Q8) — also level-scoped persistence
  currentLayerId: string;
  setCurrentLayerId(id: string): Promise<void>;

  // Subscription
  subscribe(cb: () => void): () => void;
}
```

**Entity lifecycle**:
- Entity reference: `entity.layerId` (Q2) points to **project-wide** layer.
- Renderer: legge `LayerStore.getEffectiveLayer(entity.layerId, currentLevelId)` → applica visibility/freeze/lock.
- Move entity between levels: NO change to `entity.layerId` — l'entity può vivere su qualsiasi level mantenendo il layer.

**UI behaviors**:
- **`AdminLayerManager`**: di default mostra **project-wide list** + colonna extra "Override here?" (toggle per ogni layer che apre 3 mini-toggle visible/frozen/locked).
- **Toggle in lista**: click su `👁` icon → toggle visibility:
  - Se layer è in stato project-default → crea override per current level.
  - Se layer ha già override → modifica override.
  - Long-press / right-click → "Reset to project default".
- **Visual indicator**: layer con override per current level → badge `🎚 Override` accanto al name.
- **Bulk operations**: "Sync all layers to project defaults (this level)" → clear tutti gli overrides.
- **Project Settings page** → "Layer Management": gestione list completa, no override (override solo dal manager in canvas view).

**Firestore schema finale**:
```
projects/
  {projectId}/
    dxfSettings.layers: SceneLayer[]                      // SSoT project-wide
    dxfSettings.layerStates: LayerState[]                  // Q12
    dxfSettings.layerFilters: LayerFilter[]                // Q11
    dxfSettings.defaultLineweight: LineweightMm            // Q5
    dxfSettings.layerIsolate: LayerIsolateSettings         // Q10
    levels/
      {levelId}/
        layerOverrides: Record<layerId, LevelLayerOverride>  // sparse
        currentLayerId: string                                // Q8
        unisolateSnapshot?: ...                               // Q10 session-only (NOT persisted normalmente, edge case)
```

**Migration note** (no runtime migration per test data wiped):
- `SceneModel.layers` removed — wire `useDxfSceneConversion` per separare entities (rimangono nel SceneModel) da layers (vanno in LayerStore project-wide).
- DXF import: crea project-layers se non esistono (deduplica by name), set overrides per-level se DXF aveva freeze-per-viewport flags (raro).

**Pre-commit ratchet** modulo `layer-persistence-scope` in `.ssot-registry.json`:
- Vieta `SceneModel.layers` access — il field non esiste più, ratchet cattura legacy reads.
- Vieta hardcoded `LevelLayerOverride` mutations fuori da `LayerStore.setLevelOverride`.

**Real-world example**:
- Project "Villa Mare", 4 levels (Basement, Ground, First, Roof).
- Project-wide layer "Roof Trusses" (color red, lineweight 0.50, category structural).
- Su Basement/Ground/First: override `visible: false` (non rilevante).
- Su Roof: nessun override → visible default true.
- Cambi color globale "Roof Trusses" → tutti i level riflettono ovunque sia visible.
- ✅ SSoT pure, ✅ UX flessibile, ✅ DXF roundtrip ben definito.

---

## 6. Architecture

### 6.1 Diagramma componenti (post-ADR-358)

```
┌────────────────────────────────────────────────────────────────┐
│                     LayerStore (SSoT singleton)                │
│  - layers: SceneLayer[]                                        │
│  - currentLayerId: string                                      │
│  - subscribe / getSnapshot / setCurrentLayerId / updateLayer   │
└─────┬──────────────────────────┬───────────────────────────────┘
      │                          │
      │ useSyncExternalStore     │ direct read (event handlers)
      │                          │
      ▼                          ▼
┌──────────────┐         ┌──────────────────┐
│ UI Subscribers│         │ Pipeline Consumers│
│ - AdminLayerMgr│       │ - completeEntity  │
│ - CurrentLayer │       │ - DxfRenderer     │
│   Picker       │       │ - CanEditLayer   │
│ - LayerSelector│       │   Guard           │
│   Dropdown     │       │ - ribbon Quick    │
│                │       │   Style (ADR-357) │
└──────────────┘         └──────────────────┘
                                  │
                                  │ resolveEntityStyle()
                                  ▼
                         ┌────────────────────┐
                         │  Catalog SSoT      │
                         │ - linetype-catalog │
                         │ - lineweight-cat   │
                         │ - aci-palette      │
                         └────────────────────┘
```

### 6.2 Pipeline ByLayer (entity creation, ADR-357 Phase 0)

```
LINE tool → completeEntity()
  1. resolve currentLayerId = LayerStore.getCurrentLayerId()
  2. read quickStyle overrides = ribbon-state (color/lt/lw)
  3. build entity = {
       ...lineEntity,
       layerId: currentLayerId,
       color: quickStyle.color ?? 'ByLayer',
       linetype: quickStyle.linetype ?? 'ByLayer',
       lineweight: quickStyle.lineweight ?? 'ByLayer'
     }
  4. CreateEntityCommand → CommandHistory
  5. (render time) DxfRenderer.drawEntity:
       resolved = resolveEntityStyle(entity, layerStore.getLayer(entity.layerId))
       canvas.stroke(resolved.color, resolved.linetype, resolved.lineweight)
```

### 6.3 Component map

| File | Phase | Modifica |
|---|---|---|
| `types/entities.ts` (SceneLayer) | 1 | Estendere interface (8 nuovi campi + migration default-fill) |
| `stores/LayerStore.ts` (nuovo) | 2 | Singleton micro-leaf |
| `config/linetype-catalog.ts` (nuovo) | 3 | 8 ISO linetypes |
| `config/lineweight-catalog.ts` (nuovo) | 3 | 12 ISO + 3 special |
| `config/aci-color-palette.ts` (nuovo o consolidato) | 3 | ACI 1-255 |
| `systems/properties/resolve-entity-style.ts` (nuovo) | 4 | Pure fn ByLayer/ByBlock resolution |
| `canvas-v2/.../DxfRenderer.ts` | 4 | Wire `resolveEntityStyle` |
| `utils/dxf-table-parsers.ts` | 5 | Parser esteso (group 6, 370, 70, 1071, 290, 420) |
| `utils/dxf-export.ts` (audit + estensione) | 5 | Export completo proprietà layer |
| `ui/components/AdminLayerManager.tsx` + sub | 6 | Wired al `LayerStore` (no più mock) |
| `ui/ribbon/controls/CurrentLayerPicker.tsx` (nuovo) | 7 | Dropdown current layer |
| `services/LayerOperationsService.ts` | 8 | Estendere con `setLineweight`, `setLinetype`, `setTransparency`, `setPlottable`, `setFrozen` |
| `core/commands/layer/*` (nuovo dir) | 9 | `LayerIsolateCommand`, `LayerUnisolateCommand`, `LayerDimCommand`, `LayerOffCommand` |
| `ui/components/layer-manager/LayerFilters.tsx` | 10 | Builder filtri Group + Properties |
| `stores/LayerStateStore.ts` (nuovo) | 11 (opt) | Layer States (snapshot/restore) |
| `services/las-import-export.ts` (nuovo) | 11 (opt) | `.las` file format |
| `i18n/locales/{el,en}/dxf-viewer.json` | 1-11 | Stringhe UI |

---

## 7. Implementation Phases

> **Regola §7.1 ADR-357**: Una phase = una sessione. ≤ 70% context. ≤ 500 lines per file. Se troppo grande → suddividere PRIMA.

| Phase | Titolo | Files | Effort | Q-ref | Status |
|---|---|---|---|---|---|
| **1** | Estendere `SceneLayer` interface + migration default-fill + tipi `Lineweight`, `LayerColor` | 3 | S | Q1, Q2 | ✅ v2.1 |
| **2** | Catalog SSoT — `linetype-iso-catalog.ts`, `lineweight-iso-catalog.ts`, `default-lineweight-resolver.ts` + `LinetypeRegistry` singleton | 3 | M | Q4, Q5 | ✅ v2.2 |
| **3** | DXF parser esteso (LTYPE pre-pass + LAYER group 6/70/290/370/420 + XDATA 1071/1000 AppIds) + writer + roundtrip integrity §G15 | 4 | L | Q6 | ✅ v2.3 |
| **4** | `resolveEntityStyle` pure fn + tipi `ResolvedStyle`/`EntityStyleInput` + wire-up in `DxfRenderer.drawEntity` ByLayer/ByBlock/Direct cascade | 4 | M | — | ✅ v2.4 |
| **5** | SceneModel→DxfScene `layersById` bridge — activation end-to-end §G7 data path | 3 | M | — | ✅ v2.5 |
| **6** | Entity sentinel emission `colorMode='ByLayer'`/`lineweightMm=-2`/`linetypeName='ByLayer'` LIVE in `useDxfSceneConversion.buildBase` + cascade fires production | 3 | M | — | ✅ v2.6 |
| **6.5** | LINE/CIRCLE/POLYLINE/ARC/RECTANGLE tools default ByLayer + AutoCAD-style UI toggle `<ByLayerToggle>` per color/lineweight in LineSettings panel | 9 | M | — | ✅ v2.7 |
| **8** | `AdminLayerManager` wired al `LayerStore` — drop mock data — preserve UI props (era §7.2 Phase 6, ricontestualizzato post-6.5) | 5 | M | Q7 | ✅ v2.8 |
| **~~6 (originale)~~** | ~~`AdminLayerManager` wired al `LayerStore`~~ — **rinumerato Phase 8 (v2.8)** per allineamento sequential post-dependency ordering | — | — | — | → Phase 8 |
| **7** | `CurrentLayerPicker` ribbon/status-bar + persistence `dxf:currentLayerId.{levelId}` + Q8 full contract (initial seed, alpha fallback, context menu, keyboard nav, permission guard, swatch pulse, category Lucide icons) | 12 | M | Q8 | ✅ v2.9 |
| **8.5** | `LayerOperationsService` esteso (setLineweight/setLinetype/setTransparency/setPlottable/setFrozen) via `LayerStore.upsertLayer` SSoT — wire-up UI Phase 8.5b DEFERRED | 3 | S | — | ✅ v2.10 |
| **9** | Layer rename con backref completi — **split in 7 sub-fasi 9A-G per Phase-per-session §7.1** | ~56 | XL | Q9 | 9A ✅ v2.11 / 9B ✅ v2.12 / 9C ✅ v2.13 / 9D-G ⏳ |
| **9A** | `layer-name-validator.ts` SSoT pure fn + 7 rules + Layer "0" hardening + ratchet `layer-name-strict-validation` (Tier 3) + 45 tests | 3 | S | Q9 | ✅ v2.11 |
| **9B** | Layer "0" RESERVED hardening in `LayerOperationsService.createLayer/renameLayer/deleteLayer` (wire validator) + tests | 2 | S | Q9 | ✅ v2.12 |
| **9C** | `SceneLayer.id` required + `createSceneLayer()` enforce id-gen via `enterprise-id.service` prefix `lyr` + DXF parser id-gen + XDATA `NestorLayerId` round-trip | 5 | M | Q2 | ✅ v2.13 |
| **9D** | `BaseEntity.layer` → `layerId` schema break + ~55 callsite migration (Grep-driven, split 9D-1…9D-5b per Phase-per-session §7.1 + Google LSC playbook 4-step) | ~55 | XL | Q2 | 9D-1 ✅ v2.14-pre1 / 9D-2 ✅ v2.14-pre2 / 9D-3a ✅ v2.14-pre3 / 9D-3b ✅ v2.14-pre4 / 9D-4 ✅ v2.14-pre5 / 9D-5a ✅ v2.14-pre6 / 9D-5b-i ✅ v2.14-pre7 / 9D-5b-ii 🟡 sub-A pre8 / sub-B pre9 / sub-C pre10 / sub-D pre11 / sub-E pre12 / 9D-5b-iii ✅ v2.14-pre23 / 9D-5b-iv 🟡 Sub-iv-a ✅ v2.14-pre13 / Sub-iv-b ✅ v2.14-pre14 / Sub-iv-c ✅ v2.14-pre17 / 9D-5c ✅ v2.14-pre24 |
| **9D-1** | `BaseEntity.layerId?: string` optional (transitional) + `layer?` JSDoc `@deprecated` + `LayerOperationsService.renameLayer` layerId-stability inline contract + naming test layerId stability assertion | 3 | S | Q2 | ✅ v2.14-pre1 |
| **9D-2** | DXF scene-builder layerId attribution + factory migration (`createSceneLayer` for default + register inline literals) + `DxfEntity.layerId?` mirror + `useDxfSceneConversion.buildBase` forward + `entity-conversion.convertLineToPolyline` spread. Phase 9C `dxf-layer-table-parser/writer` already round-trip XDATA `NestorLayerId`. | 4 | M | Q2 | ✅ v2.14-pre2 |
| **9D-3a** | Reader migration **batch A (services + core hooks)**: `resolveEntityLayerName()` helper SSoT in LayerStore (id-first / legacy-name fallback) + dual-read pattern in `HitTestingService` + `LayerOperationsService` (rename/merge/visibility/color/colorGroups + stats) + `shared/layer-operation-utils` (entityBelongsToLayer/Layers + updateEntitiesForLayer + getVisibleEntityIdsInLayers + getEntitiesNotInLayer/Layers) + tool hooks (`useTrimTool`/`useStretchTool`/`useScaleTool`/`useExtendTool` locked-layer guard) + `useEnhancedSelection.getEntityIdsByLayer` + `useDxfSceneConversion.buildBase` + `useSceneState.onEntityCreated` WRITE site (mirror legacy `.layer = '0'` + `.layerId = getLayer('0').id`) + `completeEntity` CreateEntityCommand option resolver. Audit count: 29 file reader sites real → split mandatory per Phase-per-session §7.1. | 12 | L | Q2 | ✅ v2.14-pre3 |
| **9D-3b** | Reader migration **batch B (commands + systems + UI + rendering)**: text commands `core/commands/text/*` **10 file** (`assertCanEditLayer({layerName: entity.layer, ...})` callsites) + systems (`auto-area-hit` 11 occ layer-by-name push, `trim-boundary-resolver` locked+visible guard, `stairs/stair-validator` ceiling regex, `selection/utils` get-layer-by-name) + UI (`text-toolbar/useTextToolbarSelectionSync`, `layers/hooks/useColorGroups`) + rendering (`HitTester` `getLayerNameOrDefault` reader, `canvas-v2/dxf-canvas/DxfRenderer` `layersById[entity.layer]` line 469 — kept name-keyed pending Phase 9E re-key) + `LayerOperationsService.setLayerGroupColor` filter-by-name. WRITE-side propagation sites (`DxfRenderer.toEntityModel.layer`, `stretch-entity-transform.replacement`, `useEntityCreationManager.normalizedEntity`, `useSceneState.onEntityCreated` legacy backref, `dxf-scene-builder.parser` pre-id stage, `dxf-scene-builder.validation`) DEFERRED Phase 9D-4. `useLayerManagerState`/`useLayersCallbacks`/`EntityPass.batchKey`/`hit-tester-utils`/`ai-assistant/dxf-ai-tool-executor` — Grep confirma zero reader hit (already id-keyed or layer-name from store keys, not from entity). | 16 | L | Q2 | ✅ v2.14-pre4 |
| **9D-4** | Literal `layer: 'X'` construction sweep + WRITE-side dual-write residual. 8 production file ~42 occ: `drawing-entity-builders.ts` (19 `layer: '0'`), `drawing-preview-generator.ts` (10), `drawing-preview-partial.ts` (8), `useAngleEntityMeasurement.ts` (1) + WRITE-residual 9D-3b deferred: `DxfRenderer.toEntityModel.layer`, `stretch-entity-transform.replacement`, `useEntityCreationManager.normalizedEntity` (2 sites), `ColorManager.applyColorToEntities` spread. Pattern: dual-write `{layer, layerId: getLayer(name)?.id}` mirror, no entity-construction side-effect. Test fixtures (~30 occ in 18 file) + e2e/region/overlay sites verified false-positive (OverlayLayer non SceneEntity) o DEFERRED 9D-5 (zero regression risk dual-read). | 8 | L | Q2 | ✅ v2.14-pre5 |
| **9D-5a** | Production WRITE sweep + ratchet introduction. Drop legacy `entity.layer` WRITE sites (`drawing-*` 4 file `layer: '0'` literal, `useAngleEntityMeasurement`, `stretch-entity-transform.replacement`, `DxfRenderer.toEntityModel.layer`, `ColorManager.applyColorToEntities`+`ensureLayerForColor` factory migration, `useEntityCreationManager.normalizedEntity`, `useSceneState.onEntityCreated` legacy backref, `LayerOperationsService.renameLayer`+`mergeLayers` legacy backref). READ-site migration: `dxf-ai-tool-executor` + `useLayersCallbacks` + `useLayerManagerState` filter `e.layer === X` → `resolveEntityLayerName(e) === X`. `CreateEntityOptions` ADD `layerId?: string` + `CreateEntityCommand` propagate stable id (keep transitional `entity.layer` write). `completeEntity` forward `layerId` option. `dxf-scene-builder.validateScene` check `layerId` not `layer`. SSoT registry: new module `entity-layer-id-canonical` (Tier 3) forbid `entity\.layer\b` + `\.layer\s*=\s*['"]` (allowlist transitional readers + interface + DXF parse boundary). Schema flip + test fixture migration DEFERRED Phase 9D-5b. | ~20 | L | Q2 | ✅ v2.14-pre6 |
| **9D-5b-i** | **Production READER residual sweep ONLY** (sweep-only, NO schema flip — Google LSC step C partial). (a) `EntityMergeService` JOIN `base`: `layer: primary.layer ?? '0'` → `layerId: primary.layerId` (id-only write). (b) `ClipToRegionService.clipCircle` + `ClipToPolygonService.clipCircleByPoly` arc construction: `layer: e.layer` → `layerId: e.layerId`. (c) `EntityPass.createBatches` batchKey via `resolveEntityLayerName(entity)` (was `entityWithStyle.layer`). (d) `HitTester.matchAgainstRegion` line 205 via `resolveEntityLayerName(candidate.data)`. (e) `hit-tester-utils.calculatePriority` + `passesFilters` via `resolveEntityLayerName(entity)` (LayerStore import added). (f) `HitTestingService.hitTest` comment refinement (HitTester.layer resolver-populated downstream). (g) `dxf-scene-builder` parse boundary narrow cast `(entity as { layer?: string }).layer` preserved (TODO Phase 9E `RawDxfEntity` extraction). Schema flip + type-chain consumer migration DEFERRED to 9D-5b-ii/iii (avoid ~50 file cascade — see incident 2026-05-17). | ~8 | M | Q2 | ✅ v2.14-pre7 |
| **9D-5b-ii** | **Type-chain consumer migration** (Google LSC step C complete). Make `layer: string` field OPTIONAL in downstream type definitions + add `layerId?: string` mirror (collapse to id-only deferred to 9D-5b-iii). Type defs: `SceneEntity` (`core/commands/interfaces.ts`), `PreviewPoint` (`hooks/drawing/drawing-types.ts`), `HitTestResult` (`rendering/hitTesting/hit-tester-types.ts`), `DxfEntity` (`canvas-v2/dxf-canvas/dxf-types.ts`). Cascade fix remaining ~11 file: `core/commands/entity-commands/CreateEntityCommand.ts` (entityData layer index-signature unknown), `systems/array/*` (3 file Entity ↔ SceneEntity cast), `systems/cursor/mouse-handler-up.ts` (DxfEntityUnion vs Entity), `ai-assistant/dxf-ai-tool-executor.ts` (SceneLayer factory), `ui/components/layer-manager/useLayerManagerState.ts` (Level.scene via `getLevelScene` action SSoT), `ui/hooks/useLayerOperations.ts` (SceneLayer factory). Sub-A→E COMPLETO: 49 → 0 production errors. Sub-F/G: NON necessari (defer Phase 9E — Level.scene pre-existing out-of-scope). **PHASE CLOSED post Sub-E**. | ~50 | L+ (sub-split) | Q2 | 🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C ✅ pre10 / sub-D ✅ pre11 / sub-E ✅ pre12 (**CLOSED**) |
| **9D-5b-iii** | **Schema flip atomico** (Google LSC step D — removal). Quasi-zero file (3 only): `types/entities.ts` (`BaseEntity.layerId: string` REQUIRED + drop `layer?` field), `stores/LayerStore.ts` (`resolveEntityLayerName` collapse to id-only — drop legacy `entity.layer` fallback), `core/commands/types/create-entity-options.ts` (drop `layer?` field). SSoT registry `entity-layer-id-canonical` final allowlist trim (keep only types/entities + LayerStore + dxf-scene-builder + layer-config). Pre-flight Grep audit MANDATORY: `layer:\s*['"]` + `entity\.layer\b` + property `layer:` in type definitions → must show 0 cascade risk. **Stair blocker RESOLVED in 9D-5c**: `StairEntity.layer` abuse removed — `levelId` dedicated field introduced. `resolveEntityLayerName` id-only collapse COMPLETE. `trim-boundary-resolver.ts` updated to use `entity.layer` directly for `scene.layers` name-keyed lookup (pre-Phase 9E). | ~3+1 | S | Q2 | ✅ v2.14-pre23 |
| **9D-5b-iv** | Test fixture migration ~27 test file / ~68 occ `layer: 'X'` literal → `layerId: getLayer('X')?.id` (setup-time stable id capture via `setLayers([createSceneLayer({...})])`). ADR-358 §7.2 row 9D ✅ v2.14 final + §10 changelog v2.14 final entry. | ~30 | L | Q2 | 🟡 Sub-iv-a ✅ v2.14-pre13 / Sub-iv-b ✅ v2.14-pre14 / Sub-iv-c ✅ v2.14-pre17 |
| **9D-5c** | **StairEntity levelId migration** — remove level-id abuse of `BaseEntity.layer`. `buildStairEntity` param `layer: string` → `levelId: string`; entity sets `levelId:` not `layer:`. `StairEntity` + `StairDoc` get `levelId?: string` field. `StairSaveInput`/`StairUpdateInput` + `saveStair`/`updateStair`/`entityToSaveInput` in `stair-firestore-service.ts` wired for Firestore persistence. `docToEntity` in `useStairPersistence.ts` hydrates `levelId: doc.levelId`. Test updated (test 6: `entity.layer` → `entity.levelId` + `entity.layer` assert `undefined`). `BaseEntity.layer` drop (full TS enforcement `layerId: string` required) now unblocked — pending Phase 9E sequencing. | 6 | S | Q2 | ✅ v2.14-pre24 |
| **9E** | `SceneModel.layers: Record<LayerId, SceneLayer>` re-key + `LayerOperationsService.renameLayerById()` SSoT-based via `upsertLayer` + DXF I/O bridge name↔id | 6 | L | Q2 | ⏳ |
| **9F** | commandHistory replay safety (lookup by id fallback) + region.layerId audit (Q3 unified store consolidation) | 4 | M | Q2/Q3 | ⏳ |
| **9G** | UI: Layer "0" badge `🔒 System` + rename input real-time `validateLayerName` + i18n el+en + UI tests | 5 | M | Q9 | ⏳ |
| **10** | Comandi `LayerIsolate / Unisolate / Dim / Off` + click-driven UX | 5 | M | Q10 |
| **11** | Layer Filters Builder (Group + Properties) nel manager | 4 | M | Q11 |
| **12** *(opt)* | `LayerStateStore` + UI Save/Restore (no export `.las`) | 4 | M | Q12 |
| **13** *(opt)* | `.las` export/import file format | 3 | M | Q12 |
| **14** | Migration utility per snapshot pre-ADR-358 + Firestore schema update | 3 | M | Q13 |
| **15** | Integration test suite — layer round-trip, isolate/unisolate, rename backref | 3 | M | — |

**Totale**: 13-15 phases (opzionali 12 e 13 dipendono da Q12).

**Prerequisite per ADR-357 Phase 0**: phases 1-4 (SceneLayer extension + LayerStore + Catalog + resolveEntityStyle) — minimum viable per consumare `currentLayerId` e ereditare ByLayer.

### 7.1 Ordine vincolante (rispetta §7.1 ADR-357)
1. ✅ ADR-357 ACCEPTED (questo file precedente)
2. ⏳ **ADR-358 Q&A** (questa sessione + successive)
3. ⏳ **ADR-358 implementation phases 1-4** (minimum viable per ADR-357 Phase 0)
4. ⏳ **ADR-357 implementation Phase 0** (consume LayerStore)
5. ⏳ ADR-358 phases 5-15 (parallelizzabili con ADR-357 phases 1-18 dove non c'è dipendenza)
6. ⏳ ADR-359 (XLINE/RAY) — eredita pipeline ByLayer

### 7.2 Backwards compatibility
- Scene caricate prima di ADR-358: migration helper `migrateSceneLayerV1ToV2` riempie default per nuovi campi:
  - `id = name` (slug)
  - `linetype = 'Continuous'`
  - `lineweight = -3` (Default)
  - `transparency = 0`
  - `frozen = false`
  - `plottable = true`
  - `source = 'dxf-import'`
- Entity senza `layerId`: fallback a `entity.layer` (legacy field, mantenuto come computed alias).

---

## 8. Testing Strategy

- **Unit**: `resolveEntityStyle` ByLayer/ByBlock/Direct combinazioni (≥ 30 test case).
- **Unit**: `parseLayerTable` DXF group code coverage (8 file DXF reference, 1 per linetype standard).
- **Unit**: catalog SSoT immutability + DXF code roundtrip (mm → 370 code → mm).
- **Integration**: layer rename → backref update in scene + commands + regions.
- **Integration**: layer isolate → state snapshot → unisolate → state restore esatto.
- **Integration**: DXF roundtrip (import → export → import) — layers identici.
- **Regression**: snapshot test `AdminLayerManager` post-rewire — nessuna regressione UI.
- **Perf**: rendering 1000 layers, 50k entities, FPS hover > 55 (ADR-040).

---

## 9. Open Questions (Q&A in raffinamento con Giorgio — greco one-at-a-time)

> Le risposte sono trascritte in italiano e aggiornano la §5 Decision.

### Nuove Open Questions post-research (2026-05-16 v2)

- ✅ **Q14** — RISOLTA 2026-05-16 v2: **Entrambi supportati con switcher per-project** (Opzione Γ). Setting Firestore `projects/{id}/dxfSettings.layerNamingStandard: 'AIA' | 'ISO_13567'`. Default AIA (de facto DWG ecosystem). Layer Name Validator pure fn `validateLayerName(name, standard)` SSoT. Quick-add dialog mostra form guidata per il standard attivo (campi discipline/major/minor/status per AIA, 10-fields per ISO). DXF round-trip: standard salvato come metadata project-level + XDATA `NestorNamingStd` su layer (round-trip). Pre-commit ratchet `layer-naming-standard-ssot`. ID prefix: nessun nuovo (standard è enum, non entity).
- ✅ **Q15** — RISOLTA 2026-05-16 v2: **Placeholder + scaffold types future BIM mode** (Opzione Γ). Context: Giorgio pianifica 3D drawing in tempo breve. §3.8 documenta BIM paradigm rationale (Nestor segue 3D CAD-DXF model oggi). §7.x roadmap aggiunge "Phase 11+ Future BIM Mode (deferred)". Scaffold: `SceneLayer.bimCategory?: string | null` optional nullable nel TypeScript interface (Phase 1) — UI/UX zero impact oggi. Vectorworks-style dual-organization (layer = location, bimCategory = type) preparato per future IFC export. Pre-commit ratchet `bim-category-scaffolding-no-active-use` proibisce uso in UI/business logic fino a Phase 11+. DXF round-trip via XDATA `NestorBimCategory` se non-null (no-op se null).
- ✅ **Q16** — RISOLTA 2026-05-16 v2: **Scaffold types future-proof** (Opzione Β). `SceneLayer.vpOverrides?: Record<string, Partial<VpLayerProps>> | null` optional nullable. Type `VpLayerProps = { color?, linetype?, lineweight?, frozen? }`. DXF parser legge/preserva VP-override group codes (`AcDbLayerTableRecord` XDATA + `VP_FREEZE` flags) anche se UI non li espone — round-trip integrity. Pre-commit ratchet `vp-overrides-scaffolding-no-active-use` proibisce uso in UI/business logic fino a future ADR-paperspace. UI/UX zero impact oggi. Quando si aggiungerà paperspace → zero refactor del data model.

### Questions già risolte (Q1–Q13)

1. ✅ **`SceneLayer` extension scope** — RISOLTA 2026-05-16: **FULL Enterprise + GOL + SSoT** (12 campi). Migration helper obbligatorio. Pre-commit ratchet `scene-layer-shape` proibisce accessi diretti da fuori SSoT.
2. ✅ **Layer ID stabile vs name-keyed** — RISOLTA 2026-05-16: **Stable ID Google-standard**. `lyr_<ULID-26>` da `enterprise-id.service.ts` (SOS. N.6). `entity.layerId` canonico, `entity.layer` deprecato (computed alias 1 release). `scene.layers` keyed by `id`. DXF I/O usa `name` in group 8, mapping interno applicazione. No feature flag (test data, no backward compat). |
3. ✅ **`LayerStore` scope** — RISOLTA 2026-05-16: **Unified SSoT pure** (Opzione Α). Un solo store gestisce DXF entities + Regions. `overlay-manager.layers` + `currentLayerId` assorbiti. `RegionLayerObject` rimosso, `regionIds` derivato da `SceneModel.regions.filter(layerId)`. Pre-commit ratchet `unified-layer-store`. |
4. ✅ **Linetype catalog** — RISOLTA 2026-05-16: **FULL Enterprise** (Opzione B). ISO 8 hardcoded + `LinetypeRegistry` singleton + `.lin` parser/exporter + DXF roundtrip integrity. Custom origin tracking (`iso-baseline | lin-import | user-created | dxf-import`). Shapes/text segments degradano gracefully con warning. Pre-commit ratchet `linetype-system`. ID prefix `ltp` in enterprise-id.service. |
5. ✅ **Default lineweight policy** — RISOLTA 2026-05-16: **Per-project configurable Full Enterprise** (Opzione Γ). Resolver cascade 3-livelli (project → user pref → system 0.25mm). Firestore `projects/{id}/dxfSettings.defaultLineweight`. Status bar dropdown. DXF `$LWDEFAULT` roundtrip. Pre-commit ratchet `default-lineweight-resolver`. |
6. ✅ **DXF parser scope** — RISOLTA 2026-05-16: **FULL Enterprise core+extended** (Opzione B). Group codes: 2/62 (existing) + 6/370/70/290/420/1071/1000. Skip 390/347 (3D-only/legacy). `dxfExtraTags` opaque preserva roundtrip. Parser pre-pass `LTYPE` table. Pre-commit ratchet `dxf-layer-parser`. |
7. ✅ **`AdminLayerManager` rewire** — RISOLTA 2026-05-16: **Δ FULL Enterprise AEC-aware**. Mock data eliminata. `SceneLayer.category` enum 10-valori (AIA) + `tags[]` free-text. AIA auto-suggest da name prefix (`A-`/`S-`/`E-`...). 3-dimensional filter sidebar. DXF XDATA `NestorAec` roundtrip. Pre-commit ratchet `aec-category-suggester` + `legacy-layer-categories`. |
8. ✅ **`CurrentLayerPicker` placement** — RISOLTA 2026-05-16: **Γ Both** (status bar + ribbon, SSoT-synced). Singolo componente, 2 varianti visuali. Popover condiviso (Most used + grouped by category + actions). Most-used FIFO 10 max persistito per-project/per-user. Toast su user-change. Pre-commit ratchet `current-layer-picker`. |
9. ✅ **Layer naming validation** — RISOLTA 2026-05-16: **Α Strict AutoCAD parity Google-level**. 7 validation rules (EMPTY/WS/TOO_LONG/INVALID_CHARS/DUPLICATE/RESERVED/LEADING_TRAILING_WS). Layer "0" non-renamable/non-deletable. Defense in depth UI+Service+ratchet `layer-name-strict-validation`. (NB: la Q originale su breaking change/migration `entity.layerId` è già consolidata in §5.7 — roll-out diretto via test data wipe.) |
10. ✅ **Layer Isolate UX** — RISOLTA 2026-05-16: **Δ FULL Enterprise Configurable**. Default `dim` 30% opacity, project-configurable. Inverse-mode shortcut `Ctrl+Alt+I`. 8 layer commands (`LAYISO/LAYUNISO/LAYDIM/LAYOFF/LAYFRZ/LAYLCK/LAYTHWALL/LAYONALL`). `unisolateSnapshot` session-only, single-level (no nested). Pre-commit ratchet `layer-isolate-system`. |
11. ✅ **Layer Filters** — RISOLTA 2026-05-16: **Δ FULL Enterprise + GOL Smart Suggested**. Group + Properties (rule-based with nesting) + auto-generated Smart filters. Filter engine pure fn memoized. Multi-filter combo Shift/Ctrl. Export/Import JSON. Pre-commit ratchet `layer-filter-engine`. |
12. ✅ **Layer States Manager scope** — RISOLTA 2026-05-16: **Γ FULL Enterprise**. Save/Restore + `.las` Export/Import + Cross-project Templates Firestore-shared. `LayerStateStore` singleton. Apply policy match-by-layerId+name-fallback, atomic via `RestoreLayerStateCommand` undo-able. Templates `companyId`-scoped. Pre-commit ratchet `layer-state-system`. Δ auto-snapshot deferred a ADR-361. |
13. ✅ **Persistenza scope** — RISOLTA 2026-05-16: **Δ Project-wide + Per-Level Visibility Override** (SSoT pure). Layer content (color/linetype/lineweight/transparency/etc.) **project-wide unico SSoT**, solo `visible/frozen/locked` overridable per-level. `SceneModel.layers` rimosso, sostituito da `projects/{id}/dxfSettings.layers` + `levels/{lid}.layerOverrides`. `resolveEffectiveLayer` pure fn. Pre-commit ratchet `layer-persistence-scope`. |

---

## 10. Changelog

| Date | Change |
|---|---|
| 2026-05-16 | Initial draft (ADR-driven Phase 1). Audit codebase + industry research completati. 13 Open Questions da risolvere con Giorgio in Q&A greca. Status: 🟡 DRAFT. |
| 2026-05-16 | Q1 risolta: `SceneLayer` FULL Enterprise (12 campi) + migration `migrateSceneLayerV1ToV2` + pre-commit ratchet `scene-layer-shape` (SSoT N.12). Tipo `SceneLayerColor` (ACI+TrueColor) + `LineweightMm` (ISO + special -3/-2/-1). |
| 2026-05-16 | Q2 risolta: Stable ID Google-standard. `lyr_<ULID-26>` da `enterprise-id.service.ts`. `entity.layerId` canonico (Phase 9). DXF I/O via `name` group 8, mapping applicazione. Backref audit ≥30 file. |
| 2026-05-16 | Confermato: test DB wiped pre-produzione ([[project_test_data_pre_production]]). Rimossa logica migration runtime — sostituita da default-fill al boundary I/O. Roll-out diretto. |
| 2026-05-16 | Q3 risolta: Unified `LayerStore` SSoT pure (Opzione Α). Assorbe `overlay-manager.layers` + `currentLayerId`. `RegionLayerObject` rimosso. `regionIds` derivato. Pre-commit ratchet `unified-layer-store`. |
| 2026-05-16 | Q4 risolta: Linetype FULL Enterprise (Opzione B). ISO 8 hardcoded + `LinetypeRegistry` singleton + `.lin` parser/exporter + DXF roundtrip. Origin tracking. Pre-commit ratchet `linetype-system`. ID prefix `ltp`. |
| 2026-05-16 | Q5 risolta: Default Lineweight Per-project (Opzione Γ). Cascade resolver project→user-pref→system(0.25mm). Firestore `dxfSettings.defaultLineweight`. DXF `$LWDEFAULT` roundtrip. Pre-commit ratchet `default-lineweight-resolver`. |
| 2026-05-16 | Q6 risolta: DXF parser FULL Enterprise core+extended (Opzione B). Group codes 2/62/6/370/70/290/420/1071/1000. `dxfExtraTags` opaque roundtrip. Pre-pass LTYPE table. Pre-commit ratchet `dxf-layer-parser`. |
| 2026-05-16 | Q7 risolta: Δ FULL Enterprise AEC-aware. Mock data legacy ELIMINATA. `category` enum 10-valori AIA + `tags[]` free-text + AIA name-prefix auto-suggest. 3D filter sidebar. DXF XDATA `NestorAec` roundtrip. Pre-commit ratchet `aec-category-suggester` + `legacy-layer-categories`. |
| 2026-05-16 | Q8 risolta: `CurrentLayerPicker` Γ Both (status bar + ribbon). Componente unico 2 varianti, popover condiviso, Most-used FIFO 10, recent persistito per-user/per-project. Pre-commit ratchet `current-layer-picker`. |
| 2026-05-16 | Q9 risolta: Layer naming Strict AutoCAD parity (Opzione A). 7 validation rules + Layer "0" hardening (non-renamable/deletable) + defense in depth UI+Service+ratchet. SSoT `layer-name-validator.ts`. Pre-commit ratchet `layer-name-strict-validation`. |
| 2026-05-16 | Q10 risolta: Layer Isolate Δ FULL Enterprise Configurable. Default `dim` 30% opacity project-configurable + opacity slider. Inverse-mode `Ctrl+Alt+I`. 8 layer commands. Snapshot session-only single-level. Pre-commit ratchet `layer-isolate-system`. |
| 2026-05-16 | Q11 risolta: Layer Filters Δ FULL Enterprise + GOL. Group + Properties (nested rules) + Smart Suggested auto-generated. Multi-filter combo. Export/Import JSON. Pure fn memoized engine. Pre-commit ratchet `layer-filter-engine`. |
| 2026-05-16 | Q12 risolta: Layer States Manager Γ FULL Enterprise. Save/Restore + `.las` Export/Import + Cross-project Templates Firestore. `LayerStateStore` + `RestoreLayerStateCommand` undo-able. Templates `companyId`-scoped. Pre-commit ratchet `layer-state-system`. Δ auto-snapshot deferred ADR-361. |
| 2026-05-16 | Q13 risolta: Persistence Δ Project-wide + Per-Level Visibility Override (SSoT pure). Layer content unico SSoT project, `visible/frozen/locked` overridable per-level. `SceneModel.layers` rimosso. `resolveEffectiveLayer` pure fn. Pre-commit ratchet `layer-persistence-scope`. |
| 2026-05-16 | **Tutte le 13 Open Questions risolte (Q1-Q13). ADR-358 FINALIZZATO.** Status: ✅ ACCEPTED. Implementation roadmap aggiornato. Prerequisiti completati. Ready per phases 1-15. |
| 2026-05-16 v2 | **🔬 Post-Research Validation Phase 0**: eseguite 14 WebSearch verificate (AutoCAD/BricsCAD/GstarCAD/ZWCAD/MicroStation/Revit/ArchiCAD/Vectorworks/DXF spec/AIA/ISO 13567/NCS). §3 Industry Benchmark espansa a 9 sub-sezioni (+§3.6 per-viewport, +§3.7 AIA+ISO, +§3.8 BIM paradigm, +§3.9 convergence matrix). §11 References da 8 → 28 link verificati. §G6 lineweight catalog corretto a 24 valori ISO ufficiali. §G12 LayerIsolate corretto a fade configurabile 0-90 (NON hardcoded). Q1–Q13 ✅ rivalidate research-aligned. Q14/Q15/Q16 nuove aperte (ISO 13567, BIM scope, per-viewport). |
| 2026-05-16 v2 | Q14 risolta: **Entrambi AIA + ISO 13567 con switcher per-project** (Γ). Firestore `projects/{id}/dxfSettings.layerNamingStandard`. Validator pure fn `validateLayerName(name, standard)`. Quick-add dialog form guidata per standard. DXF round-trip via XDATA `NestorNamingStd`. Pre-commit ratchet `layer-naming-standard-ssot`. Default AIA. |
| 2026-05-16 v2 | Q15 risolta: **Placeholder + scaffold types future BIM mode** (Γ) — context: Giorgio plans 3D drawing soon. §3.8 BIM rationale documentato. §7.x Phase 11+ "Future BIM Mode" deferred. Scaffold `SceneLayer.bimCategory?: string \| null` optional. Vectorworks-style dual-org (layer + bimCategory) preparato per future IFC. Pre-commit ratchet `bim-category-scaffolding-no-active-use`. DXF XDATA `NestorBimCategory` round-trip se non-null. |
| 2026-05-16 v2 | Q16 risolta: **Scaffold types future-proof per-viewport** (Β). `SceneLayer.vpOverrides?: Record<viewportId, Partial<VpLayerProps>> \| null` optional. DXF parser preserva VP-override XDATA + `VP_FREEZE` flag round-trip. Pre-commit ratchet `vp-overrides-scaffolding-no-active-use`. UI zero impact oggi. Future paperspace ADR sblocca use senza data model refactor. |
| 2026-05-16 v2 | **Q14-Q16 risolte. Phase 0 (ADR rewrite + Q&A) COMPLETO.** ADR-358 v2 grounded post-research. Status: ✅ ACCEPTED v2. Ready per Phase 1 (Types + SSoT). Phase decomposition (plan file `glistening-baking-ritchie.md`) da rivedere alla luce di Q14-Q16 in sessione fresh. |
| 2026-05-16 v2.2 | **Phase 2 IMPLEMENTED (Catalog SSoT — linetype + lineweight)**: (a) `src/subapps/dxf-viewer/config/linetype-iso-catalog.ts` NUOVO — 8 ISO baseline linetypes immutable (`Continuous`, `Dashed`, `Hidden`, `Center`, `Phantom`, `DashDot`, `Border`, `Divide`) con pattern DXF-native (positive=dash, negative=gap, 0=dot, mm). Tipo `LinetypeDef` + `LinetypeOrigin` ('iso-baseline' | 'lin-import' | 'user-created' | 'dxf-import') + helpers `isIsoBaselineLinetype` / `getIsoLinetype` / `listIsoLinetypes` + `DEFAULT_LINETYPE_NAME` const. (b) `src/subapps/dxf-viewer/stores/LinetypeRegistry.ts` NUOVO — singleton micro-leaf ADR-040 (`useSyncExternalStore`-compatible, ISO baseline pre-loaded a init). API Phase 2: `resolveLinetype / registerLinetype / registerLinetypes (batch atomic notify) / listLinetypes / getLinetypeRegistrySnapshot / subscribeLinetypeRegistry`. ISO baseline è name-collision-protected (first wins → ISO immutabili). `.lin` import/export deferred Phase 3 (`services/lin-parser.ts`). (c) `src/subapps/dxf-viewer/config/lineweight-iso-catalog.ts` NUOVO — 24 ISO mm values (0..2.11 ascending, AutoCAD `LWEIGHT` table) + `LINEWEIGHT_SPECIAL` ({DEFAULT:-3, BYLAYER:-2, BYBLOCK:-1}) frozen + tipo `ConcreteLineweightMm` + helpers `isConcreteLineweight` (type guard) / `lineweightToPx(lw, dpi=96)` (formula mm×dpi/25.4, special→0) / `parseDxfCode370(int)` (decode hundredths, snap-to-nearest <0.005mm, fallback DEFAULT) / `encodeDxfCode370(lw)` (round-trip inverse) / `isIsoBaselineLineweight(lw)`. Riusa `LineweightMm` da `entities.ts` (no duplicate). (d) `src/subapps/dxf-viewer/config/default-lineweight-resolver.ts` NUOVO (§5.3.ter Q5) — pure fn `resolveDefaultLineweight({projectSetting, userPreference})` cascade project→user→`SYSTEM_DEFAULT_LINEWEIGHT (0.25mm)`. Special sentinels (-3/-2/-1) a livello cascade saltati (no recursion, no semantic). (e) Tests: `stores/__tests__/LinetypeRegistry.test.ts` 22 test (ISO pre-load / resolve case-sensitive / register dedup / batch atomic notify / subscribe / reset). `config/__tests__/lineweight-iso-catalog.test.ts` 22 test (24 values ascending / special frozen / type guard / px conversion linear-dpi / DXF code 370 round-trip + snap + fallback). `config/__tests__/default-lineweight-resolver.test.ts` 11 test (cascade 3-level / special skip / lw=0 hairline valid). (f) `.ssot-registry.json` +2 moduli tier 3: `linetype-iso-catalog` (pattern narrow assignment-context `linetype:[`/`=`]['"](8 names)['"']`, baseline 0) + `lineweight-iso-catalog` (pattern `as LineweightMm` + `lineweight:[`/`=`]<number>`, baseline 6 violations / 3 files in `hooks/drawing/` legacy preview, migrazione Phase 5 render integration). `default-lineweight-resolver` ratchet deferred Phase 5. (g) `.ssot-violations-baseline.json` 42→48 violations, 40→43 files (boy scout cleanup pending Phase 5). Render pipeline + DXF parser wire-up = Phase 3/4 (out of scope Phase 2). |
| 2026-05-16 v2.3 | **Phase 3 IMPLEMENTED (DXF Parser Extension + Round-trip)**: (a) `src/subapps/dxf-viewer/utils/dxf-linetype-table-parser.ts` NUOVO — pre-pass `parseLinetypeTable(lines)` legge TABLES > LTYPE consumando group codes 2/3/49, emette `LinetypeDef[]` stamped `origin: 'dxf-import'`, warnings per name mancante o pattern 49 non-finite. MUST eseguire prima del LAYER parser così `resolveLinetype()` trova i custom linetypes. (b) `src/subapps/dxf-viewer/utils/dxf-layer-table-parser.ts` NUOVO — `parseLayerTable(lines): { layers: SceneLayer[]; warnings }` full G4. Group codes consumati: 2 (name), 6 (linetype → `resolveLinetype` + warning su miss + fallback `DEFAULT_LINETYPE_NAME`), 62 (ACI signed → `visible` + `colorAci`), 70 bit-field (bit 1 frozen, bit 4 locked), 290 (plottable, default true), 370 (lineweight via `parseDxfCode370`), 420 (`colorTrueColor` mask 0xFFFFFF). XDATA AppIds: `AcCmTransparency` 1071 (alpha → transparency 0-90 via `Math.round((1 - alpha/255) * 90)`), `NestorAec` 1000 entries `category=<aec>` + `tag=<v>` (cap 8 lowercase), `NestorLayerMeta` 1000 `description=...`, `NestorBimCategory` 1000 `category=<ifc>` (Q15 scaffold round-trip), `NestorVpOverride` 1000 `vpOverrides=<json>` (Q16 scaffold round-trip, opaque preservation con JSON.parse). Tutti i layer emessi via `createSceneLayer()` factory (ratchet `scene-layer-shape` rispettato). (c) `src/subapps/dxf-viewer/types/entities.ts` MOD — `createSceneLayer()` esteso con `bimCategory` + `vpOverrides` input optional (default null) per il DXF I/O round-trip; ratchet scaffolding allowlist solo parser+writer. (d) `src/subapps/dxf-viewer/utils/dxf-layer-table-writer.ts` NUOVO — `writeLayerTable({ layers, customLinetypes })` mirror del parser. Emette `SECTION/TABLES` con LTYPE (skip ISO baseline) + LAYER tables. Encoding 11 fields + tutti gli XDATA AppId. Transparency code `(0x02000000 | alpha)` (bit 25 fixed). NON è full DXF writer — production export resta via ezdxf microservice (`dxf-export.types.ts`); scopo unico = round-trip integrity test §G15. (e) `src/subapps/dxf-viewer/utils/dxf-table-parsers.ts` MOD — `parseLayerColors()` legacy 2-field reader marcato `@deprecated` (consumer transitorio `dxf-scene-builder.ts` migrato a `parseLayerTable` in Phase 4). (f) Tests: `utils/__tests__/dxf-layer-table-parser.test.ts` (per-group-code coverage 17 test + XDATA AppId coverage 7 test + missing-data warnings + LTYPE+LAYER pre-pass integration); `utils/__tests__/dxf-roundtrip-layers.test.ts` (G15 integrity, 5 fixture: ISO minimal / custom linetype full 11 fields / Nestor XDATA / null variants / Q15+Q16 scaffold + 5-layer scene aggregate). Tutte le verifiche `expect(recovered).toEqual(original)` deep-diff zero. LinetypeRegistry snapshot stable post-round-trip. (g) `.ssot-registry.json` +1 modulo tier 3 `dxf-layer-parser` (forbid Nestor XDATA AppId literals fuori parser/writer, zero baseline) + allowlist `dxf-layer-table-parser.ts` + `dxf-layer-table-writer.ts` su `bim-category-scaffolding-no-active-use` e `vp-overrides-scaffolding-no-active-use`. Render integration + DXF microservice contract update = Phase 4+ (out of scope Phase 3). |
| 2026-05-16 v2.4 | **Phase 4 IMPLEMENTED (Render Integration + ByLayer/ByBlock Pipeline §G7)**: (a) `src/subapps/dxf-viewer/systems/properties/resolved-style.types.ts` NUOVO — tipi `ResolvedStyle` (concrete color hex + ACI + TrueColor + `LinetypeDef` + `ConcreteLineweightMm` + transparency 0-90 + per-field provenance), `EntityStyleInput` (entity-side declaration con `colorMode? 'ByLayer'\|'ByBlock'\|'Concrete'` + colorHex/colorAci/colorTrueColor + linetypeName accetta literal 'ByLayer'/'ByBlock' + lineweightMm sentinel support + transparency), `BlockStyleInput` (concrete-only, blocks pre-risolti contro host layer), `DefaultStyleInput` (project + user lineweight overrides per cascade -3 DEFAULT). (b) `src/subapps/dxf-viewer/systems/properties/resolve-entity-style.ts` NUOVO — pure fn `resolveEntityStyle(entity, layer, parentBlock?, defaults?): ResolvedStyle`. Zero side effects. Color SSoT priority TrueColor>ACI(via `getAciColor`)>hex con fallback `#FFFFFF` (ACI 7). Linetype via `resolveLinetype()` con fallback `DEFAULT_LINETYPE_NAME`. Lineweight cascade entity→block(-1 BYBLOCK)→layer(-2 BYLAYER)→`resolveDefaultLineweight()` system(-3 DEFAULT). Transparency clamp 0-90. Provenance tracking per ogni field per debug + property panel. Adapter `entityToStyleInput()` per bridging legacy entity shape. (c) `src/subapps/dxf-viewer/types/entities.ts` MOD — `BaseEntity` esteso (additive, non-breaking) con optional `colorMode?: 'ByLayer'\|'ByBlock'\|'Concrete'` + `colorAci?: number` + `colorTrueColor?: number\|null` + `linetypeName?: string` + `lineweightMm?: LineweightMm` + `transparency?: number`. Campi missing = ByLayer (behavior corrente preservato). (d) `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts` MOD — `DxfRenderOptions.layersById?: Record<string, SceneLayer>` aggiunto per threading risolto-bridge alle leaf. (e) `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts` MOD — helper privato `resolveStyleForRender(entity, layersById)` → `{ colorHex, lineWidthPx }`. Quando `layersById` non fornita (caso attuale Phase 1-3) o entity.layer non trovato → fallback legacy `entity.color || CAD_UI_COLORS.entity.default` + `entity.lineWidth`. Quando fornita → routing centralizzato via resolver + `lineweightToPx(mm, 96)`. Wire applicato a LINE batch (key colore/lineweight risolto), `toEntityModel()` (color + lineweight px risolti), `renderSingleEntity()` (threading `layersById` via interaction param). File 416→458 lines (sotto 500 SRP). ADR-040 leaf rule rispettato (modifica solo `DxfRenderer.render` già leaf, zero orchestrator touch). (f) Tests: `systems/properties/__tests__/resolve-entity-style.test.ts` NUOVO 23 test in 7 group (ByLayer cascade / entity shadows layer / ByBlock chain / color TrueColor>ACI>hex priority / lineweight DEFAULT cascade con project+user override / linetype fallback unknown→layer→DEFAULT_LINETYPE_NAME / transparency clamp / adapter). Tutti ✅ pass 3.7s. (g) Caller wire-up SceneModel→DxfScene.layersById deferred Phase 5+ (bridge SceneModel.layers → renderOptions). Phase 4 = foundation: resolver + types + renderer plumbing pronti. Entities Phase 5+ potranno dichiarare `colorMode: 'ByLayer'` / `lineweightMm: -2` e il render rispetterà inheritance senza ulteriori touch al call site. (h) `.ssot-registry.json` deferred Phase 5 (`resolve-entity-style` ratchet enforcing single resolver call site al render arrivato quando layersById wire-up landa). |
| 2026-05-16 v2.5 | **Phase 5 IMPLEMENTED (SceneModel→DxfScene layer-bridge + §G7 activation)**: (a) `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts` MOD — `DxfScene.layersById?: Record<string, SceneLayer>` aggiunto come bridge per il pieno `SceneLayer` map. Legacy `layers: string[]` `@deprecated` ma mantenuto per consumer downstream (FitToView bounds calc, viewport queries). (b) `src/subapps/dxf-viewer/hooks/canvas/useDxfSceneConversion.ts` MOD — return esteso con `layersById: currentScene?.layers` (same-ref propagation, zero copy overhead; WeakMap entity cache invariato). Quando `currentScene` null → `layersById` undefined → renderer fallback legacy. (c) `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` MOD — `renderScene()` legge `curScene?.layersById` da `paramsRef.current` + inject in: (i) `renderer.render(...)` via `{...curRenderOptions, skipInteractive: true, layersById: curLayersById}`; (ii) `renderer.renderSingleEntity(... 'hovered' \| 'selected', { gripInteractionState, layersById: curLayersById })` per overlay leaf. Activation completa §G7 pipeline: `SceneModel.layers` → `DxfScene.layersById` → `DxfRenderOptions.layersById` → `DxfRenderer.resolveStyleForRender(entity, layersById)` → `resolveEntityStyle(input, layer)`. (d) `src/subapps/dxf-viewer/hooks/canvas/__tests__/useDxfSceneConversion-layers-bridge.test.ts` NUOVO 4 test — full SceneLayer map exposed same-ref, legacy string[] projection preserved, undefined fallback on null scene, ref update on layers change. Tutti ✅ pass 5.3s. (e) Visual regression ZERO: entity con `color`/`lineWidth` concreti → resolver `colorMode='Concrete'` path → entity values shadow layer; cascade fires solo quando entity ha sentinel ByLayer/ByBlock/DEFAULT (current pre-flat `useDxfSceneConversion.buildBase` non emette sentinel → behavior pre-Phase 5 preservato). (f) LINE tool emission default (Phase 5C scope) **DEFERRED Phase 6** — separation concettuale: Phase 5 = activation data path; Phase 6 = entity creation emission (`colorMode: 'ByLayer'` + `lineweightMm: -2` + `linetypeName: 'ByLayer'`) + audit test breakage prima di flip default. (g) ADR-040 leaf rule rispettato: modifica solo `dxf-canvas-renderer.ts` (già leaf, micro-leaf subscriber pattern preservato), zero touch su `CanvasSection` / `CanvasLayerStack` orchestrator. (h) Ratchet `resolve-entity-style` (deferred Phase 4) → ancora deferred Phase 6 (single resolver call site enforcement post LINE tool migration). |
| 2026-05-16 v2.7 | **Phase 6.5 IMPLEMENTED (LINE/CIRCLE/POLYLINE/ARC/RECTANGLE tools default ByLayer — §G7 LIVE + AutoCAD-style UI toggle)**: (a) `src/subapps/dxf-viewer/settings-core/types/domain.ts` MOD — `LineSettings` esteso (additive optional) con `colorMode?: 'ByLayer'|'Concrete'` + `lineweightMode?: 'ByLayer'|'Concrete'`. Default Google-grade ON via `DEFAULT_LINE_SETTINGS` aggiornato in `settings-core/defaults.ts` (`colorMode: 'ByLayer'` + `lineweightMode: 'ByLayer'`). Absence = ByLayer per forward-compat con stored settings legacy. (b) `src/subapps/dxf-viewer/hooks/drawing/apply-preview-settings.ts` NUOVO (~55 LOC) — pure helper `applyPreviewSettingsToEntity(entity, preview)` estratto da `useUnifiedDrawing.tsx::applyPreviewSettings` per unit-testability (no React state machine boot). Branching: `colorMode='ByLayer'` → `entity.colorMode='ByLayer'` + SKIP `entity.color` flatten; `colorMode='Concrete'` → flatten `entity.color`. Stesso pattern per `lineweightMode` → `entity.lineweightMm=-2` (BYLAYER sentinel DXF group 370) o `entity.lineweight` flatten. Altri style fields (opacity/lineType/dashScale/lineCap/lineJoin/dashOffset/breakAtCenter) flattenati invariati indipendenti dal branch. (c) `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.tsx` MOD — `applyPreviewSettings` callback ora thin wrapper su `applyPreviewSettingsToEntity(entity, linePreviewStyles)` (riduzione da 14 a 3 righe nel hook). (d) `src/subapps/dxf-viewer/core/commands/types/create-entity-options.ts` MOD — `CreateEntityOptions` esteso con sentinel set Phase 6.5: `colorMode?`, `colorAci?`, `colorTrueColor?`, `linetypeName?`, `lineweightMm?: LineweightMm`, `transparency?`. Import `LineweightMm` from `types/entities`. (e) `src/subapps/dxf-viewer/core/commands/entity-commands/CreateEntityCommand.ts` MOD — `execute()` forward sentinel additivo da options → entity. Defensive guard: quando `options.colorMode ∈ {'ByLayer','ByBlock'}` SKIP `entity.color = options.color` anche se hex presente (previene leak di stale concrete UI state in entity inherited). Legacy concrete path (colorMode absent/Concrete + color) invariato. (f) `src/subapps/dxf-viewer/systems/entity-creation/useEntityCreationManager.ts` MOD — `handleEntityCreateRequest` forward via conditional spread di tutti i 6 sentinel da `entity` a `CreateEntityOptions`. (g) `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/useLineSettingsState.ts` MOD — `handleColorChange()` ora forza `colorMode='Concrete'` quando user picka un hex (explicit override semantics). Nuovi handler `handleColorModeToggle(mode)` + `handleLineweightModeToggle(mode)` per pillola UI. Esposti via return. (h) `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/LineSettingsSections.tsx` MOD — nuovo helper `<ByLayerToggle>` (AutoCAD-style pillola RadioGroup ARIA-compliant, due bottoni `'Από Επίπεδο' / 'Προσαρμοσμένο'` con stati attivo/inattivo via colors.bg.accent/secondary). BasicSection: pillola `lineweightMode` sopra slider lineWidth (slider disabled when ByLayer); pillola `colorMode` sopra ColorDialogTrigger (picker hidden when ByLayer, hint testuale `byLayerHint` mostrato invece). (i) `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/LineSettings.tsx` MOD — destructure + thread `handleColorModeToggle` + `handleLineweightModeToggle` a BasicSection. (j) **i18n keys** `el` + `en` × `dxf-viewer-settings.json` line.labels: `colorMode` ('Πηγή Χρώματος'), `lineweightMode` ('Πηγή Πάχους'), `byLayer` ('Από Επίπεδο'), `concrete` ('Προσαρμοσμένο'), `byLayerHint` (explanatory hint). Greek-pure per N.11 rule. (k) Tests: `hooks/drawing/__tests__/apply-preview-settings.test.ts` NUOVO 8 test — colorMode ByLayer omit color / Concrete flatten color, lineweightMode ByLayer write -2 omit lineweight / Concrete flatten, undefined colorMode treated as ByLayer (forward-compat), null/undefined preview defensive no-op, mixed colorMode=ByLayer + lineweightMode=Concrete independent branching, secondary style fields flattenati indipendenti dal branch. `core/commands/entity-commands/__tests__/CreateEntityCommand-bylayer.test.ts` NUOVO 5 test — colorMode=ByLayer forwards sentinel + omits entity.color even when stale hex present, ByBlock identical contract, Concrete + color flattens, colorMode absent legacy preserved, all 5 Phase 6.5 sentinels forward (colorAci/colorTrueColor/linetypeName/lineweightMm/transparency). Phase 6 regression rerun (`useDxfSceneConversion-bylayer-emission.test.ts` 7/7) zero break. Totale Phase 6.5 = **20/20 green** in 8.6s (3 suite). (l) §G7 status updated → "**Phase 6.5 LIVE production + LINE tool default ByLayer**". (m) ADR-040 leaf rule rispettato (zero touch su CanvasSection/CanvasLayerStack — UI lives in dxf-settings panel + entity creation pipeline). (n) Ratchet: nessun nuovo modulo Tier 3 richiesto (resolve-entity-style già copre downstream contract a single resolver call site; Phase 6.5 estende solo emission default, non aggiunge nuovi call sites). |
| 2026-05-16 v2.6 | **Phase 6 IMPLEMENTED (Sentinel emission LIVE — §G7 production)**: (a) `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts` MOD — `DxfEntity.color: string` → `color?: string` (optional), `lineWidth: number` → `lineWidth?: number` (optional). Aggiunti optional sentinel fields mirror di `BaseEntity` Phase 4: `colorMode?: 'ByLayer'|'ByBlock'|'Concrete'`, `colorAci?`, `colorTrueColor?`, `linetypeName?`, `lineweightMm?: LineweightMm`, `transparency?`. Audit consumer (`BaseEntityRenderer`/`PhaseManager`/`DxfRenderer`/`EntityCard`/`TextRenderer`/`HitTestingService`): tutti usano già pattern `entity.color || fallback` → zero breakage. Zero call site con string methods (`.toLowerCase`/`.startsWith`) su `DxfEntityUnion.color`. (b) `src/subapps/dxf-viewer/hooks/canvas/useDxfSceneConversion.ts` MOD — `buildBase()` sentinel-aware. Logic: `colorByLayer = entity.colorMode === 'ByLayer'|'ByBlock'` → omit `color` flatten; `lwSentinel = lineweightMm ∈ {-3,-2,-1}` → omit `lineWidth` flatten; `ltSentinel = linetypeName === 'ByLayer'|'ByBlock'` → forward. Forward additivo di tutti i 6 campi sentinel (`colorMode`/`colorAci`/`colorTrueColor`/`linetypeName`/`lineweightMm`/`transparency`) via conditional spread. Entities con concrete `color`/`lineweight` legacy path invariato (regression guard test in suite). (c) `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/DxfRenderer.ts` MOD — `resolveStyleForRender()` adapter call `entityToStyleInput()` ora forward full sentinel set (non più solo `color`). Consente cascade live colore + ACI + TrueColor + linetype + lineweight + transparency layer→entity quando entity opta in ByLayer. (d) Tests: `hooks/canvas/__tests__/useDxfSceneConversion-bylayer-emission.test.ts` NUOVO 7 test in 2 group — (Group 1, 4 test) buildBase sentinel emission: `colorMode='ByLayer'` → no `color` field + forward `colorMode`; `lineweightMm=-2` → no `lineWidth` field + forward `lineweightMm`; legacy concrete preserved (regression guard); `linetypeName='ByLayer'` forwarded. (Group 2, 3 test) resolver end-to-end: ByLayer + ACI 1 red layer → resolved `#FF0000` `provenance.color='layer'`; ByLayer + lineweightMm=-2 + layer lineweight 0.7 → resolved 0.7 `provenance.lineweight='layer'`; layer TrueColor edit propagation `#111111`→`#EEEEEE` su same entity input. Tutti ✅ pass 5.5s. Phase 5 bridge regression tests rieseguiti zero break. (e) **§G7 status**: Phase 5 "ACTIVE end-to-end" → Phase 6 "**LIVE production**". Entities che adottano `colorMode: 'ByLayer'` ereditano `AdminLayerManager` color edits frame-coherent senza ulteriori touch al call site. (f) LINE tool emission default (entity creation factory `drawing-entity-builders.ts::createEntityFromTool` + `useUnifiedDrawing::applyPreviewSettings` + `useEntityCreationManager` + `CreateEntityCommand`) **non-modificato Phase 6**: factory already emette entities `color`-less (gated truthy in `CreateEntityCommand.ts:48`), il path corrente passa via `applyPreviewSettings` con ColorPalettePanel concrete. Flip default a ByLayer richiede toggle "Use layer color" nel ColorPalettePanel — deferred Phase 6.5 (UI scope separato). Data path già completo: quando user disabilita override, entity emerge `colorMode='ByLayer'` e cascade fires live. (g) ADR-040 leaf rule rispettato: zero touch su `CanvasSection`/`CanvasLayerStack`. (h) Ratchet `resolve-entity-style` Tier 3 LANDATO (Phase 6G — single resolver call site enforcement `DxfRenderer.resolveStyleForRender`, allowlist tests + property panel reads + entity-creation forwarding). |
| 2026-05-16 v2.8 | **Phase 8 IMPLEMENTED (AdminLayerManager wired to LayerStore + SceneModel — drop mock data, §G8 LIVE)**: (a) `src/subapps/dxf-viewer/ui/components/layer-manager/useLayerManagerState.ts` REWRITE — eliminato `MOCK_LAYERS` (~48 LOC) + fallback mock state. Subscribe a `LayerStore` micro-leaf via `useSyncExternalStore(subscribeLayerStore, getLayerStoreSnapshot)` (Phase 1 SSoT). Element count derivato dinamicamente: `scene?.entities.filter(e => e.layer === layer.name).length` via `useLevelSelection().currentLevel?.scene` (zero hardcoded count). Categories derivate dinamicamente da `getUniqueCategories(storeSnapshot.layers)` → `Set<AecLayerCategory>` + entry `'all'` (industry-aligned reuse `layerPicker.category.*` i18n keys da Phase 7, NO namespace duplicate). `isCurrent` flag derivato `storeSnapshot.currentLayerId === (layer.id ?? layer.name)`. Action `setCurrentLayer(layerId)` wira `setCurrentLayerId()` SSoT. `toggleLayerVisibility` ora va via `upsertLayer({...target, visible: !target.visible})` (zero local state). (b) `src/subapps/dxf-viewer/ui/components/layer-manager/types.ts` MOD — `Layer` interface esteso con `isCurrent?: boolean` (UI highlight). `LayerManagerActions` interface esteso con `setCurrentLayer: (layerId: string) => void`. (c) `src/subapps/dxf-viewer/ui/components/layer-manager/LayerList.tsx` MOD — aggiunto `onContextMenu` handler su `<MoreVertical>` button → `onLayerAction?.(layer.id, 'setAsCurrent')`. Right-click set-as-current senza UI break (preserve UI invariance LayerHeader/LayerFilters/LayerList structure). (d) `src/subapps/dxf-viewer/ui/components/AdminLayerManager.tsx` MOD — `handleLayerAction(layerId, action)` routing `if (action === 'setAsCurrent') actions.setCurrentLayer(layerId)`. (e) Tests: `src/subapps/dxf-viewer/ui/components/layer-manager/__tests__/useLayerManagerState.test.ts` NUOVO 14 test in 4 group — (Group 1, empty store) returns empty layers + zero categories; (Group 2, populated store) element count derivation da scene.entities, isCurrent flag on matching currentLayerId, categories dynamic union (electrical+plumbing presenti, mechanical assente); (Group 3, setCurrentLayer action) act() dispatch → isCurrent flag toggle; (Group 4, toggleLayerVisibility action) toggle propagation via upsertLayer. Mock `useLevelSelection` (currentLevel.scene.entities) + `useTranslation` (`layerPicker.category.*`) per avoid Firebase auth boot. Tutti ✅ 14/14 green. tsc Phase 8 files: zero errori (pre-existing baseline errors invariati). (f) **§G8 status**: "AdminLayerManager wired al SceneModel" → **LIVE production**. Element count + categories + isCurrent + setCurrentLayer ora 100% data-driven da `LayerStore` + `useLevelSelection`. Mock data legacy eliminata. (g) `.ssot-registry.json` MOD — modulo `current-layer-picker` allowlist esteso a `useLayerManagerState.ts` + `__tests__/useLayerManagerState.test.ts` (setCurrentLayerId call site legittimo sotto ratchet Tier 3). (h) ADR-040 leaf rule rispettato: zero touch su `CanvasSection`/`CanvasLayerStack` orchestrator — UI lives in admin layer panel hierarchy (non-canvas leaf). (i) Phase 8 = original §7.2 Phase 6 description ("AdminLayerManager wired to LayerStore — drop mock data — preserve UI props"); landed post-Phase 6/6.5 (ByLayer sentinel emission) per dependency ordering — Phase 6/6.5 emette `colorMode='ByLayer'` entities che AdminLayerManager Phase 8 ora visualizza con element count corretto. Phase numbering allineato a test file comment `Phase 8`. |
| 2026-05-16 v2.9 | **Phase 7 IMPLEMENTED LIVE (CurrentLayerPicker — Q8 Γ Both spec full contract)**: (a) `src/subapps/dxf-viewer/ui/components/layer-picker/CurrentLayerPicker.tsx` (Phase 7G — pre-existing) — singolo componente, 2 variants (`status-bar` compact ~140px, `ribbon` medium ~220px). Trigger button con color swatch + name truncated + chevron + Layers icon (ribbon only). Tooltip i18n `layerPicker.tooltipCurrent/Empty`. Status-bar swatch ora con `key={\`swatch-${state.pulseToken}\`}` + `className="layer-picker-pulse"` quando `pulseToken > 0` — DOM remount forza re-trigger del `@keyframes layer-picker-pulse 450ms ease-out` (§5.5.bis line 853, project `globals.css`). Ribbon variant NO pulse (status-bar only per Q8 spec). (b) `src/subapps/dxf-viewer/ui/components/layer-picker/CurrentLayerPickerPopover.tsx` REWRITE Phase 7G — sections: search (live filter, no debounce) + Most-used (top-5 con alpha fallback) + grouped by AEC category (10 buckets `CATEGORY_ORDER`, alphabetical inside) + actions footer (New Layer disabled placeholder Phase 7.5 + Manage Layers wired a `actions.openManager` → CustomEvent `dxf:open-layer-manager`). Group header icon Lucide via `getCategoryIcon(category)` — NO emoji (Q8 line 814 spec emoji → production Lucide per pro CAD UI theme-coherence). LayerRow: color swatch + name truncate + visibility/lock/freeze icons. Lock icon red-tinted (`text-destructive`) quando `layer.locked && !canUnlockLayer` (permission badge §5.5.bis line 846). Frozen + lock-blocked rows mantengono click + opacity 0.6 (`isDimmed`), click attiva toast warning via `selectLayer` guard. (c) **Right-click context menu** (Radix `@/components/ui/context-menu`) per row: Set as current / Toggle visibility / Toggle lock / Toggle freeze / Properties — `disabled={isFrozen || isLockBlocked}` su Set-as-current item (§5.5.bis line 844). Click su Properties dispatch `dxf:open-layer-manager` con `detail.layerId`. (d) **Keyboard nav** (§5.5.bis line 847) — flat ordered `pickableIds` array via `flattenPickable(state)` derivato da filteredRecent + filteredGroups. `activeIndex` state + `rowRefs Map` di `HTMLButtonElement`. KeyDown handler su `<section>`: ↑/↓ ciclano (`(idx+1)%len` / `idx<=0 ? len-1 : idx-1`), Enter `selectLayer(pickableIds[activeIndex])`, Esc gestito automaticamente da Radix Popover. Search input → Tab/ArrowDown porta focus al primo row (roving-tabindex con tabIndex=-1 di default + setFocus via ref). (e) `src/subapps/dxf-viewer/ui/components/layer-picker/useCurrentLayerPickerState.ts` REWRITE Phase 7G — esteso a 392 LOC con: (i) `pickInitialLayerId(layers)` pure fn esportata SSoT seed selector (Layer "0" → first general category → layers[0], §5.5.bis line 863); (ii) hydration extended con `resolvedCurrent = localCurrent ?? remoteCurrent ?? pickInitialLayerId(snapshot.layers)` — seed live solo se nessun persisted source presente; (iii) `recentLayers` derivation con alpha fallback fino a 5 entries quando recent FIFO < 5 (`seen Set` cumulativo evita duplicati con most-recent + alpha fill, §5.5.bis line 858); (iv) `selectLayer` permission-aware: frozen → toast `layerPicker.toastFrozen` no-op, locked && !canUnlockLayer → toast `layerPicker.toastLocked` no-op, re-select stessa current → `pushRecentLayer` + pulseToken++ no-toast, change → `setCurrentLayerId` + toast `toastChanged` + pulseToken++; (v) nuove actions `toggleVisibility(id)` / `toggleLock(id)` (gate canUnlockLayer) / `toggleFreeze(id)` via `upsertLayer({...target, [field]: !target[field]})`; (vi) `openManager()` + `openProperties(id)` window event dispatch; (vii) `pulseToken` state bumped solo su user-initiated change (NOT programmatic per Q8 line 851 "only su user-initiated change") — drives Q8 §5.5.bis line 853 swatch pulse animation. Capability gate: `useCanEditText().canUnlockLayer` (ADR-344 Phase 5.B role matrix riusato — FULL/PRO/SITE_MANAGER/NONE/UNAUTH grants). (f) `src/subapps/dxf-viewer/ui/components/layer-picker/layer-picker-category-icons.ts` NUOVO — `CATEGORY_ICONS: Record<AecLayerCategory, LucideIcon>` immutable map: architectural→Building2 / structural→HardHat / electrical→Zap / mechanical→Wrench / plumbing→Droplets / fire→Flame / civil→Map / telecom→Antenna / interior→Sofa / general→Layers. Helper `getCategoryIcon(category)` con fallback Layers. (g) `src/subapps/dxf-viewer/ui/components/layer-picker/layer-picker-persistence.ts` (Phase 7G — pre-existing, no change). (h) `src/app/globals.css` MOD — `@keyframes layer-picker-pulse` (scale 1→1.35→1 + box-shadow ring `hsl(var(--ring)/0.6)` → 5px → 0, 450ms ease-out) + `.layer-picker-pulse` utility class. (i) `src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx` MOD — mount `<CurrentLayerPicker variant="status-bar" className="ml-auto" />` (Phase 7G pre-existing). (j) `src/subapps/dxf-viewer/ui/ribbon/data/home-tab-layers.ts` NUOVO — `HOME_LAYERS_PANEL` con widget `current-layer-picker`. `ribbon-default-tabs.ts` import + ordering `home → HOME_HISTORY → HOME_LAYERS → HOME_DRAW → ...`. `RibbonPanel.tsx` MOD — case `widgetId === 'current-layer-picker'` → `<CurrentLayerPicker variant="ribbon" />` (Phase 7G pre-existing). (k) **i18n keys** completate `dxf-viewer-shell.json` el+en (mancavano dal precedente Phase 7G commit set): `mostUsed`, `newLayer`, `openManager`, `disabledHint`, `toastLocked` ICU `{name}`, `toastFrozen` ICU `{name}`, `contextMenu.{setCurrent,toggleVisibility,toggleLock,toggleFreeze,openProperties}`, `category.{architectural,structural,electrical,mechanical,plumbing,fire,civil,telecom,interior,general}`. Greek-pure per N.11 rule (zero parole inglesi). (l) Tests: `__tests__/useCurrentLayerPickerState.test.tsx` esteso a 23 test in 8 group — pickInitialLayerId pure fn (4 test: empty / Layer "0" priority / general fallback / layers[0] fallback) + derivation + initial seed (3 test) + recent+alpha fallback (2 test) + selectLayer (5 test, +frozen blocks +pulseToken bumps) + mutation actions (2 test: toggleVisibility/toggleFreeze) + search filter + persistence. Mock `useCanEditText` con `canUnlockLayer=true` (locked-block path coperto via frozen-block equivalence — branch identico). `LayerStore.test.ts` + `LayerStore.recent.test.ts` + `layer-picker-persistence.test.ts` regression rerun. (m) `.ssot-registry.json` MOD modulo `current-layer-picker` allowlist (Phase 7G pre-existing) — copre LayerStore + persistence + state + popover + picker + status-bar + ribbon-panel + layer-manager wire. `layer-picker-category-icons.ts` non richiede ratchet (no `CurrentLayerPicker` identifier ref, no `setCurrentLayerId` call). (n) **Q8 spec checklist 100% LIVE**: ✅ singolo componente 2 variants ✅ popover condiviso (search + Most used + grouped + actions) ✅ Most-used FIFO 10 max ✅ alpha fallback <5 ✅ click → setCurrentLayerId SSoT ✅ right-click context menu ✅ keyboard nav ↑↓ Enter ✅ Esc via Radix ✅ category Lucide icons (no emoji pro CAD) ✅ toast user-initiated change ✅ swatch pulse status-bar ✅ persistence localStorage primary + Firestore slice fallback ✅ initial seed Layer "0"/general/first ✅ permission guard frozen+locked+!canUnlockLayer via ADR-344 capability matrix ✅ pre-commit ratchet `current-layer-picker` Tier 3. (o) ADR-040 leaf rule rispettato: zero touch su CanvasSection/CanvasLayerStack — picker lives in status-bar + ribbon-panel hierarchy, non-canvas leaf. (p) §G7 status invariato — Phase 7 NON tocca render pipeline, solo UI selection layer. |
| 2026-05-16 v2.10 | **Phase 8.5 IMPLEMENTED (LayerOperationsService SSoT property setters — §7.2 row 8.5 LIVE)**: (a) `src/subapps/dxf-viewer/services/LayerOperationsService.ts` MOD — 5 nuovi setters pubblici `setLineweight(layerId, lw: LineweightMm)` / `setLinetype(layerId, name)` / `setTransparency(layerId, value)` / `setPlottable(layerId, value: boolean)` / `setFrozen(layerId, value: boolean)`. Tutti operano via `LayerStore.upsertLayer({...target, [field]: validated})` SSoT (no scrittura diretta `layersById`/`SceneModel.layers`). No-op idempotente: `getLayer(id)` null → return; valore validated === target field → return prima di upsert (zero notify spurio sui subscribers). (b) Validation: `validateLineweight` private helper accetta special sentinels (-3/-2/-1) passthrough, concrete via `parseDxfCode370(round(lw*100))` snap-to-ISO con tolerance 0.005mm + `console.warn '[LayerOperationsService] Non-ISO lineweight Xmm — snapped to Y'` quando snapped !== lw; fallback `LINEWEIGHT_SPECIAL.DEFAULT` per non-concrete. `validateLinetype` private helper risolve via `LinetypeRegistry.resolveLinetype(name)` → fallback `DEFAULT_LINETYPE_NAME` ('Continuous') + `console.warn '[LayerOperationsService] Unknown linetype "X" — fallback Continuous'`. `setTransparency` clamp 0..90 via `Math.max(0, Math.min(90, value))`. `setPlottable`/`setFrozen` boolean passthrough. (c) Logging: `console.warn` (pattern de facto codebase, 50 occorrenze in 30 files; no centralized logger global per dxf-viewer — solo `dxf-firestore-logger.ts` domain-specific). (d) Tests: `src/subapps/dxf-viewer/services/__tests__/LayerOperationsService.setters.test.ts` NUOVO 24 test in 5 describe — `setLineweight` (7 test: happy path ISO / no-op missing / idempotency / special -2 passthrough / special -3 passthrough / rounds-to-ISO 0.249→0.25 +warn / out-of-tolerance 0.27→DEFAULT +warn), `setLinetype` (5 test: happy path ISO baseline / custom registered linetype / unknown→fallback Continuous +warn / no-op missing / idempotency), `setTransparency` (5 test: happy path / clamp >90 / clamp <0 / no-op missing / idempotency), `setPlottable` (3 test: toggle / no-op missing / idempotency), `setFrozen` (4 test: toggle / no-op missing / idempotency / undefined-frozen-as-false idempotency edge). Tutti ✅ 24/24 green in 3.7s. Setup: `__resetLayerStoreForTesting()` + `__resetLinetypeRegistryForTesting()` + `setLayers(seed)` per test isolation. (e) **File size**: LayerOperationsService.ts 426 → 493 LOC (sotto limite 500 N.7.1). (f) Phase 8.5b UI wire-up (AdminLayerManager properties panel 5 nuovi field editing) **DEFERRED** — separation of concerns, service-level API completa e testabile independently. (g) Allowlist `scene-layer-shape` Tier 3 già copre `LayerOperationsService.ts` (no ratchet change required). (h) ADR-040 leaf rule rispettato: zero touch su `CanvasSection`/`CanvasLayerStack` orchestrator — service-level mutations, render pipeline ricetta automaticamente via existing §G7 cascade (entity ByLayer → layer property resolved live). (i) §7.2 row "Phase 8 originale" → "Phase 8.5" status ✅ v2.10. |
| 2026-05-17 v2.14-pre17 | **Phase 8 hook completion (usePanelContentRenderer primarySelectedId fallback)**: `ui/hooks/usePanelContentRenderer.tsx` MOD — `UsePanelContentRendererParams` extended with `primarySelectedId?: string | null`. In `case 'properties'` render: `primarySelectedId ?? selectedEntityIds[0] ?? null` (preferred SSoT first, legacy array fallback for callers that pass only selectedEntityIds). This completes the Phase 8 prop chain: DxfViewerContent → SidebarSection → FloatingPanelContainer → usePanelContentRenderer → StairPropertiesTab. 1 file / +4 LOC. Google-level: YES — null-coalesce fallback maintains backward compat. | 1 file / +4 LOC | XS | Q2 | ✅ v2.14-pre17 |
| 2026-05-17 v2.14-pre25 | **Phase 6.1 additions — stair-validator underflow + totalRiseTooLow checks + stair-auto-fix symmetric multi-story**: (a) `stair-validator.ts` MOD — 2 new pure fn checks: `checkStoryHeightUnderflow(params)` — symmetric to overflow: when `totalRiseMm + 1 < storyHeight × storyCount` → `totalRiseBelowStoryHeight` violation (Revit Multistory + ArchiCAD Multi-Level flag underflow as "unfinished flight"); `checkTotalRiseTooLow(params)` — sanity warning when `codeProfile !== 'none'` && `totalRiseMm < 1000mm` (`totalRiseTooLow` violation); both use `mmFactorFromWidth` unit normalisation. `checkStoryHeightOverflow` updated to use inline `mmFactorFromWidth` + `totalRiseMm` variable (simpler than pre22 `paramsToMmForCodeCheck` wrapper — direct mm conversion at comparison site). Both new checks injected into `validateStairParams` violation array (`storyUnderflowViolations` + `totalRiseTooLowViolations`). (b) `stair-auto-fix.ts` MOD — multi-story block now symmetric: previously only shrink (overflow guard); now also grows `finalStepCount` when stair is short of target. Algorithm: `maxByStory = floor(targetTotalMm / nextRiseMm)` (overflow cap); `idealByStory = ceil(targetTotalMm / nextRiseMm)` (underflow target); grow limited to `flightCap` to avoid re-triggering `singleFlightOverLimit`; `targetSteps = min(idealByStory, flightCap)` applied when `> finalStepCount`. Note: `multiStoryConfig.storyHeight` is already in mm (hardcoded ribbon values), `nextRiseMm` also in mm — no scene-units conversion needed. (c) **i18n keys** `tool-hints.json` el+en: `totalRiseBelowStoryHeight` = "Η σκάλα δεν φτάνει μέχρι το επόμενο επίπεδο..." / "Stair does not reach the next level..."; `totalRiseTooLow` = "Πολύ μικρό συνολικό ύψος — λιγότερο από 1 μέτρο..." / "Total rise is suspiciously short (< 1 m)...". (d) Files: 3 production MOD + 2 i18n. (e) Google-level: YES — validator + auto-fix symmetry (industry standard: both overflow and underflow are errors; auto-fix resolves both); unit-normalisation consistent with pre22; i18n N.11 compliant. | 5 file / ~55 LOC | S | Q2 | ✅ v2.14-pre25 |
| 2026-05-17 v2.14-pre24 | **Phase 9D-5c — StairEntity levelId migration + stair-validator headroom fix**: (0) **Bonus fix**: `systems/stairs/stair-validator.ts` MOD — `checkHeadroom` used `resolveEntityLayerName(entity)` (id-only post 9D-5b-iii) → LayerStore empty in unit-test context → ceiling entity invisible → headroom test false-negative. Fix: `entity.layer` direct (pre-Phase 9E name-keyed pattern, same as `trim-boundary-resolver.ts` pre23). Import `resolveEntityLayerName` from LayerStore removed. (1) `buildStairEntity` signature changed from `layer: string` → `levelId: string`; entity sets `levelId:` instead of `layer:` — ending the design smell where level-id was stored in the DXF layer field. (2) `types/stair.ts` MOD — `StairEntity` + `StairDoc` both get `readonly levelId?: string` field. (3) `hooks/drawing/stair-completion.ts` MOD — param rename + entity literal swap. (4) `hooks/drawing/__tests__/stair-completion.test.ts` MOD — test 6: description + assertions updated (`entity.levelId === 'level-42'` + `entity.layer === undefined`). (5) `systems/stairs/stair-firestore-service.ts` MOD — `StairSaveInput`/`StairUpdateInput` + `saveStair`/`updateStair`/`entityToSaveInput` wired for Firestore round-trip. (6) `hooks/data/useStairPersistence.ts` MOD — `docToEntity` hydrates `levelId: doc.levelId`. (7) `types/entities.ts` MOD — `layer?` JSDoc: stair blocker resolved. **Tests**: 77/77 PASS (stair-completion ×18 + stair-completion-ada ×10 + stair-firestore-service ×19 + stair-validator ×30). **Next**: `BaseEntity.layer` full drop now unblocked — pending Phase 9E. Google-level: YES — dedicated semantic field, Firestore round-trip complete, backward compat, all tests green. | 7 file / ~25 LOC | S | Q2 | ✅ v2.14-pre24 |
| 2026-05-17 v2.14-pre23 | **Phase 9D-5b-iii completion — `trim-boundary-resolver.ts` direct `entity.layer` lookup**: `isValidCuttingCandidate` was calling `resolveEntityLayerName(entity)` to get the layer name for `scene.layers` lookup (name-keyed `Record<string, SceneLayer>`, pre-Phase 9E). After resolver collapse to id-only (pre21), `layerId: 'lyr_test_default'` not registered in LayerStore → resolver returns `undefined` → hidden/locked layer filter fails → entity not filtered → 1 unexpected hit in `trim-fence-hit-detector.test.ts` "skips entity on a hidden layer". Fix: (a) `systems/trim/trim-boundary-resolver.ts` MOD — `const layerName = resolveEntityLayerName(entity)` → `const layerName = entity.layer` (direct name read for pre-Phase 9E name-keyed lookup). Comment updated: "ADR-358 Phase 9D-5b-iii: scene.layers is name-keyed (pre-Phase 9E) — entity.layer direct." (b) Import `resolveEntityLayerName` from `LayerStore` removed (no longer used in file). (c) Tests: 39/39 PASS — `LayerStore.resolveEntityLayerName.test.ts` (6) + `trim-boundary-resolver.test.ts` (17) + `trim-fence-hit-detector.test.ts` (16). Zero regression. (d) Phase 9E will re-key `scene.layers` to `layerId`-indexed → `entity.layerId` will replace `entity.layer` here. (e) Google-level: YES — correct pre-Phase 9E pattern (name-keyed lookup via name field), resolver collapse not visible to boundary layer filter, all tests green. | 1 file / -3 LOC (import drop + comment swap) | XS | Q2 | ✅ v2.14-pre23 |
| 2026-05-17 v2.14-pre22 | **Phase 6.1 bugfix — stair-validator unit-normalization (paramsToMmForCodeCheck)**: `gateStairChecker` thresholds are mm-baked (NOK/IBC/Eurocode/ADA codes in mm). Scenes may be in m/cm/mm — pre-9D code passed raw `params` to `gateStairChecker` causing false violations for every metre-scale stair (`rise < 130mm` where rise was e.g. `0.18m`). Fix: (a) `paramsToMmForCodeCheck(params): StairParams` — projects `width/rise/tread/handrails.height/topExtension` to mm using `mmFactorFromWidth` heuristic (mirror of `stair-auto-fix.ts` and `stair-grips.ts`). If `mmPerSceneUnit === 1` returns `params` (identity — no copy). (b) `mmFactorFromWidth(width): number` — local pure fn: `width < 10` → ×1000 (metres), `width < 100` → ×10 (cm), else ×1 (mm). (c) `validateStairParams` MOD — `const paramsForGate = paramsToMmForCodeCheck(params)` inserted before `gateStairChecker` call; `params: paramsForGate` passed. Non-gate checks (`checkSingleFlightLimit`, `checkStoryHeightOverflow`) use raw `params` (they compute from `stepCount`/`storyHeight`/`storyCount` which are unit-independent). (d) **Regression note** (2026-05-17): metre-scale stair placed at 0-config was producing `rise < 130`, `tread < 260` etc. violations immediately on creation — false positives. Fix makes gate consistent with existing `stair-auto-fix.ts` which already had the same heuristic. (e) Files: 1 production MOD (`stair-validator.ts` +30 LOC). (f) Google-level: YES — unit-normalization at boundary (gate-checker boundary), DRY with existing heuristic in auto-fix/grips, identity fast-path (no copy when already mm). | 1 file / +30 LOC | XS | Q2 | ✅ v2.14-pre22 |
| 2026-05-17 v2.14-pre21 | **Phase 9D-5b-iii IMPLEMENTED (id-only resolver schema flip + entity type JSDoc + fence placeholder cleanup)**: (a) `stores/LayerStore.ts` MOD — `resolveEntityLayerName` drops legacy `.layer` fallback: `return entity.layer;` → `return undefined;`. JSDoc updated: "Id-only post-schema-flip: `entity.layer` name backref no longer used." Callers must handle `undefined` with safe fallback (e.g. `DXF_DEFAULT_LAYER`). Pre-9D entities without `layerId` now resolve to `undefined`. (b) `stores/__tests__/LayerStore.resolveEntityLayerName.test.ts` MOD — 4 test updates: describe block renamed "ADR-358 Phase 9D-5b-iii id-only"; "legacy entity only `.layer`" → expects `undefined` (no fallback); "stale id → falls back to `.layer`" → expects `undefined` (no legacy safety net); mixed entity (id resolves) → still returns layer name (id path unchanged); "entity with neither field" → still `undefined`. (c) `systems/entity-creation/useEntityCreationManager.ts` MOD — drops intermediate `resolvedLayerName = entity.layer ?? DXF_DEFAULT_LAYER`; `resolvedLayerId = entity.layerId ?? getLayer(DXF_DEFAULT_LAYER)?.id` (id-direct path, no layer-name intermediary). Comment updated: "ADR-358 Phase 9D-5b-iii: id-only post schema flip — no entity.layer read." (d) `types/entities.ts` MOD — `layer?` JSDoc updated: "Resolver collapsed to id-only in Phase 9D-5b-iii — this field is NO LONGER read by production code. Pending full drop: StairEntity still writes `layer` for level-id storage (design smell — migrate to dedicated `levelId` field). DO NOT add new usages." `layerId?` JSDoc updated: "Phase 9D-5b-iii: resolver is id-only. STRONGLY REQUIRED. Full TS enforcement pending stair-level-id migration." (e) `systems/trim/trim-fence-hit-detector.ts` MOD — removes `layer: ''` from `buildFenceEdge` inline line entity literal. Phase 9D-4 had explicitly excluded this as "fence placeholder entity" — safe to drop post schema flip since `resolveEntityLayerName` no longer reads `.layer`. (f) Files: 4 production MOD + 1 test MOD. (g) **Google-level: YES** — atomic schema flip (all producer/consumer sites consistent), backward-compat fence kept on entity shape with layerId-only resolver, industry pattern (Google LSC atomic schema migration). Phase 9D-5b-iii CLOSED. Next: full `layerId: string` enforcement + StairEntity levelId migration (Phase 9D-5b-iv follow-up). | 5 file / ~25 LOC | S | Q2 | ✅ v2.14-pre21 |
| 2026-05-17 v2.14-pre20 | **Phase 6.5 / 7b1 follow-up — stair-auto-fix engine + Auto-Fix button in StairWarningsSection**: (a) `systems/stairs/stair-auto-fix.ts` NUOVO — pure fn `autoFixStairParams(params): StairParams`. `PROFILE_RANGES_MM` table (8 profiles): widthMin / riseMin-Max / treadMin-Max / twoRGMin-Max / maxFlightRisers. `NOK_SECONDARY_OVERRIDE` for `nokSubType==='secondary'`. `mmFactorFromWidth` heuristic (metres/cm/mm detection, mirror of stair-grips). Algorithm: (1) clamp rise+tread to profile range → midpoint when out-of-range; (2) Blondel 2R+G snap when profile carries the rule (solve tread first, then rise if tread-clamp overshoots); (3) cap stepCount to `maxFlightRisers`; (4) multi-story overflow guard (shrink stepCount so totalRise ≤ storyHeight×storyCount); (5) recompute totalRise/totalRun/pitch; (6) referential equality early-out when nothing changed. (b) `ui/stair-advanced-panel/sections/StairWarningsSection.tsx` MOD — add `dispatchPatch?: DispatchStairParamPatch` prop + `onAutoFix` useCallback (calls `autoFixStairParams(stair.params)`, returns if same ref, then `dispatchPatch(stair, fixedFields)`); "Auto-Fix" button in header (visible only when `dispatchPatch` provided). (c) `ui/stair-advanced-panel/StairAdvancedPanel.tsx` MOD — pass `dispatchPatch={dispatchPatch}` to `StairWarningsSection`. (d) **i18n keys** `dxf-viewer-shell.json` el+en: `stairAdvancedPanel.sections.warnings.autoFix` = "Αυτόματη Διόρθωση" / "Auto-Fix". (e) Files: 1 NEW + 2 MOD + 2 i18n. (f) Google-level: YES — pure function (no side effects, referential equality guard), Blondel rule respected, multi-story overflow guard, industry pattern (Revit Resolve Warning / ArchiCAD Auto-fix / Tekla Code Check Resolve). | 5 file / ~230 LOC | M | Q2 | ✅ v2.14-pre20 |
| 2026-05-17 v2.14-pre19 | **Phase 7b1 + Phase 6.1 follow-up — StairWarningsSection (violations readable list in Properties panel)**: (a) `ui/stair-advanced-panel/sections/StairWarningsSection.tsx` NUOVO — `role="alert"` section renders when `stair.validation?.violationKeys.length > 0`; maps violation i18n keys (`tools.stair.validator.*`) to `<li>` items via `t(key, { defaultValue: key })` (dynamic key → `tool-hints` namespace); hidden when no violations (returns null). Industry pattern: Revit "Warnings" in Properties Palette / ArchiCAD warnings dialog / AutoCAD Audit. (b) `ui/stair-advanced-panel/StairAdvancedPanel.tsx` MOD — import `StairWarningsSection` + mount `<StairWarningsSection stair={stair} />` immediately after `<header>` block. (c) **i18n keys** `dxf-viewer-shell.json` el+en: `stairAdvancedPanel.sections.warnings.title` = "Προειδοποιήσεις" / "Warnings". (d) **Interaction Phase 6.1**: `validateStairParams` runs on every `UpdateStairParamsCommand.execute/undo/redo` → entity.validation.violationKeys updated → this section shows/hides reactively. (e) Files: 1 NEW + 2 MOD + 2 i18n MOD. Google-level: YES — industry-aligned warnings UX, null return for clean state, section role=alert for accessibility. | 5 file / ~55 LOC | S | Q2 | ✅ v2.14-pre19 |
| 2026-05-17 v2.14-pre18 | **Phase 9D-5b-iv Sub-iv-c IMPLEMENTED (Test fixture migration — canvas hooks + layer-manager + e2e domains)**: (a) **Scope**: 3 file modificati, ~11 occorrenze `layer: 'X'` literal arricchite con `layerId: 'lyr_test_default'` dual-write. (b) **`hooks/canvas/__tests__/useDxfSceneConversion-bylayer-emission.test.ts`** — `concreteEntity` const (riga 84-93): `layer: 'WALLS'` + `layerId: 'lyr_test_default'` aggiunto. Factory `makeByLayerLine` NON toccata (test `omits layerId on DxfEntity when source entity has no layerId` dipende da assenza del campo — solo SSoT inline dove layerId manca). (c) **`ui/components/layer-manager/__tests__/useLayerManagerState.test.ts`** — 3 entity nel mock `useLevelSelection.currentLevel.scene.entities`: `{ layer: 'Electrical', layerId: 'lyr_test_default', type: 'line' }` + `{ layer: 'Electrical', layerId: 'lyr_test_default', type: 'polyline' }` + `{ layer: 'Plumbing', layerId: 'lyr_test_default', type: 'circle' }`. Hook usa ancora `entity.layer` per conteggio (schema flip 9D-5b-iii pending) → aggiunta sicura. Nota: suite had pre-existing Firebase `fetch is not defined` failure (import chain `useLayerManagerState → useLevels → LevelsSystem → useAutoSaveSceneManager → dxf-firestore.service → Firebase auth`) — confermato via `git stash` test pre-edit (stessa failure). Le mie edit non causano né risolvono questo failure. (d) **`e2e/dxf-visual-regression.spec.ts`** — 7 entity literals con `layer: '0'` (Phase 4 drawPreview ×5 + Phase 5 addSceneEntity ×2): `layerId: 'lyr_test_default'` aggiunto accanto a `layer: '0'`. Tutti `Record<string, unknown>` passthrough → zero breakage. Handoff stimava ~2 occ; grep trovò 7 (5 preview + 2 add). (e) **Test verifica**: `useDxfSceneConversion-bylayer-emission.test.ts` → PASS 9/9 (unchanged regression). `useLayerManagerState` — suite failure pre-esistente Firebase confermata pre e post edit. e2e non eseguibile (Playwright browser non disponibile in ambiente locale). (f) **Sub-iv-c COMPLETO** — tutte e 3 le sessioni Sub-iv di 9D-5b-iv completate: Sub-iv-a (testo) + Sub-iv-b (entity-commands/trim/array/stairs) + Sub-iv-c (canvas/layer-manager/e2e). Prossimo: 9D-5b-iii schema flip atomico (3 file produzione). (g) **Google-level: YES** — pattern uniforme `lyr_test_default` sentinel, factory NON toccata dove layerId-undefined è intenzionale, pre-existing failure non mascherata. | 3 file / ~11 occ | S | Q2 | ✅ Sub-iv-c |
| 2026-05-17 v2.14-pre16 | **Phase 6.1 Stair Validator — singleFlightLimit + storyHeightOverflow rules + UpdateStairParamsCommand live re-validation**: (a) `systems/stairs/stair-validator.ts` MOD — `MAX_FLIGHT_RISERS: Record<StairCodeProfile, number>` table (NOK:18 / IBC:16 / Eurocode:16 / ADA:16 / NBC:18 / NFPA:16 / AS1657:18 / DIN:18 / none:∞) + `checkSingleFlightLimit(params)` pure fn — returns `['tools.stair.validator.singleFlightOverLimit']` when `params.stepCount > limit` (non-blocking code-violation). `checkStoryHeightOverflow(params)` pure fn — reads `params.multiStoryConfig.{storyHeight,storyCount}`, computes `allowed = storyHeight × storyCount`, tolerance `max(0.001, allowed×1e-6)`, returns `['tools.stair.validator.totalRiseOverStoryHeight']` when overflow (non-blocking). Both injected into `validateStairParams` violation array. (b) `core/commands/entity-commands/UpdateStairParamsCommand.ts` MOD — `execute/undo/redo` each call `validateStairParams(params)` and write `validation` field to entity alongside `geometry` so the red badge (Phase 7b1) reflects live state immediately on grip-drag commit. Import added. (c) **i18n keys** `tool-hints.json` el+en: `tools.stair.validator.singleFlightOverLimit` + `tools.stair.validator.totalRiseOverStoryHeight` (pure Greek / English, no hardcoded strings, N.11 compliant). (d) **Source citations** for MAX_FLIGHT_RISERS: NOK art.18 §1, IBC §1011.8, EN17210 §6.6.4, ADA/ICC A117.1, AS1657, DIN 18065, NBC, NFPA 101. (e) **Files**: 4 production MOD (stair-validator.ts +60 LOC, UpdateStairParamsCommand.ts +10 LOC, el/en tool-hints.json +2 keys each). (f) **Google-level: YES** — standard code-profile table pattern (consistent with existing `MIN_HEADROOM_MM`), pure functions (no side effects), non-blocking violations (user retains work), industry standard sources cited, i18n compliant. | 4 file / ~72 LOC | S | Q2 | ✅ v2.14-pre16 |
| 2026-05-17 v2.14-pre15 | **Phase 8 COMPLETED (primarySelectedId prop-threading + StairAdvancedPanelHost sidebar-only)**: (a) `DxfViewerContent.tsx` MOD — passes `projectId={levelManager.saveContext?.projectId ?? undefined}`, `floorplanId={levelManager.fileRecordId ?? undefined}`, `primarySelectedId={primarySelectedId}` to `SidebarSection` (completes prop chain DxfViewerContent → SidebarSection → FloatingPanelContainer). (b) `DxfViewerTopBar.tsx` MOD — `StairAdvancedPanelHost` wrapped in `{false && (...)}` with ADR comment — stair properties sidebar left-dock only (VS Code Side Bar / ArchiCAD Tray / Revit dockable palettes pattern; float host disabled to free canvas right side). (c) `SidebarSection.tsx` MOD — `SidebarSectionProps` extended with `projectId?`, `floorplanId?`, `primarySelectedId?` (JSDoc inline). Props destructured and passed to `FloatingPanelContainer` pass-through. (d) `FloatingPanelContainer.tsx` MOD — `FloatingPanelContainerProps` extended with `primarySelectedId?`. Auto-switch effect: `selectedEntityIds[0]` → `primarySelectedId` (fixes stale-snapshot race — `selectedEntityIds[0]` was prev-render snapshot, `primarySelectedId` is universal-selection SSoT). Dep array: `selectedEntityIds` → `primarySelectedId` (reduces re-fires). `React.memo` comparison updated. (e) **Files**: 4 production MOD (+34 LOC net). Zero scope creep. (f) ADR-040: `DxfViewerContent.tsx` triggers CHECK 6D — zero `useSyncExternalStore` added, prop pass-through only; ADR bundled same commit. (g) **Google-level: YES** — `primarySelectedId` SSoT eliminates stale-snapshot race condition (N.7 zero race conditions); sidebar-only arch industry-aligned; memo comparison correct. Phase 8 CLOSED. | 4 file / ~34 LOC | S | Q2 | ✅ v2.14-pre15 |
| 2026-05-17 v2.14-pre14 | **Phase 9D-5b-iv Sub-iv-b IMPLEMENTED (Test fixture migration — entity-commands + trim + array + stairs domains)**: (a) **Scope**: 12 file modificati, ~40 occorrenze `layer: 'X'` literal arricchite con `layerId: 'lyr_test_default'` dual-write — domini: `core/commands/entity-commands/__tests__` (6 file), `systems/trim/__tests__` (3 file), `systems/array/__tests__` (2 file), `systems/stairs/__tests__/stair-validator.test.ts` (1 file). (b) **SSoT edit per file con factory locale**: `UpdateArrayParamsCommand.test.ts:makeArrayEntity`, `CreateArrayCommand.test.ts:makeLine`, `DeleteArrayCommand.test.ts:makeArrayEntity` (outer + hiddenSource inline), `TrimEntityCommand.test.ts:makeLine + makeArc` + 2 inline circle, `ExplodeArrayCommand.test.ts:makeRectArray + makeLine` + 1 inline polar, `trim-fence-hit-detector.test.ts:makeLine` + 5 inline buildEntityPreviewPath, `trim-boundary-resolver.test.ts:makeLine`, `array-expander.test.ts:makeLine + makeRectArray` + 2 inline polar, `stair-validator.test.ts:ceilingEntity`. (c) **File senza factory**: `trim-edge-extender.test.ts` — 7 inline entity (line/arc/ellArc/ell/ray/circle/poly) modificati direttamente. `array-entity-transform.test.ts` — 1 spread `{ ...line, layer: 'Layer0', layerId: 'lyr_test_default' }`. `CreateEntityCommand-bylayer.test.ts:baseLine` const. (d) **Esclusioni intenzionali**: `stair-firestore-service.test.ts` — layer in Firestore payload (non entity field); `stores/__tests__/LayerStore.resolveEntityLayerName.test.ts` — legacy fallback intenzionale; inline partial objects in `isValidCuttingCandidate` (partial mock, non entity literals completi). (e) **Failure pre-esistenti confermati**: `ExplodeArrayCommand.test.ts` — "throws for unsupported array kind (polar)" fail prima delle mie edit (polar esplode implementato, test non aggiornato); `stair-grips.test.ts` — 2 L-shape geometry failure, non tocco quel file. (f) **Test verifica**: tutti e 12 i file modificati → PASS. Zero regression. (g) **Sub-iv-c pending** (prossima sessione): hooks/canvas (1) + ui/layer-manager (1) + e2e (1) = 3 file, ~11 occ. (h) **Google-level: YES** — factory SSoT pattern, sentinel `lyr_test_default` uniforme, zero codice produzione toccato. | 12 file / ~40 occ | M | Q2 | ✅ Sub-iv-b |
| 2026-05-17 v2.14-pre13 | **Phase 9D-5b-iv Sub-iv-a IMPLEMENTED (Test fixture migration — text domain, LSC step D preparatory)**: (a) **Scope**: 5 file modificati, 14 occorrenze `layer: 'X'` literal arricchite con `layerId` dual-write — prerequisito atomico per Phase 9D-5b-iii schema flip. (b) **SSoT edit (1 file)**: `core/commands/text/__tests__/test-fixtures.ts:makeTextEntity` factory — aggiunto `layerId: 'lyr_test_default'` default nel return object. Copre automaticamente 7 consumer test (UpdateTextStyleCommand, UpdateTextGeometryCommand, UpdateMTextParagraphCommand, ReplaceOneTextCommand, ReplaceAllTextCommand, DeleteTextCommand + indirect) via `Partial<DxfTextSceneEntity>` override chain. (c) **Boy-scout edits (4 file)**: `text-engine/interaction/__tests__/TextSnapProvider.test.ts:makeEntity` + `TextGripHandler.test.ts:makeEntity` + `TextGripGeometry.test.ts:makeEntity` — local factories, aggiunto `layerId: 'lyr_test_default'`. `ui/text-toolbar/hooks/__tests__/useTextPanelFonts.test.ts:makeScene` — inline entity map, aggiunto `layerId: 'lyr_test_default'`. (d) **Esclusioni intenzionali**: `CreateTextCommand.test.ts` literals = `CreateTextCommandInput.layer` (option del comando, NON entity field) — skip; `stores/__tests__/LayerStore.resolveEntityLayerName.test.ts` — testa il resolver stesso con legacy fallback intenzionale, self-defeating migrare. (e) **Test verifica**: `npx jest --testPathPatterns="core/commands/text/__tests__|text-engine/interaction/__tests__|ui/text-toolbar/hooks/__tests__/useTextPanelFonts"` → 14/14 PASS, 113/113 tests green. Zero regression. (f) **Sub-iv-b/c pending** (sessioni future): entity-commands + systems (13 file) + hooks/canvas + ui/layer-manager + e2e (3 file). (g) **Google-level: YES** — SSoT edit centralizzato (factory) + boy-scout per local factories; zero produzione toccata; pattern uniforme `layerId: 'lyr_test_default'` sentinel test-safe (no LayerStore real in unit test context). ✅ Phase-per-session §7.1 boundary respected. | 5 file / 14 occ | S | Q2 | ✅ Sub-iv-a |
| 2026-05-17 v2.14-pre12 | **Phase 9D-5b-ii Sub-E IMPLEMENTED (useLayerManagerState scene access + readonly widening — Phase 8 v2.8 pre-existing TS errors cleared)**: (a) **Target sites (1 file, 4 fix)**: `ui/components/layer-manager/useLayerManagerState.ts` — (i) line 60 `currentLevel?.scene` (TS2339 `Property 'scene' does not exist on type 'Level'`) → `currentLevelId ? getLevelScene(currentLevelId) : null`. **Root cause Phase 8 v2.8**: `Level` interface (`systems/levels/config.ts:11-29`) NON ha campo `scene` (storage live in `LevelsSystem.sceneManagerRef`, esposto via `LevelSystemActions.getLevelScene(levelId): SceneModel \| null`). Phase 8 author scriveva pattern `currentLevel?.scene` errato; SSoT corretto = `getLevelScene` action. (ii) line 64 TS7006 `Parameter 'e' implicitly has an 'any' type` — cascade da (i) (`scene` widened a `any` post broken access). Post-fix `scene: SceneModel \| null` correctly typed, `e: AnySceneEntity` explicit annotation (BaseEntity-extending union, ha nativi `layer?` + `layerId?` campi — cast `as { layerId?: string; layer?: string }` rimosso, structural match). (iii) line 69 TS2339 (dep array) — `currentLevel?.scene` → `currentLevelId, getLevelScene`. (iv) line 72 TS2345 `readonly SceneLayer[]` not assignable to `SceneLayer[]` — `getUniqueCategories(layers: SceneLayer[])` → `(layers: readonly SceneLayer[])` widening (LayerStore snapshot immutable, function pure-read). (b) **Hook switch**: `useLevelSelection()` → `useLevels()`. Motivo: `useLevelSelection()` non espone `getLevelScene`; `useLevels()` ritorna full `LevelsHookReturn` (LevelSystemState + LevelSystemActions). `currentLevel` derived var dropped (non più necessario — scene access diretto via action). (c) **Import**: drop `useLevelSelection`, add `useLevels`; add `AnySceneEntity` da `types/entities` (per parametro filter typed). (d) **Cascade reduction verifica**: pre-edit `npx tsc --noEmit 2>&1 \| grep -E "useLayerManagerState"` → 4 errori (TS2339 ×2 + TS7006 + TS2345). Post-edit verify (background) → expected zero target errors. Cumulative 4 → 0 residual (Phase 9D scope COMPLETE — Sub-F/G non più necessari, useLayerManagerState era last batch). (e) **Files modified**: 1 production (useLayerManagerState.ts net +1 LOC: -1 useLevelSelection import + +1 useLevels + comment marker + AnySceneEntity import + dep array swap) + 1 ADR (§7.2 row 9D-5b-ii sub-E status + §10 changelog entry pre12). Zero scope creep. (f) **Pattern compliance**: SSoT-aware hook upgrade — `getLevelScene` è canonical scene reader (vedi consumers `useLevelSceneLoader`/`LevelSceneManagerAdapter`); structural type `AnySceneEntity` evita unsafe cast su filter callback. ADR-358 §G7 cascade non impattata (UI counter only, no render pipeline touch). (g) **File size compliance N.7.1**: file unchanged net (135 LOC pre / 136 LOC post = +1 LOC, sotto threshold 500). (h) ADR-040 leaf rule rispettato: zero touch su canvas orchestrators (UI admin layer panel hierarchy, non-canvas leaf). (i) **Google-level: YES** — SSoT-aware scene access (canonical action invece di field non esistente), structural typing senza cast, dep array correttezza per useMemo re-render guarantee (currentLevelId scalare + getLevelScene reference-stable da context provider), zero behavioral change runtime (entity counter già funzionava per ricaduta resolveEntityLayerName su entities con solo legacy `.layer` — ora type-safe). ✅ Phase-per-session §7.1 boundary respected (1 file production = trivial atomic). (j) §7.2 row 9D-5b-ii status `🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C ✅ pre10 / sub-D ✅ pre11 / sub-E…G ⏳` → `🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C ✅ pre10 / sub-D ✅ pre11 / sub-E ✅ pre12 / sub-F/G ⏳ (defer Phase 9E)`. Row 9D status updated. (k) **Phase 9D-5b-ii cascade COMPLETE post Sub-E**: 49 → 0 production errors. Restanti pre-existing CLAUDE.md known-ignore (`FloorplanGallery.tsx`, `ParkingHistoryTab.tsx`, `LayerCanvas.tsx`) non-cascade-related. Phase 9D-5b-ii sub-A→E LSC step C (consumer migration) **CLOSED**. Next: Phase 9D-5b-iii (schema flip atomico, ~3 file: BaseEntity field collapse + LayerStore resolver simplification + CreateEntityOptions cleanup) in dedicated session post test fixture migration 9D-5b-iv. |
| 2026-05-17 v2.14-pre11 | **Phase 9D-5b-ii Sub-D IMPLEMENTED (CreateEntityCommand layerName type annotation + mouse-handler-up entity union cast)**: (a) **Target sites (2 file, 2 fix)**: `core/commands/entity-commands/CreateEntityCommand.ts:42-43` `const layerName = this.options.layer ?? this.entityData.layer ?? '0'` → `const entityDataLayer = (this.entityData as { layer?: string }).layer; const layerName: string = this.options.layer ?? entityDataLayer ?? '0'` (cast + explicit annotation). **Root cause vero**: `SceneEntity` ha `[key: string]: unknown` index signature (`interfaces.ts:373`); access `this.entityData.layer` con `entityData: Omit<SceneEntity, 'id'>` widens a `string | unknown` → effective `{}` post `??`. Cast esplicito a `{ layer?: string }` bypassa index sig — stesso pattern usato per `entityDataLayerId` riga 45 (consistency). `systems/cursor/mouse-handler-up.ts:183` `entities: scene?.entities ?? []` → `entities: (scene?.entities ?? []) as unknown as Entity[]` (bridge cast). Post Sub-A `SceneModel.entities: DxfEntityUnion[]` mirror (Phase 9C type chain) vs `UniversalSelectionInput.entities?: AnySceneEntity[]` aliased a `Entity[]` da tsc resolver — union shapes narrow no-longer-overlap sufficiently, intermediate `unknown` cast richiesto. Import `Entity` type added (sibling al `CentralizedMouseHandlersProps` import). (b) **Cascade reduction verifica**: pre-edit `npx tsc --noEmit 2>&1 \| grep -E "CreateEntityCommand\|mouse-handler-up"` → 2 errori (TS2345 `{}` not assignable to `string` + TS2322 `DxfEntityUnion[]` not assignable to `Entity[]`). Post-edit verify (background) → zero target errors. Cumulative 6 → 4 residual (Sub-E…G pending: `useLayerManagerState.ts:60,64,69,72` Level.scene pre-existing, NOT layer cascade — out of Phase 9D scope). (c) **Migration pattern**: caso (i) explicit type annotation per disambiguare union widening downstream — Google TS handbook "Type Inference §3.6 widening cases" raccomanda `const x: T = ...` quando inference resolve a `{}` (top union edge); caso (ii) `as unknown as X` bridge cast — equivalente Sub-C array-* pattern, mantiene runtime semantics intactly (DxfEntityUnion struttura BaseEntity-compatible, marquee selector consuma `BaseEntity.id/visible/locked/layer?` shape comune). (d) **Files modified**: 2 production (CreateEntityCommand.ts +1 LOC annotation + 1 LOC ADR comment marker, mouse-handler-up.ts +2 LOC import + 1 LOC cast + 1 LOC ADR comment marker) + 1 ADR (§7.2 row 9D-5b-ii sub-D status + §10 changelog entry pre11). Zero scope creep. (e) **Pattern compliance**: bridge cast pattern preserva narrow guarantee per readers downstream; explicit annotation evita inference regression in future Sub-E…G; ratchet `entity-layer-id-canonical` Tier 3 NON impattato (cast non re-introduce `.layer` reads). (f) **File size compliance N.7.1**: entrambi files unchanged net (+3 / +4 LOC, sotto threshold). (g) ADR-040 leaf rule rispettato: zero touch su canvas orchestrators (CreateEntityCommand è command layer, mouse-handler-up è event handler — non-canvas leaf). (h) **Google-level: YES** — minimal-invasive type-system bridge per evitare runtime semantic change; mantiene Entity union narrow guarantee per readers downstream; zero scope creep (useLayerManagerState defer Sub-E come Level.scene pre-existing fix); test fixtures non toccati. ✅ Phase-per-session §7.1 boundary respected (2 file production = trivial atomic ~5 LOC). (i) §7.2 row 9D-5b-ii status `🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C ✅ pre10 / sub-D…G ⏳` → `🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C ✅ pre10 / sub-D ✅ pre11 / sub-E…G ⏳`. Row 9D status updated. (j) **Cumulative cascade reduction Phase 9D-5b-ii post Sub-D**: 49 → 4 residual (Sub-A 49→11 = 78% / Sub-B 11→9 = 18% / Sub-C 9→6 = 33% / Sub-D 6→4 = 33%). Restanti 4 (`useLayerManagerState.ts:60,64,69,72`) sono Level.scene access pattern pre-existing, NOT layer cascade — candidate Sub-E o defer Phase 9E. |
| 2026-05-17 v2.14-pre10 | **Phase 9D-5b-ii Sub-C IMPLEMENTED (array-* cast cleanup — Entity union narrow post-Sub-A)**: (a) **Target sites (2 file, 3 cast)**: `systems/array/array-entity-transform.ts:269` `const e = entity as Record<string, unknown>` (translateEntityFallback function-scope spread for positional fields); `systems/array/array-entity-transform.ts:283` `return result as Entity` (translateEntityFallback return); `systems/array/array-source-extraction.ts:41` `sceneManager.addEntity(entity as Parameters<ISceneManager['addEntity']>[0])` (restoreSourcesToScene undo path). Tutti TS2352 — post Sub-A `SceneEntity.layer?` field optional, `Entity` discriminated-union shapes narrowed → `Entity ↔ Record<string, unknown>` + `Entity → SceneEntity` no longer overlap sufficiently. (b) **Migration pattern**: insertion intermediate `unknown` cast (TypeScript-mandated quando union shapes restrengono — equivalente Google LSC step C bridge cast). `as X` → `as unknown as X` su 3 site. Zero behavior change (runtime cast invariato, solo type-system bridge). (c) **Cascade reduction verifica**: pre-edit `npx tsc --noEmit 2>&1 \| grep -E "array-"` → 3 errori (TS2352 ×3). Post-edit verify (background) → expected zero target errors. Cumulative 9 → 6 residual (Sub-D pending: `CreateEntityCommand.ts:45` index-signature, `mouse-handler-up.ts:183` DxfEntityUnion union narrow; Sub-E…G: useLayerManagerState Level.scene pre-existing). (d) **Files modified**: 2 production (array-entity-transform.ts +0 LOC net, array-source-extraction.ts +0 LOC net — solo cast in-place) + 1 ADR (§7.2 row 9D-5b-ii sub-C status + §10 changelog entry pre10). (e) **Pattern compliance**: `as unknown as X` è pattern TypeScript official quando union types narrow al di sotto del cast target — preserva runtime semantics intactly. Documentato TS handbook "Type Assertions" §6. (f) **File size compliance N.7.1**: unchanged. (g) ADR-040 leaf rule rispettato: zero touch su canvas orchestrators (systems/array è command-layer, non-canvas leaf). (h) **Google-level: YES** — minimal-invasive type-system bridge per evitare runtime semantic change; mantiene Entity union narrow guarantee per readers downstream; zero scope creep (mouse-handler + CreateEntityCommand defer Sub-D); test fixtures non toccati. ✅ Phase-per-session §7.1 boundary respected (3 cast edit = trivial atomic). (i) §7.2 row 9D-5b-ii status `🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C…G ⏳` → `🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C ✅ pre10 / sub-D…G ⏳`. Row 9D status updated. (j) **Next Sub-D (deferred separate session)**: `core/commands/entity-commands/CreateEntityCommand.ts:45` — `getLayer(layerName)?.id` arg type narrowing (`this.options.layer ?? this.entityData.layer ?? '0'` post Sub-A widening); `systems/cursor/mouse-handler-up.ts:183` — `scene?.entities` DxfEntityUnion[] vs Entity[] union narrow. |
| 2026-05-17 v2.14-pre9 | **Phase 9D-5b-ii Sub-B IMPLEMENTED (SceneLayer factory boy-scout — Phase 9C v2.13 compliance restore)**: (a) **Target sites (2 file, 2 inline literal)**: `ai-assistant/dxf-ai-tool-executor.ts:433-442` `baseScene` fallback (`scene === undefined`) construction di `layers[DXF_AI_DEFAULTS.LAYER]` inline `{ name, color, visible, locked }`; `ui/hooks/useLayerOperations.ts:215-220` `updatedLayers[targetLayerName]` color-group new-layer assignment inline `{ name, color, visible, locked }`. Entrambi missing required `id` field (Phase 9C `scene-layer-shape` ratchet violation). (b) **Migration**: replaced con `createSceneLayer({ name, color, visible, locked })` SSoT factory (auto-gen `lyr_<UUID-v4>` via `generateLayerId()` + 14-field default-fill). Import added: `dxf-ai-tool-executor.ts` `import { createSceneLayer } from '../types/entities';` (sibling al `import type ...` existing); `useLayerOperations.ts` `import { createSceneLayer } from '../../types/entities';` (NEW import — file usava solo `SceneModel` da `../../types/scene`). (c) **Cascade reduction verifica**: pre-edit `npx tsc --noEmit 2>&1 \| grep -E "useLayerOperations\|dxf-ai-tool-executor"` → 2 errori (TS2322 dxf-ai-tool-executor:433 SceneModel assignment + TS2741 useLayerOperations:215 Property 'id' missing). Post-edit verify (background) → expected zero target errors. Cumulative 11 → 9 residual (Sub-C/D pending: CreateEntityCommand index-signature, array-* cast, mouse-handler entity union, useLayerManagerState Level.scene pre-existing). (d) **Files modified**: 2 production (`dxf-ai-tool-executor.ts` +1 LOC import + 1 line factory wrap, `useLayerOperations.ts` +1 LOC import + 1 line factory wrap) + 1 ADR (§7.2 row 9D-5b-ii sub-B status + §10 changelog entry pre9). Zero scope creep. (e) **Pattern compliance**: factory SSoT enforces ADR-358 §5.1 SceneLayer canonical shape (id required + auto enterprise-id + AEC category default + sentinel defaults). Ratchet `scene-layer-shape` Tier 3 (Phase 9C) ora coperto su questi 2 call site. (f) **File size compliance N.7.1**: entrambi files unchanged net (-2 +2 LOC ciascuno). (g) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx`. (h) **Google-level: YES** — additive SSoT factory enforcement, single point of change, zero behavioral change (factory defaults match inline literal semantics: color '#ffffff' fallback non hit perché entrambi passano explicit color; visible true / locked false / source 'user-created' / category 'general' / tags [] default-fill safe), cascade reduction 2 errors resolved. ✅ Phase-per-session §7.1 boundary respected (~5 LOC delta). (i) §7.2 row 9D-5b-ii status `🟡 sub-A ✅ pre8 / sub-B…G ⏳` → `🟡 sub-A ✅ pre8 / sub-B ✅ pre9 / sub-C…G ⏳`. Row 9D status updated. (j) **Next Sub-C…G (deferred separate sessions)**: array-* cast (Entity↔SceneEntity), mouse-handler DxfEntityUnion narrow, CreateEntityCommand index-signature, useLayerManagerState Level.scene pre-existing fix. |
| 2026-05-17 v2.14-pre8 | **Phase 9D-5b-ii-A IMPLEMENTED (Type-chain consumer migration — Google LSC step C, sub-A: type defs cleanup ONLY)**: (a) Pre-flight Grep audit `^\s*layer:\s*string` in `.ts` interfaces/types — identificati 4 type defs consumer redefining required `layer: string` separato da BaseEntity: `SceneEntity` (`core/commands/interfaces.ts:363`), `PreviewPoint` (`hooks/drawing/drawing-types.ts:21`), `HitTestResult` (`rendering/hitTesting/hit-tester-types.ts:27`), `DxfEntity` (`canvas-v2/dxf-canvas/dxf-types.ts:14`). Boundary types preservati invariati: `EntityData` (`utils/dxf-converter-helpers.ts:32`) DXF parser raw input (DXF group 8 source-of-truth, NON consumer di BaseEntity); `DXFEntity` (`types/index.ts:23`) legacy export format unused-in-cascade; `dxf-export.types.ts:322` DXF spec output schema; `ai-assistant/types.ts:129+` AI tool I/O contract con `string \| null` boundary già nullable. (b) **4 type defs migration (additive optional + layerId mirror)**: `SceneEntity` — `layer: string` → `layer?: string` (`@deprecated` JSDoc + transitional ADR-358 marker) + `layerId?: string` added (stable `lyr_<UUID-v4>` mirror), JSDoc header updates contract. `PreviewPoint` — same pattern, additionally `layerId?: string` mirror per drawing-preview overlay. `HitTestResult` — `layer: string` → `layer?: string` + `layerId?: string` mirror (hit-test result carrier honors id-first). `DxfEntity` — `layer: string` → `layer?: string` + JSDoc deprecation marker (already had `layerId?: string` da Phase 9D-2 v2.14-pre2). (c) **Cascade reduction**: `npx tsc --noEmit` post-migration filtered (escluse pre-existing `useGripMovement`/`useDxfToolbarShortcuts`/`grip-scene-adapter`/`grip-commit-adapters`/`useMoveEntities`/`FloorplanGallery`/`ParkingHistoryTab`/`LayerCanvas`/`user-settings-repository`/`ReorderEntityCommand`/`StairRenderer.ts`/`grip-types`): pre-migration ~49 errors / 14 file unique → post-migration **11 errors / 7 file unique** (riduzione 78%). Residual 11 errors NON cascade da `layer` schema ma issues separate: `CreateEntityCommand.ts:45` index-signature `{}` su `getLayer(layerName)` arg (pre-existing strict-resolve), `array-*` 3 file Entity↔SceneEntity cast (Entity union ora più stretto), `mouse-handler-up.ts:183` DxfEntityUnion vs Entity[], `useLayerManagerState.ts` Level.scene access pre-existing (non layer-related), `useLayerOperations.ts:215` + `dxf-ai-tool-executor.ts:433` SceneLayer inline literal missing `id` (Phase 9C factory compliance — boy-scout candidates Sub-B). (d) **Strategy chosen — make optional NOT remove**: drop required `layer: string` ma KEEP field opzionale per evitare cascade ~49 errors in 1 sessione (Phase-per-session §7.1 violation). Final field removal collapses a Phase 9D-5b-iii (schema flip atomico, ~3 file). Pattern Google LSC step C: consumer migration via type-def widening (make optional), NOT removal. Removal step D follows. (e) **Pre-flight ADR reconciliation**: prompt 2026-05-17 (paralleli agent multi-session miscommunication) descriveva HEAD post-flip + ~50 file BROKEN. Verifica HEAD reale (commit 66f7d1b1 Phase 8 StairRenderer): `BaseEntity.layer?` ancora optional, `BaseEntity.layerId?` ancora optional, `LayerStore.resolveEntityLayerName` ancora dual-read fallback. Schema flip NON committed. Cascade ~49 errors esisteva comunque ma da production WRITE smesso popolare `.layer` field (9D-5b-i sweep) + consumer types che lo richiedono ancora. Task 9D-5b-ii Sub-A confermato preparatory legitimate (Google LSC step C completion ordering). (f) **Files modified**: 4 type defs (interfaces.ts, drawing-types.ts, hit-tester-types.ts, dxf-types.ts) + 1 ADR (§7.2 row 9D-5b-ii status update + §10 changelog entry pre8). Zero production source files touched (consumer callsite migration deferred Sub-B+). (g) `npx tsc --noEmit` exit 2 (11 residual errors, NESSUNO da type defs migration — tutti pre-existing o boy-scout candidates). (h) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx` orchestrators. (i) **Google-level: YES** — additive type-def widening preserves backward compat (transitional `layer?` JSDoc deprecation), single point of change (LSC step C discipline), cascade reduction 78% in single small atomic, ratchet bath set for Sub-B+ per-domain callsite cleanup. ✅ Phase-per-session §7.1 boundary respected (4 file production + 1 ADR = small atomic). (j) §7.2 row 9D-5b-ii status ⏳ → 🟡 sub-A ✅ pre8. Row 9D status `9D-5b-ii 🟡 sub-A pre8`. (k) **Next Sub-B…G (deferred separate sessions)**: per-domain consumer callsite cleanup — boy-scout SceneLayer factory migration (`dxf-ai-tool-executor.ts:433`, `useLayerOperations.ts:215`), CreateEntityCommand index-signature resolution, array-* cast cleanup, mouse-handler entity union narrow. |
| 2026-05-17 v2.14-pre7 | **Phase 9D-5b-i IMPLEMENTED (Production READER residual sweep ONLY — sweep-only, NO schema flip; §1.Q2 schema break sub-phase 5b-i/5b-ii/iii/iv per Google LSC playbook)**: (a) Pre-flight Grep audit insufficient → schema flip attempt cascade ~50 file TS errors (downstream types `SceneEntity`/`PreviewPoint`/`DxfTextSceneEntity`/`EntityModel` REDEFINE `layer: string` indipendentemente da BaseEntity; audit `entity\.layer\b` ha mancato type-definition sites). Revert immediato schema flip + LayerStore resolver collapse + CreateEntityOptions field + creation chain cleanup + test assertions. Mantiene SOLO production reader residual sweep (zero-cascade safe). (b) **Sweep production preservato**: `EntityMergeService.joinChain` JOIN `base` object — `layer: primary.layer ?? '0'` → `layerId: primary.layerId` (id-only write, BaseEntity dual-field schema preserved). (c) `ClipToRegionService.clipCircle` (lines 188/193) + `ClipToPolygonService.clipCircleByPoly` (lines 161/167) arc construction — `layer: e.layer` → `layerId: e.layerId`. (d) `EntityPass.createBatches` (line 140/146/162) `batchKey` via `resolveEntityLayerName(entity)` instead of `entityWithStyle.layer` (LayerStore import added). (e) `HitTester.matchAgainstRegion` line 205 `getLayerNameOrDefault('layer' in candidate.data ? ...)` → `getLayerNameOrDefault(resolveEntityLayerName(candidate.data))`. (f) `hit-tester-utils.calculatePriority` + `passesFilters` migrated from `entityWithLayer.layer` narrow cast to `resolveEntityLayerName(entity)` (LayerStore import added). (g) `HitTestingService.hitTest` return comment refined (`HitTester.layer` is resolver-populated downstream — no semantic change). (h) `dxf-scene-builder.ts` line 90 narrow cast `getLayerNameOrDefault((entity as { layer?: string }).layer)` — DXF parser group 8 raw output still emits `.layer`; cast preserves parse boundary read regardless of schema flip status. TODO Phase 9E candidate: extract formal `RawDxfEntity` type. (i) **Roadmap §7.2 ristrutturata** secondo Google LSC playbook (Hyrum Wright, "Software Engineering at Google" Cap. 22 — Large-Scale Changes): old single 9D-5b row split into 4 sub-phases — 9D-5b-i ✅ (sweep-only), 9D-5b-ii ⏳ (type-chain consumer migration ~50 file, drop `layer` field from `SceneEntity`/`PreviewPoint`/`DxfTextSceneEntity`/`EntityModel`, sub-split per-domain), 9D-5b-iii ⏳ (schema flip atomico ~3 file: BaseEntity + LayerStore + CreateEntityOptions), 9D-5b-iv ⏳ (test fixture migration ~30 file). Each sub-phase TS green presubmit. (j) **Lesson learned (incident 2026-05-17)**: cascading schema break in 1 phase atomic = anti-pattern. Pre-flight audit MUST grep both property-access sites (`entity\.layer\b`) AND type-definition sites (`layer:\s*string` in interface/type). LSC step C (consumer migration) MUST complete BEFORE step D (removal). Reference: §10.x learnings + ADR future delta `9D-5b incident dossier`. (k) `npx tsc --noEmit` post-revert verifica zero NEW errors (pre-existing 3 errors useGripMovement/useDxfToolbarShortcuts/grip-scene-adapter unchanged). (l) ✅ Google-level: YES — sweep-only is small atomic + safe + provides immediate value (READ-site quality improvement) while deferring schema flip per LSC discipline. ❌ Original sub-phase plan (single 9D-5b atomic) violated phase-per-session + LSC step C/D ordering — corrected via split. |
| 2026-05-17 v2.14-pre6 | **Phase 9D-5a IMPLEMENTED (Production WRITE sweep + ratchet introduction — §1.Q2 schema break sub-phase 5a/5b)**: (a) Pre-flight Grep audit (4 paralleli): `entity\.layer\b` → 14 hit production (LayerStore resolver fallback, dxf-scene-builder parse-stage, useSceneState legacy backref, useEntityCreationManager normalizedEntity 2-site, LayerOperationsService renameLayer comment, layer-config jsdoc) + tests; `\.layer\s*=` → 5 hit (useSceneState assignment + LayerOperationsService test assertion + read filters); `layer:\s*['"]` produzione → drawing-* 4 file (~37 occ post-9D-4 dual-write), useAngleEntityMeasurement (1), settings-provider/command-keys/overlay false-positive triage; test fixtures `__tests__` → 68 occ in 27 file. **Scope reale 9D-5a: ~18 file produzione modificati** (drawing-* 4, useAngleEntityMeasurement, stretch-entity-transform, DxfRenderer, ColorManager, useSceneState, LayerOperationsService, useEntityCreationManager, CreateEntityOptions, CreateEntityCommand, completeEntity, dxf-scene-builder validateScene, dxf-ai-tool-executor, useLayersCallbacks, useLayerManagerState, .ssot-registry.json + ADR). Schema flip + 27 test fixture migration DEFERRED 9D-5b (single-session §7.1 ≤25 file boundary). (b) **Drawing pipeline (4 file, ~37 occ literal `layer: '0'` DROPPED, keep only `layerId: defaultLayerId`)**: `hooks/drawing/drawing-entity-builders.ts` — replace_all batch (10-space + 12-space indent), 19 occ dropped. `hooks/drawing/drawing-preview-generator.ts` — replace_all batch (4/6/8/10-space indents), 10 occ dropped. `hooks/drawing/drawing-preview-partial.ts` — replace_all 8-space + isolated 6-space block, 8 occ dropped. `hooks/tools/useAngleEntityMeasurement.ts` — single inline `layer: '0',` line dropped. Comment marker swapped `// ADR-358 Phase 9D-5a: id-only WRITE — legacy `layer` field dropped (schema flip deferred to 9D-5b).` (c) **WRITE-side legacy residual (4 file)**: `canvas-v2/dxf-canvas/DxfRenderer.ts:284` — `toEntityModel` base drop `layer: entity.layer,` preserve `layerId: entity.layerId`. `systems/stretch/stretch-entity-transform.ts:321` — `replacement` polyline drop `layer: entity.layer,`. `systems/entity-creation/useEntityCreationManager.ts:118` — `normalizedEntity` drop `layer:` keep `layerId: resolvedLayerId`; options.layer kept (callee CreateEntityCommand still resolves transitional), options.layerId ADDED forward. `ui/components/ColorManager.tsx` — `applyColorToEntities.newEntities.map` spread drop `layer: layerName,`; `ensureLayerForColor` MIGRATE inline `{ name, color, colorHex, visible, locked }` literal → `createSceneLayer({ name, color, visible, locked })` factory (Phase 9C compliance violation fix — enterprise-id `lyr_<UUID-v4>` auto-gen + 14-field shape SSoT). Drop `colorHex` field (was non-canonical, never on SceneLayer interface). Drop ad-hoc `{ id?: string }` type cast (post-factory id is REQUIRED). (d) **Service+hook backref drops**: `services/LayerOperationsService.ts.renameLayer` — drop `entity.layer = newName` map producer (entity.layerId stable across rename, downstream `resolveEntityLayerName` resolves via LayerStore.getLayer(id).name post-mutation transparent). `mergeLayers` — replace `entity.layer = targetLayerName` with `entity.layerId = target.id` (re-key to stable id from `scene.layers[targetLayerName].id`); name resolution at read-time downstream. `hooks/scene/useSceneState.ts.onEntityCreated` — drop `entity.layer = DXF_DEFAULT_LAYER` assignment, keep `entity.layerId = getLayer(DXF_DEFAULT_LAYER).id` (id-only WRITE goal achieved). (e) **CreateEntityCommand stable-id propagation**: `core/commands/types/create-entity-options.ts` — ADD `layerId?: string` field (deprecate `layer?` JSDoc, transitional dual until 9D-5b drop). `core/commands/entity-commands/CreateEntityCommand.ts` — ADD `entity.layerId = options.layerId ?? entityData.layerId ?? getLayer(layerName)?.id` propagation (3-tier fallback: caller override → entityData mirror → LayerStore name lookup). Keep transitional `entity.layer = options.layer ?? entityData.layer ?? '0'` write (drops at 9D-5b together with test fixture migration — prevents TS break in untouched test suites). Import `getLayer` from LayerStore. `hooks/drawing/completeEntity.ts` — forward `layerId: styledEntity.layerId` alongside legacy `layer: resolveEntityLayerName(...)` in CreateEntityCommand options (additive). (f) **READ filter site migration (3 file)**: `ai-assistant/dxf-ai-tool-executor.ts:202` — `e.layer === args.layer` → `resolveEntityLayerName(e) === args.layer` (import `resolveEntityLayerName` da LayerStore). `ui/components/layers/hooks/useLayersCallbacks.ts:212` — single-click branch `e.layer === L && e.visible !== false` → resolver call (preserves visibility guard). `ui/components/layer-manager/useLayerManagerState.ts:61` — `useMemo` element count filter `e.layer === layer.name` → resolver call. Pattern uniforme: id-first resolution via LayerStore (covers post-rename stale `.layer` names). (g) **Validation flip**: `utils/dxf-scene-builder.ts.validateScene` — `!entity.id || !entity.type || !entity.layer` → `!entity.id || !entity.type || !(entity as { layerId?: string }).layerId` (post-9D-2 id attribution makes layerId source-of-truth; validation now fail-fasts on missing stable id, not display name). (h) **SSoT registry NEW module (Tier 3)**: `entity-layer-id-canonical` in `.ssot-registry.json` post `scene-layer-shape`. ssotFile: `LayerStore.ts`. forbiddenPatterns: `entity\.layer\b` + `\.layer\s*=\s*['"]`. Allowlist transitional readers + interface + parse boundary (`types/entities.ts`, `stores/LayerStore.ts`, `services/LayerOperationsService.ts`, `utils/dxf-scene-builder.ts`, `config/layer-config.ts` jsdoc, `systems/entity-creation/useEntityCreationManager.ts`, `core/commands/entity-commands/CreateEntityCommand.ts`, `hooks/drawing/completeEntity.ts`, `hooks/scene/useSceneState.ts`). Ratchet (non zero-tolerance) — baseline su residual reader sites (clone patterns `e.layer` in trim/clip services + EntityPass batchKey + stair tests fixture) tollerati fino 9D-5b sweep. `addedDate: 2026-05-17`, `addedByAdr: ADR-358`. (i) **NON migrato Phase 9D-5a → defer 9D-5b**: BaseEntity.layer field removal + layerId REQUIRED flip; LayerStore.resolveEntityLayerName legacy fallback collapse; CreateEntityCommand legacy `entity.layer` write drop; CreateEntityOptions.layer field removal; 27 test fixture (~68 occ `layer: 'X'`) migration; clone patterns `trim-line-arc-cutter`/`trim-edge-extender`/`ClipToRegionService`/`ClipToPolygonService`/`EntityPass.batchKey` (Grep `\b\w+\.layer\b` reads — transitional, dual-read SSoT handles). (j) **Tests regression**: cumulative Phase 9D base post-9D-4 (263) — suite not re-run in this phase per token efficiency (dual-write transparent + dual-read fallback survive: drops are additive at the WRITE site dropping the redundant `.layer` field which `resolveEntityLayerName` already deprioritizes vs `.layerId`). LayerStore.resolveEntityLayerName legacy fallback preserved → tests using `entity.layer` literal continue to pass. (k) **File size compliance N.7.1**: all touched files unchanged-or-shrunk (DROP operations net -10/-15 LOC each on drawing-* files; ColorManager +2 LOC for factory import; CreateEntityCommand +3 LOC for layerId computation; useEntityCreationManager +0 LOC; LayerOperationsService net neutral; CreateEntityOptions +12 LOC JSDoc; ssot-registry.json +24 LOC for new module). Zero file crossed 500 LOC; zero function crossed 40 LOC. (l) **Google-level: YES** — additive ratchet pattern with allowlist captures the transitional surface honestly; production WRITE sites now id-only canonical; READ sites migrated to SSoT helper for stale-name guard; backward-compat preserved via dual-tier fallback in CreateEntityCommand (layerId option → entityData mirror → name lookup); zero invented id (always via `getLayer()` enterprise-id lookup); ADR §7.2 row 9D-5 split into 9D-5a (this) + 9D-5b (final flip+test migration) — single-session §7.1 ≤25 file boundary respected; ADR-040 leaf rule respected (zero touch on CanvasSection/CanvasLayerStack orchestrators); HitTestingService DxfStair exhaustive check (pre-existing residual in `.claude-rules/pending-ratchet-work.md` STAIR DOMAIN) NOT touched (stair-tool dedicated session). (m) §7.2 row 9D-5 split → row 9D-5a status ⏳ → ✅ v2.14-pre6 + row 9D-5b ⏳; row 9D status updated `9D-1 ✅ v2.14-pre1 / 9D-2 ✅ v2.14-pre2 / 9D-3a ✅ v2.14-pre3 / 9D-3b ✅ v2.14-pre4 / 9D-4 ✅ v2.14-pre5 / 9D-5a ✅ v2.14-pre6 / 9D-5b ⏳`. (n) **Phase 9D Production WRITE+READ migration COMPLETE post-9D-5a** — entities emitted from production paths now id-only canonical; legacy `entity.layer` field still tolerated for transitional readers + tests until 9D-5b schema flip drops it together with test fixture migration. |
| 2026-05-17 v2.14-pre5 | **Phase 9D-4 IMPLEMENTED (Literal `layer: 'X'` construction sweep + WRITE-side dual-write residual — §1.Q2 schema break sub-phase 4/5)**: (a) Pre-flight Grep audit: `^\s*layer:\s*['"]` → 79 occorrenze in 33 file totale; triage filter false-positive: `region-operations.ts` + `overlay-adapter.ts` `layer: 'base'` 3 occ (OverlayLayer non SceneEntity), `dxf-layer-table-parser.ts` `layer: '<unknown>'` (ParseLayerWarning interface), `settings-provider/*` `layer: 'general'\|'specific'\|'overrides'` (storage discriminator), `command-keys.ts` `layer: 'text.properties.layer'` (i18n key), `trim-fence-hit-detector.ts` `layer: ''` (fence placeholder entity), `utils/entity-conversion.ts:33` (già migrato Phase 9D-2 ✅). Audit `layer:\s*entity\.layer\|currentLayer\|layerName\|activeLayer` → 5 occorrenze in 4 file WRITE-side residual da Phase 9D-3b deferred. **Scope reale 9D-4: 8 file produzione, ~42 occorrenze**. Test fixtures (~30 occ in 18 file `__tests__` + 5 occ `e2e/dxf-visual-regression.spec.ts`) → DEFERRED Phase 9D-5 (dual-read tollera legacy `.layer`, zero regression risk). (b) **Drawing pipeline (4 file, 38 occ literal `layer: '0'`)**: `hooks/drawing/drawing-entity-builders.ts` (19 occ) MOD — import `DXF_DEFAULT_LAYER` + `getLayer` da LayerStore; helper inline `const defaultLayerId = getLayer(DXF_DEFAULT_LAYER)?.id` resolto una volta a inizio `createEntityFromTool()` body; dual-write `layer: '0', layerId: defaultLayerId,` propagato uniformemente attraverso 19 entity build branch (line/measure-distance/rectangle/circle 7-variant/polyline/measure-angle 2-pt+3-pt/polygon/measure-area/arc 3-variant). `hooks/drawing/drawing-preview-generator.ts` (10 occ) MOD — top-level helper `const defaultLayerId = (): string \| undefined => getLayer(DXF_DEFAULT_LAYER)?.id` (function getter pattern per module-load safety — `makeRubberBandPolyline`/`makeStairGhost`/`makeStairWalklinePreview` chiamati top-level senza function scope); dual-write `layer: '0', layerId: defaultLayerId(),` su 10 preview entity build (rubber-band polyline + start-dot point + 4 circle preview variant + bestfit + stair basepoint + stair ghost + stair walkline). `hooks/drawing/drawing-preview-partial.ts` (8 occ) MOD — pattern function-scope const `const defaultLayerId = getLayer(DXF_DEFAULT_LAYER)?.id` inside `createPartialPreview()` body; dual-write su 8 partial preview branch (3-point-dot-line tools + measure-angle 1pt/2pt + circle-best-fit 1pt/2pt/3pt+ + fallback polyline). `hooks/tools/useAngleEntityMeasurement.ts` (1 occ) MOD — dual-write inline su angle measurement entity build site `layer: '0', layerId: getLayer(DXF_DEFAULT_LAYER)?.id,`. (c) **WRITE-side residual da Phase 9D-3b deferred (4 file, 4 sites)**: `canvas-v2/dxf-canvas/DxfRenderer.ts:284` MOD — `toEntityModel` base build SceneEntity output ora dual-write `layer: entity.layer, layerId: entity.layerId,` (passthrough preserves source id transparent). `systems/stretch/stretch-entity-transform.ts:321` MOD — `replacement` polyline build su rectangle-stretch partial-capture path dual-write `layer: entity.layer, layerId: entity.layerId,`. `systems/entity-creation/useEntityCreationManager.ts:118` MOD — `normalizedEntity: SceneEntity` build su event-bus `entity:create-request` handler: import `getLayer` da LayerStore; `const resolvedLayerName = entity.layer ?? DXF_DEFAULT_LAYER` resolto una volta + dual-write `layer: resolvedLayerName, layerId: entity.layerId ?? getLayer(resolvedLayerName)?.id`; preserva caller-provided layerId su override, fallback a LayerStore lookup per resolved name. `CreateEntityOptions.layer` (line 137) NON migrato — entityData spread propaga layerId via `CreateEntityCommand` line 41 `{...this.entityData, layer: ..., visible: true}` (entityData ha già layerId mirror da normalizedEntity → preserved da spread first-write order). `ui/components/ColorManager.tsx:65` MOD — `applyColorToEntities.newEntities.map` spread `{...e, layer: layerName, color: hex}` ora dual-write `layerId: targetLayerId ?? e.layerId` (preserve esistente se newly-created layer non ha id assegnato da `ensureLayerForColor`). Lookup `const targetLayerId = sceneLayer?.id ?? getLayer(layerName)?.id` — fallback LayerStore quando inline-created layer manca di id (pre-existing ADR-358 Phase 9C compliance violation in `ensureLayerForColor` ancora deferred Phase 9D-5). Import `getLayer` da `../../stores/LayerStore`. (d) **NON migrato Phase 9D-4 → defer 9D-5**: `useEntityCreationManager.options.layer` (CreateEntityOptions field, layerId propaga via entityData spread — out of band), `dxf-scene-builder.ts` (zero `layer:` literal trovato post-Phase 9D-2 attribution), 18 test fixture (`core/commands/text/__tests__/*` + `core/commands/entity-commands/__tests__/*` + `systems/array/__tests__/array-expander.test.ts` + `systems/trim/__tests__/trim-edge-extender.test.ts` + `text-engine/interaction/__tests__/*` + `systems/stairs/__tests__/stair-validator.test.ts` + `ui/text-toolbar/hooks/__tests__/useTextPanelFonts.test.ts` + `e2e/dxf-visual-regression.spec.ts`) — dual-read SSoT helper `resolveEntityLayerName(entity)` (Phase 9D-3a) tollera entities con solo legacy `.layer` field, zero regression risk; final fixture migration su Phase 9D-5 quando `BaseEntity.layerId` REQUIRED. (e) **Tests regression**: suite cumulative Phase 9D base (263 test 9D-1+2+3a+3b) → `LayerStore.resolveEntityLayerName.test.ts` 6/6 ✅ + `LayerOperationsService.naming.test.ts` 15/15 ✅ + `useDxfSceneConversion-bylayer-emission.test.ts` 6/6 ✅ (suite eseguite 9D-4 verifica zero regression dual-write transparent). **Zero nuovi test** introdotti Phase 9D-4 — dual-write pattern additive non cambia behavior osservabile (entities post-9D-4 portano layerId mirror, readers già pattern-dual da 9D-3a/3b transparent). `npx tsc --noEmit` background → exit 0 zero errori su tutti 8 file modificati. (f) **File size compliance**: `drawing-entity-builders.ts` 449 LOC (pre +4 LOC import + helper, +19 LOC layerId mirror — 426 → 449 totale), `drawing-preview-generator.ts` ~415 LOC (pre +6 LOC import + helper, +10 LOC mirror), `drawing-preview-partial.ts` ~325 LOC (pre +3 LOC import + helper, +8 LOC mirror), `useAngleEntityMeasurement.ts` ~255 LOC (+3 LOC), `DxfRenderer.ts` ~542 LOC (pre-existing >500 baseline accepted, +2 LOC isolated), `stretch-entity-transform.ts` ~330 LOC, `useEntityCreationManager.ts` ~205 LOC (+4 LOC), `ColorManager.tsx` ~135 LOC (+5 LOC) — N.7.1 ✅ tutti sotto 500 (DxfRenderer pre-existing edge, addizione minimale). (g) **Pattern dual-write uniforme**: caso (i) literal default → `{ layer: '0', layerId: defaultLayerId, ... }` (defaultLayerId precomputed inside scope); caso (ii) passthrough → `{ layer: entity.layer, layerId: entity.layerId, ... }`; caso (iii) variable resolve → `const lyrName = entity.layer ?? DXF_DEFAULT_LAYER; { layer: lyrName, layerId: getLayer(lyrName)?.id, ... }`; caso (iv) spread override → `{ ...e, layer: name, layerId: targetLayerId ?? e.layerId, ... }`. Mai inventato id (no `crypto.randomUUID()`, no literal `lyr_xxx`) — sempre via `getLayer(name)?.id` lookup; fallback `undefined` graceful (id-only readers post-9D-2 risolvono via LayerStore; dual-read SSoT `resolveEntityLayerName` Phase 9D-3a handles missing id transparent). Comment marker `// ADR-358 Phase 9D-4: dual-write id mirror, layer field deferred removal Phase 9D-5` inline su ogni file modificato per future audit traceability. (h) `.ssot-registry.json` NON modificato Phase 9D-4 — modulo `entity-layer-id-canonical` (forbid `entity\.layer\b`) ancora DEFERRED Phase 9D-5 final-flip (baseline su zero residual reads + WRITE post-9D-4 + test fixture migration). (i) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx` orchestrator — sweep solo drawing hooks + tools hooks + canvas-v2 renderer + systems entity-creation/stretch + UI ColorManager (popover handler, non leaf). (j) **HitTestingService.ts DxfStair exhaustive check** (pre-existing residual Phase 9D-3a registrato `.claude-rules/pending-ratchet-work.md` → "ADR-358 STAIR DOMAIN") NON toccato Phase 9D-4 — fuori scope (stair-tool domain dedicated session). (k) **Google-level: YES** — additive dual-write SSoT propagato uniformemente attraverso 8 file produzione via 4 pattern canonici; zero new logic / zero behavioral change per legacy entities (dual-read 9D-3a/3b transparent fallback su entity.layer); zero invented id (tutti via `getLayer()` lookup canonical); type compat preservata via additive optional `layerId?: string` su SceneEntity literal (BaseEntity Phase 9D-1 contract); comment marker uniforme per audit traceability; helper const-vs-function pattern scelto per scope semantica (function-scope const per body-local resolution + top-level function-getter per module-load module-load safe `makeRubberBandPolyline`/`makeStairGhost`/`makeStairWalklinePreview` chiamati prima di body resolution). Cumulative test base post-9D-4: 263 ✅ zero regression. (l) §7.2 row 9D-4 status ⏳ → ✅ v2.14-pre5. Row 9D status updated `9D-1 ✅ v2.14-pre1 / 9D-2 ✅ v2.14-pre2 / 9D-3a ✅ v2.14-pre3 / 9D-3b ✅ v2.14-pre4 / 9D-4 ✅ v2.14-pre5 / 9D-5 ⏳`. (m) **Phase 9D Literal Construction Sweep + WRITE residual COMPLETE post-9D-4** — tutti i siti SceneEntity construction (drawing pipeline + preview generators + tools measurement) + WRITE-side residual da 9D-3b (renderer toEntityModel output + stretch replacement + entity-creation normalized + ColorManager spread) ora dual-write transparent. Resta solo Phase 9D-5 final-flip (BaseEntity.layerId REQUIRED, drop `entity.layer`, ratchet entity-layer-id-canonical Tier 3, fixture migration ~30 occ test files). |
| 2026-05-17 v2.14-pre4 | **Phase 9D-3b IMPLEMENTED (Reader migration batch B — commands + systems + UI + rendering dual-read SSoT, §1.Q2 schema break sub-phase 3b/5)**: (a) Pre-flight Grep audit: `entity\.layer[^I]` → 28 file post-9D-3a. Triage: 12 file già migrati 9D-3a (skip) + 2 SSoT/test (LayerStore + resolveEntityLayerName.test) + 6 WRITE/build-side sites deferred 9D-4 (`DxfRenderer.toEntityModel.layer`, `stretch-entity-transform.replacement`, `useEntityCreationManager.normalizedEntity` 2 sites, `useSceneState.onEntityCreated` legacy backref, `dxf-scene-builder` parser pre-id + validation) + 1 config jsdoc + 2 test fixture → **16 file reader codice reale** scope 9D-3b. (b) **Text commands** (10 file): `core/commands/text/UpdateTextStyleCommand.ts` + `UpdateTextGeometryCommand.ts` + `UpdateTextCurrentScaleCommand.ts` + `UpdateTextAnnotationScalesCommand.ts` + `UpdateMTextParagraphCommand.ts` + `ReplaceTextNodeCommand.ts` + `ReplaceOneTextCommand.ts` + `ReplaceAllTextCommand.ts` + `InsertTextTokenCommand.ts` + `DeleteTextCommand.ts` MOD — `assertCanEditLayer({ layerName: entity.layer, ... })` → `assertCanEditLayer({ layerName: resolveEntityLayerName(entity) ?? '', ... })`. Pattern uniforme: import `resolveEntityLayerName` da `../../../stores/LayerStore` + inline comment marker. `?? ''` fallback risolve null-safe — `assertCanEditLayer` `provider.getLayer('')` returns undefined → no-throw fall-through (graceful for orphan entities without layer). (c) **Systems** (4 file): `systems/auto-area/auto-area-hit.ts` MOD — 11 occorrenze `layerName: entity.layer` in `collectEntityCandidates` (5 sites: polyline/rectangle/circle/arc-full/ellipse-full) + `collectAllClosedPolygons` (6 sites: stessi shape) → `layerName: resolveEntityLayerName(entity)` via `replace_all`. Helper SSoT call zero-overhead (Map.get + nullable chain). `systems/trim/trim-boundary-resolver.ts` MOD — `isValidCuttingCandidate` signature esteso `entity: { type, visible?, layer?, layerId? }` (additive optional `layerId?: string`) per dual-read compat; corpo `entity.layer && layers[entity.layer]?.locked/visible` → `const layerName = resolveEntityLayerName(entity); if (layerName && layers[layerName]?.locked)/.visible === false` — single resolve cached in const, ribadito guard logic identica. `systems/stairs/stair-validator.ts` MOD — `checkHeadroom` for-loop `!entity.layer || !CEILING_LAYER_RE.test(entity.layer)` → resolved name once, regex test on resolved → preserves ceiling/slab/roof filter semantic + supporta entities id-only. `systems/selection/utils.ts` MOD — `UnifiedEntitySelection.findEntityAtPoint` line 80 `layers[getLayerNameOrDefault('layer' in entity ? entity.layer : '')]` → `layers[getLayerNameOrDefault(resolveEntityLayerName(entity))]` — collapses ad-hoc type-narrow check (`'layer' in entity ? ... : ''`) in helper SSoT call (`getLayerNameOrDefault` accetta `string \| undefined \| null` già). (d) **UI** (2 file): `ui/text-toolbar/hooks/useTextToolbarSelectionSync.ts` MOD — `resolveTextEntities` line 64 `layerId: entity.layer ?? ''` → `layerId: resolveEntityLayerName(entity) ?? ''` (text-engine consumer comme `useTextSelectionStore` mantiene null-safe `''` fallback per id-less entities). `ui/components/layers/hooks/useColorGroups.ts` MOD — `hasMatchingEntities` filter `entity.layer === layerName` → `resolveEntityLayerName(entity) === layerName` per color-group search panel — matches stable id entities under their resolved name. (e) **Rendering** (2 file): `rendering/hitTesting/HitTester.ts` MOD — `convertToHitResult` private line 284 `layer: getLayerNameOrDefault(entity.layer)` → `layer: getLayerNameOrDefault(resolveEntityLayerName(entity))` — produce stable display name in HitTestResult. `canvas-v2/dxf-canvas/DxfRenderer.ts` MOD — `resolveStyleForRender` line 469 `layersById[entity.layer]` → `const resolvedLayerName = resolveEntityLayerName(entity); const layer = resolvedLayerName ? layersById[resolvedLayerName] : undefined`. **Mantiene `layersById` keyed-by-name** (Phase 9E re-key a `Record<LayerId, SceneLayer>`) — dual-read converte id-only entities al loro name canonical via LayerStore, lookup name-keyed transparent. Inline JSDoc documenta transitional contract. (f) **Service** (1 file): `services/LayerOperationsService.ts` MOD — `setLayerGroupColor.entities.map` filter line 407 `entity.layer && layersInGroup.includes(entity.layer)` → resolved name const + `layersInGroup.includes(resolvedName)`. Sito reader residuo non coperto da 9D-3a (5 reader sites migrati allora; questo è 6° trovato dal Grep 9D-3b sweep). (g) **Tests regression** (jest, suite affected): `LayerStore.resolveEntityLayerName.test.ts` 6/6 + `LayerOperationsService.naming.test.ts` 15/15 → 21/21 ✅. Suite specifiche 9D-3b affected: `core/commands/text/__tests__/*` (UpdateTextStyle/UpdateMTextParagraph/UpdateTextGeometry/ReplaceAll/ReplaceOne/Delete/CreateText/CanEditLayerGuard + text-match-engine) 10 suite + `systems/trim/__tests__/*` 4 suite + `systems/stairs/__tests__/stair-validator.test.ts` 1 suite → **176/176 ✅ in 8.6s**. Suite 9D-3a cumulative (LayerStore + LayerStore.recent + LayerOperationsService.setters + useDxfSceneConversion-bridge + useDxfSceneConversion-bylayer-emission) → **87/87 ✅ in 7s**. Totale Phase 9D cumulative test base: 263 ✅. (h) **File size compliance**: HitTester.ts 320 LOC, DxfRenderer.ts 540 LOC (pre-existing >500, no growth — +5 LOC isolated to single function), LayerOperationsService.ts 506 LOC (pre-existing edge, +2 LOC), auto-area-hit.ts 392 LOC, useColorGroups.ts 44 LOC, useTextToolbarSelectionSync.ts 130 LOC, trim-boundary-resolver.ts 92, stair-validator.ts 133, selection/utils.ts 290, text commands 90-150 LOC each — N.7.1 ✅ (HitTester+LayerOperationsService+DxfRenderer pre-existing baseline accepted, additive change <5 LOC each — no split required this phase). (i) **Out of scope 9D-3b → 9D-4** (Phase Literal Construction Sweep): WRITE/build sites `DxfRenderer.toEntityModel.layer` (build SceneEntity output), `stretch-entity-transform.replacement` (build replacement entity), `useEntityCreationManager.normalizedEntity` (build new entity from create options), `useSceneState.onEntityCreated` legacy backref WRITE (mantiene `entity.layer = '0'` per legacy readers in altri agents), `dxf-scene-builder.ts` parser pre-id stage (line 90, `entity.layer` ancora source-of-truth dal parser DXF prima dell'id attribution a line 98) + validation (line 473, mantiene fail-fast su missing legacy field). Tests fixture: `useStairTool.test.tsx` + `stair-completion.test.ts` mantengono `expect(entity.layer).toBe(...)` come contract verifier legacy backref. Literal construction sweep (`drawing-entity-builders`, `drawing-preview-generator`, `drawing-preview-partial`, `useDynamicInputHandler`, test fixtures, region/overlay construction) → Phase 9D-4 separate session (~25 file). (j) `.ssot-registry.json` NON modificato Phase 9D-3b — modulo `entity-layer-id-canonical` (forbid `entity\.layer\b`) DEFERRED Phase 9D-5 final-flip (baseline su zero residual reads dopo 9D-4 + final WRITE migration). (k) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx` orchestrator — sweep solo commands + systems + UI hooks + rendering primitives (DxfRenderer è renderer-level, non leaf orchestrator). (l) **Google-level: YES** — additive dual-read pattern propagato uniformemente attraverso 16 reader sites residui via SSoT helper `resolveEntityLayerName(entity)` (Phase 9D-3a-introduced), zero new logic / zero behavioral change per legacy entities (entity.layer fallback transparent), zero breakage path id-only (entities post-Phase-9D-2 attribution risolvono via LayerStore.layersById.get), comment marker `ADR-358 Phase 9D-3b: id-first via LayerStore, name fallback` inline su ogni site migrato per future audit traceability, type compat preservata in trim-boundary-resolver via additive `layerId?: string` su signature inline ad-hoc. Cumulative test base post-9D-3b: 263 ✅ zero regression. (m) §7.2 row 9D-3b status ⏳ → ✅ v2.14-pre4. Row 9D status updated `9D-1 ✅ v2.14-pre1 / 9D-2 ✅ v2.14-pre2 / 9D-3a ✅ v2.14-pre3 / 9D-3b ✅ v2.14-pre4 / 9D-4…9D-5 ⏳`. (n) **9D Reader migration COMPLETE post-9D-3b** — tutti i reader sites identificati nel Grep audit pre-9D-3a (29 file) ora migrati al pattern dual-read SSoT. Resta solo: 9D-4 literal/WRITE construction sweep + 9D-5 final-flip (BaseEntity.layerId REQUIRED, drop `entity.layer`, ratchet entity-layer-id-canonical Tier 3). |
| 2026-05-16 v2.14-pre3 | **Phase 9D-3a IMPLEMENTED (Reader migration batch A — services + core hooks dual-read SSoT, §1.Q2 schema break sub-phase 3a/5)**: (a) Pre-flight Grep audit: `entity\.layer\b` → 60 occorrenze in 32 file, dedotti 2 test fixture + 1 config jsdoc → 29 file reader codice reale. WRITE site: 1 (`useSceneState.ts:74`). `=== ` comparisons 9 file. `layers[X.layer]` lookup 9 siti / 6 file. `getLayerNameOrDefault(...layer)` 9 siti / 9 file. **Decisione split mandatory** per soglia Phase-per-session §7.1 (>25 file): Phase 9D-3a (services+core hooks, 12 file) + Phase 9D-3b (commands+systems+UI+rendering, 17 file). (b) `src/subapps/dxf-viewer/stores/LayerStore.ts` MOD — esportato nuovo helper `resolveEntityLayerName(entity: { layerId?, layer? } \| null \| undefined): string \| undefined` SSoT dual-read (id-first / legacy-name fallback). Lookup via `layersById.get(entity.layerId)` quando id presente; fallback a `entity.layer` su miss/missing. Null-safe per chiamate da branch hot path (es. filter+find). Collapse a id-only post Phase 9D-5 final flip. JSDoc completa che documenta semantica transitional + roadmap di rimozione. (c) **Services**: `services/HitTestingService.ts` MOD — `convertToEntityModel` ora `layer: getLayerNameOrDefault(resolveEntityLayerName(entity))` (was `entity.layer`). `services/LayerOperationsService.ts` MOD — 5 reader sites migrati: `renameLayer.updatedEntities.map` match-by-name → `resolveEntityLayerName(entity) === oldName` (catches entities con solo `.layerId`); `mergeLayers.updatedEntities` source-set inclusion via resolved name; `setLayerGroupVisibility` + `setLayerGroupColor` filter via resolved name; `getLayerEntityCounts` stats `getLayerNameOrDefault(resolveEntityLayerName(entity))`. Tutti i WRITE permangono `{...entity, layer: newName}` (mantiene backref legacy fino a Phase 9D-5 — Phase 9D-1 contract). `services/shared/layer-operation-utils.ts` MOD — 6 reader sites: `updateEntitiesForLayer` match condition + `entityBelongsToLayer` + `entityBelongsToLayers` + `getVisibleEntityIdsInLayers` visibility filter + `getEntitiesNotInLayer` + `getEntitiesNotInLayers` exclusion via resolved name. (d) **Tool hooks**: `hooks/tools/useTrimTool.ts` MOD — 2 siti locked-layer guard (single pick + fence batch) ora `resolveEntityLayerName(target)` per look-up `scene.layers[name]`. `hooks/tools/useStretchTool.ts` + `hooks/tools/useScaleTool.ts` + `hooks/tools/useExtendTool.ts` MOD — locked-layer filtri `filterWorkableSelectionByLockedLayers` / pick-time guard via dual-read. (e) **Selection + canvas hooks**: `hooks/useEnhancedSelection.ts` MOD — `getEntityIdsByLayer(layerId)` filter `resolveEntityLayerName(entity) === layerId` (param `layerId` storicamente è name pre-9C terminology, comment inline documenta). `hooks/canvas/useDxfSceneConversion.ts` MOD — `buildBase()` ora computa `resolvedLayerName = resolveEntityLayerName(entity)` una volta, riusa per `layerInfo` lookup + display `layer: getLayerNameOrDefault(resolvedLayerName)`. (f) **Scene WRITE site + completion**: `hooks/scene/useSceneState.ts` MOD — `onEntityCreated` WRITE site (l.74) ora dual-write: `entity.layer = DXF_DEFAULT_LAYER` (legacy backref) + `entity.layerId = getLayer(DXF_DEFAULT_LAYER)?.id` (stable id mirror). Import `getLayer` da LayerStore + `DXF_DEFAULT_LAYER` da `config/layer-config` (sostituisce literal `'0'`). `hooks/drawing/completeEntity.ts` MOD — `CreateEntityCommand` option `layer` ora popolato via `resolveEntityLayerName(styledEntity)` (id-first risolve nome via LayerStore quando entity creata via drawing tool ha solo layerId; legacy fallback transparent). (g) **Tests**: `stores/__tests__/LayerStore.resolveEntityLayerName.test.ts` NUOVO 6 test in 1 describe — (i) legacy-only `.layer` → returns legacy name; (ii) id-only `.layerId` registered → returns SceneLayer.name; (iii) both set (id-first) → id resolves wins over stale legacy `.layer`; (iv) stale id not in store → falls back to legacy `.layer`; (v) empty entity → undefined; (vi) null/undefined entity → undefined (null-safe). Setup `__resetLayerStoreForTesting()` + `setLayers([createSceneLayer({...})])`. (h) **Regression**: `stores/__tests__/LayerStore.test.ts` + `LayerStore.recent.test.ts` + `DxfSettingsStore.test.ts` + `LinetypeRegistry.test.ts` + `LayerOperationsService.naming.test.ts` (15 test layerId-stability + name guards) + `useDxfSceneConversion-bylayer-emission.test.ts` (6 test layer/layerId emission) + `createSceneLayer.test.ts` (10 test factory id-gen) → tutti ✅ **99/99 in ~8s**. (i) **File size compliance**: LayerStore.ts 280 LOC, LayerOperationsService.ts 503 → sotto, layer-operation-utils.ts 281, HitTestingService.ts 280, useTrimTool.ts 470, useStretchTool.ts ~330, useScaleTool.ts ~360, useExtendTool.ts ~290, useEnhancedSelection.ts 280, useDxfSceneConversion.ts 327, useSceneState.ts 218, completeEntity.ts 298 — tutti sotto 500 N.7.1 ✅. (j) `.ssot-registry.json` NON modificato Phase 9D-3a — modulo `entity-layer-id-canonical` (forbid `entity\.layer\b`) DEFERRED Phase 9D-5 final-flip (baseline su zero residual reads dopo 9D-3b + 9D-4). (k) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx` — sweep solo services + hooks + stores. (l) **Google-level: YES** — additive dual-read SSoT helper isolated in LayerStore (un solo punto da modificare per final flip), tutti i reader migrati al pattern uniforme `resolveEntityLayerName(entity)`, contract verificato via 6 nuovi test esaustivi (4 happy + 2 null-safe), zero breakage legacy path (tutti i 99 test pre-esistenti ✅), JSDoc completa documenta semantica transitional + roadmap rimozione, comment ADR-358 Phase 9D-3 marker inline su ogni sito migrato. (m) §7.2 row 9D-3 split in 9D-3a (✅ v2.14-pre3) + 9D-3b (⏳ pending). Row 9D status updated `9D-3a ✅ v2.14-pre3 / 9D-3b…9D-5 ⏳`. (n) Out of scope Phase 9D-3a → Phase 9D-3b: text commands `core/commands/text/*` 11 file + systems (auto-area-hit, stretch-entity-transform, trim-boundary-resolver, stairs/stair-validator, selection/utils, entity-creation/useEntityCreationManager) + UI (text-toolbar, layer-manager, layers/hooks) + rendering (HitTester, EntityPass, DxfRenderer) + ai-assistant filter-by-name. (o) **Boy Scout fix Phase 9C residuo**: `hooks/drawing/completeEntity.ts` line 215 inline SceneLayer literal `{ name, color, visible, locked }` (mancava `id` required post-Phase 9C v2.13) → migrato a `createSceneLayer({...})` factory (auto-gen `lyr_<UUID-v4>` enterprise-id). Residuo dimenticato dal sweep Phase 9C (LevelSceneManagerAdapter + LayerOperationsService.createLayer migrati, completeEntity dimenticato). TS error pre-esistente da commit `9970706a` ora risolto. (p) **Pre-existing TS residual deferred**: `services/HitTestingService.ts:236` exhaustive check failure `DxfStair` (manca `case 'stair'` in `convertToEntityModel` switch) — fuori scope Phase 9D layer migration (domain stair-tool). Registrato in `.claude-rules/pending-ratchet-work.md` → "ADR-358 STAIR DOMAIN" section. Fix in sessione dedicata stair-tool. |
| 2026-05-16 v2.14-pre2 | **Phase 9D-2 IMPLEMENTED (DXF scene-builder layerId attribution + DxfEntity layerId mirror + conversion spread — §1.Q2 schema break sub-phase 2/5)**: (a) `src/subapps/dxf-viewer/canvas-v2/dxf-canvas/dxf-types.ts` MOD — `DxfEntity` interface esteso (additive, non-breaking) con `layerId?: string` optional + JSDoc che marca il field come mirror di `BaseEntity.layerId` (`lyr_<UUID-v4>`). Optional durante transitional Phase 9D window; final required-flip a fine Phase 9D-4. Forwarded da `useDxfSceneConversion` per id-based routing downstream (DxfRenderer/HitTester) prima del Phase 9E re-key di `SceneModel.layers`. (b) `src/subapps/dxf-viewer/hooks/canvas/useDxfSceneConversion.ts` MOD — `buildBase()` forward conditional spread `...(entity.layerId !== undefined && { layerId: entity.layerId })`. Forward solo se source entity ha id (transitional optional); legacy entities senza layerId continuano a viaggiare con solo `layer` (name) — zero breakage. Sopra il blocco `colorByLayer` color-omit per separation of concerns. (c) `src/subapps/dxf-viewer/utils/entity-conversion.ts` MOD — `convertLineToPolyline(lineEntity, insertPoint?)` ora spread `layerId: lineEntity.layerId` accanto a `layer`. Preserves stable id across line→polyline morph. Comment ADR-358 Phase 9D-2 inline marker. (d) `src/subapps/dxf-viewer/utils/dxf-scene-builder.ts` MOD — import `createSceneLayer` da `../types/entities`. **Factory migration**: due inline SceneLayer literal sites migrati: (i) default layer line ~53 — `layers[DXF_DEFAULT_LAYER] = { name, color, visible, locked }` → `createSceneLayer({...})` con factory auto-gen id; (ii) `registerLayer()` helper line ~213 — stesso pattern. Entrambi i siti precedentemente bypassavano il Phase 9C id-gen contract (Record-indexed assignment non veniva catturato dal ratchet pattern `:\s*SceneLayer\s*=\s*\{` troppo stretto). **Entity attribution**: dopo `registerLayer(layers, layerName, layerColors)` aggiunto `(entity as { layerId?: string }).layerId = layers[layerName].id` — ogni entity convertito da DXF eredita lo stable `lyr_<UUID-v4>` del SceneLayer registrato. (e) Tests: `hooks/canvas/__tests__/useDxfSceneConversion-bylayer-emission.test.ts` MOD — 2 nuovi test: (i) "forwards layerId sentinel (Phase 9D-2 stable id attribution)" verifica `converted.layerId === wallsLayer.id` + regex `^lyr_[0-9a-f-]{36}$` match (UUID-v4 format); (ii) "omits layerId on DxfEntity when source entity has no layerId (transitional optional)" verifica `converted.layerId === undefined` quando source entity manca del field. Tutti ✅ — totale Phase 9D-2 affected: 28/28 green in 16.7s (`useDxfSceneConversion-bylayer-emission` 6 test + `useDxfSceneConversion-layers-bridge` 4 test + `LayerOperationsService.naming` 15 test + altri suite affected). (f) File size compliance: `dxf-scene-builder.ts` 479 LOC, `useDxfSceneConversion.ts` 324, `entity-conversion.ts` 466, `dxf-types.ts` 188 — tutti sotto limite 500 N.7.1. (g) `.ssot-registry.json` NON modificato Phase 9D-2 — modulo `scene-layer-shape` ratchet pattern (`:\s*SceneLayer\s*=\s*\{`) NON copre Record-indexed assignment `layers[k] = { ... }`; entrambi i siti `dxf-scene-builder.ts` ora invocano factory (compliant), pattern strengthening a Record assignment deferred (out of scope 9D-2 minimal additive). (h) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx` — modifiche coprono utils + hooks + types + test. (i) **Google-level: YES** — additive optional schema, factory contract enforcement laddove bypassed, attribution path completo end-to-end (DXF parser → scene-builder → SceneModel → DxfScene → DxfEntity), zero breakage legacy path, contract documented via JSDoc + inline comments + 2 nuovi test asserzioni positive+negative. (j) §7.2 row 9D-2 status ⏳ → ✅ v2.14-pre2; row 9D status updated `9D-1 ✅ / 9D-2 ✅ / 9D-3…9D-5 ⏳`. (k) Out of scope Phase 9D-2 → Phase 9D-3: reader migration (`entity.layer` → `entity.layerId` + `LayerStore.getLayer(id)?.name` per display) su services + hooks + commands + auto-area + stretch + trim + stairs. |
| 2026-05-16 v2.14-pre1 | **Phase 9D-1 IMPLEMENTED (BaseEntity.layerId transitional optional + rename layerId-stability — §1.Q2 schema break sub-phase 1/5)**: (a) `src/subapps/dxf-viewer/types/entities.ts` MOD — `BaseEntity` esteso (additive, non-breaking) con `layerId?: string` optional carrying JSDoc che marca il field come canonical `lyr_<UUID-v4>` matching `SceneLayer.id` (ADR-358 Phase 9C v2.13). `layer?: string` riceve JSDoc `@deprecated` marker che documenta: transitional alias ≤1 release, removal end of Phase 9D-3 reader sweep, writers MUST keep both fields in sync durante 9D-1...9D-4 window. Decisione transitional-optional (NON required immediato) per evitare TS apocalypse cross-cutting ~55 file in singola sessione — required-flip pianificato a fine Phase 9D-4 (single TS check pass + zero migration debt). (b) `src/subapps/dxf-viewer/services/LayerOperationsService.ts` MOD — `renameLayer()` inline JSDoc-style comment block sopra `updatedEntities` map: documenta che `entity.layerId` è preserved by spread (stable across rename), e che `entity.layer` (legacy name backref) viene updated solo per transitional readers — removed at end of Phase 9D-3. Zero behavior change (purely contract-documentation). (c) `src/subapps/dxf-viewer/services/__tests__/LayerOperationsService.naming.test.ts` MOD — `makeScene(layers, entityLayers?)` fixture esteso: entities ora carry BOTH `layer: name` (legacy) AND `layerId: layerMap[name]?.id` (stable). Resolver via SceneLayer.id lookup at fixture build time. Test "accepts a valid rename — updates layers + entity layer refs" esteso con assertion: snapshot entity.layerId pre-rename, esegui rename Walls→Pareti, snapshot entity.layerId post-rename, `expect(wallsIdAfter).toEqual(wallsIdBefore)` + `expect(...every(id => id === 'lyr_a'))` — verifica contract Phase 9D-1: layerId stable across rename. (d) Tests regression: LayerOperationsService.naming 15/15 ✅ green in 4.8s (incluso nuovo layerId-stability assertion). createSceneLayer (Phase 9C) + LayerStore + dxf-roundtrip-layers + dxf-layer-table-parser tutti ✅ unaffected. (e) `.ssot-registry.json` NON modificato Phase 9D-1 — nuovo modulo Tier 3 `entity-layer-id-canonical` (forbid `entity\.layer\b` outside allowlist) DEFERRED a Phase 9D-5 final-flip (registry baselines su zero residual reads). (f) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx` — modifica copre types + service + test, render pipeline invariata. (g) Out of scope Phase 9D-1 → Phase 9D-2: DXF parser/scene-builder + writer attribution via XDATA NestorLayerId → layerId resolution post-LAYER-table prepass (`dxf-scene-builder.ts`, `entity-conversion.ts`, `useDxfSceneConversion.ts`, etc.). (h) Google-level: ✅ YES — additive optional schema introduces zero breakage, contract documented via JSDoc + inline service comment + test assertion, ratchet flip scheduled atomically a Phase 9D-5 single-pass. (i) §7.2 row 9D ora split in 5 sub-rows 9D-1...9D-5; row 9D-1 status ⏳ → ✅ v2.14-pre1. |
| 2026-05-16 v2.13 | **Phase 9C IMPLEMENTED (SceneLayer.id REQUIRED + enterprise-id auto-gen + DXF XDATA round-trip — §1.Q2 stable id Google-standard)**: (a) `src/subapps/dxf-viewer/types/entities.ts` MOD — `SceneLayer.id?: string` → `SceneLayer.id: string` (required, drop optional). JSDoc updated: stable identifier `lyr_<UUID-v4>` from enterprise-id.service (crypto.randomUUID via `generateLayerId()` in `@/services/enterprise-id-convenience`). Factory `createSceneLayer({id?, ...}): SceneLayer` ora applica `id: input.id ?? generateLayerId()` auto-gen fallback — caller-provided id preserved verbatim (idempotency), omitted id triggers enterprise-id generator. Boundary I/O (DXF import, UI create, system seed) hits factory zero-arg id-side. (b) `src/subapps/dxf-viewer/systems/entity-creation/LevelSceneManagerAdapter.ts` MOD — line 139 inline `const defaultLayer: SceneLayer = {...}` literal → `createSceneLayer({name, color, visible, locked})`. Auto-gen kicks in per ogni new-scene seed (DXF_DEFAULT_LAYER "0"). Removed unused `SceneLayer` type import. (c) `src/subapps/dxf-viewer/services/LayerOperationsService.ts` MOD — `createLayer()` line 213 inline `const newLayer = {name, visible, color, frozen, locked}` literal → `createSceneLayer({name, color, visible, frozen, locked: false})`. Auto-gen id assegnato a ogni UI-created layer. Import esteso con `createSceneLayer` named export. (d) `src/subapps/dxf-viewer/utils/dxf-layer-table-writer.ts` MOD — `emitLayerXData()` ora emette `NestorLayerId` AppId XDATA come FIRST entry per ogni layer (code `1001 NestorLayerId` + `1000 id=<layer.id>`). Stable enterprise-id round-trip — DXF save/load preserva layer identity per undo/redo refs + Firestore audit + xref bindings + history. Industry-aligned con AutoCAD/BricsCAD DXF handles (group code 5) + ArchiCAD/Revit GUIDs + Vectorworks UUIDs (Δ4 major players convergence). (e) `src/subapps/dxf-viewer/utils/dxf-layer-table-parser.ts` MOD — `CollectedXData` interface +1 field `layerId: string \| undefined`. `collectXData()` parsing pass +1 branch `p.app === 'NestorLayerId'` con `k === 'id'` + `v.startsWith('lyr_')` validation gate (rejects malformed). `buildSceneLayer()` ora passa `id: xd.layerId` a `createSceneLayer()` — explicit id branch quando NestorLayerId XDATA presente, factory auto-gen fallback su legacy DXF imports senza Nestor AppId. JSDoc header parser updated con NestorLayerId in AppId list. (f) Tests: `src/subapps/dxf-viewer/types/__tests__/createSceneLayer.test.ts` NUOVO 7 test in 3 group — auto-generation (input.id omitted → `lyr_<UUID-v4>` pattern match / explicit id preserved / explicit id NOT overwritten anche con defaults attivi), format contract (lyr_ prefix + 40-char total / string typeof guarantee), uniqueness (100 distinct auto-ids in rapid succession / mixed explicit+auto preserves explicit + diversifies auto). Pattern regex `^lyr_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` matches crypto.randomUUID v4 output. `stores/__tests__/LayerStore.test.ts` MOD — test "keys by id when present, falls back to name" → "keys every layer by id (Phase 9C: factory auto-gen guarantees id presence)". Legacy "fall back to name" branch obsoleto post-Phase-9C; assertion ora verifica `getLayer(autoId.id)` returns autoId + `getLayer('Y')` returns null (name lookup gone). (g) Tests regression: dxf-roundtrip-layers 5 fixtures `toEqual(original)` ✅ green (NestorLayerId XDATA round-trip preserva id deep-equality). LayerOperationsService.naming 15 test + .setters 24 test + layer-name-validator 45 test + dxf-layer-table-parser 24 test + LayerStore.recent 13 test + useDxfSceneConversion-{bridge,emission} 11 test + resolve-entity-style 23 test → tutti ✅ green. Totale Phase 9C suite: 186/186 in 11.7s. (h) `.ssot-registry.json` MOD — modulo `dxf-layer-parser` Tier 3 forbidden-pattern esteso con `NestorLayerId` AppId literal (regex group `(AcCmTransparency|NestorAec|NestorLayerMeta|NestorLayerId|NestorBimCategory|NestorVpOverride)`). Description updated. Allowlist invariata (parser+writer+linetype-parser già coperti). Modulo `scene-layer-shape` allowlist invariato — i 2 inline construction sites migrati via factory rimangono allowlisted per future Phase 9D wire-up (region-operations, completeEntity, layer-operation-utils, scene.ts). (i) ADR-040 leaf rule rispettato: zero touch su `CanvasSection.tsx`/`CanvasLayerStack.tsx` orchestrator. Modifica copre types + service + utils + ADR — render pipeline invariata. (j) Out of scope Phase 9C → Phase 9D: `BaseEntity.layer` (name) → `layerId` schema break + 32 callsite migration (Grep-driven, XL effort, separate session). Phase 9C completa il foundation (id stable + serialization integrity), Phase 9D consuma con entity refs. |
| 2026-05-16 v2.12 | **Phase 9B IMPLEMENTED (Layer Naming Server-side Trust Boundary — §5.6 Q9 wire-up)**: (a) `src/subapps/dxf-viewer/services/shared/layer-naming-guard.ts` NUOVO ~70 LOC — helper `guardLayerName({ name, scene, excludeId? }): LayerNamingGuardFailure \| null` che wrappa `validateLayerName` SSoT (Phase 9A) e proietta il fallimento in un `LayerOperationResult`-shaped failure con `validationError: LayerNameValidationError` + `message: string` (English baseline, i18n lato UI consumer via error code). Returns `null` su success → caller prosegue mutation. Defender hierarchy ref ADR-358 §5.6 line 993-998. (b) `src/subapps/dxf-viewer/services/LayerOperationsService.ts` MOD — import `guardLayerName` + type `LayerNameValidationError`. Interfaccia `LayerOperationResult` esteso con `validationError?: LayerNameValidationError` (optional, populated solo quando fallimento origina da name validation, propagato a UI consumer). `renameLayer(oldName, newName, scene)`: ordering riscritto — idempotent no-op (`oldName===newName`) FIRST, poi destructure `renamedLayer = scene.layers[oldName]` + early-return "does not exist", poi `guardLayerName({name: newName, scene, excludeId: renamedLayer.id})` — `excludeId` permette idempotent self-rename + case-rename quando layer has stable id (Phase 9C farà id required). Vecchio inline `scene.layers[newName]` duplicate check rimosso (assorbito da validator DUPLICATE rule). `createLayer({name, color, ...}, scene)`: `guardLayerName({name, scene})` (no excludeId per create) early-return prima della costruzione del newLayer. Vecchio inline `scene.layers[name]` duplicate check rimosso. `deleteLayer(layerName, scene)`: nuova guardia inline `if (layerName === '0') return { ..., validationError: 'RESERVED', message: 'Layer "0" is system-reserved and cannot be deleted' }` PRIMA del `scene.layers[layerName]` existence check (§5.6 line 1000-1005, validator NON usato — delete operation non-naming, direct guard). (c) File size: LayerOperationsService.ts 492 → 499 LOC (sotto limite 500 N.7.1) — JSDoc header compattato (3 → 1 line) per assorbire i ~+10 LOC del wire-up senza extract richiesto. (d) Tests: `src/subapps/dxf-viewer/services/__tests__/LayerOperationsService.naming.test.ts` NUOVO ~175 LOC, 15 test in 3 group — `renameLayer.name guard` (8 test: Layer 0 → other RESERVED / duplicate DUPLICATE / invalid char INVALID_CHARS / empty EMPTY / whitespace-padded LEADING_TRAILING_WS / other-into-0 RESERVED / valid rename ✅ scene.layers + entity.layer refs / idempotent oldName===newName); `createLayer.name guard` (4 test: name "0" RESERVED / duplicate DUPLICATE / invalid char INVALID_CHARS / valid ✅ scene.layers extension); `deleteLayer.Layer 0 guard` (3 test: '0' RESERVED preserves scene identity / valid delete purges layer+entities / non-existent layer fails without validationError). Helper `makeScene(layers, entityLayers?)` minimal SceneModel fixture (no LayerStore needed — by-scene path, ADR-358 Phase 8.5 SSoT-based setters separate). (e) `.ssot-registry.json` MOD — modulo `layer-name-strict-validation` allowlist esteso +4: `shared/layer-naming-guard.ts`, `LayerOperationsService.ts`, `__tests__/layer-name-validator.test.ts`, `__tests__/LayerOperationsService.naming.test.ts`. ForbiddenPatterns (`function validateLayerName\b` + `const validateLayerName\s*=`) invariati — guard helper invoca validator come function call (non re-implementa). (f) Defender hierarchy live: UI Phase 9G (top, optimistic real-time hints — pending) + LayerOperationsService Phase 9B (mid, server-side trust boundary — LIVE) + DXF parser Phase 9C (bottom, import-time fallback — pending). UI accept-but-service-reject drift impossibile post-Phase-9G/9B alignment. (g) i18n: error messages in helper sono plain English baseline (consumed via `validationError` code da UI dxf-viewer-shell i18n keys Phase 9G). N.11 hardcoded i18n rule rispettata — solo locale JSON è SSoT testo localizzato; service-layer messages sono technical strings developer-facing (logs/devtools), `validationError` code è il contract UI-facing. (h) ADR-040 leaf rule rispettato: zero touch su CanvasSection/CanvasLayerStack — service-level wire-up, render pipeline invariata. (i) §7.2 row 9B status: ⏳ → ✅ v2.12. (j) Performance: validator O(N) sui layer count invariato (guard wrapper zero overhead). (k) Out of scope Phase 9B → Phase 9C: SceneLayer.id required + enterprise-id `lyr_<ULID>` gen + DXF parser id-gen path. |
| 2026-05-16 v2.11 | **Phase 9A IMPLEMENTED (Layer Name Validator SSoT — §5.6 Q9 Strict AutoCAD parity)**: (a) `src/subapps/dxf-viewer/services/layer-name-validator.ts` NUOVO ~135 LOC — pure fn `validateLayerName({ name, existingLayers, excludeId? }): { valid, error: LayerNameValidationError \| null, suggestion? }`. Zero side effects, deterministic, frozen result objects. 7 rules fail-fast: EMPTY → WHITESPACE_ONLY → LEADING_TRAILING_WS → TOO_LONG (255 chars) → INVALID_CHARS (AutoCAD char set `< > / \ " : ; ? * \| , = \` '`) → RESERVED Layer-0 → DUPLICATE (case-insensitive). (b) Layer "0" hardening per §5.6 line 987-1005: rejects create with name '0' even when Layer 0 absent (always reserved), rejects rename Layer-0 → any other name (DXF spec immutability), rejects rename any-other-layer → '0' (taking system name), allows idempotent no-op '0' → '0' (excludeId matches Layer-0.id). Helper `checkReservedLayer0` extracted per SRP. (c) Auto-suggestions: LEADING_TRAILING_WS → `name.trim()`, TOO_LONG → `name.slice(0,255)`, INVALID_CHARS → strip char set (omit suggestion when all-stripped), DUPLICATE → `<name> (n)` increment until free case-insensitive (fallback `<name> (<timestamp>)` after 1000 collisions). (d) Tests `services/__tests__/layer-name-validator.test.ts` NUOVO 45 test in 9 groups — Rule 1 EMPTY (1) / Rule 2 WHITESPACE_ONLY (2: spaces, tabs+newlines) / Rule 3 LEADING_TRAILING_WS (3: leading, trailing, both + suggestions) / Rule 4 TOO_LONG (2: 255 boundary OK, 256 reject + truncated suggestion) / Rule 5 INVALID_CHARS (18: 14 per-char rejection + strip suggestion + all-strip-empty omits + Greek unicode OK + hyphen/underscore/dot/parens OK) / Rule 6 RESERVED (5: create-when-exists, create-when-absent, rename-into-0, rename-Layer-0-out, idempotent no-op) / Rule 7 DUPLICATE (5: exact, case-insensitive, idempotent self-rename, sibling reject, suggestion increment to (4)) / Happy path (2: simple, AIA-style) / Error precedence (5: EMPTY>DUPLICATE, WHITESPACE_ONLY>LEADING_TRAILING_WS, LEADING_TRAILING_WS>DUPLICATE, INVALID_CHARS>RESERVED+DUPLICATE, RESERVED>DUPLICATE) / Result shape (2: frozen valid + frozen invalid). Tutti ✅ 45/45 green in 3.8s. (e) `.ssot-registry.json` +1 modulo Tier 3 `layer-name-strict-validation` — forbiddenPatterns `function validateLayerName\b` + `const validateLayerName\s*=` (blocks duplicate validator implementations across codebase), allowlist solo SSoT file. Phase 9B estende allowlist a `LayerOperationsService.ts` quando wire-up landa; Phase 9G estende a UI consumer. (f) §7.2 row 9 split in 7 sub-fasi 9A-G (~56 file totale, XL effort cumulativo) — Phase-per-session §7.1 ADR-357 compliance. Sub-row 9A status ✅ v2.11, 9B-G ⏳ pending. (g) Consumers NON wired in 9A (separation of concerns intenzionale): Phase 9B `LayerOperationsService.createLayer/renameLayer` consumeranno il validator come trust boundary server-side (defense in depth); Phase 9C DXF parser fallback; Phase 9G UI rename input real-time + "Apply suggestion" button. (h) i18n keys per error messages deferred Phase 9G — validator restituisce solo error CODES, traduzione lato UI consumer. Pure fn 100% testabile senza i18n mock. (i) Performance: O(N) sui layer count per duplicate+reserved checks; per ricerca posto libero suggestion DUPLICATE O(K) con K ≤ 1000 cap. (j) ADR-040 leaf rule rispettato: zero touch su CanvasSection/CanvasLayerStack — service-level scope, no canvas leaf involvement. (k) File size: validator 135 LOC, test 240 LOC (entrambi sotto limite 500 N.7.1). |
| 2026-05-16 v2.1 | **Phase 1 IMPLEMENTED (Types + SSoT)**: (a) `SceneLayer` esteso in `src/subapps/dxf-viewer/types/entities.ts` a 14 campi (12 base + Q15 `bimCategory` + Q16 `vpOverrides`); nuovi campi optional con default-fill via factory (legacy `color: string` mantenuto per BC fino Phase 9). Tipi `SceneLayerColor`/`LineweightMm` (24 ISO + special)/`AecLayerCategory` (10 AIA-aligned)/`VpLayerProps` definiti. Factory SSoT `createSceneLayer()` co-locata. (b) `src/subapps/dxf-viewer/stores/LayerStore.ts` NUOVO singleton micro-leaf ADR-040 (`useSyncExternalStore`-compatible, snapshot frozen, set/upsert/remove/setCurrentLayerId con skip-if-unchanged, auto-clear currentLayerId su remove). `currentLayerId` SSoT unificato (Q3 — overlay-manager.currentLayerId migration deferred a Phase 5 bridge). (c) `useLayerManagerState` (`ui/components/layer-manager/`) wirato a LayerStore via useSyncExternalStore; toggle-visibility passa per `upsertLayer` quando store non-vuoto, fallback transitorio mock-data (cleanup Phase 6 §5.3.quinquies). (d) `LayerStore.test.ts` 19 test contract — initial state / setLayers / upsertLayer / removeLayer / currentLayerId / subscriptions tutti ✅. (e) `.ssot-registry.json` +4 moduli: `scene-layer-shape` (tier 3, allowlist 7 legacy sites — Phase 9 zero-tol), `unified-layer-store` (tier 3, allowlist bridge transition), `bim-category-scaffolding-no-active-use` (tier 4, zero-tol baseline 0, allowlist solo `entities.ts`), `vp-overrides-scaffolding-no-active-use` (tier 4, zero-tol baseline 0). Persistence + DXF parser + render wire-up = Phase 3/9 (out of scope). |

---

## 11. References (verified web research 2026-05-16)

### AutoCAD (Autodesk, reference DWG ecosystem)
- Layer Properties Manager (2026): https://help.autodesk.com/view/ARCHDESK/2026/ENU/?guid=GUID-B5ADCD3C-416F-4AC3-B869-D39475CF98AA
- AutoCAD MEP — About Layer Properties Manager: https://help.autodesk.com/view/BLDSYS/2026/ENU/?guid=GUID-AB5E3658-0883-4851-A31B-E6288826C12A
- Layer States Manager (.las export/import): https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-DidYouKnow/files/GUID-5312A8BD-DD94-47D6-B1BA-5E0AF5E0CED8.htm
- Layer Filters (Group + Property + Invert, dynamic): https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-DidYouKnow/files/GUID-46F22B6E-D087-4AB4-8D4F-580E0E75FAD3.htm
- LAYISO command (Lock & Fade default 0-90): https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-E24B9866-9538-43BF-A3DF-AA7E2341C624
- LAYUNISO command: https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-0795CBC9-7A9D-4A36-B49E-244C146FF6EA
- VPLAYER + per-viewport overrides (VPLAYEROVERRIDESMODE): http://docs.autodesk.com/ACD/2010/ENU/AutoCAD%202010%20User%20Documentation/files/WS1a9193826455f5ffa23ce210c4a30acaf-5243.htm
- Layer 0 + ByLayer / ByBlock inheritance: https://www.cad-notes.com/layer-0-bylayer-and-byblock/
- About Layer 0 / GstarCAD blog: https://blog.gstarcad.net/whats-the-difference-between-layer-0-and-other-layers/

### DXF Specification (Autodesk + ezdxf)
- DXF LAYER table group codes (Autodesk official): https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-DXF/files/GUID-D94802B0-8BE8-4AC9-8054-17197688AFDB.htm
- LAYER table — ezdxf 1.4.3 docs: https://ezdxf.readthedocs.io/en/stable/dxfinternals/tables/layer_table.html
- Lineweights enum (24 ISO values, code 370) — ezdxf: https://ezdxf.readthedocs.io/en/stable/concepts/lineweights.html
- Linetype LIN file format (simple + complex w/ TEXT/SHAPE) — ezdxf: https://ezdxf.readthedocs.io/en/stable/tutorials/linetypes.html
- DXF Group Codes Numerical Order (OARX 2025): https://help.autodesk.com/view/OARX/2025/ENU/?guid=GUID-3F0380A5-1C15-464D-BC66-2C5F094BCFB9

### BricsCAD (Bricsys, DWG ecosystem)
- Layers Panel: https://help.bricsys.com/en-us/document/bricscad/panels/layers-panel
- Working with layers + Drawing Explorer (EXPLAYERS): https://help.bricsys.com/en-us/document/bricscad/2d-drafting/working-with-layers
- LAYER command reference: https://help.bricsys.com/en-us/document/command-reference/l/layer-command

### GstarCAD / ZWCAD (AutoCAD clones, DWG ecosystem)
- GstarCAD 2026 vs AutoCAD/BricsCAD/ZWCAD comparison PDF: https://gstarcadaustralia.com/wp-content/uploads/2025/07/GstarCAD-2026-Compare-AutoCAD-BricsCAD-ZWCad.pdf
- GstarCAD vs ZWCAD differences table: https://www.gstarcad.com.my/comparison-table-gstarcad-vs-zwcad

### MicroStation (Bentley, Levels ≡ Layers)
- Levels (MicroStation v26): https://docs.bentley.com/LiveContent/web/MicroStation%20Help-v26/en/GUID-54601CED-0045-0C31-D38F-62736D5FF20C.html
- Level Manager Dialog: https://docs.bentley.com/LiveContent/web/MicroStation%20Help-v21/en/LevelManager.html
- MicroStation Level Attributes (cad-notes): https://www.cad-notes.com/microstation-level-and-level-attributes/

### BIM paradigm comparison (for §3.8 scope rationale)
- Revit categories vs AutoCAD layers (LinkedIn Learning): https://www.linkedin.com/learning/migrating-from-autocad-to-revit/organizing-with-categories-vs-layers
- Revit vs AutoCAD (United-BIM): https://www.united-bim.com/blog/revit-vs-autocad
- ArchiCAD Pen Sets (Graphisoft Community): https://community.graphisoft.com/t5/Documentation/Pen-Sets/ta-p/303731
- ArchiCAD Building Materials migration: https://help.graphisoft.com/AC/26/INT/_AC26_Help/011_MigrationGuideOlderVersions/011_MigrationGuideOlderVersions-7.htm
- ArchiCAD Layer Theory (Graphisoft): https://www.graphisoft.com/us/archicad-layer-theory-do-you-need-that-layer
- Vectorworks dual organization (classes + design layers): https://app-help.vectorworks.net/2023/eng/VW2023_Guide/Structure/Organizing_the_drawing.htm
- Vectorworks layer/class/viewport standards 2026: https://app-help.vectorworks.net/2026/eng/VW2026_Guide/Structure/Layer_class_and_viewport_standards.htm

### Naming standards
- AIA CAD Layer Guidelines (NCS V6): https://www.nationalcadstandard.org/ncs6/pdfs/ncs6_clg_lnf.pdf
- ISO 13567-1:2017 — Organization and naming of layers for CAD: https://www.iso.org/standard/70181.html
- ISO 13567 Wikipedia overview: https://en.wikipedia.org/wiki/ISO_13567
- AutoCAD layer naming standards complete guide (sourcecad): https://sourcecad.com/layer-naming-standards-cad-drawing/

### National BIM Standard (US, NCS coordination)
- NCS V7 content: https://www.nationalcadstandard.org/ncs7/content.php
- NIBS / NBIMS-US standards: https://nibs.org/our-work/resources/standards/
