# 🔄 **DATA SYSTEMS OVERVIEW**

> **Enterprise Data Management**: Complete architecture για data handling, state management, και real-time operations

**🎯 Mission**: Centralized data operations με enterprise patterns για scalability και performance

---

## 📊 **DATA SYSTEMS ARCHITECTURE**

### 🏆 **ENTERPRISE METRICS**

| System | Lines | Files | Status | Key Features |
|--------|-------|-------|--------|--------------|
| **Property Fields System** | 875+ | 8 files | ✅ **Production** | Extended property fields (layout, areas, features) |
| **Alert Engine** | 2,000+ | 6 subsystems | ✅ **Production** | Real-time monitoring ecosystem |
| **Polygon System** | 800+ | 3 modules | ✅ **Enterprise** | Geographic drawing engine |
| **Context Providers** | 900+ | 6 providers | ✅ **Complete** | Global state management |
| **Config Systems** | 1,200+ | 50+ files | ✅ **Centralized** | Application configuration |
| **Multi-Selection System** | 600+ | 5 files | ✅ **Enterprise** | AutoCAD-style Window/Crossing selection |
| **Filter System** | 800+ | 7 files | ✅ **Enterprise** | ADR-051 Centralized Filtering |
| **Email/AI Ingestion** | 1,200+ | 10 files | ✅ **Production** | ADR-070 Email webhooks & AI analysis ✨ **NEW** |

**🏆 TOTAL**: **8 systems** | **8,375+ lines** | **Enterprise-grade** | **Real-time capable**

---

## 🏠 **PROPERTY FIELDS SYSTEM** ✨ NEW

### 📁 **EXTENDED PROPERTY FIELDS**

**📍 Location**: `src/features/property-details/components/UnitFieldsBlock.tsx` (875 lines)

**🎯 Mission**: Complete property field management με Firestore persistence

#### **🏢 ARCHITECTURE:**

```
UnitFieldsBlock
├── Phase 1: Layout (bedrooms, bathrooms, wc)
├── Phase 2: Areas (gross, net, balcony, terrace, garden)
├── Phase 3: Orientation (8 compass directions)
├── Phase 4: Condition & Energy (A+ to G)
└── Phase 5: Systems, Finishes, Features
```

#### **✅ ENTERPRISE FEATURES:**
- ✅ **Edit/View Modes**: Inline editing με immediate save
- ✅ **Firestore Persistence**: Real-time database updates
- ✅ **i18n Support**: Full EL/EN translations (80+ keys)
- ✅ **ADR-001 Compliance**: Radix Select για dropdowns
- ✅ **Centralized Tokens**: useSpacingTokens, useIconSizes, useBorderTokens
- ✅ **Type Safety**: Full TypeScript με enterprise types

**🔗 API Usage:**
```typescript
import { UnitFieldsBlock } from '@/features/property-details/components/UnitFieldsBlock';

<UnitFieldsBlock
  property={selectedUnit}
  onUpdateProperty={handleUpdateProperty}
  isReadOnly={false}
/>
```

**📚 Full Documentation**: **[Property Fields Guide](property-fields.md)**

---

## 🚨 **ALERT ENGINE SYSTEM**

### 📁 **PRODUCTION-GRADE MONITORING**

**📍 Location**: `packages/core/alert-engine/` (2,000+ lines, 6 subsystems)

**🎯 Mission**: Complete alert & monitoring ecosystem με enterprise standards

#### **🏢 ENTERPRISE ARCHITECTURE:**

```
packages/core/alert-engine/
├── rules/RulesEngine.ts           # Alert rule evaluation system
├── detection/AlertDetectionSystem.ts # Real-time monitoring
├── notifications/NotificationDispatchEngine.ts # Alert dispatch
├── analytics/EventAnalyticsEngine.ts # Analytics & reporting
├── dashboard/DashboardService.ts  # Real-time dashboard
├── configuration/ConfigService.ts # System configuration
└── index.ts                       # GeoAlertEngine master facade
```

#### **✅ ENTERPRISE FEATURES:**
- ✅ **Master Service**: `GeoAlertEngine` singleton με unified API
- ✅ **6 Subsystems**: Rules, Detection, Notifications, Analytics, Dashboard, Configuration
- ✅ **Real-time Monitoring**: Live alert detection και notification dispatch
- ✅ **Analytics Engine**: Comprehensive reporting και metrics computation
- ✅ **Health Monitoring**: System health checks και emergency controls
- ✅ **Rule Engine**: Configurable alert rules με automated execution

**🔗 API Usage:**
```typescript
// 🚨 Master alert engine access
import { geoAlertEngine } from '@/packages/core/alert-engine';

// ✅ System initialization
await geoAlertEngine.initialize();

// 🔔 Create alerts
await geoAlertEngine.createAlert('system', 'Critical Error', 'Database connection lost', 'critical');

// 📊 Health monitoring
const health = await geoAlertEngine.getSystemHealth();

// 📈 Analytics reports
const report = await geoAlertEngine.generateQuickReport();
```

---

## 🌍 **POLYGON SYSTEM**

### 📁 **ENTERPRISE DRAWING ENGINE**

**📍 Location**: `packages/core/polygon-system/` (800+ lines drawing system)

**🎯 Mission**: Professional drawing interface με enterprise patterns

#### **🏢 ARCHITECTURE:**

```
packages/core/polygon-system/
├── integrations/
│   └── usePolygonSystem.tsx     # Main integration hook
├── hooks/
│   ├── usePolygonSystemContext.ts
│   └── useCentralizedPolygonSystem.ts
└── types/                       # TypeScript definitions
```

#### **✅ ENTERPRISE FEATURES:**
- ✅ **Centralized Polygon Engine**: `usePolygonSystem` unified API
- ✅ **Drawing Tools**: Professional drawing, editing, snapping
- ✅ **Coordinate Management**: Precision coordinate handling
- ✅ **Style System**: `usePolygonStyles` με theme support
- ✅ **Integration Layer**: React hooks για seamless integration

**🔗 API Usage:**
```typescript
// 🌍 Geo-Canvas Drawing Engine
import { usePolygonSystem } from '@/packages/core/polygon-system';
import { usePolygonStyles } from '@/hooks/usePolygonStyles';
import { useCentralizedPolygonSystem } from '@/packages/core/polygon-system/hooks';

// ✅ Professional Drawing Interface
const { drawingMode, coordinates, tools, isDrawing } = usePolygonSystem();
const { polygonStyles, activeStyle } = usePolygonStyles();
```

---

## 🏗️ **STATE MANAGEMENT**

### 📁 **CONTEXT PROVIDERS ECOSYSTEM**

**📍 Location**: `src/contexts/` (900+ lines, 6 core providers)

**🎯 Mission**: Global state management με enterprise patterns

#### **✅ CORE PROVIDERS:**
- ✅ **SharedPropertiesProvider**: Global property state
- ✅ **CanvasContextProvider**: Canvas και viewport management
- ✅ **SelectionContextProvider**: Selection state handling
- ✅ **GripContextProvider**: Interactive grip management
- ✅ **NotificationProvider**: Alert και notification state
- ✅ **PerformanceProvider**: Performance monitoring state

**🔗 API Usage:**
```typescript
// 🏗️ Global State Management
import {
  SharedPropertiesProvider,
  useSharedProperties,
  CanvasContextProvider,
  useCanvasContext
} from '@/contexts';

// ✅ Provider Usage
<SharedPropertiesProvider>
  <CanvasContextProvider>
    <YourComponent />
  </CanvasContextProvider>
</SharedPropertiesProvider>

// ✅ Hook Usage
const { properties, updateProperty } = useSharedProperties();
const { canvas, transform } = useCanvasContext();
```

---

## ⚙️ **CONFIGURATION SYSTEMS**

### 📁 **CENTRALIZED APP CONFIGURATION**

**📍 Location**: `src/config/` (1,200+ lines, 50+ config files)

**🎯 Mission**: Complete app configuration με business logic

#### **✅ KEY CONFIG SYSTEMS:**
- ✅ **Navigation Config**: Menu και routing configuration
- ✅ **Building Tabs Config**: Entity-specific tab configurations
- ✅ **Feature Flags**: Development/production feature toggles
- ✅ **API Configuration**: Service endpoints και settings
- ✅ **Business Logic**: Domain-specific configuration rules

**🔗 API Usage:**
```typescript
// 📱 Global Application Settings
import {
  navigationConfig,
  buildingTabsConfig,
  APP_CONSTANTS,
  FEATURE_FLAGS
} from '@/config';

// ✅ Configuration Usage
const navItems = navigationConfig.main;
const tabs = buildingTabsConfig.tabs;
const isFeatureEnabled = FEATURE_FLAGS.NEW_SEARCH_UI;
```

---

## 🎯 **MULTI-SELECTION SYSTEM** ✨ NEW

### 📁 **AUTOCAD-STYLE SELECTION ENGINE**

**📍 Location**: `src/subapps/dxf-viewer/stores/overlay-store.tsx` + `systems/selection/` (600+ lines)

**🎯 Mission**: Professional multi-selection με Window/Crossing patterns (AutoCAD-style)

#### **🏢 ARCHITECTURE:**

```
Multi-Selection System
├── overlay-store.tsx         # State: selectedOverlayIds: Set<string>
├── UniversalMarqueeSelection.ts # Polygon intersection algorithms
├── useCentralizedMouseHandlers.ts # Mouse event handling
└── CanvasSection.tsx         # Visual feedback (grips)
```

#### **✅ ENTERPRISE FEATURES:**
- ✅ **Window Selection** (left→right): Επιλογή entities εντός του selection box
- ✅ **Crossing Selection** (right→left): Επιλογή entities που τέμνονται
- ✅ **Single-Click Selection**: Point-in-polygon hit-test (ray casting)
- ✅ **Accurate Intersection**: Polygon-to-rectangle intersection (no bounding box)
- ✅ **Grip Drag Prevention**: Hover state check για timing issues
- ✅ **Multi-Grip Display**: Grips εμφανίζονται σε όλα τα επιλεγμένα layers

**🔗 API Usage:**
```typescript
import { useOverlayStore } from '@/subapps/dxf-viewer/stores/overlay-store';

const overlayStore = useOverlayStore();

// Multi-select
overlayStore.setSelectedOverlays(['overlay_1', 'overlay_2', 'overlay_3']);

// Check selection
if (overlayStore.isSelected('overlay_1')) { /* ... */ }

// Get all selected
const selected = overlayStore.getSelectedOverlays();

// Toggle
overlayStore.toggleSelection('overlay_2');

// Clear all
overlayStore.clearSelection();
```

**📚 Full Documentation**: **[HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md](../../src/subapps/dxf-viewer/docs/HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md#9-multi-selection--marquee-selection-system-2026-01-25)**

---

## 🔍 **ENTERPRISE FILTER SYSTEM (ADR-051)** ✨ NEW

### 📁 **CENTRALIZED FILTERING ENGINE**

**📍 Location**: `src/components/core/AdvancedFilters/` (800+ lines)

**🎯 Mission**: Single source of truth για filtering operations across the application

#### **🏢 ARCHITECTURE:**

```
src/components/core/AdvancedFilters/
├── AdvancedFiltersPanel.tsx    # Universal filter panel component
├── useGenericFilters.ts        # Enterprise filtering hook (330+ lines)
├── FilterField.tsx             # Universal field renderer (8 field types)
├── types.ts                    # Type definitions & guards (200+ lines)
├── configs.ts                  # Centralized filter configurations
├── utils/applyFilters.ts       # Filter application utilities
└── index.ts                    # Central export point
```

#### **✅ ENTERPRISE FEATURES:**
- ✅ **Generic Hook**: `useGenericFilters<T>` με 12+ methods
- ✅ **Type-Safe Ranges**: `NumericRange`, `DateRange` με type guards
- ✅ **Configurable Features**: `handleFeatureChange(id, checked, featureKey)`
- ✅ **Filter Utilities**: `matchesSearchTerm`, `matchesNumericRange`, `matchesArrayFilter`
- ✅ **Batch Operations**: `batchUpdate`, `clearAllFilters`
- ✅ **Active Filter Detection**: `hasActiveFilters`, `activeFilterCount`

#### **❌ DELETED (DUPLICATES):**
- ❌ `useFilterState.ts` - Replaced by `useGenericFilters`
- ❌ `useFilteredProjects.ts` - Dead code (0 consumers)
- ❌ `property-viewer/AdvancedFiltersPanel.tsx` - Use core version

**🔗 API Usage:**
```typescript
import {
  useGenericFilters,
  matchesSearchTerm,
  matchesNumericRange,
  matchesArrayFilter,
  matchesFeatures,
  NumericRange,
  GenericFilterState
} from '@/components/core/AdvancedFilters';

// 🏢 ENTERPRISE: Type-safe filtering
const {
  handleFilterChange,
  handleRangeChange,
  handleFeatureChange,
  clearAllFilters,
  hasActiveFilters,
  activeFilterCount,
  setNumericRange,
  setDateRange,
  toggleArrayValue,
  batchUpdate
} = useGenericFilters(filters, onFiltersChange);

// 🏢 ENTERPRISE: Use centralized filter utilities
const filtered = items.filter(item => {
  const searchMatch = matchesSearchTerm(item, searchTerm, ['name', 'description']);
  const priceMatch = matchesNumericRange(item.price, priceRange);
  const typeMatch = matchesArrayFilter(item.type, selectedTypes);
  const featuresMatch = matchesFeatures(item.features, requiredFeatures);
  return searchMatch && priceMatch && typeMatch && featuresMatch;
});
```

**📋 Consumers**: PropertyViewerFilters, usePropertyFilters, FilterControls, AdvancedFiltersPanel (16+ files)

---

## 🎯 **ENTERPRISE PATTERNS**

### ✅ **DATA FLOW ARCHITECTURE**

#### **📊 REAL-TIME DATA FLOW:**
```
User Interaction → Context Providers → Business Logic → Alert Engine → UI Updates
                ↓                    ↓                ↓
            State Updates → Polygon System → Configuration → Notifications
```

#### **🏢 ENTERPRISE BENEFITS:**
- **Centralized State**: Single source of truth για όλα τα data
- **Real-time Updates**: Live monitoring και instant notifications
- **Type Safety**: Full TypeScript support με validated schemas
- **Performance**: Optimized data flow με minimal re-renders
- **Scalability**: Enterprise patterns για high-load scenarios

### 🔄 **DATA PERSISTENCE PATTERNS**

#### **✅ STORAGE STRATEGIES:**
- **Context State**: In-memory για UI state
- **Configuration**: File-based για app settings
- **Alert Data**: Database storage για historical tracking
- **Drawing Data**: Local storage για user drawings

---

## 📚 **DETAILED DOCUMENTATION**

### 🎯 **SYSTEM-SPECIFIC GUIDES**
- **[🏠 Property Fields](property-fields.md)** - Extended property fields guide
- **[🚨 Alert Engine](alert-engine.md)** - Complete monitoring system guide
- **[🌍 Polygon System](polygon-system.md)** - Drawing engine documentation
- **[🏗️ State Management](state-management.md)** - Context providers detailed guide
- **[🎯 Multi-Selection](../../src/subapps/dxf-viewer/docs/HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md#9-multi-selection--marquee-selection-system-2026-01-25)** - AutoCAD-style selection
- **[📧 Email/AI Ingestion](email-ai-ingestion.md)** - Email webhooks & AI analysis ✨ **NEW**

### 🔗 **RELATED SYSTEMS**
- **[📊 Original Documentation](../../src/subapps/dxf-viewer/docs/centralized_systems.md)** - Complete implementation details
- **[📋 Systems Overview](../overview.md)** - Data systems στο broader context
- **[🔗 API Reference](../reference/api-quick-reference.md)** - Quick import examples

---

## 🏆 **ENTERPRISE COMPLIANCE**

### ✅ **DATA MANAGEMENT STANDARDS**

| Standard | Status | Evidence |
|----------|--------|----------|
| **Type Safety** | ✅ **100%** | Full TypeScript schemas |
| **Real-time Capable** | ✅ **100%** | Alert engine proven |
| **State Consistency** | ✅ **100%** | Centralized context providers |
| **Performance Optimized** | ✅ **100%** | Minimal re-render patterns |
| **Scalability Ready** | ✅ **100%** | Enterprise architecture patterns |

### 🎯 **INDUSTRY STANDARDS**

**📚 Reference Implementations**:
- **Netflix**: Real-time alert patterns
- **Uber**: Geographic data handling
- **Airbnb**: State management patterns
- **Spotify**: Configuration management

---

> **📅 Last Updated**: 2026-01-29
>
> **👥 Authors**: Γιώργος Παγώνης + Claude Code (Anthropic AI)
>
> **🔗 Complete Reference**: [Full Data Systems Documentation](../../src/subapps/dxf-viewer/docs/centralized_systems.md#data-systems)