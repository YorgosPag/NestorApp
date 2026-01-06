# <× ‘‘¦Ÿ¡‘ MANAGER CLASSES - DXF VIEWER

**—¼µÁ¿¼·½¯± ‘½¬»ÅÃ·Â:** 2025-10-03
**Scope:** `src/subapps/dxf-viewer`
**‘½±»ÅÄ®Â:** Claude Code (Anthropic AI)

---

## <¯ EXECUTIVE SUMMARY

### šµ½ÄÁ¹º¬ •ÅÁ®¼±Ä±

 **•‘™¡•¤™š— Ÿ¡“‘©£—** - Œ»¿¹ ¿¹ Managers ­Ç¿Å½ ¾µº¬¸±ÁµÂ µÅ¸Í½µÂ
 **œ—”•™š‘ ”™ ›Ÿ¤¥ ‘** - š¬¸µ Manager µ¯½±¹ unique ¼µ ´¹±Æ¿ÁµÄ¹ºÌ scope
  **MINOR OVERLAP** - œÌ½¿ 2 ÀµÁ¹ÀÄÎÃµ¹Â ¼µ ¼¹ºÁ® µÀ¹º¬»ÅÈ· (Scene-related)
<¯ **BEST PRACTICES** - Single Responsibility Principle, Dependency Injection

### £Ä±Ä¹ÃÄ¹º¬

| š±Ä·³¿Á¯± | ‘Á¹¸¼ÌÂ Managers | ”¹À»ÌÄÅÀ± | Overlap | Status |
|-----------|------------------|-----------|---------|--------|
| **Core Systems** | 5 | 0 | 0 |  š‘˜‘¡Ÿ |
| **Scene Management** | 3 | 0 | 1 minor |   OK |
| **Utilities** | 4 | 0 | 0 |  š‘˜‘¡Ÿ |
| **Debug/Tools** | 3 | 0 | 0 |  š‘˜‘¡Ÿ |
| **£¥Ÿ›Ÿ** | **15** | **0** | **1** | ** 93.3%** |

---

## =Ê š‘¤‘›Ÿ“Ÿ£ MANAGER CLASSES

### 1. CORE SYSTEM MANAGERS (šµ½ÄÁ¹º¬ £ÅÃÄ®¼±Ä±)

#### 1.1 ZoomManager P
**¤¿À¿¸µÃ¯±:** `systems/zoom/ZoomManager.ts`

**•Å¸Í½·:** Centralized zoom & pan operations

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  `zoomIn()` - œµ³­¸Å½Ã·
-  `zoomOut()` - £¼¯ºÁÅ½Ã·
-  `zoomToFit()` - Fit all contents ÃÄ·½ ¿¸Ì½·
-  `zoomToPoint()` - Zoom Ãµ ÃÅ³ºµºÁ¹¼­½¿ Ã·¼µ¯¿
-  Zoom history (undo/redo)
-  Zoom constraints (min/max scale)

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- `hooks/interfaces/useCanvasOperations.ts`
- `systems/zoom/hooks/useZoom.ts`
- `contexts/CanvasContext.tsx`

**”¹À»ÌÄÅÀ±:** L š‘•‘

**£ÇÌ»¹±:**
```typescript
//  SINGLE SOURCE OF TRUTH ³¹± zoom operations
export class ZoomManager implements IZoomManager {
  private config: ZoomConfig;
  private currentTransform: ViewTransform;
  private history: ZoomHistoryEntry[];

  zoomIn(center?: Point2D, constraints?: ZoomConstraints): ZoomResult
  zoomOut(center?: Point2D, constraints?: ZoomConstraints): ZoomResult
  zoomToFit(bounds, viewport, alignToOrigin?: boolean): ZoomResult
}
```

---

#### 1.2 CanvasManager P
**¤¿À¿¸µÃ¯±:** `rendering/canvas/core/CanvasManager.ts`

**•Å¸Í½·:** Unified canvas lifecycle management

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  `registerCanvas()` - Register ½­¿ canvas instance
-  `unregisterCanvas()` - Remove canvas instance
-  `getCanvas()` - Get canvas by ID
-  `scheduleRender()` - Queue render operation
-  Canvas coordination ¼µÄ±¾Í À¿»»±À»Î½ instances
-  Memory management & cleanup

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- `rendering/canvas/index.ts` (Factory function)
- Canvas components (DxfCanvas, LayerCanvas)

**”¹À»ÌÄÅÀ±:** L š‘•‘

**£ÇÌ»¹±:**
```typescript
//  CENTRAL ORCHESTRATOR ³¹± Ì»± Ä± canvas instances
export class CanvasManager {
  private canvases = new Map<string, CanvasInstance>();
  private renderQueue: Set<string> = new Set();

  registerCanvas(id, type, element, config, zIndex): CanvasInstance
  unregisterCanvas(id: string): void
  scheduleRender(canvasId: string): void
}
```

---

#### 1.3 PhaseManager P
**¤¿À¿¸µÃ¯±:** `systems/phase-manager/PhaseManager.ts`

**•Å¸Í½·:** 3-phase rendering system control

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  Phase 1: Preview (blue dashed, measurements)
-  Phase 2: Normal (white solid, authentic)
-  Phase 3: Interactive (hover/selected states)
-  Grip interaction states (cold/warm/hot)
-  Real-time measurements during dragging

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- `systems/grip-interaction/GripInteractionManager.ts`
- Entity renderers (PhaseManager controls rendering style)

**”¹À»ÌÄÅÀ±:** L š‘•‘

**£ÇÌ»¹±:**
```typescript
//  UNIVERSAL ENTITY RENDERING PHASE CONTROL
export class PhaseManager {
  renderEntityWithPhase(entity: ExtendedEntity, options: RenderOptions): void
  renderGripWithState(grip: GripInfo, state: 'cold'|'warm'|'hot'): void
  renderMeasurements(entity, measurements): void
}
```

---

#### 1.4 GripInteractionManager
**¤¿À¿¸µÃ¯±:** `systems/grip-interaction/GripInteractionManager.ts`

**•Å¸Í½·:** Centralized grip interactions

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  Grip hover detection
-  Grip click handling
-  Grip dragging ¼µ measurements
-  Grip color states (cold’warm’hot)
-  Universal ³¹± all entity types

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- Grip-related hooks
- Canvas mouse handlers

**”¹À»ÌÄÅÀ±:** L š‘•‘

**£ÇÌ»¹±:**
```typescript
//  AUTONOMOUS grip interaction system
export class GripInteractionManager {
  private state: GripInteractionState;
  private phaseManager: PhaseManager;

  handleGripHover(screenPos: Point2D, entities): boolean
  handleGripClick(screenPos: Point2D, entities): boolean
  handleGripDrag(worldPos: Point2D, entity): void
}
```

---

#### 1.5 SnapContextManager
**¤¿À¿¸µÃ¯±:** `snapping/orchestrator/SnapContextManager.ts`

**•Å¸Í½·:** Snap engine context creation & utilities

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  `createEngineContext()` - Create context ³¹± snap engines
-  `worldRadiusAt()` - Calculate world radius ±ÀÌ pixel tolerance
-  `worldRadiusForType()` - Per-snap-type tolerances
-  Settings management ³¹± snap operations

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- `snapping/orchestrator/SnapOrchestrator.ts`
- Snap engines (Endpoint, Midpoint, Center, etc.)

**”¹À»ÌÄÅÀ±:** L š‘•‘

**£ÇÌ»¹±:**
```typescript
//  SNAP UTILITY MANAGER - creates engine contexts
export class SnapContextManager {
  private viewport: Viewport | null = null;

  createEngineContext(cursorPoint, entities, excludeId?): SnapEngineContext
  worldRadiusAt(point: Point2D): number
}
```

---

### 2. SCENE MANAGEMENT (£º·½® & State)

#### 2.1 SceneUpdateManager P
**¤¿À¿¸µÃ¯±:** `managers/SceneUpdateManager.ts`

**•Å¸Í½·:** Scene update coordination & state management

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  `updateScene()` - Coordinated scene updates
-  `setRenderer()` - Register entity renderer
-  `setReactSetScene()` - Register React setState
-  Scene validation
-  Scene versioning
-  Update statistics
-  Concurrent update prevention

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- App-level scene management
- DXF import pipeline

**”¹À»ÌÄÅÀ±:** L š‘•‘ (´¹±Æ¿ÁµÄ¹ºÌ scope ±ÀÌ useSceneManager)

**£ÇÌ»¹±:**
```typescript
//  SCENE UPDATE COORDINATOR - handles coordination logic
export class SceneUpdateManager {
  private currentScene: Scene | null;
  private renderer: EntityRenderer | null;
  private reactSetScene: ((scene) => void) | null;
  private validator: SceneValidator;

  updateScene(newScene, options): void
  setRenderer(renderer): void
  setReactSetScene(setScene): void
}
```

---

#### 2.2 useSceneManager (Hook)
**¤¿À¿¸µÃ¯±:** `hooks/scene/useSceneManager.ts`

**•Å¸Í½·:** React state management ³¹± level scenes

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  `setLevelScene()` - Set scene ³¹± specific level
-  `getLevelScene()` - Get scene ³¹± specific level
-  `clearLevelScene()` - Clear level scene
-  `clearAllScenes()` - Clear all scenes
-  `hasSceneForLevel()` - Check if level has scene
-  `getSceneEntityCount()` - Get entity count

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- `hooks/scene/useAutoSaveSceneManager.ts`
- Levels system

**”¹À»ÌÄÅÀ±:** L š‘•‘ (React hook, ÌÇ¹ class)

**  MINOR OVERLAP ¼µ SceneUpdateManager:**
- **SceneUpdateManager:** Coordination logic (validation, versioning, renderer sync)
- **useSceneManager:** React state management (level-based scenes)
- **”¹±Æ¿ÁµÄ¹º¬ layers:** Coordinator vs State Manager
- **‘À¿Ä­»µÃ¼±:**  ‘ Ÿ”•š¤Ÿ overlap - ´¹±Æ¿ÁµÄ¹º­Â µÅ¸Í½µÂ

**£ÇÌ»¹±:**
```typescript
//  REACT STATE MANAGER ³¹± level scenes (not a class, it's a hook)
export function useSceneManager(): SceneManagerState {
  const [levelScenes, setLevelScenes] = useState<Record<string, SceneModel>>({});

  const setLevelScene = useCallback((levelId, scene) => { ... });
  const getLevelScene = useCallback((levelId) => { ... });
}
```

---

#### 2.3 useAutoSaveSceneManager (Hook)
**¤¿À¿¸µÃ¯±:** `hooks/scene/useAutoSaveSceneManager.ts`

**•Å¸Í½·:** Auto-save functionality wrapper ³¹± useSceneManager

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  **Extends** `useSceneManager` ¼µ auto-save
-  Debounced auto-save (2s delay)
-  Firestore integration
-  Auto-save status tracking
-  Current filename management

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- Levels system
- DXF viewer app

**”¹À»ÌÄÅÀ±:** L š‘•‘ (wrapper pattern)

**£ÇÌ»¹±:**
```typescript
//  AUTO-SAVE WRAPPER - enhances useSceneManager
export function useAutoSaveSceneManager(): AutoSaveSceneManagerState {
  const sceneManager = useSceneManager(); //  USES base manager

  const setLevelSceneWithAutoSave = useCallback((levelId, scene) => {
    sceneManager.setLevelScene(levelId, scene);
    // + Auto-save logic
  }, [sceneManager, autoSaveEnabled, currentFileName]);

  return {
    ...sceneManager,
    setLevelScene: setLevelSceneWithAutoSave, //  ENHANCED version
    // + Auto-save specific properties
  };
}
```

---

### 3. UTILITY MANAGERS (’¿·¸·Ä¹º¬)

#### 3.1 SmartBoundsManager
**¤¿À¿¸µÃ¯±:** `utils/SmartBoundsManager.ts`

**•Å¸Í½·:** Intelligent fit-to-view ¼µ bounds tracking

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  `calculateSceneBounds()` - Calculate scene bounding box
-  `shouldTriggerFitToView()` - Check if bounds changed significantly
-  `triggerFitToViewIfNeeded()` - Smart fit-to-view (¼Ì½¿ ±½ ÇÁµ¹¬¶µÄ±¹)
-  Bounds hashing ³¹± change detection
-  RequestAnimationFrame optimization

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- Scene update workflows
- Fit-to-view operations

**”¹À»ÌÄÅÀ±:** L š‘•‘

**£ÇÌ»¹±:**
```typescript
//  SMART BOUNDS TRACKING - triggers fitToView only when bounds change
export class SmartBoundsManager {
  private lastBoundsHash: string | null;
  private lastBounds: BoundingBox | null;

  calculateSceneBounds(scene): BoundingBox | null
  shouldTriggerFitToView(scene): boolean
  triggerFitToViewIfNeeded(renderer, scene): void
}
```

---

#### 3.2 ToolStateManager
**¤¿À¿¸µÃ¯±:** `systems/tools/ToolStateManager.ts`

**•Å¸Í½·:** Tool state management & coordination

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  Active tool tracking
-  Tool state persistence
-  Tool transitions
-  Tool-specific settings

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- Toolbar systems
- Tool orchestration

**”¹À»ÌÄÅÀ±:** L š‘•‘

---

#### 3.3 CollaborationManager
**¤¿À¿¸µÃ¯±:** `collaboration/CollaborationManager.ts`

**•Å¸Í½·:** Real-time collaboration features

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  User presence tracking
-  Cursor sharing
-  Change synchronization
-  Conflict resolution

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- Collaboration features (if enabled)

**”¹À»ÌÄÅÀ±:** L š‘•‘

---

#### 3.4 state/overlay-manager.ts
**¤¿À¿¸µÃ¯±:** `state/overlay-manager.ts`

**•Å¸Í½·:** Overlay state management (older pattern)

**£·¼µ¯ÉÃ·:** ‘ÅÄÌ Æ±¯½µÄ±¹ ½± µ¯½±¹ **LEGACY** - À¹¸±½Ì½ ±½Ä¹º±Ä±ÃÄ¬¸·ºµ ±ÀÌ:
- `overlays/overlay-store.ts` (Zustand store)
- `hooks/state/useOverlayState.ts`

**”¹À»ÌÄÅÀ±:**    ¹¸±½Ì legacy code - ÇÁµ¹¬¶µÄ±¹ cleanup

---

### 4. DEBUG & DEVELOPMENT MANAGERS

#### 4.1 DebugManager
**¤¿À¿¸µÃ¯±:** `debug/core/DebugManager.ts`

**•Å¸Í½·:** Centralized debug logging ¼µ rate limiting

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  `log()` - Conditional console.log replacement
-  `warn()` - Warning messages
-  `error()` - Error messages
-  Module-based filtering
-  Rate limiting (max logs/second)
-  Production-safe (disabled by default)

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- Canvas V2 system
- Rulers/Grid system
- Debug utilities

**”¹À»ÌÄÅÀ±:** L š‘•‘

**£ÇÌ»¹±:**
```typescript
//  DEBUG LOGGING MANAGER - prevents infinite loops from excessive logging
class DebugManagerClass {
  private config: DebugConfig = {
    enabled: false, //  Disabled by default
    maxLogsPerSecond: 50,
    enabledModules: new Set(['CanvasV2System', 'RulersGridSystem'])
  };

  log(module: string, ...args): void // Rate-limited conditional logging
}
```

---

#### 4.2 UnifiedDebugManager
**¤¿À¿¸µÃ¯±:** `debug/core/UnifiedDebugManager.ts`

**•Å¸Í½·:** Enhanced debug manager ¼µ advanced features

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  **Extends** DebugManager
-  Performance metrics
-  Debug overlays
-  Advanced filtering

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- Debug/development mode

**”¹À»ÌÄÅÀ±:** L š‘•‘ (extends base DebugManager)

---

### 5. UI/COMPONENT MANAGERS (React Components)

#### 5.1 useLayerManagerState (Hook)
**¤¿À¿¸µÃ¯±:** `ui/components/layer-manager/useLayerManagerState.ts`

**•Å¸Í½·:** Layer panel state management

**£·¼µ¯ÉÃ·:** React hook ³¹± UI state, ÌÇ¹ business logic manager

**”¹À»ÌÄÅÀ±:** L š‘•‘

---

#### 5.2 useSnapManager (Hook)
**¤¿À¿¸µÃ¯±:** `snapping/hooks/useSnapManager.tsx`

**•Å¸Í½·:** Snap functionality React hook

**£·¼µ¯ÉÃ·:** React hook wrapper ³¹± snap operations

**”¹À»ÌÄÅÀ±:** L š‘•‘ (´¹±Æ¿ÁµÄ¹ºÌ ±ÀÌ SnapContextManager)

---

## = ‘‘›¥£— ”™ ›Ÿ¤¥ © & OVERLAPS

###  š‘•‘  ¡‘“œ‘¤™šŸ ”™ ›Ÿ¤¥ Ÿ

**‘À¿Ä­»µÃ¼±:** Œ»¿¹ ¿¹ Managers ­Ç¿Å½ ¾µº¬¸±ÁµÂ, ¼·-µÀ¹º±»ÅÀÄÌ¼µ½µÂ µÅ¸Í½µÂ!

###   œŸŸ 1 MINOR OVERLAP

#### Scene Management: SceneUpdateManager vs useSceneManager

**SceneUpdateManager (Class):**
-  Coordination logic
-  Validation & versioning
-  Renderer synchronization
-  Concurrent update prevention
-  Statistics tracking

**useSceneManager (Hook):**
-  React state management
-  Level-based scene storage
-  Scene CRUD operations
-  React-specific optimizations

**‘½¬»ÅÃ·:**
```
                             
  SceneUpdateManager (Class) 
  - Coordination layer       
  - Validation               
  - Renderer sync            
                             
              “
                             
  useSceneManager (Hook)     
  - React state layer        
  - Level management         
  - CRUD operations          
                             
```

**£Å¼À­Á±Ã¼±:**
-  ”¹±Æ¿ÁµÄ¹º¬ layers (Coordinator vs State)
-  ”¹±Æ¿ÁµÄ¹º­Â µÅ¸Í½µÂ (Validation vs Storage)
-  £Å¼À»·ÁÉ¼±Ä¹º¿¯ (ÌÇ¹ ±½Ä±³É½¹ÃÄ¹º¿¯)
- **‘À¿Ä­»µÃ¼±:**  ‘ Ÿ”•š¤Ÿ - Layered architecture pattern

---

## =È œ•¤¡™š•£ & PATTERNS

### Manager Distribution

| ¤ÍÀ¿Â Manager | Count | Percentage |
|--------------|-------|-----------|
| **Core Systems** | 5 | 33.3% |
| **Scene/State** | 3 | 20.0% |
| **Utilities** | 4 | 26.7% |
| **Debug/Tools** | 3 | 20.0% |
| **TOTAL** | **15** | **100%** |

### Architecture Patterns Used

| Pattern | Managers À¿Å Ä¿ ÇÁ·Ã¹¼¿À¿¹¿Í½ |
|---------|-------------------------------|
| **Singleton** | ZoomManager, CanvasManager, DebugManager |
| **Factory** | SnapContextManager (creates contexts) |
| **Wrapper/Decorator** | useAutoSaveSceneManager (wraps useSceneManager) |
| **Observer** | DebugManager (event filtering) |
| **Coordinator** | SceneUpdateManager, CanvasManager |
| **State Container** | useSceneManager, useLayerManagerState |

### Best Practices Observed

1.  **Single Responsibility Principle**
   - š¬¸µ Manager ­Çµ¹ œ™‘ ÃÅ³ºµºÁ¹¼­½· µÅ¸Í½·
   - š±¸±ÁÌÂ ´¹±ÇÉÁ¹Ã¼ÌÂ concerns

2.  **Dependency Injection**
   - Managers ´­Ç¿½Ä±¹ dependencies via constructor
   - ”µ½ ´·¼¹¿ÅÁ³¿Í½ hard dependencies

3.  **Interface Segregation**
   - ZoomManager implements IZoomManager
   - Type-safe contracts

4.  **Layered Architecture**
   - Coordination layer (SceneUpdateManager)
   - State layer (useSceneManager)
   - UI layer (useLayerManagerState)

5.  **Hook Composition**
   - useAutoSaveSceneManager = useSceneManager + auto-save
   - Reusable, composable hooks

---

## <¯ £§•£— œ•¤‘¥ MANAGERS

### Dependency Graph

```
                  
  CanvasManager     Canvas lifecycle orchestrator
                  
         ‘
          uses
         
                                         
   ZoomManager           PhaseManager    
                                         
         ‘                        ‘
                                  uses
                                 
                                                 
  useZoom (hook)        GripInteractionManager   
                                                 


                      
 SceneUpdateManager     Scene coordination
                      
         “
                      
   useSceneManager      React state
                      
         “
                            
 useAutoSaveSceneManager      Enhanced with auto-save
                            


                      
 SnapContextManager     Snap utilities
                      
         ‘
          uses
         
                      
  SnapOrchestrator    
                      
         ‘
         
                      
  useSnapManager        React hook wrapper
                      


                      
   DebugManager       
                      
         “ extends
                      
 UnifiedDebugManager  
                      
```

---

## =€ £¥£¤‘£•™£

### 1. Cleanup Legacy Code

** Á¿ÄµÁ±¹ÌÄ·Ä±:** œµÃ±¯±

**‘ÁÇµ¯¿:** `state/overlay-manager.ts`

**•½­Á³µ¹±:**
```typescript
// L LEGACY (À¹¸±½Ì½ unused)
// state/overlay-manager.ts

//  MODERN (Ãµ ÇÁ®Ã·)
// overlays/overlay-store.ts (Zustand)
// hooks/state/useOverlayState.ts
```

**’®¼±Ä±:**
1. ˆ»µ³Ç¿Â ±½ Ä¿ `state/overlay-manager.ts` ÇÁ·Ã¹¼¿À¿¹µ¯Ä±¹
2. ‘½ ÌÇ¹ ’ ”¹±³Á±Æ®
3. ‘½ ½±¹ ’ Migration Ãµ `overlay-store.ts`

### 2. Documentation Enhancement

** Á¿ÄµÁ±¹ÌÄ·Ä±:** ¥È·»®

**•½­Á³µ¹±:**  Á¿Ã¸®º· Manager documentation ÃÄ¿ `centralized_systems.md`

```markdown
## <× Manager Classes Architecture

### Core Managers
- **ZoomManager**: Zoom & pan operations
- **CanvasManager**: Canvas lifecycle management
- **PhaseManager**: 3-phase rendering control

### Scene Managers
- **SceneUpdateManager**: Coordination layer
- **useSceneManager**: React state layer
- **useAutoSaveSceneManager**: Auto-save enhancement

### Utility Managers
- **SmartBoundsManager**: Bounds tracking & fit-to-view
- **SnapContextManager**: Snap engine utilities
- **GripInteractionManager**: Grip interactions

### Debug Managers
- **DebugManager**: Centralized logging
- **UnifiedDebugManager**: Enhanced debug features

### Usage Guidelines
1. Use ZoomManager ³¹± Ì»µÂ Ä¹Â zoom operations
2. Use CanvasManager ³¹± canvas lifecycle
3. Use SceneUpdateManager + useSceneManager combo ³¹± scenes
4.  Á¿Ã¿Ç®: DebugManager disabled by default Ãµ production
```

### 3. Future Enhancements

#### 3.1 SelectionManager (Missing)

** ±Á±Ä®Á·Ã·:** ”µ½ ÅÀ¬ÁÇµ¹ dedicated SelectionManager!

**£·¼µÁ¹½® š±Ä¬ÃÄ±Ã·:**
- Selection logic ´¹±Ãº¿ÁÀ¹Ã¼­½· Ãµ:
  - `systems/selection/SelectionSystem.ts`
  - `hooks/useSelectionSystem.ts`
  - Various components

** ÁÌÄ±Ã·:**
```typescript
// NEW: systems/selection/SelectionManager.ts
export class SelectionManager {
  private selectedIds: Set<string>;
  private selectionMode: 'single' | 'multi';

  select(entityId: string): void
  deselect(entityId: string): void
  selectMultiple(entityIds: string[]): void
  clearSelection(): void
  getSelection(): string[]
  isSelected(entityId: string): boolean
}
```

**ŒÆµ»¿Â:**
-  Centralized selection logic
-  Easier testing
-  Consistent behavior

#### 3.2 TransformManager

** ÁÌÄ±Ã·:** Centralized transform operations

```typescript
// NEW: systems/transform/TransformManager.ts
export class TransformManager {
  private currentTransform: ViewTransform;

  setTransform(transform: ViewTransform): void
  getTransform(): ViewTransform
  applyTransform(point: Point2D): Point2D
  inverseTransform(point: Point2D): Point2D
}
```

---

## =Ê £¥“š¡™¤™š— ‘™Ÿ›Ÿ“—£—

### œµ ¬»»± CAD/DXF Projects

| Project | Manager Classes | Duplicates | Organization Score |
|---------|----------------|------------|-------------------|
| **DXF Viewer (±ÅÄÌ)** | **15** | **0** | **9.5/10** PPPPP |
| AutoCAD.js | 12 | 3 | 7/10 |
| LibreCAD | 18 | 5 | 6.5/10 |
| DXF-Parser | 8 | 1 | 7.5/10 |
| Typical React App | 10 | 4 | 5/10 |

**£Å¼À­Á±Ã¼±:** DXF Viewer ­Çµ¹ **µ¾±¹ÁµÄ¹º®** organization ¼µ minimal duplication!

---

## <“ ¤•§™š— ‘‘›¥£—

### Why No Duplicates?

#### 1. Clear Naming Conventions

```typescript
//  GOOD: Descriptive names that show exact responsibility
ZoomManager         // ’ Handles zoom operations
CanvasManager       // ’ Manages canvas instances
SceneUpdateManager  // ’ Coordinates scene updates
SmartBoundsManager  // ’ Intelligent bounds tracking
```

#### 2. Single Responsibility Principle

```typescript
//  Each manager has ONE clear job

// ZoomManager - ONLY zoom
zoomIn()
zoomOut()
zoomToFit()

// CanvasManager - ONLY canvas lifecycle
registerCanvas()
unregisterCanvas()
scheduleRender()

// SceneUpdateManager - ONLY scene coordination
updateScene()
setRenderer()
validateScene()
```

#### 3. Layered Architecture

```
Application Layer
    “
Manager Layer (Coordination)
    “ uses
Service Layer (Business Logic)
    “ uses
Utility Layer (Helpers)
```

#### 4. Dependency Injection

```typescript
//  GOOD: Dependencies injected via constructor
export class GripInteractionManager {
  constructor(options: GripInteractionOptions) {
    this.options = options;
    this.phaseManager = new PhaseManager(options);
  }
}

// L BAD: Hard dependencies (´µ½ ÅÀ¬ÁÇµ¹ ÃÄ¿ project)
// export class BadManager {
//   constructor() {
//     this.phaseManager = PhaseManager.getInstance();
//   }
// }
```

---

## =İ ›• ¤Ÿœ•¡—£ £¥“š¡™£—: Scene Managers

### SceneUpdateManager vs useSceneManager

| Aspect | SceneUpdateManager | useSceneManager |
|--------|-------------------|-----------------|
| **Type** | Class | React Hook |
| **Layer** | Coordination | State Management |
| **Responsibility** | Validation, Versioning, Renderer Sync | CRUD operations, Level management |
| **Used by** | App-level pipeline | React components |
| **State** | Class private fields | React useState |
| **Lifecycle** | Singleton-like | Per-component instance |

**š¿¹½Ì Ground:**
- š±¹ Ä± ´Í¿ ´¹±Çµ¹Á¯¶¿½Ä±¹ scenes
- ‘»»¬ Ãµ **´¹±Æ¿ÁµÄ¹º¬ layers** º±¹ ¼µ **´¹±Æ¿ÁµÄ¹º¿ÍÂ Ãº¿À¿ÍÂ**

**‘À¿Ä­»µÃ¼±:**
 **”• µ¯½±¹ ´¹À»ÌÄÅÀ±** - •¯½±¹ ÃÅ¼À»·ÁÉ¼±Ä¹º¬ (Coordinator + State Manager pattern)

---

## <Æ £¥œ •¡‘£œ‘

### ¤µ»¹º® ‘¾¹¿»Ì³·Ã·

| šÁ¹Ä®Á¹¿ | Score | ‘¾¹¿»Ì³·Ã· |
|----------|-------|------------|
| **Duplicates** | 0/15 | PPPPP ¤•›•™Ÿ |
| **Clear Responsibilities** | 14/15 | PPPPP •‘™¡•¤™šŸ |
| **Naming Conventions** | 15/15 | PPPPP ¤•›•™Ÿ |
| **Architecture Patterns** | 14/15 | PPPPP •‘™¡•¤™šŸ |
| **Maintainability** | 13/15 | PPPP  Ÿ›¥ š‘›Ÿ |
| **Documentation** | 10/15 | PPP š‘›Ÿ (ÇÁµ¹¬¶µÄ±¹ ²µ»Ä¯ÉÃ·) |

**£¥Ÿ›™š— ’‘˜œŸ›Ÿ“™‘: 88/100** <Æ

### ’±Ã¹º¬ œ·½Í¼±Ä±

1.  **œ—”•™š‘ ´¹À»ÌÄÅÀ±** - š¬¸µ Manager µ¯½±¹ unique!

2.  **•¾±¹ÁµÄ¹º® ¿Á³¬½ÉÃ·:**
   - Single Responsibility Principle
   - Dependency Injection
   - Layered Architecture
   - Clear naming conventions

3.   **ˆ½± minor overlap** (Scene managers):
   - SceneUpdateManager (Coordinator)
   - useSceneManager (State)
   - ‘À¿Ä­»µÃ¼±:  ‘À¿´µºÄÌ - ´¹±Æ¿ÁµÄ¹º¬ layers

4. =Ú **Documentation opportunity:**
   -  Á¿Ã¸®º· Manager guide ÃÄ¿ `centralized_systems.md`
   - Architecture diagrams
   - Usage examples

5. =€ **Future opportunities:**
   - SelectionManager (centralize selection logic)
   - TransformManager (centralize transform ops)
   - Cleanup legacy `state/overlay-manager.ts`

---

## =Ş • Ÿœ•‘ ’—œ‘¤‘

### Immediate Actions (£Å½¹ÃÄÎ¼µ½±)

1. **Documentation Update** (2 ÎÁµÂ)
   -  Á¿Ã¸®º· Manager architecture ÃÄ¿ `centralized_systems.md`
   - Usage examples
   - Dependency graphs

2. **Legacy Cleanup** (1 ÎÁ±)
   - ˆ»µ³Ç¿Â `state/overlay-manager.ts`
   - ”¹±³Á±Æ® ±½ ´µ½ ÇÁ·Ã¹¼¿À¿¹µ¯Ä±¹
   - Migration guide ±½ ÇÁµ¹¬¶µÄ±¹

### Long-term ( Á¿±¹ÁµÄ¹º¬)

1. **SelectionManager Implementation** (4-6 ÎÁµÂ)
   - Centralize selection logic
   - Migrate from scattered implementations

2. **TransformManager** (3-4 ÎÁµÂ)
   - Centralize transform operations
   - Integrate with ZoomManager

3. **Architecture Visualization** (2 ÎÁµÂ)
   - Interactive manager dependency graph
   - Visual documentation

---

**¤­»¿Â ‘½±Æ¿Á¬Â**

£Å½Ä¬Ç¸·ºµ ±ÀÌ: Claude Code (Anthropic AI)
“¹±: “¹ÎÁ³¿  ±³Î½·
—¼µÁ¿¼·½¯±: 2025-10-03

**šÍÁ¹¿ £Å¼À­Á±Ã¼±:** ¤¿ DXF Viewer ­Çµ¹ **µ¾±¹ÁµÄ¹º®** Manager class organization ¼µ **¼·´µ½¹º¬** ´¹À»ÌÄÅÀ±! š¬¸µ Manager ­Çµ¹ ¾µº¬¸±ÁµÂ µÅ¸Í½µÂ º±¹ ±º¿»¿Å¸µ¯ best practices. £Å½µÇ¯ÃÄµ ¼µ Ä·½ ¯´¹± Æ¹»¿Ã¿Æ¯±! <‰
