# ADR-176: DXF Viewer Mobile Responsive Refactoring

**Status**: ✅ APPROVED
**Date**: 2026-02-12
**Author**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
**Category**: UI Components

---

## Context

Το DXF Viewer είναι αποκλειστικά desktop-oriented: σταθερό sidebar 384px, toolbar flex-wrap χωρίς overflow, floating panels με absolute positioning, mouse-only drag. Σε mobile (375px) το UI βγαίνει εκτός οθόνης.

Η mobile εμπειρία είναι **"view + basic navigate"** — όχι full desktop feature parity. Drawing tools (line, rect, circle κλπ.) παραμένουν desktop-only λόγω precision requirements.

---

## Breakpoint Strategy

| Breakpoint | Value | Behavior |
|------------|-------|----------|
| `mobile` | `< 768px` | Drawer sidebar, compact toolbar, bottom sheets |
| `tablet` | `768–1023px` | Collapsible sidebar, 2-row toolbar |
| `desktop` | `≥ 1024px` | Τρέχουσα συμπεριφορά — **ΑΜΕΤΑΒΛΗΤΗ** |

**Reused Systems**:
- `useIsMobile()` → `src/hooks/useMobile.tsx` (768px breakpoint)
- `useResponsiveLayout()` → extended with `isTablet`, `layoutMode`
- `MOBILE_BREAKPOINT = 768` → `src/constants/layout.ts`
- `Sheet` component → `src/components/ui/sheet.tsx` (Radix, side=left/right/top/bottom)
- `PANEL_LAYOUT` tokens → `src/subapps/dxf-viewer/config/panel-tokens.ts`

---

## Use Cases

### Phase 1: Foundation + Layout Shell

#### UC-001: DXF Responsive Layout Hook
- Extend `useResponsiveLayout` with `isTablet`, `layoutMode`
- Add `CAD_TABLET_BREAKPOINT = 1024` to `src/constants/layout.ts`

#### UC-002: Sidebar → Off-Canvas Drawer (mobile/tablet)
- New `MobileSidebarDrawer.tsx` using `Sheet side="left"`
- Desktop → existing `SidebarSection` (unchanged)
- Mobile/tablet → drawer with SidebarSection `variant="drawer"`

#### UC-003: Mobile Toolbar (Primary + Overflow)
- Primary bar: `[☰ Sidebar] [Select] [Pan] [Zoom+] [Zoom-] [Fit] [⋯ More]`
- "More" opens `Sheet side="bottom"` with remaining tools in grid
- Drawing/measure tools shown grayed out with tooltip

#### UC-004: Compact Status Bar
- `compact` prop on `ToolbarStatusBar`
- Shows only `Tool: [name] | Zoom: [%]`

#### UC-005: Responsive Panel Tokens
- New `RESPONSIVE` section in `PANEL_LAYOUT`

### Phase 2: Floating Panels + Touch Gestures

#### UC-006: Floating Panels → Bottom Sheets
- `MobilePanelManager.tsx` — single-active panel state machine
- Desktop → floating (unchanged), mobile → `Sheet side="bottom"`

#### UC-007: Pointer Events Migration (useDraggable)
- `mousedown` → `pointerdown` + `setPointerCapture`
- `mousemove` → `pointermove`
- `mouseup` → `pointerup` + `releasePointerCapture`

#### UC-008: Pinch-to-Zoom
- `usePinchZoom.ts` — track 2 pointers, calc distance delta → zoom
- Center point between fingers → zoom center

#### UC-009: Touch Pan
- `useTouchPan.ts`
- Single-finger drag → pan (when Pan tool active)
- Two-finger drag → pan (always)

### Phase 3: Canvas Refinement + Panel Clamping

#### UC-010: Panel Width Clamping
- `clampPanelWidth()` utility in panel-tokens
- `Math.min(desiredWidth, viewportWidth - 16)`

#### UC-011: Mobile Tool Adaptation
- Drawing/measure tools → disabled + tooltip "Διαθέσιμο μόνο σε desktop"
- Available mobile tools: Select, Pan, Zoom, Layering, Import

#### UC-012: Long Press Context Menu
- `useLongPress.ts` — 500ms threshold
- Wire to DrawingContextMenu

### Phase 4: Polish + Accessibility

#### UC-013: Animations
- Sheet built-in animations (slide-in/out) verification

#### UC-014: ARIA Roles
- Sidebar drawer → `role="navigation"`
- Panels → `role="dialog"`
- Toolbar → `role="toolbar"`

#### UC-015: Viewport Meta + Safe Areas
- `user-scalable=no` on DXF viewer page
- iOS `env(safe-area-inset-*)` padding

---

## Safety Rules

1. **Desktop path ΑΜΕΤΑΒΛΗΤΗ** — Αλλαγές πίσω από `layoutMode` conditions
2. **Reuse existing** — Sheet, useResponsiveLayout, PANEL_LAYOUT tokens
3. **Κάθε phase deployable ανεξάρτητα** — incremental delivery
4. **Mobile = view + navigate** — Drawing/measure tools disabled σε mobile
5. **Zero `any`** — Enterprise TypeScript μόνο
6. **Semantic HTML** — `aside`, `nav`, `section`, `header`

---

## Files

### New (8)
- `docs/centralized-systems/reference/adrs/ADR-176-dxf-viewer-mobile-responsive.md`
- `src/subapps/dxf-viewer/layout/MobileSidebarDrawer.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/MobileToolbarLayout.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/toolbar-responsive-config.ts`
- `src/subapps/dxf-viewer/layout/MobilePanelManager.tsx`
- `src/subapps/dxf-viewer/hooks/gestures/usePinchZoom.ts`
- `src/subapps/dxf-viewer/hooks/gestures/useTouchPan.ts`
- `src/subapps/dxf-viewer/hooks/gestures/useLongPress.ts`

### Modified (14)
- `docs/centralized-systems/reference/adr-index.md`
- `src/constants/layout.ts`
- `src/components/contacts/dynamic/hooks/useResponsiveLayout.ts`
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx`
- `src/subapps/dxf-viewer/layout/SidebarSection.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/EnhancedDXFToolbar.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/ToolbarStatusBar.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/types.ts`
- `src/subapps/dxf-viewer/config/panel-tokens.ts`
- `src/subapps/dxf-viewer/layout/FloatingPanelsSection.tsx`
- `src/hooks/useDraggable.ts`
- `src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx`
- `src/subapps/dxf-viewer/ui/toolbar/ToolButton.tsx`
- `src/subapps/dxf-viewer/ui/components/DrawingContextMenu.tsx`
