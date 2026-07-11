/**
 * ADR-444 — Permanent MEP (ΗΛΜ) discipline ribbon tabs (Revit-grade).
 *
 * Giorgio 2026-06-12: the single «ΗΛΜ» tab held ~55 commands and keeps growing, so
 * it is split into SIX permanent discipline tabs — one per Greek engineering μελέτη
 * (Η/Μ study). Since the product forbids dropdowns (everything large), this is the
 * faithful adaptation of Revit's "one Systems tab + discipline panels + dropdowns":
 * no dropdowns ⇒ each discipline gets its own tab.
 *
 *   Ηλεκτρολογικά (electrical)  — power / lighting / data / weak-current + auto-design
 *   Ύδρευση (water)             — supply network + sanitary fixtures + appliances + auto
 *   Αποχέτευση (drainage)       — waste network + auto-design
 *   Θέρμανση (heating)          — hydronic terminals/sources + auto-design
 *   Κλιματισμός (hvac)          — ducts / terminals / AHU + auto-design
 *   Πυρόσβεση & Αέριο (fire-gas)— sprinkler/riser + gas meter/cooker + autos
 *
 * Auto-design triads (generate → accept → reject) live WITH their discipline (they
 * author model elements). The cross-discipline «Συντονισμός» (clash) moved OUT to the
 * «Ανάλυση» tab (analyze-tab.ts) — it is an analysis tool, not a placement tool
 * (Revit puts interference/clash under Analyze/Collaborate).
 *
 * Replaces the legacy nested `draw.mep.group` dropdown in `home-tab-draw.ts`.
 * FULL SSoT: every button reuses the EXACT commandKey / action / icon / labelKey /
 * shortcut already wired there — only tab + panel container i18n keys are new.
 *
 * Boy-Scout re-grouping (N.0.2): the legacy `draw.mep.group` dumped air-terminal /
 * AHU / sprinkler / fire-riser / gas-meter / gas-cooker INSIDE «Ηλεκτρολογικά». Here
 * they sit in their correct discipline tab (Κλιματισμός / Πυρόσβεση / Αέριο).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-444-architecture-systems-permanent-ribbon-tabs.md
 */

import type { RibbonButton, RibbonTab } from '../types/ribbon-types';

/** Helper: a LARGE tool button (commandKey → onToolChange, optional shortcut). */
function toolBtn(
  id: string, labelKey: string, icon: string, commandKey: string, shortcut?: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey, ...(shortcut ? { shortcut } : {}) } };
}

/** Helper: a LARGE action button (action → onAction; commandKey mirrors the action). */
function actionBtn(id: string, labelKey: string, icon: string, action: string): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon, commandKey: action, action } };
}

// ── Ηλεκτρολογικά (Electrical: strong + weak current) ────────────────────────
export const ELECTRICAL_TAB: RibbonTab = {
  id: 'electrical',
  labelKey: 'ribbon.tabs.electrical',
  panels: [
    {
      id: 'electrical-devices',
      labelKey: 'ribbon.panels.electricalDevices',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('electricalTab.fixture', 'ribbon.commands.bim.mepFixture.label', 'bim-light-fixture', 'mep-fixture', 'LF'),
            toolBtn('electricalTab.socket', 'ribbon.commands.bim.mepSocket.label', 'bim-socket', 'mep-socket', 'SK'),
            toolBtn('electricalTab.panel', 'ribbon.commands.bim.electricalPanel.label', 'bim-electrical-panel', 'electrical-panel', 'EP'),
            toolBtn('electricalTab.dataOutlet', 'ribbon.commands.bim.mepDataOutlet.label', 'bim-socket', 'mep-data-outlet', 'DO'),
            toolBtn('electricalTab.commsRack', 'ribbon.commands.bim.commsRack.label', 'bim-electrical-panel', 'mep-comms-rack', 'CR'),
          ],
        },
      ],
    },
    {
      id: 'electrical-auto',
      labelKey: 'ribbon.panels.electricalAuto',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn('electricalTab.autoGen', 'ribbon.commands.bim.electricalAutoGenerate.label', 'bim-socket', 'electricalAuto.actions.generate'),
            actionBtn('electricalTab.autoAccept', 'ribbon.commands.bim.electricalAutoAccept.label', 'bim-socket', 'electricalAuto.actions.accept'),
            actionBtn('electricalTab.autoReject', 'ribbon.commands.bim.electricalAutoReject.label', 'bim-socket', 'electricalAuto.actions.reject'),
            actionBtn('electricalTab.weakAutoGen', 'ribbon.commands.bim.electricalWeakAutoGenerate.label', 'bim-socket', 'electricalWeakAuto.actions.generate'),
            actionBtn('electricalTab.weakAutoAccept', 'ribbon.commands.bim.electricalWeakAutoAccept.label', 'bim-socket', 'electricalWeakAuto.actions.accept'),
            actionBtn('electricalTab.weakAutoReject', 'ribbon.commands.bim.electricalWeakAutoReject.label', 'bim-socket', 'electricalWeakAuto.actions.reject'),
          ],
        },
      ],
    },
  ],
};

// ── Ύδρευση (Water supply + plumbing fixtures) ───────────────────────────────
export const WATER_TAB: RibbonTab = {
  id: 'water',
  labelKey: 'ribbon.tabs.water',
  panels: [
    {
      id: 'water-network',
      labelKey: 'ribbon.panels.waterNetwork',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('waterTab.manifold', 'ribbon.commands.bim.mepManifold.label', 'bim-mep-manifold', 'mep-manifold'),
            toolBtn('waterTab.pipe', 'ribbon.commands.bim.mepPipe.label', 'bim-pipe', 'mep-pipe', 'PP'),
            actionBtn('waterTab.deriveNetworks', 'ribbon.commands.bim.mepPipeNetwork.label', 'bim-pipe', 'mepCircuit.actions.deriveNetworks'),
          ],
        },
      ],
    },
    {
      // Plumbing fixtures (sanitary + appliances) consume water → homed with Ύδρευση.
      id: 'water-fixtures',
      labelKey: 'ribbon.panels.waterFixtures',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('waterTab.wc', 'floorplanSymbol.catalog.wc', 'bim-furniture', 'mep-wc'),
            toolBtn('waterTab.washbasin', 'floorplanSymbol.catalog.washbasin', 'bim-furniture', 'mep-washbasin'),
            toolBtn('waterTab.shower', 'floorplanSymbol.catalog.shower', 'bim-furniture', 'mep-shower'),
            toolBtn('waterTab.bathtub', 'floorplanSymbol.catalog.bathtub', 'bim-furniture', 'mep-bathtub'),
            toolBtn('waterTab.bidet', 'floorplanSymbol.catalog.bidet', 'bim-furniture', 'mep-bidet'),
            toolBtn('waterTab.washingMachine', 'mepFixture.appliance.washingMachine', 'bim-furniture', 'mep-washing-machine'),
            // ADR-638 — one-click generative bathroom layout: detect the selected/only
            // bathroom room → solve → commit the fixture arrangement (one undo).
            actionBtn('waterTab.bathroomAutoArrange', 'ribbon.commands.bim.bathroomAutoArrange.label', 'bim-furniture', 'bathroom.actions.autoArrange'),
          ],
        },
      ],
    },
    {
      id: 'water-auto',
      labelKey: 'ribbon.panels.waterAuto',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn('waterTab.autoGen', 'ribbon.commands.bim.waterAutoGenerate.label', 'bim-pipe', 'waterSupply.actions.generate'),
            actionBtn('waterTab.autoAccept', 'ribbon.commands.bim.waterAutoAccept.label', 'bim-pipe', 'waterSupply.actions.accept'),
            actionBtn('waterTab.autoReject', 'ribbon.commands.bim.waterAutoReject.label', 'bim-pipe', 'waterSupply.actions.reject'),
          ],
        },
      ],
    },
  ],
};

// ── Αποχέτευση (Drainage / waste) ────────────────────────────────────────────
export const DRAINAGE_TAB: RibbonTab = {
  id: 'drainage',
  labelKey: 'ribbon.tabs.drainage',
  panels: [
    {
      id: 'drainage-network',
      labelKey: 'ribbon.panels.drainageNetwork',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('drainageTab.collector', 'ribbon.commands.bim.mepDrainageCollector.label', 'bim-mep-manifold', 'mep-drainage-collector'),
            toolBtn('drainageTab.drainPipe', 'ribbon.commands.bim.mepDrainPipe.label', 'bim-pipe', 'mep-drain-pipe', 'DP'),
            toolBtn('drainageTab.floorDrain', 'ribbon.commands.bim.mepFloorDrain.label', 'bim-mep-manifold', 'mep-floor-drain'),
            toolBtn('drainageTab.drainRiser', 'ribbon.commands.bim.mepDrainRiser.label', 'bim-pipe', 'mep-drain-riser'),
          ],
        },
      ],
    },
    {
      id: 'drainage-auto',
      labelKey: 'ribbon.panels.drainageAuto',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn('drainageTab.autoGen', 'ribbon.commands.bim.drainageAutoGenerate.label', 'bim-pipe', 'drainageAuto.actions.generate'),
            actionBtn('drainageTab.autoAccept', 'ribbon.commands.bim.drainageAutoAccept.label', 'bim-pipe', 'drainageAuto.actions.accept'),
            actionBtn('drainageTab.autoReject', 'ribbon.commands.bim.drainageAutoReject.label', 'bim-pipe', 'drainageAuto.actions.reject'),
          ],
        },
      ],
    },
  ],
};

// ── Θέρμανση (Heating: hydronic) ─────────────────────────────────────────────
export const HEATING_TAB: RibbonTab = {
  id: 'heating',
  labelKey: 'ribbon.tabs.heating',
  panels: [
    {
      id: 'heating-devices',
      labelKey: 'ribbon.panels.heatingDevices',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('heatingTab.radiator', 'ribbon.commands.bim.mepRadiator.label', 'bim-mep-radiator', 'mep-radiator'),
            toolBtn('heatingTab.boiler', 'ribbon.commands.bim.mepBoiler.label', 'bim-mep-boiler', 'mep-boiler'),
            toolBtn('heatingTab.waterHeater', 'ribbon.commands.bim.mepWaterHeater.label', 'bim-mep-water-heater', 'mep-water-heater'),
            toolBtn('heatingTab.underfloor', 'ribbon.commands.bim.mepUnderfloor.label', 'bim-mep-radiator', 'mep-underfloor'),
          ],
        },
      ],
    },
    {
      id: 'heating-auto',
      labelKey: 'ribbon.panels.heatingAuto',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn('heatingTab.autoGen', 'ribbon.commands.bim.heatingAutoGenerate.label', 'bim-pipe', 'heatingAuto.actions.generate'),
            actionBtn('heatingTab.autoAccept', 'ribbon.commands.bim.heatingAutoAccept.label', 'bim-pipe', 'heatingAuto.actions.accept'),
            actionBtn('heatingTab.autoReject', 'ribbon.commands.bim.heatingAutoReject.label', 'bim-pipe', 'heatingAuto.actions.reject'),
          ],
        },
      ],
    },
  ],
};

// ── Κλιματισμός / HVAC (ventilation) ─────────────────────────────────────────
export const HVAC_TAB: RibbonTab = {
  id: 'hvac',
  labelKey: 'ribbon.tabs.hvac',
  panels: [
    {
      id: 'hvac-devices',
      labelKey: 'ribbon.panels.hvacDevices',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('hvacTab.duct', 'ribbon.commands.bim.mepDuct.label', 'bim-duct', 'mep-duct', 'DU'),
            toolBtn('hvacTab.airTerminal', 'ribbon.commands.bim.mepAirTerminal.label', 'bim-duct', 'mep-air-terminal', 'AT'),
            toolBtn('hvacTab.ahu', 'ribbon.commands.bim.mepAhu.label', 'bim-duct', 'mep-ahu', 'AH'),
          ],
        },
      ],
    },
    {
      id: 'hvac-auto',
      labelKey: 'ribbon.panels.hvacAuto',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            actionBtn('hvacTab.autoGen', 'ribbon.commands.bim.hvacAutoGenerate.label', 'bim-duct', 'hvacAuto.actions.generate'),
            actionBtn('hvacTab.autoAccept', 'ribbon.commands.bim.hvacAutoAccept.label', 'bim-duct', 'hvacAuto.actions.accept'),
            actionBtn('hvacTab.autoReject', 'ribbon.commands.bim.hvacAutoReject.label', 'bim-duct', 'hvacAuto.actions.reject'),
          ],
        },
      ],
    },
  ],
};

// ── Πυρόσβεση & Αέριο (Fire protection + fuel gas) ───────────────────────────
export const FIRE_GAS_TAB: RibbonTab = {
  id: 'fire-gas',
  labelKey: 'ribbon.tabs.fireGas',
  panels: [
    {
      id: 'fire-protection',
      labelKey: 'ribbon.panels.fireProtection',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('fireGasTab.sprinkler', 'ribbon.commands.bim.mepSprinkler.label', 'bim-pipe', 'mep-sprinkler'),
            toolBtn('fireGasTab.fireRiser', 'ribbon.commands.bim.mepFireRiser.label', 'bim-pipe', 'mep-fire-riser', 'FR'),
            actionBtn('fireGasTab.fireAutoGen', 'ribbon.commands.bim.fireAutoGenerate.label', 'bim-pipe', 'fireAuto.actions.generate'),
            actionBtn('fireGasTab.fireAutoAccept', 'ribbon.commands.bim.fireAutoAccept.label', 'bim-pipe', 'fireAuto.actions.accept'),
            actionBtn('fireGasTab.fireAutoReject', 'ribbon.commands.bim.fireAutoReject.label', 'bim-pipe', 'fireAuto.actions.reject'),
          ],
        },
      ],
    },
    {
      id: 'fire-gas-gas',
      labelKey: 'ribbon.panels.gas',
      rows: [
        {
          isInFlyout: false,
          buttons: [
            toolBtn('fireGasTab.gasMeter', 'ribbon.commands.bim.mepGasMeter.label', 'bim-pipe', 'mep-gas-meter', 'GM'),
            toolBtn('fireGasTab.gasCooker', 'ribbon.commands.bim.mepGasCooker.label', 'bim-pipe', 'mep-gas-cooker', 'GC'),
            actionBtn('fireGasTab.gasAutoGen', 'ribbon.commands.bim.gasAutoGenerate.label', 'bim-pipe', 'gasAuto.actions.generate'),
            actionBtn('fireGasTab.gasAutoAccept', 'ribbon.commands.bim.gasAutoAccept.label', 'bim-pipe', 'gasAuto.actions.accept'),
            actionBtn('fireGasTab.gasAutoReject', 'ribbon.commands.bim.gasAutoReject.label', 'bim-pipe', 'gasAuto.actions.reject'),
          ],
        },
      ],
    },
  ],
};

/** All six MEP discipline tabs, in ribbon order. */
export const MEP_DISCIPLINE_TABS: readonly RibbonTab[] = [
  ELECTRICAL_TAB, WATER_TAB, DRAINAGE_TAB, HEATING_TAB, HVAC_TAB, FIRE_GAS_TAB,
];
