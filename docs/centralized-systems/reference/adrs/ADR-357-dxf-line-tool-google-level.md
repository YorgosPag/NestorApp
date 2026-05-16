# ADR-357 — DXF Line Tool: Allineamento Google-Level a CAD Professionali

**Status**: 🟡 PROPOSED (in raffinamento Q&A con Giorgio)
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

### 5.2 Nuovi SSoT da creare (massimo 2)
1. **`TrackingPointStore`** (singleton, micro-leaf) — punto acquisiti per Object Snap Tracking.
2. **`coordinate-parser`** (modulo puro) — parsing `@`/`<`/cartesian/polar.

Tutti gli altri building block sono **riusati** dai SSoT esistenti.

### 5.3 Nuovi flag `TOOL_DEFINITIONS`
- `allowsChain: boolean` (default false; `line`=true).
- `supportsDynamicInput: boolean` (default false; `line`=true).

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

## 7. Implementation Phases

Ogni phase = 1 commit autonomo (passa CI, no breaking).

| Phase | Titolo | Files affetti | Effort |
|---|---|---|---|
| **1** | Polar Tracking wire-up + UI | 4 | S |
| **2** | Dynamic Input live readout + Tab cycle + refactor handler | 4 | M |
| **3** | Direct Distance Entry | 2 | S |
| **4** | Object Snap Tracking (TrackingPointStore + resolver + leaf render) | 5 | L |
| **5** | Chain mode reale | 3 | S |
| **6** | Coordinate parser (abs/rel/polar) | 2 | M |

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
8. ⏳ **Color scheme alignment paths**: verde AutoCAD o palette design system Nestor?
9. ⏳ **Unità di misura default**: cm (Grecia architetturale) o mm (ISO)?
10. ⏳ **Conferma ADR-357 numbering**: ok o preferisci altro?

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

---

## 11. References

- AutoCAD Dynamic Input: https://cadmastercoach.com/commands/drafting-aids/dynamic-input
- AutoCAD Object Snap Tracking: https://cadmastercoach.com/commands/drafting-aids/object-snap-tracking
- BricsCAD Polar Tracking: https://help.bricsys.com/en-us/document/bricscad/drawing-accurately/polar-tracking
- AutoCAD LINE command: https://cadmastercoach.com/commands/create/line/basics
- Direct Distance Entry: https://www.mycadsite.com/tutorials/level_1/direct-distance-entry-in-AutoCAD-tutorial-1-9.html
