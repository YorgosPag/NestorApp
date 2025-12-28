# 🔗 **API QUICK REFERENCE**

> **Developer Cheatsheet**: Complete import examples και usage patterns για όλα τα centralized systems

**🎯 Purpose**: Quick copy-paste examples για immediate productivity

---

## 🎨 **DESIGN SYSTEM API**

### 🏗️ **PRIMARY DESIGN SYSTEM ACCESS**

```typescript
// 🏢 Unified API access (Recommended)
import { useDesignSystem } from '@/hooks/useDesignSystem';
const { borders, colors, spacing, typography } = useDesignSystem();
```

### 🔗 **SPECIFIC DESIGN HOOKS**

```typescript
import {
  useBorderTokens,     // 519+ uses - proven in production
  useTypography,       // Enterprise typography system
  useSemanticColors,   // Status colors & themes (from '@/ui-adapters/react/useSemanticColors')
  useLayoutClasses,    // FlexCenter, CardLayouts
  useIconSizes         // Standardized icon sizing
} from '@/hooks';

// Usage Examples
const { quick } = useBorderTokens();
const { headings, body } = useTypography();
const { status, bg, text } = useSemanticColors();
const { flexCenter, cardLayout } = useLayoutClasses();
const { sm, md, lg } = useIconSizes();
```

### 🎨 **MODULAR TOKEN IMPORTS**

```typescript
// 🎯 Modular imports για performance (Tree-shaking enabled)
import { CORE_COLORS, SEMANTIC_STATUS } from '@/styles/design-tokens';

// 🔧 Legacy compatibility (Still works)
import { colors } from '@/styles/design-tokens';

// 🎯 Component-specific tokens
import { PANEL_TOKENS } from '@/subapps/dxf-viewer/config/panel-tokens';
```

---

## 🏭 **SMART FACTORY API**

### 📑 **TABS SMART FACTORY**

```typescript
// 🏭 Dynamic Tab Configuration Generation
import {
  createTabsConfig,
  TabEntityType,
  ContactType,
  getSortedTabs,
  getDefaultTab
} from '@/config/unified-tabs-factory';

// ✅ Basic Usage
const unitsTabs = createTabsConfig('units');
const buildingTabs = createTabsConfig('building');

// ✅ Conditional Logic (Contact Types)
const companyContactTabs = createTabsConfig('contact', 'company');
const personContactTabs = createTabsConfig('contact', 'person');

// ✅ Utility Functions
const enabledTabs = getSortedTabs('units');
const defaultTab = getDefaultTab('building');
const tabCount = getEnabledTabsCount('contact', 'company');
```

### 🧭 **NAVIGATION SMART FACTORY**

```typescript
// 🏭 Dynamic Navigation Generation
import {
  createNavigationConfig,
  NavigationMenuType,
  NavigationEnvironment,
  createMainMenuItems,
  createToolsMenuItems,
  createSettingsMenuItems
} from '@/config/smart-navigation-factory';

// ✅ Environment & Permission-aware
const prodMainMenu = createNavigationConfig('main', 'production', ['user']);
const devToolsMenu = createNavigationConfig('tools', 'development', ['admin']);
const settingsMenu = createNavigationConfig('settings', 'production', ['user']);

// ✅ Backward Compatible Functions
const mainMenuItems = createMainMenuItems('production', ['user']);
const toolsMenuItems = createToolsMenuItems('development', ['admin']);
const settingsMenuItems = createSettingsMenuItems('production');
```

---

## 🔄 **DATA SYSTEMS API**

### 🚨 **ALERT ENGINE**

```typescript
// 🚨 Master Alert Engine
import { geoAlertEngine } from '@/packages/core/alert-engine';

// ✅ System Operations
await geoAlertEngine.initialize();
await geoAlertEngine.createAlert('critical', 'System Error', 'Description', 'critical');
const health = await geoAlertEngine.getSystemHealth();
const report = await geoAlertEngine.generateQuickReport();

// ✅ Specific Subsystems
import {
  AlertDetectionSystem,
  NotificationDispatchEngine,
  EventAnalyticsEngine
} from '@/packages/core/alert-engine';
```

### 🌍 **POLYGON SYSTEM**

```typescript
// 🌍 Geo-Canvas Drawing Engine
import { usePolygonSystem } from '@/packages/core/polygon-system';
import { usePolygonStyles } from '@/hooks/usePolygonStyles';
import { useCentralizedPolygonSystem } from '@/packages/core/polygon-system/hooks';

// ✅ Professional Drawing Interface
const { drawingMode, coordinates, tools, isDrawing } = usePolygonSystem();
const { polygonStyles, activeStyle } = usePolygonStyles();
```

### 🏗️ **CONTEXT PROVIDERS**

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

## 🖼️ **UI SYSTEMS API**

### 📸 **PHOTO SYSTEM**

```typescript
// 📸 Centralized Photo Management
import { PhotoGrid } from '@/components/generic/utils/PhotoGrid';
import {
  PHOTO_COLORS,
  PHOTO_BORDERS,
  PHOTO_DIMENSIONS
} from '@/components/generic/config/photo-config';

// ✅ PhotoGrid Usage
<PhotoGrid
  photos={photos}
  maxPlaceholders={6}
  gridCols={{ mobile: 2, tablet: 3, desktop: 4 }}
  onUploadClick={() => openUploadModal()}
/>

// ✅ Photo Config Usage
className={PHOTO_COLORS.PHOTO_BACKGROUND}
className={PHOTO_BORDERS.EMPTY_STATE}
```

### 🔍 **SEARCH SYSTEM**

```typescript
// 🔍 Unified Search Experience
import {
  SearchInput,
  QuickSearch,
  TableHeaderSearch,
  HeaderSearch,
  SEARCH_UI
} from '@/components/ui/search';

// ✅ Search Components
<SearchInput
  placeholder="Search..."
  onSearch={handleSearch}
  className={SEARCH_UI.INPUT.FOCUS}
/>

// ✅ Enterprise Focus Ring
className={SEARCH_UI.INPUT.FOCUS} // focus-visible:ring-1 focus-visible:ring-blue-500
```

### 📄 **ENTERPRISE HEADERS**

```typescript
// 📄 Modular Header Architecture
import {
  PageHeader,
  HeaderBuilder,
  createEnterpriseHeader
} from '@/core/headers/enterprise-system';

// ✅ Builder Pattern Usage
const header = createEnterpriseHeader({
  title: "Page Title",
  breadcrumbs: ["Home", "Section", "Page"],
  actions: [{ label: "Add", onClick: handleAdd }]
});

// ✅ Component Usage
<PageHeader
  title="Dashboard"
  subtitle="System Overview"
  actions={headerActions}
/>
```

---

## ⚙️ **CONFIGURATION API**

### 🏗️ **DXF CONFIGURATION**

```typescript
// 🏗️ CAD-Specific Configuration
import {
  PANEL_TOKENS,
  ZOOM_FACTORS,
  DXF_SETTINGS_CONFIG,
  PanelTokenUtils
} from '@/subapps/dxf-viewer/config';

// ✅ AutoCAD-Class Implementation
className={PANEL_TOKENS.LEVEL_PANEL.HEADER.TEXT}
const zoomFactor = ZOOM_FACTORS.BUTTON_IN; // 20%
const settings = DXF_SETTINGS_CONFIG.DEFAULT;
```

### 📱 **APP CONFIGURATION**

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

## 📊 **COMMON PATTERNS**

### 🎯 **COMPONENT STYLING PATTERN**

```typescript
// ✅ Enterprise Component Pattern
import { useSemanticColors, useBorderTokens, useIconSizes } from '@/hooks';

export function MyEnterpriseComponent({ className = '' }: Props) {
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const iconSizes = useIconSizes();

  return (
    <div
      className={`
        ${colors.bg.primary}
        ${colors.text.primary}
        ${quick.all}
        p-4
        ${className}
      `}
    >
      <Icon className={iconSizes.md} />
      <Text>Enterprise Content</Text>
    </div>
  );
}
```

### 🔗 **HOOK COMPOSITION PATTERN**

```typescript
// ✅ Business Logic Hook Composition
import {
  useContactForm,
  useEnterpriseFileUpload,
  useNotificationDrawer
} from '@/hooks';

export function useContactManagement() {
  const { formData, handleSubmit, validate } = useContactForm();
  const { uploadFile, progress, error } = useEnterpriseFileUpload();
  const { showSuccess, showError } = useNotificationDrawer();

  const saveContact = async (data: ContactData) => {
    try {
      await handleSubmit(data);
      showSuccess('Contact saved successfully');
    } catch (err) {
      showError('Failed to save contact');
    }
  };

  return { formData, saveContact, uploadFile, progress };
}
```

### 🏭 **SMART FACTORY PATTERN**

```typescript
// ✅ Smart Factory Integration Pattern
import { createTabsConfig } from '@/config/unified-tabs-factory';
import { createNavigationConfig } from '@/config/smart-navigation-factory';

export function useEntityConfiguration(entityType: string, userRole: string) {
  const tabs = createTabsConfig(entityType as TabEntityType);
  const navigation = createNavigationConfig('main', 'production', [userRole]);

  return { tabs, navigation };
}
```

---

## 🔗 **CROSS-REFERENCES**

### 📚 **DETAILED DOCUMENTATION**
- **[🏢 Complete Implementation](../../../src/subapps/dxf-viewer/docs/centralized_systems.md)** - Full 2,824-line reference
- **[📊 Systems Table](../../../src/subapps/dxf-viewer/docs/centralized_systems_TABLE.md)** - Comprehensive metrics
- **[🎯 Overview](../overview.md)** - Architecture summary

### 🎯 **SPECIFIC SYSTEMS**
- **[🎨 Design System](../design-system/index.md)** - Complete design documentation
- **[🏭 Smart Factories](../smart-factories/index.md)** - Factory patterns guide
- **[🖼️ UI Systems](../ui-systems/index.md)** - UI components reference

### 🛠️ **DEVELOPMENT TOOLS**
- **[📖 Import Examples](import-examples.md)** - Copy-paste code examples
- **[🛠️ Troubleshooting](troubleshooting.md)** - Common issues & solutions

---

> **💡 Pro Tip**: Bookmark this page για instant access στα imports που χρειάζεσαι!
>
> **📅 Last Updated**: 2025-12-28
>
> **🔄 Coverage**: 17 Enterprise Systems | 100+ API Examples