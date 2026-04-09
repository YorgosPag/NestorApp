# 📋 **ARCHITECTURAL DECISION RECORDS (ADRs) INDEX**

> **Complete Enterprise ADR Registry**
>
> Single source of truth για όλες τις αρχιτεκτονικές αποφάσεις της εφαρμογής
>
> ⚠️ **AUTO-GENERATED FILE** - Do not edit manually!
> Run `node docs/centralized-systems/reference/scripts/generate-adr-index.cjs` to regenerate.

**📊 Stats**: 277 ADRs | Last Updated: 2026-04-07

---

## 🎯 **QUICK NAVIGATION**

| Category | Count | Quick Jump |
|----------|-------|------------|
| 📐 **Domain - Geometry** | 1 | [View](#domain-geometry) |
| 🎨 **UI Components** | 12 | [View](#ui-components) |
| 🎨 **Design System** | 7 | [View](#design-system) |
| 🖼️ **Canvas & Rendering** | 39 | [View](#canvas-rendering) |
| 📊 **Data & State** | 12 | [View](#data-state) |
| ✏️ **Drawing System** | 16 | [View](#drawing-system) |
| 📂 **Entity Systems** | 16 | [View](#entity-systems) |
| 🔧 **Tools & Keyboard** | 8 | [View](#tools-keyboard) |
| 🔍 **Filters & Search** | 1 | [View](#filters-search) |
| 🔒 **Security & Auth** | 8 | [View](#security-auth) |
| 🔧 **Backend Systems** | 3 | [View](#backend-systems) |
| 🛠️ **Infrastructure** | 3 | [View](#infrastructure) |
| ⚡ **Performance** | 4 | [View](#performance) |
| 📄 **Uncategorized** | 88 | [View](#uncategorized) |

---

## 📊 **COMPLETE ADR TABLE**

| ADR | Decision | Status | Date | Category | Link |
|-----|----------|--------|------|----------|------|
| **ADR-GEOMETRY** | Geometry & Math Operations | ✅ ACTIVE | 2026-01-01 | Domain - Geometry | [📄](./adrs/ADR-GEOMETRY.md) |
| **ADR-001** | Select/Dropdown Component | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-001-select-dropdown-component.md) |
| **ADR-002** | Enterprise Z-Index Hierarchy | ✅ APPROVED | 2026-01-01 | Design System | [📄](./adrs/ADR-002-enterprise-z-index-hierarchy.md) |
| **ADR-003** | Floating Panel Compound Component | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-003-floating-panel-compound-component.md) |
| **ADR-004** | Canvas Theme System | ✅ APPROVED | 2026-01-01 | Design System | [📄](./adrs/ADR-004-canvas-theme-system.md) |
| **ADR-005** | Line Drawing System | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-005-line-drawing-system.md) |
| **ADR-006** | Crosshair Overlay Consolidation | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-006-crosshair-overlay-consolidation.md) |
| **ADR-008** | CSS→Canvas Coordinate Contract | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-008-css-canvas-coordinate-contract.md) |
| **ADR-009** | Ruler Corner Box Interactive | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-009-ruler-corner-box-interactive.md) |
| **ADR-010** | Panel Type Centralization | ✅ APPROVED | 2026-01-01 | Data & State | [📄](./adrs/ADR-010-panel-type-centralization.md) |
| **ADR-011** | FloatingPanel UI Styling System | ✅ APPROVED | 2026-01-01 | Design System | [📄](./adrs/ADR-011-floatingpanel-ui-styling-system.md) |
| **ADR-012** | Entity Linking Service | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-012-entity-linking-service.md) |
| **ADR-013** | Enterprise Card System (Atomic Design) | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-013-enterprise-card-system-atomic-design.md) |
| **ADR-014** | Navigation Entity Icons Centralization | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-014-navigation-entity-icons-centralization.md) |
| **ADR-015** | Entity List Column Container | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-015-entity-list-column-container.md) |
| **ADR-016** | Navigation Breadcrumb Path System | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-016-navigation-breadcrumb-path-system.md) |
| **ADR-017** | Enterprise ID Generation | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-017-enterprise-id-generation.md) |
| **ADR-018** | Unified Upload Service | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-018-unified-upload-service.md) |
| **ADR-019** | Centralized Performance Thresholds | ✅ APPROVED | 2026-01-01 | Performance | [📄](./adrs/ADR-019-centralized-performance-thresholds.md) |
| **ADR-020** | Centralized Auth Module | ✅ APPROVED | 2026-01-01 | Security & Auth | [📄](./adrs/ADR-020-centralized-auth-module.md) |
| **ADR-023** | Centralized Spinner Component | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-023-centralized-spinner-component.md) |
| **ADR-024** | Environment Security Configuration | ✅ APPROVED | 2026-01-01 | Security & Auth | [📄](./adrs/ADR-024-environment-security-configuration.md) |
| **ADR-025** | Property Linking System | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-025-unit-linking-system.md) |
| **ADR-026** | DXF Toolbar Colors System | ✅ APPROVED | 2026-01-01 | Tools & Keyboard | [📄](./adrs/ADR-026-dxf-toolbar-colors-system.md) |
| **ADR-027** | DXF Keyboard Shortcuts System | ✅ APPROVED | 2026-01-01 | Tools & Keyboard | [📄](./adrs/ADR-027-dxf-keyboard-shortcuts-system.md) |
| **ADR-028** | Button Component Consolidation | ✅ APPROVED | 2026-01-01 | Tools & Keyboard | [📄](./adrs/ADR-028-button-component-consolidation.md) |
| **ADR-029** | Canvas V2 Migration | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-029-canvas-v2-migration.md) |
| **ADR-029** | Global Search System v1 | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-029-global-search-system-v1.md) |
| **ADR-030** | Unified Frame Scheduler | ✅ APPROVED | 2026-02-01 | Performance | [📄](./adrs/ADR-030-unified-frame-scheduler.md) |
| **ADR-031** | Enterprise Command Pattern (Undo/Redo) | ✅ APPROVED | 2026-01-01 | Data & State | [📄](./adrs/ADR-031-enterprise-command-pattern-undo-redo.md) |
| **ADR-032** | Drawing State Machine | ✅ COMPLETED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-032-drawing-state-machine.md) |
| **ADR-034** | EMPTY_SPATIAL_BOUNDS Consolidation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-034-empty-spatial-bounds-centralization.md) |
| **ADR-034** | Gantt Chart - Construction Phase Tracking | ✅ IMPLEMENTED - Phase 1+2+3 Complete, Phase 4 Partial (4.4 Export + 4.9 Context Menu) | 2026-02-07 | UI Components / Construction Management | [📄](./adrs/ADR-034-gantt-chart-construction-tracking.md) |
| **ADR-034** | Validation Bounds Centralization | ✅ IMPLEMENTED | 2026-02-01 | Data & State | [📄](./adrs/ADR-034-validation-bounds-centralization.md) |
| **ADR-035** | Tool Overlay Mode Metadata | ✅ APPROVED | 2026-01-01 | Tools & Keyboard | [📄](./adrs/ADR-035-tool-overlay-mode-metadata.md) |
| **ADR-036** | Enterprise Structured Logging | ✅ APPROVED | 2026-01-01 | Performance | [📄](./adrs/ADR-036-enterprise-structured-logging.md) |
| **ADR-037** | Product Tour System | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-037-product-tour-system.md) |
| **ADR-038** | Centralized Tool Detection Functions | ✅ APPROVED | 2026-01-01 | Tools & Keyboard | [📄](./adrs/ADR-038-centralized-tool-detection-functions.md) |
| **ADR-040** | Preview Canvas Performance | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-040-preview-canvas-performance.md) |
| **ADR-041** | Distance Label Centralization | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-041-distance-label-centralization.md) |
| **ADR-042** | UI Fonts Centralization | ✅ APPROVED | 2026-01-01 | Design System | [📄](./adrs/ADR-042-ui-fonts-centralization.md) |
| **ADR-043** | Zoom Constants Consolidation | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-043-zoom-constants-consolidation.md) |
| **ADR-044** | Canvas Line Widths Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-044-canvas-line-widths-centralization.md) |
| **ADR-045** | Viewport Ready Guard | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-045-viewport-ready-guard.md) |
| **ADR-046** | Single Coordinate Transform | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-046-single-coordinate-transform.md) |
| **ADR-047** | Close Polygon on First-Point Click | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-047-close-polygon-on-first-point-click.md) |
| **ADR-048** | Unified Grip Rendering System | ✅ IMPLEMENTED | 2027-01-27 | Drawing System | [📄](./adrs/ADR-048-unified-grip-rendering.md) |
| **ADR-049** | Unified Move Tool (DXF + Overlays) | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-049-unified-move-tool-dxf-overlays.md) |
| **ADR-050** | Unified Toolbar Integration | ✅ APPROVED | 2026-01-01 | UI Components | [📄](./adrs/ADR-050-unified-toolbar-integration.md) |
| **ADR-051** | Enterprise Filter System Centralization | ✅ APPROVED | 2026-01-01 | Filters & Search | [📄](./adrs/ADR-051-enterprise-filter-system-centralization.md) |
| **ADR-052** | DXF Export API Contract | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-052-dxf-export-api-contract.md) |
| **ADR-053** | Drawing Context Menu | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-053-drawing-context-menu.md) |
| **ADR-054** | Enterprise Upload System Consolidation | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-054-enterprise-upload-system-consolidation.md) |
| **ADR-055** | Centralized Tool State Persistence | ✅ APPROVED | 2026-01-01 | Tools & Keyboard | [📄](./adrs/ADR-055-centralized-tool-state-persistence.md) |
| **ADR-056** | Centralized Entity Completion Styles | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-056-centralized-entity-completion-styles.md) |
| **ADR-057** | Unified Entity Completion Pipeline | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-057-unified-entity-completion-pipeline.md) |
| **ADR-058** | Canvas Drawing Primitives (Arc via Ellipse) | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-058-canvas-drawing-primitives-arc-via-ellipse.md) |
| **ADR-059** | Separate /api/projects/bootstrap from /api/projects/list | ✅ ✅ Active | 2026-01-11 | Backend Systems | [📄](./adrs/ADR-059-separate-audit-bootstrap-from-projects-list.md) |
| **ADR-060** | Migrate BuildingFloorplanService to Enterprise Storage Architecture | ✅ ✅ Active | 2026-01-11 | Backend Systems | [📄](./adrs/ADR-060-building-floorplan-enterprise-storage.md) |
| **ADR-061** | Path Aliases Strategy | ✅ ✅ Active | 2026-01-13 | Infrastructure | [📄](./adrs/ADR-061-path-aliases.md) |
| **ADR-062** | No Debug/Admin Analysis Endpoints in Production | ✅ ✅ Active | 2026-01-17 | Security & Auth | [📄](./adrs/ADR-062-no-debug-endpoints-in-production.md) |
| **ADR-063** | Company Isolation via Custom Claims | ✅ ✅ Active | 2026-01-18 | Security & Auth | [📄](./adrs/ADR-063-company-isolation-custom-claims.md) |
| **ADR-064** | Shape Primitives Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-064-shape-primitives-centralization.md) |
| **ADR-065** | Inline ID Generation Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-065-inline-id-generation-centralization.md) |
| **ADR-066** | Rendering Z-Index Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-066-rendering-zindex-centralization.md) |
| **ADR-067** | FillText Offset Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-067-filltext-offset-centralization.md) |
| **ADR-068** | API Rate Limiting System | ✅ APPROVED | 2026-02-06 | Security & Auth | [📄](./adrs/ADR-068-api-rate-limiting-system.md) |
| **ADR-069** | Number Formatting Centralization (formatDistance/formatAngle) | ✅ APPROVED | 2026-01-01 | Data & State | [📄](./adrs/ADR-069-number-formatting-centralization-formatdistance-fo.md) |
| **ADR-070** | Email & AI Ingestion System | ✅ ✅ FULLY OPERATIONAL (OpenAI Active) | 2026-02-05 | Backend Systems | [📄](./adrs/ADR-070-email-ai-ingestion-system.md) |
| **ADR-071** | Enterprise Email Webhook Queue System | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-071-enterprise-email-webhook-queue.md) |
| **ADR-072** | AI Inbox HTML Rendering with Enterprise Sanitization | ✅ IMPLEMENTED | 2026-02-05 | Security & Auth | [📄](./adrs/ADR-072-ai-inbox-html-rendering.md) |
| **ADR-073** | Firestore Composite Index Strategy | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-073-firestore-indexes-strategy.md) |
| **ADR-074** | AI Inbox UX Improvements - Link Visibility & Theme Colors | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-074-ai-inbox-ux-improvements.md) |
| **ADR-075** | Grip Size Multipliers Centralization | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-075-grip-size-multipliers-centralization.md) |
| **ADR-076** | RGB ↔ HEX Color Conversion Centralization | ✅ APPROVED | 2026-02-01 | Data & State | [📄](./adrs/ADR-076-rgb-hex-color-conversion-centralization.md) |
| **ADR-077** | Firebase Admin SDK — Unified Lazy Initialization | ✅ IMPLEMENTED | 2026-02-06 | Infrastructure & SDK | [📄](./adrs/ADR-077-firebase-admin-unified-lazy-init.md) |
| **ADR-078** | Server-Side Property Creation via Admin SDK | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-078-server-side-unit-creation.md) |
| **ADR-079** | AI Inbox Real-Time Updates via Firestore onSnapshot | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-079-ai-inbox-realtime-updates.md) |
| **ADR-080** | Universal AI Pipeline — Phase 1 Implementation | ✅ IMPLEMENTED | 2026-02-07 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-080-ai-pipeline-implementation.md) |
| **ADR-081** | Percentage Formatting Centralization (formatPercent) | ✅ APPROVED | 2026-01-01 | Data & State | [📄](./adrs/ADR-081-percentage-formatting-centralization-formatpercent.md) |
| **ADR-082** | Enterprise Number Formatting System (AutoCAD-Grade) | ✅ APPROVED | 2026-01-01 | Data & State | [📄](./adrs/ADR-082-enterprise-number-formatting-system-autocad-grade.md) |
| **ADR-083** | Line Dash Patterns Centralization | ✅ APPROVED | 2026-01-31 | Canvas & Rendering | [📄](./adrs/ADR-083-line-dash-patterns-centralization.md) |
| **ADR-084** | Scattered Code Centralization (Draggable + Canvas State) | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-084-scattered-code-centralization-draggable-canvas-sta.md) |
| **ADR-085** | Split Line Rendering Centralization | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-085-split-line-rendering-centralization.md) |
| **ADR-086** | Hover Utilities Scattered Code Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-086-hover-utilities-scattered-code-centralization.md) |
| **ADR-087** | Snap Engine Configuration Centralization | ✅ APPROVED | 2026-01-01 | Data & State | [📄](./adrs/ADR-087-snap-engine-configuration-centralization.md) |
| **ADR-088** | Pixel-Perfect Rendering Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-088-pixel-perfect-rendering-centralization.md) |
| **ADR-089** | CRM Calendar System | ✅ IMPLEMENTED | 2026-02-08 | UI Components / CRM | [📄](./adrs/ADR-089-crm-calendar-system.md) |
| **ADR-090** | IKA/EFKA Labor Compliance System | ✅ IMPLEMENTED - Phase 1 + Phase 2 + Phase 3 + Phase 4A + Phase 5 (EFKA Settings) Complete | 2026-02-09 | Backend Systems / Labor Compliance | [📄](./adrs/ADR-090-ika-efka-labor-compliance-system.md) |
| **ADR-091** | Scattered Code Centralization (Fonts + Formatting) | ✅ APPROVED | 2026-01-01 | Design System | [📄](./adrs/ADR-091-scattered-code-centralization-fonts-formatting.md) |
| **ADR-092** | Centralized localStorage Service | ✅ APPROVED | 2026-01-01 | Infrastructure | [📄](./adrs/ADR-092-centralized-localstorage-service.md) |
| **ADR-093** | Text Label Offsets Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-093-text-label-offsets-centralization.md) |
| **ADR-094** | Device Pixel Ratio Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-094-device-pixel-ratio-centralization.md) |
| **ADR-095** | Snap Tolerance Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-095-snap-tolerance-centralization.md) |
| **ADR-096** | Interaction Timing Constants Centralization | ✅ APPROVED | 2026-01-31 | Tools & Keyboard | [📄](./adrs/ADR-096-interaction-timing-constants-centralization.md) |
| **ADR-098** | Timing Delays Centralization (setTimeout/setInterval) | ✅ APPROVED | 2026-01-31 | Tools & Keyboard | [📄](./adrs/ADR-098-timing-delays-centralization-settimeout-setinterva.md) |
| **ADR-099** | Polygon & Measurement Tolerances Centralization | ✅ APPROVED | 2026-01-31 | Drawing System | [📄](./adrs/ADR-099-polygon-measurement-tolerances-centralization.md) |
| **ADR-100** | JIT User Profile Sync (Firestore /users/{uid}) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-100-user-profile-sync.md) |
| **ADR-101** | Deep Clone Centralization | ✅ APPROVED | 2026-01-31 | Data & State | [📄](./adrs/ADR-101-deep-clone-centralization.md) |
| **ADR-102** | Origin Markers Centralization (DXF/Layer/Debug) | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-102-origin-markers-centralization-dxf-layer-debug.md) |
| **ADR-103** | Availability Check & AI Operator Briefing | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-103-availability-check-operator-briefing.md) |
| **ADR-104** | Entity Type Guards Centralization | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-104-entity-type-guards-centralization.md) |
| **ADR-105** | Hit Test Fallback Tolerance Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-105-hit-test-fallback-tolerance-centralization.md) |
| **ADR-106** | Edge Grip Size Multipliers Centralization | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-106-edge-grip-size-multipliers-centralization.md) |
| **ADR-107** | UI Size Defaults Centralization (|| 10 / ?? 10 / || 8 / || 3) | ✅ APPROVED | 2026-01-01 | Design System | [📄](./adrs/ADR-107-ui-size-defaults-centralization-10-10-8-3.md) |
| **ADR-108** | Text Metrics Ratios Centralization | ✅ APPROVED | 2026-01-31 | Data & State | [📄](./adrs/ADR-108-text-metrics-ratios-centralization.md) |
| **ADR-115** | Canvas Context Setup Standardization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-115-canvas-context-setup-standardization.md) |
| **ADR-117** | DPI-Aware Pixel Calculations Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-117-dpi-aware-pixel-calculations-centralization.md) |
| **ADR-119** | RAF Consolidation to UnifiedFrameScheduler | ✅ IMPLEMENTED | 2026-02-01 | Performance | [📄](./adrs/ADR-119-raf-consolidation-to-unifiedframescheduler.md) |
| **ADR-120** | Canvas globalAlpha Opacity Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-120-canvas-globalalpha-opacity-centralization.md) |
| **ADR-121** | Contact Persona System — Role-Based Dynamic Fields | ✅ IMPLEMENTED | 2026-02-08 | Contact Management / CRM | [📄](./adrs/ADR-121-contact-persona-system.md) |
| **ADR-123** | PreviewRenderer Color Centralization (hex → UI_COLORS) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-123-previewrenderer-color-centralization-hex-ui-colors.md) |
| **ADR-124** | Renderer Constants Centralization (DOT_RADIUS, TEXT_GAP, CIRCLE_LABEL) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-124-renderer-constants-centralization-dot-radius-text-.md) |
| **ADR-125** | Context Creation Pattern (Provider Colocation) | ✅ APPROVED | 2026-02-01 | Data & State | [📄](./adrs/ADR-125-context-creation-pattern-provider-colocation.md) |
| **ADR-127** | Ruler Dimensions Centralization (DEFAULT_RULER_HEIGHT/WIDTH) | ✅ APPROVED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-127-ruler-dimensions-centralization-default-ruler-heig.md) |
| **ADR-128** | Switch Status Variant (Green ON / Red OFF) | ✅ APPROVED | 2026-02-01 | UI Components | [📄](./adrs/ADR-128-switch-status-variant-green-on-red-off.md) |
| **ADR-129** | Layer Entity Filtering Centralization | ✅ IMPLEMENTED | 2026-02-01 | Entity Systems | [📄](./adrs/ADR-129-layer-entity-filtering-centralization.md) |
| **ADR-130** | Default Layer Name Centralization | ✅ IMPLEMENTED | 2026-02-01 | Entity Systems | [📄](./adrs/ADR-130-default-layer-name-centralization.md) |
| **ADR-131** | Multi-Intent Pipeline — Πολλαπλά Intents σε Ένα Μήνυμα | ✅ ✅ IMPLEMENTED | 2026-02-09 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-131-multi-intent-pipeline.md) |
| **ADR-132** | ESCO Professional Classification Integration (Occupations + Skills) | ✅ IMPLEMENTED | 2026-02-09 | Contact Management / CRM | [📄](./adrs/ADR-132-esco-professional-classification.md) |
| **ADR-133** | SVG Stroke Width Centralization | ✅ IMPLEMENTED | 2026-02-01 | Design System | [📄](./adrs/ADR-133-svg-stroke-width-centralization.md) |
| **ADR-134** | UC Modules Expansion + Telegram Channel — Omnichannel AI Pipeline | ✅ ✅ IMPLEMENTED | 2026-02-09 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-134-uc-modules-expansion-telegram-channel.md) |
| **ADR-135** | Menu Icons Centralization | ✅ IMPLEMENTED | 2026-02-01 | UI Components | [📄](./adrs/ADR-135-menu-icons-centralization.md) |
| **ADR-136** | Canvas Opacity Constants Centralization (Extended) | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-136-canvas-opacity-constants-centralization-extended.md) |
| **ADR-137** | Snap Icon Geometry Centralization | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-137-snap-icon-geometry-centralization.md) |
| **ADR-138** | Overlay Dimensions Centralization | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-138-overlay-dimensions-centralization.md) |
| **ADR-139** | Label Box Dimensions Centralization | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-139-label-box-dimensions-centralization.md) |
| **ADR-140** | Angle Measurement Visualization Constants | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-140-angle-measurement-visualization-constants.md) |
| **ADR-143** | Origin/Cursor Offset Constants Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-143-origin-cursor-offset-constants-centralization.md) |
| **ADR-144** | Icon Click Sequence Colors Centralization | ✅ IMPLEMENTED | 2026-02-01 | UI Components | [📄](./adrs/ADR-144-icon-click-sequence-colors-centralization.md) |
| **ADR-145** | PropertyType SSoT Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-145-property-types-ssot.md) |
| **ADR-145** | Super Admin AI Assistant — Omnichannel Admin Command System | ✅ ✅ IMPLEMENTED | 2026-02-09 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-145-super-admin-ai-assistant.md) |
| **ADR-146** | Canvas Size Observer Hook Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-146-canvas-size-observer-hook-centralization.md) |
| **ADR-150** | Arrow Head Size Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-150-arrow-head-size-centralization.md) |
| **ADR-151** | Grip Tolerance Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-151-grip-tolerance-centralization.md) |
| **ADR-152** | Simple Coordinate Transform Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-152-simple-coordinate-transform-centralization.md) |
| **ADR-153** | Snap Tooltip Offset Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-153-snap-tooltip-offset-centralization.md) |
| **ADR-154** | Grip Line Width Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-154-grip-line-width-centralization.md) |
| **ADR-156** | Centralization Gap Audit — Εκκρεμείς Κεντρικοποιήσεις | ✅ APPROVED — Audit Complete, Remediation Pending | 2026-03-12 | Architecture / Code Quality | [📄](./adrs/ADR-156-centralization-gap-audit.md) |
| **ADR-156** | Voice Message Transcription (OpenAI Whisper) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-156-voice-message-transcription-whisper.md) |
| **ADR-158** | Origin Axis Label Offsets Centralization (X/Y axis labels) | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-158-origin-axis-label-offsets-centralization-x-y-axis-.md) |
| **ADR-159** | Measurement Text Colors Separation (ANGLE vs DISTANCE) | ✅ IMPLEMENTED | 2026-02-01 | Drawing System | [📄](./adrs/ADR-159-measurement-text-colors-separation-angle-vs-distan.md) |
| **ADR-160** | Internal Angle Arc Rendering (dot product logic) | ✅ IMPLEMENTED | 2026-02-01 | Drawing System | [📄](./adrs/ADR-160-internal-angle-arc-rendering-dot-product-logic.md) |
| **ADR-161** | Global Voice Assistant (Header Microphone) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-161-global-voice-assistant.md) |
| **ADR-161** | Σταδιακή Κεντρικοποίηση Διάσπαρτου Κώδικα | ✅ ✅ IMPLEMENTED | 2026-03-12 | Data & State / UI Components | [📄](./adrs/ADR-161-scattered-code-centralization.md) |
| **ADR-164** | In-App Voice AI Pipeline — Right-Side Chat Panel | ✅ Implemented | 2026-02-09 | AI Pipeline / Voice / UX | [📄](./adrs/ADR-164-in-app-voice-ai-pipeline.md) |
| **ADR-165** | Entity Validation Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-165-entity-validation-centralization.md) |
| **ADR-166** | GAP_TOLERANCE, ARC_TESSELLATION & Ghost Colors Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-166-gap-tolerance-arc-ghost-centralization.md) |
| **ADR-167** | Enterprise Project Address System | ✅ ✅ APPROVED | 2026-02-02 | Entity Systems | [📄](./adrs/ADR-167-enterprise-project-address-system.md) |
| **ADR-168** | Multi-Agent Development Environment | ✅ IMPLEMENTED | 2026-02-05 | Infrastructure | [📄](./adrs/ADR-168-multi-agent-development-environment.md) |
| **ADR-169** | Modular AI Architecture - Enterprise Automation Platform | ✅ DRAFT - Requirements Gathering | 2026-02-07 | AI Architecture / Enterprise Automation | [📄](./adrs/ADR-169-modular-ai-architecture.md) |
| **ADR-170** | Construction Worker Attendance — QR Code + GPS Geofencing + Photo Verification | ✅ Accepted | 2026-02-09 | Uncategorized | [📄](./adrs/ADR-170-attendance-qr-gps-verification.md) |
| **ADR-171** | Autonomous AI Agent with Agentic Tool Calling | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-171-autonomous-ai-agent.md) |
| **ADR-172** | Pre-Production Code Quality Audit & Remediation | ✅ PHASE_3_COMPLETE | 2026-02-10 | Security & Code Quality / Infrastructure | [📄](./adrs/ADR-172-pre-production-audit-remediation.md) |
| **ADR-173** | Enterprise AI Self-Improvement System | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-173-ai-self-improvement-system.md) |
| **ADR-174** | Meta Omnichannel Integration — WhatsApp + Messenger + Instagram | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-174-meta-omnichannel-whatsapp-messenger-instagram.md) |
| **ADR-175** | Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-175-quantity-surveying-measurements-system.md) |
| **ADR-176** | DXF Viewer Mobile Responsive Refactoring | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-176-dxf-viewer-mobile-responsive.md) |
| **ADR-177** | Employer Picker — Entity Linking with Company Contacts | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-177-employer-picker-entity-linking.md) |
| **ADR-178** | Contact Relationship Auto-Save UX (PendingRelationshipGuard) | ✅ IMPLEMENTED | 2026-02-13 | UX / Contact Relationships | [📄](./adrs/ADR-178-contact-relationship-auto-save-ux.md) |
| **ADR-178** | GeoCanvas Mobile Responsive Remediation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-178-geocanvas-mobile-responsive.md) |
| **ADR-179** | IFC-Compliant Floor Plan Import Hierarchy | ✅ ✅ IMPLEMENTED | 2026-02-14 | DXF Viewer / Import | [📄](./adrs/ADR-179-ifc-compliant-floorplan-hierarchy.md) |
| **ADR-180** | Hybrid Navigation — Dashboard Home με Navigation Tiles | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-180-hybrid-navigation-dashboard-tiles.md) |
| **ADR-018.1** | Photos Tab Base Template | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-018-1-photos-tab-base-template.md) |
| **ADR-181** | IFC-Compliant Floor Management System | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-181-ifc-floor-management-system.md) |
| **ADR-182** | Parking & Storage Hierarchy Audit | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-182-parking-storage-hierarchy-audit.md) |
| **ADR-183** | Unified Grip System — Ενοποίηση DXF + Overlay Grip Interaction | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-183-unified-grip-system.md) |
| **ADR-184** | Building Spaces Tabs (Storage, Parking, Units) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-184-building-spaces-tabs.md) |
| **ADR-185** | AI-Powered DXF Drawing Assistant | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-185-ai-powered-dxf-drawing-assistant.md) |
| **ADR-186** | Building Code Module — Modular Κανονισμός Δόμησης (ΝΟΚ) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-186-building-code-nok-module.md) |
| **ADR-186** | Entity Join System — AutoCAD JOIN Semantics | ✅ IMPLEMENTED | 2026-02-17 | DXF Viewer / Entity Operations | [📄](./adrs/ADR-186-entity-join-system.md) |
| **ADR-187** | Floor-Level Floorplans (IFC-Compliant) | ✅ Accepted | 2026-02-19 | Architecture / Building Management | [📄](./adrs/ADR-187-floor-level-floorplans.md) |
| **ADR-188** | Angle Measurement Variants — Line-Arc, Two-Arcs, MeasureGeom, Constraint | ✅ Accepted | 2026-02-19 | DXF Viewer / Measurement System | [📄](./adrs/ADR-188-angle-measurement-variants.md) |
| **ADR-188** | Entity Rotation System — DXF Viewer | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-188-entity-rotation-system.md) |
| **ADR-189** | Construction Grid & Guide System (Κάνναβος & Οδηγοί) | ✅ ALL COMMANDS COMPLETE ✅ + Phase 2 Enhancements (31): B1 Bubbles ✅, B2 Auto Grid ✅, B3 Dimensions ✅, B4 Lock ✅, B5 Drag ✅, B6 Colors ✅, B7 Groups ✅, B8 Guide from Entity ✅, B9 Polar Start Angle ✅, B11 Info Panel ✅, B12 Snap Midpoint ✅, B13 Keyboard Shortcuts ✅, B14 Multi-select ✅, B15 Toggle Visibility ✅, B16 Guide at Angle ✅, B17 Copy/Offset Pattern ✅, B19 Mirror ✅, B20 Undo/Redo ✅, B22 Context Menu ✅, B23 Structural Presets ✅, B24 Offset from Entity ✅, B28 Rotation ✅, B29 Rotate Group ✅, B30 Rotate All ✅, B31 Polar Array ✅, B32 Scale Grid ✅, B33 Equalize ✅, B35 Construction Line ✅, B36 Measure→Guide ✅, B37 Guide from Selection ✅, B38 Custom Labels ✅. 14/14 commands + 31 enhancements. | 2026-02-22 | Uncategorized | [📄](./adrs/ADR-189-construction-grid-guide-system.md) |
| **ADR-190** | Photo/Logo Upload System — SSoT Consolidation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-190-photo-upload-ssot-consolidation.md) |
| **ADR-191** | Enterprise Document Management System | ✅ PHASES_1-5_COMPLETE | 2026-03-09 | File Management / Document Governance | [📄](./adrs/ADR-191-enterprise-document-management.md) |
| **ADR-191** | Ιεραρχικό Σύστημα Upload Μελετών Οικοδομικής Άδειας | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-191-hierarchical-study-upload.md) |
| **ADR-192** | Master-Detail Navigation — Building Space Tabs | ✅ ✅ ACCEPTED | 2026-03-10 | UI / Navigation / Building Management | [📄](./adrs/ADR-192-master-detail-navigation.md) |
| **ADR-193** | Εμφάνιση Πεδίων ανά Domain — Χώροι vs Πωλήσεις | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-193-field-display-domain-separation.md) |
| **ADR-194** | Info Tab Section Consistency — Unified Section Order | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-194-info-tab-section-consistency.md) |
| **ADR-195** | Entity Audit Trail — Κεντρικοποιημένο Σύστημα Ιστορικού Αλλαγών | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-195-entity-audit-trail.md) |
| **ADR-196** | Unit Floorplan Enterprise FileRecord Migration | ✅ ✅ IMPLEMENTED | 2026-03-10 | Backend Systems / File Management | [📄](./adrs/ADR-196-unit-floorplan-enterprise-filerecord.md) |
| **ADR-197** | Sales Pages Implementation Plan | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-197-sales-pages-implementation-plan.md) |
| **ADR-198** | Sales-to-Accounting Bridge (Transaction Chain Pattern) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-198-sales-accounting-bridge.md) |
| **ADR-199** | Παρακολουθήματα Πωλήσεων (Parking & Storage as Sale Appurtenances) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-199-sales-appurtenances.md) |
| **ADR-200** | useEntityLink Hook — Centralized Entity Linking | ✅ Accepted | 2026-03-12 | Uncategorized | [📄](./adrs/ADR-200-useEntityLink-hook.md) |
| **ADR-200** | Utility Hooks Centralization (Phase 2) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-200-utility-hooks-centralization.md) |
| **ADR-020.1** | Conditional App Shell Layout | ✅ APPROVED | 2026-01-01 | Security & Auth | [📄](./adrs/ADR-020-1-conditional-app-shell-layout.md) |
| **ADR-201** | Centralized CompanyId Resolution | ✅ ✅ APPROVED | 2026-03-12 | Backend Systems / Multi-Tenant | [📄](./adrs/ADR-201-company-id-resolver.md) |
| **ADR-202** | Floorplan Save Orchestrator | ✅ ✅ APPROVED | 2026-03-12 | Backend Systems / File Storage | [📄](./adrs/ADR-202-floorplan-save-orchestrator.md) |
| **ADR-203** | Entity Page State Centralization | ✅ ✅ IMPLEMENTED | 2026-03-12 | Data & State / Hooks | [📄](./adrs/ADR-203-entity-page-state-centralization.md) |
| **ADR-204** | Scattered Code Centralization — Phase 3 | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-204-phase3-escape-routes-storage.md) |
| **ADR-205** | Scattered Code Centralization — Phase 4 | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-205-phase4-useInterval-useSortState-truncateText.md) |
| **ADR-206** | Scattered Code Centralization — Phase 5 | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-206-phase5-enterprise-id-debounce-filesize.md) |
| **ADR-207** | Scattered Code Centralization — Phase 6 (Collection Utilities) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-207-phase6-collection-utilities.md) |
| **ADR-208** | Phase 7 — Date Formatting Deduplication | ✅ ✅ Implemented | 2026-01-01 | Centralization / Deduplication | [📄](./adrs/ADR-208-phase7-date-formatting-dedup.md) |
| **ADR-209** | ID Consistency Audit & Remediation Roadmap | ✅ ✅ IMPLEMENTED (Phases 1-4) | 2026-03-12 | Security / Data Integrity | [📄](./adrs/ADR-209-id-consistency-audit.md) |
| **ADR-210** | Document ID Generation — Full Codebase Audit & Compliance Report | ✅ ✅ APPROVED — Phase 1 + P1/P2 + Phase 3 + Phase 4 IMPLEMENTED | 2026-03-17 (updated) | Security / Data Integrity | [📄](./adrs/ADR-210-document-id-generation-audit.md) |
| **ADR-211** | Phase 8 — Small Utility Deduplication | ✅ ✅ Implemented | 2026-03-12 | Centralization / Deduplication | [📄](./adrs/ADR-211-phase8-small-utility-dedup.md) |
| **ADR-212** | Phase 9 — Async/Clone/Validation/FileSize/Currency Deduplication | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-212-phase9-async-clone-url-filesize.md) |
| **ADR-213** | Validation Centralization (Phone + Text Extraction) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-213-validation-centralization.md) |
| **ADR-214** | Firestore Query Centralization | ✅ ✅ COMPLETED — All 11 Phases Done | 2026-03-12 | Data Access Layer | [📄](./adrs/ADR-214-firestore-query-centralization.md) |
| **ADR-215** | Phase 10 — chunkArray/isRecord/formatBytes/formatDate/formatCurrency Deduplication | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-215-phase10-chunk-typeguards-formatters.md) |
| **ADR-216** | formatCurrency Centralization — 0% → 100% Adoption | ✅ ✅ Implemented | 2026-03-12 | Centralization / Currency Formatting | [📄](./adrs/ADR-216-formatCurrency-centralization.md) |
| **ADR-217** | Phase 11 — Object Sanitization, Greek Text Normalization, Debounce Callback Deduplication | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-217-phase11-sanitize-greek-debounce.md) |
| **ADR-218** | Firestore Timestamp Conversion Centralization | ✅ Implemented | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-218-timestamp-conversion-centralization.md) |
| **ADR-219** | Notification/Toast System Consolidation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-219-notification-toast-consolidation.md) |
| **ADR-220** | Firestore Field Extractor Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-220-field-extractor-centralization.md) |
| **ADR-221** | Error Message Extraction Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-221-error-message-extraction.md) |
| **ADR-222** | console.error/warn → createModuleLogger Migration | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-222-console-to-logger-migration.md) |
| **ADR-223** | useAsyncData — Data Fetching Centralization | ✅ ✅ Implemented (Phase 1) | 2026-03-13 | Centralization / React Hooks | [📄](./adrs/ADR-223-use-async-data-centralization.md) |
| **ADR-224** | Safe JSON Parse Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-224-safe-json-parse-centralization.md) |
| **ADR-225** | Type Guards Centralization — `isNonEmptyString`, `isNonEmptyArray` | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-225-type-guards-centralization.md) |
| **ADR-226** | Centralized Deletion Guard — Referential Integrity Protection | ✅ IN PROGRESS (Phase 0-7 ✅, Phase 8 ✅ Company Identity Guard) | 2026-03-13 | Backend Systems / Data & State | [📄](./adrs/ADR-226-deletion-guard.md) |
| **ADR-227** | Real-Time Subscription Consolidation & Coverage Expansion | ✅ 🟢 Phases 1-3 Implemented — Phase 2 complete (10/10 hooks migrated) | 2026-03-13 | Data Access Layer / Real-Time Architecture | [📄](./adrs/ADR-227-realtime-subscription-consolidation.md) |
| **ADR-228** | Real-Time Event Bus Coverage Gap Analysis & Implementation Roadmap | ✅ ✅ All Tiers Implemented (100% Coverage) | 2026-03-14 | Data Access Layer / Real-Time Architecture | [📄](./adrs/ADR-228-realtime-event-coverage-gap-analysis.md) |
| **ADR-229** | Centralized Page Loading & Error States | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-229-centralized-page-loading-states.md) |
| **ADR-230** | Contract Workflow — Legal Process (Σύστημα Συμβολαίων / Νομική Διαδικασία Πώλησης) | ✅ IMPLEMENTED — All 5 phases completed (2026-03-14) | 2026-03-14 | Entity Systems | [📄](./adrs/ADR-230-contract-workflow-legal-process.md) |
| **ADR-231** | Cascade Entity Linking — Αυτόματη Διάδοση Ιεραρχίας | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-231-cascade-entity-linking.md) |
| **ADR-232** | Tenant Isolation vs Business Entity Link Separation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-232-tenant-company-separation.md) |
| **ADR-233** | Entity Coding System — Κωδικοποίηση Οντοτήτων | ✅ ✅ ACCEPTED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-233-entity-coding-system.md) |
| **ADR-234** | Payment Plan & Installment Tracking (Πρόγραμμα Αποπληρωμής Ακινήτου) | ✅ ✅ IMPLEMENTED — Phase 1 (SPEC-234D) + Phase 2 (SPEC-234C) + Phase 3 (SPEC-234A) | 2026-03-15 | Entity Systems / Sales & Finance | [📄](./adrs/ADR-234-payment-plan-installment-tracking.md) |
| **ADR-235** | Πίνακας Ποσοστών Συνιδιοκτησίας (Ownership Percentage Table) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-235-ownership-percentage-table.md) |
| **ADR-236** | Multi-Level Property Management (Πολυεπίπεδη Διαχείριση Ακινήτων) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-236-multi-level-property-management.md) |
| **ADR-237** | Polygon Overlay Bridge (DXF Viewer → Δημόσια Σελίδα Ακινήτων) | ✅ ✅ IMPLEMENTED (4/4 SPECs complete) | 2026-03-16 | Canvas & Rendering / Property Management | [📄](./adrs/ADR-237-polygon-overlay-bridge.md) |
| **ADR-238** | Entity Creation Centralization | ✅ PHASE 2 COMPLETE | 2026-03-17 | Entity Systems | [📄](./adrs/ADR-238-entity-creation-centralization.md) |
| **ADR-239** | Entity Linking Centralization | ✅ ✅ IMPLEMENTED | 2026-03-17 | Entity Systems | [📄](./adrs/ADR-239-entity-linking-centralization.md) |
| **ADR-240** | Floorplan Pipeline Unification — Wizard → ΚΑΤΟΨΗ ΟΡΟΦΟΥ | ✅ ✅ IMPLEMENTED | 2026-03-17 | Entity Systems / File Storage | [📄](./adrs/ADR-240-floorplan-pipeline-unification.md) |
| **ADR-241** | Fullscreen — Composition Architecture | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-241-fullscreen-container-centralization.md) |
| **ADR-242** | Smart Financial Intelligence Suite — Enterprise Features for InterestCostDialog | ✅ 🟡 IN PROGRESS — SPEC-242A✅ B✅ C✅ D✅ E🟡 | 2026-03-18 | Entity Systems / Sales & Finance | [📄](./adrs/ADR-242-smart-financial-intelligence-suite.md) |
| **ADR-243** | Custom Firestore MCP Server — Secure Database Access for Claude Code | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-243-firestore-mcp-server.md) |
| **ADR-244** | Πολλαπλοί Αγοραστές & Συνιδιοκτησία Ακινήτων | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-244-multi-buyer-co-ownership.md) |
| **ADR-244** | Role Management Admin Console | ✅ IMPLEMENTED (Phase A + Phase B) | 2026-03-19 | Security & Auth | [📄](./adrs/ADR-244-role-management-admin-console.md) |
| **ADR-245** | API Routes Centralization — Zero Hardcoded Endpoints | ✅ ✅ PHASE_C_COMPLETE — Scattered code eliminated. Route helpers centralized. N+1 batch resolved. | 2026-03-19 | Backend Systems / Infrastructure | [📄](./adrs/ADR-245-api-routes-centralization.md) |
| **ADR-246** | Καθολική Κεντρικοποίηση Firestore→API Mappers | ✅ APPROVED | 2026-03-19 | Data Access Layer / Entity Systems | [📄](./adrs/ADR-246-universal-firestore-mapper-centralization.md) |
| **ADR-247** | Entity Relationship Integrity Audit | ✅ IMPLEMENTED | 2026-03-19 | Entity Systems / Data Integrity | [📄](./adrs/ADR-247-entity-relationship-integrity-audit.md) |
| **ADR-248** | Centralized Auto-Save System (Google-Level) | ✅ IMPLEMENTED (Phase 1 + 2) | 2026-03-19 | UI / State Management / Data Persistence | [📄](./adrs/ADR-248-centralized-auto-save.md) |
| **ADR-249** | Comprehensive Server-Side Integrity Audit | ✅ DOCUMENTED | 2026-03-19 | Entity Systems / Data Integrity / Security | [📄](./adrs/ADR-249-comprehensive-server-integrity-audit.md) |
| **ADR-250** | Codebase Audit Findings — Security, Indexes, Centralization | ✅ PARTIALLY IMPLEMENTED (P0 fixes done) | 2026-03-19 | Infrastructure / Security / Data Integrity | [📄](./adrs/ADR-250-codebase-audit-findings.md) |
| **ADR-251** | Scattered Code Patterns Audit & Consolidation Roadmap | ✅ DOCUMENTED | 2026-03-19 | Uncategorized | [📄](./adrs/ADR-251-scattered-code-patterns-audit.md) |
| **ADR-252** | Comprehensive Security Audit | ✅ ✅ PHASE_3_IMPLEMENTED | 2026-03-19 | Security / Infrastructure | [📄](./adrs/ADR-252-comprehensive-security-audit.md) |
| **ADR-253** | Deep Security & Data Integrity Audit | ✅ ✅ IMPLEMENTED | 2026-03-20 | Security / Data Integrity | [📄](./adrs/ADR-253-deep-integrity-audit.md) |
| **ADR-254** | Monolithic Architecture Audit — Ευρήματα & Roadmap | ✅ ✅ PHASE 1+2 IMPLEMENTED | 2026-03-20 | Architecture / Performance | [📄](./adrs/ADR-254-monolithic-architecture-audit.md) |
| **ADR-255** | Security Hardening Phase 4 — Tenant Isolation, Validation, Audit Trail | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-255-security-hardening-phase-4.md) |
| **ADR-256** | Concurrency Conflict Analysis & Remediation Roadmap | ✅ DOCUMENTED | 2026-03-20 | Data & State / Security | [📄](./adrs/ADR-256-concurrency-conflict-analysis.md) |
| **ADR-257** | Customer AI Access Control (Buyer/Owner/Tenant) | ✅ DRAFT | 2026-03-23 | AI Architecture / RBAC / Security | [📄](./adrs/ADR-257-customer-ai-access-control.md) |
| **ADR-258** | Twin Architecture — Dynamic Overlay Coloring from Unit CommercialStatus | ✅ 📋 PLANNED | 2026-03-23 | Canvas & Rendering / Property Management / DXF Viewer | [📄](./adrs/ADR-258-twin-architecture-dynamic-overlay-coloring.md) |
| **ADR-259** | Production Readiness Audit — 6 Critical Findings | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-259-production-readiness-audit.md) |
| **ADR-260** | Καθολικός Κατάλογος Firestore Collections | ✅ ACTIVE | 2026-03-24 | Data & State | [📄](./adrs/ADR-260-firestore-collections-catalog.md) |
| **ADR-261** | Multi-Agent Orchestrator (Claude Agent SDK) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-261-multi-agent-orchestrator.md) |
| **ADR-262** | AI Agent Testing & Production Standards | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-262-ai-agent-testing-production-standards.md) |
| **ADR-263** | Telegram Bot Testing Playbook | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-263-telegram-bot-testing-playbook.md) |
| **ADR-264** | Document Preview Mode — AI Auto-Analysis for File-Only Messages | ✅ ✅ IMPLEMENTED | 2026-03-26 | AI Architecture | [📄](./adrs/ADR-264-document-preview-mode.md) |
| **ADR-265** | Enterprise Reports System — Research & Architecture | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-265-enterprise-reports-system.md) |
| **ADR-266** | Gantt & Construction Schedule Reports | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-266-gantt-construction-reports.md) |
| **ADR-267** | Lightweight Procurement Module — Purchase Orders & Material Tracking | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-267-lightweight-procurement-module.md) |
| **ADR-268** | Route Rename /audit to /projects | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-268-route-rename-audit-to-projects.md) |
| **ADR-269** | Unit to Property Rename — Naming Standardization | ✅ APPROVED | 2026-03-31 | Entity Systems | [📄](./adrs/ADR-269-unit-to-property-rename.md) |
| **ADR-277** | Address Impact Guard — Company Address Change/Delete Safety | ✅ ✅ IMPLEMENTED | 2026-04-01 | Backend Systems / Data Safety | [📄](./adrs/ADR-277-address-impact-guard.md) |
| **ADR-278** | Company Identity Field Guard | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-278-company-identity-field-guard.md) |
| **ADR-279** | Google-Grade i18n Governance & Localization Operating Model | ✅ ACTIVE | 2026-04-03 | Infrastructure / Data & State | [📄](./adrs/ADR-279-google-grade-i18n-governance.md) |
| **ADR-280** | i18n Namespace Splitting Implementation Plan | ✅ IMPLEMENTED | 2026-04-03 | Infrastructure / i18n | [📄](./adrs/ADR-280-i18n-namespace-splitting-plan.md) |
| **ADR-281** | SSOT Soft-Delete System — Google-Level Enterprise Trash Lifecycle | ✅ APPROVED | 2026-04-03 | Backend Systems / Data Safety / Entity Systems | [📄](./adrs/ADR-281-ssot-soft-delete-system.md) |
| **ADR-282** | Contact Persona Architecture Refactoring — Google-Level Redesign | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-282-contact-persona-architecture-refactoring.md) |
| **ADR-283** | Project Roles SSOT Refactoring | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-283-project-roles-ssot-refactoring.md) |
| **ADR-284** | Unit Creation Hierarchy Enforcement (Company → Project → Building → Floor → Unit) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-284-unit-creation-hierarchy-enforcement.md) |
| **ADR-285** | DXF Levels + cadFiles Tenant Scoping & Module Split | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-285-dxf-tenant-scoping-and-module-split.md) |
| **ADR-286** | DXF Level Creation Centralization (SSOT) | ✅ Accepted | 2026-04-05 | Entity Systems / DXF Viewer | [📄](./adrs/ADR-286-dxf-level-creation-centralization.md) |
| **ADR-287** | Enum SSoT Centralization (Batch 9) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-287-enum-ssot-centralization.md) |
| **ADR-288** | CAD File Metadata Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-288-cad-file-metadata-centralization.md) |
| **ADR-289** | DXF Overlay Item Centralization (SSOT API Gateway) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-289-dxf-overlay-item-centralization.md) |
| **ADR-290** | Building Creation SSoT Enforcement | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-290-building-creation-ssot-enforcement.md) |
| **ADR-291** | Notification Pattern Selection Strategy (Google Material Design 3) | ✅ APPROVED | 2026-04-05 | UI Components / Design System | [📄](./adrs/ADR-291-notification-pattern-selection-strategy.md) |
| **ADR-292** | Floorplan Upload Consolidation Map | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-292-floorplan-upload-consolidation-map.md) |
| **ADR-293** | File Naming & Storage Path SSoT Audit | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-293-file-naming-storage-path-ssot-audit.md) |
| **ADR-294** | SSoT Ratchet Enforcement System | ✅ ✅ IMPLEMENTED | 2026-04-08 | Code Quality / SSoT Enforcement | [📄](./adrs/ADR-294-ssot-ratchet-enforcement.md) |
| **ADR-295** | Multi-Channel Photo Sharing to CRM Contacts | ✅ ✅ IMPLEMENTED | 2026-04-09 | Omnichannel Communications | [📄](./adrs/ADR-295-multi-channel-photo-sharing.md) |
| **ADR-296** | i18n Hardcoded Greek Strings — Phased Cleanup | ✅ APPROVED | 2026-04-09 | Code Quality / i18n | [📄](../../../adrs/ADR-296-i18n-hardcoded-strings-cleanup.md) |
| **ADR-297** | Contact Dependency Registry — SSoT | ✅ ✅ IMPLEMENTED | 2026-04-09 | Data Architecture / SSoT Enforcement | [📄](../../../adrs/ADR-297-contact-dependency-ssot.md) |
| **ADR-UI-001** | Visual Primitive Ownership & Semantic Tokens | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-UI-001.md) |

---

## 📐 **DOMAIN - GEOMETRY**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-GEOMETRY** | Geometry & Math Operations | ✅ ACTIVE | [View](./adrs/ADR-GEOMETRY.md) |

---

## 🎨 **UI COMPONENTS**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-001** | Select/Dropdown Component | ✅ APPROVED | [View](./adrs/ADR-001-select-dropdown-component.md) |
| **ADR-003** | Floating Panel Compound Component | ✅ APPROVED | [View](./adrs/ADR-003-floating-panel-compound-component.md) |
| **ADR-013** | Enterprise Card System (Atomic Design) | ✅ APPROVED | [View](./adrs/ADR-013-enterprise-card-system-atomic-design.md) |
| **ADR-014** | Navigation Entity Icons Centralization | ✅ APPROVED | [View](./adrs/ADR-014-navigation-entity-icons-centralization.md) |
| **ADR-015** | Entity List Column Container | ✅ APPROVED | [View](./adrs/ADR-015-entity-list-column-container.md) |
| **ADR-016** | Navigation Breadcrumb Path System | ✅ APPROVED | [View](./adrs/ADR-016-navigation-breadcrumb-path-system.md) |
| **ADR-023** | Centralized Spinner Component | ✅ APPROVED | [View](./adrs/ADR-023-centralized-spinner-component.md) |
| **ADR-037** | Product Tour System | ✅ APPROVED | [View](./adrs/ADR-037-product-tour-system.md) |
| **ADR-050** | Unified Toolbar Integration | ✅ APPROVED | [View](./adrs/ADR-050-unified-toolbar-integration.md) |
| **ADR-128** | Switch Status Variant (Green ON / Red OFF) | ✅ APPROVED | [View](./adrs/ADR-128-switch-status-variant-green-on-red-off.md) |
| **ADR-135** | Menu Icons Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-135-menu-icons-centralization.md) |
| **ADR-144** | Icon Click Sequence Colors Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-144-icon-click-sequence-colors-centralization.md) |

---

## 🎨 **DESIGN SYSTEM**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-002** | Enterprise Z-Index Hierarchy | ✅ APPROVED | [View](./adrs/ADR-002-enterprise-z-index-hierarchy.md) |
| **ADR-004** | Canvas Theme System | ✅ APPROVED | [View](./adrs/ADR-004-canvas-theme-system.md) |
| **ADR-011** | FloatingPanel UI Styling System | ✅ APPROVED | [View](./adrs/ADR-011-floatingpanel-ui-styling-system.md) |
| **ADR-042** | UI Fonts Centralization | ✅ APPROVED | [View](./adrs/ADR-042-ui-fonts-centralization.md) |
| **ADR-091** | Scattered Code Centralization (Fonts + Formatting) | ✅ APPROVED | [View](./adrs/ADR-091-scattered-code-centralization-fonts-formatting.md) |
| **ADR-107** | UI Size Defaults Centralization (|| 10 / ?? 10 / || 8 / || 3) | ✅ APPROVED | [View](./adrs/ADR-107-ui-size-defaults-centralization-10-10-8-3.md) |
| **ADR-133** | SVG Stroke Width Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-133-svg-stroke-width-centralization.md) |

---

## 🖼️ **CANVAS & RENDERING**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-006** | Crosshair Overlay Consolidation | ✅ APPROVED | [View](./adrs/ADR-006-crosshair-overlay-consolidation.md) |
| **ADR-008** | CSS→Canvas Coordinate Contract | ✅ APPROVED | [View](./adrs/ADR-008-css-canvas-coordinate-contract.md) |
| **ADR-009** | Ruler Corner Box Interactive | ✅ APPROVED | [View](./adrs/ADR-009-ruler-corner-box-interactive.md) |
| **ADR-029** | Canvas V2 Migration | ✅ APPROVED | [View](./adrs/ADR-029-canvas-v2-migration.md) |
| **ADR-029** | Global Search System v1 | ✅ APPROVED | [View](./adrs/ADR-029-global-search-system-v1.md) |
| **ADR-043** | Zoom Constants Consolidation | ✅ APPROVED | [View](./adrs/ADR-043-zoom-constants-consolidation.md) |
| **ADR-044** | Canvas Line Widths Centralization | ✅ APPROVED | [View](./adrs/ADR-044-canvas-line-widths-centralization.md) |
| **ADR-045** | Viewport Ready Guard | ✅ APPROVED | [View](./adrs/ADR-045-viewport-ready-guard.md) |
| **ADR-046** | Single Coordinate Transform | ✅ APPROVED | [View](./adrs/ADR-046-single-coordinate-transform.md) |
| **ADR-058** | Canvas Drawing Primitives (Arc via Ellipse) | ✅ APPROVED | [View](./adrs/ADR-058-canvas-drawing-primitives-arc-via-ellipse.md) |
| **ADR-064** | Shape Primitives Centralization | ✅ APPROVED | [View](./adrs/ADR-064-shape-primitives-centralization.md) |
| **ADR-083** | Line Dash Patterns Centralization | ✅ APPROVED | [View](./adrs/ADR-083-line-dash-patterns-centralization.md) |
| **ADR-084** | Scattered Code Centralization (Draggable + Canvas State) | ✅ APPROVED | [View](./adrs/ADR-084-scattered-code-centralization-draggable-canvas-sta.md) |
| **ADR-086** | Hover Utilities Scattered Code Centralization | ✅ APPROVED | [View](./adrs/ADR-086-hover-utilities-scattered-code-centralization.md) |
| **ADR-088** | Pixel-Perfect Rendering Centralization | ✅ APPROVED | [View](./adrs/ADR-088-pixel-perfect-rendering-centralization.md) |
| **ADR-093** | Text Label Offsets Centralization | ✅ APPROVED | [View](./adrs/ADR-093-text-label-offsets-centralization.md) |
| **ADR-094** | Device Pixel Ratio Centralization | ✅ APPROVED | [View](./adrs/ADR-094-device-pixel-ratio-centralization.md) |
| **ADR-095** | Snap Tolerance Centralization | ✅ APPROVED | [View](./adrs/ADR-095-snap-tolerance-centralization.md) |
| **ADR-102** | Origin Markers Centralization (DXF/Layer/Debug) | ✅ APPROVED | [View](./adrs/ADR-102-origin-markers-centralization-dxf-layer-debug.md) |
| **ADR-105** | Hit Test Fallback Tolerance Centralization | ✅ APPROVED | [View](./adrs/ADR-105-hit-test-fallback-tolerance-centralization.md) |
| **ADR-115** | Canvas Context Setup Standardization | ✅ APPROVED | [View](./adrs/ADR-115-canvas-context-setup-standardization.md) |
| **ADR-117** | DPI-Aware Pixel Calculations Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-117-dpi-aware-pixel-calculations-centralization.md) |
| **ADR-120** | Canvas globalAlpha Opacity Centralization | ✅ APPROVED | [View](./adrs/ADR-120-canvas-globalalpha-opacity-centralization.md) |
| **ADR-123** | PreviewRenderer Color Centralization (hex → UI_COLORS) | ✅ APPROVED | [View](./adrs/ADR-123-previewrenderer-color-centralization-hex-ui-colors.md) |
| **ADR-124** | Renderer Constants Centralization (DOT_RADIUS, TEXT_GAP, CIRCLE_LABEL) | ✅ APPROVED | [View](./adrs/ADR-124-renderer-constants-centralization-dot-radius-text-.md) |
| **ADR-127** | Ruler Dimensions Centralization (DEFAULT_RULER_HEIGHT/WIDTH) | ✅ APPROVED | [View](./adrs/ADR-127-ruler-dimensions-centralization-default-ruler-heig.md) |
| **ADR-136** | Canvas Opacity Constants Centralization (Extended) | ✅ IMPLEMENTED | [View](./adrs/ADR-136-canvas-opacity-constants-centralization-extended.md) |
| **ADR-137** | Snap Icon Geometry Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-137-snap-icon-geometry-centralization.md) |
| **ADR-138** | Overlay Dimensions Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-138-overlay-dimensions-centralization.md) |
| **ADR-139** | Label Box Dimensions Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-139-label-box-dimensions-centralization.md) |
| **ADR-140** | Angle Measurement Visualization Constants | ✅ IMPLEMENTED | [View](./adrs/ADR-140-angle-measurement-visualization-constants.md) |
| **ADR-143** | Origin/Cursor Offset Constants Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-143-origin-cursor-offset-constants-centralization.md) |
| **ADR-146** | Canvas Size Observer Hook Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-146-canvas-size-observer-hook-centralization.md) |
| **ADR-150** | Arrow Head Size Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-150-arrow-head-size-centralization.md) |
| **ADR-151** | Grip Tolerance Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-151-grip-tolerance-centralization.md) |
| **ADR-152** | Simple Coordinate Transform Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-152-simple-coordinate-transform-centralization.md) |
| **ADR-153** | Snap Tooltip Offset Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-153-snap-tooltip-offset-centralization.md) |
| **ADR-154** | Grip Line Width Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-154-grip-line-width-centralization.md) |
| **ADR-158** | Origin Axis Label Offsets Centralization (X/Y axis labels) | ✅ IMPLEMENTED | [View](./adrs/ADR-158-origin-axis-label-offsets-centralization-x-y-axis-.md) |

---

## 📊 **DATA & STATE**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-010** | Panel Type Centralization | ✅ APPROVED | [View](./adrs/ADR-010-panel-type-centralization.md) |
| **ADR-031** | Enterprise Command Pattern (Undo/Redo) | ✅ APPROVED | [View](./adrs/ADR-031-enterprise-command-pattern-undo-redo.md) |
| **ADR-034** | Validation Bounds Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-034-validation-bounds-centralization.md) |
| **ADR-069** | Number Formatting Centralization (formatDistance/formatAngle) | ✅ APPROVED | [View](./adrs/ADR-069-number-formatting-centralization-formatdistance-fo.md) |
| **ADR-076** | RGB ↔ HEX Color Conversion Centralization | ✅ APPROVED | [View](./adrs/ADR-076-rgb-hex-color-conversion-centralization.md) |
| **ADR-081** | Percentage Formatting Centralization (formatPercent) | ✅ APPROVED | [View](./adrs/ADR-081-percentage-formatting-centralization-formatpercent.md) |
| **ADR-082** | Enterprise Number Formatting System (AutoCAD-Grade) | ✅ APPROVED | [View](./adrs/ADR-082-enterprise-number-formatting-system-autocad-grade.md) |
| **ADR-087** | Snap Engine Configuration Centralization | ✅ APPROVED | [View](./adrs/ADR-087-snap-engine-configuration-centralization.md) |
| **ADR-101** | Deep Clone Centralization | ✅ APPROVED | [View](./adrs/ADR-101-deep-clone-centralization.md) |
| **ADR-108** | Text Metrics Ratios Centralization | ✅ APPROVED | [View](./adrs/ADR-108-text-metrics-ratios-centralization.md) |
| **ADR-125** | Context Creation Pattern (Provider Colocation) | ✅ APPROVED | [View](./adrs/ADR-125-context-creation-pattern-provider-colocation.md) |
| **ADR-260** | Καθολικός Κατάλογος Firestore Collections | ✅ ACTIVE | [View](./adrs/ADR-260-firestore-collections-catalog.md) |

---

## ✏️ **DRAWING SYSTEM**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-005** | Line Drawing System | ✅ APPROVED | [View](./adrs/ADR-005-line-drawing-system.md) |
| **ADR-032** | Drawing State Machine | ✅ COMPLETED | [View](./adrs/ADR-032-drawing-state-machine.md) |
| **ADR-040** | Preview Canvas Performance | ✅ APPROVED | [View](./adrs/ADR-040-preview-canvas-performance.md) |
| **ADR-041** | Distance Label Centralization | ✅ APPROVED | [View](./adrs/ADR-041-distance-label-centralization.md) |
| **ADR-047** | Close Polygon on First-Point Click | ✅ APPROVED | [View](./adrs/ADR-047-close-polygon-on-first-point-click.md) |
| **ADR-048** | Unified Grip Rendering System | ✅ IMPLEMENTED | [View](./adrs/ADR-048-unified-grip-rendering.md) |
| **ADR-049** | Unified Move Tool (DXF + Overlays) | ✅ APPROVED | [View](./adrs/ADR-049-unified-move-tool-dxf-overlays.md) |
| **ADR-053** | Drawing Context Menu | ✅ APPROVED | [View](./adrs/ADR-053-drawing-context-menu.md) |
| **ADR-056** | Centralized Entity Completion Styles | ✅ APPROVED | [View](./adrs/ADR-056-centralized-entity-completion-styles.md) |
| **ADR-057** | Unified Entity Completion Pipeline | ✅ APPROVED | [View](./adrs/ADR-057-unified-entity-completion-pipeline.md) |
| **ADR-075** | Grip Size Multipliers Centralization | ✅ APPROVED | [View](./adrs/ADR-075-grip-size-multipliers-centralization.md) |
| **ADR-085** | Split Line Rendering Centralization | ✅ APPROVED | [View](./adrs/ADR-085-split-line-rendering-centralization.md) |
| **ADR-099** | Polygon & Measurement Tolerances Centralization | ✅ APPROVED | [View](./adrs/ADR-099-polygon-measurement-tolerances-centralization.md) |
| **ADR-106** | Edge Grip Size Multipliers Centralization | ✅ APPROVED | [View](./adrs/ADR-106-edge-grip-size-multipliers-centralization.md) |
| **ADR-159** | Measurement Text Colors Separation (ANGLE vs DISTANCE) | ✅ IMPLEMENTED | [View](./adrs/ADR-159-measurement-text-colors-separation-angle-vs-distan.md) |
| **ADR-160** | Internal Angle Arc Rendering (dot product logic) | ✅ IMPLEMENTED | [View](./adrs/ADR-160-internal-angle-arc-rendering-dot-product-logic.md) |

---

## 📂 **ENTITY SYSTEMS**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-012** | Entity Linking Service | ✅ APPROVED | [View](./adrs/ADR-012-entity-linking-service.md) |
| **ADR-017** | Enterprise ID Generation | ✅ APPROVED | [View](./adrs/ADR-017-enterprise-id-generation.md) |
| **ADR-018** | Unified Upload Service | ✅ APPROVED | [View](./adrs/ADR-018-unified-upload-service.md) |
| **ADR-025** | Property Linking System | ✅ APPROVED | [View](./adrs/ADR-025-unit-linking-system.md) |
| **ADR-052** | DXF Export API Contract | ✅ APPROVED | [View](./adrs/ADR-052-dxf-export-api-contract.md) |
| **ADR-054** | Enterprise Upload System Consolidation | ✅ APPROVED | [View](./adrs/ADR-054-enterprise-upload-system-consolidation.md) |
| **ADR-104** | Entity Type Guards Centralization | ✅ APPROVED | [View](./adrs/ADR-104-entity-type-guards-centralization.md) |
| **ADR-129** | Layer Entity Filtering Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-129-layer-entity-filtering-centralization.md) |
| **ADR-130** | Default Layer Name Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-130-default-layer-name-centralization.md) |
| **ADR-167** | Enterprise Project Address System | ✅ ✅ APPROVED | [View](./adrs/ADR-167-enterprise-project-address-system.md) |
| **ADR-018.1** | Photos Tab Base Template | ✅ APPROVED | [View](./adrs/ADR-018-1-photos-tab-base-template.md) |
| **ADR-230** | Contract Workflow — Legal Process (Σύστημα Συμβολαίων / Νομική Διαδικασία Πώλησης) | ✅ IMPLEMENTED — All 5 phases completed (2026-03-14) | [View](./adrs/ADR-230-contract-workflow-legal-process.md) |
| **ADR-233** | Entity Coding System — Κωδικοποίηση Οντοτήτων | ✅ ✅ ACCEPTED | [View](./adrs/ADR-233-entity-coding-system.md) |
| **ADR-238** | Entity Creation Centralization | ✅ PHASE 2 COMPLETE | [View](./adrs/ADR-238-entity-creation-centralization.md) |
| **ADR-239** | Entity Linking Centralization | ✅ ✅ IMPLEMENTED | [View](./adrs/ADR-239-entity-linking-centralization.md) |
| **ADR-269** | Unit to Property Rename — Naming Standardization | ✅ APPROVED | [View](./adrs/ADR-269-unit-to-property-rename.md) |

---

## 🔧 **TOOLS & KEYBOARD**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-026** | DXF Toolbar Colors System | ✅ APPROVED | [View](./adrs/ADR-026-dxf-toolbar-colors-system.md) |
| **ADR-027** | DXF Keyboard Shortcuts System | ✅ APPROVED | [View](./adrs/ADR-027-dxf-keyboard-shortcuts-system.md) |
| **ADR-028** | Button Component Consolidation | ✅ APPROVED | [View](./adrs/ADR-028-button-component-consolidation.md) |
| **ADR-035** | Tool Overlay Mode Metadata | ✅ APPROVED | [View](./adrs/ADR-035-tool-overlay-mode-metadata.md) |
| **ADR-038** | Centralized Tool Detection Functions | ✅ APPROVED | [View](./adrs/ADR-038-centralized-tool-detection-functions.md) |
| **ADR-055** | Centralized Tool State Persistence | ✅ APPROVED | [View](./adrs/ADR-055-centralized-tool-state-persistence.md) |
| **ADR-096** | Interaction Timing Constants Centralization | ✅ APPROVED | [View](./adrs/ADR-096-interaction-timing-constants-centralization.md) |
| **ADR-098** | Timing Delays Centralization (setTimeout/setInterval) | ✅ APPROVED | [View](./adrs/ADR-098-timing-delays-centralization-settimeout-setinterva.md) |

---

## 🔍 **FILTERS & SEARCH**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-051** | Enterprise Filter System Centralization | ✅ APPROVED | [View](./adrs/ADR-051-enterprise-filter-system-centralization.md) |

---

## 🔒 **SECURITY & AUTH**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-020** | Centralized Auth Module | ✅ APPROVED | [View](./adrs/ADR-020-centralized-auth-module.md) |
| **ADR-024** | Environment Security Configuration | ✅ APPROVED | [View](./adrs/ADR-024-environment-security-configuration.md) |
| **ADR-062** | No Debug/Admin Analysis Endpoints in Production | ✅ ✅ Active | [View](./adrs/ADR-062-no-debug-endpoints-in-production.md) |
| **ADR-063** | Company Isolation via Custom Claims | ✅ ✅ Active | [View](./adrs/ADR-063-company-isolation-custom-claims.md) |
| **ADR-068** | API Rate Limiting System | ✅ APPROVED | [View](./adrs/ADR-068-api-rate-limiting-system.md) |
| **ADR-072** | AI Inbox HTML Rendering with Enterprise Sanitization | ✅ IMPLEMENTED | [View](./adrs/ADR-072-ai-inbox-html-rendering.md) |
| **ADR-020.1** | Conditional App Shell Layout | ✅ APPROVED | [View](./adrs/ADR-020-1-conditional-app-shell-layout.md) |
| **ADR-244** | Role Management Admin Console | ✅ IMPLEMENTED (Phase A + Phase B) | [View](./adrs/ADR-244-role-management-admin-console.md) |

---

## 🔧 **BACKEND SYSTEMS**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-059** | Separate /api/projects/bootstrap from /api/projects/list | ✅ ✅ Active | [View](./adrs/ADR-059-separate-audit-bootstrap-from-projects-list.md) |
| **ADR-060** | Migrate BuildingFloorplanService to Enterprise Storage Architecture | ✅ ✅ Active | [View](./adrs/ADR-060-building-floorplan-enterprise-storage.md) |
| **ADR-070** | Email & AI Ingestion System | ✅ ✅ FULLY OPERATIONAL (OpenAI Active) | [View](./adrs/ADR-070-email-ai-ingestion-system.md) |

---

## 🛠️ **INFRASTRUCTURE**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-061** | Path Aliases Strategy | ✅ ✅ Active | [View](./adrs/ADR-061-path-aliases.md) |
| **ADR-092** | Centralized localStorage Service | ✅ APPROVED | [View](./adrs/ADR-092-centralized-localstorage-service.md) |
| **ADR-168** | Multi-Agent Development Environment | ✅ IMPLEMENTED | [View](./adrs/ADR-168-multi-agent-development-environment.md) |

---

## ⚡ **PERFORMANCE**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-019** | Centralized Performance Thresholds | ✅ APPROVED | [View](./adrs/ADR-019-centralized-performance-thresholds.md) |
| **ADR-030** | Unified Frame Scheduler | ✅ APPROVED | [View](./adrs/ADR-030-unified-frame-scheduler.md) |
| **ADR-036** | Enterprise Structured Logging | ✅ APPROVED | [View](./adrs/ADR-036-enterprise-structured-logging.md) |
| **ADR-119** | RAF Consolidation to UnifiedFrameScheduler | ✅ IMPLEMENTED | [View](./adrs/ADR-119-raf-consolidation-to-unifiedframescheduler.md) |

---

## 📄 **UNCATEGORIZED**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-034** | EMPTY_SPATIAL_BOUNDS Consolidation | ✅ APPROVED | [View](./adrs/ADR-034-empty-spatial-bounds-centralization.md) |
| **ADR-065** | Inline ID Generation Centralization | ✅ APPROVED | [View](./adrs/ADR-065-inline-id-generation-centralization.md) |
| **ADR-066** | Rendering Z-Index Centralization | ✅ APPROVED | [View](./adrs/ADR-066-rendering-zindex-centralization.md) |
| **ADR-067** | FillText Offset Centralization | ✅ APPROVED | [View](./adrs/ADR-067-filltext-offset-centralization.md) |
| **ADR-071** | Enterprise Email Webhook Queue System | ✅ APPROVED | [View](./adrs/ADR-071-enterprise-email-webhook-queue.md) |
| **ADR-073** | Firestore Composite Index Strategy | ✅ APPROVED | [View](./adrs/ADR-073-firestore-indexes-strategy.md) |
| **ADR-074** | AI Inbox UX Improvements - Link Visibility & Theme Colors | ✅ APPROVED | [View](./adrs/ADR-074-ai-inbox-ux-improvements.md) |
| **ADR-078** | Server-Side Property Creation via Admin SDK | ✅ APPROVED | [View](./adrs/ADR-078-server-side-unit-creation.md) |
| **ADR-079** | AI Inbox Real-Time Updates via Firestore onSnapshot | ✅ APPROVED | [View](./adrs/ADR-079-ai-inbox-realtime-updates.md) |
| **ADR-100** | JIT User Profile Sync (Firestore /users/{uid}) | ✅ APPROVED | [View](./adrs/ADR-100-user-profile-sync.md) |
| **ADR-103** | Availability Check & AI Operator Briefing | ✅ APPROVED | [View](./adrs/ADR-103-availability-check-operator-briefing.md) |
| **ADR-145** | PropertyType SSoT Centralization | ✅ APPROVED | [View](./adrs/ADR-145-property-types-ssot.md) |
| **ADR-156** | Voice Message Transcription (OpenAI Whisper) | ✅ APPROVED | [View](./adrs/ADR-156-voice-message-transcription-whisper.md) |
| **ADR-161** | Global Voice Assistant (Header Microphone) | ✅ APPROVED | [View](./adrs/ADR-161-global-voice-assistant.md) |
| **ADR-165** | Entity Validation Centralization | ✅ APPROVED | [View](./adrs/ADR-165-entity-validation-centralization.md) |
| **ADR-166** | GAP_TOLERANCE, ARC_TESSELLATION & Ghost Colors Centralization | ✅ APPROVED | [View](./adrs/ADR-166-gap-tolerance-arc-ghost-centralization.md) |
| **ADR-170** | Construction Worker Attendance — QR Code + GPS Geofencing + Photo Verification | ✅ Accepted | [View](./adrs/ADR-170-attendance-qr-gps-verification.md) |
| **ADR-171** | Autonomous AI Agent with Agentic Tool Calling | ✅ APPROVED | [View](./adrs/ADR-171-autonomous-ai-agent.md) |
| **ADR-173** | Enterprise AI Self-Improvement System | ✅ APPROVED | [View](./adrs/ADR-173-ai-self-improvement-system.md) |
| **ADR-174** | Meta Omnichannel Integration — WhatsApp + Messenger + Instagram | ✅ APPROVED | [View](./adrs/ADR-174-meta-omnichannel-whatsapp-messenger-instagram.md) |
| **ADR-175** | Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ) | ✅ APPROVED | [View](./adrs/ADR-175-quantity-surveying-measurements-system.md) |
| **ADR-176** | DXF Viewer Mobile Responsive Refactoring | ✅ APPROVED | [View](./adrs/ADR-176-dxf-viewer-mobile-responsive.md) |
| **ADR-177** | Employer Picker — Entity Linking with Company Contacts | ✅ APPROVED | [View](./adrs/ADR-177-employer-picker-entity-linking.md) |
| **ADR-178** | GeoCanvas Mobile Responsive Remediation | ✅ APPROVED | [View](./adrs/ADR-178-geocanvas-mobile-responsive.md) |
| **ADR-180** | Hybrid Navigation — Dashboard Home με Navigation Tiles | ✅ APPROVED | [View](./adrs/ADR-180-hybrid-navigation-dashboard-tiles.md) |
| **ADR-181** | IFC-Compliant Floor Management System | ✅ APPROVED | [View](./adrs/ADR-181-ifc-floor-management-system.md) |
| **ADR-182** | Parking & Storage Hierarchy Audit | ✅ APPROVED | [View](./adrs/ADR-182-parking-storage-hierarchy-audit.md) |
| **ADR-183** | Unified Grip System — Ενοποίηση DXF + Overlay Grip Interaction | ✅ APPROVED | [View](./adrs/ADR-183-unified-grip-system.md) |
| **ADR-184** | Building Spaces Tabs (Storage, Parking, Units) | ✅ APPROVED | [View](./adrs/ADR-184-building-spaces-tabs.md) |
| **ADR-185** | AI-Powered DXF Drawing Assistant | ✅ APPROVED | [View](./adrs/ADR-185-ai-powered-dxf-drawing-assistant.md) |
| **ADR-186** | Building Code Module — Modular Κανονισμός Δόμησης (ΝΟΚ) | ✅ APPROVED | [View](./adrs/ADR-186-building-code-nok-module.md) |
| **ADR-188** | Entity Rotation System — DXF Viewer | ✅ APPROVED | [View](./adrs/ADR-188-entity-rotation-system.md) |
| **ADR-189** | Construction Grid & Guide System (Κάνναβος & Οδηγοί) | ✅ ALL COMMANDS COMPLETE ✅ + Phase 2 Enhancements (31): B1 Bubbles ✅, B2 Auto Grid ✅, B3 Dimensions ✅, B4 Lock ✅, B5 Drag ✅, B6 Colors ✅, B7 Groups ✅, B8 Guide from Entity ✅, B9 Polar Start Angle ✅, B11 Info Panel ✅, B12 Snap Midpoint ✅, B13 Keyboard Shortcuts ✅, B14 Multi-select ✅, B15 Toggle Visibility ✅, B16 Guide at Angle ✅, B17 Copy/Offset Pattern ✅, B19 Mirror ✅, B20 Undo/Redo ✅, B22 Context Menu ✅, B23 Structural Presets ✅, B24 Offset from Entity ✅, B28 Rotation ✅, B29 Rotate Group ✅, B30 Rotate All ✅, B31 Polar Array ✅, B32 Scale Grid ✅, B33 Equalize ✅, B35 Construction Line ✅, B36 Measure→Guide ✅, B37 Guide from Selection ✅, B38 Custom Labels ✅. 14/14 commands + 31 enhancements. | [View](./adrs/ADR-189-construction-grid-guide-system.md) |
| **ADR-190** | Photo/Logo Upload System — SSoT Consolidation | ✅ APPROVED | [View](./adrs/ADR-190-photo-upload-ssot-consolidation.md) |
| **ADR-191** | Ιεραρχικό Σύστημα Upload Μελετών Οικοδομικής Άδειας | ✅ APPROVED | [View](./adrs/ADR-191-hierarchical-study-upload.md) |
| **ADR-193** | Εμφάνιση Πεδίων ανά Domain — Χώροι vs Πωλήσεις | ✅ APPROVED | [View](./adrs/ADR-193-field-display-domain-separation.md) |
| **ADR-194** | Info Tab Section Consistency — Unified Section Order | ✅ APPROVED | [View](./adrs/ADR-194-info-tab-section-consistency.md) |
| **ADR-195** | Entity Audit Trail — Κεντρικοποιημένο Σύστημα Ιστορικού Αλλαγών | ✅ APPROVED | [View](./adrs/ADR-195-entity-audit-trail.md) |
| **ADR-197** | Sales Pages Implementation Plan | ✅ APPROVED | [View](./adrs/ADR-197-sales-pages-implementation-plan.md) |
| **ADR-198** | Sales-to-Accounting Bridge (Transaction Chain Pattern) | ✅ APPROVED | [View](./adrs/ADR-198-sales-accounting-bridge.md) |
| **ADR-199** | Παρακολουθήματα Πωλήσεων (Parking & Storage as Sale Appurtenances) | ✅ APPROVED | [View](./adrs/ADR-199-sales-appurtenances.md) |
| **ADR-200** | useEntityLink Hook — Centralized Entity Linking | ✅ Accepted | [View](./adrs/ADR-200-useEntityLink-hook.md) |
| **ADR-200** | Utility Hooks Centralization (Phase 2) | ✅ APPROVED | [View](./adrs/ADR-200-utility-hooks-centralization.md) |
| **ADR-204** | Scattered Code Centralization — Phase 3 | ✅ APPROVED | [View](./adrs/ADR-204-phase3-escape-routes-storage.md) |
| **ADR-205** | Scattered Code Centralization — Phase 4 | ✅ APPROVED | [View](./adrs/ADR-205-phase4-useInterval-useSortState-truncateText.md) |
| **ADR-206** | Scattered Code Centralization — Phase 5 | ✅ APPROVED | [View](./adrs/ADR-206-phase5-enterprise-id-debounce-filesize.md) |
| **ADR-207** | Scattered Code Centralization — Phase 6 (Collection Utilities) | ✅ APPROVED | [View](./adrs/ADR-207-phase6-collection-utilities.md) |
| **ADR-212** | Phase 9 — Async/Clone/Validation/FileSize/Currency Deduplication | ✅ APPROVED | [View](./adrs/ADR-212-phase9-async-clone-url-filesize.md) |
| **ADR-213** | Validation Centralization (Phone + Text Extraction) | ✅ APPROVED | [View](./adrs/ADR-213-validation-centralization.md) |
| **ADR-215** | Phase 10 — chunkArray/isRecord/formatBytes/formatDate/formatCurrency Deduplication | ✅ APPROVED | [View](./adrs/ADR-215-phase10-chunk-typeguards-formatters.md) |
| **ADR-217** | Phase 11 — Object Sanitization, Greek Text Normalization, Debounce Callback Deduplication | ✅ APPROVED | [View](./adrs/ADR-217-phase11-sanitize-greek-debounce.md) |
| **ADR-218** | Firestore Timestamp Conversion Centralization | ✅ Implemented | [View](./adrs/ADR-218-timestamp-conversion-centralization.md) |
| **ADR-219** | Notification/Toast System Consolidation | ✅ APPROVED | [View](./adrs/ADR-219-notification-toast-consolidation.md) |
| **ADR-220** | Firestore Field Extractor Centralization | ✅ APPROVED | [View](./adrs/ADR-220-field-extractor-centralization.md) |
| **ADR-221** | Error Message Extraction Centralization | ✅ APPROVED | [View](./adrs/ADR-221-error-message-extraction.md) |
| **ADR-222** | console.error/warn → createModuleLogger Migration | ✅ APPROVED | [View](./adrs/ADR-222-console-to-logger-migration.md) |
| **ADR-224** | Safe JSON Parse Centralization | ✅ APPROVED | [View](./adrs/ADR-224-safe-json-parse-centralization.md) |
| **ADR-225** | Type Guards Centralization — `isNonEmptyString`, `isNonEmptyArray` | ✅ APPROVED | [View](./adrs/ADR-225-type-guards-centralization.md) |
| **ADR-229** | Centralized Page Loading & Error States | ✅ APPROVED | [View](./adrs/ADR-229-centralized-page-loading-states.md) |
| **ADR-231** | Cascade Entity Linking — Αυτόματη Διάδοση Ιεραρχίας | ✅ APPROVED | [View](./adrs/ADR-231-cascade-entity-linking.md) |
| **ADR-232** | Tenant Isolation vs Business Entity Link Separation | ✅ APPROVED | [View](./adrs/ADR-232-tenant-company-separation.md) |
| **ADR-235** | Πίνακας Ποσοστών Συνιδιοκτησίας (Ownership Percentage Table) | ✅ APPROVED | [View](./adrs/ADR-235-ownership-percentage-table.md) |
| **ADR-236** | Multi-Level Property Management (Πολυεπίπεδη Διαχείριση Ακινήτων) | ✅ APPROVED | [View](./adrs/ADR-236-multi-level-property-management.md) |
| **ADR-241** | Fullscreen — Composition Architecture | ✅ APPROVED | [View](./adrs/ADR-241-fullscreen-container-centralization.md) |
| **ADR-243** | Custom Firestore MCP Server — Secure Database Access for Claude Code | ✅ APPROVED | [View](./adrs/ADR-243-firestore-mcp-server.md) |
| **ADR-244** | Πολλαπλοί Αγοραστές & Συνιδιοκτησία Ακινήτων | ✅ APPROVED | [View](./adrs/ADR-244-multi-buyer-co-ownership.md) |
| **ADR-251** | Scattered Code Patterns Audit & Consolidation Roadmap | ✅ DOCUMENTED | [View](./adrs/ADR-251-scattered-code-patterns-audit.md) |
| **ADR-255** | Security Hardening Phase 4 — Tenant Isolation, Validation, Audit Trail | ✅ APPROVED | [View](./adrs/ADR-255-security-hardening-phase-4.md) |
| **ADR-259** | Production Readiness Audit — 6 Critical Findings | ✅ APPROVED | [View](./adrs/ADR-259-production-readiness-audit.md) |
| **ADR-261** | Multi-Agent Orchestrator (Claude Agent SDK) | ✅ APPROVED | [View](./adrs/ADR-261-multi-agent-orchestrator.md) |
| **ADR-262** | AI Agent Testing & Production Standards | ✅ APPROVED | [View](./adrs/ADR-262-ai-agent-testing-production-standards.md) |
| **ADR-263** | Telegram Bot Testing Playbook | ✅ APPROVED | [View](./adrs/ADR-263-telegram-bot-testing-playbook.md) |
| **ADR-265** | Enterprise Reports System — Research & Architecture | ✅ APPROVED | [View](./adrs/ADR-265-enterprise-reports-system.md) |
| **ADR-266** | Gantt & Construction Schedule Reports | ✅ APPROVED | [View](./adrs/ADR-266-gantt-construction-reports.md) |
| **ADR-267** | Lightweight Procurement Module — Purchase Orders & Material Tracking | ✅ APPROVED | [View](./adrs/ADR-267-lightweight-procurement-module.md) |
| **ADR-268** | Route Rename /audit to /projects | ✅ APPROVED | [View](./adrs/ADR-268-route-rename-audit-to-projects.md) |
| **ADR-278** | Company Identity Field Guard | ✅ APPROVED | [View](./adrs/ADR-278-company-identity-field-guard.md) |
| **ADR-282** | Contact Persona Architecture Refactoring — Google-Level Redesign | ✅ APPROVED | [View](./adrs/ADR-282-contact-persona-architecture-refactoring.md) |
| **ADR-283** | Project Roles SSOT Refactoring | ✅ APPROVED | [View](./adrs/ADR-283-project-roles-ssot-refactoring.md) |
| **ADR-284** | Unit Creation Hierarchy Enforcement (Company → Project → Building → Floor → Unit) | ✅ APPROVED | [View](./adrs/ADR-284-unit-creation-hierarchy-enforcement.md) |
| **ADR-285** | DXF Levels + cadFiles Tenant Scoping & Module Split | ✅ APPROVED | [View](./adrs/ADR-285-dxf-tenant-scoping-and-module-split.md) |
| **ADR-287** | Enum SSoT Centralization (Batch 9) | ✅ APPROVED | [View](./adrs/ADR-287-enum-ssot-centralization.md) |
| **ADR-288** | CAD File Metadata Centralization | ✅ APPROVED | [View](./adrs/ADR-288-cad-file-metadata-centralization.md) |
| **ADR-289** | DXF Overlay Item Centralization (SSOT API Gateway) | ✅ APPROVED | [View](./adrs/ADR-289-dxf-overlay-item-centralization.md) |
| **ADR-290** | Building Creation SSoT Enforcement | ✅ APPROVED | [View](./adrs/ADR-290-building-creation-ssot-enforcement.md) |
| **ADR-292** | Floorplan Upload Consolidation Map | ✅ APPROVED | [View](./adrs/ADR-292-floorplan-upload-consolidation-map.md) |
| **ADR-293** | File Naming & Storage Path SSoT Audit | ✅ APPROVED | [View](./adrs/ADR-293-file-naming-storage-path-ssot-audit.md) |
| **ADR-UI-001** | Visual Primitive Ownership & Semantic Tokens | ✅ APPROVED | [View](./adrs/ADR-UI-001.md) |

---

## 📝 **ADDING NEW ADRs**

### 🔢 ΔΙΑΘΕΣΙΜΑ IDs (χρησιμοποίησε αυτά ΠΡΩΤΑ):

```
034, 065, 066, 067, 068, 070, 071, 072, 073, 074,
077, 078, 079, 080, 089, 090, 100, 103, 121, 131,
132, 134, 145, 156, 161, 164
```

> **⚠️ ΣΗΜΑΝΤΙΚΟ**: Αυτά τα IDs ενοποιήθηκαν στο ADR-GEOMETRY. Χρησιμοποίησέ τα για νέα ADRs πριν συνεχίσεις από το 167+.

### 📋 Οδηγίες:

1. **Επέλεξε ID** από τη λίστα παραπάνω (ή 167+ αν τελείωσαν)
2. Create a new file in `adrs/` using the template: `adrs/_template.md`
3. Follow the naming convention: `ADR-NNN-short-description.md`
4. Run the generator script to update this index:
   ```bash
   node docs/centralized-systems/reference/scripts/generate-adr-index.cjs
   ```

---

## 🚫 **GLOBAL PROHIBITIONS**

Based on these ADRs, the following are **PROHIBITED**:

- ❌ `as any` - Use proper TypeScript types (ADR-CLAUDE)
- ❌ `@ts-ignore` - Fix the actual type issues (ADR-CLAUDE)
- ❌ Hardcoded z-index values - Use design tokens (ADR-002)
- ❌ Direct Tailwind border/shadow classes - Use semantic tokens (ADR-UI-001)
- ❌ Duplicate grip rendering - Use UnifiedGripRenderer (ADR-048)
- ❌ Debug endpoints in production (ADR-062)
- ❌ Inline styles - Use centralized design system

---

*Auto-generated by generate-adr-index.cjs*
*Based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
