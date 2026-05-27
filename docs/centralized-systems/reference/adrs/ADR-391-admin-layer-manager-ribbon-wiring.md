# ADR-391 — AdminLayerManager Ribbon Wiring

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **APPROVED & IMPLEMENTED** 2026-05-27 — Mount path closed από orphan component → modal dialog στο View tab του ribbon + Ctrl+L keyboard fallback. |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Ribbon / UI Wiring |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-391-admin-layer-manager-ribbon-wiring.md` |
| **Author** | Claude Sonnet 4.6 + Γιώργος Παγώνης |
| **Parent** | [ADR-382 §verification](./ADR-382-visibility-resolver-ssot.md) — discovered during manual verify ότι το AdminLayerManager δεν είχε mount path |
| **Companions** | ADR-001 (Radix Dialog SSoT), ADR-345 (Ribbon framework), ADR-357 Phase 14-A (Command Aliases / shortcuts SSoT), ADR-358 (LayerStore), ADR-382 (BIM Visibility Resolver — triggered by `layer.visible` toggle here) |
| **Industry alignment** | Revit View tab > Layer Manager (modal dialog) · AutoCAD `LA` command opens Layer Properties Manager · ArchiCAD Layer Settings dialog |
| **Effort** | ~1h Sonnet |
| **Risk** | Low — pure UI wiring, zero changes σε business logic |

---

## Summary

Το `AdminLayerManager` React component (~400 lines, `src/subapps/dxf-viewer/ui/components/AdminLayerManager.tsx`) ήταν **fully implemented αλλά orphan**: zero call sites στο production tree, zero ribbon button, zero keyboard shortcut. Χωρίς μια διαδρομή UI ο χρήστης δεν είχε τρόπο να toggle `layer.visible` / `frozen` / color / lineweight ανά layer — fallback ήταν μόνο το V/G category panel.

Αυτό το ADR συνδέει το υπάρχον component στο production μέσω:

1. **Ribbon button** στο **View tab** (industry: Revit View > Layer Manager)
2. **Ctrl+L keyboard shortcut** (consumes the previously-dead `toggleLayers` shortcut declared στο `keyboard-shortcuts.ts`)
3. **Modal Radix Dialog wrapper** (ADR-001 SSoT)
4. **Singleton visibility store** (zero React state, pattern του CommandLineStore)

---

## 1. Pre-fix State (verified 2026-05-27 grep evidence)

```
$ rg "AdminLayerManager|LayerManager" src/subapps/dxf-viewer/ui/ribbon → 0 matches
$ rg "<AdminLayerManager"             src/subapps/dxf-viewer          → 0 matches
$ rg "<LazyAdminLayerManager"         src/subapps/dxf-viewer          → 0 matches
```

Επιπτώσεις:
- `LazyAdminLayerManager` declared at `LazyLoadWrapper.tsx:177` but never mounted
- ADR-382 visibility resolver chain (LayerStore subscriber → 2D⟷3D rebuild) operational αλλά **untriggerable** από user UI
- Manual verification του ADR-382 fix χρειάστηκε V/G panel ως proxy

---

## 2. Decisions (Q1-Q4 — locked από Γιώργος 2026-05-27)

| # | Question | Decision | Why |
|---|---|---|---|
| Q1 | Mount style | **Modal Radix Dialog** πάνω από canvas (όχι 4th tab στο FloatingPanel, όχι draggable panel) | Revit V/G dialog parity · ADR-001 SSoT |
| Q2 | Ribbon tab | **View** | Industry: Revit "View" tab > Layer Manager · AutoCAD View tab > Layer Properties |
| Q3 | Keyboard shortcut | **Ctrl+L** (consume dead `toggleLayers` shortcut) | `LA` ήταν ήδη booked από `layering` paint-tool (CommandAliasRegistry:177). Ctrl+L declared αλλά zero listeners → free σε wiring χωρίς breakage |
| Q4 | ADR number | **ADR-391** | Επόμενο free post ADR-390 (ADR-381 §3 είχε pre-allocated το ADR-391 για "ribbon-auto-registry" — αυτό αναβάλλεται σε ADR-392 αργότερα) |

---

## 3. Implementation

### 3.1 New files (5)

| Path | Purpose |
|---|---|
| `src/subapps/dxf-viewer/stores/AdminLayerManagerDialogStore.ts` | Singleton open/close store (zero React, pattern CommandLineStore) — `open()`, `close()`, `toggle()`, `subscribe()`, `getSnapshot()` |
| `src/subapps/dxf-viewer/ui/components/AdminLayerManagerDialog.tsx` | Radix Dialog wrapper γύρω από `LazyAdminLayerManager`. Subscribes στο store με `useSyncExternalStore`. Reuses `@/components/ui/dialog` SSoT (ADR-001) |
| `src/subapps/dxf-viewer/app/AdminLayerManagerDialogHost.tsx` | Mount-point host (mirror του pattern 7 BIM persistence hosts). Forwards `projectId`/`projectName` props |
| `src/subapps/dxf-viewer/ui/ribbon/data/view-tab-layer-manager.ts` | Ribbon panel definition: simple button με `action: 'open-layer-manager'` + `icon: 'layering'` |
| `docs/centralized-systems/reference/adrs/ADR-391-admin-layer-manager-ribbon-wiring.md` | This document |

### 3.2 Modified files (7)

| Path | Change |
|---|---|
| `src/subapps/dxf-viewer/app/dxf-viewer-lazy-components.tsx` | `+ AdminLayerManagerDialogHost` lazy export |
| `src/subapps/dxf-viewer/ui/ribbon/data/ribbon-default-tabs.ts` | `+ VIEW_LAYER_MANAGER_PANEL` import + insertion 3rd σε View tab panels (after Display, before Visual Styles) |
| `src/subapps/dxf-viewer/app/DxfViewerContent.tsx` | `+ AdminLayerManagerDialogHost` import + `<React.Suspense>` mount μετά τα 7 BIM hosts |
| `src/subapps/dxf-viewer/app/useDxfViewerCallbacks.ts` | `+ AdminLayerManagerDialogStore` import + `action === 'open-layer-manager'` branch στο `wrappedHandleAction` |
| `src/subapps/dxf-viewer/hooks/useKeyboardShortcuts.ts` | `+ AdminLayerManagerDialogStore` import + `matchesShortcut(e, 'toggleLayers')` → `store.toggle()` |
| `src/i18n/locales/el/dxf-viewer-shell.json` | `+ ribbon.panels.layerManager`, `+ ribbon.commands.layerManager`, `+ layerManagerDialog.{title,description}` |
| `src/i18n/locales/en/dxf-viewer-shell.json` | Mirror of el keys |

### 3.3 Flow diagram

```
[User clicks "Διαχειριστής Στρώσεων" στο View tab]
    │
    ├── RibbonSmallButton.onClick(command)
    │       └─ command.action='open-layer-manager'
    │           └─ onAction('open-layer-manager')
    │               └─ wrappedHandleAction('open-layer-manager')
    │                   └─ AdminLayerManagerDialogStore.open()
    │                       └─ subscribers notified
    │                           └─ AdminLayerManagerDialog re-renders με isOpen=true
    │                               └─ Radix Dialog modal mounts <LazyAdminLayerManager />
    │
[User πατά Ctrl+L]
    │
    └── window keydown listener (useKeyboardShortcuts)
            └─ matchesShortcut(e, 'toggleLayers') === true
                └─ AdminLayerManagerDialogStore.toggle()
                    └─ (same chain as above)
```

---

## 4. SSoT alignment

- **Dialog UI**: `@/components/ui/dialog` (Radix, ADR-001) — zero new dialog primitive
- **Visibility state**: `AdminLayerManagerDialogStore` — singleton, mirrors `CommandLineStore` pattern
- **Action dispatch**: `wrappedHandleAction` στο `useDxfViewerCallbacks.ts` (ADR-345 generic action dispatcher SSoT)
- **Keyboard shortcut SSoT**: `keyboard-shortcuts.ts` `toggleLayers` entry (Ctrl+L) — zero new declaration, consumes dead one
- **Layer store**: `AdminLayerManager` ήδη χρησιμοποιεί `LayerStore` SSoT (zero touch εδώ)
- **Visibility chain**: όταν user toggle-άρει `layer.visible` → LayerStore version bump → ADR-382 resolver chain → 2D + 3D auto-refresh (zero extra wiring από αυτό το ADR)

---

## 5. Google-Level Checklist (N.7.2)

| # | Question | Answer |
|---|---|---|
| 1 | Proactive or reactive? | **Proactive** — store created at mount, no creation on first action |
| 2 | Race condition possible? | **No** — single store, single subscriber via useSyncExternalStore |
| 3 | Idempotent? | **Yes** — `open()` early-returns if already open; `toggle()` flips deterministically |
| 4 | Belt-and-suspenders? | **Yes** — ribbon button (primary) + Ctrl+L (secondary keyboard fallback) |
| 5 | Single Source of Truth? | **Yes** — Dialog, store, shortcut, action dispatcher all SSoT modules |
| 6 | Fire-and-forget or await? | **N/A** — synchronous store mutation |
| 7 | Lifecycle ownership? | **Explicit** — `AdminLayerManagerDialogHost` mounted στο `DxfViewerContent` |

✅ **Google-level: YES** — pure UI wiring χωρίς architectural debt. Reuses existing SSoTs (Dialog, action dispatcher, keyboard shortcut, LayerStore).

---

## 6. Acceptance — Manual Browser Verification Recipe

1. Open `/dxf/viewer` με project που έχει BIM entities (walls + slabs)
2. **Path A** (ribbon): Click View tab → click "Διαχειριστής Στρώσεων" button → Dialog opens
3. **Path B** (keyboard): Πατά `Ctrl+L` → Dialog toggles (open/close)
4. Στο Dialog: toggle 👁 εικονίδιο σε layer που περιέχει τοίχους → 2D walls εξαφανίζονται immediately (ADR-382 LayerStore subscriber chain)
5. Switch σε 3D mode → 3D walls **επίσης** εξαφανίζονται (ADR-382 Phase C 2D⟷3D parity verified)
6. Re-toggle 👁 → επιστρέφουν και σε 2D και σε 3D
7. Close Dialog (X button ή Escape) → state persists στο LayerStore
8. Re-open Dialog → οι ίδιες αλλαγές παραμένουν visible

---

## 7. Non-goals

- **ΟΧΙ** changes στο `layering` paint-tool (custom feature, `LA` alias παραμένει εκεί)
- **ΟΧΙ** AutoCAD multi-char `LA` redirection (status quo — Γιώργος decision Q3)
- **ΟΧΙ** AdminLayerManager component refactor (ήταν production-ready, μόνο orphan)
- **ΟΧΙ** project-context auto-detection (projectName not threaded; `projectId` από `levelManager.saveContext` only)

---

## 8. Changelog

- **2026-05-27** (Sonnet 4.6 + Γιώργος): Phase 1 Recognition + Q1-Q4 locked + Phase 2 implementation (5 NEW + 7 MODIFIED) + Phase 3 doc + index/ΕΚΚΡΕΜΟΤΗΤΕΣ/pending-ratchet/MEMORY updates.
