# 🗺️ MASTER CONSOLIDATION ROADMAP - DXF VIEWER

**Ημερομηνία Δημιουργίας**: 2025-10-04
**Στόχος**: Συστηματική εξάλειψη διπλότυπων με ελάχιστες παρενέργειες
**Scope**: `src/subapps/dxf-viewer`

---

## 📊 EXECUTIVE OVERVIEW

### Γιατί χρειαζόμαστε αυτό το Roadmap;

**Πρόβλημα**: Οι 38 αναφορές διπλότυπων είναι **αλληλοεξαρτώμενες**. Αν διορθώσουμε μία κατηγορία, επηρεάζονται πολλές άλλες.

**Λύση**: Στρατηγική σειρά consolidation με:
1. ✅ **Dependency mapping** - Ποιος εξαρτάται από ποιον
2. ✅ **Phase-based approach** - Από τη βάση προς τα πάνω
3. ✅ **Cross-reference tracking** - Ποιες αναφορές χρειάζονται update

---

## 🎯 CONSOLIDATION STRATEGY

### Bottom-Up Approach (Recommended)

```
FOUNDATION (Types & Data)
    ↓
CORE LOGIC (Algorithms & Utils)
    ↓
BUSINESS LAYER (Services & Managers)
    ↓
PRESENTATION (Hooks & Components)
```

**Γιατί Bottom-Up;**
- ✅ Αλλάζουμε πρώτα τη **βάση** (types, constants)
- ✅ Μετά τα **building blocks** (utils, algorithms)
- ✅ Τελευταία τα **high-level systems** (services, hooks)
- ✅ Λιγότερα breaking changes

---

## 📋 4-PHASE ROADMAP

### **PHASE 1: FOUNDATION LAYER** 🏗️ (εβδομάδα 1-2)

**Στόχος**: Κεντρικοποίηση types, interfaces, constants που χρησιμοποιούν ΟΛΟΙ

#### 1.1 Types & Interfaces (Κρισιμότητα: 🔴 CRITICAL)

**Αρχεία προς Consolidation**:
- ✅ `Interfaces.md` (ΗΔΗ ΕΓΡΑΨΑΜΕ ΑΝΑΦΟΡΑ - 30+ duplicates)
- ✅ `Enums.md` (28 duplicates)
- 🔄 `Type_definitions.md`

**Σειρά Εργασίας**:
```
1. BoundingBox (6 duplicates → 1 unified)
   └─ Impact: 35+ files
   └─ Affects: Algorithms.md, Rendering.md, Services.md

2. Viewport (5 duplicates → 1 unified)
   └─ Impact: 20+ files
   └─ Affects: Coordinate systems.md, Transform_operations.md

3. SnapResult (5 duplicates → 1 unified)
   └─ Impact: 15+ files
   └─ Affects: Algorithms.md, Draw_methods.md

4. EntityModel (2 duplicates → 1 unified)
   └─ Impact: 40+ files
   └─ Affects: ALL entity-related modules

5. Entity Variants (10+ duplicates → unified system)
   └─ Impact: 50+ files
   └─ Affects: Enums.md, Algorithms.md, Rendering.md
```

**Cross-References να Ενημερωθούν**:
- 📝 `Algorithms.md` - όλα τα hit testing algorithms
- 📝 `Calculation_methods.md` - distance/intersection calculations
- 📝 `Render_contexts.md` - rendering με νέα interfaces
- 📝 `Services.md` - HitTestingService, FitToViewService

**Εκτιμώμενος Χρόνος**: 3-4 μέρες

---

#### 1.2 Enums & Type Unions (Κρισιμότητα: 🔴 HIGH)

**Αρχεία προς Consolidation**:
- ✅ `Enums.md` (28 enum duplicates)

**Σειρά Εργασίας**:
```
1. EntityType (5 duplicates → 1 enum)
   └─ Files: types/entities.ts, types/index.ts, scene.ts
   └─ Impact: Όλα τα entity-related files

2. SnapType (4 duplicates → 1 unified)
   └─ Files: snapping/*, rendering/ui/snap/*
   └─ Impact: Snapping system

3. ToolType (4 duplicates → 1 enum)
   └─ Files: ui/toolbar/*, types/index.ts
   └─ Impact: Toolbar & tool selection

4. Status Types (6 duplicates → 1 unified)
   └─ Files: overlays/types.ts, constants/statuses.ts
   └─ Impact: Overlay & status management
```

**Cross-References να Ενημερωθούν**:
- 📝 `Validation_logic.md` - entity type validation
- 📝 `Event_handlers.md` - tool type handlers
- 📝 `State_management_logic.md` - status state

**Εκτιμώμενος Χρόνος**: 2-3 μέρες

---

#### 1.3 Constants & Defaults (Κρισιμότητα: 🔴 CRITICAL)

**STATUS**: ✅ **TRANSFORM CONSTANTS COMPLETED (2025-10-04)**

**Αρχεία προς Consolidation**:
- ✅ `Constants.md` (Transform section ✅ DONE)
- ⏳ `Default_values.md` (Pending)
- ⏳ `Configuration_objects.md` (Pending)

**✅ COMPLETED: Transform Constants**:
```typescript
// ✅ RESOLVED: Transform Limits
config/transform-config.ts:
  TRANSFORM_SCALE_LIMITS: { MIN: 0.01, MAX: 1000 }
  UI_ZOOM_LIMITS: { MIN: 0.1, MAX: 50 }
// → Single source of truth! Zero conflicts!

// Migration completed:
✅ hooks/state/useCanvasTransformState.ts
✅ systems/zoom/zoom-constants.ts (re-exports)
✅ systems/zoom/ZoomManager.ts (auto-updated)
✅ ui/toolbar/ZoomControls.tsx (20% industry-standard)
```

**⏳ REMAINING ISSUES**:
```
❌ INCONSISTENCY #2: Line Width
Default: 0.25mm (ISO 128)
Found: 0.5, 1, 1.5, 2, 3 (scattered)

❌ INCONSISTENCY #3: Text Size
Default: 12px
Found: 10, 12, 14, 16 (scattered)
```

**Σειρά Εργασίας**:
```
1. Transform Constants (URGENT!) ✅ DONE (2025-10-04)
   ✅ Created: config/transform-config.ts
   ✅ Consolidated: MIN/MAX_SCALE, ZOOM_FACTORS, PAN_SPEEDS
   ✅ Impact: All zoom/pan systems unified

2. UI Constants (NEXT)
   └─ Consolidate: Colors (40+ inline), Sizes, Spacing
   └─ File: config/ui-constants.ts
   └─ Impact: All rendering & UI

3. Tolerance Constants
   └─ Already good: tolerance-config.ts ✅
   └─ But: 19+ inline tolerances to migrate

4. Default Values
   └─ DEFAULT_RENDER_OPTIONS
   └─ DEFAULT_GRID_SETTINGS
   └─ DEFAULT_RULER_SETTINGS
```

**Cross-References Ενημερωμένα** ✅:
- ✅ `Transform_operations.md` - Updated με νέα constants
- ✅ `centralized_systems.md` - Rule #9 added (Transform Constants)
- ✅ `Constants.md` - Section 1 updated (Transform complete)
- ⏳ `Validation_logic.md` - Pending (validation limits)
- ⏳ `Draw_methods.md` - Pending (rendering constants)
- ⏳ `Color&Style_definitions.md` - Pending (UI colors)

**Χρόνος Ολοκλήρωσης**: ✅ 1 μέρα (Transform Constants) | ⏳ 2 μέρες (Remaining)

---

### **PHASE 2: CORE LOGIC LAYER** ⚙️ (εβδομάδα 3-4)

**Στόχος**: Κεντρικοποίηση algorithms, calculations, utilities

#### 2.1 Algorithms (Κρισιμότητα: 🔴 HIGH)

**Αρχεία προς Consolidation**:
- ✅ `Algorithms.md` (hit testing, bounds calculation)
- ✅ `Calculation_methods.md` (distance, angle, intersection)

**Dependencies από Phase 1**:
- ✅ BoundingBox (από Interfaces)
- ✅ Point2D (από Interfaces)
- ✅ TOLERANCE constants (από Constants)

**Σειρά Εργασίας**:
```
1. Hit Testing Algorithms
   └─ Files: rendering/hitTesting/*, services/HitTestingService.ts
   └─ Duplicates: 3 different implementations
   └─ Target: 1 unified HitTester class

2. Bounds Calculations
   └─ Files: rendering/hitTesting/Bounds.ts, utils/bounds-utils.ts
   └─ Duplicates: BoundsCalculator scattered
   └─ Target: Unified in rendering/hitTesting/Bounds.ts

3. Distance/Intersection Calculations
   └─ Files: utils/geometry/*, snapping/shared/GeometricCalculations.ts
   └─ Duplicates: pointToLineDistance (4x), lineIntersection (3x)
   └─ Target: utils/geometry/GeometryUtils.ts
```

**Cross-References να Ενημερωθούν**:
- 📝 `Services.md` - HitTestingService uses algorithms
- 📝 `Custom_hooks.md` - useHitTest hook
- 📝 `Validation_logic.md` - geometric validation

**Εκτιμώμενος Χρόνος**: 3-4 μέρες

---

#### 2.2 Utility Functions (Κρισιμότητα: 🟡 MEDIUM)

**Αρχεία προς Consolidation**:
- ✅ `Utility_functions.md`
- ✅ `Transformation_logic.md` (rotate, scale, translate)

**Dependencies από Phase 1**:
- ✅ Point2D, Viewport (από Interfaces)
- ✅ Transform constants (από Constants)

**Σειρά Εργασίας**:
```
1. Coordinate Transforms
   └─ File: rendering/core/CoordinateTransforms.ts (ALREADY CENTRALIZED ✅)
   └─ Action: Remove duplicates που δεν το χρησιμοποιούν

2. Array/Object Utilities
   └─ Scattered: deepClone (3x), arrayEquals (2x), isEmpty (4x)
   └─ Target: utils/common.ts

3. String Utilities
   └─ Scattered: formatNumber (3x), parseUnit (2x)
   └─ Target: utils/formatters.ts
```

**Cross-References να Ενημερωθούν**:
- 📝 `Transform_operations.md` - canvas transforms
- 📝 `Draw_methods.md` - rendering utilities

**Εκτιμώμενος Χρόνος**: 2 μέρες

---

#### 2.3 Validation Logic (Κρισιμότητα: 🟡 MEDIUM)

**Αρχεία προς Consolidation**:
- ✅ `Validation_logic.md` (entity validation, input validation)

**Dependencies από Phase 1 & 2.1**:
- ✅ EntityModel, BoundingBox (από Interfaces)
- ✅ Validation constants (από Constants)

**Σειρά Εργασίας**:
```
1. Entity Validation
   └─ Files: utils/entity-validation-utils.ts, managers/SceneValidator.ts
   └─ Duplicates: validateEntity (scattered)
   └─ Target: utils/entity-validation-utils.ts

2. Input Validation
   └─ Scattered: isValidNumber, isValidPoint, isValidBounds
   └─ Target: utils/validation.ts

3. Guard Functions
   └─ if (!x) return patterns (50+ occurrences)
   └─ Target: Create utils/guards.ts
```

**Cross-References να Ενημερωθούν**:
- 📝 `Event_handlers.md` - input validation
- 📝 `State_management_logic.md` - state validation

**Εκτιμώμενος Χρόνος**: 2 μέρες

---

### **PHASE 3: BUSINESS LAYER** 🏢 (εβδομάδα 5-6)

**Στόχος**: Κεντρικοποίηση services, managers, rendering systems

#### 3.1 Services & Managers (Κρισιμότητα: 🔴 HIGH)

**Αρχεία προς Consolidation**:
- ✅ `Serviceimplementations.md` (HitTestingService, FitToViewService)
- ✅ `Manager_classes.md` (ZoomManager, SelectionManager)
- ✅ `Singleton_patterns.md` (ServiceRegistry patterns)

**Dependencies από Phase 1 & 2**:
- ✅ Interfaces (BoundingBox, Viewport, EntityModel)
- ✅ Algorithms (HitTester, BoundsCalculator)
- ✅ Constants (Transform limits, Tolerances)

**Σειρά Εργασίας**:
```
1. Service Consolidation
   └─ Review: Όλα τα services/
   └─ Check: Duplicate service implementations
   └─ Action: Μετακίνηση στο ServiceRegistry V2

2. Manager Deduplication
   └─ Files: systems/zoom/ZoomManager.ts, systems/selection/*
   └─ Check: Overlapping responsibilities
   └─ Action: Clear separation of concerns

3. Singleton Pattern Cleanup
   └─ Multiple getInstance() patterns
   └─ Target: Use ServiceRegistry.v2.ts exclusively
```

**Cross-References να Ενημερωθούν**:
- 📝 `Factory_patterns.md` - service factories
- 📝 `Custom_hooks.md` - hooks που χρησιμοποιούν services
- 📝 `Context_providers.md` - provider integration

**Εκτιμώμενος Χρόνος**: 3-4 μέρες

---

#### 3.2 Rendering Systems (Κρισιμότητα: 🔴 HIGH)

**Αρχεία προς Consolidation**:
- ✅ `Renderers.md` (duplicate renderer implementations)
- ✅ `Render_contexts.md` (IRenderContext, UIRenderContext)
- ✅ `Draw_methods.md` (drawLine, drawCircle, etc.)
- ✅ `Canvas_operations.md` (clearRect, save/restore)
- ✅ `Coordinate systems.md` (transform systems)

**Dependencies από Phase 1 & 2**:
- ✅ Interfaces (EntityModel, RenderOptions, Viewport)
- ✅ Constants (UI colors, line widths)
- ✅ Transform utilities (CoordinateTransforms)

**Σειρά Εργασίας**:
```
1. RenderContext Consolidation
   └─ Files: rendering/core/IRenderContext.ts (main)
   └─ Check: Duplicate context implementations
   └─ Keep: IRenderContext, UIRenderContext (different purposes ✅)

2. Renderer Deduplication
   └─ Files: rendering/entities/*, canvas-v2/layer-canvas/*
   └─ Duplicates: Entity rendering logic
   └─ Target: Unified entity renderers

3. Draw Methods
   └─ Scattered: Custom draw methods vs. RenderContext
   └─ Action: Use IRenderContext exclusively

4. Coordinate Systems
   └─ File: rendering/core/CoordinateTransforms.ts (CENTRALIZED ✅)
   └─ Action: Remove custom worldToScreen implementations
```

**Cross-References να Ενημερωθούν**:
- 📝 `Transform_operations.md` - canvas transforms
- 📝 `Color&Style_definitions.md` - rendering styles
- 📝 `Event_handlers.md` - mouse coord transforms

**Εκτιμώμενος Χρόνος**: 4-5 μέρες

---

### **PHASE 4: PRESENTATION LAYER** 🎨 (εβδομάδα 7-8)

**Στόχος**: Κεντρικοποίηση hooks, providers, React patterns

#### 4.1 Hooks & React Patterns (Κρισιμότητα: 🟡 MEDIUM)

**Αρχεία προς Consolidation**:
- ✅ `Custom_hooks.md` (useMouse, useViewport, useTransform)
- ✅ `useEffect_logic.md` (initialization, cleanup)
- ✅ `useCallback&useMemo.md` (memoization patterns)
- ✅ `Refs_management.md` (useRef patterns)

**Dependencies από Phase 1-3**:
- ✅ Interfaces (όλα τα types)
- ✅ Services (ServiceRegistry, Managers)
- ✅ Constants (όλα τα defaults)

**Σειρά Εργασίας**:
```
1. Custom Hooks Deduplication
   └─ Duplicates: useMouse (2x), useViewport (3x)
   └─ Target: Unified hooks/common/

2. useEffect Patterns
   └─ Common patterns: initialization, cleanup, listeners
   └─ Target: Reusable effect hooks

3. Memoization Cleanup
   └─ Review: Unnecessary useMemo/useCallback
   └─ Action: Remove over-optimization
```

**Cross-References να Ενημερωθούν**:
- 📝 `Context_providers.md` - provider hooks
- 📝 `State_management_logic.md` - state hooks
- 📝 `Event_handlers.md` - event hooks

**Εκτιμώμενος Χρόνος**: 2-3 μέρες

---

#### 4.2 Context Providers (Κρισιμότητα: 🟡 MEDIUM)

**Αρχεία προς Consolidation**:
- ✅ `Context_providers.md` (CanvasContext, CursorContext)
- ✅ `State_management_logic.md` (setState patterns, reducers)

**Dependencies από Phase 1-3**:
- ✅ Interfaces, Services, Hooks

**Σειρά Εργασίας**:
```
1. Context Consolidation
   └─ Files: contexts/*
   └─ Check: Overlapping contexts
   └─ Action: Merge similar contexts

2. State Management
   └─ Review: useState vs. useReducer patterns
   └─ Action: Standardize complex state
```

**Εκτιμώμενος Χρόνος**: 2 μέρες

---

#### 4.3 Event Handlers (Κρισιμότητα: 🟢 LOW)

**Αρχεία προς Consolidation**:
- ✅ `Event_handlers.md` (onClick, onMouseMove, onWheel)

**Σημείωση**: Event handlers μπορεί να είναι intentionally separate per component.

**Σειρά Εργασίας**:
```
1. Review Only
   └─ Check: Truly duplicate vs. component-specific
   └─ Action: Extract only common patterns

2. Common Event Utilities
   └─ Target: utils/event-helpers.ts
   └─ Examples: preventDefault wrappers, debounce, throttle
```

**Εκτιμώμενος Χρόνος**: 1 μέρα

---

## 🔗 DEPENDENCY MAP

### Φάση 1 → Φάση 2 Dependencies

```
Interfaces (Phase 1.1)
  ├─→ Algorithms (Phase 2.1)      [uses BoundingBox, Point2D]
  ├─→ Calculations (Phase 2.1)    [uses Point2D, Viewport]
  ├─→ Utilities (Phase 2.2)       [uses EntityModel]
  └─→ Validation (Phase 2.3)      [uses EntityModel, BoundingBox]

Constants (Phase 1.3)
  ├─→ Algorithms (Phase 2.1)      [uses TOLERANCE]
  ├─→ Transformations (Phase 2.2) [uses MIN/MAX_SCALE]
  └─→ Validation (Phase 2.3)      [uses validation limits]

Enums (Phase 1.2)
  ├─→ Validation (Phase 2.3)      [uses EntityType]
  └─→ Event Handlers (Phase 4.3)  [uses ToolType]
```

### Φάση 2 → Φάση 3 Dependencies

```
Algorithms (Phase 2.1)
  ├─→ Services (Phase 3.1)        [HitTestingService uses HitTester]
  ├─→ Renderers (Phase 3.2)       [uses bounds calculation]
  └─→ Hooks (Phase 4.1)           [useHitTest hook]

Utilities (Phase 2.2)
  ├─→ Renderers (Phase 3.2)       [uses CoordinateTransforms]
  └─→ Hooks (Phase 4.1)           [uses common utils]

Validation (Phase 2.3)
  ├─→ Services (Phase 3.1)        [SceneValidator]
  └─→ Event Handlers (Phase 4.3)  [input validation]
```

### Φάση 3 → Φάση 4 Dependencies

```
Services (Phase 3.1)
  ├─→ Hooks (Phase 4.1)           [useService hooks]
  └─→ Providers (Phase 4.2)       [ServiceRegistry integration]

Renderers (Phase 3.2)
  ├─→ Hooks (Phase 4.1)           [useRenderer hooks]
  └─→ Event Handlers (Phase 4.3)  [rendering event handlers]
```

---

## 📊 CROSS-REFERENCE MATRIX

### Πότε να Ενημερώσεις άλλες Αναφορές:

| Αλλαγή σε | Επηρεάζει Αναφορές | Priority |
|-----------|-------------------|----------|
| **BoundingBox** | Algorithms.md, Rendering.md, Services.md, Calculations.md, Validation.md | 🔴 HIGH |
| **Viewport** | Coordinate_systems.md, Transform_operations.md, Hooks.md | 🔴 HIGH |
| **SnapResult** | Algorithms.md, Draw_methods.md, Rendering.md | 🔴 HIGH |
| **EntityModel** | ALL entity files, Enums.md, Validation.md, Rendering.md | 🔴 CRITICAL |
| **EntityType enum** | Validation.md, Event_handlers.md, State_management.md | 🔴 HIGH |
| **Transform Constants** | Transform_operations.md, Coordinate_systems.md, Validation.md | 🔴 CRITICAL |
| **HitTester** | Services.md, Hooks.md, Event_handlers.md | 🟡 MEDIUM |
| **CoordinateTransforms** | Renderers.md, Transform_operations.md, Draw_methods.md | 🟡 MEDIUM |
| **Validation utilities** | Event_handlers.md, State_management.md, Services.md | 🟡 MEDIUM |
| **Custom hooks** | Context_providers.md, State_management.md | 🟢 LOW |

---

## ⚠️ ΚΙΝΔΥΝΟΙ & ΠΡΟΦΥΛΑΞΕΙΣ

### Μεγάλοι Κίνδυνοι:

1. **Breaking Changes Cascade** 🚨
   - Αλλαγή σε foundation type → σπάει 100+ files
   - **Πρόληψη**: Incremental migration με backward compatibility

2. **Type Conflicts** ⚠️
   - Νέα interface incompatible με παλιά
   - **Πρόληψη**: Transition types, adapters

3. **Runtime Errors** 💥
   - Λάθος consolidation → app crashes
   - **Πρόληψη**: Test μετά από κάθε φάση

4. **Merge Conflicts** 🔀
   - Πολλά αρχεία αλλάζουν ταυτόχρονα
   - **Πρόληψη**: Ένα Phase τη φορά, ξεχωριστά branches

### Safeguards:

```
✅ **Pre-Consolidation Checklist**:
1. Read existing code thoroughly
2. Map all dependencies
3. Create backward-compatible transition types
4. Write migration guide

✅ **During Consolidation**:
1. One category at a time
2. Update cross-references immediately
3. Run TypeScript compiler after each change
4. Test critical paths

✅ **Post-Consolidation**:
1. Update all related documentation
2. Run full test suite
3. Check for runtime errors
4. Update this roadmap with findings
```

---

## 📈 PROGRESS TRACKING

### Phase 1: Foundation Layer
- [ ] 1.1 Types & Interfaces (0/5 completed)
  - [ ] BoundingBox consolidation
  - [ ] Viewport consolidation
  - [ ] SnapResult consolidation
  - [ ] EntityModel consolidation
  - [ ] Entity Variants consolidation
- [ ] 1.2 Enums & Type Unions (0/4 completed)
  - [ ] EntityType
  - [ ] SnapType
  - [ ] ToolType
  - [ ] Status Types
- [x] 1.3 Constants & Defaults (1/4 completed) ✅ **PROGRESS: 25%**
  - [x] Transform Constants (CRITICAL!) ✅ **DONE 2025-10-04**
  - [ ] UI Constants
  - [ ] Tolerance Constants
  - [ ] Default Values

### Phase 2: Core Logic Layer
- [ ] 2.1 Algorithms (0/3 completed)
  - [ ] Hit Testing
  - [ ] Bounds Calculations
  - [ ] Distance/Intersection
- [ ] 2.2 Utility Functions (0/3 completed)
  - [ ] Coordinate Transforms
  - [ ] Array/Object Utilities
  - [ ] String Utilities
- [ ] 2.3 Validation Logic (0/3 completed)
  - [ ] Entity Validation
  - [ ] Input Validation
  - [ ] Guard Functions

### Phase 3: Business Layer
- [ ] 3.1 Services & Managers (0/3 completed)
  - [ ] Service Consolidation
  - [ ] Manager Deduplication
  - [ ] Singleton Pattern Cleanup
- [ ] 3.2 Rendering Systems (0/4 completed)
  - [ ] RenderContext
  - [ ] Renderers
  - [ ] Draw Methods
  - [ ] Coordinate Systems

### Phase 4: Presentation Layer
- [ ] 4.1 Hooks & React Patterns (0/3 completed)
  - [ ] Custom Hooks
  - [ ] useEffect Patterns
  - [ ] Memoization Cleanup
- [ ] 4.2 Context Providers (0/2 completed)
  - [ ] Context Consolidation
  - [ ] State Management
- [ ] 4.3 Event Handlers (0/2 completed)
  - [ ] Review
  - [ ] Common Event Utilities

---

## 🎯 QUICK START GUIDE

### Πώς να χρησιμοποιήσεις αυτό το Roadmap:

1. **Διάλεξε Phase** (ξεκίνα από Phase 1.1)
2. **Διάβασε την αναφορά** (π.χ. `Interfaces.md`)
3. **Έλεγξε Dependencies** (τι χρειάζεται από άλλα Phases)
4. **Κάνε Consolidation** (ένα item τη φορά)
5. **Ενημέρωσε Cross-References** (δες τον πίνακα)
6. **Mark as Complete** (update Progress Tracking)
7. **Επόμενο Item**

### Παράδειγμα Workflow:

```bash
# Phase 1.1 - BoundingBox Consolidation
1. Read: Interfaces.md (BoundingBox section)
2. Check dependencies: Algorithms.md χρειάζεται BoundingBox
3. Create: rendering/types/Geometry.ts (unified BoundingBox)
4. Migrate: 35+ files να χρησιμοποιούν το νέο
5. Update cross-refs:
   - Algorithms.md → "Now uses unified BoundingBox from rendering/types/Geometry.ts"
   - Rendering.md → "Updated to use new BoundingBox interface"
   - Services.md → "HitTestingService uses new BoundingBox"
6. Test: npx tsc --noEmit
7. ✅ Mark complete
8. Next: Viewport consolidation
```

---

## 📞 ΕΠΙΚΟΙΝΩΝΙΑ & UPDATES

**Ερωτήσεις;** Ρώτα τον Claude!

**Βρήκες νέο duplicate;** Ενημέρωσε την αντίστοιχη αναφορά και αυτό το roadmap.

**Τελείωσες ένα Phase;** Update το Progress Tracking section.

**Χρειάζεσαι βοήθεια;** Ανατρέξε στις υπάρχουσες αναφορές για λεπτομέρειες.

---

**Τέλος Master Roadmap**

**Version**: 1.0
**Last Updated**: 2025-10-04
**Author**: Claude (Anthropic AI Developer)
**Maintainer**: Γιώργος Παγώνης
