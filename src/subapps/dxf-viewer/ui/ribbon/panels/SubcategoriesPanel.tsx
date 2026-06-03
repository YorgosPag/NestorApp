'use client';

/**
 * ADR-377 Phase D — Subcategories Panel (Revit Object Styles dialog equivalent).
 *
 * Ribbon `widget` (registered in `RibbonPanel.tsx` as `widgetId: 'subcategories'`)
 * that opens a Radix Dialog with ArchiCAD-style per-category tabs. Each tab lists
 * its subcategory rows; wired rows expose dual (projection/cut) pen + color and a
 * line-pattern dropdown, stub rows are greyed (🔒).
 *
 * SSoT: reads `objectStyles` from `useBimRenderSettingsStore`, writes via the
 * Phase-D setters (`setSubcategoryStyleField` / `clearSubcategoryStyle` /
 * `resetCategorySubcategories` / `resetAllSubcategories`). 2D renderers pick up
 * changes live (bitmap-cache key includes objectStyles). 3D parity = Phase E.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-377-bim-subcategories-system.md §6.1
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, Palette } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { getSubcategoryTabs, type SubcategoryTab } from './subcategory-tabs';
import { SubcategoryRow } from './SubcategoryRow';
import { SubcategoriesPanelFooter } from './SubcategoriesPanelFooter';

const GRID_COLS = 'grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-x-2 gap-y-1 items-center';

export const SubcategoriesPanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);

  const tabs = useMemo(() => getSubcategoryTabs(), []);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.subcategories.label')}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            aria-label={t('ribbon.commands.subcategories.label')}
            className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
          >
            <Palette className="w-3 h-3 opacity-70" aria-hidden />
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('ribbon.commands.subcategories.dialogTitle')}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTabId} onValueChange={setActiveTabId}>
            <TabsList className="flex-wrap h-auto justify-start">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {t(tab.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-3">
                <SubcategoryTabGrid tab={tab} />
              </TabsContent>
            ))}
          </Tabs>

          <SubcategoriesPanelFooter
            activeTab={tabs.find((tb) => tb.id === activeTabId) ?? tabs[0]}
          />
        </DialogContent>
      </Dialog>
    </span>
  );
};

interface SubcategoryTabGridProps {
  tab: SubcategoryTab;
}

/** Column-header row + one `SubcategoryRow` per key for the active tab. */
const SubcategoryTabGrid: React.FC<SubcategoryTabGridProps> = ({ tab }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const setField = useBimRenderSettingsStore((s) => s.setSubcategoryStyleField);
  const clear = useBimRenderSettingsStore((s) => s.clearSubcategoryStyle);

  const parent = objectStyles[tab.category];
  const header = `${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium text-center`;

  return (
    <div className={`${GRID_COLS} max-h-[50vh] overflow-y-auto pr-1`}>
      <span />
      <span className={header}>{t('ribbon.commands.subcategories.projectionPen')}</span>
      <span className={header}>{t('ribbon.commands.subcategories.cutPen')}</span>
      <span className={header}>{t('ribbon.commands.subcategories.pattern')}</span>
      <span className={header}>{t('ribbon.commands.subcategories.projectionColor')}</span>
      <span className={header}>{t('ribbon.commands.subcategories.cutColor')}</span>
      <span />

      {tab.keys.map((key) => (
        <SubcategoryRow
          key={`${tab.category}:${key}`}
          category={tab.category}
          subcategoryKey={key}
          override={parent.subcategories?.[key]}
          parent={parent}
          onSetField={(field, value) => setField(tab.category, key, field, value)}
          onClear={() => clear(tab.category, key)}
        />
      ))}
    </div>
  );
};
