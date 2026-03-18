# ADR-241: Fullscreen Container Centralization

## Status: ✅ IMPLEMENTED (2026-03-18)

## Context

Η εφαρμογή είχε **6 διαφορετικές fullscreen υλοποιήσεις** σε 6 αρχεία χωρίς κοινό pattern. Κάθε component έγραφε το δικό του boilerplate:

- State management (`isFullscreen` / `setIsFullscreen`)
- Escape key handler (addEventListener / removeEventListener)
- Toggle button με icon swap
- CSS positioning (fixed / absolute / portal)

### Προβλήματα

| Πρόβλημα | Αντίκτυπο |
|----------|-----------|
| **Duplicated code** | ~155 γραμμές boilerplate σε 6 αρχεία |
| **Inconsistent UX** | Κάποια components δεν είχαν Escape handler, κάποια δεν είχαν close button |
| **Maintenance burden** | Κάθε bug fix (π.χ. body scroll lock) έπρεπε να γίνει σε 6 σημεία |
| **No accessibility** | Κανένα component δεν χρησιμοποιούσε semantic HTML ή ARIA attributes |

### Existing Implementations (πριν τη centralization)

1. **EntityFilesManager** — Custom `isFullscreen` state + CSS classes
2. **GanttView** — ~125 γραμμές custom fullscreen logic + overlay
3. **FloorplanGallery** — Custom fullscreen state + escape handler
4. **VideoPlayer** — Native browser Fullscreen API (`requestFullscreen`)
5. **FullscreenView (DXF)** — DXF architecture-specific implementation
6. **GeoDialogSystem** — Dialog framework fullscreen mode

---

## Decision

Δημιουργήθηκε ένα **centralized fullscreen system** αποτελούμενο από:

1. **`useFullscreen` hook** — Shared logic (state, escape, scroll lock)
2. **`FullscreenContainer` component** — Shared UI (overlay/dialog, header, toggle button)
3. **i18n keys** — Τυποποιημένα labels

### Design Principles

- **Radix pattern**: Controlled + uncontrolled mode (like Radix primitives)
- **Zero inline styles**: Tailwind-only styling
- **Semantic HTML**: Proper `<dialog>`, `<header>`, `<button>` elements
- **Composable**: Hook μπορεί να χρησιμοποιηθεί χωρίς Container και αντίστροφα

---

## Components

### 1. `useFullscreen` hook

**Location**: `src/hooks/useFullscreen.ts`

**API**:

```typescript
interface UseFullscreenOptions {
  /** Controlled mode — external state */
  isFullscreen?: boolean;
  /** Controlled mode — external setter */
  onFullscreenChange?: (value: boolean) => void;
  /** Initial state for uncontrolled mode */
  defaultFullscreen?: boolean;
  /** Enable Escape key to exit (default: true) */
  escapeToExit?: boolean;
  /** Lock body scroll when fullscreen (default: true) */
  lockBodyScroll?: boolean;
}

interface UseFullscreenReturn {
  isFullscreen: boolean;
  toggle: () => void;
  enter: () => void;
  exit: () => void;
}
```

**Features**:
- Controlled + uncontrolled mode (Radix pattern)
- Uses `useEscapeKey` hook internally (δεν γράφει δικό του listener)
- Body scroll lock via `document.body.classList.add('overflow-hidden')`
- Cleanup on unmount

### 2. `FullscreenContainer` component

**Location**: `src/core/containers/FullscreenContainer.tsx`

**API**:

```typescript
interface FullscreenContainerProps {
  children: React.ReactNode;
  /** 'overlay' = CSS fixed, no remount | 'dialog' = Radix Dialog portal */
  mode?: 'overlay' | 'dialog';
  /** Toggle button position or 'none' to hide */
  togglePosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'none';
  /** Show header bar with close button */
  showHeader?: boolean;
  /** Custom content for the header bar */
  headerContent?: React.ReactNode;
  /** Header title text */
  title?: string;
  /** Controlled mode props */
  isFullscreen?: boolean;
  onFullscreenChange?: (value: boolean) => void;
  /** CSS class for the fullscreen wrapper */
  className?: string;
}
```

**Modes**:

| Mode | Mechanism | Remount | Portal | Use Case |
|------|-----------|---------|--------|----------|
| `overlay` | CSS `fixed inset-0 z-50` | No | No | Media viewers, file managers |
| `dialog` | Radix Dialog portal | Yes (portal) | Yes | Charts, complex layouts (Gantt) |

**Features**:
- Built-in toggle button (Maximize/Minimize icons) — configurable position ή `'none'`
- Header bar με close button + optional custom content
- Tailwind-only, semantic HTML
- Dark/light theme support via CSS variables
- `aria-label` attributes για accessibility

### 3. i18n Keys

**Location**: `src/i18n/locales/{en,el}/common.json`

```json
{
  "fullscreen": {
    "enter": "Enter fullscreen / Πλήρης οθόνη",
    "exit": "Exit fullscreen / Έξοδος πλήρους οθόνης",
    "toggle": "Toggle fullscreen / Εναλλαγή πλήρους οθόνης"
  }
}
```

---

## Migrated Components

| # | Component | File | Mode | Lines Removed | Notes |
|---|-----------|------|------|---------------|-------|
| 1 | **EntityFilesManager** | `src/components/shared/files/EntityFilesManager.tsx` | `overlay` | ~15 | Replaced custom isFullscreen state + CSS |
| 2 | **GanttView** | `src/components/construction/gantt/GanttView.tsx` | `dialog` | ~125 | Major cleanup — removed custom overlay, escape handler, toggle logic |
| 3 | **FloorplanGallery** | `src/components/floorplans/FloorplanGallery.tsx` | `dialog` | ~15 | Replaced custom fullscreen + escape handler |

### Total Lines Removed: ~155

---

## Not Migrated (by design)

| Component | Reason |
|-----------|--------|
| **VideoPlayer** | Uses native browser Fullscreen API (`element.requestFullscreen()`). Different paradigm — CSS overlay δεν αντικαθιστά native fullscreen. |
| **FullscreenView (DXF)** | Μέρος του DXF architecture. Έχει deep coupling με canvas coordinate system και zoom state. Αλλαγή θα σπάσει DXF pipeline. |
| **GeoDialogSystem** | Χρησιμοποιεί dialog framework με δικό του fullscreen mode. Η αρχιτεκτονική είναι fundamentally διαφορετική (dialog stack management). |

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Consumer Component            │
│  (EntityFilesManager, GanttView, etc.)  │
└───────────────┬─────────────────────────┘
                │ uses
                ▼
┌─────────────────────────────────────────┐
│        FullscreenContainer              │
│  mode: 'overlay' | 'dialog'            │
│  ┌─────────────────────────────────┐    │
│  │  useFullscreen hook             │    │
│  │  - state (controlled/uncontrolled)   │
│  │  - useEscapeKey                 │    │
│  │  - body scroll lock             │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

---

## Usage Examples

### Minimal (uncontrolled)

```tsx
<FullscreenContainer>
  <MyContent />
</FullscreenContainer>
```

### Controlled mode with header

```tsx
const [isFullscreen, setIsFullscreen] = useState(false);

<FullscreenContainer
  mode="dialog"
  isFullscreen={isFullscreen}
  onFullscreenChange={setIsFullscreen}
  showHeader
  title="Gantt Chart"
>
  <GanttChart />
</FullscreenContainer>
```

### Hook-only (without Container)

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

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial implementation — `useFullscreen` hook, `FullscreenContainer` component, 3 component migrations (EntityFilesManager, GanttView, FloorplanGallery), i18n keys | Claude + Γιώργος |
