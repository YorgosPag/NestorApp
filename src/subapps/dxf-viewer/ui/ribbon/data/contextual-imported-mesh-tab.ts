/**
 * ADR-683 **Φ3.1β** — contextual ribbon tab «Εισαγόμενο Πλέγμα», ορατό όταν επιλέγεται ένα
 * `ImportedMeshEntity` (`type:'imported-mesh'`).
 *
 * **Ενέργειες μόνο — καμία ιδιότητα**, και αυτό δεν είναι σχεδιαστική προτίμηση αλλά συνέπεια του
 * §3: ένα ψημένο πλέγμα **δεν έχει** παραμέτρους να επεξεργαστείς. Οι μετρημένες διαστάσεις είναι
 * μετρήσεις, όχι ρυθμίσεις — μια «επεξεργασία» τους θα παραμόρφωνε γεωμετρία που έφτιαξε ο
 * συνεργάτης. Θέση και στροφή γίνονται με λαβές (δύο, §4). Ό,τι απομένει ως πραγματική απόφαση του
 * χρήστη είναι **ένα**: πώς κοστολογείται (§10.2) — και αυτό ζει σε dialog, γιατί είναι ένα
 * καθοδηγούμενο έντυπο πολλών πεδίων με προσυμπλήρωση, όχι ένας διακόπτης.
 *
 * Ίδιος διαχωρισμός με το `contextual-topo-surface-tab` (Revit/Civil-3D): το tab κρατά ενέργειες,
 * το «Κλείσιμο»/σύριγγα τα προσθέτει κεντρικά το `withStandardLeadPanel`.
 *
 * @see ./contextual-topo-surface-tab — το mirror template (non-parametric οντότητα, actions-only)
 * @see ../../../app/dxf-special-actions — `imported-mesh.assign-boq` → άνοιγμα dialog
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §10.2
 */

import type { RibbonTab } from '../types/ribbon-types';
import { buildSelectPanel } from './contextual-select-panel';
import { actionBtn } from './ribbon-large-button-helpers';

export const IMPORTED_MESH_CONTEXTUAL_TRIGGER = 'imported-mesh-selected';

/** Το action token που ανοίγει τον dialog ανάθεσης (`dxf-special-actions`). */
export const IMPORTED_MESH_ASSIGN_BOQ_ACTION = 'imported-mesh.assign-boq';

/** ADR-686 Φ5 — action token που ανοίγει τον dialog «Αντιστοίχιση Υλικών» (`dxf-special-actions`). */
export const IMPORTED_MESH_ASSIGN_MATERIALS_ACTION = 'imported-mesh.assign-materials';

const K = 'ribbon.commands.importedMesh';

export const CONTEXTUAL_IMPORTED_MESH_TAB: RibbonTab = {
  id: 'imported-mesh-tools',
  labelKey: 'ribbon.tabs.importedMeshProperties',
  isContextual: true,
  contextualTrigger: IMPORTED_MESH_CONTEXTUAL_TRIGGER,
  panels: [
    buildSelectPanel('importedMesh'),
    {
      id: 'imported-mesh-boq',
      labelKey: 'ribbon.panels.importedMeshBoq',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn(
              'importedMeshTools.assignBoq',
              `${K}.assignBoq.label`,
              'boq-assign',
              IMPORTED_MESH_ASSIGN_BOQ_ACTION,
              IMPORTED_MESH_ASSIGN_BOQ_ACTION,
            ),
          ],
        },
      ],
    },
    {
      id: 'imported-mesh-materials',
      labelKey: 'ribbon.panels.importedMeshMaterials',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn(
              'importedMeshTools.assignMaterials',
              `${K}.assignMaterials.label`,
              'material-map',
              IMPORTED_MESH_ASSIGN_MATERIALS_ACTION,
              IMPORTED_MESH_ASSIGN_MATERIALS_ACTION,
            ),
          ],
        },
      ],
    },
  ],
};
