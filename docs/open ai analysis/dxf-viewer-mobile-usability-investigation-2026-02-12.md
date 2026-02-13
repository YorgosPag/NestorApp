# DXF Viewer Mobile Usability Investigation
Date: 2026-02-12
Scope: `src/subapps/dxf-viewer` (layout, panels, toolbar, interaction model)

## Summary
Το σημερινό DXF Viewer είναι κατά βάση **desktop-first**. Σε mobile viewport (π.χ. 375px πλάτος) συσσωρεύονται σταθερά πλάτη, floating panels και πυκνό toolbar/status UI, με αποτέλεσμα τμήματα διεπαφής να βγαίνουν εκτός οθόνης ή να μην είναι πρακτικά χειρίσιμα.

Αν θέλουμε να είναι λειτουργικό στο κινητό, χρειάζεται **ξεχωριστό mobile layout mode** (όχι μόνο μικροδιορθώσεις CSS).

---

## What I found (root causes)

### 1) Desktop-first root layout με fixed sidebar πλάτος
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:982`
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:983`
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:988`
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:999`
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx:1035`

Το root section είναι οριζόντιο `flex` με Sidebar + Main + Floating panels, χωρίς mobile breakpoint strategy.

### 2) Sidebar κλειδωμένο στα 384px (min/max)
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx:50`
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx:51`
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx:52`
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx:53`
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx:94`
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx:95`
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx:96`

Σε συσκευές 360–390px, μόνο το sidebar μπορεί να καταναλώσει όλο το πλάτος.

### 3) Floating panels με fixed desktop διαστάσεις/anchoring
- `src/subapps/dxf-viewer/config/panel-tokens.ts:907` (`min-w-[384px]`)
- `src/subapps/dxf-viewer/config/panel-tokens.ts:911` (`min-h-[850px]`)
- `src/subapps/dxf-viewer/config/panel-tokens.ts:914` (`w-[340px]`)
- `src/subapps/dxf-viewer/config/panel-tokens.ts:915` (`w-[400px]`)
- `src/subapps/dxf-viewer/config/panel-tokens.ts:1666` (overlay toolbar 380x80)
- `src/subapps/dxf-viewer/config/panel-tokens.ts:1671` (overlay properties 340x500)
- `src/subapps/dxf-viewer/config/panel-tokens.ts:1719`
- `src/subapps/dxf-viewer/config/panel-tokens.ts:1757`

Η θέση υπολογίζεται με `window.innerWidth - panelWidth - margin`, που στο κινητό αφήνει ελάχιστο usable χώρο όταν υπάρχουν πολλά overlays.

### 4) Mouse-only draggable core (όχι touch/pointer-ready)
- `src/hooks/useDraggable.ts:21` (Future: Touch support)
- `src/hooks/useDraggable.ts:186`
- `src/hooks/useDraggable.ts:241`
- `src/hooks/useDraggable.ts:256`

Ο κοινός draggable μηχανισμός βασίζεται σε mouse events (`mousemove/mouseup`). Σε κινητό αυτό δημιουργεί τριβές σε drag interactions.

### 5) Layer canvas μπλοκάρει native touch gestures
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerCanvas.tsx:594` (`touchAction: 'none'`)
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerCanvas.tsx:599`
- `src/subapps/dxf-viewer/canvas-v2/layer-canvas/LayerCanvas.tsx:604`

Καταργείται native pinch/pan του browser χωρίς καθαρό mobile gesture UX replacement layer.

### 6) Floating panel clutter
- `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx:110`
- `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx:158`
- `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx:183`
- `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx:198`

Το section διαχειρίζεται πολλαπλά floating στοιχεία. Για mobile χρειάζεται single-active panel model.

### 7) Toolbar + status bar υψηλή πυκνότητα πληροφοριών
- `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx:218`
- `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx:219`
- `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx:246`
- `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx:266`
- `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx:305`
- `src/subapps/dxf-viewer/ui/toolbar/ToolbarStatusBar.tsx:105`
- `src/subapps/dxf-viewer/ui/toolbar/ToolbarStatusBar.tsx:106`
- `src/subapps/dxf-viewer/ui/toolbar/ToolbarStatusBar.tsx:138`

Δεν υπάρχει mobile collapse strategy (π.χ. primary tools first, overflow menu, compact status).

### 8) Anchoring selectors/flows με ασυνέπεια
- Selector definitions:
  - `src/subapps/dxf-viewer/config/panel-tokens.ts:1624`
  - `src/subapps/dxf-viewer/config/panel-tokens.ts:1630`
- `cad-status-bar` υπάρχει μόνο στο component:
  - `src/subapps/dxf-viewer/statusbar/CadStatusBar.tsx:107`
- Δεν βρέθηκε χρήση/mount του `CadStatusBar` αλλού στο subapp.

Άρα bottom-right anchoring πιθανόν πέφτει συχνά σε fallback υπολογισμούς.

### 9) Mobile testing υπάρχει αλλά είναι ανεπαρκές λειτουργικά
- `src/subapps/dxf-viewer/e2e/visual-cross-browser.spec.ts:18` (mobile viewport)

Υπάρχει mobile screenshot coverage, αλλά λείπουν interaction assertions για usability (άνοιγμα panels, προσβασιμότητα εργαλείων, touch flows, overflow behavior).

---

## What must be done (required)

1. Introduce **Mobile Layout Mode** για `< 1024px`.
2. Sidebar να γίνει **off-canvas drawer** (default closed on mobile), όχι μόνιμο 384px panel.
3. Floating panels σε mobile να γίνουν **bottom sheets/fullscreen sheets** (single-active panel).
4. Αντικατάσταση mouse-only drag logic με **pointer/touch-capable interactions** ή disable drag on mobile.
5. Toolbar σε **2-tier mobile model**:
   - Tier A: 4–6 βασικά εργαλεία
   - Tier B: “More tools” drawer/sheet
6. Toolbar status bar σε **compact mode** (μία γραμμή, βασικά states μόνο).
7. Panel anchoring με **hard clamp**:
   - panel width <= `viewportWidth - 16`
   - x >= 8, y >= safe-area top
8. Replace fixed/min dimensions με responsive tokens (`sm/md/lg`) για mobile-first behavior.

---

## What we can do immediately (quick wins)

1. Hide `SidebarSection` on mobile και εμφάνιση με toggle button.
2. Disable draggable floating overlays on mobile and force centered sheet presentation.
3. Add horizontal scroll/overflow strategy στο toolbar row ώστε να μην κόβονται controls.
4. Collapse `ToolbarStatusBar` fields σε compact labels (tool, zoom, snap μόνο).
5. Add runtime guard: όταν `window.innerWidth < 480`, auto-close non-critical floating panels.

---

## Proposed implementation plan

### Phase 1 (stabilize mobile layout)
- Mobile breakpoint mode στο root `DxfViewerContent` layout.
- Sidebar drawer.
- Single floating sheet controller.
- Compact toolbar/status.

### Phase 2 (mobile interaction model)
- Pointer/touch input normalization.
- Gesture policy (pinch zoom, one-finger pan, tap select).
- Disable desktop-only shortcuts affordances on touch-only devices.

### Phase 3 (quality + validation)
- Mobile E2E tests with interaction assertions:
  - open/close sidebar
  - access all tool groups
  - open overlay properties
  - execute one drawing flow end-to-end
- Viewports: 360x800, 375x667, 390x844, 412x915, 768x1024.

---

## Acceptance criteria (mobile)

1. Σε 375px πλάτος, καμία κρίσιμη ενέργεια δεν είναι off-screen.
2. Ο χρήστης μπορεί να:
   - εισάγει DXF
   - πλοηγηθεί στον καμβά
   - επιλέξει εργαλείο
   - ανοίξει/κλείσει επίπεδα και ιδιότητες
3. Δεν υπάρχουν panel overlaps που μπλοκάρουν αλληλεπίδραση.
4. Touch interactions λειτουργούν χωρίς να απαιτείται mouse emulation.

---

## Evidence (commands used)
- `rg -n "mobile|responsive|isMobile|touch|pointer|..." src/subapps/dxf-viewer`
- `Get-Content src/subapps/dxf-viewer/layout/SidebarSection.tsx`
- `Get-Content src/subapps/dxf-viewer/layout/MainContentSection.tsx`
- `Get-Content src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx`
- `Get-Content src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx`
- `Get-Content src/subapps/dxf-viewer/ui/toolbar/ToolbarStatusBar.tsx`
- `Get-Content src/subapps/dxf-viewer/config/panel-tokens.ts`
- `Get-Content src/hooks/useDraggable.ts`
- `Get-Content src/subapps/dxf-viewer/e2e/visual-cross-browser.spec.ts`

