// SpecificSettingsPanel.tsx - Specific settings panel router (extracted from DxfSettingsPanel)
// STATUS: ACTIVE - Phase 3 Step 3.8
// PURPOSE: Router for all 7 Specific Settings categories with lazy loading

import { INTERACTIVE_PATTERNS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { PANEL_TOKENS, PanelTokenUtils, PANEL_LAYOUT } from '../../../../config/panel-tokens';

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  CROSS-REFERENCES: docs/dxf-settings/MIGRATION_CHECKLIST.md (STEP 3.8)    ║
 * ║  Parent: DxfSettingsPanel.tsx (Specific tab)                               ║
 * ║  Uses: All 7 category components (lazy loaded)                             ║
 * ║  Categories: Selection, Cursor, Grid, Layers, Entities, Grips, Lighting    ║
 * ║  Icons: icons/DxfSettingsIcons.tsx                                         ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */

import React, { Suspense, lazy, useState } from 'react';
import {
  CrosshairIcon,
  SelectionIcon,
  GridIcon,
  GripsIcon,
  LayersIcon,
  EntitiesIcon,
  LightingIcon
} from '../icons/DxfSettingsIcons';

/**
 * SpecificSettingsPanel - Router for all Specific Settings categories
 *
 * Purpose:
 * - Display category navigation (icon-based, tooltip on hover)
 * - Route to appropriate category component based on selection
 * - Lazy load category components for performance
 *
 * Categories (7 total):
 * 1. Selection - Selection settings (window/crossing)
 * 2. Cursor - Cursor & Crosshair settings (2 sub-tabs)
 * 3. Grid - Grid & Rulers settings (2 main tabs, 6 total sub-tabs)
 * 4. Layers - Layers settings
 * 5. Entities - Entities settings
 * 6. Grips - Coming Soon
 * 7. Lighting - Coming Soon
 *
 * Architecture:
 * - Category state managed locally (useState)
 * - Lazy loading via React.lazy() and Suspense
 * - Icon-based navigation with tooltips
 *
 * State:
 * - activeCategory: Currently selected category
 * - Settings state managed by child components
 *
 * @see docs/dxf-settings/COMPONENT_GUIDE.md#SpecificSettingsPanel
 * @see docs/dxf-settings/ARCHITECTURE.md - Panel routing pattern
 *
 * @example
 * ```tsx
 * // In DxfSettingsPanel.tsx
 * {activeMainTab === 'specific' && (
 *   <SpecificSettingsPanel />
 * )}
 * ```
 */

// ============================================================================
// LAZY LOADED COMPONENTS
// ============================================================================

const LazySelectionCategory = lazy(() => import('../categories/SelectionCategory'));
const LazyCursorCategory = lazy(() => import('../categories/CursorCategory'));
const LazyGridCategory = lazy(() => import('../categories/GridCategory'));
const LazyLayersCategory = lazy(() => import('../categories/LayersCategory'));
const LazyEntitiesCategory = lazy(() => import('../categories/EntitiesCategory'));
const LazyGripsCategory = lazy(() => import('../categories/GripsCategory'));
const LazyLightingCategory = lazy(() => import('../categories/LightingCategory'));

// ============================================================================
// TYPES
// ============================================================================

export interface SpecificSettingsPanelProps {
  className?: string;
  defaultCategory?: ColorCategory;
}

type ColorCategory = 'cursor' | 'selection' | 'grid' | 'grips' | 'layers' | 'entities' | 'lighting';

interface CategoryConfig {
  id: ColorCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
  comingSoon?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const SpecificSettingsPanel: React.FC<SpecificSettingsPanelProps> = ({
  className = '',
  defaultCategory = 'selection'
}) => {
  // ============================================================================
  // STATE
  // ============================================================================

  const [activeCategory, setActiveCategory] = useState<ColorCategory>(defaultCategory);

  // ============================================================================
  // CATEGORY CONFIGURATION
  // ============================================================================

  const categories: CategoryConfig[] = [
    {
      id: 'selection',
      title: 'Επιλογή (Selection)',
      description: 'Ρυθμίσεις επιλογής αντικειμένων',
      icon: <SelectionIcon />
    },
    {
      id: 'cursor',
      title: 'Κέρσορας (Cursor)',
      description: 'Ρυθμίσεις κέρσορα και σταυρονήματος',
      icon: <CrosshairIcon />
    },
    {
      id: 'grid',
      title: 'Πλέγμα & Χάρακες (Grid & Rulers)',
      description: 'Ρυθμίσεις πλέγματος και χαράκων',
      icon: <GridIcon />
    },
    {
      id: 'layers',
      title: 'Επίπεδα (Layers)',
      description: 'Ρυθμίσεις επιπέδων',
      icon: <LayersIcon />
    },
    {
      id: 'entities',
      title: 'Οντότητες (Entities)',
      description: 'Ρυθμίσεις οντοτήτων DXF',
      icon: <EntitiesIcon />
    },
    {
      id: 'grips',
      title: 'Grips',
      description: 'Ρυθμίσεις grips (σύντομα)',
      icon: <GripsIcon />,
      comingSoon: true
    },
    {
      id: 'lighting',
      title: 'Φωτισμός (Lighting)',
      description: 'Ρυθμίσεις φωτισμού (σύντομα)',
      icon: <LightingIcon />,
      comingSoon: true
    }
  ];

  // ============================================================================
  // RENDER CATEGORY CONTENT
  // ============================================================================

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'selection':
        return <LazySelectionCategory />;
      case 'cursor':
        return <LazyCursorCategory />;
      case 'grid':
        return <LazyGridCategory />;
      case 'layers':
        return <LazyLayersCategory />;
      case 'entities':
        return <LazyEntitiesCategory />;
      case 'grips':
        return <LazyGripsCategory />;
      case 'lighting':
        return <LazyLightingCategory />;
      default:
        return <LazySelectionCategory />;
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={className}>
      {/* Category Navigation - Icon Only - 🏢 ENTERPRISE: Centralized spacing */}
      <nav className={`flex ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.SPACING.SM}`}>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            disabled={category.comingSoon}
            title={category.title}
            className={PanelTokenUtils.getSpecificCategoryButtonClasses(
              activeCategory === category.id,
              category.comingSoon
            )}
          >
            {category.icon}
            {category.comingSoon && (
              <span className={PANEL_TOKENS.SPECIFIC_SETTINGS.COMING_SOON_BADGE.BASE}>
                !
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Category Content - 🏢 ENTERPRISE: Using centralized CONTENT_WRAPPER token for consistent padding */}
      <Suspense
        fallback={
          <div className={PANEL_TOKENS.SPECIFIC_SETTINGS.FALLBACK_CONTENT.BASE}>
            Φόρτωση...
          </div>
        }
      >
        <div className={PANEL_TOKENS.SPECIFIC_SETTINGS.CONTENT_WRAPPER}>
          {renderCategoryContent()}
        </div>
      </Suspense>
    </div>
  );
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default SpecificSettingsPanel;

/**
 * MIGRATION NOTES: Extracted from DxfSettingsPanel.tsx lines 800-2113
 *
 * Original code:
 * ```tsx
 * {activeMainTab === 'specific' && (
 *   <div>
 *     {/* Category Navigation - Icon Only *\/}
 *     <nav className="flex gap-1 mb-4 p-2">
 *       {categories.map((category) => (
 *         <button onClick={() => setActiveCategory(category.id)}>
 *           {category.icon}
 *         </button>
 *       ))}
 *     </nav>
 *
 *     {/* Category Content (inline switch) *\/}
 *     {(() => {
 *       switch (activeCategory) {
 *         case 'cursor': return <div>{/* 400+ lines inline *\/}</div>;
 *         case 'selection': return <SelectionSettings />;
 *         case 'grid': return <div>{/* 915 lines inline *\/}</div>;
 *         case 'layers': return <LayersSettings />;
 *         case 'entities': return <EntitiesSettings />;
 *         default: return <ComingSoonSettings />;
 *       }
 *     })()}
 *   </div>
 * )}
 * ```
 *
 * Changes:
 * - ✅ Extracted entire Specific tab to SpecificSettingsPanel component
 * - ✅ All 7 categories now lazy loaded for performance
 * - ✅ Created 7 category components:
 *   1. SelectionCategory (simple wrapper)
 *   2. CursorCategory (2 sub-tabs: Crosshair, Cursor)
 *   3. GridCategory (2 main tabs: Grid, Rulers with 6 total sub-tabs)
 *   4. LayersCategory (simple wrapper)
 *   5. EntitiesCategory (simple wrapper)
 *   6. GripsCategory (Coming Soon)
 *   7. LightingCategory (Coming Soon)
 * - ✅ Clean separation: SpecificSettingsPanel (routing) vs categories (UI)
 * - ✅ Consistent pattern with GeneralSettingsPanel
 *
 * Benefits:
 * - ✅ Single Responsibility (SpecificSettingsPanel = Category routing only)
 * - ✅ Lazy loading for all categories (performance)
 * - ✅ Reusable category components
 * - ✅ Testable in isolation
 * - ✅ Cleaner parent component (DxfSettingsPanel)
 * - ✅ Consistent architecture across all panels
 */
