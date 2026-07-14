'use client';

/**
 * ADR-363 Phase 1D — Discriminating router for the sidebar "Properties" tab.
 *
 * The sidebar third tab is BIM-entity-aware: depending on the type of the
 * primary selected entity, it mounts the matching advanced panel. Currently
 * supports stair (ADR-358), wall (ADR-363) and column (ADR-363 Phase 4 —
 * ribbon ↔ Properties-palette split); future BIM elements (beam Phase 5) plug
 * in here.
 *
 * Pure derivation — entity classification reads the scene model already held
 * by the orchestrator; no extra subscriptions (ADR-040 micro-leaf rule).
 *
 * When no BIM entity is selected, falls back to the stair tab so legacy
 * stair workflows continue working (stair empty-state renders if no stair).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isWallEntity, isStairEntity, isColumnEntity, isBeamEntity, isFoundationEntity, isSlabEntity, isSlabOpeningEntity, isHatchEntity, isBlockEntity, isImageEntity } from '../../types/entities';
import { isWallDrawingTool } from '../../systems/tools/region-tool-ids';
import { useResolvedSelectedEntity } from '../../hooks/selection/useResolvedSelectedEntity';
import { StairPropertiesTab } from '../stair-advanced-panel/StairPropertiesTab';
import { WallPropertiesTab } from './WallPropertiesTab';
import { ColumnPropertiesTab } from '../column-advanced-panel/ColumnPropertiesTab';
import { BeamPropertiesTab } from '../beam-advanced-panel/BeamPropertiesTab';
import { FoundationPropertiesTab } from '../foundation-advanced-panel/FoundationPropertiesTab';
import { SlabPropertiesTab } from '../slab-advanced-panel/SlabPropertiesTab';
import { SlabOpeningPropertiesTab } from '../slab-opening-advanced-panel/SlabOpeningPropertiesTab';
// ADR-510 Φ2E #4/#6 — inline «Τμήματα Μοτίβου» + full properties for a selected
// style-editable primitive, plus draft-mode (line/primitive tool active, no selection).
import { isStyleEditablePrimitiveType } from '../../types/style-editable-primitives';
import { isLinePrimitiveDrawingTool } from '../../app/resolve-tool-active-trigger';
import { LinePropertiesTab } from '../line-advanced-panel/LinePropertiesTab';
// ADR-507 — hatch Properties palette (ribbon ↔ panel split, Revit-style + draft mode).
import { HatchPropertiesTab } from '../hatch-advanced-panel/HatchPropertiesTab';
// ADR-641 (single-click selection surface) — selected block → object inspector.
import { BlockPropertiesTab } from '../block-advanced-panel/BlockPropertiesTab';
// ADR-654 — selected entourage image (έπιπλο/άνθρωπος/όχημα/φυτό) → object inspector.
import { ImagePropertiesTab } from '../image-advanced-panel/ImagePropertiesTab';
import type { SceneModel } from '../../types/scene';

export interface BimPropertiesRouterProps {
  readonly primarySelectedId: string | null;
  readonly currentScene: SceneModel | null;
  readonly projectId?: string;
  readonly floorplanId?: string;
  /**
   * ADR-363 — ενεργό εργαλείο σχεδίασης. Όταν είναι εργαλείο τοίχου ΧΩΡΙΣ επιλογή,
   * το panel ανοίγει σε draft mode (draw-defaults) — «set the type, then draw».
   */
  readonly activeTool?: string;
}

export function BimPropertiesRouter(
  props: BimPropertiesRouterProps,
): React.ReactElement {
  const { primarySelectedId, currentScene, activeTool } = props;
  const { t } = useTranslation('dxf-viewer-shell');

  // ADR-484 — κοινός SSoT resolver (active scene + cross-level foundation fallback)
  // ώστε ένα cross-level πέδιλο να εμφανίζει το per-type panel του.
  const selected = useResolvedSelectedEntity(primarySelectedId, currentScene);

  if (selected && isWallEntity(selected)) {
    return <WallPropertiesTab {...props} />;
  }

  // ADR-363 — κανένα selection αλλά ενεργό εργαλείο τοίχου → draft property panel
  // (πλήρης σύνθεση στρώσεων ως draw-default). Πριν τα υπόλοιπα selected branches:
  // ισχύει μόνο όταν `!selected`, άρα δεν συγκρούεται με per-type selection panels.
  if (!selected && isWallDrawingTool(activeTool)) {
    return <WallPropertiesTab {...props} draftMode />;
  }

  // ADR-507 — εργαλείο «Γραμμοσκίαση» ενεργό χωρίς επιλογή → draft panel (ρύθμιση
  // draw-defaults για την επόμενη· Revit-style «διάλεξε ιδιότητες → σχεδίασε»).
  if (!selected && activeTool === 'hatch') {
    return <HatchPropertiesTab {...props} draftMode />;
  }

  // ADR-510 Φ2E #6 — εργαλείο γραμμής/primitive (line/circle/rectangle/polyline/arc…)
  // ενεργό χωρίς επιλογή → draft «Ιδιότητες Γραμμής» (draw-defaults για την επόμενη·
  // «όρισε ιδιότητες → σχεδίασε»). Ίδιο pattern με τοίχο/γραμμοσκίαση· ΟΧΙ κενό panel.
  if (!selected && isLinePrimitiveDrawingTool(activeTool)) {
    return <LinePropertiesTab {...props} draftMode />;
  }

  // ADR-363 Phase 4 — column Properties palette (ribbon ↔ panel split).
  if (selected && isColumnEntity(selected)) {
    return <ColumnPropertiesTab {...props} />;
  }

  // ADR-471 — beam Properties palette (δομοστατικά/οπλισμός δοκού).
  if (selected && isBeamEntity(selected)) {
    return <BeamPropertiesTab {...props} />;
  }

  // ADR-463 — foundation Properties palette (πέδιλο/πεδιλοδοκός/συνδετήρια οπλισμός).
  if (selected && isFoundationEntity(selected)) {
    return <FoundationPropertiesTab {...props} />;
  }

  // ADR-476 — slab Properties palette (δομοστατικά/οπλισμός σχάρας πλάκας).
  if (selected && isSlabEntity(selected)) {
    return <SlabPropertiesTab {...props} />;
  }

  // ADR-632 Φ5 — slab-opening Properties palette (info + validation warnings +
  // managed/lock status). Surfacing του soft warning ως κείμενο, όχι μόνο badge.
  if (selected && isSlabOpeningEntity(selected)) {
    return <SlabOpeningPropertiesTab {...props} />;
  }

  // ADR-507 — επιλεγμένη γραμμοσκίαση → πλήρες Properties palette
  // (Γενικά / Μοτίβο / Διαβάθμιση / Πληροφορίες). Πριν το generic primitive fallback.
  if (selected && isHatchEntity(selected)) {
    return <HatchPropertiesTab {...props} />;
  }

  if (selected && isStairEntity(selected)) {
    return <StairPropertiesTab {...props} />;
  }

  // ADR-510 Φ2E #4 — a selected generic primitive (line/polyline/circle/arc/…)
  // gets the inline «Τμήματα Μοτίβου» pattern editor. After all BIM branches so a
  // BIM element's own panel always wins; before the empty state so it's not lost.
  if (selected && isStyleEditablePrimitiveType(selected.type)) {
    return <LinePropertiesTab {...props} />;
  }

  // ADR-641 — a selected block (INSERT) gets its object inspector (ταυτότητα +
  // εμφάνιση + INSERT transform). After all BIM branches, before the empty state.
  if (selected && isBlockEntity(selected)) {
    return <BlockPropertiesTab {...props} />;
  }

  // ADR-654 — a selected entourage image (έπιπλο/άνθρωπος/όχημα/φυτό) gets its object
  // inspector (πηγή/επίπεδο + γεωμετρία). Non-BIM standalone raster, mirror του block.
  if (selected && isImageEntity(selected)) {
    return <ImagePropertiesTab {...props} />;
  }

  // No BIM selection — render the stair tab's empty state (legacy path).
  if (!selected) {
    return <StairPropertiesTab {...props} />;
  }

  return (
    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
      {t('wallAdvancedPanel.emptyState')}
    </p>
  );
}
