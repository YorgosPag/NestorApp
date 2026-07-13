/**
 * ADR-641 (single-click selection surface) — contextual ribbon tab «Μπλοκ», ορατό
 * όταν επιλέγεται ένα block (INSERT) entity.
 *
 * Big-player split (Revit «Modify | Block Reference» / ArchiCAD / C4D / Figma· Giorgio
 * 2026-07-13): το contextual tab κρατά ΜΟΝΟ ενέργειες — Επιλογή + Επεξεργασία Μπλοκ
 * (BEDIT) + Διάλυση (Explode). ΟΛΕΣ οι ιδιότητες (Επίπεδο/Χρώμα/Διαφάνεια + γεωμετρία)
 * ζουν στο αριστερό Properties palette (`BlockPropertiesTab`), όπως στα μεγάλα CAD.
 *
 * Zero-wiring για δύο από τα τρία κουμπιά: το «Επιλογή» reuse-άρει το SSoT
 * `buildSelectPanel` (commandKey 'select', ήδη δρομολογημένο)· το «Διάλυση» reuse-άρει
 * το γενικό `action:'explode'` (ίδιο με Home → Τροποποίηση, `useExplodeRibbonAction`).
 * Μόνο το «Επεξεργασία Μπλοκ» έχει νέο route (`action:'block-edit'` →
 * `useBlockEditRibbonAction` → enterBlockEdit, το ΙΔΙΟ SSoT με το double-click).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-641-block-editor-bedit.md
 * @see ../hooks/useBlockEditRibbonAction.ts (block-edit action interceptor)
 */

import type { RibbonTab } from '../types/ribbon-types';
// SSoT leading «Επιλογή» panel (Revit «Modify | …» opens with Select).
import { buildSelectPanel } from './contextual-select-panel';
// SSoT LARGE button factories (Revit «Modify» flat buttons).
import { actionBtn } from './ribbon-large-button-helpers';

export const BLOCK_CONTEXTUAL_TRIGGER = 'block-selected';

export const CONTEXTUAL_BLOCK_TAB: RibbonTab = {
  id: 'block-tools',
  labelKey: 'ribbon.tabs.blockTools',
  isContextual: true,
  contextualTrigger: BLOCK_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Επιλογή (Revit «Modify | …» leftmost panel) ───────────────────────────
    buildSelectPanel('block'),
    // ── Μπλοκ (actions — Revit «Modify | Block Reference») ─────────────────────
    {
      id: 'block-actions',
      labelKey: 'ribbon.panels.blockActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            // Επεξεργασία Μπλοκ (BEDIT) — enters the exclusive Block Editor (≡ double-click).
            actionBtn('blockTools.edit', 'ribbon.commands.blockEdit', 'grip-edit', 'block-edit', 'block-edit'),
            // Διάλυση (Explode) — reuse του γενικού Modify command (μηδέν νέο wiring).
            actionBtn('blockTools.explode', 'ribbon.commands.explode', 'explode', 'explode', 'explode'),
          ],
        },
      ],
    },
  ],
};
