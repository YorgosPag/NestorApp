# ADR-241: Fullscreen — Composition Architecture

## Status: ✅ IMPLEMENTED (2026-03-18) | REFACTORED (2026-03-18)

## Context

Η εφαρμογή είχε **6 διαφορετικές fullscreen υλοποιήσεις** σε 6 αρχεία χωρίς κοινό pattern. Κάθε component έγραφε το δικό του boilerplate:

- State management (`isFullscreen` / `setIsFullscreen`)
- Escape key handler (addEventListener / removeEventListener)
- Toggle button με icon swap
- CSS positioning (fixed / absolute / portal)

### Αρχικό πρόβλημα (v1)

| Πρόβλημα | Αντίκτυπο |
|----------|-----------|
| **Duplicated code** | ~155 γραμμές boilerplate σε 6 αρχεία |
| **Inconsistent UX** | Κάποια components δεν είχαν Escape handler, κάποια δεν είχαν close button |
| **Maintenance burden** | Κάθε bug fix (π.χ. body scroll lock) έπρεπε να γίνει σε 6 σημεία |
| **No accessibility** | Κανένα component δεν χρησιμοποιούσε semantic HTML ή ARIA attributes |

### Πρόβλημα v1 → v2 refactor

Το `FullscreenContainer` (v1) είχε 2 modes σε 1 component:
- `mode="overlay"` — React Portal + CSS fixed
- `mode="dialog"` — Wrapper πάνω από Radix Dialog

Ο dialog mode ήταν **abstraction πάνω σε abstraction** (Radix Dialog). Google-level architecture χρησιμοποιεί **composition** — ξεχωριστά components για ξεχωριστά πράγματα.

---

## Decision (v2 — Composition Architecture)

Decompose σε **SRP components**:

```
ΠΡΙΝ (v1):                          ΜΕΤΑ (v2):
┌─────────────────────┐           ┌──────────────────┐
│ FullscreenContainer │           │ FullscreenOverlay │  (overlay μόνο)
│  mode="overlay"     │           └──────────────────┘
│  mode="dialog"      │           ┌──────────────────┐
└─────────────────────┘           │ Dialog            │  (+ size="fullscreen")
                                  │  size="fullscreen"│
                                  └──────────────────┘
                                  ┌──────────────────────────┐
                                  │ FullscreenToggleButton    │  (standalone)
                                  └──────────────────────────┘
                                  ┌──────────────────┐
                                  │ useFullscreen     │  (ως έχει)
                                  └──────────────────┘
```

### Design Principles

- **SRP**: Κάθε component κάνει ένα πράγμα
- **Composition over abstraction**: Dialog mode = direct `<Dialog>` + `<DialogContent size="fullscreen">`
- **CVA variants**: `DialogContent` αποκτά `size` prop μέσω `class-variance-authority`
- **Zero breaking changes**: Default `size="default"` = σημερινό `max-w-lg`

---

## Components

### 1. `useFullscreen` hook (αμετάβλητο)

**Location**: `src/hooks/useFullscreen.ts`

```typescript
interface UseFullscreenReturn {
  isFullscreen: boolean;
  toggle: () => void;
  enter: () => void;
  exit: () => void;
}
```

### 2. `FullscreenOverlay` component (πρώην `FullscreenContainer`)

**Location**: `src/core/containers/FullscreenOverlay.tsx`

**API**:

```typescript
interface FullscreenOverlayProps {
  children: React.ReactNode;
  isFullscreen: boolean;
  onToggle: () => void;
  headerContent?: React.ReactNode;
  className?: string;
  fullscreenClassName?: string;
  ariaLabel?: string;
}
```

- CSS `fixed inset-0` overlay via React Portal — στρώση = ρόλος **`fullscreenSurface`** της κλίμακας (ADR-780 Φάση Δ):
  **ΕΠΙΦΑΝΕΙΑ κάτω** από την παροδική οικογένεια (`transientStack`). ⚠️ Εδώ έγραφε «`z-50`» ενώ ο κώδικας είχε ωμό
  `z-[60]` — **πάνω** από το `z-50` των διαλόγων, οπότε κάθε διάλογος που άνοιγε μέσα σε πλήρη οθόνη ήταν αόρατος
  και το πρώτο κλικ τον ακύρωνε (ADR-332 D27 Ζ3). Τη σειρά την κλειδώνει το `components/ui/__tests__/layer-contract`.
- ⚠️ **Δηλωμένο κενό**: δηλώνει `role="dialog" aria-modal` **χωρίς** παγίδα focus και **χωρίς** επαναφορά focus —
  υπόσχεση στον αναγνώστη οθόνης που δεν τηρείται. Το Escape και το scroll lock **υπάρχουν**, στο `useFullscreen`
  (`useEscapeKey` + `overflow-hidden` στο `body`). 🔴 **Μετρημένο ζωντανά 2026-09-11**: το Escape είναι ωμός listener
  στο `document`, **εκτός** του bus ιδιοκτησίας πληκτρολογίου (ADR-364) ⇒ **ένα** Esc σε διάλογο ανοιγμένο μέσα σε
  πλήρη οθόνη κλείνει **και** τον διάλογο **και** την πλήρη οθόνη (και στο DXF θα ανταγωνιζόταν την ακύρωση εργαλείου).
  Χωριστό βήμα (απόφαση Giorgio 2026-09-11).
- Children do NOT remount — state preserved
- Ideal for: EntityFilesManager, canvas-based views

### 3. `FullscreenToggleButton` (standalone export)

**Location**: `src/core/containers/FullscreenOverlay.tsx`

```typescript
interface ToggleButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
}
```

- Maximize2 / Minimize2 icon toggle
- i18n tooltips
- Can be used independently in any context

### 4. `DialogContent` size variants (CVA)

**Location**: `src/components/ui/dialog.tsx`

```typescript
type DialogContentSize = 'sm' | 'default' | 'lg' | 'xl' | 'fullscreen';
```

| Size | CSS |
|------|-----|
| `sm` | `max-w-sm` |
| `default` | `max-w-lg` |
| `lg` | `max-w-2xl` |
| `xl` | `max-w-4xl` |
| `fullscreen` | `max-w-[95vw] w-[95vw] h-[90vh]` |

### 5. i18n Keys

**Location**: `src/i18n/locales/{en,el}/common.json`

```json
{
  "fullscreen": {
    "enter": "Enter fullscreen / Πλήρης οθόνη",
    "exit": "Exit fullscreen / Έξοδος πλήρους οθόνης",
    "enterTooltip": "...",
    "exitTooltip": "..."
  }
}
```

---

## Migrated Components

| # | Component | Pattern | Notes |
|---|-----------|---------|-------|
| 1 | **EntityFilesManager** | `FullscreenOverlay` (overlay) | Simple rename — props unchanged |
| 2 | **GanttView** | `Dialog` + `DialogContent size="fullscreen"` | Direct composition — no wrapper |
| 3 | **FloorplanGallery** | `Dialog` + `DialogContent size="fullscreen"` | Direct composition — no wrapper |
| 4 | **DXF Viewer** | `FullscreenOverlay` (overlay) | Portal wraps MainContentSection + FloatingPanelsSection. Toolbar button toggle. Zero canvas remount. |
| 5 | **AnalyticsTabContent** | `FullscreenOverlay` (overlay) | Building analytics tab — FullscreenToggleButton in Header nav. |
| 6 | **MeasurementsTabContent** | `FullscreenOverlay` (overlay) | Building BOQ/measurements tab — FullscreenToggleButton next to "New Item" button. |

---

## Not Migrated (by design)

| Component | Reason |
|-----------|--------|
| **VideoPlayer** | Uses native browser Fullscreen API (`element.requestFullscreen()`). Different paradigm. |
| **~~FullscreenView (DXF)~~** | ~~Deep coupling με canvas coordinate system και zoom state.~~ **MIGRATED** (2026-03-18) — Portal-based `FullscreenOverlay` wraps `MainContentSection` + `FloatingPanelsSection`, zero canvas remount. |
| **GeoDialogSystem** | Dialog framework με δικό του fullscreen mode (dialog stack management). |

---

## Architecture (v2)

```
┌─────────────────────────────────────────────────┐
│           Consumer Component                    │
│  (EntityFilesManager, GanttView, FloorplanGallery)│
└───────┬─────────────────────────────┬───────────┘
        │ overlay pattern             │ dialog pattern
        ▼                             ▼
┌───────────────────┐   ┌─────────────────────────┐
│ FullscreenOverlay │   │ Dialog + DialogContent   │
│ (React Portal)    │   │ size="fullscreen"        │
└───────────────────┘   │ + FullscreenToggleButton │
                        └─────────────────────────┘
        │                             │
        └──────────┬──────────────────┘
                   ▼
        ┌──────────────────┐
        │ useFullscreen    │
        │ (state + escape) │
        └──────────────────┘
```

---

## Usage Examples

### Overlay mode (EntityFilesManager)

```tsx
const fs = useFullscreen();
<FullscreenOverlay isFullscreen={fs.isFullscreen} onToggle={fs.toggle}>
  <Card>...</Card>
</FullscreenOverlay>
```

### Dialog mode (GanttView) — Direct composition

```tsx
const fs = useFullscreen();

<Dialog open={fs.isFullscreen} onOpenChange={(open) => { if (!open) fs.exit(); }}>
  <DialogContent size="fullscreen" hideCloseButton className="flex flex-col p-0 gap-0">
    <DialogTitle className="sr-only">Gantt Chart</DialogTitle>
    <header className="flex items-center justify-between shrink-0 border-b px-4 py-2">
      <span className="font-semibold">Title</span>
      <FullscreenToggleButton isFullscreen onToggle={fs.toggle} />
    </header>
    <section className="flex-1 min-h-0 overflow-auto">
      <GanttChart ... />
    </section>
  </DialogContent>
</Dialog>
```

### Hook-only (without any container)

```tsx
const { isFullscreen, toggle, exit } = useFullscreen({ escapeToExit: true });

return (
  <div className={isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'relative'}>
    <button onClick={toggle}>Toggle</button>
    <MyContent />
  </div>
);
```

---

## Full Codebase Audit (2026-03-18)

- **0 rogue fullscreen implementations** βρέθηκαν
- **6/6** eligible components μεταφέρθηκαν επιτυχώς (EntityFilesManager, GanttView, FloorplanGallery, DXF Viewer, AnalyticsTab, MeasurementsTab)
- **2/3** intentional exceptions τεκμηριωμένες (VideoPlayer, GeoDialogSystem)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-09-11 | **Στρώση από την κλίμακα (ADR-780 Φάση Δ)**: `FullscreenOverlay` ωμό `z-[60]` → ρόλος `fullscreenSurface` (1045), **κάτω** από την παροδική οικογένεια `transientStack` (1095). Διορθώνει την κλάση του ADR-332 D27 Ζ3: σε **κάθε** καταναλωτή (Addresses · Measurements · Ownership · Locations · Payments · Files · ScheduleDashboard · DXF) κάθε διάλογος/μενού που άνοιγε σε πλήρη οθόνη ήταν αόρατος. Άγκυρα `components/ui/__tests__/layer-contract` (Σ2). **Ζωντανά**: σύρσιμο έδρας σε πλήρη οθόνη ⇒ διάλογος ορατός (1095 > 1045), «Ακύρωση» και «Μόνο η θέση» ολοκληρώνονται, Select μέσα στην πλήρη οθόνη = 1220. Δηλωμένο κενό: παγίδα/επαναφορά focus + 🔴 **το Escape (ωμός listener του `useFullscreen`, εκτός ADR-364) κλείνει ΚΑΙ τον διάλογο ΚΑΙ την πλήρη οθόνη** (μετρημένο) — χωριστό βήμα. | Claude + Γιώργος |
| 2026-03-18 | **Building tabs fullscreen**: AnalyticsTabContent + MeasurementsTabContent — `FullscreenOverlay` wrap + `FullscreenToggleButton` in header/actions area | Claude + Γιώργος |
| 2026-03-18 | **DXF Viewer fullscreen**: Portal-based `FullscreenOverlay` wraps canvas area, toolbar toggle button (Maximize2/Minimize2), `isFullscreen` prop flow through 7 components, i18n keys (en+el), zero canvas remount | Claude + Γιώργος |
| 2026-03-18 | **Milestones fullscreen**: Added `FullscreenOverlay` to `TimelineTabContent.tsx` milestones view — `useFullscreen` hook + fullscreen button in toolbar + overlay with OverallProgressCard, TimelineMilestones, CriticalPathCard, CompletionForecastCard | Claude + Γιώργος |
| 2026-03-18 | **v2 Composition Refactor**: `FullscreenContainer` → `FullscreenOverlay` (SRP), dialog mode → direct `<Dialog size="fullscreen">` composition, `FullscreenToggleButton` standalone export, CVA size variants on `DialogContent` | Claude + Γιώργος |
| 2026-03-18 | Full codebase audit — confirmed 100% centralization coverage, 0 rogue implementations | Claude + Γιώργος |
| 2026-03-18 | Initial implementation — `useFullscreen` hook, `FullscreenContainer` component, 3 component migrations, i18n keys | Claude + Γιώργος |
