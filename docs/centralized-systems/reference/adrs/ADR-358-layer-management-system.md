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

- **LAYISO** (Layer Isolate): seleziona entità → tutti i layer **non** di quelle entità vanno OFF o `dimmed` (configurable).
- **LAYUNISO** (Layer Unisolate): ripristina lo stato pre-isolate (snapshot interno).
- **LAYDIM**: rendi semi-transparent i layer non target.
- **LAYOFF / LAYON / LAYFRZ / LAYTHW / LAYLCK / LAYULK**: comandi click-driven (one-shot layer operations via click su entity).

### 3.5 ByLayer / ByBlock / Direct property

- **ByLayer**: entity color/linetype/lineweight/transparency = quello del layer. Cambiando layer property, tutte le entità ByLayer si aggiornano.
- **ByBlock**: entity property è ereditata dal **blocco contenitore** (se entity è dentro un INSERT). Fuori da blocchi = nero/Continuous/Default.
- **Direct** (es. color rosso esplicito): override del layer, immutabile rispetto al layer.

### 3.6 Naming conventions (AIA CAD layer guidelines)

Standard `Discipline-MajorGroup-MinorGroup-Status` (es. `A-WALL-FULL-NEW`, `S-COL-EXST`, `M-HVAC-DUCT-DEMO`). Out of scope obbligatorio in ADR-358 — può essere convenzione documentata, **non enforcement**.

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
**Cosa manca**: catalogo lineweight ISO + special values `-3=Default`, `-2=ByLayer`, `-1=ByBlock`.
**Google-fix**: nuovo `src/subapps/dxf-viewer/config/lineweight-catalog.ts`:
```typescript
export const LINEWEIGHT_ISO = [
  0.05, 0.09, 0.13, 0.18, 0.25, 0.35, 0.50, 0.70, 1.00, 1.40, 2.00, 2.11
] as const; // mm
export const LW_DEFAULT = -3;
export const LW_BYLAYER = -2;
export const LW_BYBLOCK = -1;
export type LineweightMm = typeof LINEWEIGHT_ISO[number] | typeof LW_DEFAULT | typeof LW_BYLAYER | typeof LW_BYBLOCK;
```
- Conversion `lineweightToPx(mm, zoom)` → pixel rendering.
- DXF code 370 round-trip identico (multiply × 100, e.g. 0.25mm → 25).

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

### G8 — `AdminLayerManager` wired al SceneModel
**Cosa manca**: oggi mostra mock data (Ηλεκτρολογικά / Υδραυλικά / HVAC) hardcoded in `useLayerManagerState`. Non legge `scene.layers`.
**Google-fix**:
- Riscrivere `useLayerManagerState` per consumare `LayerStore` (G2) + `SceneModel` (current level).
- Mantenere SAME interface verso `LayerHeader / LayerFilters / LayerList` (UI invariata).
- Aggiungere mapping legacy `category` (electrical/plumbing/hvac) → SceneLayer `description` o nuovo campo `category` (Q da risolvere).

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
**Google-fix**:
- Comandi nuovi in `CommandRegistry`: `LayerIsolate`, `LayerUnisolate`, `LayerDim`, `LayerOff` (click-driven).
- UX: shortcut `Ctrl+Shift+I` → click entity → isolate (gli altri layer → OFF). `Ctrl+Shift+U` → unisolate.
- Snapshot pre-isolate salvato in `LayerStore.unisolateSnapshot` per `LayerUnisolate`.
- LayerDim: usa property `transparency=60` su altri layer invece di OFF.

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

**ID generator**: SSoT `src/services/enterprise-id.service.ts` — aggiungere prefix `'lyr'` (SOS. N.6 compliance). Pattern: `lyr_<ULID-26char>`.

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

| Phase | Titolo | Files | Effort | Q-ref |
|---|---|---|---|---|
| **1** | Estendere `SceneLayer` interface + migration default-fill + tipi `Lineweight`, `LayerColor` | 3 | S | Q1, Q2 |
| **2** | `LayerStore` singleton (micro-leaf) + `useLayerStore` hook + bridge con `SceneModel` | 4 | M | Q3 |
| **3** | Catalog SSoT — `linetype-catalog.ts`, `lineweight-catalog.ts`, `aci-color-palette.ts` consolidato | 3 | M | Q4 |
| **4** | `resolveEntityStyle` pure fn + wire-up in `DxfRenderer.drawEntity` + unit test ByLayer/ByBlock/Direct | 4 | M | Q5 |
| **5** | DXF parser esteso (group 6, 70, 290, 370, 420, 1071) + roundtrip integrity test su 5 file reference | 4 | L | Q6 |
| **6** | `AdminLayerManager` wired al `LayerStore` — drop mock data — preserve UI props | 5 | M | Q7 |
| **7** | `CurrentLayerPicker` ribbon/status-bar + persistence `dxf:currentLayerId.{levelId}` | 3 | S | Q8 |
| **8** | `LayerOperationsService` esteso (setLineweight/setLinetype/setTransparency/setPlottable/setFrozen) | 3 | S | — |
| **9** | Layer rename con backref completi (entity.layerId migration + audit commandHistory/regions) | 5 | L | Q9 |
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

---

## 11. References

- AutoCAD Layer Properties Manager: https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-B297EBD9-D68C-47E1-87CE-1B3798496599.htm
- AutoCAD Layer States Manager: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-LT-DidYouKnow/files/GUID-5312A8BD-DD94-47D6-B1BA-5E0AF5E0CED8.htm
- AutoCAD Layer Filters (Group + Properties): https://designandmotion.net/autodesk/autocad/autocad-layers-deep-dive-series-layer-filters/
- DXF LAYER table group codes (ezdxf): https://ezdxf.readthedocs.io/en/stable/dxfinternals/tables/layer_table.html
- DXF reference (Autodesk): https://documentation.help/AutoCAD-DXF/WS1a9193826455f5ff18cb41610ec0a2e719-7a51.htm
- ByLayer / ByBlock inheritance: https://www.cad-notes.com/layer-0-bylayer-and-byblock/
- AIA CAD Layer Guidelines (naming convention): https://www.nationalcadstandard.org/
- BricsCAD Layer Manager: https://help.bricsys.com/en-us/document/bricscad/drawing-tools/working-with-layers
