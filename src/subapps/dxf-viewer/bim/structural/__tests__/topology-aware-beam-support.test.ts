/**
 * ADR-486 — topology-aware beam support override (end-to-end through section-context
 * + reinforce-patch). Αποδεικνύει ότι ο DERIVED τύπος στήριξης (πρόβολος) προπαγκάρεται
 * στη ροπή σχεδιασμού: `wL²/2` (πρόβολος) ≫ `wL²/8` (αμφιέρειστο) → περισσότερος χάλυβας.
 *
 * Συμπληρώνει το `derive-beam-support.test.ts` (που ελέγχει τον κανόνα connectivity)
 * με την επαλήθευση ότι το override **νικά** το stored και **αλλάζει το design**.
 */

import { buildBeamSectionContext } from '../section-context';
import { buildReinforcePatch } from '../reinforce-patch';
import { EUROCODE_PROVIDER } from '../codes/eurocode-provider';
import { barAreaMm2 } from '../rebar-catalog';
import { completeBeamFromTwoClicks } from '../../../hooks/drawing/beam-completion';
import type { BeamEntity } from '../../types/beam-types';
import type { AppliedMemberLoad } from '../loads/structural-loads-types';
import type { BeamReinforcement } from '../reinforcement/beam-reinforcement-types';

const provider = EUROCODE_PROVIDER;
const HEAVY_LINE: AppliedMemberLoad = { deadAxialKn: 220, liveAxialKn: 80 };

function makeBeam(reinforcement?: BeamReinforcement, appliedLoad?: AppliedMemberLoad): BeamEntity {
  const r = completeBeamFromTwoClicks({ x: 0, y: 0 }, { x: 6000, y: 0 }, 'L1');
  if (!r.ok) throw new Error('beam build failed: ' + r.hardErrors.join(','));
  return {
    ...r.entity,
    params: {
      ...r.entity.params,
      supportType: 'simple', // stored = αμφιέρειστο (η default)
      ...(reinforcement ? { reinforcement } : {}),
      ...(appliedLoad ? { appliedLoad } : {}),
    },
  };
}

const bottomMm2 = (r: BeamReinforcement): number => r.bottom.count * barAreaMm2(r.bottom.diameterMm);
const topMm2 = (r: BeamReinforcement): number => r.top.count * barAreaMm2(r.top.diameterMm);
const reinfOf = (params: unknown): BeamReinforcement =>
  (params as { reinforcement?: BeamReinforcement }).reinforcement!;

describe('ADR-486 — buildBeamSectionContext supportType override', () => {
  it('override νικά το stored supportType', () => {
    const beam = makeBeam();
    expect(buildBeamSectionContext(beam).supportType).toBe('simple'); // stored
    expect(buildBeamSectionContext(beam, 'cantilever').supportType).toBe('cantilever'); // override
  });

  it('απών override → stored fallback (μηδέν regression)', () => {
    const beam = makeBeam();
    expect(buildBeamSectionContext(beam, undefined).supportType).toBe('simple');
  });
});

describe('ADR-486 — buildReinforcePatch με topology-aware override', () => {
  it('πρόβολος (1 στήριξη) → περισσότερος κάτω χάλυβας από αμφιέρειστο', () => {
    const beam = makeBeam(undefined, HEAVY_LINE);
    const simplePatch = buildReinforcePatch(beam, provider, 'simple');
    const cantiPatch = buildReinforcePatch(beam, provider, 'cantilever');

    expect(simplePatch).not.toBeNull();
    expect(cantiPatch).not.toBeNull();
    // wL²/2 (πρόβολος) ≫ wL²/8 (αμφιέρειστο) → μεγαλύτερη απαίτηση κύριου οπλισμού.
    const simpleSteel = bottomMm2(reinfOf(simplePatch!.next)) + topMm2(reinfOf(simplePatch!.next));
    const cantiSteel = bottomMm2(reinfOf(cantiPatch!.next)) + topMm2(reinfOf(cantiPatch!.next));
    expect(cantiSteel).toBeGreaterThan(simpleSteel);
  });

  it('default (χωρίς override) === stored simple → re-study patch σταθερό', () => {
    // Ίδιο φορτίο, stored auto = simple-derived → χωρίς override μηδέν material diff (convergence).
    const seed = { ...provider.suggestBeamReinforcement(buildBeamSectionContext(makeBeam(undefined, HEAVY_LINE))), auto: true as const };
    const beam = makeBeam(seed, HEAVY_LINE);
    expect(buildReinforcePatch(beam, provider)).toBeNull(); // ίδιο = μηδέν patch
  });
});
