# ADR-265: Enterprise Reports System — Research & Architecture

**Status**: PHASE 1 COMPLETE (Core Primitives) | PHASE 2 COMPLETE (Data Layer) | PHASE 3 COMPLETE (Navigation + i18n) | PHASE 4 COMPLETE (Executive Summary) | PHASE 5 COMPLETE (Financial) | PHASE 6 COMPLETE (Sales & Collections) | PHASE 7 COMPLETE (Projects & Buildings) | PHASE 8 COMPLETE (CRM & Pipeline) | PHASE 9 COMPLETE (Contacts) | PHASE 10 COMPLETE (Spaces) | PHASE 11 COMPLETE (Construction) | PHASE 12 COMPLETE (Compliance) | PHASE 13 COMPLETE (Export Center)
**Date**: 2026-03-28
**Author**: Claude (Orchestrator) + 6 Research Agents

### Changelog
| Date | Phase | Changes |
|------|-------|---------|
| 2026-03-28 | Phase 1 | Core Primitives — 12 UI components in `src/components/reports/core/` |
| 2026-03-28 | Phase 2 | Data Layer — 6 files in `src/services/report-engine/`: evm-calculator, aging-calculator, report-data-aggregator, report-pdf-exporter, report-excel-exporter, index barrel |
| 2026-03-28 | Phase 3 | Navigation + i18n — 10 sub-items in sidebar, 9 sub-pages in `/reports/*`, path mappings, navigation labels (en+el) |
| 2026-03-28 | Phase 4 | Executive Summary — `useExecutiveReport` hook, 5 section components (PortfolioKPIs, ProjectHealthTable, RevenueTrendChart, TopOverdueCard, PipelineSummary), updated `/reports` page, executive i18n keys (en+el) |
| 2026-03-28 | Phase 5 | Financial — API route `/api/reports/financial`, `useFinancialReport` hook, 5 section components (EVMDashboard, EVMTrendChart, CostVarianceWaterfall, CashFlowForecast, RevenueRecognition), financial i18n keys (en+el) |
| 2026-03-28 | Phase 6 | Sales & Collections — API route `/api/reports/sales`, `useSalesReport` hook, 6 section components (SalesKPIs, PaymentStatusChart, ChequeStatusChart, LegalPhaseChart, ConversionFunnelChart, OverdueAgingSection), sales i18n keys (en+el) |
| 2026-03-28 | Phase 7 | Projects & Buildings — API route `/api/reports/projects`, `useProjectsReport` hook, 8 section components (ProjectsKPIs, ProjectStatusChart, ProjectProgressChart, UnitStatusChart, RevenueByProjectChart, PricePerSqmChart, BOQVarianceChart, EnergyClassDistribution), extended aggregator with buildings+BOQ+energy data, projects i18n keys (en+el) |
| 2026-03-28 | Phase 8 | CRM & Pipeline — API route `/api/reports/crm`, `useCrmReport` hook, 6 section components (CrmKPIs, PipelineFunnelChart, TaskDistributionChart, CommunicationChannelChart, LeadSourceChart, TeamPerformanceChart), extended aggregator with leadsBySource+teamPerformance+avgDeal+directions, crm i18n keys (en+el) |
| 2026-03-28 | Phase 9 | Contacts — API route `/api/reports/contacts`, `useContactsReport` hook, 5 section components (ContactsKPIs, ContactDistributionChart, PersonaDistributionChart, GeographicDistributionChart, TopBuyersTable), extended aggregator with topBuyers+completenessRate, contacts i18n keys (en+el) |
| 2026-03-28 | Phase 10 | Spaces — API route `/api/reports/spaces`, `useSpacesReport` hook, 4 section components (SpacesKPIs, ParkingOccupancyChart, StorageUtilizationChart, SpaceValueByBuildingChart), extended aggregator with byBuilding+soldCount+avgPricePerSqm, spaces i18n keys (en+el) |
| 2026-03-28 | Phase 11 | Construction — API route `/api/reports/construction`, `useConstructionReport` hook, 4 section components (ConstructionKPIs, MilestoneCompletionChart, PhaseProgressChart, BOQCostBreakdownChart), EVM CPI/SPI per building, BOQ estimated vs actual, construction i18n keys (en+el) |
| 2026-03-28 | Phase 12 | Compliance — API route `/api/reports/compliance`, `useComplianceReport` hook, 3 section components (ComplianceKPIs, AttendanceMethodChart, InsuranceClassChart), extended aggregator from stub to real queries (attendance_events+employment_records), compliance i18n keys (en+el) |
| 2026-03-28 | Phase 13 | Export Center — `useExportCenter` hook, 2 section components (ExportDomainGrid, ExportStatusPanel), 9-domain card grid with PDF/Excel per domain, dynamic import of exporters, job status tracking, exportCenter i18n keys (en+el) |
**Scope**: Full application reporting — all domains except DXF Viewer & Geo Canvas

---

## 1. EXECUTIVE SUMMARY

Enterprise-grade Reports System covering all application domains with:
- On-screen interactive dashboards (recharts)
- PDF export (jspdf + jspdf-autotable, Greek Roboto font)
- Excel multi-sheet export (exceljs with styled headers)
- Charts: pie, bar, line, area, waterfall, heatmap, histogram
- Fully centralized: design system tokens, semantic colors, i18n, SSoT

**Infrastructure already exists (90%)**. No new libraries needed.

---

## 2. NAVIGATION PLACEMENT

### Top-Level Section in Sidebar

```
REPORTS (FileBarChart icon, displayOrder: 75)
├── Overview Dashboard      /reports
├── Contacts & Customers    /reports/contacts
├── Projects & Buildings    /reports/projects
├── Sales & Financial       /reports/sales
├── CRM & Pipeline          /reports/crm
├── Spaces (Parking/Storage)/reports/spaces
├── Construction & Timeline /reports/construction
└── Export Center           /reports/export
```

**Integration**: `src/config/smart-navigation-factory.ts` → add baseItem with subItems

---

## 3. DOMAIN RESEARCH FINDINGS

### 3.1 Contacts & Customers

**Firestore Collections**: `contacts`, `contact_links`, `contact_relationships`

**Key Types**:
- `Contact = IndividualContact | CompanyContact | ServiceContact`
- `ContactType = 'individual' | 'company' | 'service'`
- `ContactStatus = 'active' | 'inactive' | 'archived'`
- 9 Persona Types: construction_worker, engineer, accountant, lawyer, property_owner, client, supplier, notary, real_estate_agent
- 32 Relationship Types across 5 categories (employment, corporate, government, professional, property)

**Report Data Points**:
| Metric | Source | Aggregation |
|--------|--------|-------------|
| Contacts by type | contacts.type | COUNT GROUP BY type |
| Contacts by status | contacts.status | COUNT GROUP BY status |
| New contacts per period | contacts.createdAt | COUNT WHERE createdAt BETWEEN |
| Contacts by persona | contacts.personas[].personaType | COUNT per personaType |
| Top buyers by value | units.commercial.buyerContactId + finalPrice | SUM finalPrice GROUP BY buyer |
| Buyers by project | units.commercial.buyerContactId + unit.project | COUNT GROUP BY project |
| Relationship network | contact_relationships | COUNT GROUP BY type |
| Profile completeness | contacts fields filled | % of required fields |
| Geographic distribution | contacts.addresses[].city | COUNT GROUP BY city |

**Existing Hooks/Services**: `ContactsService`, `ContactRelationshipService`, `DuplicatePreventionService`

---

### 3.2 Projects, Buildings, Units

**Firestore Collections**: `projects`, `buildings`, `units`, `floors`, `building_milestones`, `construction_phases`, `construction_tasks`, `boq_items`, `boq_categories`

**Key Types**:
- `ProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'`
- `ProjectType = 'residential' | 'commercial' | 'industrial' | 'mixed' | 'infrastructure' | 'renovation'`
- Building: status, progress (0-100), totalArea, totalValue, floors, energyClass
- Unit: operationalStatus (5 states), commercialStatus (7 states), areas (gross/net/balcony/terrace/garden), layout (bedrooms/bathrooms), orientations, energy class
- BOQ: estimatedQuantity, actualQuantity, materialUnitCost, laborUnitCost, equipmentUnitCost

**Hierarchy**: Project → Building → Floor → Unit (+ ParkingSpot + Storage)

**Report Data Points**:
| Metric | Source | Aggregation |
|--------|--------|-------------|
| Projects by status | projects.status | COUNT GROUP BY status |
| Projects by type | projects.type | COUNT GROUP BY type |
| Total portfolio value | projects.totalValue | SUM |
| Average progress | projects.progress | AVG |
| Buildings per project | buildings WHERE projectId | COUNT GROUP BY projectId |
| Units by type | units.type | COUNT GROUP BY type |
| Units by commercial status | units.commercialStatus | COUNT GROUP BY status |
| Available vs sold | units.commercialStatus | COUNT WHERE sold vs for-sale |
| Total area by project | units.areas.gross | SUM GROUP BY project |
| Revenue by project | units.commercial.finalPrice | SUM WHERE sold GROUP BY project |
| Price per m2 by building | units.commercial.finalPrice / areas.gross | AVG GROUP BY building |
| BOQ estimated vs actual | boq_items costs | SUM estimated vs SUM actual |
| Construction progress | construction_phases.progress | WEIGHTED AVG |
| Milestone completion | building_milestones.status | COUNT GROUP BY status |
| Energy class distribution | units.energy.class | COUNT GROUP BY class |

**Existing Hooks**: `useProjectsStats`, `useBuildingStats`, `useEntityStats`, `useBOQItems`, `useBuildingMilestones`

---

### 3.3 Sales & Financial

**Firestore Collections**: `units` (commercial data), `payment_plans` (subcollection), `payments` (subcollection), `cheques`, `legal_contracts`, `brokerage_agreements`, `commission_records`

**Key Types**:
- PaymentPlan: status FSM (negotiation→draft→active→completed), installments[], loans[]
- LoanTracking: 15-stage FSM, multi-bank support, disbursements[]
- ChequeRecord: 10-state FSM, endorsement chain, bounce workflow
- LegalContract: 3 phases (preliminary→final→payoff), 4 statuses
- BrokerageAgreement: exclusivity, commission types (%, fixed, tiered)

**Financial Intelligence (ALREADY BUILT)**:
- NPV Calculator (Euribor rates, bank spread)
- DSCR Stress Testing
- Monte Carlo Simulation
- Equity Waterfall
- Sensitivity Analysis (tornado + heatmap)
- Forward Curves
- Hedging Comparison
- Budget Variance (waterfall chart)
- Debt Maturity Wall
- Counterproposal Analysis

**Report Data Points**:
| Metric | Source | Aggregation |
|--------|--------|-------------|
| Total revenue | units.commercial.finalPrice | SUM WHERE sold |
| Revenue by period | units.commercial.saleDate + finalPrice | SUM GROUP BY month/quarter |
| Pipeline value | units.commercial.askingPrice WHERE for-sale | SUM |
| Conversion rate | sold / (sold + for-sale) | RATIO |
| Payment coverage | paymentSummary.paidPercentage | AVG |
| Overdue installments | paymentSummary.overdueInstallments | SUM |
| Outstanding amount | paymentSummary.remainingAmount | SUM |
| Cheque status | cheques.status | COUNT GROUP BY status |
| Bounced cheques | cheques WHERE status=bounced | COUNT |
| Loan disbursement | loanTracking.disbursedAmount | SUM |
| Loan by bank | loanTracking.bankName | SUM GROUP BY bank |
| Legal phase | units.commercial.legalPhase | COUNT GROUP BY phase |
| Commission due | commission_records WHERE pending | SUM |
| Portfolio NPV | CostCalculationResult.npv | AGGREGATE |
| Time cost of money | CostCalculationResult.timeCost | SUM |
| Avg collection days | PortfolioSummary.weightedAvgCollectionDays | WEIGHTED AVG |

**Existing Services**: `PaymentPlanService`, `PaymentReportService`, `LoanTrackingService`, `ChequeRegistryService`, `LegalContractService`, `BrokerageService`

---

### 3.4 CRM & Communications

**Firestore Collections**: `opportunities`, `communications`, `messages`, `conversations`, `tasks`, `appointments`, `notifications`, `calendar`, `external_identities`

**Key Types**:
- Opportunity: 8 pipeline stages, probability, estimatedValue, source (6 types)
- Communication: 7 types (email/phone/sms/whatsapp/telegram/meeting/note), direction, AI intent analysis
- CrmTask: 8 types, 4 statuses, 4 priorities, recurrence support
- CalendarEvent: unified from tasks + appointments
- Notification: 5 severities, delivery states, multi-channel

**Report Data Points**:
| Metric | Source | Aggregation |
|--------|--------|-------------|
| Pipeline by stage | opportunities.stage | COUNT + SUM estimatedValue GROUP BY stage |
| Win rate | closed_won / (closed_won + closed_lost) | RATIO |
| Avg deal value | opportunities.estimatedValue WHERE won | AVG |
| Leads by source | opportunities.source | COUNT GROUP BY source |
| Tasks by status | tasks.status | COUNT GROUP BY status |
| Tasks by priority | tasks.priority | COUNT GROUP BY priority |
| Overdue tasks | tasks WHERE status!=completed AND dueDate < today | COUNT |
| Communications by channel | communications.type | COUNT GROUP BY type |
| Inbound vs outbound | communications.direction | COUNT GROUP BY direction |
| Response time | communications timestamps | AVG difference |
| Team performance | tasks.assignedTo + completedAt | COUNT completed GROUP BY user |
| Calendar density | calendar events per period | COUNT GROUP BY week |

**Existing Hooks**: `useRealtimeOpportunities`, `useRealtimeTasks` (with TaskStats), `useConversations`

---

### 3.5 Parking, Storage, Spaces

**Firestore Collections**: `parking_spots`, `storage_units`, `units`

**Key Types**:
- ParkingSpot: 5 types (standard/handicapped/motorcycle/electric/visitor), 5 statuses, 5 location zones
- Storage: 9 types, 6 statuses, area (m2), price
- LinkedSpace: spaceId, spaceType, inclusion, includedInSale, salePrice
- SpaceCommercialData: askingPrice, finalPrice, buyerContactId

**Report Data Points**:
| Metric | Source | Aggregation |
|--------|--------|-------------|
| Parking by status | parking_spots.status | COUNT GROUP BY status |
| Parking by type | parking_spots.type | COUNT GROUP BY type |
| Parking by zone | parking_spots.locationZone | COUNT GROUP BY zone |
| Parking by building | parking_spots.buildingId | COUNT GROUP BY building |
| Parking utilization | occupied / total | RATIO |
| Parking total value | parking_spots.price | SUM |
| Storage by status | storage_units.status | COUNT GROUP BY status |
| Storage by type | storage_units.type | COUNT GROUP BY type |
| Storage total area | storage_units.area | SUM |
| Storage avg price/m2 | storage_units.price / area | AVG |
| Linked vs unlinked | units.linkedSpaces vs standalone | COUNT |
| Sales rate | sold / total | RATIO per space type |

**Existing Hooks**: `useParkingStats` (ParkingStats interface), `useStorageStats` (StorageStats interface)

---

## 4. CENTRALIZED SYSTEMS TO USE (Πλήρης Αναφορά — Έρευνα 2026-03-28)

> **ΚΑΝΟΝΑΣ SSoT**: Κάθε component/hook/service που αναφέρεται εδώ είναι **ΥΠΟΧΡΕΩΤΙΚΟ** να χρησιμοποιηθεί.
> ΜΗΝ δημιουργείς νέα components αν υπάρχουν ήδη κεντρικοποιημένα. Επέκτεινε τα υπάρχοντα.

---

### 4.1 Design System — 9 Enterprise Hooks (SSoT)

| Hook | Import | Περιγραφή | Key Return Values |
|------|--------|-----------|-------------------|
| **useSemanticColors** | `@/hooks/useSemanticColors` | Semantic colors (bg, text, border) | `text.success/error/warning/info/primary/muted`, `bg.primary/secondary/card/hover/elevated` |
| **useSpacingTokens** | `@/hooks/useSpacingTokens` | Spacing SSoT (padding, margin, gap) | `base.xs→2xl (4→48px)`, `padding.{top/bottom/x/y}`, `margin.*`, `gap.*`, `spaceBetween.*` |
| **useBorderTokens** | `@/hooks/useBorderTokens` | Borders SSoT (519+ uses) | `width.*`, `colors.*`, `radius.{xs→full}`, `variants.{card/button/input/modal}`, `getVariantClass()` |
| **useIconSizes** | `@/hooks/useIconSizes` | Icon sizing SSoT | `xxs→xl (h-3→h-8)`, `xl2→xl12 (48→192px)`, `numeric.*` for SVG libraries |
| **useLayoutClasses** | `@/hooks/useLayoutClasses` | Layout patterns SSoT | `flexCenterGap2`, `gridCols2Gap4`, `responsiveFlexRow`, `listGapResponsive`, `pageHeaderPadding` |
| **useTypography** | `@/hooks/useTypography` | Typography SSoT (186+ uses) | `display`, `h1→h4`, `body`, `caption`, `label` |
| **usePositioningTokens** | `@/hooks/usePositioningTokens` | Positioning SSoT | `top/right/bottom/left/inset.{xs→full}` |
| **useDropdownTokens** | `@/hooks/useDropdownTokens` | Dropdown dimensions SSoT | `trigger.{sm/md/lg}`, `content.*`, `item.*`, `separator.*` |
| **useButtonPatterns** | `@/hooks/useButtonPatterns` | Button combinations SSoT | `outlineSmall`, `ghostSmall`, `edit`, `delete`, `save`, `cancel`, `create` |

**Architecture (3-Layer)**:
1. **Semantic Layer**: `src/design-system/` — Framework-agnostic tokens, `color-bridge.ts` (337 lines, SSoT)
2. **Token Layer**: `src/styles/design-tokens.ts` — componentSizes, DIALOG_SIZES, gridPatterns, zIndex, breakpoints
3. **Adapter Layer**: `src/ui-adapters/react/useSemanticColors.ts` — Pure mapping facade

**CSS Variables**: Defined in `src/app/globals.css` + auto-generated `src/styles/design-system/generated/variables.css`

**Effects**: `src/components/ui/effects.tsx` — `INTERACTIVE_PATTERNS` (CARD_STANDARD, BUTTON_OVERLAY, etc.), `TRANSITION_PRESETS`, `HOVER_COLOR_EFFECTS`

---

### 4.2 Chart System

**Location**: `src/components/ui/chart/`

| Component | Import | Χρήση |
|-----------|--------|-------|
| **ChartContainer** | `@/components/ui/chart` | Recharts wrapper, theme context, responsive |
| **ChartTooltip** | `@/components/ui/chart` | Barrel export for tooltip system |
| **ChartTooltipContent** | `@/components/ui/chart` | Formatted tooltip rendering |
| **ChartLegend** | `@/components/ui/chart` | Legend with icon/label support |
| **ChartLegendContent** | `@/components/ui/chart` | Legend rendering component |
| **ChartStyle** | `@/components/ui/chart` | CSS-in-JS theme injector (dark/light) |

**ChartConfig Interface**:
```typescript
type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<'light' | 'dark', string> }
  )
}
```

**Recharts Components σε χρήση**: ResponsiveContainer, BarChart, LineChart, AreaChart, PieChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend

**Lazy Loading**: `ChartContainerLazy` from `@/components/common/LazyComponents`

---

### 4.3 UI Components

#### Cards & Containers
| Component | Import | Variants/Props |
|-----------|--------|----------------|
| **Card/CardHeader/CardTitle/CardContent/CardFooter** | `@/components/ui/card` | Standard React HTMLAttributes, border tokens |
| **BaseCard** | `@/components/core/BaseCard` | `variant: 'default'│'bordered'│'elevated'│'minimal'`, `size: 'sm'│'md'│'lg'`, selection, favorites, actions, image, loading |

#### Tables
| Component | Import | Features |
|-----------|--------|----------|
| **Table/TableHeader/TableBody/TableRow/TableCell** | `@/components/ui/table` | `size: 'default'│'compact'`, TableSizeContext propagation |

#### Tabs
| Component | Import | Features |
|-----------|--------|----------|
| **Tabs/TabsList/TabsTrigger/TabsContent** | `@/components/ui/tabs` | Semantic colors, flex-1 expansion |

#### Buttons & Badges
| Component | Import | Variants |
|-----------|--------|----------|
| **Button** | `@/components/ui/button` | `variant: 'default'│'destructive'│'outline'│'secondary'│'ghost'│'link'`, `size: 'default'│'sm'│'xs'│'lg'│'icon'│'icon-sm'` |
| **Badge** | `@/components/ui/badge` | 12 variants: default, secondary, destructive, outline, success, warning, info, error, purple, light, muted, subtle. `size: 'default'│'sm'│'lg'` |

#### Form Elements
| Component | Import | Key Props |
|-----------|--------|-----------|
| **Select/SelectTrigger/SelectValue/SelectContent/SelectItem** | `@/components/ui/select` | `size: 'sm'│'md'│'lg'`, dropdown tokens |
| **Input** | `@/components/ui/input` | `size: 'sm'│'md'│'lg'`, `hasLeftIcon/hasRightIcon` |
| **Checkbox** | `@/components/ui/checkbox` | Radix UI based |
| **Label** | `@/components/ui/label` | Form labels |

#### Dialogs & Overlays
| Component | Import | Key Props |
|-----------|--------|-----------|
| **Dialog/DialogContent/DialogHeader/DialogTitle** | `@/components/ui/dialog` | `size: 'sm'│'default'│'lg'│'xl'│'2xl'│'fullscreen'` |
| **ConfirmDialog/DeleteConfirmDialog/WarningConfirmDialog** | `@/components/ui/ConfirmDialog` | `variant: 'default'│'destructive'│'warning'`, loading state |
| **Popover/PopoverTrigger/PopoverContent** | `@/components/ui/popover` | Portal-based, animation |
| **DropdownMenu/DropdownMenuItem/DropdownMenuCheckboxItem** | `@/components/ui/dropdown-menu` | Full Radix dropdown |

#### Other UI
| Component | Import | Χρήση |
|-----------|--------|-------|
| **Separator** | `@/components/ui/separator` | Visual dividers |
| **Skeleton** | `@/components/ui/skeleton` | Loading placeholders |
| **Progress** | `@/components/ui/progress` | Progress bars |
| **Accordion** | `@/components/ui/accordion` | Collapsible sections |
| **ScrollArea** | `@/components/ui/scroll-area` | Custom scrolling |
| **Spinner** | `@/components/ui/spinner` | `size: 'small'│'medium'│'large'`, semantic icon sizes |

---

### 4.4 Dashboard & Statistics

| Component | Import | Key Props |
|-----------|--------|-----------|
| **UnifiedDashboard** | `@/components/property-management/dashboard/UnifiedDashboard` | `stats: DashboardStat[]`, `columns?: number` (default 6), `onCardClick?`, 10 colors (blue/green/purple/orange/cyan/pink/gray/red/yellow/indigo), trend support |
| **StatsCard** | `@/components/property-management/dashboard/StatsCard` | `title`, `value`, `icon`, `color`, `onClick?`, `loading?` |

**DashboardStat Interface**:
```typescript
interface DashboardStat {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'gray' | 'red' | 'yellow' | 'indigo';
  trend?: { value: number; label: string };
  loading?: boolean;
}
```

---

### 4.5 Toolbars & Filters

#### Toolbar Components
| Component | Import | Key Features |
|-----------|--------|-------------|
| **BaseToolbar** | `@/components/core/BaseToolbar` | `variant: 'default'│'compact'│'expanded'│'narrow'`, search, filters, actions, position (top/bottom/sticky) |
| **CompactToolbar** | `@/components/core/CompactToolbar` | Icon-based, action buttons (new/edit/delete/export/import/refresh), filter/sort dropdowns, selection indicator, search row |

#### Advanced Filters System
| Component/Hook | Import | Key Features |
|----------------|--------|-------------|
| **AdvancedFiltersPanel\<T\>** | `@/components/core/AdvancedFilters` | Generic filter system, collapsible, i18n namespace support |
| **FilterField** | `@/components/core/AdvancedFilters` | Types: search, select, range, checkbox, multiselect, date, daterange |
| **useGenericFilters\<T\>** | `@/components/core/AdvancedFilters` | `handleFilterChange`, `clearAllFilters`, `hasActiveFilters`, `activeFilterCount`, `batchUpdate` |
| **applyFilters\<T\>** | `@/components/core/AdvancedFilters` | `matchesSearchTerm`, `matchesNumericRange`, `matchesDateFromToRange`, `matchesArrayFilter` |

**Pre-built Filter Configs** (from `@/components/core/AdvancedFilters/configs`):
`unitFiltersConfig`, `contactFiltersConfig`, `buildingFiltersConfig`, `projectFiltersConfig`, `communicationsFiltersConfig`, `taskFiltersConfig`, `propertyFiltersConfig`, `storageFiltersConfig`, `parkingFiltersConfig`

#### Period & Date Selection
| Component | Import | Key Features |
|-----------|--------|-------------|
| **GenericPeriodSelector** | `@/components/generic/GenericPeriodSelector` | Tab-based, theme variants (default/compact/large), i18n |
| **PeriodSelector** (CRM) | `@/components/crm/dashboard/PeriodSelector` | Button-based, semantic colors |
| **Calendar** | `@/components/ui/calendar` | react-day-picker wrapper, range selection |
| **Period Config** | `@/config/period-selector-config` | `getSortedPeriods()`, `getPeriodById()`, day/week/month/year |

#### Quick Filters
| Component | Import | Key Features |
|-----------|--------|-------------|
| **TypeQuickFilters** | `@/components/shared/TypeQuickFilters` | Generic segmented control, icon + label, single-select mode |
| **UnitTypeQuickFilters** | `@/components/shared/TypeQuickFilters` | Pre-configured for unit types |
| **ContactTypeQuickFilters** | `@/components/shared/TypeQuickFilters` | Pre-configured for contact types |

#### Sorting
| Hook | Import | Key Features |
|------|--------|-------------|
| **useSortState\<T\>** | `@/hooks/useSortState` | Generic sort state, `sortBy`, `sortOrder`, `onSortChange` |

---

### 4.6 Export Infrastructure

#### Centralized Export Service
| Service | Import | Formats |
|---------|--------|---------|
| **DataExportService** | `@/services/data-exchange/DataExportService` | CSV (BOM + escaping), JSON, XML. Singleton: `DataExportService.getInstance()` |

#### Domain-Specific Exporters (Patterns to follow)
| Exporter | Location | Pattern |
|----------|----------|---------|
| **gantt-pdf-exporter** | `@/services/gantt-export` | jsPDF + Roboto Greek font + html-to-image chart capture + autoTable |
| **gantt-excel-exporter** | `@/services/gantt-export` | ExcelJS multi-sheet (Timeline + Summary), auto-filters, styled headers |
| **milestone-pdf-exporter** | `@/services/milestone-export` | Enterprise PDF: header, 4 summary boxes, progress bar, milestone cards, footer |
| **milestone-excel-exporter** | `@/services/milestone-export` | 2-sheet (Ορόσημα + Σύνοψη), status color-coding |
| **payment-excel-exporter** | `@/services/payment-export` | 2-sheet (Κατάσταση Πληρωμών + Σύνοψη), overdue highlighting, currency formatting |

#### PDF Enterprise Service
| Service | Location | Features |
|---------|----------|----------|
| **PDFExportService** | `@/services/pdf/PDFExportService` | Orchestrator with renderers: CoverRenderer, TOCRenderer, ContentRenderer, HeaderFooterRenderer |

#### Libraries Already Installed
| Library | Version | Χρήση |
|---------|---------|-------|
| **jspdf** | ^3.0.3 | PDF generation |
| **jspdf-autotable** | ^5.0.2 | PDF tables |
| **exceljs** | 4.4.0 | Excel workbooks |
| **html-to-image** | 1.11.13 | Chart → PNG/SVG capture |
| **recharts** | installed | Interactive charts |

#### Greek Font Support
**Roboto font data**: `@/services/gantt-export/roboto-font-data.ts` (~687KB base64, Identity-H encoding)

#### Common Export Patterns
```typescript
// html-to-image chart capture
import { toPng } from 'html-to-image';
const dataUrl = await toPng(element, { backgroundColor: '#fff', quality: 1.0, pixelRatio: 2 });

// ExcelJS workbook
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('Sheet Name');
sheet.columns = [{ header: 'Col', key: 'col', width: 15 }];
sheet.autoFilter = { from: 'A1', to: 'B100' };
const buffer = await workbook.xlsx.writeBuffer();

// Download trigger (from gantt-export-utils)
import { triggerBlobDownload } from '@/services/gantt-export';
```

---

### 4.7 Navigation System

**File**: `src/config/smart-navigation-factory.ts`

**How to Add Reports Section**:
1. Add labels to `NAVIGATION_LABELS` constant
2. Import `FileBarChart` icon from lucide-react
3. Add baseItem in `getBaseConfigForMenu()` with `displayOrder: 75`
4. Add path mappings to `getLabelKeyForPath()`
5. Create i18n translations in `reports.json` namespace

**displayOrder Reference**: 0 (home), 10 (properties), 20 (contacts), 30 (audit), 40 (buildings), 50 (spaces), 60 (sales), 70 (crm), **75 (reports)**, 80 (accounting)

---

### 4.8 i18n System

**Config**: `src/i18n/lazy-config.ts` — 35 namespaces, lazy-loaded

**How to Add `reports` Namespace**:
1. Add `'reports'` to `SUPPORTED_NAMESPACES` in `src/i18n/lazy-config.ts`
2. Create `src/i18n/locales/en/reports.json` + `src/i18n/locales/el/reports.json`
3. Add `case 'reports':` in `loadTranslations()` function
4. Usage: `const { t } = useTranslation('reports');`

---

### 4.9 Page Architecture Pattern

**Pattern**: `page.tsx` → LazyRoutes → PageContent component

```typescript
// src/app/reports/page.tsx (minimal wrapper)
'use client';
import { LazyRoutes } from '@/utils/lazyRoutes';
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';
import '@/lib/design-system';

export default function ReportsPage() {
  const ReportsDashboard = LazyRoutes.ReportsDashboard;
  return (
    <>
      <ModuleBreadcrumb className="px-6 pt-4" />
      <ReportsDashboard />
    </>
  );
}
```

**Register in LazyRoutes**: `src/utils/lazyRoutes.tsx` — `createLazyRoute()` with `loadingType: 'dashboard'`

#### Containers & Layouts
| Component | Import | Χρήση |
|-----------|--------|-------|
| **PageContainer** | `@/core/containers` | Semantic section, overflow handling, h-full/h-screen |
| **ListContainer** | `@/core/containers` | Responsive padding/gaps via useLayoutClasses |
| **DetailsContainer** | `@/core/containers` | Fixed header + scrollable content, empty state |

#### Headers
| Component | Import | Key Props |
|-----------|--------|-----------|
| **SectionHeader** | `@/core/headers` | `title`, `icon`, `count`, `actions`, `variant: 'default'│'compact'│'minimal'`, `headingLevel` |
| **PageHeader** | `@/core/headers` | Full-page header with icon, title, description, actions |

#### States
| Component | Import | Key Props |
|-----------|--------|-----------|
| **PageLoadingState** | `@/core/states` | `icon` (animate-spin), `message`, `layout: 'fullscreen'│'contained'` |
| **PageErrorState** | `@/core/states` | `title`, `message`, `onRetry?`, `layout` |
| **EmptyState** | `@/components/shared/EmptyState` | `icon`, `title`, `description`, `action`, `size: 'sm'│'md'│'lg'`, `variant: 'plain'│'card'` |

#### Shared Components
| Component | Import | Χρήση |
|-----------|--------|-------|
| **GenericListHeader** | `@/components/shared/GenericListHeader` | SectionHeader + SearchInput |
| **InfoRow** | `@/components/shared/InfoRow` | Label-value pair with icon (detail panels) |
| **SearchInput** | `@/components/ui/search/SearchInput` | Debouncing, clear button, i18n |
| **ModuleBreadcrumb** | `@/components/shared/ModuleBreadcrumb` | Breadcrumb navigation |

---

### 4.10 Data Fetching Hooks

#### Generic Statistics Hook (Base)
| Hook | Import | Return |
|------|--------|--------|
| **useEntityStats\<T\>** | `@/hooks/useEntityStats` | `BaseEntityStats`: total, totalArea, averageArea, totalValue, averageValue, byStatus, byType |

**Utility exports**: `countBy`, `sumBy`, `rate`, `avg`, `avgRounded` (also from `@/utils/collection-utils`)

#### Entity-Specific Stats (Thin wrappers over useEntityStats)
| Hook | Import | Key Stats |
|------|--------|-----------|
| **useProjectsStats** | `@/hooks/useProjectsStats` | totalProjects, activeProjects, completedProjects, totalBudget, averageProgress, projectsByStatus, projectsByType |
| **useBuildingStats** | `@/hooks/useBuildingStats` | totalBuildings, activeProjects, totalValue, totalArea, averageProgress, totalUnits |
| **useUnitsStats** | `@/hooks/useUnitsStats` | totalUnits, availableUnits, soldUnits, totalValue, unitsByStatus, unitsByType, coverage (photos/floorplans/documents %) |
| **useParkingStats** | `@/hooks/useParkingStats` | totalParkingSpots, available/occupied/reserved/sold, parkingByType/Status/Floor/Building, utilizationRate, salesRate |
| **useStorageStats** | `@/hooks/useStorageStats` | totalStorages, available/occupied/maintenance/reserved, storagesByType/Status/Floor/Building, utilizationRate |

#### Real-Time Data Hooks
| Hook | Import | Key Stats |
|------|--------|-----------|
| **useRealtimeOpportunities** | `@/services/realtime/hooks/useRealtimeOpportunities` | opportunities[], loading, error, status, refetch |
| **useRealtimeTasks** | `@/services/realtime/hooks/useRealtimeTasks` | tasks[], stats (total/pending/inProgress/completed/overdue/dueToday/dueThisWeek/byPriority/byType), loading |

#### Firestore Data Hooks
| Hook | Import | Returns |
|------|--------|---------|
| **useFirestoreProjects** | `@/hooks/useFirestoreProjects` | projects[], loading, error, refetch |
| **useFirestoreBuildings** | `@/hooks/useFirestoreBuildings` | buildings[], loading, error, refetch |
| **useFirestoreUnits** | `@/hooks/useFirestoreUnits` | units[], loading, error (options: buildingId?, floorId?) |
| **useFirestoreParkingSpots** | `@/hooks/useFirestoreParkingSpots` | parkingSpots[], loading, error |
| **useFirestoreStorages** | `@/hooks/useFirestoreStorages` | storages[], loading, error |

#### Payment & Financial
| Hook/Service | Import | Key Features |
|-------------|--------|-------------|
| **usePaymentReport** | `@/hooks/usePaymentReport` | `report: PaymentReportData`, `fetchReport()`, `exportToExcel()` |
| **PaymentReportService** | `@/services/payment-report.service` | Server-only, ZERO N+1 queries, `getProjectReport(projectId)` |
| **PaymentPlanService** | `@/services/payment-plan.service` | CRUD + payment recording, installments, loans |
| **LoanTrackingService** | `@/services/loan-tracking.service` | Multi-bank, 15-stage FSM, disbursements |
| **ChequeRegistryService** | `@/services/cheque-registry.service` | 10-state FSM, endorsement, bounce workflow |
| **LegalContractService** | `@/services/legal-contract.service` | Contract lifecycle, phase prerequisites |
| **BrokerageService** | `@/services/brokerage.service` | Agreements, commissions, exclusivity validation |
| **ContactsService** | `@/services/contacts.service` | Query, search, batch ops, personas |

#### Centralized State Hooks
| Hook | Import | Key Features |
|------|--------|-------------|
| **useEntityPageState\<T, F\>** | `@/hooks/useEntityPageState` | selectedItem, viewMode, showDashboard, filteredItems, filters, URL param sync |
| **useAutoSave\<T\>** | `@/hooks/useAutoSave` | Google Docs pattern: debounce, retry, race protection, `status/isDirty/saveNow/retry` |

#### Query Infrastructure
| Service | Import | Key Features |
|---------|--------|-------------|
| **FirestoreQueryService** | `@/services/firestore` | Singleton, tenant-aware CRUD, subscriptions, batch ops, auto-chunking |
| **RealtimeService** | `@/services/realtime` | Event bus: PROJECT/BUILDING/UNIT/OPPORTUNITY/TASK CREATED/UPDATED/DELETED |
| **collection-utils** | `@/utils/collection-utils` | `groupByKey`, `tallyBy`, `sumByKey`, `sumBy`, `countBy`, `rate`, `avg` — zero-dependency, server+client safe |

---

### 4.11 Firestore Collections (SSoT)

**File**: `src/config/firestore-collections.ts`

**Relevant Collections for Reports**:
| Collection Constant | Firestore Name | Domain |
|--------------------|----------------|--------|
| `COLLECTIONS.CONTACTS` | contacts | Contacts |
| `COLLECTIONS.PROJECTS` | projects | Projects |
| `COLLECTIONS.BUILDINGS` | buildings | Buildings |
| `COLLECTIONS.UNITS` | units | Units/Sales |
| `COLLECTIONS.FLOORS` | floors | Buildings |
| `COLLECTIONS.PARKING_SPOTS` | parking_spots | Spaces |
| `COLLECTIONS.STORAGE_UNITS` | storage_units | Spaces |
| `COLLECTIONS.OPPORTUNITIES` | opportunities | CRM |
| `COLLECTIONS.TASKS` | tasks | CRM |
| `COLLECTIONS.COMMUNICATIONS` | communications | CRM |
| `COLLECTIONS.MESSAGES` | messages | CRM |
| `COLLECTIONS.CHEQUES` | cheques | Financial |
| `COLLECTIONS.CONTRACTS` | legal_contracts | Legal |
| `COLLECTIONS.BROKERAGES` | brokerage_agreements | Sales |
| `COLLECTIONS.BUILDING_MILESTONES` | building_milestones | Construction |
| `COLLECTIONS.CONSTRUCTION_PHASES` | construction_phases | Construction |
| `COLLECTIONS.BOQ_ITEMS` | boq_items | Construction |
| `COLLECTIONS.BOQ_CATEGORIES` | boq_categories | Construction |

**Helper**: `import { COLLECTIONS, buildDocPath } from '@/config/firestore-collections';`

---

### 4.12 Enterprise ID Generation

**File**: `src/services/enterprise-id.service.ts`

Αν χρειαστεί νέα collection (π.χ. `report_snapshots`), ΠΡΕΠΕΙ πρώτα να:
1. Προσθέσεις prefix στο `ENTERPRISE_ID_PREFIXES`
2. Δημιουργήσεις generator function
3. Χρησιμοποιήσεις `setDoc()` + generated ID

---

### 4.13 Auth & Permissions

**File**: `src/lib/auth/permissions.ts`

```typescript
// Permission check pattern
import { checkPermission, hasPermission } from '@/lib/auth/permissions';

// Format: domain:scope:action
await hasPermission(ctx, 'reports:reports:view', { projectId });
```

**Permission Sets**: `src/lib/auth/permission-sets.ts` — Pre-defined bundles (finance_approver, crm_exporter, etc.)

---

### 4.14 Navigation Entities (Icons & Colors SSoT)

**File**: `src/components/navigation/config/navigation-entities.ts`

```typescript
import { getEntityConfig, getEntityIcon, getEntityColor } from '@/components/navigation/config/navigation-entities';

// NAVIGATION_ENTITIES: company, project, building, unit, storage, parking, contact, etc.
// NAVIGATION_ACTIONS: view, edit, delete, share, etc.
```

---

## 5. ARCHITECTURE DESIGN

### 5.1 File Structure

```
src/app/reports/                         ← Next.js Pages
  page.tsx                               ← Overview dashboard
  contacts/page.tsx
  projects/page.tsx
  sales/page.tsx
  crm/page.tsx
  spaces/page.tsx
  construction/page.tsx
  export/page.tsx

src/components/reports/                  ← Components
  core/                                  ← Reusable report building blocks
    ReportPage.tsx                       ← Standard page layout (header + dashboard + content)
    ReportSection.tsx                    ← Collapsible section with title + description
    ReportChart.tsx                      ← Unified chart wrapper (pie/bar/line/area)
    ReportTable.tsx                      ← Sortable, filterable, exportable table
    ReportKPIGrid.tsx                    ← KPI cards (wraps UnifiedDashboard)
    ReportDateRange.tsx                  ← Period picker (week/month/quarter/year/custom)
    ReportExportBar.tsx                  ← Export buttons (PDF/Excel/CSV/Print)
    ReportEmptyState.tsx                 ← Empty state with icon + message

  sections/                              ← Domain-specific sections
    contacts/
      ContactDistributionChart.tsx       ← Pie: type distribution
      ContactGrowthChart.tsx             ← Line: new contacts over time
      TopBuyersTable.tsx                 ← Table: top buyers by value
      PersonaDistributionChart.tsx       ← Bar: persona types
      ContactCompletenessChart.tsx       ← Bar: profile completeness
    projects/
      ProjectStatusChart.tsx             ← Pie/bar: status distribution
      ProjectProgressChart.tsx           ← Bar: progress per project
      UnitStatusChart.tsx                ← Stacked bar: commercial status per building
      RevenueByProjectChart.tsx          ← Bar: revenue per project
      PricePerSqmChart.tsx              ← Bar: avg price/m2 per building
      BOQVarianceChart.tsx               ← Waterfall: estimated vs actual
    sales/
      RevenueTrendChart.tsx              ← Line: revenue over time
      PaymentStatusChart.tsx             ← Pie: payment coverage
      OverdueAnalysisChart.tsx           ← Bar: overdue installments
      ChequeStatusChart.tsx              ← Pie: cheque statuses
      LoanByBankChart.tsx                ← Bar: loan amounts by bank
      LegalPhaseChart.tsx                ← Bar: legal phases
    crm/
      PipelineFunnelChart.tsx            ← Funnel: opportunity stages
      TaskDistributionChart.tsx          ← Pie: tasks by status/priority
      CommunicationChannelChart.tsx      ← Bar: messages by channel
      TeamPerformanceChart.tsx           ← Bar: completed tasks by user
      LeadSourceChart.tsx                ← Pie: leads by source
    spaces/
      ParkingOccupancyChart.tsx          ← Pie: parking by status
      StorageUtilizationChart.tsx        ← Pie: storage by status
      SpaceValueChart.tsx                ← Bar: value per building
      SpaceTypeDistributionChart.tsx     ← Bar: types distribution
    construction/
      MilestoneCompletionChart.tsx       ← Bar: milestones by status
      PhaseProgressChart.tsx             ← Bar: phase progress
      PlannedVsActualChart.tsx           ← Grouped bar: planned vs actual dates
      BOQCostBreakdownChart.tsx          ← Stacked bar: material/labor/equipment

src/services/report-engine/              ← Data Layer
  report-data-aggregator.ts              ← Firestore queries → aggregated report data
  report-pdf-exporter.ts                 ← PDF generation (jspdf + chart images)
  report-excel-exporter.ts               ← Excel generation (multi-sheet)

src/hooks/reports/                       ← Data Fetching Hooks
  useContactsReport.ts                   ← Contacts domain data
  useProjectsReport.ts                   ← Projects/buildings domain data
  useSalesReport.ts                      ← Sales/financial domain data
  useCrmReport.ts                        ← CRM domain data
  useSpacesReport.ts                     ← Parking/storage domain data
  useConstructionReport.ts               ← Construction/timeline domain data

src/i18n/locales/en/reports.json         ← English translations
src/i18n/locales/el/reports.json         ← Greek translations
```

### 5.2 Core Component APIs

#### ReportPage
```typescript
interface ReportPageProps {
  titleKey: string                       // i18n key
  descriptionKey: string                 // i18n key
  icon: LucideIcon
  stats?: DashboardStat[]               // KPI cards
  dateRange: DateRangeValue              // Period filter
  onDateRangeChange: (range: DateRangeValue) => void
  onExport: (format: ExportFormat) => void
  loading?: boolean
  children: React.ReactNode              // Report sections
}
```

#### ReportChart
```typescript
interface ReportChartProps {
  type: 'pie' | 'bar' | 'line' | 'area' | 'stacked-bar' | 'waterfall'
  data: ChartDataPoint[]
  config: ChartConfig
  title: string
  height?: number
  showLegend?: boolean
  showTooltip?: boolean
  className?: string
}
```

#### ReportTable
```typescript
interface ReportTableProps<T> {
  data: T[]
  columns: ReportColumn<T>[]
  sortable?: boolean
  filterable?: boolean
  pagination?: boolean
  pageSize?: number
  exportable?: boolean
  emptyMessage?: string
}
```

#### ReportDateRange
```typescript
type DateRangePreset = 'week' | 'month' | 'quarter' | 'year' | 'ytd' | 'custom'
interface DateRangeValue {
  preset: DateRangePreset
  from: Date
  to: Date
}
```

### 5.3 Export Strategy

| Format | Library | Features |
|--------|---------|----------|
| On-screen | recharts + UI components | Interactive, filterable, real-time |
| PDF | jspdf + jspdf-autotable + html-to-image | A4, charts as images, tables, Greek Roboto |
| Excel | exceljs | Multi-sheet (Summary + Detail + Raw), auto-filters, styled headers, currency formatting |
| CSV | DataExportService | Simple tabular export |

### 5.4 Estimated Files (~35)

| Category | Files | Notes |
|----------|-------|-------|
| Core components | 8 | ReportPage, ReportChart, ReportTable, etc. |
| Section components | ~20 | 3-5 per domain (6 domains) |
| Hooks | 6 | One per domain |
| Services | 3 | Aggregator, PDF exporter, Excel exporter |
| Pages | 8 | One per route |
| i18n | 2 | en + el |
| Navigation | 2 | smart-navigation-factory + navigation.json |
| ADR | 1 | This document |
| **Total** | **~50** | **Orchestrator approach in batches** |

---

## 6. IMPLEMENTATION PLAN

### Phase 1: Foundation (Core + Navigation)
- [ ] Core report components (ReportPage, ReportChart, ReportTable, ReportKPIGrid, ReportDateRange, ReportExportBar, ReportEmptyState, ReportSection)
- [ ] Navigation integration (smart-navigation-factory + i18n)
- [ ] Overview dashboard page (/reports)

### Phase 2: Domain Reports (batch by domain)
- [ ] Contacts & Customers report
- [ ] Projects & Buildings report
- [ ] Sales & Financial report
- [ ] CRM & Pipeline report
- [ ] Spaces (Parking/Storage) report
- [ ] Construction & Timeline report

### Phase 3: Export Engine
- [ ] PDF exporter (reusable across all domains)
- [ ] Excel exporter (multi-sheet per domain)
- [ ] Export Center page (/reports/export)

---

## 7. DEPENDENCIES ON EXISTING INFRASTRUCTURE

| Dependency | Status | Location |
|------------|--------|----------|
| recharts | Installed | package.json |
| jspdf + jspdf-autotable | Installed | package.json |
| exceljs | Installed | package.json |
| html-to-image | Installed | package.json |
| ChartContainer | Ready | src/components/ui/chart/ |
| UnifiedDashboard | Ready | src/components/property-management/dashboard/ |
| DataExportService | Ready | src/services/data-exchange/ |
| BaseToolbar | Ready | src/components/core/BaseToolbar/ |
| Semantic Colors | Ready | src/ui-adapters/react/useSemanticColors.ts |
| Smart Navigation | Ready | src/config/smart-navigation-factory.ts |
| PageLoadingState | Ready | src/components/common/ |

**No new npm packages required.**

---

## 8. INDUSTRY RESEARCH — Web Research Findings (2026-03-28)

> **Methodology**: 4 parallel research agents scanned 60+ sources including Procore, Oracle Primavera P6,
> Autodesk Construction Cloud, Trimble Viewpoint, Sage 300 CRE, Bechtel, Vinci, Skanska, Google Looker,
> Material Design 3, PMI, FIDIC, and academic/industry publications.

### 8.1 The 13 Report Types of a Global Construction Company

Based on research of Procore, Oracle Primavera P6, Autodesk Construction Cloud, Deltek, and PMI best practices, a world-class construction company uses these 13 report categories:

| # | Report Type | Description | Our Status |
|---|------------|-------------|------------|
| 1 | **Financial Reports** | Budget vs actual, cash flow forecast, cost-to-complete, revenue recognition | Partial (Financial Intelligence exists) |
| 2 | **Earned Value Management (EVM)** | CPI, SPI, EAC, TCPI — the #1 project controls tool worldwide | **MISSING — NEW** |
| 3 | **Project Status Reports** | Progress snapshot, milestones, risk register, blockers | Partial (structure tab) |
| 4 | **Schedule Variance Reports** | Planned vs actual dates, critical path, delay analysis | Partial (Gantt exists) |
| 5 | **Cost Variance Reports** | BOQ estimated vs actual per category, waterfall | Partial (BOQ exists) |
| 6 | **Sales & Pipeline Reports** | Conversion funnel, revenue by period, win/loss rate | Partial (CRM pipeline) |
| 7 | **Payment Collection Reports** | Aging report (30/60/90+), collection rate, cheque tracking | Partial (payment system) |
| 8 | **Labor & Compliance Reports** | ΕΦΚΑ submissions, worker hours, insurance classes, safety | Partial (IKA tab) |
| 9 | **Inventory/Space Reports** | Available vs sold vs reserved, occupancy, price trends | Partial (sales pages) |
| 10 | **Customer/Contact Reports** | New contacts, type distribution, top buyers, geography | Data exists, no report |
| 11 | **Communication Reports** | Messages by channel, response times, AI metrics | Data exists, no report |
| 12 | **Team Performance Reports** | Tasks per member, deals per agent, response time | Data exists, no report |
| 13 | **Executive Summary** | Single-page portfolio dashboard, 5-8 KPIs, investor-ready | **MISSING — NEW** |

### 8.2 Construction Software Platforms — Αναλυτική Σύγκριση

#### 8.2.1 Procore — Reports & Dashboards

**5 μεγάλα datasets** μέσω 360 Reporting:
- **Financials**: Budget, Change Orders, Prime Contracts, Commitments, Budget Risk
- **Preconstruction**: Bidding, Estimating, Bid Packages, Bid Leveling
- **Project Execution**: Daily operational health, on-site activities
- **Resource Management**: Team productivity, time tracking
- **Directory & Portfolio**: Companies, users, projects, insurance

**Report pages ανά κατηγορία:**
- Project Management: Project Insights, Scorecard, Health Chart, RFIs, Submittals, Punch List, Schedule (~15 reports)
- Quality & Safety: Incidents, TRIFR Analysis, Observations, Inspections, Forms Compliance (~12 reports)
- Risk: Risk Summary, Register, Probability Matrix, Risk Map, Budget Risk (~8 reports)
- Financial: Budget Report, Change Events, Timecards, Production Rate Benchmarking (~6 reports)
- Daily Logs: Construction, Delays, Deliveries, Equipment, Manpower, Safety Violations, Weather (~12 reports)

**Custom Report Builder**: Drag-and-drop, any dataset, save as template
**Scheduled Distribution**: PDF/Excel, daily/weekly/monthly cadence, by recipient
**AI Features**: Agent Adoption dataset, Assist (AI queries across all datasets)

#### 8.2.2 Oracle Primavera P6

**10 pre-configured dashboards:**
- Main Dashboard, Project Health, Earned Value, Cash Flow, Cost Sheet
- Portfolio Analysis, Resource Analysis, Business Processes, Facilities, Performance Measurement

**EVM**: Full S-curve (PV/EV/AC), CPI/SPI gauges, resource histograms, critical path
**Role-based access**: Executives → portfolio, PMs → schedule/cost/EV, Team → task-level
**Custom builder**: Oracle OBIEE platform, scorecards, drill-down portfolio→activity

#### 8.2.3 Autodesk Construction Cloud (ACC)

**Dashboard levels**: My Home (cross-project), Project-level, Account-level
**Construction IQ**: ML-powered risk identification — scans data, predicts high-risk items
**Insight Builder**: No-code dashboard builder, pre-built templates
**Power BI integration**: Native connector, scheduled extractions, embedded dashboards
**Quality KPI Dashboard (2026)**: Issue trends, drill-down, interactive filters

#### 8.2.4 Trimble Viewpoint (Vista)

**Modules**: Job Cost, Payroll, Equipment, AP/AR Aging, GL, Financial Statements
**Analytics**: Built on **Microsoft Power BI** (embedded), mobile access
**AI (2026)**: Viewpoint Finance Assistant — AI-powered financial reporting

#### 8.2.5 Sage 300 CRE

**1,400+ prebuilt reports** + Crystal Reports integration
**Dashboard**: Real-time customizable, budget vs actual, cash flow, P&L trends
**Add-ons**: MyAssistant (alerts), Office Connector (Excel), Anterra BI (cloud analytics)

#### 8.2.6 Σύγκριση Πλατφορμών — Feature Matrix

| Feature | Procore | Oracle P6 | ACC | Trimble | Sage 300 |
|---------|---------|-----------|-----|---------|----------|
| Scheduled reports | ✅ Distribute Snapshot | ✅ OBIEE | ✅ Data Connector | ✅ Power BI | ✅ MyAssistant |
| Email distribution | ✅ by recipient | ✅ role-based | ✅ name/role/company | ✅ | ✅ auto-alerts |
| PDF export | ✅ PDF+Visuals | ✅ | ✅ | ✅ | ✅ Crystal Reports |
| Excel export | ✅ | ✅ | ✅ | ✅ Power BI | ✅ Office Connector |
| Custom builder | ✅ 360 Reporting | ✅ OBIEE | ✅ Insight Builder | ✅ Power BI | ✅ Report Designer |
| AI-powered | ✅ Assist, CIQ | Limited | ✅ Construction IQ | Coming 2026 | ❌ |

---

### 8.3 Report Hierarchy — Operational / Tactical / Strategic

Βάσει Anthony Triangle + industry patterns:

```
                    ┌──────────────────┐
                    │   STRATEGIC /    │  CEO, Board, Investors
                    │   EXECUTIVE      │  Portfolio P&L, ROI,
                    │   (Quarterly)    │  Company Health, One-Pager
                    ├──────────────────┤
                    │   TACTICAL       │  Directors, VPs, PMO
                    │   (Weekly/       │  Cross-project trends,
                    │    Monthly)      │  Resource optimization,
                    │                  │  Risk matrix, EVM
                    ├──────────────────┤
                    │   OPERATIONAL    │  PMs, Superintendents,
                    │   (Daily/        │  Foremen
                    │    Real-time)    │  Daily logs, RFIs,
                    │                  │  Budget detail, Safety
                    └──────────────────┘
```

---

### 8.4 Reports Ranked by Importance (Industry Evidence)

#### TOP 10 Reports κατά σημαντικότητα

| Rank | Report | Frequency | Value / Evidence |
|------|--------|-----------|------------------|
| **1** | **Daily Construction Report (DCR)** | Daily | Νομικό έγγραφο, source of truth εργοταξίου |
| **2** | **WIP Report (Work-In-Progress)** | Monthly | Revenue recognition, GAAP compliance, overbilling/underbilling detection |
| **3** | **Cash Flow Forecast** | Weekly/Monthly | #1 αιτία αποτυχίας κατασκευαστικών = cash flow problems. 13-week rolling forecast |
| **4** | **EVM (CPI/SPI/S-curve)** | Monthly | Cost + schedule performance σε 1 view. Μείωση overruns 10-20% |
| **5** | **Weekly Progress Report** | Weekly | Κεντρικό report διοίκησης έργου + 3-week look-ahead |
| **6** | **Budget vs Actual** | Monthly | Variance detection, corrective action triggers |
| **7** | **Safety Report** | Daily | Νομική υποχρέωση (OSHA/ΣΕΠΕ), TRIR tracking |
| **8** | **AR Aging Report** | Weekly | Cash collection optimization, 30/60/90/120+ buckets |
| **9** | **Executive One-Pager** | Quarterly | Board/CEO decision-making, investor presentations |
| **10** | **Subcontractor Performance** | Weekly | Quality + timeline compliance per subcontractor |

#### Reports ανά ρόλο — #1 Report

| Ρόλος | #1 Report | Γιατί |
|-------|-----------|-------|
| **Site Manager** | Daily Construction Report | Source of truth, νομικό έγγραφο |
| **Project Manager** | Weekly Progress + EVM | CPI + SPI = budget & schedule status |
| **Finance Director / CFO** | WIP Report + Cash Flow | Revenue recognition + liquidity position |
| **CEO / Board** | Executive One-Pager | Portfolio RAG status, top risks, decisions needed |

#### Reports που παράγουν μεγαλύτερο ROI

| Report | Αξία | Στοιχείο |
|--------|------|----------|
| Real-Time Cost Tracking | **Μείωση overruns 8-12%** | CMiC Global: daily cost tracking → 8-12% cost improvement |
| WIP Report | Αποτρέπει overbilling/underbilling | 30% complete αλλά 70% budget consumed → instant alert |
| Cash Flow Forecast | Αποτρέπει liquidity crisis | #1 λόγος αποτυχίας εταιρειών |
| EVM S-curve | **Μείωση overruns 10-20%** | Predictive risk analysis (RTS Labs) |
| Predictive Analytics (AI) | **Μείωση overruns έως 30%** | nPlan: trained on 750K schedules, $2Tn construction data |

---

### 8.5 Earned Value Management (EVM) — Critical Gap

EVM is the **industry standard** for project controls (PMI, Procore, Oracle Primavera).

#### Core Formulas

| Metric | Formula | Meaning |
|--------|---------|---------|
| **PV** (Planned Value) | Budget × Planned % Complete | What we planned to spend by now |
| **EV** (Earned Value) | Budget × Actual % Complete | Value of work actually done |
| **AC** (Actual Cost) | Sum of actual expenditures | What we actually spent |
| **CV** (Cost Variance) | EV - AC | + = under budget, - = over budget |
| **SV** (Schedule Variance) | EV - PV | + = ahead, - = behind |
| **CPI** (Cost Performance Index) | EV / AC | > 1 = under budget |
| **SPI** (Schedule Performance Index) | EV / PV | > 1 = ahead of schedule |
| **EAC** (Estimate at Completion) | Budget / CPI | Projected final cost |
| **TCPI** (To-Complete PI) | (Budget - EV) / (Budget - AC) | Required future efficiency |

#### Traffic Light Thresholds (Industry Standard)

| Color | CPI / SPI Range | Meaning |
|-------|----------------|---------|
| Green | ≥ 0.95 | On track |
| Amber | 0.85 - 0.94 | Warning — needs attention |
| Red | < 0.85 | Critical — intervention required |

#### EVM Visualization — Best Practices (Industry)

Οι κορυφαίες εταιρείες οπτικοποιούν EVM σε **3 επίπεδα drill-down**:

| Level | Visualization | Audience |
|-------|---------------|----------|
| **Executive** | Traffic lights (CPI/SPI per project) | CEO, Board |
| **PM** | S-Curve (PV/EV/AC lines) + CPI/SPI trend | Project Managers |
| **Cost Engineer** | Work package-level variance analysis | Cost Engineers |

```
EVM Dashboard Card Layout:
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ CPI      │ │ SPI      │ │ EAC      │ │ CV       │
│ 0.97 🟢  │ │ 0.88 🟡  │ │ €2.1M    │ │ -€45K 🔴 │
│ On budget│ │ Behind   │ │ Forecast │ │ Over     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

S-Curve Chart:
  PV (planned) ── blue dashed line
  EV (earned)  ── green solid line
  AC (actual)  ── red solid line

Monthly CPI/SPI Trend:
  Dual-axis line chart tracking indices over time
```

#### Data Sources in Our App

- **PV**: `boq_items.estimatedQuantity × unitCosts` + `construction_phases.plannedStartDate/plannedEndDate`
- **EV**: `construction_phases.progress` (0-100) × phase budget
- **AC**: `boq_items.actualQuantity × unitCosts` (when `status = 'executed' | 'invoiced'`)
- **% Complete**: `building.progress` or weighted `construction_phases.progress`

---

### 8.6 Aging Report (Payment Collections)

Industry-standard aging buckets for receivables:

| Bucket | Description | Color | Action |
|--------|-------------|-------|--------|
| Current | Not yet due | Green | Monitor |
| 1-30 days | Recently overdue | Yellow | Reminder |
| 31-60 days | Overdue | Orange | Follow-up call |
| 61-90 days | Seriously overdue | Red | Escalation |
| 90+ days | Critical overdue | Dark Red | Legal action |

**Healthy benchmark**: 70-80% στο Current, 10-15% στο 31-60, <10% στο 61+
**Visualization**: Stacked bar chart (X = buyer/project, Y = amount per bucket) + Pie chart (% distribution)
**Review frequency**: Weekly
**Data Source**: `paymentSummary.overdueInstallments` + installment `dueDate` vs today

---

### 8.7 Cash Flow Forecasting — Best Practices

| Στοιχείο | Best Practice |
|----------|---------------|
| **Time horizon** | **13-week rolling forecast** (ιδανική ισορροπία ακρίβειας + planning) |
| **Chart type** | Bar: Actual vs Forecast, Line: Cumulative cash position |
| **Update frequency** | Weekly (μεγάλα projects), Monthly (μικρά) |
| **Components** | Opening balance, Inflows (progress payments, milestones, retainage), Outflows (labor, materials, subs, overhead), Closing balance |
| **Construction-specific** | Billing tied to milestones, material payment timing, % completion triggers |

---

### 8.8 Executive Summary — Single-Page Portfolio Report

The investor/CEO "one-pager" that every enterprise construction company produces:

```
┌─────────────────────────────────────────────────────────┐
│  EXECUTIVE SUMMARY — Portfolio Report                    │
│  Period: Q1 2026 | Generated: 28/03/2026                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  KPI CARDS (5-8 max, with sparklines):                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │Total   │ │Revenue │ │Collec- │ │Avg     │ │Active  ││
│  │Portfolio│ │YTD     │ │tion %  │ │CPI     │ │Projects││
│  │€12.5M  │ │€3.2M   │ │78%     │ │0.96 🟢 │ │  5     ││
│  │~trend~ │ │~trend~ │ │~trend~ │ │~trend~ │ │        ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘│
│                                                          │
│  LEFT: Revenue Trend (line)    RIGHT: Pipeline Funnel    │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ Monthly Revenue  │  │ Leads → Sold     │             │
│  │ with target line │  │ conversion rates │             │
│  └──────────────────┘  └──────────────────┘             │
│                                                          │
│  Projects Health Table:                                  │
│  ┌──────────────────────────────────────────┐           │
│  │ Project  │ Progress │ CPI  │ SPI  │ Health│          │
│  │ Alpha    │ 65%      │ 0.97 │ 0.92 │ 🟢   │          │
│  │ Beta     │ 30%      │ 0.84 │ 0.78 │ 🔴   │          │
│  │ Gamma    │ 90%      │ 1.02 │ 1.01 │ 🟢   │          │
│  └──────────────────────────────────────────┘           │
│                                                          │
│  Bottom: Top 3 Risks + Top 3 Overdue Payments           │
└─────────────────────────────────────────────────────────┘
```

#### CEO One-Pager — Τι ΑΚΡΙΒΩΣ περιέχει

| Section | Περιεχόμενο |
|---------|-------------|
| **Portfolio RAG Status** | Traffic light για κάθε project (Red/Amber/Green) |
| **Financial Summary** | Total revenue, costs, profit margin, cash position |
| **Top 3 Risks** | Τα 3 μεγαλύτερα ρίσκα + mitigation plans |
| **Key Milestones** | Επερχόμενα milestones (30-60-90 ημέρες) |
| **Cash Flow Position** | Γράφημα τρέχουσας + προβλεπόμενης ταμειακής θέσης |
| **KPI Indicators** | CPI, SPI, Safety TRIR — traffic lights |
| **Decisions Required** | 1-3 αποφάσεις που χρειάζονται έγκριση Board |

**Export**: Must be a **polished A4 PDF** — presented to investors/board.

---

### 8.9 Google's 6 Rules for Data Design

From Google's data visualization team (Fast Company):

1. **Be honest** — Never truncate axes to exaggerate. Show real data, warts and all.
2. **Lend a helping hand** — Context next to every number: target, benchmark, trend arrow, % change.
3. **Delight** — Elegant, clean design. No chartjunk (Tufte principle). White space is your friend.
4. **Give clarity** — Most important metric: top-left. The eye scans left-to-right, top-to-bottom.
5. **Provide structure** — Visual hierarchy: KPIs → Charts → Tables. Progressive disclosure.
6. **Make it accessible** — Color-blind safe palette. Never rely on color alone. Labels on data.

---

### 8.10 Google Looker Studio — Dashboard Patterns

#### Scorecard (KPI Card) Design Pattern
- **Headline value**: Μεγάλο, bold — current metric
- **Comparison delta**: % ή absolute αλλαγή vs benchmark
- **Positive**: Πράσινο font + ▲ arrow
- **Negative**: Κόκκινο font + ▼ arrow
- **Compact numbers**: 200k αντί 200,000
- **Period options**: Previous period, previous year, custom

#### Google Analytics 4 — Report Navigation
Τριεπίπεδη ιεραρχία:
```
Collections (π.χ. Lifecycle, User)
  └── Topics (π.χ. Acquisition, Engagement, Monetization, Retention)
       └── Reports (individual views)
```
- Left sidebar: Icons-only, expand on hover
- Max 7 collections per property
- Lifecycle-based organization: Acquisition → Engagement → Monetization → Retention

#### Google Cloud Monitoring — Widget Types
- **Scorecards**: Single value + color-coded thresholds
- **Gauges**: Current value vs danger range
- **Heatmaps**: Latency distribution
- **Traffic Light**: Green (< 70%), Yellow (70-90%), Red (> 90%)
- **Golden Signals (SRE)**: Latency, Traffic, Errors, Saturation

---

### 8.11 KPI Card Anatomy — 4 Layers (Industry Standard)

```
┌─────────────────────────────┐
│ 📊 Label (Title)            │  ← Clear, unambiguous title (14-16px)
│                             │
│   2,847                     │  ← Headline Value (24-36px, bold)
│   ▲ +12.5% vs last month   │  ← Comparison delta (12-14px, colored)
│   ▔▔▁▁▔▔▁▔▔▁▔▔▔            │  ← Sparkline (mini trend chart)
│   Target: 3,000             │  ← Target reference (11-13px, muted)
└─────────────────────────────┘
```

**Color Logic**:
- Green + ▲: Improvement (default)
- Red + ▼: Decline
- **Invert** for metrics where lower = better (cost, response time)
- If ambiguous: blue-orange neutral palette

**Sparkline Best Practices**:
- Tiny, word-sized charts for historical context
- Shows direction (spike, dip, stable)
- No axes, no labels — pure shape
- Combined with comparison: "above target but declining" vs "above target and accelerating"

---

### 8.12 Chart Type Selection Matrix

| Purpose | Chart Type | When to Use | Max Items |
|---------|-----------|------------|-----------|
| Compare categories | **Bar Chart** (vertical) | Revenue per project, units by type | 15-20 |
| Compare categories | **Bar Chart** (horizontal) | Long labels, ranked lists | 20-30 |
| Trends over time | **Line Chart** | Monthly revenue, CPI/SPI trend | 12-36 periods |
| Part of whole | **Pie / Donut** | Status distribution, type breakdown | **5-7 max** |
| Part of whole (many) | **Treemap** | Cost breakdown by category (BOQ) | 20+ |
| Target vs actual | **Gauge Chart** | Budget utilization, CPI, SPI | 1 per gauge |
| Mini trend in card | **Sparkline** | Revenue trend inside KPI card | N/A |
| Distribution | **Histogram** | Price distribution of units | 10-20 bins |
| Cumulative | **Area Chart** | Cumulative payments over time | 12-36 periods |
| Variance analysis | **Waterfall Chart** | Budget → Changes → Actual | 5-10 steps |
| Two variables | **Scatter Plot** | Price vs Area, Size vs Value | 50-200 points |
| Progress tracking | **Stacked Bar** | Units by status per building | 5-10 stacks |
| Project timeline | **Gantt Chart** | Phase schedule with baselines | Already exists |
| Funnel/conversion | **Funnel Chart** | Lead → Qualification → Sold | 4-8 stages |
| Performance index | **Traffic Light** | CPI/SPI/Health indicators | Per-metric |

---

### 8.13 Dashboard Layout Best Practices (Material Design + Looker + Industry)

#### Layout Rules
- **Top Rail**: Title + Period Picker + Export buttons — always visible
- **KPI Row**: 5-8 cards maximum. Most important top-left.
- **Primary Charts**: 2 columns. Left = most important (bar/line). Right = secondary.
- **Secondary Charts**: Smaller charts (pie, gauge) in 2-3 columns.
- **Detail Table**: Full-width at bottom. Sortable, filterable, exportable.
- **Progressive Disclosure**: Overview → Click for detail. Don't show everything at once.

#### 3 Levels of Dashboard Drill-Down (Google Pattern)
```
Level 1: Executive Summary (KPI cards, 3-5 metrics)
    ↓ Click card
Level 2: Category View (charts, filters, comparisons)
    ↓ Click chart element
Level 3: Detail View (table, individual records, raw data)
```

#### Responsive Grid (12-Column System)
```
Desktop (1200px+): 12 cols, 24-32px gutters
  KPI Cards:   span 3 (4 per row) or span 4 (3 per row)
  Charts:      span 6 (2 per row) or span 12 (full width)
  Tables:      span 12 (full width always)

Tablet  (768px):   12 cols, 16px gutters → 2 columns
Mobile  (< 768px): Full width stacking → 1 column
```

#### Layout Pattern Statistics
- **Stratified** (49% of dashboards): Top-down ordering of widgets
- **Table layout** (19%): Semantically meaningful columns and rows
- **Magazine layout**: Mixed sizes for visual interest

---

### 8.14 Accessibility & Color-Blind Safe Palettes

#### Okabe-Ito Palette (8 Colors — Industry Standard, Nature Methods)
```
Orange:         #E69F00    Sky Blue:       #56B4E9
Bluish Green:   #009E73    Yellow:         #F0E442
Blue:           #0072B2    Vermillion:     #D55E00
Reddish Purple: #CC79A7    Black:          #000000
```

#### IBM Design Library Palette (5 Colors)
```
#FFB000 (Amber)   #FE6100 (Orange)   #DC267F (Magenta)
#785EF0 (Purple)  #648FFF (Blue)
```

#### Key Rules
- **Blue is always safe** — least affected by color blindness
- **Never red-green only** — most common color blindness type
- **Secondary cues**: patterns, shapes, icons alongside color
- **ARIA labels + alt text** on all charts
- **Data tables as fallback** for screen reader users
- **WCAG 4.5:1 contrast ratio** for text

---

### 8.15 Dark Mode — Charts & Dashboards

#### Color Rules
- **Dedicated dark palette** — μη κάνεις απλά invert
- **4-5 colors max** σε dark background
- Saturated colors "vibrate" σε dark backgrounds → adjust hues
- **Semi-bold weights** (not ultra-thin, fades against dark)

#### Recommended Dark Palette
```
Background:   #1a1a2e or #0f172a (not pure black #000)
Surface:      #1e293b or #262626
Card:         #334155 or #2d2d2d
Grid lines:   rgba(255,255,255,0.08) — very subtle
Text primary: #f1f5f9 or #e5e7eb
Text muted:   #94a3b8 or #9ca3af
```

#### Chart Colors for Dark Mode
```typescript
// Light mode (Okabe-Ito based)
chartColors: ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00']
// Dark mode (brighter variants)
chartColorsDark: ['#56B4E9', '#F0E442', '#009E73', '#CC79A7', '#648FFF', '#FFB000']
```

---

### 8.16 Export Best Practices (Enterprise Standard)

#### PDF Export
- **A4 Portrait** for summary reports (single page)
- **A4 Landscape** for data-heavy reports (tables, Gantt)
- **Header**: Company logo + report title + period + generation date
- **Footer**: Page numbers + "Confidential" watermark option
- **Charts**: Captured as PNG via `html-to-image`, pixelRatio: 2 for quality
- **Tables**: `jspdf-autotable` with alternating row colors, column headers on each page
- **Greek fonts**: Roboto with Identity-H encoding (already configured)
- **Colors**: Darker than screen — lighter colors don't print well

#### Excel Export
- **Sheet 1: Executive Summary** — KPIs in formatted cells, sparklines
- **Sheet 2: Charts Data** — Raw data behind each chart (pivot tables)
- **Sheet 3: Detail** — Full data table with auto-filters
- **Sheet 4: Raw Data** — Unformatted for BI tools
- **Styling**: Frozen header row, blue fill headers, currency/% formatting
- **Named ranges** for formula references
- **Conditional formatting**: Red (overdue), Green (on-target), Yellow (warning)

#### PDF from Charts (Recharts → PDF)
```typescript
// html-to-image → jsPDF workflow
import { toPng } from 'html-to-image';
const dataUrl = await toPng(chartElement, { backgroundColor: '#fff', quality: 1.0, pixelRatio: 2 });
// Fixed dimensions for print (no ResponsiveContainer)
```

---

### 8.17 Mobile Reporting — Field Worker Needs

| Λειτουργία | Προτεραιότητα |
|------------|---------------|
| Daily log entry (εργασίες, ώρες, υλικά) | ΚΡΙΣΙΜΟ |
| Photo/video documentation (auto GPS + timestamp) | ΚΡΙΣΙΜΟ |
| Safety inspection checklists | ΚΡΙΣΙΜΟ |
| Timecards / attendance | ΥΨΗΛΟ |
| Equipment log | ΥΨΗΛΟ |
| Punch list / snag list | ΥΨΗΛΟ |
| Weather conditions (auto-fetch) | ΜΕΤΡΙΟ |
| Material delivery receipts | ΜΕΤΡΙΟ |

---

### 8.18 AI in Construction Reporting (2025-2026 Trends)

| AI Capability | Impact | Status |
|--------------|--------|--------|
| Predictive cost overrun detection | Μείωση overruns 10-30% | Production-ready |
| Schedule delay prediction | Προειδοποίηση πριν γίνει καθυστέρηση | Production (nPlan) |
| Automated progress tracking | Computer vision σε photos → % completion | Emerging |
| Anomaly detection | Εντοπισμός ασυνήθιστων δαπανών | Growing (37% adoption) |
| Natural language reports | AI generates narrative summaries from data | Emerging |
| Document classification | Auto-categorize invoices, RFIs, submittals | Production-ready |

**Industry Statistics (Deloitte 2024)**:
- Μέσος αριθμός technologies ανά εταιρεία: **6.2** (+20%)
- Εταιρείες με AI/ML: **37%** (από 26% το 2023)
- BIM adoption (US contractors): **>70%**
- Revenue boost per new technology: **+1.4%** revenue, **+1%** profitability
- #1 barrier: Lack of skills (42%)

---

### 8.19 Comparison Reports — Actual vs Planned

| Chart Type | Χρήση | Πότε |
|------------|-------|------|
| **Clustered Column** | Budget vs Actual ανά κατηγορία | Monthly financial reviews |
| **Waterfall Chart** | Step-by-step breakdown αλλαγών budget | Variance analysis |
| **Line Chart (dual axis)** | Planned vs Actual progress over time | Schedule tracking |
| **S-Curve overlay** | PV vs EV vs AC | EVM analysis |
| **Conditional formatting** | Green (under), Yellow (near), Red (over) | Όλα τα reports |

---

### 8.21 Global Construction Companies — Report Practices (Bechtel, Vinci, Skanska, Balfour Beatty)

#### Report Escalation Chain (Industry Standard)

```
Site Foreman (Daily)
  → Site Manager (Daily + Weekly)
    → Project Manager (Weekly + Monthly)
      → Director / VP (Monthly + Quarterly)
        → CEO / Board (Quarterly + Annual)
```

#### Report Frequency by Role

| Ρόλος | Daily | Weekly | Monthly | Quarterly |
|-------|-------|--------|---------|-----------|
| **Site Foreman** | DCR, Safety, Attendance | — | — | — |
| **Site Manager** | DCR, Safety | Progress, Look-Ahead | — | — |
| **Project Manager** | — | Progress, Cost, Subs | EVM, Budget vs Actual, Cash Flow | — |
| **Director / VP** | — | — | Portfolio Health, Risk | Executive Summary |
| **CEO / Board** | — | — | — | One-Pager, Annual Financial |

#### Board-Level KPIs (Skanska, Balfour Beatty Annual Reports)

| KPI | Description | Benchmark |
|-----|-------------|-----------|
| **Operating Margin** | Profit / Revenue | 3-5% (construction segment) |
| **Return on Capital Employed (ROCE)** | Operating income / Capital employed | 8-15% target |
| **Order Bookings** | New contracts secured | Book-to-build ratio > 100% |
| **Book-to-Build Ratio** | Orders / Revenue | >110% = healthy pipeline |
| **Return on Equity** | Net income / Shareholders equity | 10%+ |
| **Working Capital** | Current assets - Current liabilities | Positive trend |
| **Bonding Capacity** | 10-20x working capital | Per surety assessment |
| **Lost Time Injury Rate (LTIFR)** | Injuries per million hours worked | <1.0 |

**Real data (2024):**
- **Skanska**: Operating margin 3.5%, ROCE 2.6%, orders SEK 207.9B, book-to-build 123%, ROE 10%
- **Balfour Beatty**: PFO £293M (+16%), UK margin >3% (5th year improvement), order book +44%

#### Monthly Progress Report — Sections (KPMG + Mastt Best Practice)

| # | Section | Περιεχόμενο |
|---|---------|-------------|
| 1 | **Project Details** | Name, code, dates, PM, client |
| 2 | **Executive Summary** | Key achievements, challenges, RAG status (budget/schedule/scope) |
| 3 | **Scope & Adjustments** | Modifications, impact on schedule/budget |
| 4 | **Progress Dashboard** | Gantt charts, milestone graphs, KPI dashboards |
| 5 | **KPI Review** | Budget, schedule, resources, CPI/SPI |
| 6 | **Health & Safety** | Incidents, near misses, LTIFR, training, compliance |
| 7 | **Risk Management** | Identified risks, mitigation, emerging opportunities |
| 8 | **Budget & Financial** | Actual vs budget, Forecasted Final Cost (FFC), ETC |
| 9 | **Stakeholder Comms** | Meetings, feedback, approvals, decisions |

#### 4 Essential Financial Statements (Construction)

| Statement | Purpose | Bonding Relevance |
|-----------|---------|-------------------|
| **Profit & Loss (Income)** | Revenue, costs, profit margin | Surety uses to assess stability |
| **Balance Sheet** | Assets, liabilities, equity | Working capital → bonding capacity |
| **Cash Flow Statement** | Operating, investing, financing activities | Liquidity assessment |
| **WIP Report** | % completion, overbilling/underbilling | Revenue recognition accuracy |

**Bonding capacity formula**: Working Capital × 10-20 = bonding limit (depends on experience + contract type)

---

### 8.22 Greece-Specific Compliance Reports

| Report | Frequency | Data Source | Regulatory Body |
|--------|-----------|-------------|-----------------|
| **ΑΠΔ (Αναλυτική Περιοδική Δήλωση)** | Monthly by 15th | Worker hours, earnings, insurance class | e-EFKA |
| **Μισθοδοσία Εργοταξίου** | Monthly | Worker cards, daily wages, triennia | ΣΕΠΕ |
| **Ημερολόγιο Μέτρων Ασφαλείας** | Continuous | Safety incidents, measures, inspections | ΣΕΠΕ |
| **Βιβλίο Ημερήσιων Δελτίων Απασχολούμενου** | Daily | Attendance, check-in/out, GPS | e-EFKA |
| **Ασφαλιστική Ενημερότητα** | Per-project | Insurance compliance status | e-EFKA |
| **Πίνακας Προσωπικού** | On change | Employee registry, terms, hours | Εργάνη ΙΙ |

Data already exists in our app: `attendance` module (ADR-170), IKA tab (workers, insurance classes, wages), ΕΦΚΑ declarations.

---

## 9. UPDATED NAVIGATION — Complete Report Structure

Based on research, the navigation should be restructured to match industry standards:

```
📊 ΑΝΑΦΟΡΕΣ (FileBarChart icon, displayOrder: 75)
├── 📋 Διοικητική Σύνοψη       /reports                  ← Executive Summary (NEW)
├── 💰 Χρηματοοικονομικά        /reports/financial        ← Financial + EVM (NEW)
├── 🏗️ Έργα & Κτίρια           /reports/projects         ← Projects + Buildings
├── 📈 Πωλήσεις & Εισπράξεις   /reports/sales            ← Sales + Aging Report (ENHANCED)
├── 👥 Επαφές & Πελάτες         /reports/contacts         ← Contacts
├── 📞 CRM & Pipeline           /reports/crm              ← CRM + Communications
├── 🅿️ Χώροι                    /reports/spaces           ← Parking + Storage
├── ⚙️ Κατασκευή & Timeline     /reports/construction     ← Construction + EVM detail
├── 📜 Συμμόρφωση & Εργατικά    /reports/compliance       ← ΕΦΚΑ/Labor (NEW)
└── 📤 Κέντρο Εξαγωγής          /reports/export           ← Batch export all reports
```

**Changes from original ADR**:
- Added **Διοικητική Σύνοψη** (Executive Summary) as first item
- Added **Χρηματοοικονομικά** with EVM integration
- Enhanced **Πωλήσεις** with Aging Report
- Added **Συμμόρφωση & Εργατικά** for Greek compliance
- Renamed and reorganized for industry alignment

---

## 10. UPDATED FILE STRUCTURE

### New files added (vs original ADR Section 5.1)

```
src/components/reports/
  core/
    ReportPage.tsx
    ReportSection.tsx
    ReportChart.tsx
    ReportTable.tsx
    ReportKPIGrid.tsx
    ReportDateRange.tsx
    ReportExportBar.tsx
    ReportEmptyState.tsx
    ReportGauge.tsx                      ← NEW: Gauge chart for CPI/SPI/targets
    ReportTrafficLight.tsx               ← NEW: Traffic light indicator
    ReportSparkline.tsx                  ← NEW: Mini trend in KPI cards
    ReportFunnel.tsx                     ← NEW: Conversion funnel
    ReportAgingTable.tsx                 ← NEW: Aging bucket visualization

  sections/
    executive/                           ← NEW DOMAIN
      PortfolioKPIs.tsx                  ← 5-8 KPI cards with sparklines
      ProjectHealthTable.tsx             ← Projects with CPI/SPI/health
      TopRisksCard.tsx                   ← Top 3 risks across portfolio
      TopOverdueCard.tsx                 ← Top overdue payments
      RevenueTrendChart.tsx              ← Monthly revenue with target line

    financial/                           ← NEW DOMAIN (replaces partial)
      EVMDashboard.tsx                   ← CPI/SPI gauges + S-curve
      EVMTrendChart.tsx                  ← Monthly CPI/SPI line chart
      CostVarianceWaterfall.tsx          ← Budget → actual waterfall
      CashFlowForecast.tsx              ← Cash in vs cash out per month
      RevenueRecognition.tsx             ← Revenue by project/period

    contacts/
      ContactDistributionChart.tsx
      ContactGrowthChart.tsx
      TopBuyersTable.tsx
      PersonaDistributionChart.tsx
      ContactCompletenessChart.tsx
      GeographicDistributionChart.tsx    ← NEW: Map or bar by city/region

    projects/
      ProjectStatusChart.tsx
      ProjectProgressChart.tsx
      UnitStatusChart.tsx
      RevenueByProjectChart.tsx
      PricePerSqmChart.tsx
      BOQVarianceChart.tsx
      EnergyClassDistribution.tsx        ← NEW: Energy class breakdown

    sales/
      RevenueTrendChart.tsx
      PaymentStatusChart.tsx
      OverdueAnalysisChart.tsx
      ChequeStatusChart.tsx
      LoanByBankChart.tsx
      LegalPhaseChart.tsx
      AgingReportChart.tsx               ← NEW: Stacked bar 30/60/90+
      ConversionFunnelChart.tsx          ← NEW: Lead → Sold funnel

    crm/
      PipelineFunnelChart.tsx
      TaskDistributionChart.tsx
      CommunicationChannelChart.tsx
      TeamPerformanceChart.tsx
      LeadSourceChart.tsx
      ResponseTimeChart.tsx              ← NEW: Avg response time trend

    spaces/
      ParkingOccupancyChart.tsx
      StorageUtilizationChart.tsx
      SpaceValueChart.tsx
      SpaceTypeDistributionChart.tsx

    construction/
      MilestoneCompletionChart.tsx
      PhaseProgressChart.tsx
      PlannedVsActualChart.tsx
      BOQCostBreakdownChart.tsx
      EVMBuildingDetail.tsx              ← NEW: Per-building EVM
      SCurveChart.tsx                    ← NEW: PV/EV/AC S-curve

    compliance/                          ← NEW DOMAIN
      EFKASubmissionStatus.tsx           ← Monthly APD submission tracker
      WorkerHoursSummary.tsx             ← Total hours by insurance class
      AttendanceComplianceChart.tsx       ← Check-in compliance rate
      SafetyIncidentTracker.tsx          ← Incidents per 10K hours

src/services/report-engine/
  report-data-aggregator.ts
  report-pdf-exporter.ts
  report-excel-exporter.ts
  evm-calculator.ts                      ← NEW: EVM calculations (CPI, SPI, EAC)
  aging-calculator.ts                    ← NEW: Payment aging bucket logic

src/hooks/reports/
  useContactsReport.ts
  useProjectsReport.ts
  useSalesReport.ts
  useCrmReport.ts
  useSpacesReport.ts
  useConstructionReport.ts
  useExecutiveReport.ts                  ← NEW: Portfolio-level aggregation
  useFinancialReport.ts                  ← NEW: EVM + cash flow
  useComplianceReport.ts                 ← NEW: ΕΦΚΑ/labor data
  useEVM.ts                              ← NEW: EVM calculations hook

src/app/reports/
  page.tsx                               ← Executive Summary (was overview)
  financial/page.tsx                     ← NEW
  projects/page.tsx
  sales/page.tsx
  contacts/page.tsx
  crm/page.tsx
  spaces/page.tsx
  construction/page.tsx
  compliance/page.tsx                    ← NEW
  export/page.tsx
```

### Updated File Count

| Category | Original | Updated | Delta |
|----------|----------|---------|-------|
| Core components | 8 | 13 | +5 (gauge, traffic light, sparkline, funnel, aging) |
| Section components | ~20 | ~35 | +15 (executive, financial, compliance, extras) |
| Hooks | 6 | 10 | +4 (executive, financial, compliance, EVM) |
| Services | 3 | 5 | +2 (EVM calculator, aging calculator) |
| Pages | 8 | 10 | +2 (financial, compliance) |
| i18n | 2 | 2 | 0 |
| Navigation | 2 | 2 | 0 |
| ADR | 1 | 1 | 0 |
| **Total** | **~50** | **~78** | **+28** |

---

## 11. QUALITY REQUIREMENTS

### Google-Level Standards
- Google's 6 data design rules applied to every chart and dashboard
- Interactive, responsive, polished UI/UX
- KPI cards with sparklines and trend indicators (Google Looker pattern)
- Progressive disclosure (overview → detail on click)
- 5-8 KPIs max per dashboard (construction industry best practice)

### Technical Standards
- Fully i18n (el + en), no hardcoded strings
- Semantic HTML (no div soup)
- TypeScript strict (no `any`, no `as any`, no `@ts-ignore`)
- Enterprise file sizes (<500 lines per component)
- Design system tokens everywhere (colors, spacing, borders)
- SSoT for all data (Firestore collections, not duplicated)
- Accessible (keyboard navigation, screen reader, color-blind safe)

### Export Standards
- PDF: A4 with company header, charts as images, Greek Roboto font
- Excel: Multi-sheet (Summary + Charts Data + Detail + Raw), auto-filters, conditional formatting
- CSV: UTF-8 BOM, proper escaping

---

## 12. STAKEHOLDER & ROLLOUT DECISIONS

### 12.1 Target Users & Rollout Strategy

**Rollout σε 3 φάσεις:**

| Φάση | Χρήστες | Στόχος |
|------|---------|--------|
| **Phase A** | Γιώργος (CEO/ιδιοκτήτης) | Validation — δοκιμή, feedback, fine-tuning |
| **Phase B** | Core team (3-4 άτομα) | Σταθεροποίηση — real-world usage, bug fixes |
| **Phase C** | Όλα τα τμήματα | Full production — role-based views |

**Σχεδιαστική απόφαση**: Τα reports πρέπει να λειτουργούν για ΟΛΟΥΣ τους ρόλους (CEO, PM, μηχανικοί, λογιστές), αλλά η προτεραιότητα υλοποίησης ξεκινάει από CEO view (executive dashboards) και κατεβαίνει.

### 12.2 Scope

**Απόφαση**: ΟΛΕΣ οι 10 κατηγορίες αναφορών υλοποιούνται. Καμία εξαίρεση.

1. Διοικητική Σύνοψη (Executive One-Pager)
2. Χρηματοοικονομικά (EVM, Cash Flow)
3. Έργα & Κτίρια
4. Πωλήσεις & Εισπράξεις (Aging)
5. Επαφές & Πελάτες
6. CRM & Pipeline
7. Χώροι (Parking/Storage)
8. Κατασκευή & Timeline
9. Συμμόρφωση & Εργατικά (ΕΦΚΑ)
10. Κέντρο Εξαγωγής (Export Center)

### 12.3 Output Formats

**Απόφαση**: Κάθε αναφορά υποστηρίζει ΟΛΑ τα formats από την αρχή:
- **On-screen**: Interactive dashboards (KPI cards, charts, filters, drill-down)
- **PDF**: Polished A4 export (Greek Roboto, company header, charts as images)
- **Excel**: Multi-sheet (Summary + Detail + Raw), auto-filters, conditional formatting
- **CSV**: Simple tabular export (UTF-8 BOM)

Δεν υπάρχει phasing μεταξύ screen/export — κάθε report κατά την υλοποίησή του παραδίδεται ολοκληρωμένο.

### 12.4 Σειρά Υλοποίησης (Google Pattern: Infrastructure First)

**Απόφαση**: Υλοποίηση όπως θα έκανε η Google — infrastructure πρώτα, μετά features.

Google χτίζει **bottom-up**: πρώτα τα reusable primitives, μετά τα domain features.
Αυτό σημαίνει ότι δεν ξεκινάμε από μία αναφορά — ξεκινάμε από τα **core components** που χρησιμοποιούνται από ΟΛΕΣ.

| Phase | Τι χτίζουμε | Γιατί πρώτα |
|-------|-------------|-------------|
| **Phase 1: Core Primitives** | ReportPage, ReportChart, ReportTable, ReportKPIGrid, ReportDateRange, ReportExportBar, ReportGauge, ReportSparkline, ReportTrafficLight, ReportFunnel, ReportAgingTable, ReportEmptyState, ReportSection | Χωρίς αυτά δεν χτίζεται τίποτα — reusable across ALL domains |
| **Phase 2: Data Layer** | EVM calculator, Aging calculator, report-data-aggregator, report-pdf-exporter, report-excel-exporter | Τα δεδομένα πρέπει να ρέουν σωστά πριν φτιάξεις UI |
| **Phase 3: Navigation + i18n** | smart-navigation-factory, reports.json (en+el), LazyRoutes | Ο χρήστης πρέπει να φτάνει στα reports |
| **Phase 4: Executive Summary** | /reports — Portfolio KPIs, Project Health Table, Top Risks, Revenue Trend | Το πρώτο report που βλέπει ο CEO |
| **Phase 5: Financial** | /reports/financial — EVM Dashboard, S-curve, Cash Flow, Cost Variance | Τα χρήματα — #1 priority μετά το overview |
| **Phase 6: Sales & Collections** | /reports/sales — Revenue trend, Aging, Cheques, Loans, Legal, Conversion funnel | Cash flow optimization |
| **Phase 7: Projects & Buildings** | /reports/projects — Status, Progress, Units, Revenue/m², BOQ variance, Energy class |  |
| **Phase 8: CRM & Pipeline** | /reports/crm — Pipeline funnel, Tasks, Communications, Team performance, Response time |  |
| **Phase 9: Contacts** | /reports/contacts — Distribution, Growth, Top buyers, Personas, Completeness, Geography |  |
| **Phase 10: Spaces** | /reports/spaces — Parking occupancy, Storage utilization, Value per building, Types |  |
| **Phase 11: Construction** | /reports/construction — Milestones, Phase progress, Planned vs Actual, BOQ cost, S-curve per building |  |
| **Phase 12: Compliance** | /reports/compliance — ΕΦΚΑ submissions, Worker hours, Attendance compliance, Safety |  |
| **Phase 13: Export Center** | /reports/export — Batch export all reports, scheduled generation |  |

### 12.5 Executive Summary — KPI Cards (Απόφαση)

**Απόφαση**: Ακολουθούμε industry standard — 8 KPI cards στο Executive Summary:

| # | KPI | Πηγή δεδομένων |
|---|-----|----------------|
| 1 | **Συνολική αξία portfolio (€)** | `projects.totalValue` SUM |
| 2 | **Έσοδα YTD (€)** | `units.commercial.finalPrice` SUM WHERE sold + saleDate in current year |
| 3 | **Ποσοστό είσπραξης (%)** | `paymentSummary.paidPercentage` AVG |
| 4 | **Μέσος CPI** | EVM calculator: EV / AC across active projects |
| 5 | **Ενεργά έργα** | `projects` COUNT WHERE status = 'in_progress' |
| 6 | **Διαθέσιμα ακίνητα** | `units` COUNT WHERE commercialStatus = 'for_sale' |
| 7 | **Εκκρεμείς πληρωμές (€)** | `paymentSummary.remainingAmount` SUM |
| 8 | **Pipeline αξία (€)** | `units.commercial.askingPrice` SUM WHERE for_sale |

Κάθε card περιλαμβάνει: headline value, sparkline trend, comparison vs previous period, target (όπου applicable).

### 12.6 Γλώσσα

**Απόφαση**: Ελληνικά ως default. Πλήρες i18n (el + en) σε ΟΛΕΣ τις αναφορές — τίτλοι, labels, tooltips, legends, export headers, PDF content. Ο χρήστης αλλάζει γλώσσα από το υπάρχον language switcher.

### 12.7 PDF Branding (Email Template Pattern)

**Απόφαση**: Ακολουθεί το ίδιο pattern με τα HTML email templates της εφαρμογής.

| Θέση | Λογότυπο | Αρχείο |
|------|----------|--------|
| **Header (top)** | Pagonis Energo (εταιρικό) | `public/images/pagonis-energo-logo.png` |
| **Footer (bottom)** | Nestor App (platform) | `public/images/nestor-app-logo.png` |

**Layout:**
```
┌─────────────────────────────────────┐
│ [Pagonis Energo Logo]               │  ← Header
│ Τίτλος Αναφοράς | Περίοδος | Ημ/νία │
├─────────────────────────────────────┤
│                                     │
│         (Report Content)            │
│                                     │
├─────────────────────────────────────┤
│ [Nestor App Logo]                   │  ← Footer
│ Σελίδα X/Y | Εμπιστευτικό          │
└─────────────────────────────────────┘
```

### 12.8 Περίοδοι Αναφοράς (Date Picker)

**Απόφαση**: Industry standard — όλες οι περίοδοι:

| Περίοδος | Label (el) | Label (en) |
|----------|------------|------------|
| Εβδομάδα | Εβδομάδα | Week |
| Μήνας | Μήνας | Month |
| Τρίμηνο | Τρίμηνο (Q1-Q4) | Quarter |
| Εξάμηνο | Εξάμηνο (H1-H2) | Half-year |
| Έτος | Έτος | Year |
| YTD | Από αρχή έτους | Year-to-date |
| Custom | Προσαρμοσμένο εύρος | Custom range |

Default: **Τρέχον τρίμηνο** (πιο χρήσιμο για CEO view).

### 12.9 Data Fetching Strategy

**Απόφαση**: Snapshot (fetch-on-load) + Refresh button. Όχι real-time αρχικά.

- Κάθε report φορτώνει δεδομένα μία φορά κατά το mount
- Refresh button για manual ανανέωση
- **Εύκολη μετάβαση σε real-time αργότερα**: Τα hooks χρησιμοποιούν abstraction layer — αλλαγή από `getDocs()` σε `onSnapshot()` χωρίς αλλαγή στα components (1 γραμμή ανά hook)
- **Γιατί snapshot**: Οικονομικότερο σε Firestore reads, τα report data δεν αλλάζουν κάθε δευτερόλεπτο

### 12.22 Data Aggregation Strategy (Απόφαση 2026-03-28)

**Απόφαση**: Υβριδικό — Firestore Aggregation + API Routes. **50x φθηνότερο** από client-side.

| Τύπος query | Μέθοδος | Παράδειγμα |
|-------------|---------|------------|
| **Απλά metrics** (count, sum, avg) | `getCountFromServer()` / `getAggregateFromServer()` | "Πόσα units πωληθέντα", "Συνολικά έσοδα" |
| **Πολύπλοκα** (GROUP BY, JOINs, EVM) | Next.js API Routes + Firebase Admin SDK | "Έσοδα ανά project", "CPI/SPI calculation" |

**Κόστος σύγκριση:**

| Σενάριο | Client-side (απορρίφθηκε) | Υβριδικό (επιλέχθηκε) |
|---------|--------------------------|----------------------|
| 1 report load | ~2.000-5.000 reads | ~50-100 reads |
| 10 users × 5 loads/μέρα | ~100K-250K reads/μέρα | ~2.500-5.000 reads/μέρα |
| Firestore free tier fit | ❌ Ξεπερνάει | ✅ Άνετα εντός |

**Γιατί:**
- Firestore Aggregation = 1 read ανεξαρτήτως docs (αντί N reads)
- API Routes = Firebase Admin SDK = δεν χρεώνεται per-read
- Vercel Hobby plan = 100GB-hrs/μήνα serverless (δωρεάν, αρκεί)
- Χωράει εντός Firestore free tier (50K reads/μέρα) ακόμα και με πολλούς χρήστες

### 12.23 Caching Strategy (Απόφαση 2026-03-28)

**Απόφαση**: In-memory cache με 5 λεπτά TTL. Zero dependencies, Google pattern.

- Κάθε report hook κρατάει cached data σε `useRef` + `lastFetchTimestamp`
- Αν ο χρήστης γυρίσει πίσω σε <5 λεπτά → δείχνει cached data αμέσως (instant)
- Αν >5 λεπτά → νέο fetch αυτόματα
- Refresh button → force refetch (αγνοεί TTL)
- **Χωρίς νέο dependency** (όχι React Query, όχι SWR)

**Pattern:**
```typescript
const cacheRef = useRef<{ data: T; timestamp: number } | null>(null);
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isCacheValid = () =>
  cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL;
```

**Γιατί:**
- Reports data δεν αλλάζει κάθε δευτερόλεπτο — 5 min cache αρκεί
- Zero bundle size impact (no library)
- Refresh button = manual override για fresh data
- Αν χρειαστεί αργότερα React Query, η μετάβαση είναι 1:1 αντικατάσταση

### 12.24 Bundle Size & Lazy Loading (Απόφαση 2026-03-28)

**Απόφαση**: Lazy pages + dynamic export imports. Μηδέν impact στο υπόλοιπο app.

| Library | Μέγεθος (gzip) | Πότε φορτώνεται |
|---------|---------------|-----------------|
| recharts | ~180KB | Μόνο στο `/reports/*` (Next.js automatic page split) |
| jspdf + jspdf-autotable | ~300KB | Μόνο στο click "Εξαγωγή PDF" (`dynamic import()`) |
| exceljs | ~500KB | Μόνο στο click "Εξαγωγή Excel" (`dynamic import()`) |

**Pattern για export:**
```typescript
const handleExportPDF = async () => {
  const { generateReportPDF } = await import('@/services/report-engine/report-pdf-exporter');
  await generateReportPDF(data, options);
};
```

**Αποτέλεσμα:**
- Χρήστες που ΔΕΝ μπαίνουν σε reports → **0KB** extra
- Χρήστες που βλέπουν reports on-screen → **+180KB** (recharts, ήδη υπάρχει στο app)
- Χρήστες που κάνουν export → **+300-500KB** μόνο τη στιγμή του click
- **Google pattern**: Code splitting per route + dynamic imports for heavy features

### 12.25 Custom Charts Implementation (Απόφαση 2026-03-28)

**Απόφαση**: Custom SVG + recharts. Zero νέα dependencies.

| Component | Υλοποίηση | Γιατί |
|-----------|-----------|-------|
| **ReportGauge** | Custom SVG arc (~60 γραμμές) | Recharts δεν έχει gauge. SVG arc = πλήρης έλεγχος, zero deps |
| **ReportSparkline** | Recharts `<LineChart>` χωρίς axes | Ήδη υπάρχει, 1 prop `dot={false}` + hide axes |
| **ReportFunnel** | Recharts `<FunnelChart>` | Native recharts component, documented |
| **ReportTrafficLight** | Custom SVG 3 circles (~20 γραμμές) | Τόσο απλό που library θα ήταν overkill |

**Απορρίφθηκε**: Tremor.so (+45KB dependency) — δεν δικαιολογείται για 2 components που γράφονται σε <100 γραμμές.

**Google principle**: Μην προσθέτεις dependency αν μπορείς να γράψεις τον κώδικα σε <100 γραμμές

### 12.26 Responsive / Mobile Strategy (Απόφαση 2026-03-28)

**Απόφαση**: Responsive (desktop-first, mobile-friendly). Όχι mobile app, αλλά δουλεύει σε κινητό.

| Στοιχείο | Desktop | Tablet | Mobile |
|----------|---------|--------|--------|
| **Charts** | Full width | Full width | Full width (recharts `<ResponsiveContainer>` auto-resize) |
| **KPI Grid** | 4 στήλες | 2 στήλες | 1 στήλη (CSS grid `auto-fit, minmax(280px, 1fr)`) |
| **Tables** | Full table | Horizontal scroll | Horizontal scroll + sticky 1η στήλη |
| **Date Picker** | Full bar inline | Full bar inline | Ίδιο, responsive layout |
| **Sections** | Side-by-side όπου χωράει | Stacked | Stacked |

**Implementation:**
- Recharts: `<ResponsiveContainer width="100%" height={300}>` — built-in, zero code
- KPI Grid: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))` — pure CSS
- Tables: `overflow-x: auto` + `position: sticky; left: 0` στην 1η στήλη — CSS μόνο
- Sections: Tailwind `grid-cols-1 md:grid-cols-2` — ήδη pattern στο app

**Γιατί Responsive (όχι Mobile-first):**
- Primary χρήστης: CEO στο desktop
- Αλλά αν ανοίξει report στο κινητό, πρέπει να διαβάζεται χωρίς broken layout
- Zero extra components — μόνο CSS breakpoints

### 12.27 Phase 1 Export Strategy (Απόφαση 2026-03-28)

**Απόφαση**: Stub buttons στο Phase 1. Export services υλοποιούνται στο Phase 2.

- `ReportExportBar` υλοποιείται στο Phase 1 ως UI component
- Τα κουμπιά PDF / Excel / CSV εμφανίζονται `disabled` + tooltip "Σύντομα διαθέσιμο"
- Στο Phase 2 τα services (report-pdf-exporter, report-excel-exporter) ενεργοποιούν τα κουμπιά
- Η `onExport` callback περνάει ως prop — στο Phase 1 = no-op, στο Phase 2 = real export

**Google principle**: Ship primitives first, wire them later. Ένα disabled button δεν πειράζει κανέναν — broken functionality πειράζει όλους.

### 12.28 Firestore Collections Strategy (Απόφαση 2026-03-28)

**Απόφαση**: Zero νέες collections. Τα reports διαβάζουν ΜΟΝΟ από existing collections.

- Τα reports δεν δημιουργούν δεδομένα — aggregation on-the-fly από: `contacts`, `projects`, `buildings`, `units`, `payments`, `boq_items`, κλπ
- Firestore Aggregation (1 read/metric) + API Routes (0 reads) + In-memory cache 5 min = φθηνό + fresh
- Χωράει στο Firestore free tier (50K reads/μέρα) ακόμα και με 20 χρήστες (~5K-10K reads/μέρα)

**Απορρίφθηκε**: `report_cache` collection — cache invalidation = πηγή bugs, dataset μικρό (<1K docs/collection), premature optimization

**Αν αργότερα χρειαστεί** (dataset > 10K docs): Προσθήκη 1 collection `report_cache` με pre-computed snapshots. Η αρχιτεκτονική το υποστηρίζει χωρίς rewrite (τα hooks αλλάζουν data source, τα components μένουν ίδια).

### 12.10 Chart Color Palette

**Απόφαση**: Okabe-Ito (color-blind safe) ως βάση, ενταγμένο στο design system.

**Γιατί**: Accessibility (8% ανδρών έχει αχρωματοψία), industry standard (Google, Nature, IBM), PDF-safe.

**Light mode:**
```
chart-1: #0072B2  (Blue)
chart-2: #E69F00  (Orange)
chart-3: #009E73  (Bluish Green)
chart-4: #CC79A7  (Reddish Purple)
chart-5: #56B4E9  (Sky Blue)
chart-6: #D55E00  (Vermillion)
chart-7: #F0E442  (Yellow)
chart-8: #000000  (Black)
```

**Dark mode (brighter variants):**
```
chart-1: #56B4E9  (Sky Blue)
chart-2: #F0E442  (Yellow)
chart-3: #009E73  (Bluish Green)
chart-4: #CC79A7  (Reddish Purple)
chart-5: #648FFF  (Blue)
chart-6: #FFB000  (Amber)
chart-7: #FE6100  (Orange)
chart-8: #FFFFFF  (White)
```

**Semantic (status colors — ίδια light/dark):**
```
chart-positive: hsl(var(--success))   — green
chart-negative: hsl(var(--destructive)) — red
chart-warning:  hsl(var(--warning))   — amber
chart-neutral:  hsl(var(--muted))     — gray
```

**Implementation**: CSS variables στο `globals.css` + `chartPalette` object στο design system. Ένα σημείο αλήθειας.

### 12.11 Executive Summary — Project Health Table (RAG)

**Απόφαση**: Ναι — RAG (Red/Amber/Green) Project Health Table στο Executive Summary. Industry standard (Procore, Oracle, Bechtel, Skanska).

| Στήλη | Πηγή | Thresholds |
|-------|------|------------|
| **Έργο** | `projects.name` | — |
| **Πρόοδος** | `projects.progress` | Progress bar (0-100%) |
| **Budget** | CPI (EV/AC) | 🟢 ≥0.95, 🟡 0.85-0.94, 🔴 <0.85 |
| **Timeline** | SPI (EV/PV) | 🟢 ≥0.95, 🟡 0.85-0.94, 🔴 <0.85 |
| **Υγεία** | worst(Budget, Timeline) | Χειρότερο από τα δύο |

Κλικ σε γραμμή → drill-down στο detail report του έργου.

### 12.12 Print vs PDF

**Απόφαση**: Μόνο PDF export, χωρίς print button. Ο χρήστης κατεβάζει PDF και εκτυπώνει από εκεί αν χρειαστεί. Ένα κουμπί, μηδέν σύγχυση.

### 12.13 Scheduled Reports (Email)

**Απόφαση**: Προβλέπεται στην αρχιτεκτονική, υλοποιείται αργότερα.

**Phase τώρα**: Manual export μόνο (ο χρήστης πατάει PDF/Excel).
**Phase μελλοντικό**: Αυτόματη αποστολή PDF/Excel στο email (π.χ. κάθε Δευτέρα, κάθε 1η μήνα). Απαιτεί: server-side PDF generation, email scheduling infrastructure, cron/trigger mechanism.

**Αρχιτεκτονική πρόβλεψη**: Τα report data hooks και export services θα σχεδιαστούν ώστε να λειτουργούν και client-side (τώρα) και server-side (αργότερα) χωρίς rewrite.

### 12.14 Chart Drill-Down Navigation

**Απόφαση**: Click σε chart element → navigate σε filtered λίστα με τα πραγματικά records.

**Παραδείγματα:**
- Click "Πωληθέντα" σε pie chart → `/sales/sold?status=sold`
- Click "Κηφισιά" σε bar chart → `/spaces/apartments?project=kifisia`
- Click "31-60 ημέρες" σε aging chart → `/reports/sales?aging=31-60`
- Click γραμμή στο Project Health Table → `/reports/projects?projectId=xxx`

**Pattern**: `onClick` handler σε chart elements → `router.push()` με query params ως filters. Τα destination pages ήδη υποστηρίζουν URL-based filtering μέσω `useEntityPageState`.

### 12.15 Comparison Mode (Period vs Period)

**Απόφαση**: Ναι — σύγκριση δύο περιόδων δίπλα-δίπλα.

**Λειτουργία:**
- Toggle "Σύγκριση" στο date picker → εμφανίζεται δεύτερο date range
- KPI cards: δείχνουν Δ% αλλαγή (π.χ. Έσοδα €320K, ▲ +12.5% vs Q1 2025)
- Charts: grouped/clustered bars (τρέχουσα vs προηγούμενη περίοδος)
- Tables: extra στήλη με τιμή προηγούμενης περιόδου + Δ%

**Comparison options:**
- Προηγούμενη περίοδος (π.χ. Q1 vs Q4)
- Ίδια περίοδος πέρυσι (π.χ. Q1 2026 vs Q1 2025)
- Custom (οποιαδήποτε δύο περίοδοι)

**Default**: Ίδια περίοδος πέρυσι (YoY — πιο χρήσιμη σύγκριση για seasonality).

### 12.16 Loading Strategy

**Απόφαση**: Progressive loading (Google pattern). Κάθε KPI card, chart, table φορτώνει ανεξάρτητα — εμφανίζεται αμέσως μόλις είναι έτοιμο. Τα υπόλοιπα δείχνουν skeleton placeholder μέχρι να φορτώσουν.

**Implementation**: Κάθε section χρησιμοποιεί δικό του hook με ανεξάρτητο loading state. Suspense boundaries ανά section, όχι ανά page.

### 12.17 Empty States

**Απόφαση**: Google pattern — μήνυμα + call-to-action. Κάθε empty state οδηγεί τον χρήστη στο σωστό μέρος.

**Παραδείγματα:**
- "Δεν υπάρχουν πωλήσεις αυτή την περίοδο" → [Πρόσθεσε πώληση →]
- "Δεν υπάρχουν επαφές" → [Δημιουργία επαφής →]
- "Δεν υπάρχουν δεδομένα κατασκευής" → [Πρόσθεσε φάσεις κατασκευής →]

Χρησιμοποιεί το υπάρχον `EmptyState` component (`@/components/shared/EmptyState`) με `action` prop.

### 12.18 URL State (Shareable Links)

**Απόφαση**: Google pattern — ΟΛΟ το filter state στο URL. Κάθε αναφορά μπορεί να μοιραστεί με copy-paste του URL.

**URL params:**
- `period` — preset (week/month/quarter/year/ytd) ή custom (2026-01-01_2026-03-31)
- `compare` — comparison period
- `project` — filter by projectId
- `building` — filter by buildingId
- `status` — filter by status

**Παράδειγμα**: `/reports/sales?period=Q1-2026&compare=Q1-2025&project=abc123`

**Implementation**: `useSearchParams()` + sync με filter state. Ήδη χρησιμοποιούμε αυτό το pattern μέσω `useEntityPageState`.

### 12.19 Number Formatting

**Απόφαση**: Ελληνικό format, χωρίς compact abbreviations. Πάντα πλήρες νούμερο.

| Τύπος | Format | Παράδειγμα |
|-------|--------|------------|
| Ποσά (€) | `X.XXX.XXX,XX €` | `1.234.567,89 €` |
| Ποσοστά | `XX,X%` | `78,5%` |
| Αριθμοί | `X.XXX` | `1.234` |
| Δεκαδικά (KPIs) | `X,XX` | `0,97` |

**Χωρίς compact** (1,2M, 320K κλπ) — πάντα πλήρες νούμερο.
**Locale**: `el-GR` via `Intl.NumberFormat('el-GR', { ... })`

### 12.20 Favorites / Saved Reports

**Απόφαση**: Δεν χτίζουμε custom favorites σύστημα. Το URL IS the bookmark (απόφαση 12.18). Browser bookmarks αρκούν. Αν ζητηθεί αργότερα → saved reports feature.

### 12.21 Error Handling

**Απόφαση**: Google pattern — graceful degradation. Partial failure, ποτέ full page crash.

- Αν αποτύχει ένα section → μόνο αυτό δείχνει error message + retry button
- Τα υπόλοιπα sections λειτουργούν κανονικά
- **Implementation**: Error boundary ανά section, όχι ανά page. Κάθε hook επιστρέφει `{ data, loading, error, refetch }`

---

## 13. IMPLEMENTATION PLAN (Updated)

### Phase 1: Foundation ✅ COMPLETE (2026-03-28)
- [x] Core report components (13 components: ReportPage, ReportSection, ReportChart, ReportTable, ReportKPIGrid, ReportDateRange, ReportExportBar, ReportEmptyState, ReportGauge, ReportSparkline, ReportTrafficLight, ReportFunnel, ReportAgingTable)
- [ ] EVM calculator service (moved to Phase 2)
- [ ] Aging calculator service (moved to Phase 2)
- [x] Navigation integration (smart-navigation-factory displayOrder:75 + PieChart icon)
- [x] Report i18n namespace (en + el — 101 lines each)
- [x] Okabe-Ito chart palette CSS variables (--report-chart-1..8, light + dark)
- [x] LazyComponents registration (ReportsOverviewLazy)
- [x] Overview page placeholder (/reports)
- [x] Barrel export (index.ts with all types)

**Phase 1 Stats**: 17 new files, 6 modified, 2,657 lines, 0 new dependencies, 0 TS errors

### Phase 2: Executive + Financial
- [ ] Executive Summary page (/reports) — the "investor one-pager"
- [ ] Financial Report page (/reports/financial) — EVM + cash flow

### Phase 3: Domain Reports (batch by domain)
- [ ] Contacts & Customers report
- [ ] Projects & Buildings report
- [ ] Sales & Payment Collections report (with aging)
- [ ] CRM & Pipeline report
- [ ] Spaces (Parking/Storage) report
- [ ] Construction & Timeline report (with EVM detail)
- [ ] Compliance & Labor report

### Phase 4: Export Engine
- [ ] PDF exporter (reusable across all domains)
- [ ] Excel exporter (multi-sheet per domain)
- [ ] Export Center page (/reports/export) — batch export all reports

---

## 13. RESEARCH SOURCES

### Construction Software Platforms
- [Procore Analytics 2.0 Report Pages](https://support.procore.com/products/online/user-guide/company-level/analytics/reports-subpage/analytics-2-report-pages)
- [Procore 360 Reporting Data Guide](https://support.procore.com/products/online/user-guide/company-level/reports/tutorials/enhanced-reporting-data-guide)
- [Procore Reports Platform](https://www.procore.com/platform/reports)
- [Procore Real-Time Dashboards](https://www.procore.com/library/real-time-dashboards)
- [Oracle Primavera P6 Analytics](https://www.oracle.com/construction-engineering/primavera-analytics/)
- [Primavera P6 EPPM](https://www.oracle.com/construction-engineering/primavera-p6/)
- [ACC Dashboards and Data Analytics](https://construction.autodesk.com/tools/dashboards-and-data-analytics/)
- [ACC Insight Builder](https://www.autodesk.com/blogs/construction/simplify-custom-dashboard-creation-with-insight-builder-in-autodesk-construction-cloud/)
- [ACC Power BI Connector](https://learn.microsoft.com/en-us/power-query/connectors/autodesk-construction-cloud)
- [Trimble Construction One Analytics](https://www.trimble.com/en/solutions/trimble-construction-one/analytics)
- [Sage 300 CRE Reporting](https://www.accordantco.com/sage-300-construction-reporting/)

### Report Types & Best Practices
- [13 Types of Construction Reports — Mastt](https://www.mastt.com/blogs/construction-reports-types-examples)
- [Construction Reporting — Procore](https://www.procore.com/library/construction-reporting)
- [Construction Reporting — Autodesk](https://www.autodesk.com/blogs/construction/construction-reporting/)
- [Construction KPIs Guide 2026](https://projul.com/blog/construction-kpi-dashboards-real-time-reporting-guide/)
- [CFMA — Construction KPIs](https://cfma.org/articles/construction-kpis-that-help-build-a-better-business)
- [Top 12 Construction KPIs — SmartPM](https://smartpm.com/blog/12-fundamental-key-performance-indicators-in-construction)

### EVM & Financial
- [EVM for Construction 2025 — APPIT Software](https://www.appitsoftware.com/blog/earned-value-management-construction-guide-2025)
- [EVM S-Curve Reports — Industrial Audit](https://industrialaudit.com/earned-value-management-evm-s-curve/)
- [Earned Value Charts — Ten Six](https://tensix.com/earned-value-charts-explained-with-examples/)
- [Construction Cash Flow — Procore](https://www.procore.com/library/construction-cash-flow-projection)
- [13-Week Cash Flow Forecast — Coefficient](https://coefficient.io/cfo-resources/build-cashflow-forecasting-in-excel)
- [WIP Accounting — Procore](https://www.procore.com/library/work-in-progress-accounting)
- [How Firms Prevent Overruns — CMiC](https://cmicglobal.com/resources/article/how-firms-are-preventing-construction-overruns)

### Google & Dashboard Design
- [Google's Six Rules for Data Design](https://www.fastcompany.com/90369607/googles-six-rules-for-great-data-design)
- [12 Most Useful Looker Studio Charts](https://analytify.io/most-useful-looker-studio-charts/)
- [Material Design 3 Color Roles](https://m3.material.io/styles/color/roles)
- [M3 Data Visualization Accessibility](https://m3.material.io/blog/data-visualization-accessibility)
- [GA4 Report Navigation](https://support.google.com/analytics/answer/10460557)
- [Progressive Disclosure — NN/g](https://www.nngroup.com/articles/progressive-disclosure/)
- [Dashboard Design Patterns — Research](https://www.researchgate.net/publication/363869631_Dashboard_Design_Patterns)
- [KPI Card Anatomy](https://nastengraph.substack.com/p/anatomy-of-the-kpi-card)
- [KPI Card Best Practices](https://tabulareditor.com/blog/kpi-card-best-practices-dashboard-design)

### Accessibility & Dark Mode
- [Colorblind-Friendly Palettes — Visme](https://visme.co/blog/color-blind-friendly-palette/)
- [Coloring for Colorblindness — David Nichols](https://davidmathlogic.com/colorblind/)
- [Accessible Data Visualizations — Smashing Magazine](https://www.smashingmagazine.com/2022/07/accessibility-first-approach-chart-visual-design/)
- [Dark Mode Charts Guide 2026](https://www.cleanchart.app/blog/dark-mode-charts)
- [Dark Mode Dashboard Design](https://www.qodequay.com/dark-mode-dashboards)

### AI & Industry Trends
- [Digital Adoption in Construction 2025 — Deloitte](https://www.deloitte.com/au/en/services/economics/analysis/state-digital-adoption-construction-industry.html)
- [Predictive Analytics in Construction — RTS Labs](https://rtslabs.com/predictive-analytics-in-construction/)
- [43 AI Use Cases in Construction — Mastt](https://www.mastt.com/blogs/ai-use-cases-in-construction)
- [nPlan — AI Construction Forecasting](https://www.nplan.io/)

### Greece Compliance
- [Greece EFKA Payroll Tax Guide](https://remotepeople.com/countries/greece/hire-employees/payroll-tax/)

### Chart Libraries & Frameworks
- [Tremor](https://www.tremor.so/)
- [Shadcn/UI Charts](https://ui.shadcn.com/charts/area)
- [Best Color Palettes for Charts 2026](https://www.cleanchart.app/blog/data-visualization-color-palettes)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-28 | Initial research complete — 6 parallel agents, all domains covered |
| 2026-03-28 | Web research: 13 report types, EVM, aging, executive summary, Google design rules, chart selection matrix, Greece compliance, updated structure (+28 files) |
| 2026-03-28 | **MAJOR UPDATE**: 4 parallel web agents, 60+ sources. Added: Platform comparison (Procore/Oracle/ACC/Trimble/Sage), Report hierarchy (3-tier), TOP 10 reports ranked by importance, KPI card anatomy (4 layers), Dashboard drill-down (3 levels), Color-blind palettes (Okabe-Ito + IBM), Dark mode guidelines, Mobile reporting priorities, AI trends (37% adoption), Cash flow best practices, Comparison chart patterns, Industry statistics (Deloitte 2024) |
| 2026-03-28 | Added Section 8.21: Global construction companies (Skanska/Balfour Beatty real KPIs), report escalation chain, board-level KPIs with benchmarks, monthly report sections (KPMG), 4 essential financial statements, bonding capacity formula |
| 2026-03-28 | **6 engineering decisions** (12.22-12.27): Hybrid data aggregation (50x cheaper), in-memory cache 5min TTL, lazy loading + dynamic import exports, custom SVG gauge/traffic light (zero deps), responsive layout, stub export buttons Phase 1 |
| 2026-03-28 | **Decision 12.28**: Zero νέες Firestore collections — reports read-only από existing data, free tier αρκεί |
| 2026-03-28 | **PHASE 1 COMPLETE**: 13 core components (2,420 lines), i18n (en+el), navigation (displayOrder:75), Okabe-Ito CSS vars, LazyComponents, /reports page — 17 new files, 6 modified, 0 new deps, 0 TS errors |
