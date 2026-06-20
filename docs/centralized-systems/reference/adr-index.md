# 📋 **ARCHITECTURAL DECISION RECORDS (ADRs) INDEX**

> **Complete Enterprise ADR Registry**
>
> Single source of truth για όλες τις αρχιτεκτονικές αποφάσεις της εφαρμογής
>
> ⚠️ **AUTO-GENERATED FILE** - Do not edit manually!
> Run `node docs/centralized-systems/reference/scripts/generate-adr-index.cjs` to regenerate.

**📊 Stats**: 438 ADRs | Last Updated: 2026-06-18

---

## 🎯 **QUICK NAVIGATION**

| Category | Count | Quick Jump |
|----------|-------|------------|
| 📐 **Domain - Geometry** | 1 | [View](#domain-geometry) |
| 🎨 **UI Components** | 12 | [View](#ui-components) |
| 🎨 **Design System** | 7 | [View](#design-system) |
| 🖼️ **Canvas & Rendering** | 40 | [View](#canvas-rendering) |
| 📊 **Data & State** | 12 | [View](#data-state) |
| ✏️ **Drawing System** | 16 | [View](#drawing-system) |
| 📂 **Entity Systems** | 16 | [View](#entity-systems) |
| 🔧 **Tools & Keyboard** | 8 | [View](#tools-keyboard) |
| 🔍 **Filters & Search** | 1 | [View](#filters-search) |
| 🔒 **Security & Auth** | 8 | [View](#security-auth) |
| 🔧 **Backend Systems** | 3 | [View](#backend-systems) |
| 🛠️ **Infrastructure** | 3 | [View](#infrastructure) |
| ⚡ **Performance** | 4 | [View](#performance) |
| 📄 **Uncategorized** | 228 | [View](#uncategorized) |

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
| **ADR-029** | Global Search System v1 | ✅ APPROVED | 2026-01-01 | Search / Indexing / Cloud Functions | [📄](./adrs/ADR-029-global-search-system-v1.md) |
| **ADR-030** | Unified Frame Scheduler | ✅ APPROVED | 2026-02-01 | Performance | [📄](./adrs/ADR-030-unified-frame-scheduler.md) |
| **ADR-031** | Enterprise Command Pattern (Undo/Redo) | ✅ APPROVED | 2026-01-01 | Data & State | [📄](./adrs/ADR-031-enterprise-command-pattern-undo-redo.md) |
| **ADR-032** | Drawing State Machine | ✅ COMPLETED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-032-drawing-state-machine.md) |
| **ADR-034** | EMPTY_SPATIAL_BOUNDS Consolidation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-034-empty-spatial-bounds-centralization.md) |
| **ADR-034** | Gantt Chart - Construction Phase Tracking | ✅ IMPLEMENTED - Phase 1+2+3+4 Complete (4.1+4.2+4.3+4.4+4.5+4.6+4.7+4.8+4.9 ALL DONE) | 2026-02-07 | UI Components / Construction Management | [📄](./adrs/ADR-034-gantt-chart-construction-tracking.md) |
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
| **ADR-147** | Unified Share Surface — ShareSurfaceShell + Pluggable PermissionPanel | ✅ 🟢 ACCEPTED — Phase A + Phase B Implemented | 2026-04-11 | UI Components / Centralization | [📄](./adrs/ADR-147-unified-share-surface.md) |
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
| **ADR-189** | Construction Grid & Guide System (Κάνναβος & Οδηγοί) | ✅ ALL COMMANDS COMPLETE ✅ + Phase 2 Enhancements (32): B1 Bubbles ✅, B2 Auto Grid ✅, B3 Dimensions ✅, B4 Lock ✅, B5 Drag ✅, B6 Colors ✅, B7 Groups ✅, B8 Guide from Entity ✅, B9 Polar Start Angle ✅, B11 Info Panel ✅, B12 Snap Midpoint ✅, B13 Keyboard Shortcuts ✅, B14 Multi-select ✅, B15 Toggle Visibility ✅, B16 Guide at Angle ✅, B17 Copy/Offset Pattern ✅, B19 Mirror ✅, B20 Undo/Redo ✅, B22 Context Menu ✅, B23 Structural Presets ✅, B24 Offset from Entity ✅, B28 Rotation ✅, B29 Rotate Group ✅, B30 Rotate All ✅, B31 Polar Array ✅, B32 Scale Grid ✅, B33 Equalize ✅, B35 Construction Line ✅, B36 Measure→Guide ✅, B37 Guide from Selection ✅, B38 Custom Labels ✅, B121 Entity→Guide ✅. 14/14 commands + 32 enhancements. | 2026-02-22 | Uncategorized | [📄](./adrs/ADR-189-construction-grid-guide-system.md) |
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
| **ADR-227** | Real-Time Subscription Consolidation & Coverage Expansion | ✅ 🟢 FULLY IMPLEMENTED — All phases complete, 10/10 hooks migrated, FLOORPLAN_UPDATED gap closed (2026-05-24) | 2026-03-13 | Data Access Layer / Real-Time Architecture | [📄](./adrs/ADR-227-realtime-subscription-consolidation.md) |
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
| **ADR-242** | Smart Financial Intelligence Suite — Enterprise Features for InterestCostDialog | ✅ ✅ COMPLETE — All SPECs A–E done | 2026-03-18 | Entity Systems / Sales & Finance | [📄](./adrs/ADR-242-smart-financial-intelligence-suite.md) |
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
| **ADR-252** | Comprehensive Security Audit | ✅ ✅ PHASE_4_IMPLEMENTED | 2026-03-19 | Security / Infrastructure | [📄](./adrs/ADR-252-comprehensive-security-audit.md) |
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
| **ADR-294** | SSoT Ratchet Enforcement System | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-294-ssot-ratchet-enforcement.md) |
| **ADR-295** | Multi-Channel Photo Sharing to CRM Contacts | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-295-multi-channel-photo-sharing.md) |
| **ADR-296** | File-Type Classification SSoT Unification | ✅ ✅ IMPLEMENTED | 2026-04-21 | File Management / Architectural Integrity | [📄](./adrs/ADR-296-file-type-classification-ssot.md) |
| **ADR-297** | HQ Address Clear + Undo — Google-level Single-Click UX | ✅ ✅ IMPLEMENTED | 2026-04-21 | Frontend UX / Contacts Form | [📄](./adrs/ADR-297-hq-clear-undo-pattern.md) |
| **ADR-314** | SSoT Discovery Findings & Centralization Roadmap | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-314-ssot-discovery-findings-roadmap.md) |
| **ADR-316** | Project Showcase (Επίδειξη Έργου) | ✅ 📋 In Progress | 2026-04-22 | Uncategorized | [📄](./adrs/ADR-316-project-showcase.md) |
| **ADR-320** | Building Showcase (SSoT Composition) | ✅ ✅ IMPLEMENTED (Phase 6 landed — public `/shared/[token]` viewer for `building_showcase`. All 6 phases green.) | 2026-04-23 | Buildings / Public Share Surfaces | [📄](./adrs/ADR-320-building-showcase.md) |
| **ADR-327** | Quote Management & Comparison System (Hybrid Scan + Vendor Portal) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-327-quote-management-comparison-system.md) |
| **ADR-328** | Tabs SSoT Consolidation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-328-tabs-ssot-consolidation.md) |
| **ADR-329** | Measurement Task Scope — Property-Granular Selection | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-329-measurement-task-scope-granularity.md) |
| **ADR-330** | Procurement Hub Scoped Split (Company-wide vs Project-scoped) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-330-procurement-hub-scoped-split.md) |
| **ADR-331** | Enterprise Spend Analytics Page | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-331-enterprise-spend-analytics-page.md) |
| **ADR-332** | Enterprise Address Editor System (Full Transparency) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-332-enterprise-address-editor-system.md) |
| **ADR-340** | Floorplan Background System (PDF + Image, single-per-floor, Procore-grade separation) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-340-raster-background-layers-system.md) |
| **ADR-341** | UserSettings SSoT (Firestore-backed industry pattern) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-341-user-settings-ssot.md) |
| **ADR-342** | Voice Input Field SSoT | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-342-voice-input-field-ssot.md) |
| **ADR-343** | DXF Canvas Visual Regression Test Suite | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-343-dxf-canvas-visual-regression-suite.md) |
| **ADR-344** | DXF Enterprise Text Engine (Autodesk-Grade Text Creation & Editing Suite) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-344-dxf-enterprise-text-engine.md) |
| **ADR-345** | DXF Viewer — Ribbon Interface (AutoCAD-style) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-345-dxf-ribbon-interface.md) |
| **ADR-346** | Auto Area Measurement (Point-and-Click) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-346-auto-area-measurement.md) |
| **ADR-347** | Admin Console Sidebar | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-347-admin-console-sidebar.md) |
| **ADR-348** | Scale Command (Κλιμάκωση) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-348-scale-command.md) |
| **ADR-349** | Stretch Command (Επιμήκυνση) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-349-stretch-command.md) |
| **ADR-350** | Trim Command (Ψαλίδισμα) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-350-trim-command.md) |
| **ADR-351** | Firebase Storage CORS Policy | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-351-firebase-storage-cors-policy.md) |
| **ADR-352** | FileRecord Query Ordering & Wipe Completeness | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-352-filerecord-ordering-wipe-completeness.md) |
| **ADR-353** | Array Commands — Rectangular, Path, Polar | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-353-array-commands.md) |
| **ADR-353** | Extend Command (Επέκταση) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-353-extend-command.md) |
| **ADR-354** | Super Admin Company Switcher: SSOT Server + Client Override | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-354-super-admin-company-switcher-ssot-override.md) |
| **ADR-355** | Real-time Firestore Subscription SSOT Consolidation | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-355-realtime-subscription-ssot-consolidation.md) |
| **ADR-356** | Super-Admin Project Scope SSOT (server helper + client invalidation hook) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-356-super-admin-project-scope-ssot.md) |
| **ADR-357** | DXF Line Tool: Allineamento Google-Level a CAD Professionali | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-357-dxf-line-tool-google-level.md) |
| **ADR-358** | DXF Stair Tool: Google-Level Parametric Staircase System | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-358-dxf-stair-tool-google-level.md) |
| **ADR-358** | Layer Management System (DXF-grade, Google-Level) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-358-layer-management-system.md) |
| **ADR-359** | Auxiliary Geometry Tools: XLINE (Construction Lines) + RAY | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-359-auxiliary-geometry-tools.md) |
| **ADR-360** | Firebase Custom Claims Auto-Refresh Listener | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-360-claims-auto-refresh-listener.md) |
| **ADR-360** | Claims Auto-Refresh SSoT (Firestore Mirror) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-360-claims-auto-refresh-ssot.md) |
| **ADR-361** | Firestore Subscribe Equality Guard (SSoT) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-361-firestore-subscribe-equality-guard.md) |
| **ADR-362** | Enterprise Dimension System | ✅ ✅ IMPLEMENTED — ADR-362 FULLY IMPLEMENTED 2026-05-18. Groups A→O3 complete (all pending commit). | 2026-05-17 | DXF Viewer — Annotation / Dimensions | [📄](./adrs/ADR-362-enterprise-dimension-system.md) |
| **ADR-363** | BIM Drawing Mode (Parametric Building Elements) | ✅ 🟢 **FULLY IMPLEMENTED** 2026-05-21 — Phases 0-8 complete. Wall/Opening/Slab/Column/Beam tools, Phase 5.6 Wall Split, Phase 6 BOQ auto-feed, Phase 7.1-7.2 multi-select + bulk edit, Phase 8 schedule export. | 2026-05-17 | DXF Viewer — BIM / Parametric Building Modeling | [📄](./adrs/ADR-363-bim-drawing-mode.md) |
| **ADR-364** | Escape Command Bus (Centralized ESC Dispatcher) | ✅ 🟢 **APPROVED** 2026-05-18 — Group 1+2+3 (BIM tools) implemented; Boy-Scout Group 4 (10 secondary components) migrated 2026-06-03 | 2026-05-18 | DXF Viewer — Tools & Keyboard | [📄](./adrs/ADR-364-escape-command-bus.md) |
| **ADR-365** | Tailwind Semantic Palette Enforcement | ✅ ✅ **APPROVED** 2026-05-29 — All 8 phases complete. Baseline 0/0, zero-tolerance CHECK 3.26 active. The `green-707` typo incident (303 occurrences / 181 files) is **RESOLVED**: all renamed to `[hsl(var(--text-success))]` theme-aware classes, and CHECK 3.26 now hard-blocks any non-existent Tailwind shade (invalid-shade detection). **Follow-up 2026-05-29**: faded SOLID status colors fixed — new `--status-*` solid tier in COLOR_BRIDGE (`bg.*Solid`/`text.onSolid`) + green text unification + 214 foreground-misuse fixes (`(text\ | 2026-05-19 | Design System — Theming & Color Tokens | [📄](./adrs/ADR-365-tailwind-semantic-palette-enforcement.md) |
| **ADR-366** | 3D BIM Viewer & Photorealistic Rendering | ✅ 🟢 **PHASES 0-8.1 FULLY IMPLEMENTED** 2026-05-21 + 🔵 **GROUP C RESEARCH CLOSED 7/7** 2026-05-22 + 🟢 **PHASE 9 FULLY CLOSED 2026-05-25** (C.4 ✅ 2026-05-22, C.5 ✅ 2026-05-22, C.3 ✅ 2026-05-22, C.6 ✅ 2026-05-22, C.2 ✅ 2026-05-24, C.7 Q1+Q2+Q3+Q4+Q5 ✅ 2026-05-24, **C.1.a+b+c ✅ 2026-05-25**) — Phases 0-8.1 implementation complete (3D BIM viewer Three.js, ARIA/screen reader Phase 8.0-8.1, IFC export Phase 8.0 Q8.3+Q8.4, section cuts Phase 7.0). **Phase 9 deferred features** (Group C decisions → implementation): **C.4 ✅ DONE** (BimMaterialsTab/BimBoqTab/BimCommentsTab + last-active-tab-tracker + material-alternatives-resolver + boq-tree-builder). **C.5 ✅ DONE** (announcement-protocol + entity-dom-proxy-renderer + entity-keyboard-navigator + use-reduced-motion + reduced-motion-config + aria-entity-description-generator extensions + focus-order semantic toggle + Bim3DPreferencesService accessibility fields + ViewMode3DStore announcementsEnabled + i18n 44 keys). **C.3 ✅ DONE 2026-05-22** (dim3d-types + value-computer + line-geometry + text-plane-orienter + Dim3DToolStateMachine + dim3d-snap-engine-adapter + bim-dimensions-3d.service + Dimension3DRenderer + Dim3DGripsRenderer + useDim3DToolRouting + RibbonDim3DContextualTab + Dim3DPropertiesPanel + BimDimensions3DStore + Firestore collection+rules+3 indexes + 4 RBAC perms + audit type+action + Bim3DPreferencesService dimensions field + Ctrl+Shift+D hotkey + i18n 36 keys × 2 + 35 tests). **C.6 ✅ DONE 2026-05-22** (SectionStore PlaneGroup/linkedGroups + CropRegionStore FSM + CropRegionTool + CropRegionOverlay + crop-frustum-builder + HorizontalPresetPicker + PlaneListItem + section-group-transformer + horizontal-cut-preset-resolver + useCropRegionTool + keyboard shortcut Ctrl+Alt+R + BimViewport3D wiring + SectionSceneController budget guard + i18n ~41 keys × 2). **C.2 ✅ DONE 2026-05-24**, **C.7 Q1+Q2+Q3+Q4+Q5 ✅ DONE 2026-05-24** (Q1 Sparkline 60s, Q2 Admin BIM Diagnostics Dashboard — super-admin /admin/bim-diagnostics route + FSM triage + Recharts aggregates + CSV export + audit, Q3 GDPR anonymous telemetry pipeline, Q4 auto-submit FSM, Q5 Regression detection). **C.1 Animation FULLY CLOSED 2026-05-25** (C.1.a Logic Foundation + C.1.b UX/Timeline + drag interaction + bezier 4-point editor + real scene-bbox turntable + React component tests + C.1.c Rendering/Queue MP4Exporter + RenderQueueStore + RenderQueuePanel). **Animation Phase 9 ολόκληρη CLOSED — μηδέν deferred testing items.** **Group B Custom HDRI Upload ✅ DONE 2026-05-25** (HdriUploader + hdri-upload.service + storage.rules bim_environments + EnvironmentStore.customHdri* — closes Group B last deferred research item §9 Q4 "User upload"). **Axis-constrained drag gizmo ✅ DONE 2026-05-25** (axis-constraint-projector.ts + AnimationStore.dragAxisLock + WaypointDragHandle gizmo arrows + keyboard X/Y/Z + arrow click). **Snap-to-grid ✅ DONE 2026-05-25** (snap-quantizer.ts + AnimationStore snapEnabled/snapStepUnits + writeWaypointPosition quantize + ribbon toggle+combobox panel + useRibbonCommands bridge + i18n 2 locales). ADR-366 total estimate: ~254-303h Phases 0-9. | 2026-05-19 | DXF Viewer — 3D Rendering / Photorealistic Output | [📄](./adrs/ADR-366-3d-bim-viewer-photorealistic-rendering.md) |
| **ADR-367** | Firestore Internal Assertion Recovery (Single-Tab Cache + Safety Net) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-367-firestore-internal-assertion-recovery.md) |
| **ADR-368** | DXF Import Drawing Units Override (AutoCAD/Revit Pattern) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-368-dxf-import-drawing-units-override.md) |
| **ADR-369** | BIM Elevation Convention: Revit/Industry-Standard Alignment | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-369-bim-elevation-convention-revit-alignment.md) |
| **ADR-370** | BIM Read-Only Visualization in Properties Floorplan Tab | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-370-bim-readonly-visualization.md) |
| **ADR-371** | BIM Corner Snap System (Revit/ArchiCAD-grade Face-Corner Snapping) | ✅ ✅ **IMPLEMENTED** 2026-05-22 — Phases 2A-2F complete. 27 files created/edited. Integration test (S1-S5) added 2026-05-22. Bugfix: SnapContext.ALL_MODES missing BIM types fixed 2026-05-22. Extension: Wall Face Corner Projection Snap (Revit-style) added 2026-05-22. Extension (ADR-398): Column Body Corner Projection Snap — move/resize/draw parity, added 2026-05-29 (§17). **Consolidation 2026-06-11: 5→1 generic `BimCharacteristicSnapEngine` + `bim-characteristic-points.ts` SSoT dispatcher; corner+midpoint+center για ΟΛΕΣ τις BIM οντότητες; 5 `BIM_*_CORNER` types → `BIM_CORNER`+`BIM_MIDPOINT`+`BIM_CENTER`; composition labels. **Bugfix 2026-06-11: «Μέσο/Κέντρο ποτέ» → priority numbers −1.7 (ίσα, αρνητικά) + iteration-order anti-starvation (§15) — BROWSER-VERIFIED (Giorgio).** commit pending.** | 2026-05-22 | DXF Viewer — Snapping / BIM Precision | [📄](./adrs/ADR-370-bim-corner-snap-system.md) |
| **ADR-371** | BIM 3D Read-Only Viewer in Properties Floorplan Tab | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-371-bim-3d-readonly-viewer.md) |
| **ADR-371** | BIM Corner Snap System (Redirect) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-371-bim-corner-snap-system.md) |
| **ADR-372** | Contact Relationship Bidirectional Crossing Matrix | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-372-relationship-crossings-matrix.md) |
| **ADR-373** | FileRecord ISO 19650 Metadata Enrichment (Phase 1 — Schema + AI Auto-Fill) | ✅ ✅ Phase 1 + P2.1/P2.2/P2.3/P2.4/P2.5/P2.6/P2.7/P2.8 IMPLEMENTED 2026-05-24. Phase 2 COMPLETE. | 2026-05-24 (clarifications session 2026-05-24) | File Management / Document Governance / AI Pipeline | [📄](./adrs/ADR-373-iso19650-metadata-enrichment.md) |
| **ADR-374** | ZOOM Window Tool (AutoCAD ZOOM W) | ✅ ✅ APPROVED | 2026-05-24 | Canvas & Rendering | [📄](./adrs/ADR-374-zoom-window-tool.md) |
| **ADR-375** | BIM Entity Line Weight Semantic System (Revit-Equivalent) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-375-bim-entity-line-weight-semantic-system.md) |
| **ADR-376** | Opening Tags (Ταμπελάκια Ανοιγμάτων) — Revit-Faithful Pattern | ✅ ✅ **PHASE_C3_DONE** 2026-05-26 — Phase A core + Phase B.1 Renumber Openings + Phase B.2 BOQ signature-group aggregation + Phase C.1 draggable tag + γωνιακή leader + Phase C.2 per-project Tag Style + Phase C.3 PDF Schedule Export ALL SHIPPED. ADR-376 COMPLETE. | 2026-05-25 | DXF Viewer — BIM / Annotation | [📄](./adrs/ADR-376-opening-tags.md) |
| **ADR-377** | BIM Subcategories System | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-377-bim-subcategories-system.md) |
| **ADR-378** | Snap System Master Architecture & SSoT | ✅ ✅ **COMPLETE** 2026-05-27 — Master ADR + Phases 1+2+3+4+5+6 ALL DONE | 2026-05-27 | DXF Viewer — Snapping (Master) | [📄](./adrs/ADR-378-snap-system-master-architecture.md) |
| **ADR-379** | BIM Entity Audit Coverage Fix | ✅ ✅ **DONE** 2026-05-27 — Phases A→E shipped, Phase F (this ADR + cross-refs) pending commit | 2026-05-27 | DXF Viewer — Persistence / Audit Trail | [📄](./adrs/ADR-379-bim-entity-audit-coverage.md) |
| **ADR-380** | Stair + Slab-Opening Audit Coverage | ✅ ✅ **DONE** 2026-05-27 — All phases shipped, pending commit | 2026-05-27 | DXF Viewer — Persistence / Audit Trail | [📄](./adrs/ADR-380-stair-slab-opening-audit-coverage.md) |
| **ADR-381** | DXF Viewer Subsystem Duplication Audit (Master) | ✅ 🟢 **RESEARCH COMPLETE** 2026-05-27 — 7 parallel domain audits executed (read-only). Implementation roadmap pending — sub-ADRs εκκρεμούν ανά finding. | 2026-05-27 | DXF Viewer — Architecture Audit (Master) | [📄](./adrs/ADR-381-dxf-viewer-duplication-audit-master.md) |
| **ADR-382** | Visibility Resolver SSoT (BIM 2D + 3D) | ✅ 🟢 **PHASE A+B+C+D+E COMPLETE** 2026-05-27 — Resolver SSoT + 7/7 BIM 2D renderers (Phase A by Haiku + Phase B by Opus) + 3D BimSceneLayer per-entity loop + floorVisModes propagation chain + LayerStore subscriber wiring (Phase C by Opus). SSoT registry entry + ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-381 §3 closure (Phase D). 54/54 tests PASS (27 resolver unit + 10 V/G regression + 17 Phase C integration). 2D⟷3D parity achieved — `layer.visible=false` now hides BIM entities in both viewports. | 2026-05-27 | DXF Viewer — Visibility / Cross-Cutting | [📄](./adrs/ADR-382-visibility-resolver-ssot.md) |
| **ADR-390** | Symmetric BIM Entity Delete/Undo Persistence | ✅ ✅ **DONE** 2026-05-27 — Phase 1 (event infra + slab pilot) + Phase 2 (extend 7/7 BIM entities) + Phase 3 (ADR + tests + docs) shipped | 2026-05-27 | DXF Viewer — Commands / Persistence / Audit Trail | [📄](./adrs/ADR-390-symmetric-bim-delete-undo.md) |
| **ADR-391** | AdminLayerManager Ribbon Wiring | ✅ 🟢 **APPROVED & IMPLEMENTED** 2026-05-27 — Mount path closed από orphan component → modal dialog στο View tab του ribbon + Ctrl+L keyboard fallback. | 2026-05-27 | DXF Viewer — Ribbon / UI Wiring | [📄](./adrs/ADR-391-admin-layer-manager-ribbon-wiring.md) |
| **ADR-393** | BIM Stair Extended Parametric Grips (Industry-Aligned Symmetric Pattern) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-393-bim-stair-extended-grips.md) |
| **ADR-394** | Fit to View to Selected Entities (Z key) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-394-fit-to-view-selected-entities.md) |
| **ADR-395** | Ενσωμάτωση BIM οντοτήτων στην καρτέλα «Επιμετρήσεις» Κτιρίου | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-395-bim-quantities-building-measurements.md) |
| **ADR-396** | Ενιαία Εξωτερική Θερμοπρόσοψη (ETICS) για BIM | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-396-bim-external-thermal-envelope-etics.md) |
| **ADR-397** | BIM Grip & Glyph Behavior System (FULL SSoT) — Wall reference → Column parity | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-397-bim-grip-glyph-behavior-ssot.md) |
| **ADR-398** | Column placement snap — corner projection + **beam-axis snap** (κέντρο κολώνας ≡ άξονας δοκαριού) + **ghost coloring** (🟢 δοκάρι / 🔴 overlap) + **bugfix** snap-indicator εξαφάνιση στο εργαλείο «Κολώνα» + **§3.3 Smart beam ghost** (φάντασμα δοκαριού στις παρειές κολόνας, 12 θέσεις, mirror) + **§3.4 beam ghost +Y offset fix** (canonical viewport SSoT στο WYSIWYG preview — `setViewportOverride`) + **§3.5 preview-render unification** (canonical preview-frame + `useCanvasGhostPreview` harness· 19 ghost hooks migrated· +transform-lag fix) | 🟢 DONE (snap+beam-ghost browser-verified ✅· §3.5 tsc-clean/9-jest 🔴 verify) (UNCOMMITTED) | 2026-06-20 | DXF/BIM | [📄](./adrs/ADR-398-column-placement-snap.md) |
| **ADR-399** | DXF Viewer: Building Floor Navigation Tabs + Auto-Provisioned Levels | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-399-dxf-floor-navigation-tabs.md) |
| **ADR-400** | Viewport State Persistence (DXF Viewer) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-400-viewport-state-persistence.md) |
| **ADR-401** | BIM Wall Top/Base Constraints + Attach-to-Structural (associative auto-height) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md) |
| **ADR-402** | 3D Viewport BIM Element Editing | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-402-3d-bim-element-editing.md) |
| **ADR-403** | 3D Viewport BIM Element Placement (Column) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-403-3d-bim-element-placement.md) |
| **ADR-404** | 3D BIM Element Tilt (Slope-Based, All Axes) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-404-3d-bim-element-tilt.md) |
| **ADR-405** | BIM Discipline Taxonomy & MEP Foundation (Step 1) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-405-bim-discipline-taxonomy-and-mep-foundation.md) |
| **ADR-406** | Point-Based MEP Fixture (Light Fixture) — Vertical Slice (Step 3) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-406-point-based-mep-fixture.md) |
| **ADR-407** | Κάγκελα / Κιγκλιδώματα (Railings) ως πλήρες BIM στοιχείο | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-407-bim-railings.md) |
| **ADR-408** | MEP Connectors & Systems (Connectivity Backbone) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-408-mep-connectors-and-systems.md) |
| **ADR-409** | Πολιτική αδειοδότησης & redistribution εξωτερικών BIM βιβλιοθηκών/περιεχομένου | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-409-third-party-bim-library-licensing-policy.md) |
| **ADR-410** | Εισαγωγή CC0 επίπλων ως mesh-based BIM στοιχείο (mesh-import subsystem) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-410-cc0-mesh-furniture-import.md) |
| **ADR-411** | BIM Mesh Library (entity-agnostic CC0 mesh assets) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-411-bim-mesh-library.md) |
| **ADR-412** | BIM Family Types (Revit-grade Type/Instance system) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-412-bim-family-types.md) |
| **ADR-413** | PBR Texture Maps for Parametric BIM 3D | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-413-pbr-textures-parametric-bim.md) |
| **ADR-414** | Live 3D Preview Panel για Τύπο Τοίχου (per-layer τομή + υφές + αμφίδρομο highlight) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-414-wall-type-live-preview.md) |
| **ADR-415** | Βιβλιοθήκη 2D Αποτυπωμάτων (Floorplan Symbol Library) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-415-2d-floorplan-symbol-library.md) |
| **ADR-417** | BIM Roof Element (Δομικό στοιχείο «Στέγη») | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-417-bim-roof-element.md) |
| **ADR-418** | Real View Scale (1:N) SSoT — Revit-style zoom indicator | ✅ ✅ APPROVED | 2026-06-05 | Canvas & Rendering | [📄](./adrs/ADR-418-view-scale-ssot.md) |
| **ADR-419** | Floor Finish Per Room (Revit-style IfcCovering FLOORING) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-419-floor-finish-per-room.md) |
| **ADR-420** | BIM Floor-Scope SSoT (stable `floorId`, not volatile `floorplanId`) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-420-bim-floor-scope-ssot.md) |
| **ADR-421** | BIM Opening Types (Revit-grade door & window catalog) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-421-bim-opening-types-revit-grade.md) |
| **ADR-422** | BIM Μηχανολογική Μελέτη Θέρμανσης (ΤΟΤΕΕ/ΚΕΝΑΚ) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-422-bim-heating-mechanical-study.md) |
| **ADR-423** | MEP Auto-Design Framework (Single Engine, All Disciplines) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-423-mep-auto-design-framework.md) |
| **ADR-424** | Building Auto-Modeling Framework (Architectural + Structural from DXF) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-424-building-auto-modeling-framework.md) |
| **ADR-425** | Stage 0 Semantic Recognition (the shared foundation) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-425-stage0-semantic-recognition.md) |
| **ADR-426** | Water-Supply Auto-Design (the pilot discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-426-water-supply-auto-design.md) |
| **ADR-427** | Sanitary Drainage Auto-Design (the 2nd discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-427-sanitary-drainage-auto-design.md) |
| **ADR-428** | Heating (Hydronic) Auto-Design (the 3rd discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-428-heating-auto-design.md) |
| **ADR-429** | MEP Routing Brain (wall-aware A* router + parallel supply/return pairing) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-429-mep-routing-brain.md) |
| **ADR-430** | Electrical-strong (ισχυρά) Auto-Design (the 4th discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-430-electrical-strong-auto-design.md) |
| **ADR-431** | Electrical-weak (ασθενή) Auto-Design (the 6th discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-431-electrical-weak-auto-design.md) |
| **ADR-432** | HVAC / Ventilation Auto-Design (5th MEP discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-432-hvac-auto-design.md) |
| **ADR-433** | Fire-Protection / Sprinkler Auto-Design (7th MEP discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-433-fire-protection-auto-design.md) |
| **ADR-434** | Gas / Φυσικό Αέριο Auto-Design (8th & FINAL MEP discipline) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-434-gas-auto-design.md) |
| **ADR-435** | Coordination / Clash Detection (MEP ↔ MEP ↔ Structural) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-435-clash-detection.md) |
| **ADR-436** | BIM Foundation Discipline (Θεμελίωση: Πέδιλα, Πεδιλοδοκοί, Συνδετήριες Δοκοί, Γενική Κοιτόστρωση) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-436-bim-foundation-discipline.md) |
| **ADR-437** | Space Separation Lines (Γραμμές Διαχωρισμού Χώρου) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-437-space-separation-lines.md) |
| **ADR-438** | Audit Log Retention / TTL Policy (Πολιτική Διατήρησης Audit Logs) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-438-audit-log-retention-ttl.md) |
| **ADR-439** | Tenant Identity SSoT & Provisioning | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-439-tenant-identity-ssot-and-provisioning.md) |
| **ADR-440** | Accounting Entity-Data SSoT (partners / members / shareholders) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-440-accounting-entity-data-ssot.md) |
| **ADR-441** | Αυτόματη Εσχάρα Πεδιλοδοκών / Ενοποιημένο Πέδιλο (Foundation Strip-Grid Auto-Design) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-441-foundation-strip-grid-auto-design.md) |
| **ADR-442** | Guides & Grid Contextual Ribbon Tab (Revit-grade) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-442-guides-contextual-ribbon-tab.md) |
| **ADR-443** | Permanent «Δομικά» (Structural) Ribbon Tab (Revit-grade) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-443-structural-permanent-ribbon-tab.md) |
| **ADR-444** | Permanent «Αρχιτεκτονικά» & «ΗΛΜ» Ribbon Tabs (Revit-grade) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-444-architecture-systems-permanent-ribbon-tabs.md) |
| **ADR-445** | Per-Category Structural Colour Identity (Revit-grade) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-445-structural-category-color-identity.md) |
| **ADR-446** | 3D Visual Styles Manager (Revit-grade) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-446-3d-visual-styles-manager.md) |
| **ADR-447** | Default Structural Concrete Textures + Revit-grade Wall Type Catalog | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-447-default-concrete-textures-wall-type-catalog.md) |
| **ADR-448** | Storey-Aware DXF Viewer (όροφοι → BIM elevations, υπόγειο, θεμελίωση, multi-storey ανέγερση) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-448-storey-aware-dxf-viewer.md) |
| **ADR-449** | Structural Finish Skin (σοβάς κολόνας/δοκαριού, per-face adjacency-driven) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-449-structural-finish-skin.md) |
| **ADR-450** | Floor-elevation cascade + SSoT-unify «οροφή ορόφου» (Revit level-driven) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-450-floor-elevation-cascade-ssot-unify.md) |
| **ADR-451** | Building Vertical Setup & Floor SSoT (Revit level-driven) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-451-building-vertical-setup-floor-ssot.md) |
| **ADR-452** | Cut-Plane Slider (Revit View Range UI for the 2D plan) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-452-cut-plane-view-range-ui.md) |
| **ADR-453** | DXF Viewer Print/Export Engine (2Δ & 3Δ → PDF / Printer / Plotter) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-453-dxf-print-export-engine.md) |
| **ADR-454** | Print Plot Style (AutoCAD CTB / Revit print, 2Δ-only) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-454-print-plot-style.md) |
| **ADR-455** | Vertical Section Cuts (X/Y) with «L» slider + direction arrow | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-455-vertical-section-cuts.md) |
| **ADR-456** | Στατικά: Ποσότητες Σκυροδέματος & Οπλισμός (Structural Quantities & Reinforcement) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-456-structural-quantities-reinforcement.md) |
| **ADR-457** | Column Reinforcement Detail Sheet (Φύλλο Σχεδίου Οπλισμού Κολώνας) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-457-column-reinforcement-detail-sheet.md) |
| **ADR-458** | Beam-to-Column **Cutback** (Revit join-geometry, «η κολόνα νικάει») | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-458-beam-column-cutback.md) |
| **ADR-459** | Structural Organism / Analytical Connectivity Model | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-459-structural-organism-connectivity.md) |
| **ADR-460** | Multi-shape Column & Wall Reinforcement Automation (SSoT) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-460-multi-shape-column-reinforcement.md) |
| **ADR-461** | Special Levels: Foundation + Stair Penthouse (Revit Building-Story OFF) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-461-special-levels-foundation-stair-penthouse.md) |
| **ADR-462** | Canonical-mm Units (ΕΝΑ unit system, πάντα χιλιοστά) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-462-canonical-mm-units.md) |
| **ADR-463** | Foundation Reinforcement UX (mirror Column: Ribbon → Properties → 2Δ/3Δ → PDF → Auto) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-463-foundation-reinforcement-ux.md) |
| **ADR-464** | Advanced Footing Reinforcement & Design (full loads model, Revit-without-Robot) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-464-advanced-footing-reinforcement.md) |
| **ADR-465** | Cross-Floor Floorplan Duplicate | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-465-cross-floor-floorplan-duplicate.md) |
| **ADR-466** | Cross-Floor Entity Clipboard (Ctrl+C / Ctrl+V) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-466-cross-floor-entity-clipboard.md) |
| **ADR-467** | Load Path Engine (διαδρομή φορτίων, FEM-free) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-467-load-path-engine.md) |
| **ADR-468** | Διαχείριση Ορόφων/Υψομέτρων από τον DXF Viewer | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-468-floor-management-from-viewer.md) |
| **ADR-469** | Cross-Floor Per-Entity BIM Load (file-less / orphaned floors) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-469-cross-floor-per-entity-bim-load.md) |
| **ADR-470** | Structural Component Visibility (Σώμα / Σοβάς / Οπλισμός) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-470-structural-component-visibility.md) |
| **ADR-471** | Unified Member Reinforcement (Κολόνα + Δοκάρι) — SSoT facade & πλήρης οπλισμός δοκού | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-471-unified-member-reinforcement.md) |
| **ADR-472** | Load-Aware Strength Reinforcement Design (As από N/M) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-472-load-aware-strength-reinforcement.md) |
| **ADR-473** | Joint Reinforcement 3D Render + BOQ Takeoff | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-473-joint-reinforcement-render-takeoff.md) |
| **ADR-474** | Occupancy-Driven Auto Structural Loads (zero-input area loads) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-474-occupancy-driven-auto-loads.md) |
| **ADR-475** | Αυτόματη Διαστασιολόγηση Μελών (Serviceability-Driven, Revit-grade) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-475-auto-member-sizing.md) |
| **ADR-476** | Unified Slab Reinforcement (Οπλισμός Πλακών: εδαφόπλακα / δάπεδο / οροφή) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-476-unified-slab-reinforcement.md) |
| **ADR-477** | Foundation Tie-Beam Reinforcement: live auto re-study + ενοποίηση render (Revit-grade) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-477-tie-beam-reinforcement-unification.md) |
| **ADR-478** | Γραμμικά Φορτία Τοιχοποιίας σε Δοκούς (Wall Line-Loads, T1) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-478-wall-line-loads.md) |
| **ADR-479** | Structural Project Presets (Revit-grade templates) + reference cross-check | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-479-structural-project-presets.md) |
| **ADR-480** | Analytical Model SSoT (T2 — αναλυτικός φορέας, θεμέλιο για FEM/σεισμό) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-480-analytical-model-ssot.md) |
| **ADR-481** | Static Linear FEM Solver (T3 — 3D space-frame K·u=F → πραγματικά M/V/N) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-481-static-fem-solver.md) |
| **ADR-482** | Static Analysis UI Surface (T3-UI — κουμπί «Ανάλυση» + M/V/N readout + diagnostics) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-482-static-analysis-ui-surface.md) |
| **ADR-483** | Static Analysis Canvas Diagrams (Slice 4 διαγράμματα Μ/V/N δοκαριών κάτοψη · **Slice 5 3Δ κολώνας** · **Slice 6 3Δ δοκαριού στο κάθετο επίπεδο ανοίγματος**) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-483-static-analysis-canvas-diagrams.md) |
| **ADR-484** | Cross-level Foundation Properties (κοινός SSoT selection resolver) + διασαφήνιση ανάθεσης επιπέδου | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-484-cross-level-foundation-properties.md) |
| **ADR-485** | Reinforcement-Utilization Overlay (T3-UI / Slice 4c — χρωματισμός επάρκειας As,req/As,prov στον καμβά) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-485-utilization-overlay.md) |
| **ADR-486** | Topology-aware Beam Support Condition (DERIVED-from-connectivity SSoT) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-486-topology-aware-beam-support.md) |
| **ADR-487** | Το ΟΡΑΜΑ: Ο Δυναμικός Στατικός Οργανισμός (Living Structural Organism) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-487-living-structural-organism-vision.md) |
| **ADR-488** | Ζωντανός Στατικός Οργανισμός: Proactive FEM επανα-επίλυση (engaged latch) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-488-living-structural-organism-proactive-fem.md) |
| **ADR-489** | Στατική συνέχεια κολώνα→πέδιλο + δυναμικό βάθος θεμελίωσης | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-489-column-footing-continuity-dynamic-foundation-depth.md) |
| **ADR-490** | Structural Warning Overlay (οπτική επισήμανση μέλους με στατικό σφάλμα) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-490-structural-warning-overlay.md) |
| **ADR-491** | FEM-driven οπλισμός κολώνας στήριξης (M-N από τον φορέα, ΟΧΙ μόνο ονομαστική εκκεντρότητα) | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-491-fem-driven-column-mn-reinforcement.md) |
| **ADR-492** | Associative beam re-frame σε κάθε transform (κολώνα-move **+ Φ2** δοκάρι rotate/move/scale/mirror — το stored άκρο δοκαριού **δεν** ακολουθούσε → δοκάρι περνά μέσα από την κολώνα & προεξέχει stub· ADR-458 cutback κόβει τον όγκο αλλά αφήνει το stub γιατί το δοκάρι όντως εκτείνεται ως εκεί· **Α stored re-frame** [επιλογή Giorgio] ΟΧΙ B display-only — αναλυτικό μήκος μέλους ακολουθεί load-path/οπλισμό/FEM ADR-467/471/472/481· NEW pure `reframeBeamEndpointsToColumns` [per-end συσχέτιση πλησιέστερης **συγγραμμικής** κολώνας — ΟΧΙ span-clamped `findColumnsFramedByBeamForGraph` που χάνει το extend-back προς τα έξω· reuse `columnSupportAlong` ADR-441 face-offset SSoT· idempotent· διατηρεί perpendicular justification· δουλεύει για **κάθε γωνία** via τρέχοντα άξονα `u`] + **cascade-στην-εντολή** `cascadeBeamReframe` [Φ2 rename από `…ForColumns`· guard: moved κολώνα **ή** δοκάρι] + κοινός `reframeBeamsAndEmit` [Φ2: cascade+dedup-by-id+ΕΝΑ `bim:entities-moved`]· wire σε `Move`/**`Rotate`/`Scale`/`Mirror`**`EntityCommand` execute/undo/redo (όχι copyMode)· `RotateEntityCommand` self-emit→`commandSelfEmitsMove += Rotate` (όλα εκπέμπουν `bim:entities-moved`=organism+auto-foundation+footing-follow· μηδέν double-announce/regress ADR-459 Φ7· 3D rotate auto-covered)· **🚨 ΜΑΘΗΜΑ-FREEZE:** η αρχική υλοποίηση ήταν reactive `useBeamReframeEffect` που re-emit-άρε `bim:entities-moved`→βρόχος με engaged proactive cycle (ADR-488/491 reinforce/FEM)→storm/freeze στο «Ανάλυση»→cascade-στην-εντολή ΠΑΝΤΑ· curved/split+copy-mode+column-grip-resize DEFER) | 🟢 DONE (UNCOMMITTED· Φ1+Φ2· 42 jest GREEN· 🔴 tsc+browser-verify+commit) | 2026-06-18 | Uncategorized | [📄](./adrs/ADR-492-associative-beam-reframe-on-column-move.md) |
| **ADR-493** | Κυκλική κολώνα: (A) δοκάρι δεν κολλά στην παρειά + (B) επαλήθευση υπολογισμών. **(A) root cause** = carve-failure στο εφαπτομενικό όριο: persisted άκρο σε ΕΠΙΠΕΔΗ παρειά (x=200), ο κύκλος υποχωρεί εκατέρωθεν → beam ∩ circle ≈ 0 → `safeDifference` identity → μηνίσκος-κενό (ΟΧΙ segmentation/recession· 400×400→Ø400 ίδια παρειά). **Λύση Revit-grade καθαρά DERIVED** (μηδέν persisted churn, μηδέν ADR-492 collision): NEW pure `extendBeamOutlineIntoFramingColumns` επεκτείνει το carve-outline του πλαισιωμένου άκρου ΜΕΧΡΙ ΤΟ ΚΕΝΤΡΟ (ΟΧΙ απέναντι παρειά→far-side stubs) → `safeDifference` σκαλίζει ΑΚΡΙΒΗ άψιδα κάθε σχήματος· 2Δ committed+preview (`buildBeamCutbackDisplay`) + 3Δ (`buildBeam3DCarveOutline`)· location-line contact στο αρχικό outline. **(B)** shape-aware ✓ (ADR-460 grossArea=π(d/2)² κ.λπ.)· **διόρθωση #6** M-N μοχλοβραχίονας `0.81·d`→**πλαστικός δακτύλιος D_s/π** (`columnLeverArmMm`, EC2 §6.1 circular· conservative)· #7 σπείρα=DEFER. | 🟢 DONE (UNCOMMITTED· 7 νέα jest· 698 GREEN· 🔴 tsc+browser-verify+commit) | 2026-06-18 | Uncategorized | [📄](./adrs/ADR-493-circular-column-beam-attachment-and-calc-verification.md) |
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
| **ADR-374** | ZOOM Window Tool (AutoCAD ZOOM W) | ✅ ✅ APPROVED | [View](./adrs/ADR-374-zoom-window-tool.md) |
| **ADR-418** | Real View Scale (1:N) SSoT — Revit-style zoom indicator | ✅ ✅ APPROVED | [View](./adrs/ADR-418-view-scale-ssot.md) |

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
| **ADR-189** | Construction Grid & Guide System (Κάνναβος & Οδηγοί) | ✅ ALL COMMANDS COMPLETE ✅ + Phase 2 Enhancements (32): B1 Bubbles ✅, B2 Auto Grid ✅, B3 Dimensions ✅, B4 Lock ✅, B5 Drag ✅, B6 Colors ✅, B7 Groups ✅, B8 Guide from Entity ✅, B9 Polar Start Angle ✅, B11 Info Panel ✅, B12 Snap Midpoint ✅, B13 Keyboard Shortcuts ✅, B14 Multi-select ✅, B15 Toggle Visibility ✅, B16 Guide at Angle ✅, B17 Copy/Offset Pattern ✅, B19 Mirror ✅, B20 Undo/Redo ✅, B22 Context Menu ✅, B23 Structural Presets ✅, B24 Offset from Entity ✅, B28 Rotation ✅, B29 Rotate Group ✅, B30 Rotate All ✅, B31 Polar Array ✅, B32 Scale Grid ✅, B33 Equalize ✅, B35 Construction Line ✅, B36 Measure→Guide ✅, B37 Guide from Selection ✅, B38 Custom Labels ✅, B121 Entity→Guide ✅. 14/14 commands + 32 enhancements. | [View](./adrs/ADR-189-construction-grid-guide-system.md) |
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
| **ADR-294** | SSoT Ratchet Enforcement System | ✅ APPROVED | [View](./adrs/ADR-294-ssot-ratchet-enforcement.md) |
| **ADR-295** | Multi-Channel Photo Sharing to CRM Contacts | ✅ APPROVED | [View](./adrs/ADR-295-multi-channel-photo-sharing.md) |
| **ADR-314** | SSoT Discovery Findings & Centralization Roadmap | ✅ APPROVED | [View](./adrs/ADR-314-ssot-discovery-findings-roadmap.md) |
| **ADR-316** | Project Showcase (Επίδειξη Έργου) | ✅ 📋 In Progress | [View](./adrs/ADR-316-project-showcase.md) |
| **ADR-327** | Quote Management & Comparison System (Hybrid Scan + Vendor Portal) | ✅ APPROVED | [View](./adrs/ADR-327-quote-management-comparison-system.md) |
| **ADR-328** | Tabs SSoT Consolidation | ✅ APPROVED | [View](./adrs/ADR-328-tabs-ssot-consolidation.md) |
| **ADR-329** | Measurement Task Scope — Property-Granular Selection | ✅ APPROVED | [View](./adrs/ADR-329-measurement-task-scope-granularity.md) |
| **ADR-330** | Procurement Hub Scoped Split (Company-wide vs Project-scoped) | ✅ APPROVED | [View](./adrs/ADR-330-procurement-hub-scoped-split.md) |
| **ADR-331** | Enterprise Spend Analytics Page | ✅ APPROVED | [View](./adrs/ADR-331-enterprise-spend-analytics-page.md) |
| **ADR-332** | Enterprise Address Editor System (Full Transparency) | ✅ APPROVED | [View](./adrs/ADR-332-enterprise-address-editor-system.md) |
| **ADR-340** | Floorplan Background System (PDF + Image, single-per-floor, Procore-grade separation) | ✅ APPROVED | [View](./adrs/ADR-340-raster-background-layers-system.md) |
| **ADR-341** | UserSettings SSoT (Firestore-backed industry pattern) | ✅ APPROVED | [View](./adrs/ADR-341-user-settings-ssot.md) |
| **ADR-342** | Voice Input Field SSoT | ✅ APPROVED | [View](./adrs/ADR-342-voice-input-field-ssot.md) |
| **ADR-343** | DXF Canvas Visual Regression Test Suite | ✅ APPROVED | [View](./adrs/ADR-343-dxf-canvas-visual-regression-suite.md) |
| **ADR-344** | DXF Enterprise Text Engine (Autodesk-Grade Text Creation & Editing Suite) | ✅ APPROVED | [View](./adrs/ADR-344-dxf-enterprise-text-engine.md) |
| **ADR-345** | DXF Viewer — Ribbon Interface (AutoCAD-style) | ✅ APPROVED | [View](./adrs/ADR-345-dxf-ribbon-interface.md) |
| **ADR-346** | Auto Area Measurement (Point-and-Click) | ✅ APPROVED | [View](./adrs/ADR-346-auto-area-measurement.md) |
| **ADR-347** | Admin Console Sidebar | ✅ APPROVED | [View](./adrs/ADR-347-admin-console-sidebar.md) |
| **ADR-348** | Scale Command (Κλιμάκωση) | ✅ APPROVED | [View](./adrs/ADR-348-scale-command.md) |
| **ADR-349** | Stretch Command (Επιμήκυνση) | ✅ APPROVED | [View](./adrs/ADR-349-stretch-command.md) |
| **ADR-350** | Trim Command (Ψαλίδισμα) | ✅ APPROVED | [View](./adrs/ADR-350-trim-command.md) |
| **ADR-351** | Firebase Storage CORS Policy | ✅ APPROVED | [View](./adrs/ADR-351-firebase-storage-cors-policy.md) |
| **ADR-352** | FileRecord Query Ordering & Wipe Completeness | ✅ APPROVED | [View](./adrs/ADR-352-filerecord-ordering-wipe-completeness.md) |
| **ADR-353** | Array Commands — Rectangular, Path, Polar | ✅ APPROVED | [View](./adrs/ADR-353-array-commands.md) |
| **ADR-353** | Extend Command (Επέκταση) | ✅ APPROVED | [View](./adrs/ADR-353-extend-command.md) |
| **ADR-354** | Super Admin Company Switcher: SSOT Server + Client Override | ✅ APPROVED | [View](./adrs/ADR-354-super-admin-company-switcher-ssot-override.md) |
| **ADR-355** | Real-time Firestore Subscription SSOT Consolidation | ✅ APPROVED | [View](./adrs/ADR-355-realtime-subscription-ssot-consolidation.md) |
| **ADR-356** | Super-Admin Project Scope SSOT (server helper + client invalidation hook) | ✅ APPROVED | [View](./adrs/ADR-356-super-admin-project-scope-ssot.md) |
| **ADR-357** | DXF Line Tool: Allineamento Google-Level a CAD Professionali | ✅ APPROVED | [View](./adrs/ADR-357-dxf-line-tool-google-level.md) |
| **ADR-358** | DXF Stair Tool: Google-Level Parametric Staircase System | ✅ APPROVED | [View](./adrs/ADR-358-dxf-stair-tool-google-level.md) |
| **ADR-358** | Layer Management System (DXF-grade, Google-Level) | ✅ APPROVED | [View](./adrs/ADR-358-layer-management-system.md) |
| **ADR-359** | Auxiliary Geometry Tools: XLINE (Construction Lines) + RAY | ✅ APPROVED | [View](./adrs/ADR-359-auxiliary-geometry-tools.md) |
| **ADR-360** | Firebase Custom Claims Auto-Refresh Listener | ✅ APPROVED | [View](./adrs/ADR-360-claims-auto-refresh-listener.md) |
| **ADR-360** | Claims Auto-Refresh SSoT (Firestore Mirror) | ✅ APPROVED | [View](./adrs/ADR-360-claims-auto-refresh-ssot.md) |
| **ADR-361** | Firestore Subscribe Equality Guard (SSoT) | ✅ APPROVED | [View](./adrs/ADR-361-firestore-subscribe-equality-guard.md) |
| **ADR-367** | Firestore Internal Assertion Recovery (Single-Tab Cache + Safety Net) | ✅ APPROVED | [View](./adrs/ADR-367-firestore-internal-assertion-recovery.md) |
| **ADR-368** | DXF Import Drawing Units Override (AutoCAD/Revit Pattern) | ✅ APPROVED | [View](./adrs/ADR-368-dxf-import-drawing-units-override.md) |
| **ADR-369** | BIM Elevation Convention: Revit/Industry-Standard Alignment | ✅ APPROVED | [View](./adrs/ADR-369-bim-elevation-convention-revit-alignment.md) |
| **ADR-370** | BIM Read-Only Visualization in Properties Floorplan Tab | ✅ APPROVED | [View](./adrs/ADR-370-bim-readonly-visualization.md) |
| **ADR-371** | BIM 3D Read-Only Viewer in Properties Floorplan Tab | ✅ APPROVED | [View](./adrs/ADR-371-bim-3d-readonly-viewer.md) |
| **ADR-371** | BIM Corner Snap System (Redirect) | ✅ APPROVED | [View](./adrs/ADR-371-bim-corner-snap-system.md) |
| **ADR-372** | Contact Relationship Bidirectional Crossing Matrix | ✅ APPROVED | [View](./adrs/ADR-372-relationship-crossings-matrix.md) |
| **ADR-375** | BIM Entity Line Weight Semantic System (Revit-Equivalent) | ✅ APPROVED | [View](./adrs/ADR-375-bim-entity-line-weight-semantic-system.md) |
| **ADR-377** | BIM Subcategories System | ✅ APPROVED | [View](./adrs/ADR-377-bim-subcategories-system.md) |
| **ADR-393** | BIM Stair Extended Parametric Grips (Industry-Aligned Symmetric Pattern) | ✅ APPROVED | [View](./adrs/ADR-393-bim-stair-extended-grips.md) |
| **ADR-394** | Fit to View to Selected Entities (Z key) | ✅ APPROVED | [View](./adrs/ADR-394-fit-to-view-selected-entities.md) |
| **ADR-395** | Ενσωμάτωση BIM οντοτήτων στην καρτέλα «Επιμετρήσεις» Κτιρίου | ✅ APPROVED | [View](./adrs/ADR-395-bim-quantities-building-measurements.md) |
| **ADR-396** | Ενιαία Εξωτερική Θερμοπρόσοψη (ETICS) για BIM | ✅ APPROVED | [View](./adrs/ADR-396-bim-external-thermal-envelope-etics.md) |
| **ADR-397** | BIM Grip & Glyph Behavior System (FULL SSoT) — Wall reference → Column parity | ✅ APPROVED | [View](./adrs/ADR-397-bim-grip-glyph-behavior-ssot.md) |
| **ADR-398** | Column placement snap — beam-axis snap + ghost coloring | 🟢 DONE (UNCOMMITTED) | [View](./adrs/ADR-398-column-placement-snap.md) |
| **ADR-399** | DXF Viewer: Building Floor Navigation Tabs + Auto-Provisioned Levels | ✅ APPROVED | [View](./adrs/ADR-399-dxf-floor-navigation-tabs.md) |
| **ADR-400** | Viewport State Persistence (DXF Viewer) | ✅ APPROVED | [View](./adrs/ADR-400-viewport-state-persistence.md) |
| **ADR-401** | BIM Wall Top/Base Constraints + Attach-to-Structural (associative auto-height) | ✅ APPROVED | [View](./adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md) |
| **ADR-402** | 3D Viewport BIM Element Editing | ✅ APPROVED | [View](./adrs/ADR-402-3d-bim-element-editing.md) |
| **ADR-403** | 3D Viewport BIM Element Placement (Column) | ✅ APPROVED | [View](./adrs/ADR-403-3d-bim-element-placement.md) |
| **ADR-404** | 3D BIM Element Tilt (Slope-Based, All Axes) | ✅ APPROVED | [View](./adrs/ADR-404-3d-bim-element-tilt.md) |
| **ADR-405** | BIM Discipline Taxonomy & MEP Foundation (Step 1) | ✅ APPROVED | [View](./adrs/ADR-405-bim-discipline-taxonomy-and-mep-foundation.md) |
| **ADR-406** | Point-Based MEP Fixture (Light Fixture) — Vertical Slice (Step 3) | ✅ APPROVED | [View](./adrs/ADR-406-point-based-mep-fixture.md) |
| **ADR-407** | Κάγκελα / Κιγκλιδώματα (Railings) ως πλήρες BIM στοιχείο | ✅ APPROVED | [View](./adrs/ADR-407-bim-railings.md) |
| **ADR-408** | MEP Connectors & Systems (Connectivity Backbone) | ✅ APPROVED | [View](./adrs/ADR-408-mep-connectors-and-systems.md) |
| **ADR-409** | Πολιτική αδειοδότησης & redistribution εξωτερικών BIM βιβλιοθηκών/περιεχομένου | ✅ APPROVED | [View](./adrs/ADR-409-third-party-bim-library-licensing-policy.md) |
| **ADR-410** | Εισαγωγή CC0 επίπλων ως mesh-based BIM στοιχείο (mesh-import subsystem) | ✅ APPROVED | [View](./adrs/ADR-410-cc0-mesh-furniture-import.md) |
| **ADR-411** | BIM Mesh Library (entity-agnostic CC0 mesh assets) | ✅ APPROVED | [View](./adrs/ADR-411-bim-mesh-library.md) |
| **ADR-412** | BIM Family Types (Revit-grade Type/Instance system) | ✅ APPROVED | [View](./adrs/ADR-412-bim-family-types.md) |
| **ADR-413** | PBR Texture Maps for Parametric BIM 3D | ✅ APPROVED | [View](./adrs/ADR-413-pbr-textures-parametric-bim.md) |
| **ADR-414** | Live 3D Preview Panel για Τύπο Τοίχου (per-layer τομή + υφές + αμφίδρομο highlight) | ✅ APPROVED | [View](./adrs/ADR-414-wall-type-live-preview.md) |
| **ADR-415** | Βιβλιοθήκη 2D Αποτυπωμάτων (Floorplan Symbol Library) | ✅ APPROVED | [View](./adrs/ADR-415-2d-floorplan-symbol-library.md) |
| **ADR-417** | BIM Roof Element (Δομικό στοιχείο «Στέγη») | ✅ APPROVED | [View](./adrs/ADR-417-bim-roof-element.md) |
| **ADR-419** | Floor Finish Per Room (Revit-style IfcCovering FLOORING) | ✅ APPROVED | [View](./adrs/ADR-419-floor-finish-per-room.md) |
| **ADR-420** | BIM Floor-Scope SSoT (stable `floorId`, not volatile `floorplanId`) | ✅ APPROVED | [View](./adrs/ADR-420-bim-floor-scope-ssot.md) |
| **ADR-421** | BIM Opening Types (Revit-grade door & window catalog) | ✅ APPROVED | [View](./adrs/ADR-421-bim-opening-types-revit-grade.md) |
| **ADR-422** | BIM Μηχανολογική Μελέτη Θέρμανσης (ΤΟΤΕΕ/ΚΕΝΑΚ) | ✅ APPROVED | [View](./adrs/ADR-422-bim-heating-mechanical-study.md) |
| **ADR-423** | MEP Auto-Design Framework (Single Engine, All Disciplines) | ✅ APPROVED | [View](./adrs/ADR-423-mep-auto-design-framework.md) |
| **ADR-424** | Building Auto-Modeling Framework (Architectural + Structural from DXF) | ✅ APPROVED | [View](./adrs/ADR-424-building-auto-modeling-framework.md) |
| **ADR-425** | Stage 0 Semantic Recognition (the shared foundation) | ✅ APPROVED | [View](./adrs/ADR-425-stage0-semantic-recognition.md) |
| **ADR-426** | Water-Supply Auto-Design (the pilot discipline) | ✅ APPROVED | [View](./adrs/ADR-426-water-supply-auto-design.md) |
| **ADR-427** | Sanitary Drainage Auto-Design (the 2nd discipline) | ✅ APPROVED | [View](./adrs/ADR-427-sanitary-drainage-auto-design.md) |
| **ADR-428** | Heating (Hydronic) Auto-Design (the 3rd discipline) | ✅ APPROVED | [View](./adrs/ADR-428-heating-auto-design.md) |
| **ADR-429** | MEP Routing Brain (wall-aware A* router + parallel supply/return pairing) | ✅ APPROVED | [View](./adrs/ADR-429-mep-routing-brain.md) |
| **ADR-430** | Electrical-strong (ισχυρά) Auto-Design (the 4th discipline) | ✅ APPROVED | [View](./adrs/ADR-430-electrical-strong-auto-design.md) |
| **ADR-431** | Electrical-weak (ασθενή) Auto-Design (the 6th discipline) | ✅ APPROVED | [View](./adrs/ADR-431-electrical-weak-auto-design.md) |
| **ADR-432** | HVAC / Ventilation Auto-Design (5th MEP discipline) | ✅ APPROVED | [View](./adrs/ADR-432-hvac-auto-design.md) |
| **ADR-433** | Fire-Protection / Sprinkler Auto-Design (7th MEP discipline) | ✅ APPROVED | [View](./adrs/ADR-433-fire-protection-auto-design.md) |
| **ADR-434** | Gas / Φυσικό Αέριο Auto-Design (8th & FINAL MEP discipline) | ✅ APPROVED | [View](./adrs/ADR-434-gas-auto-design.md) |
| **ADR-435** | Coordination / Clash Detection (MEP ↔ MEP ↔ Structural) | ✅ APPROVED | [View](./adrs/ADR-435-clash-detection.md) |
| **ADR-436** | BIM Foundation Discipline (Θεμελίωση: Πέδιλα, Πεδιλοδοκοί, Συνδετήριες Δοκοί, Γενική Κοιτόστρωση) | ✅ APPROVED | [View](./adrs/ADR-436-bim-foundation-discipline.md) |
| **ADR-437** | Space Separation Lines (Γραμμές Διαχωρισμού Χώρου) | ✅ APPROVED | [View](./adrs/ADR-437-space-separation-lines.md) |
| **ADR-438** | Audit Log Retention / TTL Policy (Πολιτική Διατήρησης Audit Logs) | ✅ APPROVED | [View](./adrs/ADR-438-audit-log-retention-ttl.md) |
| **ADR-439** | Tenant Identity SSoT & Provisioning | ✅ APPROVED | [View](./adrs/ADR-439-tenant-identity-ssot-and-provisioning.md) |
| **ADR-440** | Accounting Entity-Data SSoT (partners / members / shareholders) | ✅ APPROVED | [View](./adrs/ADR-440-accounting-entity-data-ssot.md) |
| **ADR-441** | Αυτόματη Εσχάρα Πεδιλοδοκών / Ενοποιημένο Πέδιλο (Foundation Strip-Grid Auto-Design) | ✅ APPROVED | [View](./adrs/ADR-441-foundation-strip-grid-auto-design.md) |
| **ADR-442** | Guides & Grid Contextual Ribbon Tab (Revit-grade) | ✅ APPROVED | [View](./adrs/ADR-442-guides-contextual-ribbon-tab.md) |
| **ADR-443** | Permanent «Δομικά» (Structural) Ribbon Tab (Revit-grade) | ✅ APPROVED | [View](./adrs/ADR-443-structural-permanent-ribbon-tab.md) |
| **ADR-444** | Permanent «Αρχιτεκτονικά» & «ΗΛΜ» Ribbon Tabs (Revit-grade) | ✅ APPROVED | [View](./adrs/ADR-444-architecture-systems-permanent-ribbon-tabs.md) |
| **ADR-445** | Per-Category Structural Colour Identity (Revit-grade) | ✅ APPROVED | [View](./adrs/ADR-445-structural-category-color-identity.md) |
| **ADR-446** | 3D Visual Styles Manager (Revit-grade) | ✅ APPROVED | [View](./adrs/ADR-446-3d-visual-styles-manager.md) |
| **ADR-447** | Default Structural Concrete Textures + Revit-grade Wall Type Catalog | ✅ APPROVED | [View](./adrs/ADR-447-default-concrete-textures-wall-type-catalog.md) |
| **ADR-448** | Storey-Aware DXF Viewer (όροφοι → BIM elevations, υπόγειο, θεμελίωση, multi-storey ανέγερση) | ✅ APPROVED | [View](./adrs/ADR-448-storey-aware-dxf-viewer.md) |
| **ADR-449** | Structural Finish Skin (σοβάς κολόνας/δοκαριού, per-face adjacency-driven) | ✅ APPROVED | [View](./adrs/ADR-449-structural-finish-skin.md) |
| **ADR-450** | Floor-elevation cascade + SSoT-unify «οροφή ορόφου» (Revit level-driven) | ✅ APPROVED | [View](./adrs/ADR-450-floor-elevation-cascade-ssot-unify.md) |
| **ADR-451** | Building Vertical Setup & Floor SSoT (Revit level-driven) | ✅ APPROVED | [View](./adrs/ADR-451-building-vertical-setup-floor-ssot.md) |
| **ADR-452** | Cut-Plane Slider (Revit View Range UI for the 2D plan) | ✅ APPROVED | [View](./adrs/ADR-452-cut-plane-view-range-ui.md) |
| **ADR-453** | DXF Viewer Print/Export Engine (2Δ & 3Δ → PDF / Printer / Plotter) | ✅ APPROVED | [View](./adrs/ADR-453-dxf-print-export-engine.md) |
| **ADR-454** | Print Plot Style (AutoCAD CTB / Revit print, 2Δ-only) | ✅ APPROVED | [View](./adrs/ADR-454-print-plot-style.md) |
| **ADR-455** | Vertical Section Cuts (X/Y) with «L» slider + direction arrow | ✅ APPROVED | [View](./adrs/ADR-455-vertical-section-cuts.md) |
| **ADR-456** | Στατικά: Ποσότητες Σκυροδέματος & Οπλισμός (Structural Quantities & Reinforcement) | ✅ APPROVED | [View](./adrs/ADR-456-structural-quantities-reinforcement.md) |
| **ADR-457** | Column Reinforcement Detail Sheet (Φύλλο Σχεδίου Οπλισμού Κολώνας) | ✅ APPROVED | [View](./adrs/ADR-457-column-reinforcement-detail-sheet.md) |
| **ADR-458** | Beam-to-Column **Cutback** (Revit join-geometry, «η κολόνα νικάει») | ✅ APPROVED | [View](./adrs/ADR-458-beam-column-cutback.md) |
| **ADR-459** | Structural Organism / Analytical Connectivity Model | ✅ APPROVED | [View](./adrs/ADR-459-structural-organism-connectivity.md) |
| **ADR-460** | Multi-shape Column & Wall Reinforcement Automation (SSoT) | ✅ APPROVED | [View](./adrs/ADR-460-multi-shape-column-reinforcement.md) |
| **ADR-461** | Special Levels: Foundation + Stair Penthouse (Revit Building-Story OFF) | ✅ APPROVED | [View](./adrs/ADR-461-special-levels-foundation-stair-penthouse.md) |
| **ADR-462** | Canonical-mm Units (ΕΝΑ unit system, πάντα χιλιοστά) | ✅ APPROVED | [View](./adrs/ADR-462-canonical-mm-units.md) |
| **ADR-463** | Foundation Reinforcement UX (mirror Column: Ribbon → Properties → 2Δ/3Δ → PDF → Auto) | ✅ APPROVED | [View](./adrs/ADR-463-foundation-reinforcement-ux.md) |
| **ADR-464** | Advanced Footing Reinforcement & Design (full loads model, Revit-without-Robot) | ✅ APPROVED | [View](./adrs/ADR-464-advanced-footing-reinforcement.md) |
| **ADR-465** | Cross-Floor Floorplan Duplicate | ✅ APPROVED | [View](./adrs/ADR-465-cross-floor-floorplan-duplicate.md) |
| **ADR-466** | Cross-Floor Entity Clipboard (Ctrl+C / Ctrl+V) | ✅ APPROVED | [View](./adrs/ADR-466-cross-floor-entity-clipboard.md) |
| **ADR-467** | Load Path Engine (διαδρομή φορτίων, FEM-free) | ✅ APPROVED | [View](./adrs/ADR-467-load-path-engine.md) |
| **ADR-468** | Διαχείριση Ορόφων/Υψομέτρων από τον DXF Viewer | ✅ APPROVED | [View](./adrs/ADR-468-floor-management-from-viewer.md) |
| **ADR-469** | Cross-Floor Per-Entity BIM Load (file-less / orphaned floors) | ✅ APPROVED | [View](./adrs/ADR-469-cross-floor-per-entity-bim-load.md) |
| **ADR-470** | Structural Component Visibility (Σώμα / Σοβάς / Οπλισμός) | ✅ APPROVED | [View](./adrs/ADR-470-structural-component-visibility.md) |
| **ADR-471** | Unified Member Reinforcement (Κολόνα + Δοκάρι) — SSoT facade & πλήρης οπλισμός δοκού | ✅ APPROVED | [View](./adrs/ADR-471-unified-member-reinforcement.md) |
| **ADR-472** | Load-Aware Strength Reinforcement Design (As από N/M) | ✅ APPROVED | [View](./adrs/ADR-472-load-aware-strength-reinforcement.md) |
| **ADR-473** | Joint Reinforcement 3D Render + BOQ Takeoff | ✅ APPROVED | [View](./adrs/ADR-473-joint-reinforcement-render-takeoff.md) |
| **ADR-474** | Occupancy-Driven Auto Structural Loads (zero-input area loads) | ✅ APPROVED | [View](./adrs/ADR-474-occupancy-driven-auto-loads.md) |
| **ADR-475** | Αυτόματη Διαστασιολόγηση Μελών (Serviceability-Driven, Revit-grade) | ✅ APPROVED | [View](./adrs/ADR-475-auto-member-sizing.md) |
| **ADR-476** | Unified Slab Reinforcement (Οπλισμός Πλακών: εδαφόπλακα / δάπεδο / οροφή) | ✅ APPROVED | [View](./adrs/ADR-476-unified-slab-reinforcement.md) |
| **ADR-477** | Foundation Tie-Beam Reinforcement: live auto re-study + ενοποίηση render (Revit-grade) | ✅ APPROVED | [View](./adrs/ADR-477-tie-beam-reinforcement-unification.md) |
| **ADR-478** | Γραμμικά Φορτία Τοιχοποιίας σε Δοκούς (Wall Line-Loads, T1) | ✅ APPROVED | [View](./adrs/ADR-478-wall-line-loads.md) |
| **ADR-479** | Structural Project Presets (Revit-grade templates) + reference cross-check | ✅ APPROVED | [View](./adrs/ADR-479-structural-project-presets.md) |
| **ADR-480** | Analytical Model SSoT (T2 — αναλυτικός φορέας, θεμέλιο για FEM/σεισμό) | ✅ APPROVED | [View](./adrs/ADR-480-analytical-model-ssot.md) |
| **ADR-481** | Static Linear FEM Solver (T3 — 3D space-frame K·u=F → πραγματικά M/V/N) | ✅ APPROVED | [View](./adrs/ADR-481-static-fem-solver.md) |
| **ADR-482** | Static Analysis UI Surface (T3-UI — κουμπί «Ανάλυση» + M/V/N readout + diagnostics) | ✅ APPROVED | [View](./adrs/ADR-482-static-analysis-ui-surface.md) |
| **ADR-483** | Static Analysis Canvas Diagrams (Slice 4 διαγράμματα Μ/V/N δοκαριών κάτοψη · **Slice 5 3Δ κολώνας** · **Slice 6 3Δ δοκαριού στο κάθετο επίπεδο ανοίγματος**) | ✅ APPROVED | [View](./adrs/ADR-483-static-analysis-canvas-diagrams.md) |
| **ADR-484** | Cross-level Foundation Properties (κοινός SSoT selection resolver) + διασαφήνιση ανάθεσης επιπέδου | ✅ APPROVED | [View](./adrs/ADR-484-cross-level-foundation-properties.md) |
| **ADR-485** | Reinforcement-Utilization Overlay (T3-UI / Slice 4c — χρωματισμός επάρκειας As,req/As,prov στον καμβά) | ✅ APPROVED | [View](./adrs/ADR-485-utilization-overlay.md) |
| **ADR-486** | Topology-aware Beam Support Condition (DERIVED-from-connectivity SSoT) | ✅ APPROVED | [View](./adrs/ADR-486-topology-aware-beam-support.md) |
| **ADR-487** | Το ΟΡΑΜΑ: Ο Δυναμικός Στατικός Οργανισμός (Living Structural Organism) | ✅ APPROVED | [View](./adrs/ADR-487-living-structural-organism-vision.md) |
| **ADR-488** | Ζωντανός Στατικός Οργανισμός: Proactive FEM επανα-επίλυση (engaged latch) | ✅ APPROVED | [View](./adrs/ADR-488-living-structural-organism-proactive-fem.md) |
| **ADR-489** | Στατική συνέχεια κολώνα→πέδιλο + δυναμικό βάθος θεμελίωσης | ✅ APPROVED | [View](./adrs/ADR-489-column-footing-continuity-dynamic-foundation-depth.md) |
| **ADR-490** | Structural Warning Overlay (οπτική επισήμανση μέλους με στατικό σφάλμα) | ✅ APPROVED | [View](./adrs/ADR-490-structural-warning-overlay.md) |
| **ADR-491** | FEM-driven οπλισμός κολώνας στήριξης (M-N από τον φορέα, ΟΧΙ μόνο ονομαστική εκκεντρότητα) | ✅ APPROVED | [View](./adrs/ADR-491-fem-driven-column-mn-reinforcement.md) |
| **ADR-493** | Κυκλική κολώνα: σύνδεση δοκαριού στην παρειά (derived carve-extension) + επαλήθευση υπολογισμών (M-N lever arm circular) | ✅ APPROVED | [View](./adrs/ADR-493-circular-column-beam-attachment-and-calc-verification.md) |
| **ADR-494** | Footprint-based kind-agnostic αναγνώριση στήριξης δοκαριού→κολώνας (L/T/U/I/τοιχείο/polygon — λύνει cantilever bug σε αλλαγή τύπου) | ✅ APPROVED | [View](./adrs/ADR-494-footprint-based-kind-agnostic-beam-column-framing.md) |
| **ADR-495** | Slab→Beam load propagation (slab-aware δοκός tributary — η πλάκα/πρόβολος φορτίζει τον οργανισμό· mirror ADR-478) | ✅ Slice 1 | [View](./adrs/ADR-495-slab-beam-load-propagation.md) |
| **ADR-496** | Έξυπνη ευθυγράμμιση κολώνας στα πλαισιωτικά δοκάρια κατά την αλλαγή τύπου (Phase 1 L-shape bearing-arm· **Phase 2 T-shape dual-beam T-junction**· **Phase 3 L-shape dual-leg corner** — Γ σε γωνία με 2 κάθετα δοκάρια, handedness cross-product· command-time, full re-study) | ✅ Phase 3 | [View](./adrs/ADR-496-smart-column-type-change-align-to-beam.md) |
| **ADR-497** | FEM-authoritative axial — single source of truth κολώνα-N→πέδιλο (engaged FEM υπερισχύει του grid-tributary· ο πρόβολος ADR-495 φτάνει στο πέδιλο· mirror ADR-491) | ✅ Slice 2A | [View](./adrs/ADR-497-fem-authoritative-axial-footing.md) |
| **ADR-498** | Cantilever-aware slab design (πλάκα-πρόβολος → q·L²/2 hogging άνω σχάρα + L/d warning· topology-aware spatial, mirror ADR-486) | ✅ Slice 1+2 | [View](./adrs/ADR-498-cantilever-slab-design.md) |
| **ADR-499** | Αυτο-διορθούμενος οργανισμός: flexural-capacity ceiling (M_Ed ≤ M_Rd,lim· cap αντί ψεύτικου Ø25/75) + auto-size διατομών (πλάκα-πρόβολος πάχος + ορθογ. κολώνα διατομή· member-generic AutoSizeMembersCommand) + στρέψη δοκού-προβόλου (v1 sensor: T_Ed/T_Rd,max diagnostic) + global feasibility escalation (error «ανέφικτο στο max» — η έσχατη παρέμβαση) + πλήρες EC2 §6.3 torsion actuator §6.3-a plumbing (torsionTubeProperties+shearTorsionUtilization SSoT + BeamTorsionStore + designTorsionKnm context) + §6.3-b section-grow (iterative torsionDepthMm ώστε T/T_Rd+V/V_Rd≤1, η δοκός μεγαλώνει ύψος μόνη της) + §6.3-c στρεπτικός οπλισμός (A_st/s κλειστοί + A_sl διαμήκεις, in-place bump· render+ΠΟΣΟΤΗΤΕΣ auto-follow)· υλοποιεί ADR-487 | 🟡 A+B1+B2+C(v1)+D + πλήρες §6.3 actuator | [View](./adrs/ADR-499-auto-correcting-organism.md) |
| **ADR-500** | «Αυτόματη Μελέτη»: ντετερμινιστικός βρόχος σύγκλισης (ADR-487 §7) — ENORΧΗΣΤΡΩΝΕΙ load/size/reinforce/footing/diagnostics cores σε σύγχρονο one-shot loop «δοκίμασε→έλεγξε→διόρθωσε→ξανά» μέχρι μηδέν κόκκινο ή MAX_STUDY_ROUNDS=10· 2 SSoT extractions (organism-core + auto-foundation-core)· atomic undo (execute→appendToLast)· exit-to-human (ADR-490 overlay)· FEM engaged-gated· κανένα νέο reactive trigger | 🟡 Slice 1 | [View](./adrs/ADR-500-auto-study-convergence-loop.md) |
| **ADR-501** | DXF Grip Multi-Arm + Group Move (AutoCAD/Revit hot-grips) — κλικ cold λαβή→πορτοκαλί 'armed' (GripArmedStore SSoT + 'armed' temperature)· shift+click multi· **Slice 2: window/marquee πάνω σε λαβές→arm many** (ArmableGripsStore event-time SSoT + runGripMarqueeArm reuse selectItemsInMarquee+armMany· consume μόνο αν ≥1 λαβή μέσα· shift add/plain replace)· click-vs-drag threshold (no drag regression)· Esc/click-away clear· render thread ADR-040-safe (useSyncExternalStore low-freq) | 🟡 Slices 1+2 (Slice 3 group-move+numeric DEFER) | [View](./adrs/ADR-501-dxf-grip-multi-arm-group-move.md) |
| **ADR-502** | Live reaction-aware takedown (ADR-487 §4): πρόβολος-πλάκα → δοκάρι → **αμφότερες** κολώνες (διατομή+οπλισμός) → **αμφότερα** πέδιλα, LIVE σε κάθε αλλαγή χωρίς κουμπί. Slice 1 = reaction-aware axial (`buildColumnCantileverReaction` στο `load-path-takedown` — overhang που το grid αγνοεί → στηρίζουσες κολώνες, scoped→μηδέν double-count/regression· ρέει σε size/reinforce/footing μέσω appliedLoad)· Slice 2 = static column support-moment (NEW `column-support-moment` SSoT `w·L²/2` reuse `beamDesignMomentNmm` + `ColumnSupportMomentStore` + `resolveActiveColumnDesignMoment` ιεραρχία **FEM ?? static**, 4 consumers). Reaction-aware takedown (Revit/Robot-grade), ΟΧΙ live FEM· μηδέν νέος reactive trigger (μάθημα ADR-491). +11 jest | 🟡 Slice 1+2 (full reaction tree + position-weighted = DEFER) | [View](./adrs/ADR-502-live-reaction-aware-takedown.md) |
| **ADR-503** | Two-way auto-size + safety-gated lock (ADR-487 §4/§5/§8.4): η εφαρμογή «έξυπνη» — διατομή+οπλισμός αυτο-προσαρμόζονται ώστε μηδέν υπο/υπερ-διαστασιολόγηση (αρχιτέκτονας βάζει default χωρίς στατικά). **Slice 1 DONE**: `suggestColumnSection` two-way (μεγαλώνει+**μικραίνει** στο ελάχιστο επαρκές `s×s`, αφαίρεση grow-only `Math.max`) + NEW `MAX_AXIAL_LOAD_RATIO=0.65` ν-floor EC8 στο `columnSectionFits` (η πύλη που κάνει το shrink ασφαλές)· square-only v1· live-verified (400×400→300×300, ν=0.49). **Slice 2 DONE** (safety-gated lock κολώνας): NEW `isColumnSectionAdequate` + ΕΝΑ SSoT `resolveColumnSectionLock` (de-dup `rectangularSectionFits`/`columnDimensionFloorMm`)· wired panel (`useColumnParamsDispatcher`)+grip (`commitColumnGripDrag`): manual≥επαρκές→lock· <επαρκές→ΜΠΛΟΚ (clamp στο ελάχιστο, μένει AUTO)+toast (`bim:column-section-rejected`, stable id, i18n el+en). **Slice 3 DONE** (organism-wide lock-gate): οι sizers ήταν ήδη two-way → προστέθηκε ΜΟΝΟ το reject-if-inadequate per-member. Δοκός `isBeamSectionAdequate`/`resolveBeamSectionLock` (`beam-size-patch`, depth-driven)→grip+panel· Πλάκα `isSlabSectionAdequate`/`resolveSlabSectionLock` (`slab-size-patch`)→`useSlabParamsDispatcher` (που δεν κλείδωνε)· Πέδιλο NEW `pad-size-patch` (lock-flag=reuse `autoDesigned`· `buildPadSizingInput` κολώνα+φορτίο+σ)→grip+`useRibbonFoundationBridge`. 3 per-member toast events+i18n el+en. +22 jest (88 sizing) | 🟡 Slice 1+2+3 | [View](./adrs/ADR-503-two-way-auto-size-safety-gated-lock.md) |
| **ADR-504** | Practical-span advisory + opt-in ενδιάμεσες κολώνες (ADR-487 §8.4): μη-πρακτικά βαθιά δοκός (κόβει καθαρό ύψος κάτω της, όπου μπαίνουν κουφώματα) → soft `warning` + πρόταση «πόσες ενδιάμεσες κολώνες», ΟΧΙ σιωπηλά (αίθριο/πυλωτή θέλουν το μεγάλο δοκάρι). **Φάση 1 DONE**: NEW `clear-height-under-beam.ts` (SSoT καθαρού ύψους, **δυναμικό** threshold = ύψος ορόφου − required clear· ΝΟΚ/Κτιριοδομικός Άρθρο 8 = 2,00m + κούφωμα 2,20m + ΚΠΝ στάθμευσης 1,90m) + NEW `practical-span-checks.ts` (`runPracticalSpanChecks` reuse `suggestBeamSection` για το «πόσες κολόνες»· skip locked/πρόβολος/<2 στηρίξεις) + `beamSpanImpractical` code + wiring ΕΝΑ σημείο στον organism core (storey-aware) + i18n el+en + 12 jest. Practical ≠ Feasible (soft warning κάτω από το hard cap 1500· διαφορετικός code). Μηδέν μετάλλαξη σκηνής. **Φάση 2 S0-S3 DONE** (Α + Robot-grade: `'continuous'` divisor 10 + συμμετρικός οπλισμός + l/d K=1.5· NEW `derive-beam-span-model.ts`+`beam-span-store.ts`+`resolveActiveBeamSpanMm`· `buildBeamSectionContext(+sizingSpanOverrideMm)` w-invariant threaded 18 αρχεία· Φ1 alignment· 13 jest)· **S4-S6 DONE** (NEW `intermediate-column-placement.ts` even-split+clone διατομής Enterprise IDs N.6· NEW `analytical/beam-interior-supports.ts`+`analytical-model-builder` FEM subdivision συνεχούς δοκού ADR-480/481· NEW pure `add-intermediate-columns-command.ts` `CompoundCommand[CreateColumnsCommand]` ΕΝΑ undo + `ui/structural-warnings/IntermediateColumnsAction.tsx` opt-in confirm στο BeamAdvancedPanel· πέδιλα+resize proactive· 22 jest) | 🟡 Φ1 DONE · Φ2 DONE (browser-verify+commit pending) | [View](./adrs/ADR-504-practical-span-intermediate-columns.md) |
| **ADR-505** | Unified Export System (DXF/IFC4/PDF, scope-filtered, multi-floor): εξαγωγή οντοτήτων DXF & BIM σε αρχείο από `/dxf/viewer`· φίλτρο περιεχομένου (μόνο DXF / μόνο BIM / και τα δύο)· scope ορόφων (ενεργός / όλοι→ZIP ανά όροφο / όλοι→ένα αρχείο με `FLnn_` layer-prefix). DXF πλήρες pipeline (NEW `export/` φάκελος: `export-entity-scope` reuse `isBimEntity`, `bim-to-dxf-primitives` reuse `BimEntity.geometry`, `export-floor-scope`, owned zero-dep `zip-pack` STORED writer, **`dxf-ascii-writer` client-side DXF R12 — μηδέν backend/Docker**, `dxf-export-adapter`+merge, `export-service` facade)· IFC4/PDF μέσω **delegation** στα canonical engines (ADR-369 `IfcExportHost` / ADR-453 `PrintHost`, μηδέν διπλός κώδικας)· UI `ExportHost`+`ExportDialog` (ADR-040-safe, Radix Select ADR-001) + ribbon `EXPORT_PANEL` + i18n el/en. 37 jest, tsc clean | 🟡 DXF DONE · IFC/PDF delegation (browser-verify+commit pending) | [View](./adrs/ADR-505-unified-export-system.md) |
| **ADR-506** | Auto-διαστασιολόγηση ΠΛΑΤΟΥΣ δοκαριού (ADR-487 §4, επεκτείνει ADR-475 depth-only): το δοκάρι βαθαίνει μέχρι το **δυναμικό όριο ΝΟΚ** (`practicalBeamDepthLimitMm` = ύψος ορόφου − ελεύθερο ύψος κάτω από δοκό για κούφωμα/πόρτα, SSoT ADR-504) και **μετά φαρδαίνει** αντί να βαθαίνει. **Two-way** πλάτος (φαρδαίνει+στενεύει στο ελάχιστο επαρκές, floor 150, όπως κολώνες ADR-503) με **cap = πλάτος στηρίζουσας κολώνας** (κάθετη προβολή footprint, `projectPolygonOnAxis`, min επί στηρίξεων). **Μονόδρομο (Revit-like):** η κολώνα ΔΕΝ μεγαλώνει από το δοκάρι (αποφυγή cascade/σεισμικής σύζευξης)· υπερβολικό άνοιγμα → `governedBy:'width-capped'` → ADR-504 ενδιάμεση κολώνα. **Independent lock** `BeamParams.autoSizedWidth` (χειροκίνητο πλάτος κλειδώνει μόνο το πλάτος, ύψος μένει AUTO). NEW `BeamMaxWidthStore`+`derive-beam-max-width`+`resolveActiveBeamSizingLimits`· `member-sizing` width-aware (depth-helpers παραμετρικά σε width· serviceability width-independent — σωστή φυσική)· wired AutoSizeMembers+grip+panel. 44 jest (+40 regression) | 🟡 IMPLEMENTED (browser-verify+commit pending) | [View](./adrs/ADR-506-beam-width-auto-sizing.md) |
| **ADR-508** | Unified Linear-Member Framing SSoT (δοκάρι + τοίχος, ένα έξυπνο φάντασμα): εξαγωγή του smart beam ghost (ADR-398 §3.3–§3.6) σε generic `bim/framing/` (`linear-member-face-snap` T-framing 🟢/κοντή-άκρη 🔴 + `isMemberCollinearOverlap`, `member-column-face-snap` 12-θέσεων, `member-ghost-snap` column-priority dispatcher, `member-snap-targets` generic collector, `member-column-flush` geometric auto-flush, `member-face-third` leaf). Beam files → thin adapters (byte-for-byte tests). Τοίχος mirror δοκαριού: ghost-before-click + **2-κλικ** (κατάργηση 3ου κλικ ευθυγράμμισης· auto-flush σε κολόνα), κουμπώνει σε **τοίχους+κολώνες+δοκάρια**, 🔴 overlap block. `PreviewRenderer` αμετάβλητος (entity-agnostic `ghostStatusColor`). 99 jest | 🟡 IMPLEMENTED (browser-verify+commit pending) | [View](./adrs/ADR-508-unified-linear-member-framing.md) |
| **ADR-509** | Background-Adaptive Entity Color (contrast-safe σε κάθε φόντο): ο near-black τοίχος `#2b2f36` εξαφανιζόταν στο μαύρο `#000000` canvas. NEW 2D-render-time SSoT `config/color-math.ts` (parseHex/luminance601/srgbRelativeLuminance/contrastRatio/mixHex — de-dup του private math στο print-color-policy) + `config/adaptive-entity-color.ts` (`adaptEntityColorForCanvas` reads live `resolveDxfCanvasBackgroundHex`, memoized· MIN_ENTITY_CONTRAST=3.0 WCAG AA). Μόνο near-black/near-bg χρώματα αλλάζουν (κορεσμένα beam/column/slab = no-op). Wire WallRenderer + DxfRenderer (live branch· print/3D άθικτα — δεν μπήκε στον κοινό resolver). 27 jest. | 🟡 IMPLEMENTED (wall+DXF· λοιπά BIM renderers on-touch· browser-verify+commit pending) | [View](./adrs/ADR-509-adaptive-entity-color.md) |
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
