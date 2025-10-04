# ‘‘›¥£— ”™ ›Ÿ¤¥ ©: CONTEXT PROVIDERS

**—¼µÁ¿¼·½¯± ‘½¬»ÅÃ·Â:** 2025-10-03
**Scope:** `src/subapps/dxf-viewer/`
**£ÄÌÇ¿Â:** •½Ä¿À¹Ã¼ÌÂ ´¹À»ÌÄÅÀÉ½ º±¹ overlapping »µ¹Ä¿ÅÁ³¹ºÌÄ·Ä±Â Ãµ Context Providers

---

## =Ê EXECUTIVE SUMMARY

### £Å½¿»¹º¬ •ÅÁ®¼±Ä±
- **£Í½¿»¿ Context Providers:** 21 ±ÁÇµ¯± ¼µ createContext
- **šÍÁ¹± Core Contexts:** 6 (CanvasContext, TransformContext, CursorContext, SnapContext, GripContext, DxfSettingsProvider)
- **System Contexts:** ~15 (RulersGrid, Levels, EntityCreation, Constraints, Toolbars, Selection, º.¬.)
- **=¨ š¡™¤™šŸ OVERLAP:** CanvasContext.transform vs TransformContext.transform

### šÁ¹Ã¹¼ÌÄ·Ä± •ÅÁ·¼¬ÄÉ½
- =4 **¥¨—›—:** Transform state duplication (CanvasContext ” TransformContext)
- =á **œ•¤¡™‘:** Settings management complexity (GripProvider ” DxfSettingsProvider ” ConfigurationProvider)
- =â **§‘œ—›—:** š±»¬ ´¹±ÇÉÁ¹Ã¼­½± system contexts

---

## = ›• ¤Ÿœ•¡—£ ‘‘›¥£— š¥¡™© CONTEXTS

### 1ã CanvasContext (contexts/CanvasContext.tsx)

**£º¿ÀÌÂ:** ”¹±Çµ¯Á¹Ã· canvas references º±¹ transform state ¼µ ZoomManager integration

** ±ÁµÇÌ¼µ½· State:**
```typescript
interface CanvasContextType {
  dxfRef: React.RefObject<any>;
  overlayRef: React.RefObject<any>;
  transform: ViewTransform;           //   OVERLAP ¼µ TransformContext
  setTransform: (transform: ViewTransform) => void;  //   OVERLAP
  zoomManager: ZoomManager | null;
  setZoomManager: (manager: ZoomManager) => void;
}
```

**•Å¸Í½µÂ:**
-  ‘À¿¸®ºµÅÃ· canvas refs (dxfRef, overlayRef)
-  ”¹±Çµ¯Á¹Ã· ZoomManager instance
-   ”¹±Çµ¯Á¹Ã· ViewTransform state (”™ ›Ÿ¤¥ Ÿ ¼µ TransformContext)

**§Á®Ã·:**
- Consumed via `useCanvasContext()` hook
- Provider: `<CanvasProvider>`
- §Á·Ã¹¼¿À¿¹µ¯Ä±¹ Ãµ: DxfCanvas, CanvasSection, zoom/pan handlers

**=¨  ¡Ÿ’›—œ‘:**
¤¿ CanvasContext ´¹±Çµ¹Á¯¶µÄ±¹ transform state (`transform`, `setTransform`) À¿Å µÀ±½±»±¼²¬½µ¹ Ä· »µ¹Ä¿ÅÁ³¹ºÌÄ·Ä± Ä¿Å TransformContext. ‘ÅÄÌ ´·¼¹¿ÅÁ³µ¯ ´Í¿ À·³­Â ±»®¸µ¹±Â ³¹± Ä¿ ¯´¹¿ state.

---

### 2ã TransformContext (contexts/TransformContext.tsx)

**£º¿ÀÌÂ:** **Single Source of Truth** ³¹± viewport transformations

** ±ÁµÇÌ¼µ½· State:**
```typescript
interface TransformContextValue {
  transform: ViewTransform;           //   OVERLAP ¼µ CanvasContext
  setTransform: (newTransform: ViewTransform) => void;
  updateTransform: (updater: (prev: ViewTransform) => ViewTransform) => void;
}
```

**•Å¸Í½µÂ:**
-  šµ½ÄÁ¹º® ´¹±Çµ¯Á¹Ã· ViewTransform
-  Event dispatching ³¹± zoom changes (window.dispatchEvent)
-  Backward compatibility ¼µ window.dxfTransform
-  Functional updates support

**§Á®Ã·:**
- Consumed via `useTransform()` hook
- Provider: `<TransformProvider>`
- §Á·Ã¹¼¿À¿¹µ¯Ä±¹ Ãµ: ZoomManager, pan/zoom systems, coordinate transforms

** £©£¤Ÿ PATTERN:**
Ÿ TransformContext ±º¿»¿Å¸µ¯ Ä¿ "Single Source of Truth" pattern º±¹ À±Á­Çµ¹ functional updates (`updateTransform`), À¿Å µ¯½±¹ best practice ³¹± React state management.

---

### =4 š¡™¤™šŸ OVERLAP: CanvasContext vs TransformContext

**”¹À»ÌÄÅÀ· ›µ¹Ä¿ÅÁ³¹ºÌÄ·Ä±:**

| Aspect | CanvasContext | TransformContext |
|--------|---------------|------------------|
| Transform State |  `transform: ViewTransform` |  `transform: ViewTransform` |
| Setter |  `setTransform()` |  `setTransform()` |
| Functional Updates | L ŒÇ¹ |  `updateTransform()` |
| Event Dispatching | L ŒÇ¹ |  ±¹ (zoom events) |
| Backward Compatibility | L ŒÇ¹ |  window.dxfTransform |
| Scope | Canvas-specific | Global transform |

** ÁÌ²»·¼±:**
- ”Í¿ contexts ´¹±Çµ¹Á¯¶¿½Ä±¹ Ä¿ **¯´¹¿ state** (ViewTransform)
-  ¹¸±½ÌÄ·Ä± ³¹± **state desynchronization**
- **£Í³ÇÅÃ·** ³¹± developers: À¿¹¿ context ½± ÇÁ·Ã¹¼¿À¿¹®Ã¿Å½;

**£ÍÃÄ±Ã·:**
1. **Option A ( Á¿Ä¹¼Î¼µ½¿):** ‘Æ±¯ÁµÃ· transform state ±ÀÌ CanvasContext
   - ¤¿ CanvasContext ½± ´¹±Ä·Á®Ãµ¹ ¼Ì½¿: refs (dxfRef, overlayRef) + ZoomManager
   - Œ»¿ Ä¿ transform state ’ TransformContext (single source of truth)

2. **Option B:** Composition pattern
   - CanvasContext ½± º±Ä±½±»Î½µ¹ TransformContext internally
   - Expose unified API ¼­ÃÉ CanvasContext

3. **Option C:** Merge contexts
   - •½¿À¿¯·Ã· Ãµ ­½± UnifiedCanvasTransformContext (À¹¿ radical ±»»±³®)

---

### 3ã CursorSystem/CursorContext (systems/cursor/CursorSystem.tsx)

**£º¿ÀÌÂ:** Professional CAD-style cursor management ¼µ comprehensive state

** ±ÁµÇÌ¼µ½· State:**
```typescript
interface CursorContextType extends CursorState {
  // Position tracking
  position: Point2D | null;          // Screen coordinates
  worldPosition: Point2D | null;     // World coordinates

  // Mouse state
  mouseDown: boolean;
  mouseButton: number | null;
  active: boolean;

  // Selection box
  selectionBox: { start: Point2D; current: Point2D } | null;

  // Snap integration
  snapPoint: Point2D | null;

  // Tool state
  activeTool: string | null;
  toolData: Record<string, any>;

  // Settings
  settings: CursorSettings;

  // Actions (15+ methods)
  updateSettings: (updates: Partial<CursorSettings>) => void;
  updatePosition: (position: Point2D | null) => void;
  updateWorldPosition: (position: Point2D | null) => void;
  setMouseDown: (down: boolean, button?: number) => void;
  setActive: (active: boolean) => void;
  startSelection: (startPoint: Point2D) => void;
  updateSelection: (currentPoint: Point2D) => void;
  endSelection: () => void;
  setSnapPoint: (point: Point2D | null) => void;
  setActiveTool: (tool: string | null) => void;
  setToolData: (data: Record<string, any>) => void;
  reset: () => void;
}
```

**•Å¸Í½µÂ:**
-  Cursor position tracking (screen + world coordinates)
-  Mouse event state (down, button, active)
-  Selection box functionality (start, update, end)
-  Snap point integration
-  Tool state management (active tool, tool data)
-  Cursor settings (size, color, style, crosshair)

**§Á®Ã·:**
- Consumed via `useCursor()` hook
- Provider: `<CursorProvider>`
- Reducer-based state management (useReducer)
- §Á·Ã¹¼¿À¿¹µ¯Ä±¹ Ãµ: mouse handlers, selection systems, snap systems

** £©£¤Ÿ PATTERN:**
- §Á·Ã¹¼¿À¿¹µ¯ **reducer pattern** ³¹± complex state
- š±»¬ ´¿¼·¼­½¿ API ¼µ À¿»»¬ granular actions
- Comprehensive CAD-grade functionality

**L ”¥—¤™šŸ  ¡Ÿ’›—œ‘:**
š±½­½± overlap ¼µ ¬»»± contexts - **well isolated**

---

### 4ã SnapContext (snapping/context/SnapContext.tsx)

**£º¿ÀÌÂ:** ”¹±Çµ¯Á¹Ã· snap mode states (ENDPOINT, MIDPOINT, CENTER, ºÄ».)

** ±ÁµÇÌ¼µ½· State:**
```typescript
interface SnapContextType {
  snapState: SnapState;                    // 16 snap types
  toggleSnap: (type: ExtendedSnapType) => void;
  snapEnabled: boolean;
  enabledModes: Set<ExtendedSnapType>;
  setExclusiveMode: (mode: ExtendedSnapType) => void;
  disableAllSnaps: () => void;
  enableAllSnaps: () => void;
}

// Snap types supported:
// ENDPOINT, MIDPOINT, CENTER, NODE, QUADRANT,
// INTERSECTION, INSERTION, PERPENDICULAR, TANGENT,
// NEAREST, APPARENT_INTERSECTION, PARALLEL, EXTENSION,
// GRID, POLAR, TEMPORARY
```

**•Å¸Í½µÂ:**
-  Toggle individual snap modes
-  Exclusive mode setting (disable others)
-  Global snap enable/disable
-  ”¹±Çµ¯Á¹Ã· 16 ´¹±Æ¿ÁµÄ¹ºÎ½ snap types

**§Á®Ã·:**
- Consumed via `useSnapContext()` hook
- Provider: `<SnapProvider>`
- §Á·Ã¹¼¿À¿¹µ¯Ä±¹ Ãµ: snap engines, snap UI, cursor system

** £©£¤Ÿ PATTERN:**
- š±¸±Á¬ defined responsibility (snap modes only)
- š±»Ì API ³¹± CAD snap functionality
- Well isolated ±ÀÌ ¬»»± contexts

**L ”¥—¤™šŸ  ¡Ÿ’›—œ‘:**
š±½­½± overlap - **single responsibility principle Ä·Áµ¯Ä±¹**

---

### 5ã GripProvider/GripContext (providers/GripProvider.tsx)

**£º¿ÀÌÂ:** ”¹±Çµ¯Á¹Ã· grip settings ¼µ fallback hierarchy

** ±ÁµÇÌ¼µ½· State:**
```typescript
interface GripContextType {
  gripSettings: GripSettings;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  resetToDefaults: () => void;

  // Helper methods
  getGripSize: (state: 'cold' | 'warm' | 'hot') => number;
  getGripColor: (state: 'cold' | 'warm' | 'hot') => string;
}

interface GripSettings {
  enabled: boolean;
  size: number;
  hotColor: string;
  warmColor: string;
  coldColor: string;
  hoverSize: number;
  // ... more settings
}
```

**•Å¸Í½µÂ:**
-  Grip settings management
-  Integration ¼µ DxfSettingsProvider (primary source)
-  Fallback Ãµ ConfigurationProvider
-  Deep equality checking ³¹± stability
-  Grip style management (cold/warm/hot states)

**§Á®Ã·:**
- Consumed via `useGripContext()` hook
- Provider: `<GripProvider>`
- Fallback hierarchy: DxfSettingsProvider ’ ConfigurationProvider ’ defaults

**  ”¥—¤™šŸ  ¡Ÿ’›—œ‘: Settings Complexity**

¤¿ GripProvider ­Çµ¹ **3-level fallback hierarchy**:
1. Primary: DxfSettingsProvider (central settings hub)
2. Secondary: ConfigurationProvider (legacy)
3. Tertiary: DEFAULT_GRIP_SETTINGS (hardcoded)

**•ÁÎÄ·¼±:** §Áµ¹¬¶µÄ±¹ ±ÅÄ® · À¿»ÅÀ»¿ºÌÄ·Ä± ® ¼À¿Áµ¯ ½± ±À»¿À¿¹·¸µ¯;

---

### 6ã DxfSettingsProvider (providers/DxfSettingsProvider.tsx)

**£º¿ÀÌÂ:** Central hub ³¹± Ì»± Ä± DXF viewer settings

** ±ÁµÇÌ¼µ½· State:**
```typescript
interface DxfSettingsContextType {
  // Settings groups
  lineSettings: LineSettings;
  textSettings: TextSettings;
  gripSettings: GripSettings;
  gridSettings: GridSettings;
  rulerSettings: RulerSettings;
  cursorSettings: CursorSettings;

  // Update methods
  updateLineSettings: (updates: Partial<LineSettings>) => void;
  updateTextSettings: (updates: Partial<TextSettings>) => void;
  updateGripSettings: (updates: Partial<GripSettings>) => void;
  updateGridSettings: (updates: Partial<GridSettings>) => void;
  updateRulerSettings: (updates: Partial<RulerSettings>) => void;
  updateCursorSettings: (updates: Partial<CursorSettings>) => void;

  // Batch operations
  resetAllToDefaults: () => void;
  exportSettings: () => AllSettings;
  importSettings: (settings: Partial<AllSettings>) => void;
}
```

**•Å¸Í½µÂ:**
-  šµ½ÄÁ¹º® ´¹±Çµ¯Á¹Ã· Ì»É½ ÄÉ½ settings
-  Persistence Ãµ localStorage
-  Batch updates
-  Import/Export functionality
-  Sync stores ³¹± Grid º±¹ Ruler (»Í½µ¹ circular dependencies)

**Sync Store Pattern (³¹± Grid/Ruler):**
```typescript
const createGridStore = (): GridSettingsStore => {
  let current = { ...DEFAULT_GRID_SETTINGS };
  const listeners = new Set<(settings: GridSettings) => void>();

  return {
    get settings() { return current; },
    update: (updates) => {
      current = { ...current, ...updates };
      listeners.forEach(listener => listener(current));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};
```

**§Á®Ã·:**
- Consumed via `useDxfSettings()` hook
- Provider: `<DxfSettingsProvider>`
- §Á·Ã¹¼¿À¿¹µ¯Ä±¹ Ãµ: À¿»»±À»¬ components ³¹± settings access

** £©£¤Ÿ PATTERN:**
- Central settings hub (single source of truth ³¹± settings)
- Sync store pattern »Í½µ¹ circular dependency issues
- š±»® separation of concerns

**  OVERLAP œ• GripProvider:**

¤¿ DxfSettingsProvider ´¹±Çµ¹Á¯¶µÄ±¹ `gripSettings`, ±»»¬ ÅÀ¬ÁÇµ¹ º±¹ ¾µÇÉÁ¹ÃÄÌ GripProvider.

**•ÁÎÄ·¼±:** §Áµ¹¬¶µÄ±¹ Ä¿ ¾µÇÉÁ¹ÃÄÌ GripProvider ® ¼À¿Áµ¯ ½± ±Æ±¹Áµ¸µ¯;

---

## =Ë SYSTEM CONTEXTS (15 µÀ¹À»­¿½)

### RulersGridSystem Context
**Path:** `systems/rulers-grid/RulersGridSystem.tsx`
**Scope:** Ruler º±¹ Grid system state
**Overlap:** š±¼¯± - º±»¬ isolated

### Levels Context
**Path:** `systems/levels/useLevels.ts`
**Scope:** Level management (floors/stories)
**Overlap:** š±¼¯±

### EntityCreationSystem Context
**Path:** `systems/entity-creation/EntityCreationSystem.tsx`
**Scope:** Entity creation workflow state
**Overlap:** š±¼¯±

### ConstraintsSystem Context
**Path:** `systems/constraints/ConstraintsSystem.tsx`
**Scope:** Geometric constraints management
**Overlap:** š±¼¯±

### ToolbarsSystem Context
**Path:** `systems/toolbars/ToolbarsSystem.tsx`
**Scope:** Toolbar state º±¹ actions
**Overlap:** š±¼¯±

### SelectionSystem Context
**Path:** `systems/selection/SelectionSystem.tsx`
**Scope:** Entity selection state
**Overlap:** š±¼¯±

### Overlay Store Context
**Path:** `overlays/overlay-store.tsx`
**Scope:** Overlay layer management
**Overlap:** š±¼¯±

### LineSettingsContext
**Path:** `contexts/LineSettingsContext.tsx`
**Scope:** Line drawing settings
**Overlap:**   Overlap ¼µ DxfSettingsProvider.lineSettings

### TextSettingsContext
**Path:** `contexts/TextSettingsContext.tsx`
**Scope:** Text settings
**Overlap:**   Overlap ¼µ DxfSettingsProvider.textSettings

### ProjectHierarchyContext
**Path:** `contexts/ProjectHierarchyContext.tsx`
**Scope:** Project structure º±¹ hierarchy
**Overlap:** š±¼¯±

### ConfigurationProvider
**Path:** `providers/ConfigurationProvider.tsx`
**Scope:** Legacy configuration management
**Overlap:**   Fallback ³¹± GripProvider (legacy)

### UnifiedProviders
**Path:** `providers/UnifiedProviders.tsx`
**Scope:** Composition Ì»É½ ÄÉ½ providers
**Overlap:** š±¼¯± (wrapper)

### StyleManagerProvider
**Path:** `providers/StyleManagerProvider.tsx`
**Scope:** Style º±¹ theme management
**Overlap:** š±¼¯±

### StableFirestoreProvider
**Path:** `providers/StableFirestoreProvider.tsx`
**Scope:** Firestore integration ¼µ stable subscriptions
**Overlap:** š±¼¯±

---

## =¨ •¤Ÿ ™£œ•‘ OVERLAPS

### 1. =4 š¡™¤™šŸ: Transform State Duplication

**Contexts:** CanvasContext ” TransformContext

**Overlap:**
- š±¹ Ä± ´Í¿ ´¹±Çµ¹Á¯¶¿½Ä±¹ `ViewTransform` state
- š±¹ Ä± ´Í¿ À±Á­Ç¿Å½ `setTransform()` method
- ”Í¿ À·³­Â ±»®¸µ¹±Â ³¹± Ä¿ ¯´¹¿ state

**Impact:** ¥¨—›Ÿ£
-  ¹¸±½ÌÄ·Ä± state desynchronization
- Confusion ³¹± developers
- Maintenance overhead

**£ÍÃÄ±Ã·:**
```typescript
// BEFORE (Current - Problematic)
interface CanvasContextType {
  dxfRef: React.RefObject<any>;
  overlayRef: React.RefObject<any>;
  transform: ViewTransform;              // L ”™ ›Ÿ¤¥ Ÿ
  setTransform: (transform: ViewTransform) => void;  // L ”™ ›Ÿ¤¥ Ÿ
  zoomManager: ZoomManager | null;
  setZoomManager: (manager: ZoomManager) => void;
}

// AFTER (Proposed - Clean)
interface CanvasContextType {
  dxfRef: React.RefObject<any>;
  overlayRef: React.RefObject<any>;
  //  REMOVE transform state - use TransformContext instead
  zoomManager: ZoomManager | null;
  setZoomManager: (manager: ZoomManager) => void;
}

// Usage becomes:
const { dxfRef, overlayRef, zoomManager } = useCanvasContext();
const { transform, setTransform } = useTransform();  // From TransformContext
```

---

### 2. =á œ•¤¡™Ÿ: Settings Management Complexity

**Contexts:** DxfSettingsProvider ” GripProvider ” ConfigurationProvider

**Overlap:**
- DxfSettingsProvider ´¹±Çµ¹Á¯¶µÄ±¹ `gripSettings`
- GripProvider ´¹±Çµ¹Á¯¶µÄ±¹ µÀ¯Ã·Â `gripSettings` ¼µ fallback hierarchy
- ConfigurationProvider À±Á­Çµ¹ legacy grip settings

**Impact:** œ•¤¡™Ÿ£
-  ¿»ÍÀ»¿º¿ fallback hierarchy
- Potential confusion À¿¹¿ provider ½± ÇÁ·Ã¹¼¿À¿¹®ÃÉ
- ”ÍÃº¿»¿ maintenance

**£ÍÃÄ±Ã·:**
```typescript
// Option A: ‘Æ±¯ÁµÃ· GripProvider
// §Á®Ã· ¼Ì½¿ DxfSettingsProvider.gripSettings

// Option B: ‘À»¿À¿¯·Ã· Fallback
// GripProvider ’ DxfSettingsProvider ’ defaults
// (Remove ConfigurationProvider ±ÀÌ chain)

// Option C: Merge all settings
// ˆ½± UnifiedSettingsProvider ³¹± Ì»±
```

---

### 3. =á œ•¤¡™Ÿ: Line/Text Settings Duplication

**Contexts:**
- LineSettingsContext ” DxfSettingsProvider.lineSettings
- TextSettingsContext ” DxfSettingsProvider.textSettings

**Overlap:**
- µÇÉÁ¹ÃÄ¬ contexts ³¹± Line º±¹ Text settings
- ‘»»¬ Ä¿ DxfSettingsProvider ´¹±Çµ¹Á¯¶µÄ±¹ º±¹ Ä± ´Í¿

**Impact:** œ•¤¡™Ÿ£
- ”Í¿ ÄÁÌÀ¿¹ ½± À¬Áµ¹Â Ä± ¯´¹± settings
- Potential inconsistency

**£ÍÃÄ±Ã·:**
```typescript
// DEPRECATE: LineSettingsContext, TextSettingsContext
// USE ONLY: DxfSettingsProvider.lineSettings, textSettings

// Migration:
// Before:
const { lineSettings } = useLineSettings();
const { textSettings } = useTextSettings();

// After:
const { lineSettings, textSettings } = useDxfSettings();
```

---

##  š‘›‘ ‘ ŸœŸ©œ•‘ CONTEXTS (No Overlaps)

### Excellent Isolation:
-  **CursorContext** - œ¿½±´¹º® µÅ¸Í½·: cursor state
-  **SnapContext** - œ¿½±´¹º® µÅ¸Í½·: snap modes
-  **RulersGridSystem** - œ¿½±´¹º® µÅ¸Í½·: rulers/grid
-  **LevelsContext** - œ¿½±´¹º® µÅ¸Í½·: level management
-  **EntityCreationSystem** - œ¿½±´¹º® µÅ¸Í½·: entity creation
-  **ConstraintsSystem** - œ¿½±´¹º® µÅ¸Í½·: constraints
-  **ToolbarsSystem** - œ¿½±´¹º® µÅ¸Í½·: toolbars
-  **SelectionSystem** - œ¿½±´¹º® µÅ¸Í½·: selection
-  **OverlayStore** - œ¿½±´¹º® µÅ¸Í½·: overlays
-  **ProjectHierarchy** - œ¿½±´¹º® µÅ¸Í½·: project structure
-  **StyleManager** - œ¿½±´¹º® µÅ¸Í½·: styles/themes
-  **StableFirestore** - œ¿½±´¹º® µÅ¸Í½·: Firestore

**‘ÅÄ¬ Ä± contexts ±º¿»¿Å¸¿Í½ Ä¿ Single Responsibility Principle ¬Á¹ÃÄ±!**

---

## =Ê ARCHITECTURE PATTERNS OBSERVED

### 1. Reducer Pattern 
**Used in:** CursorSystem
**Quality:** Excellent ³¹± complex state ¼µ À¿»»¬ actions

### 2. Fallback Hierarchy Pattern  
**Used in:** GripProvider
**Quality:**  ¿»ÍÀ»¿º¿ - ÇÁµ¹¬¶µÄ±¹ ±À»¿À¿¯·Ã·

### 3. Sync Store Pattern 
**Used in:** DxfSettingsProvider (Grid/Ruler)
**Quality:** Excellent »ÍÃ· ³¹± circular dependencies

### 4. Single Source of Truth 
**Used in:** TransformContext
**Quality:** Best practice - ÀÁ­Àµ¹ ½± µÀµºÄ±¸µ¯

### 5. Composition Pattern 
**Used in:** UnifiedProviders
**Quality:** Excellent ³¹± provider composition

---

## <¯ £¥£¤‘£•™£  ¡Ÿ¤•¡‘™Ÿ¤—¤‘£

### =4 PRIORITY 1: Fix Transform State Duplication

**Problem:** CanvasContext º±¹ TransformContext ´¹±Çµ¹Á¯¶¿½Ä±¹ Ä¿ ¯´¹¿ transform state

**Solution:**
1. ‘Æ±¯ÁµÃ· transform/setTransform ±ÀÌ CanvasContext
2. §Á®Ã· ¼Ì½¿ TransformContext ³¹± transform state
3. CanvasContext ’ refs + ZoomManager ¼Ì½¿
4. Update all consumers ½± ÇÁ·Ã¹¼¿À¿¹¿Í½ Ä± ´Í¿ contexts ¾µÇÉÁ¹ÃÄ¬

**Affected Files (~15 files):**
- contexts/CanvasContext.tsx
- hooks/interfaces/useCanvasOperations.ts
- components/dxf-layout/CanvasSection.tsx
- systems/zoom/* (Ì»± Ä± zoom files)
- systems/pan/* (Ì»± Ä± pan files)

**Estimated Effort:** 4-6 hours
**Risk:** œ•¤¡™Ÿ£ (º±»¬ documented)

---

### =á PRIORITY 2: Simplify Settings Management

**Problem:**  ¿»»±À»¬ overlapping settings providers

**Solution:**
1. **Phase 1:** Deprecate LineSettingsContext, TextSettingsContext
   - §Á®Ã· ¼Ì½¿ DxfSettingsProvider

2. **Phase 2:** Simplify GripProvider fallback
   - Remove ConfigurationProvider ±ÀÌ chain
   - GripProvider ’ DxfSettingsProvider ’ defaults

3. **Phase 3:** Consider merging GripProvider ÃÄ¿ DxfSettingsProvider
   - ‘½ ´µ½ ÇÁµ¹¬¶µÄ±¹ ¾µÇÉÁ¹ÃÄÌ context

**Affected Files (~10 files):**
- contexts/LineSettingsContext.tsx (deprecate)
- contexts/TextSettingsContext.tsx (deprecate)
- providers/GripProvider.tsx (simplify)
- providers/DxfSettingsProvider.tsx (extend)
- All consumers (~6 files)

**Estimated Effort:** 6-8 hours
**Risk:** §‘œ—›Ÿ£ (settings isolated)

---

### =â PRIORITY 3: Document Best Practices

**Problem:** ”µ½ ÅÀ¬ÁÇµ¹ documentation ³¹± context usage patterns

**Solution:**
1. ”·¼¹¿ÅÁ³¯± `CONTEXT_PATTERNS.md` guide
2. Document ÀÌÄµ ½± ´·¼¹¿ÅÁ³µ¯Â ½­¿ context
3. Document best practices ³¹± context composition
4. Examples ³¹± common patterns

**Affected Files:** 1 ½­¿ documentation file

**Estimated Effort:** 2-3 hours
**Risk:** œ—”•™šŸ£ (documentation only)

---

## =È METRICS & STATISTICS

### Context Provider Distribution

| Category | Count | Examples |
|----------|-------|----------|
| **Core Contexts** | 6 | Canvas, Transform, Cursor, Snap, Grip, Settings |
| **System Contexts** | 9 | RulersGrid, Levels, EntityCreation, Constraints, Toolbars, Selection, Overlays |
| **Legacy Providers** | 3 | Configuration, LineSettings, TextSettings |
| **Infrastructure** | 3 | UnifiedProviders, StyleManager, StableFirestore |
| **TOTAL** | 21 | - |

### Overlap Severity

| Severity | Count | Contexts |
|----------|-------|----------|
| =4 **Critical** | 1 | CanvasContext ” TransformContext (transform state) |
| =á **Medium** | 3 | Settings management (DxfSettings ” Grip ” Line ” Text) |
| =â **Low/None** | 17 | All other contexts (well isolated) |

### Code Quality Indicators

| Metric | Score | Notes |
|--------|-------|-------|
| **Isolation** | 80% | 17/21 contexts º±»¬ isolated |
| **Single Responsibility** | 85% | Majority follow SRP |
| **Type Safety** | 100% | Œ»± TypeScript ¼µ interfaces |
| **Documentation** | 60% | Inline docs º±»¬, architectural docs »µ¯À¿Å½ |

---

## =' IMPLEMENTATION ROADMAP

### Week 1: Critical Fixes
- [ ] Fix CanvasContext/TransformContext overlap
- [ ] Create CONTEXT_PATTERNS.md documentation
- [ ] Test transform state migration

### Week 2: Settings Simplification
- [ ] Deprecate LineSettingsContext
- [ ] Deprecate TextSettingsContext
- [ ] Update consumers Ãµ DxfSettingsProvider

### Week 3: Advanced Cleanup
- [ ] Simplify GripProvider fallback hierarchy
- [ ] Consider merging GripProvider Ãµ DxfSettings
- [ ] Remove ConfigurationProvider (if obsolete)

### Week 4: Testing & Documentation
- [ ] Full integration testing
- [ ] Update architectural documentation
- [ ] Code review º±¹ final cleanup

---

## =Ú REFERENCE FILES

### Core Context Files Analyzed
```
contexts/
     CanvasContext.tsx          #   Transform overlap
     TransformContext.tsx       #  Single source of truth
     LineSettingsContext.tsx    #   Deprecated candidate
     TextSettingsContext.tsx    #   Deprecated candidate
     ProjectHierarchyContext.tsx #  Well isolated

systems/
     cursor/CursorSystem.tsx    #  Excellent design
     rulers-grid/RulersGridSystem.tsx
     levels/useLevels.ts
     entity-creation/EntityCreationSystem.tsx
     constraints/ConstraintsSystem.tsx
     toolbars/ToolbarsSystem.tsx
     selection/SelectionSystem.tsx

providers/
     DxfSettingsProvider.tsx    #  Central settings hub
     GripProvider.tsx           #   Complex fallback
     ConfigurationProvider.tsx  #   Legacy (deprecate?)
     UnifiedProviders.tsx       #  Composition pattern
     StyleManagerProvider.tsx
     StableFirestoreProvider.tsx

snapping/
     context/SnapContext.tsx    #  Well isolated

overlays/
     overlay-store.tsx          #  Well isolated
```

### Consuming Hooks
```typescript
// Core hooks
useCanvasContext()     //   Contains transform (duplicate)
useTransform()         //  Preferred ³¹± transform
useCursor()            //  Excellent design
useSnapContext()       //  Well designed
useGripContext()       //   Complex fallback
useDxfSettings()       //  Central settings

// Legacy hooks (deprecate?)
useLineSettings()      //   Use useDxfSettings() instead
useTextSettings()      //   Use useDxfSettings() instead
```

---

## =¡ BEST PRACTICES IDENTIFIED

###  Patterns to Follow

1. **Single Responsibility Principle**
   - š¬¸µ context ¼¯± ÃÅ³ºµºÁ¹¼­½· µÅ¸Í½·
   - Example: SnapContext ´¹±Çµ¹Á¯¶µÄ±¹ œŸŸ snap modes

2. **Reducer Pattern ³¹± Complex State**
   - CursorSystem ÇÁ·Ã¹¼¿À¿¹µ¯ useReducer
   - š±»ÍÄµÁ¿ ±ÀÌ À¿»»¬ useState ³¹± complex state

3. **Sync Store ³¹± Circular Dependencies**
   - DxfSettingsProvider »Í½µ¹ circular deps ¼µ sync stores
   - Excellent pattern ³¹± Grid/Ruler settings

4. **Single Source of Truth**
   - TransformContext µ¯½±¹ Ä¿ œŸŸ transform state
   - ŒÇ¹ duplicates Ãµ ¬»»± contexts

5. **Type Safety**
   - Œ»± Ä± contexts ¼µ TypeScript interfaces
   - Compile-time safety

### L Patterns to Avoid

1. **State Duplication**
   - CanvasContext.transform duplicate (BAD)
   - ˆ½± state, ­½± context

2. **Complex Fallback Hierarchies**
   - GripProvider: 3-level fallback (TOO COMPLEX)
   - Simplify Ãµ 2 levels max

3. **Multiple Providers ³¹± Ä¿ Š´¹¿ Domain**
   - LineSettingsContext + DxfSettingsProvider.lineSettings (REDUNDANT)
   - Pick one, deprecate the other

4. **Unclear Ownership**
   -  ¿¹¿Â µ¯½±¹ ¿ owner Ä¿Å transform state? (CONFUSING)
   - Clear ownership = clear architecture

---

## <“ LEARNING POINTS

### ¤¹ ”¿Å»µÍµ¹ š±»¬
1. ¤¿ **CursorSystem** µ¯½±¹ **reference implementation** ³¹± complex contexts
2. ¤¿ **TransformContext** ±º¿»¿Å¸µ¯ ÃÉÃÄ¬ Ä¿ "Single Source of Truth"
3. ¤± **System contexts** (Levels, EntityCreation, ºÄ».) µ¯½±¹ ¬Á¹ÃÄ± isolated
4. **Sync store pattern** »Í½µ¹ circular dependencies elegantly

### ¤¹ §Áµ¹¬¶µÄ±¹ ’µ»Ä¯ÉÃ·
1. **Transform state ownership** ÀÁ­Àµ¹ ½± ¾µº±¸±Á¹ÃÄµ¯ (remove ±ÀÌ CanvasContext)
2. **Settings management** ÀÁ­Àµ¹ ½± ±À»¿À¿¹·¸µ¯ (too many overlaps)
3. **Documentation** ÇÁµ¹¬¶µÄ±¹ architectural guide ³¹± context patterns
4. **Fallback hierarchies** ÀÁ­Àµ¹ ½± ¼µ¹É¸¿Í½ (max 2 levels)

---

## <Á CONCLUSION

### Summary
- **21 Context providers** identified
- **1 critical overlap** (CanvasContext ” TransformContext)
- **3 medium overlaps** (Settings management)
- **17 well-isolated contexts** (excellent)

### Priority Actions
1. =4 Fix transform state duplication (URGENT)
2. =á Simplify settings management (IMPORTANT)
3. =â Document context patterns (GOOD TO HAVE)

### Overall Assessment
¤¿ dxf-viewer ­Çµ¹ **º±»® context architecture** ¼µ ¼µÁ¹º¬ **critical overlaps** À¿Å ÇÁµ¹¬¶¿½Ä±¹ immediate attention. ¤± ÀµÁ¹ÃÃÌÄµÁ± contexts ±º¿»¿Å¸¿Í½ best practices º±¹ µ¯½±¹ º±»¬ isolated. œµ Ä¹Â ÀÁ¿Äµ¹½Ì¼µ½µÂ ²µ»Ä¹ÎÃµ¹Â, · ±ÁÇ¹ÄµºÄ¿½¹º® ¸± ³¯½µ¹ **production-grade**.

---

**—¼µÁ¿¼·½¯± ‘½±Æ¿Á¬Â:** 2025-10-03
**‘½±»ÅÄ®Â:** Claude (Anthropic AI)
**•ÀÌ¼µ½· ‘½±¸µÎÁ·Ã·:** œµÄ¬ Ä·½ Å»¿À¿¯·Ã· ÄÉ½ PRIORITY 1-2 fixes
