/**
 * ADR-430 — Contextual ribbon tab για την πρίζα ρεύματος (power socket / ρευματοδότης
 * — Revit "Electrical Fixtures", IfcOutlet).
 *
 * Trigger: `mep-socket-selected` (dispatched από `resolveContextualTrigger` στο
 * `app/ribbon-contextual-config.ts` όταν το primary-selected entity είναι
 * `mep-fixture` με `kind === 'socket'`).
 *
 * SSoT — ΜΗΔΕΝ νέος bridge: η πρίζα ΕΙΝΑΙ `mep-fixture`, οπότε επαναχρησιμοποιεί
 * αυτούσια τα `MEP_FIXTURE_RIBBON_KEYS` + τον `useRibbonMepFixtureBridge`. Thin
 * config του `mep-outlet-contextual-tab-factory.ts` — διαφέρει από τον data-outlet
 * μόνο σε labels (panels/tab) + trigger· πανομοιότυπη γεωμετρία κουτιού (και τα δύο
 * μικρά επιτοίχια ηλεκτρικά κουτιά ~80×80).
 *
 * Revit-true: η πρίζα ρεύματος είναι ξεχωριστή category από την πρίζα δικτύου
 * (Communication Devices) → ξεχωριστό contextual tab το καθένα, παρότι μοιράζονται
 * IfcOutlet βάση + πανομοιότυπη γεωμετρία κουτιού.
 *
 * @see ./mep-outlet-contextual-tab-factory.ts — the shared structure/presets SSoT
 * @see ./contextual-mep-data-outlet-tab.ts — the weak-current (data) counterpart
 * @see docs/centralized-systems/reference/adrs/ADR-430-electrical-strong-auto-design.md
 */

import type { RibbonTab } from '../types/ribbon-types';
import { buildMepOutletContextualTab } from './mep-outlet-contextual-tab-factory';

export const MEP_SOCKET_CONTEXTUAL_TRIGGER = 'mep-socket-selected';

export const CONTEXTUAL_MEP_SOCKET_TAB: RibbonTab = buildMepOutletContextualTab({
  tabId: 'mep-socket-editor',
  panelIdPrefix: 'mep-socket',
  commandIdPrefix: 'mepSocket',
  trigger: MEP_SOCKET_CONTEXTUAL_TRIGGER,
  tabLabelKey: 'ribbon.tabs.mepSocketProperties',
  panelLabelKeys: {
    geometry: 'ribbon.panels.mepSocketGeometry',
    threeDView: 'ribbon.panels.mepSocket3dView',
    actions: 'ribbon.panels.mepSocketActions',
  },
});
