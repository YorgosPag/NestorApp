# =Ê ‘‘¦Ÿ¡‘ ”™ ›Ÿ¤¥ © EVENT HANDLERS - DXF VIEWER

**—¼µÁ¿¼·½¯± ‘½¬»ÅÃ·Â:** 2025-10-03
**Scope:** `src/subapps/dxf-viewer`
**‘½±»ÅÄ®Â:** Claude Code (Anthropic AI)

---

## <¯ EXECUTIVE SUMMARY

### šµ½ÄÁ¹º¬ •ÅÁ®¼±Ä±

 **¥ ‘¡§•™ š•¤¡™šŸ Ÿ™—£—** - ¤¿ project ­Çµ¹ ®´· ºµ½ÄÁ¹ºÌ ÃÍÃÄ·¼± event handling
  **•¤Ÿ ™£˜—š‘ ”™ ›Ÿ¤¥ ‘** - ¥À¬ÁÇ¿Å½ ÀµÁ¹¿Á¹Ã¼­½± ´¹À»ÌÄÅÀ± event handlers Ãµ ÃÅ³ºµºÁ¹¼­½± components
<¯ ** ¡Ÿ¤‘£—** - œµÄ±ÄÁ¿À® ÄÉ½ UI draggable components ½± ÇÁ·Ã¹¼¿À¿¹¿Í½ Ä¿ ºµ½ÄÁ¹ºÌ ÃÍÃÄ·¼±

### £Ä±Ä¹ÃÄ¹º¬

| ¤ÍÀ¿Â Handler | £Í½¿»¿ ‘ÁÇµ¯É½ | šµ½ÄÁ¹º¿À¿¹·¼­½± | ”¹À»ÌÄÅÀ± |  ¿Ã¿ÃÄÌ šµ½ÄÁ¹º¿À¿¯·Ã·Â |
|--------------|----------------|------------------|-----------|------------------------|
| **onClick** | 70 | 68 | 2 | 97.1% |
| **onMouseMove** | 4 | 2 | 2 | 50% |
| **onWheel** | 3 | 3 | 0 | 100% |
| **onMouseDown** | 6 | 4 | 2 | 66.7% |
| **onMouseUp** | 2 | 2 | 0 | 100% |
| **addEventListener** | 37 | 35 | 2 | 94.6% |

---

## <× š•¤¡™šŸ £¥£¤—œ‘ EVENT HANDLING

### 1. useCentralizedMouseHandlers (P MASTER SYSTEM)

**¤¿À¿¸µÃ¯±:** `systems/cursor/useCentralizedMouseHandlers.ts`

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  handleMouseDown - Centralized mouse down with pan detection
-  handleMouseMove - High-performance mouse tracking ¼µ requestAnimationFrame
-  handleMouseUp - Release handler ¼µ marquee selection support
-  handleMouseLeave - Cursor deactivation ¼µ ruler area detection
-  handleWheel - Professional CAD-style zoom ¼µ modifier keys support

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
1. `canvas-v2/dxf-canvas/DxfCanvas.tsx:398-402`
2. `canvas-v2/layer-canvas/LayerCanvas.tsx:592,602,606,608`

**§±Á±ºÄ·Á¹ÃÄ¹º¬:**
- =€ High-performance panning ¼µ requestAnimationFrame
- <¯ Middle-button double-click detection ³¹± Fit to View
- >ò Snap detection integration
- =Ï Ruler area detection ³¹± cursor persistence
- <¨ Marquee selection ¼µ UniversalMarqueeSelector
- ¡ Cached canvas bounds ¼µ CanvasBoundsService

---

### 2. InteractionEngine (P ALTERNATIVE SYSTEM)

**¤¿À¿¸µÃ¯±:** `systems/interaction/InteractionEngine.ts`

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  handleMouseDown:118
-  handleMouseMove:147
-  handleMouseUp:179
-  handleWheel:226

**£·¼µ¯ÉÃ·:** ‘ÅÄÌ µ¯½±¹ ­½± **µ½±»»±ºÄ¹ºÌ** interaction system À¿Å ¼À¿Áµ¯ ½± ÇÁ·Ã¹¼¿À¿¹·¸µ¯ ³¹± À¹¿ complex interaction patterns. ”• µ¯½±¹ ´¹À»ÌÄÅÀ¿ - µ¯½±¹ ´¹±Æ¿ÁµÄ¹ºÌ µÀ¯Àµ´¿ abstraction.

---

### 3. useZoom Hook (ZOOM-SPECIFIC)

**¤¿À¿¸µÃ¯±:** `systems/zoom/hooks/useZoom.ts`

**›µ¹Ä¿ÅÁ³¯µÂ:**
-  handleWheelZoom:143 - Specialized zoom ¼µ constraints & modifiers

**§Á·Ã¹¼¿À¿¹µ¯Ä±¹ ±ÀÌ:**
- `components/dxf-layout/CanvasSection.tsx:703,769`

**§±Á±ºÄ·Á¹ÃÄ¹º¬:**
- Ctrl+Wheel = Faster zoom
- Shift+Wheel = Horizontal pan (AutoCAD standard)
- Zoom constraints (min/max scale)
- Professional easing & dampening

---

##   •¤Ÿ ™£˜•¤‘ ”™ ›Ÿ¤¥ ‘

### =4 š‘¤—“Ÿ¡™‘ 1: Draggable UI Components

¤± À±Á±º¬ÄÉ components ­Ç¿Å½ **¯´¹±** drag & drop implementation:

#### 1.1 DraggableOverlayProperties
**‘ÁÇµ¯¿:** `ui/components/DraggableOverlayProperties.tsx:35-75`

```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  setDragging(true);
  setOffset({ x: e.clientX - position.x, y: e.clientY - position.y });

  const handleMouseMove = (e: MouseEvent) => {
    setPosition({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

#### 1.2 DraggableOverlayToolbar
**‘ÁÇµ¯¿:** `ui/components/DraggableOverlayToolbar.tsx:52-93`

```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  setDragging(true);
  setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });

  const handleMouseMove = (e: MouseEvent) => {
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

#### 1.3 CursorSettingsPanel
**‘ÁÇµ¯¿:** `ui/CursorSettingsPanel.tsx:267-331`

```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  setDragging(true);
  setDragOffset({
    x: e.clientX - position.x,
    y: e.clientY - position.y
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};
```

**=Ê ‘½¬»ÅÃ·:**
- **‘Á¹¸¼ÌÂ ´¹À»¿ÄÍÀÉ½:** 3 components
- **“Á±¼¼­Â ºÎ´¹º± ±½¬ implementation:** ~40 lines
- **£Å½¿»¹º­Â ´¹À»ÌÄÅÀµÂ ³Á±¼¼­Â:** ~120 lines
- **”¹±Æ¿Á­Â:** œÌ½¿ ¿½Ì¼±Ä± state variables (offset/dragOffset/position)

---

### =4 š‘¤—“Ÿ¡™‘ 2: Debug/Test Handlers

‘ÅÄ¬ ”• µ¯½±¹ ´¹À»ÌÄÅÀ± - µ¯½±¹ debug/test utilities À¿Å ÀÁ­Àµ¹ ½± À±Á±¼µ¯½¿Å½ ¾µÇÉÁ¹ÃÄ¬:

#### 2.1 CursorSnapAlignmentDebugOverlay
**‘ÁÇµ¯¿:** `debug/CursorSnapAlignmentDebugOverlay.ts:107,191`

**£º¿ÀÌÂ:** Enterprise-level testing/debugging ³¹± cursor-snap alignment

#### 2.2 CoordinateDebugOverlay
**‘ÁÇµ¯¿:** `debug/layout-debug/CoordinateDebugOverlay.tsx:189-244`

**£º¿ÀÌÂ:** Real-time coordinate system debugging

#### 2.3 enterprise-cursor-crosshair-test
**‘ÁÇµ¯¿:** `debug/enterprise-cursor-crosshair-test.ts:368-432`

**£º¿ÀÌÂ:** Automated testing ³¹± cursor-crosshair alignment

---

##  £©£¤‘ š•¤¡™šŸ Ÿ™—œ•‘ COMPONENTS

### Canvas Components (P BEST PRACTICE)

#### DxfCanvas
**‘ÁÇµ¯¿:** `canvas-v2/dxf-canvas/DxfCanvas.tsx:398-402`

```typescript
const mouseHandlers = useCentralizedMouseHandlers({
  scene, transform, viewport, activeTool,
  onTransformChange, onEntitySelect, onMouseMove, onWheelZoom,
  hitTestCallback
});

return (
  <canvas
    onMouseDown={(e) => mouseHandlers.handleMouseDown(e, canvasRef.current!)}
    onMouseMove={(e) => mouseHandlers.handleMouseMove(e, canvasRef.current!)}
    onMouseUp={mouseHandlers.handleMouseUp}
    onMouseLeave={(e) => mouseHandlers.handleMouseLeave(e, canvasRef.current!)}
    onWheel={(e) => mouseHandlers.handleWheel(e, canvasRef.current!)}
  />
);
```

** ‘ÅÄÌ µ¯½±¹ Ä¿ PERFECT PATTERN À¿Å ÀÁ­Àµ¹ ½± ±º¿»¿Å¸¿Í½ Ì»± Ä± components!**

#### LayerCanvas
**‘ÁÇµ¯¿:** `canvas-v2/layer-canvas/LayerCanvas.tsx:592,602,606,608`

```typescript
const mouseHandlers = useCentralizedMouseHandlers({
  scene: null, transform, viewport, activeTool,
  onTransformChange, onEntitySelect: handleLayerSelection,
  onMouseMove, onWheelZoom, hitTestCallback: layerHitTestCallback,
  colorLayers: layers, onLayerSelected: onLayerClick, canvasRef
});

return (
  <canvas
    onMouseMove={(e) => mouseHandlers.handleMouseMove(e, canvasRef.current!)}
    onMouseDown={(e) => mouseHandlers.handleMouseDown(e, canvasRef.current!)}
    onMouseUp={mouseHandlers.handleMouseUp}
    onWheel={(e) => mouseHandlers.handleWheel(e, canvasRef.current!)}
  />
);
```

---

## <¯  ¡Ÿ¤‘£•™£ š•¤¡™šŸ Ÿ™—£—£

###  ¡Ÿ¤•¡‘™Ÿ¤—¤‘ 1: ”·¼¹¿ÅÁ³¯± useDraggable Hook

**‘ÁÇµ¯¿:** `hooks/common/useDraggable.ts` (•Ÿ)

```typescript
/**
 * CENTRALIZED DRAGGABLE HOOK
 * šµ½ÄÁ¹º¿À¿¹·¼­½· drag & drop »¿³¹º® ³¹± UI components
 */
interface UseDraggableOptions {
  initialPosition?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  bounds?: 'viewport' | { top: number; right: number; bottom: number; left: number };
}

export function useDraggable(options: UseDraggableOptions = {}) {
  const [position, setPosition] = useState(
    options.initialPosition || { x: 100, y: 100 }
  );
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    setOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });

    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - offset.x;
      let newY = e.clientY - offset.y;

      // Apply bounds constraints
      if (options.bounds === 'viewport') {
        newX = Math.max(0, Math.min(window.innerWidth - 200, newX));
        newY = Math.max(0, Math.min(window.innerHeight - 100, newY));
      }

      const newPosition = { x: newX, y: newY };
      setPosition(newPosition);
      options.onPositionChange?.(newPosition);
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, offset, options]);

  return {
    position,
    setPosition,
    dragging,
    handleMouseDown,
    dragHandleProps: {
      onMouseDown: handleMouseDown,
      style: { cursor: dragging ? 'grabbing' : 'grab' }
    }
  };
}
```

###  ¡Ÿ¤•¡‘™Ÿ¤—¤‘ 2: •½·¼­ÁÉÃ· Draggable Components

#### 2.1 DraggableOverlayProperties (BEFORE ’ AFTER)

```typescript
// BEFORE: 40 lines of duplicate drag logic
const [dragging, setDragging] = useState(false);
const [position, setPosition] = useState({ x: 100, y: 100 });
const [offset, setOffset] = useState({ x: 0, y: 0 });
const handleMouseDown = (e: React.MouseEvent) => { /* ... */ };

// AFTER: 2 lines using centralized hook
import { useDraggable } from '../../hooks/common/useDraggable';

const { position, dragging, dragHandleProps } = useDraggable({
  initialPosition: { x: 100, y: 100 },
  bounds: 'viewport'
});
```

**‘À¿Ä­»µÃ¼±:**
-  ‘ÀÌ 40 lines ’ 2 lines ±½¬ component
-  £Å½¿»¹º® µ¾¿¹º¿½Ì¼·Ã·: ~114 lines
-  œ·´µ½¹º¬ bugs ±ÀÌ copy-paste errors
-  œ¯± À·³® ±»®¸µ¹±Â ³¹± drag behavior

---

## =È œ•¤¡™š•£ š•¤¡™šŸ Ÿ™—£—£

### ¤Á­Ç¿ÅÃ± š±Ä¬ÃÄ±Ã·

| œµÄÁ¹º® | ¤¹¼® | £ÄÌÇ¿Â | Gap |
|---------|------|--------|-----|
| **šµ½ÄÁ¹º¿À¿¹·¼­½± Canvas Events** | 100% | 100% |  0% |
| **šµ½ÄÁ¹º¿À¿¹·¼­½± Zoom Events** | 100% | 100% |  0% |
| **šµ½ÄÁ¹º¿À¿¹·¼­½± Drag Events** | 0% | 100% |   100% |
| **£Å½¿»¹ºÌÂ ’±¸¼ÌÂ šµ½ÄÁ¹º¿À¿¯·Ã·Â** | 66.7% | 100% |   33.3% |

### œµÄ¬ ±ÀÌ  Á¿Äµ¹½Ì¼µ½µÂ ‘»»±³­Â

| œµÄÁ¹º® | ¤¹¼® | Improvement |
|---------|------|-------------|
| **šµ½ÄÁ¹º¿À¿¹·¼­½± Canvas Events** | 100% | - |
| **šµ½ÄÁ¹º¿À¿¹·¼­½± Zoom Events** | 100% | - |
| **šµ½ÄÁ¹º¿À¿¹·¼­½± Drag Events** | 100% | +100% |
| **£Å½¿»¹ºÌÂ ’±¸¼ÌÂ šµ½ÄÁ¹º¿À¿¯·Ã·Â** | 100% | +33.3% |

---

## =€ ROADMAP š•¤¡™šŸ Ÿ™—£—£

### Phase 1: ”·¼¹¿ÅÁ³¯± useDraggable Hook (1-2 ÎÁµÂ)
- [ ] ”·¼¹¿ÅÁ³¯± `hooks/common/useDraggable.ts`
- [ ] Unit tests ³¹± drag behavior
- [ ] Documentation ¼µ usage examples

### Phase 2: Migration ÄÉ½ Draggable Components (2-3 ÎÁµÂ)
- [ ] Migrate `DraggableOverlayProperties.tsx`
- [ ] Migrate `DraggableOverlayToolbar.tsx`
- [ ] Migrate `CursorSettingsPanel.tsx`
- [ ] Visual regression tests

### Phase 3: Cleanup & Documentation (1 ÎÁ±)
- [ ] ”¹±³Á±Æ® À±»¹¿Í duplicate code
- [ ] •½·¼­ÁÉÃ· documentation
- [ ] Code review & validation

**£Å½¿»¹ºÌÂ •ºÄ¹¼Î¼µ½¿Â §ÁÌ½¿Â:** 4-6 ÎÁµÂ

---

## <“ £¥œ •¡‘£œ‘¤‘ & £¥£¤‘£•™£

###  ˜µÄ¹º¬

1. **•¾±¹ÁµÄ¹º® ºµ½ÄÁ¹º¿À¿¯·Ã· ³¹± Canvas events**
   - `useCentralizedMouseHandlers` µ¯½±¹ professional-grade
   - High-performance panning ¼µ requestAnimationFrame
   - CAD-standard zoom ¼µ modifier keys
   - Snap detection integration

2. **š±¸±ÁÌÂ ´¹±ÇÉÁ¹Ã¼ÌÂ µÅ¸Å½Î½**
   - Canvas interaction ’ useCentralizedMouseHandlers
   - Zoom operations ’ useZoom
   - Debug/Testing ’ Separate utilities

3. **£ÉÃÄ® ÇÁ®Ã· Ä¿Å ºµ½ÄÁ¹º¿Í ÃÅÃÄ®¼±Ä¿Â**
   - DxfCanvas & LayerCanvas ÇÁ·Ã¹¼¿À¿¹¿Í½ Ä¿ centralized system ÃÉÃÄ¬

###    µÁ¹¿Ç­Â ’µ»Ä¯ÉÃ·Â

1. **Draggable Components**
   - 3 components ¼µ identical drag logic
   - ~120 lines ´¹À»ÌÄÅÀ¿Å ºÎ´¹º±
   -  ¹¸±½ÌÄ·Ä± ³¹± bugs ±ÀÌ copy-paste

### <¯  Á¿Äµ¹½Ì¼µ½µÂ •½­Á³µ¹µÂ

#### ¥È·»®  Á¿ÄµÁ±¹ÌÄ·Ä±
1.  **”·¼¹¿ÅÁ³¯± useDraggable hook** (1-2 ÎÁµÂ)
2.  **Migration ÄÉ½ 3 draggable components** (2-3 ÎÁµÂ)

#### œµÃ±¯±  Á¿ÄµÁ±¹ÌÄ·Ä±
3. =Ú **Documentation enhancement**
4. >ê **Testing** - Unit tests & visual regression

---

## =Ú  ‘¡‘¡¤—œ‘:  ›—¡—£ ›™£¤‘ EVENT HANDLERS

### onClick Handlers (70 ±ÁÇµ¯±)
- **97.1% ºµ½ÄÁ¹º¿À¿¹·¼­½±** - UI button handlers (µ¾±¹Á¿Í½Ä±¹)

### onMouseMove Handlers
#### šµ½ÄÁ¹º¿À¿¹·¼­½±
1. `systems/cursor/useCentralizedMouseHandlers.ts:187`  MASTER
2. `canvas-v2/dxf-canvas/DxfCanvas.tsx:399` 
3. `canvas-v2/layer-canvas/LayerCanvas.tsx:592` 

#### ”¹À»ÌÄÅÀ±
4. `ui/CursorSettingsPanel.tsx:280`  
5. `ui/components/DraggableOverlayProperties.tsx:48`  
6. `ui/components/DraggableOverlayToolbar.tsx:66`  

### onMouseDown Handlers
#### šµ½ÄÁ¹º¿À¿¹·¼­½±
1. `systems/cursor/useCentralizedMouseHandlers.ts:118`  MASTER
2. `systems/interaction/InteractionEngine.ts:118`  ALTERNATIVE
3. `canvas-v2/dxf-canvas/DxfCanvas.tsx:398` 
4. `canvas-v2/layer-canvas/LayerCanvas.tsx:602` 

#### ”¹À»ÌÄÅÀ±
5. `ui/CursorSettingsPanel.tsx:267`  
6. `ui/components/DraggableOverlayProperties.tsx:35`  
7. `ui/components/DraggableOverlayToolbar.tsx:52`  

### onWheel Handlers (100% ºµ½ÄÁ¹º¿À¿¹·¼­½±) <‰
1. `systems/cursor/useCentralizedMouseHandlers.ts:411` 
2. `systems/zoom/hooks/useZoom.ts:143` 
3. `systems/interaction/InteractionEngine.ts:226` 

---

**¤­»¿Â ‘½±Æ¿Á¬Â**

£Å½Ä¬Ç¸·ºµ ±ÀÌ: Claude Code (Anthropic AI)
“¹±: “¹ÎÁ³¿  ±³Î½·
—¼µÁ¿¼·½¯±: 2025-10-03
