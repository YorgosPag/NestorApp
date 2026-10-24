/**
 * ADR-444 §Icons — subject → geometry registry for the MEP ribbon icons (pure).
 *
 * `Record<MepIconSubject, …>`: adding a subject to `MEP_ICON_SUBJECTS` without a
 * geometry here is a compile error — no subject can silently render blank.
 *
 * @see ./mep-icon-subjects-plan.ts    — elements drawn by their plan-symbol SSoT
 * @see ./mep-icon-subjects-network.ts — linear networks & generative tools
 */

import type { MepIconSubject } from './mep-icon-tokens';
import type { MepIconGeometry } from './mep-icon-geometry';
import {
  luminaireIcon, socketIcon, electricalPanelIcon, dataOutletIcon, commsRackIcon,
  manifoldIcon, plumbingFixtureIcon,
  drainageCollectorIcon, floorDrainIcon, drainRiserIcon,
  radiatorIcon, boilerIcon, waterHeaterIcon,
  airTerminalIcon, ahuIcon, sprinklerIcon, fireRiserIcon, gasMeterIcon, gasCookerIcon,
} from './mep-icon-subjects-plan';
import {
  pipeIcon, drainPipeIcon, ductIcon, underfloorIcon, pipeNetworkIcon, bathroomIcon,
} from './mep-icon-subjects-network';

const BUILDERS: Readonly<Record<MepIconSubject, () => MepIconGeometry>> = {
  luminaire: luminaireIcon,
  socket: socketIcon,
  'electrical-panel': electricalPanelIcon,
  'data-outlet': dataOutletIcon,
  'comms-rack': commsRackIcon,
  manifold: manifoldIcon,
  pipe: pipeIcon,
  'pipe-network': pipeNetworkIcon,
  wc: () => plumbingFixtureIcon('wc'),
  washbasin: () => plumbingFixtureIcon('washbasin'),
  shower: () => plumbingFixtureIcon('shower'),
  bathtub: () => plumbingFixtureIcon('bathtub'),
  bidet: () => plumbingFixtureIcon('bidet'),
  'washing-machine': () => plumbingFixtureIcon('washing-machine'),
  bathroom: bathroomIcon,
  'drainage-collector': drainageCollectorIcon,
  'drain-pipe': drainPipeIcon,
  'floor-drain': floorDrainIcon,
  'drain-riser': drainRiserIcon,
  radiator: radiatorIcon,
  boiler: boilerIcon,
  'water-heater': waterHeaterIcon,
  underfloor: underfloorIcon,
  duct: ductIcon,
  'air-terminal': airTerminalIcon,
  ahu: ahuIcon,
  sprinkler: sprinklerIcon,
  'fire-riser': fireRiserIcon,
  'gas-meter': gasMeterIcon,
  'gas-cooker': gasCookerIcon,
};

const cache = new Map<MepIconSubject, MepIconGeometry>();

/**
 * The (memoised) icon geometry of a subject. The geometry is a pure function of
 * authored constants, so it is computed once per subject per session.
 */
export function resolveMepIconGeometry(subject: MepIconSubject): MepIconGeometry {
  const hit = cache.get(subject);
  if (hit) return hit;
  const geometry = BUILDERS[subject]();
  cache.set(subject, geometry);
  return geometry;
}
