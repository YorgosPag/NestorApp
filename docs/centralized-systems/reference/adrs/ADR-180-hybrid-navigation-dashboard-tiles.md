# ADR-180: Hybrid Navigation — Dashboard Home με Navigation Tiles

## Status
**IMPLEMENTED** | 2026-02-14

## Context

Η εφαρμογή Nestor είχε sidebar navigation αλλά έλειπε ένα **Dashboard Home** με μεγάλα navigation cards/tiles. Ο Γιώργος ζήτησε υβριδικό μοντέλο: sidebar (πάντα visible) **+** dashboard οθόνη με μεγάλα πλήκτρα-καρτέλες πλοήγησης.

### Inspiration
- **SAP Fiori Launchpad**: Tile-based navigation dashboard
- **Salesforce Lightning**: App Launcher with cards
- **Procore**: Construction management dashboard tiles

## Decision

Αντικατάσταση του public landing page (`/`) με Dashboard Home για authenticated users. Redirect σε `/login` για anonymous users.

### Architecture
- **Phase 1**: Static cards (Icon + Title + Description), no Firestore queries
- **Pattern**: SAP Fiori Launchpad tile grid
- **Responsive**: 1 col (mobile) → 2 col (tablet) → 3-4 col (desktop)

## Components Created

| Component | Path | Purpose |
|-----------|------|---------|
| `DashboardHome` | `src/components/dashboard/DashboardHome.tsx` | Main orchestrator |
| `DashboardWelcome` | `src/components/dashboard/DashboardWelcome.tsx` | Time-based greeting header |
| `QuickActionsStrip` | `src/components/dashboard/QuickActionsStrip.tsx` | Prominent quick action buttons |
| `NavigationCard` | `src/components/dashboard/NavigationCard.tsx` | Reusable tile component |
| `NavigationGrid` | `src/components/dashboard/NavigationGrid.tsx` | CSS Grid responsive wrapper |

## Modified Files

| File | Change |
|------|--------|
| `src/app/page.tsx` | Auth conditional: Dashboard or redirect to /login |
| `src/i18n/locales/el/dashboard.json` | Greek translations for tiles |
| `src/i18n/locales/en/dashboard.json` | English translations for tiles |

## Navigation Tile Mapping

### Main Menu (8 tiles)
| Module | Route | Color |
|--------|-------|-------|
| Ευρετήριο Ακινήτων | `/properties` | blue |
| Επαφές | `/contacts` | green |
| Έργα | `/audit` | purple |
| Κτίρια | `/buildings` | orange |
| Χώροι | `/spaces` | teal |
| Πωλήσεις | `/sales` | yellow |
| CRM | `/crm` | indigo |
| Λογιστικό | `/accounting` | pink |

### Tools (4 tiles)
| Module | Route | Color |
|--------|-------|-------|
| Αρχεία | `/files` | blue |
| Νομικά | `/legal-documents` | purple |
| Geo-Canvas | `/geo/canvas` | green |
| DXF Viewer | `/dxf/viewer` | orange |

## Design Patterns Used

- **shadcn Card**: Base card component
- **COMPLEX_HOVER_EFFECTS.FEATURE_CARD**: Lift + shadow hover
- **TRANSITION_PRESETS**: Smooth transitions
- **useIconSizes()**: Responsive icon sizing
- **useSemanticColors()**: Theme-aware colors
- **Badge**: PRO / ENTERPRISE badges on tiles
- **i18n**: Full el/en translation support

## Consequences

- Landing page no longer public — authenticated-only dashboard
- Sidebar + Dashboard coexist (hybrid navigation)
- Future Phase 2 could add Firestore-based stats counters on tiles
