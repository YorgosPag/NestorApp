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
import { PlanLinesToggle } from './PlanLinesToggle';
import { MepWireToggle } from './MepWireToggle';
import { DrainPipeToggle } from './DrainPipeToggle';
import { ColorBySystemToggle } from './ColorBySystemToggle';
import { ShowHeatLoadToggle } from './ShowHeatLoadToggle';
import { ShowFinishSkinToggle } from './ShowFinishSkinToggle';
import { ShowReinforcementToggle } from './ShowReinforcementToggle';
import { ShowPipeSizingToggle } from './ShowPipeSizingToggle';
import { ShowAnalysisDiagramsToggle } from './ShowAnalysisDiagramsToggle';
import { DiagramComponentSelect } from './DiagramComponentSelect';
import { ShowUtilizationToggle } from './ShowUtilizationToggle';
import { ShowBalancingToggle } from './ShowBalancingToggle';
import { ExportThermalStudyButton } from './ExportThermalStudyButton';
import { VisualStyleSelect } from './VisualStyleSelect';
import { StructuralComponentVisibilitySelect } from './StructuralComponentVisibilitySelect';
import { DisciplineVisibilityToggle } from './DisciplineVisibilityToggle';
import { RibbonInsertTokenWidget } from './RibbonInsertTokenWidget';
import { RibbonStairFloorInfoWidget } from './RibbonStairFloorInfoWidget';
import { RibbonStairDimensionsWidget } from './RibbonStairDimensionsWidget';
import { RibbonWallDimensionWidget } from './RibbonWallDimensionWidget';
import { RibbonWallFamilyTypeWidget } from './RibbonWallFamilyTypeWidget';
import { RibbonWallTypePropertiesWidget } from './RibbonWallTypePropertiesWidget';
import { RibbonWallJoinWidget } from './RibbonWallJoinWidget';
import { RibbonWallDrawModeWidget } from './RibbonWallDrawModeWidget';
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
import { RibbonHatchListWidget } from './RibbonHatchListWidget';
// ADR-662 Φάση 1b — «Τοπογραφικό» live toggles + numeric fields.
import {
  TopoGridVisibleToggle,
  NorthArrowVisibleToggle,
  PointCloud3DVisibleToggle,
  ContourStyleToggle,
  NorthModeToggle,
  CutFillModeToggle,
} from './TopoRibbonToggleWidgets';
import {
  ContourIntervalField,
  ContourIndexField,
  GridStepField,
} from './TopoRibbonNumericWidgets';
// ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» toggle widget.
import { DimRowHandlesToggle } from './DimRowHandlesToggle';
import { DimNewLinePatternWidget } from './DimNewLinePatternWidget';
import { LineNewLinePatternWidget } from './LineNewLinePatternWidget';
import { LineEditLinePatternWidget } from './LineEditLinePatternWidget';
import { MultiSelectionCommonPropertiesPanel } from './MultiSelectionCommonPropertiesPanel';
import { MultiSelectionFilterPanel } from './MultiSelectionFilterPanel';
import { CurrentLayerPicker } from '../../components/layer-picker/CurrentLayerPicker';
import { useRibbonPanelVisibility } from '../context/useRibbonFieldSelectors';

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
    if (button.widgetId === 'plan-lines') {
      return <PlanLinesToggle key="plan-lines-widget" />;
    }
    if (button.widgetId === 'dim-row-handles-toggle') {
      return <DimRowHandlesToggle key="dim-row-handles-toggle-widget" />;
    }
    if (button.widgetId === 'dim-new-line-pattern') {
      return <DimNewLinePatternWidget key="dim-new-line-pattern-widget" />;
    }
    // ADR-510 Φ2E #3 — «＋ Νέος τύπος» στο LINE tab (creates + assigns to the line).
    if (button.widgetId === 'line-new-line-pattern') {
      return <LineNewLinePatternWidget key="line-new-line-pattern-widget" />;
    }
    // ADR-642 — «✎ Επεξεργασία / ⧉ Διπλότυπο» for the current linetype (edit-in-place / duplicate).
    if (button.widgetId === 'line-edit-line-pattern') {
      return <LineEditLinePatternWidget key="line-edit-line-pattern-widget" />;
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
    if (button.widgetId === 'show-finish-skin-toggle') {
      return <ShowFinishSkinToggle key="show-finish-skin-toggle-widget" />;
    }
    if (button.widgetId === 'show-reinforcement-toggle') {
      return <ShowReinforcementToggle key="show-reinforcement-toggle-widget" />;
    }
    if (button.widgetId === 'show-pipe-sizing-toggle') {
      return <ShowPipeSizingToggle key="show-pipe-sizing-toggle-widget" />;
    }
    if (button.widgetId === 'show-balancing-toggle') {
      return <ShowBalancingToggle key="show-balancing-toggle-widget" />;
    }
    if (button.widgetId === 'show-analysis-diagrams-toggle') {
      return <ShowAnalysisDiagramsToggle key="show-analysis-diagrams-toggle-widget" />;
    }
    if (button.widgetId === 'diagram-component-select') {
      return <DiagramComponentSelect key="diagram-component-select-widget" />;
    }
    if (button.widgetId === 'show-utilization-toggle') {
      return <ShowUtilizationToggle key="show-utilization-toggle-widget" />;
    }
    if (button.widgetId === 'export-thermal-study') {
      return <ExportThermalStudyButton key="export-thermal-study-widget" />;
    }
    if (button.widgetId === 'visual-style-select') {
      return <VisualStyleSelect key="visual-style-select-widget" />;
    }
    if (button.widgetId === 'structural-component-visibility') {
      return <StructuralComponentVisibilitySelect key="structural-component-visibility-widget" />;
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
    if (button.widgetId === 'wall-joins') {
      return <RibbonWallJoinWidget key="wall-joins-widget" />;
    }
    if (button.widgetId === 'wall-draw-mode') {
      return <RibbonWallDrawModeWidget key="wall-draw-mode-widget" />;
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
    if (button.widgetId === 'hatch-list') {
      return <RibbonHatchListWidget key="hatch-list-widget" />;
    }
    // ADR-662 Φάση 1b — «Τοπογραφικό» live toggles + numeric fields.
    if (button.widgetId === 'topo-grid-visible') {
      return <TopoGridVisibleToggle key="topo-grid-visible-widget" />;
    }
    if (button.widgetId === 'topo-north-visible') {
      return <NorthArrowVisibleToggle key="topo-north-visible-widget" />;
    }
    if (button.widgetId === 'topo-cloud-visible') {
      return <PointCloud3DVisibleToggle key="topo-cloud-visible-widget" />;
    }
    if (button.widgetId === 'topo-contour-style') {
      return <ContourStyleToggle key="topo-contour-style-widget" />;
    }
    if (button.widgetId === 'topo-north-mode') {
      return <NorthModeToggle key="topo-north-mode-widget" />;
    }
    if (button.widgetId === 'topo-cutfill-mode') {
      return <CutFillModeToggle key="topo-cutfill-mode-widget" />;
    }
    if (button.widgetId === 'topo-contour-interval') {
      return <ContourIntervalField key="topo-contour-interval-widget" />;
    }
    if (button.widgetId === 'topo-contour-index') {
      return <ContourIndexField key="topo-contour-index-widget" />;
    }
    if (button.widgetId === 'topo-grid-step') {
      return <GridStepField key="topo-grid-step-widget" />;
    }
    return null;
  }
  // ADR-345 split + ADR-521 pure dropdown («Τύποι») share ONE component — the
  // dropdown is just a split button whose trigger opens the list (no top-action).
  if (button.type === 'split' || button.type === 'dropdown') {
    return <RibbonSplitButton key={key} button={button} />;
  }
  if (button.type === 'toggle') {
    return <RibbonToggleButton key={key} command={button.command} size={button.size} />;
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
  // ADR-547 Stage 4 — per-key visibility leaf subscription (moved out of RibbonBody
  // so a BIM edit re-renders only the affected panel, not the whole body). Panels
  // without a `visibilityKey` resolve to the default `true` slice (never changes).
  const isVisible = useRibbonPanelVisibility(panel.visibilityKey ?? '');
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

  // ADR-547 Stage 4 — self-hide when the owning bridge marks this panel hidden.
  // Placed after all hooks so hook order stays stable.
  if (!isVisible) return null;

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
