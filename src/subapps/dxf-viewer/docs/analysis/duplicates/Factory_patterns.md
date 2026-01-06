# 🏭 ΑΝΑΦΟΡΑ FACTORY PATTERNS - DXF VIEWER

**Ημερομηνία Ανάλυσης:** 2025-10-03 22:18:15
**Συνολικά Factory Patterns:** 92
**Συνολικές Εμφανίσεις:** 140
**Πιθανά Διπλότυπα:** 11

---

## 📊 EXECUTIVE SUMMARY

### 🎯 Κύρια Ευρήματα για Κεντρικοποίηση

**ΚΡΙΣΙΜΑ ΔΙΠΛΟΤΥΠΑ** που χρειάζονται άμεση προσοχή:

1. **`createDxfImportUtils`** - Διπλότυπο σε 2 αρχεία
   - `hooks\useDxfImport.ts:15`
   - `pipeline\useDxfPipeline.ts:17`
   - 💡 **Πρόταση**: Κεντρικοποίηση σε `utils/dxf-import-utils.ts`

2. **`createEntityFromTool`** - Διπλότυπο σε 2 αρχεία
   - `hooks\drawing\useEntityCreation.ts:29`
   - `hooks\drawing\useUnifiedDrawing.ts:125`
   - 💡 **Πρόταση**: Κεντρικοποίηση σε `systems/entity-creation/utils.ts` (ήδη υπάρχει!)

3. **`createContext`** - 20 διαφορετικά contexts
   - Διασπαρμένα σε `contexts/`, `providers/`, `systems/`, `snapping/`, `overlays/`
   - 💡 **Σημείωση**: Αυτό είναι φυσιολογικό για React - κάθε context ορίζεται στο δικό του αρχείο

4. **Render Passes** - 3 factory functions με παρόμοια δομή
   - `createBackgroundPass`, `createEntityPass`, `createOverlayPass`
   - 💡 **Σημείωση**: Ήδη κεντρικοποιημένα σε `rendering/passes/` - καλή δομή!

### 📝 Επιπλέον Παρατηρήσεις

- **79 μοναδικά `create*` functions** - Υπάρχει μεγάλη χρήση του Factory Pattern
- **20 React Contexts** - Φυσιολογικό για React architecture
- **Καλή δομή** στο `rendering/` subsystem - τα passes είναι κεντρικοποιημένα
- **Ευκαιρίες κεντρικοποίησης**: Κυρίως στα `hooks/` και `pipeline/` directories

### Κατανομή Factory Patterns

| Τύπος Pattern | Μοναδικά Factories | Συνολικές Εμφανίσεις |
|---------------|-------------------|---------------------|
| `createCache` | 2 | 4 |
| `createContext` | 2 | 21 |
| `createEngine` | 2 | 3 |
| `createPass` | 3 | 18 |
| `createRenderer` | 1 | 2 |
| `createStore` | 2 | 4 |
| `createUtils` | 1 | 7 |
| `create_functions` | 79 | 81 |

---

## 🚨 ΠΙΘΑΝΑ ΔΙΠΛΟΤΥΠΑ & ΔΙΑΣΠΑΡΤΟΣ ΚΩΔΙΚΑΣ

> **ΣΗΜΑΝΤΙΚΟ**: Αυτά τα patterns εμφανίζονται σε πολλαπλά αρχεία και μπορεί να χρειάζονται κεντρικοποίηση!

### 1. `const createDxfImportUtils` - Διασπαρμένο σε 2 αρχεία

**Τύπος:** `create_functions`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `hooks\useDxfImport.ts` | 15 | `const createDxfImportUtils = () => ({` |
| `pipeline\useDxfPipeline.ts` | 17 | `const createDxfImportUtils = () => ({` |

### 2. `const createEntityFromTool` - Διασπαρμένο σε 2 αρχεία

**Τύπος:** `create_functions`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `hooks\drawing\useEntityCreation.ts` | 29 | `const createEntityFromTool = useCallback((tool: DrawingTool, points: Point[], la...` |
| `hooks\drawing\useUnifiedDrawing.ts` | 125 | `const createEntityFromTool = useCallback((tool: DrawingTool, points: Point2D[]):...` |

### 3. `createContext<` - Διασπαρμένο σε 20 αρχεία

**Τύπος:** `createContext`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `contexts\LineSettingsContext.tsx` | 57 | `const LineSettingsContext = createContext<LineSettingsContextType | null>(null);` |
| `contexts\ProjectHierarchyContext.tsx` | 94 | `const ProjectHierarchyContext = createContext<ProjectHierarchyContextType | null...` |
| `contexts\TextSettingsContext.tsx` | 110 | `const TextSettingsContext = createContext<TextSettingsContextType | null>(null);` |
| `contexts\TransformContext.tsx` | 32 | `const TransformContext = createContext<TransformContextValue | undefined>(undefi...` |
| `contexts\CanvasContext.tsx` | 18 | `const CanvasContext = createContext<CanvasContextType | null>(null);` |
| `overlays\overlay-store.tsx` | 28 | `const OverlayStoreContext = createContext<(OverlayStoreState & OverlayStoreActio...` |
| `providers\ConfigurationProvider.tsx` | 35 | `const ConfigurationContext = createContext<ConfigurationContextType | null>(null...` |
| `providers\DxfSettingsProvider.tsx` | 594 | `const DxfSettingsContext = createContext<DxfSettingsContextType | null>(null);` |
| `providers\GripProvider.tsx` | 21 | `const GripContext = createContext<GripContextType | null>(null);` |
| `providers\StableFirestoreProvider.tsx` | 37 | `const FirestoreContext = createContext<FirestoreContextType | undefined>(undefin...` |
| `providers\StyleManagerProvider.tsx` | 19 | `const StyleManagerContext = createContext<StyleManagerContextType | null>(null);` |
| `snapping\context\SnapContext.tsx` | 37 | `const SnapContext = createContext<SnapContextType | undefined>(undefined);` |
| `systems\constraints\ConstraintsSystem.tsx` | 170 | `const ConstraintsContext = createContext<ConstraintsHookReturn | null>(null);` |
| `systems\cursor\CursorSystem.tsx` | 111 | `export const CursorContext = createContext<CursorContextType | null>(null);` |
| `systems\entity-creation\EntityCreationSystem.tsx` | 21 | `const EntityCreationContext = createContext<EntityCreationContextType | null>(nu...` |
| `systems\levels\useLevels.ts` | 74 | `export const LevelsContext = createContext<LevelsHookReturn | null>(null);` |
| `systems\rulers-grid\RulersGridSystem.tsx` | 505 | `const RulersGridContext = createContext<RulersGridHookReturn | null>(null);` |
| `systems\rulers-grid\useRulersGrid.ts` | 106 | `const contextToUse = _rulersGridContext || React.createContext<RulersGridContext...` |
| `systems\selection\SelectionSystem.tsx` | 7 | `export const SelectionContext = createContext<SelectionContextType | null>(null)...` |
| `systems\toolbars\ToolbarsSystem.tsx` | 23 | `export const ToolbarsContext = createContext<ToolbarsContextType | null>(null);` |

### 4. `createDxfImportUtils` - Διασπαρμένο σε 2 αρχεία

**Τύπος:** `createUtils`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `hooks\useDxfImport.ts` | 4 | `* Χρησιμοποιεί το υπάρχον dxfImportService και createDxfImportUtils` |
| `hooks\useDxfImport.ts` | 15 | `const createDxfImportUtils = () => ({` |
| `hooks\useDxfImport.ts` | 45 | `const dxfUtils = createDxfImportUtils();` |
| `hooks\useDxfImport.ts` | 53 | `const dxfUtils = createDxfImportUtils();` |
| `pipeline\useDxfPipeline.ts` | 17 | `const createDxfImportUtils = () => ({` |
| `pipeline\useDxfPipeline.ts` | 64 | `const dxfUtils = createDxfImportUtils();` |
| `pipeline\useDxfPipeline.ts` | 104 | `const dxfUtils = createDxfImportUtils();` |

### 5. `createPathCache` - Διασπαρμένο σε 2 αρχεία

**Τύπος:** `createCache`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\cache\index.ts` | 9 | `createPathCache,` |
| `rendering\cache\PathCache.ts` | 397 | `export function createPathCache(options: CacheOptions = {}): PathCache {` |

### 6. `createTextMetricsCache` - Διασπαρμένο σε 2 αρχεία

**Τύπος:** `createCache`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\cache\index.ts` | 17 | `createTextMetricsCache,` |
| `rendering\cache\TextMetricsCache.ts` | 227 | `export function createTextMetricsCache(options: TextCacheOptions = {}): TextMetr...` |

### 7. `createBackgroundPass` - Διασπαρμένο σε 3 αρχεία

**Τύπος:** `createPass`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\core\RenderPipeline.ts` | 201 | `const { createBackgroundPass } = require('../passes/BackgroundPass');` |
| `rendering\core\RenderPipeline.ts` | 205 | `const backgroundPass = createBackgroundPass();` |
| `rendering\core\RenderPipeline.ts` | 221 | `const { createBackgroundPass } = require('../passes/BackgroundPass');` |
| `rendering\core\RenderPipeline.ts` | 225 | `const backgroundPass = createBackgroundPass(config?.background);` |
| `rendering\passes\BackgroundPass.ts` | 273 | `export function createBackgroundPass(config?: Partial<BackgroundConfig>): Backgr...` |
| `rendering\passes\index.ts` | 11 | `export { BackgroundPass, createBackgroundPass } from './BackgroundPass';` |

### 8. `createEntityPass` - Διασπαρμένο σε 3 αρχεία

**Τύπος:** `createPass`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\core\RenderPipeline.ts` | 202 | `const { createEntityPass } = require('../passes/EntityPass');` |
| `rendering\core\RenderPipeline.ts` | 206 | `const entityPass = createEntityPass();` |
| `rendering\core\RenderPipeline.ts` | 222 | `const { createEntityPass } = require('../passes/EntityPass');` |
| `rendering\core\RenderPipeline.ts` | 226 | `const entityPass = createEntityPass(config?.entity);` |
| `rendering\passes\EntityPass.ts` | 428 | `export function createEntityPass(config?: Partial<EntityPassConfig>): EntityPass...` |
| `rendering\passes\index.ts` | 14 | `export { EntityPass, createEntityPass } from './EntityPass';` |

### 9. `createOverlayPass` - Διασπαρμένο σε 3 αρχεία

**Τύπος:** `createPass`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\core\RenderPipeline.ts` | 203 | `const { createOverlayPass } = require('../passes/OverlayPass');` |
| `rendering\core\RenderPipeline.ts` | 207 | `const overlayPass = createOverlayPass();` |
| `rendering\core\RenderPipeline.ts` | 223 | `const { createOverlayPass } = require('../passes/OverlayPass');` |
| `rendering\core\RenderPipeline.ts` | 227 | `const overlayPass = createOverlayPass(config?.overlay);` |
| `rendering\passes\index.ts` | 17 | `export { OverlayPass, createOverlayPass } from './OverlayPass';` |
| `rendering\passes\OverlayPass.ts` | 411 | `export function createOverlayPass(config?: Partial<OverlayPassConfig>): OverlayP...` |

### 10. `createEntityRenderer` - Διασπαρμένο σε 2 αρχεία

**Τύπος:** `createRenderer`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\index.ts` | 23 | `export function createEntityRenderer(ctx: CanvasRenderingContext2D) {` |
| `utils\entity-renderer.ts` | 126 | `export { createEntityRenderer } from '../rendering/entities';` |

### 11. `createEngine` - Διασπαρμένο σε 2 αρχεία

**Τύπος:** `createEngine`

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `snapping\orchestrator\SnapContextManager.ts` | 29 | `createEngineContext(` |
| `snapping\orchestrator\SnapOrchestrator.ts` | 90 | `const context = this.contextManager.createEngineContext(cursorPoint, this.entiti...` |

---

## 📁 ΑΝΑΛΥΤΙΚΗ ΑΝΑΦΟΡΑ ΑΝΑ ΤΥΠΟ PATTERN

### createCache

**Μοναδικά Factories:** 2

#### `createPathCache`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\cache\index.ts` | 9 | `createPathCache,` |
| `rendering\cache\PathCache.ts` | 397 | `export function createPathCache(options: CacheOptions = {}):...` |

#### `createTextMetricsCache`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\cache\index.ts` | 17 | `createTextMetricsCache,` |
| `rendering\cache\TextMetricsCache.ts` | 227 | `export function createTextMetricsCache(options: TextCacheOpt...` |


### createContext

**Μοναδικά Factories:** 2

#### `createContext<`

**Εμφανίσεις:** 20

| Αρχείο | Γραμμές |
|--------|---------|
| `contexts\CanvasContext.tsx` | 18 |
| `contexts\LineSettingsContext.tsx` | 57 |
| `contexts\ProjectHierarchyContext.tsx` | 94 |
| `contexts\TextSettingsContext.tsx` | 110 |
| `contexts\TransformContext.tsx` | 32 |
| `overlays\overlay-store.tsx` | 28 |
| `providers\ConfigurationProvider.tsx` | 35 |
| `providers\DxfSettingsProvider.tsx` | 594 |
| `providers\GripProvider.tsx` | 21 |
| `providers\StableFirestoreProvider.tsx` | 37 |
| `providers\StyleManagerProvider.tsx` | 19 |
| `snapping\context\SnapContext.tsx` | 37 |
| `systems\constraints\ConstraintsSystem.tsx` | 170 |
| `systems\cursor\CursorSystem.tsx` | 111 |
| `systems\entity-creation\EntityCreationSystem.tsx` | 21 |
| `systems\levels\useLevels.ts` | 74 |
| `systems\rulers-grid\RulersGridSystem.tsx` | 505 |
| `systems\rulers-grid\useRulersGrid.ts` | 106 |
| `systems\selection\SelectionSystem.tsx` | 7 |
| `systems\toolbars\ToolbarsSystem.tsx` | 23 |

#### `createContext(`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\core\IRenderContext.ts` | 122 | `createContext(canvas: HTMLCanvasElement, type: 'canvas2d' | ...` |


### createEngine

**Μοναδικά Factories:** 2

#### `createEngine`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `snapping\orchestrator\SnapContextManager.ts` | 29 | `createEngineContext(` |
| `snapping\orchestrator\SnapOrchestrator.ts` | 90 | `const context = this.contextManager.createEngineContext(curs...` |

#### `createSnapEngine`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `snapping\index.ts` | 32 | `export const createSnapEngine = (settings?: Partial<ProSnapS...` |


### createPass

**Μοναδικά Factories:** 3

#### `createBackgroundPass`

**Εμφανίσεις:** 6

| Αρχείο | Γραμμές |
|--------|---------|
| `rendering\core\RenderPipeline.ts` | 201, 205, 221, 225 |
| `rendering\passes\BackgroundPass.ts` | 273 |
| `rendering\passes\index.ts` | 11 |

#### `createEntityPass`

**Εμφανίσεις:** 6

| Αρχείο | Γραμμές |
|--------|---------|
| `rendering\core\RenderPipeline.ts` | 202, 206, 222, 226 |
| `rendering\passes\EntityPass.ts` | 428 |
| `rendering\passes\index.ts` | 14 |

#### `createOverlayPass`

**Εμφανίσεις:** 6

| Αρχείο | Γραμμές |
|--------|---------|
| `rendering\core\RenderPipeline.ts` | 203, 207, 223, 227 |
| `rendering\passes\OverlayPass.ts` | 411 |
| `rendering\passes\index.ts` | 17 |


### createRenderer

**Μοναδικά Factories:** 1

#### `createEntityRenderer`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\index.ts` | 23 | `export function createEntityRenderer(ctx: CanvasRenderingCon...` |
| `utils\entity-renderer.ts` | 126 | `export { createEntityRenderer } from '../rendering/entities'...` |


### createStore

**Μοναδικά Factories:** 2

#### `createGridStore`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `providers\DxfSettingsProvider.tsx` | 49 | `const createGridStore = (): GridSettingsStore => {` |
| `providers\DxfSettingsProvider.tsx` | 96 | `export const globalGridStore = createGridStore();` |

#### `createRulerStore`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `providers\DxfSettingsProvider.tsx` | 68 | `const createRulerStore = (): RulerSettingsStore => {` |
| `providers\DxfSettingsProvider.tsx` | 97 | `export const globalRulerStore = createRulerStore();` |


### createUtils

**Μοναδικά Factories:** 1

#### `createDxfImportUtils`

**Εμφανίσεις:** 7

| Αρχείο | Γραμμές |
|--------|---------|
| `hooks\useDxfImport.ts` | 4, 15, 45, 53 |
| `pipeline\useDxfPipeline.ts` | 17, 64, 104 |


### create_functions

**Μοναδικά Factories:** 79

#### `const createDxfImportUtils`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `hooks\useDxfImport.ts` | 15 | `const createDxfImportUtils = () => ({` |
| `pipeline\useDxfPipeline.ts` | 17 | `const createDxfImportUtils = () => ({` |

#### `const createEntityFromTool`

**Εμφανίσεις:** 2

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `hooks\drawing\useEntityCreation.ts` | 29 | `const createEntityFromTool = useCallback((tool: DrawingTool,...` |
| `hooks\drawing\useUnifiedDrawing.ts` | 125 | `const createEntityFromTool = useCallback((tool: DrawingTool,...` |

#### `const createMockCanvas`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `__tests__\cursor-crosshair-alignment.test.ts` | 11 | `const createMockCanvas = (): HTMLCanvasElement => {` |

#### `const createInitialWizardState`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `hooks\common\useImportWizard.ts` | 6 | `const createInitialWizardState = (): ImportWizardState => ({` |

#### `export const createOverlayHandlers`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `overlays\types.ts` | 141 | `export const createOverlayHandlers = (overlayStore: {` |

#### `const createDefaultConfiguration`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `providers\ConfigurationProvider.tsx` | 39 | `const createDefaultConfiguration = (): ViewerConfiguration =...` |

#### `const createGridStore`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `providers\DxfSettingsProvider.tsx` | 49 | `const createGridStore = (): GridSettingsStore => {` |

#### `const createRulerStore`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `providers\DxfSettingsProvider.tsx` | 68 | `const createRulerStore = (): RulerSettingsStore => {` |

#### `export function createCanvas2DContext`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\adapters\canvas2d\Canvas2DContext.ts` | 316 | `export function createCanvas2DContext(canvas: HTMLCanvasElem...` |

#### `export function createPathCache`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\cache\PathCache.ts` | 397 | `export function createPathCache(options: CacheOptions = {}):...` |

#### `export function createTextMetricsCache`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\cache\TextMetricsCache.ts` | 227 | `export function createTextMetricsCache(options: TextCacheOpt...` |

#### `export const createUnifiedCanvasSystem`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\canvas\index.ts` | 40 | `export const createUnifiedCanvasSystem = (options: {` |

#### `export function createRenderPipeline`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\core\RenderPipeline.ts` | 200 | `export function createRenderPipeline(): RenderPipeline {` |

#### `export function createCustomRenderPipeline`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\core\RenderPipeline.ts` | 216 | `export function createCustomRenderPipeline(config?: {` |

#### `export function createEntityRenderer`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\index.ts` | 23 | `export function createEntityRenderer(ctx: CanvasRenderingCon...` |

#### `export function createGripsFromPoints`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\shared\grip-utils.ts` | 15 | `export function createGripsFromPoints(` |

#### `export function createCenterGrip`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\shared\grip-utils.ts` | 38 | `export function createCenterGrip(entityId: string, center: P...` |

#### `export function createVertexGrip`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\shared\grip-utils.ts` | 51 | `export function createVertexGrip(entityId: string, position:...` |

#### `export function createEdgeGrip`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\shared\grip-utils.ts` | 64 | `export function createEdgeGrip(entityId: string, position: P...` |

#### `export function createArcGripPattern`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\shared\grip-utils.ts` | 78 | `export function createArcGripPattern(` |

#### `export function createEdgeGrips`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\entities\shared\line-utils.ts` | 15 | `export function createEdgeGrips(` |

#### `export function createHitTester`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\hitTesting\HitTester.ts` | 631 | `export function createHitTester(entities: EntityModel[] = []...` |

#### `export function createBackgroundPass`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\passes\BackgroundPass.ts` | 273 | `export function createBackgroundPass(config?: Partial<Backgr...` |

#### `export function createEntityPass`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\passes\EntityPass.ts` | 428 | `export function createEntityPass(config?: Partial<EntityPass...` |

#### `export function createOverlayPass`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\passes\OverlayPass.ts` | 411 | `export function createOverlayPass(config?: Partial<OverlayPa...` |

#### `export function createUIRenderContext`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `rendering\ui\core\UIRenderContext.ts` | 53 | `export function createUIRenderContext(` |

#### `function createMockCanvas`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `services\__benchmarks__\CanvasBoundsService.benchmark.ts` | 22 | `function createMockCanvas(): HTMLCanvasElement {` |

#### `export const createSnapEngine`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `snapping\index.ts` | 32 | `export const createSnapEngine = (settings?: Partial<ProSnapS...` |

#### `export function createSnapCandidate`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `snapping\engines\shared\snap-engine-utils.ts` | 29 | `export function createSnapCandidate(` |

#### `const createRegion`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `state\overlay-manager.ts` | 60 | `const createRegion = useCallback((vertices: Point2D[], statu...` |

#### `function createVisualConstraintFeedback`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\constraints\utils.ts` | 33 | `function createVisualConstraintFeedback(): ConstraintFeedbac...` |

#### `export function createCursorAnimationLoop`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\cursor\utils.ts` | 96 | `export function createCursorAnimationLoop(` |

#### `export function createDefaultCursorState`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\cursor\utils.ts` | 146 | `export function createDefaultCursorState(): CursorState {` |

#### `const createLine`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\entity-creation\EntityCreationSystem.tsx` | 28 | `const createLine = (start: Point2D, end: Point2D) => {` |

#### `const createRectangle`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\entity-creation\EntityCreationSystem.tsx` | 34 | `const createRectangle = (corner1: Point2D, corner2: Point2D)...` |

#### `const createCircle`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\entity-creation\EntityCreationSystem.tsx` | 40 | `const createCircle = (center: Point2D, radius: number) => {` |

#### `const createPolyline`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\entity-creation\EntityCreationSystem.tsx` | 47 | `const createPolyline = (points: Point2D[]) => {` |

#### `export function createEntityFromPoints`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\entity-creation\utils.ts` | 92 | `export function createEntityFromPoints(` |

#### `export function createPreviewEntity`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\entity-creation\utils.ts` | 253 | `export function createPreviewEntity(` |

#### `export function createGripIdentifier`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\grips\utils.ts` | 58 | `export function createGripIdentifier(` |

#### `const createEmptyScene`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\levels\LevelsSystem.tsx` | 33 | `const createEmptyScene = () => ({` |

#### `function createGridLine`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\rulers-grid\utils.ts` | 24 | `function createGridLine(` |

#### `function createMinorLines`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\rulers-grid\utils.ts` | 57 | `function createMinorLines(` |

#### `export function createSelectionResult`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\selection\utils.ts` | 248 | `export function createSelectionResult(` |

#### `export function createRectangleVertices`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\selection\shared\selection-duplicate-utils.ts` | 128 | `export function createRectangleVertices(corner1: Point2D, co...` |

#### `const createToolbar`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\toolbars\hooks\useToolbarManagement.ts` | 18 | `const createToolbar = useCallback(async (config: ToolbarConf...` |

#### `export function createBoundsFromPoints`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\zoom\utils\bounds.ts` | 15 | `export function createBoundsFromPoints(points: Point2D[]): {...` |

#### `export function createBoundsFromDxfScene`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\zoom\utils\bounds.ts` | 30 | `export function createBoundsFromDxfScene(scene: DxfScene | n...` |

#### `export function createBoundsFromLayers`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\zoom\utils\bounds.ts` | 83 | `export function createBoundsFromLayers(layers: ColorLayer[])...` |

#### `export function createCombinedBounds`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `systems\zoom\utils\bounds.ts` | 106 | `export function createCombinedBounds(` |

#### `export function createDeterministicCanvas`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\setupCanvas.ts` | 121 | `export function createDeterministicCanvas(` |

#### `export function createMockCanvas`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\setupTests.ts` | 92 | `export function createMockCanvas(options?: {` |

#### `export function createMockDOMRect`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\setupTests.ts` | 118 | `export function createMockDOMRect(options?: {` |

#### `export function createMockMouseEvent`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\setupTests.ts` | 139 | `export function createMockMouseEvent(options?: {` |

#### `export function createMockViewport`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\setupTests.ts` | 166 | `export function createMockViewport(options?: {` |

#### `export function createMockTransform`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\setupTests.ts` | 185 | `export function createMockTransform(options?: {` |

#### `export function createVisualTestCanvas`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\setupTests.ts` | 332 | `export function createVisualTestCanvas(options?: {` |

#### `export function createBaseline`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\visual\io.ts` | 126 | `export function createBaseline(` |

#### `export function createCIArtifactManifest`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `test\visual\io.ts` | 299 | `export function createCIArtifactManifest(): void {` |

#### `export function createColorGroupKey`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\components\layers\utils.ts` | 12 | `export function createColorGroupKey(colorName: string): stri...` |

#### `export const createLineConsolidatedSettings`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useConsolidatedSettings.ts` | 131 | `export const createLineConsolidatedSettings = (` |

#### `export const createTextConsolidatedSettings`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useConsolidatedSettings.ts` | 143 | `export const createTextConsolidatedSettings = (` |

#### `export const createGripConsolidatedSettings`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useConsolidatedSettings.ts` | 155 | `export const createGripConsolidatedSettings = (` |

#### `const createTextInputHandler`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useSettingsUpdater.ts` | 46 | `const createTextInputHandler = useCallback((key: keyof T) =>...` |

#### `const createNumberInputHandler`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useSettingsUpdater.ts` | 53 | `const createNumberInputHandler = useCallback((key: keyof T, ...` |

#### `const createCheckboxHandler`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useSettingsUpdater.ts` | 67 | `const createCheckboxHandler = useCallback((key: keyof T) => ...` |

#### `const createColorHandler`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useSettingsUpdater.ts` | 74 | `const createColorHandler = useCallback((key: keyof T) => {` |

#### `const createSelectHandler`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useSettingsUpdater.ts` | 81 | `const createSelectHandler = useCallback((key: keyof T, close...` |

#### `const createValueSetter`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useSettingsUpdater.ts` | 89 | `const createValueSetter = useCallback((key: keyof T) => {` |

#### `const createKeyboardHandler`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\hooks\useSettingsUpdater.ts` | 114 | `const createKeyboardHandler = useCallback((` |

#### `export const createActionButtons`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\toolbar\toolDefinitions.ts` | 97 | `export const createActionButtons = (props: {` |

#### `export function createIcon`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\toolbar\icons\shared\BaseIcon.tsx` | 40 | `export function createIcon(config: BaseIconConfig) {` |

#### `export function createVariantIcon`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\toolbar\icons\shared\BaseIcon.tsx` | 54 | `export function createVariantIcon(config: BaseIconConfig) {` |

#### `export function createDefaultCalibration`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `ui\wizard\utils\calibration-utils.ts` | 18 | `export function createDefaultCalibration(` |

#### `function createMockScene`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `utils\dxf-loader.ts` | 24 | `function createMockScene(): SceneModel {` |

#### `export function createFeedbackMessage`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `utils\shared\feedback-message-utils.ts` | 9 | `export function createFeedbackMessage(` |

#### `export function createCoordinateFeedback`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `utils\shared\feedback-message-utils.ts` | 30 | `export function createCoordinateFeedback(` |

#### `export function createDistanceFeedback`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `utils\shared\feedback-message-utils.ts` | 43 | `export function createDistanceFeedback(` |

#### `export function createEntityFeedback`

**Εμφανίσεις:** 1

| Αρχείο | Γραμμή | Κώδικας |
|--------|--------|---------|
| `utils\shared\feedback-message-utils.ts` | 55 | `export function createEntityFeedback(` |

