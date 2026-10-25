/**
 * ADR-444 §7.6 — Accept / Reject of the MEP auto-design triads are available ONLY while a
 * proposal of THEIR discipline awaits review (Revit Finish/Cancel, Office Accept/Reject).
 *
 * Locks: idle ⇒ greyed with the «no pending proposal» reason · generate is never gated ·
 * the shared electrical store enables only the triad whose `origin` produced the review ·
 * teardown stops publishing · every Accept/Reject on the six MEP tabs has a gate.
 */

import { createExternalStore } from '../../../../../stores/createExternalStore';
import {
  getToolUnavailability,
  guardToolActivation,
  isRibbonActionKey,
  resetToolAvailabilityForTests,
} from '../../../../../stores/ToolAvailabilityStore';
import {
  electricalProposalStore,
  type ElectricalProposalOrigin,
  type ElectricalProposalReview,
} from '../../../../../systems/mep-design/electrical/electrical-proposal-store';
import { EventBus } from '../../../../../systems/events/EventBus';
import { MEP_DISCIPLINE_TABS } from '../../../data/systems-discipline-tabs';
import {
  installMepProposalAvailability,
  MEP_PROPOSAL_GATES,
  NO_PENDING_PROPOSAL,
  type MepProposalGate,
} from '../mep-proposal-availability';
import { ELECTRICAL_AUTO_RIBBON_ACTIONS } from '../electrical-auto-command-keys';
import { ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS } from '../electrical-weak-auto-command-keys';

const ACTIONS = {
  generate: 'testAuto.actions.generate',
  accept: 'testAuto.actions.accept',
  reject: 'testAuto.actions.reject',
} as const;

function fakeGate(): { gate: MepProposalGate; setPending: (pending: boolean) => void } {
  const store = createExternalStore<boolean>(false);
  return {
    gate: { actions: ACTIONS, subscribe: store.subscribe, hasPending: () => store.get() },
    setPending: (pending) => store.set(pending),
  };
}

function electricalReview(origin: ElectricalProposalOrigin): ElectricalProposalReview {
  return {
    origin,
    proposal: { warnings: [], storeyId: 'L1', skippedAlreadyCircuited: 0 },
    systemEntities: [],
    wirePaths: [],
    sceneUnits: 'mm',
  };
}

describe('mep-proposal-availability (ADR-444 §7.6)', () => {
  let teardown: (() => void) | null = null;

  beforeEach(() => {
    resetToolAvailabilityForTests();
    electricalProposalStore.reset();
  });

  afterEach(() => {
    teardown?.();
    teardown = null;
    electricalProposalStore.reset();
    jest.restoreAllMocks();
  });

  it('greys Accept + Reject while idle; Generate is never gated', () => {
    const { gate } = fakeGate();
    teardown = installMepProposalAvailability([gate]);
    expect(getToolUnavailability(ACTIONS.accept)).toEqual(NO_PENDING_PROPOSAL);
    expect(getToolUnavailability(ACTIONS.reject)).toEqual(NO_PENDING_PROPOSAL);
    expect(getToolUnavailability(ACTIONS.generate)).toBeNull();
  });

  it('enables the pair while a proposal is pending and greys it again after Accept/Reject', () => {
    const { gate, setPending } = fakeGate();
    teardown = installMepProposalAvailability([gate]);
    setPending(true);
    expect(getToolUnavailability(ACTIONS.accept)).toBeNull();
    expect(getToolUnavailability(ACTIONS.reject)).toBeNull();
    setPending(false);
    expect(getToolUnavailability(ACTIONS.accept)).toEqual(NO_PENDING_PROPOSAL);
  });

  it('stops publishing after teardown', () => {
    const { gate, setPending } = fakeGate();
    installMepProposalAvailability([gate])();
    setPending(true);
    expect(getToolUnavailability(ACTIONS.accept)).toEqual(NO_PENDING_PROPOSAL);
  });

  it('shared electrical store: a strong proposal enables ONLY the strong pair, a weak one ONLY the weak pair', () => {
    teardown = installMepProposalAvailability();
    electricalProposalStore.set(electricalReview('strong'));
    expect(getToolUnavailability(ELECTRICAL_AUTO_RIBBON_ACTIONS.accept)).toBeNull();
    expect(getToolUnavailability(ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS.accept)).toEqual(NO_PENDING_PROPOSAL);

    electricalProposalStore.set(electricalReview('weak'));
    expect(getToolUnavailability(ELECTRICAL_AUTO_RIBBON_ACTIONS.accept)).toEqual(NO_PENDING_PROPOSAL);
    expect(getToolUnavailability(ELECTRICAL_WEAK_AUTO_RIBBON_ACTIONS.reject)).toBeNull();
  });

  it('a click on a greyed action is refused by the gate with the «why» event', () => {
    const emitSpy = jest.spyOn(EventBus, 'emit');
    teardown = installMepProposalAvailability();
    expect(guardToolActivation(ELECTRICAL_AUTO_RIBBON_ACTIONS.accept)).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith('tool:activation-blocked', {
      tool: ELECTRICAL_AUTO_RIBBON_ACTIONS.accept,
      reasonKey: NO_PENDING_PROPOSAL.reasonKey,
    });
  });

  it('every Accept/Reject on the six MEP tabs is owned by exactly one gate', () => {
    const ribbonConfirmActions = MEP_DISCIPLINE_TABS.flatMap((tab) => tab.panels)
      .flatMap((panel) => panel.rows.flatMap((row) => row.buttons))
      .flatMap((button) => (button.type === 'simple' && button.command.action ? [button.command.action] : []))
      .filter((action) => /\.actions\.(accept|reject)$/.test(action))
      .sort();
    const gated = MEP_PROPOSAL_GATES.flatMap((g) => [g.actions.accept, g.actions.reject]).sort();
    expect(gated).toEqual(ribbonConfirmActions);
    expect(new Set(gated).size).toBe(gated.length);
  });

  it('isRibbonActionKey recognises the `<ns>.actions.<verb>` convention only', () => {
    expect(isRibbonActionKey('waterSupply.actions.accept')).toBe(true);
    expect(isRibbonActionKey('mep-pipe')).toBe(false);
    expect(isRibbonActionKey('.actions.')).toBe(false);
  });
});
