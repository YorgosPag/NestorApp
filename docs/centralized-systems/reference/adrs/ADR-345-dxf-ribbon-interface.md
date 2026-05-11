# ADR-345: DXF Viewer — Ribbon Interface (AutoCAD-style)

**Status**: ACCEPTED
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
- **Levels tab** → ribbon tab `Layers` (Fase 2) — già strutturato, migrazione rapida
- **DXF Settings** → ribbon tab `Settings` (Fase 5+) — complesso, richiede redesign UX
- **Text Properties** → ribbon tab contestuale `Text Editor` (Fase 5) — già è un pannello contestuale

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
          <RibbonCombobox />
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

### Fase 2 — Tab LAYERS (migrazione rapida dal floating panel) ← PRIORITÀ CONFERMATA
- Migrazione contenuto `LevelPanel.tsx` nel ribbon tab Layers
- Layer visibility, colori, rename, delete, merge
- Import floorplan + Load from Storage buttons
- **Floating panel: tab Levels disabilitato**

### Fase 3 — Tab HOME, panel DRAW
- `LargeButton`, `SmallButton`, `SplitButton` con split-last-used persistence
- Line, Polyline, Circle (split), Arc (split), Rectangle, Polygon, Ellipse (split)
- Collegamento ai comandi DXF viewer esistenti
- **Floating panel disabilitato per questi tool**

### Fase 4 — Panel MODIFY
- Move, Copy, Rotate, Mirror, Scale, Trim, Extend, Offset, Fillet, Array

### Fase 5 — Tab VIEW + contextual tabs
- Visual styles, zoom, pan controls
- Text Editor tab contestuale (migrazione TextPropertiesPanel.tsx)

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

---

## Fonti

- [AutoCAD 2024 Help — About the Ribbon](https://help.autodesk.com/view/ACD/2024/ENU/?guid=GUID-D20EF1D7-4135-48A7-B68E-65BF3BFF3D70)
- [AutoCAD Ribbon Customization — Autodesk Blog](https://www.autodesk.com/blogs/autocad/a-guide-to-autocad-ribbon-customization/)
- [CUI Ribbon Panels — CADnotes](https://www.cad-notes.com/exploring-autocad-cui-working-with-ribbon-part-3/)
- [AutoCAD ARC Command variants — CADMasterCoach](https://cadmastercoach.com/commands/create/arc)
- [AutoCAD 2025 Status Bar — Arkance UK](https://ukcommunity.arkance.world/hc/en-us/articles/21551000713362-AutoCAD-2025-The-Status-Bar)
- [Contextual Tab States — AutoCAD 2022 Help](https://help.autodesk.com/cloudhelp/2022/ENU/AutoCAD-Core/files/GUID-E0353176-0BDA-440B-B7DD-0AFD84A2D2F2.htm)
- [Supporting AutoCAD Dark Theme — Kean Walmsley](https://keanw.com/2014/04/supporting-autocad-2015s-dark-theme.html)
