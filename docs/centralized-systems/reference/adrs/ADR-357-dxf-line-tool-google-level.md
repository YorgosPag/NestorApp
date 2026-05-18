# ADR-357 — DXF Line Tool: Allineamento Google-Level a CAD Professionali

**Status**: ✅ ACCEPTED (Q1-Q19 finalizzate 2026-05-16 — Full Enterprise Google-Level. Pronto per implementazione Phase 0 dopo ADR-358)
**Date**: 2026-05-16
**Category**: Drawing System / DXF Viewer
**Author**: Giorgio Pagonis + Claude (Opus 4.7)
**Related ADRs**: ADR-005, ADR-030, ADR-031, ADR-032, ADR-040, ADR-046, ADR-055, ADR-057, ADR-087, ADR-095, ADR-104, ADR-189, ADR-340, ADR-344, ADR-345

---

## 1. Context

Il subapp **DXF Viewer** (`src/subapps/dxf-viewer/`) implementa già un line tool **funzionante** con base architetturale solida e centralizzata. Tuttavia, analizzando il comportamento dei CAD professionali (AutoCAD, BricsCAD, ArchiCAD, Revit), emergono **6 lacune funzionali** che separano l'esperienza attuale dallo standard di settore.

Questo ADR documenta:
- lo **stato attuale** del line tool (codice = source of truth, ADR-driven Phase 1);
- lo **standard industry** atteso da utenti CAD professionali;
- la **gap analysis** Google-level;
- il **piano di implementazione** in 6 fasi incrementali, **riusando i SSoT esistenti** (zero duplicati).

### Perché questo ADR
1. **Utente target**: architetti/ingegneri abituati a AutoCAD/BricsCAD. La mancanza di Polar Tracking, Dynamic Input live e Direct Distance Entry rende il tool **percepito come "amatoriale"**.
2. **Trust industria**: dove 4-5 player CAD convergono su un pattern, quello È la risposta ([[feedback_industry_standard_default]]).
3. **SSoT readiness**: il 90% dei building block esiste già, ma non è cablato. La spesa per allineare è bassa rispetto al beneficio.

---

## 2. Stato attuale (mappato dal codice 2026-05-16)

### 2.1 Flusso line creation end-to-end

```
Ribbon "Line" (shortcut 'L')
  ▼
ToolStateManager.setTool('line')          ← SSoT activeTool
  ▼
DrawingStateMachine: IDLE → TOOL_READY
  ▼
[Mouse Move]
  useDrawingHandlers.onDrawingHover(raw)
    ↓ ProSnapEngineV2.findSnapPoint(raw)  ← 17 engine paralleli
    ↓ hardOrtho(snapped, lastRef) se F8
    ↓ generatePreviewEntity('line', tempPoints, cursor)
    ↓ PreviewCanvas.drawPreview(entity)   ← zero React overhead (ADR-040)
  ▼
[Click 1]
  useCanvasClickHandler.handleCanvasClick (priority 6)
    → drawingHandlersRef.onDrawingPoint(world)
       → applySnap → orthoConstrain → addPoint
       → DrawingStateMachine: TOOL_READY → COLLECTING_POINTS
       → tempPoints = [p1]
  ▼
[Mouse Move — rubber band]
  generatePreviewEntity('line', [p1], cursor)
    → createEntityFromTool('line', [p1, cursor]) → LineEntity preview
  ▼
[Click 2]
  isEntityComplete('line', 2) → TRUE
    → createEntityFromTool → LineEntity finale
    → completeEntity():
        1. applyCompletionStyles (ADR-056)
        2. CreateEntityCommand → CommandHistory.execute (ADR-031, ADR-057)
           → SceneManager.addEntity (persistito)
        3. EventBus.emit('drawing:complete')
        4. toolStateStore.handleToolCompletion('line')
           allowsContinuous=true → tool rimane attivo, MA tempPoints svuotato
        5. (opt) Firestore persistence (ADR-340)
```

### 2.2 SSoT esistenti (riusabili)

| SSoT | Path | Ruolo per line tool |
|---|---|---|
| `ToolStateStore` | `src/subapps/dxf-viewer/stores/ToolStateStore.ts` | SSoT activeTool (ADR-055) |
| `ToolStateManager` (`TOOL_DEFINITIONS`) | `src/subapps/dxf-viewer/systems/tools/ToolStateManager.ts:22` | Metadata `'line'`: drawing, continuous, can-interrupt |
| `DrawingStateMachine` | `src/subapps/dxf-viewer/core/state-machine/DrawingStateMachine.ts` | FSM IDLE→COLLECTING→COMPLETING (ADR-032) |
| `useDrawingMachine` | `src/subapps/dxf-viewer/core/state-machine/useDrawingMachine.ts` | React binding FSM |
| `useDrawingHandlers` | `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts` | Entry point click/hover/snap |
| `useUnifiedDrawing` | `src/subapps/dxf-viewer/hooks/drawing/useUnifiedDrawing.tsx` | Facade hook |
| `completeEntity` | `src/subapps/dxf-viewer/hooks/drawing/completeEntity.ts` | Pipeline unificato (ADR-057) |
| `CreateEntityCommand` | `src/subapps/dxf-viewer/core/commands/entity-commands/CreateEntityCommand.ts` | Undo/redo (ADR-031) |
| `CommandHistory` | `src/subapps/dxf-viewer/core/commands/CommandHistory.ts` | Stack globale singleton |
| `ProSnapEngineV2` | `src/subapps/dxf-viewer/snapping/global-snap-engine.ts` | 17 snap engines singleton |
| `OrthoSnapEngine` | `src/subapps/dxf-viewer/snapping/engines/OrthoSnapEngine.ts` | Ortho visivo |
| `PreviewCanvas` | `src/subapps/dxf-viewer/canvas-v2/preview-canvas/PreviewCanvas.tsx` | Rubber-band zero-lag (ADR-040) |
| `HoverStore` / `ImmediatePositionStore` / `ImmediateSnapStore` | `systems/hover/`, `systems/cursor/` | Micro-leaf stores (ADR-040) |
| `UnifiedFrameScheduler` | `src/subapps/dxf-viewer/rendering/core/UnifiedFrameScheduler.ts` | RAF (ADR-030) |
| `LineEntity` type | `src/subapps/dxf-viewer/types/entities.ts:77` | Schema persistenza |
| `usePolarConstraints` | `src/subapps/dxf-viewer/systems/constraints/usePolarConstraints.ts` | Hook polar (⚠️ **non cablato**) |
| `DynamicInputSystem` | `src/subapps/dxf-viewer/systems/dynamic-input/` | Overlay X/Y/Angle/Length (wire parziale) |
| `line-keyboard-handler` | `src/subapps/dxf-viewer/systems/dynamic-input/keyboard-handlers/line-keyboard-handler.ts` | Tab cycling (esiste, bypassa pipeline) |

---

## 3. Industry Benchmark (CAD professionali)

Confronto feature-by-feature contro lo standard di mercato:

| Feature | AutoCAD | BricsCAD | ArchiCAD | Stato Nestor | Gap |
|---|---|---|---|---|---|
| Ortho (F8) | ✅ | ✅ | ✅ | ✅ `hardOrtho` | — |
| Polar Tracking (F10) — angoli multipli + tooltip + Shift-lock | ✅ 5/10/15/22.5/30/45/90 + custom | ✅ | ✅ | ⚠️ hook esiste, NON cablato | **G1** |
| Object Snap (F3 OSNAP) — endpoint/midpoint/center/intersection/perpendicular/tangent/quadrant/nearest/extension/node/insertion/parallel | ✅ 13 tipi | ✅ | ✅ | ✅ 17 engine | — |
| Object Snap Tracking (F11) — acquisire `+` punti, alignment paths | ✅ | ✅ TT/TK | ✅ | ❌ assente | **G4** |
| Dynamic Input (F12) — overlay X/Y/Angle/Length al cursore, Tab cycle | ✅ | ✅ | ✅ | ⚠️ system parziale, bypassa pipeline | **G2** |
| Direct Distance Entry — punta direzione + digita distanza + Enter | ✅ | ✅ | ✅ | ❌ assente | **G3** |
| Chain mode — segmento N+1 inizia da fine segmento N senza riselezione | ✅ | ✅ | ✅ | ⚠️ tool resta attivo ma `tempPoints` svuotato | **G5** |
| Undo last vertex (`U`) durante LINE | ✅ | ✅ | ✅ | ✅ `undoLastPoint` (per polyline) | — |
| Length + Angle live readout vicino al cursore | ✅ | ✅ | ✅ | ⚠️ solo edge distance, no angolo live | **G2** |
| Coordinate input absoluto/relativo/polar (`100,50`, `@100,50`, `@100<45`) | ✅ | ✅ | ✅ | ❌ assente | **G6** |
| ESC cancel / Enter finish / right-click context | ✅ | ✅ | ✅ | ✅ | — |
| Cursor crosshair + snap markers (colored squares/circles/triangles) | ✅ | ✅ | ✅ | ✅ | — |

**Convergenza industry**: 4/4 player implementano gli stessi pattern. Standard non opinionato — **questa è la risposta** ([[feedback_industry_standard_default]]).

---

## 4. Gap Analysis Google-Level

### G1 — Polar Tracking non cablato
**Cosa manca**: `usePolarConstraints` è scritto ma il suo output non passa in `useDrawingHandlers.onDrawingHover` né in `onDrawingPoint`. Solo `hardOrtho()` (puro 0/90/180/270) è applicato.

**Effetto**: l'utente non può tracciare linee a 30°, 45°, 60° "con magnete". Deve ricorrere a coordinate o object snap.

**Google-fix**:
- Esporre `applyPolar(point, ref, settings)` come funzione pura in `systems/constraints/polar-utils.ts` (SSoT puro).
- Wire in `useDrawingHandlers`:
  ```
  rawPoint → applySnap → applyPolar (if F10) → applyOrtho (if F8, mutually exclusive) → addPoint
  ```
- UI: toggle F10 nello status bar + dropdown angoli + custom input.
- Visual feedback: alignment path tratteggiata (verde, default industry) dal `lastRef` al cursore quando snap polar attivo, con tooltip `12.5° / 235.4mm` accanto al cursore.

### G2 — Dynamic Input incompleto
**Cosa manca**: `DynamicInputSystem` e `line-keyboard-handler` esistono ma:
1. l'overlay non è permanentemente visibile durante `COLLECTING_POINTS`;
2. quando l'utente digita lunghezza+angolo, `line-keyboard-handler` crea entità **direttamente** senza passare per `completeEntity()` → bypassa stili, command history, eventi, persistence. **Regressione architetturale**.

**Google-fix**:
- `DynamicInputOverlay.tsx`: condizione di mount = `state === 'COLLECTING_POINTS' && tool in INTERACTIVE_TOOLS`.
- Live readout: `useUnifiedDrawing` espone `liveLength` + `liveAngle` derivati da `(cursor - tempPoints[lastIdx])`.
- Tab cycling: default **lunghezza prima**, poi angolo (AutoCAD standard).
- Submit: **TUTTI** i path passano da `completeEntity()` — il keyboard handler trasforma input in `worldPoint` e chiama `onDrawingPoint(worldPoint)`, non scorciatoie.

### G3 — Direct Distance Entry
**Cosa manca**: digitare un numero seguito da `Enter` durante `COLLECTING_POINTS` non produce un punto a quella distanza dalla direzione corrente del cursore.

**Google-fix**:
- In `useKeyboardShortcuts` (canvas focus + state=COLLECTING_POINTS + tool='line'): tasti digit + Enter ⇒ leggi numero, calcola direzione `dir = normalize(cursor - lastRef)`, punto = `lastRef + dir * distance`, chiama `onDrawingPoint(punto)`.
- Funziona sia con polar/ortho ON (direzione vincolata) sia OFF (direzione libera cursore). Default: **funziona sempre** (industry: AutoCAD/BricsCAD non richiedono polar ON).

### G4 — Object Snap Tracking
**Cosa manca**: feature più sofisticata. L'utente:
1. fa hover su uno snap point (es. endpoint) — al passare di `ACQUISITION_DURATION` (default 1000ms) o con `Shift+click`, il punto diventa "acquired" (marker `+`).
2. Quando il cursore si allinea orizzontalmente/verticalmente/polarmente a un punto acquisito, appare alignment path tratteggiata.
3. Cliccando lungo la path, il punto si snappa alla path stessa.
4. Intersezioni tra path multiple = snap candidate prioritario.
5. ESC / completion / mouseleave timeout (default 5s) → clear acquired points.

**Google-fix**:
- Nuovo SSoT singleton **`TrackingPointStore`** in `src/subapps/dxf-viewer/systems/tracking/TrackingPointStore.ts` — gemello architetturale di `HoverStore`/`ImmediatePositionStore` (zero React state, `useSyncExternalStore`).
- Storage: array di `AcquiredPoint = { x, y, acquiredAt, sourceSnapType }` (max 7 punti, FIFO).
- Resolver: `resolveTrackingSnap(cursor, polarSettings) → SnapCandidate | null`.
- Render: in `canvas-layer-stack-leaves.tsx` micro-leaf dedicato che disegna alignment paths + marker `+`.

### G5 — Chain mode reale
**Cosa manca**: dopo il secondo click, `toolStateStore.handleToolCompletion('line')` rimette tool='line' ma `DrawingStateMachine.reset()` cancella `tempPoints`. L'utente deve ri-cliccare per il primo punto del prossimo segmento.

**Google-fix**:
- In `completeEntity` per tool con `allowsChain=true` (nuovo flag in `TOOL_DEFINITIONS`):
  ```
  dopo addEntity → DON'T reset → tempPoints = [previousEndPoint] → state = COLLECTING_POINTS
  ```
- Exit chain: ESC, Enter (no point digitato), right-click → context menu "Finish" / "Cancel".

### G6 — Coordinate input syntax
**Cosa manca**: nessun parser per `100,50`, `@100,50`, `@100<45`.

**Google-fix**:
- Nuovo file `src/subapps/dxf-viewer/systems/dynamic-input/coordinate-parser.ts`:
  ```ts
  parseCoordInput(text: string, lastRef: Point | null): Point | null
  // "100,50"    → { x:100, y:50 } (absolute)
  // "@100,50"   → lastRef + { x:100, y:50 } (relative cartesian)
  // "@100<45"   → lastRef + polar(100, 45°) (relative polar)
  // "@100<45,h" → relative polar in horizontal plane (3D-aware, future)
  ```
- Integrato in `line-keyboard-handler` su Enter: se input matcha coord pattern → chiama `parseCoordInput` → `onDrawingPoint(parsed)`.

---

## 4-BIS. Deep-Dive Enterprise Features (ricerca 2026-05-16, seconda iterazione)

Dopo la prima Q&A è emerso che il line tool, per essere **full enterprise**, necessita anche delle seguenti feature presenti in tutti i CAD professionali. Estensione gap analysis:

### G7 — Layer & Object Properties durante la creazione (critical enterprise)
**Cosa manca**: quando l'utente disegna una linea, **non è chiaro** in quale layer finisca. Manca:
- Concetto di **"current layer"** (l'attivo, dove vanno le nuove entità).
- Properties **ByLayer / ByBlock** per `color`, `lineweight`, `linetype` ereditate dal layer.
- Dropdown nello status bar/ribbon per **cambio rapido current layer**.
- Override esplicito di proprietà (es. "questa linea è rossa, non importa il layer").

**Effetto su drafting professionale**: senza layers, il file DXF esportato è un blob unico → inutile per architetti che lavorano per "layer wall", "layer dimension", "layer construction", ecc.

**Google-fix**:
- Verificare se esiste già un **`LayerStore`** SSoT (probabilmente sì, DXF parser lo necessita per import).
- Cablare `completeEntity` per leggere `currentLayerId` e settare `entity.layer`.
- UI: layer picker nello status bar + properties panel con override.
- Lineweight standard ISO: `0.05, 0.09, 0.13, 0.18, 0.25, 0.35, 0.50, 0.70, 1.00, 1.40, 2.00 mm` + `Default` + `ByLayer`.
- Linetype standard: `Continuous, Dashed, Hidden, Center, Phantom, DashDot, Border, Divide` (ACAD ISO templates).

### G8 — Object Snap Overrides (one-shot snap modifiers)
**Cosa manca**: capacità di forzare uno snap specifico **per il prossimo click**, anche se i running snaps sono disabilitati. Industry pattern:
- **`from`**: punto di riferimento + offset cartesiano/polar (`from <ENDP> @5,0`).
- **`m2p` / `mtp`**: midpoint tra 2 punti cliccati al volo (utilissimo per centrare).
- **`app`**: apparent intersection (intersezione "vista" anche se 3D-skew).
- **Single-use overrides via right-click menu** durante COLLECTING_POINTS: "endp once", "mid once", ecc.

**Google-fix**:
- Right-click in COLLECTING_POINTS → context menu con submenu "Snap Override" (lista 17 engine + From/M2P/App).
- Selezione = next-click usa solo quello snap, poi torna ai running.
- Tasto `Shift+Right-click` = override menu rapido (industry shortcut).

### G9 — Quick Properties (hover preview + double-click edit)
**Cosa manca**: feedback informativo sull'entità sotto il cursore senza dover aprire un pannello.
- **Hover di 800ms** su una linea esistente → tooltip con `Layer / Color / Length / Angle / Linetype`.
- **Double-click** su una linea → mini-pannello editing rapido in-place (modifica length, angle, layer).
- **Properties Palette** (full): `F11` o `Ctrl+1` → pannello laterale con TUTTE le properties dell'entità selezionata, editabile in tempo reale.

**Google-fix**:
- Quick Properties: nuovo modulo `systems/properties/QuickPropertiesPopover.tsx` (collegato a `HoverStore`).
- Properties Palette: nuovo pannello FloatingPanel (ADR-003) con form generato da entity schema (`getEntityProperties(entity)`).
- Edit real-time: modifica → `UpdateEntityCommand` → CommandHistory (undo-able).

### G10 — Grip Editing dopo la creazione
**Cosa manca**: nessun grip visibile selezionando una linea esistente. L'utente non può "stirare un endpoint" o "spostare la linea via midpoint" intuitivamente.
- **3 grip per LineEntity**: 2 endpoint (square) + 1 midpoint (square).
- **Hover grip**: cursore cambia; tooltip "Stretch" / "Move" / "Lengthen".
- **Click grip ("hot")**: enter modal stretch mode → preview rubber-band → click finale.
- **Multi-function**: Enter/Space cicla `Stretch → Move → Rotate → Scale → Mirror`.
- **Endpoint grip**: stretch (estende/accorcia + cambia angolo).
- **Midpoint grip**: move (sposta tutta la linea senza cambiare length/angle).

**Google-fix**:
- Verificare presenza eventuale `GripStore` / `useGrip*` esistente.
- Se assente: nuovo modulo `systems/grips/GripStore.ts` + `entity-grips/line-grips.ts` (generator pure fn).
- Render: micro-leaf in `canvas-layer-stack-leaves.tsx` per grip overlay.
- Command: `UpdateEntityCommand` (riusa pipeline esistente, undo-able).

### G11 — Command Aliases & Command Line Input
**Cosa manca**: utenti CAD veterani digitano `L` Enter per attivare LINE, `XL` per XLINE, ecc. Più veloce del click ribbon.
- **Command line input** (bottom o floating): area testo dove l'utente digita comandi.
- **Alias registry**: `L → line`, `XL → xline`, `RAY → ray`, ecc.
- **Autocomplete**: come digiti, suggerimenti.
- **Command history**: frecce ↑↓ per richiamare comandi precedenti.

**Google-fix**:
- Nuovo SSoT `systems/command-line/CommandAliasRegistry.ts` (SSoT puro).
- Nuovo componente `ui/command-line/CommandLineInput.tsx`.
- Hook in `useKeyboardShortcuts`: pressione lettera fuori da input field → mostra command line + focus.

### G13 — Selection Cycling (overlapping entities)
**Cosa manca**: quando 2+ entità si sovrappongono nello stesso pixel, l'utente non può scegliere quale selezionare.

**Google-fix**:
- Trigger: `Shift+Space` durante hover su pixel con N≥2 entità rilevate (uso di `hit-test` esistente in `ProSnapEngineV2` per intercept).
- Display: mini-list flottante accanto al cursore con N voci (entity type + layer + sintetico ID).
- Ogni Shift+Space cicla highlight della voce successiva.
- Click su voce o `Enter` → selezione esclusiva di quella entità.
- ESC → annulla cycling, torna a default selection.
- Nuovo modulo: `systems/selection/SelectionCyclingPopover.tsx` + `systems/selection/use-selection-cycling.ts`.

### G14 — Length / Angle Locking durante draw
**Cosa manca**: in Dynamic Input non si può "congelare" un valore mantenendo libero l'altro.

**Google-fix**:
- Shortcut: `Ctrl+L` (Length lock) / `Ctrl+A` (Angle lock) durante COLLECTING_POINTS.
- Visual: il campo bloccato diventa **arancione** con icona lucchetto 🔒; il campo libero si aggiorna live con cursore.
- Comportamento:
  - Length locked: la geometria preview ha length fissa, angle deriva dal cursore.
  - Angle locked: la geometria preview ha angle fissa (sovrascrive polar/ortho), length deriva dal cursore.
- Unlock: stesso shortcut o click su lucchetto.
- Persistenza nel `DynamicInputStore` (nuovo micro-leaf SSoT) — stato `{ lockedField: 'length' | 'angle' | null, lockedValue: number | null }`.

### G15 — Lineweight / Linetype / Color Override nel ribbon (consumer di ADR-358)
**Cosa manca**: quando line tool è attivo, l'utente non può sovrascrivere le proprietà di stile per la **prossima** linea senza cambiare layer.

**Google-fix**:
- Quando `activeTool === 'line'`, nel ribbon area "Quick Style" appaiono 3 dropdown:
  - `Lineweight: [ByLayer ▼] [Default] [0.05/0.09/0.13/0.18/0.25/0.35/0.50/0.70/1.00/1.40/2.00 mm]`
  - `Linetype: [ByLayer ▼] [Continuous/Dashed/Hidden/Center/Phantom/DashDot/Border/Divide]` (catalogo ISO DXF)
  - `Color: [ByLayer ▼] [Red/Yellow/Green/Cyan/Blue/Magenta/White] [Truecolor picker…]`
- Default = ByLayer (heritage da `currentLayer` definito in ADR-358).
- Override: l'entity create durante override mode salva property esplicita (non ByLayer).
- Persistenza scelte: `localStorage` chiave `dxf:quickStyle.{lineweight,linetype,color}` (cross-session).
- Consumo di **`LayerStore`** (ADR-358) — non duplica struttura layer, legge `currentLayerId` e usa solo come default fallback.

### G16 — Construction Lines (XLINE / RAY) — sub-family del Line tool
**Cosa manca**: linee ausiliarie infinite per costruzioni geometriche.
- **XLINE**: linea infinita in entrambe le direzioni (passa per un punto + angolo).
- **RAY**: linea semi-infinita (start point + direzione).
- **Sub-modes XLINE**: H (horizontal), V (vertical), A (angle), B (bisect), O (offset).

**Google-fix**:
- Aggiungere tool `xline` e `ray` a `TOOL_DEFINITIONS`.
- Nuove entità: `XLineEntity`, `RayEntity` in `types/entities.ts`.
- Render: clip alle viewport bounds (infinite "in display" ma persistite come `{point, direction}`).
- DXF compat: `XLINE` e `RAY` sono entità DXF native (group code 100 = `AcDbXline` / `AcDbRay`).

---

---

## 5. Decision

### 5.1 Standard adottato
**Replica fedele dello standard AutoCAD/BricsCAD** (industry de-facto):
- **Polar Tracking — sistema misto AutoCAD-like** (confermato Giorgio 2026-05-16):
  - **Increment Angle** (singola): dropdown con `5°, 10°, 15°, 18°, 22.5°, 30°, 45°, 90°` — il sistema deriva tutti i multipli automaticamente. **Default = 90°**.
  - **Additional Angles** (lista): l'utente aggiunge angoli specifici extra (es. `33°` per pendenza tetto). Default = lista vuota.
  - **Custom input**: campo testuale per qualsiasi decimale (es. `27.5°`).
  - Le tre opzioni operano **simultaneamente** (Increment-multipli ∪ Additional ∪ Custom).
- **Dynamic Input — sempre ON di default + toggle status bar** (confermato Giorgio 2026-05-16, opzione C):
  - Mount permanente in `COLLECTING_POINTS` quando tool è in `INTERACTIVE_TOOLS`.
  - Bottone toggle nello status bar (NO F12 perché conflitta con DevTools del browser).
  - Stato salvato in `ToolStateStore` (persistente cross-session via localStorage chiave `dxf:dynamicInput.enabled`).
- **Tab cycling — lunghezza prima, poi angolo** (confermato Giorgio 2026-05-16, opzione A AutoCAD-style):
  - Campo iniziale attivo all'apertura dell'overlay = **Lunghezza**.
  - Tab: Lunghezza → Angolo → Lunghezza (ciclo a 2 elementi).
  - Coordinate X/Y NON nel ciclo Tab — accessibili solo digitando direttamente con sintassi `100,50` (vedi Q5).
- **Direct Distance Entry — funziona sempre (loose)** (confermato Giorgio 2026-05-16, opzione A):
  - Attivo in `COLLECTING_POINTS` con tool drawing, indipendentemente da F8/F10.
  - Senza Polar/Ortho: direzione = `normalize(cursor - lastRef)` esatta (anche se 4.97°).
  - Con Polar ON: applicata costrizione polar PRIMA del calcolo direzione.
  - Con Ortho ON: applicata costrizione ortho (H/V) PRIMA del calcolo direzione.
  - Nessun warning UI (l'utente CAD-aware accetta la responsabilità della direzione).
- **Coordinate syntax — hybrid simboli AutoCAD + bottoni mode** (confermato Giorgio 2026-05-16, opzione C):
  - **Sintassi testuale** (parser in `coordinate-parser.ts`):
    - `100,50` → assoluto `{x:100, y:50}`
    - `@100,50` → relativo cartesiano da `lastRef`
    - `@100<45` → relativo polare (distanza 100, angolo 45°)
    - `100<45` → polare assoluto (raro, ma supportato per simmetria)
  - **Bottoni mode** nel Dynamic Input panel: `[Abs] [Rel] [Polar]`
    - Selezionando un mode, l'input numerico viene auto-prefissato dietro le quinte (`@`, `<`).
    - Default mode: `Abs` su primo punto, `Rel` su punti successivi (chain mode).
  - **Parser unico**: i bottoni convertono in syntax `@`/`<`, poi tutto passa dallo stesso parser → SSoT puro, zero duplicazione logica.
- **Chain mode — ON di default per `line` con uscita full industry-style** (confermato Giorgio 2026-05-16, opzione A):
  - `allowsChain: true` nel `TOOL_DEFINITIONS['line']`.
  - **ESC**: cancella chain + esce dal tool (torna `select`).
  - **Enter senza input**: termina chain corrente, tool resta attivo per nuova chain (Polyline-like behavior).
  - **Right-click**: apre context menu CAD con voci:
    - `Finish` (= Enter senza input)
    - `Cancel` (= ESC)
    - `Undo last vertex` (= `U` / `Ctrl+Z` durante chain — rimuove ultimo punto, mantiene chain)
    - `Close` (visibile solo se `tempPoints.length >= 3`, chiude polylinea — non applicabile a line tool puro, presente per coerenza con polyline)
  - **`U` keyboard**: shortcut diretto a "Undo last vertex" durante chain.
  - **`Ctrl+Z` durante chain**: stesso comportamento di `U` (rimuove vertice corrente). Quando chain esce, `Ctrl+Z` torna al comportamento globale (CommandHistory).
- **Object Snap Tracking — INCLUSO in questo ADR (Phase 4)** (confermato Giorgio 2026-05-16, opzione A — completeness over MVP):
  - Acquisizione: hover di `ACQUISITION_DURATION = 1000ms` su snap point **OPPURE** `Shift+click` esplicito.
  - Capacità: fino a **7 punti** acquisiti simultanei (FIFO, il più vecchio decade).
  - Storage: `TrackingPointStore` singleton (nuovo SSoT) — gemello di `HoverStore`.
  - Visual: marker `+` sui punti acquisiti, alignment paths tratteggiate H/V/polar quando il cursore si allinea (tolleranza ±3px in screen space).
  - Resolver: intersezione tra paths multiple = snap candidate prioritario; intersezione path+geometria = secondario; path puro = terziario.
  - Decadimento: clear su ESC, completion (entity created), o `TIMEOUT = 5000ms` da ultimo hover.
  - Anti-flicker: durante chain mode, i punti acquisiti **persistono** tra segmenti.

### 5.2 Nuovi SSoT da creare (aggiornato dopo seconda iterazione Q&A)

**Modulo SSoT puri (zero state)**:
1. **`coordinate-parser`** — parsing `@`/`<`/cartesian/polar (`systems/dynamic-input/coordinate-parser.ts`).
2. **`tracking-colors`** — palette adaptive theme-aware (`canvas-v2/preview-canvas/tracking-colors.ts`).
3. **`polar-utils`** — pure fn `applyPolar` (`systems/constraints/polar-utils.ts`).
4. **`units`** — conversion mm↔display unit (`config/units.ts`).
5. **`tracking-resolver`** — intersezioni alignment paths (`systems/tracking/tracking-resolver.ts`).
6. **`entity-property-schema`** — schema editing properties per entity type (`systems/properties/entity-property-schema.ts`).
7. **`line-grips`** — generator grip per LineEntity (`systems/grips/entity-grips/line-grips.ts`).

**Store singleton (micro-leaf, `useSyncExternalStore`)**:
8. **`TrackingPointStore`** — acquired points Object Snap Tracking (`systems/tracking/TrackingPointStore.ts`).
9. **`GripStore`** — grip state (hovered/hot/active mode) (`systems/grips/GripStore.ts`).
10. **`CommandHistoryStore`** — command line history (`systems/command-line/CommandHistoryStore.ts`).

**Registry SSoT (read-mostly)**:
11. **`CommandAliasRegistry`** — ~150 ACAD-compatible alias (`systems/command-line/CommandAliasRegistry.ts`).
12. **`GripTransformRegistry`** — Stretch/Move/Lengthen/Rotate/Scale/Mirror modes (`systems/grips/GripTransformRegistry.ts`).
13. **`SnapOverrideOrchestrator`** — single-shot snap coordinator (`snapping/overrides/SnapOverrideOrchestrator.ts`).

**Componenti UI (FloatingPanel + canvas overlay)**:
14. **`DynamicInputOverlay`** — esistente, refactor.
15. **`QuickPropertiesHoverPopover`** — livello 1.
16. **`QuickPropertiesMiniPanel`** — livello 2.
17. **`PropertiesPalette`** — livello 3.
18. **`CommandLineInput` + `CommandAutocompleteList`** — UI command line.
19. **Status bar buttons**: Polar (F10), Dynamic Input toggle, Display Unit dropdown, Layer current picker (consumed da ADR-358).

**Prerequisito esterno**:
20. **`LayerStore`** (definito in ADR-358 — Layer Management System).

Tutti gli altri building block sono **riusati** dai SSoT esistenti.

### 5.3 Visual feedback — Adaptive theme colors
**Sistema adattivo** (confermato Giorgio 2026-05-16, opzione C):
- File SSoT: `src/subapps/dxf-viewer/canvas-v2/preview-canvas/tracking-colors.ts`
- Lettura theme da `ADR-004 Canvas Theme System` (`CanvasThemeContext`).
- **Dark theme** (AutoCAD-style):
  - Polar/Tracking alignment path: `#00FF00` (neon green) — dashed
  - Acquired marker `+`: `#FFFF00` (neon yellow)
  - Snap endpoint: yellow square
  - Snap midpoint: yellow triangle
  - Snap center: yellow circle
- **Light theme** (modern):
  - Polar/Tracking alignment path: `#15803D` (deep green 700) — dashed
  - Acquired marker `+`: `#EA580C` (orange 600)
  - Snap markers: design system tertiary colors con contrasto ≥ 4.5:1 WCAG AA
- Tooltip background: semi-transparent backdrop con auto-contrast del testo.

### 5.4 Nuovi flag `TOOL_DEFINITIONS`
- `allowsChain: boolean` (default false; `line`=true).
- `supportsDynamicInput: boolean` (default false; `line`=true).

### 5.5 Unità di misura — internal mm, display configurabile (default cm)
**Architettura** (confermato Giorgio 2026-05-16, opzione A):
- **Unità interna (scene/storage/DXF)**: **mm** (millimetri) — standard BIM/ISO/DXF.
  - 1 unit = 1 mm.
  - `LineEntity.start.x = 5000` significa 5000 mm = 5 m.
- **Unità display (UI overlay, tooltip, status bar)**: **configurabile**, default `cm`.
  - Opzioni: `mm`, `cm`, `m`, `in` (inches), `ft` (feet).
  - Selezione: dropdown nello status bar `[cm ▼]`.
  - Persistenza: `localStorage` chiave `dxf:displayUnit` (cross-session) + project-scoped override (Firestore `projects/{id}/dxfSettings`).
- **Conversion layer** (SSoT puro): `src/subapps/dxf-viewer/config/units.ts`
  - `toDisplay(mm: number, unit: DisplayUnit): { value: number, label: string }`
  - `fromDisplay(value: number, unit: DisplayUnit): number` (mm)
  - Precisione: 3 decimali default, configurabile via `dxf:displayPrecision`.
- **Coordinate parser** (Q5) accetta suffisso unit opzionale: `5m,3m` → `5000mm, 3000mm` automaticamente.
- **DXF export/import**: `$INSUNITS = 4` (millimeters) sempre — coerenza assoluta.

---

## 6. Architecture

### 6.1 Pipeline estesa (rawPoint → finalPoint)

```
rawPoint (mouse o keyboard input)
  ▼
1. applySnap (ProSnapEngineV2)             ← 17 engine, priority-resolved
  ▼
2. applyTrackingSnap (TrackingPointStore)   ← se acquired points presenti
  ▼
3. applyPolar (usePolarConstraints)         ← se F10 ON
  ▼
4. applyOrtho (hardOrtho)                   ← se F8 ON (override polar)
  ▼
5. applyDynamicInputOverride               ← se Tab+digit Enter pending
  ▼
6. applyCoordinateParser                    ← se input testuale syntax-match
  ▼
finalPoint → addPoint → DrawingStateMachine
```

Ogni step è **puro** (input → output), composabile e testabile. L'ordine è critico: snap PRIMA di polar (snap su geometria esistente vince), polar/ortho dopo (override direzionale), dynamic input ultimo (override esplicito utente).

### 6.2 Component map

| File | Phase | Modifica |
|---|---|---|
| `hooks/drawing/useDrawingHandlers.ts` | 1, 3, 5, 6 | Wire polar/tracking/chain reset/distance entry |
| `systems/constraints/polar-utils.ts` (nuovo) | 1 | `applyPolar(point, ref, settings)` pure fn |
| `systems/constraints/usePolarConstraints.ts` | 1 | Espone settings (enabled, increment, custom angles) |
| `ui/ribbon/data/status-bar.ts` | 1 | Toggle F10 + dropdown angoli |
| `systems/dynamic-input/DynamicInputOverlay.tsx` | 2 | Mount permanente in COLLECTING_POINTS |
| `hooks/drawing/useUnifiedDrawing.tsx` | 2 | Espone `liveLength`, `liveAngle` |
| `systems/dynamic-input/keyboard-handlers/line-keyboard-handler.ts` | 2, 6 | Refactor per passare da `onDrawingPoint` |
| `hooks/canvas/useKeyboardShortcuts.ts` | 3 | Direct Distance Entry handler |
| `systems/dynamic-input/coordinate-parser.ts` (nuovo) | 6 | `parseCoordInput` |
| `hooks/drawing/completeEntity.ts` | 5 | Chain mode: `tempPoints=[lastEnd]` invece di reset |
| `systems/tools/ToolStateManager.ts` | 5 | Flag `allowsChain` su `'line'` |
| `systems/tracking/TrackingPointStore.ts` (nuovo) | 4 | Singleton micro-leaf |
| `systems/tracking/tracking-resolver.ts` (nuovo) | 4 | `resolveTrackingSnap` pure fn |
| `components/dxf-layout/canvas-layer-stack-leaves.tsx` | 4 | Nuovo leaf: alignment paths + marker `+` |
| `canvas-v2/preview-canvas/PreviewCanvas.tsx` | 4 | Render acquired markers |
| `i18n/locales/{el,en}/dxf-viewer.json` | 1-6 | Stringhe nuove UI |

---

## 7. Implementation Phases (aggiornato dopo seconda iterazione)

Ogni phase = 1 commit autonomo (passa CI, no breaking). **Prerequisito globale**: ADR-358 (Layer Management System) deve essere implementato PRIMA di Phase 0 di ADR-357.

| Phase | Titolo | Files affetti | Effort | Q-ref |
|---|---|---|---|---|
| **0** | Consume `LayerStore` da ADR-358 — wire `completeEntity` → `entity.layer = currentLayerId` | 2 | S | Q11 |
| **1** | Polar Tracking wire-up + UI status bar (Increment + Additional + Custom) | 5 | M | Q1 |
| **2** | Dynamic Input live readout + Tab cycle + units display + refactor handler | 6 | M | Q2, Q3, Q9 |
| **3** | Direct Distance Entry | 2 | S | Q4 |
| **4** | Object Snap Tracking (TrackingPointStore + resolver + leaf render + adaptive colors) | 6 | L | Q7, Q8 |
| **5** | Chain mode reale + right-click context menu + U undo vertex | 4 | M | Q6 |
| **6** | Coordinate parser (abs/rel/polar) + bottoni mode | 3 | M | Q5 |
| **7** | Snap Overrides FULL (From, M2P, App, single-use) + SnapOverrideOrchestrator | 4 | M | Q12 |
| **8** | Quick Properties — Livello 1 Hover Tooltip | 3 | S | Q13 |
| **9** | Quick Properties — Livello 2 Mini-Panel (double-click) | 3 | M | Q13 |
| **10** | Quick Properties — Livello 3 Full Palette (F11) + `entity-property-schema` SSoT | 5 | L | Q13 |
| **11** | Grip Editing — `GripStore` + line-grips + Stretch/Move base | 5 | M | Q14 |
| **12** | Grip Editing — `GripTransformRegistry` + Lengthen/Rotate/Scale/Mirror + hover popup + Enter cycle | 5 | L | Q14 |
| **13** | Command Aliases — Registry + keyboard handler (no UI) | 3 | S | Q15 |
| **14** | Command Line UI — Input + Autocomplete + History + user customization panel | 6 | L | Q15 |
| **15** | Selection Cycling (Shift+Space + mini-popover) | 3 | S | Q17 |
| **16** | Length/Angle Lock (Ctrl+L / Ctrl+A) + `DynamicInputStore` lock state | 3 | M | Q18 |
| **17** | Quick Style Override ribbon (Lineweight/Linetype/Color dropdown) — consumer di ADR-358 | 4 | M | Q19 |
| **18** | Mouse gestures audit + gap-fill (right-drag/middle-drag pan) | 2 | S | extras |

Totale: **18 phases**, **~79 files** affetti, ship-ready incrementalmente. Ogni phase ha integration test dedicati.

### 7.1 Principio "Una phase = una sessione" (NON-NEGOZIABILE)

**Regola di esecuzione confermata da Giorgio 2026-05-16**:

> Ogni phase deve essere abbastanza piccola da:
> 1. Stare interamente in **una singola sessione Claude Code** (no carryover tra sessioni)
> 2. Non saturare il context window (target: ≤ 70% context usage a fine phase)
> 3. Concludersi con: codice + ADR update + handoff report per la prossima sessione

**Se una phase risulta troppo grande durante l'implementazione**:
- **STOP**. Suddividere in `Phase X.a`, `Phase X.b`, ... PRIMA di iniziare.
- Aggiornare la tabella phases sopra con la nuova suddivisione.
- Documentare la motivazione nel changelog.

**Ordine di esecuzione vincolante**:
1. ✅ ADR-357 (questo) — **ACCEPTED**, design completo.
2. ⏳ **ADR-358 (Layer Management System)** — Q&A + design, **PRIMA di qualunque implementazione**.
3. ⏳ **ADR-359 (Auxiliary Geometry Tools: XLINE + RAY)** — Q&A + design, dopo ADR-358.
4. ⏳ **Implementation Phase 0** di ADR-357 (consume `LayerStore` da ADR-358).
5. ⏳ Implementation Phase 1 → Phase 18 (una per sessione).

**Indipendenze**:
- ADR-359 (XLINE/RAY) può procedere parallelo a implementation di ADR-357 (no dipendenze).
- ADR-360 (Dimension System) è completamente indipendente, può essere pianificato in qualsiasi momento.

---

## 8. Testing Strategy

- **Unit tests** per ogni funzione pura: `applyPolar`, `parseCoordInput`, `resolveTrackingSnap`.
- **Integration tests** in `src/subapps/dxf-viewer/__tests__/drawing/` per ogni phase: simulano click/keyboard → asserzioni su scene, command history, store state.
- **Regression**: snapshot test FPS hover (deve restare >55 fps su scene 5k entità — ADR-040).
- **Manual browser test**: ogni phase verificata in `npm run dev` su pagina DXF Viewer prima del merge.

---

## 9. Open Questions (in raffinamento con Giorgio)

> Le risposte di Giorgio in greco saranno trascritte qui in italiano + aggiornata la sezione 5 (Decision).

1. ✅ **Polar Tracking — angoli default**: RISOLTO 2026-05-16 → sistema misto AutoCAD-like (Increment + Additional + Custom), default Increment=90°.
2. ✅ **Dynamic Input visibility**: RISOLTO 2026-05-16 → sempre ON di default + toggle nello status bar (no F12 per conflitto browser DevTools).
3. ✅ **Tab cycling start**: RISOLTO 2026-05-16 → Lunghezza prima (AutoCAD-style). X/Y solo via syntax diretto.
4. ✅ **Direct Distance Entry restrictions**: RISOLTO 2026-05-16 → funziona sempre (loose), nessun warning. Polar/Ortho applicati a monte se attivi.
5. ✅ **Coordinate input syntax**: RISOLTO 2026-05-16 → hybrid (simboli `@`/`<` + bottoni `[Abs][Rel][Polar]`). Parser unico SSoT.
6. ✅ **Chain mode exit**: RISOLTO 2026-05-16 → ESC=cancel+exit, Enter=finish chain (tool stays), Right-click=context menu (Finish/Cancel/Undo/Close), U=undo vertex.
7. ✅ **Object Snap Tracking**: RISOLTO 2026-05-16 → INCLUSO in ADR-357 Phase 4 (completeness over MVP). 7 punti FIFO, hover 1000ms o Shift+click, timeout 5000ms.
8. ✅ **Color scheme alignment paths**: RISOLTO 2026-05-16 → Adaptive theme-aware (dark = AutoCAD neon, light = design-system deep). SSoT `tracking-colors.ts`.
9. ✅ **Unità di misura**: RISOLTO 2026-05-16 → internal mm (BIM/ISO/DXF standard), display configurabile (default cm). Nuovo modulo `config/units.ts`.
10. ✅ **ADR-357 numbering**: CONFERMATO 2026-05-16. CLAUDE.md §7 (Terminal Prohibitions) aggiornato: regola "145 first" rimossa, ora "use next sequential after highest existing". ADR-145 duplicato segnalato come da evitare.

### Q11–Q16 — Seconda iterazione (deep-dive enterprise)

11. ✅ **G7 — Layer & Object Properties**: RISOLTO 2026-05-16 → **ADR-358 separato** (Layer Management System) come **prerequisito** di ADR-357 implementation. Layer System parzialmente esistente nel codebase (`AdminLayerManager`, `LayerOperationsService`, `LayerSelectorDropdown`, `CanEditLayerGuard`, `useLayerManagerState`) — richiede audit approfondito in ADR-358 Phase 0 prima di estendere. ADR-357 consumerà `LayerStore` (SSoT da ADR-358).
12. ✅ **G8 — Object Snap Overrides**: RISOLTO 2026-05-16 → **FULL enterprise** (opzione A). Inclusi: `From`, `M2P` (Mid-Between-2-Points), `Apparent Intersection`, **+ single-use overrides di tutti i 17 running snap engines**. Trigger UX:
- Right-click in `COLLECTING_POINTS` → context menu "Snap Override" con sub-menu completo.
- **`Shift+Right-click`** = override menu rapido (industry shortcut AutoCAD/BricsCAD).
- Selezione = next-click usa solo quello snap, poi torna automaticamente ai running.
- **Apparent Intersection**: rilevamento via projection 2D di entità con `z != 0` (DXF 3D support) — degrada gracefully se scene è puramente 2D.
- Nuovo modulo SSoT: `snapping/overrides/SnapOverrideOrchestrator.ts` — coordina single-shot snap + cleanup automatico.
13. ✅ **G9 — Quick Properties**: RISOLTO 2026-05-16 → **FULL 3 livelli enterprise** (opzione A):
- **Livello 1 — Hover Tooltip (800ms)**: read-only popover con Layer/Color/Length/Angle/Linetype. Modulo `systems/properties/QuickPropertiesHoverPopover.tsx` legato a `HoverStore`.
- **Livello 2 — Quick Properties Mini-Panel (double-click)**: floating editor con 5-6 properties critiche. Modulo `systems/properties/QuickPropertiesMiniPanel.tsx`. Pattern: open su `dblclick`, close su `Esc`/`Enter`/click-outside.
- **Livello 3 — Full Properties Palette (F11 / Ctrl+1)**: FloatingPanel (ADR-003) con form generato da entity schema. Modulo `systems/properties/PropertiesPalette.tsx`. Real-time editing → `UpdateEntityCommand` → CommandHistory (undo-able).
- **SSoT condiviso**: `systems/properties/entity-property-schema.ts` (pure) — mappa entity type → property descriptors (label, editor type, validation, getter, setter). Tutti e 3 i livelli leggono da qui.
14. ✅ **G10 — Grip Editing**: RISOLTO 2026-05-16 → **FULL AutoCAD-style** (opzione A):
- **3 grip** per `LineEntity`: 2 endpoint (square) + 1 midpoint (square).
- **Hover su grip** = multi-function popup con voci: `Stretch / Move / Lengthen / Rotate / Scale / Mirror`.
- **Click grip (hot)** = entra in modal interactive con preview rubber-band; **Enter/Space** cicla modes.
- **Right-click su grip hot** = context menu completo (modes + Copy + Undo).
- **Mode behaviors**:
  - Endpoint: Stretch (default) cambia length+angle / Lengthen mantiene angle.
  - Midpoint: Move (default) sposta tutto.
  - Tutti i grip supportano Rotate / Scale / Mirror sull'intera entità.
- **SSoT**: nuovo `systems/grips/GripStore.ts` (singleton, micro-leaf) + `systems/grips/entity-grips/line-grips.ts` (pure fn `generateGrips(entity) → Grip[]`).
- **Grip transformation modes** centralizzati in `systems/grips/GripTransformRegistry.ts` — riusabili da TUTTE le entity types future (polyline, circle, ecc.). Pattern: `interface GripTransform { name, preview(grip, cursor, entity), apply(grip, cursor, entity) → UpdateEntityCommand }`.
- **Render**: nuovo micro-leaf in `canvas-layer-stack-leaves.tsx` per grip overlay + hover popup.
- **NOTA scope**: Rotate/Scale/Mirror dei grip riutilizzeranno la stessa `GripTransformRegistry` quando saranno aggiunti i tool top-level corrispondenti (es. `RotateTool`). Il registro è SSoT condiviso — zero duplicazione.
15. ✅ **G11 — Command Aliases & Command Line**: RISOLTO 2026-05-16 → **FULL system** (opzione A):
- **Command Alias Registry** (SSoT): `systems/command-line/CommandAliasRegistry.ts`. Preloaded con ~150 alias ACAD-compatible (`L→line, XL→xline, RAY→ray, C→circle, REC→rectangle, PL→polyline, O→offset, M→move, CO→copy, E→erase, Z→zoom, F→fillet, CH→chamfer, …`).
- **Command Line Input UI**: `ui/command-line/CommandLineInput.tsx` — visibile in bottom bar (toggle nello status bar, default ON). Auto-show su digitazione fuori da input field.
- **Autocomplete dropdown**: `ui/command-line/CommandAutocompleteList.tsx` — suggerimenti real-time, navigation con ↑↓, Tab per completare.
- **Command History**: `systems/command-line/CommandHistoryStore.ts` (singleton, persistente localStorage chiave `dxf:commandHistory`, max 100 entries). Frecce ↑↓ in input vuoto = scorri history. Space/Enter su empty = repeat-last.
- **User customization**: pannello settings DXF Viewer → "Command Aliases" → CRUD UI per alias custom. Persistenza Firestore (per-user) + fallback localStorage.
- **Execution**: alias risolto → `ToolStateStore.setTool(toolId)` o invocazione comando. Pipeline unificata via `CommandRegistry` esistente (ADR-031).
- **i18n**: nome comando localizzato (`line` → ελληνικά `Γραμμή`) ma alias **sempre ASCII** (industry standard, multilingual-safe).
16. ✅ **G12 → ora G16 — Construction Lines (XLINE + RAY)**: RISOLTO 2026-05-16 → **ADR-359 separato** (Auxiliary Geometry Tools) implementato **DOPO** ADR-357. Include XLINE (con sub-modes H/V/A/B/O) + RAY + integrazione `IntersectionSnapEngine`. Nessuna dipendenza da ADR-357 (può procedere parallelo). DXF compatibility nativa (entity codes `AcDbXline`, `AcDbRay`).

### Q17–Q19 — Terza iterazione (extras enterprise dalla proposta accettata)

17. ✅ **G13 — Selection Cycling**: RISOLTO 2026-05-16 → **INCLUSO in ADR-357**. Shift+Space cicla highlight tra entità sovrapposte, mini-popover lista accanto al cursore, ESC annulla. Nuovi moduli `SelectionCyclingPopover` + `use-selection-cycling`.
18. ✅ **G14 — Length / Angle Locking durante draw**: RISOLTO 2026-05-16 → **INCLUSO in ADR-357**. Ctrl+L lock length, Ctrl+A lock angle. Campo lockato arancione con 🔒. Nuovo micro-leaf `DynamicInputStore` per stato lock.
19. ✅ **G15 — Lineweight/Linetype/Color Override nel ribbon**: RISOLTO 2026-05-16 → **INCLUSO in ADR-357** come consumer di `LayerStore` (ADR-358). 3 dropdown Quick Style nel ribbon durante line tool attivo. Catalogo ISO mm + DXF linetypes + ACI Color + Truecolor picker. Persistenza localStorage.

### Decisioni di esclusione (proposta accettata)

- **Layer Isolate / Layer Dim**: ➡️ migrato in ADR-358 (Layer Management System).
- **Auto-Dimension on Creation**: 🆕 ADR-360 separato (Dimension System) — fuori scope ADR-357.
- **Mouse Gesture Commands** (right-drag pan, middle-drag pan): ⚠️ **codebase ha già `useCentralizedMouseHandlers`** — audit dedicato in implementation phase, gap-fill se necessario senza nuovo ADR.
- **Sub-Selection (endpoint as separate selectable)**: ❌ SKIP — overlap con G10 Grip Editing (`GripStore` gestisce già hot-grip select).

---

## 10. Changelog

| Date | Change |
|---|---|
| 2026-05-16 | Initial draft (Phase 1 ADR-driven workflow). Open questions sezione 9 da compilare con Giorgio in Q&A greca. |
| 2026-05-16 | Q1 risolta: Polar Tracking = sistema misto Increment+Additional+Custom (AutoCAD-like), default Increment=90°. |
| 2026-05-16 | Q2 risolta: Dynamic Input sempre ON + toggle status bar (no F12). Persistenza localStorage. |
| 2026-05-16 | Q3 risolta: Tab cycling = Lunghezza→Angolo (AutoCAD-style). X/Y via syntax `100,50`. |
| 2026-05-16 | Q4 risolta: Direct Distance Entry sempre attivo (loose mode), nessun warning. |
| 2026-05-16 | Q5 risolta: Coordinate syntax hybrid — simboli `@`/`<` + bottoni `[Abs][Rel][Polar]`. Parser unico. |
| 2026-05-16 | Q6 risolta: Chain exit ESC/Enter/Right-click context menu + U shortcut undo vertex. |
| 2026-05-16 | Q7 risolta: Object Snap Tracking INCLUSO in ADR-357 (Phase 4). 7 punti FIFO, hover 1000ms o Shift+click. |
| 2026-05-16 | Q8 risolta: Colori adaptive theme-aware. Nuovo SSoT `tracking-colors.ts`. |
| 2026-05-16 | Q9 risolta: Unità — internal mm (BIM/ISO/DXF), display default cm, configurabile mm/cm/m/in/ft. |
| 2026-05-16 | Q10 risolta: ADR-357 confermato. CLAUDE.md §7 aggiornato (regola "145 first" obsoleta). |
| 2026-05-16 | **TUTTE le 10 Open Questions risolte.** Status ADR: ✅ ACCEPTED (Decision finalizzata, pronta per implementazione). |
| 2026-05-16 | **Deep-dive enterprise features** (seconda iterazione). 6 nuove gap identificate: G7 Layer/Properties, G8 Snap Overrides, G9 Quick Properties, G10 Grip Editing, G11 Command Aliases, G12 Construction Lines. Status revertito a 🟡 IN REVISIONE. |
| 2026-05-16 | Q11 risolta: G7 Layer System estratto in ADR-358 separato (prerequisito). Codebase ha già Layer Manager parziale — audit dedicato in ADR-358 Phase 0. |
| 2026-05-16 | Q12 risolta: G8 Snap Overrides FULL enterprise — From + M2P + Apparent Intersection + single-use di tutti i 17 engine. Nuovo SnapOverrideOrchestrator. |
| 2026-05-16 | Q13 risolta: G9 Quick Properties FULL — 3 livelli (Hover Tooltip + Mini-Panel double-click + Full Palette F11). SSoT entity-property-schema condiviso. |
| 2026-05-16 | Q14 risolta: G10 Grip Editing FULL — Stretch/Move/Lengthen/Rotate/Scale/Mirror + hover popup + Enter cycle. Nuovo GripStore + GripTransformRegistry (riusabile cross-entity). |
| 2026-05-16 | Q15 risolta: G11 Command Aliases FULL — registry 150 alias ACAD + input UI + autocomplete + history + user customization. |
| 2026-05-16 | Q16 risolta: G12 Construction Lines estratte in ADR-359 separato (XLINE + RAY + sub-modes H/V/A/B/O). Nessuna dipendenza, ADR-357 ship-ready senza. |
| 2026-05-16 | **Seconda iterazione Q&A completata (Q11-Q16).** ADR-357 finalizzato per LINE tool. ADR-358 (Layer System) e ADR-359 (Auxiliary Lines) da scrivere come ADR separati. |
| 2026-05-16 | **Terza iterazione — Extras enterprise.** Q17/G13 Selection Cycling, Q18/G14 Length/Angle Lock, Q19/G15 Style Override INCLUSI. Layer Isolate → ADR-358. Auto-Dimension → ADR-360. Mouse gestures → audit. Sub-selection skip (overlap G10). |
| 2026-05-16 | **Tutte le Q risolte (Q1-Q19). ADR-357 FINALIZZATO.** Status: ✅ ACCEPTED. Implementation roadmap aggiornato (15+3=18 phases incrementali). Prerequisiti: ADR-358. Follow-up: ADR-359, ADR-360. |
| 2026-05-16 | Aggiunta §7.1 "Una phase = una sessione" (non-negoziabile). Suddivisione obbligatoria se la phase risulta troppo grande. Ordine vincolante: ADR-358 → ADR-359 → implementation. |
| 2026-05-17 | **Phase 0 IMPLEMENTED.** `getCurrentLayerId()` promosso a Level 3 nel fallback di `CreateEntityCommand.execute()` (era Level 4, dopo `getLayerByName('0')`). `getLayerByName('0')` diventa Level 4 (fallback assoluto). Risultato: ogni nuova entity (LINE, ecc.) eredita il layer attivo dell'utente, non sempre Layer-0. Files: `CreateEntityCommand.ts`, `create-entity-options.ts`, `CreateEntityCommand.replay-safety.test.ts` (7/7 ✅). |
| 2026-05-18 | **Phase 1 IMPLEMENTED.** Polar Tracking wire-up + UI status bar. Nuovi SSoT: `systems/constraints/polar-utils.ts` (applyPolar pure fn, increment∪additional logic) + `systems/constraints/polar-tracking-store.ts` (singleton localStorage, keys dxf:polar.increment/additional). Wire in `hooks/drawing/useDrawingHandlers.ts`: `polarOnRef` + applyPolar in onDrawingPoint + onDrawingHover. Visual feedback: `drawPolarTrackingLine()` method in `PreviewRenderer.ts` + `PreviewCanvas.tsx` handle (dashed green alignment path + angle/distance tooltip). UI: `PolarToggleWithPopover` component in `CadStatusBar.tsx` — angle increment dropdown (5°/10°/15°/18°/22.5°/30°/45°/90°, default 90°) + additional angles CRUD. i18n: 5 nuove chiavi el+en in dxf-viewer-panels. Tests: 13/13 ✅ (polar-utils.test.ts). Default incrementAngle=90° per ADR-357 §5.1. Mutual exclusion ortho/polar garantita da useCadToggles. |
| 2026-05-18 | **Phase 2b IMPLEMENTED** — Units display layer (mm internal ↔ configurable display). Nuovo SSoT puro `config/units.ts`: `DisplayUnit = SceneUnits` (type alias, zero duplication), `toDisplay(mm, unit)`, `fromDisplay(value, unit)`, `formatDisplayValue(mm, unit, precision?)`. `DEFAULT_DISPLAY_PRECISION` per-unit (mm=0, cm=2, m/in/ft=3). Nuovo hook `hooks/common/useDisplayUnit.ts`: localStorage `dxf:displayUnit`, default `cm`, idempotent `setDisplayUnit`. **Wire-up**: `useDynamicInputRealtime` sostituisce tutti i `.toFixed(3)` su x/y/length/radius con `formatDisplayValue(value, displayUnit)` — angolo rimane `toFixed(3)` (sempre gradi, no conversione). `line-keyboard-handler` converte `lengthDisplay` → `lengthMm = fromDisplay(lengthDisplay, context.displayUnit)` prima del calcolo `worldPoint` — garantisce round-trip corretto. `DynamicInputOverlay` acquisisce `displayUnit` da `useDisplayUnit()` e propaga a `useDynamicInputRealtime` + `useDynamicInputKeyboard`. **UI**: `CadStatusBar` aggiunge `DisplayUnitSelector` (Radix `Select`, dropdown `[cm ▼]`, opzioni mm/cm/m/in/ft). **Boy Scout Fix**: `useDynamicInputKeyboard` completava `contextRef.current` / `actionsRef.current` / `refsRef.current` senza i campi stair (ADR-358 gap): aggiunti `riseValue, treadValue, widthValue, activeStairField` a context + `setRiseValue, setTreadValue, setWidthValue, setActiveStairField` ad actions + `riseInputRef, treadInputRef, widthInputRef` a refs. i18n: 2 nuove chiavi el+en `cadDock.statusBar.displayUnit/displayUnitDesc` in `dxf-viewer-panels`. Files: `config/units.ts` (NEW), `hooks/common/useDisplayUnit.ts` (NEW), `keyboard-handlers/types.ts`, `hooks/useDynamicInputRealtime.ts`, `hooks/useDynamicInputKeyboard.ts`, `keyboard-handlers/line-keyboard-handler.ts`, `components/DynamicInputOverlay.tsx`, `statusbar/CadStatusBar.tsx`, `i18n/locales/el/dxf-viewer-panels.json`, `i18n/locales/en/dxf-viewer-panels.json`. |
| 2026-05-18 | **Phase 3 IMPLEMENTED** — Direct Distance Entry. Guard: `activeTool === 'line'` + `drawingTempPoints.length >= 1` + `!CanvasNumericInputStore.isActive()`. Digit buffer (`ddeBufferRef`) accumulates via `useRef('')` — reset on tool change + ESC + successful apply. On `Enter`: `rawDistance = parseFloat(buffer)` → `fromDisplay(rawDistance, localStorage['dxf:displayUnit'] ?? 'cm')` → `distMm` → `dir = normalize(cursor - lastRef)` via `getImmediateWorldPosition()` → `onDirectDistanceEntry(lastRef + dir*distMm)`. Dot-duplicate guard (only one `.` in buffer). Cursor direction from `ImmediatePositionStore.getWorldPosition()` (singleton, zero-React overhead). Works with polar/ortho ON (applied upstream by `onDrawingPoint` pipeline). Files: `hooks/canvas/useCanvasKeyboardShortcuts.ts` (DDE params + buffer logic), `components/dxf-layout/CanvasSection.tsx` (wire `drawingTempPoints` + `onDirectDistanceEntry`). |
| 2026-05-18 | **Phase 2a IMPLEMENTED** (split del Phase 2 originale — Phase 2b coprirà units display in sessione separata, vedi §7.1). Dynamic Input overlay mount + live readout + Tab 2-cycle + `completeEntity` pipeline restore. **Recognition**: `DynamicInputOverlay` non era mounted in production (orphan code); `useDrawingOrchestrator` non usato; `useDynamicInputHandler` (event listener) mai vivo; `line-keyboard-handler` creava `LineEntity` direttamente via `useDynamicInputHandler` bypassando `completeEntity()`/CommandHistory/styling/persistence (= regressione architetturale §4 G2). **Fix**: (a) `DynamicInputSubscriber.tsx` nuovo micro-leaf in `components/dxf-layout/`, monta `<DynamicInputSystem>` quando `useCadToggles().dynInput.on === true` AND `isInteractiveTool(activeTool)` — pattern ADR-040 (isola re-render cursor a sola foglia). (b) `DynamicInputOverlay.tsx` migrato da `settings.behavior.dynamic_input` (legacy cursor flag) a `useCadToggles().dynInput.on` (SSoT status-bar Firestore-backed). (c) `useCadToggles` default `dynInput: true` (ADR §5.1 "sempre ON di default"). (d) `useDynamicInputRealtime` esteso con live `angleDeg = atan2(dy, dx)` normalizzato 0..360 (AutoCAD convention). (e) `line-keyboard-handler.ts` riscritto: Tab 2-cycle `Length → Angle → Length` (X/Y rimossi, Phase 6 syntax), Enter dispatches `{action:'add-point', coordinates}` calcolato come `firstClickPoint + (length·cos(angle), length·sin(angle))` — NIENTE entity-create diretto. (f) `useDynamicInputHandler` ripulito: rami `create-line-second-point` (line direct-create) eliminati, line routa solo via `onDrawingPoint`. (g) `useDrawingHandlers.onDrawingPoint` emette `canvas-click` window event dopo `addPoint()` non completion — riabilita `useDynamicInputPhase.stableHandleCanvasClick` (mai dispatched prima) che setta `firstClickPoint`. Files: `hooks/common/useCadToggles.ts`, `systems/dynamic-input/components/DynamicInputOverlay.tsx`, `systems/dynamic-input/hooks/useDynamicInputRealtime.ts`, `systems/dynamic-input/keyboard-handlers/line-keyboard-handler.ts`, `systems/dynamic-input/hooks/useDynamicInputHandler.ts`, `hooks/drawing/useDrawingHandlers.ts`, `components/dxf-layout/DynamicInputSubscriber.tsx` (nuovo), `components/dxf-layout/CanvasLayerStack.tsx`. **Nota su §5.1**: ADR diceva `localStorage dxf:dynamicInput.enabled` — il code-source-of-truth è `useCadToggles` (Firestore-backed via `dxfViewer.cadToggles.dynInput`). §5.1 va aggiornato in Phase 2b con la nota di persistenza Firestore-first + localStorage fallback inferito da `userSettingsRepository`. |

---

## 11. References

- AutoCAD Dynamic Input: https://cadmastercoach.com/commands/drafting-aids/dynamic-input
- AutoCAD Object Snap Tracking: https://cadmastercoach.com/commands/drafting-aids/object-snap-tracking
- BricsCAD Polar Tracking: https://help.bricsys.com/en-us/document/bricscad/drawing-accurately/polar-tracking
- AutoCAD LINE command: https://cadmastercoach.com/commands/create/line/basics
- Direct Distance Entry: https://www.mycadsite.com/tutorials/level_1/direct-distance-entry-in-AutoCAD-tutorial-1-9.html
- AutoCAD Layers / Lineweights: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Set-default-lineweight-for-layers.html
- Object Snap modes (Deferred/Parallel/Perpendicular): https://www.cadtutor.net/tutorials/autocad/object-snap.php
- BricsCAD XLINE / RAY: https://help.bricsys.com/en-us/document/bricscad/2d-drafting/drawing-infinite-lines
- AutoCAD Selection Cycling: https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-cycle-through-overlapping-objects-for-selection-in-AutoCAD.html
- AutoCAD Quick Properties: https://sourcecad.com/quick-properties-in-autocad/
- AutoCAD Grip Editing: https://www.nobledesktop.com/learn/autocad/modifying-with-grips-part-1
- AutoCAD Command Aliases: https://xlncad.com/autocad-command-alias/
- ArchiCAD Magic Wand / Reference Line: https://help.graphisoft.com/AC/20/INT/AC20Help/02_Interaction/02_Interaction-108.htm
- **ADR-358 (Layer Management System)**: `docs/centralized-systems/reference/adrs/ADR-358-layer-management-system.md` — prerequisito implementativo (LayerStore + resolveEntityStyle).
- **ADR-359 (Auxiliary Geometry Tools: XLINE + RAY)**: `docs/centralized-systems/reference/adrs/ADR-359-auxiliary-geometry-tools.md` — ACCEPTED 2026-05-16, Q1-Q15 risolte. Estrazione di G16 (Construction Lines). Consumer puro di ADR-358.
