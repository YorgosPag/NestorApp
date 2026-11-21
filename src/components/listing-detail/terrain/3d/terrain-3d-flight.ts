/**
 * @fileoverview **Η ΠΤΗΣΗ ΤΗΣ ΚΑΜΕΡΑΣ** — από την τρέχουσα θέση σε μια όψη, με ακύρωση (ADR-920 §14.5).
 * @related `@/lib/motion/animate-frames` (ο χρόνος, με `AbortSignal`) · `@/lib/motion/easing` · `@/lib/a11y/reduced-motion`
 * @module components/listing-detail/terrain/3d/terrain-3d-flight
 *
 * 🔑 **Μία πτήση τη φορά**: νέα πτήση ακυρώνει την προηγούμενη και ξεκινά από **όπου βρίσκεται** η κάμερα — κανένα
 *   άλμα. Μόνο η **τρέχουσα** πτήση ξαναδίνει τον έλεγχο στον χρήστη όταν τελειώσει (η ακυρωμένη σιωπά).
 * 🔑 **Χωρίς χειρισμό κατά την πτήση**: το `OrbitControls` απενεργοποιείται, ώστε η αδράνεια του δαχτύλου να μην
 *   «παλεύει» με την κίνηση.
 * ♿ `prefers-reduced-motion` ⇒ διάρκεια 0: ένα καρέ, κατευθείαν στον προορισμό.
 */

import type * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { prefersReducedMotion } from '@/lib/a11y/reduced-motion';
import { animateFrames } from '@/lib/motion/animate-frames';
import { easeInOutCubic } from '@/lib/motion/easing';

import type { TerrainPose } from './terrain-3d-camera';

/** Διάρκεια πτήσης του κύβου / της επαναφοράς. */
export const TERRAIN_3D_FLIGHT_MS = 500;

export interface Terrain3dFlight {
  /** Πτήση στη θέση (`null` ⇒ καμία κίνηση). */
  flyTo(pose: TerrainPose | null): void;
  isFlying(): boolean;
  /** Σταματά χωρίς να επιστρέψει τον έλεγχο (για το `dispose`). */
  cancel(): void;
}

export interface Terrain3dFlightDeps {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly onFrame: () => void;
}

export function createTerrain3dFlight({ camera, controls, onFrame }: Terrain3dFlightDeps): Terrain3dFlight {
  let current: AbortController | null = null;

  const flyTo = (pose: TerrainPose | null): void => {
    if (pose === null) return;
    current?.abort();
    const mine = new AbortController();
    current = mine;
    controls.enabled = false;
    const from = { position: camera.position.clone(), target: controls.target.clone() };
    const duration = prefersReducedMotion() ? 0 : TERRAIN_3D_FLIGHT_MS;
    const step = (elapsed: number): void => {
      const t = duration > 0 ? easeInOutCubic(elapsed / duration) : 1;
      camera.position.lerpVectors(from.position, pose.position, t);
      controls.target.lerpVectors(from.target, pose.target, t);
      camera.lookAt(controls.target);
      onFrame();
    };
    animateFrames(duration, step, mine.signal)
      .catch(() => undefined)
      .finally(() => {
        if (current !== mine) return;
        current = null;
        controls.enabled = true;
        onFrame();
      });
  };

  return {
    flyTo,
    isFlying: () => current !== null,
    cancel: () => {
      const running = current;
      current = null;
      running?.abort();
    },
  };
}
