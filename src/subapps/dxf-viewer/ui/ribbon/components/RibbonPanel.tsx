'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  RibbonButton,
  RibbonPanelDef,
  RibbonRow,
} from '../types/ribbon-types';
import { RibbonLargeButton } from './buttons/RibbonLargeButton';
import { RibbonSmallButton } from './buttons/RibbonSmallButton';
import { RibbonSplitButton } from './buttons/RibbonSplitButton';
import { RibbonToggleButton } from './buttons/RibbonToggleButton';
import { RibbonCombobox } from './buttons/RibbonCombobox';
import { ZoomControlsWidget } from './ZoomControlsWidget';
import { RibbonColorSwatchWidget } from './RibbonColorSwatchWidget';
import { OpeningTagPillColorWidget, OpeningTagLeaderColorWidget } from './OpeningTagStyleColorWidget';
import { RibbonJustificationGridWidget } from './RibbonJustificationGridWidget';
import { RibbonFontFamilyWidget } from './RibbonFontFamilyWidget';
import { RibbonLineSpacingWidget } from './RibbonLineSpacingWidget';
import { RibbonAnnotationScaleWidget } from './RibbonAnnotationScaleWidget';
import { DrawingScaleWidget } from './DrawingScaleWidget';
import { ViewRangePanel } from '../panels/ViewRangePanel';
import { ObjectStylesPanel } from '../panels/ObjectStylesPanel';
import { SubcategoriesPanel } from '../panels/SubcategoriesPanel';
import { PenTablePanel } from '../panels/PenTablePanel';
import { ViewTemplatesPanel } from '../panels/ViewTemplatesPanel';
import { VisibilityGraphicsPanel } from '../panels/VisibilityGraphicsPanel';
import { HideBimToggle } from './HideBimToggle';
import { MepWireToggle } from './MepWireToggle';
import { DrainPipeToggle } from './DrainPipeToggle';
import { ColorBySystemToggle } from './ColorBySystemToggle';
import { ShowHeatLoadToggle } from './ShowHeatLoadToggle';
import { ShowPipeSizingToggle } from './ShowPipeSizingToggle';
import { ShowBalancingToggle } from './ShowBalancingToggle';
import { ExportThermalStudyButton } from './ExportThermalStudyButton';
import { VisualStyleSelect } from './VisualStyleSelect';
import { DisciplineVisibilityToggle } from './DisciplineVisibilityToggle';
import { RibbonInsertTokenWidget } from './RibbonInsertTokenWidget';
import { RibbonStairFloorInfoWidget } from './RibbonStairFloorInfoWidget';
import { RibbonStairDimensionsWidget } from './RibbonStairDimensionsWidget';
import { RibbonWallDimensionWidget } from './RibbonWallDimensionWidget';
import { RibbonWallFamilyTypeWidget } from './RibbonWallFamilyTypeWidget';
import { RibbonWallTypePropertiesWidget } from './RibbonWallTypePropertiesWidget';
import { RibbonSlabFamilyTypeWidget } from './RibbonSlabFamilyTypeWidget';
import { RibbonRoofFamilyTypeWidget } from './RibbonRoofFamilyTypeWidget';
import { RibbonRoofTypePropertiesWidget } from './RibbonRoofTypePropertiesWidget';
import { RibbonOpeningFamilyTypeWidget } from './RibbonOpeningFamilyTypeWidget';
import { RibbonOpeningTypePropertiesWidget } from './RibbonOpeningTypePropertiesWidget';
import { RibbonMepCircuitPickerWidget } from './RibbonMepCircuitPickerWidget';
import { RibbonMepFixtureCircuitWidget } from './RibbonMepFixtureCircuitWidget';
import { RibbonMepCircuitNameWidget } from './RibbonMepCircuitNameWidget';
import { RibbonMepCircuitColorWidget } from './RibbonMepCircuitColorWidget';
import { RibbonMepCircuitWireStyleWidget } from './RibbonMepCircuitWireStyleWidget';
import { RibbonMepCircuitConductorsWidget } from './RibbonMepCircuitConductorsWidget';
import { RibbonMepNetworkClassificationWidget } from './RibbonMepNetworkClassificationWidget';
import { MultiSelectionCommonPropertiesPanel } from './MultiSelectionCommonPropertiesPanel';
import { MultiSelectionFilterPanel } from './MultiSelectionFilterPanel';
import { CurrentLayerPicker } from '../../components/layer-picker/CurrentLayerPicker';

interface RibbonPanelProps {
  panel: RibbonPanelDef;
  /** ADR-345 Fase 7 — whether this panel's flyout is pinned open. */
  isPinned?: boolean;
  /** ADR-345 Fase 7 — callback to toggle pin state. */
  onPinToggle?: (panelId: string) => void;
}

function renderButton(button: RibbonButton): React.ReactNode {
  const key = button.command.id;
  if (button.type === 'color-swatch') {
    return <RibbonColorSwatchWidget key={button.command.id} />;
  }
  if (button.type === 'widget') {
    if (button.widgetId === 'zoom-controls') {
      return <ZoomControlsWidget key="zoom-controls-widget" />;
    }
    if (button.widgetId === 'justification-grid') {
      return <RibbonJustificationGridWidget key="justification-grid-widget" />;
    }
    if (button.widgetId === 'font-family') {
      return <RibbonFontFamilyWidget key="font-family-widget" />;
    }
    if (button.widgetId === 'line-spacing') {
      return <RibbonLineSpacingWidget key="line-spacing-widget" />;
    }
    if (button.widgetId === 'annotation-scale') {
      return <RibbonAnnotationScaleWidget key="annotation-scale-widget" />;
    }
    if (button.widgetId === 'drawing-scale') {
      return <DrawingScaleWidget key="drawing-scale-widget" />;
    }
    if (button.widgetId === 'view-range') {
      return <ViewRangePanel key="view-range-widget" />;
    }
    if (button.widgetId === 'object-styles') {
      return <ObjectStylesPanel key="object-styles-widget" />;
    }
    if (button.widgetId === 'subcategories') {
      return <SubcategoriesPanel key="subcategories-widget" />;
    }
    if (button.widgetId === 'pen-table') {
      return <PenTablePanel key="pen-table-widget" />;
    }
    if (button.widgetId === 'view-templates') {
      return <ViewTemplatesPanel key="view-templates-widget" />;
    }
    if (button.widgetId === 'visibility-graphics') {
      return <VisibilityGraphicsPanel key="visibility-graphics-widget" />;
    }
    if (button.widgetId === 'hide-bim') {
      return <HideBimToggle key="hide-bim-widget" />;
    }
    if (button.widgetId === 'mep-wire-toggle') {
      return <MepWireToggle key="mep-wire-toggle-widget" />;
    }
    if (button.widgetId === 'drain-pipe-toggle') {
      return <DrainPipeToggle key="drain-pipe-toggle-widget" />;
    }
    if (button.widgetId === 'color-by-system-toggle') {
      return <ColorBySystemToggle key="color-by-system-toggle-widget" />;
    }
    if (button.widgetId === 'show-heat-load-toggle') {
      return <ShowHeatLoadToggle key="show-heat-load-toggle-widget" />;
    }
    if (button.widgetId === 'show-pipe-sizing-toggle') {
      return <ShowPipeSizingToggle key="show-pipe-sizing-toggle-widget" />;
    }
    if (button.widgetId === 'show-balancing-toggle') {
      return <ShowBalancingToggle key="show-balancing-toggle-widget" />;
    }
    if (button.widgetId === 'export-thermal-study') {
      return <ExportThermalStudyButton key="export-thermal-study-widget" />;
    }
    if (button.widgetId === 'visual-style-select') {
      return <VisualStyleSelect key="visual-style-select-widget" />;
    }
    if (button.widgetId === 'discipline-visibility') {
      return <DisciplineVisibilityToggle key="discipline-visibility-widget" />;
    }
    if (button.widgetId === 'insert-tokens') {
      return <RibbonInsertTokenWidget key="insert-tokens-widget" />;
    }
    if (button.widgetId === 'current-layer-picker') {
      return <CurrentLayerPicker key="current-layer-picker-widget" variant="ribbon" />;
    }
    if (button.widgetId === 'stair-floor-info') {
      return <RibbonStairFloorInfoWidget key="stair-floor-info-widget" />;
    }
    if (button.widgetId === 'stair-dimensions') {
      return <RibbonStairDimensionsWidget key="stair-dimensions-widget" />;
    }
    if (button.widgetId === 'wall-length') {
      return <RibbonWallDimensionWidget key="wall-length-widget" dimension="length" />;
    }
    if (button.widgetId === 'wall-height') {
      return <RibbonWallDimensionWidget key="wall-height-widget" dimension="height" />;
    }
    if (button.widgetId === 'wall-thickness') {
      return <RibbonWallDimensionWidget key="wall-thickness-widget" dimension="thickness" />;
    }
    if (button.widgetId === 'wall-family-type') {
      return <RibbonWallFamilyTypeWidget key="wall-family-type-widget" />;
    }
    if (button.widgetId === 'wall-type-properties') {
      return <RibbonWallTypePropertiesWidget key="wall-type-properties-widget" />;
    }
    if (button.widgetId === 'slab-family-type') {
      return <RibbonSlabFamilyTypeWidget key="slab-family-type-widget" />;
    }
    if (button.widgetId === 'roof-family-type') {
      return <RibbonRoofFamilyTypeWidget key="roof-family-type-widget" />;
    }
    if (button.widgetId === 'roof-type-properties') {
      return <RibbonRoofTypePropertiesWidget key="roof-type-properties-widget" />;
    }
    if (button.widgetId === 'opening-family-type') {
      return <RibbonOpeningFamilyTypeWidget key="opening-family-type-widget" />;
    }
    if (button.widgetId === 'opening-type-properties') {
      return <RibbonOpeningTypePropertiesWidget key="opening-type-properties-widget" />;
    }
    if (button.widgetId === 'multi-selection-common-properties') {
      return <MultiSelectionCommonPropertiesPanel key="multi-selection-common-widget" />;
    }
    if (button.widgetId === 'multi-selection-filter') {
      return <MultiSelectionFilterPanel key="multi-selection-filter-widget" />;
    }
    if (button.widgetId === 'opening-tag-pill-color') {
      return <OpeningTagPillColorWidget key="opening-tag-pill-color-widget" />;
    }
    if (button.widgetId === 'opening-tag-leader-color') {
      return <OpeningTagLeaderColorWidget key="opening-tag-leader-color-widget" />;
    }
    if (button.widgetId === 'mep-fixture-circuit-info') {
      return <RibbonMepFixtureCircuitWidget key="mep-fixture-circuit-info-widget" />;
    }
    if (button.widgetId === 'mep-circuit-picker') {
      return <RibbonMepCircuitPickerWidget key="mep-circuit-picker-widget" />;
    }
    if (button.widgetId === 'mep-circuit-name') {
      return <RibbonMepCircuitNameWidget key="mep-circuit-name-widget" />;
    }
    if (button.widgetId === 'mep-circuit-color') {
      return <RibbonMepCircuitColorWidget key="mep-circuit-color-widget" />;
    }
    if (button.widgetId === 'mep-circuit-wire-style') {
      return <RibbonMepCircuitWireStyleWidget key="mep-circuit-wire-style-widget" />;
    }
    if (button.widgetId === 'mep-circuit-conductors') {
      return <RibbonMepCircuitConductorsWidget key="mep-circuit-conductors-widget" />;
    }
    if (button.widgetId === 'mep-network-classification') {
      return <RibbonMepNetworkClassificationWidget key="mep-network-classification-widget" />;
    }
    return null;
  }
  if (button.type === 'split') {
    return <RibbonSplitButton key={key} button={button} />;
  }
  if (button.type === 'toggle') {
    return <RibbonToggleButton key={key} command={button.command} />;
  }
  if (button.type === 'combobox') {
    return <RibbonCombobox key={key} command={button.command} />;
  }
  if (button.size === 'large') {
    return <RibbonLargeButton key={key} command={button.command} />;
  }
  return <RibbonSmallButton key={key} command={button.command} />;
}

function rowSize(row: RibbonRow): 'large' | 'small' | 'mixed' {
  if (row.buttons.length === 0) return 'large';
  const first = row.buttons[0].size;
  return row.buttons.every((b) => b.size === first) ? first : 'mixed';
}

export const RibbonPanel: React.FC<RibbonPanelProps> = ({
  panel,
  isPinned = false,
  onPinToggle,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const containerRef = useRef<HTMLElement>(null);

  const normalRows = panel.rows.filter((r) => !r.isInFlyout && r.buttons.length > 0);
  const flyoutRows = panel.rows.filter((r) => r.isInFlyout && r.buttons.length > 0);
  const hasFlyout = flyoutRows.length > 0;
  const flyoutVisible = isPinned || isFlyoutOpen;

  const toggleFlyout = useCallback(() => {
    if (!isPinned) setIsFlyoutOpen((prev) => !prev);
  }, [isPinned]);

  const handlePinToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPinToggle?.(panel.id);
      setIsFlyoutOpen(false);
    },
    [onPinToggle, panel.id],
  );

  // Close flyout on outside click when not pinned
  useEffect(() => {
    if (!isFlyoutOpen || isPinned) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFlyoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isFlyoutOpen, isPinned]);

  const hasContent = normalRows.length > 0;

  return (
    <section
      ref={containerRef}
      className="dxf-ribbon-panel"
      data-panel-id={panel.id}
      data-flyout-open={flyoutVisible}
    >
      <div className="dxf-ribbon-panel-body" data-empty={!hasContent}>
        {hasContent
          ? normalRows.map((row, idx) => (
              <div
                key={idx}
                className="dxf-ribbon-panel-row"
                data-row-size={rowSize(row)}
              >
                {row.buttons.map(renderButton)}
              </div>
            ))
          : t('ribbon.panels.placeholder')}
      </div>

      {hasFlyout && (
        <button
          type="button"
          className="dxf-ribbon-flyout-trigger"
          aria-label={t('ribbon.flyout.expand')}
          aria-expanded={flyoutVisible}
          onClick={toggleFlyout}
        >
          <span className="dxf-ribbon-flyout-chevron" aria-hidden="true">
            {flyoutVisible ? '▲' : '▼'}
          </span>
        </button>
      )}

      {hasFlyout && flyoutVisible && (
        <div className="dxf-ribbon-flyout-rows" role="group">
          {flyoutRows.map((row, idx) => (
            <div
              key={idx}
              className="dxf-ribbon-panel-row"
              data-row-size={rowSize(row)}
            >
              {row.buttons.map(renderButton)}
            </div>
          ))}
          <button
            type="button"
            className="dxf-ribbon-flyout-pin"
            aria-label={t(isPinned ? 'ribbon.flyout.unpin' : 'ribbon.flyout.pin')}
            aria-pressed={isPinned}
            onClick={handlePinToggle}
          >
            📌
          </button>
        </div>
      )}
    </section>
  );
};
