/**
 * ADR-431 — Contextual ribbon tab για την πρίζα δικτύου (data outlet / RJ45
 * structured-cabling — Revit "Communication Devices", IfcOutlet DATAOUTLET).
 *
 * Trigger: `mep-data-outlet-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-fixture` με `kind === 'data-outlet'`).
 *
 * SSoT — ΜΗΔΕΝ νέος bridge: η πρίζα δικτύου ΕΙΝΑΙ `mep-fixture`, οπότε επαναχρησιμοποιεί
 * αυτούσια τα `MEP_FIXTURE_RIBBON_KEYS` + τον `useRibbonMepFixtureBridge`. Thin config
 * του `mep-outlet-contextual-tab-factory.ts` — διαφέρει από την πρίζα ρεύματος μόνο σε
 * labels (panels/tab) + trigger· πανομοιότυπη γεωμετρία κουτιού (και τα δύο μικρά
 * επιτοίχια ηλεκτρικά κουτιά ~80×80).
 *
 * Revit-true: η πρίζα δικτύου (ασθενή ρεύματα) είναι ξεχωριστή category από την πρίζα
 * ρεύματος (Electrical Fixtures) → ξεχωριστό contextual tab το καθένα, παρότι
 * μοιράζονται IfcOutlet βάση + πανομοιότυπη γεωμετρία.
 *
 * @see ./mep-outlet-contextual-tab-factory.ts — the shared structure/presets SSoT
 * @see ./contextual-mep-socket-tab.ts — the power (strong-current) counterpart
 * @see docs/centralized-systems/reference/adrs/ADR-431-electrical-weak-auto-design.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { buildMepOutletContextualTab } from './mep-outlet-contextual-tab-factory';

export const MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER = 'mep-data-outlet-selected';

export const CONTEXTUAL_MEP_DATA_OUTLET_TAB: RibbonTab = buildMepOutletContextualTab({
  tabId: 'mep-data-outlet-editor',
  panelIdPrefix: 'mep-data-outlet',
  commandIdPrefix: 'mepDataOutlet',
  trigger: MEP_DATA_OUTLET_CONTEXTUAL_TRIGGER,
  tabLabelKey: 'ribbon.tabs.mepDataOutletProperties',
  panelLabelKeys: {
    geometry: 'ribbon.panels.mepDataOutletGeometry',
    threeDView: 'ribbon.panels.mepDataOutlet3dView',
    actions: 'ribbon.panels.mepDataOutletActions',
  },
});
