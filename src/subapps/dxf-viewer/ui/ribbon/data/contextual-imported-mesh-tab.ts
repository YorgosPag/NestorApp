/**
 * ADR-683 **Φ3.1β** (+ **Φ3.1γ B2**) — contextual ribbon tab «Εισαγόμενο Πλέγμα», ορατό όταν
 * επιλέγεται ένα `ImportedMeshEntity` (`type:'imported-mesh'`).
 *
 * **Ενέργειες + θέση/στροφή** — όχι σχήμα. Η §3 παραμένει ακέραιη: ένα ψημένο πλέγμα **δεν έχει**
 * παραμέτρους σχήματος να επεξεργαστείς — οι μετρημένες διαστάσεις είναι μετρήσεις, όχι ρυθμίσεις,
 * και μια «επεξεργασία» τους θα παραμόρφωνε γεωμετρία που έφτιαξε ο συνεργάτης. Θέση/υψόμετρο/στροφή
 * ΟΜΩΣ είναι νόμιμες μεταβολές (§10.1, ίδιο σύνολο με τις δύο λαβές move/rotation, §4) — το panel
 * `imported-mesh-params` απλώς εκθέτει την ΙΔΙΑ μεταβολή ως πληκτρολογήσιμο πεδίο, μέσω του
 * SSoT `bim/entities/imported-mesh/imported-mesh-param-{keys,access}.ts` (Φ3.1γ A1) + το bridge
 * `useRibbonImportedMeshBridge`. Ό,τι απομένει ως πραγματική απόφαση κοστολόγησης (§10.2) ζει σε
 * dialog, γιατί είναι ένα καθοδηγούμενο έντυπο πολλών πεδίων με προσυμπλήρωση, όχι ένας διακόπτης.
 *
 * @see ./contextual-railing-tab — το mirror template για combobox-panel σχήμα (ADR-407 Φ9)
 * @see ../../../bim/hooks/use-ribbon-imported-mesh-bridge — το bridge που τροφοδοτεί το νέο panel
 * @see ../../../app/dxf-special-actions — `imported-mesh.assign-boq` → άνοιγμα dialog
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §3, §10.1, §10.2
 */

import type { RibbonTab } from '../types/ribbon-types';
import { buildSelectPanel } from './contextual-select-panel';
import { actionBtn } from './ribbon-large-button-helpers';
import { IMPORTED_MESH_RIBBON_KEYS } from '../../../bim/entities/imported-mesh/imported-mesh-param-keys';

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
      id: 'imported-mesh-params',
      labelKey: 'importedMeshParams.panelTitle',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'importedMesh.posX',
                labelKey: 'importedMeshAdvancedPanel.field.posX',
                commandKey: IMPORTED_MESH_RIBBON_KEYS.number.posX,
                comboboxWidthPx: 90,
                options: [],
                numericInput: { quantityKind: 'model-length', editable: true, allowNegative: true, allowDecimal: true },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'importedMesh.posY',
                labelKey: 'importedMeshAdvancedPanel.field.posY',
                commandKey: IMPORTED_MESH_RIBBON_KEYS.number.posY,
                comboboxWidthPx: 90,
                options: [],
                numericInput: { quantityKind: 'model-length', editable: true, allowNegative: true, allowDecimal: true },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'importedMesh.elevation',
                labelKey: 'importedMeshAdvancedPanel.field.elevation',
                commandKey: IMPORTED_MESH_RIBBON_KEYS.number.elevation,
                comboboxWidthPx: 90,
                options: [],
                numericInput: { quantityKind: 'model-length', editable: true, allowNegative: true, allowDecimal: true },
              },
            },
            {
              type: 'combobox',
              size: 'small',
              command: {
                id: 'importedMesh.rotation',
                labelKey: 'importedMeshAdvancedPanel.field.rotation',
                commandKey: IMPORTED_MESH_RIBBON_KEYS.number.rotation,
                comboboxWidthPx: 80,
                options: [],
                numericInput: { quantityKind: 'angle', editable: true, allowNegative: true, allowDecimal: true },
              },
            },
          ],
        },
      ],
    },
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
