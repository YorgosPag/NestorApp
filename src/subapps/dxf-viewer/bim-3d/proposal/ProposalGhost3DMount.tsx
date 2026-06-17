'use client';

/**
 * ProposalGhost3DMount — the discipline-aware assembler for the 3D MEP auto-design proposal
 * ghost. It subscribes to all seven LOW-FREQUENCY proposal stores (a fixed hook count), finds
 * the ONE under review (only one discipline generates at a time), and builds its translucent
 * `THREE.Object3D`s via the pure builders, then hands them to the generic
 * {@link ProposalGhost3DOverlay} which owns the scene lifecycle.
 *
 *   - electrical (strong + weak, shared store) → one conduit per circuit via `buildElectricalGhost3D`;
 *   - the six pipe/duct/fuel disciplines → one tube per proposed segment via `buildSegmentGhost3D`
 *     (their networks flatten through the shared `pipeNetworksToGhostTubes`, so there is no
 *     per-discipline branch — they share the same review shape + SSoT classification colour).
 *
 * `useMemo` keeps the object array referentially stable between unrelated viewport re-renders
 * (the stores only mutate on Generate/Accept/Reject), so the overlay effect runs only on a real
 * proposal transition — never per frame.
 *
 * @see ./proposal-ghost-3d-builders.ts — pure object builders
 * @see ../viewport/BimViewport3D.tsx — mounts this beside ClashMarkers3DOverlay
 */

import React, { useMemo, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import type { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { ProposalGhost3DOverlay } from './ProposalGhost3DOverlay';
import {
  buildElectricalGhost3D,
  buildSegmentGhost3D,
  pipeNetworksToGhostTubes,
} from './proposal-ghost-3d-builders';
import { useWaterProposal } from '../../systems/mep-design/water/water-proposal-store';
import { useDrainageProposal } from '../../systems/mep-design/drainage/drainage-proposal-store';
import { useHeatingProposal } from '../../systems/mep-design/heating/heating-proposal-store';
import { useHvacProposal } from '../../systems/mep-design/hvac/hvac-proposal-store';
import { useFireProposal } from '../../systems/mep-design/fire/fire-proposal-store';
import { useGasProposal } from '../../systems/mep-design/gas/gas-proposal-store';
import { useElectricalProposal } from '../../systems/mep-design/electrical/electrical-proposal-store';

export interface ProposalGhost3DMountProps {
  readonly managerRef: MutableRefObject<ThreeJsSceneManager | null>;
}

export function ProposalGhost3DMount({ managerRef }: ProposalGhost3DMountProps): React.ReactElement {
  const water = useWaterProposal();
  const drainage = useDrainageProposal();
  const heating = useHeatingProposal();
  const hvac = useHvacProposal();
  const fire = useFireProposal();
  const gas = useGasProposal();
  const electrical = useElectricalProposal();

  const objects = useMemo<THREE.Object3D[] | null>(() => {
    if (electrical) return buildElectricalGhost3D(electrical.wirePaths, electrical.sceneUnits);
    // Drainage roots at the collector invert (gravity sink), not a pressurised source
    // outlet — normalize its network datum (`outfallInvertElevationMm`) to the shared
    // ghost-network shape so it flattens through the same SSoT as the other disciplines.
    if (drainage) {
      const networks = drainage.proposal.networks.map((n) => ({
        sourceElevationMm: n.outfallInvertElevationMm,
        classification: n.classification,
        segments: n.segments,
      }));
      return buildSegmentGhost3D(pipeNetworksToGhostTubes(networks), drainage.sceneUnits);
    }
    // Exactly one discipline is ever active; the five pressurised pipe/duct/fuel reviews
    // share one shape (flat source datum).
    const pipe = water ?? heating ?? hvac ?? fire ?? gas;
    if (pipe) return buildSegmentGhost3D(pipeNetworksToGhostTubes(pipe.proposal.networks), pipe.sceneUnits);
    return null;
  }, [water, drainage, heating, hvac, fire, gas, electrical]);

  return <ProposalGhost3DOverlay managerRef={managerRef} objects={objects} />;
}
