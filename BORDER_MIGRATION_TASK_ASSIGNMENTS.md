# 📋 BORDER MIGRATION - DETAILED TASK ASSIGNMENTS (COMPREHENSIVE UPDATE)

## 🎯 **OVERVIEW - COMPREHENSIVE AUDIT RESULTS**
**Previous Completed:**
- ✅ GEO-CANVAS domain (15 files, 46 violations) - Agent B 100% COMPLETE
- ✅ DXF-VIEWER partial (6 files, 25+ violations) - Agent B completed

**NEW COMPREHENSIVE FINDINGS:**
- **540 total violations** across **239 files**
- **85% της εφαρμογής** χρειάζεται border centralization
- **Strategy:** Parallel execution με 4 specialized agents
- **Updated Timeline:** 8-12 hours total effort, 3-5 weeks wall time

---

## 🟢 **AGENT A - DXF-VIEWER & CORE HOOKS SPECIALIST**

### 🎯 **Domain:** DXF Systems, Performance, Core Hooks
**Total Files:** 60 files | **Estimated Effort:** 4-5 hours | **Priority:** 🔴 CRITICAL

### 📁 **ASSIGNED FILES (60 FILES):**
```
🔥 CRITICAL HOOKS & CORE SYSTEMS:
src/hooks/useSemanticColors.ts (11 violations) - Core color system
src/styles/design-tokens/core/borders.ts (21 violations) - Design tokens
src/utils/lazyRoutes.tsx (1 violation) - Routing system

🎯 DXF-VIEWER HIGH PRIORITY:
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/CursorSettings.tsx (10 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/LayersSettings.tsx (9 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/CrosshairAppearanceSettings.tsx (9 violations)
src/subapps/dxf-viewer/ui/OverlayToolbar.tsx (8 violations)
src/subapps/dxf-viewer/ui/components/DraggableOverlayToolbar.tsx (7 violations)
src/subapps/dxf-viewer/config/panel-tokens.ts (7 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/rulers/RulerBackgroundSettings.tsx (7 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/rulers/RulerUnitsSettings.tsx (6 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/shared/CurrentSettingsDisplay.tsx (6 violations)
src/subapps/dxf-viewer/ui/components/ProSnapToolbar.tsx (5 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/rulers/RulerTextSettings.tsx (5 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/GridSettings.tsx (5 violations)
src/subapps/dxf-viewer/ui/components/palettes/CursorColorPalette.tsx (4 violations)
src/subapps/dxf-viewer/ui/components/dxf-settings/settings/special/EntitiesSettings.tsx (4 violations)
src/subapps/dxf-viewer/ui/color/UnifiedColorPicker.tsx (4 violations)

⚡ ADDITIONAL DXF FILES (45 more files):
[Continuing with remaining DXF-Viewer components...]
```

---

## 🟡 **AGENT B - GEO-CANVAS & FLOOR PLAN SPECIALIST** (COMPLETED + NEW TASKS)

### 🎯 **Domain:** Geographic Systems, Floor Plans, Polygon Systems
**Status:** ✅ Previous work completed, **NEW TASKS:** 60 files
**Total Files:** 60 files | **Estimated Effort:** 3-4 hours | **Priority:** 🔴 HIGH

### 📁 **ASSIGNED FILES (60 FILES):**
```
🗺️ GEO-CANVAS COMPLETION (Remaining violations):
src/subapps/geo-canvas/components/ProfessionalDrawingInterface.tsx (9 violations)
src/subapps/geo-canvas/components/CitizenDrawingInterface.tsx (8 violations)
src/subapps/geo-canvas/floor-plan-system/components/FloorPlanPreview.tsx (7 violations)
src/subapps/geo-canvas/components/TechnicalDrawingInterface.tsx (6 violations)
src/subapps/geo-canvas/systems/polygon-system/components/PolygonControls.tsx (4 violations)
src/subapps/geo-canvas/components/BoundaryLayerControlPanel.tsx (3 violations)
src/subapps/geo-canvas/components/GeoreferencingPanel.tsx (2 violations)
src/subapps/geo-canvas/floor-plan-system/components/FloorPlanUploadButton.tsx (1 violation)

🏢 PROPERTY & BUILDING MANAGEMENT:
src/components/property-viewer/version-history/VersionList.tsx (1 violation)
src/components/property-viewer/version-history/VersionDetails.tsx (2 violations)
src/components/property-viewer/FloorPlanCanvas/StatusLegend.tsx (1 violation)
src/components/property-viewer/LayersPanel/LayersPanel.tsx (1 violation)
src/components/property-viewer/ReadOnlyLayerViewer.tsx (1 violation)
src/components/property-viewer/PropertyLayerItem/PropertyLayerDetails.tsx (1 violation)
src/components/property-viewer/AdminLayerManager.tsx (1 violation)

🏗️ BUILDING SYSTEMS:
src/components/building-management/tabs/GeneralTabContent/FilesCard.tsx (5 violations)
src/components/building-management/tabs/MapTabContent/InteractiveMap/MapCanvas.tsx (2 violations)
src/components/building-management/tabs/TimelineTabContent/MilestoneItem.tsx (2 violations)
src/components/building-management/tabs/PlaceholderTab.tsx (1 violation)
src/components/building-management/tabs/PhotosTabContent.tsx (1 violation)
src/components/building-management/tabs/VideosTabContent.tsx (1 violation)

⚡ ADDITIONAL PROPERTY FILES (35+ more files):
[Property management, building systems, floor plan components...]
```

---

## 🔵 **AGENT C - UI COMPONENTS & FORMS SPECIALIST**

### 🎯 **Domain:** Core UI, Forms, Theme, Business Components
**Total Files:** 60 files | **Estimated Effort:** 4-5 hours | **Priority:** 🟡 FOUNDATIONAL

### 📁 **ASSIGNED FILES (60 FILES):**
```
🎨 CORE UI COMPONENTS (Foundation layer):
src/components/ui/theme/ThemeComponents.tsx (7 violations)
src/components/ui/skeletons/index.tsx (4 violations)
src/components/ui/form/UniversalClickableField.tsx (4 violations)
src/components/ui/email-sharing/EmailShareForm.original.tsx (4 violations)
src/components/ui/email-sharing/components/ValidationErrors.tsx (4 violations)
src/components/ui/variants.ts (2 violations)
src/components/ui/tooltip.tsx (1 violation)
src/components/ui/textarea.tsx (1 violation)
src/components/ui/switch.tsx (1 violation)
src/components/ui/slider.tsx (1 violation)
src/components/ui/sidebar.tsx (1 violation)
src/components/ui/search/HeaderSearch.tsx (1 violation)
src/components/ui/scroll-area.tsx (1 violation)
src/components/ui/radio-group.tsx (1 violation)
src/components/ui/progress/ProgressiveLoader.tsx (1 violation)
src/components/ui/popover.tsx (1 violation)
src/components/ui/MultiplePhotosCompact.tsx (2 violations)
src/components/ui/menubar.tsx (3 violations)
src/components/ui/EnterprisePhotoUpload.tsx (2 violations)
src/components/ui/checkbox.tsx (1 violation)
src/components/ui/chart/tooltip/Content.tsx (1 violation)
src/components/ui/badge.tsx (1 violation)
src/components/ui/alert.tsx (1 violation)

📝 FORMS & FIELDS:
src/components/core/FormFields/FormField.tsx (3 violations)
src/components/core/BaseCard/BaseCardValidated.tsx (1 violation)
src/components/core/AdvancedFilters/FilterField.tsx (1 violation)
src/components/core/AdvancedFilters/AdvancedFiltersPanel.tsx (2 violations)

📧 EMAIL & SHARING:
src/components/ui/email-sharing/components/TemplateSelector.tsx (2 violations)
src/components/ui/email-sharing/components/RecipientsList.tsx (1 violation)
src/components/ui/email-sharing/components/MessagePreview.tsx (2 violations)

⚡ ADDITIONAL UI FILES (30+ more files):
[Generic components, showcase components, providers...]
```

---

## 🟣 **AGENT D - APP PAGES & BUSINESS LOGIC SPECIALIST**

### 🎯 **Domain:** Next.js Pages, CRM, Units, Navigation, Features
**Total Files:** 59 files | **Estimated Effort:** 3-4 hours | **Priority:** 🟢 BUSINESS LOGIC

### 📁 **ASSIGNED FILES (59 FILES):**
```
📊 UNITS & SPACE MANAGEMENT:
src/components/units/UnitsList.tsx (1 violation)
src/components/units/tabs/UnitCustomerTab.tsx (3 violations)
src/components/units/page/UnitsHeader.tsx (1 violation)
src/components/units/FiltersPanel.tsx (1 violation)
src/features/units-sidebar/UnitsSidebar.tsx (2 violations)

🏪 SPACE MANAGEMENT:
src/components/space-management/StoragesPage/StoragesList/StoragesList.tsx (1 violation)
src/components/space-management/StoragesPage/StoragesList/StorageListItem.tsx (1 violation)
src/components/space-management/StoragesPage/StoragesHeader.tsx (1 violation)
src/components/space-management/StoragesPage/StorageDetails/tabs/StorageDocumentsTab.tsx (1 violation)
src/components/space-management/StoragesPage/StorageDetails/tabs/StorageStatsTab.tsx (3 violations)
src/components/space-management/StoragesPage/StorageDetails/tabs/StoragePhotosTab.tsx (6 violations)

🏢 CRM & BUSINESS LOGIC:
src/components/crm/dashboard/TelegramNotifications.tsx (1 violation)
src/components/crm/dashboard/TasksTab.tsx (2 violations)
src/components/crm/dashboard/PipelineTab.tsx (2 violations)
src/components/crm/dashboard/OpportunityCard.tsx (1 violation)
src/components/crm/dashboard/dialogs/CreateTaskModal.tsx (3 violations)
src/components/crm/dashboard/ContactsTab.tsx (1 violation)
src/components/crm/dashboard/CalendarTab.tsx (1 violation)
src/components/crm/CommunicationsIntegration.tsx (1 violation)

👥 CONTACTS & RELATIONSHIPS:
src/components/contacts/relationships/summary/StatisticsSection.tsx (1 violation)
src/components/contacts/relationships/summary/StateComponents.tsx (1 violation)
src/components/contacts/relationships/RelationshipsSummary.tsx (1 violation)
src/components/contacts/relationships/RelationshipForm.tsx (1 violation)
src/components/contacts/relationships/OrganizationTree.tsx (1 violation)
src/components/contacts/page/ContactsHeader.tsx (1 violation)
src/components/contacts/ContactsPageContent.tsx (4 violations)

📱 APP PAGES:
src/app/units/page.tsx (1 violation)
src/app/test-upload/page.tsx (3 violations)
src/app/storage/[id]/page.tsx (1 violation)
src/app/spaces/storage/page.tsx (2 violations)
src/app/spaces/apartments/page.tsx (1 violation)
src/app/properties/page.tsx (1 violation)
src/app/crm/leads/[id]/page.tsx (2 violations)

⚡ ADDITIONAL BUSINESS FILES (25+ more files):
[Navigation, features, leads, projects, admin pages...]
```

---

## 🤝 **COORDINATION PROTOCOL - UPDATED**

### 📊 **PROGRESS TRACKING:**
Each agent reports progress every **10 files completed** or **45 minutes**, whichever comes first.

### 📈 **LOAD BALANCING:**
- **Agent A:** 60 files (Critical hooks + DXF completion)
- **Agent B:** 60 files (GEO-Canvas completion + Property/Building)
- **Agent C:** 60 files (Core UI + Forms + Theme)
- **Agent D:** 59 files (App Pages + Business Logic)
- **Total:** 239 files distributed equally

### ⚡ **TECHNICAL REQUIREMENTS:**
1. **Import:** `import { useBorderTokens } from '@/hooks/useBorderTokens';`
2. **Hook Usage:** `const { quick } = useBorderTokens();`
3. **Common Replacements:**
   - `border rounded-lg` → `${quick.card}`
   - `border rounded-md` → `${quick.table}`
   - `border rounded` → `${quick.input}`
   - `rounded-full` → Keep as is (special case)

### 🚫 **CONFLICT AVOIDANCE:**
- **Domain Separation:** Each agent has exclusive file ownership
- **No Overlap:** Zero shared files between agents
- **Same Standards:** All agents use identical migration patterns

---

## 📋 **EXECUTION PHASES**

### **Phase 1: FOUNDATION (Week 1)**
- **Agent A:** Core hooks & design tokens (Critical infrastructure)
- **Agent C:** Core UI components (Foundation multiplier effect)

### **Phase 2: DOMAIN COMPLETION (Week 2-3)**
- **Agent A:** Complete DXF-Viewer domain
- **Agent B:** Complete GEO-Canvas + Property systems

### **Phase 3: BUSINESS LOGIC (Week 4)**
- **Agent D:** App pages & business components
- **All Agents:** Cross-verification and testing

---

## ✅ **UPDATED COMPLETION CRITERIA**

### **Overall Targets:**
- [x] 46 violations resolved (Agent B - GEO-Canvas initial) ✅
- [ ] **540 total violations** to be resolved across **239 files**
- [ ] **100% centralization** με useBorderTokens system
- [ ] **Zero hardcoded borders** remaining in codebase
- [ ] Full TypeScript compilation success
- [ ] Runtime verification completed

**🚀 ΜΕΓΑΛΗ ΑΠΟΣΤΟΛΗ: From 540 violations → 0 violations. Ready for parallel execution!**