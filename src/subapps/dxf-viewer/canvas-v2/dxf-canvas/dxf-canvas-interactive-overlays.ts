/**
 * DXF CANVAS — INTERACTIVE OVERLAYS (hover + selection) ΠΑΝΩ ΑΠΟ ΤΟ BLIT
 *
 * ⚠️ ARCHITECTURE-CRITICAL — ΔΙΑΒΑΣΕ ADR-040 ΠΡΙΝ ΤΗΝ ΕΠΕΞΕΡΓΑΣΙΑ.
 *
 * ## Τι είναι
 *
 * Ό,τι ζωγραφίζεται **έξω** από το cached normal-state bitmap: η hovered οντότητα, οι
 * επιλεγμένες, οι λαβές τους. Εξήχθη από το `renderScene` (ADR-743 Φ0, Boy-Scout N.7.1: η
 * `renderScene` ήταν ~260 γραμμές — 6,5× το όριο των 40).
 *
 * ## 🔴 ΓΙΑΤΙ ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΟ BITMAP CACHE — ADR-040 cardinal rule #3
 *
 * Αν το `hoveredEntityId` / `selectedEntityIds` / `gripInteractionState` έμπαινε στο κλειδί του
 * bitmap cache, ένα απλό hover θα ακύρωνε το cache στα **~60Hz** και θα προκαλούσε πλήρη
 * ανακατασκευή N οντοτήτων ανά καρέ — το πάγωμα του Phase D v1 (FPS 1). Αντ' αυτού το cache
 * κρατά **μόνο** normal-state, και η αλληλεπίδραση ζωγραφίζεται εδώ, ως overlay λίγων
 * οντοτήτων πάνω από το blit. **Μηδέν κόστος bitmap.**
 *
 * Το ότι το αρχείο είναι ξεχωριστό δεν χαλαρώνει τον κανόνα — τον κάνει **ορατό**: αυτό εδώ
 * είναι, εξ ορισμού, ο τόπος όπου ζει η διαδραστική κατάσταση.
 *
 * ## ADR-575 §selection/hover semantics — γιατί υπάρχει το `membersByGroupId`
 *
 * Τα μέλη ενός GROUP μοιράζονται όλα το `group.id`, οπότε ένα `Map<id, entity>` κρατά **ένα
 * αυθαίρετο** μέλος. Το hover/selection ενός group πρέπει να βάψει **ΟΛΑ** τα μέλη (αλλιώς
 * «λάμπει ένα αδέσποτο μέλος» — το προ-ADR-575 σφάλμα), γι' αυτό ο 1→N χάρτης.
 *
 * @module canvas-v2/dxf-canvas/dxf-canvas-interactive-overlays
 * @see ADR-040 — cardinal rule #3 (τι ΔΕΝ μπαίνει ποτέ στο cache key)
 * @see ADR-575 — group hover/selection semantics
 * @see ADR-637 §hover-grips — λαβές και σε hover, όχι μόνο σε selection
 */

import type { DxfRenderer } from './DxfRenderer';
import type { DxfEntityUnion, DxfRenderOptions } from './dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import { isBimRegionOrPerimeterTool } from '../../systems/tools/region-tool-ids';

/** Ό,τι χρειάζεται ένα overlay pass — διαβασμένο από refs τη στιγμή του καρέ, ποτέ snapshot. */
export interface InteractiveOverlayParams {
  readonly renderer: DxfRenderer;
  readonly entityMap: ReadonlyMap<string, DxfEntityUnion>;
  readonly membersByGroupId: ReadonlyMap<string, DxfEntityUnion[]>;
  readonly renderOptions: DxfRenderOptions;
  readonly layersById: DxfRenderOptions['layersById'];
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  readonly activeTool: string | undefined;
}

/**
 * AutoCAD parity: οι λαβές φαίνονται **μόνο** σε κατάσταση επιλογής (καμία ενεργή εντολή).
 * Με ενεργό εργαλείο (π.χ. Move) εξαφανίζονται — το εργαλείο έχει δικό του UX.
 * ADR-363 Phase 1J / ADR-419 — το `wall-on-entity` και τα region/perimeter εργαλεία δείχνουν
 * λαβές στις επιλογές τους, άρα εξαιρούνται ρητά.
 */
function areGripsAllowed(activeTool: string | undefined): boolean {
  return (
    !activeTool ||
    activeTool === 'select' ||
    activeTool === 'layering' ||
    activeTool === 'wall-on-entity' ||
    isBimRegionOrPerimeterTool(activeTool)
  );
}

/** Το hover pass: μία οντότητα, ή ΟΛΑ τα μέλη ενός group (ADR-575). */
function paintHoverOverlay(p: InteractiveOverlayParams, selectedIds: ReadonlySet<string>): void {
  const hoveredId = p.renderOptions.hoveredEntityId;
  if (!hoveredId) return;

  const base = {
    gripInteractionState: p.renderOptions.gripInteractionState,
    layersById: p.layersById,
  };

  const hoveredMembers = p.membersByGroupId.get(hoveredId);
  if (hoveredMembers) {
    // Whole-group hover: κυανή λάμψη μόνο — το group έχει δικό του gizmo (όπως στον κλάδο
    // selection), οπότε suppressGrips στα μέλη.
    for (const ent of hoveredMembers) {
      p.renderer.renderSingleEntity(ent, p.transform, p.viewport, 'hovered', { ...base, suppressGrips: true });
    }
    return;
  }

  const ent = p.entityMap.get(hoveredId);
  if (!ent) return;
  // ADR-637 §hover-grips — καμία διπλή λαβή όταν η hovered είναι ήδη επιλεγμένη (τις δίνει
  // το selection pass), και καμία λαβή όσο τρέχει εντολή.
  p.renderer.renderSingleEntity(ent, p.transform, p.viewport, 'hovered', {
    ...base,
    suppressGrips: !areGripsAllowed(p.activeTool) || selectedIds.has(hoveredId),
  });
}

/**
 * ADR-049 SSOT — η συρόμενη οντότητα μένει ζωγραφισμένη στην ΑΡΧΙΚΗ της θέση εδώ (ως
 * 'selected'). Το ημιδιαφανές φάντασμα στη δέλτα της μετακίνησης ζωγραφίζεται στον
 * αποκλειστικό `PreviewCanvas` — κανένας κλάδος drag-preview δεν ζει σε αυτόν τον renderer.
 *
 * ADR-561 EXT — ένα rotate-COPY κρατά την πηγή ως μόνιμο πρωτότυπο, άρα μένει ΣΥΜΠΑΓΗΣ (δεν
 * θαμπώνει)· μόνο ο περιστρεφόμενος κλώνος δείχνει τη μετακίνηση.
 */
function isMovePreviewDimmed(id: string, o: DxfRenderOptions): boolean {
  return !!o.movePreviewActive || (id === o.gripDraggedEntityId && !o.gripDragIsCopy);
}

/** Το selection pass: κάθε επιλεγμένο id, ή ΟΛΑ τα μέλη του αν είναι group (ADR-575). */
function paintSelectionOverlay(p: InteractiveOverlayParams): void {
  const o = p.renderOptions;
  const gripsAllowed = areGripsAllowed(p.activeTool);

  for (const selId of o.selectedEntityIds) {
    const base = {
      gripInteractionState: o.gripInteractionState,
      layersById: p.layersById,
      armedTransformHighlight: o.armedTransformHighlight,
      movePreviewActive: isMovePreviewDimmed(selId, o),
    };
    // ADR-575 — ένα επιλεγμένο GROUP αποδίδεται ως ΕΝΑ σώμα: όλα τα μέλη 'selected' με τις
    // λαβές ΚΑΤΑΣΤΑΛΜΕΝΕΣ (το gizmo ολόκληρου του group — σταυρός μετακίνησης + λαβή
    // περιστροφής — κατέχει τους χειρισμούς, εκπέμπεται χωριστά από το μητρώο λαβών).
    const selMembers = p.membersByGroupId.get(selId);
    if (selMembers) {
      for (const ent of selMembers) {
        p.renderer.renderSingleEntity(ent, p.transform, p.viewport, 'selected', { ...base, suppressGrips: true });
      }
      continue;
    }
    const ent = p.entityMap.get(selId);
    if (ent) {
      p.renderer.renderSingleEntity(ent, p.transform, p.viewport, 'selected', { ...base, suppressGrips: !gripsAllowed });
    }
  }
}

/**
 * Ζωγραφίζει τα διαδραστικά overlays πάνω από το blit — hover πρώτα, selection μετά.
 *
 * Η σειρά μετράει: μια οντότητα και hovered και επιλεγμένη πρέπει να καταλήγει με την
 * εμφάνιση της επιλογής (και τις λαβές της), γι' αυτό το selection ζωγραφίζει τελευταίο.
 */
export function paintInteractiveOverlays(params: InteractiveOverlayParams): void {
  const selectedIds = new Set(params.renderOptions.selectedEntityIds);
  paintHoverOverlay(params, selectedIds);
  paintSelectionOverlay(params);
}
