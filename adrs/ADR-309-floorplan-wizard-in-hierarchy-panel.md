# ADR-309: Floating Panel Restructure — 2 Tabs + Wizard in Επίπεδα

**Status**: ✅ APPROVED — Ready for implementation
**Date**: 2026-04-16
**Author**: Claude (Sonnet 4.6) + Γιώργος Παγώνης
**Category**: DXF Viewer / UX / Import System
**Relates to**: ADR-179, ADR-240, ADR-258, ADR-286, SPEC-237D

---

## 1. Κίνητρο

Το floating panel του DXF Viewer έχει 4 tabs:
`levels` | `hierarchy` | `overlay` | `colors`

Μετά από ανάλυση (2026-04-16) διαπιστώθηκε:

| Tab | Πρόβλημα |
|-----|---------|
| **Ιεραρχία** | Πλήρης αναπαραγωγή του wizard (βήματα 1-4). Μηδενική αξία. |
| **Επικάλυψη** | Το overlay management ανήκει inline στα Επίπεδα όταν φορτωθεί κάτοψη ορόφου. |
| **Επίπεδα** | Λείπει το κουμπί εισαγωγής κάτοψης. Ο χρήστης δεν ξέρει ότι υπάρχει wizard. |
| **Ρυθμίσεις** | OK — παραμένει. |

---

## 2. Αποφάσεις (Final — Approved)

### 2.1 Νέα δομή: 2 tabs

| Tab | ID | Περιεχόμενο |
|-----|-----|------------|
| **Επίπεδα** | `levels` | Wizard button + λίστα κατόψεων + inline overlay όταν floor plan |
| **Ρυθμίσεις** | `colors` | Χρώματα DXF, στυλ γραμμών, grip settings |

### 2.2 Tab "Ιεραρχία" → ΑΦΑΙΡΕΙΤΑΙ ΠΛΗΡΩΣ
Δεν συγχωνεύεται, αφαιρείται. Η ιεραρχία υπάρχει ήδη στον wizard.

### 2.3 Tab "Επικάλυψη" → ΑΦΑΙΡΕΙΤΑΙ ΠΛΗΡΩΣ
Το overlay management εμφανίζεται inline στο tab Επίπεδα όταν το ενεργό
επίπεδο είναι κάτοψη ορόφου (floorplanType = 'floor').

### 2.4 Wizard button στο tab Επίπεδα
Στην κορυφή του tab Επίπεδα προστίθεται κουμπί που καλεί τον
`FloorplanImportWizard` — **ο ίδιος ακριβώς wizard** που υπάρχει στην toolbar
(dialog 6 βημάτων). Δεν δημιουργείται νέος κώδικας.

```
Tab ΕΠΙΠΕΔΑ:
┌──────────────────────────────────┐
│ [📤 Εισαγωγή κάτοψης]           │  ← FloorplanImportWizard (ίδιος)
│──────────────────────────────────│
│ ● Κάτοψη Κτιρίου Α    [ενεργή]  │  ← context-aware τίτλος
│ ○ Γεν. Κάτοψη Έργου             │
│ ○ Κάτοψη 1ου Ορόφου             │
│──────────────────────────────────│
│ [Layers του ενεργού DXF]        │
│ layer1 • layer2 • layer3         │
└──────────────────────────────────┘
```

### 2.5 Κουμπί "+ Νέο Επίπεδο" → ΚΡΥΒΕΤΑΙ (reversible)
Ένα νέο επίπεδο δημιουργείται μόνο μέσω wizard. Η function `addLevel()` στο
`useLevels` hook **παραμένει** — μόνο το UI button κρύβεται. Αναστρέψιμο.

### 2.6 Context-aware τίτλος επιπέδου
Το panel δεν δείχνει γενικό "Επίπεδο 1" αλλά τον τύπο κάτοψης:

| floorplanType | Τίτλος στο panel |
|--------------|-----------------|
| `project` | Γεν. Κάτοψη Έργου "[όνομα έργου]" |
| `building` | Γεν. Κάτοψη Κτιρίου "[όνομα κτιρίου]" |
| `floor` | Κάτοψη Ορόφου "[όνομα ορόφου]" |
| `unit` | Κάτοψη "[κωδ. + όνομα ακινήτου]" |
| `null` | Επίπεδο [n] (legacy) |

### 2.7 Πολλαπλά επίπεδα — ένα ενεργό τη φορά
Revit pattern: πολλά επίπεδα αποθηκευμένα, ένα εμφανίζεται στον canvas.
Εναλλαγή με ένα κλικ στη λίστα.

---

## 3. Τι ΔΕΝ αλλάζει

- Ο `FloorplanImportWizard` — ίδιος κώδικας, ίδιο dialog
- Το κουμπί wizard στην toolbar — παραμένει ως quick-access
- Το `useLevels()` hook — αμετάβλητο
- Το `addLevel()` — αμετάβλητο (μόνο κρύβεται το UI button)

---

## 4. Αρχεία που αλλάζουν

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/subapps/dxf-viewer/types/panel-types.ts` | Αφαίρεση `hierarchy`, `overlay` από `FloatingPanelType` |
| `src/subapps/dxf-viewer/ui/components/PanelTabs.tsx` | Αφαίρεση 2 tabs |
| `src/subapps/dxf-viewer/ui/hooks/usePanelContentRenderer.tsx` | Αφαίρεση `case 'hierarchy'`, `case 'overlay'` |
| `src/subapps/dxf-viewer/ui/hooks/usePanelNavigation.ts` | Update disabled panels logic |
| `src/subapps/dxf-viewer/ui/hooks/useFloatingPanelState.ts` | Default panel = `'levels'` |
| `src/subapps/dxf-viewer/ui/components/LevelPanel.tsx` | +wizard button, -add button, +context title |
| `src/subapps/dxf-viewer/ui/FloatingPanelContainer.tsx` | +`onSceneImported` prop |
| `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx` | Pass `onSceneImported` to container |

---

## 4b. Sistemi Centralizzati da Usare (SSoT)

| Sistema | Posizione | Uso |
|---------|-----------|-----|
| `FloatingPanelType` SSoT | `types/panel-types.ts` | Aggiornare a `'levels' \| 'colors'` |
| `PANEL_METADATA` + `PANEL_LAYOUT` config | `types/panel-types.ts` + `config/panel-tokens.ts` | Spacing, typography, panel rows |
| `TabsOnlyTriggers` | `@/components/ui/navigation/TabsComponents` | Tab navigation (già usato in PanelTabs) |
| `Button` + `Tooltip` | `@/components/ui/button`, `@/components/ui/tooltip` | Wizard button |
| `useSemanticColors` + `useBorderTokens` + `useIconSizes` | hooks centralizzati | Styling tokens |
| `FloorplanImportWizard` | `@/features/floorplan-import` | Riusare esattamente — nessun nuovo wizard |
| `LazyLevelPanel` | `ui/components/LazyLoadWrapper.tsx` | Già lazy-loaded ✅ |
| `useTranslation` | `@/i18n` | Namespace: `dxf-viewer-panels`, `dxf-viewer-shell` |
| `PANEL_LAYOUT` tokens | `config/panel-tokens.ts` | Tutti spacing/typography |

### Tipo Level — Gap trovato

Il tipo `Level` (`systems/levels/config.ts`) ha `floorId` e `buildingId` ma **mancano**:
- `floorplanType: 'project' | 'building' | 'floor' | 'unit'`
- `entityLabel: string` (nome human-readable dell'entità)
- `projectId: string`

Questi campi servono per i titoli context-aware (Fase 3). Vanno aggiunti al tipo Level.

### FloatingPanelsSection — Gap trovato

`FloatingPanelsSection.tsx` **non riceve** `onSceneImported`. La prop arriva a
`DxfViewerContent.tsx` → `EnhancedDXFToolbar`. Va aggiunto il passaggio della prop
attraverso la catena per raggiungere il LevelPanel (Fase 2).

---

## 5. Fasi di implementazione

### Fase 1 — Tab restructure (remove hierarchy + overlay)
Rimuove i 2 tab. Rapido, basso rischio.

### Fase 2 — Wizard button + hide add-level button
Aggiunge il bottone in cima al LevelPanel.

### Fase 3 — Context-aware level titles
Il panel mostra il tipo di floorplan per ogni livello.

### Fase 4 — Inline overlay management (quando floor plan attiva)
L'overlay management appare sotto la lista livelli quando `floorplanType = 'floor'`.

### Fase 5 — Load from storage ☁️ (futura)
Bottone "Φόρτωση από αποθήκη" — carica floorplan salvato da Firestore/Storage.

---

## 6. Per MEP (ηλεκτρολογικά/υδραυλικά) — futuro

I piani MEP saranno semplicemente **nuovi επίπεδα** importati via wizard
(es. "Ηλεκτρολογικά 1ου Ορόφου"). Non serve un meccanismo separato.

---

## 7. Changelog

| Data | Versione | Autore | Modifica |
|------|----------|--------|---------|
| 2026-04-16 | 0.1 | Claude + Γ.Παγώνης | Bozza iniziale — UNDER DISCUSSION |
| 2026-04-16 | 1.0 | Claude + Γ.Παγώνης | Decisioni finali approvate — APPROVED |
| 2026-04-16 | 1.1 | Claude | **Fase 1 IMPLEMENTATA** — rimossi tab `hierarchy` e `overlay`. File modificati: `panel-types.ts`, `PanelTabs.tsx`, `usePanelContentRenderer.tsx`, `LazyLoadWrapper.tsx`, `usePanelDescription.ts`. Componenti `HierarchyDebugPanel` e `AdminLayerManager` preservati nel codebase. |
| 2026-04-16 | 1.2 | Claude | **Fase 2 IMPLEMENTATA** — wizard button in cima a LevelPanel, sezione "+ Νέο Επίπεδο" nascosta (ADR-309 §2.5). Prop chain: `DxfViewerContent` → `SidebarSection` + `MobileSidebarDrawer` → `FloatingPanelContainer` → `usePanelContentRenderer` → `LevelPanel`. i18n key riusata: `shell.importFloorplanWizard`. |
| 2026-04-16 | 1.3 | Claude | **Fase 3 IMPLEMENTATA** — titoli context-aware per ogni livello nella lista. Tipo `FloorplanType` aggiunto a `config.ts`. Campi `floorplanType`, `entityLabel`, `projectId` aggiunti a `Level`. Metodo `updateLevelContext()` aggiunto a `useLevelOperations` → esposto da `LevelsSystem` → `useLevels`. API PATCH `/api/dxf-levels` aggiornata (schema + handler whitelist). `LevelPanel.onComplete` chiama `updateLevelContext` con mapping `EntityType→FloorplanType`. `LevelListCard` mostra `contextTitle` basato su `floorplanType`+`entityLabel`, fallback a `level.name`. i18n: 4 nuove chiavi `levelCard.title.*` in `dxf-viewer-panels` (el+en). |
| 2026-04-16 | 1.4 | Claude | **Fase 4 IMPLEMENTATA** — overlay management inline nel tab Επίπεδα quando `floorplanType === 'floor'`. `OverlayList` + `OverlayProperties` ora condizionali su `showOverlayPanel`. `currentLevel` calcolato via `useMemo` da `levels + currentLevelId`. `selectedOverlay` derivato da `universalSelection.getPrimaryId()` + `overlayStore.overlays`. Nessun nuovo i18n key — tutti i componenti riusano chiavi esistenti. |
