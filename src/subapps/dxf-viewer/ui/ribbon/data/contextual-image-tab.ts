/**
 * ADR-654 — contextual ribbon tab «Εικόνα», ορατό όταν επιλέγεται ένα entourage
 * `ImageEntity` (έπιπλο/άνθρωπος/όχημα/φυτό — `type:'image'`).
 *
 * Big-player split (Revit «Modify | …» / ArchiCAD / C4D / Figma): το contextual tab
 * κρατά ΜΟΝΟ ενέργειες — Επιλογή + Μετακίνηση / Περιστροφή / Καθρέφτισμα / Αντιγραφή /
 * Διαγραφή. ΟΛΕΣ οι ιδιότητες (Πηγή/Επίπεδο + γεωμετρία) ζουν στο αριστερό Properties
 * palette (`ImagePropertiesTab`), όπως στα μεγάλα CAD.
 *
 * Zero-wiring: κάθε κουμπί reuse-άρει τα ήδη δρομολογημένα generic Modify commands
 * (`move`/`rotate`/`mirror`/`copy`/`delete`, βλ. `home-tab-modify.ts`)· η «Επιλογή»
 * reuse-άρει το SSoT `buildSelectPanel`. Κανένα νέο command route/label.
 *
 * @see ./contextual-block-tab.ts — το mirror template (ADR-641)
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

import type { RibbonTab } from '../types/ribbon-types';
// SSoT leading «Επιλογή» panel (Revit «Modify | …» opens with Select).
import { buildSelectPanel } from './contextual-select-panel';
// SSoT LARGE button factory (Revit «Modify» flat buttons· generic tool commands + actions).
import { toolBtn, actionBtn } from './ribbon-large-button-helpers';

export const IMAGE_CONTEXTUAL_TRIGGER = 'image-selected';

export const CONTEXTUAL_IMAGE_TAB: RibbonTab = {
  id: 'image-tools',
  labelKey: 'ribbon.tabs.imageTools',
  isContextual: true,
  contextualTrigger: IMAGE_CONTEXTUAL_TRIGGER,
  panels: [
    // ── Επιλογή (Revit «Modify | …» leftmost panel) ───────────────────────────
    buildSelectPanel('image'),
    // ── Εικόνα (actions — Revit «Modify | Image») — όλα generic Modify commands ─
    {
      id: 'image-actions',
      labelKey: 'ribbon.panels.imageActions',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('imageTools.move', 'ribbon.commands.move', 'move', 'move', 'M'),
            toolBtn('imageTools.rotate', 'ribbon.commands.rotate', 'rotate', 'rotate', 'RO'),
            toolBtn('imageTools.mirror', 'ribbon.commands.mirror', 'mirror', 'mirror', 'MI'),
            // ADR-654 — δύο ενέργειες διαστάσεων (action interceptor `useImageDimensionRibbonAction`,
            // ΟΧΙ tools — undoable commands σε ένα κλικ):
            //   «Κλείδωμα Αναλογιών» (ArchiCAD «fit to proportions») = un-deform κρατώντας την κλίμακα.
            //   «Επαναφορά Διαστάσεων» (PowerPoint «Reset Size») = απόλυτο αρχικό μέγεθος τοποθέτησης.
            actionBtn('imageTools.lockAspect', 'ribbon.commands.imageLockAspect', 'image-lock-aspect', 'image-lock-aspect', 'image-lock-aspect'),
            actionBtn('imageTools.resetSize', 'ribbon.commands.imageResetSize', 'image-reset-size', 'image-reset-size', 'image-reset-size'),
            toolBtn('imageTools.copy', 'ribbon.commands.copy', 'copy', 'copy', 'CO'),
            toolBtn('imageTools.delete', 'ribbon.commands.delete', 'delete', 'delete', 'DEL'),
          ],
        },
      ],
    },
  ],
};
