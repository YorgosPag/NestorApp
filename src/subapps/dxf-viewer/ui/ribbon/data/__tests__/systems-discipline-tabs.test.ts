/**
 * ADR-444 — Tests for the SIX permanent MEP discipline tabs (one per Greek μελέτη).
 * Each is permanent, all-large, no flyout. Clash moved OUT to «Ανάλυση» — asserted absent.
 * Shortcut uniqueness is NOT asserted globally: the source legitimately reuses 'SK'
 * (socket + sprinkler), now in different tabs anyway.
 */

import {
  ELECTRICAL_TAB, WATER_TAB, DRAINAGE_TAB, HEATING_TAB, HVAC_TAB, FIRE_GAS_TAB,
  MEP_DISCIPLINE_TABS,
} from '../systems-discipline-tabs';
import { ANALYZE_TAB, CLASH_COORDINATION_PANEL } from '../analyze-tab';
import type { RibbonCommand, RibbonTab } from '../../types/ribbon-types';
import { parseMepIconToken } from '../../components/buttons/mep-icon-tokens';

const ALL_EXPECTED_KEYS = [
  // electrical
  'mep-fixture', 'mep-socket', 'electrical-panel', 'mep-data-outlet', 'mep-comms-rack',
  'electricalAuto.actions.generate', 'electricalAuto.actions.accept', 'electricalAuto.actions.reject',
  'electricalWeakAuto.actions.generate', 'electricalWeakAuto.actions.accept', 'electricalWeakAuto.actions.reject',
  // water (incl. plumbing fixtures + appliances)
  'mep-manifold', 'mep-pipe', 'mepCircuit.actions.deriveNetworks',
  'mep-wc', 'mep-washbasin', 'mep-shower', 'mep-bathtub', 'mep-bidet', 'mep-washing-machine',
  // ADR-638 Στάδιο 2b — generative bathroom auto-arrange tool (water fixtures panel).
  'bathroom-auto-arrange',
  'waterSupply.actions.generate', 'waterSupply.actions.accept', 'waterSupply.actions.reject',
  // drainage
  'mep-drainage-collector', 'mep-drain-pipe', 'mep-floor-drain', 'mep-drain-riser',
  'drainageAuto.actions.generate', 'drainageAuto.actions.accept', 'drainageAuto.actions.reject',
  // heating
  'mep-radiator', 'mep-boiler', 'mep-water-heater', 'mep-underfloor',
  'heatingAuto.actions.generate', 'heatingAuto.actions.accept', 'heatingAuto.actions.reject',
  // hvac
  'mep-duct', 'mep-air-terminal', 'mep-ahu',
  'hvacAuto.actions.generate', 'hvacAuto.actions.accept', 'hvacAuto.actions.reject',
  // fire + gas
  'mep-sprinkler', 'mep-fire-riser',
  'fireAuto.actions.generate', 'fireAuto.actions.accept', 'fireAuto.actions.reject',
  'mep-gas-meter', 'mep-gas-cooker',
  'gasAuto.actions.generate', 'gasAuto.actions.accept', 'gasAuto.actions.reject',
];

function buttonsOf(tab: RibbonTab) {
  return tab.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}
function commandsOf(tab: RibbonTab): RibbonCommand[] {
  return buttonsOf(tab).map((b) => b.command);
}

describe('ADR-444 — MEP discipline tabs (6 permanent tabs)', () => {
  it('exports exactly six permanent tabs in ribbon order with canonical ids/labels', () => {
    expect(MEP_DISCIPLINE_TABS).toEqual([
      ELECTRICAL_TAB, WATER_TAB, DRAINAGE_TAB, HEATING_TAB, HVAC_TAB, FIRE_GAS_TAB,
    ]);
    expect(MEP_DISCIPLINE_TABS.map((t) => t.id)).toEqual([
      'electrical', 'water', 'drainage', 'heating', 'hvac', 'fire-gas',
    ]);
    expect(MEP_DISCIPLINE_TABS.map((t) => t.labelKey)).toEqual([
      'ribbon.tabs.electrical', 'ribbon.tabs.water', 'ribbon.tabs.drainage',
      'ribbon.tabs.heating', 'ribbon.tabs.hvac', 'ribbon.tabs.fireGas',
    ]);
    for (const t of MEP_DISCIPLINE_TABS) expect(t.isContextual).toBeUndefined();
  });

  it('covers ALL MEP commandKeys exactly once across the six tabs (none lost, no dup)', () => {
    const keys = MEP_DISCIPLINE_TABS.flatMap((t) => commandsOf(t)).map((c) => c.commandKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(ALL_EXPECTED_KEYS));
  });

  it('renders EVERY command as a LARGE simple button — nothing in a flyout', () => {
    for (const tab of MEP_DISCIPLINE_TABS) {
      for (const button of buttonsOf(tab)) {
        expect(button.type).toBe('simple');
        expect(button.size).toBe('large');
        expect(button.variants).toBeUndefined();
      }
      for (const panel of tab.panels) for (const row of panel.rows) expect(row.isInFlyout).toBe(false);
    }
  });

  it('routes every label through a namespaced i18n key, no comingSoon, non-empty icon (N.11)', () => {
    for (const command of MEP_DISCIPLINE_TABS.flatMap((t) => commandsOf(t))) {
      expect(command.labelKey).toMatch(/^[a-zA-Z]+(\.[a-zA-Z]+)+$/);
      expect(command.comingSoon).toBeFalsy();
      expect(command.icon).toBeTruthy();
    }
  });

  // §Icons (Giorgio 2026-10-24) — «τα εικονίδια στα Ηλεκτρολογικά είναι όλα ίδια»: 8 of the
  // 11 electrical buttons shared one plug glyph. Two buttons of one tab never share an icon.
  it('gives every button of a tab its OWN icon (no two buttons share an icon)', () => {
    for (const tab of MEP_DISCIPLINE_TABS) {
      const icons = commandsOf(tab).map((c) => c.icon);
      expect({ tab: tab.id, unique: new Set(icons).size }).toEqual({ tab: tab.id, unique: icons.length });
    }
  });

  it('uses a VALID plan-symbol MEP icon token for every button (never the fallback dot)', () => {
    for (const command of MEP_DISCIPLINE_TABS.flatMap((t) => commandsOf(t))) {
      expect({ id: command.id, spec: parseMepIconToken(command.icon) }).toEqual({
        id: command.id, spec: expect.objectContaining({ subject: expect.any(String) }),
      });
    }
  });

  it('marks every auto-design triad with generate ✦ / accept ✓ / reject ✗ badges', () => {
    const badgeOf = (c: RibbonCommand) => parseMepIconToken(c.icon)?.badge;
    for (const command of MEP_DISCIPLINE_TABS.flatMap((t) => commandsOf(t))) {
      const key = command.commandKey;
      if (key.endsWith('.actions.generate')) expect(badgeOf(command)).toBe('generate');
      if (key.endsWith('.actions.accept')) expect(badgeOf(command)).toBe('accept');
      if (key.endsWith('.actions.reject')) expect(badgeOf(command)).toBe('reject');
    }
  });

  it('splits Ηλεκτρολογικά into strong / weak device + auto-design panels', () => {
    expect(ELECTRICAL_TAB.panels.map((p) => p.id)).toEqual([
      'electrical-strong', 'electrical-weak', 'electrical-auto', 'electrical-weak-auto',
    ]);
  });

  it('moves clash OUT of the discipline tabs and INTO the «Ανάλυση» tab', () => {
    const allKeys = MEP_DISCIPLINE_TABS.flatMap((t) => commandsOf(t)).map((c) => c.commandKey);
    expect(allKeys.some((k) => k.startsWith('clashDetection.'))).toBe(false);
    const clashKeys = CLASH_COORDINATION_PANEL.rows
      .flatMap((r) => r.buttons).map((b) => b.command.commandKey);
    expect(new Set(clashKeys)).toEqual(new Set(['clashDetection.actions.detect', 'clashDetection.actions.clear']));
    expect(ANALYZE_TAB.panels.some((p) => p.id === 'coordination')).toBe(true);
  });
});
