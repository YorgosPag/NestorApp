/**
 * ADR-651 Φάση Β — πινακίδα ως **τοποθετήσιμο block** (`InSessionBlockDef`).
 *
 * Η αλυσίδα, όλη από υπάρχοντα SSoT (κανένα παράλληλο σύστημα):
 *
 *   TextTemplate (ADR-344) ──resolveTemplate(scope)──► DxfTextNode (λυμένο)
 *        └─readTitleBlockContent─► heading + FieldRow[]
 *              └─buildTitleBlockLayout─► DetailPrimitive[] (sheet-mm, ADR-622)
 *                    └─detailPrimitivesToEntities─► Entity[] (block-local, y-up)
 *                          └─InSessionBlockDef ─► buildBlockEntityFromDef (ADR-652)
 *                                └─addBlockToScene ─► undoable create + persist
 *
 * Γιατί block και όχι σκόρπια entities: η πινακίδα πρέπει να επιλέγεται/μετακινείται/
 * αναιρείται **ως ΕΝΑ αντικείμενο** — αυτό ακριβώς κάνουν οι μεγάλοι (AutoCAD BLOCK/INSERT,
 * Revit title-block family instance). Το `BlockEntity` υπάρχει ήδη, ζωγραφίζεται ήδη
 * (ADR-640) και εξάγεται ήδη ως πραγματικό DXF BLOCK/INSERT (ADR-636/644/648).
 */

import { buildSheetBlockDef } from '../../bim/block-library/sheet-block-def';
import type { InSessionBlockDef } from '../../bim/block-library/block-library-types';
import { isBlockEntity, type Entity } from '../../types/entities';
import type { PlaceholderScope } from '../templates/resolver/scope.types';
import type { TextTemplate } from '../templates/template.types';
import { buildTitleBlockLayout, type TitleBlockLayoutOptions } from './title-block-layout';
import { resolveTitleBlockContent } from './title-block-rows';

/** Όνομα του DXF block ορισμού (ASCII — γίνεται `BLOCK` record στο export). */
export const TITLE_BLOCK_BLOCK_NAME = 'TITLE_BLOCK';

/**
 * Έχει ήδη πινακίδα το σχέδιο; (Απόφαση #10β — η εκτύπωση προτείνει πινακίδα όταν λείπει.)
 * Το όνομα του block είναι η ταυτότητά της — ίδιο κριτήριο με το DXF export.
 */
export function hasTitleBlockEntity(entities: readonly Entity[]): boolean {
  return entities.some((entity) => isBlockEntity(entity) && entity.name === TITLE_BLOCK_BLOCK_NAME);
}

export interface TitleBlockDefOptions {
  /** paper-mm → model units (annotation scale· 1:50 ⇒ 50). */
  readonly scaleFactor: number;
  /** Layer των members· `'0'` = block-local default (σύμβαση DXF, όπως το block library). */
  readonly layerId?: string;
  /** ADR-651 Φάση Γ — φύλλο/κορνίζα/σφραγίδα: ό,τι κάνει τη διάταξη παραμετρική. */
  readonly layout: TitleBlockLayoutOptions;
}

/**
 * Λύνει το πρότυπο με το δοσμένο scope και επιστρέφει τον έτοιμο **block-local** ορισμό
 * της πινακίδας. Καθαρή συνάρτηση: καμία εγγραφή στη σκηνή, κανένα I/O — άρα ασφαλής και
 * για το ghost (τρέχει ανά κίνηση δρομέα) και για το commit (ίδια γεωμετρία, εξ ορισμού).
 */
export function buildTitleBlockDef(
  template: TextTemplate,
  scope: PlaceholderScope,
  options: TitleBlockDefOptions,
): InSessionBlockDef {
  const layout = buildTitleBlockLayout(resolveTitleBlockContent(template, scope), options.layout);

  return buildSheetBlockDef(layout.primitives, {
    name: TITLE_BLOCK_BLOCK_NAME,
    widthMm: layout.sizeMm.widthMm,
    heightMm: layout.sizeMm.heightMm,
    scaleFactor: options.scaleFactor,
    layerId: options.layerId,
  });
}
