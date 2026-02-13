# 📋 **ARCHITECTURAL DECISION RECORDS (ADRs) INDEX**

> **Complete Enterprise ADR Registry**
>
> Single source of truth για όλες τις αρχιτεκτονικές αποφάσεις της εφαρμογής
>
> ⚠️ **AUTO-GENERATED FILE** - Do not edit manually!
> Run `node docs/centralized-systems/reference/scripts/generate-adr-index.cjs` to regenerate.

**📊 Stats**: 152 ADRs + 11 Accounting ADRs (ACC-xxx) | Last Updated: 2026-02-12

---

## 🎯 **QUICK NAVIGATION**

| Category | Count | Quick Jump |
|----------|-------|------------|
| 📐 **Domain - Geometry** | 1 | [View](#domain-geometry) |
| 🎨 **UI Components** | 12 | [View](#ui-components) |
| 🎨 **Design System** | 7 | [View](#design-system) |
| 🖼️ **Canvas & Rendering** | 39 | [View](#canvas-rendering) |
| 📊 **Data & State** | 11 | [View](#data-state) |
| ✏️ **Drawing System** | 16 | [View](#drawing-system) |
| 📂 **Entity Systems** | 11 | [View](#entity-systems) |
| 🔧 **Tools & Keyboard** | 8 | [View](#tools-keyboard) |
| 🔍 **Filters & Search** | 1 | [View](#filters-search) |
| 🔒 **Security & Auth** | 8 | [View](#security-auth) |
| 🔧 **Backend Systems** | 7 | [View](#backend-systems) |
| 🛠️ **Infrastructure** | 3 | [View](#infrastructure) |
| ⚡ **Performance** | 4 | [View](#performance) |
| 📄 **Uncategorized** | 12 | [View](#uncategorized) |
| 🧮 **Accounting Subapp** | 11 | [View](#accounting-subapp-adrs-separate-numbering--acc-xxx) |

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
| **ADR-025** | Unit Linking System | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-025-unit-linking-system.md) |
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
| **ADR-054** | Enterprise Upload System Consolidation | ✅ STABILIZED | 2026-02-13 | Entity Systems | [📄](./adrs/ADR-054-enterprise-upload-system-consolidation.md) |
| **ADR-055** | Centralized Tool State Persistence | ✅ APPROVED | 2026-01-01 | Tools & Keyboard | [📄](./adrs/ADR-055-centralized-tool-state-persistence.md) |
| **ADR-056** | Centralized Entity Completion Styles | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-056-centralized-entity-completion-styles.md) |
| **ADR-057** | Unified Entity Completion Pipeline | ✅ APPROVED | 2026-01-01 | Drawing System | [📄](./adrs/ADR-057-unified-entity-completion-pipeline.md) |
| **ADR-058** | Canvas Drawing Primitives (Arc via Ellipse) | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-058-canvas-drawing-primitives-arc-via-ellipse.md) |
| **ADR-059** | Separate /api/audit/bootstrap from /api/projects/list | ✅ ✅ Active | 2026-01-11 | Backend Systems | [📄](./adrs/ADR-059-separate-audit-bootstrap-from-projects-list.md) |
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
| **ADR-078** | Server-Side Unit Creation via Admin SDK | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-078-server-side-unit-creation.md) |
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
| **ADR-090** | IKA/EFKA Labor Compliance System | ✅ IMPLEMENTED - Phase 1-3 + Phase 4A (QR+GPS, ADR-170) | 2026-02-09 | Backend Systems / Labor Compliance | [📄](./adrs/ADR-090-ika-efka-labor-compliance-system.md) |
| **ADR-091** | Scattered Code Centralization (Fonts + Formatting) | ✅ APPROVED | 2026-01-01 | Design System | [📄](./adrs/ADR-091-scattered-code-centralization-fonts-formatting.md) |
| **ADR-092** | Centralized localStorage Service | ✅ APPROVED | 2026-01-01 | Infrastructure | [📄](./adrs/ADR-092-centralized-localstorage-service.md) |
| **ADR-093** | Text Label Offsets Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-093-text-label-offsets-centralization.md) |
| **ADR-094** | Device Pixel Ratio Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-094-device-pixel-ratio-centralization.md) |
| **ADR-095** | Snap Tolerance Centralization | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-095-snap-tolerance-centralization.md) |
| **ADR-096** | Interaction Timing Constants Centralization | ✅ APPROVED | 2026-01-31 | Tools & Keyboard | [📄](./adrs/ADR-096-interaction-timing-constants-centralization.md) |
| **ADR-098** | Timing Delays Centralization (setTimeout/setInterval) | ✅ APPROVED | 2026-01-31 | Tools & Keyboard | [📄](./adrs/ADR-098-timing-delays-centralization-settimeout-setinterva.md) |
| **ADR-099** | Polygon & Measurement Tolerances Centralization | ✅ APPROVED | 2026-01-31 | Drawing System | [📄](./adrs/ADR-099-polygon-measurement-tolerances-centralization.md) |
| **ADR-100** | JIT User Profile Sync (Firestore /users/{uid}) | ✅ IMPLEMENTED | 2026-02-08 | Security & Auth | [📄](./adrs/ADR-100-user-profile-sync.md) |
| **ADR-101** | Deep Clone Centralization | ✅ APPROVED | 2026-01-31 | Data & State | [📄](./adrs/ADR-101-deep-clone-centralization.md) |
| **ADR-103** | Availability Check & AI Operator Briefing | ✅ IMPLEMENTED | 2026-02-08 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-103-availability-check-operator-briefing.md) |
| **ADR-102** | Origin Markers Centralization (DXF/Layer/Debug) | ✅ APPROVED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-102-origin-markers-centralization-dxf-layer-debug.md) |
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
| **ADR-131** | Multi-Intent Pipeline — Πολλαπλά Intents σε Ένα Μήνυμα | ✅ IMPLEMENTED | 2026-02-09 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-131-multi-intent-pipeline.md) |
| **ADR-132** | ESCO Professional Classification Integration (Occupations + Skills) | ✅ IMPLEMENTED | 2026-02-09 | Contact Management / CRM | [📄](./adrs/ADR-132-esco-professional-classification.md) |
| **ADR-133** | SVG Stroke Width Centralization | ✅ IMPLEMENTED | 2026-02-01 | Design System | [📄](./adrs/ADR-133-svg-stroke-width-centralization.md) |
| **ADR-134** | UC Modules Expansion + Telegram Channel — Omnichannel AI Pipeline | ✅ IMPLEMENTED | 2026-02-09 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-134-uc-modules-expansion-telegram-channel.md) |
| **ADR-145** | Super Admin AI Assistant — Omnichannel Admin Command System | ✅ IMPLEMENTED | 2026-02-09 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-145-super-admin-ai-assistant.md) |
| **ADR-171** | Autonomous AI Agent with Agentic Tool Calling | ✅ IMPLEMENTED | 2026-02-10 | AI Architecture / Pipeline Infrastructure | [📄](./adrs/ADR-171-autonomous-ai-agent.md) |
| **ADR-172** | Pre-Production Code Quality Audit & Remediation | ✅ IN_PROGRESS | 2026-02-10 | Security & Auth / Infrastructure | [📄](./adrs/ADR-172-pre-production-audit-remediation.md) |
| **ADR-173** | Enterprise AI Self-Improvement System | ✅ ACTIVE | 2026-02-10 | AI Architecture / Self-Improvement | [📄](./adrs/ADR-173-ai-self-improvement-system.md) |
| **ADR-174** | Meta Omnichannel — WhatsApp + Messenger + Instagram | ✅ PHASE 1+2 OPERATIONAL (WhatsApp + Messenger live), Phase 3 code ready | 2026-02-11 | Communications / Omnichannel | [📄](./adrs/ADR-174-meta-omnichannel-whatsapp-messenger-instagram.md) |
| **ADR-135** | Menu Icons Centralization | ✅ IMPLEMENTED | 2026-02-01 | UI Components | [📄](./adrs/ADR-135-menu-icons-centralization.md) |
| **ADR-136** | Canvas Opacity Constants Centralization (Extended) | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-136-canvas-opacity-constants-centralization-extended.md) |
| **ADR-137** | Snap Icon Geometry Centralization | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-137-snap-icon-geometry-centralization.md) |
| **ADR-138** | Overlay Dimensions Centralization | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-138-overlay-dimensions-centralization.md) |
| **ADR-139** | Label Box Dimensions Centralization | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-139-label-box-dimensions-centralization.md) |
| **ADR-140** | Angle Measurement Visualization Constants | ✅ IMPLEMENTED | 2026-01-01 | Canvas & Rendering | [📄](./adrs/ADR-140-angle-measurement-visualization-constants.md) |
| **ADR-143** | Origin/Cursor Offset Constants Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-143-origin-cursor-offset-constants-centralization.md) |
| **ADR-144** | Icon Click Sequence Colors Centralization | ✅ IMPLEMENTED | 2026-02-01 | UI Components | [📄](./adrs/ADR-144-icon-click-sequence-colors-centralization.md) |
| **ADR-146** | Canvas Size Observer Hook Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-146-canvas-size-observer-hook-centralization.md) |
| **ADR-150** | Arrow Head Size Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-150-arrow-head-size-centralization.md) |
| **ADR-151** | Grip Tolerance Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-151-grip-tolerance-centralization.md) |
| **ADR-152** | Simple Coordinate Transform Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-152-simple-coordinate-transform-centralization.md) |
| **ADR-153** | Snap Tooltip Offset Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-153-snap-tooltip-offset-centralization.md) |
| **ADR-154** | Grip Line Width Centralization | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-154-grip-line-width-centralization.md) |
| **ADR-156** | Voice Message Transcription (OpenAI Whisper) | ✅ IMPLEMENTED | 2026-02-09 | Backend Systems | [📄](./adrs/ADR-156-voice-message-transcription-whisper.md) |
| **ADR-158** | Origin Axis Label Offsets Centralization (X/Y axis labels) | ✅ IMPLEMENTED | 2026-02-01 | Canvas & Rendering | [📄](./adrs/ADR-158-origin-axis-label-offsets-centralization-x-y-axis-.md) |
| **ADR-159** | Measurement Text Colors Separation (ANGLE vs DISTANCE) | ✅ IMPLEMENTED | 2026-02-01 | Drawing System | [📄](./adrs/ADR-159-measurement-text-colors-separation-angle-vs-distan.md) |
| **ADR-160** | Internal Angle Arc Rendering (dot product logic) | ✅ IMPLEMENTED | 2026-02-01 | Drawing System | [📄](./adrs/ADR-160-internal-angle-arc-rendering-dot-product-logic.md) |
| **ADR-161** | Global Voice Assistant (Header Microphone) | ✅ IMPLEMENTED | 2026-02-09 | Frontend / Backend | [📄](./adrs/ADR-161-global-voice-assistant.md) |
| **ADR-164** | In-App Voice AI Pipeline (Right-Side Chat Panel) | ✅ IMPLEMENTED | 2026-02-09 | AI Pipeline / Voice / UX | [📄](./adrs/ADR-164-in-app-voice-ai-pipeline.md) |
| **ADR-165** | Entity Validation Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-165-entity-validation-centralization.md) |
| **ADR-166** | GAP_TOLERANCE, ARC_TESSELLATION & Ghost Colors Centralization | ✅ APPROVED | 2026-01-01 | Uncategorized | [📄](./adrs/ADR-166-gap-tolerance-arc-ghost-centralization.md) |
| **ADR-167** | Enterprise Project Address System | ✅ ✅ APPROVED | 2026-02-02 | Entity Systems | [📄](./adrs/ADR-167-enterprise-project-address-system.md) |
| **ADR-168** | Multi-Agent Development Environment | ✅ IMPLEMENTED | 2026-02-05 | Infrastructure | [📄](./adrs/ADR-168-multi-agent-development-environment.md) |
| **ADR-169** | Modular AI Architecture - Enterprise Automation Platform | ✅ DRAFT - Requirements Gathering | 2026-02-07 | AI Architecture / Enterprise Automation | [📄](./adrs/ADR-169-modular-ai-architecture.md) |
| **ADR-170** | Construction Worker Attendance — QR Code + GPS Geofencing + Photo | ✅ IMPLEMENTED | 2026-02-09 | Backend Systems / Labor Compliance | [📄](./adrs/ADR-170-attendance-qr-gps-verification.md) |
| **ADR-175** | Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ) | ✅ PHASE_1B_IMPLEMENTED | 2026-02-12 | Construction Management / BOQ | [📄](./adrs/ADR-175-quantity-surveying-measurements-system.md) |
| **ADR-176** | DXF Viewer Mobile Responsive Refactoring | ✅ APPROVED | 2026-02-12 | UI Components | [📄](./adrs/ADR-176-dxf-viewer-mobile-responsive.md) |
| **ADR-177** | Employer Picker — Entity Linking with Company Contacts | ✅ IMPLEMENTED | 2026-02-13 | UI Components / Data Quality | [📄](./adrs/ADR-177-employer-picker-entity-linking.md) |
| **ADR-178** | Contact Relationship Auto-Save UX (PendingRelationshipGuard) | ✅ IMPLEMENTED | 2026-02-13 | UX / Contact Relationships | [📄](./adrs/ADR-178-contact-relationship-auto-save-ux.md) |
| **ADR-018.1** | Photos Tab Base Template | ✅ APPROVED | 2026-01-01 | Entity Systems | [📄](./adrs/ADR-018-1-photos-tab-base-template.md) |
| **ADR-020.1** | Conditional App Shell Layout | ✅ APPROVED | 2026-01-01 | Security & Auth | [📄](./adrs/ADR-020-1-conditional-app-shell-layout.md) |
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
| **ADR-025** | Unit Linking System | ✅ APPROVED | [View](./adrs/ADR-025-unit-linking-system.md) |
| **ADR-052** | DXF Export API Contract | ✅ APPROVED | [View](./adrs/ADR-052-dxf-export-api-contract.md) |
| **ADR-054** | Enterprise Upload System Consolidation | ✅ APPROVED | [View](./adrs/ADR-054-enterprise-upload-system-consolidation.md) |
| **ADR-104** | Entity Type Guards Centralization | ✅ APPROVED | [View](./adrs/ADR-104-entity-type-guards-centralization.md) |
| **ADR-129** | Layer Entity Filtering Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-129-layer-entity-filtering-centralization.md) |
| **ADR-130** | Default Layer Name Centralization | ✅ IMPLEMENTED | [View](./adrs/ADR-130-default-layer-name-centralization.md) |
| **ADR-167** | Enterprise Project Address System | ✅ ✅ APPROVED | [View](./adrs/ADR-167-enterprise-project-address-system.md) |
| **ADR-177** | Employer Picker — Entity Linking with Company Contacts | ✅ IMPLEMENTED | [View](./adrs/ADR-177-employer-picker-entity-linking.md) |
| **ADR-178** | Contact Relationship Auto-Save UX (PendingRelationshipGuard) | ✅ IMPLEMENTED | [View](./adrs/ADR-178-contact-relationship-auto-save-ux.md) |
| **ADR-018.1** | Photos Tab Base Template | ✅ APPROVED | [View](./adrs/ADR-018-1-photos-tab-base-template.md) |

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
| **ADR-100** | JIT User Profile Sync (Firestore /users/{uid}) | ✅ IMPLEMENTED | [View](./adrs/ADR-100-user-profile-sync.md) |
| **ADR-020.1** | Conditional App Shell Layout | ✅ APPROVED | [View](./adrs/ADR-020-1-conditional-app-shell-layout.md) |

---

## 🔧 **BACKEND SYSTEMS**

| ADR | Decision | Status | Link |
|-----|----------|--------|------|
| **ADR-059** | Separate /api/audit/bootstrap from /api/projects/list | ✅ ✅ Active | [View](./adrs/ADR-059-separate-audit-bootstrap-from-projects-list.md) |
| **ADR-060** | Migrate BuildingFloorplanService to Enterprise Storage Architecture | ✅ ✅ Active | [View](./adrs/ADR-060-building-floorplan-enterprise-storage.md) |
| **ADR-070** | Email & AI Ingestion System | ✅ ✅ FULLY OPERATIONAL (OpenAI Active) | [View](./adrs/ADR-070-email-ai-ingestion-system.md) |
| **ADR-131** | Multi-Intent Pipeline — Πολλαπλά Intents σε Ένα Μήνυμα | ✅ IMPLEMENTED | [View](./adrs/ADR-131-multi-intent-pipeline.md) |
| **ADR-134** | UC Modules Expansion + Telegram Channel — Omnichannel AI Pipeline | ✅ IMPLEMENTED | [View](./adrs/ADR-134-uc-modules-expansion-telegram-channel.md) |
| **ADR-145** | Super Admin AI Assistant — Omnichannel Admin Command System | ✅ IMPLEMENTED | [View](./adrs/ADR-145-super-admin-ai-assistant.md) |
| **ADR-156** | Voice Message Transcription (OpenAI Whisper) | ✅ IMPLEMENTED | [View](./adrs/ADR-156-voice-message-transcription-whisper.md) |
| **ADR-161** | Global Voice Assistant (Header Microphone) | ✅ IMPLEMENTED | [View](./adrs/ADR-161-global-voice-assistant.md) |
| **ADR-164** | In-App Voice AI Pipeline (Right-Side Chat Panel) | ✅ IMPLEMENTED | [View](./adrs/ADR-164-in-app-voice-ai-pipeline.md) |

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
| **ADR-078** | Server-Side Unit Creation via Admin SDK | ✅ APPROVED | [View](./adrs/ADR-078-server-side-unit-creation.md) |
| **ADR-079** | AI Inbox Real-Time Updates via Firestore onSnapshot | ✅ APPROVED | [View](./adrs/ADR-079-ai-inbox-realtime-updates.md) |
| **ADR-165** | Entity Validation Centralization | ✅ APPROVED | [View](./adrs/ADR-165-entity-validation-centralization.md) |
| **ADR-166** | GAP_TOLERANCE, ARC_TESSELLATION & Ghost Colors Centralization | ✅ APPROVED | [View](./adrs/ADR-166-gap-tolerance-arc-ghost-centralization.md) |
| **ADR-UI-001** | Visual Primitive Ownership & Semantic Tokens | ✅ APPROVED | [View](./adrs/ADR-UI-001.md) |

---

## 📝 **ADDING NEW ADRs**

### 🔢 ΔΙΑΘΕΣΙΜΑ IDs (χρησιμοποίησε αυτά ΠΡΩΤΑ):

```
034, 065, 066, 067, 068, 070, 071, 072, 073, 074,
077, 078, 079, 080, 089, 090, 100, 103, 121, 131,
156, 161, 164
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

---

## 🧮 **ACCOUNTING SUBAPP ADRs** (Separate Numbering — ACC-xxx)

> **📍 Location**: `src/subapps/accounting/docs/adrs/` — Portable subapp with independent ADR numbering
>
> **Status**: Phase 1 COMPLETE (2026-02-10) — Sole Proprietor (Ατομική Επιχείρηση)

| ADR | Decision | Status | Date | Link |
|-----|----------|--------|------|------|
| **ADR-ACC-000** | Founding Decision — Enterprise Accounting Subapp | ✅ ACTIVE | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-000-founding-decision.md) |
| **ADR-ACC-001** | Chart of Accounts — Λογιστικό Σχέδιο ΕΛΠ (24 categories) | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-001-chart-of-accounts.md) |
| **ADR-ACC-002** | Invoicing System — Σύστημα Τιμολόγησης (7 types) | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-002-invoicing-system.md) |
| **ADR-ACC-003** | myDATA / ΑΑΔΕ Integration | ⏳ DRAFT | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-003-mydata-aade-integration.md) |
| **ADR-ACC-004** | VAT Engine — Μηχανή ΦΠΑ | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-004-vat-engine.md) |
| **ADR-ACC-005** | AI Document Processing — Expense Tracker (OpenAI Vision) | ✅ IMPLEMENTED | 2026-02-10 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-005-ai-document-processing.md) |
| **ADR-ACC-006** | EFKA Contribution Tracking | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-006-efka-contribution-tracking.md) |
| **ADR-ACC-007** | Fixed Assets & Depreciation | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-007-fixed-assets-depreciation.md) |
| **ADR-ACC-008** | Bank Reconciliation | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-008-bank-reconciliation.md) |
| **ADR-ACC-009** | Tax Engine | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-009-tax-engine.md) |
| **ADR-ACC-010** | Portability & Abstraction Layers | ✅ IMPLEMENTED | 2026-02-09 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-010-portability-abstraction-layers.md) |
| **ADR-ACC-011** | Service Presets | ✅ IMPLEMENTED | 2026-02-10 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-011-service-presets.md) |
| **ADR-ACC-012** | OE Partnership Support (Ομόρρυθμη Εταιρεία) | ✅ IMPLEMENTED | 2026-02-10 | [📄](../../../src/subapps/accounting/docs/adrs/ADR-ACC-012-oe-partnership-support.md) |

---

*Auto-generated by generate-adr-index.cjs*
*Based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems, SAP, Google*
