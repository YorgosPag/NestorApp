# 🏪 State Management

> **Centralized state management με Context API και Zustand stores**
> Enterprise patterns για shared state και dependency injection

---

## 📋 Table of Contents

- [Overview](#overview)
- [State Management Patterns](#state-management-patterns)
- [Context Providers](#context-providers)
- [Zustand Stores](#zustand-stores)
- [State Flow](#state-flow)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Best Practices](#best-practices)

---

## Overview

Το **State Management System** χρησιμοποιεί:
- **React Context API** - Για global state και dependency injection
- **Zustand Stores** - Για reactive style state
- **Component State** - Για local UI state
- **Ref-based State** - Για imperative APIs (canvas instances)

### 🎯 State Categories

| Category | Technology | Scope | Examples |
|----------|-----------|-------|----------|
| **Canvas State** | Context | Global | Transform, ZoomManager, Canvas refs |
| **Selection State** | Context | Global | Selected entities, selection mode |
| **Style State** | Zustand | Global | Text styles, Grip styles |
| **Settings State** | Context | Global | Drawing settings, Preferences |
| **UI State** | useState | Local | Modal visibility, Input values |
| **Overlay State** | Custom Store | Global | Overlay entities, Regions |

---

## State Management Patterns

### Pattern 1: Context-Based Dependency Injection

**Use for**: Shared services και managers που χρειάζονται πολλά components

```typescript
<CanvasProvider>           // Provides: ZoomManager, Canvas refs
  <SelectionProvider>      // Provides: Selection state
    <GripProvider>         // Provides: Grip settings
      <App />
    </GripProvider>
  </SelectionProvider>
</CanvasProvider>
```

**Benefits**:
- ✅ Single instance guarantee
- ✅ No prop drilling
- ✅ Easy testing (mock context)
- ✅ Type-safe consumption

### Pattern 2: Zustand Stores

**Use for**: Reactive state που χρειάζεται subscribe/update από πολλά σημεία

```typescript
const useTextStyleStore = create<TextStyleStore>((set) => ({
  fontSize: 12,
  fontFamily: 'Arial',
  setFontSize: (size) => set({ fontSize: size })
}))

// Usage
const fontSize = useTextStyleStore(state => state.fontSize)
```

**Benefits**:
- ✅ Simple API
- ✅ No boilerplate
- ✅ DevTools integration
- ✅ Performance (fine-grained subscriptions)

### Pattern 3: Custom Stores

**Use for**: Complex state με custom logic (overlays, projects)

```typescript
class OverlayStore {
  private overlays = new Map<string, Overlay>()
  private listeners = new Set<Listener>()

  add(overlay: Overlay) {
    this.overlays.set(overlay.id, overlay)
    this.notify()
  }

  // ... more methods
}
```

---

## Context Providers

### A. CanvasContext (ΚΕΝΤΡΙΚΟ)

**Path**: `src/subapps/dxf-viewer/contexts/CanvasContext.tsx`

**Responsibility**: Canvas state, zoom manager, transform coordination

**Interface**:
```typescript
interface CanvasContextType {
  // Canvas references
  dxfRef: React.RefObject<DxfCanvasAPI>
  overlayRef: React.RefObject<LayerCanvasAPI>

  // Transform state
  transform: ViewTransform
  setTransform: (transform: ViewTransform) => void

  // 🏢 ENTERPRISE: Centralized zoom system
  zoomManager: ZoomManager | null
  setZoomManager: (manager: ZoomManager) => void
}
```

**Provider Implementation**:
```typescript
export const CanvasProvider: React.FC<CanvasProviderProps> = ({ children }) => {
  const dxfRef = useRef<DxfCanvasAPI>(null)
  const overlayRef = useRef<LayerCanvasAPI>(null)
  const [transform, setTransform] = useState<ViewTransform>(initialTransform)
  const [zoomManager, setZoomManager] = useState<ZoomManager | null>(null)

  const value = useMemo(() => ({
    dxfRef,
    overlayRef,
    transform,
    setTransform,
    zoomManager,
    setZoomManager
  }), [transform, zoomManager])

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  )
}
```

**Consumption**:
```typescript
import { useCanvasContext } from '../contexts/CanvasContext'

function MyComponent() {
  const { zoomManager, transform, dxfRef } = useCanvasContext()

  const handleZoom = () => {
    zoomManager?.zoomIn()
  }

  return <button onClick={handleZoom}>Zoom In</button>
}
```

**🏢 Enterprise Features (2025-10-03)**:
- ✅ Centralized ZoomManager access
- ✅ Single Source of Truth για canvas refs
- ✅ Shared transform state
- ✅ Zero breaking changes (backward compatible)

### B. SelectionContext

**Path**: `src/subapps/dxf-viewer/contexts/SelectionContext.tsx` (if exists)

**Responsibility**: Selection state management

**Interface**:
```typescript
interface SelectionContextType {
  selectedIds: Set<string>
  hoveredId: string | null
  selectionMode: 'single' | 'multiple'

  selectEntity: (id: string) => void
  deselectEntity: (id: string) => void
  clearSelection: () => void
  setHoveredId: (id: string | null) => void
}
```

### C. GripContext

**Path**: `src/subapps/dxf-viewer/providers/GripProvider.tsx`

**Responsibility**: Grip settings και state

**Interface**:
```typescript
interface GripContextType {
  gripSettings: {
    size: number
    color: string
    hoverColor: string
    enabled: boolean
  }
  updateGripSettings: (settings: Partial<GripSettings>) => void
}
```

### D. Settings Contexts

**Paths**:
- `LineSettingsContext.tsx` - Line drawing settings
- `TextSettingsContext.tsx` - Text styling settings

**Pattern**:
```typescript
interface LineSettingsContextType {
  lineColor: string
  lineWeight: number
  lineType: string
  setLineColor: (color: string) => void
  setLineWeight: (weight: number) => void
  setLineType: (type: string) => void
}
```

### E. ProjectHierarchyContext

**Path**: `src/subapps/dxf-viewer/contexts/ProjectHierarchyContext.tsx`

**Responsibility**: Project structure state (folders, files, levels)

**Interface**:
```typescript
interface ProjectHierarchyContextType {
  currentProject: Project | null
  currentLevel: Level | null
  setCurrentLevel: (level: Level) => void
  updateProject: (project: Project) => void
}
```

### F. SnapContext (ΚΕΝΤΡΙΚΟ - 2025-10-03)

**Path**: `src/subapps/dxf-viewer/snapping/context/SnapContext.tsx`

**Responsibility**: Centralized snap system state

**Interface**:
```typescript
interface SnapContextType {
  snapState: SnapState
  toggleSnap: (type: ExtendedSnapType) => void
  setSnapState: (state: SnapState) => void
  isSnapActive: (type: ExtendedSnapType) => boolean
  snapEnabled: boolean                    // 🎯 ΚΕΝΤΡΙΚΟ
  setSnapEnabled: (enabled: boolean) => void
  enabledModes: Set<ExtendedSnapType>
  toggleMode: (mode: ExtendedSnapType, enabled: boolean) => void
  setExclusiveMode: (mode: ExtendedSnapType) => void
}
```

**Usage**:
```typescript
import { useSnapContext } from '../snapping/context/SnapContext'

function MyComponent() {
  const { snapEnabled, setSnapEnabled, enabledModes } = useSnapContext()

  return (
    <button onClick={() => setSnapEnabled(!snapEnabled)}>
      Snap: {snapEnabled ? 'ON' : 'OFF'}
    </button>
  )
}
```

**🏢 Enterprise Features**:
- ✅ Global snap enable/disable
- ✅ Snap mode management (Endpoint, Midpoint, Center, etc.)
- ✅ Exclusive mode support (single snap type active)
- ✅ Integration με Drawing system

---

## Zustand Stores

### A. TextStyleStore

**Path**: `src/subapps/dxf-viewer/stores/TextStyleStore.ts` (assumed)

**Responsibility**: Global text styling preferences

```typescript
import create from 'zustand'

interface TextStyleStore {
  fontSize: number
  fontFamily: string
  fontWeight: number
  color: string

  setFontSize: (size: number) => void
  setFontFamily: (family: string) => void
  setFontWeight: (weight: number) => void
  setColor: (color: string) => void
}

export const useTextStyleStore = create<TextStyleStore>((set) => ({
  fontSize: 12,
  fontFamily: 'Arial',
  fontWeight: 400,
  color: '#000000',

  setFontSize: (size) => set({ fontSize: size }),
  setFontFamily: (family) => set({ fontFamily: family }),
  setFontWeight: (weight) => set({ fontWeight: weight }),
  setColor: (color) => set({ color })
}))
```

**Usage**:
```typescript
function TextToolbar() {
  const fontSize = useTextStyleStore(state => state.fontSize)
  const setFontSize = useTextStyleStore(state => state.setFontSize)

  return (
    <input
      type="number"
      value={fontSize}
      onChange={(e) => setFontSize(Number(e.target.value))}
    />
  )
}
```

### B. GripStyleStore

**Path**: `src/subapps/dxf-viewer/stores/GripStyleStore.ts` (assumed)

**Responsibility**: Grip visual appearance

```typescript
interface GripStyleStore {
  size: number
  color: string
  hoverColor: string
  selectedColor: string

  setSize: (size: number) => void
  setColor: (color: string) => void
  setHoverColor: (color: string) => void
  setSelectedColor: (color: string) => void
}

export const useGripStyleStore = create<GripStyleStore>((set) => ({
  size: 8,
  color: '#0078D7',
  hoverColor: '#FFD700',
  selectedColor: '#FF0000',

  setSize: (size) => set({ size }),
  setColor: (color) => set({ color }),
  setHoverColor: (color) => set({ hoverColor: color }),
  setSelectedColor: (color) => set({ selectedColor: color })
}))
```

### C. ToolStyleStore

**Path**: `src/subapps/dxf-viewer/stores/ToolStyleStore.ts` (assumed)

**Responsibility**: Active tool state

```typescript
interface ToolStyleStore {
  activeTool: string
  toolSettings: Record<string, any>

  setActiveTool: (tool: string) => void
  updateToolSetting: (key: string, value: any) => void
}

export const useToolStyleStore = create<ToolStyleStore>((set) => ({
  activeTool: 'select',
  toolSettings: {},

  setActiveTool: (tool) => set({ activeTool: tool }),
  updateToolSetting: (key, value) => set((state) => ({
    toolSettings: { ...state.toolSettings, [key]: value }
  }))
}))
```

---

## Custom Hooks (Centralized Systems)

### useDrawingHandlers (ΚΕΝΤΡΙΚΟ - 2025-10-03)

**Path**: `src/subapps/dxf-viewer/hooks/drawing/useDrawingHandlers.ts`

**Responsibility**: Centralized Drawing & Measurement handlers

**Interface**:
```typescript
function useDrawingHandlers(
  activeTool: ToolType,
  onEntityCreated: (entity: Entity) => void,
  onToolChange: (tool: ToolType) => void,
  currentScene?: SceneModel
): {
  drawingState: DrawingState
  startDrawing: (tool: DrawingTool) => void
  onDrawingPoint: (p: Point2D) => void
  onDrawingHover: (p: Point2D | null) => void
  onDrawingCancel: () => void
  onDrawingDoubleClick: () => void
  cancelAllOperations: () => void
}
```

**Features**:
- ✅ **Unified Drawing System** - Line, Circle, Rectangle, Polyline, Polygon
- ✅ **Unified Measurement System** - Distance, Area, Angle (same handlers!)
- ✅ **Snap Integration** - Auto-connects με SnapContext
- ✅ **Transform Support** - Screen ↔ World coordinate conversion
- ✅ **Preview Support** - Real-time preview entities

**Usage** (from `useDxfViewerState`):
```typescript
import { useDrawingHandlers } from './drawing/useDrawingHandlers'

export function useDxfViewerState() {
  const [activeTool, setActiveTool] = useState<ToolType>('select')
  const sceneState = useSceneState()

  // 🎯 CENTRALIZED DRAWING SYSTEM
  const drawingHandlers = useDrawingHandlers(
    activeTool,
    (entity) => {
      // Add entity to scene
      const updatedScene = {
        ...sceneState.currentScene,
        entities: [...sceneState.currentScene.entities, entity]
      }
      sceneState.handleSceneChange(updatedScene)
    },
    setActiveTool,
    sceneState.currentScene
  )

  return {
    ...drawingHandlers,
    // Drawing handlers
    onDrawingPoint: drawingHandlers.onDrawingPoint,
    onDrawingHover: drawingHandlers.onDrawingHover,
    onDrawingCancel: drawingHandlers.onDrawingCancel,
    onDrawingDoubleClick: drawingHandlers.onDrawingDoubleClick,
    // Measurement handlers (same as drawing!)
    onMeasurementPoint: drawingHandlers.onDrawingPoint,
    onMeasurementHover: drawingHandlers.onDrawingHover,
    onMeasurementCancel: drawingHandlers.onDrawingCancel
  }
}
```

**🏢 Enterprise Features**:
- ✅ **Zero Duplication** - Drawing & Measurement share handlers
- ✅ **Snap-Aware** - Auto snapping to entities
- ✅ **Transform-Aware** - Automatic coordinate conversion
- ✅ **Preview System** - Real-time visual feedback
- ✅ **Tool Cleanup** - Auto-cleanup on tool change

**🔗 Related Systems**:
- `useUnifiedDrawing` - Core drawing state machine
- `useSnapManager` - Snap point detection
- `SnapContext` - Global snap settings

---

## State Flow

### User Interaction → State Update Flow

```
User Action (Click, Keyboard)
    ↓
Event Handler (Component)
    ↓
Context Consumer / Store Hook
    ↓
State Update (Context.setState / Store.set)
    ↓
React Re-render (Affected components)
    ↓
UI Update
```

### Example: Zoom Operation

```
User scrolls mouse wheel
    ↓
handleWheel() in useCentralizedMouseHandlers
    ↓
Extract modifiers (Ctrl/Shift) από event
    ↓
Call onWheelZoom(deltaY, center, undefined, modifiers)
    ↓
useZoom.handleWheelZoom()
    ↓
ZoomManager.wheelZoom(deltaY, center, constraints, modifiers)
    ↓
Calculate new transform
    ↓
onTransformChange(newTransform)
    ↓
CanvasContext.setTransform(newTransform)
    ↓
All consumers re-render (DxfCanvas, LayerCanvas, HUD)
    ↓
Canvas updates με new zoom level
```

### Example: Selection Update

```
User clicks entity
    ↓
handleCanvasClick() in MouseHandlers
    ↓
Hit testing (find entity under cursor)
    ↓
SelectionContext.selectEntity(entityId)
    ↓
Update selectedIds Set
    ↓
Re-render affected components (Entity highlights, Property panel)
```

---

## API Reference

### CanvasContext

```typescript
interface CanvasContextType {
  dxfRef: React.RefObject<DxfCanvasAPI>
  overlayRef: React.RefObject<LayerCanvasAPI>
  transform: ViewTransform
  setTransform: (transform: ViewTransform) => void
  zoomManager: ZoomManager | null
  setZoomManager: (manager: ZoomManager) => void
}

// Hook
function useCanvasContext(): CanvasContextType

// Provider
<CanvasProvider>{children}</CanvasProvider>
```

### Zustand Store Pattern

```typescript
interface Store {
  // State
  value: T

  // Actions
  setValue: (value: T) => void
}

const useStore = create<Store>((set) => ({
  value: initialValue,
  setValue: (value) => set({ value })
}))

// Consumption
const value = useStore(state => state.value)         // Subscribe to value
const setValue = useStore(state => state.setValue)   // Get action
```

### Custom Store Pattern

```typescript
class CustomStore {
  private state: T
  private listeners: Set<Listener>

  getState(): T
  setState(newState: T): void
  subscribe(listener: Listener): () => void
}

// React hook wrapper
function useCustomStore(): T {
  const [state, setState] = useState(store.getState())

  useEffect(() => {
    return store.subscribe(setState)
  }, [])

  return state
}
```

---

## Usage Examples

### Using CanvasContext

```typescript
import { useCanvasContext } from '../contexts/CanvasContext'

function ZoomControls() {
  const { zoomManager } = useCanvasContext()

  return (
    <div>
      <button onClick={() => zoomManager?.zoomIn()}>Zoom In</button>
      <button onClick={() => zoomManager?.zoomOut()}>Zoom Out</button>
      <button onClick={() => zoomManager?.zoomTo100()}>100%</button>
    </div>
  )
}
```

### Multiple Context Consumers

```typescript
function DrawingTool() {
  const { transform } = useCanvasContext()
  const { selectedIds } = useSelectionContext()
  const { gripSettings } = useGripContext()

  // Component logic using all contexts
}
```

### Zustand Store with Selectors

```typescript
// Fine-grained subscription (only re-renders when fontSize changes)
const fontSize = useTextStyleStore(state => state.fontSize)

// Multiple values
const { fontSize, fontFamily } = useTextStyleStore(
  state => ({ fontSize: state.fontSize, fontFamily: state.fontFamily }),
  shallow  // Shallow equality check
)

// Action only (no re-renders)
const setFontSize = useTextStyleStore(state => state.setFontSize)
```

### Providing Context at App Root

```typescript
// DxfViewerContent.tsx
export default function DxfViewerContent() {
  return (
    <CanvasProvider>
      <SelectionProvider>
        <GripProvider>
          <ProjectHierarchyProvider>
            {/* App content */}
            <CanvasSection />
            <Toolbar />
            <StatusBar />
          </ProjectHierarchyProvider>
        </GripProvider>
      </SelectionProvider>
    </CanvasProvider>
  )
}
```

### Custom Store Implementation

```typescript
// OverlayStore.ts
class OverlayStore {
  private overlays = new Map<string, Overlay>()
  private listeners = new Set<(overlays: Overlay[]) => void>()

  add(overlay: Overlay) {
    this.overlays.set(overlay.id, overlay)
    this.notify()
  }

  remove(id: string) {
    this.overlays.delete(id)
    this.notify()
  }

  getAll(): Overlay[] {
    return Array.from(this.overlays.values())
  }

  subscribe(listener: (overlays: Overlay[]) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.getAll()))
  }
}

export const overlayStore = new OverlayStore()

// React hook
export function useOverlays(): Overlay[] {
  const [overlays, setOverlays] = useState(overlayStore.getAll())

  useEffect(() => {
    return overlayStore.subscribe(setOverlays)
  }, [])

  return overlays
}
```

---

## Best Practices

### ✅ DO

**1. Use Context για Shared Services**
```typescript
// ✅ GOOD - ZoomManager σε context
const { zoomManager } = useCanvasContext()
```

**2. Memoize Context Values**
```typescript
// ✅ GOOD - Prevent unnecessary re-renders
const value = useMemo(() => ({
  transform,
  setTransform,
  zoomManager
}), [transform, zoomManager])
```

**3. Fine-Grained Zustand Selectors**
```typescript
// ✅ GOOD - Only subscribe to what you need
const fontSize = useTextStyleStore(state => state.fontSize)
```

**4. Separate Read and Write**
```typescript
// ✅ GOOD - Action doesn't cause re-renders
const setFontSize = useTextStyleStore(state => state.setFontSize)
```

**5. Clean Up Subscriptions**
```typescript
// ✅ GOOD - Return cleanup function
useEffect(() => {
  return store.subscribe(listener)  // Auto-cleanup
}, [])
```

### ❌ DON'T

**1. Avoid Prop Drilling**
```typescript
// ❌ BAD - Passing through many components
<Parent zoomManager={zm}>
  <Child zoomManager={zm}>
    <GrandChild zoomManager={zm} />
  </Child>
</Parent>

// ✅ GOOD - Use context
<CanvasProvider>
  <Parent>
    <Child>
      <GrandChild />  {/* Gets zoomManager από context */}
    </Child>
  </Parent>
</CanvasProvider>
```

**2. Don't Create New Objects in Render**
```typescript
// ❌ BAD - New object every render
<Context.Provider value={{ transform, setTransform }}>

// ✅ GOOD - Memoized object
const value = useMemo(() => ({ transform, setTransform }), [transform])
<Context.Provider value={value}>
```

**3. Don't Subscribe to Entire Store**
```typescript
// ❌ BAD - Re-renders on ANY store change
const store = useTextStyleStore()

// ✅ GOOD - Only re-renders when fontSize changes
const fontSize = useTextStyleStore(state => state.fontSize)
```

**4. Don't Put Everything in Context**
```typescript
// ❌ BAD - Local state in context
const [isModalOpen, setIsModalOpen] = useState(false)  // Keep local!

// ✅ GOOD - Only shared state in context
const { zoomManager } = useCanvasContext()
```

**5. Don't Forget Cleanup**
```typescript
// ❌ BAD - Memory leak
useEffect(() => {
  store.subscribe(listener)
  // Missing cleanup!
}, [])

// ✅ GOOD - Cleanup
useEffect(() => {
  return store.subscribe(listener)
}, [])
```

---

## Performance Considerations

### 1. Context Optimization

**Problem**: Context changes trigger re-renders σε όλα τα consumers

**Solution**: Split contexts by update frequency

```typescript
// ✅ GOOD - Separate fast-changing state
<TransformContext>           {/* Changes often (pan/zoom) */}
  <CanvasRefsContext>        {/* Changes rarely (mount) */}
    <App />
  </CanvasRefsContext>
</TransformContext>
```

### 2. Selector Optimization

**Problem**: Re-rendering even when selected value hasn't changed

**Solution**: Use shallow equality or custom comparator

```typescript
import { shallow } from 'zustand/shallow'

const { fontSize, fontFamily } = useTextStyleStore(
  state => ({ fontSize: state.fontSize, fontFamily: state.fontFamily }),
  shallow  // Don't re-render if values are the same
)
```

### 3. Action-Only Subscriptions

**Problem**: Component re-renders even though it only calls actions

**Solution**: Subscribe to actions only (stable references)

```typescript
// ✅ GOOD - No re-renders
const setFontSize = useTextStyleStore(state => state.setFontSize)
const setColor = useTextStyleStore(state => state.setColor)
```

### 4. Batched Updates

**Problem**: Multiple setState calls cause multiple re-renders

**Solution**: Use Zustand's batched updates or React 18's automatic batching

```typescript
// Zustand automatically batches
store.setState({ fontSize: 14 })
store.setState({ fontFamily: 'Arial' })  // Only 1 re-render

// Or batch manually
store.setState({ fontSize: 14, fontFamily: 'Arial' })
```

---

## Related Documentation

- [Architecture Overview](./overview.md)
- [Zoom & Pan System](../systems/zoom-pan.md)
- [Entity Management](./entity-management.md)
- [Coordinate Systems](./coordinate-systems.md)

---

**🏪 Centralized State Management**
*Context-Based • Reactive • Type-Safe*

Last Updated: 2025-10-03
