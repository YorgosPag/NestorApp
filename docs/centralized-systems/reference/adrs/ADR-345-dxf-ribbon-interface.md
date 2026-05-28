# ADR-345: DXF Viewer — Ribbon Interface (AutoCAD-style)

**Status**: ACTIVE
**Date**: 2026-05-11
**Author**: Claude Sonnet 4.6 + Georgios Pagonis
**Supersedes**: Floating panel toolbar (gradual migration)
**Related**: ADR-040, ADR-048, ADR-183, ADR-344

---

## 1. Context

Il DXF Viewer subapp usa attualmente un **floating panel** per esporre i tool di disegno e modifica. Con la crescita dell'applicazione (text engine, grip system, snap system, layer system) il numero di tool aumenta costantemente e il floating panel diventa un collo di bottiglia di UX: occupa spazio canvas, ha profondità limitata, non scala a decine di comandi.

**Soluzione**: adottare la **Ribbon Interface** come standard de-facto del settore CAD (AutoCAD, Revit, Civil 3D, MicroStation, BricsCAD, LibreCAD 2.x) — una barra orizzontale persistente con tab, panel e button types diversificati.

---

## 2. Ricerca — AutoCAD Ribbon Architecture

*(Research condotta 2026-05-11 da fonti ufficiali Autodesk + community CAD)*

### 2.1 Gerarchia schermo dall'alto al basso

```
┌───────────────────────────────────────────────────────────────────┐
│  TITLE BAR  [App Button]  [QAT buttons...]    [Title]  [─][□][×]  │
├───────────────────────────────────────────────────────────────────┤
│  TAB BAR:  Home | Insert | Annotate | Parametric | View | ...     │
├───────────────────────────────────────────────────────────────────┤
│  RIBBON PANELS  (~90-100px height)                                │
│  [Draw panel] | [Modify panel] | [Annotation] | [Layers] | ...    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│                     DRAWING CANVAS                                │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  COMMAND LINE  (1-3 righe, collapsibile)                          │
├───────────────────────────────────────────────────────────────────┤
│  STATUS BAR  [coords] [Grid][Snap][Ortho][Polar][Osnap]...        │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Quick Access Toolbar (QAT) — pulsanti default

Ordine da sinistra a destra:

| # | Pulsante | Comando |
|---|----------|---------|
| 1 | New | Nuovo file |
| 2 | Open | Apri file |
| 3 | Save | Salva |
| 4 | Save As | Salva con nome |
| 5 | Undo | Annulla (con dropdown storia) |
| 6 | Redo | Ripeti (con dropdown storia) |
| 7 | ▼ Customize | Personalizza QAT |

### 2.3 Tab bar — lista completa tab default AutoCAD 2024

| # | Tab | Scopo |
|---|-----|-------|
| 1 | **Home** | Disegno, modifica, annotazioni base, layer, blocchi |
| 2 | **Insert** | Blocchi, xref, immagini, PDF underlay |
| 3 | **Annotate** | Testo, quote, tabelle, multileader |
| 4 | **Parametric** | Vincoli geometrici e dimensionali |
| 5 | **View** | Viste, viewport, UCS, visual style |
| 6 | **Manage** | CUI editor, Action Recorder, CAD Standards |
| 7 | **Output** | Plot, export PDF/DWF |
| 8 | **Add-ins** | Plugin terze parti |
| 9 | **Collaborate** | Cloud sharing, DWG Compare |
| — | *[Tab contestuali]* | Appaiono su selezione oggetti specifici |

---

## 3. Struttura dettagliata — Tab HOME

Panel in ordine da sinistra a destra — **tutti 9 confermati (2026-05-11)**:

```
[Draw] | [Modify] | [Annotation] | [Layers] | [Properties] | [Block] | [Groups] | [Utilities] | [Clipboard]
```

Nota: Block, Groups, Utilities, Clipboard non esistono ancora nel DXF viewer — saranno **nuova funzionalità** implementata insieme al ribbon (non migrazione dal floating panel).

### 3.1 Panel DRAW

| Tipo | Tool | Varianti split |
|------|------|----------------|
| Large ▾ | **Line** (L) | Line / Perpendicular Line / Parallel Line |
| Large | **Polyline** (PL) | — |
| Large ▾ | **Circle** | Center+Radius / Center+Diameter / 2-Point / 3-Point / Tan-Tan-Radius / Tan-Tan-Tan |
| Large ▾ | **Arc** | 3-Point / Start+Center+End / Start+Center+Angle / Start+Center+Length / Start+End+Angle / Start+End+Direction / Start+End+Radius / Center+Start+End / Center+Start+Angle / Center+Start+Length / Continue |
| Large | **Rectangle** (REC) | — |
| Small | **Polygon** | — |
| Small ▾ | **Ellipse** | Center / Axis+End / Elliptical Arc |
| *[expanded]* | **Spline** ▾ | Fit Points / Control Vertices |
| *[expanded]* | **Hatch** ▾ | Hatch / Gradient / Boundary |
| *[expanded]* | **Revision Cloud** ▾ | Rectangular / Polygonal / Freehand / Object |
| *[expanded]* | **Draw Order** ▾ | Bring to Front / Send to Back / Above / Under |
| *[expanded]* | **Region** | — |
| *[expanded]* | **Wipeout** | — |
| *[expanded]* | **Construction Line** | XLINE (linea infinita) |
| *[expanded]* | **Ray** | RAY (semi-infinita) |
| *[expanded]* | **Donut** | — |

### 3.2 Panel MODIFY

| Tipo | Tool | Note |
|------|------|------|
| Large | **Move** (M) | — |
| Large | **Copy** (CO) | — |
| Large | **Rotate** (RO) | — |
| Large | **Mirror** (MI) | — |
| Large | **Scale** (SC) | — |
| Large | **Stretch** (S) | — |
| Small ▾ | **Trim** (TR) | toggle Shift = Extend |
| Small ▾ | **Extend** (EX) | toggle Shift = Trim |
| Small | **Offset** (O) | — |
| Small ▾ | **Fillet** (F) | Fillet / Chamfer |
| Small ▾ | **Array** (AR) | Rectangular / Path / Polar |
| Small | **Explode** (X) | — |
| *[expanded]* | **Break** ▾ | Break / Break at Point |
| *[expanded]* | **Join** | — |
| *[expanded]* | **Lengthen** | — |
| *[expanded]* | **Edit Polyline** | PEDIT |
| *[expanded]* | **Align** | — |
| *[expanded]* | **Overkill** | Rimuove duplicati/sovrapposizioni |
| *DXF-specific* | **Περικοπή Περιοχής** (crop-window) | Taglia geometricamente le entità al bordo del rettangolo di selezione. Implementato via `ClipToRegionService` (Liang-Barsky / Sutherland-Hodgman / campionamento parametrico 72 step). EventBus `crop:marquee-rect`. |

### 3.3 Panel ANNOTATION

| Tipo | Tool | Varianti |
|------|------|----------|
| Large ▾ | **Text** | Multiline Text / Single Line Text |
| Large ▾ | **Dimension** | Linear / Aligned / Angular / Arc Length / Radius / Diameter / Jogged / Ordinate / Baseline / Continue |
| Small | **Linear** | — |
| Small | **Aligned** | — |
| Small | **Angular** | — |
| Small | **Radius** | — |
| Small | **Diameter** | — |
| Small ▾ | **Leader** | Multileader / Quick Leader |
| Small | **Table** | — |
| Dropdown | **Annotation Scale** | Lista scale annotative |

### 3.4 Panel LAYERS

| Tool | Descrizione |
|------|-------------|
| **Layer Properties** (large) | Apre Layer Properties Manager |
| **Layer dropdown** (combobox largo) | Cambia layer corrente |
| **Make Current** | Clicca oggetto → suo layer diventa corrente |
| **Match Layer** | Copia layer da oggetto ad altri |
| Small: Turn Off / Isolate / Freeze / Lock | Toggle singolo layer |
| **Layer States** | Salva/ripristina configurazioni layer |
| **Previous Layer** | Torna al layer precedente |

### 3.5 Panel BLOCK

| Tool | Comando |
|------|---------|
| **Insert** ▾ (large) | INSERT — gallery blocchi recenti |
| **Create** (large) | BLOCK |
| **Edit** | BEDIT — Block Editor |
| **Define Attributes** | ATTDEF |

### 3.6 Panel PROPERTIES

| Tool | Descrizione |
|------|-------------|
| **Match Properties** (large) | Copia proprietà tra oggetti |
| **Properties palette** | Apre palette Properties |
| Dropdown: **Color** | Cambia colore oggetto |
| Dropdown: **Linetype** | Cambia linetype |
| Dropdown: **Lineweight** | Cambia spessore linea |

### 3.7 Panel GROUPS

| Tool | Comando |
|------|---------|
| **Group** (large) | GROUP |
| **Ungroup** | UNGROUP |
| **Group Edit** | GROUPEDIT |

### 3.8 Panel UTILITIES

| Tool | Varianti |
|------|----------|
| **Measure** ▾ | Distance / Radius / Angle / Area / Volume / Quick |
| **Quick Select** | QSELECT |
| **ID Point** | Coordinate punto |
| **List** | Info oggetto |

### 3.9 Panel CLIPBOARD

| Tool | Varianti |
|------|----------|
| **Paste** ▾ (large) | Paste / Paste as Block / Paste to Coords / Paste Special |
| **Copy** | COPYCLIP |
| **Cut** | CUTCLIP |
| **Copy with Base Point** | COPYBASE |

---

## 4. Tipi di pulsante — specifiche

### 4.1 Large Button

```
┌──────────────┐
│              │
│   [ICON]     │  ← icona 32×32px
│              │
│   Label      │  ← testo ~11px sotto icona
└──────────────┘
Dimensioni totali: ~40×56px
```

Usato per: tool primari del panel (Line, Move, Text, Insert).

### 4.2 Small Button

```
[🔲 Label      ]   ← icona 16×16 + testo inline
[🔲 Label      ]
[🔲 Label      ]   ← 2-3 righe impilate verticalmente
```

Altezza riga: ~20px. Usato per tool secondari e varianti.

### 4.3 Split Button

```
Large variant:
┌──────────────┐
│   [ICON]     │  ← click → esegue ultimo comando usato
├──────────────┤  ← linea divisoria
│      ▾       │  ← click → apre dropdown varianti
└──────────────┘

Small variant:
[🔲 Label    ▾]   ← freccia inline a destra
```

**Comportamento critico**: quando si sceglie una variante dal dropdown, quella variante **sale in cima** come nuovo default. Click successivi al top half eseguono questa variante senza riaprire il dropdown.

### 4.4 Toggle Button

```
[🔲 Grid]   stato OFF
[█  Grid]   stato ON (sfondo highlighted)
```

### 4.5 Dropdown Combobox

Larghezza variabile (es. Layer ~200px, Scale ~80px). Per: Layer selector, Text Style, Dimension Style, Annotation Scale.

---

## 5. Comportamento interattivo

### 5.1 Tab click + drag & drop reorder — DECISIONE CONFERMATA (2026-05-11)
- Click su tab → mostra panel di quel tab
- Tab attivo: underline o sfondo leggermente diverso
- **Drag & drop tab reorder**: l'utente può trascinare le tab per cambiare l'ordine
- Ordine salvato in localStorage: `dxf-ribbon:tabOrder → string[]` (array di tab id)
- Al mount: legge ordine da localStorage → fallback ordine default `['home','insert','layers','view','annotate','settings']`

### 5.2 Panel Flyout (espansione)
- Ogni panel ha una **label bar** in fondo (16px, testo nome panel + chevron ▾)
- Click sul label/chevron → slide-down del flyout con tool aggiuntivi
- Il flyout resta aperto fino a click altrove
- Icona 📌 **pin** nel flyout → lo mantiene sempre aperto

### 5.3 Ribbon minimize — 4 stati ciclici

Doppio-click su tab o click pulsante ▲ a destra:

| Stato | Altezza | Descrizione |
|-------|---------|-------------|
| **Full** | ~100px | Panel completi |
| **Panel buttons** | ~46px | Solo icone panel senza label |
| **Panel titles** | ~30px | Solo nomi panel |
| **Tab names only** | ~26px | Solo tab bar |

In qualsiasi stato minimizzato: click su tab → mostra temporaneamente i panel → scompaiono dopo click sul canvas.

### 5.4 Tab contestuali

Appaiono automaticamente (con colore accent diverso) quando:
- Selezione Hatch → **Hatch Editor** tab
- Entrata in MTEXT → **Text Editor** tab
- Comando ARRAY → **Array Creation** tab
- Selezione immagine/xref → **Image/Reference** tab

Scompaiono automaticamente su deselect o ESC.

### 5.5 Right-click ribbon — IMPLEMENTATO IN V1 (DECISIONE CONFERMATA 2026-05-11)
- Minimize the Ribbon (toggle)
- Show Tabs → checklist tab visibili
- Show Panels → checklist panel tab corrente
- Undock → ribbon floating/draggable

---

## 6. Visual Design

### 6.1 Dimensioni fondamentali

| Componente | Valore |
|------------|--------|
| Altezza ribbon totale | 90-100px |
| Tab bar height | 26px |
| Panel body height | 64-74px |
| Panel label bar | 16px |
| Icona Large | 32×32px |
| Icona Small | 16×16px |
| Large button totale | ~40×56px |
| Small button row | ~20px altezza |
| Panel separator | 1px verticale |

### 6.2 Color scheme — Theme-aware (DECISIONE CONFERMATA 2026-05-11)

Il ribbon segue il theme dell'applicazione. NON hardcoded — usa CSS variables del design system esistente.

| Token CSS | Dark value | Light value |
|-----------|-----------|-------------|
| `--ribbon-bg` | `hsl(var(--showcase-bg))` (`#1D283A` navy) | `#F0F0F0` |
| `--ribbon-tab-bar-bg` | `#141A24` | `#E0E0E0` |
| `--ribbon-tab-active` | `hsl(var(--showcase-bg))` (`#1D283A` navy) | `#FFFFFF` |
| `--ribbon-panel-label` | `#363636` | `#D8D8D8` |
| `--ribbon-separator` | `#404040` | `#C0C0C0` |
| `--ribbon-btn-hover` | `#4A4A4A` | `#D0D0D0` |
| `--ribbon-btn-active` | `#1464A0` | `#1464A0` |
| `--ribbon-text` | `#CCCCCC` | `#1A1A1A` |
| `--ribbon-tab-text-active` | `#FFFFFF` | `#000000` |

Implementazione: `data-theme="dark"` / `data-theme="light"` sul root → CSS variables cambiano automaticamente.

### 6.3 Layout panel (struttura visiva)

```
┌─────────────────────────────────────┐
│  [btn] [btn] [btn]   [sm] [sm]      │  ← large buttons + colonne small
│                      [sm] [sm]      │
│                      [sm] [sm]      │
├─────────────────────────────────────┤
│  Draw                            ▾  │  ← label 16px
└─────────────────────────────────────┘
```

---

## 7. Status Bar (bottom) — DECISIONE CONFERMATA (2026-05-11)

Tutti gli elementi implementati. Da sinistra a destra:

| Elemento | Default | Shortcut |
|----------|---------|----------|
| **Coordinates (X, Y)** | ON | — |
| **Grid Display** | OFF | F7 |
| **Snap Mode** | OFF | F9 |
| **Ortho Mode** | OFF | F8 |
| **Polar Tracking** | ON | F10 |
| **Annotation Scale** | 1:1 | — |
| **Layer name (current)** | ON | — |

---

## 8. Decision — Adozione Ribbon per DXF Viewer

### 8.0 Posizione nel layout — DECISIONE CONFERMATA (2026-05-11)

```
ADESSO:
┌──────────────────────────────────────────────────────┐
│              GLOBAL HEADER                            │
├────────────┬─────────────────────────────────────────┤
│            │   [DXF TOOLBAR]                         │
│  FLOATING  ├─────────────────────────────────────────┤
│   PANEL    │   CANVAS + RULERS + GRID                │
└────────────┴─────────────────────────────────────────┘

TRANSITORIO (ribbon inserito tra header e toolbar):
┌──────────────────────────────────────────────────────┐
│              GLOBAL HEADER                            │
├──────────────────────────────────────────────────────┤
│              RIBBON (full width)  ← NUOVO            │
├────────────┬─────────────────────────────────────────┤
│  FLOATING  │   [DXF TOOLBAR — ancora presente]       │
│   PANEL    ├─────────────────────────────────────────┤
│  (ancora)  │   CANVAS + RULERS + GRID                │
└────────────┴─────────────────────────────────────────┘

FINALE (floating panel + DXF toolbar rimossi):
┌──────────────────────────────────────────────────────┐
│              GLOBAL HEADER                            │
├──────────────────────────────────────────────────────┤
│              RIBBON (full width)                      │
├──────────────────────────────────────────────────────┤
│              CANVAS + RULERS + GRID (full width)      │
└──────────────────────────────────────────────────────┘
```

**Regola**: Il ribbon si inserisce come riga full-width tra il global header e il resto del DXF viewer layout. Coesiste con floating panel + DXF toolbar durante la migrazione graduale per tab/fase.

### 8.1 Cosa adottiamo

1. **Ribbon orizzontale** sopra il canvas, sotto l'app header globale — inserito tra header e DXF toolbar esistente
2. **Tab bar** — ordine e nomi confermati: `Home | Insert | Layers | View | Annotate | Settings` — label via i18n (el default, en se cambia lingua). Pattern identico al resto dell'app (N.11).
3. **Panel structure** per ogni tab con large + small + split buttons
4. **Layers: tab dedicato** (non panel dentro Home) — contenuto troppo ricco per un panel. Home ha solo un mini-panel con layer dropdown + 2-3 quick actions. Revit pattern.
5. **Flyout** per tool secondari (panel espanso al click del label)
6. **Contextual tabs** per selezione entità (es. Text Editor)
7. **4 stati minimize** via doppio-click
8. **Deprecazione graduale** del floating panel mentre il ribbon copre gli stessi tool

### 8.1b Icone — DECISIONE CONFERMATA (2026-05-11)

SVG personalizzate CAD-specific, selezionate da queste librerie open-source:

| Libreria | Licenza | URL |
|----------|---------|-----|
| Tabler Icons | MIT ✅ | https://tabler.io/icons |
| Iconoir | MIT ✅ | https://iconoir.com/ |
| Iconbuddy (aggregatore) | varia — verificare per icona | https://iconbuddy.com/ |

**Regola**: per ogni tool ribbon, si sceglie l'icona più CAD-like tra le tre fonti. Le icone vengono copiate come file SVG nell'asset folder del DXF viewer subapp — nessun npm package di icone da installare (evita bundle bloat). NON usare Lucide (già presente nel project) per il ribbon: look troppo generico, non CAD.

**Check N.5 pre-installazione**: se si sceglie un'icona da Iconbuddy, verificare licenza originale prima di usarla.

### 8.1c Persistenza stato ribbon — DECISIONE CONFERMATA (2026-05-11)

**localStorage** — industry standard (AutoCAD, Revit, MS Office, BricsCAD tutti ricordano).

Chiavi salvate:
```
dxf-ribbon:activeTabId        → es. "home"
dxf-ribbon:minimizeState      → "full" | "panel-buttons" | "panel-titles" | "tab-names"
dxf-ribbon:pinnedPanelIds     → string[] (flyout pinned)
dxf-ribbon:splitLastUsed      → Record<commandId, variantId>
dxf-ribbon:tabOrder           → string[] (es. ['home','layers','view','annotate','settings'])
```

Al mount: legge da localStorage → fallback su default (`activeTabId: "home"`, `minimizeState: "full"`).

### 8.2 Cosa NON adottiamo (v1)

- Application Menu (bottone A) — sostituito dal menu header esistente
- QAT standalone — funzionalità già nella app header
- CUI editor — ribbon non customizzabile da utente in v1
- Command line persistente — già gestito via tooltip/status bar

### 8.1d Contenuto floating panel attuale — RICERCA 2026-05-11

Il floating panel ha **3 tab** (non 2):

| Tab | File | Contenuto principale |
|-----|------|----------------------|
| **Levels** | `LevelPanel.tsx` | Livelli/layer: visibilità, colori, rename, delete, merge, import floorplan, grip settings |
| **DXF Settings** | `DxfSettingsPanel.tsx` | General (Lines/Text/Grips) + Specific 8 categorie (Selection, Cursor, Grid+Rulers, Layers, Entities, Grips⚠️, Lighting⚠️, Background) |
| **Text Properties** | `TextPropertiesPanel.tsx` | Editor testo ADR-344: font, bold/italic/underline, paragraph, layer selector, annotation scales, insert symbols |

⚠️ = "Coming Soon" — disabilitato.

**Strategia migrazione verso ribbon:**
- **Levels tab** → ribbon tab `Layers` (Fase 2) ✅ MIGRATA 2026-05-12 — tab `levels` disabilitata in sidebar
- **DXF Settings** → ribbon tab `Settings` (Fase 5+) — complesso, richiede redesign UX
- **Text Properties** → ribbon tab contestuale `Text Editor` (Fase 5) — già è un pannello contestuale

**Stato attuale floating panel sidebar (post-Fase 2):**
- ❌ `levels` — DISABLED (LevelPanel ora nel ribbon)
- ✅ `colors` — DxfSettingsPanel (attiva, da migrare in Fase 6)
- ✅ `text-properties` — TextPropertiesPanel (attiva, da migrare in Fase 5)

### 8.3 Motivazione

| Criterio | Floating panel | Ribbon |
|----------|---------------|--------|
| Scalabilità tool | ❌ Limitata | ✅ Illimitata (tab + expand) |
| Spazio canvas | ❌ Occupa area | ✅ Fisso sopra |
| Discoverability | ❌ Nascosto | ✅ Sempre visibile + label |
| Industry standard | ⚠️ Non CAD-standard | ✅ AutoCAD/Revit/BricsCAD |
| Context sensitivity | ❌ Statico | ✅ Tab contestuali |
| Mobile/tablet | ⚠️ Difficile | ✅ Minimizzabile |

---

## 9. Data Model — TypeScript

```typescript
type ButtonSize = 'large' | 'small';
type ButtonType = 'simple' | 'split' | 'toggle' | 'dropdown' | 'combobox';

interface RibbonCommand {
  id: string;
  label: string;           // i18n key
  icon: string;            // SVG component name o path
  iconSmall?: string;      // versione 16×16 (se diversa)
  commandKey: string;      // es. 'LINE', 'CIRCLE', 'MOVE'
  shortcut?: string;       // es. 'L', 'C', 'M'
  tooltip?: string;        // i18n key
}

interface RibbonButton {
  type: ButtonType;
  size: ButtonSize;
  command: RibbonCommand;
  variants?: RibbonCommand[];   // per split button
  lastVariantId?: string;       // persistente su localStorage
  isActive?: boolean;           // per toggle
}

interface RibbonRow {
  buttons: RibbonButton[];
  isInFlyout: boolean;          // true → solo nel pannello espanso
}

interface RibbonPanel {
  id: string;
  label: string;                // i18n key
  rows: RibbonRow[];
  isPinned?: boolean;           // flyout pinned open
}

interface RibbonTab {
  id: string;
  label: string;                // i18n key
  panels: RibbonPanel[];
  isContextual?: boolean;
  contextualColor?: string;     // accent per tab contestuali
  contextualTrigger?: string;   // es. 'hatch-selected'
}

type RibbonMinimizeState = 'full' | 'panel-buttons' | 'panel-titles' | 'tab-names';

interface RibbonState {
  activeTabId: string;
  minimizeState: RibbonMinimizeState;
  expandedPanelId: string | null;
  tabs: RibbonTab[];
}
```

---

## 10. Componenti React

```
<DxfRibbon>
  <RibbonTabBar>
    <RibbonTabItem />  × N tabs
    <RibbonTabItem isContextual />  × M contextual tabs
    <RibbonMinimizeButton />
  </RibbonTabBar>
  <RibbonBody minimizeState={...}>
    <RibbonPanel>  × K panels
      <PanelBody>
        <PanelRow>  × J rows (non-flyout)
          <RibbonLargeButton />
          <RibbonSmallButton />
          <RibbonSplitButton />
          <RibbonToggleButton />     {/* Fase 5.5 */}
          <RibbonCombobox />          {/* Fase 5.5 */}
        </PanelRow>
      </PanelBody>
      <PanelFlyout isPinned={...}>
        <PanelRow />  × flyout rows
      </PanelFlyout>
      <PanelLabel onExpand={...}>
        {panel.label}
        <PanelExpandChevron />
      </PanelLabel>
    </RibbonPanel>
  </RibbonBody>
</DxfRibbon>
```

---

## 11. Piano di implementazione — Fasi

### Fase 1 — Scaffold ribbon + Status Bar
- `RibbonRoot`, `RibbonTabBar`, `RibbonTabItem`, `RibbonBody`, `RibbonPanel`, `PanelLabel`
- Stile dark theme, dimensioni corrette, animate tab switch
- localStorage persistence (activeTabId, minimizeState)
- **Status Bar** (bottom) — implementata insieme al ribbon scaffold
- Nessun tool funzionante — solo struttura visiva

### Fase 2 — Tab LAYERS (migrazione rapida dal floating panel) ✅ COMPLETATA 2026-05-12
- ✅ Migrazione contenuto `LevelPanel.tsx` nel ribbon tab Layers (composition pattern via prop `layersTabContent`)
- ✅ Layer visibility, colori, rename, delete, merge (via `useLayerOperations` wired in `LayersTabContent`)
- ✅ Import floorplan wizard + Load from Storage buttons (via `onSceneImported` da `handleFileImportWithEncoding`)
- ✅ **Floating panel: tab `levels` disabilitato** (`usePanelNavigation.getDisabledPanels() = { levels: true }`)
- ✅ Expanded workspace mode (body 240px-720px, scroll) — pattern Revit
- File: `LayersTabContent.tsx` (75 righe), modifiche minimal a `RibbonRoot`/`RibbonBody`/CSS

### Fase 3 — Tab HOME, panel DRAW ✅ COMPLETATA 2026-05-12
- ✅ `RibbonLargeButton`, `RibbonSmallButton`, `RibbonSplitButton` + `RibbonSplitDropdown`
- ✅ Split-last-used persistence via `dxf-ribbon:splitLastUsed` (hook `useSplitLastUsed`)
- ✅ `RibbonCommandContext` bridge (`onToolChange` + split map) wired da `DxfViewerContent`
- ✅ Line ▾ (3 varianti: Line/Perpendicular/Parallel), Polyline, Rectangle, Polygon, Ellipse (simple) — wireati a `ToolType` reali
- ✅ Circle ▾ (4 varianti: radius/diameter/2P/3P), Arc ▾ (3 varianti: 3P/SCE/CSE)
- ⏳ Floating panel NON ancora disabilitato per questi tool (rimozione → Fase 8)
- ⚠️ Varianti rinviate (manca `ToolType` mappabile): Circle TTR, Arc SCA/SEA, Ellipse Axis+End/Arc

### Fase 4 — Panel MODIFY ✅ COMPLETATA 2026-05-12 (parziale wiring)
- ✅ 12 button visibili nel panel Modify (Move/Copy/Rotate/Mirror/Scale/Stretch large + Trim/Extend/Offset/Fillet▾/Array▾/Explode small)
- ✅ Wireati a `ToolType` reale: **Move (M), Copy (CO), Rotate (RO)**
- ✅ **Mirror (MI)** → tool reale wired (vedi Fase 4.1)
- ⏳ `comingSoon: true` → toast "Σύντομα διαθέσιμο: <label>" via `notifications.info`: Scale, Stretch, Trim, Extend, Offset, Fillet, Chamfer, Array (Rect/Path/Polar), Explode
- ✅ Pattern stub: `RibbonCommand.comingSoon?: boolean` + `RibbonCommandsApi.onComingSoon` Context bridge
- ⚠️ Wiring effettivo degli 8 tool rimanenti richiede `ToolType` + engine DXF (Scale/Stretch/Trim/Extend/Offset/Fillet/Array/Explode) — fuori scope ADR-345

### Fase 4.1 — Mirror tool wiring ✅ COMPLETATA 2026-05-14

- ✅ `comingSoon: true` rimosso dal button Mirror in `home-tab-modify.ts` (commandKey `'mirror'`, shortcut `MI`)
- ✅ **Mirror math SSoT** — `utils/mirror-math.ts`: `mirrorPoint()` (foot-point reflection), `mirrorAngle()` (start/end SWAP per archi), `getAxisAngleDeg()`, `mirrorEntity()` (gestisce line/circle/arc/polyline/lwpolyline/rectangle/ellipse/text/mtext/spline/angle-measurement)
- ✅ **ICommand** — `core/commands/entity-commands/MirrorEntityCommand.ts`: execute/undo/redo. Due modalità: `keepOriginals=true` (default AutoCAD — crea copie riflesse via `addEntity`) / `keepOriginals=false` (replace via snapshot + `updateEntity`). `validate()` controlla asse non degenere (|p2-p1|² > 1e-10)
- ✅ **State machine** — `hooks/tools/useMirrorTool.ts`: fasi `idle → awaiting-entity → awaiting-first-point → awaiting-second-point → awaiting-keep-originals`. Al secondo click: salva `secondPoint`, entra in `awaiting-keep-originals`. Y = `handleMirrorConfirm(true)` (copia+mantieni originali), N = `handleMirrorConfirm(false)` (sostituisce). Prompt i18next namespace `dxf-viewer-guides:mirrorTool.*`
- ✅ **Preview RAF** — `hooks/tools/useMirrorPreview.ts`: 60fps su PreviewCanvas durante `awaiting-second-point`. Asse mirror (linea tratteggiata oro estesa), croce rossa su p1, entità fantasma blu (alpha 0.4). Legge cursore via `useCursorWorldPosition()` direttamente (ADR-040 micro-leaf, zero re-render parent)
- ✅ **Click wiring** — `useCanvasClickHandler.ts` priority 1.56 (tra Move 1.55 e Guide 1.6): se `mirrorIsActive && handleMirrorClick` → intercetta click
- ✅ **Escape wiring** — `useCanvasKeyboardShortcuts.ts`: Escape durante `mirrorIsActive` → `handleMirrorEscape()` prima di rotation handler
- ✅ **Leaf mount** — `canvas-layer-stack-leaves.tsx`: `MirrorPreviewMount = React.memo(...)` accanto a `RotationPreviewMount` e `MovePreviewMount`. Prop pass da `CanvasLayerStack` → `CanvasSection`
- ✅ **i18n** — el+en: `dxf-viewer-guides:mirrorTool.{selectEntity,selectFirstPoint,selectSecondPoint}` + `tool-hints:mirror`
- ✅ Google-level: YES — proactive (command creates entity at right lifecycle), race-free (snapshot before execute), idempotent (redo recreates from entity store), belt-and-suspenders (validate axis before execute), SSoT (mirror-math.ts unico per preview + command), await (sync execute in click handler)

### Fase 5 — Tab VIEW + contextual tabs ✅ COMPLETATA 2026-05-12 (5A pieno, 5B scaffolding)

**5A — Tab VIEW**
- ✅ Panel `navigate`: Pan (large, ToolType `pan`), Zoom▾ split large (Window/In/Out, tutti ToolType reali), Zoom Extents (large, action `zoom-extents`), Previous View (small, `comingSoon`), Realtime Zoom (small, `comingSoon`), Zoom Reset (small, action `zoom-reset`)
- ✅ Panel `visual-styles`: 5 button tutti `comingSoon` (2D Wireframe / Hidden / Realistic / Shaded / Conceptual) — il DXF renderer non supporta visual styles
- ✅ Panel `viewports`: 4 button tutti `comingSoon` (Single/Two/Three/Four) — multi-viewport non implementato
- ✅ Estensione `RibbonCommandsApi` con `onAction: (action: string, data?) => void` + nuovo field `RibbonCommand.action?: string` + `actionData?: number | string | Record<string, unknown>`. Priority dispatch su tutti i 4 button: `comingSoon > action > tool`. Wiring via `handleAction` da `useDxfViewerState` (riusa `zoom-extents` / `zoom-reset` cases esistenti)

**5B — Contextual tab Text Editor (scaffolding)**
- ✅ Nuovo file `data/contextual-text-editor-tab.ts` con tab `text-editor` (`isContextual: true`, `contextualTrigger: 'text-selected'`) + 5 panels placeholder (`text-font` / `text-paragraph` / `text-properties` / `text-insert` / `text-editor-tools`), ognuno con 1 button `comingSoon`
- ✅ Controlled prop pattern (decisione Plan Mode 2026-05-12): `RibbonRoot` accetta nuove prop `contextualTabs?: readonly RibbonTab[]` + `activeContextualTrigger?: string | null`. `DxfViewerContent` deriva `activeContextualTrigger` da `primarySelectedId` + `currentScene.entities` (entity.type === 'text' | 'mtext' → trigger `'text-selected'`)
- ✅ Auto-attivazione tab contestuale quando entra (selezione TEXT/MTEXT) + auto-revert a `'home'` quando esce (deselect). Implementato via `useEffect` in `RibbonRoot` con `prevContextualIdsRef`
- ✅ CSS contextual tab: accent color esistente (`--ribbon-tab-contextual`) + nuovi `border-top: 2px solid accent` + `margin-left: 4px` + `font-weight: 600` per evidenza visiva. Selezione su tab attiva preserva accent text color
- ✅ Wiring concreto controlli Text Editor → **Fase 5.5 COMPLETATA 2026-05-12** (vedi §11 Fase 5.5)
- ✅ Floating panel sidebar `text-properties` tab → DISABILITATA da Fase 5.5

### Fase 5.5 — Text Editor contextual tab wiring ✅ COMPLETATA 2026-05-12

**Obiettivo**: sostituire i 5 button placeholder `comingSoon` di `contextual-text-editor-tab.ts` con controlli funzionanti wireati al text engine (ADR-344) tramite `useTextToolbarStore`. Introdurre i due button types ADR §4.4-4.5 non ancora implementati (Toggle + Combobox).

**Nuovi button components**
- ✅ `components/buttons/RibbonToggleButton.tsx` (ADR §4.4) — `aria-pressed` + `data-pressed="true"` (sfondo accent) + `data-mixed="true"` (border dashed). Priority dispatch `comingSoon > action > toggle` (NO `onToolChange` — toggle è ortogonale al tool mode).
- ✅ `components/buttons/RibbonCombobox.tsx` (ADR §4.5) — Wrapper su `@/components/ui/select` (Radix Select, **canonico ADR-001 — MAI EnterpriseComboBox**). Larghezza variabile via CSS variable `--ribbon-combobox-width` settata con `ref.style.setProperty` (SOS N.3 compliant, no inline style). Opzioni dinamiche dal bridge (`getComboboxState(commandKey).options`) o statiche da `command.options`. Mixed value → placeholder em-dash.
- ✅ `components/RibbonPanel.renderButton` dispatch esteso con `case 'toggle'` + `case 'combobox'`.

**Estensione API**
- ✅ `RibbonCommand` (in `types/ribbon-types.ts`) estesa con `options?: readonly RibbonComboboxOption[]` + `comboboxWidthPx?: number`. Nuovo type `RibbonComboboxOption { value, labelKey, isLiteralLabel? }`.
- ✅ `RibbonCommandsApi` (in `context/RibbonCommandContext.tsx`) estesa con `onToggle`, `onComboboxChange`, `getToggleState`, `getComboboxState`. Tutti opzionali con fallback no-op. Provider expose handlers + state via Context.
- ✅ Tipi `RibbonToggleState = boolean | null` (null = mixed) + `RibbonComboboxState { value: string | null; options: readonly RibbonComboboxOption[] }`.

**Bridge text-engine ↔ ribbon**
- ✅ `hooks/useRibbonTextEditorBridge.ts` — hook root che legge `useTextToolbarStore` + `useTextPanelFonts` + `useTextPanelLayers` + `useScaleList` + `useActiveScale`, ritorna i 4 handler API. Split helpers (file <40 righe, SRP rispettata):
  - `hooks/bridge/command-keys.ts` — costanti `TEXT_RIBBON_KEYS.*` (font/style/align/paragraph/properties) SSoT condivisa con data file
  - `hooks/bridge/toggle-handlers.ts` — `applyToggle()` + `readToggleState()`. Alignment toggles mutually exclusive: setValue justification `ML`/`MC`/`MR`. `readToggleState` deriva pressed da `values.justification === 'ML' | 'MC' | 'MR'`.
  - `hooks/bridge/combobox-handlers.ts` — `readComboboxState()` build options list per font/layer/scale dinamico; values numerici (height, lineSpacing) serializzati a stringa.
  - `hooks/bridge/combobox-apply.ts` — `applyCombobox()` parse numeri difensivo (Number.isFinite + >0), annotationScale scrive ANCHE `setActiveScale()` globale (ADR-344 Phase 11 viewport singleton SSoT).

**Commit semantics (Fase 5.5 — aggiornato 2026-05-22)**
- Il bridge scrive su `useTextToolbarStore` (pending values via `setValue`, `isPopulating=false`).
- La catena `store → UpdateTextStyleCommand/UpdateMTextParagraphCommand → CommandHistory` è **già operativa** dal 2026-05-12 (ADR-344 Phase 6.E): `useTextToolbarCommandBridge` è montato in `DxfViewerContent.tsx:124` (sempre attivo, non dentro `TextPropertiesPanelHost`). Ogni mutazione ribbon fluisce automaticamente in CommandHistory — zero cambio necessario qui. ✅
- **Campi deferred** (gap noto, uguale al floating panel): `lineSpacingFactor` + `layerId` aggiornano lo store ma non dispatchano comandi — follow-up in Phase 6+.
- **Nota**: `annotationScale` chiama `setActiveScale()` sia da `combobox-apply.ts` sia da `useTextToolbarCommandBridge` — doppia chiamata idempotente, zero bug.

**Data declaration (`data/contextual-text-editor-tab.ts`)**
- Font panel: combobox `font.family` (180px) · combobox `font.height` (80px, statico 1.0/2.5/3.5/5/7/10) · toggle bold · toggle italic · toggle underline
- Paragraph panel: toggle align.left/center/right (mutually exclusive via justification) · combobox `lineSpacing` (90px, statico 1.0/1.15/1.5/2.0)
- Properties panel: combobox `layer` (160px, dinamico) · combobox `annotationScale` (110px, dinamico)
- Insert panel: button `symbol` (comingSoon) · button `field` (comingSoon)
- Editor Tools panel: button `findReplace` (**✅ WIRED** — `DxfFindReplaceHost` lazy wrapper, state `findReplaceOpen` in `useDxfViewerState`, action `text-find-replace` → 2026-05-19) · toggle `spellCheck` (comingSoon — engine assente)

**Wiring in `DxfViewerContent.tsx`**
- ✅ `const textEditorBridge = useRibbonTextEditorBridge()` montato sempre (overhead trascurabile, leaf subscriptions ADR-040 friendly)
- ✅ Bridge handlers passati nel prop `commands` di `<RibbonRoot>` (onToggle / onComboboxChange / getToggleState / getComboboxState)

**Floating panel sidebar**
- ✅ `ui/hooks/usePanelNavigation.getDisabledPanels()` ora ritorna `{ levels: true, 'text-properties': true }`. Tab `colors` resta attiva (Fase 6 migration).

**CSS (`styles/ribbon-tokens.css`)**
- ✅ `.dxf-ribbon-btn-toggle[data-pressed="true"]` → background `--ribbon-btn-active`, color `#FFFFFF`; hover `filter: brightness(1.1)`
- ✅ `.dxf-ribbon-btn-toggle[data-mixed="true"]` → border dashed
- ✅ `.dxf-ribbon-combobox-trigger` → width via CSS var, height 24px, font 12px, padding 2px 6px (chip-like per ribbon density)

**i18n**
- ✅ `ribbon.commands.textEditor.{font,style,paragraph,properties,insert,editor}.*` keys (el + en). Pure greek locale (Έντονα/Πλάγια/Υπογράμμιση/Στοίχιση/Διάστιχο/Επίπεδο/Κλίμακα Σχολιασμού/Σύμβολο/Πεδίο/Εύρεση και Αντικατάσταση/Ορθογραφικός Έλεγχος). Placeholder keys vecchi (`fontPlaceholder`, etc.) rimossi.

**Google-level checklist (N.7.2)**
- ✅ Proactive: bridge sempre montato (zero side-effect quando tab contestuale chiusa)
- ✅ Race-free: setValue Zustand sync; nessuna Promise floating
- ✅ Idempotent: toggle bold ×2 = stesso stato finale; combobox set stesso valore = no-op
- ✅ Belt-and-suspenders: parsing numerico difensivo (`Number.isFinite + > 0`); fallback no-op handlers in Context
- ✅ SSoT: `useTextToolbarStore` = UI pending values (unica fonte). ViewportStore.activeScale aggiornato consistentemente.
- ✅ Await: setValue sync; nessun await su catena ribbon→store
- ✅ Lifecycle: hook leaf-subscribes ad ADR-040-friendly stores; cleanup automatico React

### Fase 5.5-FR — FindReplace button wiring ✅ COMPLETATA 2026-05-19

**Obiettivo**: rimuovere `comingSoon: true` dal button `findReplace` nel panel `text-editor-tools` e montare `FindReplaceDialog` (ADR-344 Phase 9) tramite un host wrapper lazy-loaded.

**Architettura**
- `comingSoon: true` rimosso da `data/contextual-text-editor-tab.ts`. Icona cambiata `text-placeholder` → `search`. Aggiunto `action: 'text-find-replace'`.
- `useDxfViewerState.ts`: nuovo state `findReplaceOpen / setFindReplaceOpen (useState(false))`. Case `'text-find-replace'` aggiunto in `handleAction` → `setFindReplaceOpen(true)`.
- **Nuovo file** `ui/text-toolbar/DxfFindReplaceHost.tsx` — wrapper component che raccoglie le 3 dipendenze pesanti di `FindReplaceDialog` (`sceneManager` + `layerProvider` da `useDxfTextServices()`, `entities: DxfTextSceneEntity[]` filtrati da `useCurrentSceneModel().entities`, `onExecuteCommand` da `getGlobalCommandHistory().execute`). Ritorna `null` quando `services === null` (no level active). Logica di filtraggio: `isTextEntity(e)` type guard `e.type === 'text' || e.type === 'mtext'`.
- `DxfViewerContent.tsx`: import lazy `React.lazy(() => import('../ui/text-toolbar/DxfFindReplaceHost'))` + mount con `<React.Suspense fallback={<div className="hidden" />}><DxfFindReplaceHost open={state.findReplaceOpen} onOpenChange={state.setFindReplaceOpen} /></React.Suspense>`.

**Files modificati/creati**
- `ui/ribbon/data/contextual-text-editor-tab.ts` — rimozione comingSoon findReplace
- `hooks/useDxfViewerState.ts` — `findReplaceOpen` state + `text-find-replace` action case
- `ui/text-toolbar/DxfFindReplaceHost.tsx` (NUOVO)
- `app/DxfViewerContent.tsx` — lazy import + Suspense mount

**Google-level checklist**
- ✅ Proactive: `DxfFindReplaceHost` lazy-loaded → zero bundle impact finché non richiesto
- ✅ Race-free: Suspense boundary garantisce che il dialog non parte prima del chunk
- ✅ Idempotent: `setFindReplaceOpen(true)` × 2 = stesso stato
- ✅ SSoT: `findReplaceOpen` in `useDxfViewerState` = unica fonte di verità
- ✅ Lifecycle: `useDxfTextServices()` gestisce null (no level active) → `DxfFindReplaceHost` ritorna null

✅ Google-level: YES — lazy wrapper + null guard + SSoT state in viewer-state hook.

---

### Fase 5.5-SYM — Symbol Picker + ClipToRegion textNode fix ✅ COMPLETATA 2026-05-21

**Obiettivo**: (A) rimuovere `comingSoon: true` dal button `symbol` nel panel `text-insert` e montare un `SymbolPickerDialog` leggero; (B) fix `clipText()` per entità ribbon (textNode invece di flat `text`); (C) test suite `ClipToRegionService`.

**Architettura Symbol Picker**
- `comingSoon: true` rimosso da `data/contextual-text-editor-tab.ts` → `action: 'text-insert-symbol'` aggiunto.
- `useDxfViewerState.ts`: nuovo state `symbolPickerOpen / setSymbolPickerOpen (useState(false))`. Case `'text-insert-symbol'` in `handleAction` → `setSymbolPickerOpen(true)`.
- **Nuovo file** `ui/text-toolbar/SymbolPickerDialog.tsx` — 30 Unicode symbols in 3 gruppi (math/arrows/legal). Click → `InsertTextTokenCommand` per ogni entityId in `selectedIds`. Dialog si chiude auto dopo inserimento. Usa `useTextSelectionStore` (ADR-040 micro-leaf) + `useDxfTextServices()` + `getGlobalCommandHistory()`.
- **Nuovo file** `ui/text-toolbar/DxfSymbolPickerHost.tsx` — wrapper lazy-loadable, ritorna null se `services === null`.
- `DxfViewerContent.tsx`: lazy import + Suspense mount identici a `DxfFindReplaceHost`.

**InsertTextTokenCommand esteso**
- Nuova helper `resolveToken(token)`: TOKEN_MAP lookup primo; se non trovato, accetta raw Unicode codepoint (`[...token].length === 1`). Retro-compatibile — tutti i token `%%c/%%d/%%p/\S` continuano a funzionare.
- `validate()` + `getDescription()` aggiornati per usare `resolveToken`.

**ClipToRegionService textNode fix** (già presente in precedente sessione, ora coperto da test)
- `clipText()`: se `entity.textNode` esiste → estrae `plainText` dai paragraphs→runs→text (duck-typing `'top' in run`), calcola `charH` da primo run style (height > 0) o fallback `TEXT_SIZE_LIMITS.DEFAULT_FONT_SIZE` (12). Per 1-para/1-run: ricostruisce textNode con solo il testo tagliato. Per multi-run: conservativo (muove solo `position`).
- Nuovi test: `services/__tests__/ClipToRegionService.test.ts` — 6 casi: fully-inside, outside, single-run trim, DEFAULT_FONT_SIZE fallback, legacy text field, multi-run conservative.

**Files modificati/creati**
- `ui/ribbon/data/contextual-text-editor-tab.ts` — rimozione comingSoon symbol, aggiunto action
- `hooks/useDxfViewerState.ts` — `symbolPickerOpen` state + `text-insert-symbol` action case
- `ui/text-toolbar/SymbolPickerDialog.tsx` (NUOVO)
- `ui/text-toolbar/DxfSymbolPickerHost.tsx` (NUOVO)
- `app/DxfViewerContent.tsx` — lazy import + Suspense mount
- `core/commands/text/InsertTextTokenCommand.ts` — `resolveToken()` helper per raw Unicode
- `services/__tests__/ClipToRegionService.test.ts` (NUOVO — 6 tests, tutti ✅)
- `i18n/locales/en/dxf-viewer-shell.json` — `ribbon.symbolPicker.{title,hint,close}`
- `i18n/locales/el/dxf-viewer-shell.json` — stesse keys in greco

**Google-level checklist**
- ✅ Proactive: lazy bundle, zero impact finché non richiesto
- ✅ Race-free: Suspense + SSoT state
- ✅ Idempotent: `setSymbolPickerOpen(true)` × 2 = stesso stato; `InsertTextTokenCommand` idempotente su sceneCopy
- ✅ SSoT: `symbolPickerOpen` in `useDxfViewerState`; `selectedIds` da `useTextSelectionStore`
- ✅ Belt-and-suspenders: `resolveToken` null-safe; dialog disabilitato se no services/selection
- ✅ Lifecycle: null guard in host wrapper

✅ Google-level: YES — lazy wrapper + null guard + SSoT state + undo/redo via CommandHistory.

---

### Fase 6.0 — Font panel extras (migrazione controlli FloatingPanel → Ribbon) ✅ COMPLETATA 2026-05-14

**Obiettivo**: migrare i controlli mancanti del panel "Font" dal FloatingPanel alla tab contestuale Text Editor.

**Controlli aggiunti al panel `text-font`**:
- ✅ Row 3: Overline toggle (`text.style.overline`) + Strikethrough toggle (`text.style.strikethrough`) + Color swatch widget (`text.font.color`)
- ✅ Row 4: Width factor combobox presets (0.50–2.00) + Oblique angle combobox (−30°–30°) + Tracking combobox (0.80–1.50)

**Architettura**:
- ✅ `command-keys.ts` — 5 nuovi command keys centralizzati (SSoT)
- ✅ `toggle-handlers.ts` — overline + strikethrough wired
- ✅ `combobox-handlers.ts` + `combobox-apply.ts` — widthFactor / obliqueAngle / tracking wired
- ✅ Nuovo `ButtonType` `'color-swatch'` in `ribbon-types.ts`
- ✅ Nuovo leaf widget `RibbonColorSwatchWidget.tsx` (ADR-040 compliant — micro-leaf diretto su store)
- ✅ `RibbonPanel.tsx` — case `'color-swatch'` → `<RibbonColorSwatchWidget />`
- ✅ i18n el + en per tutti i nuovi controlli

**Google-level checklist**:
- ✅ SSoT: `useTextToolbarStore` è l'unica fonte di pending values
- ✅ No race conditions: widget leaf legge store direttamente (ADR-040)
- ✅ Idempotente: `setValue` Zustand puro
- ✅ Parsing difensivo: `Number.isFinite + > 0` su tutti i valori numerici
- ✅ No inline styles, no `any`, no hardcoded strings

### Fase 6.1 — Tab SETTINGS (migrazione DXF Settings) ✅ COMPLETATA 2026-05-15
- `DxfSettingsPanel` embeddato nel ribbon Settings tab (expanded area sotto i ribbon panels)
- Floating panel tab `colors` disabilitata + rimossa dalla UI

### Fase 7 — Flyout expand + minimize states ✅ COMPLETATA 2026-05-15
- `RIBBON_MINIMIZE_CYCLE`: 4 stati (`full → panel-buttons → panel-titles → tab-names`)
- `pinnedPanelIds` in `useRibbonState` con localStorage persistence
- Flyout inline (sotto panel body): chevron trigger ▼/▲ + pin button 📌 + click-outside close

### Fase 8 — Floating panel removal ⏳ NON PIANIFICATA
- Tab `colors` (Ρυθμίσεις DXF) rimane nella sidebar — confermato da Giorgio 2026-05-15
- Floating panel sidebar resta con entrambe le tab (Επίπεδα + Ρυθμίσεις DXF)

### Fase 9 — ToolbarStatusBar standalone ✅ COMPLETATA 2026-05-13
- `ToolbarStatusBar` estratto come elemento autonomo senza wrapper container
- Creato `StandaloneStatusBar.tsx`: gestisce desktop (ToolbarStatusBar) + mobile (MobileToolbarLayout + compact bar) internamente
- Creato `useDxfToolbarShortcuts.ts`: hook autonomo con tutta la keyboard shortcut logic (estratta da `EnhancedDXFToolbar`)
- `NormalView.tsx` semplificato: usa `StandaloneStatusBar` + `useDxfToolbarShortcuts` direttamente, nessun container wrapper
- `FullscreenView.tsx` semplificato: stessa struttura
- **Eliminati**: `ToolbarSection.tsx`, `ToolbarWithCursorCoordinates.tsx`, `EnhancedDXFToolbar.tsx` (catena wrapper rimossa)
- `toolbar/index.ts` pulito: rimosso export `EnhancedDXFToolbar`, aggiunto `StandaloneStatusBar`
- `DxfViewerContent.tsx`: rimosso lazy import morto `ToolbarWithCursorCoordinates`

---

## 12. Pre-commit checks da aggiungere

- CHECK 7A: file ribbon > 500 righe → BLOCK (SRP)
- CHECK 7B: `RibbonCommand.commandKey` referenzia comando esistente nel DXF command registry → WARNING se non trovato
- CHECK 7C: modifica file ribbon → stagingADR-345 obbligatorio

---

## 13. Success Criteria

- [ ] Ribbon visibile sopra il canvas in `/dxf/viewer`
- [ ] Tab Home funzionante con panel Draw completo
- [ ] Split buttons con last-used persistence (localStorage)
- [ ] Flyout panel espanso e pinnable
- [ ] 4 stati minimize
- [ ] Tab contestuali su selezione hatch/text
- [ ] Floating panel completamente rimosso (Fase 7)
- [ ] 0 TypeScript errors
- [ ] Ribbon responsive: viewport < 900px → auto-minimize a "tab-names-only". Click su tab → mostra panels temporaneamente. Click sul canvas → panels scompaiono.
- [ ] i18n completo (nessuna stringa hardcoded)

---

## 14. Changelog

| Data | Modifica |
|------|----------|
| 2026-05-22 | **Commit semantics §Fase-5.5 aggiornato** — Code audit confermato: catena ribbon→CommandHistory già operativa dal 2026-05-12 (ADR-344 Phase 6.E). `useTextToolbarCommandBridge` montato in `DxfViewerContent.tsx:124` (sempre attivo). Chain: `setValue(store, isPopulating=false)` → subscriber → dispatch `UpdateTextStyleCommand/UpdateTextGeometryCommand/UpdateTextCurrentScaleCommand/UpdateMTextParagraphCommand` → `CommandHistory`. Gap noto: `lineSpacingFactor`+`layerId` deferred (stessa limitazione del floating panel). Nota: `annotationScale` causa doppio `setActiveScale()` — idempotente, zero bug. Pending ratchet entry «commit chain» rimossa come outdated. |
| 2026-05-21 | **Fase 5.5-SYM — Symbol Picker + ClipToRegion textNode fix**. `comingSoon: true` rimosso da symbol button (`contextual-text-editor-tab.ts`), aggiunto `action: 'text-insert-symbol'`. `useDxfViewerState`: `symbolPickerOpen/setSymbolPickerOpen` state + `case 'text-insert-symbol'` in `handleAction`. Nuovi file: `SymbolPickerDialog.tsx` (30 Unicode symbols in 3 gruppi math/arrows/legal, click→`InsertTextTokenCommand`, auto-close) + `DxfSymbolPickerHost.tsx` (null guard wrapper). `DxfViewerContent`: lazy import + Suspense mount. `InsertTextTokenCommand`: `resolveToken()` helper — TOKEN_MAP lookup + raw Unicode codepoint fallback per 1-char tokens (retro-compatibile). `ClipToRegionService.clipText()` già fixato per textNode entities: duck-typing per estrarre plainText + charH da run.style.height con fallback DEFAULT_FONT_SIZE(12). Nuova test suite `services/__tests__/ClipToRegionService.test.ts` (6 test ✅). i18n: `ribbon.symbolPicker.{title,hint,close}` in el+en. ✅ Google-level: YES. |
| 2026-05-19 | **Fase 5.5-FR — FindReplace button wired**. `comingSoon: true` rimosso da `contextual-text-editor-tab.ts` (findReplace button: icon `text-placeholder`→`search`, aggiunto `action: 'text-find-replace'`). `useDxfViewerState`: `findReplaceOpen/setFindReplaceOpen` state + `case 'text-find-replace': setFindReplaceOpen(true)` in `handleAction`. Nuovo `DxfFindReplaceHost.tsx`: wrapper lazy-loadable che raccoglie `sceneManager`+`layerProvider` da `useDxfTextServices()` + filtra `entities` da `useCurrentSceneModel()` via type guard `e.type === 'text'|'mtext'` + `onExecuteCommand` da `getGlobalCommandHistory().execute()`. Ritorna null se no level active. `DxfViewerContent`: lazy import + Suspense mount. spellCheck e symbol rimangono `comingSoon` (engine/dialog assenti). ✅ Google-level: YES — lazy bundle, null guard, SSoT state, race-free Suspense. |
| 2026-05-19 | **ADR-363 Phase 7.1 — Multi-Selection contextual tab registered**. Νέο tab `multi-selection` (`isContextual: true`, `contextualTrigger: 'multi-selection-bim'`) στο registry `RIBBON_CONTEXTUAL_TABS` (`app/ribbon-contextual-config.ts`). Tab data στο `ui/ribbon/data/contextual-multi-selection-tab.ts`: 2 panels (`multi-selection-common` mounts `MultiSelectionCommonPropertiesPanel` widget, `multi-selection-filter` mounts `MultiSelectionFilterPanel` widget). Widget dispatcher `RibbonPanel.tsx` updated με τα δύο νέα widgetId ('multi-selection-common-properties', 'multi-selection-filter'). Trigger resolution στο `useActiveContextualTrigger` extended με `selectedEntityIds` arg + precedence: 2+ BIM-kind selection → multi-selection tab υπερτερεί του per-kind tab από `primarySelectedId`. i18n `ribbon.tabs.multiSelection`, `ribbon.panels.multiSelection{Common,Filter}`, `ribbon.contextualTabs.multiSelection.*` σε el (Πολλαπλή Επιλογή / Κοινές Ιδιότητες / Φιλτράρισμα / κ.λπ.) + en. CSS `dxf-ribbon-multi-{common,filter}*` στο `ribbon-tokens.css`. Widgets self-gate (return null όταν mode!=='multi' ή commonProperties άδειο) — panels collapse-άρουν gracefully. |
| 2026-05-17 | **Fase 5.6 wire** — `DxfViewerContent` passa `useDxfViewerState.activeTool` come prop a `useRibbonCommands({ activeTool, ... })`, completando il plumbing da viewer-state → ribbon-context → tool buttons. |
| 2026-05-17 | **Fase 5.6 — activeTool propagation per pressed/active visual state**. `RibbonCommandsApi.activeTool: ToolType \| null` aggiunto; `RibbonCommandProvider` lo memoizza nel context value (deps array updated). `useRibbonCommands` riceve `activeTool` da `useDxfViewerState` e lo forward. `DxfViewerContent` lo plumbing al hook. `RibbonLargeButton` + `RibbonSmallButton` calcolano `isActive = !comingSoon && !action && activeTool === command.commandKey` e settano `aria-pressed` + `data-active`. Industry convergence (Office/AutoCAD/Revit Ribbon): toggle button visual state mandatory per discoverability tool corrente. Pure tool buttons (no action/comingSoon) only — stateless action buttons restano sempre inactive. |
| 2026-05-11 | ADR-345 PROPOSED — Research Autodesk ribbon architecture + struttura completa tool Home tab. Migration plan in 7 fasi. |
| 2026-05-11 | §8.0 aggiunto — Layout position confermato: ribbon full-width tra global header e DXF toolbar. Coesistenza transitoria con floating panel + DXF toolbar durante migrazione. |
| 2026-05-11 | §8.1b aggiunto — Icone: SVG custom CAD-specific da Tabler Icons (MIT) / Iconoir (MIT) / Iconbuddy (verifica per icona). Copiate come file SVG nell'asset folder. NO Lucide per ribbon. |
| 2026-05-11 | §8.1c aggiunto — Persistenza stato: localStorage (industry standard AutoCAD/Revit/Office). 4 chiavi: activeTabId, minimizeState, pinnedPanelIds, splitLastUsed. |
| 2026-05-11 | §8.1d aggiunto — Ricerca floating panel: 3 tab (Levels, DXF Settings, Text Properties). Strategia migrazione per ciascuno. |
| 2026-05-11 | §11 rivisitato — Fasi riordinate: F1 scaffold → F2 Layers (quick win) → F3 Draw → F4 Modify → F5 View+contextual → F6 Settings → F7 Flyout/minimize → F8 Remove floating panel. |
| 2026-05-11 | §8.1 aggiornato — Layers: tab dedicato (non panel in Home). Home mantiene mini-panel con layer dropdown + quick actions. Revit pattern. |
| 2026-05-11 | §11 Fase 1 aggiornata — Status Bar implementata in Fase 1 insieme al ribbon scaffold. |
| 2026-05-11 | §7 aggiornato — Status Bar: tutti 7 elementi (X/Y, Grid, Snap, Ortho, Polar, Scale, Layer). |
| 2026-05-11 | §8.1 aggiornato — Label ribbon via i18n (el default, en se cambia lingua). Stesso pattern N.11. |
| 2026-05-11 | §8.1 tab order confermato: Home | Layers | View | Annotate | Settings. |
| 2026-05-11 | §13 responsive aggiornato — viewport < 900px: auto-minimize tab-names-only. Click tab → panels temporanei. Click canvas → chiude. |
| 2026-05-11 | §6.2 aggiornato — Colori theme-aware via CSS variables, NON hardcoded. Dark + Light token table. |
| 2026-05-11 | §5.5 confermato — Right-click ribbon menu implementato in v1: minimize toggle, show tabs, show panels, undock. |
| 2026-05-11 | §3 confermato — Tutti 9 panels Home tab approvati. Block/Groups/Utilities/Clipboard = nuova funzionalità (non migrazione). |
| 2026-05-11 | Status → ACCEPTED. Sessione Q&A completata (14 domande). Tutte le decisioni architetturali prese. Pronto per implementazione Fase 1. |
| 2026-05-11 | §5.1 + §8.1c — Tab drag & drop reorder aggiunto. Ordine persiste in localStorage (dxf-ribbon:tabOrder). |
| 2026-05-12 | §6.2 aggiornato — `--ribbon-tab-bar-bg` (dark) cambiato da `#252525` a `#141A24` (rgb 20,26,36) per richiesta utente. Light invariato (`#E0E0E0`). |
| 2026-05-12 | §6.2 aggiornato — `--ribbon-bg` (dark) cambiato da `#2D2D2D` a `hsl(var(--showcase-bg))` = `#1D283A` (rgb 29,40,58) navy brand surface. Riusa token centralizzato `--showcase-bg` da `app/globals.css` (SSoT N.12, ADR-312). Light invariato (`#F0F0F0`). |
| 2026-05-12 | §6.2 aggiornato — `--ribbon-tab-active` (dark) cambiato da `#3C3C3C` a `hsl(var(--showcase-bg))` = `#1D283A` per uniformare il chip della tab attiva con il body del ribbon (richiesta utente). Light invariato (`#FFFFFF`). |
| 2026-05-12 | CSS `.dxf-ribbon-tab` — angoli superiori arrotondati. Nuovo token `--ribbon-tab-radius: 6px` + `border-top-left-radius` / `border-top-right-radius` su ogni tab. Bottom corners restano squadrati per fondersi col body. Pattern Chrome/Firefox/Office. |
| 2026-05-12 | Route-scoped global header tweak — `DxfViewerContent` mount/unmount setta/pulisce `document.documentElement.dataset.appRoute = 'dxf-viewer'`. CSS in `ribbon-tokens.css`: `html[data-app-route="dxf-viewer"] header.sticky.top-0 { border-bottom-width: 0 }` nasconde la `border-b` del global app header (`src/components/app-header.tsx`) solo su `/dxf/viewer`. Le altre route mantengono il separatore. |
| 2026-05-12 | CSS `.dxf-ribbon-tab-bar` — rimossa `border-bottom: 1px solid var(--ribbon-separator)`. La transizione di colore `--ribbon-tab-bar-bg` (#141A24) ↔ `--ribbon-bg` (#1D283A) crea già la separazione naturale per le tab inattive; la tab attiva (#1D283A, uguale al body) fluisce direttamente nel pannello senza linea di taglio. Tentativo iniziale con pseudo-elemento `::after` rimosso — `.dxf-ribbon-tab-list { overflow-x: auto }` clippava il `bottom: -1px`. Pattern AutoCAD/Office 365 confermato. |
| 2026-05-12 | **Fase 5.5 IMPLEMENTATA** — Text Editor contextual tab wiring. Due nuovi button types ADR §4.4-4.5: `RibbonToggleButton.tsx` (aria-pressed + data-pressed/mixed states, priority dispatch `comingSoon > action > toggle`) e `RibbonCombobox.tsx` (wrapper Radix Select ADR-001 canonico, larghezza variabile via CSS var `--ribbon-combobox-width` settata con `ref.style.setProperty` per SOS N.3 compliance, mixed value → em-dash placeholder). Estensione API: `RibbonCommand.options` + `comboboxWidthPx`, nuovo type `RibbonComboboxOption { value, labelKey, isLiteralLabel }`, `RibbonCommandsApi` con `onToggle/onComboboxChange/getToggleState/getComboboxState` (tutti opzionali, fallback no-op). `RibbonPanel.renderButton` dispatch esteso con `case 'toggle'` + `case 'combobox'`. **Bridge** `hooks/useRibbonTextEditorBridge.ts` + 4 helpers SRP (`bridge/command-keys.ts` SSoT costanti, `bridge/toggle-handlers.ts` apply+read toggles (alignment mutually exclusive via `justification` ML/MC/MR), `bridge/combobox-handlers.ts` build dynamic option lists fonts/layers/scales, `bridge/combobox-apply.ts` setValue + parsing numerico difensivo + `setActiveScale()` su annotationScale change). Bridge legge `useTextToolbarStore` + `useTextPanelFonts/Layers` + `useScaleList/useActiveScale` (ADR-040 leaf subscriptions). **Commit semantics v1**: bridge scrive solo su store pending values; catena `store → UpdateTextStyleCommand → CommandHistory` rimane di ADR-344 Phase 6+ (TipTap session). Coerente con `TextPropertiesPanel.tsx` esistente. **Data file rewritten** `data/contextual-text-editor-tab.ts`: 12 button wired (font.family/height combobox + bold/italic/underline toggle + align.left/center/right toggle + lineSpacing combobox + layer/annotationScale combobox) + 4 comingSoon (insert symbol/field, editor findReplace/spellCheck — placeholder UX per release v1). Wiring in `DxfViewerContent.tsx`: `useRibbonTextEditorBridge()` sempre montato, handlers passati a `<RibbonRoot commands>`. **Floating panel** sidebar tab `text-properties` DISABILITATA in `usePanelNavigation.getDisabledPanels()` (ora `{ levels: true, 'text-properties': true }`). CSS `ribbon-tokens.css`: `.dxf-ribbon-btn-toggle[data-pressed]` (sfondo accent + hover brightness 1.1), `[data-mixed]` (border dashed), `.dxf-ribbon-combobox-trigger` (width CSS var, height 24px, font 12px). i18n el+en: `ribbon.commands.textEditor.{font,style,paragraph,properties,insert,editor}.*` (pure greek: Έντονα/Πλάγια/Υπογράμμιση/Στοίχιση Αριστερά|Κέντρο|Δεξιά/Διάστιχο/Επίπεδο/Κλίμακα Σχολιασμού/Σύμβολο/Πεδίο/Εύρεση και Αντικατάσταση/Ορθογραφικός Έλεγχος). Placeholder keys vecchi rimossi. ✅ Google-level: YES — proactive (bridge sempre montato), race-free (Zustand sync), idempotent (toggle ×2 = stesso stato), belt-and-suspenders (parsing numerico Number.isFinite + >0, no-op fallback handlers), SSoT (store = UI pending, ViewportStore = scale active), await (sync), lifecycle (React cleanup automatico). |
| 2026-05-12 | **Fase 5 IMPLEMENTATA** (5A pieno, 5B scaffolding). **5A — Tab VIEW**: 3 nuovi file data (`ui/ribbon/data/{view-tab-navigate,view-tab-visual-styles,view-tab-viewports}.ts`) → 3 panels Navigate/Visual Styles/Viewports. Estensione `RibbonCommandsApi` con `onAction: (action: string, data?: number\|string\|Record) => void` + `RibbonCommand.action?: string` + `actionData?` (in `context/RibbonCommandContext.tsx` + `types/ribbon-types.ts`). Priority dispatch su tutti i 4 button components: `comingSoon > action > tool`. Wiring: `DxfViewerContent.tsx` passa `commands.onAction = handleAction` (riusa cases zoom-extents/zoom-reset esistenti in `useDxfViewerState.handleAction`). 19 nuove icone SVG inline in `RibbonButtonIcon.tsx` (pan, zoom, zoom-in/out/window/extents/previous/realtime/reset, visual-2d/hidden/realistic/shaded/conceptual, viewport-single/two/three/four, text-placeholder). **5B — Contextual tab Text Editor (scaffolding)**: nuovo file `data/contextual-text-editor-tab.ts` con tab `text-editor` (isContextual + contextualTrigger `'text-selected'`) + 5 panels placeholder (Font/Paragraph/Properties/Insert/Editor) tutti `comingSoon`. **Controlled prop pattern** (decisione Plan Mode Q&A 2026-05-12 → opzione "most enterprise"): `RibbonRoot` accetta `contextualTabs?: readonly RibbonTab[]` + `activeContextualTrigger?: string \| null`. `DxfViewerContent` deriva il trigger via `useMemo` da `primarySelectedId` + `currentScene.entities.find(e => e.id === primarySelectedId)` → se `entity.type === 'text' \| 'mtext'` → `'text-selected'`. Auto-attivazione tab contestuale all'apparizione + auto-revert a `'home'` quando deselect, via `useEffect` con `prevContextualIdsRef` in `RibbonRoot`. CSS contextual: aggiunte regole `border-top: 2px solid accent` + `margin-left: 4px` + `font-weight: 600` su `.dxf-ribbon-tab[data-contextual="true"]`. i18n (el+en): `ribbon.tabs.textEditor`, `ribbon.panels.{visualStyles,viewports,font,paragraph,textProperties,insert,editor}`, `ribbon.commands.{pan,zoom,zoomExtents,zoomPrevious,zoomRealtime,zoomReset}` + nested `zoomVariants`/`visualStyles`/`viewports`/`textEditor`. Pure greek locale (no English words, anche "Realistic" → "Ρεαλιστικό"). **Wiring controlli Text Editor (font combobox, bold/italic/underline, layer dropdown, find/replace)** → rinviato a Fase 5.5 (richiede `RibbonCombobox` + `RibbonToggleButton` components, ADR §4.4-4.5). Floating panel sidebar tab `text-properties` resterà attivo fino a Fase 5.5. ✅ Google-level: YES — proactive (trigger deriva da selection state esistente, no fire-and-forget), idempotent (memoized derivation, switch tab = setState), race-free (controlled prop = pure data flow React), SSoT (un solo `activeContextualTrigger`), belt-and-suspenders (fallback `'home'` se contextual scompare mentre attivo). |
| 2026-05-13 | **Line → split button** — `home-tab-draw.ts`: `line` trasformato da `simple` a `split` con 3 varianti (Line / Perpendicular Line / Parallel Line → commandKey `line`/`line-perpendicular`/`line-parallel`). `RibbonButtonIcon.tsx`: aggiunti 2 nuovi case `line-perpendicular` + `line-parallel` → `<LineIcon variant="perpendicular/parallel">` (riuso icone da `toolbar/icons/LineIcon.tsx`, stesso pattern circle/arc). i18n el+en: `ribbon.commands.lineVariants.{line,perpendicular,parallel}`. §3.1 aggiornato. |
| 2026-05-12 | **Fase 5.5 wiring COMPLETATO** — `RibbonPanel.tsx` dispatch esteso con `case 'toggle'` + `case 'combobox'` (import `RibbonToggleButton` + `RibbonCombobox`). `usePanelNavigation.getDisabledPanels()` aggiornato: `{ levels: true, 'text-properties': true }` — sidebar text-properties tab disabilitata (contenuto migrato in contextual tab ribbon). `DxfViewerContent.tsx` wiring bridge + contextual trigger. i18n el+en allineati. |
| 2026-05-12 | **Fase 2 IMPLEMENTATA** — Migrazione `LevelPanel.tsx` nel ribbon tab `Layers`. Decisione UX: tab Layers usa **expanded workspace mode** (body height auto, max 720px / 70vh, scroll) invece di panels orizzontali — pattern Revit-style per contenuto ricco. Nuovo file `src/subapps/dxf-viewer/ui/ribbon/tabs/LayersTabContent.tsx` che wireare `LevelPanel` via `useLayerOperations` + `useLevels` + `useFloatingPanelState` (stesso wiring di `FloatingPanelContainer`). Composition pattern: `RibbonRoot` accetta prop `layersTabContent?: ReactNode`, `DxfViewerContent` istanzia `<LayersTabContent>` con scene/tool/selection/onSceneImported wired da `useDxfViewerState`. `RibbonBody` aggiunge `data-tab-mode="expanded"` quando layers tab attivo. CSS `.dxf-ribbon-body[data-tab-mode="expanded"]` con height auto + max 720px. `ribbon-default-tabs.ts`: Layers tab → `panels: []` (no horizontal panels). **Floating panel sidebar sx**: tab `levels` DISABILITATA via `usePanelNavigation.getDisabledPanels()` (LevelPanel ora vive solo nel ribbon, no duplicazione). Tab `colors` e `text-properties` restano attive in sidebar. Funzionalità preservate: visibility/colori/rename/delete/merge layers, import floorplan wizard, load from storage, livelli list, overlay list. |
| 2026-05-12 | **Fase 4 IMPLEMENTATA** (parziale wiring) — Home tab → panel MODIFY popolato con 12 button. Nuovo file `ui/ribbon/data/home-tab-modify.ts`. Estensione `RibbonCommand` con flag `comingSoon?: boolean` (in `types/ribbon-types.ts`) + `RibbonCommandsApi.onComingSoon: (label: string) => void` (in `context/RibbonCommandContext.tsx`). Tutti i 3 button componenti (`RibbonLargeButton`, `RibbonSmallButton`, `RibbonSplitButton` + `RibbonSplitDropdown`) ora controllano `command.comingSoon` → se true fanno `onComingSoon(t(labelKey))` invece di `onToolChange`. `DxfViewerContent.tsx`: aggiunto `useTranslation('dxf-viewer-shell')` + `handleRibbonComingSoon` callback che chiama `notifications.info(tShell('ribbon.commands.comingSoon', { label }))`, passata via `commands.onComingSoon`. Icone Modify (move/copy/rotate/mirror/scale/stretch/trim/extend/offset/fillet/chamfer/array-rect/array-path/array-polar/explode): 15 SVG inline primitivi in `RibbonButtonIcon.tsx`. CSS `ribbon-tokens.css`: `.dxf-ribbon-btn[data-coming-soon="true"] { opacity: 0.55; font-style: italic }` per discoverability visiva del NotYet status. i18n el+en: `ribbon.commands.{move,copy,rotate,mirror,scale,stretch,trim,extend,offset,fillet,array,explode,comingSoon}` + `filletVariants.{fillet,chamfer}` + `arrayVariants.{rectangular,path,polar}`. ICU placeholder `{label}` (single braces, CHECK 3.9 compliant). Splits con tutti variants comingSoon mantengono struttura ADR §3.2 (Fillet ▾ Fillet/Chamfer, Array ▾ Rect/Path/Polar). **Wiring effettivo**: Move/Copy/Rotate → comandi reali; gli altri 9 tool richiedono `ToolType` + engine DXF separato (fuori scope ADR-345). |
| 2026-05-12 | **Pulsante "A" Testo nel panel DRAW** — Aggiunto split button `draw.text` (icona `text-create`: SVG "A" AutoCAD-style, 2 gambe diagonali + traversa) nella prima row del panel DRAW di `home-tab-draw.ts`. Un'unica variante `text.singleLine` (commandKey `'text'`). Nuova icona SVG `TEXT_CREATE_PATH` + case `'text-create'` in `RibbonButtonIcon.tsx`. i18n el+en: `ribbon.commands.text` + `ribbon.commands.textVariants.singleLine`. Il pulsante attiva il tool `'text'` già esistente (ADR-344 Phase 6.E). |
| 2026-05-12 | **Fase 3 IMPLEMENTATA** — Home tab → panel DRAW wired ai comandi DXF reali. 7 file nuovi: `ui/ribbon/{context/RibbonCommandContext.tsx, hooks/useSplitLastUsed.ts, components/buttons/{RibbonButtonIcon,RibbonLargeButton,RibbonSmallButton,RibbonSplitButton,RibbonSplitDropdown}.tsx, data/home-tab-draw.ts}`. Modifiche: `RibbonPanel.tsx` ora renderizza `panel.rows` (row-size aware: large=row, small=column), `RibbonRoot.tsx` accetta nuova prop `commands: { onToolChange }` e wrappa con `<RibbonCommandProvider>`, `ribbon-default-tabs.ts` importa `HOME_DRAW_PANEL`, `DxfViewerContent.tsx` passa `commands={{ onToolChange: handleToolChange }}`. CSS in `ribbon-tokens.css`: large/small/split button styles + dropdown + minimize-aware label hiding. i18n: `ribbon.commands.{line,polyline,circle,arc,rectangle,polygon,ellipse}` + `circleVariants.{radius,diameter,twoPoint,threePoint}` + `arcVariants.{threePoint,startCenterEnd,centerStartEnd}` + `dropdown.openVariants` (el+en). Persistenza split last-used via `dxf-ribbon:splitLastUsed → Record<commandId, variantId>` (hook `useSplitLastUsed`). Click top-half split = esegue last-used (default = prima variante); click ▾ = dropdown; selezione promuove variante in cima. Icone: riuso `LineIcon`, `CircleIcon` (4 varianti), `ArcIcon` (3 varianti) dal `toolbar/icons/`. Polyline/Polygon/Rectangle/Ellipse → SVG inline primitivi in `RibbonButtonIcon.tsx`. **Scope variants vs §3.1**: implementate solo varianti mappabili a `ToolType` reale (`src/subapps/dxf-viewer/ui/toolbar/types.ts`). Circle: radius / diameter / 2-Point / 3-Point (TTR rinviata — manca ToolType). Arc: 3-Point / Start-Center-End / Center-Start-End (Start+Center+Angle, Start+End+Angle rinviati). Ellipse: variante singola (no split) — Axis+End / Elliptical Arc rinviati. Polygon: singolo. **Test manuali**: 7 button visibili in panel Draw, Line/Polyline/Rectangle/Polygon/Ellipse → tool attivato, Circle▾ / Arc▾ → dropdown varianti, selezione variante = nuovo default persistito su refresh. Tab Layers / drag&drop / minimize states / context menu = nessuna regressione (Fase 1+2 stabile). |
| 2026-05-13 | **Fase 8 IMPLEMENTATA — Migrazione Layering + Fullscreen → Ribbon. Seconda toolbar ora solo Overlay Section + StatusBar** — Layering tool (Map): Home tab → Draw panel come primo `large` button (`commandKey: 'layering'`, `icon: 'layering'`). Fullscreen: View tab → nuovo panel "Window" (`action: 'toggle-fullscreen'`, `icon: 'fullscreen'`). Nuovo file `view-tab-window.ts`. `home-tab-draw.ts`: aggiunto `draw.layering` come primo button. `toolDefinitions.tsx`: `toolGroups` svuotato (array vuoto) — layering ora solo nel Ribbon. Rimossi da `EnhancedDXFToolbar`: import `toolGroups`, `ToolButton`, `Maximize2`, `Minimize2`, `DXF_ACTION_COLORS`; destructuring `isFullscreen`, `layeringDisabled`; intera sezione toolGroups.map + standalone fullscreen button (ADR-241). i18n el+en: `ribbon.panels.window`, `ribbon.commands.{layering,fullscreen}`. Fix typo i18n: `"Κάτωψη (Wizard)"` → `"Κάτοψη (Wizard)"`. 2 nuovi icon cases in `RibbonButtonIcon.tsx` (Map, Maximize2). La seconda toolbar ora contiene SOLO: OverlayToolbarSection (ADR-050, feature-flagged) + ToolbarStatusBar. |
| 2026-05-13 | **Fase 7 IMPLEMENTATA — Migrazione ultimi 4 bottoni toolbar → Ribbon + rimozione seconda toolbar** — Cursor Settings → Settings tab panel "Cursor" (`action: toggle-cursor-settings`). Run Tests + Toggle Perf → Settings tab panel "Developer" (`action: run-tests` / `action: toggle-perf`). AI Assistant → Home tab panel "AI" come ultimo panel a destra (`action: toggle-ai-assistant`). Nuovi file: `home-tab-ai.ts`, `settings-tab-cursor.ts`, `settings-tab-developer.ts`. 4 nuovi icon cases in `RibbonButtonIcon.tsx` (Crosshair/FlaskConical/Activity/Sparkles). i18n el+en: `ribbon.panels.{cursor,developer,ai}`, `ribbon.commands.{cursorSettings,runTests,togglePerf,aiAssistant}`. SSOT: `action-button-definitions.tsx` ELIMINATO (dead code — tutti i bottoni migrati al Ribbon). `toolDefinitions.tsx`: rimosso re-export `createActionButtons`. `EnhancedDXFToolbar`: rimossi import `createActionButtons`/`ActionButton`, rimosso useMemo `actionButtons`, rimosso separator+map dal render, rimosso destructuring `showCursorSettings`. `MobileToolbarLayout`: rimossi import `createActionButtons`/`ActionButton`, rimossa sezione "Action buttons" dallo sheet overflow. La seconda toolbar ora contiene solo: tool buttons di disegno + fullscreen toggle (nessun action button). |
| 2026-05-13 | **Fase 6.1 — Toolbar cleanup: rimozione bottoni duplicati** — Rimossi da `action-button-definitions.tsx` i 3 bottoni già presenti nel Ribbon: `grid` (→ View/Display panel), `autocrop` (→ View/Display panel), `fit` (→ View/Navigate `zoom-extents`, stessa azione). Lucide imports rimossi: `Grid`, `Crop`, `Focus`. Props `showGrid`/`autoCrop`/`snapEnabled` eliminate da `createActionButtons` (nessun bottone rimasto li usa). `EnhancedDXFToolbar`: aggiornata useMemo call + rimossa destructuring di `showGrid`/`autoCrop`/`snapEnabled` dai props. `MobileToolbarLayout`: rimossi i 3 props dall'interface + destructuring + createActionButtons call. La seconda toolbar ora contiene solo: Cursor Settings, Run Tests, Toggle Perf, AI Assistant. |
| 2026-05-13 | **Fase 6 IMPLEMENTATA** — Tab INSERT + migrazione 5 bottoni import/export da `EnhancedDXFToolbar` al Ribbon (AutoCAD/Revit Insert+Output pattern). Nuovo file `ui/ribbon/data/insert-tab.ts` con 4 panels: Εισαγωγή (Wizard Κάτωψης), Αρχεία DXF (Enhanced Import large + Upload Legacy small), Υπόβαθρο (PDF Background), Εξαγωγή (Export Ctrl+E). 5 nuovi Lucide icon cases in `RibbonButtonIcon.tsx` (FileImage/Upload/FolderUp/Wand2/Download). Tab order aggiornato: Home→Insert→Layers→View→Annotate→Settings. SSOT: stato dialogs (`showEnhancedImport`, `showImportWizard`, `showLegacyImport`) lifted da `EnhancedDXFToolbar` a `DxfViewerContent`. 3 nuovi dialog renders in `DxfViewerContent` (DxfImportModal, SimpleProjectDialog, FloorplanImportWizard). Fix pre-existing bug: `RibbonRoot commands.onAction` cambiato da `handleAction` raw a `wrappedHandleAction` (altrimenti toggle-pdf-background e altri azioni speciali non funzionavano dal Ribbon). 3 nuove action intercepts in `useDxfViewerCallbacks.wrappedHandleAction`: `import-dxf-enhanced`, `import-floorplan-wizard`, `import-dxf-legacy`. `EnhancedDXFToolbar`: rimossi 4 bottoni JSX, 2 dialogs, `showSimpleDialog`/`showImportWizard` state, import di `UploadDxfButton`/`SimpleProjectDialog`/`FloorplanImportWizard`/`useTranslation`. `action-button-definitions.tsx`: rimosso bottone `export` (migrato a Ribbon). i18n el+en: `ribbon.tabs.insert`, `ribbon.panels.{dxfFiles,background,exportPanel}`, `ribbon.commands.{floorplanWizard,uploadDxfLegacy,enhancedImport,pdfBackground,exportDxf}`. |
| 2026-05-13 | **Panel labels nascosti** — `.dxf-ribbon-panel-label { display: none }`. Token `--ribbon-panel-label-height: 0px`. Il nome panel ("Ιστορικό", "Σχέδιο"…) in fondo ad ogni sezione rimuove rumore visivo. I 16px recuperati vanno ai bottoni. SSoT: token azzerato, nessun layout che dipende dal valore. |
| 2026-05-13 | **Tab "Layers" RIMOSSA dal Ribbon** — duplicato con floating panel sidebar (tab "Επίπεδα" già presente). `LayersTabContent.tsx` eliminato. `ribbon-default-tabs.ts`: tab `layers` rimossa da `DEFAULT_RIBBON_TABS` + `DEFAULT_RIBBON_TAB_ORDER`. `RibbonRoot`/`RibbonBody`: prop `layersTabContent` rimossa. `DxfViewerContent.tsx`: import + prop rimossi. i18n `ribbon.tabs.layers` rimosso da el+en. Floating panel tab "levels" riabilitata (era disabilitata in Fase 2 per evitare duplicazione). SSoT: `LevelPanel` nel floating panel = unico owner UI dei livelli. |
| 2026-05-13 | **`DxfStatusBar` ELIMINATO** — scaffold Phase 1 §7 mai completato. Coordinate X/Y erano `useState('0.00')` statico (non wired a `ImmediatePositionStore`). Toggles Grid/Snap/Ortho/Polar erano `useState` locali (non wired a `useCadToggles`). Tutto duplicato da: `CadStatusBar` (toggles reali + F-keys) e `ToolbarStatusBar` (coordinate reali). Rimosso da `DxfViewerContent.tsx` (import + JSX). i18n `ribbon.statusBar.*` rimossi da el+en locale. File `ui/ribbon/status-bar/DxfStatusBar.tsx` eliminato. SSoT: `CadStatusBar` = unico owner dei CAD toggles a fondo schermo. |
| 2026-05-14 | **Polygon Crop + Lasso Freehand — split button + 2 tools** — `home-tab-modify.ts`: bottoni `cropWindow`+`lassoCrop` (2 semplici) sostituiti da 1 split button `cropWindow` con 3 varianti (`crop-window`/`polygon-crop`/`lasso-crop`). `RibbonButtonIcon.tsx`: nuovo case `polygon-crop` → `Pentagon` icon (Lucide); `lasso-crop` → `Lasso` invariato. i18n el+en: `ribbon.commands.{polygonCrop}` + `ribbon.commands.cropVariants.{window,polygon,lasso}`. Logica interna: `polygon-crop` = click-to-add-points (Enter chiude), `lasso-crop` = freehand mousedown→drag→mouseup. Dettagli implementazione in ADR-040. |
| 2026-05-14 | **Crop-to-Region: character-level text clipping (`clipText`)** — Vecchio: `clipText` faceva `inRect(e.position, r)` → keep/discard intero label. Nuovo: campionamento per carattere Unicode (`[...e.text]`). `charH = fontSize ?? height ?? 1.0`; `charW = charH * 0.6` (stima aspect ratio monospaziato). Per ogni char i: calcola bbox locale (x0=localStart+i·charW, x1=x0+charW, y∈[0,charH]), ruota i 4 angoli attorno a `e.position` con `rotation` (cosR/sinR), controlla `inRect` su tutti e 4 gli angoli → char parzialmente tagliato = SCARTATO. Caratteri superstiti: testo risultante = `keptIndices.map(i=>chars[i]).join('')`. Nuova `position` = angolo baseline-sinistro del primo char mantenuto. Alignment forzato a `'left'` (posizione già calcolata esatta). Handle: `alignment` left/center/right per `localStart`, `rotation` per testo ruotato, testo spezzato non contiguo (es. finestra a staccionata). `MTextEntity`: invariato (posizione-in-rect) — layout multiriga senza font metrics non campionabile accuratamente. File: `ClipToRegionService.ts`. |
| 2026-05-14 | **Crop-to-Region fix: `clipAngleMeasurement` smart clip** — Vecchio: tutti e 3 i punti (vertex/point1/point2) dovevano essere dentro la rect, altrimenti discard. Nuovo: `vertex` fuori → discard; `vertex` dentro → clipa ogni braccio (vertex→point1, vertex→point2) via Liang-Barsky → entità con bracci troncati al bordo rect. File: `ClipToRegionService.ts`. |
| 2026-05-15 | **Fasi 6.1 + 7 + 8 IMPLEMENTATE** — (1) **Fase 6.1 — Tab SETTINGS**: `DxfSettingsPanel` (General/Specific) embeddato nel ribbon Settings tab via `settingsTabContent` prop chain (`RibbonRoot → RibbonBody`). Pattern: `data-tab-mode="settings"` → flex-col: ribbon panels (cursor/developer) in cima + DxfSettingsPanel sotto (max-h 640px, overflow-y auto). Panel `general` vuoto rimosso. `usePanelNavigation.getDisabledPanels()` → `{ colors: true }` (floating panel tab colors disabilitata). (2) **Fase 7 — Flyout + 4 stati minimize**: `RIBBON_MINIMIZE_CYCLE` esteso da 2 a 4 stati (`full→panel-buttons→panel-titles→tab-names`). `useRibbonState` + `pinnedPanelIds`/`togglePinPanel` con localStorage persistence. `RibbonPanel` rewritten: `normalRows` filtrati, `flyoutRows` mostrati inline sotto il panel body (no portal, no overflow issue). Chevron trigger ▼/▲ + pin button 📌 con `aria-pressed`. Click-outside handler via `mousedown` + `useRef` (non-pinned only). i18n el+en: `ribbon.flyout.{expand,pin,unpin}`. (3) **Fase 8 — Floating panel colors removal**: tab `colors` rimossa da `PanelTabs.tsx`, `case 'colors'` rimosso da `usePanelContentRenderer.tsx`, import `LazyColorPalettePanel as ColorPalettePanel` rimosso dal renderer (`LazyColorPalettePanel` rimane in `LazyLoadWrapper.tsx` — usato nel ribbon). Floating panel ora mostra solo `levels` (rimozione completa floating panel = task futuro quando `levels` migra nel ribbon). ✅ Google-level: YES — SSoT (DxfSettingsPanel unico owner, zero duplicati), race-free (pinnedPanelIds Zustand-like useState + localStorage sync), idempotent (toggle × 2 = stato invariato), proattivo (flyout stato locale chiuso all'avvio = determinista), no-op graceful (onPinToggle opzionale). |
| 2026-05-15 | **Fase 4.2 — Trim tool wired (ADR-350)** — `comingSoon: true` rimosso da entrambi i `modify.trim` button (linee 169-174 + 301 di `home-tab-modify.ts`). Locale `ribbon.commands.trim` cambiata da **"Αποκοπή"** (placeholder) a **"Ψαλίδισμα"** (custom di Giorgio per ADR-350 Q15). Nuovo namespace `tool-hints:trimTool.*` in el+en (prompt pick/standardEdges/extending + mode/edge labels + warnings hatch/locked/noIntersection + eraseArmed/undoEmpty). Full implementation in ADR-350 §Changelog Phase 2. |
| 2026-05-14 | **Crop-to-Region fix Sessione 2: rettangoli spariscono + archi invariati** — (1) `clipRectangleBox`: rettangoli disegnati hanno SOLO `corner1/corner2` (niente `x/y/width/height`). Il vecchio codice leggeva `e.x/e.width` → `undefined` → NaN → entità con `corner1:{NaN,NaN}` → invisibile. Fix: legge `c1 = e.corner1 ?? {x:e.x,y:e.y}`, `c2 = e.corner2 ?? {x:e.x+e.width,...}`. (2) `sampleArcSegments`: `arcFrom3Points` restituisce `counterclockwise` con senso INVERTITO rispetto alla convenzione mondo (Y+UP). `ccw=false` nell'entità → arco visivamente CCW; `ccw=true` → visivamente CW; `ccw=undefined` (DXF) → CCW. Il vecchio `ccw = e.counterclockwise !== false` campionava la direzione SBAGLIATA per archi disegnati → tutti i punti fuori dalla rect → arco restituito invariato. Fix: `ccw = e.counterclockwise !== true` (tabella completa: undefined→true, false→true, true→false). File: `ClipToRegionService.ts`. |
| 2026-05-14 | **Crop-to-Region fix: rettangoli e archi non tagliati** — (1) `clipRectangleBox`: aggiornati `corner1/corner2` nel risultato clippato (`corner1:{x:ix1,y:iy1}`, `corner2:{x:ix2,y:iy2}`). `RectangleRenderer` usa `corner1/corner2` per i vertici (via `getRectangleVertices`), non `x/y/width/height` — senza questo fix disegnava il rettangolo originale. (2) `sampleArcSegments`: cambiato `const ccw = !!e.counterclockwise` → `const ccw = e.counterclockwise !== false`. DXF arcs sono sempre CCW (`counterclockwise: undefined`); il vecchio default `false` (CW) calcolava sweep e angoli nell'altra direzione → campionamento sbagliato → arc non tagliati. File: `src/subapps/dxf-viewer/services/ClipToRegionService.ts`. |
| 2026-05-13 | **Crop-to-Region implementato + completato** — Tool `crop-window` nel panel MODIFY. Architettura: utente disegna marquee → `mouse-handler-up.processMarqueeSelection` intercetta `activeTool==='crop-window'` → converte screen→world via `screenToWorldWithSnapshot` → emette `EventBus.emit('crop:marquee-rect', rect)`. `useDxfViewerState` ascolta con ref pattern (single subscription, sceneStateRef.current per fresh scene) → chiama `ClipToRegionService.clip(currentScene, rect)` → `handleSceneChange`. **Algoritmi per tipo**: `line`→Liang-Barsky, `polyline`/`lwpolyline` chiuso→Sutherland-Hodgman, aperto→chain Liang-Barsky, `circle`→sample+arc, `arc`→sample, `ellipse`→campionamento parametrico 72 step con rotazione, `rectangle`/`rect`→intersez. bbox, `text`/`mtext`/`point`→posizione-in-rect, `spline`→bbox control points (conservativo), `angle-measurement`→tutti 3 punti in rect, `hatch`/`block`/`dimension`/`leader`/`xline`/`ray`→kept unchanged (conservativo). SSOT: tutta la logica di clipping è centralizzata SOLO in `services/ClipToRegionService.ts` (zero duplicati verificati). |
| 2026-05-12 | Status → ACTIVE. **Fase 1 IMPLEMENTATA**: ribbon scaffold + status bar inseriti in `DxfViewerContent.tsx` (full-width tra global header e section esistente). 11 nuovi file: `src/subapps/dxf-viewer/ui/ribbon/{components/RibbonRoot,RibbonTabBar,RibbonTabItem,RibbonBody,RibbonPanel,PanelLabel,RibbonMinimizeButton,RibbonContextMenu, status-bar/DxfStatusBar, hooks/useRibbonState,useRibbonTabDrag, styles/ribbon-tokens.css, types/ribbon-types.ts, data/ribbon-default-tabs.ts}`. 5 tab vuote (Home/Layers/View/Annotate/Settings) con i18n via `dxf-viewer-shell`. localStorage persistence (activeTabId, minimizeState, tabOrder). Drag&drop reorder. 4 stati minimize ciclici (full → panel-buttons → panel-titles → tab-names). Right-click context menu (minimize toggle attivo, altri voci disabled v1). Responsive: viewport <900px → auto-minimize tab-names. Status bar 7 elementi: coordinate (placeholder 0.00/0.00), Grid/Snap/Ortho/Polar (toggle locali), Annotation Scale 1:1, Layer 0. Theme-aware via CSS variables (dark + light tokens). Coesistenza con floating panel + DXF toolbar (transitorio). NESSUN tool funzionante — solo struttura visiva. Floating panel ancora presente, sarà rimosso in Fase 8. |

| 2026-05-14 | **Fase 4.1 — Mirror tool wired (MI)** — `comingSoon: true` rimosso da `home-tab-modify.ts`. 4 nuovi file: (1) `utils/mirror-math.ts` SSoT per `mirrorPoint/mirrorAngle/getAxisAngleDeg/mirrorEntity` — importato da command + preview, zero duplicati. (2) `core/commands/entity-commands/MirrorEntityCommand.ts` — ICommand pattern, `keepOriginals=true` default (crea copie riflesse via `addEntity` + nuovo ID), `keepOriginals=false` (snapshot + `updateEntity`, undo restore). (3) `hooks/tools/useMirrorTool.ts` — state machine 4 fasi, click handler, escape handler, prompt i18next. (4) `hooks/tools/useMirrorPreview.ts` — RAF 60fps PreviewCanvas: asse tratteggiato oro, croce rossa p1, ghost blu alpha 0.4; legge cursor via `useCursorWorldPosition()` diretto (ADR-040). Wiring: `useCanvasClickHandler` priority 1.56, `useCanvasKeyboardShortcuts` Escape, `canvas-layer-stack-leaves` `MirrorPreviewMount` memo. Props chain: `CanvasSection → CanvasLayerStack → PreviewCanvasMounts → MirrorPreviewMount`. i18n el+en: `dxf-viewer-guides:mirrorTool.*` + `tool-hints:mirror`. Exports via `hooks/tools/index.ts`. |
| 2026-05-14 | **FloatingPanel "Ιδιότητες Κειμένου" cleanup — Round 1** — Rimossi: `StylePanel` (Bold/Italic/Underline/Overline/Strikethrough), SizeInput Height/Color/WidthFactor/Oblique/Tracking, `JustificationGrid`. `TextPropertiesPanel.tsx` ridotto a: `FontFamilyCombobox` + `LineSpacingMenu` + `LayerSelectorDropdown` + `AnnotationScaleManager` + `InsertPanel`. |
| 2026-05-14 | **FloatingPanel "Ιδιότητες Κειμένου" cleanup — Round 2 (SSoT completo)** — Rimossi da `TextPropertiesPanel.tsx`: `FontFamilyCombobox`, `LineSpacingMenu`, `LayerSelectorDropdown` (tutti già nel Ribbon ADR-345 Fase 5.5 wired). Props rimosse dalla interface: `layers`, `availableFonts`, `onRequestFontUpload`. Da `TextPropertiesPanelHost.tsx`: rimossi `useTextPanelLayers`, `useTextPanelFonts`, `onRequestFontUpload` callback. Il pannello ora contiene SOLO: `AnnotationScaleManager` + `InsertPanel`. |
| 2026-05-14 | **Ribbon widget: AnnotationScaleManager (Popover) + InsertTokens** — (1) `RibbonAnnotationScaleWidget` rewritten: trigger compatto (Button con nome scala corrente) + `PopoverContent` con `AnnotationScaleManager` completo (max-h 70vh, overflow-y auto) — risolve overflow nel ribbon body. (2) Nuovo `RibbonInsertTokenWidget`: 4 pulsanti ¹⁄₂/⌀/°/± che dispatchano `InsertTextTokenCommand` direttamente (stesso pattern `TextPropertiesPanelHost`). `contextual-text-editor-tab.ts`: panel `text-insert` aggiornato — nuova row `widget 'insert-tokens'` + comingSoon symbol/field rimangono come seconda row. `RibbonPanel.tsx`: aggiunto caso `'insert-tokens'`. i18n el+en: `ribbon.commands.textEditor.insert.tokens`. `usePanelNavigation.getDisabledPanels()`: `text-properties: true` — tab FloatingPanel disabilitata (tutti i controlli nel Ribbon). |
| 2026-05-14 | **Ribbon widget: AnnotationScaleManager** — `text.properties.annotationScale` combobox sostituito con widget `widgetId='annotation-scale'` che renderizza `AnnotationScaleManager` completo (ViewportSection + scale lista + preset + custom input + sync buttons). Nuovo hook `useTextAnnotationScaleSync` estratto da `TextPropertiesPanelHost` (SSoT unico per entity→scales sync). Nuovo file `RibbonAnnotationScaleWidget.tsx`. `TextPropertiesPanel.tsx` ora contiene SOLO `InsertPanel`. `TextPropertiesPanelHost.tsx` ridotto a 30 righe (solo `onInsertToken`). |
| 2026-05-14 | **Ribbon widget: FontFamily + LineSpacing (search+upload + full modes)** — Il `text.font.family` combobox nel Ribbon è stato sostituito con un widget `widgetId='font-family'` che renderizza `FontFamilyCombobox` completo (cmdk search + upload button). Il `text.paragraph.lineSpacing` combobox (4 valori numerici) è stato sostituito con widget `widgetId='line-spacing'` che renderizza `LineSpacingMenu` completo (3 preset + 3 modes: multiple/exact/at-least). Nuovi file: `RibbonFontFamilyWidget.tsx` + `RibbonLineSpacingWidget.tsx` (micro-leaf, ADR-040 compliant). `RibbonPanel.tsx`: aggiunti 2 casi widget. `contextual-text-editor-tab.ts`: rimossa `LINE_SPACING_OPTIONS` const (non più usata). |
| 2026-05-14 | **Lasso Crop tool — panel MODIFY** — Nuovo tool `lasso-crop` aggiunto al panel MODIFY del tab HOME (`home-tab-modify.ts`, shortcut `LC`). Icona: `Lasso` (lucide-react). Architettura ADR-040 compliant: `LassoCropStore` (module-level pub/sub, `systems/lasso/LassoCropStore.ts`, nessun React state), `ClipToPolygonService` (`services/ClipToPolygonService.ts`, algoritmi: ray-casting point-in-polygon per qualsiasi poligono, Sutherland-Hodgman generalizzato per forme chiuse, segment-polygon parametrico per linee), `LassoCropPreviewSubscriber` (micro-leaf dedicato `components/dxf-layout/LassoCropPreviewSubscriber.tsx`, due `useSyncExternalStore`: LassoCropStore + ImmediateSnapStore). Input: click aggiunge punto world-space via PRIORITY 0.5 in `useCanvasClickHandler`; Enter chiude lasso (≥3 punti) via `useCanvasKeyboardShortcuts`; Escape cancella. EventBus: nuovo evento `crop:lasso-polygon` in `DrawingEventMap`. `useDxfViewerState`: listener `crop:lasso-polygon` (stesso pattern crop:marquee-rect), cleanup useEffect cancella LassoCropStore al cambio tool. Undo/redo via `ClipToRegionCommand` riutilizzato invariato. Preview SVG: poligono arancione semi-trasparente + rubber-band line a cursore + linea closing preview + vertex dots (first r=5, rest r=3). i18n: `ribbon.commands.lassoCrop` in el+en. |
| 2026-05-14 | **FloatingPanel "Ιδιότητες Κειμένου" — RIMOSSA completamente (Fase 6 finale)** — Tab `text-properties` eliminata dal FloatingPanel. Modifiche: (1) `panel-types.ts`: `FloatingPanelType = 'levels' | 'colors'` (rimosso `'text-properties'`), `FLOATING_PANEL_TYPES` aggiornato, `PANEL_METADATA` entry rimossa, `isFloatingPanelType` guard aggiornato, `PANEL_LAYOUT.topRow` aggiornato. (2) `PanelTabs.tsx`: rimossa voce `text-properties` + import `Type` da lucide-react. (3) `usePanelContentRenderer.tsx`: rimosso `case 'text-properties'` + import `LazyTextPropertiesPanel`. (4) `DxfViewerContent.tsx`: rimossi 2 useEffect che chiamavano `floatingRef.current?.showTab('text-properties')`. (5) `usePanelNavigation.ts`: `getDisabledPanels()` ora ritorna `{}`. (6) `LazyLoadWrapper.tsx`: rimosso `LazyTextPropertiesPanel` export + tipo `TextPropertiesPanelHostComponent/Props`. Tutti i controlli sono nel Ribbon contextual tab `text-editor`. |
| 2026-05-15 | **Fase 6.1 — Settings tab: DxfSettingsPanel embedded** — `DxfViewerContent` inietta `settingsTabContent={<RibbonSettingsPanel />}` (= `LazyColorPalettePanel`, SSoT già esistente). `RibbonRoot` e `RibbonBody` ricevono prop `settingsTabContent?: React.ReactNode`. `RibbonBody`: quando `activeTab.id === 'settings'` e settingsTabContent presente → `data-tab-mode="settings"` → layout flex-column: pannelli ribbon nella riga superiore + contenuto `DxfSettingsPanel` in area scrollabile sotto (CSS `ribbon-tokens.css`). `usePanelNavigation.getDisabledPanels()` → `{ colors: true }` (FloatingPanel 'colors' disabilitato perché SSoT ora nel Ribbon). `ribbon-default-tabs.ts`: rimosso pannello generico `general` dalla Settings tab (era vuoto). |
| 2026-05-15 | **Fase 7 — Flyout panels con pin** — `RibbonPanel`: supporto `isInFlyout` row flag (filtra `normalRows` vs `flyoutRows`), trigger chevron ▼/▲ per aprire/chiudere flyout, pulsante 📌 pin/unpin. Click fuori chiude flyout non-pinnato (mousedown listener). `useRibbonState`: aggiunge `pinnedPanelIds: string[]` (localStorage `dxf-ribbon:pinnedPanelIds`, `parsePinnedPanelIds`) + `togglePinPanel(panelId)`. `RIBBON_LS_KEYS.pinnedPanelIds` aggiunto in `ribbon-types.ts`. `RibbonRoot` e `RibbonBody` passano `pinnedPanelIds` + `onPinToggle` a `RibbonPanel`. `RIBBON_MINIMIZE_CYCLE` esteso: `full → panel-buttons → panel-titles → tab-names` (nuovi stati intermedi). i18n el: `ribbon.flyout.{expand,pin,unpin}`. |
| 2026-05-17 | **Fase 5.6 — Active-tool visual highlight per Large / Small / Split buttons** — Bug: cliccando un tool nel Ribbon (es. Line, Polyline, Rectangle, Layering) il pulsante non mostrava di essere il tool attivo (nessun feedback visivo). Solo i Toggle/Tab buttons rispondevano. Causa radice: i tre componenti tool-button (`RibbonLargeButton`, `RibbonSmallButton`, `RibbonSplitButton`) chiamavano `onToolChange(commandKey)` ma non leggevano mai indietro `activeTool` dal contesto — il context API non lo esponeva. Fix SSoT: `RibbonCommandsApi.activeTool: ToolType \| null` (opzionale, default `null`) aggiunto in `context/RibbonCommandContext.tsx` + propagato in `RibbonCommandContextValue`. `useRibbonCommands` (hooks) accetta nuova prop `activeTool` e la inoltra invariata — zero duplicazione, SSoT resta `useDxfViewerState.activeTool` (→ `ToolStateStore`). `DxfViewerContent.tsx` passa `activeTool` (già destrutturato in scope) a `useRibbonCommands`. Render: `RibbonLargeButton` + `RibbonSmallButton` calcolano `isActive = !comingSoon && !action && activeTool === command.commandKey` e settano `aria-pressed={isActive\|\|undefined}` + `data-active="true"`. `RibbonSplitButton` calcola `isActive` se ALMENO UNA variante mappa al tool corrente (utente vede attivo "Line" anche quando è in `line-parallel`/`line-perpendicular`); attributo `data-active` sul wrapper `<div className="dxf-ribbon-btn-split">`. CSS `ribbon-tokens.css`: `.dxf-ribbon-btn[data-active="true"]` (background `--ribbon-btn-active` blu accent + foreground bianco + hover brightness 1.1), `.dxf-ribbon-btn-split[data-active="true"]` (stesso pattern, propagato a `.dxf-ribbon-btn-split-top` + `.dxf-ribbon-btn-split-arrow`, hover dei sotto-bottoni usa overlay bianco 12% alpha). Action-buttons (es. `zoom-extents`, `toggle-fullscreen`, `import-dxf-enhanced`) e comingSoon stub NON ricevono active state (stateless). Coerente con pattern già in uso: `.dxf-status-bar-item[data-on="true"]` (status-bar toggles), `.dxf-ribbon-btn-toggle[data-pressed="true"]` (toggle buttons), `.dxf-ribbon-tab[data-active="true"]` (tab bar). ✅ Google-level: YES — proactive (deriva da SSoT esistente, no nuovo state), race-free (single source `ToolStateStore`), idempotent (re-render con stesso activeTool = stesso DOM), SSoT (`activeTool` resta in `ToolStateStore`, ribbon è puro consumer), no fallback shim (null = no highlight, deterministic), lifecycle (context value memoized — invalida ribbon consumers solo a tool change reale ~5×/sec max, ben sotto budget ADR-040). |
| 2026-05-17 | **Fase 5.6 follow-up — SSoT predicate extraction** — Audit post-implementazione: la condizione `isActive` era duplicata 3 volte (Large + Small + Split) violando SOS N.0 / N.12 SSoT. Estratto in nuovo file `ui/ribbon/utils/ribbon-active-state.ts` con 2 export: `isCommandActive(command, activeTool)` (regola unica per Large/Small: skip se `comingSoon` / `action` / `activeTool=null`, altrimenti `commandKey === activeTool`) e `isAnyVariantActive(variants, activeTool)` (Split: active se almeno una variante mappa al tool corrente, riusa `isCommandActive` per ogni variante). `RibbonLargeButton` + `RibbonSmallButton` + `RibbonSplitButton` ora importano e chiamano l'helper — zero duplicazione, una sola location da aggiornare se la regola evolve (es. future "soft-active" per action buttons stateful). ✅ Google-level: YES — SSoT singolo (`ribbon-active-state.ts`), no copy-paste, no behavior change (helper è pure function dello stesso predicate). |
| 2026-05-28 | **Global app-header toggle su /dxf/viewer** — Richiesta Giorgio: l'header GLOBALE dell'app (sidebar trigger, search, company switcher, notifiche, user menu di `src/components/app-header.tsx`) ruba spazio verticale al canvas CAD. Soluzione low-risk senza plumbing React cross-boundary: nuovo hook SSoT `ui/ribbon/hooks/useDxfGlobalHeaderToggle.ts` (unico writer dell'attributo `data-dxf-header-hidden` su `<html>`, default **hidden** ad ogni mount del viewer, attributo pulito on-unmount → altre route mai toccate, **no localStorage** per scelta esplicita di Giorgio) + nuovo componente `ui/ribbon/components/RibbonHeaderToggleButton.tsx` (icona Lucide `PanelTopOpen`/`PanelTopClose`, Tooltip Radix — niente `title=` per CHECK 3.23, `aria-pressed`). Montato in `RibbonTabBar.tsx` come PRIMO figlio della tab-bar (a sinistra della tab «Αρχικό»), speculare al `RibbonMinimizeButton` a destra. CSS `ribbon-tokens.css`: nuova regola route-scoped `html[data-dxf-header-hidden="true"] header.sticky.top-0 { display: none }` + classe `.dxf-ribbon-header-toggle-button` (26px, mirror dello stile minimize). i18n el+en: `ribbon.ariaLabels.toggleHeader` + `ribbon.headerToggle.{show,hide}`. ✅ Google-level: YES — SSoT (un solo writer dell'attributo), race-free (DOM attribute puro, nessun store ad alta frequenza ADR-040), idempotent (toggle ×2 = stesso stato), proactive (default settato al mount, non come side-effect), lifecycle esplicito (cleanup React on-unmount). |
| 2026-05-28 | **Fase 5.7 — Undo/Redo nella tab bar** — Richiesta Giorgio: due pulsanti Undo/Redo nella tab bar, TRA il pulsante header-toggle e la tab «Αρχικό». Nuovo componente `ui/ribbon/components/RibbonUndoRedoButtons.tsx` (icone Lucide `Undo2`/`Redo2`, Tooltip Radix — CHECK 3.23, niente `title=`) montato in `RibbonTabBar.tsx` come secondo elemento (dopo `RibbonHeaderToggleButton`, prima della `dxf-ribbon-tab-list`). Riusa il pipeline esistente: `onAction('undo'\|'redo')` → `handleAction` → CommandHistory (ADR-032), lo stesso del panel Home › History e di Ctrl+Z/Ctrl+Y — zero nuova logica. **Disabled state (scelta Giorgio, opzione "Google-level"):** aggiunti `canUndo`/`canRedo` a `RibbonCommandsApi` + `RibbonCommandContextValue` (default `false`), propagati da `useDxfViewerState.canUndo/canRedo` → `useRibbonCommands` → context. I bottoni si disabilitano (greyed, opacity 0.35) quando non c'è nulla da annullare/ripetere, come Word/AutoCAD. CSS `ribbon-tokens.css`: `.dxf-ribbon-tabbar-actions` (flex group) + `.dxf-ribbon-tabbar-action-button` (26px, mirror minimize) + `:disabled`. i18n: riusa `ribbon.commands.undo`/`redo` esistenti (nessuna nuova chiave). ✅ Google-level: YES — SSoT (CommandHistory unico owner, ribbon puro consumer), no duplicazione (riusa onAction pipeline + label esistenti), idempotent, race-free (canUndo/canRedo derivati, no nuovo state), context memoizzato (re-render solo a cambio availability). |
| 2026-05-28 | **Fase 5.7 dedup — rimosso `HOME_HISTORY_PANEL` dalla tab Home** — Dato che Undo/Redo ora vivono nella tab bar sempre-visibile (Fase 5.7 sopra), i pulsanti nel panel Home › «Ιστορικό» erano una duplicazione (stesso `onAction('undo'\|'redo')`). Rimossi: import + entry `HOME_HISTORY_PANEL` da `ribbon-default-tabs.ts` (era il primo panel della tab Home); file `ui/ribbon/data/home-tab-history.ts` ELIMINATO (dead code). Locale `ribbon.panels.history` resta nei JSON (orfano innocuo). SSoT: Undo/Redo = unico punto nella tab bar. |
| 2026-05-28 | **Rimosso pulsante «Επεξεργασία Λαβών» (grip-edit) dal panel Home › Modify** — Segnalazione Giorgio: cliccando un'entità in `select` le grips compaiono GIÀ ed sono interattive, quindi il pulsante era ridondante. Audit codice conferma: le grips sono *mostrate* in `select`/`grip-edit`/`layering` (`useDxfViewerEffects.ts:252`), ma l'*interazione* (drag/hover-menu/spacebar-cycle/context-menu) è gated su `isGripMode = activeTool === 'select' \|\| activeTool === 'layering'` (`useUnifiedGripInteraction.ts:169` + 3 hook gemelli) — `grip-edit` NON è incluso. Quindi il tool `grip-edit` mostrava grips NON trascinabili: ridondante con `select` e parzialmente rotto. Rimosso solo il button `modify.gripEdit` da `home-tab-modify.ts`. **ToolType `'grip-edit'` mantenuto** — ancora usato da `LevelPanel.tsx` (228/237/319) nel flusso overlay/layering. Locale `ribbon.commands.gripEdit` resta nei JSON (orfano innocuo). SSoT: `select` = unico punto d'ingresso al grip editing per le entità DXF. |

---

## Fonti

- [AutoCAD 2024 Help — About the Ribbon](https://help.autodesk.com/view/ACD/2024/ENU/?guid=GUID-D20EF1D7-4135-48A7-B68E-65BF3BFF3D70)
- [AutoCAD Ribbon Customization — Autodesk Blog](https://www.autodesk.com/blogs/autocad/a-guide-to-autocad-ribbon-customization/)
- [CUI Ribbon Panels — CADnotes](https://www.cad-notes.com/exploring-autocad-cui-working-with-ribbon-part-3/)
- [AutoCAD ARC Command variants — CADMasterCoach](https://cadmastercoach.com/commands/create/arc)
- [AutoCAD 2025 Status Bar — Arkance UK](https://ukcommunity.arkance.world/hc/en-us/articles/21551000713362-AutoCAD-2025-The-Status-Bar)
- [Contextual Tab States — AutoCAD 2022 Help](https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-E0353176-0BDA-440B-B7DD-0AFD84A2D2F2.htm)
- [Supporting AutoCAD Dark Theme — Kean Walmsley](https://keanw.com/2014/04/supporting-autocad-2015s-dark-theme.html)
