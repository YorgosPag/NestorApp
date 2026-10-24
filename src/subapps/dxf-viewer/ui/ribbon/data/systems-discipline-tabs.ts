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
 * FULL SSoT: every button reuses the EXACT commandKey / action / labelKey / shortcut
 * already wired there — only tab + panel container i18n keys are new.
 *
 * §Icons (Giorgio 2026-10-24): every button has its OWN icon — the element's 2D plan
 * symbol (drawn by the same SSoT drawer as the canvas) × an optional action badge
 * (✦ generate · ✓ accept · ✗ reject), built with `mepIconToken`. A test forbids two
 * buttons of one tab from sharing an icon. Strong and weak current sit in their own
 * panels, so the two electrical auto-design triads are told apart by title as well.
 *
 * Boy-Scout re-grouping (N.0.2): the legacy `draw.mep.group` dumped air-terminal /
 * AHU / sprinkler / fire-riser / gas-meter / gas-cooker INSIDE «Ηλεκτρολογικά». Here
 * they sit in their correct discipline tab (Κλιματισμός / Πυρόσβεση / Αέριο).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-444-architecture-systems-permanent-ribbon-tabs.md
 */

import type { RibbonButton, RibbonPanelDef, RibbonTab } from '../types/ribbon-types';
import { mepIconToken as icon, type MepIconSubject } from '../components/buttons/mep-icon-tokens';

/** Helper: a LARGE tool button (commandKey → onToolChange, optional shortcut). */
function toolBtn(
  id: string, labelKey: string, iconToken: string, commandKey: string, shortcut?: string,
): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon: iconToken, commandKey, ...(shortcut ? { shortcut } : {}) } };
}

/** Helper: a LARGE action button (action → onAction; commandKey mirrors the action). */
function actionBtn(id: string, labelKey: string, iconToken: string, action: string): RibbonButton {
  return { type: 'simple', size: 'large', command: { id, labelKey, icon: iconToken, commandKey: action, action } };
}

/** Helper: a single-row, no-flyout panel. */
function panel(id: string, labelKey: string, buttons: RibbonButton[]): RibbonPanelDef {
  return { id, labelKey, rows: [{ isInFlyout: false, buttons }] };
}

/**
 * Helper: one discipline's auto-design triad «Δημιουργία → Αποδοχή → Απόρριψη».
 * The three share the discipline's icon SUBJECT and differ only by badge (✦ / ✓ / ✗).
 *
 * @param idPrefix    button id prefix → `${idPrefix}Gen|Accept|Reject`
 * @param labelPrefix i18n prefix → `${labelPrefix}Generate|Accept|Reject.label`
 * @param subject     icon subject identifying the discipline
 * @param actionNs    action namespace → `${actionNs}.actions.generate|accept|reject`
 */
function autoTriad(idPrefix: string, labelPrefix: string, subject: MepIconSubject, actionNs: string): RibbonButton[] {
  return [
    actionBtn(`${idPrefix}Gen`, `${labelPrefix}Generate.label`, icon(subject, 'generate'), `${actionNs}.actions.generate`),
    actionBtn(`${idPrefix}Accept`, `${labelPrefix}Accept.label`, icon(subject, 'accept'), `${actionNs}.actions.accept`),
    actionBtn(`${idPrefix}Reject`, `${labelPrefix}Reject.label`, icon(subject, 'reject'), `${actionNs}.actions.reject`),
  ];
}

// ── Ηλεκτρολογικά (Electrical: strong + weak current) ────────────────────────
export const ELECTRICAL_TAB: RibbonTab = {
  id: 'electrical',
  labelKey: 'ribbon.tabs.electrical',
  panels: [
    panel('electrical-strong', 'ribbon.panels.electricalStrong', [
      toolBtn('electricalTab.fixture', 'ribbon.commands.bim.mepFixture.label', icon('luminaire'), 'mep-fixture', 'LF'),
      toolBtn('electricalTab.socket', 'ribbon.commands.bim.mepSocket.label', icon('socket'), 'mep-socket', 'SK'),
      toolBtn('electricalTab.panel', 'ribbon.commands.bim.electricalPanel.label', icon('electrical-panel'), 'electrical-panel', 'EP'),
    ]),
    panel('electrical-weak', 'ribbon.panels.electricalWeak', [
      toolBtn('electricalTab.dataOutlet', 'ribbon.commands.bim.mepDataOutlet.label', icon('data-outlet'), 'mep-data-outlet', 'DO'),
      toolBtn('electricalTab.commsRack', 'ribbon.commands.bim.commsRack.label', icon('comms-rack'), 'mep-comms-rack', 'CR'),
    ]),
    panel('electrical-auto', 'ribbon.panels.electricalAuto',
      autoTriad('electricalTab.auto', 'ribbon.commands.bim.electricalAuto', 'socket', 'electricalAuto')),
    panel('electrical-weak-auto', 'ribbon.panels.electricalWeakAuto',
      autoTriad('electricalTab.weakAuto', 'ribbon.commands.bim.electricalWeakAuto', 'data-outlet', 'electricalWeakAuto')),
  ],
};

// ── Ύδρευση (Water supply + plumbing fixtures) ───────────────────────────────
export const WATER_TAB: RibbonTab = {
  id: 'water',
  labelKey: 'ribbon.tabs.water',
  panels: [
    panel('water-network', 'ribbon.panels.waterNetwork', [
      toolBtn('waterTab.manifold', 'ribbon.commands.bim.mepManifold.label', icon('manifold'), 'mep-manifold'),
      toolBtn('waterTab.pipe', 'ribbon.commands.bim.mepPipe.label', icon('pipe'), 'mep-pipe', 'PP'),
      actionBtn('waterTab.deriveNetworks', 'ribbon.commands.bim.mepPipeNetwork.label', icon('pipe-network'), 'mepCircuit.actions.deriveNetworks'),
    ]),
    // Plumbing fixtures (sanitary + appliances) consume water → homed with Ύδρευση.
    panel('water-fixtures', 'ribbon.panels.waterFixtures', [
      toolBtn('waterTab.wc', 'floorplanSymbol.catalog.wc', icon('wc'), 'mep-wc'),
      toolBtn('waterTab.washbasin', 'floorplanSymbol.catalog.washbasin', icon('washbasin'), 'mep-washbasin'),
      toolBtn('waterTab.shower', 'floorplanSymbol.catalog.shower', icon('shower'), 'mep-shower'),
      toolBtn('waterTab.bathtub', 'floorplanSymbol.catalog.bathtub', icon('bathtub'), 'mep-bathtub'),
      toolBtn('waterTab.bidet', 'floorplanSymbol.catalog.bidet', icon('bidet'), 'mep-bidet'),
      toolBtn('waterTab.washingMachine', 'mepFixture.appliance.washingMachine', icon('washing-machine'), 'mep-washing-machine'),
      // ADR-638 Στάδιο 2b — generative bathroom layout tool: hover σε κλειστό δωμάτιο →
      // highlight → κλικ → solve + commit των ειδών υγιεινής (Revit «Place Space» pattern).
      toolBtn('waterTab.bathroomAutoArrange', 'ribbon.commands.bim.bathroomAutoArrange.label', icon('bathroom', 'generate'), 'bathroom-auto-arrange'),
    ]),
    panel('water-auto', 'ribbon.panels.waterAuto',
      autoTriad('waterTab.auto', 'ribbon.commands.bim.waterAuto', 'pipe', 'waterSupply')),
  ],
};

// ── Αποχέτευση (Drainage / waste) ────────────────────────────────────────────
export const DRAINAGE_TAB: RibbonTab = {
  id: 'drainage',
  labelKey: 'ribbon.tabs.drainage',
  panels: [
    panel('drainage-network', 'ribbon.panels.drainageNetwork', [
      toolBtn('drainageTab.collector', 'ribbon.commands.bim.mepDrainageCollector.label', icon('drainage-collector'), 'mep-drainage-collector'),
      toolBtn('drainageTab.drainPipe', 'ribbon.commands.bim.mepDrainPipe.label', icon('drain-pipe'), 'mep-drain-pipe', 'DP'),
      toolBtn('drainageTab.floorDrain', 'ribbon.commands.bim.mepFloorDrain.label', icon('floor-drain'), 'mep-floor-drain'),
      toolBtn('drainageTab.drainRiser', 'ribbon.commands.bim.mepDrainRiser.label', icon('drain-riser'), 'mep-drain-riser'),
    ]),
    panel('drainage-auto', 'ribbon.panels.drainageAuto',
      autoTriad('drainageTab.auto', 'ribbon.commands.bim.drainageAuto', 'drain-pipe', 'drainageAuto')),
  ],
};

// ── Θέρμανση (Heating: hydronic) ─────────────────────────────────────────────
export const HEATING_TAB: RibbonTab = {
  id: 'heating',
  labelKey: 'ribbon.tabs.heating',
  panels: [
    panel('heating-devices', 'ribbon.panels.heatingDevices', [
      toolBtn('heatingTab.radiator', 'ribbon.commands.bim.mepRadiator.label', icon('radiator'), 'mep-radiator'),
      toolBtn('heatingTab.boiler', 'ribbon.commands.bim.mepBoiler.label', icon('boiler'), 'mep-boiler'),
      toolBtn('heatingTab.waterHeater', 'ribbon.commands.bim.mepWaterHeater.label', icon('water-heater'), 'mep-water-heater'),
      toolBtn('heatingTab.underfloor', 'ribbon.commands.bim.mepUnderfloor.label', icon('underfloor'), 'mep-underfloor'),
    ]),
    panel('heating-auto', 'ribbon.panels.heatingAuto',
      autoTriad('heatingTab.auto', 'ribbon.commands.bim.heatingAuto', 'radiator', 'heatingAuto')),
  ],
};

// ── Κλιματισμός / HVAC (ventilation) ─────────────────────────────────────────
export const HVAC_TAB: RibbonTab = {
  id: 'hvac',
  labelKey: 'ribbon.tabs.hvac',
  panels: [
    panel('hvac-devices', 'ribbon.panels.hvacDevices', [
      toolBtn('hvacTab.duct', 'ribbon.commands.bim.mepDuct.label', icon('duct'), 'mep-duct', 'DU'),
      toolBtn('hvacTab.airTerminal', 'ribbon.commands.bim.mepAirTerminal.label', icon('air-terminal'), 'mep-air-terminal', 'AT'),
      toolBtn('hvacTab.ahu', 'ribbon.commands.bim.mepAhu.label', icon('ahu'), 'mep-ahu', 'AH'),
    ]),
    panel('hvac-auto', 'ribbon.panels.hvacAuto',
      autoTriad('hvacTab.auto', 'ribbon.commands.bim.hvacAuto', 'duct', 'hvacAuto')),
  ],
};

// ── Πυρόσβεση & Αέριο (Fire protection + fuel gas) ───────────────────────────
export const FIRE_GAS_TAB: RibbonTab = {
  id: 'fire-gas',
  labelKey: 'ribbon.tabs.fireGas',
  panels: [
    panel('fire-protection', 'ribbon.panels.fireProtection', [
      toolBtn('fireGasTab.sprinkler', 'ribbon.commands.bim.mepSprinkler.label', icon('sprinkler'), 'mep-sprinkler'),
      toolBtn('fireGasTab.fireRiser', 'ribbon.commands.bim.mepFireRiser.label', icon('fire-riser'), 'mep-fire-riser', 'FR'),
      ...autoTriad('fireGasTab.fireAuto', 'ribbon.commands.bim.fireAuto', 'sprinkler', 'fireAuto'),
    ]),
    panel('fire-gas-gas', 'ribbon.panels.gas', [
      toolBtn('fireGasTab.gasMeter', 'ribbon.commands.bim.mepGasMeter.label', icon('gas-meter'), 'mep-gas-meter', 'GM'),
      toolBtn('fireGasTab.gasCooker', 'ribbon.commands.bim.mepGasCooker.label', icon('gas-cooker'), 'mep-gas-cooker', 'GC'),
      ...autoTriad('fireGasTab.gasAuto', 'ribbon.commands.bim.gasAuto', 'gas-meter', 'gasAuto'),
    ]),
  ],
};

/** All six MEP discipline tabs, in ribbon order. */
export const MEP_DISCIPLINE_TABS: readonly RibbonTab[] = [
  ELECTRICAL_TAB, WATER_TAB, DRAINAGE_TAB, HEATING_TAB, HVAC_TAB, FIRE_GAS_TAB,
];
