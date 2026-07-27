'use client';

/**
 * Το ΕΝΑ σπίτι του «ποιο inline widget σηκώνει αυτό το `widgetId`;».
 *
 * Βγήκε από το `RibbonPanel.tsx` όταν εκείνο πέρασε τις 500 γραμμές (N.7.1): η αλυσίδα των
 * ~85 `if (widgetId === '…')` ήταν το 60% του αρχείου και μεγάλωνε με **κάθε** νέο widget,
 * ενώ το `RibbonPanel` υποτίθεται ότι έχει μία ευθύνη — να ζωγραφίζει ένα panel.
 *
 * Χάρτης αντί για αλυσίδα, για δύο λόγους πέρα από το μέγεθος:
 *   1. **O(1) αντί O(n).** Το `renderButton` τρέχει για κάθε κουμπί κάθε ορατού panel σε κάθε
 *      re-render του ribbon· τα topo widgets κάθονταν στο τέλος της αλυσίδας, δηλαδή πλήρωναν
 *      ~80 συγκρίσεις συμβολοσειρών το καθένα.
 *   2. **Το διπλό κλειδί γίνεται αδύνατο.** Σε if-chain, δεύτερο `if` για υπάρχον id είναι
 *      σιωπηλά νεκρός κώδικας — κερδίζει το πρώτο και κανείς δεν το μαθαίνει ποτέ. Σε object
 *      literal το ίδιο λάθος είναι διπλό κλειδί, που ο linter δείχνει με το δάχτυλο.
 *
 * Οι ομάδες είναι θεματικές και **μόνο** για ανάγνωση — τα ids ζουν σε έναν ενιαίο χώρο
 * ονομάτων, οπότε το ίδιο id δεν επιτρέπεται σε δύο ομάδες.
 *
 * @see ./RibbonPanel.tsx — ο μοναδικός καταναλωτής
 * @see ../data/*-tab.ts — εκεί δηλώνονται τα `widgetId` που φτάνουν εδώ
 */

import React from 'react';
import { ZoomControlsWidget } from './ZoomControlsWidget';
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
import { OpeningTagLayerToggle } from './OpeningTagLayerToggle';
import { MepWireToggle } from './MepWireToggle';
import { DrainPipeToggle } from './DrainPipeToggle';
import { ColorBySystemToggle } from './ColorBySystemToggle';
import { ShowHeatLoadToggle } from './ShowHeatLoadToggle';
import { ShowFinishSkinToggle } from './ShowFinishSkinToggle';
import { MarqueeSelectThroughToggle } from './MarqueeSelectThroughToggle';
import { ShowReinforcementToggle } from './ShowReinforcementToggle';
import { ShowPipeSizingToggle } from './ShowPipeSizingToggle';
import { ShowAnalysisDiagramsToggle } from './ShowAnalysisDiagramsToggle';
import { DiagramComponentSelect } from './DiagramComponentSelect';
import { ShowUtilizationToggle } from './ShowUtilizationToggle';
import { ShowBalancingToggle } from './ShowBalancingToggle';
import { ExportThermalStudyButton } from './ExportThermalStudyButton';
import { VisualStyleSelect } from './VisualStyleSelect';
import { GlassQualitySelect } from './GlassQualitySelect';
// ADR-689 Φ3 — «Ακμές Πλέγματος» + «Πάχος Ακμών» (mesh wireframe άξονες).
import { MeshWireModeSelect, MeshWireWidthField } from './MeshWireWidgets';
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
import { RibbonOpeningHardwareWidget } from './RibbonOpeningHardwareWidget';
import { OpeningFrameProfileLibraryWidget } from './opening-frame-profile-library-widget';
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
  PointCloud3DManageButton,
  ContourStyleToggle,
  NorthModeToggle,
  CutFillModeToggle,
  TopoCropToBoundaryToggle,
  TopoCropShowOutsideToggle,
  TerrainVisibleToggle,
  TerrainStyleToggle,
  TerrainAutoClipToggle,
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

/** Ένα widget όπως το ζητά το ribbon: χωρίς props, με σταθερό `key`. */
type WidgetFactory = () => React.ReactNode;

/** Καμβάς, κλίμακες, πίνακες ρυθμίσεων — ό,τι δεν ανήκει σε συγκεκριμένη ειδικότητα. */
const CORE_WIDGETS: Readonly<Record<string, WidgetFactory>> = {
  'zoom-controls': () => <ZoomControlsWidget key="zoom-controls-widget" />,
  'justification-grid': () => <RibbonJustificationGridWidget key="justification-grid-widget" />,
  'font-family': () => <RibbonFontFamilyWidget key="font-family-widget" />,
  'line-spacing': () => <RibbonLineSpacingWidget key="line-spacing-widget" />,
  'annotation-scale': () => <RibbonAnnotationScaleWidget key="annotation-scale-widget" />,
  'drawing-scale': () => <DrawingScaleWidget key="drawing-scale-widget" />,
  'view-range': () => <ViewRangePanel key="view-range-widget" />,
  'object-styles': () => <ObjectStylesPanel key="object-styles-widget" />,
  'subcategories': () => <SubcategoriesPanel key="subcategories-widget" />,
  'pen-table': () => <PenTablePanel key="pen-table-widget" />,
  'view-templates': () => <ViewTemplatesPanel key="view-templates-widget" />,
  'visibility-graphics': () => <VisibilityGraphicsPanel key="visibility-graphics-widget" />,
  'current-layer-picker': () => <CurrentLayerPicker key="current-layer-picker-widget" variant="ribbon" />,
  'insert-tokens': () => <RibbonInsertTokenWidget key="insert-tokens-widget" />,
  'visual-style-select': () => <VisualStyleSelect key="visual-style-select-widget" />,
  'glass-quality-select': () => <GlassQualitySelect key="glass-quality-select-widget" />,
  'mesh-wire-mode-select': () => <MeshWireModeSelect key="mesh-wire-mode-select-widget" />,
  'mesh-wire-width-field': () => <MeshWireWidthField key="mesh-wire-width-field-widget" />,
  'discipline-visibility': () => <DisciplineVisibilityToggle key="discipline-visibility-widget" />,
  'structural-component-visibility': () => (
    <StructuralComponentVisibilitySelect key="structural-component-visibility-widget" />
  ),
  'marquee-select-through-toggle': () => (
    <MarqueeSelectThroughToggle key="marquee-select-through-toggle-widget" />
  ),
  'hide-bim': () => <HideBimToggle key="hide-bim-widget" />,
  'plan-lines': () => <PlanLinesToggle key="plan-lines-widget" />,
  'show-finish-skin-toggle': () => <ShowFinishSkinToggle key="show-finish-skin-toggle-widget" />,
  'show-reinforcement-toggle': () => <ShowReinforcementToggle key="show-reinforcement-toggle-widget" />,
};

/** Διαστάσεις, γραμμές, διαγραμμίσεις, ετικέτες ανοιγμάτων — ο σχολιασμός του σχεδίου. */
const ANNOTATION_WIDGETS: Readonly<Record<string, WidgetFactory>> = {
  'opening-tag-visibility': () => <OpeningTagLayerToggle key="opening-tag-visibility-widget" />,
  'opening-tag-pill-color': () => <OpeningTagPillColorWidget key="opening-tag-pill-color-widget" />,
  'opening-tag-leader-color': () => <OpeningTagLeaderColorWidget key="opening-tag-leader-color-widget" />,
  'dim-row-handles-toggle': () => <DimRowHandlesToggle key="dim-row-handles-toggle-widget" />,
  'dim-new-line-pattern': () => <DimNewLinePatternWidget key="dim-new-line-pattern-widget" />,
  // ADR-510 Φ2E #3 — «＋ Νέος τύπος» στο LINE tab (creates + assigns to the line).
  'line-new-line-pattern': () => <LineNewLinePatternWidget key="line-new-line-pattern-widget" />,
  // ADR-642 — «✎ Επεξεργασία / ⧉ Διπλότυπο» for the current linetype (edit-in-place / duplicate).
  'line-edit-line-pattern': () => <LineEditLinePatternWidget key="line-edit-line-pattern-widget" />,
  'hatch-list': () => <RibbonHatchListWidget key="hatch-list-widget" />,
};

/** Τοίχοι, πλάκες, στέγες, ανοίγματα, σκάλες + η πολλαπλή επιλογή. */
const BIM_WIDGETS: Readonly<Record<string, WidgetFactory>> = {
  'stair-floor-info': () => <RibbonStairFloorInfoWidget key="stair-floor-info-widget" />,
  'stair-dimensions': () => <RibbonStairDimensionsWidget key="stair-dimensions-widget" />,
  'wall-length': () => <RibbonWallDimensionWidget key="wall-length-widget" dimension="length" />,
  'wall-height': () => <RibbonWallDimensionWidget key="wall-height-widget" dimension="height" />,
  'wall-thickness': () => <RibbonWallDimensionWidget key="wall-thickness-widget" dimension="thickness" />,
  'wall-family-type': () => <RibbonWallFamilyTypeWidget key="wall-family-type-widget" />,
  'wall-type-properties': () => <RibbonWallTypePropertiesWidget key="wall-type-properties-widget" />,
  'wall-joins': () => <RibbonWallJoinWidget key="wall-joins-widget" />,
  'wall-draw-mode': () => <RibbonWallDrawModeWidget key="wall-draw-mode-widget" />,
  'slab-family-type': () => <RibbonSlabFamilyTypeWidget key="slab-family-type-widget" />,
  'roof-family-type': () => <RibbonRoofFamilyTypeWidget key="roof-family-type-widget" />,
  'roof-type-properties': () => <RibbonRoofTypePropertiesWidget key="roof-type-properties-widget" />,
  'opening-family-type': () => <RibbonOpeningFamilyTypeWidget key="opening-family-type-widget" />,
  'opening-type-properties': () => <RibbonOpeningTypePropertiesWidget key="opening-type-properties-widget" />,
  'opening-hardware': () => <RibbonOpeningHardwareWidget key="opening-hardware-widget" />,
  'opening-frame-profile-library': () => (
    <OpeningFrameProfileLibraryWidget key="opening-frame-profile-library-widget" />
  ),
  'multi-selection-common-properties': () => (
    <MultiSelectionCommonPropertiesPanel key="multi-selection-common-widget" />
  ),
  'multi-selection-filter': () => <MultiSelectionFilterPanel key="multi-selection-filter-widget" />,
};

/** Ηλεκτρολογικά κυκλώματα, σωληνώσεις, θερμικά — τα δίκτυα και η ανάλυσή τους. */
const MEP_WIDGETS: Readonly<Record<string, WidgetFactory>> = {
  'mep-wire-toggle': () => <MepWireToggle key="mep-wire-toggle-widget" />,
  'drain-pipe-toggle': () => <DrainPipeToggle key="drain-pipe-toggle-widget" />,
  'color-by-system-toggle': () => <ColorBySystemToggle key="color-by-system-toggle-widget" />,
  'show-heat-load-toggle': () => <ShowHeatLoadToggle key="show-heat-load-toggle-widget" />,
  'show-pipe-sizing-toggle': () => <ShowPipeSizingToggle key="show-pipe-sizing-toggle-widget" />,
  'show-balancing-toggle': () => <ShowBalancingToggle key="show-balancing-toggle-widget" />,
  'show-analysis-diagrams-toggle': () => (
    <ShowAnalysisDiagramsToggle key="show-analysis-diagrams-toggle-widget" />
  ),
  'diagram-component-select': () => <DiagramComponentSelect key="diagram-component-select-widget" />,
  'show-utilization-toggle': () => <ShowUtilizationToggle key="show-utilization-toggle-widget" />,
  'export-thermal-study': () => <ExportThermalStudyButton key="export-thermal-study-widget" />,
  'mep-fixture-circuit-info': () => <RibbonMepFixtureCircuitWidget key="mep-fixture-circuit-info-widget" />,
  'mep-circuit-picker': () => <RibbonMepCircuitPickerWidget key="mep-circuit-picker-widget" />,
  'mep-circuit-name': () => <RibbonMepCircuitNameWidget key="mep-circuit-name-widget" />,
  'mep-circuit-color': () => <RibbonMepCircuitColorWidget key="mep-circuit-color-widget" />,
  'mep-circuit-wire-style': () => <RibbonMepCircuitWireStyleWidget key="mep-circuit-wire-style-widget" />,
  'mep-circuit-conductors': () => <RibbonMepCircuitConductorsWidget key="mep-circuit-conductors-widget" />,
  'mep-network-classification': () => (
    <RibbonMepNetworkClassificationWidget key="mep-network-classification-widget" />
  ),
};

/** ADR-662 «Τοπογραφικό» + ADR-718 η κοπή στο όριο — έδαφος, ισοϋψείς, νέφος, όγκοι. */
const TOPO_WIDGETS: Readonly<Record<string, WidgetFactory>> = {
  'topo-grid-visible': () => <TopoGridVisibleToggle key="topo-grid-visible-widget" />,
  'topo-north-visible': () => <NorthArrowVisibleToggle key="topo-north-visible-widget" />,
  'topo-cloud-visible': () => <PointCloud3DVisibleToggle key="topo-cloud-visible-widget" />,
  'topo-cloud-manage': () => <PointCloud3DManageButton key="topo-cloud-manage-widget" />,
  'topo-contour-style': () => <ContourStyleToggle key="topo-contour-style-widget" />,
  'topo-north-mode': () => <NorthModeToggle key="topo-north-mode-widget" />,
  'topo-cutfill-mode': () => <CutFillModeToggle key="topo-cutfill-mode-widget" />,
  // ADR-718 — κοπή της επιφάνειας στο όριο του οικοπέδου + το αχνό γύρω έδαφος.
  'topo-crop-boundary': () => <TopoCropToBoundaryToggle key="topo-crop-boundary-widget" />,
  'topo-crop-outside': () => <TopoCropShowOutsideToggle key="topo-crop-outside-widget" />,
  // ADR-662 Φ4 — contextual «Τοπογραφική Επιφάνεια»: quick ανάγλυφο + χρωματισμός.
  'topo-terrain-visible': () => <TerrainVisibleToggle key="topo-terrain-visible-widget" />,
  'topo-terrain-autoclip': () => <TerrainAutoClipToggle key="topo-terrain-autoclip-widget" />,
  'topo-terrain-style': () => <TerrainStyleToggle key="topo-terrain-style-widget" />,
  'topo-contour-interval': () => <ContourIntervalField key="topo-contour-interval-widget" />,
  'topo-contour-index': () => <ContourIndexField key="topo-contour-index-widget" />,
  'topo-grid-step': () => <GridStepField key="topo-grid-step-widget" />,
};

/** Ο ενιαίος χώρος ονομάτων. Οι ομάδες παραπάνω είναι για τα μάτια· η αναζήτηση γίνεται εδώ. */
const WIDGET_REGISTRY: Readonly<Record<string, WidgetFactory>> = {
  ...CORE_WIDGETS,
  ...ANNOTATION_WIDGETS,
  ...BIM_WIDGETS,
  ...MEP_WIDGETS,
  ...TOPO_WIDGETS,
};

/**
 * Το widget για αυτό το `widgetId`, ή `null` όταν δεν υπάρχει.
 *
 * `null` σε άγνωστο id είναι σκόπιμο και ταιριάζει με την προηγούμενη if-chain: ένα κουμπί που
 * δηλώθηκε σε `*-tab.ts` με ορθογραφικό λάθος απλώς δεν εμφανίζεται, αντί να ρίξει όλο το ribbon.
 */
export function renderRibbonWidget(widgetId: string | undefined): React.ReactNode {
  if (!widgetId) return null;
  const factory = WIDGET_REGISTRY[widgetId];
  return factory ? factory() : null;
}
