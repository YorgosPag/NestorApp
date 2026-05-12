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
| Large | **Line** (L) | — |
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
- Al mount: legge ordine da localStorage → fallback ordine default `['home','layers','view','annotate','settings']`

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
| `--ribbon-bg` | `#2D2D2D` | `#F0F0F0` |
| `--ribbon-tab-bar-bg` | `#252525` | `#E0E0E0` |
| `--ribbon-tab-active` | `#3C3C3C` | `#FFFFFF` |
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
2. **Tab bar** — ordine e nomi confermati: `Home | Layers | View | Annotate | Settings` — label via i18n (el default, en se cambia lingua). Pattern identico al resto dell'app (N.11).
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
- ✅ Line, Polyline, Rectangle, Polygon, Ellipse (simple) — wireati a `ToolType` reali
- ✅ Circle ▾ (4 varianti: radius/diameter/2P/3P), Arc ▾ (3 varianti: 3P/SCE/CSE)
- ⏳ Floating panel NON ancora disabilitato per questi tool (rimozione → Fase 8)
- ⚠️ Varianti rinviate (manca `ToolType` mappabile): Circle TTR, Arc SCA/SEA, Ellipse Axis+End/Arc

### Fase 4 — Panel MODIFY ✅ COMPLETATA 2026-05-12 (parziale wiring)
- ✅ 12 button visibili nel panel Modify (Move/Copy/Rotate/Mirror/Scale/Stretch large + Trim/Extend/Offset/Fillet▾/Array▾/Explode small)
- ✅ Wireati a `ToolType` reale: **Move (M), Copy (CO), Rotate (RO)**
- ⏳ `comingSoon: true` → toast "Σύντομα διαθέσιμο: <label>" via `notifications.info`: Mirror, Scale, Stretch, Trim, Extend, Offset, Fillet, Chamfer, Array (Rect/Path/Polar), Explode
- ✅ Pattern stub: `RibbonCommand.comingSoon?: boolean` + `RibbonCommandsApi.onComingSoon` Context bridge
- ⚠️ Wiring effettivo dei 9 tool richiede implementazione `ToolType` + engine DXF (Mirror/Scale/Stretch/Trim/Extend/Offset/Fillet/Array/Explode) — fuori scope ADR-345

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

**Commit semantics (Fase 5.5 v1)**
- Il bridge scrive **solo** su `useTextToolbarStore` (pending values). La catena `store → UpdateTextStyleCommand/UpdateMTextParagraphCommand → CommandHistory` è proprietà di **ADR-344 Phase 6+** (TipTap editor session). Quando quella catena chiude, ogni mutazione ribbon fluisce automaticamente nel doc via CommandHistory — nessun cambio necessario qui.
- Pattern coerente con `TextPropertiesPanel.tsx` esistente (che parimenti scrive solo nello store).

**Data declaration (`data/contextual-text-editor-tab.ts`)**
- Font panel: combobox `font.family` (180px) · combobox `font.height` (80px, statico 1.0/2.5/3.5/5/7/10) · toggle bold · toggle italic · toggle underline
- Paragraph panel: toggle align.left/center/right (mutually exclusive via justification) · combobox `lineSpacing` (90px, statico 1.0/1.15/1.5/2.0)
- Properties panel: combobox `layer` (160px, dinamico) · combobox `annotationScale` (110px, dinamico)
- Insert panel: button `symbol` (comingSoon) · button `field` (comingSoon)
- Editor Tools panel: button `findReplace` (comingSoon — FindReplaceDialog wiring di ADR-344 Phase 9) · toggle `spellCheck` (comingSoon — engine assente)

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

### Fase 6 — Tab SETTINGS (migrazione DXF Settings)
- Redesign UX rispetto al floating panel (più semplice)
- Lines, Grips, Cursor, Grid, Background
- **Floating panel: tab DXF Settings disabilitato**

### Fase 7 — Flyout expand + minimize states
- Panel flyout con slide-down animation
- Pin button
- 4 stati minimize con doppio-click

### Fase 8 — Floating panel removal
- Rimozione completa floating panel
- Verifica coverage 100% tool migrati

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
| 2026-05-12 | **Fase 5.5 IMPLEMENTATA** — Text Editor contextual tab wiring. Due nuovi button types ADR §4.4-4.5: `RibbonToggleButton.tsx` (aria-pressed + data-pressed/mixed states, priority dispatch `comingSoon > action > toggle`) e `RibbonCombobox.tsx` (wrapper Radix Select ADR-001 canonico, larghezza variabile via CSS var `--ribbon-combobox-width` settata con `ref.style.setProperty` per SOS N.3 compliance, mixed value → em-dash placeholder). Estensione API: `RibbonCommand.options` + `comboboxWidthPx`, nuovo type `RibbonComboboxOption { value, labelKey, isLiteralLabel }`, `RibbonCommandsApi` con `onToggle/onComboboxChange/getToggleState/getComboboxState` (tutti opzionali, fallback no-op). `RibbonPanel.renderButton` dispatch esteso con `case 'toggle'` + `case 'combobox'`. **Bridge** `hooks/useRibbonTextEditorBridge.ts` + 4 helpers SRP (`bridge/command-keys.ts` SSoT costanti, `bridge/toggle-handlers.ts` apply+read toggles (alignment mutually exclusive via `justification` ML/MC/MR), `bridge/combobox-handlers.ts` build dynamic option lists fonts/layers/scales, `bridge/combobox-apply.ts` setValue + parsing numerico difensivo + `setActiveScale()` su annotationScale change). Bridge legge `useTextToolbarStore` + `useTextPanelFonts/Layers` + `useScaleList/useActiveScale` (ADR-040 leaf subscriptions). **Commit semantics v1**: bridge scrive solo su store pending values; catena `store → UpdateTextStyleCommand → CommandHistory` rimane di ADR-344 Phase 6+ (TipTap session). Coerente con `TextPropertiesPanel.tsx` esistente. **Data file rewritten** `data/contextual-text-editor-tab.ts`: 12 button wired (font.family/height combobox + bold/italic/underline toggle + align.left/center/right toggle + lineSpacing combobox + layer/annotationScale combobox) + 4 comingSoon (insert symbol/field, editor findReplace/spellCheck — placeholder UX per release v1). Wiring in `DxfViewerContent.tsx`: `useRibbonTextEditorBridge()` sempre montato, handlers passati a `<RibbonRoot commands>`. **Floating panel** sidebar tab `text-properties` DISABILITATA in `usePanelNavigation.getDisabledPanels()` (ora `{ levels: true, 'text-properties': true }`). CSS `ribbon-tokens.css`: `.dxf-ribbon-btn-toggle[data-pressed]` (sfondo accent + hover brightness 1.1), `[data-mixed]` (border dashed), `.dxf-ribbon-combobox-trigger` (width CSS var, height 24px, font 12px). i18n el+en: `ribbon.commands.textEditor.{font,style,paragraph,properties,insert,editor}.*` (pure greek: Έντονα/Πλάγια/Υπογράμμιση/Στοίχιση Αριστερά|Κέντρο|Δεξιά/Διάστιχο/Επίπεδο/Κλίμακα Σχολιασμού/Σύμβολο/Πεδίο/Εύρεση και Αντικατάσταση/Ορθογραφικός Έλεγχος). Placeholder keys vecchi rimossi. ✅ Google-level: YES — proactive (bridge sempre montato), race-free (Zustand sync), idempotent (toggle ×2 = stesso stato), belt-and-suspenders (parsing numerico Number.isFinite + >0, no-op fallback handlers), SSoT (store = UI pending, ViewportStore = scale active), await (sync), lifecycle (React cleanup automatico). |
| 2026-05-12 | **Fase 5 IMPLEMENTATA** (5A pieno, 5B scaffolding). **5A — Tab VIEW**: 3 nuovi file data (`ui/ribbon/data/{view-tab-navigate,view-tab-visual-styles,view-tab-viewports}.ts`) → 3 panels Navigate/Visual Styles/Viewports. Estensione `RibbonCommandsApi` con `onAction: (action: string, data?: number\|string\|Record) => void` + `RibbonCommand.action?: string` + `actionData?` (in `context/RibbonCommandContext.tsx` + `types/ribbon-types.ts`). Priority dispatch su tutti i 4 button components: `comingSoon > action > tool`. Wiring: `DxfViewerContent.tsx` passa `commands.onAction = handleAction` (riusa cases zoom-extents/zoom-reset esistenti in `useDxfViewerState.handleAction`). 19 nuove icone SVG inline in `RibbonButtonIcon.tsx` (pan, zoom, zoom-in/out/window/extents/previous/realtime/reset, visual-2d/hidden/realistic/shaded/conceptual, viewport-single/two/three/four, text-placeholder). **5B — Contextual tab Text Editor (scaffolding)**: nuovo file `data/contextual-text-editor-tab.ts` con tab `text-editor` (isContextual + contextualTrigger `'text-selected'`) + 5 panels placeholder (Font/Paragraph/Properties/Insert/Editor) tutti `comingSoon`. **Controlled prop pattern** (decisione Plan Mode Q&A 2026-05-12 → opzione "most enterprise"): `RibbonRoot` accetta `contextualTabs?: readonly RibbonTab[]` + `activeContextualTrigger?: string \| null`. `DxfViewerContent` deriva il trigger via `useMemo` da `primarySelectedId` + `currentScene.entities.find(e => e.id === primarySelectedId)` → se `entity.type === 'text' \| 'mtext'` → `'text-selected'`. Auto-attivazione tab contestuale all'apparizione + auto-revert a `'home'` quando deselect, via `useEffect` con `prevContextualIdsRef` in `RibbonRoot`. CSS contextual: aggiunte regole `border-top: 2px solid accent` + `margin-left: 4px` + `font-weight: 600` su `.dxf-ribbon-tab[data-contextual="true"]`. i18n (el+en): `ribbon.tabs.textEditor`, `ribbon.panels.{visualStyles,viewports,font,paragraph,textProperties,insert,editor}`, `ribbon.commands.{pan,zoom,zoomExtents,zoomPrevious,zoomRealtime,zoomReset}` + nested `zoomVariants`/`visualStyles`/`viewports`/`textEditor`. Pure greek locale (no English words, anche "Realistic" → "Ρεαλιστικό"). **Wiring controlli Text Editor (font combobox, bold/italic/underline, layer dropdown, find/replace)** → rinviato a Fase 5.5 (richiede `RibbonCombobox` + `RibbonToggleButton` components, ADR §4.4-4.5). Floating panel sidebar tab `text-properties` resterà attivo fino a Fase 5.5. ✅ Google-level: YES — proactive (trigger deriva da selection state esistente, no fire-and-forget), idempotent (memoized derivation, switch tab = setState), race-free (controlled prop = pure data flow React), SSoT (un solo `activeContextualTrigger`), belt-and-suspenders (fallback `'home'` se contextual scompare mentre attivo). |
| 2026-05-12 | **Fase 5.5 wiring COMPLETATO** — `RibbonPanel.tsx` dispatch esteso con `case 'toggle'` + `case 'combobox'` (import `RibbonToggleButton` + `RibbonCombobox`). `usePanelNavigation.getDisabledPanels()` aggiornato: `{ levels: true, 'text-properties': true }` — sidebar text-properties tab disabilitata (contenuto migrato in contextual tab ribbon). `DxfViewerContent.tsx` wiring bridge + contextual trigger. i18n el+en allineati. |
| 2026-05-12 | **Fase 2 IMPLEMENTATA** — Migrazione `LevelPanel.tsx` nel ribbon tab `Layers`. Decisione UX: tab Layers usa **expanded workspace mode** (body height auto, max 720px / 70vh, scroll) invece di panels orizzontali — pattern Revit-style per contenuto ricco. Nuovo file `src/subapps/dxf-viewer/ui/ribbon/tabs/LayersTabContent.tsx` che wireare `LevelPanel` via `useLayerOperations` + `useLevels` + `useFloatingPanelState` (stesso wiring di `FloatingPanelContainer`). Composition pattern: `RibbonRoot` accetta prop `layersTabContent?: ReactNode`, `DxfViewerContent` istanzia `<LayersTabContent>` con scene/tool/selection/onSceneImported wired da `useDxfViewerState`. `RibbonBody` aggiunge `data-tab-mode="expanded"` quando layers tab attivo. CSS `.dxf-ribbon-body[data-tab-mode="expanded"]` con height auto + max 720px. `ribbon-default-tabs.ts`: Layers tab → `panels: []` (no horizontal panels). **Floating panel sidebar sx**: tab `levels` DISABILITATA via `usePanelNavigation.getDisabledPanels()` (LevelPanel ora vive solo nel ribbon, no duplicazione). Tab `colors` e `text-properties` restano attive in sidebar. Funzionalità preservate: visibility/colori/rename/delete/merge layers, import floorplan wizard, load from storage, livelli list, overlay list. |
| 2026-05-12 | **Fase 4 IMPLEMENTATA** (parziale wiring) — Home tab → panel MODIFY popolato con 12 button. Nuovo file `ui/ribbon/data/home-tab-modify.ts`. Estensione `RibbonCommand` con flag `comingSoon?: boolean` (in `types/ribbon-types.ts`) + `RibbonCommandsApi.onComingSoon: (label: string) => void` (in `context/RibbonCommandContext.tsx`). Tutti i 3 button componenti (`RibbonLargeButton`, `RibbonSmallButton`, `RibbonSplitButton` + `RibbonSplitDropdown`) ora controllano `command.comingSoon` → se true fanno `onComingSoon(t(labelKey))` invece di `onToolChange`. `DxfViewerContent.tsx`: aggiunto `useTranslation('dxf-viewer-shell')` + `handleRibbonComingSoon` callback che chiama `notifications.info(tShell('ribbon.commands.comingSoon', { label }))`, passata via `commands.onComingSoon`. Icone Modify (move/copy/rotate/mirror/scale/stretch/trim/extend/offset/fillet/chamfer/array-rect/array-path/array-polar/explode): 15 SVG inline primitivi in `RibbonButtonIcon.tsx`. CSS `ribbon-tokens.css`: `.dxf-ribbon-btn[data-coming-soon="true"] { opacity: 0.55; font-style: italic }` per discoverability visiva del NotYet status. i18n el+en: `ribbon.commands.{move,copy,rotate,mirror,scale,stretch,trim,extend,offset,fillet,array,explode,comingSoon}` + `filletVariants.{fillet,chamfer}` + `arrayVariants.{rectangular,path,polar}`. ICU placeholder `{label}` (single braces, CHECK 3.9 compliant). Splits con tutti variants comingSoon mantengono struttura ADR §3.2 (Fillet ▾ Fillet/Chamfer, Array ▾ Rect/Path/Polar). **Wiring effettivo**: Move/Copy/Rotate → comandi reali; gli altri 9 tool richiedono `ToolType` + engine DXF separato (fuori scope ADR-345). |
| 2026-05-12 | **Fase 3 IMPLEMENTATA** — Home tab → panel DRAW wired ai comandi DXF reali. 7 file nuovi: `ui/ribbon/{context/RibbonCommandContext.tsx, hooks/useSplitLastUsed.ts, components/buttons/{RibbonButtonIcon,RibbonLargeButton,RibbonSmallButton,RibbonSplitButton,RibbonSplitDropdown}.tsx, data/home-tab-draw.ts}`. Modifiche: `RibbonPanel.tsx` ora renderizza `panel.rows` (row-size aware: large=row, small=column), `RibbonRoot.tsx` accetta nuova prop `commands: { onToolChange }` e wrappa con `<RibbonCommandProvider>`, `ribbon-default-tabs.ts` importa `HOME_DRAW_PANEL`, `DxfViewerContent.tsx` passa `commands={{ onToolChange: handleToolChange }}`. CSS in `ribbon-tokens.css`: large/small/split button styles + dropdown + minimize-aware label hiding. i18n: `ribbon.commands.{line,polyline,circle,arc,rectangle,polygon,ellipse}` + `circleVariants.{radius,diameter,twoPoint,threePoint}` + `arcVariants.{threePoint,startCenterEnd,centerStartEnd}` + `dropdown.openVariants` (el+en). Persistenza split last-used via `dxf-ribbon:splitLastUsed → Record<commandId, variantId>` (hook `useSplitLastUsed`). Click top-half split = esegue last-used (default = prima variante); click ▾ = dropdown; selezione promuove variante in cima. Icone: riuso `LineIcon`, `CircleIcon` (4 varianti), `ArcIcon` (3 varianti) dal `toolbar/icons/`. Polyline/Polygon/Rectangle/Ellipse → SVG inline primitivi in `RibbonButtonIcon.tsx`. **Scope variants vs §3.1**: implementate solo varianti mappabili a `ToolType` reale (`src/subapps/dxf-viewer/ui/toolbar/types.ts`). Circle: radius / diameter / 2-Point / 3-Point (TTR rinviata — manca ToolType). Arc: 3-Point / Start-Center-End / Center-Start-End (Start+Center+Angle, Start+End+Angle rinviati). Ellipse: variante singola (no split) — Axis+End / Elliptical Arc rinviati. Polygon: singolo. **Test manuali**: 7 button visibili in panel Draw, Line/Polyline/Rectangle/Polygon/Ellipse → tool attivato, Circle▾ / Arc▾ → dropdown varianti, selezione variante = nuovo default persistito su refresh. Tab Layers / drag&drop / minimize states / context menu = nessuna regressione (Fase 1+2 stabile). |
| 2026-05-12 | Status → ACTIVE. **Fase 1 IMPLEMENTATA**: ribbon scaffold + status bar inseriti in `DxfViewerContent.tsx` (full-width tra global header e section esistente). 11 nuovi file: `src/subapps/dxf-viewer/ui/ribbon/{components/RibbonRoot,RibbonTabBar,RibbonTabItem,RibbonBody,RibbonPanel,PanelLabel,RibbonMinimizeButton,RibbonContextMenu, status-bar/DxfStatusBar, hooks/useRibbonState,useRibbonTabDrag, styles/ribbon-tokens.css, types/ribbon-types.ts, data/ribbon-default-tabs.ts}`. 5 tab vuote (Home/Layers/View/Annotate/Settings) con i18n via `dxf-viewer-shell`. localStorage persistence (activeTabId, minimizeState, tabOrder). Drag&drop reorder. 4 stati minimize ciclici (full → panel-buttons → panel-titles → tab-names). Right-click context menu (minimize toggle attivo, altri voci disabled v1). Responsive: viewport <900px → auto-minimize tab-names. Status bar 7 elementi: coordinate (placeholder 0.00/0.00), Grid/Snap/Ortho/Polar (toggle locali), Annotation Scale 1:1, Layer 0. Theme-aware via CSS variables (dark + light tokens). Coesistenza con floating panel + DXF toolbar (transitorio). NESSUN tool funzionante — solo struttura visiva. Floating panel ancora presente, sarà rimosso in Fase 8. |

---

## Fonti

- [AutoCAD 2024 Help — About the Ribbon](https://help.autodesk.com/view/ACD/2024/ENU/?guid=GUID-D20EF1D7-4135-48A7-B68E-65BF3BFF3D70)
- [AutoCAD Ribbon Customization — Autodesk Blog](https://www.autodesk.com/blogs/autocad/a-guide-to-autocad-ribbon-customization/)
- [CUI Ribbon Panels — CADnotes](https://www.cad-notes.com/exploring-autocad-cui-working-with-ribbon-part-3/)
- [AutoCAD ARC Command variants — CADMasterCoach](https://cadmastercoach.com/commands/create/arc)
- [AutoCAD 2025 Status Bar — Arkance UK](https://ukcommunity.arkance.world/hc/en-us/articles/21551000713362-AutoCAD-2025-The-Status-Bar)
- [Contextual Tab States — AutoCAD 2022 Help](https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-E0353176-0BDA-440B-B7DD-0AFD84A2D2F2.htm)
- [Supporting AutoCAD Dark Theme — Kean Walmsley](https://keanw.com/2014/04/supporting-autocad-2015s-dark-theme.html)
